import Close from "@mui/icons-material/Close";
import Edit from "@mui/icons-material/Edit";
import Save from "@mui/icons-material/Save";
import {
  AppBar,
  Box,
  Button,
  CircularProgress,
  IconButton,
  TextField,
  Toolbar,
  Typography,
  useTheme,
} from "@mui/material";
import { ref, update } from "firebase/database";
import React, { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useParams, useRouter } from "next/navigation";
import { db } from "../../firebase-config";
import { updatePresentationTitle } from "../../Frames/actions";
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

  useEffect(() => {
    setCurrentTitle(presentationTitle);
  }, [presentationTitle]);

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
