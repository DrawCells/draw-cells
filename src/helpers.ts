import Konva from "konva";
import { VIEWPORT_HEIGHT, VIEWPORT_WIDTH } from "./constants";
import { isArrowSprite, isTextSprite, Sprite } from "./Frames/reducers/frames";

// Generates a globally-unique, opaque id for sprites and frames. Using a UUID
// (instead of a monotonic counter derived from array order or the max existing
// id) means ids never collide regardless of reordering, deletion, cloning, or
// how many entities are created between renders. Ids are treated as opaque
// strings everywhere (compared via toString), so they never need to be parsed.
export function generateId(): string {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return crypto.randomUUID();
  }
  // Fallback for environments without crypto.randomUUID (e.g. older test envs).
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

// Derives the Konva Arrow geometry for an arrow sprite from its bounding box:
// a horizontal arrow across the box with the head sized to the box height.
export function arrowGeometry(width: number, height: number) {
  return {
    points: [0, height / 2, width, height / 2],
    strokeWidth: Math.max(2, height * 0.18),
    pointerWidth: height,
    pointerLength: Math.min(width * 0.5, height),
  };
}

// App-wide cache of loaded source images keyed by their original sprite URL, so
// each image is signed and downloaded once and the resulting HTMLImageElement is
// reused everywhere it is rendered (editing canvas, frame thumbnails, video
// export). Without this the video export re-signs and re-downloads each image on
// every one of its thousands of interpolated frames, which makes export appear
// to hang while it floods the network with requests.
const imageCache = new Map<string, Promise<HTMLImageElement | null>>();

export function loadSpriteImage(
  url: string,
): Promise<HTMLImageElement | null> {
  if (!url) return Promise.resolve(null);

  const cached = imageCache.get(url);
  if (cached) return cached;

  const promise = (async () => {
    const src = await resolveImageUrl(url);
    if (!src) return null;
    return new Promise<HTMLImageElement | null>((resolve) => {
      const img = new window.Image();
      img.crossOrigin = "anonymous";
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);
      img.src = src;
    });
  })().catch(() => null);

  // If loading ultimately fails, drop the entry so a later render can retry.
  promise.then((img) => {
    if (!img) imageCache.delete(url);
  });

  imageCache.set(url, promise);
  return promise;
}

// Adds a single sprite (image or text) to a Konva layer, mirroring how the
// editing canvas renders it. Used for frame thumbnails and video export so the
// rendering stays in one place.
// Builds the Konva node for a sprite. Image sprites resolve asynchronously
// (their bitmap has to load), so this is separated from adding the node to the
// layer: callers await all nodes in parallel, then add them in array order so
// z-ordering (bring-to-front / send-to-back) is preserved. Adding directly here
// would place synchronously-created text/arrow nodes before images that finish
// loading later, silently reordering the stack.
export async function createSpriteNode(s: Sprite): Promise<Konva.Shape | null> {
  if (isTextSprite(s)) {
    return new Konva.Text({
      x: s.position.x,
      y: s.position.y,
      text: s.text,
      fontSize: s.fontSize,
      fontFamily: s.fontFamily || "Arial",
      fontStyle: s.fontStyle || "normal",
      fill: s.fill || "#000000",
      align: s.align || "left",
      verticalAlign: "middle",
      wrap: "word",
      width: s.width,
      height: s.height,
      offsetX: s.width / 2,
      offsetY: s.height / 2,
      rotation: s.rotation,
      opacity: s.opacity ?? 1,
    });
  }

  if (isArrowSprite(s)) {
    const geom = arrowGeometry(s.width, s.height);
    return new Konva.Arrow({
      x: s.position.x,
      y: s.position.y,
      points: geom.points,
      stroke: s.stroke || "#000000",
      fill: s.stroke || "#000000",
      strokeWidth: geom.strokeWidth,
      pointerWidth: geom.pointerWidth,
      pointerLength: geom.pointerLength,
      offsetX: s.width / 2,
      offsetY: s.height / 2,
      rotation: s.rotation,
      opacity: s.opacity ?? 1,
    });
  }

  const img = await loadSpriteImage(s.backgroundUrl || "");
  if (!img) return null;
  return new Konva.Image({
    x: s.position.x,
    y: s.position.y,
    image: img,
    width: s.width,
    height: s.height,
    rotation: s.rotation,
    offsetX: s.width / 2,
    offsetY: s.height / 2,
    opacity: s.opacity ?? 1,
  });
}

// Adds sprites to the layer preserving their array order (= z-order). Nodes are
// created/loaded in parallel, then added sequentially so images that load later
// don't jump above earlier text/arrow sprites.
export async function addSpritesToLayer(
  layer: Konva.Layer,
  sprites: Sprite[],
): Promise<void> {
  const nodes = await Promise.all(sprites.map((s) => createSpriteNode(s)));
  for (const node of nodes) {
    if (node) layer.add(node);
  }
}

export async function renderFrameToDataUrl(sprites: Sprite[]): Promise<string> {
  const container = document.createElement("div");
  container.style.position = "fixed";
  container.style.left = "-9999px";
  container.style.top = "-9999px";
  document.body.appendChild(container);
  const stage = new Konva.Stage({ container, width: VIEWPORT_WIDTH, height: VIEWPORT_HEIGHT });
  const layer = new Konva.Layer();
  stage.add(layer);

  const background = new Konva.Rect({ x: 0, y: 0, width: VIEWPORT_WIDTH, height: VIEWPORT_HEIGHT, fill: "white" });
  layer.add(background);
  background.moveToBottom();

  await addSpritesToLayer(layer, sprites);

  stage.draw();
  const dataUrl = stage.toDataURL({ pixelRatio: 2 });
  stage.destroy();
  container.remove();
  return dataUrl;
}

export function getRndInteger(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min)) + min;
}

export function resolveSpriteUrl(url?: string): string {
  if (!url) return "";
  const normalized = url.trim();
  if (
    normalized.startsWith("http://") ||
    normalized.startsWith("https://") ||
    normalized.startsWith("data:") ||
    normalized.startsWith("blob:") ||
    normalized.startsWith("gs:")
  ) {
    return normalized;
  }
  return `/assets/cells/${normalized}`;
}

// Returns the object storage key extracted from `url`, or null if not applicable.
// Normally a bare path (e.g. "sprites/Brain/Neuron.svg"), which is now an S3 key.
// The storage.googleapis.com branch is a legacy fallback: migrateSignedUrlsToStoragePaths
// rewrote stored GCS signed URLs to bare paths, so it only catches stragglers.
function extractStoragePath(url: string): string | null {
  if (
    !url.startsWith("http://") &&
    !url.startsWith("https://") &&
    !url.startsWith("data:") &&
    !url.startsWith("blob:") &&
    !url.startsWith("gs:") &&
    !url.startsWith("/")
  ) {
    return decodeURIComponent(url);
  }
  try {
    const parsed = new URL(url);
    if (parsed.hostname === "storage.googleapis.com") {
      const parts = parsed.pathname.split("/").filter(Boolean);
      return decodeURIComponent(parts.slice(1).join("/"));
    }
  } catch {}
  return null;
}

// Resolves a sprite URL to a usable image src.
// For stored object keys, fetches a fresh presigned S3 URL via /api/storage.
// Falls back to resolveSpriteUrl for local assets.
export async function resolveImageUrl(url: string): Promise<string> {
  if (!url) return "";
  const storagePath = extractStoragePath(url);
  if (storagePath) {
    try {
      const res = await fetch(
        `/api/storage?path=${encodeURIComponent(storagePath)}`,
      );
      const data = await res.json();
      if (data.url) return data.url;
    } catch {}
  }
  return resolveSpriteUrl(url);
}
