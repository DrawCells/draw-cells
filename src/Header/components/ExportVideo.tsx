import { Button, Menu, MenuItem } from "@mui/material";
import { useState } from "react";
import ExportProgressDialog, {
  ExportProgress,
} from "./ExportProgressDialog";
import { useSelector } from "react-redux";
import State from "../../stateInterface";
import { VIEWPORT_HEIGHT, VIEWPORT_WIDTH } from "../../constants";
import { isTextSprite, Sprite } from "../../Frames/reducers/frames";
import Konva from "konva";
import ArrowDropDown from "@mui/icons-material/ArrowDropDown";
import { jsPDF } from "jspdf";
import { addSpritesToLayer, renderFrameToDataUrl } from "../../helpers";

// Frames are rendered, presigned, and uploaded one chunk at a time. This caps
// how many frame blobs live in memory at once, keeps S3 PUTs within the signed
// URL's lifetime, and bounds upload concurrency so a large export no longer
// fires thousands of simultaneous requests.
const CHUNK_SIZE = 25;
const UPLOAD_CONCURRENCY = 6;
const MAX_UPLOAD_RETRIES = 3;

// Images per second of animation. The encoding Lambda (outside this repo)
// has to use the same rate, or timings stretch or compress.
const FPS = 30;
// How long the video stays on the final frame once everything has arrived.
const FINAL_HOLD_SECONDS = 1;

interface PresignedItem {
  url: string;
  key: string;
}

interface FrameSpec {
  filename: string;
  sprites: Sprite[];
}

// Runs `worker` over `items` with at most `concurrency` in flight at a time,
// preserving result order.
async function runWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  worker: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  const runners = Array.from(
    { length: Math.min(concurrency, items.length) },
    async () => {
      while (next < items.length) {
        const index = next++;
        results[index] = await worker(items[index], index);
      }
    },
  );
  await Promise.all(runners);
  return results;
}

async function presignBatch(
  files: { filename: string; filetype: string }[],
  presentationId: string,
): Promise<PresignedItem[]> {
  const res = await fetch("/api/presign", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ files, presentationId }),
  });
  if (!res.ok) throw new Error(`Presign failed: ${res.status}`);
  const { items } = await res.json();
  return items;
}

async function putWithRetry(url: string, blob: Blob): Promise<void> {
  const contentType = blob.type || "image/png";
  let lastError: unknown;
  for (let attempt = 0; attempt < MAX_UPLOAD_RETRIES; attempt++) {
    try {
      const upload = await fetch(url, {
        method: "PUT",
        headers: { "Content-Type": contentType },
        body: blob,
      });
      if (upload.ok) return;
      lastError = new Error(`Upload failed: ${upload.status}`);
    } catch (err) {
      lastError = err;
    }
    // Linear backoff before retrying.
    await new Promise((r) => setTimeout(r, 300 * (attempt + 1)));
  }
  throw lastError ?? new Error("Upload failed");
}

function publicUrlForKey(key: string): string {
  return `https://${process.env.NEXT_PUBLIC_S3_BUCKET!}.s3.${process.env
    .NEXT_PUBLIC_AWS_REGION!}.amazonaws.com/${key}`;
}

export default function ExportVideo({
  presentationId,
}: {
  presentationId: string;
}) {
  const [isExporting, setIsExporting] = useState(false);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [progress, setProgress] = useState<ExportProgress | null>(null);

  // Clears all export UI state. Called from every terminal path of an export.
  const finishExport = () => {
    setIsExporting(false);
    setProgress(null);
  };

  const frames = useSelector((state: State) => state.frames.frames);
  const currentFrame = useSelector((state: State) => state.frames.currentFrame);

  const createStage = () => {
    const container = document.createElement("div");
    container.style.backgroundColor = "white";
    // container.style.display = "none";
    document.body.appendChild(container);

    const stage = new Konva.Stage({
      container: container,
      width: VIEWPORT_WIDTH,
      height: VIEWPORT_HEIGHT,
      stroke: "#eaeaea",
      strokeWidth: 1,
      fillPatternRepeat: "no-repeat",
      fill: "white",
    });

    return stage;
  };

  const renderSprites = async (stage: Konva.Stage, sprites: Sprite[]) => {
    stage.destroyChildren();
    const layer = new Konva.Layer();
    stage.add(layer);
    const background = new Konva.Rect({
      x: 0,
      y: 0,
      width: VIEWPORT_WIDTH,
      height: VIEWPORT_HEIGHT,
      fill: "white",
    });
    layer.add(background);
    background.moveToBottom();

    await addSpritesToLayer(layer, sprites);

    stage.draw();
    const canvas = stage.toCanvas({ pixelRatio: 2 });
    const blob: Blob = await new Promise((resolve, reject) => {
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error("Canvas toBlob failed"))),
        "image/png",
        1,
      );
    });
    return blob;
  };

  const handleExportVideo = async () => {
    setIsExporting(true);
    setAnchorEl(null);
    const stage = createStage();
    const frameSpecs: FrameSpec[] = [];

    for (let frameIdx = 0; frameIdx < frames.length - 1; frameIdx++) {
      const frame = frames[frameIdx];
      const nextFrame = frames[frameIdx + 1];

      const maxDuration = Math.max(
        ...frame.sprites.map((s) => s.duration ?? 1),
      );

      for (let i = 0; i < FPS * maxDuration; i++) {
        const newSprites: Sprite[] = [];
        for (const sprite of frame.sprites) {
          const nextSprite = nextFrame.sprites.find((s) => s.id === sprite.id);
          const currentFrameIndex = Math.min(i, FPS * (sprite.duration ?? 1));
          if (nextSprite) {
            const progress = currentFrameIndex / (FPS * (sprite.duration ?? 1));
            const lerp = (a: number, b: number) => a + (b - a) * progress;
            const rotation = lerp(sprite.rotation, nextSprite.rotation);
            const opacity = lerp(sprite.opacity ?? 1, nextSprite.opacity ?? 1);

            // LINEAR, and the fallback when a path's derived data is missing —
            // a sprite should still move rather than vanish from the video.
            let newPosition = {
              x: lerp(sprite.position.x, nextSprite.position.x),
              y: lerp(sprite.position.y, nextSprite.position.y),
            };

            if (
              sprite.animationType === "CIRCULAR" &&
              sprite.animationProps?.circleX != null
            ) {
              const distanceX =
                sprite.position.x - sprite.animationProps.circleX;
              const distanceY =
                sprite.position.y - sprite.animationProps.circleY;
              const angle =
                (progress *
                  (sprite.angle ?? 0) *
                  (sprite.animationProps.angleDirection * -1) *
                  Math.PI) /
                180;
              newPosition = {
                x:
                  sprite.animationProps.circleX +
                  Math.cos(angle) * distanceX -
                  Math.sin(angle) * distanceY,
                y:
                  sprite.animationProps.circleY +
                  Math.sin(angle) * distanceX +
                  Math.cos(angle) * distanceY,
              };
            } else if (
              sprite.animationType === "CHAOTIC" &&
              Array.isArray(sprite.animationProps) &&
              sprite.animationProps.length > 0
            ) {
              const N = sprite.animationProps.length;
              const F = FPS * (sprite.duration ?? 1);
              const s = (i * (N - 1)) / (F - 1);
              const k = Math.floor(s);
              const a = Math.min(k, N - 1);
              const b = Math.min(k + 1, N - 1);
              const t = s - k;
              newPosition =
                a === b
                  ? {
                      x: sprite.animationProps[a].x,
                      y: sprite.animationProps[a].y,
                    }
                  : {
                      x:
                        sprite.animationProps[a].x +
                        t *
                          (sprite.animationProps[b].x -
                            sprite.animationProps[a].x),
                      y:
                        sprite.animationProps[a].y +
                        t *
                          (sprite.animationProps[b].y -
                            sprite.animationProps[a].y),
                    };
            }

            if (
              isTextSprite(sprite) &&
              isTextSprite(nextSprite) &&
              sprite.text !== nextSprite.text
            ) {
              // Wording cannot be interpolated, and drawing either wording in
              // a box tweening toward the other's size wraps it past the box
              // height, where Konva drops the overflowing lines. Crossfade
              // instead: each wording keeps its own box and both follow the
              // sprite's path.
              newSprites.push({
                ...sprite,
                id: `${sprite.id}-${i}-out`,
                position: newPosition,
                rotation,
                opacity: opacity * (1 - progress),
              });
              newSprites.push({
                ...nextSprite,
                id: `${sprite.id}-${i}-in`,
                position: newPosition,
                rotation,
                opacity: opacity * progress,
              });
            } else {
              newSprites.push({
                ...sprite,
                width: lerp(sprite.width, nextSprite.width),
                height: lerp(sprite.height, nextSprite.height),
                // Resizing a text box on the canvas scales its font with it,
                // so the font has to tween alongside the box.
                ...(isTextSprite(sprite) && isTextSprite(nextSprite)
                  ? { fontSize: lerp(sprite.fontSize, nextSprite.fontSize) }
                  : {}),
                rotation,
                opacity,
                id: `${sprite.id}-${i}`,
                position: newPosition,
              } as Sprite);
            }
          } else {
            newSprites.push({
              ...sprite,
              id: `${sprite.id}-${i}`,
              opacity: 1 - Math.min(i, FPS) / FPS,
              position: { x: sprite.position.x, y: sprite.position.y },
            });
          }
        }

        // Process sprites that are in nextFrame but not in current frame (fade in)
        for (const sprite of nextFrame.sprites) {
          const existingSprite = frame.sprites.find((s) => s.id === sprite.id);
          if (!existingSprite) {
            const newPosition = { x: sprite.position.x, y: sprite.position.y };
            newSprites.push({
              ...sprite,
              id: `${sprite.id}-${i}`,
              opacity: Math.min(i, FPS) / FPS,
              position: newPosition,
            });
          }
        }

        const filename = `frame-${String(frameIdx).padStart(4, "0")}-${String(
          i,
        ).padStart(4, "0")}.png`;
        frameSpecs.push({ filename, sprites: newSprites });
      }
    }

    // Each transition above stops one step short of its end state, because
    // the next transition's first image is that state. The last frame has no
    // next transition, so it would never appear: render it and hold it.
    const lastIdx = frames.length - 1;
    for (let i = 0; i < FPS * FINAL_HOLD_SECONDS; i++) {
      frameSpecs.push({
        filename: `frame-${String(lastIdx).padStart(4, "0")}-${String(
          i,
        ).padStart(4, "0")}.png`,
        sprites: frames[lastIdx].sprites,
      });
    }

    try {
      setProgress({ phase: "uploading", uploaded: 0, total: frameSpecs.length });

      // Render, presign, and upload one chunk at a time so peak memory stays
      // bounded and each presigned URL is used well within its lifetime.
      const frameURLs: string[] = [];
      for (let start = 0; start < frameSpecs.length; start += CHUNK_SIZE) {
        const chunk = frameSpecs.slice(start, start + CHUNK_SIZE);

        // Rendering shares one Konva stage, so it must stay sequential.
        const blobs: Blob[] = [];
        for (const spec of chunk) {
          blobs.push(await renderSprites(stage, spec.sprites));
        }

        const presigned = await presignBatch(
          chunk.map((spec) => ({
            filename: spec.filename,
            filetype: "image/png",
          })),
          presentationId,
        );

        await runWithConcurrency(chunk, UPLOAD_CONCURRENCY, async (_, idx) => {
          await putWithRetry(presigned[idx].url, blobs[idx]);
          setProgress((p) =>
            p?.phase === "uploading"
              ? { ...p, uploaded: p.uploaded + 1 }
              : p,
          );
        });

        for (const item of presigned) {
          frameURLs.push(publicUrlForKey(item.key));
        }
      }

      // Frames are uploaded; the server now encodes the video.
      setProgress({ phase: "processing" });

      const response = await fetch("/api/export-video", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          frames: frameURLs,
          bucket: "draw-cells-s3-bucket",
        }),
      });
      const { jobId } = await response.json();

      const poll = setInterval(async () => {
        try {
          const statusRes = await fetch(
            `/api/export-video/status?jobId=${jobId}`,
          );
          const job = await statusRes.json();

          if (job.status === "completed") {
            clearInterval(poll);
            finishExport();
            const videoRes = await fetch(job.videoUrl);
            const blob = await videoRes.blob();
            const blobUrl = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = blobUrl;
            link.download = "animation.mp4";
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(blobUrl);
          } else if (job.status === "failed") {
            clearInterval(poll);
            finishExport();
            console.error("Export failed:", job.error);
          }
        } catch (pollError) {
          clearInterval(poll);
          finishExport();
          console.error("Error polling export status:", pollError);
        }
      }, 3000);
    } catch (error) {
      console.error("Error exporting video:", error);
      finishExport();
    } finally {
      stage.destroy();
    }
  };

  const handleExportFrame = async () => {
    setIsExporting(true);
    setAnchorEl(null);
    try {
      const dataUrl = await renderFrameToDataUrl(currentFrame.sprites);
      const link = document.createElement("a");
      link.href = dataUrl;
      link.download = "frame.png";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportFramePdf = async () => {
    setIsExporting(true);
    setAnchorEl(null);
    try {
      const dataUrl = await renderFrameToDataUrl(currentFrame.sprites);
      const pdf = new jsPDF({
        orientation:
          VIEWPORT_WIDTH >= VIEWPORT_HEIGHT ? "landscape" : "portrait",
        unit: "px",
        format: [VIEWPORT_WIDTH, VIEWPORT_HEIGHT],
      });
      pdf.addImage(dataUrl, "PNG", 0, 0, VIEWPORT_WIDTH, VIEWPORT_HEIGHT);
      pdf.save("frame.pdf");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <>
      <Button
        variant="contained"
        color="primary"
        onClick={(e) => setAnchorEl(e.currentTarget)}
        disabled={isExporting}
        endIcon={<ArrowDropDown />}
      >
        {isExporting ? "Exporting..." : "Export"}
      </Button>
      <Menu
        id="menu-export"
        anchorEl={anchorEl}
        anchorOrigin={{
          vertical: "top",
          horizontal: "right",
        }}
        keepMounted
        transformOrigin={{
          vertical: "top",
          horizontal: "right",
        }}
        open={Boolean(anchorEl)}
        onClose={() => setAnchorEl(null)}
      >
        <MenuItem onClick={handleExportVideo} disabled={isExporting}>
          Export Video
        </MenuItem>
        <MenuItem onClick={handleExportFrame}>Export Frame as Image</MenuItem>
        <MenuItem onClick={handleExportFramePdf} disabled={isExporting}>
          Export Frame as PDF
        </MenuItem>
      </Menu>
      <ExportProgressDialog progress={progress} />
    </>
  );
}
