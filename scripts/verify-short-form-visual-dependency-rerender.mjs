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

console.log("Short-form visual dependency rerender verification passed.");
