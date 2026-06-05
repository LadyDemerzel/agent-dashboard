#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const motionGraphicsSource = fs.readFileSync(
  path.join(repoRoot, "src/lib/short-form-motion-graphics.ts"),
  "utf-8",
);
const visualPlanningSource = fs.readFileSync(
  path.join(repoRoot, "src/lib/short-form-xml-visual-planning-settings.ts"),
  "utf-8",
);
const stageWorkerSource = fs.readFileSync(
  path.join(repoRoot, "scripts/short-form-stage-worker.mjs"),
  "utf-8",
);
const rendererSource = fs.readFileSync(
  path.join(repoRoot, "scripts/render-hyperframes-motion-graphic.mjs"),
  "utf-8",
);
const settingsViewSource = fs.readFileSync(
  path.join(repoRoot, "src/components/short-form-video/ShortFormVideoSettingsView.tsx"),
  "utf-8",
);
const settingsPageSource = fs.readFileSync(
  path.join(repoRoot, "src/app/short-form-video/settings/[section]/page.tsx"),
  "utf-8",
);
const motionGraphicsPreviewFileRouteSource = fs.readFileSync(
  path.join(repoRoot, "src/app/api/short-form-videos/settings/motion-graphics-previews/[...filePath]/route.ts"),
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
  /additionalUsageInstructions:\s*string/,
  "MotionGraphicTemplateConfig must include editable additional usage instructions.",
);
assert.match(
  motionGraphicsSource,
  /Additional usage instructions:/,
  "Scribe prompt injection must include filled additional usage instructions.",
);
assert.match(
  motionGraphicsSource,
  /Timeline step labels should all belong to the same semantic category of abstraction/,
  "Timeline template must include the semantic-label usage instruction by default.",
);
assert.match(
  motionGraphicsSource,
  /additionalUsageInstructions:\s*template\.additionalUsageInstructions\s*\|\|\s*"None\."/,
  "Blank additional usage instructions must render through the editable individual-template prompt with a neutral fallback.",
);
assert.match(
  motionGraphicsSource,
  /name:\s*"units"/,
  "Line growth chart template must expose optional counter units to Scribe.",
);
assert.match(
  visualPlanningSource,
  /<arg name=\\"units\\">homes<\/arg>/,
  "Editable XML visual-planning guidance must document line_growth_chart counter units.",
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
  stageWorkerSource,
  /render-hyperframes-motion-graphic\.mjs/,
  "Generate Visuals must render motion graphics through the HyperFrames renderer.",
);
assert.match(
  rendererSource,
  /rendererEngine:\s*"hyperframes"/,
  "Renderer CLI must report HyperFrames as the motion graphic render engine.",
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
assert.match(
  settingsViewSource,
  /motionTemplatePreviewRequestIdsRef/,
  "Motion graphics preview requests must track latest request ids so stale or aborted renders cannot leave stuck loading state.",
);
assert.match(
  settingsViewSource,
  /err instanceof DOMException && err\.name === "AbortError"[\s\S]*isLoading: false/,
  "Aborted motion graphics preview requests must clear loading state when they are still the latest request.",
);
assert.match(
  settingsViewSource,
  /selectedTemplate = motionGraphicsSettings\.templates\.find[\s\S]*requestMotionTemplatePreview\(selectedTemplate/,
  "Generate Visuals settings must auto-render only the selected motion graphics template instead of kicking off the full gallery.",
);
assert.doesNotMatch(
  settingsViewSource,
  /for \(const template of (?:orderedTemplates|motionGraphicsSettings\.templates)\)/,
  "Generate Visuals settings must not auto-render every motion graphics template in a background loop.",
);
assert.doesNotMatch(
  motionGraphicsPreviewFileRouteSource,
  /Readable\.toWeb/,
  "Motion graphics preview file serving must not use Readable.toWeb, which can throw Controller already closed when preview media requests are aborted.",
);
assert.match(
  motionGraphicsPreviewFileRouteSource,
  /fs\.promises\.readFile/,
  "Motion graphics preview file serving should return a buffered response for small preview assets.",
);
assert.match(
  settingsPageSource,
  /const initialSettings =[\s\S]*getShortFormSettingsPayload\(\)[\s\S]*initialSettings=\{initialSettings\}/,
  "Short-form settings pages must pass server-loaded initial settings into the client view.",
);
assert.match(
  settingsViewSource,
  /useState\(!initialSettings\)/,
  "Short-form settings view must not show first-load skeletons when server initial settings are available.",
);
assert.match(
  settingsViewSource,
  /fallbackData: initialSettings/,
  "Short-form settings SWR must reuse server initial settings before background revalidation.",
);

console.log("motion graphics duration contract: ok");
