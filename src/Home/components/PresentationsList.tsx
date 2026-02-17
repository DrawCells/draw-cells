"use client";

import Edit from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
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
import React, { startTransition, useState } from "react";
import { useRouter } from "next/navigation";
import {
  createNewPresentation,
  deletePresentation as deletePresentationAction,
} from "../../Header/actions";

interface User {
  uid: string;
  email: string | null;
  displayName: string | null;
}

interface PresentationsListProps {
  user: User;
  initialPresentations: Record<string, { title: string; previewImage?: string }>;
}

export default function PresentationsList({
  user,
  initialPresentations,
}: PresentationsListProps) {
  const [presentations, setPresentations] =
    useState<Record<string, { title: string; previewImage?: string }>>(initialPresentations);
  const router = useRouter();

  const handleNewPresentation = async () => {
    startTransition(async () => {
      const res = await createNewPresentation();
      if (res) {
        router.push(`/presentations/${res.key}`);
      } else {
        console.error("Failed to create new presentation");
      }
    });
  };

  const handleDelete = async (presId: string) => {
    const res = await deletePresentationAction(presId);
    if (res.success) {
      const { [presId]: _, ...rest } = presentations;
      setPresentations(rest);
    }
  };

  return (
    <Container maxWidth={false} sx={{ mt: 3 }}>
      <Typography variant="h5" sx={{ mb: 2 }}>
        My Presentations
      </Typography>
      {Object.entries(presentations).length > 0 && (
        <Grid container spacing={2}>
          {Object.entries(presentations).map(([id, val]: any) => (
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
                    {id}
                  </Typography>
                </CardContent>
                <CardActions>
                  <Stack direction="row-reverse" spacing={2} width="100%">
                    <Button
                      variant="contained"
                      onClick={() => router.push(`/presentations/${id}`)}
                      startIcon={<Edit fontSize="small" />}
                    >
                      Edit
                    </Button>
                    <Button
                      variant="outlined"
                      color="error"
                      onClick={() => handleDelete(id)}
                      startIcon={<DeleteIcon fontSize="small" />}
                    >
                      Delete
                    </Button>
                  </Stack>
                </CardActions>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}
      {Object.entries(presentations).length <= 0 && (
        <Grid container spacing={1} alignItems="center" direction="column">
          <Grid>
            <Typography variant="subtitle1">
              <i>You haven't created any presentation yet.</i>
            </Typography>
          </Grid>
          <Grid>
            <Button
              color="primary"
              variant="contained"
              onClick={handleNewPresentation}
            >
              Create new presentation
            </Button>
          </Grid>
        </Grid>
      )}
    </Container>
  );
}
