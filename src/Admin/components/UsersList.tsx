"use client";

import {
  Avatar,
  Chip,
  Container,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from "@mui/material";
import React, { useMemo, useState } from "react";

export interface AdminUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  disabled: boolean;
  emailVerified: boolean;
  providerIds: string[];
  creationTime: string | null;
  lastSignInTime: string | null;
}

interface UsersListProps {
  users: AdminUser[];
}

function formatDate(value: string | null): string {
  if (!value) return "—";
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

// Firebase timestamps are RFC 1123 strings; parse for sorting, treating
// unknown values as oldest.
function toMillis(value: string | null): number {
  if (!value) return 0;
  const ms = new Date(value).getTime();
  return Number.isNaN(ms) ? 0 : ms;
}

export default function UsersList({ users }: UsersListProps) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q
      ? users.filter(
          (u) =>
            u.email?.toLowerCase().includes(q) ||
            u.displayName?.toLowerCase().includes(q) ||
            u.uid.toLowerCase().includes(q),
        )
      : users;
    // Most recent sign-in first, matching the Firebase console default.
    return [...list].sort(
      (a, b) => toMillis(b.lastSignInTime) - toMillis(a.lastSignInTime),
    );
  }, [users, query]);

  return (
    <Container maxWidth={false} sx={{ mt: 3, mb: 4 }}>
      <Stack
        direction={{ xs: "column", sm: "row" }}
        justifyContent="space-between"
        alignItems={{ xs: "flex-start", sm: "center" }}
        spacing={2}
        sx={{ mb: 2 }}
      >
        <Typography variant="h5">
          Users{" "}
          <Typography component="span" variant="h6" color="GrayText">
            ({users.length})
          </Typography>
        </Typography>
        <TextField
          size="small"
          placeholder="Search email, name, or UID"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          sx={{ minWidth: 280 }}
        />
      </Stack>

      <TableContainer component={Paper}>
        <Table size="small" stickyHeader>
          <TableHead>
            <TableRow>
              <TableCell>User</TableCell>
              <TableCell>Providers</TableCell>
              <TableCell>Created</TableCell>
              <TableCell>Last signed in</TableCell>
              <TableCell>User UID</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filtered.map((u) => (
              <TableRow key={u.uid} hover>
                <TableCell>
                  <Stack direction="row" spacing={1.5} alignItems="center">
                    <Avatar
                      src={u.photoURL ?? undefined}
                      sx={{ width: 32, height: 32 }}
                    >
                      {(u.displayName || u.email || "?")
                        .charAt(0)
                        .toUpperCase()}
                    </Avatar>
                    <Stack>
                      <Typography variant="body2">
                        {u.displayName || "—"}
                      </Typography>
                      <Stack
                        direction="row"
                        spacing={0.5}
                        alignItems="center"
                      >
                        <Typography variant="caption" color="GrayText">
                          {u.email || "no email"}
                        </Typography>
                        {u.disabled && (
                          <Chip label="disabled" size="small" color="error" />
                        )}
                      </Stack>
                    </Stack>
                  </Stack>
                </TableCell>
                <TableCell>
                  <Stack direction="row" spacing={0.5} flexWrap="wrap">
                    {u.providerIds.length > 0 ? (
                      u.providerIds.map((p) => (
                        <Chip
                          key={p}
                          label={p.replace(".com", "")}
                          size="small"
                          variant="outlined"
                        />
                      ))
                    ) : (
                      <Typography variant="caption" color="GrayText">
                        —
                      </Typography>
                    )}
                  </Stack>
                </TableCell>
                <TableCell>
                  <Typography variant="body2">
                    {formatDate(u.creationTime)}
                  </Typography>
                </TableCell>
                <TableCell>
                  <Typography variant="body2">
                    {formatDate(u.lastSignInTime)}
                  </Typography>
                </TableCell>
                <TableCell>
                  <Typography variant="caption" color="GrayText">
                    {u.uid}
                  </Typography>
                </TableCell>
              </TableRow>
            ))}
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={5}>
                  <Typography
                    variant="body2"
                    color="GrayText"
                    align="center"
                    sx={{ py: 3 }}
                  >
                    No users match your search.
                  </Typography>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </Container>
  );
}
