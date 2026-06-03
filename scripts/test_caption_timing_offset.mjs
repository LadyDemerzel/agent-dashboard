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

console.log("caption timing offset: ok");
