import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { spawnSync } from "child_process";
import { getProjectDir } from "@/lib/short-form-videos";
import { readXmlVisualEditStates } from "@/lib/short-form-xml-visual-editor";
import { getXmlScriptPath } from "@/lib/short-form-xml-script";

export const dynamic = "force-dynamic";

const PREVIEW_DURATION_SECONDS = 4;
const PREVIEW_CACHE_DIRNAME = ".scene-preview-cache";
const PREVIEW_CACHE_VERSION = "v5-direct-camera";
const FRAME_WIDTH = 1080;
const FRAME_HEIGHT = 1920;
const FPS = 30;
const ANIMATED_ZOOM_SUPERSAMPLE = 4;
const PAD_COLOR = "0x000000";

function ensureDir(dirPath: string) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function parseSceneNumber(sceneId: string) {
  const match = sceneId.match(/scene-(\d+)/i);
  if (!match) return null;
  const value = Number(match[1]);
  return Number.isInteger(value) && value > 0 ? value : null;
}

function buildPreviewPaths(projectId: string, sceneNumber: number) {
  const cacheDir = path.join(
    getProjectDir(projectId),
    "scenes",
    PREVIEW_CACHE_DIRNAME,
    PREVIEW_CACHE_VERSION,
  );
  const outputPath = path.join(
    cacheDir,
    `scene-${String(sceneNumber).padStart(2, "0")}-preview.mp4`,
  );
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
    return readXmlVisualEditStates(getXmlScriptPath(projectId)).find(
      (state) => state.number === sceneNumber,
    );
  } catch {
    return undefined;
  }
}

function verticalFrameNormalizeFilter() {
  return [
    `scale=${FRAME_WIDTH}:${FRAME_HEIGHT}:force_original_aspect_ratio=decrease`,
    `pad=${FRAME_WIDTH}:${FRAME_HEIGHT}:(ow-iw)/2:(oh-ih)/2:color=${PAD_COLOR}`,
    "setsar=1",
  ].join(",");
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
  const normalizeFilter = verticalFrameNormalizeFilter();

  if (explicitZoomAnimation) {
    const totalFrames = Math.max(1, Math.round(PREVIEW_DURATION_SECONDS * FPS));
    const progressDen = Math.max(totalFrames - 1, 1);
    const zoom = `${startZoom.toFixed(4)}+${(endZoom - startZoom).toFixed(4)}*(on/${progressDen})`;
    return [
      normalizeFilter,
      `scale=w=iw*${ANIMATED_ZOOM_SUPERSAMPLE}:h=ih*${ANIMATED_ZOOM_SUPERSAMPLE}:flags=lanczos`,
      `zoompan=z='${zoom}':x='(iw-iw/zoom)/2':y='(ih-ih/zoom)/2':d=1:s=${FRAME_WIDTH}x${FRAME_HEIGHT}:fps=${FPS}`,
      `fps=${FPS}`,
      "format=yuv420p",
    ].join(",");
  }

  const zoom = startZoom.toFixed(4);
  return [
    normalizeFilter,
    `scale=w='trunc(${FRAME_WIDTH}*(${zoom})/2)*2':h='trunc(${FRAME_HEIGHT}*(${zoom})/2)*2':eval=frame`,
    `crop=${FRAME_WIDTH}:${FRAME_HEIGHT}:x='(in_w-out_w)/2':y='(in_h-out_h)/2'`,
    `fps=${FPS}`,
    "format=yuv420p",
  ].join(",");
}

function needsRefresh(outputPath: string, inputs: string[]) {
  if (!fs.existsSync(outputPath)) return true;
  const outputMtime = fs.statSync(outputPath).mtimeMs;
  return inputs.some((inputPath) => {
    if (!fs.existsSync(inputPath)) return true;
    return fs.statSync(inputPath).mtimeMs > outputMtime + 1000;
  });
}

function generatePreviewVideo(
  rawImagePath: string,
  outputPath: string,
  camera: ReturnType<typeof readSceneCameraZoom>,
) {
  ensureDir(path.dirname(outputPath));
  const result = spawnSync(
    "ffmpeg",
    [
      "-y",
      "-loop",
      "1",
      "-framerate",
      String(FPS),
      "-t",
      String(PREVIEW_DURATION_SECONDS),
      "-i",
      rawImagePath,
      "-vf",
      buildCameraZoomFilter(camera),
      "-an",
      "-c:v",
      "libx264",
      "-pix_fmt",
      "yuv420p",
      "-movflags",
      "+faststart",
      outputPath,
    ],
    { encoding: "utf-8", maxBuffer: 10 * 1024 * 1024 },
  );

  if (result.status !== 0) {
    throw new Error(
      result.stderr?.trim() ||
        result.stdout?.trim() ||
        "ffmpeg failed to generate scene preview video",
    );
  }
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string; sceneId: string }> },
) {
  try {
    const { id, sceneId } = await params;
    const projectDir = getProjectDir(id);
    if (!fs.existsSync(projectDir)) {
      return NextResponse.json(
        { success: false, error: "Project not found" },
        { status: 404 },
      );
    }

    const sceneNumber = parseSceneNumber(sceneId);
    if (!sceneNumber) {
      return NextResponse.json(
        { success: false, error: "Invalid scene id" },
        { status: 400 },
      );
    }

    const rawImagePath = path.join(
      projectDir,
      "scenes",
      `scene-${String(sceneNumber).padStart(2, "0")}-uncaptioned-1080x1920.png`,
    );
    if (!fs.existsSync(rawImagePath)) {
      return NextResponse.json(
        { success: false, error: "Scene image not found" },
        { status: 404 },
      );
    }

    const camera = readSceneCameraZoom(id, sceneNumber);
    const { outputPath } = buildPreviewPaths(id, sceneNumber);
    const xmlScriptPath = getXmlScriptPath(id);
    const inputPaths = [
      rawImagePath,
      ...(fs.existsSync(xmlScriptPath) ? [xmlScriptPath] : []),
    ];

    if (needsRefresh(outputPath, inputPaths)) {
      generatePreviewVideo(rawImagePath, outputPath, camera);
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
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to generate scene preview",
      },
      { status: 500 },
    );
  }
}
