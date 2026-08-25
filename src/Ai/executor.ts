import { VIEWPORT_HEIGHT, VIEWPORT_WIDTH } from "../constants";
import { loadSpriteImage } from "../helpers";
import { addSpriteAndGetId, StoreLike } from "./dispatch";
import { shortId } from "./stateProjection";
import {
  ADD_SPRITE,
  ADD_TEXT,
  AddSpriteInput,
  AddTextInput,
  SEARCH_SPRITES,
  SearchSpritesInput,
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
function spriteStorageKey(sprite: {
  baseImageUrl?: string;
  variants?: string[];
}): string {
  const base = (sprite.baseImageUrl ?? "").trim();
  if (!base || ABSOLUTE.test(base)) return base;

  const variant = sprite.variants?.[0];
  if (!variant) return withImageExtension(base);
  return withImageExtension(`${base.replace(IMAGE_FILE, "")} - ${variant}`);
}

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
    .map((s: any) => `${s.name} | image_url=${spriteStorageKey(s)}`)
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
  const imageUrl = withImageExtension(raw);

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
    position: { x, y },
    width,
    height,
    rotation: 0,
  });

  if (!id) return { content: "Failed to add the sprite.", isError: true };

  const label = input.name ? ` (${input.name})` : "";
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

  // Konva wraps Text at `width`, so the box is sized from the content rather
  // than left at a fixed default — a fixed box makes short labels look
  // mispositioned and wraps long ones mid-word.
  const width = Math.round(
    clamp(text.length * fontSize * 0.62, 80, VIEWPORT_WIDTH - 40),
  );
  const height = Math.round(fontSize * 1.5);

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
