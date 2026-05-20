import fs from "fs";
import path from "path";
import { spawn, spawnSync } from "child_process";
import { randomUUID } from "crypto";
import type { ShortFormStageKey } from "@/lib/short-form-videos";
import type { ShortFormNanoBananaPromptTemplates, ShortFormStyleReferenceImage } from "@/lib/short-form-image-styles";
import type { ShortFormCaptionAnimationPresetEntry } from "@/lib/short-form-caption-animation";
import type { ShortFormCaptionStyleEntry } from "@/lib/short-form-video-render-settings";
import type { ShortFormVisualGenerationModelId } from "@/lib/short-form-visual-generation";
import type { ShortFormMotionGraphicsSettings } from "@/lib/short-form-motion-graphics";

export interface DirectSceneImagesConfig {
  scriptPath: string;
  outputDir: string;
  sceneManifestPath: string;
  sceneDocPath: string;
  mode: "generate" | "revise";
  notes?: string;
  sceneId?: string;
  imageStyleId: string;
  imageStyleName: string;
  visualGenerationModelId: ShortFormVisualGenerationModelId;
  visualGenerationModelLabel: string;
  visualGenerationModelRef: string;
  imageStyleSubject: string;
  imageStylePrompt: string;
  imageStyleHeaderPercent: number;
  imageStyleReferences?: ShortFormStyleReferenceImage[];
  imagePromptTemplates: ShortFormNanoBananaPromptTemplates;
  motionGraphicsSettings?: ShortFormMotionGraphicsSettings;
  backgroundVideoId?: string;
  backgroundVideoName?: string;
  backgroundVideoPath?: string;
}

export interface DirectVideoConfig {
  scriptPath: string;
  sceneManifestPath: string;
  sceneImagesDir: string;
  finalVideoPath: string;
  videoDocPath: string;
  videoWorkDir: string;
  mode: "generate" | "revise";
  soundDesignDecision?: "approved" | "skipped";
  soundDesignPreviewRelativePath?: string;
  captionStyleId?: string;
  captionStyleName?: string;
  captionStyleSource?: "project" | "default" | "fallback";
  captionStyle?: ShortFormCaptionStyleEntry;
  animationPreset?: ShortFormCaptionAnimationPresetEntry;
  backgroundVideoId?: string;
  backgroundVideoName?: string;
  backgroundVideoPath?: string;
  chromaKeyEnabled?: boolean;
  chromaKeySource?: "project" | "default";
  notes?: string;
}

export interface DirectTextScriptConfig {
  textScriptRunId: string;
  mode: "generate" | "revise";
  writerPromptMode: "generate" | "revise";
  topic: string;
  selectedHookText?: string;
  approvedResearch: string;
  currentScriptContent?: string;
  notes?: string;
  projectDir: string;
  scriptPath: string;
  runDir: string;
  iterationsDir: string;
  runManifestPath: string;
  maxIterations: number;
  overrideMaxIterations?: number;
  passingScore: number;
  generatePromptTemplate: string;
  revisePromptTemplate: string;
  reviewPromptTemplate: string;
  retentionSkillPath: string;
  retentionPlaybookPath: string;
  graderSkillPath: string;
  graderRubricPath: string;
}

export interface ShortFormStageRunJob {
  runId: string;
  projectId: string;
  stage: ShortFormStageKey;
  agentId: "oracle" | "scribe" | "workflow";
  label: string;
  task: string;
  requestedAt: string;
  requiredArtifacts: string[];
  preferredModels: string[];
  sessionKeyBase: string;
  verificationTimeoutMs: number;
  verificationPollMs: number;
  directConfig?:
    | { kind: "text-script"; config: DirectTextScriptConfig }
    | { kind: "scene-images"; config: DirectSceneImagesConfig }
    | { kind: "video"; config: DirectVideoConfig };
}

interface ShortFormStageRunProcess {
  runId: string;
  projectId: string;
  stage: ShortFormStageKey;
  pid?: number;
  processGroupId?: number;
  startedAt: string;
}

const HOME_DIR = process.env.HOME || "/Users/ittaisvidler";
const REPO_ROOT = path.join(HOME_DIR, "tenxsolo", "systems", "agent-dashboard");
const WORKER_PATH = path.join(REPO_ROOT, "scripts", "short-form-stage-worker.mjs");
const DEFAULT_RELIABLE_MODEL =
  process.env.SHORT_FORM_RELIABLE_MODEL || "openai/gpt-5.5";
const DEFAULT_RETRY_MODEL =
  process.env.SHORT_FORM_RETRY_MODEL || "";

function ensureDir(dirPath: string) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function getRunDir(projectId: string) {
  return path.join(
    HOME_DIR,
    "tenxsolo",
    "business",
    "content",
    "deliverables",
    "short-form-videos",
    projectId,
    ".workflow-runs",
  );
}

function readJsonFile<T>(filePath: string): T | undefined {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf-8")) as T;
  } catch {
    return undefined;
  }
}

function writeJsonFile(filePath: string, value: unknown) {
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2), "utf-8");
}

function getRunFilePath(projectId: string, runId: string, suffix: "job" | "status" | "process") {
  return path.join(getRunDir(projectId), `${runId}.${suffix}.json`);
}

function findRunningStageRun(projectId: string, stage: ShortFormStageKey) {
  const runDir = getRunDir(projectId);
  if (!fs.existsSync(runDir)) return undefined;

  const candidates = fs
    .readdirSync(runDir)
    .filter((entry) => entry.endsWith(".status.json"))
    .map((entry) => {
      const fullPath = path.join(runDir, entry);
      let mtimeMs = 0;
      try {
        mtimeMs = fs.statSync(fullPath).mtimeMs;
      } catch {
        mtimeMs = 0;
      }
      return { entry, fullPath, mtimeMs };
    })
    .sort((a, b) => b.mtimeMs - a.mtimeMs);

  for (const candidate of candidates) {
    const status = readJsonFile<{
      runId?: string;
      projectId?: string;
      stage?: ShortFormStageKey;
      status?: string;
    }>(candidate.fullPath);
    if (
      status?.projectId === projectId &&
      status.stage === stage &&
      status.status === "running" &&
      status.runId
    ) {
      return status.runId;
    }
  }

  return undefined;
}

function findWorkerPidForJobPath(jobPath: string) {
  const result = spawnSync("ps", ["-axo", "pid=,command="], {
    encoding: "utf-8",
    maxBuffer: 1024 * 1024,
  });
  if (result.error || result.status !== 0) return undefined;

  const normalizedJobPath = path.resolve(jobPath);
  for (const line of (result.stdout || "").split("\n")) {
    const match = line.match(/^\s*(\d+)\s+(.+)$/);
    if (!match) continue;
    const pid = Number.parseInt(match[1], 10);
    const command = match[2] || "";
    if (
      Number.isFinite(pid) &&
      pid !== process.pid &&
      command.includes(WORKER_PATH) &&
      command.includes(normalizedJobPath)
    ) {
      return pid;
    }
  }

  return undefined;
}

function markStageRunStopped(projectId: string, stage: ShortFormStageKey, runId: string, message: string) {
  const statusPath = getRunFilePath(projectId, runId, "status");
  const existing = readJsonFile<Record<string, unknown>>(statusPath) || {};
  const now = new Date().toISOString();
  writeJsonFile(statusPath, {
    ...existing,
    runId,
    projectId,
    stage,
    status: "failed",
    failedAt: now,
    stoppedAt: now,
    errorMessage: message,
  });
}

function getVerificationSettingsForStage(stage: ShortFormStageKey): { verificationTimeoutMs: number; verificationPollMs: number } {
  switch (stage) {
    case "research":
    case "script":
      return { verificationTimeoutMs: 10 * 60_000, verificationPollMs: 5_000 };
    case "scene-images":
      return { verificationTimeoutMs: 45 * 60_000, verificationPollMs: 15_000 };
    case "sound-design":
      return { verificationTimeoutMs: 15 * 60_000, verificationPollMs: 10_000 };
    case "video":
      return { verificationTimeoutMs: 60 * 60_000, verificationPollMs: 15_000 };
  }
}

export function getPreferredModelsForStage(stage: ShortFormStageKey): string[] {
  switch (stage) {
    case "research":
    case "script":
    case "scene-images":
    case "sound-design":
    case "video":
      return [DEFAULT_RELIABLE_MODEL, DEFAULT_RETRY_MODEL].filter(Boolean);
  }
}

export function enqueueShortFormStageRun(job: Omit<ShortFormStageRunJob, "runId" | "preferredModels" | "verificationTimeoutMs" | "verificationPollMs"> & {
  preferredModels?: string[];
  verificationTimeoutMs?: number;
  verificationPollMs?: number;
}) {
  const runId = randomUUID();
  const verificationSettings = getVerificationSettingsForStage(job.stage);
  const fullJob: ShortFormStageRunJob = {
    ...job,
    runId,
    preferredModels:
      job.preferredModels && job.preferredModels.length > 0
        ? job.preferredModels
        : getPreferredModelsForStage(job.stage),
    verificationTimeoutMs: job.verificationTimeoutMs ?? verificationSettings.verificationTimeoutMs,
    verificationPollMs: job.verificationPollMs ?? verificationSettings.verificationPollMs,
  };

  const runDir = getRunDir(job.projectId);
  ensureDir(runDir);

  const jobPath = path.join(runDir, `${runId}.job.json`);
  fs.writeFileSync(jobPath, JSON.stringify(fullJob, null, 2), "utf-8");

  const child = spawn(process.execPath, [WORKER_PATH, jobPath], {
    cwd: REPO_ROOT,
    env: { ...process.env },
    detached: true,
    stdio: "ignore",
  });
  const processInfo: ShortFormStageRunProcess = {
    runId,
    projectId: fullJob.projectId,
    stage: fullJob.stage,
    pid: child.pid,
    processGroupId: child.pid,
    startedAt: new Date().toISOString(),
  };
  writeJsonFile(getRunFilePath(job.projectId, runId, "process"), processInfo);
  child.unref();

  return { runId, jobPath };
}

export function stopShortFormStageRun(projectId: string, stage: ShortFormStageKey, runId?: string) {
  const targetRunId = runId || findRunningStageRun(projectId, stage);
  if (!targetRunId) {
    return { stopped: false, reason: "No active workflow run was found." };
  }

  const jobPath = getRunFilePath(projectId, targetRunId, "job");
  const processInfo = readJsonFile<ShortFormStageRunProcess>(
    getRunFilePath(projectId, targetRunId, "process"),
  );
  const pid = processInfo?.pid || findWorkerPidForJobPath(jobPath);
  const message = "Stopped by user from the dashboard.";

  if (!pid || !Number.isFinite(pid)) {
    markStageRunStopped(projectId, stage, targetRunId, message);
    return {
      stopped: false,
      runId: targetRunId,
      reason: "The run was marked stopped, but no worker process id was available.",
    };
  }

  try {
    process.kill(-pid, "SIGTERM");
  } catch {
    try {
      process.kill(pid, "SIGTERM");
    } catch {
      markStageRunStopped(projectId, stage, targetRunId, message);
      return {
        stopped: false,
        runId: targetRunId,
        reason: "The run was marked stopped, but the worker process was no longer running.",
      };
    }
  }

  markStageRunStopped(projectId, stage, targetRunId, message);
  return { stopped: true, runId: targetRunId };
}
