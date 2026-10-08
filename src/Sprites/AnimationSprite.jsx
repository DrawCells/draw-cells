import React, { useEffect } from "react";
import { animated, to, useSpring } from "@react-spring/konva";
import { Arrow } from "react-konva";
import { arrowGeometry, loadSpriteImage } from "../helpers";

// Animated wrapper so the arrow's rotation/scale/opacity tween like the image
// and text nodes (which use svgProps).
const AnimatedArrow = animated(Arrow);

function getCurrentAndPrevSprite(animationProps) {
  const { prevFrame, id } = animationProps;

  const prevSprite = prevFrame?.sprites.find((s) => s.id === id);
  const currentSprite = animationProps;

  if (!prevSprite) {
    return [null, currentSprite];
  }

  return [prevSprite, currentSprite];
}

export default function AnimationSprite(props) {
  const [prevSprite, currentSprite] = getCurrentAndPrevSprite(props);
  // Which way the presentation is being stepped, and how far the rotation
  // spring travels, come from the frames' positions in the presentation — not
  // from their ids. Ids are opaque uuids (see generateId), so parsing them as
  // numbers gave NaN for most frames and every comparison against NaN is
  // false, which silently sent forward steps down the reverse branch.
  const { currentFrameIndex, prevFrameIndex } = props;
  const isForward = currentFrameIndex > prevFrameIndex;

  const {
    position,
    backgroundUrl,
    kind,
    text,
    fontSize,
    fontFamily,
    fontStyle,
    fill,
    align,
    stroke,
    scale,
    width,
    height,
    opacity,
    rotation,
    isRemoved,
    animationType: reverseAnimationType,
    nrOfIterations: reverseNrOfIterations,
    duration: reverseDuration,
  } = currentSprite;

  const {
    animationType: forwardAnimationType,
    nrOfIterations: forwardNrOfIterations,
    duration: forwardDuration,
    animationProps: forwardAnimationProps,
    reverseAnimationProps,
  } = prevSprite || {};

  const spriteAnimationProps = isForward
    ? forwardAnimationProps
    : reverseAnimationProps;
  const animationType = isForward
    ? forwardAnimationType
    : reverseAnimationType;
  const animationDuration =
    ((isForward ? forwardDuration : reverseDuration) || 1) * 1000;
  const currentNrOfIterations =
    (isForward ? forwardNrOfIterations : reverseNrOfIterations) || 10;
  const isStatic =
    !prevSprite ||
    (prevSprite?.position?.x === position.x &&
      prevSprite?.position?.y === position.y);

  //SCALE PROPS
  const scaleProps = useSpring({
    to: { scale, rotation, width, height },
    config: { duration: animationDuration },
  });

  // OPACITY PROPS
  const opacityProps = useSpring({
    from: { opacity: 0 },
    to: { opacity: opacity },
    config: { duration: 500 },
  });

  // OFFSET PROPS
  const offsetProps = useSpring({
    to: { offsetX: width / 2, offsetY: height / 2 },
    config: { duration: animationDuration },
  });

  //STATIC PROPS
  const staticProps = useSpring({
    to: { x: position.x, y: position.y },
    config: { duration: animationDuration },
  });

  // LINEAR PROPS
  const linearProps = useSpring({
    from: { x: prevSprite?.position?.x || 0, y: prevSprite?.position?.y || 0 },
    to: spriteAnimationProps,
    config: { duration: animationDuration },
  });

  // CHAOTIC PROPS
  const chaoticProps = useSpring({
    from: { x: prevSprite?.position?.x || 0, y: prevSprite?.position?.y || 0 },
    to: spriteAnimationProps,
    config: {
      duration:
        Math.round((animationDuration / currentNrOfIterations) * 100) / 100,
    },
  });

  //CIRCULAR PROPS
  const finalAngle = parseInt(spriteAnimationProps?.finalAngle || "90");
  const angleDirection = parseInt(spriteAnimationProps?.angleDirection || "1");
  const { rotateSpring } = useSpring({
    from: { rotateSpring: prevFrameIndex },
    to: { rotateSpring: currentFrameIndex },
    config: { duration: animationDuration },
  });
  // Interpolation input ranges must ascend, so a backward step is mapped over
  // the reversed range with its output reversed to match.
  const rotateRange = isForward
    ? [prevFrameIndex, currentFrameIndex]
    : [currentFrameIndex, prevFrameIndex];
  const rotateOutput = (from, target) =>
    isForward ? [from, target] : [target, from];
  const rotationProps = to(
    [
      rotateSpring
        .to(rotateRange, rotateOutput(angleDirection * finalAngle, 0))
        .to((x) => x),
    ],
    (x) => x,
  );
  const svgRotationProps = to(
    [
      rotateSpring
        .to(
          rotateRange,
          rotateOutput(
            prevSprite?.rotation - angleDirection * finalAngle,
            rotation,
          ),
        )
        .to((x) => x),
    ],
    (x) => x,
  );

  // CHOOSE THE PROPS
  let animationProps = {};
  let svgProps = { ...scaleProps, ...opacityProps, ...offsetProps };

  if (currentFrameIndex === prevFrameIndex || isRemoved || isStatic) {
    animationProps = { ...animationProps, ...staticProps };
  } else if (animationType === "LINEAR") {
    animationProps = { ...animationProps, ...linearProps };
  } else if (animationType === "CHAOTIC") {
    animationProps = { ...animationProps, ...chaoticProps };
  } else if (animationType === "CIRCULAR") {
    // CIRCULAR PROPS
    const { distX, distY, circleX, circleY } = spriteAnimationProps;
    animationProps = {
      ...animationProps,
      x: circleX,
      y: circleY,
      rotation: rotationProps,
    };
    // svgProps = circularSvgProps
    svgProps = {
      ...svgProps,
      x: -distX,
      y: -distY,
      rotation: svgRotationProps,
    };
  } else {
    animationProps = { ...animationProps, x: position.x, y: position.y };
  }

  const [img, setImg] = React.useState(null);

  useEffect(() => {
    if (!backgroundUrl) return;
    let cancelled = false;
    loadSpriteImage(backgroundUrl).then((newImg) => {
      if (!cancelled && newImg) setImg(newImg);
    });
    return () => { cancelled = true; };
  }, [backgroundUrl]);

  const arrowGeom = kind === "arrow" ? arrowGeometry(width, height) : null;

  return (
    <animated.Group width={width} height={height} {...animationProps}>
      {kind === "arrow" ? (
        <AnimatedArrow
          points={arrowGeom.points}
          stroke={stroke || "#000000"}
          fill={stroke || "#000000"}
          strokeWidth={arrowGeom.strokeWidth}
          pointerWidth={arrowGeom.pointerWidth}
          pointerLength={arrowGeom.pointerLength}
          width={width}
          height={height}
          {...svgProps}
        />
      ) : kind === "text" ? (
        <animated.Text
          text={text}
          fontSize={fontSize}
          fontFamily={fontFamily || "Arial"}
          fontStyle={fontStyle || "normal"}
          fill={fill || "#000000"}
          align={align || "left"}
          verticalAlign="middle"
          wrap="word"
          width={width}
          height={height}
          {...svgProps}
        />
      ) : (
        <animated.Image
          image={img}
          width={width}
          height={height}
          {...svgProps}
        />
      )}
    </animated.Group>
  );
}
