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
  { rendererId: "stat_reveal", previewArgs: { value: "73%", title: "people notice the change" } },
  { rendererId: "bar_chart", previewArgs: { title: "What changed most", data: [{ label: "A", value: 35, displayValue: "35" }, { label: "B", value: 68, displayValue: "68" }] } },
  { rendererId: "pie_chart", previewArgs: { title: "Split", data: [{ label: "A", value: 40, displayValue: "40%" }, { label: "B", value: 60, displayValue: "60%" }] } },
  { rendererId: "line_growth_chart", previewArgs: { title: "Growth trend", direction: "increase", startLabel: "Start", endLabel: "Now", valueLabel: "86" } },
  { rendererId: "comparison_before_after", previewArgs: { before: "Problem state", after: "Improved state" } },
  { rendererId: "timeline", previewArgs: { title: "Thirty-day ramp", steps: [{ label: "MONTH 12 CHECKPOINT", text: "Setup" }, { label: "DAY 7", text: "Signal" }, { label: "DAY 30", text: "Visible change" }] } },
  { rendererId: "cause_effect", previewArgs: { cause: "Small habit", effect: "Visible change" } },
  { rendererId: "ranked_podium", previewArgs: { items: ["Most visible change", "Faster feedback", "Cleaner routine"] } },
  { rendererId: "list", previewArgs: { title: "Daily routine", listType: "checklist", items: ["Set the baseline", "Make the small adjustment that continues even when the routine gets longer", "Repeat it daily"] } },
  { rendererId: "list", previewArgs: { listType: "numbered", items: ["First numbered step", "Second numbered step", "Third numbered step"] } },
  { rendererId: "list", previewArgs: { listType: "bulleted", items: ["First bullet", "Second bullet", "Third bullet"] } },
  { rendererId: "scorecard", previewArgs: { title: "Scorecard", data: [{ label: "Clarity", value: 92, displayValue: "1,234,567 people" }] } },
  { rendererId: "research_paper_card", previewArgs: { source: "Study", title: "Research finding", finding: "One finding changes how this should be read." } },
  { rendererId: "good_bad_indicator", previewArgs: { indicatorType: "good", text: "Do this" } },
  { rendererId: "caption_word_wall", allowSyntheticTiming: true, previewArgs: { text: "miss <large>this,</large> words <extraLarge>visual.</extraLarge>" } },
];

try {
  assert.ok(fs.existsSync(hyperframesCli), "hyperframes CLI must be installed as a local dependency");
  assert.ok(fs.existsSync(gsapScript), "GSAP must be installed as a local dependency");
  assert.equal(resolveRendererKey({ templateId: "good-bad-indicator" }), "good_bad_indicator");
  assert.equal(resolveRendererKey({ rendererId: "checklist" }), "list");

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
      assert.ok(html.includes("timeline-title"), "timeline should render the optional title inside the centered content group");
      assert.ok(html.includes("Thirty-day ramp"), "timeline optional title should preserve configured copy");
      assert.ok(!html.includes("timeline-dot"), "timeline must not use the newer dot-based visual style");
      assert.ok(html.includes("timeline-connector-0"), "timeline must preserve short center-out connectors");
      assert.ok(html.includes("width:62px;height:4px"), "timeline connectors must match the old compact rule geometry");
      assert.ok(html.includes("left:260px"), "timeline vertical rule must use the old left-side rule position");
      assert.ok(html.includes("MONTH 12 CHECKPOINT"), "timeline fixture must keep a long label for no-wrap coverage");
      assert.ok(html.includes("timeline-label-0"), "timeline must render the step label");
      assert.ok(html.includes("width:max-content"), "timeline step labels should use intrinsic width instead of a fixed label column");
      assert.ok(html.includes("font-size:38px"), "timeline step labels must keep the configured font size instead of shrinking to fit");
      assert.ok(html.includes("white-space:nowrap"), "timeline step labels must not wrap when they are long");
      assert.ok(html.includes('tl.set("#timeline-rule", {opacity:1, scaleY:0}, 1.000);'), "timeline vertical rule should start growing after the first step finishes revealing");
      assert.ok(html.includes('tl.to("#timeline-rule", {scaleY:0.5000, duration:0.660, ease:"none"}, 1.000);'), "timeline vertical rule should reach the second step exactly when that step finishes revealing");
      assert.ok(html.includes('tl.to("#timeline-rule", {scaleY:1.0000, duration:0.660, ease:"none"}, 1.660);'), "timeline vertical rule should reach the third step exactly when that step finishes revealing");
      assert.ok(!html.includes('tl.fromTo("#timeline-rule", {opacity:0, scaleY:0}'), "timeline vertical rule must not use one arbitrary full-height growth tween");
    }
    if (config.rendererId === "scorecard") {
      assert.ok(html.includes("score-track-0"), "scorecard must preserve the old thin background track");
      assert.ok(html.includes("score-bar-0"), "scorecard must preserve the old animated score bar");
      assert.ok(html.includes("height:8px"), "scorecard bars must match the old 8px rule weight");
      assert.ok(!html.includes("score-row"), "scorecard must not use the newer bordered-row visual style");
      assert.ok(html.includes("single-line-text"), "scorecard displayValue must render as a single-line value");
      assert.ok(html.includes("white-space:nowrap"), "scorecard displayValue must not wrap when it is long");
      assert.ok(html.includes("width:max-content"), "scorecard displayValue should use intrinsic width instead of a fixed value column");
      assert.ok(html.includes("font-size:40px"), "scorecard displayValue must keep the configured font size instead of shrinking to fit");
      assert.ok(html.includes("1,234,567 people"), "scorecard fixture must keep a long displayValue for no-wrap coverage");
    }
    if (config.rendererId === "list" && config.previewArgs.listType === "checklist") {
      const readStyleNumber = (id, property) => {
        const match = html.match(new RegExp(`id="${id}"[^>]*style="([^"]*)"`));
        assert.ok(match, `${id} should be rendered`);
        const propertyMatch = match[1].match(new RegExp(`${property}:(-?\\d+)px`));
        assert.ok(propertyMatch, `${id} should define ${property}`);
        return Number(propertyMatch[1]);
      };
      const textTops = [0, 1, 2].map((index) => readStyleNumber(`list-text-${index}`, "top"));
      const boxTops = [0, 1, 2].map((index) => readStyleNumber(`list-check-box-${index}`, "top"));
      assert.ok(html.includes("list-title"), "list should render the optional title inside the centered content group");
      assert.ok(html.includes("the routine gets longer"), "list fixture must keep a wrapped long item for responsive-height coverage");
      assert.ok(textTops[2] - textTops[1] > textTops[1] - textTops[0], "list rows should advance by measured content height instead of one fixed row height");
      assert.equal(boxTops[0] - textTops[0], 3, "single-line checklist text should be vertically centered against the check box");
      assert.equal(boxTops[1] - textTops[1], boxTops[0] - textTops[0], "multi-line checklist check box should align to the first text row instead of the full wrapped text block");
      assert.ok(!html.includes("height:128px"), "list items should not render a fixed row height");
      assert.ok(!html.includes("height:104px"), "list items should not render the compact fixed row height");
    }
    if (config.rendererId === "list" && config.previewArgs.listType === "numbered") {
      assert.ok(html.includes("list-number-0"), "numbered list should render number markers");
      assert.ok(html.includes("1."), "numbered list should show 1. marker text");
      assert.ok(!html.includes("list-check-box-0"), "numbered list should not render checklist boxes");
    }
    if (config.rendererId === "list" && config.previewArgs.listType === "bulleted") {
      assert.ok(html.includes("list-bullet-0"), "bulleted list should render bullet markers");
      assert.ok(html.includes("•"), "bulleted list should show bullet marker text");
      assert.ok(!html.includes("list-check-box-0"), "bulleted list should not render checklist boxes");
    }
    if (config.rendererId === "cause_effect") {
      assert.ok(html.includes("cause-card"), "cause_effect must render the cause text group");
      assert.ok(html.includes("effect-card"), "cause_effect must render the effect text group");
      assert.ok(html.includes("cause-arrow-path"), "cause_effect must render the downward arrow");
      assert.ok(!html.includes("cause-effect-card"), "cause_effect must not render boxed cause/effect cards");
      assert.ok(!html.includes("border-radius:20px"), "cause_effect must not show rounded boxes around the cause/effect text");
      assert.ok(html.includes("width:128px;height:156px"), "cause_effect arrow must use the thicker wide arrow geometry");
      assert.ok(html.includes("stroke-width=\"16\""), "cause_effect arrow must be substantially thicker than the old compact arrow");
      assert.ok(html.includes("rgba(132,130,121,0.84)"), "cause_effect arrow should use a darker neutral arrow color");
      assert.ok(!html.includes("stroke=\"rgba(168,191,208,0.78)\""), "cause_effect arrow should not use the old blue hue");
      assert.ok(html.includes("font-weight:500"), "cause_effect text should render one weight notch above regular");
      assert.ok(!html.includes("drawSVG"), "cause_effect must not depend on non-installed GSAP plugins");
    }
    if (config.rendererId === "caption_word_wall") {
      assert.ok(html.includes("caption-word-wall-flow"), "caption_word_wall should render one continuous caption flow");
      assert.ok(!html.includes("word-line-"), "caption_word_wall must not render configured separate line rows");
      assert.ok(html.includes("align-content:flex-start"), "caption_word_wall wrapped flow should avoid extra centered vertical air");
      assert.ok(html.includes("--caption-row-gap"), "caption_word_wall should keep row spacing explicit for wrapped lines");
      assert.ok(html.includes("left:108px"), "caption_word_wall should use 10% left padding");
      assert.ok(html.includes("width:864px"), "caption_word_wall should use an 80% text region");
      assert.ok(html.includes("display:none"), "caption_word_wall should hide unspoken future words instead of rendering them dimmed");
      assert.ok(!html.includes("--caption-upcoming"), "caption_word_wall should not configure a darker upcoming-word color");
      assert.ok(html.includes("scale:1.16"), "caption_word_wall active word pop should use transform scale");
      assert.ok(!html.includes("fontSize:"), "caption_word_wall active word pop must not animate font-size and change wrapping");
      assert.ok(html.includes("this,"), "caption_word_wall should preserve punctuation in displayed word tokens");
      assert.ok(html.includes("visual."), "caption_word_wall should preserve sentence punctuation in displayed word tokens");
      const wordMetrics = [...html.matchAll(/class="word-token word-size-(?:large|extra_large)"[^>]*style="([^"]*)"/g)]
        .map((match) => ({
          weight: Number(match[1].match(/font-weight:(\d+)/)?.[1]),
          fontSize: Number(match[1].match(/font-size:(\d+)px/)?.[1]),
        }));
      assert.equal(wordMetrics.length, 2, "caption_word_wall fixture should render one large and one extra-large inline token");
      assert.ok(wordMetrics[1].fontSize > wordMetrics[0].fontSize, "extra-large inline words should render larger than large inline words");
      assert.equal(wordMetrics[0].weight, 600, "large inline words should use the requested 600 font weight");
      assert.ok(wordMetrics[1].weight > wordMetrics[0].weight, "extra-large inline words should remain heavier than large inline words");
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
    previewArgs: { value: "73%", title: "people notice the change" },
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
