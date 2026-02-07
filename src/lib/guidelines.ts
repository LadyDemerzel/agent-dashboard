import fs from "fs";
import path from "path";

const AGENTS_ROOT = path.join(
  process.env.HOME || "/Users/ittaisvidler",
  "tenxsolo",
  "agents"
);

export interface GuidelineFiles {
  soul: string;
  agents: string;
  tacit: string;
}

const VALID_AGENTS = ["echo", "ralph", "scribe", "oracle", "clerk"];

export function isValidAgent(agentId: string): boolean {
  return VALID_AGENTS.includes(agentId);
}

export function getGuidelineFiles(agentId: string): GuidelineFiles | null {
  if (!isValidAgent(agentId)) return null;

  const agentDir = path.join(AGENTS_ROOT, agentId);
  if (!fs.existsSync(agentDir)) return null;

  const readFile = (name: string) => {
    const filePath = path.join(agentDir, name);
    if (!fs.existsSync(filePath)) return "";
    return fs.readFileSync(filePath, "utf-8");
  };

  return {
    soul: readFile("SOUL.md"),
    agents: readFile("AGENTS.md"),
    tacit: readFile("TACIT.md"),
  };
}

export function saveGuidelineFile(
  agentId: string,
  file: "SOUL.md" | "AGENTS.md",
  content: string
): boolean {
  if (!isValidAgent(agentId)) return false;

  const filePath = path.join(AGENTS_ROOT, agentId, file);
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  fs.writeFileSync(filePath, content, "utf-8");
  return true;
}
