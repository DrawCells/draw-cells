"use client";

import React from "react";
import { loadSpriteImage } from "../helpers";
import { Image } from "react-konva";

const CanvasSprite = React.forwardRef(
  ({ spriteId, onSelect, onChange, ...shapeProps }: any, ref: any) => {
    const [image, setImage] = React.useState<HTMLImageElement | null>(null);

    React.useEffect(() => {
      if (!shapeProps.backgroundUrl) {
        setImage(null);
        return;
      }

      let cancelled = false;
      loadSpriteImage(shapeProps.backgroundUrl).then((img) => {
        if (!cancelled && img) setImage(img);
      });
      return () => { cancelled = true; };
    }, [shapeProps.backgroundUrl]);

    if (!image) {
      return null;
    }

    return (
      <Image
        spriteId={spriteId}
        image={image}
        onClick={onSelect}
        onTap={onSelect}
        ref={ref}
        {...shapeProps}
      />
    );
  },
);

export default CanvasSprite;
