import Close from "@mui/icons-material/Close";
import Edit from "@mui/icons-material/Edit";
import Save from "@mui/icons-material/Save";
import Undo from "@mui/icons-material/Undo";
import Redo from "@mui/icons-material/Redo";
import {
  AppBar,
  Box,
  Button,
  CircularProgress,
  IconButton,
  TextField,
  Toolbar,
  Tooltip,
  Typography,
  useTheme,
} from "@mui/material";
import { ref, update } from "firebase/database";
import React, { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useParams, useRouter } from "next/navigation";
import { db } from "../../firebase-config";
import { updatePresentationTitle, undo, redo } from "../../Frames/actions";
import { toggleModal } from "../../Presentation/actions";
import State from "../../stateInterface";
import ExportVideo from "./ExportVideo";

// interface HeaderProps {
// }

const CanvasHeader = () => {
  const theme = useTheme();
  const dispatch = useDispatch();
  const router = useRouter();
  const presentationTitle = useSelector((state: State) => state.frames.title);
  const isFramesSaving = useSelector(
    (state: State) => state.frames.isFramesSaving,
  );
  const [isTitleEditing, setIsTitleEditing] = useState(false);
  const [currentTitle, setCurrentTitle] = useState(presentationTitle);
  const user = useSelector((state: State) => state.home.user);
  const { id: presentationId } = useParams<{ id: string }>();
  const canUndo = useSelector((state: State) => state.frames._past.length > 0);
  const canRedo = useSelector((state: State) => state.frames._future.length > 0);

  useEffect(() => {
    setCurrentTitle(presentationTitle);
  }, [presentationTitle]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      const isMac = navigator.platform.toUpperCase().includes("MAC");
      const modifier = isMac ? e.metaKey : e.ctrlKey;
      if (modifier && e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        dispatch(undo());
      } else if (modifier && (e.key === "y" || (e.key === "z" && e.shiftKey))) {
        e.preventDefault();
        dispatch(redo());
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [dispatch]);

  const handleSave = async () => {
    await update(ref(db), {
      [`presentations/${presentationId}/title`]: currentTitle,
      [`/user-presentations/${user.uid}/${presentationId}/title`]: currentTitle,
    });
    dispatch(updatePresentationTitle(currentTitle));
    setIsTitleEditing(false);
  };

  return (
    <AppBar position="static" style={{ zIndex: 25 }}>
      <Toolbar
        style={{
          paddingLeft: theme.spacing(7),
          paddingRight: theme.spacing(7),
        }}
      >
        <Box style={{ flexGrow: 1, display: "flex" }} alignItems="center">
          <img
            src="/assets/logo/scillustrate-logo-white-no-padding.png"
            alt="Scillustrate"
            style={{ height: 24, marginBottom: 9, marginRight: 16 }}
          />
          {isTitleEditing && (
            <>
              <TextField
                value={currentTitle}
                size="small"
                InputProps={{ sx: { bgcolor: "white" } }}
                onChange={(e) => setCurrentTitle(e.target.value)}
              />
              <IconButton
                component="span"
                size="small"
                sx={{ color: "white" }}
                onClick={handleSave}
              >
                <Save sx={{ fontSize: "1.5rem" }} />
              </IconButton>
              <IconButton
                component="span"
                size="small"
                sx={{ color: "white" }}
                onClick={() => setIsTitleEditing(false)}
              >
                <Close sx={{ fontSize: "1.5rem" }} />
              </IconButton>
            </>
          )}
          {!isTitleEditing && (
            <>
              <Typography>{presentationTitle}</Typography>
              <IconButton
                component="span"
                size="small"
                sx={{ color: "white" }}
                onClick={() => setIsTitleEditing(true)}
              >
                <Edit sx={{ fontSize: "1rem" }} />
              </IconButton>
            </>
          )}
          {isFramesSaving && (
            <CircularProgress size={16} sx={{ ml: 2, color: "white" }} />
          )}
        </Box>
        <Tooltip title="Undo (⌘Z)">
          <span>
            <IconButton
              color="inherit"
              onClick={() => dispatch(undo())}
              disabled={!canUndo}
              size="small"
              sx={{ "&.Mui-disabled": { color: "rgba(255,255,255,0.5)" } }}
            >
              <Undo />
            </IconButton>
          </span>
        </Tooltip>
        <Tooltip title="Redo (⌘⇧Z)">
          <span>
            <IconButton
              color="inherit"
              onClick={() => dispatch(redo())}
              disabled={!canRedo}
              size="small"
              sx={{ "&.Mui-disabled": { color: "rgba(255,255,255,0.5)" } }}
            >
              <Redo />
            </IconButton>
          </span>
        </Tooltip>
        <Button
          color="inherit"
          onClick={() => router.push("/")}
          sx={{ "&:hover": { bgcolor: "rgba(255,255,255,0.1)" } }}
        >
          Home
        </Button>
        <Button
          color="inherit"
          onClick={() => dispatch(toggleModal(true))}
          sx={{ "&:hover": { bgcolor: "rgba(255,255,255,0.1)" } }}
        >
          Preview
        </Button>
        {/* <Button color="inherit" onClick={() => dispatch(recomputeFrames())}>
          Recompute Frames
        </Button> */}
        <Button
          color="inherit"
          onClick={() => {
            navigator.clipboard.writeText(
              `${window.location.origin}/presentations/${presentationId}/present`,
            );
          }}
          sx={{ "&:hover": { bgcolor: "rgba(255,255,255,0.1)" } }}
        >
          Get presentation link
        </Button>
        <ExportVideo presentationId={presentationId} />
      </Toolbar>
    </AppBar>
  );
};

export default CanvasHeader;
