#!/usr/bin/env node
/**
 * Initialize version history for existing deliverables.
 *
 * Walks all deliverable files (x-posts, research, generic) and creates
 * a -versions.json with the current content as v1 for files that:
 *   - Don't already have a -versions.json
 *   - Have a status log showing at least one revision cycle
 *
 * Usage:
 *   npx tsx scripts/init-versions.ts
 *   npx tsx scripts/init-versions.ts --dry-run
 */

import fs from "fs";
import path from "path";

const BUSINESS_ROOT = path.join(
  process.env.HOME || "/Users/ittaisvidler",
  "tenxsolo",
  "business"
);

interface StatusLogEntry {
  timestamp: string;
  from: string;
  to: string;
  by: string;
  note: string;
}

interface StatusLog {
  logs: StatusLogEntry[];
}

interface VersionEntry {
  version: number;
  timestamp: string;
  content: string;
  updatedBy: string;
  comment?: string;
}

interface VersionHistory {
  currentVersion: number;
  versions: VersionEntry[];
}

function findMarkdownFiles(dir: string): string[] {
  const files: string[] = [];
  if (!fs.existsSync(dir)) return files;

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...findMarkdownFiles(fullPath));
    } else if (
      entry.name.endsWith(".md") &&
      !entry.name.startsWith(".") &&
      entry.name !== "README.md" &&
      entry.name !== entry.name.toUpperCase()
    ) {
      files.push(fullPath);
    }
  }
  return files;
}

function getStatusLogPath(filePath: string): string {
  const dir = path.dirname(filePath);
  const base = path.basename(filePath, ".md");
  return path.join(dir, `${base}-status-log.json`);
}

function getVersionsPath(filePath: string): string {
  const dir = path.dirname(filePath);
  const base = path.basename(filePath, ".md");
  return path.join(dir, `${base}-versions.json`);
}

function readStatusLog(filePath: string): StatusLog {
  const logPath = getStatusLogPath(filePath);
  if (!fs.existsSync(logPath)) return { logs: [] };
  try {
    const parsed = JSON.parse(fs.readFileSync(logPath, "utf-8"));
    if (!parsed || !Array.isArray(parsed.logs)) return { logs: [] };
    return parsed;
  } catch {
    return { logs: [] };
  }
}

/**
 * Check if the status log shows at least one revision cycle:
 * any transition TO "needs review" after the file was first created
 * (indicating it went through feedback and was resubmitted)
 */
function hasRevisionCycle(statusLog: StatusLog): boolean {
  const logs = statusLog.logs;
  if (logs.length < 2) return false;

  // Look for: requested changes -> needs review (a revision cycle)
  for (const entry of logs) {
    if (
      entry.from === "requested changes" &&
      entry.to === "needs review"
    ) {
      return true;
    }
  }
  return false;
}

function inferAgent(filePath: string): string {
  if (filePath.includes("market-research")) return "echo";
  if (filePath.includes("content")) return "scribe";
  if (filePath.includes("engineering")) return "ralph";
  if (filePath.includes("strategy")) return "oracle";
  if (filePath.includes("operations")) return "clerk";
  return "unknown";
}

function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");

  console.log("📦 Version History Initialization");
  console.log("==================================");
  if (dryRun) {
    console.log("🏃 DRY RUN MODE - No files will be created\n");
  } else {
    console.log("⚠️  LIVE MODE - Version files will be created\n");
  }

  const deliverableDirs = [
    path.join(BUSINESS_ROOT, "market-research", "deliverables"),
    path.join(BUSINESS_ROOT, "content", "deliverables"),
    path.join(BUSINESS_ROOT, "engineering", "deliverables"),
    path.join(BUSINESS_ROOT, "strategy", "deliverables"),
    path.join(BUSINESS_ROOT, "operations", "deliverables"),
  ];

  let created = 0;
  let skippedNoLog = 0;
  let skippedExisting = 0;
  let skippedNoRevision = 0;

  for (const dir of deliverableDirs) {
    if (!fs.existsSync(dir)) {
      console.log(`⏭️  Skipping (not found): ${dir}`);
      continue;
    }

    console.log(`\n📁 Scanning: ${path.relative(BUSINESS_ROOT, dir)}`);
    const files = findMarkdownFiles(dir);

    for (const filePath of files) {
      const versionsPath = getVersionsPath(filePath);
      const relPath = path.relative(BUSINESS_ROOT, filePath);

      // Skip if versions already exist
      if (fs.existsSync(versionsPath)) {
        console.log(`   ⏭️  Already has versions: ${relPath}`);
        skippedExisting++;
        continue;
      }

      // Read status log
      const statusLog = readStatusLog(filePath);

      // Skip if no status log
      if (statusLog.logs.length === 0) {
        console.log(`   ⏭️  No status log: ${relPath}`);
        skippedNoLog++;
        continue;
      }

      // Skip if no revision cycle
      if (!hasRevisionCycle(statusLog)) {
        console.log(`   ⏭️  No revision cycle: ${relPath}`);
        skippedNoRevision++;
        continue;
      }

      // Create version history with current content as v1
      const content = fs.readFileSync(filePath, "utf-8");
      const agent = inferAgent(filePath);

      const history: VersionHistory = {
        currentVersion: 1,
        versions: [
          {
            version: 1,
            timestamp: new Date().toISOString(),
            content,
            updatedBy: agent,
            comment: "Initial version (migrated from existing content)",
          },
        ],
      };

      if (!dryRun) {
        fs.writeFileSync(versionsPath, JSON.stringify(history, null, 2), "utf-8");
      }

      console.log(`   ✨ Created v1: ${relPath}`);
      created++;
    }
  }

  console.log("\n==================================");
  console.log("📊 Summary");
  console.log("==================================");
  console.log(`   Created: ${created}`);
  console.log(`   Skipped (already has versions): ${skippedExisting}`);
  console.log(`   Skipped (no status log): ${skippedNoLog}`);
  console.log(`   Skipped (no revision cycle): ${skippedNoRevision}`);

  if (dryRun) {
    console.log("\n🏃 This was a dry run. No files were created.");
    console.log("   Run without --dry-run to apply changes.");
  }
}

main();
