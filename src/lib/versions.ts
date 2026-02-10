import fs from "fs";
import path from "path";
import { createTwoFilesPatch } from "diff";

export interface VersionEntry {
  version: number;
  timestamp: string;
  content: string;
  updatedBy: string;
  comment?: string;
  feedbackAddressed?: string[];
}

export interface VersionHistory {
  currentVersion: number;
  versions: VersionEntry[];
}

export interface DiffLine {
  type: "added" | "removed" | "context";
  lineNumber: number;
  content: string;
  oldLineNumber?: number;
  newLineNumber?: number;
}

export interface DiffHunk {
  oldStart: number;
  oldCount: number;
  newStart: number;
  newCount: number;
  lines: DiffLine[];
}

export interface DiffResult {
  fromVersion: number;
  toVersion: number;
  fromTimestamp: string;
  toTimestamp: string;
  hunks: DiffHunk[];
  stats: {
    additions: number;
    deletions: number;
    changes: number;
  };
}

function getVersionsPath(deliverableFilePath: string): string {
  const dir = path.dirname(deliverableFilePath);
  const base = path.basename(deliverableFilePath, ".md");
  return path.join(dir, `${base}-versions.json`);
}

export function readVersionHistory(deliverableFilePath: string): VersionHistory {
  const versionsPath = getVersionsPath(deliverableFilePath);
  if (!fs.existsSync(versionsPath)) {
    return { currentVersion: 0, versions: [] };
  }
  try {
    const raw = fs.readFileSync(versionsPath, "utf-8");
    return JSON.parse(raw);
  } catch {
    return { currentVersion: 0, versions: [] };
  }
}

export function writeVersionHistory(
  deliverableFilePath: string,
  history: VersionHistory
): void {
  const versionsPath = getVersionsPath(deliverableFilePath);
  const dir = path.dirname(versionsPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(versionsPath, JSON.stringify(history, null, 2), "utf-8");
}

export function addVersion(
  deliverableFilePath: string,
  content: string,
  updatedBy: string,
  comment?: string,
  feedbackAddressed?: string[]
): VersionEntry {
  const history = readVersionHistory(deliverableFilePath);
  const newVersion = history.currentVersion + 1;
  
  const entry: VersionEntry = {
    version: newVersion,
    timestamp: new Date().toISOString(),
    content,
    updatedBy,
    comment,
    feedbackAddressed,
  };
  
  history.versions.push(entry);
  history.currentVersion = newVersion;
  
  writeVersionHistory(deliverableFilePath, history);
  
  return entry;
}

export function getVersion(
  deliverableFilePath: string,
  version: number
): VersionEntry | null {
  const history = readVersionHistory(deliverableFilePath);
  return history.versions.find((v) => v.version === version) || null;
}

export function getCurrentVersion(deliverableFilePath: string): number {
  const history = readVersionHistory(deliverableFilePath);
  return history.currentVersion;
}

export function hasVersions(deliverableFilePath: string): boolean {
  const history = readVersionHistory(deliverableFilePath);
  return history.versions.length > 0;
}

function parseDiffPatch(patch: string): DiffHunk[] {
  const hunks: DiffHunk[] = [];
  const lines = patch.split("\n");
  let currentHunk: DiffHunk | null = null;
  let oldLineNum = 0;
  let newLineNum = 0;

  for (const line of lines) {
    // Hunk header: @@ -oldStart,oldCount +newStart,newCount @@
    const hunkMatch = line.match(/^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
    if (hunkMatch) {
      if (currentHunk) {
        hunks.push(currentHunk);
      }
      const oldStart = parseInt(hunkMatch[1], 10);
      const newStart = parseInt(hunkMatch[2], 10);
      oldLineNum = oldStart;
      newLineNum = newStart;
      currentHunk = {
        oldStart,
        oldCount: 0,
        newStart,
        newCount: 0,
        lines: [],
      };
      continue;
    }

    if (!currentHunk) continue;

    if (line.startsWith("+")) {
      currentHunk.lines.push({
        type: "added",
        lineNumber: newLineNum,
        content: line.slice(1),
        newLineNumber: newLineNum,
      });
      newLineNum++;
      currentHunk.newCount++;
    } else if (line.startsWith("-")) {
      currentHunk.lines.push({
        type: "removed",
        lineNumber: oldLineNum,
        content: line.slice(1),
        oldLineNumber: oldLineNum,
      });
      oldLineNum++;
      currentHunk.oldCount++;
    } else if (line.startsWith(" ")) {
      currentHunk.lines.push({
        type: "context",
        lineNumber: oldLineNum,
        content: line.slice(1),
        oldLineNumber: oldLineNum,
        newLineNumber: newLineNum,
      });
      oldLineNum++;
      newLineNum++;
      currentHunk.oldCount++;
      currentHunk.newCount++;
    } else if (line.startsWith("\\")) {
      // "\ No newline at end of file" - skip
      continue;
    }
  }

  if (currentHunk) {
    hunks.push(currentHunk);
  }

  return hunks;
}

export function generateDiff(
  deliverableFilePath: string,
  fromVersion: number,
  toVersion: number
): DiffResult | null {
  const history = readVersionHistory(deliverableFilePath);
  
  const fromEntry = history.versions.find((v) => v.version === fromVersion);
  const toEntry = history.versions.find((v) => v.version === toVersion);
  
  if (!fromEntry || !toEntry) {
    return null;
  }

  const fileName = path.basename(deliverableFilePath);
  const patch = createTwoFilesPatch(
    fileName,
    fileName,
    fromEntry.content,
    toEntry.content,
    `v${fromVersion}`,
    `v${toVersion}`
  );

  const hunks = parseDiffPatch(patch);
  
  // Calculate stats
  let additions = 0;
  let deletions = 0;
  
  for (const hunk of hunks) {
    for (const line of hunk.lines) {
      if (line.type === "added") additions++;
      if (line.type === "removed") deletions++;
    }
  }

  return {
    fromVersion,
    toVersion,
    fromTimestamp: fromEntry.timestamp,
    toTimestamp: toEntry.timestamp,
    hunks,
    stats: {
      additions,
      deletions,
      changes: additions + deletions,
    },
  };
}

export function generateDiffFromStrings(
  oldContent: string,
  newContent: string,
  fileName: string = "file.md"
): DiffResult {
  const patch = createTwoFilesPatch(
    fileName,
    fileName,
    oldContent,
    newContent,
    "previous",
    "current"
  );

  const hunks = parseDiffPatch(patch);
  
  // Calculate stats
  let additions = 0;
  let deletions = 0;
  
  for (const hunk of hunks) {
    for (const line of hunk.lines) {
      if (line.type === "added") additions++;
      if (line.type === "removed") deletions++;
    }
  }

  return {
    fromVersion: 0,
    toVersion: 0,
    fromTimestamp: "",
    toTimestamp: new Date().toISOString(),
    hunks,
    stats: {
      additions,
      deletions,
      changes: additions + deletions,
    },
  };
}

export function getVersionHistoryList(
  deliverableFilePath: string
): Array<{ version: number; timestamp: string; updatedBy: string; comment?: string }> {
  const history = readVersionHistory(deliverableFilePath);
  return history.versions.map((v) => ({
    version: v.version,
    timestamp: v.timestamp,
    updatedBy: v.updatedBy,
    comment: v.comment,
  }));
}

export function initializeVersionHistory(
  deliverableFilePath: string,
  currentContent: string,
  agentName: string
): void {
  const history = readVersionHistory(deliverableFilePath);
  
  // Only initialize if no versions exist
  if (history.versions.length === 0) {
    addVersion(
      deliverableFilePath,
      currentContent,
      agentName,
      "Initial version"
    );
  }
}