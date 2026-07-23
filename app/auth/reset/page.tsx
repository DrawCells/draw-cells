"use client";

import {
  Box,
  Button,
  CircularProgress,
  Grid,
  Paper,
  TextField,
  Typography,
} from "@mui/material";
import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "../../../lib/supabaseBrowser";

export default function ResetPasswordPage() {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) {
      setError("Password should be at least 6 characters");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match");
      return;
    }

    setLoading(true);
    setError(null);

    // The reset link already established a recovery session (via /auth/callback),
    // so updateUser can set the new password for the signed-in recovery user.
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.auth.updateUser({ password });

    if (error) {
      setError(
        /session|missing|jwt/i.test(error.message)
          ? "Your reset link is invalid or has expired. Please request a new one."
          : error.message,
      );
      setLoading(false);
      return;
    }

    setDone(true);
    setTimeout(() => router.push("/"), 1500);
  };

  return (
    <Grid
      container
      justifyContent="center"
      alignItems="center"
      sx={{ minHeight: "100vh", bgcolor: "#f5f5f5" }}
    >
      <Paper elevation={3} sx={{ maxWidth: 420, width: "100%", borderRadius: 4 }}>
        <Box
          component="form"
          onSubmit={handleSubmit}
          sx={{ display: "flex", flexDirection: "column", px: 4, py: 3 }}
        >
          <Typography variant="h5" sx={{ mb: 1 }}>
            Set a new password
          </Typography>
          {done ? (
            <Typography color="success.main" fontSize={14} sx={{ mb: 1 }}>
              Password updated. Redirecting…
            </Typography>
          ) : (
            <>
              <Typography fontSize={14} color="text.secondary" sx={{ mb: 3 }}>
                Enter a new password for your account.
              </Typography>
              {error && (
                <Typography color="error" fontSize={14} sx={{ mb: 2 }}>
                  {error}
                </Typography>
              )}
              <TextField
                autoFocus
                label="New password"
                type="password"
                fullWidth
                variant="standard"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                sx={{ mb: 2 }}
              />
              <TextField
                label="Confirm password"
                type="password"
                fullWidth
                variant="standard"
                required
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                sx={{ mb: 3 }}
              />
              <Button variant="contained" type="submit" disabled={loading}>
                Update password
                {loading && (
                  <>
                    &nbsp;
                    <CircularProgress color="primary" size={20} />
                  </>
                )}
              </Button>
            </>
          )}
        </Box>
      </Paper>
    </Grid>
  );
}
