import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { Readable } from "stream";
import { spawnSync } from "child_process";
import { getProjectDir, readProjectMeta } from "@/lib/short-form-videos";
import {
  resolveShortFormBackgroundVideoAbsolutePath,
  resolveShortFormBackgroundVideoSelection,
} from "@/lib/short-form-background-videos";

export const dynamic = "force-dynamic";

const PREVIEW_DURATION_SECONDS = 4;
const PREVIEW_CACHE_DIRNAME = ".scene-preview-cache";
const PREVIEW_CACHE_VERSION = "v3-bluegreen-chromakey";
// Some generated plates drift toward slightly cyan/blue-shifted greens instead of pure #00FF00.
// A wider chroma key plus lighter despill removes those backgrounds cleanly without turning the
// missed background into a solid blue/teal matte in preview renders.
const GREENSCREEN_FILTER = "format=rgba,chromakey=0x00FF00:0.30:0.08,despill=type=green:mix=0.12:expand=0.0";

function ensureDir(dirPath: string) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function parseSceneNumber(sceneId: string) {
  const match = sceneId.match(/scene-(\d+)/i);
  if (!match) return null;
  const value = Number(match[1]);
  return Number.isInteger(value) && value > 0 ? value : null;
}

function buildPreviewPaths(projectId: string, backgroundId: string, sceneNumber: number) {
  const cacheDir = path.join(getProjectDir(projectId), "scenes", PREVIEW_CACHE_DIRNAME, PREVIEW_CACHE_VERSION, backgroundId);
  const outputPath = path.join(cacheDir, `scene-${String(sceneNumber).padStart(2, "0")}-preview.mp4`);
  return { cacheDir, outputPath };
}

function needsRefresh(outputPath: string, inputs: string[]) {
  if (!fs.existsSync(outputPath)) return true;
  const outputMtime = fs.statSync(outputPath).mtimeMs;
  return inputs.some((inputPath) => !fs.existsSync(inputPath) || fs.statSync(inputPath).mtimeMs > outputMtime + 1000);
}

function generatePreviewVideo(rawImagePath: string, backgroundVideoPath: string, outputPath: string) {
  ensureDir(path.dirname(outputPath));
  const filter = [
    `[1:v]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920[bg]`,
    `[0:v]scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2:color=0x00FF00,${GREENSCREEN_FILTER}[fg]`,
    `[bg][fg]overlay=(W-w)/2:(H-h)/2:shortest=1,format=yuv420p[v]`,
  ].join(";");

  const result = spawnSync(
    "ffmpeg",
    [
      "-y",
      "-loop",
      "1",
      "-t",
      String(PREVIEW_DURATION_SECONDS),
      "-i",
      rawImagePath,
      "-stream_loop",
      "-1",
      "-t",
      String(PREVIEW_DURATION_SECONDS),
      "-i",
      backgroundVideoPath,
      "-filter_complex",
      filter,
      "-map",
      "[v]",
      "-an",
      "-c:v",
      "libx264",
      "-pix_fmt",
      "yuv420p",
      "-movflags",
      "+faststart",
      outputPath,
    ],
    { encoding: "utf-8", maxBuffer: 10 * 1024 * 1024 }
  );

  if (result.status !== 0) {
    throw new Error(result.stderr?.trim() || result.stdout?.trim() || "ffmpeg failed to generate scene preview video");
  }
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string; sceneId: string }> }
) {
  try {
    const { id, sceneId } = await params;
    const projectDir = getProjectDir(id);
    if (!fs.existsSync(projectDir)) {
      return NextResponse.json({ success: false, error: "Project not found" }, { status: 404 });
    }

    const projectMeta = readProjectMeta(id);
    const selection = resolveShortFormBackgroundVideoSelection(projectMeta?.selectedBackgroundVideoId);
    if (!selection.background || !selection.resolvedBackgroundVideoId) {
      return NextResponse.json({ success: false, error: "No background video is configured" }, { status: 404 });
    }

    const sceneNumber = parseSceneNumber(sceneId);
    if (!sceneNumber) {
      return NextResponse.json({ success: false, error: "Invalid scene id" }, { status: 400 });
    }

    const rawImagePath = path.join(projectDir, "scenes", `scene-${String(sceneNumber).padStart(2, "0")}-uncaptioned-1080x1920.png`);
    if (!fs.existsSync(rawImagePath)) {
      return NextResponse.json({ success: false, error: "Scene image not found" }, { status: 404 });
    }
    const backgroundVideoPath = resolveShortFormBackgroundVideoAbsolutePath(selection.background.videoRelativePath);
    const { outputPath } = buildPreviewPaths(id, selection.resolvedBackgroundVideoId, sceneNumber);

    if (needsRefresh(outputPath, [rawImagePath, backgroundVideoPath])) {
      generatePreviewVideo(rawImagePath, backgroundVideoPath, outputPath);
    }

    const stat = fs.statSync(outputPath);
    const stream = fs.createReadStream(outputPath);
    return new NextResponse(Readable.toWeb(stream) as unknown as ReadableStream, {
      headers: {
        "Content-Type": "video/mp4",
        "Content-Length": String(stat.size),
        "Cache-Control": "no-cache",
        "Accept-Ranges": "bytes",
      },
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Failed to generate scene preview" },
      { status: 500 }
    );
  }
}
