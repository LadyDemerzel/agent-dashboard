import fs from "fs";
import path from "path";

export type ShortFormSessionLogKind =
  | "session"
  | "user"
  | "assistant"
  | "tool"
  | "system"
  | "error";

export interface ShortFormSessionLogEntry {
  id: string;
  timestamp?: string;
  kind: ShortFormSessionLogKind;
  label: string;
  text: string;
}

export interface ShortFormSessionLogResult {
  agentId: string;
  sessionId: string;
  sessionKey?: string;
  sourcePath?: string;
  updatedAt?: string;
  entries: ShortFormSessionLogEntry[];
}

const HOME_DIR = process.env.HOME || "/Users/ittaisvidler";
const OPENCLAW_AGENTS_DIR = path.join(HOME_DIR, ".openclaw", "agents");
const MAX_LOG_FILE_BYTES = 768 * 1024;
const DEFAULT_MAX_ENTRIES = 240;

function safeAgentId(agentId: string) {
  return /^[a-z0-9_-]+$/i.test(agentId) ? agentId : "";
}

function readTail(filePath: string, maxBytes = MAX_LOG_FILE_BYTES) {
  const stats = fs.statSync(filePath);
  if (stats.size <= maxBytes) return fs.readFileSync(filePath, "utf-8");

  const start = Math.max(0, stats.size - maxBytes);
  const buffer = Buffer.alloc(stats.size - start);
  const fd = fs.openSync(filePath, "r");
  try {
    fs.readSync(fd, buffer, 0, buffer.length, start);
  } finally {
    fs.closeSync(fd);
  }
  return buffer.toString("utf-8").replace(/^[^\n]*\n/, "");
}

function readHead(filePath: string, maxBytes = 64 * 1024) {
  const stats = fs.statSync(filePath);
  const length = Math.min(maxBytes, stats.size);
  if (length <= 0) return "";

  const buffer = Buffer.alloc(length);
  const fd = fs.openSync(filePath, "r");
  try {
    fs.readSync(fd, buffer, 0, length, 0);
  } finally {
    fs.closeSync(fd);
  }
  return buffer.toString("utf-8");
}

function toIsoTimestamp(value: unknown) {
  if (typeof value === "string" && value.trim()) return value;
  if (typeof value === "number" && Number.isFinite(value)) {
    return new Date(value).toISOString();
  }
  return undefined;
}

function truncateText(value: string, max = 4000) {
  const normalized = value.replace(/\r\n/g, "\n").trim();
  if (normalized.length <= max) return normalized;
  return `${normalized.slice(0, max).trimEnd()}\n…`;
}

function stringifyCompact(value: unknown) {
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function extractMessageText(message: unknown) {
  if (!message || typeof message !== "object" || Array.isArray(message)) {
    return "";
  }
  const obj = message as Record<string, unknown>;
  const content = obj.content;
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";

  return content
    .map((part) => {
      if (!part || typeof part !== "object" || Array.isArray(part)) return "";
      const item = part as Record<string, unknown>;
      if (typeof item.text === "string") return item.text;
      if (typeof item.content === "string") return item.content;
      return "";
    })
    .filter(Boolean)
    .join("\n\n");
}

function makeEntry(
  index: number,
  timestamp: string | undefined,
  kind: ShortFormSessionLogKind,
  label: string,
  text: string,
): ShortFormSessionLogEntry | undefined {
  const body = truncateText(text);
  if (!body) return undefined;
  return {
    id: `${timestamp || "event"}-${index}`,
    timestamp,
    kind,
    label,
    text: body,
  };
}

function parseTrajectoryLine(line: string, index: number) {
  const entry = JSON.parse(line) as Record<string, unknown>;
  const type = typeof entry.type === "string" ? entry.type : "event";
  const timestamp = toIsoTimestamp(entry.ts);
  const data = entry.data && typeof entry.data === "object" && !Array.isArray(entry.data)
    ? (entry.data as Record<string, unknown>)
    : {};

  if (type === "model.completed") {
    const texts = Array.isArray(data.assistantTexts)
      ? data.assistantTexts.filter((value): value is string => typeof value === "string")
      : [];
    const usage = data.usage && typeof data.usage === "object" && !Array.isArray(data.usage)
      ? data.usage as Record<string, unknown>
      : undefined;
    const usageText = usage
      ? `\n\nUsage: input ${usage.input ?? "?"}, output ${usage.output ?? "?"}, total ${usage.total ?? "?"}`
      : "";
    return makeEntry(index, timestamp, "assistant", "Assistant", `${texts.join("\n\n") || "Model completed."}${usageText}`);
  }

  if (type === "tool.call" || type === "tool.result") {
    const toolName = typeof data.name === "string" ? data.name : "tool";
    const status = typeof data.status === "string" ? ` ${data.status}` : "";
    const output = typeof data.output === "string"
      ? data.output
      : data.result
        ? stringifyCompact(data.result)
        : `${type}${status}`;
    return makeEntry(index, timestamp, "tool", toolName, output);
  }

  if (type === "session.started" || type === "session.ended") {
    const status = data.status ? `Status: ${String(data.status)}` : type.replace(".", " ");
    return makeEntry(index, timestamp, "session", "Session", status);
  }

  if (type.startsWith("error") || data.error || data.errorMessage) {
    return makeEntry(index, timestamp, "error", "Error", stringifyCompact(data.error || data.errorMessage || data));
  }

  return makeEntry(index, timestamp, "system", type, stringifyCompact(data));
}

function parseSessionLine(line: string, index: number) {
  const entry = JSON.parse(line) as Record<string, unknown>;
  const timestamp = toIsoTimestamp(entry.timestamp);
  const type = typeof entry.type === "string" ? entry.type : undefined;
  const message = entry.message && typeof entry.message === "object" && !Array.isArray(entry.message)
    ? entry.message as Record<string, unknown>
    : undefined;
  const role = typeof entry.role === "string"
    ? entry.role
    : typeof message?.role === "string"
      ? message.role
      : undefined;
  const text = message ? extractMessageText(message) : "";

  if (role === "user") return makeEntry(index, timestamp, "user", "User", text);
  if (role === "assistant") return makeEntry(index, timestamp, "assistant", "Assistant", text || stringifyCompact(entry));
  if (type === "session") return makeEntry(index, timestamp, "session", "Session", stringifyCompact(entry));
  if (entry.errorMessage) return makeEntry(index, timestamp, "error", "Error", stringifyCompact(entry.errorMessage));
  return makeEntry(index, timestamp, "system", type || "Event", text || stringifyCompact(entry));
}

function findSessionFile(agentId: string, sessionId: string, sessionKey?: string) {
  const sessionsDir = path.join(OPENCLAW_AGENTS_DIR, agentId, "sessions");
  if (!fs.existsSync(sessionsDir)) return undefined;

  const normalizedSessionKey = sessionKey?.trim();
  const recentFiles = normalizedSessionKey
    ? fs
        .readdirSync(sessionsDir)
        .filter((entry) => entry.endsWith(".jsonl"))
        .map((entry) => {
          const fullPath = path.join(sessionsDir, entry);
          let mtimeMs = 0;
          try {
            mtimeMs = fs.statSync(fullPath).mtimeMs;
          } catch {
            mtimeMs = 0;
          }
          return { fullPath, mtimeMs };
        })
        .sort((a, b) => b.mtimeMs - a.mtimeMs)
        .slice(0, 800)
    : [];

  for (const candidate of recentFiles) {
    try {
      const head = readHead(candidate.fullPath);
      if (head.includes(normalizedSessionKey!)) return candidate.fullPath;
      const tail = readTail(candidate.fullPath, 96 * 1024);
      if (tail.includes(normalizedSessionKey!)) return candidate.fullPath;
    } catch {
      continue;
    }
  }

  if (!sessionId) return undefined;

  const exactCandidates = [
    `${sessionId}.trajectory.jsonl`,
    `${sessionId}.jsonl`,
  ];
  for (const candidate of exactCandidates) {
    const fullPath = path.join(sessionsDir, candidate);
    if (fs.existsSync(fullPath)) return fullPath;
  }

  const files = fs
    .readdirSync(sessionsDir)
    .filter((entry) => entry.endsWith(".jsonl") && entry.includes(sessionId))
    .map((entry) => {
      const fullPath = path.join(sessionsDir, entry);
      let mtimeMs = 0;
      try {
        mtimeMs = fs.statSync(fullPath).mtimeMs;
      } catch {
        mtimeMs = 0;
      }
      return { fullPath, mtimeMs };
    })
    .sort((a, b) => b.mtimeMs - a.mtimeMs);

  return files[0]?.fullPath;
}

export function readShortFormSessionLogs(
  agentIdInput: string,
  sessionIdInput: string,
  options?: { maxEntries?: number; sessionKey?: string },
): ShortFormSessionLogResult | null {
  const agentId = safeAgentId(agentIdInput);
  const sessionId = sessionIdInput.trim();
  const sessionKey = options?.sessionKey?.trim();
  if (!agentId || (!sessionId && !sessionKey) || sessionId.includes(path.sep)) return null;

  const sourcePath = findSessionFile(agentId, sessionId, sessionKey);
  if (!sourcePath) {
    return {
      agentId,
      sessionId,
      sessionKey,
      entries: [],
    };
  }

  const stats = fs.statSync(sourcePath);
  const raw = readTail(sourcePath);
  const isTrajectory = sourcePath.endsWith(".trajectory.jsonl");
  const maxEntries = Math.max(20, Math.min(500, options?.maxEntries || DEFAULT_MAX_ENTRIES));
  const lines = raw.split("\n").filter((line) => line.trim());
  const entries = lines
    .map((line, index) => {
      try {
        return isTrajectory
          ? parseTrajectoryLine(line, index)
          : parseSessionLine(line, index);
      } catch {
        return undefined;
      }
    })
    .filter((entry): entry is ShortFormSessionLogEntry => Boolean(entry))
    .slice(-maxEntries);

  return {
    agentId,
    sessionId,
    sessionKey,
    sourcePath,
    updatedAt: new Date(stats.mtimeMs).toISOString(),
    entries,
  };
}
