#!/usr/bin/env node
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const motionGraphicsPath = path.join(repoRoot, "src/lib/short-form-motion-graphics.ts");
const soundDesignPath = path.join(repoRoot, "src/lib/short-form-sound-design.ts");
const soundSettingsPath = path.join(repoRoot, "src/lib/short-form-sound-design-settings.ts");
const workflowRoutePath = path.join(repoRoot, "src/app/api/short-form-videos/[id]/workflow/[stage]/route.ts");

const motionGraphics = fs.readFileSync(motionGraphicsPath, "utf-8");
const soundDesign = fs.readFileSync(soundDesignPath, "utf-8");
const soundSettings = fs.readFileSync(soundSettingsPath, "utf-8");
const workflowRoute = fs.readFileSync(workflowRoutePath, "utf-8");

function assert(condition, message) {
  if (!condition) {
    console.error(message);
    process.exit(1);
  }
}

const templateIds = [
  "stat_reveal",
  "bar_chart",
  "pie_chart",
  "line_growth_chart",
  "comparison_before_after",
  "timeline",
  "cause_effect",
  "caption_word_wall",
  "ranked_podium",
  "checklist",
  "scorecard",
  "research_paper_card",
  "good-bad-indicator",
];

for (const id of templateIds) {
  const idPattern = id === "checklist"
    ? "id: CHECKLIST_TEMPLATE_ID"
    : id === "good-bad-indicator"
      ? "id: GOOD_BAD_INDICATOR_TEMPLATE_ID"
      : `id: ${JSON.stringify(id)}`;
  const templateMatch = motionGraphics.match(new RegExp(`${idPattern.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}[\\s\\S]*?enabled: true,`));
  assert(templateMatch, `Missing default motion graphic template ${id}.`);
  assert(templateMatch[0].includes("deterministicSoundEffects"), `Template ${id} has no deterministicSoundEffects cues.`);
}

for (const phrase of [
  "Motion-graphic boundary rule",
  "Motion-graphic interior rule",
  "never add your own non-music/non-ambience SFX inside the interior of motion_graphic scenes/segments",
]) {
  assert(soundSettings.includes(phrase), `Sound-design settings prompt is missing: ${phrase}`);
}

assert(workflowRoute.includes("buildShortFormSoundDesignPrompt"), "Workflow route sound-design path must use the editable sound-design prompt template builder.");
assert(soundDesign.includes("buildDeterministicMotionGraphicSoundEvents"), "Resolver is missing deterministic motion-graphic event generation.");
assert(soundDesign.includes("mergePlannedAndDeterministicSoundEvents"), "Resolver is missing planned+deterministic event merge.");
assert(soundDesign.includes("deterministic-motion-graphic-internal-sfx"), "Deterministic cues are missing their resolution marker.");
assert(soundDesign.includes("Generated from known template timing, not Scribe planning."), "Deterministic cue rationale does not distinguish renderer-owned cues from Scribe cues.");
assert(soundDesign.includes("findXmlishTagEnd"), "Sound-design music segment parsing must use a quoted-attribute-aware XML-ish tag scanner.");
assert(soundDesign.includes("planned-music-segments-missing"), "Sound-design QA must fail when planned music segments are missing from resolution output.");
assert(!soundDesign.includes("block.match(/<segment\\\\b[^>]*\\\\/>/g)"), "Music segment parsing must not use the old fragile segment regex.");

console.log("motion graphic sound-design verification passed");
