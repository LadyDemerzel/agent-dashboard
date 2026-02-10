import fs from "fs";
import path from "path";

const BUSINESS_ROOT = path.join(
  process.env.HOME || "/Users/ittaisvidler",
  "tenxsolo",
  "business"
);

export interface Deliverable {
  id: string;
  agentId: string;
  agentName: string;
  title: string;
  type: "research" | "code" | "content" | "strategy" | "operations";
  status: "draft" | "needs review" | "requested changes" | "approved" | "published";
  filePath: string;
  relativePath: string;
  createdAt: string;
  updatedAt: string;
  size: number;
}

const AGENT_TYPE_MAP: Record<string, Deliverable["type"]> = {
  "market-research": "research",
  engineering: "code",
  content: "content",
  strategy: "strategy",
  operations: "operations",
  coordination: "strategy",
};

const AGENT_NAME_MAP: Record<string, string> = {
  "market-research": "Echo",
  engineering: "Ralph",
  content: "Scribe",
  strategy: "Oracle",
  operations: "Clerk",
  coordination: "Demerzel",
};

const AGENT_ID_MAP: Record<string, string> = {
  "market-research": "echo",
  engineering: "ralph",
  content: "scribe",
  strategy: "oracle",
  operations: "clerk",
  coordination: "demerzel",
};

function walkDir(dir: string): string[] {
  const results: string[] = [];
  if (!fs.existsSync(dir)) return results;

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...walkDir(fullPath));
    } else if (
      entry.name.endsWith(".md") &&
      !entry.name.startsWith(".") &&
      entry.name !== "README.md"
    ) {
      // Skip agent definition files (uppercase)
      if (entry.name === entry.name.toUpperCase()) continue;
      results.push(fullPath);
    }
  }
  return results;
}

function inferStatus(content: string): Deliverable["status"] {
  const lower = content.toLowerCase();
  if (lower.includes("status: published") || lower.includes("[published]"))
    return "published";
  if (lower.includes("status: approved") || lower.includes("[approved]"))
    return "approved";
  if (lower.includes("status: requested changes") || lower.includes("[requested changes]"))
    return "requested changes";
  if (lower.includes("status: needs review") || lower.includes("[needs review]"))
    return "needs review";
  return "draft";
}

function titleFromFilename(filename: string): string {
  return filename
    .replace(/\.md$/, "")
    .replace(/[-_]/g, " ")
    .replace(/\b\w/g, (l) => l.toUpperCase());
}

export function getDeliverables(agentFilter?: string): Deliverable[] {
  const deliverables: Deliverable[] = [];
  const workspaces = fs.existsSync(BUSINESS_ROOT)
    ? fs.readdirSync(BUSINESS_ROOT, { withFileTypes: true })
    : [];

  for (const ws of workspaces) {
    if (!ws.isDirectory()) continue;

    const agentId = AGENT_ID_MAP[ws.name];
    if (!agentId) continue;
    if (agentFilter && agentId !== agentFilter) continue;

    const delivDir = path.join(BUSINESS_ROOT, ws.name, "deliverables");
    const files = walkDir(delivDir);

    for (const filePath of files) {
      const stat = fs.statSync(filePath);
      const content = fs.readFileSync(filePath, "utf-8");
      const relativePath = path.relative(BUSINESS_ROOT, filePath);

      deliverables.push({
        id: Buffer.from(relativePath).toString("base64url"),
        agentId,
        agentName: AGENT_NAME_MAP[ws.name] || ws.name,
        title: titleFromFilename(path.basename(filePath)),
        type: AGENT_TYPE_MAP[ws.name] || "research",
        status: inferStatus(content),
        filePath,
        relativePath,
        createdAt: stat.birthtime.toISOString(),
        updatedAt: stat.mtime.toISOString(),
        size: stat.size,
      });
    }
  }

  return deliverables.sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );
}

export function getDeliverableContent(id: string): string | null {
  const deliverables = getDeliverables();
  const d = deliverables.find((d) => d.id === id);
  if (!d) return null;
  try {
    return fs.readFileSync(d.filePath, "utf-8");
  } catch {
    return null;
  }
}

export function getAgentStats(): Record<
  string,
  { deliverableCount: number; lastActivity: string }
> {
  const deliverables = getDeliverables();
  const stats: Record<
    string,
    { deliverableCount: number; lastActivity: string }
  > = {};

  for (const d of deliverables) {
    if (!stats[d.agentId]) {
      stats[d.agentId] = {
        deliverableCount: 0,
        lastActivity: d.updatedAt,
      };
    }
    stats[d.agentId].deliverableCount++;
    if (d.updatedAt > stats[d.agentId].lastActivity) {
      stats[d.agentId].lastActivity = d.updatedAt;
    }
  }

  return stats;
}
