"use client";

import RestoreFromTrash from "@mui/icons-material/RestoreFromTrash";
import DeleteForever from "@mui/icons-material/DeleteForever";
import {
  Button,
  Card,
  CardActions,
  CardContent,
  CardMedia,
  Container,
  Grid,
  Stack,
  Typography,
} from "@mui/material";
import React, { useState } from "react";
import {
  permanentlyDeletePresentation,
  restorePresentation,
} from "../../Header/actions";
import ConfirmDialog from "./ConfirmDialog";

const RETENTION_DAYS = 30;

interface TrashItem {
  title: string;
  previewImage?: string;
  deletedAt: number;
}

interface TrashListProps {
  initialPresentations: Record<string, TrashItem>;
}

function daysRemaining(deletedAt: number) {
  const elapsedMs = Date.now() - deletedAt;
  const remainingMs = RETENTION_DAYS * 24 * 60 * 60 * 1000 - elapsedMs;
  return Math.max(0, Math.ceil(remainingMs / (24 * 60 * 60 * 1000)));
}

export default function TrashList({ initialPresentations }: TrashListProps) {
  const [presentations, setPresentations] =
    useState<Record<string, TrashItem>>(initialPresentations);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  const handleRestore = async (presId: string) => {
    const res = await restorePresentation(presId);
    if (res.success) {
      const { [presId]: _, ...rest } = presentations;
      setPresentations(rest);
    }
  };

  const handleConfirmPermanentDelete = async () => {
    if (!pendingDeleteId) return;
    const presId = pendingDeleteId;
    setPendingDeleteId(null);
    const res = await permanentlyDeletePresentation(presId);
    if (res.success) {
      const { [presId]: _, ...rest } = presentations;
      setPresentations(rest);
    }
  };

  const pendingTitle = pendingDeleteId
    ? presentations[pendingDeleteId]?.title
    : "";

  return (
    <Container maxWidth={false} sx={{ mt: 3 }}>
      <Typography variant="h5" sx={{ mb: 2 }}>
        Trash
      </Typography>
      <Typography variant="body2" color="GrayText" sx={{ mb: 2 }}>
        Items in Trash are permanently deleted after {RETENTION_DAYS} days.
      </Typography>
      {Object.entries(presentations).length > 0 ? (
        <Grid container spacing={2}>
          {Object.entries(presentations).map(([id, val]) => (
            <Grid key={id} size={{ xs: 12, sm: 6, md: 4, lg: 3 }}>
              <Card>
                {val.previewImage && (
                  <CardMedia
                    component="img"
                    image={val.previewImage}
                    alt={val.title}
                    sx={{ height: 160, objectFit: "cover" }}
                  />
                )}
                <CardContent>
                  <Typography variant="h5">
                    <b>{val.title}</b>
                  </Typography>
                  <Typography variant="body2" color="GrayText">
                    {daysRemaining(val.deletedAt)} day(s) until permanent deletion
                  </Typography>
                </CardContent>
                <CardActions>
                  <Stack direction="row-reverse" spacing={2} width="100%">
                    <Button
                      variant="contained"
                      onClick={() => handleRestore(id)}
                      startIcon={<RestoreFromTrash fontSize="small" />}
                    >
                      Restore
                    </Button>
                    <Button
                      variant="outlined"
                      color="error"
                      onClick={() => setPendingDeleteId(id)}
                      startIcon={<DeleteForever fontSize="small" />}
                    >
                      Delete forever
                    </Button>
                  </Stack>
                </CardActions>
              </Card>
            </Grid>
          ))}
        </Grid>
      ) : (
        <Typography variant="subtitle1">
          <i>Trash is empty.</i>
        </Typography>
      )}
      <ConfirmDialog
        open={pendingDeleteId !== null}
        title="Delete permanently?"
        message={`"${pendingTitle}" will be permanently deleted. This action cannot be undone.`}
        confirmLabel="Delete forever"
        onConfirm={handleConfirmPermanentDelete}
        onCancel={() => setPendingDeleteId(null)}
      />
    </Container>
  );
}
