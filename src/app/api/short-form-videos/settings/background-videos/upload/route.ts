import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { randomUUID } from "crypto";
import { getShortFormBackgroundVideosDir } from "@/lib/short-form-background-videos";

export const dynamic = "force-dynamic";

const ALLOWED_CONTENT_TYPES = new Set([
  "video/mp4",
  "video/quicktime",
  "video/webm",
  "video/x-m4v",
  "application/octet-stream",
]);

const EXT_BY_CONTENT_TYPE: Record<string, string> = {
  "video/mp4": ".mp4",
  "video/quicktime": ".mov",
  "video/webm": ".webm",
  "video/x-m4v": ".m4v",
};

function slugify(text: string) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");
    const label = typeof formData.get("label") === "string" ? String(formData.get("label")).trim() : "";

    if (!(file instanceof File)) {
      return NextResponse.json({ success: false, error: "file is required" }, { status: 400 });
    }

    const fallbackExt = path.extname(file.name || "").toLowerCase();
    if (!ALLOWED_CONTENT_TYPES.has(file.type) && ![".mp4", ".mov", ".webm", ".m4v"].includes(fallbackExt)) {
      return NextResponse.json({ success: false, error: "Unsupported video type" }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const bytes = Buffer.from(arrayBuffer);
    if (!bytes.length) {
      return NextResponse.json({ success: false, error: "Uploaded file is empty" }, { status: 400 });
    }

    const baseDir = getShortFormBackgroundVideosDir();
    const extension = EXT_BY_CONTENT_TYPE[file.type] || fallbackExt || ".mp4";
    const baseName = slugify(label || file.name || "background-video") || "background-video";
    const fileName = `${baseName}-${randomUUID()}${extension}`;
    const absolutePath = path.join(baseDir, fileName);
    fs.mkdirSync(baseDir, { recursive: true });
    fs.writeFileSync(absolutePath, bytes);

    const relativePath = path.relative(baseDir, absolutePath).split(path.sep).join("/");
    return NextResponse.json({
      success: true,
      data: {
        videoRelativePath: relativePath,
        videoUrl: `/api/short-form-videos/settings/background-videos/${relativePath}?v=${Date.now()}`,
        uploadedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Failed to upload background video" },
      { status: 500 }
    );
  }
}
