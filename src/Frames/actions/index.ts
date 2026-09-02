import { Frame, Sprite } from "../reducers/frames";

// Distributive Omit so that omitting "id" from the Sprite union preserves each
// member (image/text/arrow) and its discriminant, rather than collapsing to the
// members' common keys.
type DistributiveOmit<T, K extends keyof any> = T extends any
  ? Omit<T, K>
  : never;

// The reducer is the single source of truth for sprite ids and assigns one on
// ADD_SPRITE, so callers create sprites without supplying an id.
export type NewSprite = DistributiveOmit<Sprite, "id">;

// Sprite mutations are all id-addressed: the caller names the sprites to change.
// They used to read `state.currentSprites` instead — implicitly operating on the
// user's selection — which meant any caller that wasn't the properties sidebar
// had to take over (and clobber) the selection just to edit a sprite. Selection
// and navigation still have their own actions (SET_CURRENT_SPRITE,
// ADD_CURRENT_SPRITE, REMOVE_ALL_CURRENT_SPRITES, SET_CURRENT_FRAME); they
// manage what is selected, they do not mutate sprites.
export const Actions = {
  SET_INITIAL_DATA: "SET_INITIAL_DATA",
  SET_CURRENT_FRAME: "SET_CURRENT_FRAME",
  SET_CURRENT_SPRITE: "SET_CURRENT_SPRITE",
  ADD_SPRITE: "ADD_SPRITE",
  ADD_FRAME: "ADD_FRAME",
  REMOVE_FRAME: "REMOVE_FRAME",
  REORDER_FRAMES: "REORDER_FRAMES",
  RECOMPUTE_FRAMES: "RECOMPUTE_FRAMES",
  NEXT_FRAME: "NEXT_FRAME",
  PREV_FRAME: "PREV_FRAME",
  UPDATE_SPRITES: "UPDATE_SPRITES",
  REMOVE_SPRITES_BY_IDS: "REMOVE_SPRITES_BY_IDS",
  REMOVE_SPRITES_BY_IDS_FROM_ALL_FRAMES:
    "REMOVE_SPRITES_BY_IDS_FROM_ALL_FRAMES",
  COPY_SPRITES_INTO_FRAME: "COPY_SPRITES_INTO_FRAME",
  ADD_CURRENT_SPRITE: "ADD_CURRENT_SPRITE",
  REMOVE_ALL_CURRENT_SPRITES: "REMOVE_ALL_CURRENT_SPRITES",
  UPDATE_PRESENTATION_TITLE: "UPDATE_PRESENTATION_TITLE",
  SET_IS_FRAMES_SAVING: "SET_IS_FRAMES_SAVING",
  SET_FRAME_PREVIEW: "SET_FRAME_PREVIEW",
  SEND_SPRITES_TO_BACK: "SEND_SPRITES_TO_BACK",
  BRING_SPRITES_TO_FRONT: "BRING_SPRITES_TO_FRONT",
  SET_CURRENT_FRAME_BACKGROUND: "SET_CURRENT_FRAME_BACKGROUND",
  UNDO: "UNDO",
  REDO: "REDO",
  GROUP_SPRITES_BY_IDS: "GROUP_SPRITES_BY_IDS",
  UNGROUP_SPRITES_BY_IDS: "UNGROUP_SPRITES_BY_IDS",
};

export type SpriteId = number | string;

// One sprite's worth of changes. `positionX` / `positionY` are accepted as flat
// fields and mapped onto `position` by the reducer.
export interface SpritePatch {
  id: SpriteId;
  fields: Record<string, any>;
}

export const loadInitialData = (payload: any) => ({
  type: Actions.SET_INITIAL_DATA,
  payload,
});

export const addSprite = (sprite: NewSprite) => ({
  type: Actions.ADD_SPRITE,
  payload: sprite,
});

// The one sprite-editing primitive: a list of per-sprite patches applied in a
// single pass, so N sprites cost one frame recompute and one undo entry rather
// than N of each. `updateSpriteById` and `updateSpritesByIds` below are sugar
// over it for the two common shapes.
export const updateSprites = (patches: SpritePatch[]) => ({
  type: Actions.UPDATE_SPRITES,
  payload: { patches },
});

export const updateSpriteById = ({
  id,
  fields,
}: {
  id: SpriteId;
  fields: Record<string, any>;
}) => updateSprites([{ id, fields }]);

// Applies the same fields to every listed sprite — what the properties sidebar
// does when several sprites are selected.
export const updateSpritesByIds = ({
  ids,
  fields,
}: {
  ids: SpriteId[];
  fields: Record<string, any>;
}) => updateSprites(ids.map((id) => ({ id, fields })));

export const removeSpritesByIds = (ids: SpriteId[]) => ({
  type: Actions.REMOVE_SPRITES_BY_IDS,
  payload: { ids },
});

export const removeSpritesByIdsFromAllFrames = (ids: SpriteId[]) => ({
  type: Actions.REMOVE_SPRITES_BY_IDS_FROM_ALL_FRAMES,
  payload: { ids },
});

export const copySpritesIntoFrame = (
  ids: SpriteId[],
  frameId: SpriteId,
) => ({
  type: Actions.COPY_SPRITES_INTO_FRAME,
  payload: { ids, frameId },
});

export const addFrame = (frame: Frame, afterId?: number | string | null) => ({
  type: Actions.ADD_FRAME,
  payload: { frame, afterId },
});

export const nextAnimationFrame = () => ({
  type: Actions.NEXT_FRAME,
});

export const prevAnimationFrame = () => ({
  type: Actions.PREV_FRAME,
});

export const removeFrameById = ({ id }: any) => ({
  type: Actions.REMOVE_FRAME,
  payload: { id },
});

export const setCurrentFrame = (frameId: number | string | null) => ({
  type: Actions.SET_CURRENT_FRAME,
  payload: frameId,
});

export const setCurrentSprite = (spriteId: number | string | null) => ({
  type: Actions.SET_CURRENT_SPRITE,
  payload: spriteId,
});

export const addCurrentSprite = (spriteId: number | string | null) => ({
  type: Actions.ADD_CURRENT_SPRITE,
  payload: spriteId,
});

export const unselectAllSprites = () => ({
  type: Actions.REMOVE_ALL_CURRENT_SPRITES,
});

export const updatePresentationTitle = (title: string) => ({
  type: Actions.UPDATE_PRESENTATION_TITLE,
  payload: title,
});

export const setIsFramesSaving = (value: boolean) => ({
  type: Actions.SET_IS_FRAMES_SAVING,
  payload: value,
});

export const setFramePreview = (frameId: string | number, preview: any) => ({
  type: Actions.SET_FRAME_PREVIEW,
  payload: {
    frameId,
    preview,
  },
});

export const sendSpritesToBack = (ids: SpriteId[]) => ({
  type: Actions.SEND_SPRITES_TO_BACK,
  payload: { ids },
});

export const bringSpritesToFront = (ids: SpriteId[]) => ({
  type: Actions.BRING_SPRITES_TO_FRONT,
  payload: { ids },
});

export const recomputeFrames = () => ({
  type: Actions.RECOMPUTE_FRAMES,
});

export const setCurrentFrameBackground = (background: string) => ({
  type: Actions.SET_CURRENT_FRAME_BACKGROUND,
  payload: background,
});

export const reorderFrames = (fromIndex: number, toIndex: number) => ({
  type: Actions.REORDER_FRAMES,
  payload: { fromIndex, toIndex },
});

export const undo = () => ({
  type: Actions.UNDO,
});

export const redo = () => ({
  type: Actions.REDO,
});

// Groups the listed sprites (needs at least two). Ungrouping dissolves every
// group any of the listed sprites belongs to, across all frames.
export const groupSpritesByIds = (ids: SpriteId[]) => ({
  type: Actions.GROUP_SPRITES_BY_IDS,
  payload: { ids },
});

export const ungroupSpritesByIds = (ids: SpriteId[]) => ({
  type: Actions.UNGROUP_SPRITES_BY_IDS,
  payload: { ids },
});
