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
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "caption-word-wall-test-"));

function run(command, args) {
  const result = spawnSync(command, args, {
    cwd: root,
    encoding: "utf-8",
    maxBuffer: 10 * 1024 * 1024,
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
  const outputPath = path.join(tempDir, "caption-word-wall.mp4");
  const posterPath = path.join(tempDir, "caption-word-wall.png");
  const interVariableFontPath = path.join(root, "public", "fonts", "InterVariable.ttf");
  const interVariableFont = fontkit.openSync(interVariableFontPath);
  const variableGlyphShapes = [400, 450, 500, 550, 600].map((weight) => {
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
      { text: "the", start_time: 11.24, end_time: 11.38 },
      { text: "words", start_time: 11.40, end_time: 11.68 },
      { text: "become", start_time: 11.70, end_time: 12.04 },
      { text: "the", start_time: 12.06, end_time: 12.18 },
      { text: "visual", start_time: 12.20, end_time: 12.58 },
      { text: "because", start_time: 12.60, end_time: 12.90 },
      { text: "captions", start_time: 12.92, end_time: 13.20 },
      { text: "matter", start_time: 13.22, end_time: 13.48 },
      { text: "now", start_time: 13.50, end_time: 13.78 },
    ],
  }, null, 2));

  fs.writeFileSync(configPath, JSON.stringify({
    templateId: "caption_word_wall",
    rendererId: "caption_word_wall",
    durationSeconds: 4,
    visualStartSeconds: 10,
    alignmentPath,
    defaultArgs: {
      lines: [
        { text: "most people, miss this part." },
        { text: "the words become the visual because captions matter now", emphasized: true },
      ],
    },
  }, null, 2));

  const render = run(process.execPath, [renderer, "--config", configPath, "--output", outputPath, "--poster", posterPath]);
  const metadata = JSON.parse(render.stdout);
  assert.equal(metadata.renderer, "caption_word_wall");
  assert.equal(metadata.usesForcedAlignment, true);
  assert.equal(metadata.wordCount, 14);
  assert.equal(metadata.lineCount, 2);
  assert.deepEqual(metadata.displayWords.slice(0, 5), ["most", "people,", "miss", "this", "part."]);
  assert.equal(metadata.layout.alignment, "left");
  assert.equal(metadata.layout.spacingMode, "svg-fixed-space-tspans-active-font-pop");
  assert.equal(metadata.typography.regular.fontSize, 64);
  assert.equal(metadata.typography.regular.fontWeight, 400);
  assert.equal(metadata.typography.regular.color, "#e8e5dd");
  assert.equal(metadata.typography.regular.lineGap, 20);
  assert.equal(metadata.typography.emphasized.fontSize, 186);
  assert.equal(metadata.typography.emphasized.fontWeight, 400);
  assert.equal(metadata.typography.emphasized.color, "#e8e5dd");
  assert.equal(metadata.typography.upcomingWordColor, "#bab7b1@0.42");
  assert.equal(metadata.activeWordPop.maxScale, 1.35);
  assert.equal(metadata.activeWordPop.maxTranslateYEm, 0.08);
  assert.equal(metadata.activeWordPop.baseFontWeight, 400);
  assert.equal(metadata.activeWordPop.maxFontWeight, 600);
  assert.equal(metadata.activeWordPop.progressBasis, "word spoken duration");
  assert.match(metadata.activeWordPop.fontWeightRenderMode, /InterVariable\.ttf wght axis/);
  assert.equal(metadata.activeWordPop.variableFont.renderer, "fontkit-svg-paths");
  assert.equal(metadata.activeWordPop.variableFont.loadedPath, path.join("public", "fonts", "InterVariable.ttf"));
  assert.deepEqual(metadata.activeWordPop.variableFont.weightAxis, { min: 100, default: 400, max: 900 });
  assert.match(metadata.activeWordPop.variableFont.activeWeightValues, /continuous values from 400 to 600 to 400/);
  assert.deepEqual(metadata.activeWordPop.keyframes, [
    { progress: 0, scale: 1, translateYEm: 0, fontWeight: 400, easingToNext: "ease-out-quart" },
    { progress: 0.2, scale: 1.35, translateYEm: 0.08, fontWeight: 600, easingToNext: "ease-out-cubic" },
    { progress: 1, scale: 1, translateYEm: 0, fontWeight: 400 },
  ]);
  assert.equal(metadata.lineVisibility[0].firstWordStart, 0);
  assert.equal(metadata.lineVisibility[1].firstWordStart, 1.24);
  assert.ok(metadata.layout.rows.every((row) => row.x === metadata.layout.x), "all rendered rows should share the same left edge");
  const emphasizedRows = metadata.layout.rows.filter((row) => row.emphasized && row.lineIndex === 1);
  assert.ok(emphasizedRows.length >= 2, "long emphasized lines should wrap during layout");
  assert.ok(emphasizedRows.every((row) => row.lineStart === 1.24), "wrapped rows should inherit their source line reveal start");
  assert.ok(
    emphasizedRows[0].gapAfter < Math.round(emphasizedRows[0].fontSize * 0.2),
    `expected tight emphasized wrap gap, got ${emphasizedRows[0].gapAfter}`,
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
  assert.ok(duration >= 3.9 && duration <= 4.1, `expected rendered duration near 4s, got ${duration}`);

  const frameBeforeLine = path.join(tempDir, "before-second-line.png");
  const frameAfterLine = path.join(tempDir, "after-second-line.png");
  run("ffmpeg", ["-y", "-i", outputPath, "-ss", "1.00", "-frames:v", "1", frameBeforeLine]);
  run("ffmpeg", ["-y", "-i", outputPath, "-ss", "1.35", "-frames:v", "1", frameAfterLine]);
  const secondLineFirstRow = emphasizedRows[0];
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
