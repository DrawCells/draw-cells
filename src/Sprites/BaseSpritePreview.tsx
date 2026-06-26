import { memo } from "react";
import { ImageSprite } from "../Frames/reducers/frames";
import { Box } from "@mui/material";
import { resolveSpriteUrl } from "../helpers";

const BASE = 50;

const BaseSpritePreview = memo(function BoxDragPreview(
  props: ImageSprite & { name: string; ratio: number },
) {
  // ratio = naturalWidth / naturalHeight. Mirror createSprite's sizing so the
  // drag ghost has the same proportions as the dropped sprite: pin the shorter
  // side to BASE and let the longer side grow.
  const r = props.ratio || 1;
  const width = r >= 1 ? BASE * r : BASE;
  const height = r >= 1 ? BASE : BASE / r;

  return (
    <Box
      sx={{
        width,
        height,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {props.backgroundUrl && (
        <img
          src={resolveSpriteUrl(props.backgroundUrl)}
          alt={props.name}
          width={width}
          height={height}
          style={{ display: "block", width: "100%", height: "100%" }}
        />
      )}
    </Box>
  );
});

export default BaseSpritePreview;
