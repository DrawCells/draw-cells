"use client";

import {
  Box,
  Button,
  CircularProgress,
  Grid,
  Link,
  Paper,
  TextField,
  Typography,
} from "@mui/material";
import React, { useActionState, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { loginAction, signupAction } from "./actions";

function LoginForm({ toggleForm }: { toggleForm: (mode: string) => void }) {
  const [state, formAction, isPending] = useActionState(loginAction, {
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
          Sign In
        </Typography>
        <Typography fontSize={14} color="text.secondary" sx={{ mb: 3 }}>
          Enter email and password or click on{" "}
          <span style={{ fontWeight: "bold" }}>Sign Up</span> to create an
          account.
        </Typography>
        {state.error && (
          <Typography color="error" fontSize={14} sx={{ mb: 2 }}>
            {state.error}
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
