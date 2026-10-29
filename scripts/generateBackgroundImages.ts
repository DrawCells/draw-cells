import dotenv from "dotenv";
import sharp from "sharp";
import {
  GetObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
} from "@aws-sdk/client-s3";
import {
  BACKGROUND_DISPLAY_HEIGHT,
  BACKGROUND_DISPLAY_WIDTH,
  BACKGROUND_THUMB_WIDTH,
  BACKGROUNDS_PREFIX,
  displayKeyFor,
  isImageKey,
  thumbKeyFor,
} from "../lib/backgrounds";

dotenv.config({ path: ".env.local" });

// Generates the WebP copies of every image under backgrounds/ (see
// lib/backgrounds.ts): a small thumbnail for the sidebar and a display copy
// that replaces the original wherever the background is drawn. Re-run it after
// adding backgrounds; copies that already exist are skipped unless --force.
//
// Usage:
//   tsx scripts/generateBackgroundImages.ts             # create missing copies
//   tsx scripts/generateBackgroundImages.ts --dry-run   # list what would be created
//   tsx scripts/generateBackgroundImages.ts --force     # regenerate all

const VARIANTS = [
  {
    name: "thumb",
    keyFor: thumbKeyFor,
    resize: { width: BACKGROUND_THUMB_WIDTH },
    quality: 75,
  },
  {
    name: "display",
    keyFor: displayKeyFor,
    resize: {
      width: BACKGROUND_DISPLAY_WIDTH,
      height: BACKGROUND_DISPLAY_HEIGHT,
      fit: "inside" as const,
    },
    quality: 82,
  },
];

// SVGs rasterize at 72 dpi by default, i.e. at their intrinsic size, and some
// are smaller than the display copy. Rasterize those at a higher density so
// they're drawn at the target size rather than upscaled (and blurred).
async function svgDensityFor(input: Buffer, targetWidth: number) {
  const { format, width } = await sharp(input, { unlimited: true }).metadata();
  if (format !== "svg" || !width || width >= targetWidth) return undefined;
  return Math.ceil((72 * targetWidth) / width);
}

async function run() {
  const dryRun = process.argv.includes("--dry-run");
  const force = process.argv.includes("--force");

  const { s3, S3_BUCKET } = await import("../lib/s3");
  if (!S3_BUCKET) {
    console.error("AWS_S3_BUCKET_NAME is not set.");
    process.exit(1);
  }

  const exists = async (key: string) => {
    try {
      await s3.send(new HeadObjectCommand({ Bucket: S3_BUCKET, Key: key }));
      return true;
    } catch {
      return false;
    }
  };

  let created = 0;
  let skipped = 0;
  let failed = 0;
  let token: string | undefined;

  do {
    const listed = await s3.send(
      new ListObjectsV2Command({
        Bucket: S3_BUCKET,
        Prefix: BACKGROUNDS_PREFIX,
        Delimiter: "/",
        ContinuationToken: token,
      }),
    );
    token = listed.NextContinuationToken;

    for (const { Key: key } of listed.Contents ?? []) {
      if (!key || !isImageKey(key)) continue;

      const missing = [];
      for (const variant of VARIANTS) {
        if (force || !(await exists(variant.keyFor(key)))) missing.push(variant);
        else skipped++;
      }
      if (missing.length === 0) continue;

      if (dryRun) {
        for (const variant of missing) {
          console.log(`  [dry-run] ${key} -> ${variant.keyFor(key)}`);
          created++;
        }
        continue;
      }

      let input: Buffer;
      try {
        const original = await s3.send(
          new GetObjectCommand({ Bucket: S3_BUCKET, Key: key }),
        );
        input = Buffer.from(await original.Body!.transformToByteArray());
      } catch (err) {
        console.error(`  FAILED to download ${key}:`, err);
        failed += missing.length;
        continue;
      }

      for (const variant of missing) {
        const outKey = variant.keyFor(key);
        try {
          const output = await sharp(input, {
            // The SVGs embed very large PNGs, which trip sharp's default
            // safety limits on input size.
            unlimited: true,
            density: await svgDensityFor(input, variant.resize.width),
          })
            .resize({ ...variant.resize, withoutEnlargement: true })
            .webp({ quality: variant.quality })
            .toBuffer();

          await s3.send(
            new PutObjectCommand({
              Bucket: S3_BUCKET,
              Key: outKey,
              Body: output,
              ContentType: "image/webp",
            }),
          );
          console.log(
            `  ${key} -> ${outKey} (${Math.round(input.length / 1024)}KB -> ${Math.round(output.length / 1024)}KB)`,
          );
          created++;
        } catch (err) {
          console.error(`  FAILED ${outKey}:`, err);
          failed++;
        }
      }
    }
  } while (token);

  console.log(
    `\nDone. ${dryRun ? "Would create" : "Created"}: ${created}, skipped: ${skipped}, failed: ${failed}`,
  );
  if (failed > 0) process.exit(1);
}

run();
