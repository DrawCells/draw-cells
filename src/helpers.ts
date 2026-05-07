import Konva from "konva";
import { VIEWPORT_HEIGHT, VIEWPORT_WIDTH } from "./constants";
import { Sprite } from "./Frames/reducers/frames";

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

  await Promise.all(
    sprites.map(async (s) => {
      const src = await resolveImageUrl(s.backgroundUrl || "");
      if (!src) return;
      await new Promise<void>((resolve) => {
        const img = new window.Image();
        img.crossOrigin = "anonymous";
        img.onload = () => {
          layer.add(new Konva.Image({
            x: s.position.x, y: s.position.y, image: img,
            width: s.width, height: s.height, rotation: s.rotation,
            offsetX: s.width / 2, offsetY: s.height / 2,
            opacity: s.opacity ?? 1,
          }));
          resolve();
        };
        img.onerror = () => resolve();
        img.src = src;
      });
    }),
  );

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
