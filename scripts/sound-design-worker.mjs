import fs from "fs";
import path from "path";

const jobPath = process.argv[2];
const HOME_DIR = process.env.HOME || "/Users/ittaisvidler";
const HOOK_WEBHOOK_TIMEOUT_MS = 30_000;
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
  const { url, token } = getGatewayConfig();
  if (!token) {
    throw new Error("Hooks token not found in config");
  }
  const body = JSON.stringify({
    message: job.prompt,
    agentId: "scribe",
    name: `sound-design-${job.projectId}-attempt-${attemptIndex + 1}`,
    sessionKey: `hook:short-form:${job.projectId}:sound-design:${job.runId}:attempt-${attemptIndex + 1}`,
    wakeMode: "now",
    deliver: false,
    model,
  });

  const response = await fetch(`${url}/hooks/agent`, {
    method: "POST",
    signal: AbortSignal.timeout(HOOK_WEBHOOK_TIMEOUT_MS),
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Webhook failed: ${response.status} ${errorText}`);
  }

  return response.json();
}

function hasFreshArtifact(filePath, requestedAt) {
  if (!fs.existsSync(filePath)) return false;
  const requestedAtMs = Date.parse(requestedAt || new Date().toISOString());
  try {
    return fs.statSync(filePath).mtimeMs > requestedAtMs + 1000;
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

async function waitForFile(filePath, requestedAt, timeoutMs = 10 * 60_000, pollMs = 5000) {
  const startedAt = Date.now();
  let stableSince = 0;
  let lastSignature = null;
  const stableMs = 45_000;

  while (Date.now() - startedAt < timeoutMs) {
    if (hasFreshArtifact(filePath, requestedAt)) {
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
  return Boolean(hasFreshArtifact(filePath, requestedAt) && lastSignature && Date.now() - stableSince >= stableMs);
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

  const models = Array.isArray(job.preferredModels) && job.preferredModels.length > 0 ? job.preferredModels : ["openai-codex/gpt-5.5"];
  let lastError = null;

  for (const [index, model] of models.entries()) {
    const attempt = {
      index: index + 1,
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
      attempt.spawnResult = await spawnAuthoringAttempt(job, model, index);
      attempt.waitingForArtifact = true;
      const ok = await waitForFile(job.soundDesignPath, job.requestedAt, 12 * 60_000, 5000);
      attempt.finishedAt = new Date().toISOString();
      attempt.verified = ok;
      if (!ok) {
        throw new Error("Scribe run completed, but the sound-design XML artifact was not updated on disk.");
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

main().catch((error) => {
  const statusPath = jobPath.replace(/\.job\.json$/, ".status.json");
  writeJson(statusPath, {
    status: "failed",
    errorMessage: describeError(error),
    finishedAt: new Date().toISOString(),
  });
  process.exitCode = 1;
});
