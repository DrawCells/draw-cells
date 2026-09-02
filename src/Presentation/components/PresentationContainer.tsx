"use client";

import { Button } from "@mui/material";
import React, { useEffect } from "react";
import { Layer, Stage } from "react-konva";
import { useDispatch, useSelector } from "react-redux";
import { VIEWPORT_HEIGHT, VIEWPORT_WIDTH } from "../../constants";
import {
  loadInitialData,
  nextAnimationFrame,
  prevAnimationFrame,
} from "../../Frames/actions";
import {
  isArrowSprite,
  isImageSprite,
  isTextSprite,
  Sprite,
} from "../../Frames/reducers/frames";
import AnimationSprite from "../../Sprites/AnimationSprite";
import State from "../../stateInterface";

const SCALE = Math.min(
  (window.innerWidth - 250) / VIEWPORT_WIDTH,
  (window.innerHeight - 200) / VIEWPORT_HEIGHT
);

const PresentationContainer = ({
  presentationId,
}: {
  presentationId?: string;
}) => {
  const frames = useSelector((state: State) => state.frames.frames);
  const currentFrame = useSelector((state: State) => state.frames.currentFrame);
  const prevFrame = useSelector((state: State) => state.frames.prevFrame);

  // Sprites animate between two frames, and which of the pair comes first in
  // the presentation is what decides whether the step plays forward or in
  // reverse. Frame ids are opaque uuids, so that ordering has to come from the
  // frames array rather than from the ids themselves.
  const indexOfFrame = (frame: typeof currentFrame | null) =>
    frame ? frames.findIndex((f) => f.id === frame.id) : -1;
  const currentFrameIndex = indexOfFrame(currentFrame);
  const prevFrameIndex = indexOfFrame(prevFrame);

  const currentFrameSpriteIds = currentFrame.sprites.map((s) => s.id);
  const spritesToRemove =
    prevFrame?.sprites
      .filter((s) => currentFrameSpriteIds.indexOf(s.id) < 0)
      .map((s) => ({ ...s, opacity: 0 })) || [];

  const dispatch = useDispatch();

  useEffect(() => {
    if (!presentationId) {
      return;
    }

    fetch(`/api/presentations/${presentationId}`)
      .then((res) => res.json())
      .then((data) => dispatch(loadInitialData(data)));
  }, [presentationId]);

  return (
    <div
      style={{
        height: "calc(100% - 30px)",
        backgroundColor: "white",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div
        style={{
          padding: "10px 50px 20px",
          backgroundColor: "white",
          width: VIEWPORT_WIDTH * SCALE,
          height: VIEWPORT_HEIGHT * SCALE,
        }}
      >
        <Stage
          scale={{ x: SCALE, y: SCALE }}
          width={VIEWPORT_WIDTH * SCALE}
          height={VIEWPORT_HEIGHT * SCALE}
          style={{
            border: "solid 1px #ddd",
            marginBottom: 20,
            overflow: "hidden",
          }}
        >
          <Layer>
            {currentFrame.sprites
              .concat(...spritesToRemove)
              .map((s: Sprite) => (
                <AnimationSprite
                  kind={s.kind}
                  backgroundUrl={isImageSprite(s) ? s.backgroundUrl : undefined}
                  text={isTextSprite(s) ? s.text : undefined}
                  fontSize={isTextSprite(s) ? s.fontSize : undefined}
                  fontFamily={isTextSprite(s) ? s.fontFamily : undefined}
                  fontStyle={isTextSprite(s) ? s.fontStyle : undefined}
                  fill={isTextSprite(s) ? s.fill : undefined}
                  align={isTextSprite(s) ? s.align : undefined}
                  stroke={isArrowSprite(s) ? s.stroke : undefined}
                  id={s.id}
                  position={s.position}
                  key={`animation-${s.id}`}
                  animationType={s.animationType}
                  scale={s.scale}
                  // angle={s.angle}
                  opacity={s.opacity}
                  animationProps={s.animationProps}
                  duration={s.duration}
                  nrOfIterations={s.nrOfIterations}
                  // zIndex={s.zIndex}
                  width={s.width}
                  height={s.height}
                  rotation={s.rotation}
                  currentFrame={currentFrame}
                  prevFrame={prevFrame}
                  currentFrameIndex={currentFrameIndex}
                  prevFrameIndex={prevFrameIndex}
                  isRemoved={s.opacity === 0}
                />
              ))}
          </Layer>
        </Stage>
      </div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-around",
          width: VIEWPORT_WIDTH,
        }}
      >
        <Button
          variant="outlined"
          color="primary"
          onClick={() => dispatch(prevAnimationFrame())}
        >
          PREV
        </Button>
        <Button
          variant="outlined"
          color="primary"
          onClick={() => dispatch(nextAnimationFrame())}
        >
          NEXT
        </Button>
      </div>
    </div>
  );
};

export default PresentationContainer;
