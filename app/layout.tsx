import "../styles/globals.css";

import { AppRouterCacheProvider } from "@mui/material-nextjs/v15-appRouter";
import React from "react";
import App from "../src/App";
import { ThemeProvider } from "@mui/material/styles";
import theme from "../src/theme";
import { Nunito } from "next/font/google";

const nunito = Nunito({
  subsets: ["latin"],
  variable: "--font-nunito",
});

export default function RootLayout({
  // Layouts must accept a children prop.
  // This will be populated with nested layouts or pages
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={nunito.variable}>
      <body>
        <AppRouterCacheProvider>
          <ThemeProvider theme={theme}>
            <App>{children}</App>
          </ThemeProvider>
        </AppRouterCacheProvider>
      </body>
    </html>
  );
}
