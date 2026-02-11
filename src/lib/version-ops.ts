import fs from "fs";
import {
  hasVersions,
  initializeVersionHistory,
  addVersion,
  readVersionHistory,
  writeVersionHistory,
} from "./versions";
import { markOutdatedThreads } from "./feedback";

const MAX_VERSIONS_PER_FILE = 50;
const MAX_CONTENT_SIZE = 5 * 1024 * 1024; // 5MB

export function snapshotVersionOnStatusChange(
  filePath: string,
  oldStatus: string,
  newStatus: string,
  updatedBy: string,
  note?: string
): void {
  // Only snapshot when agent submits updated work
  if (newStatus !== "needs review") return;

  let currentContent: string;
  try {
    currentContent = fs.readFileSync(filePath, "utf-8");
  } catch {
    return; // File doesn't exist, skip
  }

  // Reject oversized content
  if (Buffer.byteLength(currentContent, "utf-8") > MAX_CONTENT_SIZE) {
    return;
  }

  // Initialize version history if first time
  if (!hasVersions(filePath)) {
    initializeVersionHistory(filePath, currentContent, updatedBy);
    return;
  }

  // Add new version
  addVersion(
    filePath,
    currentContent,
    updatedBy,
    note || "Revised based on feedback"
  );

  // Enforce version limit
  const history = readVersionHistory(filePath);
  if (history.versions.length > MAX_VERSIONS_PER_FILE) {
    history.versions = history.versions.slice(-MAX_VERSIONS_PER_FILE);
    writeVersionHistory(filePath, history);
  }

  // Mark any outdated threads
  markOutdatedThreads(filePath);
}
