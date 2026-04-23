"use client";

import { createTheme } from "@mui/material/styles";

const theme = createTheme({
  typography: {
    fontFamily: "var(--font-nunito)",
  },
  palette: {
    primary: {
      main: "rgb(21, 62, 49)",
    },
    secondary: {
      main: "rgb(234, 170, 0)",
      contrastText: "#ffffff",
    },
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: "none",
          fontFamily: "var(--font-nunito)",
        },
      },
    },
  },
});

export default theme;
