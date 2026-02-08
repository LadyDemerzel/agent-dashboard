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
}

function inferStatus(
  content: string
): "draft" | "needs review" | "requested changes" | "approved" | "published" {
  const lower = content.toLowerCase();
  if (lower.includes("status: published") || lower.includes("[published]") || lower.includes("**status: published**"))
    return "published";
  if (lower.includes("status: approved") || lower.includes("[approved]") || lower.includes("**status: approved**"))
    return "approved";
  if (lower.includes("status: requested changes") || lower.includes("[requested changes]") || lower.includes("**status: requested changes**"))
    return "requested changes";
  if (lower.includes("status: needs review") || lower.includes("[needs review]") || lower.includes("**status: needs review**"))
    return "needs review";
  if (lower.includes("status: review") || lower.includes("**status: review**"))
    return "needs review";
  return "draft";
}

function extractTitle(content: string, filename: string): string {
  const match = content.match(/^#\s+(.+)$/m);
  if (match) return match[1].trim();
  return filename
    .replace(/\.md$/, "")
    .replace(/[-_]/g, " ")
    .replace(/\b\w/g, (l) => l.toUpperCase());
}

function extractDate(filename: string): string {
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

function extractPreview(content: string): string {
  const lines = content.split("\n");
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

    results.push({
      id: Buffer.from(filename).toString("base64url"),
      title: extractTitle(content, filename),
      filename,
      date: extractDate(filename),
      status: inferStatus(content),
      preview: extractPreview(content),
      size: stat.size,
      updatedAt: stat.mtime.toISOString(),
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
