#!/usr/bin/env node

import assert from "assert";
import fs from "fs";
import os from "os";
import path from "path";
import { spawnSync } from "child_process";
import * as fontkit from "fontkit";
import sharp from "sharp";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const renderer = path.join(root, "scripts", "render-motion-graphic.mjs");
const stageWorker = path.join(root, "scripts", "short-form-stage-worker.mjs");
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "caption-word-wall-test-"));

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: root,
    encoding: "utf-8",
    maxBuffer: 10 * 1024 * 1024,
    ...options,
  });
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(" ")} failed\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`);
  }
  return result;
}

async function meanAbsoluteDifference(pathA, pathB, crop) {
  const [a, b] = await Promise.all([
    sharp(pathA).extract(crop).raw().toBuffer(),
    sharp(pathB).extract(crop).raw().toBuffer(),
  ]);
  assert.equal(a.length, b.length);
  let sum = 0;
  for (let index = 0; index < a.length; index += 1) {
    sum += Math.abs(a[index] - b[index]);
  }
  return sum / a.length;
}

try {
  const alignmentPath = path.join(tempDir, "word-timestamps.json");
  const configPath = path.join(tempDir, "config.json");
  const xmlPath = path.join(tempDir, "motion-graphic.xml");
  const outputPath = path.join(tempDir, "caption-word-wall.mp4");
  const posterPath = path.join(tempDir, "caption-word-wall.png");
  const interVariableFontPath = path.join(root, "public", "fonts", "InterVariable.ttf");
  const interVariableFont = fontkit.openSync(interVariableFontPath);
  const variableGlyphShapes = [400, 425, 450, 475, 500].map((weight) => {
    const variation = interVariableFont.getVariation({ wght: weight });
    return variation.layout("smooth").glyphs.map((glyph) => glyph.path.toSVG()).join("");
  });
  for (let index = 0; index < variableGlyphShapes.length - 1; index += 1) {
    assert.notEqual(variableGlyphShapes[index], variableGlyphShapes[index + 1], "Inter variable-font glyph outlines should differ at intermediate wght values");
  }

  fs.writeFileSync(alignmentPath, JSON.stringify({
    items: [
      { text: "most", start_time: 10.00, end_time: 10.18 },
      { text: "people", start_time: 10.20, end_time: 10.46 },
      { text: "miss", start_time: 10.48, end_time: 10.72 },
      { text: "this", start_time: 10.74, end_time: 10.92 },
      { text: "part", start_time: 10.94, end_time: 11.20 },
      { text: "large", start_time: 11.24, end_time: 11.48 },
      { text: "words", start_time: 11.50, end_time: 11.78 },
      { text: "guide", start_time: 11.80, end_time: 12.06 },
      { text: "the", start_time: 12.08, end_time: 12.22 },
      { text: "eye", start_time: 12.24, end_time: 12.50 },
      { text: "the", start_time: 12.54, end_time: 12.68 },
      { text: "words", start_time: 12.70, end_time: 12.98 },
      { text: "become", start_time: 13.00, end_time: 13.34 },
      { text: "the", start_time: 13.36, end_time: 13.48 },
      { text: "visual", start_time: 13.50, end_time: 13.88 },
      { text: "legacy", start_time: 13.92, end_time: 14.20 },
      { text: "still", start_time: 14.22, end_time: 14.46 },
      { text: "works", start_time: 14.48, end_time: 14.74 },
    ],
  }, null, 2));

  fs.writeFileSync(xmlPath, `
<video>
  <assets>
    <motionGraphic id="word-wall" templateId="caption_word_wall">
      <line size="regular">most people miss this part</line>
      <line size="large">large words guide the eye</line>
      <line size="extra_large">the words become the visual</line>
      <line emphasized="true">legacy still works</line>
      <blankLine />
    </motionGraphic>
  </assets>
</video>
`, "utf-8");
  const parseResult = run(process.execPath, [stageWorker, xmlPath], {
    env: { ...process.env, SHORT_FORM_STAGE_WORKER_PARSE_MOTION_GRAPHICS_TEST: "1" },
  });
  const parsedMotionGraphics = JSON.parse(parseResult.stdout);
  assert.deepEqual(parsedMotionGraphics[0].args.lines, [
    { text: "most people miss this part", size: "regular" },
    { text: "large words guide the eye", size: "large" },
    { text: "the words become the visual", size: "extra_large" },
    { text: "legacy still works", size: "extra_large", emphasized: true },
    { blank: true },
  ]);

  fs.writeFileSync(configPath, JSON.stringify({
    templateId: "caption_word_wall",
    rendererId: "caption_word_wall",
    durationSeconds: 5,
    visualStartSeconds: 10,
    alignmentPath,
    defaultArgs: {
      lines: [
        { text: "most people, miss this part.", size: "regular" },
        { text: "large words guide the eye", size: "large" },
        { text: "the words become the visual", size: "extra_large" },
        { text: "legacy still works", emphasized: true },
      ],
    },
  }, null, 2));

  const render = run(process.execPath, [renderer, "--config", configPath, "--output", outputPath, "--poster", posterPath]);
  const metadata = JSON.parse(render.stdout);
  assert.equal(metadata.renderer, "caption_word_wall");
  assert.equal(metadata.usesForcedAlignment, true);
  assert.equal(metadata.wordCount, 18);
  assert.equal(metadata.lineCount, 4);
  assert.deepEqual(metadata.displayWords.slice(0, 5), ["most", "people,", "miss", "this", "part."]);
  assert.equal(metadata.layout.alignment, "left");
  assert.equal(metadata.layout.spacingMode, "svg-fixed-space-tspans-active-font-pop");
  assert.deepEqual(Object.keys(metadata.typography.lineSizes), ["regular", "large", "extra_large"]);
  assert.equal(metadata.typography.regular.fontSize, 64);
  assert.equal(metadata.typography.regular.fontWeight, 400);
  assert.equal(metadata.typography.regular.color, "#e8e5dd");
  assert.equal(metadata.typography.regular.lineGap, 20);
  assert.equal(metadata.typography.large.fontSize, 112);
  assert.equal(metadata.typography.large.fontWeight, 400);
  assert.equal(metadata.typography.large.color, "#e8e5dd");
  assert.equal(metadata.typography.large.lineHeight, Number(((112 + 16) / 112).toFixed(6)));
  assert.equal(metadata.typography.extra_large.fontSize, 186);
  assert.equal(metadata.typography.extra_large.fontWeight, 400);
  assert.equal(metadata.typography.extra_large.color, "#e8e5dd");
  assert.equal(metadata.typography.emphasized.aliasFor, "extra_large");
  assert.equal(metadata.typography.upcomingWordColor, "#bab7b1@0.42");
  assert.equal(metadata.activeWordPop.maxScale, 1.2);
  assert.equal(metadata.activeWordPop.maxTranslateYEm, 0.5);
  assert.equal(metadata.activeWordPop.baseFontWeight, 400);
  assert.equal(metadata.activeWordPop.maxFontWeight, 500);
  assert.equal(metadata.activeWordPop.progressBasis, "word spoken duration");
  assert.match(metadata.activeWordPop.fontWeightRenderMode, /InterVariable\.ttf wght axis/);
  assert.equal(metadata.activeWordPop.variableFont.renderer, "fontkit-svg-paths");
  assert.equal(metadata.activeWordPop.variableFont.loadedPath, path.join("public", "fonts", "InterVariable.ttf"));
  assert.deepEqual(metadata.activeWordPop.variableFont.weightAxis, { min: 100, default: 400, max: 900 });
  assert.match(metadata.activeWordPop.variableFont.activeWeightValues, /continuous values from 400 to 500 to 400/);
  assert.deepEqual(metadata.activeWordPop.keyframes, [
    { progress: 0, scale: 1, translateYEm: 0, fontWeight: 400, easingToNext: "ease-out-quart" },
    { progress: 0.2, scale: 1.2, translateYEm: 0.5, fontWeight: 500, easingToNext: "ease-out-cubic" },
    { progress: 1, scale: 1, translateYEm: 0, fontWeight: 400 },
  ]);
  assert.equal(metadata.lineVisibility[0].firstWordStart, 0);
  assert.equal(metadata.lineVisibility[1].firstWordStart, 1.24);
  assert.equal(metadata.lineVisibility[1].size, "large");
  assert.equal(metadata.lineVisibility[2].size, "extra_large");
  assert.equal(metadata.lineVisibility[3].size, "extra_large");
  assert.ok(metadata.layout.rows.every((row) => row.x === metadata.layout.x), "all rendered rows should share the same left edge");
  const regularRows = metadata.layout.rows.filter((row) => row.size === "regular" && row.lineIndex === 0);
  const largeRows = metadata.layout.rows.filter((row) => row.size === "large" && row.lineIndex === 1);
  const extraLargeRows = metadata.layout.rows.filter((row) => row.size === "extra_large" && row.lineIndex === 2);
  const legacyEmphasizedRows = metadata.layout.rows.filter((row) => row.size === "extra_large" && row.lineIndex === 3);
  const responsiveScale = regularRows[0].fontSize / metadata.typography.regular.fontSize;
  assert.ok(Math.abs(largeRows[0].fontSize - Math.round(metadata.typography.large.fontSize * responsiveScale)) <= 2);
  assert.ok(Math.abs(extraLargeRows[0].fontSize - Math.round(metadata.typography.extra_large.fontSize * responsiveScale)) <= 2);
  assert.ok(extraLargeRows.length >= 2, "long extra_large lines should wrap during layout");
  assert.ok(extraLargeRows.every((row) => row.lineStart === 2.54), "wrapped rows should inherit their source line reveal start");
  assert.ok(legacyEmphasizedRows.length > 0, "legacy emphasized=true line should map to extra_large rows");
  assert.ok(
    extraLargeRows[0].gapAfter < Math.round(extraLargeRows[0].fontSize * 0.2),
    `expected tight extra_large wrap gap, got ${extraLargeRows[0].gapAfter}`,
  );
  assert.ok(fs.existsSync(outputPath), "output video should exist");
  assert.ok(fs.existsSync(posterPath), "poster image should exist");

  const probe = run("ffprobe", [
    "-v",
    "error",
    "-show_entries",
    "format=duration",
    "-of",
    "default=noprint_wrappers=1:nokey=1",
    outputPath,
  ]);
  const duration = Number(probe.stdout.trim());
  assert.ok(duration >= 4.9 && duration <= 5.1, `expected rendered duration near 5s, got ${duration}`);

  const frameBeforeLine = path.join(tempDir, "before-second-line.png");
  const frameAfterLine = path.join(tempDir, "after-second-line.png");
  run("ffmpeg", ["-y", "-i", outputPath, "-ss", "1.00", "-frames:v", "1", frameBeforeLine]);
  run("ffmpeg", ["-y", "-i", outputPath, "-ss", "1.35", "-frames:v", "1", frameAfterLine]);
  const secondLineFirstRow = largeRows[0];
  const diff = await meanAbsoluteDifference(frameBeforeLine, frameAfterLine, {
    left: Math.max(0, secondLineFirstRow.x - 12),
    top: Math.max(0, secondLineFirstRow.y - 18),
    width: Math.min(1080 - Math.max(0, secondLineFirstRow.x - 12), Math.ceil(secondLineFirstRow.width + 120)),
    height: Math.min(1920 - Math.max(0, secondLineFirstRow.y - 18), Math.ceil(secondLineFirstRow.fontSize * 1.45)),
  });
  assert.ok(diff > 4, `expected second line to become visibly different after its first word starts, got mean diff ${diff.toFixed(2)}`);

  console.log("caption word wall motion graphic tests passed");
} finally {
  fs.rmSync(tempDir, { recursive: true, force: true });
}
