import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import os from "os";
import path from "path";
import { spawnSync } from "child_process";
import {
  getShortFormSoundDesignSettings,
  getShortFormSoundLibraryDir,
  getStoredSoundLibraryAudioAnalysis,
} from "@/lib/short-form-sound-design-settings";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const ALLOWED_CONTENT_TYPES = new Set([
  "audio/wav",
  "audio/wave",
  "audio/x-wav",
  "audio/mpeg",
  "audio/mp3",
  "audio/mp4",
  "audio/x-m4a",
  "audio/aac",
  "audio/ogg",
  "audio/opus",
  "audio/webm",
  "video/webm",
  "application/octet-stream",
]);

const ALLOWED_EXTENSIONS = new Set([".wav", ".mp3", ".m4a", ".aac", ".mp4", ".ogg", ".opus", ".webm"]);

function sanitizePathSegment(value: string) {
  return value.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "") || "sound";
}

function runFfmpeg(inputPath: string, outputPath: string) {
  const result = spawnSync(
    "ffmpeg",
    ["-y", "-i", inputPath, "-vn", "-ar", "48000", "-ac", "2", "-acodec", "pcm_s16le", outputPath],
    {
      encoding: "utf-8",
      maxBuffer: 20 * 1024 * 1024,
    }
  );

  if (result.status !== 0) {
    throw new Error(result.stderr.trim() || result.stdout.trim() || "ffmpeg failed to convert uploaded sound");
  }
}

export async function POST(request: NextRequest) {
  let tempDir: string | null = null;

  try {
    const formData = await request.formData();
    const file = formData.get("file");
    const soundId = typeof formData.get("soundId") === "string" ? String(formData.get("soundId")).trim() : "";

    if (!(file instanceof File)) {
      return NextResponse.json({ success: false, error: "file is required" }, { status: 400 });
    }

    if (!soundId) {
      return NextResponse.json({ success: false, error: "soundId is required" }, { status: 400 });
    }

    const settings = getShortFormSoundDesignSettings();
    if (!settings.library.some((sound) => sound.id === soundId)) {
      return NextResponse.json({ success: false, error: "Sound-library entry not found. Refresh settings and try again." }, { status: 404 });
    }

    const fallbackExt = path.extname(file.name || "").toLowerCase();
    if (!ALLOWED_CONTENT_TYPES.has(file.type) && !ALLOWED_EXTENSIONS.has(fallbackExt)) {
      return NextResponse.json({ success: false, error: "Unsupported audio type. Upload wav, mp3, m4a, aac, ogg, opus, or webm." }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const bytes = Buffer.from(arrayBuffer);
    if (!bytes.length) {
      return NextResponse.json({ success: false, error: "Uploaded file is empty" }, { status: 400 });
    }

    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "agent-dashboard-sound-upload-"));
    const tempInputPath = path.join(tempDir, `input${fallbackExt || ".bin"}`);
    const baseDir = getShortFormSoundLibraryDir();
    const soundDir = path.join(baseDir, sanitizePathSegment(soundId));
    const outputPath = path.join(soundDir, "asset.wav");
    const relativePath = path.relative(baseDir, outputPath).split(path.sep).join("/");
    const uploadedAt = new Date().toISOString();

    fs.mkdirSync(soundDir, { recursive: true });
    fs.writeFileSync(tempInputPath, bytes);
    runFfmpeg(tempInputPath, outputPath);
    const metadata = getStoredSoundLibraryAudioAnalysis(relativePath);

    fs.writeFileSync(
      path.join(soundDir, "meta.json"),
      JSON.stringify(
        {
          soundId,
          originalFileName: file.name || "sound-effect",
          uploadedAt,
          updatedAt: uploadedAt,
          audioRelativePath: relativePath,
          source: "sound-library-upload",
          ...metadata,
        },
        null,
        2
      ),
      "utf-8"
    );

    return NextResponse.json({
      success: true,
      data: {
        audioRelativePath: relativePath,
        audioUrl: `/api/short-form-videos/settings/sound-library-files/${relativePath
          .split("/")
          .filter(Boolean)
          .map((part) => encodeURIComponent(part))
          .join("/")}?v=${Date.now()}`,
        uploadedAt,
        updatedAt: uploadedAt,
        ...metadata,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Failed to upload sound-library file" },
      { status: 500 }
    );
  } finally {
    if (tempDir) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  }
}
