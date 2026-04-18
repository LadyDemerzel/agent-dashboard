import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import os from "os";
import path from "path";
import { spawnSync } from "child_process";
import { getShortFormVoiceLibraryDir } from "@/lib/short-form-video-render-settings";

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
  return value.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "") || "voice";
}

function runFfmpeg(inputPath: string, outputPath: string) {
  const result = spawnSync(
    "ffmpeg",
    ["-y", "-i", inputPath, "-vn", "-acodec", "pcm_s16le", "-ac", "1", outputPath],
    {
      encoding: "utf-8",
      maxBuffer: 20 * 1024 * 1024,
    }
  );

  if (result.status !== 0) {
    throw new Error(result.stderr.trim() || result.stdout.trim() || "ffmpeg failed to convert uploaded audio");
  }
}

export async function POST(request: NextRequest) {
  let tempDir: string | null = null;

  try {
    const formData = await request.formData();
    const file = formData.get("file");
    const voiceId = typeof formData.get("voiceId") === "string" ? String(formData.get("voiceId")).trim() : "";

    if (!(file instanceof File)) {
      return NextResponse.json({ success: false, error: "file is required" }, { status: 400 });
    }

    if (!voiceId) {
      return NextResponse.json({ success: false, error: "voiceId is required" }, { status: 400 });
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

    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "agent-dashboard-voice-upload-"));
    const tempInputPath = path.join(tempDir, `input${fallbackExt || ".bin"}`);
    const baseDir = getShortFormVoiceLibraryDir();
    const voiceDir = path.join(baseDir, sanitizePathSegment(voiceId));
    const outputPath = path.join(voiceDir, "reference.wav");
    const relativePath = path.relative(baseDir, outputPath).split(path.sep).join("/");
    const uploadedAt = new Date().toISOString();

    fs.mkdirSync(voiceDir, { recursive: true });
    fs.writeFileSync(tempInputPath, bytes);
    runFfmpeg(tempInputPath, outputPath);

    fs.writeFileSync(
      path.join(voiceDir, "meta.json"),
      JSON.stringify(
        {
          voiceId,
          originalFileName: file.name || "reference-audio",
          uploadedAt,
          referenceAudioRelativePath: relativePath,
          source: "voice-library-upload",
        },
        null,
        2
      ),
      "utf-8"
    );

    return NextResponse.json({
      success: true,
      data: {
        referenceAudioRelativePath: relativePath,
        audioUrl: `/api/short-form-videos/settings/voice-library-files/${relativePath
          .split("/")
          .filter(Boolean)
          .map((part) => encodeURIComponent(part))
          .join("/")}?v=${Date.now()}`,
        uploadedAt,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Failed to upload reference voice" },
      { status: 500 }
    );
  } finally {
    if (tempDir) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  }
}
