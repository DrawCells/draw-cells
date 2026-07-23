import { NextRequest, NextResponse } from "next/server";
import {
  GetObjectCommand,
  ListObjectsV2Command,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { s3, S3_BUCKET } from "../../../lib/s3";

const SIGNED_URL_TTL = 60 * 60; // 1 hour, in seconds

function signRead(key: string) {
  return getSignedUrl(
    s3,
    new GetObjectCommand({ Bucket: S3_BUCKET, Key: key }),
    { expiresIn: SIGNED_URL_TTL },
  );
}

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const path = searchParams.get("path");
  const prefix = searchParams.get("prefix");
  const maxResults = parseInt(searchParams.get("maxResults") || "10", 10);
  const pageToken = searchParams.get("pageToken") || undefined;

  // Single file URL
  if (path) {
    try {
      const url = await signRead(path);
      return NextResponse.json({ url });
    } catch (error) {
      console.error("Failed to get signed URL for", path, error);
      return NextResponse.json({ url: "" });
    }
  }

  // List files in a prefix (for backgrounds)
  if (prefix) {
    try {
      const listed = await s3.send(
        new ListObjectsV2Command({
          Bucket: S3_BUCKET,
          Prefix: prefix,
          MaxKeys: maxResults,
          ContinuationToken: pageToken,
        }),
      );

      const files = await Promise.all(
        (listed.Contents ?? [])
          .map((obj) => obj.Key)
          .filter((key): key is string => !!key && !key.endsWith("/"))
          .map(async (key) => {
            try {
              const url = await signRead(key);
              return { path: key, url };
            } catch {
              return null;
            }
          }),
      );

      return NextResponse.json({
        files: files.filter(Boolean),
        nextPageToken: listed.NextContinuationToken || null,
      });
    } catch (error) {
      console.error("Failed to list files", error);
      return NextResponse.json({ files: [], nextPageToken: null });
    }
  }

  return NextResponse.json(
    { error: "Provide either 'path' or 'prefix' parameter" },
    { status: 400 },
  );
}

// Batch: resolve multiple paths at once
export async function POST(req: NextRequest) {
  const { paths } = await req.json();

  if (!Array.isArray(paths) || paths.length === 0) {
    return NextResponse.json(
      { error: "'paths' must be a non-empty array" },
      { status: 400 },
    );
  }

  const urls = await Promise.all(
    paths.map(async (path: string) => {
      try {
        const url = await signRead(path);
        return { path, url };
      } catch {
        return { path, url: "" };
      }
    }),
  );

  return NextResponse.json({ urls });
}
