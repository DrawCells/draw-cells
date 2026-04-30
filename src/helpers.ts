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
    return url;
  }
  try {
    const parsed = new URL(url);
    if (parsed.hostname === "storage.googleapis.com") {
      const parts = parsed.pathname.split("/").filter(Boolean);
      return parts.slice(1).join("/");
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
