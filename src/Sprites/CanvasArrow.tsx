"use client";

import React from "react";
import { Arrow } from "react-konva";
import { arrowGeometry } from "../helpers";

// A straight arrow rendered as a Konva Arrow node. It is box-based like an
// image sprite: position/width/height/rotation drive a horizontal arrow whose
// geometry is derived from the box, so the standard Transformer resize works.
const CanvasArrow = React.forwardRef(
  (
    { spriteId, stroke, width, height, onSelect, ...shapeProps }: any,
    ref: any,
  ) => {
    const geom = arrowGeometry(width, height);

    return (
      <Arrow
        ref={ref}
        spriteId={spriteId}
        spriteKind="arrow"
        points={geom.points}
        width={width}
        height={height}
        stroke={stroke || "#000000"}
        fill={stroke || "#000000"}
        strokeWidth={geom.strokeWidth}
        pointerWidth={geom.pointerWidth}
        pointerLength={geom.pointerLength}
        hitStrokeWidth={Math.max(geom.strokeWidth, 12)}
        onClick={onSelect}
        onTap={onSelect}
        {...shapeProps}
      />
    );
  },
);

CanvasArrow.displayName = "CanvasArrow";

export default CanvasArrow;
