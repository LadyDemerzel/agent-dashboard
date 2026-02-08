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
  message?: {
    role: string;
    content?: Array<{
      type: string;
      text?: string;
    }>;
  };
}

interface SessionInfo {
  sessionKey: string;
  agentId: string | null;
  lastActivity: string;
  isActive: boolean;
  taskDescription?: string;
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

function extractTaskDescription(content: string): string | undefined {
  try {
    const lines = content.trim().split("\n");
    
    // Look for the first user message with content
    for (const line of lines) {
      const entry: SessionEntry = JSON.parse(line);
      
      // Check for user message with content
      if (entry.role === "user" || entry.message?.role === "user") {
        const messageContent = entry.message?.content;
        if (Array.isArray(messageContent)) {
          // Find text content
          const textContent = messageContent.find(c => c.type === "text" && c.text);
          if (textContent?.text) {
            // Extract first line or sentence that's meaningful
            const text = textContent.text;
            
            // Try to find a clear task description
            // Look for the first substantial line (not just "Task:" or similar headers)
            const lines_text = text.split("\n").filter(l => l.trim().length > 10);
            if (lines_text.length > 0) {
              // Get first meaningful line, truncate if too long
              const description = lines_text[0].trim();
              if (description.length > 120) {
                return description.substring(0, 120) + "...";
              }
              return description;
            }
            
            // Fallback: first 120 chars of text
            if (text.length > 120) {
              return text.substring(0, 120) + "...";
            }
            return text;
          }
        }
      }
    }
  } catch {
    // If parsing fails, return undefined
  }
  return undefined;
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
          const taskDescription = extractTaskDescription(content);
          activeSessions[agentId] = {
            sessionKey,
            agentId,
            lastActivity,
            isActive,
            taskDescription,
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
        currentTask: session.taskDescription || "Working on task",
      };
    }
  }

  return statusMap;
}
