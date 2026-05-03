import { NextResponse } from "next/server";
import crypto from "crypto";
import fs from "fs";
import path from "path";
import { spawn } from "child_process";
import { SHORT_FORM_VIDEOS_DIR } from "@/lib/short-form-videos";
import {
  SUPPORTED_MOTION_GRAPHIC_RENDERERS,
  type MotionGraphicTemplateConfig,
} from "@/lib/short-form-motion-graphics";
export const dynamic = "force-dynamic";

const PREVIEW_DIR = path.join(SHORT_FORM_VIDEOS_DIR, "_motion-graphic-previews");
const PROCESS_FLOW_BACKGROUND_IMAGE_PATH = path.join(
  SHORT_FORM_VIDEOS_DIR,
  "_motion-graphic-assets",
  "process-flow-dark-pastel-watercolor-bg.png",
);
const RENDER_SCRIPT_PATH = path.join(process.cwd(), "scripts", "render-motion-graphic.mjs");

interface PreviewRequestBody {
  template?: Partial<MotionGraphicTemplateConfig>;
  force?: boolean;
}

function slugify(value: unknown, fallback: string) {
  const raw = typeof value === "string" && value.trim() ? value.trim() : fallback;
  return raw
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || fallback;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function resolvePreviewBackgroundImage(_rendererId: string) {
  if (!fs.existsSync(PROCESS_FLOW_BACKGROUND_IMAGE_PATH)) return null;

  const stat = fs.statSync(PROCESS_FLOW_BACKGROUND_IMAGE_PATH);
  return {
    backgroundImageName: "Dark pastel watercolor unified motion-graphics background",
    backgroundImagePath: PROCESS_FLOW_BACKGROUND_IMAGE_PATH,
    backgroundImageMtimeMs: Math.round(stat.mtimeMs),
  };
}

function normalizeTemplate(value: unknown) {
  const template = asRecord(value);
  const rendererId = typeof template.rendererId === "string" ? template.rendererId : "stat_reveal";
  if (!(SUPPORTED_MOTION_GRAPHIC_RENDERERS as readonly string[]).includes(rendererId)) {
    throw new Error(`Unsupported motion graphics renderer: ${rendererId}`);
  }

  const durationNumber = Number(template.durationSeconds);
  const durationSeconds = Number.isFinite(durationNumber)
    ? Math.min(12, Math.max(3, durationNumber))
    : 6;
  const previewBackgroundImage = resolvePreviewBackgroundImage(rendererId);

  return {
    templateId: typeof template.id === "string" && template.id.trim() ? template.id.trim() : rendererId,
    rendererId,
    durationSeconds,
    stylePreset:
      typeof template.stylePreset === "string" && template.stylePreset.trim()
        ? template.stylePreset.trim()
        : "watercolor-editorial",
    defaultArgs: asRecord(template.defaultArgs),
    ...(previewBackgroundImage || {}),
  };
}

function rendererSourceHash() {
  try {
    return crypto
      .createHash("sha256")
      .update(fs.readFileSync(RENDER_SCRIPT_PATH))
      .digest("hex")
      .slice(0, 16);
  } catch {
    return "renderer-source-unavailable";
  }
}

function previewHash(config: ReturnType<typeof normalizeTemplate>) {
  return crypto
    .createHash("sha256")
    .update(JSON.stringify({ config, rendererSourceHash: rendererSourceHash() }))
    .digest("hex")
    .slice(0, 16);
}

function runRenderScript(configPath: string, outputPath: string, posterPath: string) {
  return new Promise<void>((resolve, reject) => {
    const child = spawn(
      process.execPath,
      [RENDER_SCRIPT_PATH, "--config", configPath, "--output", outputPath, "--poster", posterPath],
      { cwd: process.cwd(), stdio: ["ignore", "pipe", "pipe"] },
    );

    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += String(chunk);
    });
    child.stderr.on("data", (chunk) => {
      stderr += String(chunk);
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(stderr.trim() || stdout.trim() || `Renderer exited with status ${code}`));
    });
  });
}

function buildAssetUrl(relativePath: string, version: string) {
  return `/api/short-form-videos/settings/motion-graphics-previews/${relativePath
    .split(path.sep)
    .map(encodeURIComponent)
    .join("/")}?v=${encodeURIComponent(version)}`;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as PreviewRequestBody;
    const config = normalizeTemplate(body.template);
    const hash = previewHash(config);
    const slug = slugify(config.templateId, config.rendererId);
    const outputDir = path.join(PREVIEW_DIR, slug);
    const configPath = path.join(outputDir, `${hash}.json`);
    const videoPath = path.join(outputDir, `${hash}.mp4`);
    const posterPath = path.join(outputDir, `${hash}.png`);
    const relativeVideoPath = path.relative(PREVIEW_DIR, videoPath).split(path.sep).join("/");
    const relativePosterPath = path.relative(PREVIEW_DIR, posterPath).split(path.sep).join("/");

    fs.mkdirSync(outputDir, { recursive: true });

    const hasCachedPreview = fs.existsSync(videoPath) && fs.existsSync(posterPath);
    if (!hasCachedPreview || body.force) {
      fs.writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`, "utf-8");
      await runRenderScript(configPath, videoPath, posterPath);
    }

    const version = String(Math.max(fs.statSync(videoPath).mtimeMs, fs.statSync(posterPath).mtimeMs));

    return NextResponse.json({
      success: true,
      data: {
        templateId: config.templateId,
        rendererId: config.rendererId,
        previewKey: hash,
        videoRelativePath: relativeVideoPath,
        posterRelativePath: relativePosterPath,
        videoUrl: buildAssetUrl(relativeVideoPath, version),
        posterUrl: buildAssetUrl(relativePosterPath, version),
        reusedExisting: hasCachedPreview && !body.force,
        durationSeconds: config.durationSeconds,
        ...(config.backgroundImagePath
          ? {
              backgroundImageName: config.backgroundImageName,
            }
          : {}),
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to render motion graphics preview",
      },
      { status: 500 },
    );
  }
}
