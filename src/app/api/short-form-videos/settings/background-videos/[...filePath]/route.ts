import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { Readable } from "stream";
import { getShortFormBackgroundVideosDir } from "@/lib/short-form-background-videos";

export const dynamic = "force-dynamic";

const CONTENT_TYPES: Record<string, string> = {
  ".mp4": "video/mp4",
  ".mov": "video/quicktime",
  ".webm": "video/webm",
  ".m4v": "video/x-m4v",
};

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ filePath: string[] }> }
) {
  const { filePath } = await params;
  if (!filePath || filePath.length === 0) {
    return NextResponse.json({ success: false, error: "Missing file path" }, { status: 400 });
  }

  const baseDir = path.resolve(getShortFormBackgroundVideosDir());
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
      "Cache-Control": "no-cache",
      "Accept-Ranges": "bytes",
    },
  });
}
