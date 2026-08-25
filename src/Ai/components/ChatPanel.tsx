"use client";

import ArrowUpwardIcon from "@mui/icons-material/ArrowUpward";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import KeyboardDoubleArrowRightIcon from "@mui/icons-material/KeyboardDoubleArrowRight";
import RestartAltIcon from "@mui/icons-material/RestartAlt";
import StopIcon from "@mui/icons-material/Stop";
import {
  Box,
  CircularProgress,
  IconButton,
  InputBase,
  Tooltip,
  Typography,
} from "@mui/material";
import React, { useEffect, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
  chatPanelDefaultWidth,
  chatPanelMaxWidth,
  chatPanelMinWidth,
  editorCardShadow,
} from "../../constants";
import { toggleAiChat } from "../../Sidebars/actions";
import State from "../../stateInterface";
import { TranscriptEntry, useAiChat } from "../useAiChat";

// A card of its own, sitting beside the editor card rather than inside it. It
// stays mounted while closed (hidden with `display`) so the conversation
// survives closing and reopening the panel.

const SUGGESTIONS = [
  "Add a neuron in the middle and label it",
  "Place a T cell and a cancer cell side by side",
  "Add a title at the top of the frame",
];

const BORDER = "solid 1px #ddd";

function Entry({ entry }: { entry: TranscriptEntry }) {
  if (entry.role === "user") {
    return (
      <Box sx={{ display: "flex", justifyContent: "flex-end", mb: 2 }}>
        <Box
          sx={{
            maxWidth: "88%",
            px: 1.5,
            py: 1,
            borderRadius: "14px",
            bgcolor: "#f1f2f4",
            color: "#111",
            fontSize: 14,
            lineHeight: 1.5,
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
          }}
        >
          {entry.text}
        </Box>
      </Box>
    );
  }

  if (entry.role === "tool") {
    return (
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 0.75,
          mb: 1,
          color: "#8a8f98",
          fontSize: 12.5,
        }}
      >
        <Box
          sx={{
            width: 5,
            height: 5,
            borderRadius: "50%",
            bgcolor: "#c3c7ce",
            flexShrink: 0,
          }}
        />
        <Box sx={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
          {entry.text}
        </Box>
      </Box>
    );
  }

  if (entry.role === "error") {
    return (
      <Box
        sx={{
          mb: 2,
          px: 1.5,
          py: 1,
          borderRadius: "12px",
          bgcolor: "#fdecea",
          color: "#611a15",
          fontSize: 13.5,
          lineHeight: 1.5,
          whiteSpace: "pre-wrap",
          wordBreak: "break-word",
        }}
      >
        {entry.text}
      </Box>
    );
  }

  return (
    <Box
      sx={{
        mb: 2,
        color: "#1a1c1f",
        fontSize: 14,
        lineHeight: 1.6,
        whiteSpace: "pre-wrap",
        wordBreak: "break-word",
      }}
    >
      {entry.text}
    </Box>
  );
}

export default function ChatPanel() {
  const dispatch = useDispatch();
  const isOpen = useSelector((state: State) => state.sidebars.isAiChatOpen);

  const [width, setWidth] = useState(chatPanelDefaultWidth);
  const [isResizing, setIsResizing] = useState(false);
  const [draft, setDraft] = useState("");
  const { transcript, isBusy, send, stop, reset } = useAiChat();
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [transcript, isBusy]);

  // Drag the left edge to resize. Start state lives in a ref so the window
  // listeners can stay mounted once instead of rebinding on every pixel.
  const dragRef = useRef<{ startX: number; startWidth: number } | null>(null);
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      const drag = dragRef.current;
      if (!drag) return;
      const next = drag.startWidth - (e.clientX - drag.startX);
      setWidth(
        Math.min(chatPanelMaxWidth, Math.max(chatPanelMinWidth, next)),
      );
    };
    const onUp = () => {
      if (!dragRef.current) return;
      dragRef.current = null;
      setIsResizing(false);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, []);

  const submit = () => {
    const text = draft.trim();
    if (!text || isBusy) return;
    setDraft("");
    void send(text);
  };

  return (
    <>
      {/*
        While dragging, this overlay takes every pointer event so the Konva stage
        underneath doesn't start a selection and text doesn't highlight.
      */}
      {isResizing && (
        <Box
          sx={{
            position: "fixed",
            inset: 0,
            zIndex: 2000,
            cursor: "col-resize",
          }}
        />
      )}
      {/*
        Two boxes: the outer one is the positioning context for the drag handle,
        which sits in the gutter between the cards and so must not be clipped by
        the card's own `overflow: hidden`.
      */}
      <Box
        sx={{
          position: "relative",
          width,
          flexShrink: 0,
          display: isOpen ? "flex" : "none",
          minHeight: 0,
        }}
      >
        <Box
          onMouseDown={(e) => {
            e.preventDefault();
            dragRef.current = { startX: e.clientX, startWidth: width };
            setIsResizing(true);
          }}
          sx={{
            position: "absolute",
            left: -11,
            top: 0,
            bottom: 0,
            width: 6,
            borderRadius: 3,
            cursor: "col-resize",
            zIndex: 10,
            "&:hover": { bgcolor: "rgba(21, 62, 49, 0.22)" },
          }}
        />

        <Box
          sx={{
            flexGrow: 1,
            minWidth: 0,
            bgcolor: "#fff",
            borderRadius: 3,
            boxShadow: editorCardShadow,
            display: "flex",
            flexDirection: "column",
            minHeight: 0,
            overflow: "hidden",
          }}
        >
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 1,
              px: 1.5,
              py: 1,
              borderBottom: BORDER,
              flexShrink: 0,
            }}
          >
            <AutoAwesomeIcon fontSize="small" color="primary" />
            <Typography variant="subtitle2" sx={{ flexGrow: 1 }}>
              Build with AI
            </Typography>
            {transcript.length > 0 && (
              <Tooltip title="Clear conversation">
                <IconButton size="small" onClick={reset} disabled={isBusy}>
                  <RestartAltIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            )}
            <Tooltip title="Close">
              <IconButton
                size="small"
                onClick={() => dispatch(toggleAiChat())}
              >
                <KeyboardDoubleArrowRightIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Box>

          <Box
            ref={scrollRef}
            sx={{ flexGrow: 1, minHeight: 0, overflowY: "auto", px: 2, py: 1.5 }}
          >
            {transcript.length === 0 && (
              <>
                <Typography
                  variant="body2"
                  sx={{ color: "#777", fontSize: 13.5, mb: 1.5 }}
                >
                  Describe what you want on this frame and I&apos;ll build it.
                </Typography>
                {SUGGESTIONS.map((s) => (
                  <Box
                    key={s}
                    onClick={() => setDraft(s)}
                    sx={{
                      mb: 1,
                      px: 1.25,
                      py: 0.75,
                      border: BORDER,
                      borderRadius: "10px",
                      fontSize: 13,
                      color: "#444",
                      cursor: "pointer",
                      "&:hover": { bgcolor: "#f7f7f8", color: "#111" },
                    }}
                  >
                    {s}
                  </Box>
                ))}
              </>
            )}
            {transcript.map((entry) => (
              <Entry key={entry.id} entry={entry} />
            ))}
            {isBusy && (
              <Box sx={{ display: "flex", alignItems: "center", gap: 1, mt: 1 }}>
                <CircularProgress size={14} />
                <Typography variant="caption" sx={{ color: "#777" }}>
                  Working…
                </Typography>
              </Box>
            )}
          </Box>

          <Box sx={{ p: 1.5, flexShrink: 0 }}>
            <Box
              sx={{
                border: BORDER,
                borderRadius: "14px",
                px: 1.5,
                pt: 1.25,
                pb: 1,
                "&:focus-within": { borderColor: "primary.main" },
              }}
            >
              <InputBase
                multiline
                maxRows={8}
                value={draft}
                disabled={isBusy}
                placeholder="Describe what you'd like to create…"
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  // Enter sends, Shift+Enter newlines. The canvas has global key
                  // handlers (⌘G grouping, delete); stopping propagation keeps
                  // typing in here from triggering them.
                  e.stopPropagation();
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    submit();
                  }
                }}
                sx={{ width: "100%", fontSize: 14 }}
              />
              <Box sx={{ display: "flex", justifyContent: "flex-end", mt: 0.5 }}>
                {/*
                  Same button, two jobs: while a turn is running it stops it, so
                  the control the user reaches for is always in the same place.
                */}
                <IconButton
                  size="small"
                  aria-label={isBusy ? "Stop" : "Send"}
                  title={isBusy ? "Stop" : undefined}
                  disabled={!isBusy && !draft.trim()}
                  onClick={isBusy ? stop : submit}
                  sx={{
                    bgcolor: "primary.main",
                    color: "#fff",
                    "&:hover": { bgcolor: "primary.dark" },
                    "&.Mui-disabled": { bgcolor: "#e8e8ea", color: "#b0b0b4" },
                  }}
                >
                  {isBusy ? (
                    <StopIcon fontSize="small" />
                  ) : (
                    <ArrowUpwardIcon fontSize="small" />
                  )}
                </IconButton>
              </Box>
            </Box>
          </Box>
        </Box>
      </Box>
    </>
  );
}
