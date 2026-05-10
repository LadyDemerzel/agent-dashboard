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
const rendererSource = fs.readFileSync(
  path.join(repoRoot, "scripts/render-motion-graphic.mjs"),
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
assert.match(
  motionGraphicsSource,
  /name:\s*"units"/,
  "Line growth chart template must expose optional counter units to Scribe.",
);
assert.match(
  motionGraphicsSource,
  /<arg name=\\"units\\">homes<\/arg>/,
  "Scribe prompt injection must document line_growth_chart counter units.",
);
assert.match(
  motionGraphicsSource,
  /displayName:\s*"Checklist"/,
  "Checklist template display name must be generalized.",
);
assert.match(
  motionGraphicsSource,
  /rendererId:\s*"checklist"/,
  "Checklist template must use the generalized renderer id while preserving legacy aliases separately.",
);
assert.match(
  motionGraphicsSource,
  /name:\s*"items"[\s\S]*label:\s*"Checklist items"/,
  "Checklist configurable field must use generalized item language.",
);
assert.doesNotMatch(
  motionGraphicsSource,
  /Step checklist|Checklist steps|Start step|Future step state|future-step/i,
  "Checklist settings and prompt-facing copy must not use step-specific checklist language.",
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
assert.doesNotMatch(
  stageWorkerSource,
  /rendererId:\s*collapseWhitespace\(attributes\.rendererId\)\s*\|\|\s*templateId/,
  "Motion graphic XML parsing must not treat template ids as renderer ids when rendererId is omitted.",
);
assert.match(
  stageWorkerSource,
  /function resolveMotionGraphicRendererId/,
  "Motion graphic renders must resolve renderer ids through explicit valid ids, settings templates, and legacy aliases.",
);
assert.match(
  stageWorkerSource,
  /motion_graphic_renderer_id:\s*mergedConfig\.rendererId/,
  "Scene manifest entries must persist the resolved renderer id used for rendering.",
);
assert.match(
  rendererSource,
  /\["good-bad-indicator",\s*"good_bad_indicator"\]/,
  "Renderer CLI must map the good-bad-indicator template id to the good_bad_indicator renderer.",
);
assert.match(
  rendererSource,
  /function resolveRendererKey/,
  "Renderer CLI must normalize known template ids before dispatching to renderer implementations.",
);

console.log("motion graphics duration contract: ok");
