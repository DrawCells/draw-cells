import { addSprite, NewSprite } from "../Frames/actions";
import State from "../stateInterface";
import { Sprite } from "../Frames/reducers/frames";

// Minimal shape of the Redux store this module needs. Declared structurally
// rather than imported so these helpers stay usable from a plain store handle
// (`useStore()`) without dragging in react-redux types.
export interface StoreLike {
  dispatch: (action: any) => void;
  getState: () => State;
}

// Adds a sprite and returns the id the reducer assigned it.
//
// ADD_SPRITE is deliberately the sole authority on sprite ids — it ignores any
// id the caller supplies so two sprites can never collide (see the comment in
// the reducer) — and the action creator returns nothing. That is fine for the
// drag-and-drop path, which never needs the id back, but a programmatic caller
// that wants to position, animate, or delete what it just created does.
//
// The id is recovered by diffing the sprite list rather than reading the last
// element, so this does not depend on ADD_SPRITE appending rather than
// inserting. Returns null if the dispatch produced no new sprite.
export function addSpriteAndGetId(
  store: StoreLike,
  sprite: NewSprite,
): string | number | null {
  const before = new Set(
    store
      .getState()
      .frames.currentFrame.sprites.map((s: Sprite) => s.id.toString()),
  );

  store.dispatch(addSprite(sprite));

  const added = store
    .getState()
    .frames.currentFrame.sprites.find(
      (s: Sprite) => !before.has(s.id.toString()),
    );

  return added ? added.id : null;
}
