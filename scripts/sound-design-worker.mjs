import fs from "fs";
import path from "path";

const jobPath = process.argv[2];
const HOME_DIR = process.env.HOME || "/Users/ittaisvidler";
const OPENCLAW_CONFIG = path.join(HOME_DIR, ".openclaw", "openclaw.json");

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
  if (fs.existsSync(OPENCLAW_CONFIG)) {
    try {
      const config = JSON.parse(fs.readFileSync(OPENCLAW_CONFIG, "utf-8"));
      if (config.gateway?.port) url = `http://127.0.0.1:${config.gateway.port}`;
      if (config.hooks?.token) token = config.hooks.token;
    } catch {}
  }
  return { url, token };
}

async function spawnAuthoringAttempt(job, model, attemptIndex) {
  const { url, token } = getGatewayConfig();
  if (!token) {
    throw new Error("Hooks token not found in config");
  }

  const response = await fetch(`${url}/hooks/agent`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      message: job.prompt,
      agentId: "scribe",
      name: `sound-design-${job.projectId}-attempt-${attemptIndex + 1}`,
      sessionKey: `hook:short-form:${job.projectId}:sound-design:${job.runId}:attempt-${attemptIndex + 1}`,
      wakeMode: "now",
      deliver: false,
      model,
    }),
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

async function waitForFile(filePath, requestedAt, timeoutMs = 10 * 60_000, pollMs = 5000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    if (hasFreshArtifact(filePath, requestedAt)) return true;
    await new Promise((resolve) => setTimeout(resolve, pollMs));
  }
  return hasFreshArtifact(filePath, requestedAt);
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

  const models = Array.isArray(job.preferredModels) && job.preferredModels.length > 0 ? job.preferredModels : ["codex/gpt-5.4"];
  let lastError = null;

  for (const [index, model] of models.entries()) {
    const attempt = {
      index: index + 1,
      model,
      startedAt: new Date().toISOString(),
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
      attempt.error = error instanceof Error ? error.message : String(error);
      attempt.finishedAt = new Date().toISOString();
    }
  }

  writeJson(statusPath, {
    status: "failed",
    runId: job.runId,
    projectId: job.projectId,
    finishedAt: new Date().toISOString(),
    errorMessage: lastError instanceof Error ? lastError.message : String(lastError || "Unknown error"),
    attempts,
  });
  process.exitCode = 1;
}

main().catch((error) => {
  const statusPath = jobPath.replace(/\.job\.json$/, ".status.json");
  writeJson(statusPath, {
    status: "failed",
    errorMessage: error instanceof Error ? error.message : String(error),
    finishedAt: new Date().toISOString(),
  });
  process.exitCode = 1;
});
