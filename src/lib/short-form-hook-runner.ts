import fs from "fs";
import path from "path";
import { spawn } from "child_process";
import { randomUUID } from "crypto";

export interface ShortFormHookRunJob {
  kind: "hooks";
  runId: string;
  projectId: string;
  label: string;
  task: string;
  requestedAt: string;
  requiredArtifacts: string[];
  preferredModels: string[];
  sessionKeyBase: string;
  verificationTimeoutMs: number;
  verificationPollMs: number;
}

const HOME_DIR = process.env.HOME || "/Users/ittaisvidler";
const REPO_ROOT = path.join(HOME_DIR, "tenxsolo", "systems", "agent-dashboard");
const WORKER_PATH = path.join(REPO_ROOT, "scripts", "short-form-hook-worker.mjs");
const DEFAULT_RELIABLE_MODEL =
  process.env.SHORT_FORM_RELIABLE_MODEL || "openai-codex/gpt-5.4";
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

export function getPreferredModelsForHooks() {
  return [DEFAULT_RELIABLE_MODEL, DEFAULT_RETRY_MODEL].filter(Boolean);
}

export function enqueueShortFormHookRun(job: Omit<ShortFormHookRunJob, "kind" | "runId" | "preferredModels" | "verificationTimeoutMs" | "verificationPollMs"> & {
  preferredModels?: string[];
  verificationTimeoutMs?: number;
  verificationPollMs?: number;
}) {
  const runId = randomUUID();
  const fullJob: ShortFormHookRunJob = {
    kind: "hooks",
    runId,
    preferredModels:
      job.preferredModels && job.preferredModels.length > 0
        ? job.preferredModels
        : getPreferredModelsForHooks(),
    verificationTimeoutMs: job.verificationTimeoutMs ?? 10 * 60_000,
    verificationPollMs: job.verificationPollMs ?? 5_000,
    ...job,
  };

  const runDir = getRunDir(job.projectId);
  ensureDir(runDir);

  const jobPath = path.join(runDir, `${runId}.job.json`);
  fs.writeFileSync(jobPath, JSON.stringify(fullJob, null, 2), "utf-8");

  const child = spawn(process.execPath, [WORKER_PATH, jobPath], {
    cwd: REPO_ROOT,
    detached: true,
    stdio: "ignore",
  });
  child.unref();

  return { runId, jobPath };
}
