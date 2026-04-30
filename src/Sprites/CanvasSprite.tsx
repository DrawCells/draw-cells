"use client";

import React from "react";
import { resolveImageUrl } from "../helpers";
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
      resolveImageUrl(shapeProps.backgroundUrl).then((src) => {
        if (cancelled || !src) return;
        const img = new window.Image();
        img.crossOrigin = "anonymous";
        img.src = src;
        img.onload = () => { if (!cancelled) setImage(img); };
        img.onerror = (err) => console.error("Error loading image", err);
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
