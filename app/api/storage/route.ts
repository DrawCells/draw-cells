import { NextRequest, NextResponse } from "next/server";
import {
  GetObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { s3, S3_BUCKET } from "../../../lib/s3";
import {
  BACKGROUNDS_PREFIX,
  displayKeyFor,
  isBackgroundKey,
  isImageKey,
  thumbKeyFor,
} from "../../../lib/backgrounds";

const SIGNED_URL_TTL = 60 * 60; // 1 hour, in seconds

function signRead(key: string) {
  return getSignedUrl(
    s3,
    new GetObjectCommand({ Bucket: S3_BUCKET, Key: key }),
    { expiresIn: SIGNED_URL_TTL },
  );
}

// Display copies known to exist. Only hits are cached, so a copy generated
// after a miss is picked up on the next request.
const existingDisplayKeys = new Set<string>();

// Backgrounds are drawn from their WebP display copy when one has been
// generated, falling back to the (much larger) original otherwise. Frames keep
// storing the original key either way.
async function readKeyFor(key: string): Promise<string> {
  if (!isBackgroundKey(key)) return key;
  const displayKey = displayKeyFor(key);
  if (existingDisplayKeys.has(displayKey)) return displayKey;
  try {
    await s3.send(
      new HeadObjectCommand({ Bucket: S3_BUCKET, Key: displayKey }),
    );
    existingDisplayKeys.add(displayKey);
    return displayKey;
  } catch {
    return key;
  }
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
      const url = await signRead(await readKeyFor(path));
      return NextResponse.json({ url });
    } catch (error) {
      console.error("Failed to get signed URL for", path, error);
      return NextResponse.json({ url: "" });
    }
  }

  // List the images directly inside a folder prefix (for backgrounds).
  // Subfolders and non-image objects (e.g. .DS_Store) are skipped.
  if (prefix) {
    const folder = prefix.endsWith("/") ? prefix : `${prefix}/`;
    const withThumbs = folder === BACKGROUNDS_PREFIX;
    try {
      const listed = await s3.send(
        new ListObjectsV2Command({
          Bucket: S3_BUCKET,
          Prefix: folder,
          Delimiter: "/",
          MaxKeys: maxResults,
          ContinuationToken: pageToken,
        }),
      );

      const files = await Promise.all(
        (listed.Contents ?? [])
          .map((obj) => obj.Key)
          .filter((key): key is string => !!key && isImageKey(key))
          .map(async (key) => {
            try {
              const url = await signRead(key);
              // Signing doesn't check the thumbnail exists; the client falls
              // back to `url` if it fails to load.
              const thumbUrl = withThumbs
                ? await signRead(thumbKeyFor(key))
                : undefined;
              return { path: key, url, thumbUrl };
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
      return NextResponse.json(
        { error: "Failed to list files" },
        { status: 500 },
      );
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
        const url = await signRead(await readKeyFor(path));
        return { path, url };
      } catch {
        return { path, url: "" };
      }
    }),
  );

  return NextResponse.json({ urls });
}
