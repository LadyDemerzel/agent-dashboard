import fs from "fs";
import os from "os";
import path from "path";
import { pathToFileURL } from "url";

const repoRoot = process.cwd();
const orchestratorPath = path.join(repoRoot, "src/lib/short-form-auto-run-orchestrator.ts");
const source = fs.readFileSync(orchestratorPath, "utf-8");
const videosPath = path.join(repoRoot, "src/lib/short-form-videos.ts");
const videosSource = fs.readFileSync(videosPath, "utf-8");
const workerPath = path.join(repoRoot, "scripts/short-form-stage-worker.mjs");
const workerSource = fs.readFileSync(workerPath, "utf-8");
const stageRunnerPath = path.join(repoRoot, "src/lib/short-form-stage-runner.ts");
const stageRunnerSource = fs.readFileSync(stageRunnerPath, "utf-8");
const xmlWorkerPath = path.join(repoRoot, "scripts/xml-script-worker.mjs");
const xmlWorkerSource = fs.readFileSync(xmlWorkerPath, "utf-8");
const soundWorkerPath = path.join(repoRoot, "scripts/sound-design-worker.mjs");
const soundWorkerSource = fs.readFileSync(soundWorkerPath, "utf-8");
const xmlRoutePath = path.join(repoRoot, "src/app/api/short-form-videos/[id]/xml-script/route.ts");
const xmlRouteSource = fs.readFileSync(xmlRoutePath, "utf-8");
const soundRoutePath = path.join(repoRoot, "src/app/api/short-form-videos/[id]/sound-design/route.ts");
const soundRouteSource = fs.readFileSync(soundRoutePath, "utf-8");
const visualPlanningSettingsPath = path.join(repoRoot, "src/lib/short-form-xml-visual-planning-settings.ts");
const visualPlanningSettingsSource = fs.readFileSync(visualPlanningSettingsPath, "utf-8");
const soundDesignSettingsPath = path.join(repoRoot, "src/lib/short-form-sound-design-settings.ts");
const soundDesignSettingsSource = fs.readFileSync(soundDesignSettingsPath, "utf-8");
const sessionLogsPath = path.join(repoRoot, "src/lib/short-form-session-logs.ts");
const sessionLogsSource = fs.readFileSync(sessionLogsPath, "utf-8");
const secondaryNavPath = path.join(repoRoot, "src/lib/short-form-secondary-nav.ts");
const secondaryNavSource = fs.readFileSync(secondaryNavPath, "utf-8");

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
  "const force = options?.force ?? !options?.prepareCurrent;",
  "Selected downstream auto-run steps must force a fresh run instead of reusing old approved artifacts.",
);
assertIncludes(
  "selectedStepNeedsFreshRun(autoRun, stepId)",
  "Auto-run reconciliation must distinguish selected downstream steps from the prepared current step.",
);
assertIncludes(
  "workflowStageForAutoRunStep(stepId) &&",
  "Workflow-backed selected downstream steps must require a request from the current auto-run window.",
);
assertIncludes(
  "selectedStepArtifactFresh(autoRun, stepId, project.sceneImages.updatedAt)",
  "Generate Visuals completion must require a fresh artifact for selected downstream auto-run steps.",
);
assertIncludes(
  "options?.force ||\n    !current.soundDesign.exists",
  "Plan Sound Design must force regeneration when selected as a downstream auto-run step.",
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
assertIncludes(
  'xmlStep?.status === "completed"',
  "Plan Visuals auto-run must wait for the XML pipeline step to complete, not just any existing XML content.",
);
assertIncludes(
  "freshAtOrAfter(nextProject.xmlScript.updatedAt, requestedAt)",
  "Plan Visuals auto-run must require a fresh XML artifact from the current request.",
);
assertIncludes(
  "readXmlScriptRunProgress",
  "Plan Visuals auto-run must inspect the XML worker status file before approving XML.",
);
assertIncludes(
  "waitForXmlScriptRunVerified(projectId, signal, step, runId)",
  "Plan Visuals auto-run must wait for the XML worker's final verified marker before approving XML.",
);
assertIncludes(
  "waitForActiveXmlPipelineToSettle",
  "Auto-run must wait for an already-running XML pipeline instead of retrying into a 409 conflict.",
);
assertIncludes(
  "if (current.xmlScript.audioUrl) return current;",
  "Narration auto-run retry must reuse fresh audio after an existing XML pipeline completes.",
);
assertIncludes(
  "if (current.xmlScript.captions?.length) return current;",
  "Caption auto-run retry must reuse fresh captions after an existing XML pipeline completes.",
);
const perStepApprovalMatches = source.match(/await reconcileCompletedAutoRunApprovals\(/g) || [];
if (perStepApprovalMatches.length < 3) {
  throw new Error(
    "Auto-run should reconcile approvals immediately after each completed step, not only at the end of the run.",
  );
}
if (!videosSource.includes("soundDesignRunStillNeedsValidation")) {
  throw new Error(
    "Sound-design auto-run must keep tracking the worker after a fresh XML artifact appears until the worker validates or fails.",
  );
}
if (!videosSource.includes('stageDoc.agentRun = stageDoc.revision?.agentRun || deriveLatestStageAgentRun(projectId, "sound-design", stageDoc);')) {
  throw new Error(
    "Plan Sound Design must expose revision agent-run metadata on soundDesign.agentRun so session logs can stream on the custom stage page.",
  );
}
if (!videosSource.includes('workflowRun?.status !== "verified"')) {
  throw new Error(
    "Sound-design auto-run must not approve fresh-but-unverified sound-design output.",
  );
}
const soundRunLookupIndex = videosSource.indexOf("const workflowRun = stage === \"sound-design\"");
const freshArtifactIndex = videosSource.indexOf("const hasFreshArtifact = hasFreshStageArtifact", soundRunLookupIndex);
const guardedFreshReturnIndex = videosSource.indexOf("if (hasFreshArtifact && !soundDesignRunStillNeedsValidation)", freshArtifactIndex);
if (soundRunLookupIndex < 0 || freshArtifactIndex < soundRunLookupIndex || guardedFreshReturnIndex < freshArtifactIndex) {
  throw new Error(
    "Sound-design freshness checks must inspect the worker run first, then only clear revision tracking after validation.",
  );
}
if (!workerSource.includes("activeStatusText: `Running direct ${job.stage} workflow`")) {
  throw new Error("Direct workflow workers should publish progress before long provider calls.");
}
if (!workerSource.includes("SHORT_FORM_SCENE_IMAGES_COMMAND_TIMEOUT_MS")) {
  throw new Error("Scene image direct workflow needs an explicit command timeout.");
}
if (!workerSource.includes("process.on(\"SIGTERM\"")) {
  throw new Error("Stage workers should turn termination into a visible failed run.");
}
if (!xmlRouteSource.includes('process.env.SHORT_FORM_RELIABLE_MODEL || "openai/gpt-5.5"')) {
  throw new Error("Plan Visuals must default to a Scribe-allowed model so session logs can stream immediately.");
}
if (!soundRouteSource.includes('process.env.SHORT_FORM_RELIABLE_MODEL || "openai/gpt-5.5"')) {
  throw new Error("Plan Sound Design must default to a Scribe-allowed model so session logs can stream immediately.");
}
if (!stageRunnerSource.includes('process.env.SHORT_FORM_RELIABLE_MODEL || "openai/gpt-5.5"')) {
  throw new Error("Workflow-backed stages must default to a Scribe/Oracle-allowed model.");
}
for (const [label, body] of [
  ["Plan Visuals worker", xmlWorkerSource],
  ["Plan Sound Design worker", soundWorkerSource],
  ["workflow stage worker", workerSource],
]) {
  if (!body.includes('status === "error"') || !body.includes("Hook agent run failed:")) {
    throw new Error(`${label} must treat hook-level error responses as failed spawns instead of waiting for nonexistent logs/artifacts.`);
  }
}
if (!xmlWorkerSource.includes("readXmlArtifactBody")) {
  throw new Error("Plan Visuals XML verification must inspect the XML body, not just xml-script.md mtime.");
}
if (!xmlWorkerSource.includes("waitForXmlAuthoringArtifact")) {
  throw new Error("Plan Visuals XML worker must wait for a fresh authoring artifact.");
}
if (!xmlWorkerSource.includes("snapshotXmlAuthoringArtifact")) {
  throw new Error("Plan Visuals XML worker must snapshot the existing XML artifact before each authoring attempt.");
}
if (!xmlWorkerSource.includes("body !== previousBody")) {
  throw new Error("Plan Visuals XML worker must reject body-identical rewrites even when xml-script.md was touched.");
}
if (!soundWorkerSource.includes("snapshotSoundDesignAuthoringArtifact")) {
  throw new Error("Plan Sound Design worker must snapshot the existing sound-design artifact before each authoring attempt.");
}
if (!soundWorkerSource.includes("hasFreshSoundDesignAuthoringArtifact")) {
  throw new Error("Plan Sound Design worker must validate fresh authoring by artifact body, not just mtime.");
}
if (!soundWorkerSource.includes("body !== previousBody")) {
  throw new Error("Plan Sound Design worker must reject body-identical rewrites even when sound-design.md was touched.");
}
if (!visualPlanningSettingsSource.includes("Rewriting the same XML with only front matter/status/timestamp changes is invalid.")) {
  throw new Error("Plan Visuals prompt must instruct Scribe not to rewrite identical XML.");
}
if (!visualPlanningSettingsSource.includes("Motion graphic text should work as read-along support")) {
  throw new Error("Plan Visuals prompt must include read-along motion graphic text guidance.");
}
if (!visualPlanningSettingsSource.includes("matching spoken phrase") || !visualPlanningSettingsSource.includes("Do not turn motion graphics into captions/subtitles")) {
  throw new Error("Plan Visuals read-along guidance must tie motion graphic text/reveals to narration without turning templates into captions.");
}
if (!soundDesignSettingsSource.includes("Rewriting the same XML with only front matter/status/timestamp changes is invalid.")) {
  throw new Error("Plan Sound Design prompt must instruct Scribe not to rewrite identical XML.");
}
if (!sessionLogsSource.includes("if (!sessionId) return undefined;")) {
  throw new Error("Session-log lookup must not treat an empty session id as matching every historical session file.");
}
if (
  !secondaryNavSource.includes("project.xmlScript.exists ||") ||
  !secondaryNavSource.includes("project.sceneImages.pending ||") ||
  !secondaryNavSource.includes("project.sceneImages.scenes.length > 0")
) {
  throw new Error(
    "Generate Visuals navigation should unlock when a visual plan exists, not only after the XML is approved.",
  );
}
if (sessionLogsSource.indexOf("const normalizedSessionKey = sessionKey?.trim();") > sessionLogsSource.indexOf("const exactCandidates = [")) {
  throw new Error("Session-log lookup must prefer the explicit session key before loose session-id matching.");
}
if (!soundWorkerSource.includes("attempt.waitingForArtifact = true;") || !soundWorkerSource.includes("attempt.spawnResult = await spawnAuthoringAttempt(job, model, index);")) {
  throw new Error("Plan Sound Design worker must record the spawned Scribe session before waiting for the artifact.");
}
if (!xmlWorkerSource.includes("attempt.spawnResult = await spawnAuthoringAttempt(job, model, index);\n          updateStatus();")) {
  throw new Error("Plan Visuals worker must persist the spawned Scribe session before waiting for XML output.");
}
if (!workerSource.includes("attempt.spawnResult = spawnResult;\n      finalizeRun({\n        status: \"running\",\n      });")) {
  throw new Error("Workflow stage workers must persist spawned agent sessions while runs are still active.");
}

const {
  hasFreshXmlAuthoringArtifact,
  snapshotXmlAuthoringArtifact,
} = await import(pathToFileURL(xmlWorkerPath).href);
const {
  hasFreshSoundDesignAuthoringArtifact,
  snapshotSoundDesignAuthoringArtifact,
} = await import(pathToFileURL(soundWorkerPath).href);

function writeXmlFixture(filePath, frontMatter, body, mtimeMs) {
  fs.writeFileSync(
    filePath,
    [
      "---",
      frontMatter,
      "---",
      "",
      body,
    ].join("\n"),
    "utf-8",
  );
  fs.utimesSync(filePath, new Date(mtimeMs), new Date(mtimeMs));
}

const xmlFreshnessDir = fs.mkdtempSync(path.join(os.tmpdir(), "xml-freshness-"));
try {
  const xmlPath = path.join(xmlFreshnessDir, "xml-script.md");
  const validXmlBody = "<video version=\"2\"><assets></assets><timeline></timeline></video>";
  const staleMtimeMs = Date.now() - 10_000;
  writeXmlFixture(xmlPath, "status: working\nupdatedAt: \"2026-05-19T12:40:00.000Z\"", validXmlBody, staleMtimeMs);
  const staleSnapshot = snapshotXmlAuthoringArtifact(xmlPath);
  const authoringStartedAtMs = staleMtimeMs + 5_000;

  if (hasFreshXmlAuthoringArtifact(xmlPath, staleSnapshot, authoringStartedAtMs)) {
    throw new Error("Plan Visuals XML freshness must reject untouched stale XML, even when the XML body is valid.");
  }

  writeXmlFixture(
    xmlPath,
    "status: needs review\nupdatedAt: \"2026-05-19T12:43:25.000Z\"",
    validXmlBody,
    authoringStartedAtMs + 2_000,
  );
  if (hasFreshXmlAuthoringArtifact(xmlPath, staleSnapshot, authoringStartedAtMs)) {
    throw new Error("Plan Visuals XML freshness must reject a same-body XML artifact touched after the authoring attempt.");
  }

  const placeholderSnapshot = snapshotXmlAuthoringArtifact(xmlPath);
  writeXmlFixture(
    xmlPath,
    "status: needs review\nupdatedAt: \"2026-05-19T12:44:00.000Z\"",
    "<video version=\"2\"><script><!-- Waiting for the XML script pipeline to generate narration, alignment, captions, and visuals. --></script></video>",
    authoringStartedAtMs + 4_000,
  );
  if (hasFreshXmlAuthoringArtifact(xmlPath, placeholderSnapshot, authoringStartedAtMs)) {
    throw new Error("Plan Visuals XML freshness must keep rejecting placeholder XML after an authoring attempt.");
  }

  writeXmlFixture(
    xmlPath,
    "status: needs review\nupdatedAt: \"2026-05-19T12:45:00.000Z\"",
    "<video version=\"2\"><assets><image id=\"new\" /></assets><timeline></timeline></video>",
    authoringStartedAtMs + 6_000,
  );
  if (!hasFreshXmlAuthoringArtifact(xmlPath, placeholderSnapshot, authoringStartedAtMs)) {
    throw new Error("Plan Visuals XML freshness must accept a fresh body-different XML artifact.");
  }
} finally {
  fs.rmSync(xmlFreshnessDir, { recursive: true, force: true });
}

const soundFreshnessDir = fs.mkdtempSync(path.join(os.tmpdir(), "sound-freshness-"));
try {
  const soundPath = path.join(soundFreshnessDir, "sound-design.md");
  const validSoundBody = [
    "<sound_design version=\"2\">",
    "  <track id=\"impacts\" role=\"punctuation\" gainDb=\"0\">",
    "    <effect id=\"fx-one\" type=\"impact\" start=\"0.00\" duration=\"0.50\" gainDb=\"-8\" searchQuery=\"soft hit\" />",
    "  </track>",
    "</sound_design>",
  ].join("\n");
  const changedSoundBody = validSoundBody.replace("fx-one", "fx-two");
  const staleMtimeMs = Date.now() - 10_000;
  writeXmlFixture(soundPath, "status: working\nupdatedAt: \"2026-05-19T12:50:00.000Z\"", validSoundBody, staleMtimeMs);
  const staleSnapshot = snapshotSoundDesignAuthoringArtifact(soundPath);
  const authoringStartedAtMs = staleMtimeMs + 5_000;

  if (hasFreshSoundDesignAuthoringArtifact(soundPath, staleSnapshot, authoringStartedAtMs)) {
    throw new Error("Plan Sound Design freshness must reject untouched stale XML, even when the XML body is valid.");
  }

  writeXmlFixture(
    soundPath,
    "status: needs review\nupdatedAt: \"2026-05-19T12:51:00.000Z\"",
    validSoundBody,
    authoringStartedAtMs + 2_000,
  );
  if (hasFreshSoundDesignAuthoringArtifact(soundPath, staleSnapshot, authoringStartedAtMs)) {
    throw new Error("Plan Sound Design freshness must reject a same-body XML artifact touched after the authoring attempt.");
  }

  writeXmlFixture(
    soundPath,
    "status: needs review\nupdatedAt: \"2026-05-19T12:52:00.000Z\"",
    "Waiting for the dashboard workflow to plan tasteful sound design before audio generation.",
    authoringStartedAtMs + 4_000,
  );
  if (hasFreshSoundDesignAuthoringArtifact(soundPath, staleSnapshot, authoringStartedAtMs)) {
    throw new Error("Plan Sound Design freshness must keep rejecting placeholder content after an authoring attempt.");
  }

  writeXmlFixture(
    soundPath,
    "status: needs review\nupdatedAt: \"2026-05-19T12:53:00.000Z\"",
    changedSoundBody,
    authoringStartedAtMs + 6_000,
  );
  if (!hasFreshSoundDesignAuthoringArtifact(soundPath, staleSnapshot, authoringStartedAtMs)) {
    throw new Error("Plan Sound Design freshness must accept a fresh body-different XML artifact.");
  }
} finally {
  fs.rmSync(soundFreshnessDir, { recursive: true, force: true });
}

console.log("short-form auto-run hardening checks passed");
