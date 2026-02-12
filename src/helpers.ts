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
