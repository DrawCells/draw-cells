import React from "react";
import { Arrow, Circle, Rect } from "react-konva";

interface AnimationCanvasPreviewProps {
  x1: number;
  y1: number;
  animationProps: any;
  animationType: string | undefined;
  width1: number;
  width2: number;
  height1: number;
  height2: number;
}

export default function AnimationCanvasPreview({
  x1,
  y1,
  animationProps,
  animationType,
  width2,
  height2,
}: AnimationCanvasPreviewProps) {
  let otherPoints: any = [];
  let tension = 0;
  let midX = 0,
    midY = 0;
  let nx,
    ny = 0;

  if (!animationProps) {
    return <></>;
  }

  if (animationType === "LINEAR") {
    otherPoints = [
      animationProps.x + width2 / 2,
      animationProps.y + height2 / 2,
    ];
  } else if (animationType === "CHAOTIC") {
    otherPoints = animationProps
      .slice(0)
      .map((p: any) => [p.x, p.y])
      .flat();
  } else if (animationType === "CIRCULAR") {
    const {
      radius: r,
      x2,
      y2,
      circleX,
      circleY,
      circleDirection,
    } = animationProps;
    tension = 0.8;
    // Coordinates of the middle of initial point and final point (we'll call it N)
    nx = (x1 + x2) / 2;
    ny = (y1 + y2) / 2;
    let m;

    if (nx === circleX && ny === circleY) {
      m = Math.round(((x1 - x2) / (y2 - y1)) * 100) / 100;
    } else {
      // Slope of the line going through circle center and N
      m = Math.round(((ny - circleY) / (nx - circleX)) * 100) / 100;
    }
    // Constant for slope line formula (y=mx + c)
    const mc = m * nx - ny;

    // Solve quadratic equation to find the mid point of the arc
    const a = Math.round((m * m + 1) * 100) / 100;
    const b =
      -Math.round((2 * circleX + 2 * m * circleY + 2 * m * mc) * 100) / 100;
    const c =
      Math.round(
        (circleX * circleX +
          circleY * circleY +
          2 * circleY * mc +
          mc * mc -
          r * r) *
          100,
      ) / 100;
    const delta = b * b - 4 * a * c;
    midX = (-b - circleDirection * Math.sqrt(delta)) / (2 * a);
    midY = m * midX - mc;

    otherPoints = [midX, midY, x2, y2];
  }

  return (
    <>
      {animationType === "CIRCULAR" && (
        <>
          <Rect
            x={animationProps.circleX}
            y={animationProps.circleY}
            width={5}
            height={5}
            fill="red"
          />
          <Circle
            x={animationProps.circleX}
            y={animationProps.circleY}
            radius={animationProps.r}
            stroke="black"
            strokeWidth={2}
          />
        </>
      )}
      <Arrow
        points={[x1, y1, ...otherPoints]}
        tension={tension}
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
