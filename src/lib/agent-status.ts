import fs from "fs";
import path from "path";
import { isValidAgent } from "./agent-files";

const STATUS_FILE = path.join(
  process.env.HOME || "/Users/ittaisvidler",
  ".openclaw",
  "agent-status.json"
);

export interface AgentStatus {
  status: string;
  deliverableId?: string;
  progress?: number;
  eta?: string;
  message?: string;
  priority?: string;
  updatedAt: string;
}

type StatusStore = Record<string, AgentStatus>;

function readStore(): StatusStore {
  if (!fs.existsSync(STATUS_FILE)) return {};
  try {
    return JSON.parse(fs.readFileSync(STATUS_FILE, "utf-8"));
  } catch {
    return {};
  }
}

function writeStore(store: StatusStore): void {
  const dir = path.dirname(STATUS_FILE);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(STATUS_FILE, JSON.stringify(store, null, 2), "utf-8");
}

export function getAgentStatus(agentId: string): AgentStatus | null {
  if (!isValidAgent(agentId)) return null;
  const store = readStore();
  return store[agentId] || null;
}

export function setAgentStatus(
  agentId: string,
  update: Omit<AgentStatus, "updatedAt">
): AgentStatus | null {
  if (!isValidAgent(agentId)) return null;

  const store = readStore();
  const entry: AgentStatus = {
    ...update,
    updatedAt: new Date().toISOString(),
  };
  store[agentId] = entry;
  writeStore(store);
  return entry;
}
