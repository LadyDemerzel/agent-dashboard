import fs from "fs";
import path from "path";
import { spawn, spawnSync } from "child_process";
import { NextRequest, NextResponse } from "next/server";
import {
  getShortFormMusicTestsDir,
  getShortFormVideoRenderSettings,
  resolveShortFormMusicSelection,
} from "@/lib/short-form-video-render-settings";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const HOME_DIR = process.env.HOME || "/Users/ittaisvidler";
const ACESTEP_REPO = path.join(HOME_DIR, ".openclaw", "tools", "ACE-Step-1.5");
const DEFAULT_ACE_STEP_URL = "http://127.0.0.1:8011";
const DEFAULT_DURATION_SECONDS = 12;
const DEFAULT_MUSIC_VOLUME = 0.38;
const DEFAULT_TIMEOUT_MS = 45 * 60 * 1000;
const DEFAULT_POLL_MS = 5000;

function normalizeString(value: unknown, fallback = "") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function clampVolume(value: unknown, fallback = DEFAULT_MUSIC_VOLUME) {
  const parsed = typeof value === "number" ? value : typeof value === "string" ? Number(value) : Number.NaN;
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(1, Math.max(0, parsed));
}

function normalizeDuration(value: unknown, fallback = DEFAULT_DURATION_SECONDS) {
  const parsed = typeof value === "number" ? value : typeof value === "string" ? Number(value) : Number.NaN;
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(30, Math.max(6, Math.round(parsed)));
}

async function httpJson(method: string, url: string, payload?: unknown) {
  const response = await fetch(url, {
    method,
    headers: payload ? { "Content-Type": "application/json" } : undefined,
    body: payload ? JSON.stringify(payload) : undefined,
  });
  const text = await response.text();
  const json = text ? JSON.parse(text) : {};
  if (!response.ok) {
    throw new Error(typeof json?.message === "string" ? json.message : `HTTP ${response.status}`);
  }
  return json;
}

async function aceStepHealth(baseUrl: string) {
  try {
    return await httpJson("GET", new URL("health", `${baseUrl.replace(/\/$/, "")}/`).toString());
  } catch {
    return null;
  }
}

async function ensureAceStepServer(baseUrl: string, workDir: string) {
  const ready = await aceStepHealth(baseUrl);
  if (ready?.code === 200) return;

  if (!fs.existsSync(ACESTEP_REPO)) {
    throw new Error(`ACE-Step repo not found at ${ACESTEP_REPO}`);
  }

  fs.mkdirSync(workDir, { recursive: true });
  const logPath = path.join(workDir, "ace-step-server.log");
  const url = new URL(baseUrl);
  const host = url.hostname || "127.0.0.1";
  const port = url.port || "8011";
  const logFd = fs.openSync(logPath, "a");
  const child = spawn(
    "bash",
    [
      "-lc",
      `cd ${JSON.stringify(ACESTEP_REPO)} && ACESTEP_API_HOST=${JSON.stringify(host)} ACESTEP_API_PORT=${JSON.stringify(port)} uv run acestep-api --host ${JSON.stringify(host)} --port ${JSON.stringify(port)}`,
    ],
    {
      detached: true,
      stdio: ["ignore", logFd, logFd],
    }
  );
  child.unref();
  fs.closeSync(logFd);

  const deadline = Date.now() + 90_000;
  while (Date.now() < deadline) {
    const health = await aceStepHealth(baseUrl);
    if (health?.code === 200) return;
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }
  throw new Error(`ACE-Step API did not become ready at ${baseUrl}`);
}

async function downloadFile(url: string, destPath: string) {
  const response = await fetch(url);
  if (!response.ok || !response.body) {
    throw new Error(`Failed to download generated music from ${url}`);
  }
  const buffer = Buffer.from(await response.arrayBuffer());
  fs.writeFileSync(destPath, buffer);
}

function runFfmpeg(args: string[]) {
  const result = spawnSync("ffmpeg", ["-y", ...args], { encoding: "utf-8" });
  if (result.status !== 0) {
    throw new Error(result.stderr?.trim() || result.stdout?.trim() || "ffmpeg failed");
  }
}

async function generateMusicPreview(options: {
  prompt: string;
  durationSeconds: number;
  musicVolume: number;
  outputPath: string;
  workDir: string;
  baseUrl: string;
}) {
  await ensureAceStepServer(options.baseUrl, options.workDir);

  const release = await httpJson("POST", new URL("release_task", `${options.baseUrl.replace(/\/$/, "")}/`).toString(), {
    prompt: options.prompt,
    lyrics: "[Instrumental]",
    instrumental: true,
    vocal_language: "en",
    audio_duration: Math.max(10, options.durationSeconds),
    inference_steps: 8,
    thinking: false,
    batch_size: 1,
    audio_format: "wav",
    use_random_seed: true,
  });

  const taskId = release?.data?.task_id;
  if (!taskId) {
    throw new Error(`ACE-Step release_task failed: ${JSON.stringify(release)}`);
  }

  const deadline = Date.now() + DEFAULT_TIMEOUT_MS;
  while (Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, DEFAULT_POLL_MS));
    const status = await httpJson("POST", new URL("query_result", `${options.baseUrl.replace(/\/$/, "")}/`).toString(), {
      task_id_list: [taskId],
    });
    const item = Array.isArray(status?.data) ? status.data[0] : null;
    if (!item) continue;
    if (item.status === 0) continue;
    if (item.status === 2) {
      throw new Error(`ACE-Step task failed: ${JSON.stringify(item)}`);
    }
    if (item.status === 1) {
      const parsed = typeof item.result === "string" ? JSON.parse(item.result) : item.result;
      const relFile = parsed?.[0]?.file;
      if (!relFile) {
        throw new Error(`ACE-Step result missing file path: ${JSON.stringify(item)}`);
      }
      const downloadUrl = new URL(String(relFile).replace(/^\//, ""), `${options.baseUrl.replace(/\/$/, "")}/`).toString();
      const downloadPath = `${options.outputPath}.download.wav`;
      await downloadFile(downloadUrl, downloadPath);
      runFfmpeg(["-i", downloadPath, "-ar", "48000", "-ac", "2", "-af", `volume=${options.musicVolume.toFixed(3)}`, options.outputPath]);
      fs.rmSync(downloadPath, { force: true });
      return;
    }
  }

  throw new Error(`ACE-Step task timed out after ${Math.round(DEFAULT_TIMEOUT_MS / 1000)} seconds`);
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const savedSettings = getShortFormVideoRenderSettings();
  const savedSelection = resolveShortFormMusicSelection(typeof body?.trackId === "string" ? body.trackId.trim() : undefined);

  const trackName = normalizeString(body?.track?.name, savedSelection.music?.name || "Music preview");
  const prompt = normalizeString(body?.track?.prompt, savedSelection.music?.prompt || "");
  const durationSeconds = normalizeDuration(body?.durationSeconds, savedSelection.music?.previewDurationSeconds || DEFAULT_DURATION_SECONDS);
  const musicVolume = clampVolume(body?.musicVolume, savedSettings.musicVolume);

  if (!trackName || !prompt) {
    return NextResponse.json({ success: false, error: "track name and prompt are required" }, { status: 400 });
  }

  const runId = `music-preview-${Date.now()}`;
  const runDir = path.join(getShortFormMusicTestsDir(), runId);
  fs.mkdirSync(runDir, { recursive: true });

  const outputPath = path.join(runDir, "preview.wav");
  const metaPath = path.join(runDir, "meta.json");

  try {
    await generateMusicPreview({
      prompt,
      durationSeconds,
      musicVolume,
      outputPath,
      workDir: runDir,
      baseUrl: DEFAULT_ACE_STEP_URL,
    });

    fs.writeFileSync(
      metaPath,
      JSON.stringify(
        {
          runId,
          createdAt: new Date().toISOString(),
          track: { name: trackName, prompt },
          durationSeconds,
          musicVolume,
        },
        null,
        2
      ),
      "utf-8"
    );

    return NextResponse.json({
      success: true,
      data: {
        runId,
        audioRelativePath: `${runId}/preview.wav`,
        audioUrl: `/api/short-form-videos/settings/music-tests/${runId}/preview.wav?v=${Date.now()}`,
        durationSeconds,
        musicVolume,
        track: {
          name: trackName,
          prompt,
        },
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to generate music preview",
      },
      { status: 500 }
    );
  }
}
