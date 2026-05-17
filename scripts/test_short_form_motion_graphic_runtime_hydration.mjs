import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  hydrateMotionGraphicVisualTypes,
  hydrateRuntimeXmlMotionGraphicsFromManifest,
} from "./short-form-motion-graphics-runtime.mjs";

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "short-form-motion-runtime-"));
const scenesDir = path.join(tempDir, "scenes");
fs.mkdirSync(scenesDir, { recursive: true });
fs.writeFileSync(path.join(scenesDir, "scene-02-motion-graphic.mp4"), "");

const runtimeXml = `<video version="2">
  <assets>
    <image id="scene-one"><prompt>Scene one</prompt></image>
    <image id="__motion_graphic_mg-two"><prompt>Motion poster</prompt></image>
  </assets>
  <timeline>
    <visual id="visual-001" label="Image" start="0" end="1" imageId="scene-one" />
    <visual id="visual-002" label="Motion" start="1" end="3" imageId="__motion_graphic_mg-two" />
  </timeline>
</video>
`;

const sourceXml = `---
title: Example
---
<video version="2">
  <assets>
    <image id="scene-one"><prompt>Scene one</prompt></image>
    <motionGraphic id="mg-two" templateId="checklist">
      <step>Use the real motion config</step>
      <step>Do not render the poster placeholder</step>
    </motionGraphic>
  </assets>
  <timeline>
    <visual id="visual-001" label="Image" start="0" end="1" imageId="scene-one" />
    <visual id="visual-002" label="Motion" start="1" end="3" visualType="motion_graphic" motionGraphicId="mg-two" />
  </timeline>
</video>
`;

const manifest = {
  scenes: [
    { index: 1, visual_type: "image" },
    {
      index: 2,
      visual_type: "motion_graphic",
      motion_graphic_id: "mg-two",
      image_id: "__motion_graphic_mg-two",
      motion_graphic_video: path.join(scenesDir, "scene-02-motion-graphic.mp4"),
    },
  ],
};

const hydrated = hydrateMotionGraphicVisualTypes(runtimeXml, manifest, {
  baseDir: scenesDir,
  sourceXml,
});
assert.deepEqual(hydrated.hydratedIndexes, [2]);
assert.match(hydrated.xml, /<visual id="visual-002"[^>]*visualType="motion_graphic"[^>]*motionGraphicId="mg-two"[^>]*\/>/);
assert.doesNotMatch(hydrated.xml, /<visual id="visual-002"[^>]*imageId="__motion_graphic_mg-two"/);
assert.doesNotMatch(hydrated.xml, /<image id="__motion_graphic_mg-two"/);
assert.match(hydrated.xml, /<motionGraphic id="mg-two" templateId="checklist">[\s\S]*Use the real motion config[\s\S]*<\/motionGraphic>/);
assert.doesNotMatch(hydrated.xml, /<visual id="visual-001"[^>]*visualType="motion_graphic"/);

const runtimeXmlPath = path.join(tempDir, "video-runtime.xml");
const manifestPath = path.join(scenesDir, "manifest.json");
const sourceXmlPath = path.join(tempDir, "xml-script.md");
fs.writeFileSync(runtimeXmlPath, runtimeXml);
fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
fs.writeFileSync(sourceXmlPath, sourceXml);
assert.deepEqual(hydrateRuntimeXmlMotionGraphicsFromManifest(runtimeXmlPath, manifestPath, { sourceXmlPath }), [2]);
const hydratedRuntimeXml = fs.readFileSync(runtimeXmlPath, "utf-8");
assert.match(hydratedRuntimeXml, /visual-002[^>]*visualType="motion_graphic"[^>]*motionGraphicId="mg-two"/);
assert.doesNotMatch(hydratedRuntimeXml, /__motion_graphic_mg-two/);
assert.match(hydratedRuntimeXml, /<motionGraphic id="mg-two"/);

console.log("short-form motion graphic runtime hydration tests passed");
