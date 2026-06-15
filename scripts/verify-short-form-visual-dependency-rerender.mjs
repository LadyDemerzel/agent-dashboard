import fs from "fs";
import os from "os";
import path from "path";
import { spawnSync } from "child_process";

const repoRoot = process.cwd();
const workerPath = path.join(repoRoot, "scripts", "short-form-stage-worker.mjs");
const workflowRouteSource = fs.readFileSync(
  path.join(repoRoot, "src/app/api/short-form-videos/[id]/workflow/[stage]/route.ts"),
  "utf-8",
);
const secondaryShellSource = fs.readFileSync(
  path.join(repoRoot, "src/components/short-form-video/ShortFormSecondaryShell.tsx"),
  "utf-8",
);
const detailViewSource = fs.readFileSync(
  path.join(repoRoot, "src/components/short-form-video/ShortFormVideoDetailView.tsx"),
  "utf-8",
);

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function runExpansion(xml, indexes) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "short-form-visual-deps-"));
  const xmlPath = path.join(dir, "visuals.xml");
  fs.writeFileSync(xmlPath, xml, "utf-8");

  try {
    const result = spawnSync(process.execPath, [workerPath, xmlPath], {
      cwd: repoRoot,
      env: {
        ...process.env,
        SHORT_FORM_STAGE_WORKER_DEPENDENCY_EXPANSION_TEST: "1",
        REQUESTED_SCENE_INDEXES: indexes.join(","),
      },
      encoding: "utf-8",
    });
    assert(result.status === 0, `dependency expansion worker failed: ${result.stderr || result.stdout}`);
    return JSON.parse(result.stdout.trim());
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

function runTimelineRuntimeTransform(xml) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "short-form-timeline-runtime-"));
  const xmlPath = path.join(dir, "visuals.xml");
  fs.writeFileSync(xmlPath, xml, "utf-8");

  try {
    const result = spawnSync(process.execPath, [workerPath, xmlPath], {
      cwd: repoRoot,
      env: {
        ...process.env,
        SHORT_FORM_STAGE_WORKER_TIMELINE_IMAGE_RUNTIME_TEST: "1",
      },
      encoding: "utf-8",
    });
    assert(result.status === 0, `timeline image runtime transform failed: ${result.stderr || result.stdout}`);
    return JSON.parse(result.stdout.trim());
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

assert(
  workflowRouteSource.includes('if (stage === "scene-images" && project.autoRun?.status === "active")') &&
    workflowRouteSource.includes("stopShortFormAutoRun(id);"),
  "Generate Visuals cancellation must also stop active whole-video auto-run state.",
);
assert(
  workflowRouteSource.includes('stage === "scene-images" && effectiveAction === "request-scene-change"') &&
    workflowRouteSource.includes("stopShortFormStageRun(id, \"scene-images\", latestSceneImagesRequest?.runId);"),
  "Targeted visual rerenders should stop the active scene-images worker before enqueueing the replacement chain.",
);
assert(
  secondaryShellSource.includes("Stop auto-generation") &&
    secondaryShellSource.includes("/api/short-form-videos/${projectId}/auto-run") &&
    secondaryShellSource.includes("method: 'DELETE'"),
  "Sidebar auto-generation dialog must expose a stop action wired to the auto-run DELETE API.",
);
assert(
  !detailViewSource.includes("Caption / visual timeline") &&
    !detailViewSource.includes("VisualCaptionTimeline"),
  "Generate Visuals should not render the broken Caption / visual timeline section.",
);

const xml = `
<video version="2">
  <assets>
    <image id="parent-img"><prompt>Parent</prompt></image>
    <image id="child-img" basedOn="parent-visual"><prompt>Child</prompt></image>
    <image id="grandchild-img" basedOn="child-visual"><prompt>Grandchild</prompt></image>
    <image id="sibling-img"><prompt>Sibling</prompt></image>
    <image id="image-id-child" basedOn="parent-img"><prompt>Image id child</prompt></image>
  </assets>
  <timeline>
    <visual id="parent-visual" imageId="parent-img"><label>Parent</label></visual>
    <visual id="child-visual" imageId="child-img"><label>Child</label></visual>
    <visual id="grandchild-visual" imageId="grandchild-img"><label>Grandchild</label></visual>
    <visual id="sibling-visual" imageId="sibling-img"><label>Sibling</label></visual>
    <visual id="image-id-child-visual" imageId="image-id-child"><label>Image id child</label></visual>
  </timeline>
</video>
`;

const parentExpansion = runExpansion(xml, [1]);
assert(
  JSON.stringify(parentExpansion) === JSON.stringify([1, 2, 5, 3]),
  `parent visual expansion should include recursive descendants in dependency order, got ${JSON.stringify(parentExpansion)}`,
);
assert(!parentExpansion.includes(4), "non-descendant sibling visual must not be reset by parent rerender");

const childExpansion = runExpansion(xml, [2]);
assert(
  JSON.stringify(childExpansion) === JSON.stringify([2, 3]),
  `child visual expansion should include only child plus recursive descendants, got ${JSON.stringify(childExpansion)}`,
);
assert(!childExpansion.includes(1) && !childExpansion.includes(4) && !childExpansion.includes(5), "child rerender should not include ancestors or unrelated visuals");

const timelineImageXml = `
<video version="2">
  <assets></assets>
  <timeline>
    <visual id="parent-visual"><image id="parent-img"><prompt>Parent</prompt></image></visual>
    <visual id="reuse-visual" imageId="parent-visual"><label>Reuse parent</label></visual>
    <visual id="child-visual"><image id="child-img" basedOn="parent-visual"><prompt>Child</prompt></image></visual>
    <visual id="grandchild-visual"><image id="grandchild-img" basedOn="child-visual"><prompt>Grandchild</prompt></image></visual>
    <visual id="sibling-visual"><image id="sibling-img"><prompt>Sibling</prompt></image></visual>
  </timeline>
</video>
`;

const timelineParentExpansion = runExpansion(timelineImageXml, [1]);
assert(
  JSON.stringify(timelineParentExpansion) === JSON.stringify([1, 2, 3, 4]),
  `timeline inline image expansion should include reuse and recursive descendants, got ${JSON.stringify(timelineParentExpansion)}`,
);
assert(!timelineParentExpansion.includes(5), "timeline inline sibling visual must not be reset by parent rerender");

const duplicateEmptyInlineReuse = runTimelineRuntimeTransform(`
<video version="2">
  <timeline>
    <visual id="source-visual">
      <image id="shared-img" characterDriven="false"><prompt>Source prompt</prompt></image>
    </visual>
    <visual id="reuse-visual">
      <image id="shared-img" characterDriven="false" />
    </visual>
  </timeline>
</video>
`);
assert(
  duplicateEmptyInlineReuse.xml.includes('<visual id="reuse-visual" imageId="shared-img" />'),
  "empty later inline image with an existing id should be normalized to imageId reuse.",
);
assert(
  duplicateEmptyInlineReuse.xml.match(/<image id="shared-img"/g)?.length === 1,
  "runtime XML should keep only the first real shared-img image asset.",
);

console.log("Short-form visual dependency rerender verification passed.");
