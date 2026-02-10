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
  demerzel: "demerzel",
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
    
    // System/greeting phrases to filter out
    const systemPhrases = [
      "a new session was started",
      "greet the user in your configured persona",
      "be yourself",
      "this is a new session",
      "you are a helpful assistant",
      "you are an ai assistant"
    ];
    
    // Look for the first user message with meaningful content
    for (const line of lines) {
      const entry: SessionEntry = JSON.parse(line);
      
      // Check for user message with content
      if (entry.role === "user" || entry.message?.role === "user") {
        const messageContent = entry.message?.content;
        if (Array.isArray(messageContent)) {
          // Find text content
          const textContent = messageContent.find(c => c.type === "text" && c.text);
          if (textContent?.text) {
            const text = textContent.text;
            
            // Skip system/greeting messages
            const lowerText = text.toLowerCase();
            if (systemPhrases.some(phrase => lowerText.includes(phrase))) {
              continue;
            }
            
            // Look for task-related keywords that indicate actual work
            const taskKeywords = [
              "implement", "create", "build", "fix", "update", "add",
              "improve", "change", "modify", "develop", "design",
              "write", "generate", "make", "refactor", "optimize"
            ];
            
            // Split into lines and find first substantial, meaningful line
            const textLines = text.split("\n");
            for (const textLine of textLines) {
              const trimmed = textLine.trim();
              // Must be reasonably long and contain task keywords or be substantial
              if (trimmed.length > 20 && trimmed.length < 200) {
                const hasTaskKeyword = taskKeywords.some(kw => 
                  trimmed.toLowerCase().includes(kw)
                );
                // If it has a task keyword or is a very clear instruction
                if (hasTaskKeyword || trimmed.length > 50) {
                  if (trimmed.length > 120) {
                    return trimmed.substring(0, 120) + "...";
                  }
                  return trimmed;
                }
              }
            }
            
            // Fallback: get first substantial line that's not too long
            const substantialLine = textLines.find(l => {
              const trimmed = l.trim();
              return trimmed.length > 30 && trimmed.length < 150;
            });
            
            if (substantialLine) {
              const trimmed = substantialLine.trim();
              if (trimmed.length > 120) {
                return trimmed.substring(0, 120) + "...";
              }
              return trimmed;
            }
            
            // Last resort: first 120 chars of text
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
    demerzel: { status: "idle" },
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
