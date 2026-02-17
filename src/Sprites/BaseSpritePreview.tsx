import React, { memo, useEffect, useState } from "react";
import { SPRITE_TO_SVG_ELEMENT_MAP } from "../constants";
import { Sprite } from "../Frames/reducers/frames";
import { Box } from "@mui/material";
import { resolveSpriteUrl } from "../helpers";

const styles: any = {
  position: "absolute",
  cursor: "pointer",
  width: 50,
  height: 50,
};

const BaseSpritePreview = memo(function BoxDragPreview(
  props: Sprite & { name: string; ratio: number },
) {
  const [tickTock, setTickTock] = useState(false);
  useEffect(
    function subscribeToIntervalTick() {
      const interval = setInterval(() => setTickTock(!tickTock), 500);
      return () => clearInterval(interval);
    },
    [tickTock],
  );

  return (
    <div style={styles}>
      <Box
        sx={{
          border: "dashed 2px transparent",
          borderWidth: 2,
          width: "100%",
          height: "100%",
          "& svg": {
            height: "100%",
            width: "100%",
          },
        }}
        style={{
          backgroundColor: "transparent",
          transform: `scale(${props.scale})`,
          zIndex: props.zIndex,
        }}
      >
        {props.backgroundUrl && (
          <img
            src={resolveSpriteUrl(props.backgroundUrl)}
            alt={props.name}
            width={50}
            height={50 / props.ratio}
          />
        )}
      </Box>
    </div>
  );
});

export default BaseSpritePreview;
