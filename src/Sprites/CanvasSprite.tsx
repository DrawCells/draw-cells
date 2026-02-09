"use client";

import React from "react";
import { Image } from "react-konva";

const CanvasSprite = React.forwardRef(
  ({ spriteId, onSelect, onChange, ...shapeProps }: any, ref: any) => {
    const [image, setImage] = React.useState<HTMLImageElement | null>(null);

    React.useEffect(() => {
      const img = new window.Image();
      img.src = `/assets/cells/${shapeProps.backgroundUrl}`;
      img.onload = () => setImage(img);
      img.onerror = (err) => console.error("Error loading image", err);
    }, [shapeProps.backgroundUrl]);

    if (!image) {
      return null;
    }

    return (
      <React.Fragment>
        <Image
          spriteId={spriteId}
          image={image}
          onClick={onSelect}
          onTap={onSelect}
          ref={ref}
          {...shapeProps}
        />
      </React.Fragment>
    );
  },
);

export default CanvasSprite;
