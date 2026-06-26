import { NextRequest, NextResponse } from "next/server";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const s3 = new S3Client({
  region: "eu-central-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

interface PresignFile {
  filename: string;
  filetype: string;
}

export async function POST(req: NextRequest) {
  try {
    const { files, presentationId } = await req.json();

    if (!Array.isArray(files) || files.length === 0) {
      return NextResponse.json(
        { error: "Invalid files array" },
        { status: 400 },
      );
    }

    const Bucket = process.env.AWS_S3_BUCKET_NAME!;
    // Shared timestamp + index keeps keys unique within the batch.
    const timestamp = Date.now();

    // Presign a batch of PUT URLs in one round-trip. Signing is CPU-only (no
    // network), so it parallelizes cheaply. Each URL is valid for 5 minutes,
    // which comfortably covers a single upload chunk on the client.
    const items = await Promise.all(
      (files as PresignFile[]).map(async ({ filename, filetype }, index) => {
        const Key = `video-export-frames/${presentationId}/${timestamp}-${index}-${filename}`;
        const command = new PutObjectCommand({
          Bucket,
          Key,
          ContentType: filetype,
        });
        const url = await getSignedUrl(s3, command, { expiresIn: 300 });
        return { url, key: Key };
      }),
    );

    return NextResponse.json({ items });
  } catch (err: any) {
    console.error(err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
