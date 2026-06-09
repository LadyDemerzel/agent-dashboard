#!/usr/bin/env node
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const repoRoot = process.cwd();
const stageWorker = path.join(repoRoot, "scripts", "short-form-stage-worker.mjs");
const motionGraphicsSource = fs.readFileSync(path.join(repoRoot, "src/lib/short-form-motion-graphics.ts"), "utf-8");
const motionGraphicsSettingsSource = fs.readFileSync(path.join(repoRoot, "settings/short-form-video/_motion-graphics-settings.json"), "utf-8");
const timingControlsSource = fs.readFileSync(path.join(repoRoot, "src/lib/short-form-motion-graphic-timing-controls.ts"), "utf-8");
const visualPlanningSource = fs.readFileSync(path.join(repoRoot, "src/lib/short-form-xml-visual-planning-settings.ts"), "utf-8");
const soundDesignSource = fs.readFileSync(path.join(repoRoot, "src/lib/short-form-sound-design.ts"), "utf-8");
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "motion-graphic-timing-contract-"));

try {
  const xmlPath = path.join(tempDir, "timed-motion-graphics.xml");
  fs.writeFileSync(xmlPath, `
<video>
  <assets></assets>
  <timeline>
    <visual id="visual-1" label="Timed chart" start="10.00" end="12.00" visualType="motion_graphic">
      <motionGraphic templateId="bar_chart">
        <arg name="title" animateIn="10.20">Timed chart</arg>
        <timing item="cause" at="10.35" />
        <timing item="effect" time="11.70" />
        <item label="A" value="35" displayValue="35%" animateIn="10.62" />
        <item label="B" value="68" displayValue="68%" revealAt="11.24" />
        <step label="01" startAt="10.50">First step</step>
        <line size="large" at="10.70">First line</line>
        <blankLine time="11.10" />
      </motionGraphic>
    </visual>
    <visual id="visual-2" label="Caption wall" start="12.00" end="14.00" visualType="motion_graphic">
      <motionGraphic templateId="caption_word_wall">
        <arg name="text">most people miss <large>this part,</large> because <extraLarge>the words</extraLarge> become the visual.</arg>
      </motionGraphic>
    </visual>
  </timeline>
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
  assert.equal(parsedMotionGraphics[1].args.text, "most people miss <large>this part,</large> because <extraLarge>the words</extraLarge> become the visual.");
  assert.equal(parsedMotionGraphics[1].args.lines, undefined);

  assert.match(motionGraphicsSource, /Controllable animation-in timing items:/, "Scribe motion graphic prompt injection must list controllable timing items per template.");
  assert.match(motionGraphicsSource, /formatMotionGraphicAnimationTimingControls\(template\.rendererId\)/, "Scribe motion graphic prompt injection must render timing controls through the shared formatter.");
  assert.match(timingControlsSource, /bar_chart:[\s\S]*each data <item> \/ bar group/, "Bar chart timing controls must describe repeated data items instead of rendering the raw data key.");
  assert.doesNotMatch(timingControlsSource, /bar_chart:[\s\S]*controls:\s*\["title",\s*"data"\]/, "Bar chart timing controls must not regress to raw title/data labels.");
  assert.match(timingControlsSource, /timeline:[\s\S]*each <step> timeline item/, "Timeline timing controls must describe independently timed step items.");
  assert.match(timingControlsSource, /good_bad_indicator:[\s\S]*fields:\s*\["text"\][\s\S]*controls:\s*\["text"\]/, "Good/bad indicator must expose only indicator text as Scribe-controllable timing.");
  assert.match(timingControlsSource, /caption_word_wall:[\s\S]*fields:\s*\["text"\][\s\S]*forced-alignment word reveal\/highlight/, "Caption word wall must expose one text field with forced-alignment word timing.");
  assert.match(motionGraphicsSource, /<step label=\\"DAY 1\\" animateIn=\\"30\.50\\">Setup<\/step>/, "Timeline example XML must show per-step absolute animateIn timing.");
  assert.doesNotMatch(motionGraphicsSource, /<timing item=\\"steps\\" at=\\"30\.50\\"/, "Timeline example XML must not imply all timeline steps share one timing.");
  assert.match(motionGraphicsSource, /Array of \{ label, text, animateIn \} objects/, "Timeline step field guidance must document editable per-step animateIn values.");
  assert.match(motionGraphicsSource, /const animateIn = cleanOptionalNumber/, "Timeline settings normalization must preserve editable per-step animateIn values.");
  assert.match(timingControlsSource, /checklist:[\s\S]*each <step> \/ checklist item/, "Checklist timing controls must describe independently timed checklist step items.");
  assert.match(motionGraphicsSource, /<step animateIn=\\"56\.40\\">Set the baseline<\/step>/, "Checklist example XML must show per-item absolute animateIn timing.");
  assert.doesNotMatch(motionGraphicsSource, /<timing item=\\"items\\" at=\\"56\.40\\"/, "Checklist example XML must not imply all checklist items share one timing.");
  assert.match(motionGraphicsSource, /Use ordered <step animateIn=\\"absolute_video_timestamp_seconds\\">copy<\/step> entries/, "Checklist step field guidance must document editable per-item animateIn values.");
  assert.match(motionGraphicsSource, /<item label=\\"Before\\" value=\\"35\\" displayValue=\\"35%\\" animateIn=\\"12\.90\\" \/>/, "Bar chart example XML must show per-bar animateIn timing.");
  assert.match(motionGraphicsSource, /<item label=\\"Practice\\" value=\\"50\\" displayValue=\\"50%\\" animateIn=\\"12\.85\\" \/>/, "Pie chart example XML must show per-slice animateIn timing.");
  assert.match(motionGraphicsSource, /<step label=\\"01\\" animateIn=\\"49\.40\\">Most visible change<\/step>/, "Ranked podium example XML must show per-rank animateIn timing.");
  assert.match(motionGraphicsSource, /<item label=\\"Clarity\\" value=\\"82\\" displayValue=\\"82\/100\\" animateIn=\\"63\.90\\" \/>/, "Scorecard example XML must show per-row animateIn timing.");
  assert.match(motionGraphicsSource, /<arg name=\\"text\\">most people miss <large>this part,<\/large> because <extraLarge>the words<\/extraLarge> become the visual\.<\/arg>/, "Caption word wall example XML must use one text arg with inline size tags and punctuation.");
  assert.doesNotMatch(motionGraphicsSource, /caption_word_wall:[\s\S]*<line size=/, "Caption word wall instructions/examples must not use line-based rows.");
  assert.match(motionGraphicsSource, /<timing item=\\"arrow\\" at=\\"39\.25\\" \/>/, "Cause/effect example XML must expose the separately controllable arrow timing.");
  assert.match(motionGraphicsSource, /<timing item=\\"paper\\" at=\\"69\.15\\" \/>[\s\S]*<timing item=\\"title\\" at=\\"69\.75\\" \/>/, "Research paper card example XML must expose paper and title timings.");
  assert.doesNotMatch(motionGraphicsSource, /only use one <timing item=\\"(?:data|items|steps)\\"/, "Repeatable motion templates must not tell Scribe to use shared collection timings.");
  assert.doesNotMatch(motionGraphicsSource, /<timing item=\\"data\\" at=\\"(?:12\.85|12\.90|63\.90)\\"/, "Repeated data examples must not imply all data items share one timing.");
  assert.doesNotMatch(motionGraphicsSource, /<timing item=\\"items\\" at=\\"49\.40\\"/, "Ranked podium example XML must not imply all ranks share one timing.");
  assert.doesNotMatch(motionGraphicsSource, /<timing item=\\"line\\" at=\\"18\.80\\"/, "Line growth example should use the canonical chart timing target instead of the legacy line alias.");
  assert.match(motionGraphicsSettingsSource, /"id": "stat_reveal",\s*"rendererId": "stat_reveal"/, "Saved stat_reveal settings must use the stat_reveal renderer, not another renderer id.");
  assert.match(motionGraphicsSettingsSource, /<item label=\\"Before\\" value=\\"35\\" displayValue=\\"35%\\" animateIn=\\"12\.90\\" \/>/, "Saved bar chart example XML must show per-bar animateIn timing.");
  assert.match(motionGraphicsSettingsSource, /<step label=\\"01\\" animateIn=\\"49\.40\\">Most visible change<\/step>/, "Saved ranked podium example XML must show per-rank animateIn timing.");
  assert.match(motionGraphicsSettingsSource, /<item label=\\"Clarity\\" value=\\"82\\" displayValue=\\"82\/100\\" animateIn=\\"63\.90\\" \/>/, "Saved scorecard example XML must show per-row animateIn timing.");
  assert.match(motionGraphicsSettingsSource, /<arg name=\\"text\\">most people miss <large>this part,<\/large> because <extraLarge>the words<\/extraLarge> become the visual\.<\/arg>/, "Saved caption word wall example XML must use one text arg with inline size tags and punctuation.");
  assert.doesNotMatch(motionGraphicsSettingsSource, /<line size=\\"(?:regular|large|extra_large)\\"/, "Saved caption word wall settings must not use line-based caption rows.");
  assert.doesNotMatch(motionGraphicsSettingsSource, /only use one <timing item=\\"(?:data|items|steps)\\"/, "Saved repeatable motion template instructions must not tell Scribe to use shared collection timings.");
  assert.doesNotMatch(motionGraphicsSettingsSource, /<timing item=\\"(?:data|items)\\" at=\\"(?:12\.85|12\.90|49\.40|63\.90)\\"/, "Saved repeated-item examples must not imply shared collection timings.");
  assert.match(visualPlanningSource, /<timing item=\\"title\\" at=\\"12\.20\\"/, "Editable XML visual planning guidance must document named absolute timing controls.");
  assert.match(visualPlanningSource, /Items that visually belong together[\s\S]*animate together/, "Editable XML visual planning guidance must explain grouped item timing.");
  assert.match(visualPlanningSource, /absolute video timestamps/, "XML visual planning prompt must document absolute item timing attributes.");
  assert.match(visualPlanningSource, /not seconds relative to the visual start/, "XML visual planning prompt must reject local timing for new motion graphics.");
  assert.doesNotMatch(visualPlanningSource, /<timing item=\\"(?:icon|rule)\\"/, "Good/bad indicator example must not suggest separate icon/rule timing.");

  assert.match(soundDesignSource, /const repeatItem = visibleRepeatItems\(args, cue\.repeat\.source\)\[index\]/, "Deterministic repeated SFX must align to visible timed data/step/line items.");
  assert.match(soundDesignSource, /cue\.id === "line-finish" && key === "chart"[\s\S]*return cueTiming \+ 3/, "Line-growth finish SFX must remain aligned to explicit chart animation timing.");
  assert.match(soundDesignSource, /"cause-card": \["cause"\][\s\S]*"effect-card": \["effect"\]/, "Deterministic SFX aliases must include named motion core items.");
  assert.match(soundDesignSource, /"icon-enter": \["text"\][\s\S]*"rule-confirm": \["text"\]/, "Good/bad indicator deterministic SFX must follow text timing.");

  console.log("motion graphic timing contract: ok");
} finally {
  fs.rmSync(tempDir, { recursive: true, force: true });
}
