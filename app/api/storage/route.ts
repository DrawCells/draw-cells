import { NextRequest, NextResponse } from "next/server";
import { adminApp } from "../../../lib/firebaseAdmin";

const bucket = adminApp.storage().bucket();

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const path = searchParams.get("path");
  const prefix = searchParams.get("prefix");
  const maxResults = parseInt(searchParams.get("maxResults") || "10", 10);
  const pageToken = searchParams.get("pageToken") || undefined;

  // Single file URL
  if (path) {
    try {
      const [url] = await bucket.file(path).getSignedUrl({
        action: "read",
        expires: Date.now() + 60 * 60 * 1000, // 1 hour
      });
      return NextResponse.json({ url });
    } catch (error) {
      console.error("Failed to get signed URL for", path, error);
      return NextResponse.json({ url: "" });
    }
  }

  // List files in a prefix (for backgrounds)
  if (prefix) {
    try {
      const [files, , apiResponse] = await bucket.getFiles({
        prefix,
        maxResults,
        pageToken,
        autoPaginate: false,
      });

      const files2 = await Promise.all(
        files
          .filter((file) => !file.name.endsWith("/"))
          .map(async (file) => {
            try {
              const [url] = await file.getSignedUrl({
                action: "read",
                expires: Date.now() + 60 * 60 * 1000,
              });
              return { path: file.name, url };
            } catch {
              return null;
            }
          }),
      );

      return NextResponse.json({
        files: files2.filter(Boolean),
        nextPageToken: (apiResponse as any)?.nextPageToken || null,
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
        const [url] = await bucket.file(path).getSignedUrl({
          action: "read",
          expires: Date.now() + 60 * 60 * 1000,
        });
        return { path, url };
      } catch {
        return { path, url: "" };
      }
    }),
  );

  return NextResponse.json({ urls });
}
