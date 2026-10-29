"use client";

import { Button } from "@mui/material";
import React, { useEffect, useState } from "react";
import { Image as KonvaImage, Layer, Stage } from "react-konva";
import { useDispatch, useSelector } from "react-redux";
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
import { loadSpriteImage } from "../../helpers";
import State from "../../stateInterface";

const PresentationContainer = ({
  presentationId,
}: {
  presentationId?: string;
}) => {
  const frames = useSelector((state: State) => state.frames.frames);
  const currentFrame = useSelector((state: State) => state.frames.currentFrame);
  const prevFrame = useSelector((state: State) => state.frames.prevFrame);
  const canvasWidth = useSelector((state: State) => state.canvas.width);
  const canvasHeight = useSelector((state: State) => state.canvas.height);

  const SCALE = Math.min(
    (window.innerWidth - 250) / canvasWidth,
    (window.innerHeight - 200) / canvasHeight
  );

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

  const [backgroundImage, setBackgroundImage] =
    useState<HTMLImageElement | null>(null);
  useEffect(() => {
    let cancelled = false;
    loadSpriteImage(currentFrame.backgroundUrl || "").then((img) => {
      if (!cancelled) setBackgroundImage(img);
    });
    return () => {
      cancelled = true;
    };
  }, [currentFrame.backgroundUrl]);

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
          width: canvasWidth * SCALE,
          height: canvasHeight * SCALE,
        }}
      >
        <Stage
          scale={{ x: SCALE, y: SCALE }}
          width={canvasWidth * SCALE}
          height={canvasHeight * SCALE}
          style={{
            border: "solid 1px #ddd",
            marginBottom: 20,
            overflow: "hidden",
          }}
        >
          <Layer>
            {backgroundImage && (
              <KonvaImage
                image={backgroundImage}
                width={canvasWidth}
                height={canvasHeight}
                listening={false}
              />
            )}
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
          width: canvasWidth,
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
