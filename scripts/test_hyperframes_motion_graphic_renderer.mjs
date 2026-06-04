#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

import {
  buildCompositionHtml,
  resolveRendererKey,
} from "./render-hyperframes-motion-graphic.mjs";

const repoRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const hyperframesCli = path.join(repoRoot, "node_modules", "hyperframes", "dist", "cli.js");
const gsapScript = path.join(repoRoot, "node_modules", "gsap", "dist", "gsap.min.js");
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "hyperframes-motion-graphic-test-"));

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: repoRoot,
    encoding: "utf-8",
    maxBuffer: 20 * 1024 * 1024,
    ...options,
  });
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(" ")} failed\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`);
  }
  return result;
}

const templateConfigs = [
  { rendererId: "stat_reveal", defaultArgs: { value: "73%", title: "people notice the change" } },
  { rendererId: "bar_chart", defaultArgs: { title: "What changed most", data: [{ label: "A", value: 35, displayValue: "35" }, { label: "B", value: 68, displayValue: "68" }] } },
  { rendererId: "pie_chart", defaultArgs: { title: "Split", data: [{ label: "A", value: 40, displayValue: "40%" }, { label: "B", value: 60, displayValue: "60%" }] } },
  { rendererId: "line_growth_chart", defaultArgs: { title: "Growth trend", direction: "increase", startLabel: "Start", endLabel: "Now", valueLabel: "86" } },
  { rendererId: "comparison_before_after", defaultArgs: { before: "Problem state", after: "Improved state" } },
  { rendererId: "timeline", defaultArgs: { steps: ["Setup", "Signal", "Visible change"] } },
  { rendererId: "cause_effect", defaultArgs: { cause: "Small habit", effect: "Visible change" } },
  { rendererId: "ranked_podium", defaultArgs: { items: ["Most visible change", "Faster feedback", "Cleaner routine"] } },
  { rendererId: "checklist", defaultArgs: { items: ["Set the baseline", "Make the small adjustment", "Repeat it daily"] } },
  { rendererId: "scorecard", defaultArgs: { title: "Scorecard", data: [{ label: "Clarity", value: 92, displayValue: "92" }] } },
  { rendererId: "research_paper_card", defaultArgs: { source: "Study", title: "Research finding", finding: "One finding changes how this should be read." } },
  { rendererId: "good_bad_indicator", defaultArgs: { indicatorType: "good", text: "Do this" } },
  { rendererId: "caption_word_wall", allowSyntheticTiming: true, defaultArgs: { lines: [{ text: "most people miss this part" }, { text: "the words become the visual", size: "large" }] } },
];

try {
  assert.ok(fs.existsSync(hyperframesCli), "hyperframes CLI must be installed as a local dependency");
  assert.ok(fs.existsSync(gsapScript), "GSAP must be installed as a local dependency");
  assert.equal(resolveRendererKey({ templateId: "good-bad-indicator" }), "good_bad_indicator");

  for (const config of templateConfigs) {
    const templateDir = path.join(tempDir, config.rendererId);
    fs.mkdirSync(templateDir, { recursive: true });
    fs.copyFileSync(gsapScript, path.join(templateDir, "gsap.min.js"));
    const { html, rendererKey } = buildCompositionHtml({ durationSeconds: 1, ...config });
    assert.ok(html.includes("window.__timelines[\"main\"]"), `${config.rendererId} should register a HyperFrames timeline`);
    assert.ok(html.includes("data-composition-id=\"main\""), `${config.rendererId} should define a HyperFrames composition root`);
    if (config.rendererId === "line_growth_chart") {
      assert.ok(html.includes("id=\"growth-arrow\""), "line_growth_chart must preserve the old moving arrowhead");
      assert.ok(html.includes("line-grid-h-1"), "line_growth_chart must render animated horizontal grid lines");
      assert.ok(html.includes("line-grid-v-1"), "line_growth_chart must render animated vertical grid lines");
      assert.ok(html.includes("line-axis-x-arrow"), "line_growth_chart must preserve animated x-axis chevron");
      assert.ok(html.includes("line-axis-y-arrow"), "line_growth_chart must preserve animated y-axis chevron");
      assert.ok(html.includes("updateLineGrowth("), "line_growth_chart must update the line, arrow, and counter frame-by-frame");
      assert.ok(html.includes("stroke-width=\"10\""), "line_growth_chart primary line should match the old 10px stroke");
    }
    if (config.rendererId === "timeline") {
      assert.ok(!html.includes("timeline-dot"), "timeline must not use the newer dot-based visual style");
      assert.ok(html.includes("timeline-connector-0"), "timeline must preserve short center-out connectors");
      assert.ok(html.includes("width:62px;height:4px"), "timeline connectors must match the old compact rule geometry");
      assert.ok(html.includes("left:260px"), "timeline vertical rule must use the old left-side rule position");
    }
    if (config.rendererId === "scorecard") {
      assert.ok(html.includes("score-track-0"), "scorecard must preserve the old thin background track");
      assert.ok(html.includes("score-bar-0"), "scorecard must preserve the old animated score bar");
      assert.ok(html.includes("height:8px"), "scorecard bars must match the old 8px rule weight");
      assert.ok(!html.includes("score-row"), "scorecard must not use the newer bordered-row visual style");
    }
    if (config.rendererId === "cause_effect") {
      assert.ok(html.includes("cause-card"), "cause_effect must render the cause text group");
      assert.ok(html.includes("effect-card"), "cause_effect must render the effect text group");
      assert.ok(html.includes("cause-arrow-path"), "cause_effect must render the downward arrow");
      assert.ok(!html.includes("cause-effect-card"), "cause_effect must not render boxed cause/effect cards");
      assert.ok(!html.includes("border-radius:20px"), "cause_effect must not show rounded boxes around the cause/effect text");
      assert.ok(html.includes("width:128px;height:156px"), "cause_effect arrow must use the thicker wide arrow geometry");
      assert.ok(html.includes("stroke-width=\"16\""), "cause_effect arrow must be substantially thicker than the old compact arrow");
      assert.ok(html.includes("font-weight:500"), "cause_effect text should render one weight notch above regular");
      assert.ok(!html.includes("drawSVG"), "cause_effect must not depend on non-installed GSAP plugins");
    }
    if (config.rendererId === "caption_word_wall") {
      assert.ok(html.includes("align-content:flex-start"), "caption_word_wall wrapped rows should avoid extra centered vertical air");
      assert.ok(html.includes("--caption-row-gap"), "caption_word_wall should keep row spacing explicit for wrapped lines");
    }
    fs.writeFileSync(path.join(templateDir, "index.html"), html, "utf-8");
    fs.writeFileSync(path.join(templateDir, "hyperframes.json"), JSON.stringify({ entry: "index.html" }), "utf-8");
    const lint = run(process.execPath, [hyperframesCli, "lint", templateDir, "--json"]);
    const lintResult = JSON.parse(lint.stdout.slice(lint.stdout.indexOf("{")));
    assert.equal(lintResult.errorCount, 0, `${rendererKey} HyperFrames composition should lint without errors`);
  }

  const renderConfigPath = path.join(tempDir, "render-config.json");
  const renderOutputPath = path.join(tempDir, "stat-reveal.mp4");
  const renderPosterPath = path.join(tempDir, "stat-reveal.png");
  fs.writeFileSync(renderConfigPath, JSON.stringify({
    rendererId: "stat_reveal",
    durationSeconds: 1,
    defaultArgs: { value: "73%", title: "people notice the change" },
  }), "utf-8");
  const render = run(process.execPath, [
    path.join(repoRoot, "scripts", "render-hyperframes-motion-graphic.mjs"),
    "--config",
    renderConfigPath,
    "--output",
    renderOutputPath,
    "--poster",
    renderPosterPath,
  ]);
  const metadata = JSON.parse(render.stdout);
  assert.equal(metadata.rendererEngine, "hyperframes");
  assert.equal(metadata.renderer, "stat_reveal");
  assert.ok(fs.existsSync(renderOutputPath), "HyperFrames renderer should create an MP4");
  assert.ok(fs.existsSync(renderPosterPath), "HyperFrames renderer should create a poster");

  console.log("hyperframes motion graphic renderer tests passed");
} finally {
  fs.rmSync(tempDir, { recursive: true, force: true });
}
