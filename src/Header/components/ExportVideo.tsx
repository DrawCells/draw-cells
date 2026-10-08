import { Button, Menu, MenuItem } from "@mui/material";
import { useState } from "react";
import ExportProgressDialog, {
  ExportProgress,
} from "./ExportProgressDialog";
import { useSelector } from "react-redux";
import State from "../../stateInterface";
import { VIEWPORT_HEIGHT, VIEWPORT_WIDTH } from "../../constants";
import { Sprite } from "../../Frames/reducers/frames";
import { sampleFrames, transitionSeconds } from "../../Animation/sample";
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
      const earlier = frames[frameIdx].sprites;
      const later = frames[frameIdx + 1].sprites;
      const totalSeconds = transitionSeconds(earlier, later);

      for (let i = 0; i < FPS * totalSeconds; i++) {
        const filename = `frame-${String(frameIdx).padStart(4, "0")}-${String(
          i,
        ).padStart(4, "0")}.png`;
        frameSpecs.push({
          filename,
          sprites: sampleFrames(earlier, later, i / FPS),
        });
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
