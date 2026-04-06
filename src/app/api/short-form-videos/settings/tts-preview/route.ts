import fs from "fs";
import path from "path";
import { spawn } from "child_process";
import { NextRequest, NextResponse } from "next/server";
import {
  getShortFormVideoRenderSettings,
  getShortFormVoiceTestsDir,
  resolveShortFormVoiceSelection,
  type ShortFormQwenVoiceMode,
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
const QWEN_VOICE_DESIGN_WARMUP_TEXT = "Hi there. Ready when you are.";

function normalizeString(value: unknown, fallback = "") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function normalizeMode(value: unknown, fallback: ShortFormQwenVoiceMode): ShortFormQwenVoiceMode {
  return value === "custom-voice" ? "custom-voice" : fallback;
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
    return NextResponse.json({ success: false, error: `Qwen preview runner not found: ${QWEN_RUNNER}` }, { status: 500 });
  }

  const body = await request.json().catch(() => ({}));
  const savedSettings = getShortFormVideoRenderSettings();
  const savedVoiceSelection = resolveShortFormVoiceSelection(typeof body?.voiceId === "string" ? body.voiceId.trim() : undefined);

  const mode = normalizeMode(body?.voice?.mode, savedVoiceSelection.voice.mode);
  const name = normalizeString(body?.voice?.name, savedVoiceSelection.voice.name);
  const voiceDesignPrompt = normalizeString(body?.voice?.voiceDesignPrompt, savedVoiceSelection.voice.voiceDesignPrompt);
  const speaker = normalizeString(body?.voice?.speaker, savedVoiceSelection.voice.speaker || "");
  const sampleText = normalizeString(body?.sampleText, savedVoiceSelection.voice.previewText);

  if (!name || !voiceDesignPrompt || !sampleText) {
    return NextResponse.json({ success: false, error: "name, voiceDesignPrompt, and sampleText are required" }, { status: 400 });
  }
  if (mode === "custom-voice" && !speaker) {
    return NextResponse.json({ success: false, error: "speaker is required for legacy/custom voice previews" }, { status: 400 });
  }

  const runId = `tts-preview-${Date.now()}`;
  const runDir = path.join(getShortFormVoiceTestsDir(), runId);
  fs.mkdirSync(runDir, { recursive: true });

  const outputPath = path.join(runDir, "preview.mp3");
  const transcriptPath = path.join(runDir, "sample.txt");
  const metaPath = path.join(runDir, "meta.json");

  fs.writeFileSync(transcriptPath, `${sampleText}\n`, "utf-8");

  try {
    const args = [
      QWEN_RUNNER,
      "--mode",
      mode,
      "--language",
      "English",
      "--instruct",
      voiceDesignPrompt,
      "--text-file",
      transcriptPath,
      "--output",
      outputPath,
    ];

    if (mode === "custom-voice") {
      args.splice(4, 0, "--speaker", speaker);
    } else {
      args.push("--warmup-text", QWEN_VOICE_DESIGN_WARMUP_TEXT);
    }

    const result = await runCommand("bash", args);

    const meta = {
      runId,
      sampleText,
      voice: {
        id: normalizeString(body?.voice?.id),
        name,
        mode,
        voiceDesignPrompt,
        ...(speaker ? { speaker } : {}),
      },
      defaultVoiceId: savedSettings.defaultVoiceId,
      createdAt: new Date().toISOString(),
      stdout: result.stdout.trim(),
      stderr: result.stderr.trim(),
    };
    fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2), "utf-8");

    return NextResponse.json({
      success: true,
      data: {
        runId,
        sampleText,
        audioRelativePath: `${runId}/preview.mp3`,
        audioUrl: `/api/short-form-videos/settings/voice-tests/${runId}/preview.mp3?v=${Date.now()}`,
        voice: {
          name,
          mode,
          voiceDesignPrompt,
          ...(speaker ? { speaker } : {}),
        },
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to generate TTS preview",
      },
      { status: 500 }
    );
  }
}
