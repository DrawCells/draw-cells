import { Box, Typography } from "@mui/material";
import React, { useEffect, useState } from "react";
import { useDrag } from "react-dnd";
import { getEmptyImage } from "react-dnd-html5-backend";

interface SidebarSpriteProps {
  backgroundUrl: string;
  name: string;
  onDragStart?: () => void;
}

export default function SidebarSprite({
  backgroundUrl,
  name,
  onDragStart,
}: SidebarSpriteProps) {
  const [ratio, setRatio] = useState(1);
  const hasStartedDraggingRef = React.useRef(false);
  const [{ isDragging: isSquareDragging }, squareDrag, preview] = useDrag(
    () => ({
      type: "SPRITE",
      item: {
        type: "SIDEBAR_SPRITE",
        backgroundUrl,
        ratio,
        name,
      },
      collect: (monitor) => ({
        isDragging: !!monitor.isDragging(),
      }),
    }),
    [ratio],
  );

  useEffect(() => {
    preview(getEmptyImage(), { captureDraggingState: true });
  }, [preview]);

  useEffect(() => {
    if (isSquareDragging && !hasStartedDraggingRef.current) {
      hasStartedDraggingRef.current = true;
      onDragStart?.();
    }

    if (!isSquareDragging && hasStartedDraggingRef.current) {
      hasStartedDraggingRef.current = false;
    }
  }, [isSquareDragging, onDragStart]);

  useEffect(() => {
    setRatio(1);
  }, [backgroundUrl]);

  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        marginBottom: 1,
        flexDirection: "column",
      }}
    >
      <Box
        ref={squareDrag as any}
        sx={{ width: 50, height: 50, cursor: "grab" }}
        style={{ opacity: isSquareDragging ? 0.5 : 1 }}
      >
        {backgroundUrl && (
          <img
            src={`/assets/cells/${backgroundUrl}`}
            alt={name}
            width={50}
            height={50}
            onLoad={(event) => {
              const { naturalWidth, naturalHeight } = event.currentTarget;
              if (naturalWidth > 0 && naturalHeight > 0) {
                setRatio(naturalWidth / naturalHeight);
              }
            }}
          />
        )}
      </Box>
      <Typography variant="caption" sx={{ textAlign: "center" }}>
        {name}
      </Typography>
    </Box>
  );
}
