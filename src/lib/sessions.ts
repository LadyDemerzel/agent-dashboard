import fs from "fs";
import path from "path";

const SESSIONS_DIR = path.join(
  process.env.HOME || "/Users/ittaisvidler",
  ".openclaw",
  "agents",
  "main",
  "sessions"
);

interface SessionEntry {
  role: string;
  content?: unknown;
  timestamp?: number;
  toolCalls?: unknown[];
}

interface SessionInfo {
  sessionKey: string;
  agentId: string | null;
  lastActivity: string;
  isActive: boolean;
}

// Map session keys/names to agent IDs
const AGENT_SESSION_MAP: Record<string, string> = {
  ralph: "ralph",
  echo: "echo",
  scribe: "scribe",
  oracle: "oracle",
  clerk: "clerk",
};

function extractAgentFromSessionKey(sessionKey: string): string | null {
  const lowerKey = sessionKey.toLowerCase();
  for (const [keyword, agentId] of Object.entries(AGENT_SESSION_MAP)) {
    if (lowerKey.includes(keyword)) {
      return agentId;
    }
  }
  return null;
}

function extractAgentFromContent(content: string): string | null {
  const lowerContent = content.toLowerCase();
  
  // Check for agent names in the task content
  // Look for patterns like "have ralph", "ralph is", "assign to ralph", etc.
  for (const [keyword, agentId] of Object.entries(AGENT_SESSION_MAP)) {
    // Check if agent name appears in the content
    if (lowerContent.includes(keyword)) {
      return agentId;
    }
  }
  return null;
}

function isSessionActive(lastActivity: string): boolean {
  const lastActivityTime = new Date(lastActivity).getTime();
  const now = Date.now();
  const fiveMinutesAgo = now - 5 * 60 * 1000;
  return lastActivityTime > fiveMinutesAgo;
}

export function getActiveAgentSessions(): Record<string, SessionInfo> {
  const activeSessions: Record<string, SessionInfo> = {};

  if (!fs.existsSync(SESSIONS_DIR)) {
    return activeSessions;
  }

  const sessionFiles = fs
    .readdirSync(SESSIONS_DIR)
    .filter((f) => f.endsWith(".jsonl"));

  for (const file of sessionFiles) {
    const sessionPath = path.join(SESSIONS_DIR, file);
    try {
      const content = fs.readFileSync(sessionPath, "utf-8");
      const lines = content.trim().split("\n");

      if (lines.length === 0) continue;

      // Parse session metadata from first line if it exists
      let sessionKey = file.replace(".jsonl", "");
      let lastActivity = new Date().toISOString();

      // Try to find the most recent timestamp in the session
      for (let i = lines.length - 1; i >= 0; i--) {
        try {
          const entry: SessionEntry = JSON.parse(lines[i]);
          if (entry.timestamp) {
            lastActivity = new Date(entry.timestamp).toISOString();
            break;
          }
        } catch {
          continue;
        }
      }

      // Check for agent mentions in the session content
      const agentId = extractAgentFromContent(content);
      if (agentId) {
        const isActive = isSessionActive(lastActivity);
        if (isActive) {
          activeSessions[agentId] = {
            sessionKey,
            agentId,
            lastActivity,
            isActive,
          };
        }
      }
    } catch {
      continue;
    }
  }

  return activeSessions;
}

export function getAgentStatusWithSessions(): Record<
  string,
  { status: "idle" | "working" | "review" | "blocked"; currentTask?: string }
> {
  const activeSessions = getActiveAgentSessions();
  const statusMap: Record<
    string,
    { status: "idle" | "working" | "review" | "blocked"; currentTask?: string }
  > = {
    ralph: { status: "idle" },
    echo: { status: "idle" },
    scribe: { status: "idle" },
    oracle: { status: "idle" },
    clerk: { status: "idle" },
  };

  for (const [agentId, session] of Object.entries(activeSessions)) {
    if (session.isActive) {
      statusMap[agentId] = {
        status: "working",
        currentTask: `Active session: ${session.sessionKey}`,
      };
    }
  }

  return statusMap;
}
