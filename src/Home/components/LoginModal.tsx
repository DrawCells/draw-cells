"use client";

import {
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  Grid,
  Link,
  TextField,
  Typography,
} from "@mui/material";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  updateProfile,
} from "firebase/auth";
import React, { useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { auth } from "../../firebase-config";
import State from "../../stateInterface";
import { toggleLoginModalOpen } from "../reducers";

interface LoginFormProps {
  handleClose: () => void;
  toggleForm: (val: string) => void;
}

function RegisterForm({ handleClose, toggleForm }: LoginFormProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");

  const handleSubmit = async () => {
    try {
      const response = await createUserWithEmailAndPassword(
        auth,
        email,
        password
      );
      localStorage.setItem("user_email", response.user.email || "");
      localStorage.setItem("user_uid", response.user.uid || "");
      updateProfile(response.user, { displayName: `${firstName} ${lastName}` });
    } catch (e) {
      console.error(e);
    }
    handleClose();
  };

  return (
    <>
      <DialogContent>
        <Grid container justifyContent="center">
          <DialogContentText fontSize={14}>
            Enter email and password or click on{" "}
            <span style={{ fontWeight: "bold" }}>Sign Up</span> to create an
            account.
          </DialogContentText>
          <Box
            sx={{
              mt: 5,
              mb: 5,
              display: "flex",
              flexDirection: "column",
              width: "100%",
            }}
            alignItems="center"
          >
            <TextField
              margin="dense"
              id="first_name"
              label="First Name"
              type="text"
              fullWidth
              variant="standard"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              required
            />
            <TextField
              margin="dense"
              id="last_name"
              label="Last Name"
              type="text"
              fullWidth
              variant="standard"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              required
            />
            <TextField
              autoFocus
              margin="dense"
              id="name"
              label="Email Address"
              type="email"
              fullWidth
              variant="standard"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <TextField
              margin="dense"
              id="password"
              label="Password"
              type="password"
              fullWidth
              variant="standard"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            <Link
              underline="hover"
              sx={{ mt: 3, fontSize: 14, "&:hover": { cursor: "pointer" } }}
              onClick={() => toggleForm("sign_in")}
            >
              Sign In
            </Link>
          </Box>
        </Grid>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose}>Cancel</Button>
        <Button variant="contained" onClick={handleSubmit}>
          Register
        </Button>
      </DialogActions>
    </>
  );
}

function LoginForm({ handleClose, toggleForm }: LoginFormProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async () => {
    setIsLoading(true);
    try {
      const response = await signInWithEmailAndPassword(auth, email, password);

      await fetch("/api/session", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ userId: response.user.uid }),
      });

      localStorage.setItem("user_email", response.user.email || "");
      localStorage.setItem("user_uid", response.user.uid || "");
      handleClose();
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <DialogContent>
        <Grid container justifyContent="center">
          <DialogContentText fontSize={14}>
            Enter email and password or click on{" "}
            <span style={{ fontWeight: "bold" }}>Sign Up</span> to create a new
            account.
          </DialogContentText>
          <Box
            sx={{
              mt: 5,
              mb: 5,
              display: "flex",
              flexDirection: "column",
              width: "100%",
            }}
            alignItems="center"
          >
            <TextField
              autoFocus
              margin="dense"
              id="name"
              label="Email Address"
              type="email"
              fullWidth
              variant="standard"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <TextField
              margin="dense"
              id="password"
              label="Password"
              type="password"
              fullWidth
              variant="standard"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            <Typography fontSize="0.9rem" sx={{ mt: 3 }}>
              {"You don't have an account yet?"}
            </Typography>
            <Link
              underline="hover"
              sx={{ fontSize: 14, "&:hover": { cursor: "pointer" } }}
              onClick={() => toggleForm("sign_up")}
            >
              Sign Up
            </Link>
          </Box>
        </Grid>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose}>Cancel</Button>
        <Button variant="contained" onClick={handleSubmit} disabled={isLoading}>
          Log In
          {isLoading && (
            <>
              &nbsp;
              <CircularProgress color="primary" size={20} />
            </>
          )}
        </Button>
      </DialogActions>
    </>
  );
}

export default function LoginModal() {
  const open = useSelector((state: State) => state.home.loginModalOpen);
  const dispatch = useDispatch();
  const [currentForm, setCurrentForm] = useState("sign_in");

  const handleClose = () => {
    dispatch(toggleLoginModalOpen(false));
  };

  return (
    <Dialog open={open} onClose={handleClose}>
      <Grid container>
        <Grid
          size={{ xs: 0, sm: 6 }}
          sx={{ bgcolor: "primary.main", color: "white" }}
        >
          <Grid
            container
            alignItems="center"
            justifyContent="center"
            sx={{ height: "100%" }}
          >
            <Grid>
              <Typography
                variant="h3"
                textAlign="center"
                sx={{ color: "white" }}
              >
                Welcome
              </Typography>
            </Grid>
          </Grid>
        </Grid>
        <Grid
          size={{ xs: 12, sm: 6 }}
          alignItems="center"
          justifyContent="center"
        >
          {currentForm === "sign_in" && (
            <LoginForm handleClose={handleClose} toggleForm={setCurrentForm} />
          )}
          {currentForm === "sign_up" && (
            <RegisterForm
              handleClose={handleClose}
              toggleForm={setCurrentForm}
            />
          )}
        </Grid>
      </Grid>
    </Dialog>
  );
}
