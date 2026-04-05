import fs from "fs";
import path from "path";
import { NextRequest, NextResponse } from "next/server";
import { getShortFormVoiceTestsDir } from "@/lib/short-form-video-render-settings";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function isSafeRelativePath(baseDir: string, relativePath: string) {
  const resolved = path.resolve(baseDir, relativePath);
  return resolved.startsWith(`${baseDir}${path.sep}`);
}

function contentTypeFor(filePath: string) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".mp3") return "audio/mpeg";
  if (ext === ".wav") return "audio/wav";
  if (ext === ".json") return "application/json";
  return "application/octet-stream";
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ filePath: string[] }> }
) {
  const { filePath } = await params;
  const relativePath = filePath.join(path.sep);
  const baseDir = getShortFormVoiceTestsDir();

  if (!isSafeRelativePath(baseDir, relativePath)) {
    return NextResponse.json({ success: false, error: "Invalid file path" }, { status: 400 });
  }

  const absolutePath = path.join(baseDir, relativePath);
  if (!fs.existsSync(absolutePath) || !fs.statSync(absolutePath).isFile()) {
    return NextResponse.json({ success: false, error: "Voice test file not found" }, { status: 404 });
  }

  const data = fs.readFileSync(absolutePath);
  return new NextResponse(new Uint8Array(data), {
    headers: {
      "Content-Type": contentTypeFor(absolutePath),
      "Cache-Control": "no-store",
    },
  });
}
