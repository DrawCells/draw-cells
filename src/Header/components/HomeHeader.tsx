"use client";

import AccountCircle from "@mui/icons-material/AccountCircle";
import ArrowDropDown from "@mui/icons-material/ArrowDropDown";
import { AppBar, Button, Menu, MenuItem, Stack, Toolbar } from "@mui/material";
import React, { useEffect, useState, useTransition } from "react";
import { useDispatch, useSelector } from "react-redux";
import State from "../../stateInterface";
import { setUser } from "../../Home/reducers";
import { createNewPresentation } from "../actions";
import { logoutAction } from "../../../app/login/actions";
import { useRouter } from "next/navigation";

const HomeHeader = () => {
  const dispatch = useDispatch();
  const user = useSelector((state: State) => state.home.user);
  const [anchorEl, setAnchorEl] = useState(null);
  const [hasMounted, setHasMounted] = useState(false);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  useEffect(() => {
    setHasMounted(true);
  }, []);

  const handleLogOut = async () => {
    await logoutAction();
    dispatch(setUser(null));
    router.refresh();
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleNewPresentation = () => {
    startTransition(async () => {
      const res = await createNewPresentation();
      if (res) {
        router.push(`/presentations/${res.key}`);
      } else {
        console.error("Failed to create new presentation");
      }
    });
  };

  if (!hasMounted) return null;

  return (
    <AppBar
      position="static"
      style={{ zIndex: 25, backgroundColor: "rgb(21, 62, 49)" }}
    >
      <Toolbar sx={{ pl: 7, pr: 7 }}>
        <Stack direction="row" style={{ flexGrow: 1 }} alignItems="center">
          <img
            src="/assets/logo/scillustrate-logo-white-no-padding.png"
            alt="Scillustrate"
            style={{
              height: 32,
              marginBottom: 9,
              marginRight: 24,
            }}
          />
          {user && (
            <Button
              variant="contained"
              color="secondary"
              onClick={handleNewPresentation}
              style={{ fontWeight: "bolder" }}
            >
              New Presentation
            </Button>
          )}
        </Stack>
        {!user && (
          <Button color="inherit" onClick={() => router.push("/login")}>
            Log in
          </Button>
        )}
        {user && (
          <>
            <Button
              onClick={(e: any) => setAnchorEl(e.currentTarget)}
              sx={{ color: "white" }}
              startIcon={<AccountCircle />}
              endIcon={<ArrowDropDown />}
            >
              {user.displayName}
            </Button>
            <Menu
              id="menu-appbar"
              anchorEl={anchorEl}
              anchorOrigin={{
                vertical: "top",
                horizontal: "right",
              }}
              keepMounted
              transformOrigin={{
                vertical: "top",
                horizontal: "right",
              }}
              open={Boolean(anchorEl)}
              onClose={handleClose}
            >
              <MenuItem onClick={handleClose}>Profile</MenuItem>
              <MenuItem onClick={handleLogOut}>Log out</MenuItem>
            </Menu>
          </>
        )}
      </Toolbar>
    </AppBar>
  );
};

export default HomeHeader;
