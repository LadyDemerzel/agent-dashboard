import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { spawnSync } from "child_process";
import { getProjectDir, readProjectMeta } from "@/lib/short-form-videos";
import { readXmlVisualEditStates } from "@/lib/short-form-xml-visual-editor";
import { getXmlScriptPath } from "@/lib/short-form-xml-script";
import {
  resolveShortFormBackgroundVideoAbsolutePath,
  resolveShortFormBackgroundVideoSelection,
} from "@/lib/short-form-background-videos";

export const dynamic = "force-dynamic";

const PREVIEW_DURATION_SECONDS = 4;
const PREVIEW_CACHE_DIRNAME = ".scene-preview-cache";
const PREVIEW_CACHE_VERSION = "v4-camera-zoom";
const FRAME_WIDTH = 1080;
const FRAME_HEIGHT = 1920;
const ANIMATED_ZOOM_SUPERSAMPLE = 4;
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

function parseOptionalFloat(value?: string) {
  if (!value?.trim()) return undefined;
  const parsed = Number(value.trim());
  return Number.isFinite(parsed) ? parsed : undefined;
}

function resolveZoomValue(value: number | undefined, fallback: number) {
  if (value === undefined) return fallback;
  const normalized = Math.max(0, value);
  return normalized >= 1 ? normalized : 1 + normalized;
}

function readSceneCameraZoom(projectId: string, sceneNumber: number) {
  try {
    return readXmlVisualEditStates(getXmlScriptPath(projectId)).find((state) => state.number === sceneNumber);
  } catch {
    return undefined;
  }
}

function buildCameraZoomFilter(camera: ReturnType<typeof readSceneCameraZoom>) {
  const rawStaticZoom = parseOptionalFloat(camera?.cameraZoom);
  const rawZoomStart = parseOptionalFloat(camera?.cameraZoomStart);
  const rawZoomEnd = parseOptionalFloat(camera?.cameraZoomEnd);
  const explicitZoomAnimation = rawZoomStart !== undefined || rawZoomEnd !== undefined;
  const staticZoom = resolveZoomValue(rawStaticZoom, 1);
  let startZoom = resolveZoomValue(rawZoomStart, staticZoom);
  let endZoom = resolveZoomValue(rawZoomEnd, staticZoom);
  const maxZoomGain = Math.max(0, staticZoom - 1, startZoom - 1, endZoom - 1);
  const baseBuffer = Math.min(0.35, maxZoomGain * 0.35);
  startZoom += baseBuffer;
  endZoom += baseBuffer;

  if (explicitZoomAnimation) {
    const totalFrames = Math.max(1, Math.round(PREVIEW_DURATION_SECONDS * 30));
    const progressDen = Math.max(totalFrames - 1, 1);
    const zoom = `${startZoom.toFixed(4)}+${(endZoom - startZoom).toFixed(4)}*(on/${progressDen})`;
    return [
      `scale=w=iw*${ANIMATED_ZOOM_SUPERSAMPLE}:h=ih*${ANIMATED_ZOOM_SUPERSAMPLE}:flags=lanczos`,
      `zoompan=z='${zoom}':x='(iw-iw/zoom)/2':y='(ih-ih/zoom)/2':d=1:s=${FRAME_WIDTH}x${FRAME_HEIGHT}:fps=30`,
    ].join(",");
  }

  const zoom = startZoom.toFixed(4);
  if (zoom === "1.0000") return "";
  return [
    `scale=w='trunc(${FRAME_WIDTH}*(${zoom})/2)*2':h='trunc(${FRAME_HEIGHT}*(${zoom})/2)*2':eval=frame`,
    `crop=${FRAME_WIDTH}:${FRAME_HEIGHT}:x='(in_w-out_w)/2':y='(in_h-out_h)/2'`,
  ].join(",");
}

function needsRefresh(outputPath: string, inputs: string[]) {
  if (!fs.existsSync(outputPath)) return true;
  const outputMtime = fs.statSync(outputPath).mtimeMs;
  return inputs.some((inputPath) => !fs.existsSync(inputPath) || fs.statSync(inputPath).mtimeMs > outputMtime + 1000);
}

function generatePreviewVideo(rawImagePath: string, backgroundVideoPath: string, outputPath: string, camera: ReturnType<typeof readSceneCameraZoom>) {
  ensureDir(path.dirname(outputPath));
  const cameraFilter = buildCameraZoomFilter(camera);
  const filter = [
    `[1:v]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920[bg]`,
    `[0:v]scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2:color=0x00FF00,setsar=1,${cameraFilter ? `${cameraFilter},` : ""}${GREENSCREEN_FILTER}[fg]`,
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
    const camera = readSceneCameraZoom(id, sceneNumber);
    const { outputPath } = buildPreviewPaths(id, selection.resolvedBackgroundVideoId, sceneNumber);
    const xmlScriptPath = getXmlScriptPath(id);
    const inputPaths = [rawImagePath, backgroundVideoPath, ...(fs.existsSync(xmlScriptPath) ? [xmlScriptPath] : [])];

    if (needsRefresh(outputPath, inputPaths)) {
      generatePreviewVideo(rawImagePath, backgroundVideoPath, outputPath, camera);
    }

    const stat = fs.statSync(outputPath);
    const body = await fs.promises.readFile(outputPath);
    return new NextResponse(body, {
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
