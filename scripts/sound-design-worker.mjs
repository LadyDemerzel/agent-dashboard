import fs from "fs";
import path from "path";
import {
  CLAUDE_CODE_TARGET_ID,
  normalizeAgentTargetId,
  openClawAgentIdForTarget,
  runClaudeCodePrompt,
  runOpenClawAgentPrompt,
} from "./short-form-agent-target-runner.mjs";

const isDirectRun = Boolean(process.argv[1]) && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname);
const jobPath = isDirectRun ? process.argv[2] : null;
if (isDirectRun && !jobPath) process.exit(1);
const HOME_DIR = process.env.HOME || "/Users/ittaisvidler";
const HOOK_WEBHOOK_TIMEOUT_MS = 30_000;
const AGENT_DASHBOARD_ROOT = path.join(HOME_DIR, "tenxsolo", "systems", "agent-dashboard");
const OPENCLAW_CONFIG_CANDIDATES = [
  path.join(HOME_DIR, ".openclaw", "openclaw.json"),
  "/Users/ittaisvidler/.openclaw/openclaw.json",
];

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf-8"));
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2), "utf-8");
}

function stripFrontMatter(content) {
  const match = content.match(/^---\s*\n[\s\S]*?\n---\s*\n?([\s\S]*)$/);
  return (match ? match[1] : content).trim();
}

function getGatewayConfig() {
  let url = "http://127.0.0.1:18789";
  let token = "";
  const configPath = OPENCLAW_CONFIG_CANDIDATES.find((candidate) => fs.existsSync(candidate));
  if (configPath) {
    try {
      const config = JSON.parse(fs.readFileSync(configPath, "utf-8"));
      if (config.gateway?.port) url = `http://127.0.0.1:${config.gateway.port}`;
      if (config.hooks?.token) token = config.hooks.token;
    } catch {}
  }
  return { url, token };
}

function byteLength(value) {
  return Buffer.byteLength(value, "utf-8");
}

function describeError(error) {
  if (!(error instanceof Error)) return String(error);
  const details = [error.message || error.name];
  const cause = error.cause;
  if (cause && typeof cause === "object") {
    const causeParts = [];
    if ("code" in cause && cause.code) causeParts.push(`code=${cause.code}`);
    if ("errno" in cause && cause.errno) causeParts.push(`errno=${cause.errno}`);
    if ("syscall" in cause && cause.syscall) causeParts.push(`syscall=${cause.syscall}`);
    if ("message" in cause && cause.message) causeParts.push(`message=${cause.message}`);
    if (causeParts.length > 0) details.push(`cause: ${causeParts.join(" ")}`);
  }
  return details.join("; ");
}

async function spawnAuthoringAttempt(job, model, attemptIndex) {
  const agentTarget = normalizeAgentTargetId(job.agentTarget, "openclaw-scribe");
  if (agentTarget === CLAUDE_CODE_TARGET_ID) {
    return runClaudeCodePrompt({
      prompt: job.prompt,
      cwd: AGENT_DASHBOARD_ROOT,
    });
  }

  const { url, token } = getGatewayConfig();
  return runOpenClawAgentPrompt({
    url,
    token,
    timeoutMs: HOOK_WEBHOOK_TIMEOUT_MS,
    message: job.prompt,
    agentId: openClawAgentIdForTarget(agentTarget, "scribe"),
    name: `sound-design-${job.projectId}-attempt-${attemptIndex + 1}`,
    sessionKey: `hook:short-form:${job.projectId}:sound-design:${job.runId}:attempt-${attemptIndex + 1}`,
    model,
  });
}

function readSoundDesignArtifactBody(filePath) {
  if (!fs.existsSync(filePath)) return "";
  try {
    return stripFrontMatter(fs.readFileSync(filePath, "utf-8")).replace(/\r\n/g, "\n").trim();
  } catch {
    return "";
  }
}

function snapshotSoundDesignAuthoringArtifact(filePath) {
  if (!fs.existsSync(filePath)) return { body: "", exists: false, mtimeMs: undefined };
  try {
    return {
      body: readSoundDesignArtifactBody(filePath),
      exists: true,
      mtimeMs: fs.statSync(filePath).mtimeMs,
    };
  } catch {
    return { body: "", exists: fs.existsSync(filePath), mtimeMs: undefined };
  }
}

function isPlaceholderSoundDesignBody(body) {
  return !body ||
    body.includes("Waiting for the dashboard workflow to plan tasteful sound design") ||
    !/<sound_design\b/i.test(body);
}

function hasFreshSoundDesignAuthoringArtifact(filePath, previousArtifact, authoringStartedAtMs) {
  if (!fs.existsSync(filePath)) return false;
  try {
    const stat = fs.statSync(filePath);
    if (stat.mtimeMs + 1000 < authoringStartedAtMs) return false;
    const body = readSoundDesignArtifactBody(filePath);
    const previousBody = previousArtifact?.body || "";
    return !isPlaceholderSoundDesignBody(body) && body !== previousBody;
  } catch {
    return false;
  }
}

function getFileSignature(filePath) {
  if (!fs.existsSync(filePath)) return null;
  const stat = fs.statSync(filePath);
  return {
    size: stat.size,
    mtimeMs: Math.round(stat.mtimeMs),
  };
}

function countSoundDesignEffects(filePath) {
  if (!fs.existsSync(filePath)) return 0;
  const content = fs.readFileSync(filePath, "utf-8");
  return (content.match(/<effect\b[^>]*\/>/g) || []).length
    + (content.match(/<event\b[^>]*\/>/g) || []).length;
}

function setMarkdownStatus(filePath, status) {
  if (!fs.existsSync(filePath)) return;
  const content = fs.readFileSync(filePath, "utf-8");
  const match = content.match(/^---\s*\n([\s\S]*?)\n---\s*\n?/);
  if (!match) return;
  const frontMatter = match[1].match(/^status:\s*/m)
    ? match[1].replace(/^status:\s*.*$/m, `status: ${status}`)
    : `${match[1]}\nstatus: ${status}`;
  fs.writeFileSync(filePath, `---\n${frontMatter}\n---\n${content.slice(match[0].length)}`, "utf-8");
}

async function waitForSoundDesignAuthoringArtifact(filePath, previousArtifact, authoringStartedAtMs, timeoutMs = 10 * 60_000, pollMs = 5000) {
  const startedAt = Date.now();
  let stableSince = 0;
  let lastSignature = null;
  const stableMs = 45_000;

  while (Date.now() - startedAt < timeoutMs) {
    if (hasFreshSoundDesignAuthoringArtifact(filePath, previousArtifact, authoringStartedAtMs)) {
      const signature = getFileSignature(filePath);
      const changed =
        !signature ||
        !lastSignature ||
        signature.size !== lastSignature.size ||
        signature.mtimeMs !== lastSignature.mtimeMs;
      if (changed) {
        lastSignature = signature;
        stableSince = Date.now();
      } else if (stableSince && Date.now() - stableSince >= stableMs) {
        return true;
      }
    } else {
      stableSince = 0;
      lastSignature = null;
    }
    await new Promise((resolve) => setTimeout(resolve, pollMs));
  }
  return Boolean(
    hasFreshSoundDesignAuthoringArtifact(filePath, previousArtifact, authoringStartedAtMs) &&
    lastSignature &&
    Date.now() - stableSince >= stableMs
  );
}

async function main() {
  const job = readJson(jobPath);
  const statusPath = jobPath.replace(/\.job\.json$/, ".status.json");
  const attempts = [];
  writeJson(statusPath, {
    status: "running",
    runId: job.runId,
    projectId: job.projectId,
    startedAt: new Date().toISOString(),
    attempts,
  });

  const models = Array.isArray(job.preferredModels) && job.preferredModels.length > 0 ? job.preferredModels : ["openai/gpt-5.5"];
  const agentTarget = normalizeAgentTargetId(job.agentTarget, "openclaw-scribe");
  const attemptModels = agentTarget === CLAUDE_CODE_TARGET_ID ? ["opus-4.8/xhigh"] : models;
  let lastError = null;

  for (const [index, model] of attemptModels.entries()) {
    const attempt = {
      index: index + 1,
      agentTarget,
      model,
      startedAt: new Date().toISOString(),
      promptLength: typeof job.prompt === "string" ? job.prompt.length : 0,
      promptBytes: typeof job.prompt === "string" ? byteLength(job.prompt) : 0,
    };
    attempts.push(attempt);
    writeJson(statusPath, {
      status: "running",
      runId: job.runId,
      projectId: job.projectId,
      startedAt: attempt.startedAt,
      attempts,
    });

    try {
      const previousSoundDesignArtifact = snapshotSoundDesignAuthoringArtifact(job.soundDesignPath);
      const authoringStartedAtMs = Date.now();
      attempt.spawnResult = await spawnAuthoringAttempt(job, model, index);
      attempt.waitingForArtifact = true;
      writeJson(statusPath, {
        status: "running",
        runId: job.runId,
        projectId: job.projectId,
        startedAt: attempt.startedAt,
        attempts,
      });
      const ok = await waitForSoundDesignAuthoringArtifact(
        job.soundDesignPath,
        previousSoundDesignArtifact,
        authoringStartedAtMs,
        12 * 60_000,
        5000,
      );
      attempt.finishedAt = new Date().toISOString();
      attempt.verified = ok;
      if (!ok) {
        throw new Error("Scribe run completed without writing a body-different sound-design.md artifact. Identical-body rewrites are rejected; Scribe must make a meaningful Plan Sound Design revision or fail with a clear reason.");
      }
      const minEffectCount = Number.isFinite(Number(job.minEffectCount)) ? Number(job.minEffectCount) : 0;
      if (minEffectCount > 0) {
        const effectCount = countSoundDesignEffects(job.soundDesignPath);
        if (effectCount < minEffectCount) {
          setMarkdownStatus(job.soundDesignPath, "draft");
          throw new Error(`Scribe updated the sound-design XML, but it only contains ${effectCount} effect cue${effectCount === 1 ? "" : "s"}; expected at least ${minEffectCount}.`);
        }
      }
      writeJson(statusPath, {
        status: "completed",
        runId: job.runId,
        projectId: job.projectId,
        finishedAt: attempt.finishedAt,
        attempts,
      });
      return;
    } catch (error) {
      lastError = error;
      attempt.error = describeError(error);
      attempt.finishedAt = new Date().toISOString();
    }
  }

  writeJson(statusPath, {
    status: "failed",
    runId: job.runId,
    projectId: job.projectId,
    finishedAt: new Date().toISOString(),
    errorMessage: describeError(lastError || "Unknown error"),
    attempts,
  });
  process.exitCode = 1;
}

if (isDirectRun) {
  main().catch((error) => {
    const statusPath = jobPath.replace(/\.job\.json$/, ".status.json");
    writeJson(statusPath, {
      status: "failed",
      errorMessage: describeError(error),
      finishedAt: new Date().toISOString(),
    });
    process.exitCode = 1;
  });
}

export {
  hasFreshSoundDesignAuthoringArtifact,
  readSoundDesignArtifactBody,
  snapshotSoundDesignAuthoringArtifact,
};
