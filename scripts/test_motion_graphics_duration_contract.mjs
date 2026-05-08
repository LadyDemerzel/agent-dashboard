#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const motionGraphicsSource = fs.readFileSync(
  path.join(repoRoot, "src/lib/short-form-motion-graphics.ts"),
  "utf-8",
);
const stageWorkerSource = fs.readFileSync(
  path.join(repoRoot, "scripts/short-form-stage-worker.mjs"),
  "utf-8",
);

assert.match(
  motionGraphicsSource,
  /durationGuidance:\s*string/,
  "MotionGraphicTemplateConfig must include durationGuidance.",
);
assert.match(
  motionGraphicsSource,
  /Duration guidance:/,
  "Scribe prompt injection must include duration guidance text.",
);
assert.doesNotMatch(
  motionGraphicsSource,
  new RegExp(["durationSeconds", "default"].join(" ")),
  "Scribe prompt injection must not expose template duration defaults.",
);
assert.doesNotMatch(
  stageWorkerSource,
  /visual\.asset\.durationSeconds\s*\|\||template\?\.durationSeconds\s*\|\||durationSeconds:\s*visualDuration\s*\|\|/,
  "Real motion graphic renders must not fall back to asset/template/default duration.",
);
assert.match(
  stageWorkerSource,
  /requires valid start and end times with end greater than start/,
  "Real motion graphic renders must fail clearly when visual start/end are invalid.",
);

console.log("motion graphics duration contract: ok");
