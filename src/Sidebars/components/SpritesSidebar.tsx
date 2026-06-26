"use client";

import { Box, IconButton, Tooltip, useTheme } from "@mui/material";
import CategoryIcon from "@mui/icons-material/Category";
import WallpaperIcon from "@mui/icons-material/Wallpaper";
import TextFieldsIcon from "@mui/icons-material/TextFields";
import ArrowRightAltIcon from "@mui/icons-material/ArrowRightAlt";
import { ReactElement, useEffect } from "react";
import { useDrag } from "react-dnd";
import { getEmptyImage } from "react-dnd-html5-backend";
import { useDispatch, useSelector } from "react-redux";
import { leftDrawerWidth } from "../../constants";
import State from "../../stateInterface";
import { LeftPanel, setLeftPanel } from "../actions";
import SpritesSection from "./SpritesSection";
import BackgroundsSection from "./BackgroundsSection";

// A tab that opens/closes its content panel when clicked.
function PanelTab({
  title,
  icon,
  active,
  onClick,
}: {
  title: string;
  icon: ReactElement;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <Tooltip title={title} placement="right">
      <IconButton
        onClick={onClick}
        sx={{
          borderRadius: 1.5,
          color: active ? "primary.main" : "text.secondary",
          bgcolor: active ? "action.selected" : "transparent",
        }}
      >
        {icon}
      </IconButton>
    </Tooltip>
  );
}

// A tab whose icon is itself draggable onto the canvas (no panel).
function DraggableTab({
  title,
  icon,
  dragType,
}: {
  title: string;
  icon: ReactElement;
  dragType: string;
}) {
  const [{ isDragging }, drag, preview] = useDrag(() => ({
    type: "SPRITE",
    item: { type: dragType },
    collect: (monitor) => ({ isDragging: !!monitor.isDragging() }),
  }));

  useEffect(() => {
    preview(getEmptyImage(), { captureDraggingState: true });
  }, [preview]);

  return (
    <Tooltip title={`${title} (drag onto canvas)`} placement="right">
      <IconButton
        ref={drag as any}
        sx={{ borderRadius: 1.5, color: "text.secondary", cursor: "grab" }}
        style={{ opacity: isDragging ? 0.5 : 1 }}
      >
        {icon}
      </IconButton>
    </Tooltip>
  );
}

export default function SpritesSidebar() {
  const dispatch = useDispatch();
  const theme = useTheme();
  const activeLeftPanel = useSelector(
    (state: State) => state.sidebars.activeLeftPanel,
  );

  const railWidth = parseInt(theme.spacing(6).replace("px", ""));
  const headerHeight = theme.spacing(8);
  const verticalStyles = {
    top: 0,
    marginTop: headerHeight,
    height: `calc(100vh - ${headerHeight})`,
    background: "#fff",
    borderRight: "solid 1px #ddd",
  } as const;

  return (
    <>
      <Box
        sx={{
          position: "absolute",
          left: 0,
          width: railWidth,
          zIndex: 6,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          pt: 1,
          gap: 0.5,
          ...verticalStyles,
        }}
      >
        <PanelTab
          title="Library"
          icon={<CategoryIcon />}
          active={activeLeftPanel === "sprites"}
          onClick={() => dispatch(setLeftPanel("sprites" as LeftPanel))}
        />
        <DraggableTab
          title="Text"
          icon={<TextFieldsIcon />}
          dragType="SIDEBAR_TEXT"
        />
        <DraggableTab
          title="Arrow"
          icon={<ArrowRightAltIcon />}
          dragType="SIDEBAR_ARROW"
        />
        <PanelTab
          title="Backgrounds"
          icon={<WallpaperIcon />}
          active={activeLeftPanel === "backgrounds"}
          onClick={() => dispatch(setLeftPanel("backgrounds" as LeftPanel))}
        />
      </Box>

      {/*
        Both sections stay mounted and are toggled with `display` rather than
        conditionally rendered, so their pagination state (page cursor, loaded
        flag) survives opening/closing the panel. Unmounting would reset that
        local state while the loaded list persists in Redux, causing duplicate
        re-fetches. Data loading is gated on the `active` prop instead.
      */}
      <Box
        sx={{
          position: "absolute",
          left: railWidth,
          width: leftDrawerWidth - railWidth,
          zIndex: 5,
          ...verticalStyles,
          display: activeLeftPanel ? "block" : "none",
        }}
      >
        <Box
          sx={{
            height: "100%",
            display: activeLeftPanel === "sprites" ? "block" : "none",
          }}
        >
          <SpritesSection active={activeLeftPanel === "sprites"} />
        </Box>
        <Box
          sx={{
            height: "100%",
            display: activeLeftPanel === "backgrounds" ? "block" : "none",
          }}
        >
          <BackgroundsSection active={activeLeftPanel === "backgrounds"} />
        </Box>
      </Box>
    </>
  );
}
