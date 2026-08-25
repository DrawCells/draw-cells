import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "../../../lib/auth";
import { SYSTEM_PROMPT } from "../../../src/Ai/systemPrompt";
import { AI_TOOLS } from "../../../src/Ai/tools";

// Thin authenticated proxy to the Messages API.
//
// The agent loop itself runs in the browser (see useAiChat), because that is
// where the Redux store lives and tools have to dispatch into it. This route
// exists to hold the API key and to own the system prompt and tool definitions,
// neither of which the client is allowed to supply.

const MODEL = "claude-opus-5";

// Generous, but bounded: adaptive thinking shares this budget with the reply,
// and a tool-calling turn is short. Non-streaming is fine at this size; Phase 3
// switches to streaming for the typing-indicator UX, not for timeout headroom.
const MAX_TOKENS = 16000;

// A turn is a few tool calls, not an open-ended agent run. The client counts
// iterations too; this is the backstop that bounds cost per request.
const MAX_STATE_CHARS = 40_000;

export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: "The AI chat is not configured: ANTHROPIC_API_KEY is not set." },
      { status: 503 },
    );
  }

  const { messages, presentationState } = await req.json();
  if (!Array.isArray(messages) || messages.length === 0) {
    return NextResponse.json({ error: "messages are required" }, { status: 400 });
  }

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  // The current canvas rides as a trailing system message rather than inside the
  // system prompt. Both are operator-authority channels the user cannot forge,
  // but appending here leaves the cached prefix (tools + system + history)
  // untouched, where rebuilding the system prompt each turn would re-bill it.
  // Placement rules: it must follow a user message and be last — which holds
  // both for a fresh user turn and for a turn carrying tool results.
  const state =
    typeof presentationState === "string"
      ? presentationState.slice(0, MAX_STATE_CHARS)
      : "";
  const withState = state
    ? [
        ...messages,
        {
          role: "system" as const,
          content: `Current presentation state:\n\n${state}`,
        },
      ]
    : messages;

  try {
    const response = await client.beta.messages.create({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      // Safety classifiers occasionally decline benign life-sciences wording.
      // "default" re-runs the request on Anthropic's recommended fallback model
      // server-side, routed by refusal category, instead of failing the turn.
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      system: [
        {
          type: "text",
          text: SYSTEM_PROMPT,
          cache_control: { type: "ephemeral" },
        },
      ],
      tools: AI_TOOLS,
      messages: withState,
    });

    // Check stop_reason before reading content: a refusal can arrive with an
    // empty content array, so anything indexing content[0] breaks here.
    if (response.stop_reason === "refusal") {
      return NextResponse.json({
        refusal: true,
        message:
          "I can't help with that request. Try rephrasing what you'd like on the canvas.",
      });
    }

    return NextResponse.json({
      content: response.content,
      stop_reason: response.stop_reason,
      usage: response.usage,
    });
  } catch (error: any) {
    // Surface the model's own error text for 4xx (bad request, rate limit) so
    // the client can show something actionable, but never leak internals.
    const status = error?.status ?? 500;
    console.error("AI chat request failed", error);
    return NextResponse.json(
      {
        error:
          status === 429
            ? "The assistant is rate limited right now. Try again shortly."
            : "The assistant failed to respond.",
      },
      { status: status >= 400 && status < 500 ? status : 500 },
    );
  }
}
