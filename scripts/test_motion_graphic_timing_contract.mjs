#!/usr/bin/env node
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const repoRoot = process.cwd();
const stageWorker = path.join(repoRoot, "scripts", "short-form-stage-worker.mjs");
const motionGraphicsSource = fs.readFileSync(path.join(repoRoot, "src/lib/short-form-motion-graphics.ts"), "utf-8");
const visualPlanningSource = fs.readFileSync(path.join(repoRoot, "src/lib/short-form-xml-visual-planning-settings.ts"), "utf-8");
const soundDesignSource = fs.readFileSync(path.join(repoRoot, "src/lib/short-form-sound-design.ts"), "utf-8");
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "motion-graphic-timing-contract-"));

try {
  const xmlPath = path.join(tempDir, "timed-motion-graphics.xml");
  fs.writeFileSync(xmlPath, `
<video>
  <assets>
    <motionGraphic id="timed" templateId="bar_chart">
      <arg name="title" animateIn="0.20">Timed chart</arg>
      <timing item="cause" at="0.35" />
      <timing item="effect" time="1.70" />
      <item label="A" value="35" displayValue="35%" animateIn="0.62" />
      <item label="B" value="68" displayValue="68%" revealAt="1.24" />
      <step label="01" startAt="0.50">First step</step>
      <line size="large" at="0.70">First line</line>
      <blankLine time="1.10" />
    </motionGraphic>
  </assets>
</video>
`, "utf-8");

  const parseResult = spawnSync(process.execPath, [stageWorker, xmlPath], {
    cwd: repoRoot,
    encoding: "utf-8",
    env: { ...process.env, SHORT_FORM_STAGE_WORKER_PARSE_MOTION_GRAPHICS_TEST: "1" },
  });
  assert.equal(parseResult.status, 0, parseResult.stderr || parseResult.stdout);
  const parsedMotionGraphics = JSON.parse(parseResult.stdout);
  assert.deepEqual(parsedMotionGraphics[0].args.animationTimings, {
    title: 0.2,
    data: [0.62, 1.24],
    steps: [0.5],
    lines: [0.7, 1.1],
    cause: 0.35,
    effect: 1.7,
  });
  assert.equal(parsedMotionGraphics[0].args.data[0].animateIn, 0.62);
  assert.equal(parsedMotionGraphics[0].args.steps[0].animateIn, 0.5);
  assert.equal(parsedMotionGraphics[0].args.lines[0].animateIn, 0.7);

  assert.match(motionGraphicsSource, /Controllable animation-in timing items:/, "Scribe motion graphic prompt injection must list controllable timing items per template.");
  assert.match(motionGraphicsSource, /<timing item=\\"title\\" at=\\"0\.20\\"/, "Scribe prompt injection must document named timing controls.");
  assert.match(motionGraphicsSource, /Items that visually belong together[\s\S]*animate together/, "Scribe prompt injection must explain grouped item timing.");
  assert.match(visualPlanningSource, /animateIn=\\"seconds\\" on <item>, <step>, or <line>/, "XML visual planning prompt must document local item timing attributes.");
  assert.match(visualPlanningSource, /relative to the start of that motion_graphic visual/, "XML visual planning prompt must distinguish local timing from absolute timestamps.");

  assert.match(soundDesignSource, /const repeatItem = visibleRepeatItems\(args, cue\.repeat\.source\)\[index\]/, "Deterministic repeated SFX must align to visible timed data/step/line items.");
  assert.match(soundDesignSource, /cue\.id === "line-finish" && key === "chart"[\s\S]*return cueTiming \+ 3/, "Line-growth finish SFX must remain aligned to explicit chart animation timing.");
  assert.match(soundDesignSource, /"cause-card": \["cause"\][\s\S]*"effect-card": \["effect"\]/, "Deterministic SFX aliases must include named motion core items.");

  console.log("motion graphic timing contract: ok");
} finally {
  fs.rmSync(tempDir, { recursive: true, force: true });
}
