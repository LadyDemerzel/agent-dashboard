#!/usr/bin/env node
import assert from "node:assert/strict";
import path from "node:path";
import {
  buildCaptionOverlayFramePlan,
  formatCaptionOverlayFrameAudit,
} from "./short-form-caption-overlay-track.mjs";

const outputDir = "/tmp/caption-overlays-animated";
const blankOverlayPath = path.join(outputDir, "blank-overlay.png");
const plan = buildCaptionOverlayFramePlan({
  outputDir,
  blankOverlayPath,
  totalDurationSeconds: 4,
  fps: 30,
  entries: [
    { relativePath: "before.png", start: 0.2, end: 0.233, frameIndex: 6 },
    { relativePath: "after.png", start: 3.2, end: 3.233, frameIndex: 96 },
  ],
});

assert.equal(plan.frameCount, 120);
assert.equal(plan.frames[6].source, "before.png");
assert.equal(plan.frames[45].source, "blank");
assert.equal(plan.frames[45].path, blankOverlayPath);
assert.equal(plan.frames[90].source, "blank");
assert.equal(plan.frames[96].source, "after.png");

const audit = formatCaptionOverlayFrameAudit(plan);
assert.match(audit, /frame 000045 start 1\.500 end 1\.533 .*source blank/);
assert.match(audit, /frame 000096 start 3\.200 end 3\.233 .*source after\.png/);

console.log("caption overlay track suppressed-gap timing: ok");
