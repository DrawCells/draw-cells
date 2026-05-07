import { Box, IconButton, List, ListItem, Menu, MenuItem } from "@mui/material";
import AddCircleOutlineIcon from "@mui/icons-material/AddCircleOutline";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import KeyboardArrowUpIcon from "@mui/icons-material/KeyboardArrowUp";
import React from "react";
import { useDispatch, useSelector } from "react-redux";
import { addFrame, reorderFrames } from "../../Frames/actions";
import Frame from "../../Frames/components/Frame";
import State from "../../stateInterface";
import { toggleFrames } from "../actions";
import BaseSidebar from "./BaseSidebar";

interface StateProps {
  mouseX: number | null;
  mouseY: number | null;
}

const initialState: StateProps = {
  mouseX: null,
  mouseY: null,
};

export default function FramesSidebar() {
  const dispatch = useDispatch();
  const isFramesSidebarOpen = useSelector(
    (state: State) => state.sidebars.isFramesOpen
  );
  const currentFrame = useSelector((state: State) => state.frames.currentFrame);
  const [state, setState] = React.useState(initialState);
  const framesList = useSelector((state: State) => state.frames.frames);

  const handleAddFrame = () => {
    const newFrameId =
      parseInt(framesList[framesList.length - 1]?.id?.toString() || "0") + 1;
    const newFrame = {
      id: newFrameId,
      title: `Frame ${newFrameId}`,
      sprites: [],
    };
    dispatch(addFrame(newFrame));
    handleClose();
  };

  const handleCloneSelected = () => {
    const newFrameId =
      parseInt(framesList[framesList.length - 1]?.id?.toString() || "0") + 1;
    const newFrame = {
      id: newFrameId,
      title: `Frame ${newFrameId}`,
      sprites: structuredClone(currentFrame.sprites),
    };
    dispatch(addFrame(newFrame, currentFrame.id));
    handleClose();
  };

  const handleMoveFrame = (fromIndex: number, toIndex: number) => {
    dispatch(reorderFrames(fromIndex, toIndex));
  };

  const handleClick = (event: any) => {
    event.preventDefault();
    setState({
      mouseX: event.clientX - 2,
      mouseY: event.clientY - 4,
    });
  };
  const handleClose = () => {
    setState(initialState);
  };

  return (
    <BaseSidebar
      isOpen={isFramesSidebarOpen}
      toggleOpen={() => dispatch(toggleFrames())}
      iconRenderer={() =>
        isFramesSidebarOpen ? (
          <KeyboardArrowDownIcon />
        ) : (
          <KeyboardArrowUpIcon />
        )
      }
      anchor="bottom"
      additionalTitle={
        <>
          | <b>Frame {currentFrame.id}</b>
        </>
      }
    >
      <Box
        sx={{
          width: "100%",
          height: "calc(100% - 24px)",
          display: "flex",
          alignItems: "flex-start",
          marginTop: 3,
        }}
      >
        <List
          style={{
            height: "calc(100%)",
            display: "inline-flex",
            overflowX: "auto",
          }}
        >
          {framesList.map((f, index) => (
            <ListItem key={`frame-${f.id}`} style={{ width: "100%" }}>
              <Frame id={f.id} title={f.title} preview={f.preview} index={index} onMove={handleMoveFrame} />
            </ListItem>
          ))}
          <ListItem style={{ height: "100%" }}>
            <IconButton
              color="primary"
              style={{ display: "flex", alignItems: "center", fontSize: "4em" }}
              onClick={handleClick}
              size="large"
            >
              <AddCircleOutlineIcon fontSize="inherit" />
            </IconButton>
            <Menu
              id="simple-menu"
              keepMounted
              open={state.mouseY !== null}
              onClose={handleClose}
              anchorReference="anchorPosition"
              anchorPosition={
                state.mouseY !== null && state.mouseX !== null
                  ? { top: state.mouseY, left: state.mouseX }
                  : undefined
              }
            >
              <MenuItem onClick={handleAddFrame}>New Frame</MenuItem>
              <MenuItem onClick={handleCloneSelected}>Clone Selected</MenuItem>
            </Menu>
          </ListItem>
        </List>
      </Box>
    </BaseSidebar>
  );
}
