"use client";

import { useCallback, useRef, useState } from "react";
import { useStore } from "react-redux";
import { StoreLike } from "./dispatch";
import { executeTool } from "./executor";
import { projectPresentation } from "./stateProjection";

// The agent loop. It runs here rather than on the server because the tools
// mutate the Redux store, which only exists in the browser — the server route is
// a stateless proxy that holds the API key. One turn is: send → model replies
// with tool calls → dispatch them → send the results back → repeat until the
// model stops calling tools.
//
// Minimal local types instead of importing the Anthropic SDK: the SDK is a
// server dependency and there is no reason to ship it to the browser.

interface ToolUseBlock {
  type: "tool_use";
  id: string;
  name: string;
  input: any;
}
interface TextBlock {
  type: "text";
  text: string;
}
type ContentBlock = ToolUseBlock | TextBlock | { type: string; [k: string]: any };

interface ApiMessage {
  role: "user" | "assistant";
  content: string | ContentBlock[];
}

export interface TranscriptEntry {
  id: string;
  role: "user" | "assistant" | "tool" | "error";
  text: string;
}

// A turn is a handful of tool calls, not an open-ended run. Hitting this stops
// cleanly with a message rather than looping on the user's budget.
const MAX_ITERATIONS = 12;

// Abort reason that tells the running turn its history was thrown away.
const RESET = "reset";

const isToolUse = (b: ContentBlock): b is ToolUseBlock => b.type === "tool_use";
const isText = (b: ContentBlock): b is TextBlock => b.type === "text";

let entrySeq = 0;
const nextEntryId = () => `e${++entrySeq}`;

export function useAiChat() {
  const store = useStore() as unknown as StoreLike;
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);
  const [isBusy, setIsBusy] = useState(false);

  // The full API-shaped history, including tool_use / tool_result blocks. Kept
  // in a ref rather than state: it is not rendered directly (the transcript is),
  // and the loop below needs to read it synchronously between iterations.
  const history = useRef<ApiMessage[]>([]);

  // Set for the duration of a turn so the stop button can abort the in-flight
  // request and short-circuit the loop.
  const abort = useRef<AbortController | null>(null);

  const append = useCallback((role: TranscriptEntry["role"], text: string) => {
    setTranscript((t) => [...t, { id: nextEntryId(), role, text }]);
  }, []);

  const send = useCallback(
    async (userText: string) => {
      const trimmed = userText.trim();
      if (!trimmed || isBusy) return;

      append("user", trimmed);
      history.current = [
        ...history.current,
        { role: "user", content: trimmed },
      ];
      setIsBusy(true);

      const controller = new AbortController();
      abort.current = controller;
      const stopped = () => controller.signal.aborted;
      // A reset aborts too, but it has already emptied the history — writing
      // this turn's tail into it would leave orphaned tool results behind.
      const wasReset = () => controller.signal.reason === RESET;

      try {
        for (let i = 0; i < MAX_ITERATIONS; i++) {
          // Re-projected every iteration rather than captured once at the start
          // of the turn, so the model sees its own edits — and anything the user
          // changed on the canvas mid-turn.
          const presentationState = projectPresentation(
            store.getState().frames,
          );

          const res = await fetch("/api/chat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              messages: history.current,
              presentationState,
            }),
            signal: controller.signal,
          });

          const data = await res.json();

          if (!res.ok) {
            append("error", data?.error ?? "The assistant failed to respond.");
            return;
          }
          if (data.refusal) {
            append("assistant", data.message);
            return;
          }

          const content: ContentBlock[] = data.content ?? [];
          history.current = [
            ...history.current,
            { role: "assistant", content },
          ];

          for (const block of content) {
            if (isText(block) && block.text.trim()) {
              append("assistant", block.text.trim());
            }
          }

          const toolUses = content.filter(isToolUse);
          if (data.stop_reason !== "tool_use" || toolUses.length === 0) return;

          // Execute sequentially: each one dispatches into the store, and the
          // next call's placement decisions depend on the resulting state.
          const results = [];
          for (const call of toolUses) {
            // Every tool_use needs a result even when the user stops mid-run —
            // an unanswered one makes the whole history invalid, so the next
            // message the user sends would be rejected by the API.
            if (stopped()) {
              results.push({
                type: "tool_result" as const,
                tool_use_id: call.id,
                content: "The user stopped the turn before this ran.",
                is_error: true,
              });
              continue;
            }
            append("tool", describeToolCall(call));
            const outcome = await executeTool(store, call.name, call.input);
            results.push({
              type: "tool_result" as const,
              tool_use_id: call.id,
              content: outcome.content,
              ...(outcome.isError ? { is_error: true } : {}),
            });
          }

          if (wasReset()) return;

          // All results go back in ONE user message. Splitting them across
          // several messages trains the model out of making parallel calls.
          history.current = [
            ...history.current,
            { role: "user", content: results },
          ];

          if (stopped()) return;
        }

        append(
          "error",
          "That took more steps than I allow in one turn. Tell me the next bit and I'll carry on.",
        );
      } catch (error: any) {
        // An aborted fetch is the stop button doing its job, not a failure.
        if (!stopped()) {
          append("error", error?.message ?? "Something went wrong.");
        }
      } finally {
        if (stopped() && !wasReset()) append("tool", "Stopped.");
        if (abort.current === controller) abort.current = null;
        setIsBusy(false);
      }
    },
    [append, isBusy, store],
  );

  // Ends the turn where it stands. Tool calls that already ran stay applied to
  // the canvas — the user can undo them — and the history is left in a shape the
  // next message can continue from.
  const stop = useCallback(() => {
    abort.current?.abort();
  }, []);

  const reset = useCallback(() => {
    abort.current?.abort(RESET);
    history.current = [];
    setTranscript([]);
  }, []);

  return { transcript, isBusy, send, stop, reset };
}

function describeToolCall(call: ToolUseBlock): string {
  const input = call.input ?? {};
  switch (call.name) {
    case "search_sprites":
      return `Searching for “${input.query}”…`;
    case "add_sprite":
      return `Placing ${input.name ? `“${input.name}”` : "a sprite"}…`;
    case "add_text":
      return `Adding text “${input.text}”…`;
    default:
      return `Running ${call.name}…`;
  }
}
