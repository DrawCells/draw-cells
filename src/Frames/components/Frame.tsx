import CancelIcon from "@mui/icons-material/Cancel";
import { Box, IconButton, Typography } from "@mui/material";
import React, { useRef } from "react";
import { useDrag, useDrop } from "react-dnd";
import { useDispatch, useSelector } from "react-redux";
import State from "../../stateInterface";
import { removeFrameById, setCurrentFrame } from "../actions";

const DRAG_TYPE = "FRAME";

interface FrameProps {
  title: string;
  id: string | number | null;
  preview?: any;
  index: number;
  onMove: (fromIndex: number, toIndex: number) => void;
}

const Frame = ({ title, id, preview, index, onMove }: FrameProps) => {
  console.log("Preview prop received in Frame component:", preview);
  const dispatch = useDispatch();
  const currentFrame = useSelector((state: State) => state.frames.currentFrame);
  const ref = useRef<HTMLDivElement>(null);

  const [{ isDragging }, drag] = useDrag({
    type: DRAG_TYPE,
    item: { index },
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
  });

  const [, drop] = useDrop<{ index: number }, void, unknown>({
    accept: DRAG_TYPE,
    hover(item) {
      if (item.index === index) return;
      onMove(item.index, index);
      item.index = index;
    },
  });

  drag(drop(ref));

  const removeFrame = (e: React.MouseEvent) => {
    e.stopPropagation();
    dispatch(removeFrameById({ id }));
  };

  return (
    <Box
      ref={ref}
      sx={{
        border: "1px solid",
        borderColor: id === currentFrame.id ? "primary.main" : "grey.300",
        height: "100%",
        width: "233px",
        opacity: isDragging ? 0.4 : 1,
        cursor: "grab",
      }}
      onClick={() => dispatch(setCurrentFrame(id))}
    >
      <Typography variant="body2" color="textSecondary">
        {" "}
        {title}{" "}
      </Typography>
      <div
        style={{
          width: "100%",
          height: "calc(100% - 20px)",
          overflow: "hidden",
          backgroundImage: `url(${preview})`,
          backgroundSize: "contain",
          backgroundRepeat: "no-repeat",
          backgroundPosition: "center",
        }}
      />
      <IconButton
        onClick={removeFrame}
        sx={{
          position: "absolute",
          top: -8,
          right: 0,
          color: "error.main",
          bgcolor: "white",
          padding: 0.5,
        }}
        size="large"
      >
        <CancelIcon />
      </IconButton>
    </Box>
  );
};

export default Frame;
