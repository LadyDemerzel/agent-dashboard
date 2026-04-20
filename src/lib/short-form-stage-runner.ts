import fs from "fs";
import path from "path";
import { spawn } from "child_process";
import { randomUUID } from "crypto";
import type { ShortFormStageKey } from "@/lib/short-form-videos";
import type { ShortFormNanoBananaPromptTemplates, ShortFormStyleReferenceImage } from "@/lib/short-form-image-styles";
import type { ShortFormCaptionAnimationPresetEntry } from "@/lib/short-form-caption-animation";
import type { ShortFormCaptionStyleEntry } from "@/lib/short-form-video-render-settings";

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
  imageStyleSubject: string;
  imageStylePrompt: string;
  imageStyleHeaderPercent: number;
  imageStyleReferences?: ShortFormStyleReferenceImage[];
  imagePromptTemplates: ShortFormNanoBananaPromptTemplates;
}

export interface DirectVideoConfig {
  scriptPath: string;
  sceneManifestPath: string;
  sceneImagesDir: string;
  finalVideoPath: string;
  videoDocPath: string;
  videoWorkDir: string;
  mode: "generate" | "revise";
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

const HOME_DIR = process.env.HOME || "/Users/ittaisvidler";
const REPO_ROOT = path.join(HOME_DIR, "tenxsolo", "systems", "agent-dashboard");
const WORKER_PATH = path.join(REPO_ROOT, "scripts", "short-form-stage-worker.mjs");
const DEFAULT_RELIABLE_MODEL =
  process.env.SHORT_FORM_RELIABLE_MODEL || "codex/gpt-5.4";
const DEFAULT_RETRY_MODEL =
  process.env.SHORT_FORM_RETRY_MODEL || "openrouter/anthropic/claude-3-haiku";

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

function getVerificationSettingsForStage(stage: ShortFormStageKey) {
  switch (stage) {
    case "research":
    case "script":
      return { verificationTimeoutMs: 10 * 60_000, verificationPollMs: 5_000 };
    case "scene-images":
      return { verificationTimeoutMs: 45 * 60_000, verificationPollMs: 15_000 };
    case "video":
      return { verificationTimeoutMs: 60 * 60_000, verificationPollMs: 15_000 };
  }
}

export function getPreferredModelsForStage(stage: ShortFormStageKey) {
  switch (stage) {
    case "research":
    case "script":
    case "scene-images":
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
  const fullJob: ShortFormStageRunJob = {
    runId,
    preferredModels:
      job.preferredModels && job.preferredModels.length > 0
        ? job.preferredModels
        : getPreferredModelsForStage(job.stage),
    ...getVerificationSettingsForStage(job.stage),
    ...job,
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
  child.unref();

  return { runId, jobPath };
}
