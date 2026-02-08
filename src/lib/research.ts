import fs from "fs";
import path from "path";

const RESEARCH_DIR = path.join(
  process.env.HOME || "/Users/ittaisvidler",
  "tenxsolo",
  "business",
  "market-research",
  "deliverables"
);

export interface ResearchFile {
  id: string;
  title: string;
  filename: string;
  date: string;
  status: "draft" | "needs review" | "requested changes" | "approved" | "published";
  preview: string;
  size: number;
  updatedAt: string;
  agent: string;
  tags: string[];
}

interface FrontMatter {
  title?: string;
  status?: string;
  date?: string;
  agent?: string;
  tags?: string[];
  [key: string]: unknown;
}

/**
 * Parse YAML front matter from markdown content
 * Returns { frontMatter, body } or null if no front matter
 */
function parseFrontMatter(content: string): { frontMatter: FrontMatter; body: string } | null {
  const match = content.match(/^---\s*\n([\s\S]*?)\n---\s*\n([\s\S]*)$/);
  if (!match) return null;

  const yamlText = match[1];
  const body = match[2];

  const frontMatter: FrontMatter = {};
  
  // Simple YAML parser for basic types
  const lines = yamlText.split('\n');
  let currentKey: string | null = null;
  let currentArray: string[] = [];
  
  for (const line of lines) {
    const trimmed = line.trim();
    
    // Skip empty lines and comments
    if (!trimmed || trimmed.startsWith('#')) continue;
    
    // Check for array item
    if (trimmed.startsWith('- ')) {
      if (currentKey) {
        currentArray.push(trimmed.slice(2).trim());
      }
      continue;
    }
    
    // If we were building an array, save it
    if (currentKey && currentArray.length > 0) {
      frontMatter[currentKey] = currentArray;
      currentArray = [];
    }
    
    // Parse key: value
    const keyValueMatch = trimmed.match(/^(\w+):\s*(.*)$/);
    if (keyValueMatch) {
      const [, key, value] = keyValueMatch;
      currentKey = key;
      
      if (value) {
        // Strip quotes if present
        frontMatter[key] = value.replace(/^["'](.*)["']$/, '$1');
        currentKey = null;
      }
    }
  }
  
  // Don't forget the last array
  if (currentKey && currentArray.length > 0) {
    frontMatter[currentKey] = currentArray;
  }
  
  return { frontMatter, body };
}

/**
 * Generate YAML front matter string
 */
export function generateFrontMatter(data: FrontMatter): string {
  const lines = ['---'];
  
  for (const [key, value] of Object.entries(data)) {
    if (value === undefined || value === null) continue;
    
    if (Array.isArray(value)) {
      lines.push(`${key}:`);
      for (const item of value) {
        lines.push(`  - ${item}`);
      }
    } else if (typeof value === 'string' && value.includes(':')) {
      lines.push(`${key}: "${value}"`);
    } else {
      lines.push(`${key}: ${value}`);
    }
  }
  
  lines.push('---');
  return lines.join('\n');
}

function normalizeStatus(status: string | undefined): ResearchFile['status'] {
  if (!status) return 'draft';
  const lower = status.toLowerCase();
  if (lower === 'published') return 'published';
  if (lower === 'approved') return 'approved';
  if (lower === 'requested changes') return 'requested changes';
  if (lower === 'needs review' || lower === 'review') return 'needs review';
  return 'draft';
}

function extractTitle(body: string, filename: string, frontMatter?: FrontMatter): string {
  if (frontMatter?.title) return frontMatter.title;
  
  const match = body.match(/^#\s+(.+)$/m);
  if (match) return match[1].trim();
  
  return filename
    .replace(/\.md$/, "")
    .replace(/[-_]/g, " ")
    .replace(/\b\w/g, (l) => l.toUpperCase());
}

function extractDate(filename: string, frontMatter?: FrontMatter): string {
  if (frontMatter?.date) {
    // Try to parse the front matter date
    const parsed = new Date(frontMatter.date);
    if (!isNaN(parsed.getTime())) return parsed.toISOString();
  }
  
  const match = filename.match(/(\d{4}-\d{2}-\d{2})-?(\d{4})?/);
  if (match) {
    const date = match[1];
    const time = match[2]
      ? `${match[2].slice(0, 2)}:${match[2].slice(2)}`
      : "00:00";
    return `${date}T${time}:00`;
  }
  return new Date().toISOString();
}

function extractPreview(body: string): string {
  const lines = body.split("\n");
  const contentLines = lines.filter(
    (l) =>
      l.trim() &&
      !l.startsWith("#") &&
      !l.startsWith("**Status") &&
      !l.startsWith("**Date") &&
      !l.startsWith("**Agent")
  );
  return contentLines.slice(0, 3).join(" ").slice(0, 200);
}

export function getResearchFiles(): ResearchFile[] {
  if (!fs.existsSync(RESEARCH_DIR)) return [];

  const files = fs.readdirSync(RESEARCH_DIR).filter((f) => f.endsWith(".md"));
  const results: ResearchFile[] = [];

  for (const filename of files) {
    const filePath = path.join(RESEARCH_DIR, filename);
    const stat = fs.statSync(filePath);
    const content = fs.readFileSync(filePath, "utf-8");

    // Try to parse YAML front matter
    const parsed = parseFrontMatter(content);
    const frontMatter = parsed?.frontMatter;
    const body = parsed?.body || content;

    results.push({
      id: Buffer.from(filename).toString("base64url"),
      title: extractTitle(body, filename, frontMatter),
      filename,
      date: extractDate(filename, frontMatter),
      status: normalizeStatus(frontMatter?.status),
      preview: extractPreview(body),
      size: stat.size,
      updatedAt: stat.mtime.toISOString(),
      agent: frontMatter?.agent || 'Echo',
      tags: frontMatter?.tags || [],
    });
  }

  return results.sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );
}

export function getResearchContent(id: string): string | null {
  const files = getResearchFiles();
  const file = files.find((f) => f.id === id);
  if (!file) return null;
  try {
    return fs.readFileSync(path.join(RESEARCH_DIR, file.filename), "utf-8");
  } catch {
    return null;
  }
}

// Get only approved research files (for Scribe to use when creating content)
export function getApprovedResearch(): ResearchFile[] {
  const allFiles = getResearchFiles();
  return allFiles.filter(
    (f) => f.status === "approved" || f.status === "published"
  );
}

/**
 * Update deliverable with new front matter
 * Preserves existing front matter fields not in the update
 */
export function updateDeliverableFrontMatter(
  filePath: string,
  updates: Partial<FrontMatter>
): void {
  if (!fs.existsSync(filePath)) return;

  const content = fs.readFileSync(filePath, "utf-8");
  const parsed = parseFrontMatter(content);
  
  let body: string;
  let newFrontMatter: FrontMatter;
  
  if (parsed) {
    body = parsed.body;
    newFrontMatter = { ...parsed.frontMatter, ...updates };
  } else {
    // No existing front matter - extract from body
    body = content;
    newFrontMatter = updates;
    
    // Try to extract existing metadata from body
    const statusMatch = content.match(/\*\*Status:\*\*\s*(.+)/i) || 
                        content.match(/\*\*Status:\s*(.+)\*\*/i);
    if (statusMatch && !updates.status) {
      newFrontMatter.status = statusMatch[1].trim();
    }
    
    const dateMatch = content.match(/\*\*Date:\*\*\s*(.+)/i);
    if (dateMatch && !updates.date) {
      newFrontMatter.date = dateMatch[1].trim();
    }
    
    const agentMatch = content.match(/\*\*Agent:\*\*\s*(.+)/i);
    if (agentMatch && !updates.agent) {
      newFrontMatter.agent = agentMatch[1].trim();
    }
  }
  
  const newContent = generateFrontMatter(newFrontMatter) + '\n\n' + body;
  fs.writeFileSync(filePath, newContent, "utf-8");
}
