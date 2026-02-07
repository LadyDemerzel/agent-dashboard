import fs from "fs";
import path from "path";

const BUSINESS_ROOT = path.join(
  process.env.HOME || "/Users/ittaisvidler",
  "tenxsolo",
  "business"
);

export type DeliverableStatus =
  | "needs review"
  | "requested changes"
  | "approved"
  | "published";

export interface StatusLogEntry {
  timestamp: string;
  from: string;
  to: DeliverableStatus;
  by: string;
  note: string;
}

export interface StatusLog {
  logs: StatusLogEntry[];
}

// Map workspace to deliverables directory
const WORKSPACE_DIRS: Record<string, string> = {
  "market-research": path.join(BUSINESS_ROOT, "market-research", "deliverables"),
  content: path.join(BUSINESS_ROOT, "content", "deliverables"),
  engineering: path.join(BUSINESS_ROOT, "engineering", "deliverables"),
  strategy: path.join(BUSINESS_ROOT, "strategy", "deliverables"),
  operations: path.join(BUSINESS_ROOT, "operations", "deliverables"),
};

function getStatusLogPath(deliverableFilePath: string): string {
  const dir = path.dirname(deliverableFilePath);
  const base = path.basename(deliverableFilePath, ".md");
  return path.join(dir, `${base}-status-log.json`);
}

export function readStatusLog(deliverableFilePath: string): StatusLog {
  const logPath = getStatusLogPath(deliverableFilePath);
  if (!fs.existsSync(logPath)) {
    return { logs: [] };
  }
  try {
    const raw = fs.readFileSync(logPath, "utf-8");
    return JSON.parse(raw);
  } catch {
    return { logs: [] };
  }
}

export function appendStatusLog(
  deliverableFilePath: string,
  from: string,
  to: DeliverableStatus,
  by: string,
  note: string
): StatusLog {
  const log = readStatusLog(deliverableFilePath);
  log.logs.push({
    timestamp: new Date().toISOString(),
    from,
    to,
    by,
    note,
  });

  const logPath = getStatusLogPath(deliverableFilePath);
  const dir = path.dirname(logPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(logPath, JSON.stringify(log, null, 2), "utf-8");
  return log;
}

export function updateDeliverableStatus(
  deliverableFilePath: string,
  newStatus: DeliverableStatus
): void {
  if (!fs.existsSync(deliverableFilePath)) return;

  let content = fs.readFileSync(deliverableFilePath, "utf-8");

  // Replace existing status line or add one
  const statusRegex = /\*\*Status:\*\*\s*.+/i;
  const statusLineRegex = /^status:\s*.+$/im;

  if (statusRegex.test(content)) {
    content = content.replace(statusRegex, `**Status:** ${newStatus}`);
  } else if (statusLineRegex.test(content)) {
    content = content.replace(statusLineRegex, `status: ${newStatus}`);
  } else {
    // Add status after the first heading
    const firstHeading = content.match(/^#.+$/m);
    if (firstHeading) {
      const idx = content.indexOf(firstHeading[0]) + firstHeading[0].length;
      content =
        content.slice(0, idx) +
        `\n\n**Status:** ${newStatus}` +
        content.slice(idx);
    } else {
      content = `**Status:** ${newStatus}\n\n` + content;
    }
  }

  fs.writeFileSync(deliverableFilePath, content, "utf-8");
}

// Get status log for a research file by its ID (base64url encoded filename)
export function getResearchStatusLog(researchId: string): StatusLog {
  const filename = Buffer.from(researchId, "base64url").toString("utf-8");
  const filePath = path.join(
    BUSINESS_ROOT,
    "market-research",
    "deliverables",
    filename
  );
  return readStatusLog(filePath);
}

// Get status log for an x-post by its ID (date_post-N format)
export function getXPostStatusLog(postId: string): StatusLog {
  const match = postId.match(/^(\d{4}-\d{2}-\d{2})_post-(\d+)$/);
  if (!match) return { logs: [] };
  const [, date, num] = match;
  const filePath = path.join(
    BUSINESS_ROOT,
    "content",
    "deliverables",
    "x-posts",
    date,
    `post-${num}.md`
  );
  return readStatusLog(filePath);
}
