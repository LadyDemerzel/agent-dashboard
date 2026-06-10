import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  hydrateMotionGraphicVisualTypes,
  hydrateRuntimeXmlMotionGraphicsFromManifest,
} from "./short-form-motion-graphics-runtime.mjs";

const repoRoot = process.cwd();
const stageWorkerSource = fs.readFileSync(path.join(repoRoot, "scripts", "short-form-stage-worker.mjs"), "utf-8");
const finalVideoRendererSource = fs.readFileSync(path.join(repoRoot, "scripts", "xml-scene-video", "generate_video.py"), "utf-8");
const normalizeMotionGraphicVideoBody = finalVideoRendererSource.match(/def normalize_motion_graphic_video\([\s\S]*?\n\ndef ensure_dir/)?.[0] || "";

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
  </assets>
  <timeline>
    <visual id="visual-001" label="Image" start="0" end="1" imageId="scene-one" />
    <visual id="visual-002" label="Motion" start="1" end="3" visualType="motion_graphic">
      <motionGraphic id="mg-two" templateId="checklist">
        <step animateIn="1.2">Use the real motion config</step>
        <step animateIn="2.1">Do not render the poster placeholder</step>
      </motionGraphic>
    </visual>
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
assert.match(hydrated.xml, /<visual id="visual-002"[^>]*visualType="motion_graphic"[^>]*>/);
assert.doesNotMatch(hydrated.xml, /<visual id="visual-002"[^>]*motionGraphicId="mg-two"/);
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
assert.match(hydratedRuntimeXml, /visual-002[^>]*visualType="motion_graphic"/);
assert.doesNotMatch(hydratedRuntimeXml, /visual-002[^>]*motionGraphicId="mg-two"/);
assert.doesNotMatch(hydratedRuntimeXml, /__motion_graphic_mg-two/);
assert.match(hydratedRuntimeXml, /<motionGraphic id="mg-two"/);

const runDirectVideoBody = stageWorkerSource.match(/function runDirectVideo\(job\) \{[\s\S]*?\n\}\n\nasync function main/)?.[0] || "";
assert.match(runDirectVideoBody, /getLatestSceneImagesRuntimeXmlPath/, "Final-video should consume the scene-images runtime XML that already maps motion graphics to renderable placeholder imageIds.");
assert.match(runDirectVideoBody, /syncRuntimeTimelineVisualAttributesFromSource\(runtimeXmlPath, config\.scriptPath\)/, "Final-video should sync mutable visual timeline attrs from the current XML before rendering stale scene-images runtime XML.");
assert.match(runDirectVideoBody, /preserveRuntimeMotionGraphicRendererMetadata/, "Final-video should repair older scene-images runtime XML so motion graphics keep renderer-facing metadata.");
assert.doesNotMatch(runDirectVideoBody, /hydrateRuntimeXmlMotionGraphicsFromManifest/, "Final-video must not rehydrate renderer-facing XML back to inline motion graphics before calling xml-scene-video.");
assert.match(stageWorkerSource, /XML_SCENE_VIDEO_SCRIPT = path\.join\(AGENT_DASHBOARD_ROOT, "scripts", "xml-scene-video", "generate_video\.py"\)/, "Final-video should use the Agent Dashboard repo-owned xml-scene-video renderer.");
assert.doesNotMatch(stageWorkerSource, /\.openclaw", "skills", "xml-scene-video", "scripts", "generate_video\.py"/, "Final-video must not call the external xml-scene-video skill renderer.");
assert.match(stageWorkerSource, /attrs\.visualType = "motion_graphic"/, "Renderer-facing scene-images runtime XML must preserve motion-graphic visualType metadata for final-video substitution and caption suppression.");
assert.match(stageWorkerSource, /attrs\.motionGraphicId = motionVisual\.asset\.id/, "Renderer-facing scene-images runtime XML must preserve motionGraphicId while using a poster imageId placeholder.");
assert.doesNotMatch(normalizeMotionGraphicVideoBody, /"-stream_loop"/, "Final-video must not extend short motion graphics by looping them.");
assert.match(normalizeMotionGraphicVideoBody, /tpad=stop_mode=clone/, "Final-video should hold the last motion-graphic frame when a visual's XML timing is longer than the source clip.");

const staleFinalRuntimePath = path.join(tempDir, "stale-video-runtime.xml");
const currentSourceXmlPath = path.join(tempDir, "current-xml-script.md");
fs.writeFileSync(staleFinalRuntimePath, `<video>
  <assets>
    <image id="scene-one"><prompt>Scene one</prompt></image>
    <image id="scene-two"><prompt>Scene two</prompt></image>
  </assets>
  <timeline>
    <visual id="visual-001" label="Old label" start="0" end="1" cameraZoomStart="1.00" cameraZoomEnd="1.18" imageId="scene-one" />
    <visual id="visual-002" label="Scene two" start="1" end="2" cameraZoom="1.30" imageId="scene-two" />
  </timeline>
</video>
`);
fs.writeFileSync(currentSourceXmlPath, `---
title: Current
---
<video>
  <timeline>
    <visual id="visual-001" label="New label" start="0.00" end="1.25" cameraZoomStart="1.00" cameraZoomEnd="1.90">
      <image id="scene-one"><prompt>Scene one</prompt></image>
    </visual>
    <visual id="visual-002" label="Scene two" start="1.25" end="2.00">
      <image id="scene-two"><prompt>Scene two</prompt></image>
    </visual>
  </timeline>
</video>
`);
execFileSync(process.execPath, [path.join(repoRoot, "scripts", "short-form-stage-worker.mjs"), staleFinalRuntimePath], {
  cwd: repoRoot,
  env: {
    ...process.env,
    SHORT_FORM_STAGE_WORKER_RUNTIME_ATTR_SYNC_TEST: "1",
    RUNTIME_XML_PATH: staleFinalRuntimePath,
    SOURCE_XML_PATH: currentSourceXmlPath,
  },
  encoding: "utf-8",
});
const syncedRuntimeXml = fs.readFileSync(staleFinalRuntimePath, "utf-8");
assert.match(syncedRuntimeXml, /visual-001[^>]*label="New label"/);
assert.match(syncedRuntimeXml, /visual-001[^>]*end="1.25"/);
assert.match(syncedRuntimeXml, /visual-001[^>]*cameraZoomEnd="1.90"/);
assert.match(syncedRuntimeXml, /visual-001[^>]*imageId="scene-one"/);
assert.doesNotMatch(syncedRuntimeXml, /visual-001[^>]*cameraZoomEnd="1.18"/);
assert.doesNotMatch(syncedRuntimeXml, /visual-002[^>]*cameraZoom="1.30"/);

console.log("short-form motion graphic runtime hydration tests passed");
