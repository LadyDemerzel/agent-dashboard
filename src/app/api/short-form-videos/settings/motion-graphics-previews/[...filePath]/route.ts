import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { Readable } from "stream";
import { SHORT_FORM_VIDEOS_DIR } from "@/lib/short-form-videos";

export const dynamic = "force-dynamic";

const PREVIEW_DIR = path.join(SHORT_FORM_VIDEOS_DIR, "_motion-graphic-previews");

const CONTENT_TYPES: Record<string, string> = {
  ".mp4": "video/mp4",
  ".png": "image/png",
};

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ filePath: string[] }> },
) {
  const { filePath } = await params;
  if (!filePath || filePath.length === 0) {
    return NextResponse.json({ success: false, error: "Missing file path" }, { status: 400 });
  }

  const baseDir = path.resolve(PREVIEW_DIR);
  const relativePath = filePath.join("/");
  const absolutePath = path.resolve(baseDir, relativePath);

  if (absolutePath !== baseDir && !absolutePath.startsWith(`${baseDir}${path.sep}`)) {
    return NextResponse.json({ success: false, error: "Invalid path" }, { status: 400 });
  }

  if (!fs.existsSync(absolutePath) || !fs.statSync(absolutePath).isFile()) {
    return NextResponse.json({ success: false, error: "File not found" }, { status: 404 });
  }

  const ext = path.extname(absolutePath).toLowerCase();
  const contentType = CONTENT_TYPES[ext] || "application/octet-stream";
  const stat = fs.statSync(absolutePath);
  const stream = fs.createReadStream(absolutePath);

  return new NextResponse(Readable.toWeb(stream) as unknown as ReadableStream, {
    headers: {
      "Content-Type": contentType,
      "Content-Length": String(stat.size),
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
