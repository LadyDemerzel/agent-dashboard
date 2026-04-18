import fs from "fs";
import path from "path";
import { spawn, spawnSync } from "child_process";
import { NextRequest, NextResponse } from "next/server";
import {
  getShortFormMusicLibraryDir,
  getShortFormVideoRenderSettings,
  saveShortFormVideoRenderSettings,
} from "@/lib/short-form-video-render-settings";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const HOME_DIR = process.env.HOME || "/Users/ittaisvidler";
const ACESTEP_REPO = path.join(HOME_DIR, ".openclaw", "tools", "ACE-Step-1.5");
const DEFAULT_ACE_STEP_URL = "http://127.0.0.1:8011";
const DEFAULT_DURATION_SECONDS = 12;
const DEFAULT_TIMEOUT_MS = 45 * 60 * 1000;
const DEFAULT_POLL_MS = 5000;

function normalizeString(value: unknown, fallback = "") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function normalizeDuration(value: unknown, fallback = DEFAULT_DURATION_SECONDS) {
  const parsed = typeof value === "number" ? value : typeof value === "string" ? Number(value) : Number.NaN;
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(30, Math.max(6, Math.round(parsed)));
}

function buildAudioUrl(relativePath: string) {
  return `/api/short-form-videos/settings/music-library-files/${relativePath
    .split("/")
    .filter(Boolean)
    .map((part) => encodeURIComponent(part))
    .join("/")}?v=${Date.now()}`;
}

function sanitizePathSegment(value: string) {
  return value.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "") || "soundtrack";
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

async function generateReusableMusicFile(options: {
  prompt: string;
  durationSeconds: number;
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
      runFfmpeg(["-i", downloadPath, "-ar", "48000", "-ac", "2", options.outputPath]);
      fs.rmSync(downloadPath, { force: true });
      return;
    }
  }

  throw new Error(`ACE-Step task timed out after ${Math.round(DEFAULT_TIMEOUT_MS / 1000)} seconds`);
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const trackId = normalizeString(body?.trackId);
  const force = body?.force === true;

  if (!trackId) {
    return NextResponse.json({ success: false, error: "trackId is required" }, { status: 400 });
  }

  const settings = getShortFormVideoRenderSettings();
  const track = settings.musicTracks.find((candidate) => candidate.id === trackId);
  if (!track) {
    return NextResponse.json({ success: false, error: "Saved soundtrack preset not found" }, { status: 404 });
  }

  const durationSeconds = normalizeDuration(track.previewDurationSeconds, DEFAULT_DURATION_SECONDS);
  const canonicalRelativePath = track.generatedAudioRelativePath || `${sanitizePathSegment(track.id)}/soundtrack.wav`;
  const absolutePath = path.resolve(getShortFormMusicLibraryDir(), canonicalRelativePath);
  const workDir = path.dirname(absolutePath);
  const metaPath = path.join(workDir, "meta.json");
  fs.mkdirSync(workDir, { recursive: true });

  const canReuseExisting = Boolean(
    !force
    && track.generatedAudioRelativePath === canonicalRelativePath
    && track.generatedPrompt === track.prompt
    && track.generatedDurationSeconds === durationSeconds
    && fs.existsSync(absolutePath)
    && fs.statSync(absolutePath).isFile()
  );

  try {
    if (!canReuseExisting) {
      await generateReusableMusicFile({
        prompt: track.prompt,
        durationSeconds,
        outputPath: absolutePath,
        workDir,
        baseUrl: DEFAULT_ACE_STEP_URL,
      });
    }

    const generatedAt = canReuseExisting ? (track.generatedAt || new Date().toISOString()) : new Date().toISOString();
    fs.writeFileSync(
      metaPath,
      JSON.stringify(
        {
          trackId: track.id,
          trackName: track.name,
          generatedAt,
          generatedDurationSeconds: durationSeconds,
          generatedPrompt: track.prompt,
          audioRelativePath: canonicalRelativePath,
          reusedExisting: canReuseExisting,
        },
        null,
        2
      ),
      "utf-8"
    );

    const nextSettings = saveShortFormVideoRenderSettings({
      ...settings,
      musicTracks: settings.musicTracks.map((candidate) =>
        candidate.id === track.id
          ? {
              ...candidate,
              generatedAudioRelativePath: canonicalRelativePath,
              generatedDurationSeconds: durationSeconds,
              generatedPrompt: track.prompt,
              generatedAt,
            }
          : candidate
      ),
    });
    const savedTrack = nextSettings.musicTracks.find((candidate) => candidate.id === track.id);
    if (!savedTrack?.generatedAudioRelativePath) {
      throw new Error("Generated soundtrack metadata did not persist correctly");
    }

    return NextResponse.json({
      success: true,
      data: {
        track: savedTrack,
        videoRender: nextSettings,
        reusedExisting: canReuseExisting,
        audioUrl: buildAudioUrl(savedTrack.generatedAudioRelativePath),
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to generate reusable soundtrack file",
      },
      { status: 500 }
    );
  }
}
