import Konva from "konva";
import { VIEWPORT_HEIGHT, VIEWPORT_WIDTH } from "./constants";
import { isArrowSprite, isTextSprite, Sprite } from "./Frames/reducers/frames";

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

// Adds a single sprite (image or text) to a Konva layer, mirroring how the
// editing canvas renders it. Used for frame thumbnails and video export so the
// rendering stays in one place.
export async function addSpriteToLayer(
  layer: Konva.Layer,
  s: Sprite,
): Promise<void> {
  if (isTextSprite(s)) {
    layer.add(
      new Konva.Text({
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
      }),
    );
    return;
  }

  if (isArrowSprite(s)) {
    const geom = arrowGeometry(s.width, s.height);
    layer.add(
      new Konva.Arrow({
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
      }),
    );
    return;
  }

  const src = await resolveImageUrl(s.backgroundUrl || "");
  if (!src) return;
  await new Promise<void>((resolve) => {
    const img = new window.Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      layer.add(
        new Konva.Image({
          x: s.position.x,
          y: s.position.y,
          image: img,
          width: s.width,
          height: s.height,
          rotation: s.rotation,
          offsetX: s.width / 2,
          offsetY: s.height / 2,
          opacity: s.opacity ?? 1,
        }),
      );
      resolve();
    };
    img.onerror = () => resolve();
    img.src = src;
  });
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

  await Promise.all(sprites.map((s) => addSpriteToLayer(layer, s)));

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

// Returns the Firebase Storage path extracted from `url`, or null if not applicable.
// Handles both bare storage paths (e.g. "sprites/Brain/Neuron.svg") and
// GCS signed URLs (https://storage.googleapis.com/<bucket>/<path>?X-Goog-*).
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
// For Firebase Storage paths and GCS signed URLs, fetches a fresh signed URL.
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
