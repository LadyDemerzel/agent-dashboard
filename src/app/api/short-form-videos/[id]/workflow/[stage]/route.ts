import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { randomUUID } from "crypto";
import {
  appendStatusLog,
  readStatusLog,
  type DeliverableStatus,
} from "@/lib/status";
import { createThread, getThreadsForDeliverable } from "@/lib/feedback";
import { enqueueShortFormStageRun, getPreferredModelsForStage } from "@/lib/short-form-stage-runner";
import { ensureXmlScriptDocument, getXmlScriptPath } from "@/lib/short-form-xml-script";
import {
  ensureStageDocument,
  getLatestStageRequest,
  getProjectDir,
  getSceneManifestPath,
  getShortFormProject,
  getStageFilePath,
  getTextScriptRunDir,
  persistManualTextScriptIteration,
  updateLatestStageRequest,
  updatePendingStage,
  updateProjectMeta,
  updateStageFrontMatterStatus,
  writeStageDocument,
  type ShortFormStageKey,
} from "@/lib/short-form-videos";
import { hasVersions, initializeVersionHistory, addVersion } from "@/lib/versions";
import { getShortFormWorkflowPrompts, renderShortFormPrompt } from "@/lib/short-form-workflow-prompts";
import { resolveShortFormImageStyle } from "@/lib/short-form-image-styles";
import {
  resolveShortFormBackgroundVideoAbsolutePath,
  resolveShortFormBackgroundVideoSelection,
} from "@/lib/short-form-background-videos";
import {
  getShortFormTextScriptSettings,
  SHORT_FORM_TEXT_SCRIPT_PASSING_SCORE,
} from "@/lib/short-form-text-script-settings";

export const dynamic = "force-dynamic";

const HOME_DIR = process.env.HOME || "/Users/ittaisvidler";

const STAGE_AGENT: Record<ShortFormStageKey, "oracle" | "scribe" | "workflow"> = {
  research: "oracle",
  script: "scribe",
  "scene-images": "workflow",
  video: "workflow",
};

function getStageTitle(stage: ShortFormStageKey) {
  switch (stage) {
    case "research":
      return "Research";
    case "script":
      return "Text Script";
    case "scene-images":
      return "Visuals";
    case "video":
      return "Video";
  }
}

function getPendingKey(stage: ShortFormStageKey): ShortFormStageKey | "scene-images" {
  return stage;
}

function ensureInitialStageDoc(projectId: string, stage: ShortFormStageKey, topic: string) {
  const defaults = {
    research: {
      title: `${topic || "Short-form video"} research`,
      agent: "oracle",
      body: "# Research\n\nWaiting for Oracle to generate research.",
    },
    script: {
      title: `${topic || "Short-form video"} text script`,
      agent: "scribe",
      body: "Waiting for Scribe to generate the plain narration text script.",
    },
    "scene-images": {
      title: `${topic || "Short-form video"} visuals`,
      agent: "workflow",
      body: "# Visuals\n\nWaiting for the dashboard workflow to generate the visual manifest and green-screen assets.",
    },
    video: {
      title: `${topic || "Short-form video"} final video`,
      agent: "workflow",
      body: "# Final Video\n\nWaiting for the dashboard workflow to render the final video.",
    },
  } as const;

  return ensureStageDocument(projectId, stage, {
    ...defaults[stage],
    status: "draft",
    tags: ["short-form-video", stage],
  });
}

function shouldUseCleanRerunPrompt(stage: ShortFormStageKey, mode: "generate" | "revise", notes?: string) {
  return stage === "script" && mode === "revise" && !notes?.trim();
}

function buildRevisionInstruction(stage: ShortFormStageKey, mode: "generate" | "revise", notes?: string) {
  if (mode !== "revise") return "";
  const cleaned = notes?.trim();
  if (cleaned) {
    return stage === "script"
      ? `Revise the existing plain text script based on this feedback:
${cleaned}`
      : `Revise the existing artifact based on this feedback:
${cleaned}`;
  }
  return stage === "script"
    ? "No specific revision notes were supplied. Regenerate the existing plain text script in place as a clean rerun from the approved inputs, preserving the current workflow requirements and writing the refreshed result back to the same path."
    : "";
}

function promptKeyFor(stage: Exclude<ShortFormStageKey, "script">, mode: "generate" | "revise") {
  if (stage === "research") return mode === "generate" ? "researchGenerate" : "researchRevise";
  if (stage === "scene-images") return mode === "generate" ? "sceneImagesGenerate" : "sceneImagesRevise";
  return mode === "generate" ? "videoGenerate" : "videoRevise";
}

function getStageArtifactRequirements(stage: ShortFormStageKey, paths: {
  researchPath: string;
  scriptPath: string;
  sceneManifestPath: string;
  sceneDocPath: string;
  videoDocPath: string;
  finalVideoPath: string;
}) {
  switch (stage) {
    case "research":
      return {
        primary: paths.researchPath,
        required: [paths.researchPath],
        verification: [
          `After writing, read back ${paths.researchPath} and verify the revised research is present.`,
        ],
      };
    case "script":
      return {
        primary: paths.scriptPath,
        required: [paths.scriptPath],
        verification: [
          `After writing, read back ${paths.scriptPath} and verify the plain narration script reflects the latest requested text-script output for this run.`,
          `The text-script body must be plain narration prose only. If you still see XML tags like <video>, <script>, <scene>, <text>, or <image>, the task is not complete.`,
        ],
      };
    case "scene-images":
      return {
        primary: paths.sceneDocPath,
        required: [paths.sceneDocPath, paths.sceneManifestPath],
        verification: [
          `After writing, read back ${paths.sceneDocPath}.`,
          `Then read back ${paths.sceneManifestPath} and confirm it is valid JSON with a non-empty top-level scenes array.`,
        ],
      };
    case "video":
      return {
        primary: paths.videoDocPath,
        required: [paths.videoDocPath, paths.finalVideoPath],
        verification: [
          `After rendering, confirm ${paths.finalVideoPath} exists and then read back ${paths.videoDocPath}.`,
        ],
      };
  }
}

function buildExecutionContract(stage: ShortFormStageKey, mode: "generate" | "revise", requirements: ReturnType<typeof getStageArtifactRequirements>) {
  const stageLabel = getStageTitle(stage);
  return [
    "EXECUTION CONTRACT — REQUIRED FOR TASK SUCCESS",
    `This is an artifact-writing task for the ${stageLabel} stage.`,
    `You must create or update the required on-disk artifact(s), not just draft the content in chat.`,
    `Required artifact path(s):\n${requirements.required.map((item) => `- ${item}`).join("\n")}`,
    `Use the write/edit tool on the exact path(s) above. Do not stop after showing a draft in your response.`,
    mode === "revise"
      ? `This is a revision. You must overwrite/update the existing artifact in place at ${requirements.primary}. Do not create a second alternate file.`
      : `This is an initial generation. The task is incomplete until the required artifact(s) exist on disk at the exact path(s) above.`,
    `Before finishing, verify the artifact side effect yourself:\n${requirements.verification.map((item) => `- ${item}`).join("\n")}`,
    "If you cannot write or verify the artifact(s), explicitly say the task FAILED and explain why. Do not claim completion without the file side effect.",
  ].join("\n\n");
}

function buildTextScriptWorkflowConfig(
  project: NonNullable<ReturnType<typeof getShortFormProject>>,
  requestContext: { mode: "generate" | "revise"; notes?: string; textScriptRunId: string }
) {
  const textScriptSettings = getShortFormTextScriptSettings();
  const writerPromptMode: "generate" | "revise" =
    shouldUseCleanRerunPrompt("script", requestContext.mode, requestContext.notes) ? "generate" : "revise";
  const projectDir = getProjectDir(project.id);
  const researchPath = getStageFilePath(project.id, "research");
  const scriptPath = getStageFilePath(project.id, "script");
  const researchContent = fs.existsSync(researchPath) ? fs.readFileSync(researchPath, "utf-8") : "No approved research file found.";
  const runDir = getTextScriptRunDir(project.id, requestContext.textScriptRunId);
  const iterationsDir = path.join(runDir, "iterations");
  const runManifestPath = path.join(runDir, "run.json");
  const retentionSkillPath = path.join(HOME_DIR, ".openclaw", "skills", "video-script-retention", "SKILL.md");
  const retentionPlaybookPath = path.join(HOME_DIR, ".openclaw", "skills", "video-script-retention", "references", "playbook.md");
  const graderSkillPath = path.join(HOME_DIR, ".openclaw", "skills", "video-script-retention-grader", "SKILL.md");
  const graderRubricPath = path.join(HOME_DIR, ".openclaw", "skills", "video-script-retention-grader", "references", "rubric.md");
  const maxIterationsOverride = project.script.textScriptMaxIterationsOverride;
  const maxIterations = maxIterationsOverride || textScriptSettings.defaultMaxIterations;
  const passingScore = SHORT_FORM_TEXT_SCRIPT_PASSING_SCORE;

  return {
    task: [
      "Direct workflow execution for Text Script.",
      `Mode: ${requestContext.mode}`,
      `Text script run id: ${requestContext.textScriptRunId}`,
      `Run manifest path: ${runManifestPath}`,
      `Final published script path: ${scriptPath}`,
      `Max iterations: ${maxIterations}${maxIterationsOverride ? ` (project override; settings default is ${textScriptSettings.defaultMaxIterations})` : " (settings default)"}`,
      `Passing score: ${passingScore}/100`,
    ].join("\n"),
    config: {
      textScriptRunId: requestContext.textScriptRunId,
      mode: requestContext.mode,
      writerPromptMode,
      topic: project.topic,
      ...(project.selectedHookText ? { selectedHookText: project.selectedHookText } : {}),
      approvedResearch: researchContent,
      currentScriptContent: fs.existsSync(scriptPath) ? fs.readFileSync(scriptPath, "utf-8") : "",
      ...(requestContext.notes ? { notes: requestContext.notes } : {}),
      projectDir,
      scriptPath,
      runDir,
      iterationsDir,
      runManifestPath,
      maxIterations,
      ...(maxIterationsOverride ? { overrideMaxIterations: maxIterationsOverride } : {}),
      passingScore,
      generatePromptTemplate: textScriptSettings.generatePrompt,
      revisePromptTemplate: textScriptSettings.revisePrompt,
      reviewPromptTemplate: textScriptSettings.reviewPrompt,
      retentionSkillPath,
      retentionPlaybookPath,
      graderSkillPath,
      graderRubricPath,
    },
  };
}

function buildStageTask(
  project: NonNullable<ReturnType<typeof getShortFormProject>>,
  stage: Exclude<ShortFormStageKey, "script">,
  requestContext: {
    mode: "generate" | "revise";
    notes?: string;
  }
) {
  const prompts = getShortFormWorkflowPrompts();
  const promptMode = shouldUseCleanRerunPrompt(stage, requestContext.mode, requestContext.notes) ? "generate" : requestContext.mode;
  const template = prompts[promptKeyFor(stage, promptMode)];
  const projectDir = getProjectDir(project.id);
  const researchPath = getStageFilePath(project.id, "research");
  const scriptPath = getStageFilePath(project.id, "script");
  const sceneManifestPath = getSceneManifestPath(project.id);
  const sceneDocPath = getStageFilePath(project.id, "scene-images");
  const videoDocPath = getStageFilePath(project.id, "video");
  const xmlScriptPath = getXmlScriptPath(project.id);
  const finalVideoPath = `${projectDir}/output/final-video.mp4`;
  const sceneImagesDir = `${projectDir}/scenes`;
  const videoWorkDir = `${projectDir}/output/xml-scene-video-work`;
  const researchContent = fs.existsSync(researchPath) ? fs.readFileSync(researchPath, "utf-8") : "No approved research file found.";
  const renderedPrompt = renderShortFormPrompt(template, {
    topic: project.topic,
    selectedHookLine: project.selectedHookText ? `Selected hook: ${project.selectedHookText}` : "",
    selectedHookTextOrFallback: project.selectedHookText || "Use the topic context if no hook is selected.",
    notesOrFallback: requestContext.notes || "",
    revisionInstructionLine: buildRevisionInstruction(stage, requestContext.mode, requestContext.notes),
    researchPath,
    scriptPath: xmlScriptPath,
    sceneManifestPath,
    sceneDocPath,
    videoDocPath,
    finalVideoPath,
    sceneImagesDir,
    videoWorkDir,
    approvedResearch: researchContent,
    projectDir,
  });
  const requirements = getStageArtifactRequirements(stage, {
    researchPath,
    scriptPath: xmlScriptPath,
    sceneManifestPath,
    sceneDocPath,
    videoDocPath,
    finalVideoPath,
  });

  return [renderedPrompt, buildExecutionContract(stage, requestContext.mode, requirements)].join("\n\n");
}

function readStageStatus(filePath: string) {
  if (!fs.existsSync(filePath)) return "draft";
  const content = fs.readFileSync(filePath, "utf-8");
  const match = content.match(/\nstatus:\s*([^\n]+)/i);
  return match?.[1]?.trim() || "draft";
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; stage: string }> }
) {
  const { id, stage: rawStage } = await params;
  const stage = rawStage as ShortFormStageKey;
  const project = getShortFormProject(id);

  if (!project) {
    return NextResponse.json({ success: false, error: "Project not found" }, { status: 404 });
  }

  const body = await request.json().catch(() => ({}));
  const requestedAction = typeof body.action === "string" ? body.action : "generate";
  const notes = typeof body.notes === "string" ? body.notes.trim() : "";
  const sceneId = typeof body.sceneId === "string" ? body.sceneId.trim() : "";

  ensureInitialStageDoc(id, stage, project.topic);

  if (requestedAction === "request-scene-change" && stage !== "scene-images") {
    return NextResponse.json({ success: false, error: "Scene changes only apply to scene-images" }, { status: 400 });
  }

  const previousRequest = requestedAction === "retry" ? getLatestStageRequest(id, stage) : undefined;
  if (requestedAction === "retry" && !previousRequest) {
    return NextResponse.json({ success: false, error: `No previous ${stage} request is available to retry` }, { status: 400 });
  }

  const effectiveAction = requestedAction === "retry"
    ? previousRequest?.action || (previousRequest?.mode === "generate" ? "generate" : "revise")
    : requestedAction;
  const effectiveSceneId = requestedAction === "retry" ? previousRequest?.sceneId || "" : sceneId;
  const effectiveNotes = requestedAction === "retry" ? previousRequest?.notes || "" : notes;
  const mode = effectiveAction === "generate" ? "generate" : "revise";
  const requestNotes = effectiveAction === "request-scene-change" && effectiveSceneId
    ? effectiveNotes
      ? `Focus on ${effectiveSceneId}. Requested change: ${effectiveNotes}`
      : `Focus on ${effectiveSceneId}. No specific change notes were supplied, so treat this as a clean rerun for that targeted scope and any continuity-linked downstream scenes that depend on it.`
    : effectiveNotes;
  const directWorkflowRequestLine = requestNotes
    ? mode === "revise"
      ? `Requested changes: ${requestNotes}`
      : `Run direction: ${requestNotes}`
    : mode === "revise"
      ? "Requested changes: none. Treat this as a clean rerun/regeneration for the current scope rather than a targeted textual revision."
      : "Run direction: none";
  // Every script trigger needs a fresh run id so regenerate/retry creates a new
  // iteration history instead of mutating or pointing at the previous run.
  const textScriptRunId = stage === "script"
    ? randomUUID()
    : undefined;
  const resolvedImageStyle = resolveShortFormImageStyle(project.selectedImageStyleId);
  const resolvedBackgroundVideo = resolveShortFormBackgroundVideoSelection(project.selectedBackgroundVideoId);

  const textScriptWorkflow = stage === "script" && textScriptRunId
    ? buildTextScriptWorkflowConfig(project, { mode, notes: requestNotes, textScriptRunId })
    : null;

  const task = stage === "script" && textScriptWorkflow
    ? textScriptWorkflow.task
    : stage === "scene-images" || stage === "video"
    ? [
        `Direct workflow execution for ${getStageTitle(stage)}.`,
        `Mode: ${mode}`,
        ...(stage === "scene-images"
          ? [
              `Selected image style: ${resolvedImageStyle.style.name}`,
              `Shared/common style constraints plus per-style instructions are already resolved and must stay applied for this run.`,
            ]
          : []),
        ...(stage === "video" && resolvedBackgroundVideo.background
          ? [`Selected looping background video: ${resolvedBackgroundVideo.background.name}`]
          : stage === "video"
            ? ["No looping background video is configured. The direct video render should fail clearly until one is chosen in settings/project selection."]
            : []),
        directWorkflowRequestLine,
      ].join("\n")
    : buildStageTask(project, "research", { mode, notes: requestNotes });
  const projectDir = getProjectDir(id);
  const researchPath = getStageFilePath(id, "research");
  const scriptPath = getStageFilePath(id, "script");
  const xmlScriptPath = getXmlScriptPath(id);
  ensureXmlScriptDocument(id, project.topic);
  const sceneManifestPath = getSceneManifestPath(id);
  const sceneDocPath = getStageFilePath(id, "scene-images");
  const videoDocPath = getStageFilePath(id, "video");
  const finalVideoPath = `${projectDir}/output/final-video.mp4`;
  const sceneImagesDir = `${projectDir}/scenes`;
  const videoWorkDir = `${projectDir}/output/xml-scene-video-work`;
  const requirements = getStageArtifactRequirements(stage, {
    researchPath,
    scriptPath: stage === "script" ? scriptPath : xmlScriptPath,
    sceneManifestPath,
    sceneDocPath,
    videoDocPath,
    finalVideoPath,
  });
  const requestedAt = new Date().toISOString();

  updatePendingStage(id, getPendingKey(stage), true);
  updateLatestStageRequest(id, stage, {
    requestedAt,
    action: effectiveAction === "request-scene-change" ? "request-scene-change" : mode,
    mode,
    ...(requestNotes ? { notes: requestNotes } : {}),
    ...(effectiveSceneId ? { sceneId: effectiveSceneId } : {}),
    ...(textScriptRunId ? { textScriptRunId } : {}),
  });

  if (requestedAction !== "generate" && requestedAction !== "retry" && notes) {
    const filePath = getStageFilePath(id, stage);
    createThread(filePath, `${id}:${stage}`, STAGE_AGENT[stage], null, null, requestNotes || notes, "user");
    updateStageFrontMatterStatus(id, stage, "requested changes");
    appendStatusLog(filePath, project[stage === "scene-images" ? "sceneImages" : stage].status || "draft", "requested changes", "ittai", requestNotes || notes);
  }

  try {
    const run = enqueueShortFormStageRun({
      projectId: id,
      stage,
      agentId: STAGE_AGENT[stage],
      label: `short-form-${stage}-${id}`,
      sessionKeyBase: `hook:short-form:${id}:${stage}`,
      task,
      requestedAt,
      requiredArtifacts: requirements.required,
      preferredModels: getPreferredModelsForStage(stage),
      directConfig:
        stage === "script" && textScriptWorkflow
          ? {
              kind: "text-script" as const,
              config: textScriptWorkflow.config,
            }
          : stage === "scene-images"
          ? {
              kind: "scene-images" as const,
              config: {
                scriptPath: xmlScriptPath,
                outputDir: sceneImagesDir,
                sceneManifestPath,
                sceneDocPath,
                mode,
                imageStyleId: resolvedImageStyle.resolvedStyleId,
                imageStyleName: resolvedImageStyle.style.name,
                imageStyleSubject: resolvedImageStyle.style.subjectPrompt,
                imageCommonConstraints: resolvedImageStyle.settings.commonConstraints,
                imageStylePrompt: resolvedImageStyle.effectiveStylePrompt,
                imageStyleHeaderPercent: resolvedImageStyle.style.headerPercent,
                imageStyleReferences: resolvedImageStyle.style.references || [],
                imagePromptTemplates: resolvedImageStyle.settings.promptTemplates,
                ...(requestNotes ? { notes: requestNotes } : {}),
                ...(effectiveSceneId ? { sceneId: effectiveSceneId } : {}),
              },
            }
          : stage === "video"
            ? {
                kind: "video" as const,
                config: {
                  scriptPath: xmlScriptPath,
                  sceneManifestPath,
                  sceneImagesDir,
                  finalVideoPath,
                  videoDocPath,
                  videoWorkDir,
                  mode,
                  ...(resolvedBackgroundVideo.background
                    ? {
                        backgroundVideoId: resolvedBackgroundVideo.resolvedBackgroundVideoId,
                        backgroundVideoName: resolvedBackgroundVideo.background.name,
                        backgroundVideoPath: resolveShortFormBackgroundVideoAbsolutePath(
                          resolvedBackgroundVideo.background.videoRelativePath
                        ),
                      }
                    : {}),
                  ...(requestNotes ? { notes: requestNotes } : {}),
                },
              }
            : undefined,
    });

    updateLatestStageRequest(id, stage, {
      requestedAt,
      runId: run.runId,
      action: effectiveAction === "request-scene-change" ? "request-scene-change" : mode,
      mode,
      ...(requestNotes ? { notes: requestNotes } : {}),
      ...(effectiveSceneId ? { sceneId: effectiveSceneId } : {}),
      ...(textScriptRunId ? { textScriptRunId } : {}),
    });

    return NextResponse.json({
      success: true,
      message: `${getStageTitle(stage)} task triggered`,
      runId: run.runId,
    });
  } catch (error) {
    updatePendingStage(id, getPendingKey(stage), false);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : `Failed to trigger ${stage}` },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; stage: string }> }
) {
  const { id, stage: rawStage } = await params;
  const stage = rawStage as ShortFormStageKey;
  const project = getShortFormProject(id);
  if (!project) {
    return NextResponse.json({ success: false, error: "Project not found" }, { status: 404 });
  }

  const body = await request.json().catch(() => ({}));
  const content = typeof body.content === "string" ? body.content : undefined;
  const status = typeof body.status === "string" ? body.status : undefined;
  const comment = typeof body.comment === "string" ? body.comment : undefined;
  const updatedBy = typeof body.updatedBy === "string" ? body.updatedBy : "ittai";

  const filePath = ensureInitialStageDoc(id, stage, project.topic);
  const currentContent = fs.existsSync(filePath) ? fs.readFileSync(filePath, "utf-8") : "";
  const currentStatus = project[stage === "scene-images" ? "sceneImages" : stage].status || "draft";

  let finalContent = currentContent;

  if (content !== undefined) {
    writeStageDocument(id, stage, content);
    finalContent = content;

    if (!hasVersions(filePath)) {
      initializeVersionHistory(filePath, finalContent, updatedBy);
    } else if (finalContent !== currentContent) {
      addVersion(filePath, finalContent, updatedBy, comment || "Updated from dashboard");
    }

    if (stage === "script" && finalContent !== currentContent) {
      persistManualTextScriptIteration(id, finalContent, updatedBy, comment || "Manual dashboard edit");
    }
  }

  if (status) {
    updateStageFrontMatterStatus(id, stage, status);
    appendStatusLog(filePath, currentStatus, status as DeliverableStatus, updatedBy, comment || `Status changed to ${status}`);
    finalContent = fs.readFileSync(filePath, "utf-8");
  }

  updatePendingStage(id, getPendingKey(stage), false);
  updateProjectMeta(id, {});

  return NextResponse.json({
    success: true,
    data: {
      content: finalContent,
      status: status || readStageStatus(filePath),
      statusLog: readStatusLog(filePath),
      threads: getThreadsForDeliverable(filePath),
    },
  });
}
