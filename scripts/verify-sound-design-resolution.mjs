#!/usr/bin/env node
import fs from "fs";
import path from "path";

const HOME_DIR = process.env.HOME || "/Users/ittaisvidler";
const projectId = process.argv[2];
if (!projectId) {
  console.error("Usage: node scripts/verify-sound-design-resolution.mjs <project-id>");
  process.exit(2);
}

const projectDir = path.join(
  HOME_DIR,
  "tenxsolo",
  "business",
  "content",
  "deliverables",
  "short-form-videos",
  projectId,
);
const resolutionPath = path.join(projectDir, "output", "sound-design-work", "resolution.json");
if (!fs.existsSync(resolutionPath)) {
  console.error(`Missing sound-design resolution: ${resolutionPath}`);
  process.exit(1);
}

const resolution = JSON.parse(fs.readFileSync(resolutionPath, "utf-8"));
const events = Array.isArray(resolution.events) ? resolution.events : [];
const assetCounts = new Map();
const typeCounts = new Map();
for (const event of events) {
  typeCounts.set(event.type, (typeCounts.get(event.type) || 0) + 1);
  assetCounts.set(event.assetId || "<none>", (assetCounts.get(event.assetId || "<none>") || 0) + 1);
}

const maxConcurrentOneShots = Math.max(1, Math.round(Number(resolution.mixSettings?.maxConcurrentOneShots) || 2));
const activeOneShots = events.filter((event) =>
  event?.status === "resolved"
  && !event.muted
  && event.timingType !== "bed"
  && event.assetRelativePath
);
const checkpoints = new Set();
for (const event of activeOneShots) {
  const start = Math.max(0, Number(event.resolvedStartSeconds) || 0);
  const end = Number.isFinite(Number(event.resolvedEndSeconds))
    ? Math.max(start + 0.01, Number(event.resolvedEndSeconds))
    : start + Math.max(0.05, Number(event.durationSeconds) || 0.6);
  checkpoints.add(start);
  checkpoints.add(end);
}
let observedMaxConcurrent = 0;
for (const time of [...checkpoints].sort((a, b) => a - b)) {
  const concurrent = activeOneShots.filter((event) => {
    const start = Math.max(0, Number(event.resolvedStartSeconds) || 0);
    const end = Number.isFinite(Number(event.resolvedEndSeconds))
      ? Math.max(start + 0.01, Number(event.resolvedEndSeconds))
      : start + Math.max(0.05, Number(event.durationSeconds) || 0.6);
    return start < time + 0.001 && end > time - 0.001;
  }).length;
  observedMaxConcurrent = Math.max(observedMaxConcurrent, concurrent);
}

const distinctAssets = assetCounts.size;
const allSameAsset = events.length > 1 && distinctAssets === 1;
const allImpact = events.length > 1 && typeCounts.size === 1 && typeCounts.has("impact");
const exceedsConcurrency = observedMaxConcurrent > maxConcurrentOneShots;

console.log(JSON.stringify({
  projectId,
  events: events.length,
  resolved: events.filter((event) => event.status === "resolved").length,
  unresolved: events.filter((event) => event.status !== "resolved").length,
  muted: events.filter((event) => event.muted).length,
  typeCounts: Object.fromEntries([...typeCounts].sort()),
  assetCounts: Object.fromEntries([...assetCounts].sort()),
  maxConcurrentOneShots,
  observedMaxConcurrent,
}, null, 2));

if (!events.length) {
  console.error("No resolved sound-design events found.");
  process.exit(1);
}
if (allImpact) {
  console.error("Every event resolved as impact; concrete asset type parsing is still broken.");
  process.exit(1);
}
if (allSameAsset) {
  console.error("Every event resolved to one asset; concrete asset selection is still broken.");
  process.exit(1);
}
if (exceedsConcurrency) {
  console.error(`Observed ${observedMaxConcurrent} concurrent one-shot cues, exceeding limit ${maxConcurrentOneShots}.`);
  process.exit(1);
}
