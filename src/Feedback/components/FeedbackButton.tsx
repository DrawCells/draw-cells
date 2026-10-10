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
import { toJpeg } from "html-to-image";
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

async function captureScreenshot(): Promise<string | null> {
  try {
    return await toJpeg(document.body, {
      quality: 0.8,
      pixelRatio: 1,
      skipFonts: true,
      width: window.innerWidth,
      height: window.innerHeight,
      filter: (node) => !(node instanceof HTMLElement && node.hasAttribute(IGNORE_ATTR)),
    });
  } catch (err) {
    // e.g. a cross-origin image tainting a canvas — send the report without it.
    console.warn("Feedback screenshot failed", err);
    return null;
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
