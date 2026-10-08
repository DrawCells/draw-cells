import React, { useEffect } from "react";
import { Arrow, Image, Text } from "react-konva";
import {
  isArrowSprite,
  isTextSprite,
  Sprite,
} from "../Frames/reducers/frames";
import { arrowGeometry, loadSpriteImage } from "../helpers";

// Draws one sprite during presentation playback. Motion is worked out
// upstream by sampleFrames (src/Animation/sample.ts), so this only renders the
// pose it is given — the same way createSpriteNode draws it for video export.
export default function AnimationSprite({ sprite }: { sprite: Sprite }) {
  const { position, width, height, rotation, opacity } = sprite;
  const backgroundUrl =
    isTextSprite(sprite) || isArrowSprite(sprite)
      ? undefined
      : sprite.backgroundUrl;

  const [img, setImg] = React.useState<HTMLImageElement | null>(null);

  useEffect(() => {
    if (!backgroundUrl) return;
    let cancelled = false;
    loadSpriteImage(backgroundUrl).then((newImg) => {
      if (!cancelled && newImg) setImg(newImg);
    });
    return () => {
      cancelled = true;
    };
  }, [backgroundUrl]);

  const shapeProps = {
    x: position.x,
    y: position.y,
    width,
    height,
    offsetX: width / 2,
    offsetY: height / 2,
    rotation,
    opacity: opacity ?? 1,
  };

  if (isArrowSprite(sprite)) {
    const geom = arrowGeometry(width, height);
    return (
      <Arrow
        points={geom.points}
        stroke={sprite.stroke || "#000000"}
        fill={sprite.stroke || "#000000"}
        strokeWidth={geom.strokeWidth}
        pointerWidth={geom.pointerWidth}
        pointerLength={geom.pointerLength}
        {...shapeProps}
      />
    );
  }

  if (isTextSprite(sprite)) {
    return (
      <Text
        text={sprite.text}
        fontSize={sprite.fontSize}
        fontFamily={sprite.fontFamily || "Arial"}
        fontStyle={sprite.fontStyle || "normal"}
        fill={sprite.fill || "#000000"}
        align={sprite.align || "left"}
        verticalAlign="middle"
        wrap="word"
        {...shapeProps}
      />
    );
  }

  return img ? <Image image={img} {...shapeProps} /> : null;
}
