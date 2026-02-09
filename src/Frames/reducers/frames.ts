import { getRndInteger } from "../../helpers";
import { Actions } from "../actions";

const initialFrame = {
  id: 1,
  title: "Frame 1",
  sprites: [],
};

const initialState: FramesState = {
  frames: [initialFrame],
  currentFrame: initialFrame,
  prevFrame: null,
  nextFrame: null,
  currentSprites: [],
  lastSpriteId: 1,
  title: "",
  isFramesSaving: false,
};

interface Action {
  type: string;
  payload: any;
}

export interface Position {
  x: number;
  y: number;
}
export interface Sprite {
  id: number | string;
  position: Position;
  backgroundUrl?: string | undefined;
  animationType?: string | undefined;
  scale?: number | undefined;
  duration?: number | undefined;
  minTravelDistance?: number | undefined;
  rangeOfMovement?: number | undefined;
  nrOfIterations?: number | undefined;
  circleDirection?: number | undefined;
  angle?: number | undefined;
  opacity?: number;
  animationProps?: any;
  reverseAnimationProps?: any;
  zIndex?: any;
  width: number;
  height: number;
  rotation: number;
}

export interface Frame {
  id: number | string | null;
  title: string;
  sprites: Array<Sprite>;
  preview?: any;
  backgroundUrl?: string | undefined;
}

export interface FramesState {
  frames: Array<Frame>;
  currentFrame: Frame;
  prevFrame: Frame | null;
  nextFrame: Frame | null;
  currentSprites: Array<Sprite>;
  lastSpriteId: number;
  title: string;
  isFramesSaving?: boolean;
}

const computeNextFrame = (
  frames: Array<Frame>,
  crtFrame: Frame,
): Frame | null => {
  const crtFrameIndex = frames.map((f) => f.id).indexOf(crtFrame.id);
  const nextFrame =
    crtFrameIndex + 1 < frames.length ? frames[crtFrameIndex + 1] : null;
  return nextFrame;
};

const computeSpritePosition = (
  sprite: Sprite,
  deltaX: number | undefined,
  deltaY: number | undefined,
): Sprite => {
  const newX = (sprite?.position.x || 0) + (deltaX || 0);
  const newY = (sprite?.position.y || 0) + (deltaY || 0);
  return {
    ...sprite,
    id: sprite.id,
    position: {
      ...sprite?.position,
      x: newX,
      y: newY,
    },
  };
};

const computeLinearAnimation = (currentSprite: Sprite, prevSprite: Sprite) => {
  return { x: currentSprite.position.x, y: currentSprite.position.y };
};

const computeChaoticAnimation = (
  currentSprite: Sprite,
  prevSprite: Sprite,
  reversed: boolean = false,
) => {
  if (!prevSprite)
    return { to: { x: currentSprite.position.x, y: currentSprite.position.y } };
  const chaoticArray = [];
  let newLeft = prevSprite.position.x || 0;
  const leftDistance = currentSprite.position?.x - newLeft;
  let newTop = prevSprite.position.y || 0;
  const topDistance = currentSprite.position?.y - newTop;

  const finalMinTravelDistance =
    (reversed
      ? currentSprite.minTravelDistance
      : prevSprite.minTravelDistance) || 15;
  const rangeOfMotion =
    (reversed ? currentSprite.rangeOfMovement : prevSprite.rangeOfMovement) ||
    40;
  const numberOfIterations =
    (reversed ? currentSprite.nrOfIterations : prevSprite.nrOfIterations) || 10;

  const leftStep = leftDistance / numberOfIterations;
  const leftDirection = leftStep < 0 ? -1 : 1;
  const topStep = topDistance / numberOfIterations;
  const topDirection = topStep < 0 ? -1 : 1;

  for (let i = 0; i < numberOfIterations; i += 1) {
    chaoticArray.push({ x: newLeft, y: newTop });
    let newRandLeft;
    const fromIntermediaryLeftPoint = Math.round(
      (prevSprite?.position.x || 0) + leftStep * i,
    );
    const toIntermediaryLeftPoint = Math.round(
      (prevSprite?.position.x || 0) + leftStep * (i + 1),
    );
    const fromLeft = fromIntermediaryLeftPoint - rangeOfMotion * leftDirection;
    const toLeft = toIntermediaryLeftPoint + rangeOfMotion * leftDirection;
    newRandLeft = getRndInteger(fromLeft, toLeft);
    if (Math.abs(newRandLeft - newLeft) < finalMinTravelDistance) {
      newRandLeft += finalMinTravelDistance * leftDirection;
    }
    newLeft = newRandLeft;

    let newRandTop;
    const fromIntermediaryTopPoint = Math.round(
      (prevSprite?.position.y || 0) + topStep * i,
    );
    const toIntermediaryTopPoint = Math.round(
      (prevSprite?.position.y || 0) + topStep * (i + 1),
    );
    const fromTop = fromIntermediaryTopPoint - rangeOfMotion * topDirection;
    const toTop = toIntermediaryTopPoint + rangeOfMotion * topDirection;
    newRandTop = getRndInteger(fromTop, toTop);
    if (Math.abs(newRandTop - newTop) < finalMinTravelDistance) {
      newRandTop += finalMinTravelDistance * topDirection;
    }
    newTop = newRandTop;
  }
  chaoticArray.push({
    x: currentSprite.position.x,
    y: currentSprite.position.y,
  });
  return chaoticArray;
};

const computeCircularAnimation = (
  currentSprite: Sprite,
  prevSprite: Sprite,
  reversed: boolean = false,
) => {
  const circleDirection: number =
    (reversed ? currentSprite.circleDirection : prevSprite?.circleDirection) ||
    1;
  const currentAngle: number =
    (reversed ? currentSprite?.angle : prevSprite?.angle) || 90;
  const [x1, y1, x2, y2] = [
    prevSprite?.position.x || 0,
    prevSprite?.position.y || 0,
    currentSprite.position.x,
    currentSprite.position.y,
  ];
  const pointsDistance =
    Math.round(Math.sqrt((x2 - x1) * (x2 - x1) + (y2 - y1) * (y2 - y1)) * 100) /
    100;
  const radius =
    Math.round(
      (pointsDistance / 2 / Math.sin((currentAngle / 2) * (Math.PI / 180))) *
        100,
    ) / 100;

  if (x1 === x2 && y1 === y2) {
    return {
      distX: 0,
      distY: 0,
      circleX: x1,
      circleY: y1,
      x1,
      y1,
      x2,
      y2,
      radius: 0,
      angleDirection: circleDirection,
    };
  }

  let currentCircleDirection = 1;
  if (y1 <= y2 && x1 <= x2) currentCircleDirection = circleDirection * -1;
  if (y1 <= y2 && x1 >= x2) currentCircleDirection = circleDirection * 1;
  if (y1 >= y2 && x1 >= x2) currentCircleDirection = circleDirection * -1;
  if (y1 >= y2 && x1 <= x2) currentCircleDirection = circleDirection * 1;

  let angleDirection = 1;
  if (x1 <= x2) angleDirection = circleDirection * -1;
  if (x1 >= x2) angleDirection = circleDirection * 1;

  const x3 = (x1 + x2) / 2;
  const y3 = (y1 + y2) / 2;
  // slope of the perpendicular line through (x1, y1), (x2, y2)
  const m = Math.round(((x1 - x2) / (y2 - y1)) * 100) / 100;
  const a = Math.round((m * m + 1) * 100) / 100;
  const b = Math.round(-2 * (x1 + y1 * m - y3 * m + m * m * x3) * 100) / 100;
  const c =
    Math.round(
      (x1 * x1 +
        y1 * y1 +
        2 * y1 * (m * x3 - y3) +
        m * m * x3 * x3 +
        y3 * y3 -
        2 * m * x3 * y3 -
        radius * radius) *
        100,
    ) / 100;
  const delta = Math.round((b * b - 4 * a * c) * 100) / 100;

  // if delta is negative, we can't find the center of the circle, so we set it to middle of the line
  if (delta < 0) {
    return {
      distX: x3 - x2,
      distY: y3 - y2,
      circleX: x3,
      circleY: y3,
      x1,
      y1,
      x2,
      y2,
      radius: pointsDistance / 2,
      circleDirection: currentCircleDirection,
      angleDirection,
    };
  }

  const circleX = Math.round(
    (-b + currentCircleDirection * Math.sqrt(delta)) / (2 * a),
  );
  const circleY = Math.round(m * circleX - m * x3 + y3);

  const distX = circleX - x2;
  const distY = circleY - y2;

  return {
    distX,
    distY,
    finalAngle: currentAngle,
    circleX,
    circleY,
    x1,
    y1,
    x2,
    y2,
    radius,
    circleDirection: currentCircleDirection,
    angleDirection,
  };
};

const getAnimationProps = (
  currentSprite: Sprite,
  prevSprite: Sprite,
  reversed: boolean = false,
) => {
  if (!currentSprite) return {};
  if (!prevSprite) return computeLinearAnimation(currentSprite, prevSprite);
  const animationType = reversed
    ? currentSprite.animationType
    : prevSprite.animationType;
  switch (animationType) {
    case "LINEAR": {
      return computeLinearAnimation(currentSprite, prevSprite);
    }
    case "CHAOTIC": {
      return computeChaoticAnimation(currentSprite, prevSprite, reversed);
    }
    case "CIRCULAR": {
      return computeCircularAnimation(currentSprite, prevSprite, reversed);
    }
  }
};

const computeNewFrames = (
  frames: Array<Frame>,
  crtFrame: Frame,
): Array<Frame> => {
  const crtFrameIndex = frames.map((f) => f.id).indexOf(crtFrame.id);
  const prevFrame = crtFrameIndex - 1 >= 0 ? frames[crtFrameIndex - 1] : null;
  const nextFrame =
    crtFrameIndex + 1 < frames.length ? frames[crtFrameIndex + 1] : null;

  const crtFrameSprites = crtFrame.sprites.reduce((r: any, s) => {
    if (!s || !s.id) return r;
    r[s.id] = s;
    return r;
  }, {});
  const nextFrameSprites = !nextFrame
    ? {}
    : nextFrame?.sprites.reduce((r: any, s) => {
        if (!s || !s.id) return r;
        r[s.id] = s;
        return r;
      }, {});

  if (prevFrame?.sprites) {
    for (let s of prevFrame.sprites) {
      s.animationProps = getAnimationProps(crtFrameSprites[s.id], s);
      if (crtFrameSprites[s.id]) {
        crtFrameSprites[s.id].reverseAnimationProps = getAnimationProps(
          s,
          crtFrameSprites[s.id],
          true,
        );
      }
    }
  }
  for (let s of crtFrame.sprites) {
    s.animationProps = getAnimationProps(nextFrameSprites[s.id], s);
    if (nextFrame && nextFrameSprites[s.id]) {
      nextFrameSprites[s.id].reverseAnimationProps = getAnimationProps(
        s,
        nextFrameSprites[s.id],
        true,
      );
    }
  }

  const newFrames = frames
    .map((f) => (f.id === crtFrame.id ? crtFrame : f))
    .map((f) => (prevFrame && f.id === prevFrame.id ? prevFrame : f));

  return newFrames;
};

// Possibly need in the future for Copy/Remove from all frames
// const computeAllNewFrames = (frames: Array<Frame>) => {
//   let newFrames = frames
//   for (let i = 0; i < frames.length; i++) {
//     newFrames = computeNewFrames(newFrames, newFrames[i])
//   }
//   return newFrames
// }

export const frames = (
  state: FramesState = initialState,
  action: Action,
): FramesState => {
  const { type, payload } = action;
  switch (type) {
    case Actions.SET_INITIAL_DATA: {
      if (!payload.frames || payload.frames.length <= 0) {
        return {
          ...initialState,
          title: payload.title,
        };
      }
      const lastSpriteId = Math.max(
        ...payload.frames.map((f: Frame) => {
          if (!f.sprites) return 1;
          return Math.max(...f.sprites.map((s) => parseInt(s.id.toString())));
        }),
      );

      const nextFrame = computeNextFrame(payload.frames, payload.frames[0]);

      return {
        ...initialState,
        title: payload.title,
        frames: payload.frames,
        lastSpriteId: lastSpriteId + 1,
        currentFrame: {
          ...payload.frames[0],
          sprites: payload.frames[0].sprites || [],
        },
        nextFrame: nextFrame,
      };
    }
    case Actions.ADD_SPRITE: {
      console.log("Adding sprite with payload:", payload);
      const newSprite = {
        duration: 1,
        minTravelDistance: 15,
        rangeOfMovement: 40,
        nrOfIterations: 30,
        animationType: "LINEAR",
        scale: { x: 1, y: 1 },
        circleDirection: 1,
        angle: 90,
        opacity: 1,
        zIndex: 1,
        width: payload.width || 50,
        height: payload.height || 50,
        ...payload,
      };
      const crtFrame = {
        ...state.currentFrame,
        sprites: [...structuredClone(state.currentFrame.sprites), newSprite],
      };
      const newFrames = computeNewFrames(
        structuredClone(state.frames),
        crtFrame,
      );
      return {
        ...state,
        frames: newFrames,
        currentFrame: crtFrame,
        lastSpriteId: state.lastSpriteId + 1,
      };
    }
    case Actions.UPDATE_ALL_SELECTED_SPRITES: {
      if (!state.currentSprites || state.currentSprites.length <= 0)
        return { ...state };

      const newCurrentSprites = [];
      const newCurrentSpritesMap = new Map<string | number, Sprite>();
      for (let newCurrentSprite of state.currentSprites) {
        if (payload.field === "positionX") {
          newCurrentSprite = {
            ...newCurrentSprite,
            position: {
              x: parseInt(payload.value),
              y: newCurrentSprite?.position?.y || 0,
            },
          };
        } else if (payload.field === "positionY") {
          newCurrentSprite = {
            ...newCurrentSprite,
            position: {
              x: newCurrentSprite?.position?.x || 0,
              y: parseInt(payload.value),
            },
          };
        } else {
          newCurrentSprite = {
            ...newCurrentSprite,
            [payload.field]: payload.value,
          };
        }
        newCurrentSprites.push(newCurrentSprite);
        newCurrentSprite.id &&
          newCurrentSpritesMap.set(newCurrentSprite.id, newCurrentSprite);
      }
      const crtFrame = {
        ...state.currentFrame,
        sprites: state.currentFrame.sprites.map((s) => {
          let newS = null;
          if (s.id && newCurrentSpritesMap.get(s.id))
            newS = newCurrentSpritesMap.get(s.id);
          if (newS) return newS;
          return s;
        }),
      };
      const newFrames = computeNewFrames(state.frames, crtFrame);
      return {
        ...state,
        frames: newFrames,
        currentFrame: crtFrame,
        currentSprites: newCurrentSprites,
      };
    }
    case Actions.UPDATE_SPRITE: {
      const currentSprite = state.currentSprites.find(
        (s) => s.id.toString() === payload.id.toString(),
      );
      if (!currentSprite) return state;

      let newCurrentSprite: Sprite = { ...currentSprite };
      if (payload.field === "positionX") {
        newCurrentSprite = {
          ...newCurrentSprite,
          position: {
            x: parseInt(payload.value),
            y: newCurrentSprite?.position?.y || 0,
          },
        };
      } else if (payload.field === "positionY") {
        newCurrentSprite = {
          ...newCurrentSprite,
          position: {
            x: newCurrentSprite?.position?.x || 0,
            y: parseInt(payload.value),
          },
        };
      } else {
        newCurrentSprite = {
          ...newCurrentSprite,
          [payload.field]: payload.value,
        };
      }

      const newCurrentSprites = state.currentSprites.map((s) =>
        s.id === payload.id ? newCurrentSprite : s,
      );
      const crtFrame = {
        ...state.currentFrame,
        sprites: state.currentFrame.sprites.map((s) =>
          s.id === payload.id ? newCurrentSprite : s,
        ),
      };
      const newFrames = computeNewFrames(
        structuredClone(state.frames),
        structuredClone(crtFrame),
      );
      return {
        ...state,
        frames: newFrames,
        currentFrame: crtFrame,
        currentSprites: newCurrentSprites,
      };
    }
    case Actions.REMOVE_CURRENT_SPRITES: {
      const currentSpritesIds = state.currentSprites.map((x) => x.id);
      const crtFrame = {
        ...state.currentFrame,
        sprites: state.currentFrame.sprites.filter(
          (s) => currentSpritesIds.indexOf(s.id) < 0,
        ),
      };
      const newFrames = computeNewFrames(state.frames, crtFrame);
      return {
        ...state,
        frames: newFrames,
        currentFrame: crtFrame,
        currentSprites: [],
      };
    }
    case Actions.REMOVE_CURRENT_SPRITES_FROM_ALL_FRAMES: {
      const currentSpritesIds = state.currentSprites.map((x) => x.id);
      const crtFrame = {
        ...state.currentFrame,
        sprites: state.currentFrame.sprites.filter(
          (s) => currentSpritesIds.indexOf(s.id) < 0,
        ),
      };
      const newFrames = state.frames.map((f) => ({
        ...f,
        sprites: f.sprites.filter((s) => currentSpritesIds.indexOf(s.id) < 0),
      }));
      return {
        ...state,
        frames: newFrames,
        currentFrame: crtFrame,
        currentSprites: [],
      };
    }
    case Actions.COPY_SPRITE_INTO_FRAME: {
      const spriteToCopy = state.currentFrame.sprites.find(
        (s) => s.id === payload.spriteId,
      );
      if (spriteToCopy) {
        const newFrames = state.frames.map((f) =>
          f.id === payload.frameId
            ? { ...f, sprites: [...f.sprites, spriteToCopy] }
            : f,
        );
        return {
          ...state,
          frames: newFrames,
        };
      }
      return { ...state };
    }
    case Actions.COPY_SELECTED_SPRITES_INTO_FRAME: {
      const currentSpritesIds = state.currentSprites.map((x) => x.id);
      const spritesToCopy = state.currentFrame.sprites.filter(
        (s) => currentSpritesIds.indexOf(s.id) > -1,
      );
      if (spritesToCopy) {
        const newFrames = state.frames.map((f) =>
          f.id === payload.frameId
            ? { ...f, sprites: [...f.sprites, ...spritesToCopy] }
            : f,
        );
        return {
          ...state,
          frames: newFrames,
        };
      }
      return { ...state };
    }
    case Actions.ADD_FRAME: {
      const newFrames = computeNewFrames(
        [...structuredClone(state.frames), payload],
        payload,
      );
      const crtFrame =
        state.frames.find((f) => f.id === payload) || initialState.frames[0];
      const nextFrame = computeNextFrame(
        structuredClone(state.frames),
        structuredClone(crtFrame),
      );

      return {
        ...state,
        currentFrame: payload,
        nextFrame: nextFrame,
        frames: newFrames,
      };
    }
    case Actions.REMOVE_FRAME:
      if (state.frames.length === 1) {
        return {
          ...state,
          frames: [initialFrame],
          currentFrame: initialFrame,
          prevFrame: null,
          nextFrame: null,
          currentSprites: [],
          lastSpriteId: 1,
        };
      }

      const crtFrame = state.frames.find((f) => f.id === payload.id);
      if (crtFrame === undefined || crtFrame === null) return { ...state };

      const nextFrame = computeNextFrame(state.frames, crtFrame);
      const frames = state.frames.filter((f) => f.id !== payload.id);
      const currentFrame =
        payload.id === state.currentFrame.id ? frames[0] : state.currentFrame;

      return {
        ...state,
        frames: frames,
        currentFrame: currentFrame,
        nextFrame: nextFrame,
      };
    case Actions.SET_CURRENT_FRAME: {
      const crtFrame =
        state.frames.find((f) => f.id === payload) || initialState.frames[0];
      const newCurrentSprites =
        crtFrame.sprites.filter((s) =>
          state.currentSprites.find((crtSprite) => crtSprite.id === s.id),
        ) || [];

      const nextFrame = computeNextFrame(state.frames, crtFrame);

      return {
        ...state,
        currentFrame: crtFrame,
        nextFrame: nextFrame,
        currentSprites: newCurrentSprites,
      };
    }
    case Actions.RECOMPUTE_FRAMES: {
      let frames = state.frames;
      for (let f of frames) {
        frames = computeNewFrames(frames, f);
      }
      return {
        ...state,
        frames,
      };
    }
    case Actions.SET_CURRENT_SPRITE: {
      const crtSprite = state.currentFrame.sprites.find(
        (s) => s.id === payload,
      );
      const shouldRemove = !!state.currentSprites.find((s) => s.id === payload);
      return {
        ...state,
        currentSprites: crtSprite && !shouldRemove ? [crtSprite] : [],
      };
    }
    case Actions.ADD_CURRENT_SPRITE: {
      const crtSprite = state.currentFrame.sprites.find(
        (s) => s.id === payload,
      );
      const shouldRemove = !!state.currentSprites.find((s) => s.id === payload);
      return {
        ...state,
        currentSprites: crtSprite
          ? shouldRemove
            ? state.currentSprites.filter((s) => s.id !== payload)
            : [...state.currentSprites, crtSprite]
          : state.currentSprites,
      };
    }
    case Actions.REMOVE_ALL_CURRENT_SPRITES:
      return {
        ...state,
        currentSprites: [],
      };
    case Actions.UPDATE_CURRENT_SPRITE_POSITION: {
      const { id, deltaX, deltaY } = payload;
      const currentSpritesIds = state.currentSprites.map((x) => x.id);
      if (
        state.currentSprites.length > 0 &&
        currentSpritesIds.indexOf(id) > -1
      ) {
        const newCurrentSpritesById = new Map<string | number, Sprite>();
        for (let crtSprite of state.currentSprites) {
          if (!crtSprite.id) continue;
          const newCurrentSprite: Sprite = computeSpritePosition(
            crtSprite,
            deltaX,
            deltaY,
          );
          newCurrentSpritesById.set(crtSprite.id, newCurrentSprite);
        }
        const newCurrentFrame = {
          ...state.currentFrame,
          sprites: state.currentFrame.sprites.map((s) => {
            let newS = null;
            if (s.id && newCurrentSpritesById.get(s.id))
              newS = newCurrentSpritesById.get(s.id);
            if (newS) return newS;
            return s;
          }),
        };
        const newFrames = computeNewFrames(state.frames, newCurrentFrame);
        return {
          ...state,
          frames: newFrames,
          currentFrame: newCurrentFrame,
          currentSprites: state.currentSprites.map((s) => {
            let newS = null;
            if (s.id && newCurrentSpritesById.get(s.id))
              newS = newCurrentSpritesById.get(s.id);
            if (newS) return newS;
            return s;
          }),
        };
      } else {
        const crtSprite = state.currentFrame.sprites.find((s) => s.id === id);
        if (!crtSprite) return { ...state };

        const newCurrentSprite = computeSpritePosition(
          crtSprite,
          deltaX,
          deltaY,
        );
        const newCurrentFrame = {
          ...state.currentFrame,
          sprites: state.currentFrame.sprites.map((s) =>
            s.id === id ? newCurrentSprite : s,
          ),
        };
        const newFrames = computeNewFrames(state.frames, newCurrentFrame);
        return {
          ...state,
          frames: newFrames,
          currentFrame: newCurrentFrame,
          currentSprites: state.currentSprites.map((s) =>
            s.id === id ? newCurrentSprite : s,
          ),
        };
      }
    }
    case Actions.NEXT_FRAME: {
      let newCrtFrame = state.currentFrame;
      const crtFrameIndex = state.frames.findIndex(
        (f) => f.id === state.currentFrame.id,
      );
      if (crtFrameIndex < state.frames.length - 1)
        newCrtFrame = state.frames[crtFrameIndex + 1];
      const newCurrentSprites =
        newCrtFrame.sprites.filter((s) =>
          state.currentSprites.find((crtSprite) => crtSprite.id === s.id),
        ) || [];
      return {
        ...state,
        currentFrame: newCrtFrame,
        prevFrame: state.currentFrame,
        currentSprites: newCurrentSprites,
      };
    }
    case Actions.PREV_FRAME: {
      let newCrtFrame = state.currentFrame;
      const crtFrameIndex = state.frames.findIndex(
        (f) => f.id === state.currentFrame.id,
      );
      if (crtFrameIndex > 0) newCrtFrame = state.frames[crtFrameIndex - 1];
      const newCurrentSprites =
        newCrtFrame.sprites.filter((s) =>
          state.currentSprites.find((crtSprite) => crtSprite.id === s.id),
        ) || [];
      return {
        ...state,
        currentFrame: newCrtFrame,
        prevFrame: state.currentFrame,
        currentSprites: newCurrentSprites,
      };
    }
    case "TOGGLE_MODAL": {
      return {
        ...state,
        prevFrame: null,
      };
    }
    case Actions.UPDATE_PRESENTATION_TITLE: {
      return {
        ...state,
        title: payload,
      };
    }
    case Actions.SET_IS_FRAMES_SAVING: {
      return {
        ...state,
        isFramesSaving: payload,
      };
    }
    case Actions.SET_FRAME_PREVIEW: {
      const newFrames = state.frames.map((x) =>
        x.id === payload.frameId ? { ...x, preview: payload.preview } : x,
      );
      return {
        ...state,
        frames: newFrames,
      };
    }
    case Actions.SEND_SPRITE_TO_BACK: {
      let sprites = state.currentFrame.sprites;
      for (let sprite of state.currentSprites) {
        sprites = sprites.filter((s) => s.id !== sprite.id);
        sprites.unshift(sprite);
      }
      return {
        ...state,
        currentFrame: {
          ...state.currentFrame,
          sprites,
        },
      };
    }
    case Actions.BRING_SPRITE_TO_FRONT: {
      let sprites = state.currentFrame.sprites;
      for (let sprite of state.currentSprites) {
        sprites = sprites.filter((s) => s.id !== sprite.id);
        sprites.push(sprite);
      }
      return {
        ...state,
        currentFrame: {
          ...state.currentFrame,
          sprites,
        },
      };
    }
    case Actions.SET_CURRENT_FRAME_BACKGROUND: {
      const newFrames = state.frames.map((x) =>
        x.id === state.currentFrame.id ? { ...x, backgroundUrl: payload } : x,
      );
      return {
        ...state,
        currentFrame: {
          ...state.currentFrame,
          backgroundUrl: payload,
        },
        frames: newFrames,
      };
    }
    default:
      return state;
  }
};
