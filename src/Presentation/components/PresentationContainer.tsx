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
import { sampleFrames, transitionSeconds } from "../../Animation/sample";
import { useTransitionClock } from "../../Animation/useTransitionClock";
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
  const isForward = indexOfFrame(prevFrame) <= indexOfFrame(currentFrame);

  // A transition always runs from the earlier frame to the later one, and the
  // earlier frame's sprite settings govern it. Stepping backwards plays that
  // same transition in reverse. With no previous frame, everything fades in.
  const earlier = isForward ? prevFrame?.sprites ?? [] : currentFrame.sprites;
  const later = isForward ? currentFrame.sprites : prevFrame?.sprites ?? [];
  const totalSeconds = transitionSeconds(earlier, later);
  const elapsed = useTransitionClock(
    `${prevFrame?.id}->${currentFrame.id}`,
    totalSeconds,
  );
  const sprites = sampleFrames(
    earlier,
    later,
    isForward ? elapsed : totalSeconds - elapsed,
  );

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
            {sprites.map((s) => (
              <AnimationSprite key={`animation-${s.id}`} sprite={s} />
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
