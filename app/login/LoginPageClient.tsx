"use client";

import {
  Box,
  Button,
  CircularProgress,
  Divider,
  Grid,
  Link,
  Paper,
  TextField,
  Typography,
} from "@mui/material";
import React, { useActionState, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createSupabaseBrowserClient } from "../../lib/supabaseBrowser";
import { loginAction, resetPasswordAction, signupAction } from "./actions";

function GoogleSignInButton() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGoogleSignIn = async () => {
    setLoading(true);
    setError(null);
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    // On success the browser redirects to Google; we only reach here on error.
    if (error) {
      setError(error.message || "Google sign-in failed");
      setLoading(false);
    }
  };

  return (
    <>
      {error && (
        <Typography color="error" fontSize={14} sx={{ mb: 1 }}>
          {error}
        </Typography>
      )}
      <Button
        type="button"
        variant="outlined"
        fullWidth
        onClick={handleGoogleSignIn}
        disabled={loading}
        sx={{ textTransform: "none" }}
      >
        {loading ? <CircularProgress size={20} /> : "Sign in with Google"}
      </Button>
    </>
  );
}

function LoginForm({ toggleForm }: { toggleForm: (mode: string) => void }) {
  const [state, formAction, isPending] = useActionState(loginAction, {
    success: false,
  });
  const [email, setEmail] = useState("");
  const [resetLoading, setResetLoading] = useState(false);
  const [resetMsg, setResetMsg] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    if (state.success) {
      router.push("/");
    }
  }, [state.success, router]);

  const handleReset = async () => {
    if (resetLoading) return;
    setResetLoading(true);
    setResetMsg(null);
    const res = await resetPasswordAction(email);
    setResetLoading(false);
    setResetMsg(
      res.success
        ? "If an account exists for that email, a reset link is on its way. Check your inbox."
        : res.error || "Could not send the reset link. Please try again.",
    );
  };

  return (
    <form action={formAction}>
      <Box
        sx={{
          display: "flex",
          flexDirection: "column",
          px: 4,
          py: 3,
        }}
      >
        <Typography variant="h5" sx={{ mb: 1 }}>
          Sign In
        </Typography>
        <Typography fontSize={14} color="text.secondary" sx={{ mb: 3 }}>
          Enter email and password or click on{" "}
          <span style={{ fontWeight: "bold" }}>Sign Up</span> to create an
          account.
        </Typography>
        {state.error && (
          <Typography color="error" fontSize={14} sx={{ mb: 1 }}>
            {state.error}
          </Typography>
        )}
        {state.canReset && !resetMsg && (
          <Typography fontSize={13} color="text.secondary" sx={{ mb: 2 }}>
            Returning user? Your account needs a new password — use the link
            below.
          </Typography>
        )}
        {resetMsg && (
          <Typography fontSize={13} color="text.secondary" sx={{ mb: 2 }}>
            {resetMsg}
          </Typography>
        )}
        <TextField
          autoFocus
          name="email"
          label="Email Address"
          type="email"
          fullWidth
          variant="standard"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          sx={{ mb: 2 }}
        />
        <TextField
          name="password"
          label="Password"
          type="password"
          fullWidth
          variant="standard"
          required
          sx={{ mb: 1 }}
        />
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 3 }}>
          <Link
            underline="hover"
            sx={{ fontSize: 14, "&:hover": { cursor: "pointer" } }}
            onClick={handleReset}
          >
            Forgot password?
          </Link>
          {resetLoading && <CircularProgress size={14} />}
        </Box>
        <Typography fontSize="0.9rem">
          {"You don't have an account yet?"}
        </Typography>
        <Link
          underline="hover"
          sx={{ fontSize: 14, "&:hover": { cursor: "pointer" }, mb: 3 }}
          onClick={() => toggleForm("sign_up")}
        >
          Sign Up
        </Link>
        <Button variant="contained" type="submit" disabled={isPending}>
          Log In
          {isPending && (
            <>
              &nbsp;
              <CircularProgress color="primary" size={20} />
            </>
          )}
        </Button>
        <Divider sx={{ my: 2 }}>or</Divider>
        <GoogleSignInButton />
      </Box>
    </form>
  );
}

function RegisterForm({ toggleForm }: { toggleForm: (mode: string) => void }) {
  const [state, formAction, isPending] = useActionState(signupAction, {
    success: false,
  });
  const router = useRouter();

  useEffect(() => {
    if (state.success) {
      router.push("/");
    }
  }, [state.success, router]);

  return (
    <form action={formAction}>
      <Box
        sx={{
          display: "flex",
          flexDirection: "column",
          px: 4,
          py: 3,
        }}
      >
        <Typography variant="h5" sx={{ mb: 1 }}>
          Sign Up
        </Typography>
        <Typography fontSize={14} color="text.secondary" sx={{ mb: 3 }}>
          Create a new account to get started.
        </Typography>
        {state.error && (
          <Typography color="error" fontSize={14} sx={{ mb: 2 }}>
            {state.error}
          </Typography>
        )}
        <TextField
          name="firstName"
          label="First Name"
          type="text"
          fullWidth
          variant="standard"
          required
          sx={{ mb: 2 }}
        />
        <TextField
          name="lastName"
          label="Last Name"
          type="text"
          fullWidth
          variant="standard"
          required
          sx={{ mb: 2 }}
        />
        <TextField
          autoFocus
          name="email"
          label="Email Address"
          type="email"
          fullWidth
          variant="standard"
          required
          sx={{ mb: 2 }}
        />
        <TextField
          name="password"
          label="Password"
          type="password"
          fullWidth
          variant="standard"
          required
          sx={{ mb: 3 }}
        />
        <Link
          underline="hover"
          sx={{ fontSize: 14, "&:hover": { cursor: "pointer" }, mb: 3 }}
          onClick={() => toggleForm("sign_in")}
        >
          Sign In
        </Link>
        <Button variant="contained" type="submit" disabled={isPending}>
          Register
          {isPending && (
            <>
              &nbsp;
              <CircularProgress color="primary" size={20} />
            </>
          )}
        </Button>
        <Divider sx={{ my: 2 }}>or</Divider>
        <GoogleSignInButton />
      </Box>
    </form>
  );
}

export default function LoginPageClient() {
  const searchParams = useSearchParams();
  const [currentForm, setCurrentForm] = useState(
    searchParams.get("mode") === "signup" ? "sign_up" : "sign_in",
  );

  return (
    <Grid
      container
      justifyContent="center"
      alignItems="center"
      sx={{ minHeight: "100vh", bgcolor: "#f5f5f5" }}
    >
      <Paper
        elevation={3}
        sx={{
          maxWidth: 700,
          width: "100%",
          borderRadius: 4,
          overflow: "hidden",
        }}
      >
        <Grid container>
          <Grid
            size={{ xs: 0, sm: 5 }}
            sx={{
              bgcolor: "primary.main",
              color: "white",
              display: { xs: "none", sm: "flex" },
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Typography variant="h3" textAlign="center" sx={{ color: "white" }}>
              Welcome
            </Typography>
          </Grid>
          <Grid size={{ xs: 12, sm: 7 }} sx={{ p: 2 }}>
            {currentForm === "sign_in" && (
              <LoginForm toggleForm={setCurrentForm} />
            )}
            {currentForm === "sign_up" && (
              <RegisterForm toggleForm={setCurrentForm} />
            )}
          </Grid>
        </Grid>
      </Paper>
    </Grid>
  );
}
