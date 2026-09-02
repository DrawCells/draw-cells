import { generateId, getRndInteger } from "../../helpers";
import { Actions } from "../actions";

const initialFrame = {
  id: generateId(),
  title: "Frame 1",
  sprites: [],
};

const initialState: FramesState = {
  frames: [initialFrame],
  currentFrame: initialFrame,
  prevFrame: null,
  nextFrame: null,
  currentSprites: [],
  title: "",
  isFramesSaving: false,
  _past: [],
  _future: [],
};

interface Action {
  type: string;
  payload: any;
}

export interface Position {
  x: number;
  y: number;
}
// Fields shared by every item that lives on the canvas (geometry + animation).
export interface BaseSprite {
  id: number | string;
  position: Position;
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
  groupId?: string;
}

// An image-backed sprite (the historical default). `kind` is optional so that
// pre-existing persisted sprites without a `kind` field deserialize as images.
export interface ImageSprite extends BaseSprite {
  kind?: "image";
  backgroundUrl?: string | undefined;
}

// A text box rendered with a Konva Text node.
export interface TextSprite extends BaseSprite {
  kind: "text";
  text: string;
  fontSize: number;
  fontFamily?: string;
  fill?: string;
  align?: string;
  fontStyle?: string;
}

// A straight arrow rendered with a Konva Arrow node. Like an image sprite it is
// box-based (position/width/height/rotation); the arrow geometry is derived
// from that box (see arrowGeometry in helpers).
export interface ArrowSprite extends BaseSprite {
  kind: "arrow";
  stroke?: string;
}

// The canvas accepts all of these; branch on `kind` to render the right node.
export type Sprite = ImageSprite | TextSprite | ArrowSprite;

export const isTextSprite = (s: Sprite): s is TextSprite => s.kind === "text";

export const isArrowSprite = (s: Sprite): s is ArrowSprite =>
  s.kind === "arrow";

// Image sprites are the default: `kind` is "image" or absent (for sprites
// persisted before the discriminant existed).
export const isImageSprite = (s: Sprite): s is ImageSprite =>
  s.kind === undefined || s.kind === "image";

export interface Frame {
  id: number | string | null;
  title: string;
  sprites: Array<Sprite>;
  preview?: any;
  backgroundUrl?: string | undefined;
}

interface FramesSnapshot {
  frames: Array<Frame>;
  currentFrame: Frame;
}

const MAX_HISTORY = 50;

export interface FramesState {
  frames: Array<Frame>;
  currentFrame: Frame;
  prevFrame: Frame | null;
  nextFrame: Frame | null;
  currentSprites: Array<Sprite>;
  title: string;
  isFramesSaving?: boolean;
  _past: Array<FramesSnapshot>;
  _future: Array<FramesSnapshot>;
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

// Normalises a payload id list into a lookup set. Ids are opaque strings
// compared via toString (see generateId), so membership is tested on strings.
const idSet = (ids: Array<number | string> | undefined): Set<string> =>
  new Set((ids ?? []).map((id) => id.toString()));

// Position must end up numeric, but its two callers disagree on input type: the
// properties sidebar's text Inputs emit strings, while the canvas emits floats
// from Konva node coordinates. parseFloat (rather than the parseInt the sidebar
// path used to do) keeps the canvas's sub-pixel precision intact.
const toCoordinate = (value: any): number =>
  typeof value === "number" ? value : parseFloat(value);

// Applies a field patch to a sprite. `positionX` / `positionY` are addressed as
// flat fields by callers but live under `position`, so they are mapped here
// rather than at every call site. Every other field is assigned as given.
const applySpriteFields = (
  sprite: Sprite,
  fields: Record<string, any>,
): Sprite => {
  let next: Sprite = { ...sprite };
  for (const [field, value] of Object.entries(fields)) {
    if (field === "positionX") {
      next = {
        ...next,
        position: { ...next.position, x: toCoordinate(value) },
      };
    } else if (field === "positionY") {
      next = {
        ...next,
        position: { ...next.position, y: toCoordinate(value) },
      };
    } else {
      next = { ...next, [field]: value };
    }
  }
  return next;
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
): { frames: Array<Frame>; currentFrame: Frame } => {
  const crtFrameClone = structuredClone(crtFrame);
  const crtFrameIndex = frames.map((f) => f.id).indexOf(crtFrame.id);
  const prevFrame =
    crtFrameIndex - 1 >= 0 ? structuredClone(frames[crtFrameIndex - 1]) : null;
  const nextFrame =
    crtFrameIndex + 1 < frames.length
      ? structuredClone(frames[crtFrameIndex + 1])
      : null;

  // Index the frames' own sprite objects by id. These lookups are written
  // through (reverseAnimationProps below), so they must not be clones —
  // indexing clones meant the reverse props were computed into throwaway
  // objects and no sprite ever carried them, leaving backward steps with no
  // motion to play. The frames themselves are already clones, so writing
  // through them still leaves the incoming state untouched.
  const byId = (frame: Frame | null): Record<string, Sprite> =>
    (frame?.sprites ?? []).reduce((r: any, s) => {
      if (!s || !s.id) return r;
      r[s.id] = s;
      return r;
    }, {});

  const crtFrameSprites = byId(crtFrameClone);
  const nextFrameSprites = byId(nextFrame);

  let newPrevFrame: Frame | null = null;

  if (prevFrame?.sprites) {
    newPrevFrame = {
      ...prevFrame,
      sprites: prevFrame.sprites.map((s) => structuredClone(s)),
    };
    for (let s of newPrevFrame.sprites) {
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

  for (let s of crtFrameClone.sprites) {
    s.animationProps = getAnimationProps(nextFrameSprites[s.id], s);
    if (nextFrame && nextFrameSprites[s.id]) {
      nextFrameSprites[s.id].reverseAnimationProps = getAnimationProps(
        s,
        nextFrameSprites[s.id],
        true,
      );
    }
  }

  // The next frame is republished too: the loop above stores its sprites'
  // reverseAnimationProps, which is the motion a backward step out of it plays.
  const newFrames = frames
    .map((f) => (f.id === crtFrameClone.id ? crtFrameClone : f))
    .map((f) => (newPrevFrame && f.id === newPrevFrame.id ? newPrevFrame : f))
    .map((f) => (nextFrame && f.id === nextFrame.id ? nextFrame : f));

  return { frames: newFrames, currentFrame: crtFrameClone };
};

// Possibly need in the future for Copy/Remove from all frames
// const computeAllNewFrames = (frames: Array<Frame>) => {
//   let newFrames = frames
//   for (let i = 0; i < frames.length; i++) {
//     newFrames = computeNewFrames(newFrames, newFrames[i])
//   }
//   return newFrames
// }

const TRACKED_ACTIONS = new Set([
  'ADD_SPRITE',
  'UPDATE_SPRITES',
  'REMOVE_SPRITES_BY_IDS',
  'REMOVE_SPRITES_BY_IDS_FROM_ALL_FRAMES',
  'COPY_SPRITES_INTO_FRAME',
  'ADD_FRAME',
  'REMOVE_FRAME',
  'REORDER_FRAMES',
  'SEND_SPRITES_TO_BACK',
  'BRING_SPRITES_TO_FRONT',
  'SET_CURRENT_FRAME_BACKGROUND',
  'GROUP_SPRITES_BY_IDS',
  'UNGROUP_SPRITES_BY_IDS',
]);

const snapshot = (state: FramesState): FramesSnapshot => ({
  frames: state.frames,
  currentFrame: state.currentFrame,
});

// Computes the next sequential "Frame N" label. N is one past the highest
// number already used by an existing "Frame N" title, so labels stay monotonic
// and never collide even after frames are deleted or reordered (counting frames
// would reuse a number after a deletion).
const nextFrameTitle = (frames: Array<Frame>): string => {
  const highest = frames.reduce((max, f) => {
    const match = /^Frame (\d+)$/.exec(f.title ?? "");
    return match ? Math.max(max, parseInt(match[1], 10)) : max;
  }, 0);
  return `Frame ${highest + 1}`;
};

const restoreSnapshot = (state: FramesState, snap: FramesSnapshot): FramesState => {
  const nextFrame = computeNextFrame(snap.frames, snap.currentFrame);
  return {
    ...state,
    frames: snap.frames,
    currentFrame: snap.currentFrame,
    nextFrame,
    currentSprites: [],
  };
};

export const frames = (
  state: FramesState = initialState,
  action: Action,
): FramesState => {
  const { type, payload } = action;

  if (type === Actions.UNDO) {
    if (state._past.length === 0) return state;
    const previous = state._past[state._past.length - 1];
    const newPast = state._past.slice(0, -1);
    return {
      ...restoreSnapshot(state, previous),
      _past: newPast,
      _future: [snapshot(state), ...state._future],
    };
  }

  if (type === Actions.REDO) {
    if (state._future.length === 0) return state;
    const next = state._future[0];
    const newFuture = state._future.slice(1);
    return {
      ...restoreSnapshot(state, next),
      _past: [...state._past, snapshot(state)].slice(-MAX_HISTORY),
      _future: newFuture,
    };
  }

  if (type === Actions.SET_INITIAL_DATA) {
    // payload can be null when the presentation doesn't exist yet or the DB
    // read returns nothing — fall back to a fresh empty presentation.
    const data = payload || {};
    if (!data.frames || data.frames.length <= 0) {
      return { ...initialState, title: data.title };
    }
    // Persisted frames may omit `sprites` entirely; the derivation below
    // iterates it, so normalise first.
    let loadedFrames: Array<Frame> = data.frames.map((f: Frame) => ({
      ...f,
      sprites: f.sprites || [],
    }));
    // Derive each frame's motion up front. Only the forward animationProps are
    // persisted, so without this a just-loaded presentation carries no
    // reverseAnimationProps at all and stepping backwards through it animates
    // nothing — which is all the "/present" and preview views ever do, since
    // they load and never edit.
    for (const f of loadedFrames) {
      loadedFrames = computeNewFrames(loadedFrames, f).frames;
    }
    const currentFrame = loadedFrames[0];
    return {
      ...initialState,
      title: data.title,
      frames: loadedFrames,
      currentFrame,
      nextFrame: computeNextFrame(loadedFrames, currentFrame),
    };
  }

  const shouldTrack = TRACKED_ACTIONS.has(type);
  const newPast = shouldTrack
    ? [...state._past, snapshot(state)].slice(-MAX_HISTORY)
    : state._past;
  const newFuture = shouldTrack ? [] : state._future;

  const result = ((): FramesState => {
    switch (type) {
    case Actions.ADD_SPRITE: {
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
        // The reducer is the single source of truth for ids: always assign a
        // fresh unique id, ignoring any id the caller may have supplied, so two
        // sprites can never share an id.
        id: generateId(),
      };
      const crtFrame = {
        ...state.currentFrame,
        sprites: [...structuredClone(state.currentFrame.sprites), newSprite],
      };
      const { frames: newFrames, currentFrame: newCurrentFrame } =
        computeNewFrames(structuredClone(state.frames), crtFrame);
      return {
        ...state,
        frames: newFrames,
        currentFrame: newCurrentFrame,
      };
    }
    // The single sprite-editing case. Callers name the sprites to change, so
    // editing never depends on (or disturbs) the user's selection. Applying the
    // whole patch list in one pass means N sprites cost one frame recompute and
    // one undo entry, not N of each.
    case Actions.UPDATE_SPRITES: {
      const patches: Array<{ id: string | number; fields: Record<string, any> }> =
        payload.patches || [];

      // Collapse to one merged patch per sprite so several patches naming the
      // same sprite apply in order rather than the last one winning.
      const patchById = new Map<string, Record<string, any>>();
      for (const patch of patches) {
        if (patch?.id == null) continue;
        const key = patch.id.toString();
        patchById.set(key, { ...(patchById.get(key) ?? {}), ...(patch.fields ?? {}) });
      }
      if (patchById.size === 0) return state;

      const patched = (sprite: Sprite): Sprite | null => {
        const fields = patchById.get(sprite.id.toString());
        return fields ? applySpriteFields(sprite, fields) : null;
      };

      const crtFrame = {
        ...state.currentFrame,
        sprites: state.currentFrame.sprites.map(
          (s) => patched(s) ?? structuredClone(s),
        ),
      };
      const { frames: newFrames, currentFrame: newCurrentFrame } =
        computeNewFrames(state.frames, crtFrame);
      return {
        ...state,
        frames: newFrames,
        currentFrame: newCurrentFrame,
        // Keep the selection in sync when an edited sprite is also selected, so
        // the properties sidebar reflects the new values.
        currentSprites: state.currentSprites.map((s) => patched(s) ?? s),
      };
    }
    case Actions.REMOVE_SPRITES_BY_IDS: {
      const removed = idSet(payload.ids);
      if (removed.size === 0) return state;

      const crtFrame = {
        ...state.currentFrame,
        sprites: state.currentFrame.sprites.filter(
          (s) => !removed.has(s.id.toString()),
        ),
      };
      const { frames: newFrames, currentFrame: newCurrentFrame } =
        computeNewFrames(state.frames, crtFrame);
      return {
        ...state,
        frames: newFrames,
        currentFrame: newCurrentFrame,
        // Drop only the removed sprites from the selection; anything else the
        // user had selected stays selected.
        currentSprites: state.currentSprites.filter(
          (s) => !removed.has(s.id.toString()),
        ),
      };
    }
    case Actions.REMOVE_SPRITES_BY_IDS_FROM_ALL_FRAMES: {
      const removed = idSet(payload.ids);
      if (removed.size === 0) return state;

      const keep = (f: Frame): Frame => ({
        ...f,
        sprites: f.sprites.filter((s) => !removed.has(s.id.toString())),
      });
      const newFrames = state.frames.map(keep);
      return {
        ...state,
        frames: newFrames,
        // Take the current frame from the rebuilt list so it and `frames` stay
        // the same object rather than two separately-filtered copies.
        currentFrame:
          newFrames.find(
            (f) => f.id?.toString() === state.currentFrame.id?.toString(),
          ) ?? keep(state.currentFrame),
        currentSprites: state.currentSprites.filter(
          (s) => !removed.has(s.id.toString()),
        ),
      };
    }
    // Copies keep their source sprite's id on purpose: computeNewFrames pairs
    // sprites between adjacent frames by id to derive motion, so a copy sharing
    // its origin's id is what makes the sprite animate across the two frames.
    case Actions.COPY_SPRITES_INTO_FRAME: {
      const toCopy = idSet(payload.ids);
      if (toCopy.size === 0) return state;

      const spritesToCopy = state.currentFrame.sprites.filter((s) =>
        toCopy.has(s.id.toString()),
      );
      if (spritesToCopy.length === 0) return state;

      return {
        ...state,
        frames: state.frames.map((f) =>
          f.id?.toString() === payload.frameId?.toString()
            ? { ...f, sprites: [...f.sprites, ...structuredClone(spritesToCopy)] }
            : f,
        ),
      };
    }
    case Actions.ADD_FRAME: {
      const { frame: incomingFrame, afterId } = payload;
      // Assign the new frame's id and title here so both are derived from full
      // state: the id is globally unique and the title is the next sequential
      // "Frame N" rather than something computed from array order in the UI.
      const frame = {
        ...incomingFrame,
        id: generateId(),
        title: nextFrameTitle(state.frames),
      };
      let baseFrames: Array<Frame>;
      if (afterId != null) {
        const insertAt = state.frames.findIndex((f) => f.id === afterId);
        baseFrames = [...state.frames];
        baseFrames.splice(insertAt + 1, 0, frame);
      } else {
        baseFrames = [...state.frames, frame];
      }
      const { frames: newFrames, currentFrame: newCurrentFrame } =
        computeNewFrames(baseFrames, frame);
      const nextFrame = computeNextFrame(newFrames, newCurrentFrame);

      return {
        ...state,
        currentFrame: newCurrentFrame,
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
        frames = computeNewFrames(frames, f).frames;
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
    case Actions.GROUP_SPRITES_BY_IDS: {
      const ids = idSet(payload.ids);
      if (ids.size < 2) return state;
      const groupId = `group_${Date.now()}`;
      const applyGroup = (sprites: Sprite[]) =>
        sprites.map((s) =>
          ids.has(s.id.toString()) ? { ...s, groupId } : s,
        );
      return {
        ...state,
        currentFrame: { ...state.currentFrame, sprites: applyGroup(state.currentFrame.sprites) },
        frames: state.frames.map((f) => ({ ...f, sprites: applyGroup(f.sprites) })),
        currentSprites: applyGroup(state.currentSprites),
      };
    }
    case Actions.UNGROUP_SPRITES_BY_IDS: {
      const ids = idSet(payload.ids);
      if (ids.size === 0) return state;
      // Dissolve every group the named sprites belong to, so ungrouping one
      // member ungroups the whole group rather than orphaning the rest.
      const groupIds = new Set(
        state.currentFrame.sprites
          .filter((s) => ids.has(s.id.toString()) && s.groupId)
          .map((s) => s.groupId as string),
      );
      if (groupIds.size === 0) return state;
      const removeGroup = (sprites: Sprite[]) =>
        sprites.map((s) => (s.groupId && groupIds.has(s.groupId) ? { ...s, groupId: undefined } : s));
      return {
        ...state,
        currentFrame: { ...state.currentFrame, sprites: removeGroup(state.currentFrame.sprites) },
        frames: state.frames.map((f) => ({ ...f, sprites: removeGroup(f.sprites) })),
        currentSprites: removeGroup(state.currentSprites),
      };
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
      const newCurrentFrame =
        state.currentFrame.id === payload.frameId
          ? { ...state.currentFrame, preview: payload.preview }
          : state.currentFrame;
      return {
        ...state,
        frames: newFrames,
        currentFrame: newCurrentFrame,
      };
    }
    // Array order is z-order, back to front. Both directions partition the
    // frame's sprites and re-concatenate, which keeps the moved sprites in their
    // existing relative order (the previous unshift-in-a-loop reversed them when
    // sending several to the back) and reorders the frame's own sprite objects
    // rather than splicing in possibly-stale copies from the selection.
    case Actions.SEND_SPRITES_TO_BACK:
    case Actions.BRING_SPRITES_TO_FRONT: {
      const ids = idSet(payload.ids);
      if (ids.size === 0) return state;

      const moving = state.currentFrame.sprites.filter((s) =>
        ids.has(s.id.toString()),
      );
      if (moving.length === 0) return state;
      const rest = state.currentFrame.sprites.filter(
        (s) => !ids.has(s.id.toString()),
      );

      const updatedFrame = {
        ...state.currentFrame,
        sprites:
          type === Actions.SEND_SPRITES_TO_BACK
            ? [...moving, ...rest]
            : [...rest, ...moving],
      };
      return {
        ...state,
        currentFrame: updatedFrame,
        frames: state.frames.map((f) =>
          f.id?.toString() === updatedFrame.id?.toString() ? updatedFrame : f,
        ),
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
    case Actions.REORDER_FRAMES: {
      const { fromIndex, toIndex } = payload;
      let newFrames = [...state.frames];
      const [moved] = newFrames.splice(fromIndex, 1);
      newFrames.splice(toIndex, 0, moved);
      for (const f of newFrames) {
        newFrames = computeNewFrames(newFrames, f).frames;
      }
      const newCurrentFrame = newFrames.find((f) => f.id === state.currentFrame.id) || state.currentFrame;
      return {
        ...state,
        frames: newFrames,
        currentFrame: newCurrentFrame,
      };
    }
    default:
      return state;
    }
  })();

  return { ...result, _past: newPast, _future: newFuture };
};
