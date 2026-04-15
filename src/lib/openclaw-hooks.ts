import fs from "fs";
import path from "path";

export function getGatewayConfig(): { url: string; token: string } {
  let url = "http://127.0.0.1:18789";
  let token = "";

  const configPath = path.join(
    process.env.HOME || "/Users/ittaisvidler",
    ".openclaw",
    "openclaw.json"
  );

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

export async function spawnAgentViaWebhook(options: {
  agentId: string;
  task: string;
  label: string;
  model?: string;
  sessionKey?: string;
}) {
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
      message: options.task,
      agentId: options.agentId,
      name: options.label,
      sessionKey: options.sessionKey || `hook:${options.agentId}:${options.label}`,
      wakeMode: "now",
      deliver: false,
      model: options.model || process.env.SHORT_FORM_RELIABLE_MODEL || "codex/gpt-5.4",
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Webhook failed: ${response.status} ${errorText}`);
  }

  return response.json();
}
