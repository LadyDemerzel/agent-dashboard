import fs from "fs";
import path from "path";

const repoRoot = process.cwd();
const orchestratorPath = path.join(repoRoot, "src/lib/short-form-auto-run-orchestrator.ts");
const source = fs.readFileSync(orchestratorPath, "utf-8");

function assertIncludes(needle, message) {
  if (!source.includes(needle)) {
    throw new Error(message);
  }
}

assertIncludes(
  "reconcileFinishedAutoRunWithProjectState(projectId, project)",
  "Finished auto-runs are not reconciled against the actual approved project state.",
);
assertIncludes(
  "autoRunStepActuallyCompleted",
  "Auto-run reconciliation does not check actual per-step completion.",
);
assertIncludes(
  "ensureFinalVideoSceneAssets(",
  "Final Video auto-run does not preflight required scene assets before rendering.",
);
assertIncludes(
  "{ force: true }",
  "Missing scene assets do not force a Generate Visuals repair pass.",
);
assertIncludes(
  "formatFinalVideoAssetPreflightFailure",
  "Missing scene asset failures do not use a precise actionable error.",
);

console.log("short-form auto-run hardening checks passed");
