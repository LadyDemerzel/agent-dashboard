import fs from "fs";
import path from "path";

const HOME = process.env.HOME || "/Users/ittaisvidler";

const AGENT_WORKSPACE_PATHS: Record<string, string> = {
  echo: path.join(HOME, ".openclaw", "workspace-echo"),
  ralph: path.join(HOME, ".openclaw", "workspace-ralph"),
  scribe: path.join(HOME, ".openclaw", "workspace-scribe"),
  oracle: path.join(HOME, ".openclaw", "workspace-oracle"),
  clerk: path.join(HOME, ".openclaw", "workspace-clerk"),
  demerzel: path.join(HOME, ".openclaw", "workspace"),
};

export interface AgentFiles {
  soul: string;
  agents: string;
  user: string;
  tools: string;
  bootstrap: string;
  heartbeat: string;
  identity: string;
  memory: string;
}

const VALID_AGENTS = ["echo", "ralph", "scribe", "oracle", "clerk", "demerzel"];

export function isValidAgent(agentId: string): boolean {
  return VALID_AGENTS.includes(agentId);
}

export function getAgentFiles(agentId: string): AgentFiles | null {
  if (!isValidAgent(agentId)) return null;

  const agentDir = AGENT_WORKSPACE_PATHS[agentId];
  if (!agentDir || !fs.existsSync(agentDir)) return null;

  const readFile = (name: string) => {
    const filePath = path.join(agentDir, name);
    if (!fs.existsSync(filePath)) return "";
    return fs.readFileSync(filePath, "utf-8");
  };

  return {
    soul: readFile("SOUL.md"),
    agents: readFile("AGENTS.md"),
    user: readFile("USER.md"),
    tools: readFile("TOOLS.md"),
    bootstrap: readFile("BOOTSTRAP.md"),
    heartbeat: readFile("HEARTBEAT.md"),
    identity: readFile("IDENTITY.md"),
    memory: readFile("MEMORY.md"),
  };
}

export type AgentFileName = "SOUL.md" | "AGENTS.md" | "USER.md" | "TOOLS.md" | "BOOTSTRAP.md" | "HEARTBEAT.md" | "IDENTITY.md" | "MEMORY.md";

export function saveAgentFile(
  agentId: string,
  file: AgentFileName,
  content: string
): boolean {
  if (!isValidAgent(agentId)) return false;

  const agentDir = AGENT_WORKSPACE_PATHS[agentId];
  if (!agentDir) return false;

  const filePath = path.join(agentDir, file);
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  fs.writeFileSync(filePath, content, "utf-8");
  return true;
}
