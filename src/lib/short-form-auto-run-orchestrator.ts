import fs from "fs";
import path from "path";
import {
  buildShortFormAutoRunState,
  getShortFormAutoRunCurrentStep,
  getShortFormAutoRunStepLabel,
  getShortFormAutoRunSubsequentSteps,
  SHORT_FORM_AUTO_RUN_STEPS,
  summarizeShortFormAutoRunError,
  type ShortFormAutoRunState,
  type ShortFormAutoRunStepDefinition,
  type ShortFormAutoRunStepId,
} from "@/lib/short-form-auto-run";
import { getSoundDesignHandoffState } from "@/lib/short-form-sound-design-handoff";
import {
  appendStatusLog,
  type DeliverableStatus,
} from "@/lib/status";
import {
  getStageFilePath,
  getProjectDir,
  getProjectMetaPath,
  getShortFormProject,
  getTextScriptRunManifestPath,
  readSceneManifest,
  updateProjectMeta,
  updateStageFrontMatterStatus,
  type ShortFormProject,
  type ShortFormStageKey,
  type StageDocumentSummary,
} from "@/lib/short-form-videos";
import type { ShortFormDetailRouteSection } from "@/lib/short-form-video-navigation";

type ApiEnvelope<T = unknown> = {
  success: boolean;
  data?: T;
  error?: string;
  runId?: string;
};

type AutoRunJob = {
  autoRunId: string;
  projectId: string;
  controller: AbortController;
  promise: Promise<void>;
};

type AutoRunStepRunOptions = {
  prepareCurrent?: boolean;
  force?: boolean;
};

const jobs = new Map<string, AutoRunJob>();

class AutoRunStoppedError extends Error {
  constructor(message = "Auto-run was stopped.") {
    super(message);
    this.name = "AutoRunStoppedError";
  }
}

function nowIso() {
  return new Date().toISOString();
}

function sleep(ms: number, signal: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    if (signal.aborted) {
      reject(new AutoRunStoppedError());
      return;
    }
    const timeout = setTimeout(resolve, ms);
    signal.addEventListener(
      "abort",
      () => {
        clearTimeout(timeout);
        reject(new AutoRunStoppedError());
      },
      { once: true },
    );
  });
}

function approved(status?: string) {
  return status === "approved" || status === "published";
}

function needsReviewStatus(status?: string) {
  const normalized = status?.trim().toLowerCase().replace(/[-_]+/g, " ");
  return normalized === "needs review" || normalized === "review";
}

function docCanApprove(doc?: StageDocumentSummary) {
  return Boolean(doc?.exists && !doc.pending && needsReviewStatus(doc.status));
}

function hasActiveXmlPipeline(project: ShortFormProject) {
  return Boolean(
    project.xmlScript.pending ||
      project.xmlScript.pipeline?.status === "running" ||
      project.xmlScript.pipeline?.steps.some((step) => step.status === "active"),
  );
}

function stageFailed(project: ShortFormProject, stepId: ShortFormAutoRunStepId) {
  if (stepId === "generate-narration-audio") {
    return project.xmlScript.pipeline?.steps.some(
      (step) =>
        ["narration", "silence-removal", "alignment"].includes(step.id) &&
        step.status === "failed",
    );
  }
  if (stepId === "plan-captions") {
    return project.xmlScript.pipeline?.steps.some(
      (step) => step.id === "captions" && step.status === "failed",
    );
  }
  if (stepId === "plan-visuals") {
    return project.xmlScript.pipeline?.steps.some(
      (step) => step.id === "xml" && step.status === "failed",
    );
  }
  if (stepId === "generate-visuals") {
    return Boolean(project.sceneImages.revision?.isFailed);
  }
  if (stepId === "plan-sound-design" || stepId === "generate-sound-design") {
    return Boolean(project.soundDesign.revision?.isFailed);
  }
  if (stepId === "final-video") {
    return Boolean(
      project.video.pipeline?.status === "failed" || project.video.revision?.isFailed,
    );
  }
  if (stepId === "research") return Boolean(project.research.revision?.isFailed);
  if (stepId === "text-script") return Boolean(project.script.revision?.isFailed);
  return false;
}

function freshAtOrAfter(updatedAt: string | undefined, requestedAt: string) {
  if (!updatedAt) return false;
  const updated = Date.parse(updatedAt);
  const requested = Date.parse(requestedAt);
  return Number.isFinite(updated) && Number.isFinite(requested) && updated + 1000 >= requested;
}

function updatedBefore(candidate: string | undefined, dependency: string | undefined) {
  if (!candidate || !dependency) return false;
  const candidateTime = Date.parse(candidate);
  const dependencyTime = Date.parse(dependency);
  return (
    Number.isFinite(candidateTime) &&
    Number.isFinite(dependencyTime) &&
    candidateTime + 1000 < dependencyTime
  );
}

function stageDocReadyFromRequest(doc: StageDocumentSummary, requestedAt: string) {
  return (
    !doc.pending &&
    !doc.revision?.isPending &&
    doc.exists &&
    doc.content.trim().length > 0 &&
    freshAtOrAfter(doc.updatedAt, requestedAt)
  );
}

function stageDocRunFailed(doc: StageDocumentSummary, runId?: string) {
  if (!doc.revision?.isFailed) return false;
  if (!runId) return true;
  return doc.revision.agentRun?.runId === runId;
}

function xmlPipelineStepUpdatedAt(project: ShortFormProject, stepId: string) {
  return project.xmlScript.pipeline?.steps.find((step) => step.id === stepId)?.updatedAt;
}

type WorkflowRunStatus = "running" | "verified" | "failed";

type WorkflowRunProgress = {
  runId: string;
  status?: WorkflowRunStatus;
  statusPath: string;
  lastProgressAt?: string;
  activeStep?: string;
  activeIterationNumber?: number;
  activeStatusText?: string;
  errorMessage?: string;
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function asString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function asNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function latestIso(...values: Array<string | undefined>) {
  const latest = values.reduce<number>((max, value) => {
    if (!value) return max;
    const time = Date.parse(value);
    return Number.isFinite(time) ? Math.max(max, time) : max;
  }, Number.NEGATIVE_INFINITY);

  return Number.isFinite(latest) ? new Date(latest).toISOString() : undefined;
}

function workflowRunStatus(value: unknown): WorkflowRunStatus | undefined {
  return value === "running" || value === "verified" || value === "failed"
    ? value
    : undefined;
}

function readWorkflowRunProgress(
  projectId: string,
  stage: string,
  runId: string,
): WorkflowRunProgress | undefined {
  if (!runId) return undefined;

  const statusPath = path.join(getProjectDir(projectId), ".workflow-runs", `${runId}.status.json`);
  let raw = "";
  let statusMtime: string | undefined;
  try {
    const stat = fs.statSync(statusPath);
    statusMtime = new Date(stat.mtimeMs).toISOString();
    raw = fs.readFileSync(statusPath, "utf-8");
  } catch {
    return undefined;
  }

  let parsed: Record<string, unknown>;
  try {
    parsed = asRecord(JSON.parse(raw));
  } catch {
    return undefined;
  }

  if (
    asString(parsed.runId) !== runId ||
    asString(parsed.projectId) !== projectId ||
    asString(parsed.stage) !== stage
  ) {
    return undefined;
  }

  const attempts = Array.isArray(parsed.attempts) ? parsed.attempts.map(asRecord) : [];
  const latestAttempt = attempts[attempts.length - 1];
  const errorAttempt = [...attempts]
    .reverse()
    .find((attempt) => asString(attempt.error));
  const attemptTimes = attempts.flatMap((attempt) => [
    asString(attempt.startedAt),
    asString(attempt.finishedAt),
  ]);
  const textScriptRunId = asString(parsed.textScriptRunId);
  let textScriptManifestMtime: string | undefined;
  if (textScriptRunId) {
    try {
      textScriptManifestMtime = new Date(
        fs.statSync(getTextScriptRunManifestPath(projectId, textScriptRunId)).mtimeMs,
      ).toISOString();
    } catch {
      textScriptManifestMtime = undefined;
    }
  }

  return {
    runId,
    status: workflowRunStatus(parsed.status),
    statusPath,
    lastProgressAt: latestIso(
      statusMtime,
      textScriptManifestMtime,
      asString(parsed.startedAt),
      asString(parsed.verifiedAt),
      asString(parsed.failedAt),
      ...attemptTimes,
    ),
    activeStep: asString(parsed.activeStep),
    activeIterationNumber: asNumber(parsed.activeIterationNumber),
    activeStatusText: asString(parsed.activeStatusText),
    errorMessage: asString(parsed.errorMessage) || asString(errorAttempt?.error) || asString(latestAttempt?.error),
  };
}

function readXmlScriptRunProgress(
  projectId: string,
  runId: string,
): WorkflowRunProgress | undefined {
  if (!runId) return undefined;

  const statusPath = path.join(getProjectDir(projectId), ".xml-script-runs", `${runId}.status.json`);
  let raw = "";
  let statusMtime: string | undefined;
  try {
    const stat = fs.statSync(statusPath);
    statusMtime = new Date(stat.mtimeMs).toISOString();
    raw = fs.readFileSync(statusPath, "utf-8");
  } catch {
    return undefined;
  }

  let parsed: Record<string, unknown>;
  try {
    parsed = asRecord(JSON.parse(raw));
  } catch {
    return undefined;
  }

  if (
    asString(parsed.runId) !== runId ||
    asString(parsed.projectId) !== projectId
  ) {
    return undefined;
  }

  const attempts = Array.isArray(parsed.attempts) ? parsed.attempts.map(asRecord) : [];
  const latestAttempt = attempts[attempts.length - 1];
  const errorAttempt = [...attempts]
    .reverse()
    .find((attempt) => asString(attempt.error));
  const attemptTimes = attempts.flatMap((attempt) => [
    asString(attempt.startedAt),
    asString(attempt.finishedAt),
  ]);
  const status = workflowRunStatus(parsed.status);
  const progress = asRecord(parsed.progress);

  return {
    runId,
    status,
    statusPath,
    lastProgressAt: latestIso(
      statusMtime,
      asString(parsed.startedAt),
      asString(parsed.verifiedAt),
      asString(parsed.failedAt),
      asString(latestAttempt?.startedAt),
      asString(latestAttempt?.finishedAt),
      ...attemptTimes,
    ),
    activeStep: asString(latestAttempt?.step) || asString(progress.step),
    activeStatusText: asString(latestAttempt?.error)
      || asString(parsed.errorMessage)
      || (status ? `XML script run ${status}` : undefined),
    errorMessage: asString(parsed.errorMessage) || asString(errorAttempt?.error),
  };
}

function formatMinutes(ms: number) {
  return `${Math.round(ms / 60_000)} minutes`;
}

function describeWorkflowProgress(progress: WorkflowRunProgress) {
  const parts = [
    progress.activeStatusText,
    progress.activeStep ? `step: ${progress.activeStep}` : undefined,
    progress.activeIterationNumber ? `iteration: ${progress.activeIterationNumber}` : undefined,
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(", ") : "no detailed progress status";
}

function workflowProgressInactiveMs(progress: WorkflowRunProgress) {
  const lastProgressMs = progress.lastProgressAt ? Date.parse(progress.lastProgressAt) : Number.NaN;
  return Number.isFinite(lastProgressMs) ? Date.now() - lastProgressMs : undefined;
}

function workflowProgressStaleForStep(
  progress: WorkflowRunProgress,
  stepId: ShortFormAutoRunStepId,
) {
  if (progress.status !== "running") return false;
  const step = getStepDefinition(stepId);
  const staleProgressMs = step?.staleProgressTimeoutMs ?? step?.timeoutMs;
  const inactiveMs = workflowProgressInactiveMs(progress);
  return typeof staleProgressMs === "number" && typeof inactiveMs === "number" && inactiveMs >= staleProgressMs;
}

function workflowProgressFailureMessage(
  progress: WorkflowRunProgress,
  stepId: ShortFormAutoRunStepId,
) {
  const label = getShortFormAutoRunStepLabel(stepId);
  if (progress.status === "failed") {
    return (
      progress.errorMessage ||
      `${label} workflow run ${progress.runId.slice(0, 8)} failed. Open that page for details.`
    );
  }
  if (workflowProgressStaleForStep(progress, stepId)) {
    const step = getStepDefinition(stepId);
    const staleProgressMs = step?.staleProgressTimeoutMs ?? step?.timeoutMs ?? 0;
    return `${label} workflow run ${progress.runId.slice(0, 8)} stopped making progress for more than ${formatMinutes(staleProgressMs)}. Last status: ${describeWorkflowProgress(progress)}.`;
  }
  return undefined;
}

async function parseEnvelope<T>(response: Response, fallback: string) {
  const payload = (await response.json().catch(() => null)) as ApiEnvelope<T> | null;
  if (!response.ok || !payload?.success) {
    throw new Error(payload?.error || fallback);
  }
  return payload;
}

async function postJson<T>(
  baseUrl: string,
  path: string,
  body?: Record<string, unknown>,
  fallback = "Request failed",
  signal?: AbortSignal,
) {
  return parseEnvelope<T>(
    await fetch(new URL(path, baseUrl), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body || {}),
      cache: "no-store",
      signal,
    }),
    fallback,
  );
}

async function patchJson<T>(
  baseUrl: string,
  path: string,
  body: Record<string, unknown>,
  fallback = "Request failed",
  signal?: AbortSignal,
) {
  return parseEnvelope<T>(
    await fetch(new URL(path, baseUrl), {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      cache: "no-store",
      signal,
    }),
    fallback,
  );
}

function assertAutoRunActive(projectId: string, autoRunId: string, signal: AbortSignal) {
  if (signal.aborted) throw new AutoRunStoppedError();
  const project = getShortFormProject(projectId);
  const autoRun = project?.autoRun;
  if (!project) throw new Error("Project not found");
  if (autoRun?.id !== autoRunId || autoRun.status !== "active") {
    throw new AutoRunStoppedError();
  }
  return project;
}

function saveAutoRun(projectId: string, autoRun: ShortFormAutoRunState) {
  updateProjectMeta(projectId, { autoRun });
  return autoRun;
}

function updateAutoRun(
  projectId: string,
  autoRun: ShortFormAutoRunState,
  updates: Partial<ShortFormAutoRunState>,
) {
  return saveAutoRun(projectId, {
    ...autoRun,
    ...updates,
    updatedAt: nowIso(),
  });
}

async function waitForProject(
  projectId: string,
  autoRunId: string,
  signal: AbortSignal,
  step: ShortFormAutoRunStepDefinition,
  predicate: (nextProject: ShortFormProject) => boolean,
  isFailed?: (nextProject: ShortFormProject) => boolean,
) {
  const deadline = Date.now() + step.timeoutMs;

  while (Date.now() < deadline) {
    const nextProject = assertAutoRunActive(projectId, autoRunId, signal);
    if (isFailed ? isFailed(nextProject) : stageFailed(nextProject, step.id)) {
      throw new Error(`${step.label} failed. Open that page for details.`);
    }
    if (predicate(nextProject)) return nextProject;
    await sleep(4000, signal);
  }

  throw new Error(`${step.label} did not finish before the auto-run timeout.`);
}

async function waitForTextScriptRun(
  projectId: string,
  autoRunId: string,
  signal: AbortSignal,
  step: ShortFormAutoRunStepDefinition,
  runId: string,
  predicate: (nextProject: ShortFormProject) => boolean,
) {
  const startedAtMs = Date.now();
  const noProgressDeadline = startedAtMs + step.timeoutMs;
  const hardTimeoutMs = step.hardTimeoutMs ?? Math.max(step.timeoutMs, 60 * 60_000);
  const hardDeadline = startedAtMs + hardTimeoutMs;
  const staleProgressMs = step.staleProgressTimeoutMs ?? step.timeoutMs;
  let sawMatchingRun = false;

  while (Date.now() < hardDeadline) {
    const nextProject = assertAutoRunActive(projectId, autoRunId, signal);
    if (stageDocRunFailed(nextProject.script, runId)) {
      throw new Error(`${step.label} failed. Open that page for details.`);
    }
    if (predicate(nextProject)) return nextProject;

    const progress = readWorkflowRunProgress(projectId, "script", runId);
    if (progress) {
      sawMatchingRun = true;

      if (progress.status === "failed") {
        throw new Error(
          `${step.label} workflow run ${runId.slice(0, 8)} failed${
            progress.errorMessage ? `: ${progress.errorMessage}` : "."
          }`,
        );
      }

      if (progress.status === "verified") {
        throw new Error(
          `${step.label} workflow run ${runId.slice(0, 8)} finished, but the dashboard could not find a fresh script artifact for this auto-run request. This protects against approving a stale Text Script.`,
        );
      }

      const lastProgressMs = progress.lastProgressAt
        ? Date.parse(progress.lastProgressAt)
        : Number.NaN;
      if (Number.isFinite(lastProgressMs)) {
        const inactiveMs = Date.now() - lastProgressMs;
        if (inactiveMs >= staleProgressMs) {
          throw new Error(
            `${step.label} workflow run ${runId.slice(0, 8)} stopped making progress for more than ${formatMinutes(staleProgressMs)}. Last status: ${describeWorkflowProgress(progress)}.`,
          );
        }
      } else if (Date.now() >= noProgressDeadline) {
        throw new Error(
          `${step.label} workflow run ${runId.slice(0, 8)} is active, but the dashboard could not read a progress timestamp for ${formatMinutes(step.timeoutMs)}.`,
        );
      }

      await sleep(4000, signal);
      continue;
    }

    if (Date.now() < noProgressDeadline) {
      await sleep(4000, signal);
      continue;
    }

    throw new Error(
      sawMatchingRun
        ? `${step.label} workflow run ${runId.slice(0, 8)} stopped reporting progress before publishing a fresh script.`
        : `${step.label} workflow run ${runId.slice(0, 8)} did not report progress within ${formatMinutes(step.timeoutMs)}.`,
    );
  }

  throw new Error(
    `${step.label} workflow run ${runId.slice(0, 8)} exceeded the ${formatMinutes(hardTimeoutMs)} hard auto-run limit while waiting for a fresh script artifact.`,
  );
}

async function waitForWorkflowRunVerified(
  projectId: string,
  signal: AbortSignal,
  step: ShortFormAutoRunStepDefinition,
  stage: string,
  runId?: string,
) {
  if (!runId) return;

  const startedAtMs = Date.now();
  const noProgressDeadline = startedAtMs + step.timeoutMs;
  const hardTimeoutMs = step.hardTimeoutMs ?? Math.max(step.timeoutMs, 60 * 60_000);
  const hardDeadline = startedAtMs + hardTimeoutMs;
  const staleProgressMs = step.staleProgressTimeoutMs ?? step.timeoutMs;

  while (Date.now() < hardDeadline) {
    if (signal.aborted) throw new AutoRunStoppedError();
    const progress = readWorkflowRunProgress(projectId, stage, runId);

    if (progress?.status === "verified") return;
    if (progress?.status === "failed") {
      throw new Error(
        `${step.label} workflow run ${runId.slice(0, 8)} failed${
          progress.errorMessage ? `: ${progress.errorMessage}` : "."
        }`,
      );
    }

    const lastProgressMs = progress?.lastProgressAt
      ? Date.parse(progress.lastProgressAt)
      : Number.NaN;
    if (Number.isFinite(lastProgressMs)) {
      const inactiveMs = Date.now() - lastProgressMs;
      if (inactiveMs >= staleProgressMs) {
        throw new Error(
          `${step.label} workflow run ${runId.slice(0, 8)} stopped making progress for more than ${formatMinutes(staleProgressMs)}. Last status: ${describeWorkflowProgress(progress!)}.`,
        );
      }
    } else if (Date.now() >= noProgressDeadline) {
      throw new Error(
        `${step.label} workflow run ${runId.slice(0, 8)} did not report progress within ${formatMinutes(step.timeoutMs)}.`,
      );
    }

    await sleep(4000, signal);
  }

  throw new Error(
    `${step.label} workflow run ${runId.slice(0, 8)} exceeded the ${formatMinutes(hardTimeoutMs)} hard auto-run limit before verification.`,
  );
}

async function waitForXmlScriptRunVerified(
  projectId: string,
  signal: AbortSignal,
  step: ShortFormAutoRunStepDefinition,
  runId?: string,
) {
  if (!runId) return;

  const startedAtMs = Date.now();
  const noProgressDeadline = startedAtMs + step.timeoutMs;
  const hardTimeoutMs = step.hardTimeoutMs ?? Math.max(step.timeoutMs, 60 * 60_000);
  const hardDeadline = startedAtMs + hardTimeoutMs;
  const staleProgressMs = step.staleProgressTimeoutMs ?? step.timeoutMs;

  while (Date.now() < hardDeadline) {
    if (signal.aborted) throw new AutoRunStoppedError();
    const progress = readXmlScriptRunProgress(projectId, runId);

    if (progress?.status === "verified") return;
    if (progress?.status === "failed") {
      throw new Error(
        `${step.label} XML run ${runId.slice(0, 8)} failed${
          progress.errorMessage ? `: ${progress.errorMessage}` : "."
        }`,
      );
    }

    const lastProgressMs = progress?.lastProgressAt
      ? Date.parse(progress.lastProgressAt)
      : Number.NaN;
    if (Number.isFinite(lastProgressMs)) {
      const inactiveMs = Date.now() - lastProgressMs;
      if (inactiveMs >= staleProgressMs) {
        throw new Error(
          `${step.label} XML run ${runId.slice(0, 8)} stopped making progress for more than ${formatMinutes(staleProgressMs)}. Last status: ${describeWorkflowProgress(progress!)}.`,
        );
      }
    } else if (Date.now() >= noProgressDeadline) {
      throw new Error(
        `${step.label} XML run ${runId.slice(0, 8)} did not report progress within ${formatMinutes(step.timeoutMs)}.`,
      );
    }

    await sleep(4000, signal);
  }

  throw new Error(
    `${step.label} XML run ${runId.slice(0, 8)} exceeded the ${formatMinutes(hardTimeoutMs)} hard auto-run limit before verification.`,
  );
}

async function approveWorkflowStage(
  baseUrl: string,
  projectId: string,
  signal: AbortSignal,
  stage: "research" | "script" | "scene-images" | "sound-design" | "video",
  title: string,
) {
  await patchJson(
    baseUrl,
    `/api/short-form-videos/${projectId}/workflow/${stage}`,
    {
      status: "approved",
      comment: `Auto-approved ${title} while running the remaining short-form workflow`,
      updatedBy: "ittai",
    },
    `Failed to approve ${title}`,
    signal,
  );
}

async function approveXmlScript(baseUrl: string, projectId: string, signal: AbortSignal) {
  await patchJson(
    baseUrl,
    `/api/short-form-videos/${projectId}/xml-script`,
    { status: "approved" },
    "Failed to approve Plan Visuals",
    signal,
  );
}

function completedStepSet(autoRun: ShortFormAutoRunState) {
  return new Set(autoRun.completedSteps);
}

function getStepDefinition(stepId: ShortFormAutoRunStepId) {
  return SHORT_FORM_AUTO_RUN_STEPS.find((step) => step.id === stepId);
}

function stageDocumentReady(doc: StageDocumentSummary) {
  return (
    doc.exists &&
    !doc.pending &&
    !doc.revision?.isPending &&
    doc.content.trim().length > 0
  );
}

function xmlScriptReadyForAutoApproval(project: ShortFormProject) {
  const captionsStep = project.xmlScript.pipeline?.steps.find((step) => step.id === "captions");
  const xmlStep = project.xmlScript.pipeline?.steps.find((step) => step.id === "xml");

  return (
    project.xmlScript.exists &&
    !project.xmlScript.pending &&
    project.xmlScript.content.trim().length > 0 &&
    captionsStep?.status === "completed" &&
    xmlStep?.status === "completed" &&
    !updatedBefore(project.xmlScript.updatedAt, captionsStep.updatedAt)
  );
}

function sceneImagesReadyForAutoApproval(project: ShortFormProject) {
  return (
    stageDocumentReady(project.sceneImages) &&
    project.sceneImages.scenes.length > 0 &&
    !updatedBefore(project.sceneImages.updatedAt, project.xmlScript.updatedAt)
  );
}

function soundDesignReadyForAutoApproval(project: ShortFormProject) {
  return (
    stageDocumentReady(project.soundDesign) &&
    /<sound_design\b/i.test(project.soundDesign.content) &&
    !updatedBefore(project.soundDesign.updatedAt, project.sceneImages.updatedAt)
  );
}

function finalVideoReadyForAutoApproval(project: ShortFormProject) {
  return (
    stageDocumentReady(project.video) &&
    (project.video.pipeline?.status === "completed" || Boolean(project.video.videoUrl)) &&
    !updatedBefore(project.video.updatedAt, project.sceneImages.updatedAt) &&
    !updatedBefore(project.video.updatedAt, project.soundDesign.updatedAt)
  );
}

function workflowStageForAutoRunStep(
  stepId: ShortFormAutoRunStepId,
): ShortFormStageKey | undefined {
  switch (stepId) {
    case "research":
      return "research";
    case "text-script":
      return "script";
    case "generate-visuals":
      return "scene-images";
    case "plan-sound-design":
      return "sound-design";
    case "final-video":
      return "video";
    default:
      return undefined;
  }
}

type AutoRunStageRequest = { requestedAt: string; runId?: string };

function latestStageRequest(projectId: string, stage: ShortFormStageKey) {
  const meta = parseAutoRunProjectMeta(projectId);
  const latestStageRequests = asRecord(meta.latestStageRequests);
  const requestRecord = asRecord(latestStageRequests[stage]);
  const requestedAt = asString(requestRecord.requestedAt);
  if (!requestedAt) return undefined;
  return {
    requestedAt,
    runId: asString(requestRecord.runId),
  } satisfies AutoRunStageRequest;
}

function requestTimeInAutoRunWindow(
  request: AutoRunStageRequest | undefined,
  autoRun: ShortFormAutoRunState | undefined,
) {
  if (!request || !autoRun) return false;
  const requestedAt = Date.parse(request.requestedAt);
  const startedAt = Date.parse(autoRun.startedAt);
  const finishedAt = autoRun.finishedAt ? Date.parse(autoRun.finishedAt) : Number.NaN;
  if (!Number.isFinite(requestedAt) || !Number.isFinite(startedAt)) return false;
  if (requestedAt + 1000 < startedAt) return false;
  return !Number.isFinite(finishedAt) || requestedAt <= finishedAt + 1000;
}

function latestRequestForAutoRunStep(
  projectId: string,
  autoRun: ShortFormAutoRunState | undefined,
  stepId: ShortFormAutoRunStepId,
) {
  const stage = workflowStageForAutoRunStep(stepId);
  if (!stage) return undefined;

  const request = latestStageRequest(projectId, stage);
  if (!request || !requestTimeInAutoRunWindow(request, autoRun)) return undefined;
  return { stage, request };
}

function canUseExistingAutoRunArtifact(
  autoRun: ShortFormAutoRunState | undefined,
  stepId: ShortFormAutoRunStepId,
) {
  if (!autoRun) return true;
  return getShortFormAutoRunCurrentStep(autoRun.startedFrom)?.id === stepId;
}

function selectedStepNeedsFreshRun(
  autoRun: ShortFormAutoRunState | undefined,
  stepId: ShortFormAutoRunStepId,
) {
  return Boolean(autoRun && !canUseExistingAutoRunArtifact(autoRun, stepId));
}

function selectedStepArtifactFresh(
  autoRun: ShortFormAutoRunState | undefined,
  stepId: ShortFormAutoRunStepId,
  updatedAt: string | undefined,
) {
  if (!selectedStepNeedsFreshRun(autoRun, stepId)) return true;
  return freshAtOrAfter(updatedAt, autoRun!.startedAt);
}

function latestWorkflowProgressForAutoRunStep(
  projectId: string,
  _project: ShortFormProject,
  autoRun: ShortFormAutoRunState | undefined,
  stepId: ShortFormAutoRunStepId,
) {
  const latestRequest = latestRequestForAutoRunStep(projectId, autoRun, stepId);
  if (!latestRequest?.request.runId) return undefined;
  return readWorkflowRunProgress(projectId, latestRequest.stage, latestRequest.request.runId);
}

function autoRunFailedStepFromWorkflowRequests(
  projectId: string,
  project: ShortFormProject,
  autoRun: ShortFormAutoRunState,
) {
  for (const stepId of autoRun.selectedSteps) {
    const progress = latestWorkflowProgressForAutoRunStep(projectId, project, autoRun, stepId);
    if (!progress) continue;
    const error = workflowProgressFailureMessage(progress, stepId);
    if (error) return { stepId, error };
  }
  return undefined;
}

function workflowRequestVerifiedForAutoRunStep(
  projectId: string,
  project: ShortFormProject,
  autoRun: ShortFormAutoRunState | undefined,
  stepId: ShortFormAutoRunStepId,
) {
  const latestRequest = latestRequestForAutoRunStep(projectId, autoRun, stepId);
  if (!latestRequest) return true;
  if (!latestRequest.request.runId) return false;
  const progress = readWorkflowRunProgress(
    projectId,
    latestRequest.stage,
    latestRequest.request.runId,
  );
  return progress?.status === "verified" && !workflowProgressStaleForStep(progress, stepId);
}

function requestAfterUpdatedAt(request: AutoRunStageRequest | undefined, updatedAt: string | undefined) {
  if (!request || !updatedAt) return false;
  const requestedAtMs = Date.parse(request.requestedAt);
  const updatedAtMs = Date.parse(updatedAt);
  if (!Number.isFinite(requestedAtMs) || !Number.isFinite(updatedAtMs)) return false;
  return requestedAtMs > updatedAtMs + 1000;
}

function autoRunProducedSoundDesignPlan(
  projectId: string,
  project: ShortFormProject,
  autoRun: ShortFormAutoRunState,
) {
  const updatedAtMs = Date.parse(project.soundDesign.updatedAt || "");
  const startedAtMs = Date.parse(autoRun.startedAt);
  if (!Number.isFinite(updatedAtMs) || !Number.isFinite(startedAtMs)) return false;
  if (updatedAtMs + 1000 < startedAtMs) return false;

  const soundDesignRequest = latestRequestForAutoRunStep(projectId, autoRun, "plan-sound-design");
  if (
    soundDesignRequest &&
    !freshAtOrAfter(project.soundDesign.updatedAt, soundDesignRequest.request.requestedAt)
  ) {
    return false;
  }

  const latestSceneImagesRequest = latestStageRequest(projectId, "scene-images");
  if (requestAfterUpdatedAt(latestSceneImagesRequest, project.soundDesign.updatedAt)) return false;

  return (
    stageDocumentReady(project.soundDesign) &&
    /<sound_design\b/i.test(project.soundDesign.content)
  );
}

function approveStageFromCompletedAutoRun(
  projectId: string,
  stage: "sound-design",
  currentStatus: string | undefined,
  title: string,
) {
  const from = currentStatus || "draft";
  updateStageFrontMatterStatus(projectId, stage, "approved");
  appendStatusLog(
    getStageFilePath(projectId, stage),
    from,
    "approved" as DeliverableStatus,
    "ralph",
    `Repair after completed auto-run left ${title} in review`,
  );
}

function repairCompletedSoundDesignApprovals(projectId: string, project: ShortFormProject) {
  const autoRun = project.autoRun;
  if (!autoRun || autoRun.status !== "completed") return project;

  const completed = completedStepSet(autoRun);
  let current = project;
  let repaired = false;

  if (
    completed.has("plan-sound-design") &&
    !approved(current.soundDesign.status) &&
    docCanApprove(current.soundDesign) &&
    autoRunProducedSoundDesignPlan(projectId, current, autoRun)
  ) {
    approveStageFromCompletedAutoRun(
      projectId,
      "sound-design",
      current.soundDesign.status,
      "Plan Sound Design",
    );
    current = getShortFormProject(projectId) || current;
    repaired = true;
  }

  if (completed.has("generate-sound-design")) {
    const handoff = getSoundDesignHandoffState(current);
    if (!handoff.canProceedToFinalVideo && handoff.canApprove) {
      updateProjectMeta(projectId, {
        soundDesignDecision: "approved",
        soundDesignSkipReason: undefined,
        soundDesignApprovalWarning: handoff.approvalWarnings.join(" ") || undefined,
      });
      current = getShortFormProject(projectId) || current;
      repaired = true;
    }
  }

  return repaired ? current : project;
}

function autoRunStepActuallyCompleted(
  projectId: string,
  project: ShortFormProject,
  stepId: ShortFormAutoRunStepId,
  autoRun?: ShortFormAutoRunState,
) {
  const latestRequest = latestRequestForAutoRunStep(projectId, autoRun, stepId);
  if (
    selectedStepNeedsFreshRun(autoRun, stepId) &&
    workflowStageForAutoRunStep(stepId) &&
    !latestRequest
  ) {
    return false;
  }
  if (latestRequest && !workflowRequestVerifiedForAutoRunStep(projectId, project, autoRun, stepId)) {
    return false;
  }

  switch (stepId) {
    case "research":
      return (
        stageDocumentReady(project.research) &&
        approved(project.research.status) &&
        selectedStepArtifactFresh(autoRun, stepId, project.research.updatedAt) &&
        (!latestRequest || freshAtOrAfter(project.research.updatedAt, latestRequest.request.requestedAt))
      );
    case "text-script":
      return (
        stageDocumentReady(project.script) &&
        approved(project.script.status) &&
        selectedStepArtifactFresh(autoRun, stepId, project.script.updatedAt) &&
        (!latestRequest || freshAtOrAfter(project.script.updatedAt, latestRequest.request.requestedAt))
      );
    case "generate-narration-audio":
      return (
        Boolean(project.xmlScript.audioUrl) &&
        selectedStepArtifactFresh(autoRun, stepId, xmlPipelineStepUpdatedAt(project, "narration"))
      );
    case "plan-captions":
      return (
        Boolean(project.xmlScript.captions?.length) &&
        selectedStepArtifactFresh(autoRun, stepId, xmlPipelineStepUpdatedAt(project, "captions"))
      );
    case "plan-visuals":
      return (
        project.xmlScript.exists &&
        !project.xmlScript.pending &&
        project.xmlScript.content.trim().length > 0 &&
        approved(project.xmlScript.status) &&
        selectedStepArtifactFresh(autoRun, stepId, project.xmlScript.updatedAt)
      );
    case "generate-visuals":
      return (
        stageDocumentReady(project.sceneImages) &&
        project.sceneImages.scenes.length > 0 &&
        approved(project.sceneImages.status) &&
        selectedStepArtifactFresh(autoRun, stepId, project.sceneImages.updatedAt) &&
        (!latestRequest || freshAtOrAfter(project.sceneImages.updatedAt, latestRequest.request.requestedAt))
      );
    case "plan-sound-design":
      return (
        stageDocumentReady(project.soundDesign) &&
        approved(project.soundDesign.status) &&
        selectedStepArtifactFresh(autoRun, stepId, project.soundDesign.updatedAt) &&
        (!latestRequest || freshAtOrAfter(project.soundDesign.updatedAt, latestRequest.request.requestedAt))
      );
    case "generate-sound-design":
      return getSoundDesignHandoffState(project).canProceedToFinalVideo;
    case "final-video":
      return (
        stageDocumentReady(project.video) &&
        (project.video.pipeline?.status === "completed" || Boolean(project.video.videoUrl)) &&
        approved(project.video.status) &&
        selectedStepArtifactFresh(autoRun, stepId, project.video.updatedAt) &&
        (!latestRequest || freshAtOrAfter(project.video.updatedAt, latestRequest.request.requestedAt))
      );
  }
}

function reconcileFinishedAutoRunWithProjectState(projectId: string, project: ShortFormProject) {
  const autoRun = project.autoRun;
  if (!autoRun || autoRun.status === "active") return project;
  if (autoRun.selectedSteps.length === 0) return project;

  const failedStep = autoRunFailedStepFromWorkflowRequests(projectId, project, autoRun);
  if (failedStep) {
    const failedStepIndex = autoRun.selectedSteps.indexOf(failedStep.stepId);
    const completedBeforeFailedStep = autoRun.selectedSteps.filter((stepId, index) =>
      index >= 0 &&
      (failedStepIndex < 0 || index < failedStepIndex) &&
      autoRun.completedSteps.includes(stepId) &&
      autoRunStepActuallyCompleted(projectId, project, stepId, autoRun),
    );
    updateAutoRun(projectId, autoRun, {
      status: "failed",
      completedSteps: completedBeforeFailedStep,
      waitingSteps: [],
      currentStep: undefined,
      failedStep: failedStep.stepId,
      error: failedStep.error,
      finishedAt: autoRun.finishedAt || nowIso(),
    });
    return getShortFormProject(projectId) || project;
  }

  if (autoRun.status === "completed") {
    return repairCompletedSoundDesignApprovals(projectId, project);
  }

  const actuallyCompleted = autoRun.selectedSteps.filter((stepId) =>
    autoRunStepActuallyCompleted(projectId, project, stepId, autoRun),
  );
  if (actuallyCompleted.length !== autoRun.selectedSteps.length) return project;

  updateAutoRun(projectId, autoRun, {
    status: "completed",
    completedSteps: actuallyCompleted,
    waitingSteps: [],
    currentStep: undefined,
    failedStep: undefined,
    error: undefined,
    finishedAt: nowIso(),
  });
  return getShortFormProject(projectId) || project;
}

async function reconcileCompletedAutoRunApprovals(
  baseUrl: string,
  projectId: string,
  autoRunId: string,
  signal: AbortSignal,
  autoRun: ShortFormAutoRunState,
) {
  const completed = completedStepSet(autoRun);
  let current = assertAutoRunActive(projectId, autoRunId, signal);

  if (completed.has("research") && stageDocumentReady(current.research) && !approved(current.research.status)) {
    await approveWorkflowStage(baseUrl, projectId, signal, "research", "Research");
    current = assertAutoRunActive(projectId, autoRunId, signal);
  }

  if (
    completed.has("text-script") &&
    stageDocumentReady(current.script) &&
    !updatedBefore(current.script.updatedAt, current.research.updatedAt) &&
    !approved(current.script.status)
  ) {
    await approveWorkflowStage(baseUrl, projectId, signal, "script", "Text Script");
    current = assertAutoRunActive(projectId, autoRunId, signal);
  }

  if (completed.has("plan-visuals") && xmlScriptReadyForAutoApproval(current) && !approved(current.xmlScript.status)) {
    await approveXmlScript(baseUrl, projectId, signal);
    current = assertAutoRunActive(projectId, autoRunId, signal);
  }

  if (
    completed.has("generate-visuals") &&
    sceneImagesReadyForAutoApproval(current) &&
    !approved(current.sceneImages.status)
  ) {
    await approveWorkflowStage(baseUrl, projectId, signal, "scene-images", "Generate Visuals");
    current = assertAutoRunActive(projectId, autoRunId, signal);
  }

  if (
    completed.has("plan-sound-design") &&
    soundDesignReadyForAutoApproval(current) &&
    !approved(current.soundDesign.status)
  ) {
    await approveWorkflowStage(baseUrl, projectId, signal, "sound-design", "Plan Sound Design");
    current = assertAutoRunActive(projectId, autoRunId, signal);
  }

  if (completed.has("generate-sound-design")) {
    const handoff = getSoundDesignHandoffState(current);
    if (!handoff.canProceedToFinalVideo && handoff.canApprove) {
      await patchJson(
        baseUrl,
        `/api/short-form-videos/${projectId}`,
        { soundDesignDecision: "approved" },
        "Failed to approve Generate Sound Design",
        signal,
      );
      current = assertAutoRunActive(projectId, autoRunId, signal);
    }
  }

  if (completed.has("final-video") && finalVideoReadyForAutoApproval(current) && !approved(current.video.status)) {
    await approveWorkflowStage(baseUrl, projectId, signal, "video", "Final Video");
  }
}

async function runResearch(
  baseUrl: string,
  projectId: string,
  autoRunId: string,
  signal: AbortSignal,
  step: ShortFormAutoRunStepDefinition,
  current: ShortFormProject,
  options?: AutoRunStepRunOptions,
) {
  if (!current.selectedHookText) {
    throw new Error("Select a hook before auto-running Research.");
  }

  if (options?.force || !current.research.exists || !current.research.content.trim()) {
    const requestedAt = nowIso();
    const response = await postJson(
      baseUrl,
      `/api/short-form-videos/${projectId}/workflow/research`,
      { action: "generate" },
      "Failed to generate research",
      signal,
    );
    const runId = response.runId;
    current = await waitForProject(
      projectId,
      autoRunId,
      signal,
      step,
      (nextProject) => stageDocReadyFromRequest(nextProject.research, requestedAt),
      (nextProject) => stageDocRunFailed(nextProject.research, runId),
    );
    await waitForWorkflowRunVerified(projectId, signal, step, "research", runId);
    current = assertAutoRunActive(projectId, autoRunId, signal);
  }

  if (docCanApprove(current.research)) {
    await approveWorkflowStage(baseUrl, projectId, signal, "research", "Research");
    current = assertAutoRunActive(projectId, autoRunId, signal);
  }

  return current;
}

async function runTextScript(
  baseUrl: string,
  projectId: string,
  autoRunId: string,
  signal: AbortSignal,
  step: ShortFormAutoRunStepDefinition,
  current: ShortFormProject,
  options?: AutoRunStepRunOptions,
) {
  if (!approved(current.research.status)) {
    throw new Error("Approve Research before auto-running Text Script.");
  }

  const shouldGenerate =
    options?.force ||
    !current.script.exists ||
    !current.script.content.trim() ||
    (!options?.prepareCurrent &&
      (!approved(current.script.status) ||
        updatedBefore(current.script.updatedAt, current.research.updatedAt)));

  if (shouldGenerate) {
    const requestedAt = nowIso();
    const response = await postJson(
      baseUrl,
      `/api/short-form-videos/${projectId}/workflow/script`,
      { action: "generate" },
      "Failed to generate text script",
      signal,
    );
    const runId = response.runId;
    current = runId
      ? await waitForTextScriptRun(
          projectId,
          autoRunId,
          signal,
          step,
          runId,
          (nextProject) => stageDocReadyFromRequest(nextProject.script, requestedAt),
        )
      : await waitForProject(
          projectId,
          autoRunId,
          signal,
          step,
          (nextProject) => stageDocReadyFromRequest(nextProject.script, requestedAt),
          (nextProject) => stageDocRunFailed(nextProject.script, runId),
        );
  }

  if (docCanApprove(current.script)) {
    await approveWorkflowStage(baseUrl, projectId, signal, "script", "Text Script");
    current = assertAutoRunActive(projectId, autoRunId, signal);
  }

  if (!approved(current.script.status)) {
    throw new Error("Text Script must be approved before auto-running Narration Audio.");
  }

  return current;
}

async function runNarrationAudio(
  baseUrl: string,
  projectId: string,
  autoRunId: string,
  signal: AbortSignal,
  step: ShortFormAutoRunStepDefinition,
) {
  const current = assertAutoRunActive(projectId, autoRunId, signal);
  if (!approved(current.script.status)) {
    throw new Error("Approve Text Script before auto-running Narration Audio.");
  }

  const response = await postJson(
    baseUrl,
    `/api/short-form-videos/${projectId}/xml-script`,
    { task: "narration" },
    "Failed to generate narration audio",
    signal,
  );
  const runId = response.runId;
  return waitForProject(
    projectId,
    autoRunId,
    signal,
    step,
    (nextProject) =>
      nextProject.xmlScript.pipeline?.runId === runId &&
      !hasActiveXmlPipeline(nextProject) &&
      Boolean(nextProject.xmlScript.audioUrl),
    (nextProject) =>
      nextProject.xmlScript.pipeline?.runId === runId &&
      nextProject.xmlScript.pipeline?.status === "failed",
  );
}

async function runPlanCaptions(
  baseUrl: string,
  projectId: string,
  autoRunId: string,
  signal: AbortSignal,
  step: ShortFormAutoRunStepDefinition,
) {
  const response = await postJson(
    baseUrl,
    `/api/short-form-videos/${projectId}/xml-script`,
    { task: "captions" },
    "Failed to plan captions",
    signal,
  );
  const runId = response.runId;
  return waitForProject(
    projectId,
    autoRunId,
    signal,
    step,
    (nextProject) =>
      nextProject.xmlScript.pipeline?.runId === runId &&
      !hasActiveXmlPipeline(nextProject) &&
      Boolean(nextProject.xmlScript.captions?.length),
    (nextProject) =>
      nextProject.xmlScript.pipeline?.runId === runId &&
      nextProject.xmlScript.pipeline?.status === "failed",
  );
}

async function runPlanVisuals(
  baseUrl: string,
  projectId: string,
  autoRunId: string,
  signal: AbortSignal,
  step: ShortFormAutoRunStepDefinition,
  current: ShortFormProject,
  options?: AutoRunStepRunOptions,
) {
  if (!current.xmlScript.captions?.length) {
    throw new Error("Plan Captions before auto-running Plan Visuals.");
  }

  const shouldGenerate =
    options?.force ||
    !current.xmlScript.exists ||
    !current.xmlScript.content.trim() ||
    (!options?.prepareCurrent &&
      (!approved(current.xmlScript.status) ||
        updatedBefore(current.xmlScript.updatedAt, xmlPipelineStepUpdatedAt(current, "captions"))));

  if (shouldGenerate) {
    const requestedAt = nowIso();
    const response = await postJson(
      baseUrl,
      `/api/short-form-videos/${projectId}/xml-script`,
      { task: "visuals" },
      "Failed to plan visuals",
      signal,
    );
    const runId = response.runId;
    current = await waitForProject(
      projectId,
      autoRunId,
      signal,
      step,
      (nextProject) => {
        const xmlStep = nextProject.xmlScript.pipeline?.steps.find((item) => item.id === "xml");
        return (
          nextProject.xmlScript.pipeline?.runId === runId &&
          !hasActiveXmlPipeline(nextProject) &&
          xmlStep?.status === "completed" &&
          nextProject.xmlScript.exists &&
          nextProject.xmlScript.content.trim().length > 0 &&
          freshAtOrAfter(nextProject.xmlScript.updatedAt, requestedAt)
        );
      },
      (nextProject) =>
        nextProject.xmlScript.pipeline?.runId === runId &&
        nextProject.xmlScript.pipeline?.status === "failed",
    );
    await waitForXmlScriptRunVerified(projectId, signal, step, runId);
    current = assertAutoRunActive(projectId, autoRunId, signal);
  }

  if (!approved(current.xmlScript.status)) {
    await approveXmlScript(baseUrl, projectId, signal);
    current = assertAutoRunActive(projectId, autoRunId, signal);
  }

  return current;
}

async function runGenerateVisuals(
  baseUrl: string,
  projectId: string,
  autoRunId: string,
  signal: AbortSignal,
  step: ShortFormAutoRunStepDefinition,
  current: ShortFormProject,
  options?: AutoRunStepRunOptions,
) {
  if (!approved(current.xmlScript.status)) {
    throw new Error("Approve Plan Visuals before auto-running Generate Visuals.");
  }

  const shouldGenerate =
    options?.force ||
    !current.sceneImages.scenes.length ||
    (!options?.prepareCurrent &&
      (!approved(current.sceneImages.status) ||
        updatedBefore(current.sceneImages.updatedAt, current.xmlScript.updatedAt)));

  if (shouldGenerate) {
    const requestedAt = nowIso();
    const response = await postJson(
      baseUrl,
      `/api/short-form-videos/${projectId}/workflow/scene-images`,
      { action: "generate" },
      "Failed to generate visuals",
      signal,
    );
    const runId = response.runId;
    current = await waitForProject(
      projectId,
      autoRunId,
      signal,
      step,
      (nextProject) =>
        !nextProject.sceneImages.pending &&
        !nextProject.sceneImages.revision?.isPending &&
        freshAtOrAfter(nextProject.sceneImages.updatedAt, requestedAt) &&
        nextProject.sceneImages.scenes.length > 0,
      (nextProject) => stageDocRunFailed(nextProject.sceneImages, runId),
    );
    await waitForWorkflowRunVerified(projectId, signal, step, "scene-images", runId);
    current = assertAutoRunActive(projectId, autoRunId, signal);
  }

  if (docCanApprove(current.sceneImages)) {
    await approveWorkflowStage(baseUrl, projectId, signal, "scene-images", "Generate Visuals");
    current = assertAutoRunActive(projectId, autoRunId, signal);
  }

  return current;
}

async function runPlanSoundDesign(
  baseUrl: string,
  projectId: string,
  autoRunId: string,
  signal: AbortSignal,
  step: ShortFormAutoRunStepDefinition,
  current: ShortFormProject,
  options?: AutoRunStepRunOptions,
) {
  if (!approved(current.sceneImages.status)) {
    throw new Error("Approve Generate Visuals before auto-running Plan Sound Design.");
  }

  const shouldGenerate =
    options?.force ||
    !current.soundDesign.exists ||
    !current.soundDesign.content.trim() ||
    (!options?.prepareCurrent &&
      (!approved(current.soundDesign.status) ||
        updatedBefore(current.soundDesign.updatedAt, current.sceneImages.updatedAt)));

  if (shouldGenerate) {
    const requestedAt = nowIso();
    const response = await postJson(
      baseUrl,
      `/api/short-form-videos/${projectId}/sound-design`,
      { action: "generate" },
      "Failed to plan sound design",
      signal,
    );
    const runId = response.runId || (response.data as { runId?: string } | undefined)?.runId;
    current = await waitForProject(
      projectId,
      autoRunId,
      signal,
      step,
      (nextProject) => stageDocReadyFromRequest(nextProject.soundDesign, requestedAt),
      (nextProject) => stageDocRunFailed(nextProject.soundDesign, runId),
    );
  }

  if (docCanApprove(current.soundDesign)) {
    await approveWorkflowStage(baseUrl, projectId, signal, "sound-design", "Plan Sound Design");
    current = assertAutoRunActive(projectId, autoRunId, signal);
  }

  return current;
}

async function runGenerateSoundDesign(
  baseUrl: string,
  projectId: string,
  autoRunId: string,
  signal: AbortSignal,
  current: ShortFormProject,
) {
  if (!approved(current.soundDesign.status)) {
    throw new Error("Approve Plan Sound Design before auto-running Generate Sound Design.");
  }

  await postJson(
    baseUrl,
    `/api/short-form-videos/${projectId}/sound-design`,
    { action: "resolve" },
    "Failed to resolve sound design",
    signal,
  );
  await postJson(
    baseUrl,
    `/api/short-form-videos/${projectId}/sound-design/preview`,
    {},
    "Failed to render sound-design preview",
    signal,
  );

  current = assertAutoRunActive(projectId, autoRunId, signal);
  const handoff = getSoundDesignHandoffState(current);
  if (!handoff.canApprove) {
    throw new Error(handoff.gateReason || "Generate Sound Design is not ready to approve.");
  }

  await patchJson(
    baseUrl,
    `/api/short-form-videos/${projectId}`,
    { soundDesignDecision: "approved" },
    "Failed to approve Generate Sound Design",
    signal,
  );

  return assertAutoRunActive(projectId, autoRunId, signal);
}

function stripFrontMatter(content: string) {
  if (!content.startsWith("---")) return content.trim();
  const match = content.match(/^---\s*\n[\s\S]*?\n---\s*\n?([\s\S]*)$/);
  return (match ? match[1] : content).trim();
}

function parseAutoRunProjectMeta(projectId: string) {
  try {
    const parsed = JSON.parse(fs.readFileSync(getProjectMetaPath(projectId), "utf-8"));
    return asRecord(parsed);
  } catch {
    return {};
  }
}

function getLatestSceneImagesRuntimeXmlPath(projectId: string) {
  const meta = parseAutoRunProjectMeta(projectId);
  const latestStageRequests = asRecord(meta.latestStageRequests);
  const sceneImagesRequest = asRecord(latestStageRequests["scene-images"]);
  const runId = asString(sceneImagesRequest.runId);
  if (!runId) return undefined;

  const candidate = path.join(
    getProjectDir(projectId),
    ".workflow-runs",
    runId,
    "scene-images-runtime.xml",
  );
  return fs.existsSync(candidate) ? candidate : undefined;
}

function getFinalVideoXmlSource(projectId: string, project: ShortFormProject) {
  const runtimeXmlPath = getLatestSceneImagesRuntimeXmlPath(projectId);
  if (runtimeXmlPath) {
    try {
      return {
        sourcePath: runtimeXmlPath,
        xml: fs.readFileSync(runtimeXmlPath, "utf-8"),
      };
    } catch {
      // Fall back to the approved XML Script document below.
    }
  }

  return {
    sourcePath: "xml-script.md",
    xml: stripFrontMatter(project.xmlScript.content),
  };
}

function parseRequiredSceneIndexes(xml: string) {
  const timeline = xml.match(/<timeline\b[^>]*>([\s\S]*?)<\/timeline>/i)?.[1] || "";
  const visualMatches = Array.from(timeline.matchAll(/<visual\b[^>]*(?:\/>|>[\s\S]*?<\/visual>)/gi));
  if (visualMatches.length > 0) {
    return visualMatches.map((_match, index) => index + 1);
  }

  const sceneMatches = Array.from(xml.matchAll(/<scene\b[^>]*(?:\/>|>[\s\S]*?<\/scene>)/gi));
  return sceneMatches.map((_match, index) => index + 1);
}

function finalVideoSceneCandidates(projectId: string, sceneIndex: number) {
  const padded = String(sceneIndex).padStart(2, "0");
  return [
    path.join(getProjectDir(projectId), "scenes", `scene-${padded}-uncaptioned-1080x1920.png`),
    path.join(getProjectDir(projectId), "scenes", `scene-${padded}.png`),
  ];
}

function preflightFinalVideoSceneAssets(projectId: string, project: ShortFormProject) {
  const { sourcePath, xml } = getFinalVideoXmlSource(projectId, project);
  const requiredSceneIndexes = parseRequiredSceneIndexes(xml);
  const manifestScenes = readSceneManifest(projectId);
  const manifestSceneIndexes = new Set(manifestScenes.map((scene) => scene.number));
  const missingFiles: Array<{ sceneIndex: number; candidates: string[] }> = [];
  const missingManifestSceneIndexes: number[] = [];

  for (const sceneIndex of requiredSceneIndexes) {
    const candidates = finalVideoSceneCandidates(projectId, sceneIndex);
    if (!candidates.some((candidate) => fs.existsSync(candidate))) {
      missingFiles.push({ sceneIndex, candidates });
    }
    if (!manifestSceneIndexes.has(sceneIndex)) {
      missingManifestSceneIndexes.push(sceneIndex);
    }
  }

  return {
    ok:
      requiredSceneIndexes.length > 0 &&
      missingFiles.length === 0 &&
      missingManifestSceneIndexes.length === 0,
    sourcePath,
    requiredSceneIndexes,
    missingFiles,
    missingManifestSceneIndexes,
  };
}

function relativeProjectPath(projectId: string, absolutePath: string) {
  const relative = path.relative(getProjectDir(projectId), absolutePath);
  return relative.startsWith("..") || path.isAbsolute(relative)
    ? absolutePath
    : relative.split(path.sep).join("/");
}

function formatFinalVideoAssetPreflightFailure(
  projectId: string,
  preflight: ReturnType<typeof preflightFinalVideoSceneAssets>,
  regenerated: boolean,
) {
  const parts: string[] = [];
  if (preflight.missingFiles.length > 0) {
    const examples = preflight.missingFiles.slice(0, 5).map((missing) => {
      const candidates = missing.candidates
        .map((candidate) => relativeProjectPath(projectId, candidate))
        .join(" or ");
      return `scene ${missing.sceneIndex} (${candidates})`;
    });
    const suffix =
      preflight.missingFiles.length > examples.length
        ? ` and ${preflight.missingFiles.length - examples.length} more`
        : "";
    parts.push(`missing image files for ${examples.join(", ")}${suffix}`);
  }
  if (preflight.missingManifestSceneIndexes.length > 0) {
    const examples = preflight.missingManifestSceneIndexes.slice(0, 8).join(", ");
    const suffix =
      preflight.missingManifestSceneIndexes.length > 8
        ? ` and ${preflight.missingManifestSceneIndexes.length - 8} more`
        : "";
    parts.push(`missing scene-images.json entries for scene ${examples}${suffix}`);
  }

  const repairText = regenerated
    ? "Auto-run regenerated Generate Visuals, but the required assets are still missing."
    : "Auto-run could not safely regenerate Generate Visuals from the current state.";
  return `Final Video cannot render because Generate Visuals is incomplete for ${preflight.sourcePath}: ${parts.join("; ")}. ${repairText} Open Generate Visuals, rerun it from the approved Plan Visuals/XML stage, then run Final Video again.`;
}

async function ensureFinalVideoSceneAssets(
  baseUrl: string,
  projectId: string,
  autoRunId: string,
  signal: AbortSignal,
  current: ShortFormProject,
) {
  let preflight = preflightFinalVideoSceneAssets(projectId, current);
  if (preflight.ok) return current;

  const repairStep = getStepDefinition("generate-visuals");
  if (
    repairStep &&
    approved(current.xmlScript.status) &&
    !current.sceneImages.pending &&
    !current.sceneImages.revision?.isPending
  ) {
    const repaired = await runGenerateVisuals(
      baseUrl,
      projectId,
      autoRunId,
      signal,
      repairStep,
      current,
      { force: true },
    );
    preflight = preflightFinalVideoSceneAssets(projectId, repaired);
    if (preflight.ok) return repaired;
    throw new Error(formatFinalVideoAssetPreflightFailure(projectId, preflight, true));
  }

  throw new Error(formatFinalVideoAssetPreflightFailure(projectId, preflight, false));
}

async function runFinalVideo(
  baseUrl: string,
  projectId: string,
  autoRunId: string,
  signal: AbortSignal,
  step: ShortFormAutoRunStepDefinition,
  current: ShortFormProject,
) {
  const handoff = getSoundDesignHandoffState(current);
  if (!handoff.canProceedToFinalVideo) {
    throw new Error(
      handoff.gateReason ||
        "Approve or skip Generate Sound Design before auto-running Final Video.",
    );
  }

  current = await ensureFinalVideoSceneAssets(
    baseUrl,
    projectId,
    autoRunId,
    signal,
    current,
  );

  const requestedAt = nowIso();
  const response = await postJson(
    baseUrl,
    `/api/short-form-videos/${projectId}/workflow/video`,
    {
      action: "generate",
      chromaKeyEnabledOverride: current.chromaKeyEnabledOverride ?? null,
    },
    "Failed to generate final video",
    signal,
  );
  const runId = response.runId;

  current = await waitForProject(
    projectId,
    autoRunId,
    signal,
    step,
    (nextProject) =>
      !nextProject.video.pending &&
      !nextProject.video.revision?.isPending &&
      freshAtOrAfter(nextProject.video.updatedAt, requestedAt) &&
      (nextProject.video.pipeline?.status === "completed" ||
        Boolean(nextProject.video.videoUrl)),
    (nextProject) => stageDocRunFailed(nextProject.video, runId),
  );

  if (finalVideoReadyForAutoApproval(current) && !approved(current.video.status)) {
    await approveWorkflowStage(baseUrl, projectId, signal, "video", "Final Video");
    current = assertAutoRunActive(projectId, autoRunId, signal);
  }

  return current;
}

async function runStep(
  baseUrl: string,
  projectId: string,
  autoRunId: string,
  signal: AbortSignal,
  step: ShortFormAutoRunStepDefinition,
  options?: AutoRunStepRunOptions,
) {
  const current = assertAutoRunActive(projectId, autoRunId, signal);
  const force = options?.force ?? !options?.prepareCurrent;
  const stepOptions = { ...options, force };

  switch (step.id) {
    case "research":
      return runResearch(baseUrl, projectId, autoRunId, signal, step, current, stepOptions);
    case "text-script":
      return runTextScript(baseUrl, projectId, autoRunId, signal, step, current, stepOptions);
    case "generate-narration-audio":
      return runNarrationAudio(baseUrl, projectId, autoRunId, signal, step);
    case "plan-captions":
      return runPlanCaptions(baseUrl, projectId, autoRunId, signal, step);
    case "plan-visuals":
      return runPlanVisuals(baseUrl, projectId, autoRunId, signal, step, current, stepOptions);
    case "generate-visuals":
      return runGenerateVisuals(baseUrl, projectId, autoRunId, signal, step, current, stepOptions);
    case "plan-sound-design":
      return runPlanSoundDesign(baseUrl, projectId, autoRunId, signal, step, current, stepOptions);
    case "generate-sound-design":
      return runGenerateSoundDesign(baseUrl, projectId, autoRunId, signal, current);
    case "final-video":
      return runFinalVideo(baseUrl, projectId, autoRunId, signal, step, current);
  }
}

async function runAutoRun(
  baseUrl: string,
  projectId: string,
  initialAutoRun: ShortFormAutoRunState,
  signal: AbortSignal,
) {
  let autoRun = initialAutoRun;
  const currentStep = getShortFormAutoRunCurrentStep(autoRun.startedFrom);
  const subsequentSteps = SHORT_FORM_AUTO_RUN_STEPS.filter((step) => {
    if (currentStep?.id === step.id) return false;
    return autoRun.selectedSteps.includes(step.id);
  });

  try {
    if (currentStep) {
      autoRun = updateAutoRun(projectId, autoRun, {
        currentStep: currentStep.id,
        waitingSteps: autoRun.waitingSteps.filter((stepId) => stepId !== currentStep.id),
      });
      await runStep(baseUrl, projectId, autoRun.id, signal, currentStep, {
        prepareCurrent: true,
      });
      autoRun = updateAutoRun(projectId, autoRun, {
        currentStep: undefined,
        completedSteps: Array.from(new Set([...autoRun.completedSteps, currentStep.id])),
      });
      await reconcileCompletedAutoRunApprovals(
        baseUrl,
        projectId,
        autoRun.id,
        signal,
        autoRun,
      );
      autoRun = assertAutoRunActive(projectId, autoRun.id, signal).autoRun || autoRun;
    }

    for (const step of subsequentSteps) {
      autoRun = updateAutoRun(projectId, autoRun, {
        currentStep: step.id,
        waitingSteps: autoRun.waitingSteps.filter((stepId) => stepId !== step.id),
      });
      await runStep(baseUrl, projectId, autoRun.id, signal, step);
      autoRun = updateAutoRun(projectId, autoRun, {
        currentStep: undefined,
        completedSteps: Array.from(new Set([...autoRun.completedSteps, step.id])),
      });
      await reconcileCompletedAutoRunApprovals(
        baseUrl,
        projectId,
        autoRun.id,
        signal,
        autoRun,
      );
      autoRun = assertAutoRunActive(projectId, autoRun.id, signal).autoRun || autoRun;
    }

    await reconcileCompletedAutoRunApprovals(
      baseUrl,
      projectId,
      autoRun.id,
      signal,
      autoRun,
    );

    updateAutoRun(projectId, autoRun, {
      status: "completed",
      currentStep: undefined,
      waitingSteps: [],
      finishedAt: nowIso(),
    });
  } catch (error) {
    if (error instanceof AutoRunStoppedError) return;
    try {
      await reconcileCompletedAutoRunApprovals(
        baseUrl,
        projectId,
        autoRun.id,
        signal,
        autoRun,
      );
    } catch {
      // Preserve the original auto-run failure; approval reconciliation is best-effort here.
    }
    updateAutoRun(projectId, autoRun, {
      status: "failed",
      failedStep: autoRun.currentStep,
      error: summarizeShortFormAutoRunError(error instanceof Error ? error.message : String(error)) || "Auto-run failed",
      currentStep: undefined,
      finishedAt: nowIso(),
    });
  }
}

export function reconcileStaleShortFormAutoRun(projectId: string) {
  const project = getShortFormProject(projectId);
  const autoRun = project?.autoRun;
  if (!project || !autoRun) return project;
  if (autoRun.status !== "active") {
    return reconcileFinishedAutoRunWithProjectState(projectId, project);
  }
  if (jobs.has(autoRun.id)) return project;

  updateAutoRun(projectId, autoRun, {
    status: "failed",
    error:
      "Auto-run stopped because the dashboard server restarted before the in-process worker finished. Start it again to continue.",
    currentStep: undefined,
    failedStep: autoRun.currentStep,
    finishedAt: nowIso(),
  });
  return getShortFormProject(projectId);
}

export function getShortFormAutoRunJob(projectId: string) {
  const project = reconcileStaleShortFormAutoRun(projectId);
  return project?.autoRun;
}

export function startShortFormAutoRun({
  projectId,
  baseUrl,
  startedFrom,
  selectedSubsequentSteps,
}: {
  projectId: string;
  baseUrl: string;
  startedFrom: ShortFormDetailRouteSection;
  selectedSubsequentSteps?: ShortFormAutoRunStepId[];
}) {
  const project = reconcileStaleShortFormAutoRun(projectId);
  if (!project) {
    throw new Error("Project not found");
  }
  if (project.autoRun?.status === "active") {
    throw new Error(
      `An auto-run is already active${
        project.autoRun.currentStep
          ? ` at ${getShortFormAutoRunStepLabel(project.autoRun.currentStep)}`
          : ""
      }.`,
    );
  }

  const subsequentStepIds = selectedSubsequentSteps
    ? new Set(selectedSubsequentSteps)
    : undefined;
  const validSelectedSubsequentSteps = subsequentStepIds
    ? getShortFormAutoRunSubsequentSteps(startedFrom)
        .map((step) => step.id)
        .filter((stepId) => subsequentStepIds.has(stepId))
    : undefined;
  const autoRun = buildShortFormAutoRunState({
    startedFrom,
    selectedSubsequentSteps: validSelectedSubsequentSteps,
  });
  const controller = new AbortController();
  saveAutoRun(projectId, autoRun);
  const job: AutoRunJob = {
    autoRunId: autoRun.id,
    projectId,
    controller,
    promise: Promise.resolve(),
  };
  jobs.set(autoRun.id, job);
  job.promise = runAutoRun(baseUrl, projectId, autoRun, controller.signal).finally(() => {
    jobs.delete(autoRun.id);
  });

  return autoRun;
}

export function stopShortFormAutoRun(projectId: string) {
  const project = getShortFormProject(projectId);
  const autoRun = project?.autoRun;
  if (!project || autoRun?.status !== "active") return autoRun;

  const job = jobs.get(autoRun.id);
  job?.controller.abort();
  jobs.delete(autoRun.id);

  return updateAutoRun(projectId, autoRun, {
    status: "stopped",
    currentStep: undefined,
    waitingSteps: [],
    finishedAt: nowIso(),
  });
}
