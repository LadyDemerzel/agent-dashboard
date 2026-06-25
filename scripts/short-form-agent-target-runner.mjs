import { spawnSync } from "child_process";

export const CLAUDE_CODE_TARGET_ID = "claude-code";
export const DEFAULT_CLAUDE_CODE_MODEL = "opus-4.8";
export const DEFAULT_CLAUDE_CODE_EFFORT = "xhigh";

export function normalizeAgentTargetId(value, fallback) {
  return value === "openclaw-scribe" || value === "openclaw-oracle" || value === CLAUDE_CODE_TARGET_ID
    ? value
    : fallback;
}

export function openClawAgentIdForTarget(target, fallbackAgentId) {
  if (target === "openclaw-oracle") return "oracle";
  if (target === "openclaw-scribe") return "scribe";
  return fallbackAgentId;
}

function formatClaudeAuthHelp(errorText) {
  return [
    "Claude Code authentication failed on the Mac mini.",
    "",
    "To re-authenticate from another device:",
    "1. SSH into the Mac mini from your MacBook Pro, or open an existing remote terminal to it.",
    "2. Run `claude auth login` in the terminal on the Mac mini. If you use a subscription token flow instead, run `claude setup-token`.",
    "3. When Claude prints a browser URL or device code, open that URL on your phone or MacBook Pro, approve the login, then paste any code back into the Mac mini terminal.",
    "4. Re-run `claude -p --model opus-4.8 --effort xhigh --permission-mode bypassPermissions --dangerously-skip-permissions \"hello\"` on the Mac mini to confirm the CLI is authenticated.",
    "",
    errorText ? `Claude CLI output: ${errorText}` : "",
  ].filter(Boolean).join("\n");
}

function looksLikeClaudeAuthError(text) {
  return /auth|oauth|login|log in|api key|apikey|subscription|token|credential|unauthorized|forbidden|not authenticated/i.test(text || "");
}

export function runClaudeCodePrompt({
  prompt,
  cwd,
  timeoutMs = 60 * 60_000,
  model = DEFAULT_CLAUDE_CODE_MODEL,
  effort = DEFAULT_CLAUDE_CODE_EFFORT,
}) {
  const args = [
    "-p",
    "--model",
    model,
    "--effort",
    effort,
    "--permission-mode",
    "bypassPermissions",
    "--dangerously-skip-permissions",
    "--output-format",
    "json",
  ];
  const result = spawnSync("claude", args, {
    cwd,
    env: { ...process.env },
    input: prompt,
    encoding: "utf-8",
    timeout: timeoutMs,
    maxBuffer: 50 * 1024 * 1024,
  });

  const stdout = result.stdout || "";
  const stderr = result.stderr || "";
  const combined = [stdout.trim(), stderr.trim()].filter(Boolean).join("\n\n");

  if (result.error) {
    const message = result.error.message || String(result.error);
    throw new Error(looksLikeClaudeAuthError(message) ? formatClaudeAuthHelp(message) : message);
  }

  if (result.status !== 0) {
    const message = combined || `Claude Code exited with status ${result.status ?? "unknown"}`;
    throw new Error(looksLikeClaudeAuthError(message) ? formatClaudeAuthHelp(message) : message);
  }

  let parsed;
  try {
    parsed = stdout.trim() ? JSON.parse(stdout) : undefined;
  } catch {
    parsed = undefined;
  }

  return {
    provider: "claude-code",
    model,
    effort,
    status: result.status,
    stdout: stdout.trim(),
    stderr: stderr.trim(),
    result: parsed,
  };
}

export async function runOpenClawAgentPrompt({
  url,
  token,
  timeoutMs,
  message,
  agentId,
  name,
  sessionKey,
  model,
}) {
  if (!token) {
    throw new Error("Hooks token not found in config");
  }

  const response = await fetch(`${url}/hooks/agent`, {
    method: "POST",
    signal: AbortSignal.timeout(timeoutMs),
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      message,
      agentId,
      name,
      sessionKey,
      wakeMode: "now",
      deliver: false,
      model,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Webhook failed: ${response.status} ${errorText}`);
  }

  const result = await response.json();
  const status = typeof result?.status === "string" ? result.status.toLowerCase() : "";
  if (result?.ok === false || status === "error" || result?.error || result?.errorMessage) {
    const summary = result?.summary || result?.errorMessage || result?.error || JSON.stringify(result);
    throw new Error(`Agent run failed: ${summary}`);
  }

  return { provider: "openclaw", agentId, model, ...result };
}

