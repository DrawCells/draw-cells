"use client";

import Close from "@mui/icons-material/Close";
import {
  Box,
  Button,
  Chip,
  Container,
  Drawer,
  IconButton,
  Link,
  MenuItem,
  Paper,
  Select,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";
import React, { useMemo, useState, useTransition } from "react";
import { updateFeedback } from "../actions";
import {
  FEEDBACK_STATUSES,
  FEEDBACK_STATUS_LABELS,
  FEEDBACK_TYPES,
  FEEDBACK_TYPE_LABELS,
  FeedbackItem,
  FeedbackStatus,
  FeedbackType,
} from "../../Feedback/types";

const TYPE_COLORS: Record<FeedbackType, "error" | "info" | "default"> = {
  bug: "error",
  feature: "info",
  other: "default",
};

const STATUS_COLORS: Record<FeedbackStatus, "warning" | "info" | "success" | "default"> = {
  new: "warning",
  in_progress: "info",
  done: "success",
  wont_fix: "default",
};

// "Open" hides finished items, which is what triage usually wants.
type StatusFilter = "open" | "all" | FeedbackStatus;

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function StatusSelect({
  value,
  onChange,
}: {
  value: FeedbackStatus;
  onChange: (status: FeedbackStatus) => void;
}) {
  return (
    <Select
      size="small"
      value={value}
      onChange={(e) => onChange(e.target.value as FeedbackStatus)}
      onClick={(e) => e.stopPropagation()}
      renderValue={(v) => (
        <Chip label={FEEDBACK_STATUS_LABELS[v]} size="small" color={STATUS_COLORS[v]} />
      )}
      sx={{ "& .MuiSelect-select": { py: 0.5 } }}
    >
      {FEEDBACK_STATUSES.map((s) => (
        <MenuItem key={s} value={s}>
          {FEEDBACK_STATUS_LABELS[s]}
        </MenuItem>
      ))}
    </Select>
  );
}

function Detail({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <Box>
      <Typography variant="caption" color="GrayText">
        {label}
      </Typography>
      <Typography variant="body2" component="div" sx={{ wordBreak: "break-word" }}>
        {children || "—"}
      </Typography>
    </Box>
  );
}

export default function FeedbackList({ items: initialItems }: { items: FeedbackItem[] }) {
  const [items, setItems] = useState(initialItems);
  const [typeFilter, setTypeFilter] = useState<FeedbackType | "all">("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("open");
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [notesDraft, setNotesDraft] = useState("");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isSaving, startSaving] = useTransition();

  const selected = items.find((i) => i.id === selectedId) ?? null;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((i) => {
      if (typeFilter !== "all" && i.type !== typeFilter) return false;
      if (statusFilter === "open" && (i.status === "done" || i.status === "wont_fix"))
        return false;
      if (statusFilter !== "open" && statusFilter !== "all" && i.status !== statusFilter)
        return false;
      return (
        !q ||
        i.message.toLowerCase().includes(q) ||
        i.email?.toLowerCase().includes(q) ||
        i.adminNotes?.toLowerCase().includes(q)
      );
    });
  }, [items, typeFilter, statusFilter, query]);

  // Optimistic: apply locally, roll back if the server refuses.
  const save = (id: string, changes: { status?: FeedbackStatus; adminNotes?: string }) => {
    const previous = items;
    setSaveError(null);
    setItems((list) =>
      list.map((i) =>
        i.id === id
          ? {
              ...i,
              ...(changes.status && { status: changes.status }),
              ...(changes.adminNotes !== undefined && {
                adminNotes: changes.adminNotes.trim() || null,
              }),
            }
          : i,
      ),
    );
    startSaving(async () => {
      const res = await updateFeedback(id, changes);
      if (!res.success) {
        setItems(previous);
        setSaveError("Could not save the change.");
      }
    });
  };

  const openDetail = (item: FeedbackItem) => {
    setSelectedId(item.id);
    setNotesDraft(item.adminNotes ?? "");
    setSaveError(null);
  };

  const newCount = items.filter((i) => i.status === "new").length;

  return (
    <Container maxWidth={false} sx={{ mt: 3, mb: 4 }}>
      <Stack
        direction={{ xs: "column", md: "row" }}
        justifyContent="space-between"
        alignItems={{ xs: "flex-start", md: "center" }}
        spacing={2}
        sx={{ mb: 2 }}
      >
        <Typography variant="h5">
          Feedback{" "}
          <Typography component="span" variant="h6" color="GrayText">
            ({newCount} new)
          </Typography>
        </Typography>
        <Stack direction="row" spacing={1.5} flexWrap="wrap" useFlexGap>
          <ToggleButtonGroup
            size="small"
            exclusive
            value={typeFilter}
            onChange={(_, v) => v && setTypeFilter(v)}
          >
            <ToggleButton value="all">All</ToggleButton>
            {FEEDBACK_TYPES.map((t) => (
              <ToggleButton key={t} value={t}>
                {FEEDBACK_TYPE_LABELS[t]}
              </ToggleButton>
            ))}
          </ToggleButtonGroup>
          <Select
            size="small"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
          >
            <MenuItem value="open">Open (new + in progress)</MenuItem>
            <MenuItem value="all">All statuses</MenuItem>
            {FEEDBACK_STATUSES.map((s) => (
              <MenuItem key={s} value={s}>
                {FEEDBACK_STATUS_LABELS[s]}
              </MenuItem>
            ))}
          </Select>
          <TextField
            size="small"
            placeholder="Search message, email, notes"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            sx={{ minWidth: 260 }}
          />
        </Stack>
      </Stack>

      {saveError && !selected && (
        <Typography color="error" variant="body2" sx={{ mb: 1 }}>
          {saveError}
        </Typography>
      )}

      <TableContainer component={Paper}>
        <Table size="small" stickyHeader>
          <TableHead>
            <TableRow>
              <TableCell>Type</TableCell>
              <TableCell>Message</TableCell>
              <TableCell>From</TableCell>
              <TableCell>Received</TableCell>
              <TableCell>Status</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filtered.map((i) => (
              <TableRow
                key={i.id}
                hover
                selected={i.id === selectedId}
                onClick={() => openDetail(i)}
                sx={{ cursor: "pointer" }}
              >
                <TableCell>
                  <Chip
                    label={FEEDBACK_TYPE_LABELS[i.type]}
                    size="small"
                    color={TYPE_COLORS[i.type]}
                    variant="outlined"
                  />
                </TableCell>
                <TableCell sx={{ maxWidth: 520 }}>
                  <Typography variant="body2" noWrap>
                    {i.message}
                  </Typography>
                </TableCell>
                <TableCell>
                  <Typography variant="body2">{i.email || "—"}</Typography>
                </TableCell>
                <TableCell>
                  <Typography variant="body2" noWrap>
                    {formatDate(i.createdAt)}
                  </Typography>
                </TableCell>
                <TableCell>
                  <StatusSelect value={i.status} onChange={(s) => save(i.id, { status: s })} />
                </TableCell>
              </TableRow>
            ))}
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={5}>
                  <Typography variant="body2" color="GrayText" align="center" sx={{ py: 3 }}>
                    {items.length === 0 ? "No feedback yet." : "No feedback matches these filters."}
                  </Typography>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <Drawer anchor="right" open={!!selected} onClose={() => setSelectedId(null)}>
        {selected && (
          <Stack spacing={2} sx={{ width: { xs: "100vw", sm: 480 }, p: 3 }}>
            <Stack direction="row" justifyContent="space-between" alignItems="center">
              <Chip
                label={FEEDBACK_TYPE_LABELS[selected.type]}
                color={TYPE_COLORS[selected.type]}
                variant="outlined"
              />
              <IconButton onClick={() => setSelectedId(null)} aria-label="Close">
                <Close />
              </IconButton>
            </Stack>

            <Typography variant="body1" sx={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
              {selected.message}
            </Typography>

            {selected.screenshotUrl && (
              <Link href={selected.screenshotUrl} target="_blank" rel="noopener">
                <Box
                  component="img"
                  src={selected.screenshotUrl}
                  alt="Screenshot attached to this feedback"
                  sx={{
                    display: "block",
                    width: "100%",
                    border: 1,
                    borderColor: "divider",
                    borderRadius: 1,
                  }}
                />
              </Link>
            )}

            <Stack direction="row" spacing={1} alignItems="center">
              <Typography variant="body2">Status</Typography>
              <StatusSelect
                value={selected.status}
                onChange={(s) => save(selected.id, { status: s })}
              />
            </Stack>

            <TextField
              label="Notes (only visible to admins)"
              multiline
              minRows={3}
              value={notesDraft}
              onChange={(e) => setNotesDraft(e.target.value)}
            />
            <Stack direction="row" spacing={1} alignItems="center">
              <Button
                variant="contained"
                size="small"
                disabled={isSaving || notesDraft.trim() === (selected.adminNotes ?? "")}
                onClick={() => save(selected.id, { adminNotes: notesDraft })}
              >
                Save notes
              </Button>
              {saveError && (
                <Typography color="error" variant="body2">
                  {saveError}
                </Typography>
              )}
            </Stack>

            <Detail label="From">{selected.email}</Detail>
            <Detail label="Received">{formatDate(selected.createdAt)}</Detail>
            <Detail label="Page">
              {selected.pageUrl && (
                <Link href={selected.pageUrl} target="_blank" rel="noopener">
                  {selected.pageUrl}
                </Link>
              )}
            </Detail>
            <Detail label="Presentation">
              {selected.presentationId && (
                <Link href={`/presentations/${selected.presentationId}/present`} target="_blank">
                  {selected.presentationId}
                </Link>
              )}
            </Detail>
            <Detail label="Viewport">{selected.viewport}</Detail>
            <Detail label="Browser">{selected.userAgent}</Detail>
            <Detail label="User UID">{selected.userId}</Detail>
          </Stack>
        )}
      </Drawer>
    </Container>
  );
}
