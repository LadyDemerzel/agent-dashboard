import fs from "fs";
import path from "path";
import { NextRequest, NextResponse } from "next/server";
import { getShortFormMusicTestsDir } from "@/lib/short-form-video-render-settings";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function resolveSafePath(parts: string[]) {
  const baseDir = path.resolve(getShortFormMusicTestsDir());
  const resolvedPath = path.resolve(baseDir, ...parts);
  if (resolvedPath !== baseDir && !resolvedPath.startsWith(`${baseDir}${path.sep}`)) {
    throw new Error("Invalid music preview path");
  }
  return resolvedPath;
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ filePath: string[] }> }
) {
  const { filePath } = await params;

  try {
    const resolvedPath = resolveSafePath(filePath || []);
    if (!fs.existsSync(resolvedPath) || !fs.statSync(resolvedPath).isFile()) {
      return NextResponse.json({ success: false, error: "Music preview not found" }, { status: 404 });
    }

    const buffer = fs.readFileSync(resolvedPath);
    return new NextResponse(buffer, {
      headers: {
        "Content-Type": resolvedPath.endsWith(".mp3") ? "audio/mpeg" : "audio/wav",
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Failed to read music preview" },
      { status: 400 }
    );
  }
}
