"use client";

import FeedbackOutlined from "@mui/icons-material/FeedbackOutlined";
import {
  Alert,
  Box,
  Button,
  Checkbox,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  IconButton,
  Snackbar,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
} from "@mui/material";
import { toSvg } from "html-to-image";
import { useParams, usePathname } from "next/navigation";
import React, { useState } from "react";
import {
  FEEDBACK_MESSAGE_MAX,
  FEEDBACK_TYPES,
  FEEDBACK_TYPE_LABELS,
  FeedbackType,
} from "../types";

const PLACEHOLDERS: Record<FeedbackType, string> = {
  bug: "What happened, and what did you expect to happen?",
  feature: "What would you like to be able to do?",
  other: "Tell us what's on your mind",
};

// Marks the dialog so the screenshot (taken while it opens) leaves it out.
const IGNORE_ATTR = "data-feedback-ignore";

// Tags scrolled elements with their offset so it can be re-applied in the
// rendered copy, which html-to-image always lays out at scroll 0.
const SCROLL_ATTR = "data-feedback-scroll";
const SVG_PREFIX = "data:image/svg+xml;charset=utf-8,";

function tagScrolledElements(): HTMLElement[] {
  const tagged: HTMLElement[] = [];
  document.body.querySelectorAll<HTMLElement>("*").forEach((el) => {
    if ((el.scrollTop || el.scrollLeft) && !el.closest(`[${IGNORE_ATTR}]`)) {
      el.setAttribute(SCROLL_ATTR, `${el.scrollLeft},${el.scrollTop}`);
      tagged.push(el);
    }
  });
  return tagged;
}

// Shifts the children of each tagged element by its scroll offset. We don't
// scroll the live elements instead because e.g. the canvas repositions its
// stage on scroll.
function applyScrollOffsets(svgUrl: string): string {
  const doc = new DOMParser().parseFromString(
    decodeURIComponent(svgUrl.slice(SVG_PREFIX.length)),
    "image/svg+xml"
  );
  doc.querySelectorAll(`[${SCROLL_ATTR}]`).forEach((el) => {
    const [x, y] = el.getAttribute(SCROLL_ATTR)!.split(",").map(Number);
    Array.from(el.children).forEach((child) => {
      if (!(child instanceof HTMLElement) || child.style.position === "fixed") return;
      const existing = child.style.transform === "none" ? "" : child.style.transform;
      child.style.transform = `translate(${-x}px, ${-y}px) ${existing}`;
    });
  });
  return SVG_PREFIX + encodeURIComponent(new XMLSerializer().serializeToString(doc));
}

async function svgToJpeg(svgUrl: string, width: number, height: number): Promise<string> {
  const img = new Image();
  img.src = svgUrl;
  await img.decode();
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  canvas.getContext("2d")!.drawImage(img, 0, 0, width, height);
  return canvas.toDataURL("image/jpeg", 0.8);
}

async function captureScreenshot(): Promise<string | null> {
  const { innerWidth: width, innerHeight: height, scrollX, scrollY } = window;
  const tagged = tagScrolledElements();
  try {
    const svg = await toSvg(document.body, {
      skipFonts: true,
      width,
      height,
      // Window scroll: shift the page up/left. `top`/`left` rather than a
      // transform so fixed elements (e.g. the header) stay where they are.
      style: {
        position: "relative",
        left: `${-scrollX}px`,
        top: `${-scrollY}px`,
        width: `${width + scrollX}px`,
        height: `${height + scrollY}px`,
        overflow: "visible",
      },
      filter: (node) => !(node instanceof HTMLElement && node.hasAttribute(IGNORE_ATTR)),
    });
    return await svgToJpeg(tagged.length ? applyScrollOffsets(svg) : svg, width, height);
  } catch (err) {
    // e.g. a cross-origin image tainting a canvas — send the report without it.
    console.warn("Feedback screenshot failed", err);
    return null;
  } finally {
    tagged.forEach((el) => el.removeAttribute(SCROLL_ATTR));
  }
}

interface FeedbackButtonProps {
  // Icon-only, for the crowded editor toolbar.
  compact?: boolean;
}

const FeedbackButton = ({ compact = false }: FeedbackButtonProps) => {
  const pathname = usePathname();
  const params = useParams<{ id?: string }>();
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<FeedbackType>("bug");
  const [message, setMessage] = useState("");
  const [screenshot, setScreenshot] = useState<string | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [includeScreenshot, setIncludeScreenshot] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const handleOpen = () => {
    setOpen(true);
    setError(null);
    setScreenshot(null);
    setIsCapturing(true);
    captureScreenshot().then((shot) => {
      setScreenshot(shot);
      setIsCapturing(false);
    });
  };

  const handleClose = () => {
    if (isSending) return;
    setOpen(false);
  };

  const handleSubmit = async () => {
    setIsSending(true);
    setError(null);
    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type,
          message,
          pageUrl: window.location.href,
          presentationId: pathname?.startsWith("/presentations/") ? params?.id : undefined,
          viewport: `${window.innerWidth}x${window.innerHeight}`,
          screenshot: includeScreenshot ? screenshot : undefined,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || "Could not send feedback");
      }
      setOpen(false);
      setMessage("");
      setType("bug");
      setSent(true);
    } catch (err: any) {
      setError(err.message || "Could not send feedback");
    } finally {
      setIsSending(false);
    }
  };

  const trimmedLength = message.trim().length;

  return (
    <>
      {compact ? (
        <Tooltip title="Send feedback">
          <IconButton color="inherit" size="small" onClick={handleOpen} sx={{ mr: 1 }}>
            <FeedbackOutlined />
          </IconButton>
        </Tooltip>
      ) : (
        <Button
          color="inherit"
          startIcon={<FeedbackOutlined />}
          onClick={handleOpen}
          sx={{ mr: 1, "&:hover": { bgcolor: "rgba(255,255,255,0.1)" } }}
        >
          Feedback
        </Button>
      )}

      <Dialog
        open={open}
        onClose={handleClose}
        fullWidth
        maxWidth="sm"
        {...{ [IGNORE_ATTR]: "" }}
      >
        <DialogTitle>Send feedback</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <ToggleButtonGroup
              value={type}
              exclusive
              size="small"
              color="primary"
              onChange={(_, value) => value && setType(value)}
            >
              {FEEDBACK_TYPES.map((t) => (
                <ToggleButton key={t} value={t} sx={{ textTransform: "none" }}>
                  {FEEDBACK_TYPE_LABELS[t]}
                </ToggleButton>
              ))}
            </ToggleButtonGroup>

            <TextField
              autoFocus
              multiline
              minRows={5}
              placeholder={PLACEHOLDERS[type]}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              slotProps={{ htmlInput: { maxLength: FEEDBACK_MESSAGE_MAX } }}
              helperText={
                message.length > FEEDBACK_MESSAGE_MAX * 0.9
                  ? `${message.length} / ${FEEDBACK_MESSAGE_MAX}`
                  : " "
              }
            />

            <Box>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={includeScreenshot}
                    onChange={(e) => setIncludeScreenshot(e.target.checked)}
                    disabled={!isCapturing && !screenshot}
                  />
                }
                label={
                  !isCapturing && !screenshot
                    ? "Screenshot unavailable for this page"
                    : "Include a screenshot of the page"
                }
              />
              {isCapturing && (
                <Stack direction="row" spacing={1} alignItems="center" sx={{ ml: 4 }}>
                  <CircularProgress size={14} />
                  <Typography variant="caption" color="text.secondary">
                    Capturing screenshot…
                  </Typography>
                </Stack>
              )}
              {screenshot && includeScreenshot && (
                <Box
                  component="img"
                  src={screenshot}
                  alt="Screenshot that will be attached"
                  sx={{
                    display: "block",
                    ml: 4,
                    maxWidth: 240,
                    border: 1,
                    borderColor: "divider",
                    borderRadius: 1,
                  }}
                />
              )}
            </Box>

            <Typography variant="caption" color="text.secondary">
              We'll also include the page you're on and your browser details so we can
              look into it.
            </Typography>

            {error && <Alert severity="error">{error}</Alert>}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClose} disabled={isSending}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleSubmit}
            disabled={isSending || isCapturing || trimmedLength === 0}
          >
            {isSending ? "Sending…" : "Send"}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={sent}
        autoHideDuration={4000}
        onClose={() => setSent(false)}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert severity="success" variant="filled" onClose={() => setSent(false)}>
          Thanks! Your feedback was sent.
        </Alert>
      </Snackbar>
    </>
  );
};

export default FeedbackButton;
