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
import { renderMotionGraphicPreviewSoundEffects } from "@/lib/short-form-sound-design";
import {
  getShortFormSoundDesignSettings,
  getShortFormSoundLibraryDir,
} from "@/lib/short-form-sound-design-settings";
export const dynamic = "force-dynamic";

const PREVIEW_DIR = path.join(SHORT_FORM_VIDEOS_DIR, "_motion-graphic-previews");
const UNIFIED_MOTION_GRAPHICS_BACKGROUND_IMAGE_PATH = path.join(
  SHORT_FORM_VIDEOS_DIR,
  "_motion-graphic-assets",
  "process-flow-dark-pastel-watercolor-bg.png",
);
const RENDER_SCRIPT_PATH = path.join(process.cwd(), "scripts", "render-hyperframes-motion-graphic.mjs");
const LEGACY_RENDERER_FALLBACKS: Record<string, string> = {
  process_flow: "timeline",
  warning_card: "good_bad_indicator",
  instruction: "good_bad_indicator",
  step_checklist: "list",
  checklist: "list",
};

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
  if (!fs.existsSync(UNIFIED_MOTION_GRAPHICS_BACKGROUND_IMAGE_PATH)) return null;

  const stat = fs.statSync(UNIFIED_MOTION_GRAPHICS_BACKGROUND_IMAGE_PATH);
  return {
    backgroundImageName: "Dark pastel watercolor unified motion-graphics background",
    backgroundImagePath: UNIFIED_MOTION_GRAPHICS_BACKGROUND_IMAGE_PATH,
    backgroundImageMtimeMs: Math.round(stat.mtimeMs),
  };
}

function normalizeTemplate(value: unknown) {
  const template = asRecord(value);
  const rawRendererId = typeof template.rendererId === "string" ? template.rendererId : "stat_reveal";
  const rendererId = LEGACY_RENDERER_FALLBACKS[rawRendererId] || rawRendererId;
  if (!(SUPPORTED_MOTION_GRAPHIC_RENDERERS as readonly string[]).includes(rendererId)) {
    throw new Error(`Unsupported motion graphics renderer: ${rawRendererId}`);
  }

  const durationNumber = Number(template.durationSeconds);
  const durationSeconds = Number.isFinite(durationNumber)
    ? Math.min(12, Math.max(3, durationNumber))
    : 6;
  const previewBackgroundImage = resolvePreviewBackgroundImage(rendererId);

  const templateId = typeof template.id === "string" && template.id.trim() ? template.id.trim() : rendererId;
  return {
    id: templateId,
    templateId,
    rendererId,
    durationSeconds,
    ...(rendererId === "caption_word_wall" ? { allowSyntheticTiming: true } : {}),
    stylePreset:
      typeof template.stylePreset === "string" && template.stylePreset.trim()
        ? template.stylePreset.trim()
        : "watercolor-editorial",
    defaultArgs: asRecord(template.defaultArgs),
    displayName:
      typeof template.displayName === "string" && template.displayName.trim()
        ? template.displayName.trim()
        : rendererId,
    deterministicSoundEffects: Array.isArray(template.deterministicSoundEffects)
      ? (template.deterministicSoundEffects as MotionGraphicTemplateConfig["deterministicSoundEffects"])
      : [],
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

function sourceFileHash(relativePath: string) {
  try {
    return crypto
      .createHash("sha256")
      .update(fs.readFileSync(path.join(process.cwd(), relativePath)))
      .digest("hex")
      .slice(0, 16);
  } catch {
    return "source-unavailable";
  }
}

function soundEffectsPreviewSourceHash() {
  const soundLibraryDir = getShortFormSoundLibraryDir();
  const settings = getShortFormSoundDesignSettings();
  const librarySignature = settings.library.map((asset) => {
    const absolutePath = asset.audioRelativePath
      ? path.join(soundLibraryDir, asset.audioRelativePath)
      : "";
    const stat = absolutePath && fs.existsSync(absolutePath)
      ? fs.statSync(absolutePath)
      : null;
    return {
      id: asset.id,
      semanticTypes: asset.semanticTypes,
      category: asset.category,
      frequencyBand: asset.frequencyBand,
      layerRoles: asset.layerRoles,
      literalness: asset.literalness,
      timingType: asset.timingType,
      defaultGainDb: asset.defaultGainDb,
      defaultFadeInMs: asset.defaultFadeInMs,
      defaultFadeOutMs: asset.defaultFadeOutMs,
      audioRelativePath: asset.audioRelativePath,
      audioMtimeMs: stat ? Math.round(stat.mtimeMs) : null,
      audioSize: stat ? stat.size : null,
    };
  });

  return crypto
    .createHash("sha256")
    .update(JSON.stringify({
      library: librarySignature,
      soundDesignSourceHash: sourceFileHash("src/lib/short-form-sound-design.ts"),
      soundDesignSettingsSourceHash: sourceFileHash("src/lib/short-form-sound-design-settings.ts"),
    }))
    .digest("hex")
    .slice(0, 16);
}

function previewHash(config: ReturnType<typeof normalizeTemplate>) {
  return crypto
    .createHash("sha256")
    .update(JSON.stringify({
      config,
      rendererSourceHash: rendererSourceHash(),
      soundEffectsPreviewSourceHash: soundEffectsPreviewSourceHash(),
    }))
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

function runMuxVideoWithAudio(videoPath: string, audioPath: string, outputPath: string) {
  return new Promise<void>((resolve, reject) => {
    const child = spawn(
      "ffmpeg",
      [
        "-y",
        "-i",
        videoPath,
        "-i",
        audioPath,
        "-map",
        "0:v:0",
        "-map",
        "1:a:0",
        "-c:v",
        "copy",
        "-c:a",
        "aac",
        "-b:a",
        "192k",
        "-movflags",
        "+faststart",
        outputPath,
      ],
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
      reject(new Error(stderr.trim() || stdout.trim() || `ffmpeg exited with status ${code}`));
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
    const silentVideoPath = path.join(outputDir, `${hash}.silent.mp4`);
    const audioPath = path.join(outputDir, `${hash}.wav`);
    const posterPath = path.join(outputDir, `${hash}.png`);
    const soundMetaPath = path.join(outputDir, `${hash}.sound-effects.json`);
    const relativeVideoPath = path.relative(PREVIEW_DIR, videoPath).split(path.sep).join("/");
    const relativePosterPath = path.relative(PREVIEW_DIR, posterPath).split(path.sep).join("/");

    fs.mkdirSync(outputDir, { recursive: true });

    const hasCachedPreview = fs.existsSync(videoPath) && fs.existsSync(posterPath) && fs.existsSync(soundMetaPath);
    let soundEffectsPreview: unknown = null;
    if (!hasCachedPreview || body.force) {
      fs.writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`, "utf-8");
      await runRenderScript(configPath, silentVideoPath, posterPath);

      try {
        const soundResult = renderMotionGraphicPreviewSoundEffects({
          template: config,
          durationSeconds: config.durationSeconds,
          outputPath: audioPath,
          args: config.defaultArgs,
        });
        soundEffectsPreview = {
          rendered: soundResult.rendered,
          skippedReason: soundResult.skippedReason,
          stats: soundResult.stats,
          eventIds: soundResult.events.map((event) => event.id),
          unresolvedEventIds: soundResult.events
            .filter((event) => event.status !== "resolved")
            .map((event) => event.id),
        };

        if (soundResult.rendered && soundResult.audioPath) {
          await runMuxVideoWithAudio(silentVideoPath, soundResult.audioPath, videoPath);
        } else {
          fs.copyFileSync(silentVideoPath, videoPath);
        }
      } catch (error) {
        soundEffectsPreview = {
          rendered: false,
          error: error instanceof Error ? error.message : "Failed to render preview sound effects",
        };
        fs.copyFileSync(silentVideoPath, videoPath);
      }
      fs.writeFileSync(soundMetaPath, `${JSON.stringify(soundEffectsPreview, null, 2)}\n`, "utf-8");
    } else {
      try {
        soundEffectsPreview = JSON.parse(fs.readFileSync(soundMetaPath, "utf-8"));
      } catch {
        soundEffectsPreview = null;
      }
    }

    const versionInputs = [videoPath, posterPath, soundMetaPath, audioPath].filter((filePath) => fs.existsSync(filePath));
    const version = String(Math.max(...versionInputs.map((filePath) => fs.statSync(filePath).mtimeMs)));

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
        soundEffectsPreview,
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
