import { Button, Menu, MenuItem } from "@mui/material";
import { useState } from "react";
import { useSelector } from "react-redux";
import State from "../../stateInterface";
import { VIEWPORT_HEIGHT, VIEWPORT_WIDTH } from "../../constants";
import { Sprite } from "../../Frames/reducers/frames";
import Konva from "konva";
import ArrowDropDown from "@mui/icons-material/ArrowDropDown";
import { addSpriteToLayer, renderFrameToDataUrl } from "../../helpers";

// Frames are rendered, presigned, and uploaded one chunk at a time. This caps
// how many frame blobs live in memory at once, keeps S3 PUTs within the signed
// URL's lifetime, and bounds upload concurrency so a large export no longer
// fires thousands of simultaneous requests.
const CHUNK_SIZE = 25;
const UPLOAD_CONCURRENCY = 6;
const MAX_UPLOAD_RETRIES = 3;

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

    await Promise.all(
      sprites.map((s) => addSpriteToLayer(layer, s)),
    );

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

      for (let i = 0; i < 30 * maxDuration; i++) {
        const newSprites: Sprite[] = [];
        for (const sprite of frame.sprites) {
          const nextSprite = nextFrame.sprites.find((s) => s.id === sprite.id);
          const currentFrameIndex = Math.min(i, 30 * (sprite.duration ?? 1));
          if (nextSprite) {
            const sharedProps = {
              width:
                sprite.width +
                (nextSprite.width - sprite.width) *
                  (currentFrameIndex / (30 * (sprite.duration ?? 1))),
              height:
                sprite.height +
                (nextSprite.height - sprite.height) *
                  (currentFrameIndex / (30 * (sprite.duration ?? 1))),
              rotation:
                sprite.rotation +
                (nextSprite.rotation - sprite.rotation) *
                  (currentFrameIndex / (30 * (sprite.duration ?? 1))),
            };

            if (sprite.animationType === "LINEAR") {
              const newPosition = {
                x:
                  sprite.position.x +
                  (nextSprite.position.x - sprite.position.x) *
                    (currentFrameIndex / (30 * (sprite.duration ?? 1))),
                y:
                  sprite.position.y +
                  (nextSprite.position.y - sprite.position.y) *
                    (currentFrameIndex / (30 * (sprite.duration ?? 1))),
              };
              newSprites.push({
                ...sprite,
                ...sharedProps,
                id: `${sprite.id}-${i}`,
                position: newPosition,
              });
            } else if (sprite.animationType === "CIRCULAR") {
              console.log("CIRCULAR ANIMATION", sprite.animationProps);
              const distanceX =
                sprite.position.x - sprite.animationProps.circleX;
              const distanceY =
                sprite.position.y - sprite.animationProps.circleY;
              const angle =
                ((currentFrameIndex / (30 * (sprite.duration ?? 1))) *
                  (sprite.angle ?? 0) *
                  (sprite.animationProps.angleDirection * -1) *
                  Math.PI) /
                180;
              const newPosition = {
                x:
                  sprite.animationProps.circleX +
                  Math.cos(angle) * distanceX -
                  Math.sin(angle) * distanceY,
                y:
                  sprite.animationProps.circleY +
                  Math.sin(angle) * distanceX +
                  Math.cos(angle) * distanceY,
              };
              newSprites.push({
                ...sprite,
                ...sharedProps,
                id: `${sprite.id}-${i}`,
                position: newPosition,
              });
            } else if (sprite.animationType === "CHAOTIC") {
              const N = sprite.animationProps.length;
              const F = 30 * (sprite.duration ?? 1);
              const s = (i * (N - 1)) / (F - 1);
              const k = Math.floor(s);
              const a = Math.min(k, N - 1);
              const b = Math.min(k + 1, N - 1);
              const t = s - k;
              let newPosition = { x: sprite.position.x, y: sprite.position.y };
              if (a === b) {
                newPosition = {
                  x: sprite.animationProps[a].x,
                  y: sprite.animationProps[a].y,
                };
              } else {
                newPosition = {
                  x:
                    sprite.animationProps[a].x +
                    t *
                      (sprite.animationProps[b].x - sprite.animationProps[a].x),
                  y:
                    sprite.animationProps[a].y +
                    t *
                      (sprite.animationProps[b].y - sprite.animationProps[a].y),
                };
              }

              newSprites.push({
                ...sprite,
                ...sharedProps,
                id: `${sprite.id}-${i}`,
                position: newPosition,
              });
            }
          } else {
            newSprites.push({
              ...sprite,
              id: `${sprite.id}-${i}`,
              opacity: 1 - Math.min(i, 30) / 30,
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
              opacity: Math.min(i, 30) / 30,
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

    try {
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

        await runWithConcurrency(chunk, UPLOAD_CONCURRENCY, (_, idx) =>
          putWithRetry(presigned[idx].url, blobs[idx]),
        );

        for (const item of presigned) {
          frameURLs.push(publicUrlForKey(item.key));
        }
      }

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
            setIsExporting(false);
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
            setIsExporting(false);
            console.error("Export failed:", job.error);
          }
        } catch (pollError) {
          clearInterval(poll);
          setIsExporting(false);
          console.error("Error polling export status:", pollError);
        }
      }, 3000);
    } catch (error) {
      console.error("Error exporting video:", error);
      setIsExporting(false);
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
      </Menu>
    </>
  );
}
