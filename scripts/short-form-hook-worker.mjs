#!/usr/bin/env node

import fs from "fs";
import path from "path";

const jobPath = process.argv[2];

if (!jobPath) {
  process.exit(1);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf-8"));
}

function writeJson(filePath, value) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2), "utf-8");
}

function getGatewayConfig() {
  let url = "http://127.0.0.1:18789";
  let token = "";

  const homeDir = process.env.HOME || "/Users/ittaisvidler";
  const configPath = path.join(homeDir, ".openclaw", "openclaw.json");

  if (fs.existsSync(configPath)) {
    try {
      const config = JSON.parse(fs.readFileSync(configPath, "utf-8"));
      if (config.gateway?.port) url = `http://127.0.0.1:${config.gateway.port}`;
      if (config.hooks?.token) token = config.hooks.token;
    } catch {
      // ignore malformed local config
    }
  }

  return { url, token };
}

function hasFreshArtifact(filePath, requestedAtMs) {
  if (!fs.existsSync(filePath)) return false;

  try {
    return fs.statSync(filePath).mtimeMs > requestedAtMs + 1000;
  } catch {
    return false;
  }
}

async function waitForArtifacts(requiredArtifacts, requestedAtMs, timeoutMs, pollMs) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    const allPresent = requiredArtifacts.every((filePath) => hasFreshArtifact(filePath, requestedAtMs));
    if (allPresent) {
      return true;
    }

    await sleep(pollMs);
  }

  return requiredArtifacts.every((filePath) => hasFreshArtifact(filePath, requestedAtMs));
}

async function spawnAttempt(job, model, attemptIndex) {
  const { url, token } = getGatewayConfig();
  if (!token) {
    throw new Error("Hooks token not found in config");
  }

  const isRetry = attemptIndex > 0;
  const retryNotice = isRetry
    ? [
        "RETRY NOTICE — THE PREVIOUS HOOK GENERATION RUN DID NOT PRODUCE hooks.json.",
        "Start fresh from the task below. Do not summarize only in chat.",
        "You must write/update the exact hooks.json file path and verify it before finishing.",
      ].join("\n\n")
    : "";

  const response = await fetch(`${url}/hooks/agent`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      message: isRetry ? `${retryNotice}\n\n${job.task}` : job.task,
      agentId: "scribe",
      name: `${job.label}-attempt-${attemptIndex + 1}`,
      sessionKey: `${job.sessionKeyBase}:${job.runId}:attempt-${attemptIndex + 1}`,
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

async function main() {
  const job = readJson(jobPath);
  const statusPath = jobPath.replace(/\.job\.json$/, ".status.json");
  const requestedAtMs = Date.parse(job.requestedAt || new Date().toISOString());
  const attempts = [];

  writeJson(statusPath, {
    kind: "hooks",
    status: "running",
    runId: job.runId,
    projectId: job.projectId,
    startedAt: new Date().toISOString(),
    attempts,
  });

  const models = Array.isArray(job.preferredModels) && job.preferredModels.length > 0
    ? job.preferredModels
    : ["codex/gpt-5.4", "openrouter/anthropic/claude-3-haiku"];

  for (let index = 0; index < models.length; index += 1) {
    const model = models[index];
    const attempt = {
      index: index + 1,
      model,
      startedAt: new Date().toISOString(),
    };
    attempts.push(attempt);
    writeJson(statusPath, {
      kind: "hooks",
      status: "running",
      runId: job.runId,
      projectId: job.projectId,
      startedAt: new Date().toISOString(),
      attempts,
    });

    try {
      const spawnResult = await spawnAttempt(job, model, index);
      attempt.spawnResult = spawnResult;
      const verified = await waitForArtifacts(
        job.requiredArtifacts,
        requestedAtMs,
        typeof job.verificationTimeoutMs === "number" ? job.verificationTimeoutMs : 120000,
        typeof job.verificationPollMs === "number" ? job.verificationPollMs : 5000,
      );
      attempt.verified = verified;
      attempt.finishedAt = new Date().toISOString();

      if (verified) {
        writeJson(statusPath, {
          kind: "hooks",
          status: "verified",
          runId: job.runId,
          projectId: job.projectId,
          startedAt: new Date().toISOString(),
          verifiedAt: new Date().toISOString(),
          attempts,
        });
        return;
      }
    } catch (error) {
      attempt.error = error instanceof Error ? error.message : String(error);
      attempt.finishedAt = new Date().toISOString();
    }
  }

  writeJson(statusPath, {
    kind: "hooks",
    status: "failed",
    runId: job.runId,
    projectId: job.projectId,
    startedAt: new Date().toISOString(),
    failedAt: new Date().toISOString(),
    attempts,
  });
}

main().catch(() => process.exit(1));
