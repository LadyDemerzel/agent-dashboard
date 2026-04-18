import fs from "fs";
import path from "path";
import { spawn } from "child_process";
import { NextRequest, NextResponse } from "next/server";
import {
  getShortFormVideoRenderSettings,
  getShortFormVoiceLibraryDir,
  saveShortFormVideoRenderSettings,
  type ShortFormVoiceLibraryEntry,
} from "@/lib/short-form-video-render-settings";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const HOME_DIR = process.env.HOME || "/Users/ittaisvidler";
const QWEN_RUNNER = path.join(
  HOME_DIR,
  ".openclaw",
  "workspace-ralph",
  "skills",
  "qwen3-voiceover",
  "scripts",
  "run.sh"
);
const DEFAULT_WARMUP_TEXT = "Hi there. Ready when you are.";
// Keep generated references long enough to stabilize later voice-clone runs,
// while still fitting inside one voice-design chunk.
const MIN_REFERENCE_CHARS = 320;
const MAX_REFERENCE_CHARS = 650;
const REFERENCE_EXTENSION_TEXT =
  " Keep your shoulders relaxed, breathe through the nose, and imagine you are explaining a useful idea to one smart friend in a calm, confident, trustworthy tone.";

function normalizeString(value: unknown, fallback = "") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function sanitizePathSegment(value: string) {
  return value.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "") || "voice";
}

function buildAudioUrl(relativePath: string) {
  return `/api/short-form-videos/settings/voice-library-files/${relativePath
    .split("/")
    .filter(Boolean)
    .map((part) => encodeURIComponent(part))
    .join("/")}?v=${Date.now()}`;
}

function normalizeReferenceText(voice: ShortFormVoiceLibraryEntry) {
  let text = normalizeString(voice.previewText);
  if (!text) {
    text = "Most people think their face shape is fixed, but posture, breathing, and muscular balance change more than you expect. In this lesson, I will walk through the habits that matter most, the mistakes that waste effort, and the small adjustments that create visible changes over time.";
  }
  while (text.length < MIN_REFERENCE_CHARS) {
    text = `${text}${REFERENCE_EXTENSION_TEXT}`.trim();
  }
  if (text.length > MAX_REFERENCE_CHARS) {
    text = text.slice(0, MAX_REFERENCE_CHARS).trim();
  }
  return text;
}

function runCommand(command: string, args: string[]) {
  return new Promise<{ stdout: string; stderr: string }>((resolve, reject) => {
    const child = spawn(command, args, {
      env: {
        ...process.env,
        PYTORCH_ENABLE_MPS_FALLBACK: "1",
      },
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve({ stdout, stderr });
        return;
      }
      reject(new Error(stderr.trim() || stdout.trim() || `${command} exited with code ${code}`));
    });
  });
}

export async function POST(request: NextRequest) {
  if (!fs.existsSync(QWEN_RUNNER)) {
    return NextResponse.json({ success: false, error: `Qwen runner not found: ${QWEN_RUNNER}` }, { status: 500 });
  }

  const body = await request.json().catch(() => ({}));
  const voiceId = normalizeString(body?.voiceId);
  const force = body?.force === true;

  if (!voiceId) {
    return NextResponse.json({ success: false, error: "voiceId is required" }, { status: 400 });
  }

  const settings = getShortFormVideoRenderSettings();
  const voice = settings.voices.find((candidate) => candidate.id === voiceId);
  if (!voice) {
    return NextResponse.json({ success: false, error: "Saved voice entry not found" }, { status: 404 });
  }

  const isUploadedReferenceVoice = voice.sourceType === "uploaded-reference";
  const referenceText = isUploadedReferenceVoice
    ? normalizeString(voice.referenceText, normalizeString(voice.previewText))
    : normalizeReferenceText(voice);
  const canonicalRelativePath = voice.referenceAudioRelativePath || `${sanitizePathSegment(voice.id)}/reference.wav`;
  const absolutePath = path.resolve(getShortFormVoiceLibraryDir(), canonicalRelativePath);
  const workDir = path.dirname(absolutePath);
  const transcriptPath = path.join(workDir, "reference.txt");
  const metaPath = path.join(workDir, "meta.json");
  fs.mkdirSync(workDir, { recursive: true });
  fs.writeFileSync(transcriptPath, `${referenceText}\n`, "utf-8");

  if (isUploadedReferenceVoice) {
    if (!voice.referenceAudioRelativePath || !fs.existsSync(absolutePath) || !fs.statSync(absolutePath).isFile()) {
      return NextResponse.json({ success: false, error: "Uploaded reference clip is missing. Re-upload the voice clip in Short-form Video settings." }, { status: 400 });
    }
    if (!referenceText) {
      return NextResponse.json({ success: false, error: "Uploaded reference voice needs a transcript before it can be reused." }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      data: {
        voice,
        videoRender: settings,
        reusedExisting: true,
        audioUrl: buildAudioUrl(voice.referenceAudioRelativePath),
      },
    });
  }

  const canReuseExisting = Boolean(
    !force
    && voice.referenceAudioRelativePath === canonicalRelativePath
    && voice.referencePrompt === voice.voiceDesignPrompt
    && voice.referenceMode === voice.mode
    && (voice.mode !== "custom-voice" || voice.referenceSpeaker === (voice.speaker || undefined))
    && voice.referenceText === referenceText
    && fs.existsSync(absolutePath)
    && fs.statSync(absolutePath).isFile()
  );

  try {
    if (!canReuseExisting) {
      const args = [
        QWEN_RUNNER,
        "--mode",
        voice.mode,
        "--language",
        "English",
      ];

      if (voice.mode === "custom-voice") {
        const speaker = normalizeString(voice.speaker);
        if (!speaker) {
          return NextResponse.json({ success: false, error: "Legacy/custom voice is missing its speaker" }, { status: 400 });
        }
        args.push("--speaker", speaker);
      }

      args.push(
        "--instruct",
        voice.mode === "custom-voice"
          ? (voice.legacyInstruct || voice.voiceDesignPrompt)
          : voice.voiceDesignPrompt,
        "--text-file",
        transcriptPath,
        "--output",
        absolutePath,
      );

      if (voice.mode !== "custom-voice") {
        args.push("--warmup-text", DEFAULT_WARMUP_TEXT, "--max-chars", String(MAX_REFERENCE_CHARS));
      }

      await runCommand("bash", args);
    }

    const referenceGeneratedAt = canReuseExisting ? (voice.referenceGeneratedAt || new Date().toISOString()) : new Date().toISOString();
    fs.writeFileSync(
      metaPath,
      JSON.stringify(
        {
          voiceId: voice.id,
          voiceName: voice.name,
          referenceGeneratedAt,
          referenceMode: voice.mode,
          referencePrompt: voice.voiceDesignPrompt,
          referenceText,
          ...(voice.speaker ? { referenceSpeaker: voice.speaker } : {}),
          referenceAudioRelativePath: canonicalRelativePath,
          reusedExisting: canReuseExisting,
        },
        null,
        2
      ),
      "utf-8"
    );

    const nextSettings = saveShortFormVideoRenderSettings({
      ...settings,
      voices: settings.voices.map((candidate) =>
        candidate.id === voice.id
          ? {
              ...candidate,
              referenceAudioRelativePath: canonicalRelativePath,
              referenceText,
              referencePrompt: voice.voiceDesignPrompt,
              referenceMode: voice.mode,
              ...(voice.speaker ? { referenceSpeaker: voice.speaker } : {}),
              referenceGeneratedAt,
            }
          : candidate
      ),
    });
    const savedVoice = nextSettings.voices.find((candidate) => candidate.id === voice.id);
    if (!savedVoice?.referenceAudioRelativePath || !savedVoice.referenceText) {
      throw new Error("Saved voice reference metadata did not persist correctly");
    }

    return NextResponse.json({
      success: true,
      data: {
        voice: savedVoice,
        videoRender: nextSettings,
        reusedExisting: canReuseExisting,
        audioUrl: buildAudioUrl(savedVoice.referenceAudioRelativePath),
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to generate reusable voice sample",
      },
      { status: 500 }
    );
  }
}
