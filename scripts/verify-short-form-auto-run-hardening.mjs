import fs from "fs";
import path from "path";

const repoRoot = process.cwd();
const orchestratorPath = path.join(repoRoot, "src/lib/short-form-auto-run-orchestrator.ts");
const source = fs.readFileSync(orchestratorPath, "utf-8");
const workerPath = path.join(repoRoot, "scripts/short-form-stage-worker.mjs");
const workerSource = fs.readFileSync(workerPath, "utf-8");

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

assertIncludes(
  "autoRunFailedStepFromWorkflowRequests",
  "Finished auto-runs are not checked for failed workflow requests from the same auto-run window.",
);
assertIncludes(
  "requestTimeInAutoRunWindow",
  "Auto-run status reconciliation does not bind workflow request timestamps to the auto-run window.",
);
assertIncludes(
  "latestWorkflowProgressForAutoRunStep",
  "Auto-run completion can still rely on stale approved artifacts instead of the latest workflow run status.",
);
assertIncludes(
  "repairCompletedSoundDesignApprovals(projectId, project)",
  "Completed auto-runs should repair sound-design approvals that were overwritten after auto-run completion.",
);
assertIncludes(
  "completedBeforeFailedStep",
  "Failed auto-runs should truncate completedSteps to steps before the failed workflow step.",
);
assertIncludes(
  "workflowProgressStaleForStep",
  "Stopped/completed auto-run reconciliation should treat stale running workflow runs as failures.",
);
if (!workerSource.includes("activeStatusText: `Running direct ${job.stage} workflow`")) {
  throw new Error("Direct workflow workers should publish progress before long provider calls.");
}
if (!workerSource.includes("SHORT_FORM_SCENE_IMAGES_COMMAND_TIMEOUT_MS")) {
  throw new Error("Scene image direct workflow needs an explicit command timeout.");
}
if (!workerSource.includes("process.on(\"SIGTERM\"")) {
  throw new Error("Stage workers should turn termination into a visible failed run.");
}

console.log("short-form auto-run hardening checks passed");
