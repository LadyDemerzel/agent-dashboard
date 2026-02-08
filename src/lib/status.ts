import fs from "fs";
import path from "path";
import { parseFrontMatter, generateFrontMatter } from "./frontmatter";

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

/**
 * Update deliverable status - prefers YAML front matter, falls back to inline
 */
export function updateDeliverableStatus(
  deliverableFilePath: string,
  newStatus: DeliverableStatus
): void {
  if (!fs.existsSync(deliverableFilePath)) return;

  const content = fs.readFileSync(deliverableFilePath, "utf-8");
  
  // Try to update YAML front matter first
  const parsed = parseFrontMatter(content);
  
  if (parsed) {
    // Update front matter
    const updatedFrontMatter = {
      ...parsed.frontMatter,
      status: newStatus,
      updatedAt: new Date().toISOString(),
    };
    
    const newContent = generateFrontMatter(updatedFrontMatter) + '\n\n' + parsed.body;
    fs.writeFileSync(deliverableFilePath, newContent, "utf-8");
    return;
  }
  
  // Fall back to inline status format for legacy files
  let updatedContent = content;
  
  // Handle **Status:** value (colon outside bold)
  const statusRegex = /\*\*Status:\*\*\s*.+/i;
  // Handle **Status: value** (colon inside bold)
  const statusInsideBoldRegex = /\*\*Status:\s*[^*]+\*\*/i;
  const statusLineRegex = /^status:\s*.+$/im;

  if (statusRegex.test(content)) {
    updatedContent = content.replace(statusRegex, `**Status:** ${newStatus}`);
  } else if (statusInsideBoldRegex.test(content)) {
    updatedContent = content.replace(statusInsideBoldRegex, `**Status: ${newStatus}**`);
  } else if (statusLineRegex.test(content)) {
    updatedContent = content.replace(statusLineRegex, `status: ${newStatus}`);
  } else {
    // Add status after the first heading
    const firstHeading = content.match(/^#.+$/m);
    if (firstHeading) {
      const idx = content.indexOf(firstHeading[0]) + firstHeading[0].length;
      updatedContent =
        content.slice(0, idx) +
        `\n\n**Status:** ${newStatus}` +
        content.slice(idx);
    } else {
      updatedContent = `**Status:** ${newStatus}\n\n` + content;
    }
  }

  fs.writeFileSync(deliverableFilePath, updatedContent, "utf-8");
}

/**
 * Migrate a deliverable file to use YAML front matter
 */
export function migrateToFrontMatter(deliverableFilePath: string): void {
  if (!fs.existsSync(deliverableFilePath)) return;

  const content = fs.readFileSync(deliverableFilePath, "utf-8");
  
  // Skip if already has front matter
  if (parseFrontMatter(content)) return;

  // Extract metadata from inline format
  const frontMatter: Record<string, string | string[]> = {};
  
  // Extract title from first heading
  const titleMatch = content.match(/^#\s+(.+)$/m);
  if (titleMatch) {
    frontMatter.title = titleMatch[1].trim();
  }
  
  // Extract status
  const statusMatch = content.match(/\*\*Status:\*\*\s*(.+)/i) || 
                      content.match(/\*\*Status:\s*(.+)\*\*/i);
  if (statusMatch) {
    frontMatter.status = statusMatch[1].trim();
  }
  
  // Extract date
  const dateMatch = content.match(/\*\*Date:\*\*\s*(.+)/i);
  if (dateMatch) {
    frontMatter.date = dateMatch[1].trim();
  }
  
  // Extract agent
  const agentMatch = content.match(/\*\*Agent:\*\*\s*(.+)/i);
  if (agentMatch) {
    frontMatter.agent = agentMatch[1].trim();
  }
  
  // Clean up body by removing extracted inline metadata
  let body = content;
  body = body.replace(/\*\*Status:\*\*\s*.+\n?/gi, '');
  body = body.replace(/\*\*Status:\s*[^*]+\*\*\n?/gi, '');
  body = body.replace(/\*\*Date:\*\*\s*.+\n?/gi, '');
  body = body.replace(/\*\*Agent:\*\*\s*.+\n?/gi, '');
  body = body.replace(/\n{3,}/g, '\n\n'); // Clean up extra newlines
  
  const newContent = generateFrontMatter(frontMatter) + '\n\n' + body.trim();
  fs.writeFileSync(deliverableFilePath, newContent, "utf-8");
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
