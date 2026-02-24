import { Button, Grid, Stack, Typography } from "@mui/material";
import React from "react";
import { useDispatch, useSelector } from "react-redux";
import { toggleLoginModalOpen } from "../reducers";
import Image from "next/image";
import State from "../../stateInterface";

export default function Landing() {
  const user = useSelector((state: State) => state.home.user);
  const dispatch = useDispatch();

  const handleLogin = () => {
    dispatch(toggleLoginModalOpen(true));
  };

  if (user) return null;

  return (
    <Grid container sx={{ height: "calc(100vh - 70px)" }} spacing={4}>
      <Grid size={{ xs: 12, lg: 5 }}>
        <Stack sx={{ height: "80%", pl: 10, pr: 10, pt: 20 }}>
          <Typography
            variant="h1"
            fontWeight={600}
            style={{ lineHeight: 1, wordWrap: "initial" }}
          >
            Draw Cells
          </Typography>
          <Typography variant="h4" color="GrayText" fontWeight={300}>
            Give life to your cells
          </Typography>
          <Grid container spacing={2} sx={{ mt: 4 }}>
            <Grid size={{ xs: 12, sm: 6 }}>
              <Button
                fullWidth
                variant="contained"
                size="large"
                onClick={handleLogin}
              >
                Sign up
              </Button>
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <Button
                fullWidth
                variant="outlined"
                size="large"
                onClick={handleLogin}
              >
                Log in
              </Button>
            </Grid>
          </Grid>
        </Stack>
      </Grid>
      <Grid size={{ xs: 12, lg: 7 }}>
        <Stack
          alignItems="center"
          justifyContent="center"
          sx={{ height: "100%" }}
        >
          <div style={{ position: "relative", width: "100%", height: "100%" }}>
            <Image
              src="/assets/macbook_mock.png"
              alt="Macbook Animation"
              fill
              objectFit="contain"
            />
            <video
              controls
              style={{
                position: "absolute",
                left: "16.15%",
                top: "24.8%",
                width: "67.7%",
                height: "46.2%",
                backgroundColor: "#111",
              }}
            >
              <source src="assets/animation_sample_1.mp4" type="video/mp4" />
            </video>
          </div>
        </Stack>
      </Grid>
    </Grid>
  );
}
