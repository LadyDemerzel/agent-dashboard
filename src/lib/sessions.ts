import fs from "fs";
import path from "path";

const AGENTS_DIR = path.join(
  process.env.HOME || "/Users/ittaisvidler",
  ".openclaw",
  "agents"
);

// List of agent IDs to check
const AGENT_IDS = ["echo", "ralph", "scribe", "oracle", "clerk", "demerzel", "main"];

// Activity threshold: session is "active" if last message was within this time
const ACTIVITY_THRESHOLD_MS = 3 * 60 * 1000; // 3 minutes

interface SessionEntry {
  role?: string;
  content?: unknown;
  timestamp?: number;
  type?: string;
  message?: {
    role?: string;
    content?: Array<{
      type?: string;
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

/**
 * Check if a session is active based on last activity time
 */
function isSessionActive(lastActivity: string): boolean {
  const lastActivityTime = new Date(lastActivity).getTime();
  const now = Date.now();
  return lastActivityTime > (now - ACTIVITY_THRESHOLD_MS);
}

/**
 * Extract the most recent user message content from session
 */
function extractLastUserMessage(content: string): string | undefined {
  try {
    const lines = content.trim().split("\n").filter(line => line.trim());
    
    // Parse from the end to find the most recent user message
    for (let i = lines.length - 1; i >= 0; i--) {
      try {
        const entry: SessionEntry = JSON.parse(lines[i]);
        
        // Check for user message
        const isUserMessage = entry.role === "user" || entry.message?.role === "user";
        
        if (isUserMessage && entry.message?.content) {
          const messageContent = entry.message.content;
          if (Array.isArray(messageContent)) {
            const textContent = messageContent.find(c => c.type === "text" && c.text);
            if (textContent?.text) {
              return textContent.text;
            }
          }
        }
      } catch {
        continue;
      }
    }
  } catch {
    // If parsing fails, return undefined
  }
  return undefined;
}

/**
 * Extract a meaningful task description from session content
 */
function extractTaskDescription(content: string): string | undefined {
  const text = extractLastUserMessage(content);
  if (!text) return undefined;

  // System/greeting phrases to filter out
  const systemPhrases = [
    "a new session was started",
    "greet the user in your configured persona",
    "be yourself",
    "this is a new session",
    "you are a helpful assistant",
    "you are an ai assistant",
    "heartbeat",
    "read heartbeat.md",
    "if nothing needs attention",
  ];
  
  const lowerText = text.toLowerCase();
  
  // Skip system/greeting messages
  if (systemPhrases.some(phrase => lowerText.includes(phrase))) {
    return undefined;
  }
  
  // Task-related keywords that indicate actual work
  const taskKeywords = [
    "implement", "create", "build", "fix", "update", "add",
    "improve", "change", "modify", "develop", "design",
    "write", "generate", "make", "refactor", "optimize",
    "research", "investigate", "analyze", "review", "test",
    "deploy", "configure", "setup", "integrate"
  ];
  
  // Split into lines and find first substantial, meaningful line
  const lines = text.split("\n");
  
  for (const line of lines) {
    const trimmed = line.trim();
    
    // Must be reasonably long
    if (trimmed.length < 15) continue;
    
    // Skip lines that are just metadata or commands
    if (trimmed.startsWith("[") && trimmed.includes("]")) {
      // Extract content after the metadata bracket
      const match = trimmed.match(/\[.*?\]\s*(.+)/);
      if (match) {
        const content = match[1].trim();
        if (content.length > 15) {
          return content.length > 120 ? content.substring(0, 120) + "..." : content;
        }
      }
    }
    
    // Check for task keywords
    const hasTaskKeyword = taskKeywords.some(kw => 
      trimmed.toLowerCase().includes(kw)
    );
    
    if (hasTaskKeyword && trimmed.length > 20) {
      return trimmed.length > 120 ? trimmed.substring(0, 120) + "..." : trimmed;
    }
    
    // If it's a substantial line without keywords, use it as fallback
    if (trimmed.length > 50 && trimmed.length < 200) {
      return trimmed.length > 120 ? trimmed.substring(0, 120) + "..." : trimmed;
    }
  }
  
  // Last resort: truncate the whole text
  if (text.length > 120) {
    return text.substring(0, 120) + "...";
  }
  return text;
}

/**
 * Get session info for a specific agent
 */
function getAgentSessions(agentId: string): SessionInfo | null {
  const sessionsDir = path.join(AGENTS_DIR, agentId, "sessions");
  
  if (!fs.existsSync(sessionsDir)) {
    return null;
  }

  const sessionFiles = fs
    .readdirSync(sessionsDir)
    .filter((f) => f.endsWith(".jsonl") && !f.includes(".deleted."));

  let mostRecentSession: SessionInfo | null = null;
  let mostRecentTime = 0;

  for (const file of sessionFiles) {
    const sessionPath = path.join(sessionsDir, file);
    try {
      const stats = fs.statSync(sessionPath);
      const content = fs.readFileSync(sessionPath, "utf-8");
      const lines = content.trim().split("\n").filter(line => line.trim());

      if (lines.length === 0) continue;

      const sessionKey = file.replace(".jsonl", "");
      let maxTimestamp = stats.mtime.getTime(); // Fallback to file mtime
      let lastActivity = new Date(maxTimestamp).toISOString();

      // Try to find the most recent timestamp in the session
      for (let i = lines.length - 1; i >= 0; i--) {
        try {
          const entry: SessionEntry = JSON.parse(lines[i]);
          if (entry.timestamp && entry.timestamp > maxTimestamp) {
            maxTimestamp = entry.timestamp;
            lastActivity = new Date(entry.timestamp).toISOString();
          }
        } catch {
          continue;
        }
      }

      // Track the most recent session for this agent
      if (maxTimestamp > mostRecentTime) {
        mostRecentTime = maxTimestamp;
        const isActive = isSessionActive(lastActivity);
        const taskDescription = isActive ? extractTaskDescription(content) : undefined;
        
        mostRecentSession = {
          sessionKey,
          agentId,
          lastActivity,
          isActive,
          taskDescription,
        };
      }
    } catch {
      continue;
    }
  }

  return mostRecentSession;
}

/**
 * Get all active agent sessions
 */
export function getActiveAgentSessions(): Record<string, SessionInfo> {
  const activeSessions: Record<string, SessionInfo> = {};

  for (const agentId of AGENT_IDS) {
    const session = getAgentSessions(agentId);
    if (session && session.isActive) {
      activeSessions[agentId] = session;
    }
  }

  return activeSessions;
}

/**
 * Get agent status map with current task info
 */
export function getAgentStatusWithSessions(): Record<
  string,
  { status: "idle" | "working" | "review" | "blocked"; currentTask?: string; lastActivity?: string }
> {
  const statusMap: Record<
    string,
    { status: "idle" | "working" | "review" | "blocked"; currentTask?: string; lastActivity?: string }
  > = {
    ralph: { status: "idle" },
    echo: { status: "idle" },
    scribe: { status: "idle" },
    oracle: { status: "idle" },
    clerk: { status: "idle" },
    demerzel: { status: "idle" },
  };

  for (const agentId of Object.keys(statusMap)) {
    const session = getAgentSessions(agentId);
    if (session && session.isActive) {
      statusMap[agentId] = {
        status: "working",
        currentTask: session.taskDescription || "Working on task",
        lastActivity: session.lastActivity,
      };
    } else if (session) {
      // Store last activity even if not currently active
      statusMap[agentId].lastActivity = session.lastActivity;
    }
  }

  return statusMap;
}
