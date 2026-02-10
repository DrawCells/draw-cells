import React, { useEffect } from "react";
import { animated, to, useSpring } from "@react-spring/konva";

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
  const { currentFrame, prevFrame } = props;
  const crtFrameId = parseInt(String(currentFrame.id || "1"));
  const prevFrameId = parseInt(String(prevFrame?.id || "0"));

  const {
    position,
    backgroundUrl,
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

  const spriteAnimationProps =
    crtFrameId > prevFrameId ? forwardAnimationProps : reverseAnimationProps;
  const animationType =
    crtFrameId > prevFrameId ? forwardAnimationType : reverseAnimationType;
  const animationDuration =
    ((crtFrameId > prevFrameId ? forwardDuration : reverseDuration) || 1) *
    1000;
  const currentNrOfIterations =
    (crtFrameId > prevFrameId
      ? forwardNrOfIterations
      : reverseNrOfIterations) || 10;
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
    from: { rotateSpring: prevFrameId },
    to: { rotateSpring: crtFrameId },
    config: { duration: animationDuration },
  });
  const rotationProps = to(
    [
      rotateSpring
        .to([prevFrameId, crtFrameId], [angleDirection * finalAngle, 0])
        .to((x) => x),
    ],
    (x) => x,
  );
  const svgRotationProps = to(
    [
      rotateSpring
        .to(
          [prevFrameId, crtFrameId],
          [prevSprite?.rotation - angleDirection * finalAngle, rotation],
        )
        .to((x) => x),
    ],
    (x) => x,
  );

  // CHOOSE THE PROPS
  let animationProps = {};
  let svgProps = { ...scaleProps, ...opacityProps, ...offsetProps };

  if (crtFrameId === prevFrameId || isRemoved || isStatic) {
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
    const newImg = new window.Image();
    newImg.src = `/assets/cells/${backgroundUrl}`;
    newImg.onload = () => setImg(newImg);
  }, [backgroundUrl]);

  return (
    <animated.Group width={width} height={height} {...animationProps}>
      <animated.Image image={img} width={width} height={height} {...svgProps} />
    </animated.Group>
  );
}
