import dotenv from "dotenv";
import {
  PutObjectCommand,
  HeadObjectCommand,
} from "@aws-sdk/client-s3";

dotenv.config({ path: ".env.local" });

// Copies sprite SVGs and backgrounds from Firebase Storage (GCS) to S3,
// preserving the exact object keys so `baseImageUrl` / `backgroundUrl` values
// stored in the database keep resolving unchanged.
//
// Usage:
//   tsx scripts/migrateStorageToS3.ts               # copy everything (overwrite)
//   tsx scripts/migrateStorageToS3.ts --dry-run     # list what would be copied
//   tsx scripts/migrateStorageToS3.ts --skip-existing  # skip keys already in S3

const PREFIXES = ["sprites/", "backgrounds/"];

const CONTENT_TYPES: Record<string, string> = {
  svg: "image/svg+xml",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
};

function contentTypeFor(key: string, fallback?: string): string {
  const ext = key.split(".").pop()?.toLowerCase() ?? "";
  return CONTENT_TYPES[ext] || fallback || "application/octet-stream";
}

async function existsInS3(
  s3: import("@aws-sdk/client-s3").S3Client,
  bucket: string,
  key: string,
): Promise<boolean> {
  try {
    await s3.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
    return true;
  } catch {
    return false;
  }
}

async function run() {
  const dryRun = process.argv.includes("--dry-run");
  const skipExisting = process.argv.includes("--skip-existing");

  const { adminApp } = await import("../lib/firebaseAdmin");
  const { s3, S3_BUCKET } = await import("../lib/s3");
  const bucket = adminApp.storage().bucket();

  if (!S3_BUCKET) {
    console.error("AWS_S3_BUCKET_NAME is not set.");
    process.exit(1);
  }

  let copied = 0;
  let skipped = 0;
  let failed = 0;

  for (const prefix of PREFIXES) {
    const [files] = await bucket.getFiles({ prefix });
    const objects = files.filter((f) => !f.name.endsWith("/"));
    console.log(`\n${prefix}: ${objects.length} object(s)`);

    for (const file of objects) {
      const key = file.name;

      if (skipExisting && !dryRun && (await existsInS3(s3, S3_BUCKET, key))) {
        skipped++;
        continue;
      }

      if (dryRun) {
        console.log(`  [dry-run] ${key}`);
        copied++;
        continue;
      }

      try {
        const [buf] = await file.download();
        await s3.send(
          new PutObjectCommand({
            Bucket: S3_BUCKET,
            Key: key,
            Body: buf,
            ContentType: contentTypeFor(key, file.metadata?.contentType),
          }),
        );
        copied++;
        if (copied % 25 === 0) console.log(`  ...${copied} copied`);
      } catch (err) {
        failed++;
        console.error(`  FAILED ${key}:`, err);
      }
    }
  }

  console.log(
    `\nDone. copied=${copied} skipped=${skipped} failed=${failed}${
      dryRun ? " (dry-run)" : ""
    }`,
  );
  process.exit(failed > 0 ? 1 : 0);
}

run().catch((error) => {
  console.error("Migration failed:", error);
  process.exit(1);
});
