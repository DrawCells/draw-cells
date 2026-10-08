import React from "react";
import { Arrow, Circle, Rect } from "react-konva";
import { circularArc, motionPath } from "../../Animation/sample";
import { Sprite } from "../../Frames/reducers/frames";

interface AnimationCanvasPreviewProps {
  // The selected sprite on the current frame, and the same sprite on the
  // next frame.
  from: Sprite;
  to: Sprite;
}

// Shows where a selected sprite will travel to reach the next frame. The
// route comes from the same code playback and export use, so it is exactly
// the path the sprite will take.
export default function AnimationCanvasPreview({
  from,
  to,
}: AnimationCanvasPreviewProps) {
  const points = motionPath(from, to);
  if (points.some((p) => !Number.isFinite(p))) return null;

  const arc = from.animationType === "CIRCULAR" ? circularArc(from, to) : null;

  return (
    <>
      {arc && (
        <>
          <Rect
            x={arc.center.x}
            y={arc.center.y}
            width={5}
            height={5}
            fill="red"
          />
          <Circle
            x={arc.center.x}
            y={arc.center.y}
            radius={arc.radius}
            stroke="black"
            strokeWidth={2}
          />
        </>
      )}
      <Arrow
        points={points}
        pointerLength={10}
        pointerWidth={10}
        fill="#888"
        stroke="#888"
        strokeWidth={3}
        opacity={0.5}
      />
    </>
  );
}
