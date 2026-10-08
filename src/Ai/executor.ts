import { VIEWPORT_HEIGHT, VIEWPORT_WIDTH } from "../constants";
import { loadSpriteImage } from "../helpers";
import {
  addFrame,
  bringSpritesToFront,
  copySpritesIntoFrame,
  groupSpritesByIds,
  removeSpritesByIds,
  removeSpritesByIdsFromAllFrames,
  sendSpritesToBack,
  setCurrentFrame,
  setCurrentFrameBackground,
  SpriteId,
  SpritePatch,
  ungroupSpritesByIds,
  updateSprites,
} from "../Frames/actions";
import {
  Frame,
  isArrowSprite,
  isImageSprite,
  isTextSprite,
  Sprite,
} from "../Frames/reducers/frames";
import { addSpriteAndGetId, StoreLike } from "./dispatch";
import {
  resolveFrameHandle,
  resolveSpriteHandle,
  shortId,
} from "./stateProjection";
import {
  ADD_FRAME,
  ADD_SPRITE,
  ADD_TEXT,
  AddFrameInput,
  AddSpriteInput,
  AddTextInput,
  ARRANGE_SPRITES,
  ArrangeSpritesInput,
  COPY_SPRITES_TO_FRAME,
  CopySpritesToFrameInput,
  DELETE_SPRITES,
  DeleteSpritesInput,
  GROUP_SPRITES,
  GroupSpritesInput,
  LIST_BACKGROUNDS,
  SEARCH_SPRITES,
  SearchSpritesInput,
  SET_ANIMATION,
  SET_FRAME_BACKGROUND,
  SetAnimationInput,
  SetFrameBackgroundInput,
  SpriteEdit,
  SWITCH_FRAME,
  SwitchFrameInput,
  UNGROUP_SPRITES,
  UPDATE_SPRITES,
  UpdateSpritesInput,
} from "./tools";

// Runs a tool call the model asked for. This is the browser half of the loop:
// the server owns the API key and the prompt, this owns the store.
//
// Errors are returned as tool results with `isError`, never thrown. A thrown
// error would abort the turn; a returned one lets the model read what went
// wrong and try something else, which is almost always the better outcome.

export interface ToolOutcome {
  content: string;
  isError?: boolean;
}

const DEFAULT_SPRITE_SIZE = 50;
const DEFAULT_FONT_SIZE = 24;
const DEFAULT_TEXT_COLOR = "#000000";

// How many variant names to list per search hit. Some sprites come in dozens;
// past this the row costs more than the choice is worth.
const MAX_VARIANTS_LISTED = 12;

// How many search hits to feed back. The catalogue can return 200; the model
// only needs enough to choose, and every row costs context on a request that
// repeats each loop iteration.
const MAX_SEARCH_RESULTS = 8;

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

// A catalogue row's base_image_url is an extension-less path
// ("sprites/Brain/Neuron"), but the storage key is the file itself. Every other
// route onto the canvas appends the extension on the way — SpritesSection when
// it signs a preview, SidebarSpriteWithVariants when it builds the drag payload
// — so this does too. Without it resolveImageUrl presigns a key that does not
// exist, and the sprite lands as a blank image rather than an error.
const IMAGE_FILE = /\.(svg|png|jpe?g|webp|gif)$/i;
const ABSOLUTE = /^(https?:|data:|blob:|gs:|\/)/;

function withImageExtension(path: string): string {
  if (!path || ABSOLUTE.test(path)) return path;
  return IMAGE_FILE.test(path) ? path : `${path}.svg`;
}

// Sprites that have variants keep each one in its own file ("<base> - <variant>.svg")
// and may have no plain "<base>.svg" at all. The sidebar shows the first variant
// as the default, so hand the model the same file it would get by dragging.
function spriteStorageKey(
  sprite: { baseImageUrl?: string; variants?: string[] },
  variant: string | undefined = sprite.variants?.[0],
): string {
  const base = (sprite.baseImageUrl ?? "").trim();
  if (!base || ABSOLUTE.test(base)) return base;

  if (!variant) return withImageExtension(base);
  return withImageExtension(`${base.replace(IMAGE_FILE, "")} - ${variant}`);
}

// Search hits, keyed by the image_url handed to the model. add_sprite's
// `variant` needs the catalogue row (base path + variant list) behind an
// image_url, and recovering it from the URL alone is unreliable — variant
// names and base names can both contain " - ". Module scope so it outlives a
// turn: the model may place a sprite it found several messages ago.
interface CatalogueEntry {
  name: string;
  baseImageUrl: string;
  variants: string[];
}
const searchIndex = new Map<string, CatalogueEntry>();

// Keeps a sprite's centre inside the visible canvas. The stage is larger than
// the viewport, so an unclamped coordinate does not error — the sprite just
// lands somewhere the user cannot see, which reads as the tool silently
// failing. Clamping is reported back so the model can correct its next call.
function clampToCanvas(x: number, y: number) {
  const cx = clamp(Math.round(x), 0, VIEWPORT_WIDTH);
  const cy = clamp(Math.round(y), 0, VIEWPORT_HEIGHT);
  return {
    x: cx,
    y: cy,
    clamped: cx !== Math.round(x) || cy !== Math.round(y),
  };
}

// Konva wraps Text at `width`, so the box is sized from the content rather
// than left at a fixed default — a fixed box makes short labels look
// mispositioned and wraps long ones mid-word. The height has to cover every
// wrapped line: Konva silently drops lines that overflow a fixed height, so a
// one-line box cuts a long caption short. 0.62em per character overestimates
// Arial slightly, which errs towards a spare line rather than a lost one.
function textBoxSize(text: string, fontSize: number) {
  const lineWidths = text.split("\n").map((l) => l.length * fontSize * 0.62);
  const width = clamp(Math.max(...lineWidths), 80, VIEWPORT_WIDTH - 40);
  const lines = lineWidths.reduce(
    (n, w) => n + Math.max(1, Math.ceil(w / width)),
    0,
  );
  return {
    width: Math.round(width),
    // Konva's default lineHeight is 1; half a line of slack keeps the
    // vertically centred text clear of the box edges.
    height: Math.round(fontSize * (lines + 0.5)),
  };
}

async function searchSprites(input: SearchSpritesInput): Promise<ToolOutcome> {
  console.log("searchSprites input:", input);
  const query = (input?.query ?? "").trim();
  if (!query) return { content: "query is required.", isError: true };

  const res = await fetch(`/api/sprites?search=${encodeURIComponent(query)}`);
  console.log("searchSprites response:", res);
  if (!res.ok) {
    return { content: `Sprite search failed (${res.status}).`, isError: true };
  }

  const { sprites = [] } = await res.json();
  if (sprites.length === 0) {
    return {
      content: `No sprites match "${query}". Try a broader term.`,
    };
  }

  // Emit the storage key, not the raw base path: the model is told to copy
  // image_url verbatim, so the value it copies has to be the one that resolves.
  const rows = sprites
    .slice(0, MAX_SEARCH_RESULTS)
    .map((s: any) => {
      const imageUrl = spriteStorageKey(s);
      const variants: string[] = s.variants ?? [];
      searchIndex.set(imageUrl, {
        name: s.name,
        baseImageUrl: s.baseImageUrl ?? "",
        variants,
      });
      if (variants.length < 2) return `${s.name} | image_url=${imageUrl}`;

      const listed = variants
        .slice(0, MAX_VARIANTS_LISTED)
        .map((v, i) => (i === 0 ? `${v} (default)` : v))
        .join(", ");
      const extra =
        variants.length > MAX_VARIANTS_LISTED
          ? `, +${variants.length - MAX_VARIANTS_LISTED} more`
          : "";
      return `${s.name} | image_url=${imageUrl} | variants: ${listed}${extra}`;
    })
    .join("\n");

  const more =
    sprites.length > MAX_SEARCH_RESULTS
      ? `\n(${sprites.length - MAX_SEARCH_RESULTS} further matches not shown — refine the query if none of these fit.)`
      : "";

  return { content: `Matches for "${query}":\n${rows}${more}` };
}

async function addSprite(
  store: StoreLike,
  input: AddSpriteInput,
): Promise<ToolOutcome> {
  const raw = (input?.image_url ?? "").trim();
  if (!raw) {
    return {
      content: "image_url is required — call search_sprites first.",
      isError: true,
    };
  }

  // Belt and braces: search_sprites already returns a key with its extension,
  // but the model can echo back an older, extension-less one from earlier in the
  // conversation. Cheaper to normalise than to fail the placement.
  let imageUrl = withImageExtension(raw);
  const entry = searchIndex.get(raw) ?? searchIndex.get(imageUrl);
  let name = input.name?.trim() || entry?.name;

  const requested = input.variant?.trim();
  if (requested) {
    if (!entry) {
      return {
        content:
          `No search result is on record for "${raw}", so its variants are ` +
          `unknown. Search for the sprite again, then retry with its image_url.`,
        isError: true,
      };
    }
    const variant = entry.variants.find(
      (v) => v.toLowerCase() === requested.toLowerCase(),
    );
    if (!variant) {
      return {
        content:
          entry.variants.length > 0
            ? `"${entry.name}" has no variant "${requested}". Its variants are: ` +
              `${entry.variants.join(", ")}.`
            : `"${entry.name}" has no variants; omit variant.`,
        isError: true,
      };
    }
    imageUrl = spriteStorageKey(entry, variant);
    if (name && variant !== entry.variants[0]) name = `${name} (${variant})`;
  }

  // Mirrors the drag-and-drop sizing in AnimationCanvas.createSprite: pin the
  // shorter side to the base size and let the longer side grow, so a wide image
  // gets wider rather than squashed.
  const image = await loadSpriteImage(imageUrl);
  if (!image) {
    return {
      content:
        `Could not load an image at "${imageUrl}". Use an image_url exactly as ` +
        `returned by search_sprites.`,
      isError: true,
    };
  }

  const base = input.size && input.size > 0 ? input.size : DEFAULT_SPRITE_SIZE;
  const ratio =
    image.naturalWidth > 0 && image.naturalHeight > 0
      ? image.naturalWidth / image.naturalHeight
      : 1;
  const width = Math.round(ratio >= 1 ? base * ratio : base);
  const height = Math.round(ratio >= 1 ? base : base / ratio);

  const { x, y, clamped } = clampToCanvas(input.x, input.y);
  const id = addSpriteAndGetId(store, {
    backgroundUrl: imageUrl,
    ...(name ? { name } : {}),
    position: { x, y },
    width,
    height,
    rotation: 0,
  });

  if (!id) return { content: "Failed to add the sprite.", isError: true };

  const label = name ? ` (${name})` : "";
  return {
    content:
      `Added sprite${label} as ${shortId(id)} at (${x}, ${y}), ${width}x${height}.` +
      (clamped ? " Position was clamped to stay on the canvas." : ""),
  };
}

async function addText(
  store: StoreLike,
  input: AddTextInput,
): Promise<ToolOutcome> {
  const text = input?.text ?? "";
  if (!text.trim()) return { content: "text is required.", isError: true };

  const fontSize =
    input.font_size && input.font_size > 0
      ? input.font_size
      : DEFAULT_FONT_SIZE;

  const { width, height } = textBoxSize(text, fontSize);

  const { x, y, clamped } = clampToCanvas(input.x, input.y);
  const id = addSpriteAndGetId(store, {
    kind: "text",
    text,
    fontSize,
    fontFamily: "Arial",
    fill: input.color || DEFAULT_TEXT_COLOR,
    align: "center",
    position: { x, y },
    width,
    height,
    rotation: 0,
  });

  if (!id) return { content: "Failed to add the text.", isError: true };

  return {
    content:
      `Added text ${shortId(id)} "${text}" at (${x}, ${y}).` +
      (clamped ? " Position was clamped to stay on the canvas." : ""),
  };
}

// ── Handle resolution ───────────────────────────────────────────────────────
//
// Every sprite-mutating reducer case acts on the current frame only, and a
// handle naming a sprite elsewhere is silently ignored by it. So handles are
// checked here first, and a sprite that exists on another frame gets an error
// saying which one — the model can switch_frame and retry, rather than being
// told it succeeded at something that never happened.

type Resolved<T> = { ok: true; value: T } | { ok: false; error: ToolOutcome };

const fail = (content: string): { ok: false; error: ToolOutcome } => ({
  ok: false,
  error: { content, isError: true },
});

const frameNumber = (frames: Frame[], id: SpriteId | null) =>
  frames.findIndex((f) => f.id?.toString() === id?.toString()) + 1;

function resolveSprites(
  store: StoreLike,
  handles: unknown,
  { anyFrame = false }: { anyFrame?: boolean } = {},
): Resolved<Sprite[]> {
  if (!Array.isArray(handles) || handles.length === 0) {
    return fail("Pass at least one sprite handle.");
  }

  const state = store.getState().frames;
  const onCurrent = new Map(
    state.currentFrame.sprites.map((s) => [s.id.toString(), s] as const),
  );
  const errors: string[] = [];
  const found = new Map<string, Sprite>();

  for (const handle of handles) {
    const resolution = resolveSpriteHandle(state, String(handle));
    if (!resolution.ok) {
      errors.push(
        resolution.reason === "ambiguous"
          ? `"${handle}" matches several sprites (${resolution.candidates.join(", ")}).`
          : `No sprite "${handle}".`,
      );
      continue;
    }
    const key = resolution.id.toString();
    const sprite =
      onCurrent.get(key) ??
      (anyFrame
        ? state.frames
            .flatMap((f) => f.sprites)
            .find((s) => s.id.toString() === key)
        : undefined);
    if (!sprite) {
      const home = state.frames.find((f) =>
        f.sprites.some((s) => s.id.toString() === key),
      );
      errors.push(
        `Sprite ${shortId(resolution.id)} is not on the current frame` +
          (home ? ` (it is on frame ${frameNumber(state.frames, home.id)})` : "") +
          ". Call switch_frame first.",
      );
      continue;
    }
    found.set(key, sprite);
  }

  // All or nothing: half-applying a multi-sprite edit leaves the model unsure
  // which half landed.
  if (errors.length > 0) {
    return fail(`${errors.join(" ")} Nothing was changed.`);
  }
  return { ok: true, value: Array.from(found.values()) };
}

// A frame is named by its handle or by its 1-based position. Handles are 8
// characters, so a 1–3 digit string can only be a position.
function resolveFrame(store: StoreLike, ref: unknown): Resolved<Frame> {
  const state = store.getState().frames;
  const total = state.frames.length;

  const asNumber =
    typeof ref === "number"
      ? ref
      : typeof ref === "string" && /^\d{1,3}$/.test(ref.trim())
        ? parseInt(ref, 10)
        : null;
  if (asNumber !== null) {
    if (!Number.isInteger(asNumber) || asNumber < 1 || asNumber > total) {
      return fail(`There is no frame ${ref}; frames are numbered 1–${total}.`);
    }
    return { ok: true, value: state.frames[asNumber - 1] };
  }

  const resolution = resolveFrameHandle(state, String(ref ?? ""));
  if (!resolution.ok) {
    return fail(
      resolution.reason === "ambiguous"
        ? `"${ref}" matches several frames (${resolution.candidates.join(", ")}).`
        : `No frame "${ref}".`,
    );
  }
  const frame = state.frames.find(
    (f) => f.id?.toString() === resolution.id.toString(),
  );
  return frame ? { ok: true, value: frame } : fail(`No frame "${ref}".`);
}

const handles = (sprites: Sprite[]) =>
  sprites.map((s) => shortId(s.id)).join(", ");

const isFiniteNumber = (n: unknown): n is number =>
  typeof n === "number" && Number.isFinite(n);

const HEX_COLOR = /^#(?:[0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i;

// ── Editing ─────────────────────────────────────────────────────────────────

// Turns one model-facing edit into a reducer patch. Returns an error string
// instead when the edit does not fit the sprite (font size on an image, etc.).
function patchFor(
  sprite: Sprite,
  edit: SpriteEdit,
): { fields: Record<string, any>; notes: string[] } | string {
  const h = shortId(sprite.id);
  const fields: Record<string, any> = {};
  const notes: string[] = [];

  if (isFiniteNumber(edit.x) || isFiniteNumber(edit.y)) {
    const { x, y, clamped } = clampToCanvas(
      isFiniteNumber(edit.x) ? edit.x : sprite.position.x,
      isFiniteNumber(edit.y) ? edit.y : sprite.position.y,
    );
    fields.positionX = x;
    fields.positionY = y;
    if (clamped) notes.push(`${h}: position clamped to stay on the canvas`);
  }

  if (edit.text !== undefined || edit.font_size !== undefined) {
    if (!isTextSprite(sprite)) {
      return `${h} is not a text sprite, so text and font_size do not apply.`;
    }
  }
  if (edit.text !== undefined) {
    if (!String(edit.text).trim()) return `${h}: text cannot be empty.`;
    fields.text = String(edit.text);
  }
  if (edit.font_size !== undefined) {
    if (!isFiniteNumber(edit.font_size) || edit.font_size <= 0) {
      return `${h}: font_size must be a positive number.`;
    }
    fields.fontSize = edit.font_size;
  }

  const width = isFiniteNumber(edit.width) ? edit.width : undefined;
  const height = isFiniteNumber(edit.height) ? edit.height : undefined;
  if ((width !== undefined && width <= 0) || (height !== undefined && height <= 0)) {
    return `${h}: width and height must be positive.`;
  }
  if (width !== undefined || height !== undefined) {
    // An image given one side keeps its aspect ratio; anything else (text
    // boxes, arrows, or both sides given) takes the sides as stated.
    const ratio = sprite.height > 0 ? sprite.width / sprite.height : 1;
    const keepRatio = isImageSprite(sprite) && (width === undefined) !== (height === undefined);
    fields.width = Math.round(
      width ?? (keepRatio ? height! * ratio : sprite.width),
    );
    fields.height = Math.round(
      height ?? (keepRatio ? width! / ratio : sprite.height),
    );
  } else if (isTextSprite(sprite) && (fields.text || fields.fontSize)) {
    // New wording or size without an explicit box: refit the box the same
    // way add_text sized it, so the text neither wraps nor floats.
    Object.assign(
      fields,
      textBoxSize(fields.text ?? sprite.text, fields.fontSize ?? sprite.fontSize),
    );
  }

  if (edit.rotation !== undefined) {
    if (!isFiniteNumber(edit.rotation)) return `${h}: rotation must be a number.`;
    fields.rotation = ((edit.rotation % 360) + 360) % 360;
  }
  if (edit.opacity !== undefined) {
    if (!isFiniteNumber(edit.opacity)) return `${h}: opacity must be a number.`;
    fields.opacity = clamp(edit.opacity, 0, 1);
  }

  if (edit.color !== undefined) {
    if (!HEX_COLOR.test(String(edit.color))) {
      return `${h}: color must be a hex colour such as "#1a73e8".`;
    }
    if (isTextSprite(sprite)) fields.fill = edit.color;
    else if (isArrowSprite(sprite)) fields.stroke = edit.color;
    else return `${h} is an image; its colour cannot be changed.`;
  }

  if (Object.keys(fields).length === 0) {
    return `${h}: the edit changes nothing — pass at least one field.`;
  }
  return { fields, notes };
}

function updateSpritesTool(
  store: StoreLike,
  input: UpdateSpritesInput,
): ToolOutcome {
  const edits = Array.isArray(input?.edits) ? input.edits : [];
  if (edits.length === 0) return { content: "Pass at least one edit.", isError: true };

  const resolved = resolveSprites(
    store,
    edits.map((e) => e?.sprite),
  );
  if (!resolved.ok) return resolved.error;
  const byKey = new Map(resolved.value.map((s) => [s.id.toString(), s]));
  const state = store.getState().frames;

  const patches: SpritePatch[] = [];
  const notes: string[] = [];
  const errors: string[] = [];
  for (const edit of edits) {
    const resolution = resolveSpriteHandle(state, String(edit.sprite));
    const sprite = resolution.ok ? byKey.get(resolution.id.toString()) : undefined;
    if (!sprite) continue; // unreachable: resolveSprites vetted every handle
    const patch = patchFor(sprite, edit);
    if (typeof patch === "string") {
      errors.push(patch);
      continue;
    }
    patches.push({ id: sprite.id, fields: patch.fields });
    notes.push(...patch.notes);
  }
  if (errors.length > 0) {
    return { content: `${errors.join(" ")} Nothing was changed.`, isError: true };
  }

  store.dispatch(updateSprites(patches));

  // Read back what landed rather than echoing the request, so clamping and
  // aspect-ratio adjustments are visible to the model.
  const after = store.getState().frames.currentFrame.sprites;
  const summary = patches
    .map((p) => {
      const s = after.find((x) => x.id.toString() === p.id.toString());
      return s
        ? `${shortId(s.id)} @${Math.round(s.position.x)},${Math.round(s.position.y)} ${Math.round(s.width)}x${Math.round(s.height)}`
        : shortId(p.id);
    })
    .join("; ");
  return {
    content:
      `Updated ${patches.length} sprite${patches.length === 1 ? "" : "s"}: ${summary}.` +
      (notes.length ? ` Note: ${notes.join("; ")}.` : ""),
  };
}

function deleteSpritesTool(
  store: StoreLike,
  input: DeleteSpritesInput,
): ToolOutcome {
  const everywhere = input?.from_all_frames === true;
  const resolved = resolveSprites(store, input?.sprites, { anyFrame: everywhere });
  if (!resolved.ok) return resolved.error;

  const ids = resolved.value.map((s) => s.id);
  store.dispatch(
    everywhere ? removeSpritesByIdsFromAllFrames(ids) : removeSpritesByIds(ids),
  );
  return {
    content:
      `Removed ${handles(resolved.value)} from ` +
      (everywhere ? "every frame." : "the current frame."),
  };
}

// ── Animation ───────────────────────────────────────────────────────────────

const ANIMATION_TYPES = ["LINEAR", "CHAOTIC", "CIRCULAR"];

function setAnimationTool(
  store: StoreLike,
  input: SetAnimationInput,
): ToolOutcome {
  const resolved = resolveSprites(store, input?.sprites);
  if (!resolved.ok) return resolved.error;

  // Bounds follow the properties sidebar's controls, so the assistant cannot
  // set a value the user could not reproduce or adjust by hand.
  const fields: Record<string, any> = {};
  if (input.type !== undefined) {
    const type = String(input.type).toUpperCase();
    if (!ANIMATION_TYPES.includes(type)) {
      return {
        content: `type must be one of ${ANIMATION_TYPES.join(", ")}.`,
        isError: true,
      };
    }
    fields.animationType = type;
  }
  if (isFiniteNumber(input.duration)) {
    fields.duration = clamp(input.duration, 0.1, 30);
  }
  if (isFiniteNumber(input.range_of_movement)) {
    fields.rangeOfMovement = Math.round(clamp(input.range_of_movement, 10, 500));
  }
  if (isFiniteNumber(input.iterations)) {
    fields.nrOfIterations = Math.round(clamp(input.iterations, 1, 30));
  }
  if (isFiniteNumber(input.arc_angle)) {
    fields.angle = clamp(input.arc_angle, 1, 359);
  }
  if (input.arc_direction !== undefined) {
    if (input.arc_direction !== "up" && input.arc_direction !== "down") {
      return { content: 'arc_direction must be "up" or "down".', isError: true };
    }
    // Matches the sidebar's select: 1 is "Upwards", -1 "Downwards".
    fields.circleDirection = input.arc_direction === "up" ? 1 : -1;
  }
  if (Object.keys(fields).length === 0) {
    return { content: "Pass at least one animation setting.", isError: true };
  }

  store.dispatch(
    updateSprites(resolved.value.map((s) => ({ id: s.id, fields }))),
  );

  // Motion only exists between a sprite and its twin in the next frame. Say
  // so when there is none, or the model will believe it animated something.
  const { frames, currentFrame } = store.getState().frames;
  const next = frames[frameNumber(frames, currentFrame.id)];
  const nextIds = new Set((next?.sprites ?? []).map((s) => s.id.toString()));
  const still = resolved.value.filter((s) => !nextIds.has(s.id.toString()));

  let note = "";
  if (!next) {
    note =
      " There is no next frame yet, so nothing moves until you add_frame and " +
      "reposition these sprites in it.";
  } else if (still.length > 0) {
    note =
      ` ${handles(still)} ${still.length === 1 ? "is" : "are"} not in the next ` +
      "frame, so the setting has no visible effect for them.";
  }

  const settings = Object.entries(fields)
    .map(([k, v]) => `${k}=${v}`)
    .join(", ");
  return {
    content: `Set ${settings} on ${handles(resolved.value)}.${note}`,
  };
}

// ── Frames ──────────────────────────────────────────────────────────────────

function describeCurrentFrame(store: StoreLike): string {
  const { frames, currentFrame } = store.getState().frames;
  const count = currentFrame.sprites.length;
  return (
    `frame ${frameNumber(frames, currentFrame.id)}/${frames.length} ` +
    `id=${shortId(currentFrame.id)} (${count} sprite${count === 1 ? "" : "s"})`
  );
}

function addFrameTool(store: StoreLike, input: AddFrameInput): ToolOutcome {
  const copy = input?.copy_sprites !== false;
  const { currentFrame } = store.getState().frames;

  // Same shape as the frames sidebar's "clone": copies keep their ids, which
  // is what pairs them with the originals for motion. The reducer assigns the
  // frame's own id and title and makes it current.
  store.dispatch(
    addFrame(
      {
        id: "",
        title: "",
        sprites: copy ? structuredClone(currentFrame.sprites) : [],
      },
      currentFrame.id,
    ),
  );
  return {
    content:
      `Added ${describeCurrentFrame(store)}, now current` +
      (copy
        ? ". Its sprites are copies with the same handles — move them here to animate."
        : ", empty."),
  };
}

function switchFrameTool(store: StoreLike, input: SwitchFrameInput): ToolOutcome {
  const resolved = resolveFrame(store, input?.frame);
  if (!resolved.ok) return resolved.error;
  store.dispatch(setCurrentFrame(resolved.value.id));
  return { content: `Now on ${describeCurrentFrame(store)}.` };
}

function copySpritesToFrameTool(
  store: StoreLike,
  input: CopySpritesToFrameInput,
): ToolOutcome {
  const sprites = resolveSprites(store, input?.sprites);
  if (!sprites.ok) return sprites.error;
  const target = resolveFrame(store, input?.frame);
  if (!target.ok) return target.error;

  const state = store.getState().frames;
  if (target.value.id?.toString() === state.currentFrame.id?.toString()) {
    return {
      content: "That is the current frame; pick a different target frame.",
      isError: true,
    };
  }

  const present = new Set(target.value.sprites.map((s) => s.id.toString()));
  const toCopy = sprites.value.filter((s) => !present.has(s.id.toString()));
  const skipped = sprites.value.filter((s) => present.has(s.id.toString()));
  const n = frameNumber(state.frames, target.value.id);

  if (toCopy.length > 0) {
    store.dispatch(
      copySpritesIntoFrame(
        toCopy.map((s) => s.id),
        target.value.id as SpriteId,
      ),
    );
  }
  return {
    content:
      (toCopy.length > 0
        ? `Copied ${handles(toCopy)} into frame ${n}.`
        : `Nothing copied.`) +
      (skipped.length > 0 ? ` Frame ${n} already had ${handles(skipped)}.` : ""),
  };
}

// ── Z-order and grouping ────────────────────────────────────────────────────

function arrangeSpritesTool(
  store: StoreLike,
  input: ArrangeSpritesInput,
): ToolOutcome {
  if (input?.to !== "front" && input?.to !== "back") {
    return { content: 'to must be "front" or "back".', isError: true };
  }
  const resolved = resolveSprites(store, input.sprites);
  if (!resolved.ok) return resolved.error;
  const ids = resolved.value.map((s) => s.id);
  store.dispatch(
    input.to === "front" ? bringSpritesToFront(ids) : sendSpritesToBack(ids),
  );
  return { content: `Moved ${handles(resolved.value)} to the ${input.to}.` };
}

function groupSpritesTool(
  store: StoreLike,
  input: GroupSpritesInput,
): ToolOutcome {
  const resolved = resolveSprites(store, input?.sprites);
  if (!resolved.ok) return resolved.error;
  if (resolved.value.length < 2) {
    return { content: "Grouping needs at least two different sprites.", isError: true };
  }
  store.dispatch(groupSpritesByIds(resolved.value.map((s) => s.id)));
  const groupId = store
    .getState()
    .frames.currentFrame.sprites.find(
      (s) => s.id.toString() === resolved.value[0].id.toString(),
    )?.groupId;
  return {
    content: `Grouped ${handles(resolved.value)}${groupId ? ` as group=${shortId(groupId)}` : ""}.`,
  };
}

function ungroupSpritesTool(
  store: StoreLike,
  input: GroupSpritesInput,
): ToolOutcome {
  const resolved = resolveSprites(store, input?.sprites);
  if (!resolved.ok) return resolved.error;
  if (!resolved.value.some((s) => s.groupId)) {
    return { content: `${handles(resolved.value)} are not in a group.` };
  }
  store.dispatch(ungroupSpritesByIds(resolved.value.map((s) => s.id)));
  return { content: `Ungrouped ${handles(resolved.value)} and the rest of their group(s).` };
}

// ── Backgrounds ─────────────────────────────────────────────────────────────

// The backgrounds sidebar pages through this prefix 20 at a time; the model
// gets one larger page, which covers the library as it stands.
const MAX_BACKGROUNDS = 100;

async function listBackgroundsTool(): Promise<ToolOutcome> {
  const params = new URLSearchParams({
    prefix: "backgrounds",
    maxResults: String(MAX_BACKGROUNDS),
  });
  const res = await fetch(`/api/storage?${params}`);
  if (!res.ok) {
    return { content: `Listing backgrounds failed (${res.status}).`, isError: true };
  }
  const { files = [], nextPageToken } = await res.json();
  if (files.length === 0) return { content: "No background images are available." };

  const rows = files.map((f: { path: string }) => f.path).join("\n");
  return {
    content:
      `Backgrounds (pass a path verbatim to set_frame_background):\n${rows}` +
      (nextPageToken ? "\n(more exist that are not listed)" : ""),
  };
}

async function setFrameBackgroundTool(
  store: StoreLike,
  input: SetFrameBackgroundInput,
): Promise<ToolOutcome> {
  const path = (input?.path ?? "").trim();
  if (!path) {
    store.dispatch(setCurrentFrameBackground(""));
    return { content: "Cleared the current frame's background." };
  }
  // As with sprites, a bad path does not error on its own — the frame just
  // renders without a background. Load it first so the model hears about it.
  if (!(await loadSpriteImage(path))) {
    return {
      content: `Could not load a background at "${path}". Use a path from list_backgrounds.`,
      isError: true,
    };
  }
  store.dispatch(setCurrentFrameBackground(path));
  return { content: `Set the current frame's background to "${path}".` };
}

export async function executeTool(
  store: StoreLike,
  name: string,
  input: any,
): Promise<ToolOutcome> {
  try {
    switch (name) {
      case SEARCH_SPRITES:
        return await searchSprites(input as SearchSpritesInput);
      case ADD_SPRITE:
        return await addSprite(store, input as AddSpriteInput);
      case ADD_TEXT:
        return await addText(store, input as AddTextInput);
      case UPDATE_SPRITES:
        return updateSpritesTool(store, input as UpdateSpritesInput);
      case DELETE_SPRITES:
        return deleteSpritesTool(store, input as DeleteSpritesInput);
      case SET_ANIMATION:
        return setAnimationTool(store, input as SetAnimationInput);
      case ADD_FRAME:
        return addFrameTool(store, input as AddFrameInput);
      case SWITCH_FRAME:
        return switchFrameTool(store, input as SwitchFrameInput);
      case COPY_SPRITES_TO_FRAME:
        return copySpritesToFrameTool(store, input as CopySpritesToFrameInput);
      case ARRANGE_SPRITES:
        return arrangeSpritesTool(store, input as ArrangeSpritesInput);
      case GROUP_SPRITES:
        return groupSpritesTool(store, input as GroupSpritesInput);
      case UNGROUP_SPRITES:
        return ungroupSpritesTool(store, input as GroupSpritesInput);
      case LIST_BACKGROUNDS:
        return await listBackgroundsTool();
      case SET_FRAME_BACKGROUND:
        return await setFrameBackgroundTool(store, input as SetFrameBackgroundInput);
      default:
        return { content: `Unknown tool "${name}".`, isError: true };
    }
  } catch (error: any) {
    return {
      content: `Tool "${name}" failed: ${error?.message ?? "unknown error"}`,
      isError: true,
    };
  }
}
