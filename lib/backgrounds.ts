// S3 layout for frame background images. The originals (multi-MB SVGs) live
// under BACKGROUNDS_PREFIX, and their keys are what frames store. Two WebP
// copies are generated from them by scripts/generateBackgroundImages.ts:
// - thumbnails for the sidebar, under BACKGROUND_THUMBS_PREFIX;
// - display copies, under BACKGROUND_DISPLAY_PREFIX, which /api/storage serves
//   in place of the original wherever a background is drawn (canvas,
//   presentation, export). 3x the viewport keeps them sharp in a full-screen
//   presentation on a retina display.
export const BACKGROUNDS_PREFIX = "backgrounds/";
export const BACKGROUND_THUMBS_PREFIX = "background-thumbs/";
export const BACKGROUND_DISPLAY_PREFIX = "background-display/";
export const BACKGROUND_THUMB_WIDTH = 320;
export const BACKGROUND_DISPLAY_WIDTH = 2430;
export const BACKGROUND_DISPLAY_HEIGHT = 1620;

const IMAGE_EXTENSIONS = ["png", "jpg", "jpeg", "webp", "gif", "avif", "svg"];

export function isImageKey(key: string): boolean {
  const ext = key.split(".").pop()?.toLowerCase() ?? "";
  return IMAGE_EXTENSIONS.includes(ext);
}

export function isBackgroundKey(key: string): boolean {
  return key.startsWith(BACKGROUNDS_PREFIX);
}

const webpKeyUnder = (prefix: string, key: string) =>
  `${prefix}${key.slice(BACKGROUNDS_PREFIX.length).replace(/\.[^./]+$/, "")}.webp`;

// "backgrounds/forest.svg" -> "background-thumbs/forest.webp"
export const thumbKeyFor = (key: string) =>
  webpKeyUnder(BACKGROUND_THUMBS_PREFIX, key);

// "backgrounds/forest.svg" -> "background-display/forest.webp"
export const displayKeyFor = (key: string) =>
  webpKeyUnder(BACKGROUND_DISPLAY_PREFIX, key);
