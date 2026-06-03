#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

const repoRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const workerSource = fs.readFileSync(path.join(repoRoot, "scripts", "short-form-stage-worker.mjs"), "utf-8");
const rendererSource = fs.readFileSync(path.join(repoRoot, "scripts", "render_animated_caption_overlays.py"), "utf-8");

assert.match(workerSource, /function shiftCaptionTimeline/, "Final render worker must shift caption timeline timing.");
assert.match(workerSource, /timingOffsetMs/, "Final render worker must read and persist timingOffsetMs.");
assert.match(workerSource, /animationStart/, "Final render worker must preserve unclamped shifted word timing for animation progress.");
assert.match(rendererSource, /animationStart/, "Animated overlay renderer must use unclamped shifted word timing for animation progress.");
assert.match(workerSource, /const offsetAwareSuppressionRanges = buildOffsetAwareCaptionSuppressionRanges\(suppressionRanges, timingOffsetMs\);\s*const effectiveSuppressionRanges = buildEffectiveCaptionSuppressionRanges\(suppressionRanges, timingOffsetMs\);\s*const suppressedTimeline = suppressCaptionTimelineForRanges\(timeline, effectiveSuppressionRanges\);\s*const captionTimeline = shiftCaptionTimeline\(suppressedTimeline, timingOffsetMs\)/s, "Final render must suppress original and offset-aware motion-graphic caption ranges before applying the timing offset.");
assert.match(rendererSource, /"timingOffsetMs": normalize_int/, "Animated overlay renderer must normalize timingOffsetMs in config JSON.");

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "caption-offset-"));
const timelinePath = path.join(tempDir, "timeline.json");
const outputDir = path.join(tempDir, "overlays");
const animationConfig = {
  version: 1,
  layoutMode: "stable",
  timing: {
    mode: "fixed",
    multiplier: 1,
    minMs: 120,
    maxMs: 240,
    fixedMs: 180,
    timingOffsetMs: -130,
  },
  colors: {
    outlineColorMode: "style-outline",
    shadowColorMode: "style-shadow",
    glowColorMode: "style-active-word",
  },
  motion: {
    scale: { keyframes: [{ time: 0, value: 1 }, { time: 1, value: 1 }] },
    translateXEm: { keyframes: [{ time: 0, value: 0 }, { time: 1, value: 0 }] },
    translateYEm: { keyframes: [{ time: 0, value: 0 }, { time: 1, value: 0 }] },
    extraOutlineWidth: { keyframes: [{ time: 0, value: 0 }, { time: 1, value: 0 }] },
    extraBlur: { keyframes: [{ time: 0, value: 0 }, { time: 1, value: 0 }] },
    glowStrength: { keyframes: [{ time: 0, value: 0 }, { time: 1, value: 0 }] },
    shadowOpacityMultiplier: { keyframes: [{ time: 0, value: 1 }, { time: 1, value: 1 }] },
  },
};

fs.writeFileSync(
  timelinePath,
  JSON.stringify({
    captions: [{
      id: "caption-1",
      index: 1,
      text: "offset test",
      start: 0.2,
      end: 0.8,
      words: [
        { text: "offset", start: 0.2, end: 0.45 },
        { text: "test", start: 0.45, end: 0.8 },
      ],
    }],
  }),
  "utf-8",
);

const result = spawnSync("uv", [
  "run",
  "--with",
  "pillow",
  "python3",
  path.join(repoRoot, "scripts", "render_animated_caption_overlays.py"),
  "--timeline-json",
  timelinePath,
  "--output-dir",
  outputDir,
  "--animation-config-json",
  JSON.stringify(animationConfig),
  "--fps",
  "12",
], { encoding: "utf-8" });

assert.equal(result.status, 0, result.stderr || result.stdout);
const manifest = JSON.parse(fs.readFileSync(path.join(outputDir, "manifest.json"), "utf-8"));
assert.equal(manifest.animationConfig.timing.timingOffsetMs, -130);

const clampedTimelinePath = path.join(tempDir, "clamped-timeline.json");
const clampedOutputDir = path.join(tempDir, "clamped-overlays");
fs.writeFileSync(
  clampedTimelinePath,
  JSON.stringify({
    captions: [{
      id: "caption-1",
      index: 1,
      text: "You can make",
      start: 0,
      end: 0.29,
      animationStart: -0.11,
      animationEnd: 0.29,
      words: [
        { text: "You", start: 0, end: 0.01, animationStart: -0.11, animationEnd: -0.03 },
        { text: "can", start: 0, end: 0.13, animationStart: -0.03, animationEnd: 0.13 },
        { text: "make", start: 0.13, end: 0.29, animationStart: 0.13, animationEnd: 0.29 },
      ],
    }],
  }),
  "utf-8",
);

const clampedResult = spawnSync("uv", [
  "run",
  "--with",
  "pillow",
  "python3",
  path.join(repoRoot, "scripts", "render_animated_caption_overlays.py"),
  "--timeline-json",
  clampedTimelinePath,
  "--output-dir",
  clampedOutputDir,
  "--animation-config-json",
  JSON.stringify(animationConfig),
  "--fps",
  "30",
], { encoding: "utf-8" });

assert.equal(clampedResult.status, 0, clampedResult.stderr || clampedResult.stdout);
const clampedManifest = JSON.parse(fs.readFileSync(path.join(clampedOutputDir, "manifest.json"), "utf-8"));
const firstFrame = clampedManifest.entries.find((entry) => entry.frameIndex === 0);
const secondFrame = clampedManifest.entries.find((entry) => entry.frameIndex === 1);
assert.equal(firstFrame.activeIndex, 0, "The first frame should still show the first word as active.");
assert.ok(firstFrame.progress > 0.5, `The first word should render the tail of its animation, got ${firstFrame.progress}.`);
assert.equal(secondFrame.activeIndex, 1, "The second frame should advance to the second word.");
assert.ok(secondFrame.progress > 0.4, `The second word should animate from unclamped shifted timing, got ${secondFrame.progress}.`);

const boundaryTimelinePath = path.join(tempDir, "boundary-timeline.json");
const boundaryOutputDir = path.join(tempDir, "boundary-overlays");
fs.writeFileSync(
  boundaryTimelinePath,
  JSON.stringify({
    captions: [
      {
        id: "caption-1",
        index: 1,
        text: "previous caption",
        start: 0,
        end: 0.29,
        words: [
          { text: "previous", start: 0, end: 0.16 },
          { text: "caption", start: 0.16, end: 0.29 },
        ],
      },
      {
        id: "caption-2",
        index: 2,
        text: "next caption",
        start: 0.29,
        end: 0.7,
        words: [
          { text: "next", start: 0.29, end: 0.46 },
          { text: "caption", start: 0.46, end: 0.7 },
        ],
      },
    ],
  }),
  "utf-8",
);

const boundaryResult = spawnSync("uv", [
  "run",
  "--with",
  "pillow",
  "python3",
  path.join(repoRoot, "scripts", "render_animated_caption_overlays.py"),
  "--timeline-json",
  boundaryTimelinePath,
  "--output-dir",
  boundaryOutputDir,
  "--animation-config-json",
  JSON.stringify(animationConfig),
  "--fps",
  "30",
], { encoding: "utf-8" });

assert.equal(boundaryResult.status, 0, boundaryResult.stderr || boundaryResult.stdout);
const boundaryManifest = JSON.parse(fs.readFileSync(path.join(boundaryOutputDir, "manifest.json"), "utf-8"));
const frameCounts = new Map();
for (const entry of boundaryManifest.entries) {
  frameCounts.set(entry.frameIndex, (frameCounts.get(entry.frameIndex) || 0) + 1);
}
assert.equal([...frameCounts.values()].filter((count) => count > 1).length, 0, "Boundary rendering should emit at most one overlay per frame.");
assert.equal(boundaryManifest.entries.find((entry) => entry.frameIndex === 8)?.captionIndex, 1, "Frame 8 midpoint should keep the previous caption.");
assert.equal(boundaryManifest.entries.find((entry) => entry.frameIndex === 9)?.captionIndex, 2, "Frame 9 midpoint should advance to the next caption.");

console.log("caption timing offset: ok");
