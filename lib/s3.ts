import { S3Client } from "@aws-sdk/client-s3";

// Shared S3 client for server-side asset access (sprite SVGs, backgrounds).
// Reuses the same credentials/region/bucket as the video-export flow.
export const s3 = new S3Client({
  region: process.env.AWS_REGION || "eu-central-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

export const S3_BUCKET = process.env.AWS_S3_BUCKET_NAME!;
