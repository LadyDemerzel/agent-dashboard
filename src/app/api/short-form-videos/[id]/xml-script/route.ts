import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { spawn } from "child_process";
import { randomUUID } from "crypto";
import { extractBody } from "@/lib/frontmatter";
import { getShortFormProject, getStageFilePath } from "@/lib/short-form-videos";
import {
  ensureXmlScriptDocument,
  getXmlScriptDocument,
  getXmlScriptPath,
  getXmlScriptRunsDir,
  getXmlScriptWorkDir,
  stopXmlScriptRun,
  updateXmlScriptFrontMatterStatus,
  writeXmlScriptRunProcessInfo,
  writeXmlScriptDocument,
} from "@/lib/short-form-xml-script";
import { updateProjectMeta } from "@/lib/short-form-videos";
import { stopShortFormAutoRun } from "@/lib/short-form-auto-run-orchestrator";
import {
  getShortFormVideoRenderSettings,
  resolveShortFormPauseRemovalSettings,
  resolveShortFormVoiceSelection,
} from "@/lib/short-form-video-render-settings";
import {
  getShortFormXmlVisualPlanningSettings,
  renderShortFormXmlVisualPlanningPrompt,
} from "@/lib/short-form-xml-visual-planning-settings";

export const dynamic = "force-dynamic";

const HOME_DIR = process.env.HOME || "/Users/ittaisvidler";
const REPO_ROOT = path.join(HOME_DIR, "tenxsolo", "systems", "agent-dashboard");
const WORKER_PATH = path.join(REPO_ROOT, "scripts", "xml-script-worker.mjs");
const DEFAULT_RELIABLE_MODEL = process.env.SHORT_FORM_RELIABLE_MODEL || "openai/gpt-5.5";
const DEFAULT_RETRY_MODEL = process.env.SHORT_FORM_RETRY_MODEL || "";

type XmlWorkflowTask = "full" | "narration" | "silence" | "captions" | "visuals";

function normalizeXmlWorkflowTask(value: unknown): XmlWorkflowTask {
  return value === "narration" || value === "silence" || value === "captions" || value === "visuals" ? value : "full";
}

function ensureDir(dirPath: string) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function writeJson(filePath: string, value: unknown) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2), "utf-8");
}

function looksLikeLegacyXmlTextScript(content: string) {
  const body = extractBody(content).trim();
  if (!body) return false;
  return /<video\b/i.test(body)
    || /<script\b/i.test(body)
    || /<scene\b/i.test(body)
    || /<timeline\b/i.test(body)
    || /<assets\b/i.test(body)
    || /<text>[\s\S]*?<\/text>/i.test(body)
    || /<image>[\s\S]*?<\/image>/i.test(body);
}

function buildXmlAuthoringPrompt(project: NonNullable<ReturnType<typeof getShortFormProject>>, notes?: string) {
  const projectId = project.id;
  const projectDir = path.join(HOME_DIR, "tenxsolo", "business", "content", "deliverables", "short-form-videos", projectId);
  const textScriptPath = getStageFilePath(projectId, "script");
  const xmlScriptPath = getXmlScriptPath(projectId);
  const workDir = getXmlScriptWorkDir(projectId);
  const captionPlanPath = path.join(workDir, "captions", "caption-sections.json");
  const alignmentPath = path.join(workDir, "alignment", "word-timestamps.json");
  const transcriptPath = path.join(workDir, "voice", "text-script.txt");
  const settings = getShortFormXmlVisualPlanningSettings();
  const revisionNotes = notes || "";
  const promptTemplate = revisionNotes
    ? settings.revisePromptTemplate
    : settings.promptTemplate;

  const existingBody = fs.existsSync(xmlScriptPath) ? extractBody(fs.readFileSync(xmlScriptPath, "utf-8")).trim() : "";
  const promptValues = {
    xmlScriptPath,
    topic: project.topic || "Untitled short-form video",
    selectedHook: project.selectedHookText ?? "",
    revisionNotes,
    textScriptPath,
    transcriptPath,
    alignmentPath,
    captionPlanPath,
    projectDir,
    existingXmlBodySummary: existingBody
      ? `The current artifact body is ${existingBody.length} characters; your saved body must differ from it.`
      : "No previous XML body was found; write the initial complete XML body.",
  };
  const planningVisualsGuidelines = renderShortFormXmlVisualPlanningPrompt(
    settings.planningGuidelinesTemplate,
    promptValues,
  );

  return renderShortFormXmlVisualPlanningPrompt(promptTemplate, {
    ...promptValues,
    planningVisualsGuidelines,
  });
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const project = getShortFormProject(id);
  if (!project) {
    return NextResponse.json({ success: false, error: "Project not found" }, { status: 404 });
  }
  ensureXmlScriptDocument(id, project.topic);
  const expectedPauseRemoval = resolveShortFormPauseRemovalSettings({
    ...(typeof project.pauseRemovalMinSilenceDurationSecondsOverride === "number"
      ? { minSilenceDurationSeconds: project.pauseRemovalMinSilenceDurationSecondsOverride }
      : {}),
    ...(typeof project.pauseRemovalSilenceThresholdDbOverride === "number"
      ? { silenceThresholdDb: project.pauseRemovalSilenceThresholdDbOverride }
      : {}),
  });
  return NextResponse.json({
    success: true,
    data: getXmlScriptDocument(id, {
      expectedVoiceId: project.selectedVoiceId,
      expectedPauseRemoval,
    }),
  });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const project = getShortFormProject(id);
  if (!project) {
    return NextResponse.json({ success: false, error: "Project not found" }, { status: 404 });
  }

  const body = await request.json().catch(() => ({}));
  const task = normalizeXmlWorkflowTask(body.task);
  const notes = typeof body.notes === "string" ? body.notes.trim() : "";
  const source = typeof body.source === "string" ? body.source.trim() : "";
  const autoApproveOnComplete =
    task === "visuals" &&
    source === "generate-visuals-edit-button" &&
    body.autoApproveOnComplete === true;
  const textScriptPath = getStageFilePath(id, "script");
  if (!fs.existsSync(textScriptPath)) {
    return NextResponse.json({ success: false, error: "Text script is missing. Generate or save the text script first." }, { status: 400 });
  }

  const textScriptContent = fs.readFileSync(textScriptPath, "utf-8");
  if (!extractBody(textScriptContent).trim()) {
    return NextResponse.json({ success: false, error: "Text script is empty. Generate or save the plain narration text first." }, { status: 400 });
  }

  if (looksLikeLegacyXmlTextScript(textScriptContent)) {
    return NextResponse.json(
      {
        success: false,
        error: "Text script still contains legacy XML/scene markup. Regenerate the Text Script stage so it outputs plain narration text only before running XML Script.",
      },
      { status: 400 }
    );
  }

  ensureXmlScriptDocument(id, project.topic);
  const expectedPauseRemoval = resolveShortFormPauseRemovalSettings({
    ...(typeof project.pauseRemovalMinSilenceDurationSecondsOverride === "number"
      ? { minSilenceDurationSeconds: project.pauseRemovalMinSilenceDurationSecondsOverride }
      : {}),
    ...(typeof project.pauseRemovalSilenceThresholdDbOverride === "number"
      ? { silenceThresholdDb: project.pauseRemovalSilenceThresholdDbOverride }
      : {}),
  });
  const currentDoc = getXmlScriptDocument(id, {
    expectedVoiceId: project.selectedVoiceId,
    expectedPauseRemoval,
  });
  if (currentDoc.pending) {
    return NextResponse.json({ success: false, error: "XML script pipeline is already running" }, { status: 409 });
  }

  const runsDir = getXmlScriptRunsDir(id);
  ensureDir(runsDir);
  ensureDir(getXmlScriptWorkDir(id));
  const runId = randomUUID();
  const prompt = buildXmlAuthoringPrompt(project, notes);
  const selectedVoice = resolveShortFormVoiceSelection(project.selectedVoiceId);
  const renderSettings = getShortFormVideoRenderSettings();
  const captionMaxWords = project.captionMaxWordsOverride ?? renderSettings.captionMaxWords;
  const pauseRemoval = expectedPauseRemoval;
  const requestedAt = new Date().toISOString();
  const jobPath = path.join(runsDir, `${runId}.job.json`);
  const statusPath = path.join(runsDir, `${runId}.status.json`);
  fs.writeFileSync(jobPath, JSON.stringify({
    runId,
    projectId: id,
    projectTopic: project.topic,
    textScriptPath,
    xmlScriptPath: getXmlScriptPath(id),
    workDir: getXmlScriptWorkDir(id),
    task,
    prompt,
    notes,
    selectedVoice: {
      id: selectedVoice.voice.id,
      name: selectedVoice.voice.name,
      sourceType: selectedVoice.voice.sourceType,
      mode: selectedVoice.voice.mode,
      voiceDesignPrompt: selectedVoice.voice.voiceDesignPrompt,
      previewText: selectedVoice.voice.previewText,
      ...(selectedVoice.voice.speaker ? { speaker: selectedVoice.voice.speaker } : {}),
      ...(selectedVoice.voice.legacyInstruct ? { legacyInstruct: selectedVoice.voice.legacyInstruct } : {}),
      ...(selectedVoice.voice.referenceAudioRelativePath ? { referenceAudioRelativePath: selectedVoice.voice.referenceAudioRelativePath } : {}),
      ...(selectedVoice.voice.referenceText ? { referenceText: selectedVoice.voice.referenceText } : {}),
      ...(selectedVoice.voice.referencePrompt ? { referencePrompt: selectedVoice.voice.referencePrompt } : {}),
      ...(selectedVoice.voice.referenceMode ? { referenceMode: selectedVoice.voice.referenceMode } : {}),
      ...(selectedVoice.voice.referenceSpeaker ? { referenceSpeaker: selectedVoice.voice.referenceSpeaker } : {}),
      ...(selectedVoice.voice.referenceGeneratedAt ? { referenceGeneratedAt: selectedVoice.voice.referenceGeneratedAt } : {}),
      source: selectedVoice.source,
      resolvedVoiceId: selectedVoice.resolvedVoiceId,
    },
    preferredModels: [DEFAULT_RELIABLE_MODEL, DEFAULT_RETRY_MODEL].filter(Boolean),
    captionMaxWords,
    pauseRemoval,
    requestedAt,
    source,
    autoApproveOnComplete,
  }, null, 2), "utf-8");
  writeJson(statusPath, { status: "running", runId, projectId: id, task, startedAt: requestedAt, attempts: [] });

  if (task === "full" || task === "visuals") {
    updateXmlScriptFrontMatterStatus(id, "working");
  }
  updateProjectMeta(id, {});

  const child = spawn(process.execPath, [WORKER_PATH, jobPath], {
    cwd: REPO_ROOT,
    detached: true,
    stdio: "ignore",
  });
  writeXmlScriptRunProcessInfo(id, runId, child.pid);
  child.unref();

  const taskLabel = task === "narration"
    ? "Narration Audio"
    : task === "silence"
      ? "Pause removal + alignment"
      : task === "captions"
        ? "Plan Captions"
        : task === "visuals"
          ? "Plan Visuals"
          : "XML workflow";

  return NextResponse.json({
    success: true,
    runId,
    message: `${taskLabel} started`,
    data: getXmlScriptDocument(id, {
      expectedVoiceId: project.selectedVoiceId,
      expectedPauseRemoval,
    }),
  });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const project = getShortFormProject(id);
  if (!project) {
    return NextResponse.json({ success: false, error: "Project not found" }, { status: 404 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const content = typeof body.content === "string" ? body.content : undefined;
    const status = typeof body.status === "string" ? body.status.trim() : undefined;

    if (content !== undefined) {
      if (!content.trim()) {
        return NextResponse.json(
          { success: false, error: "XML script content cannot be empty." },
          { status: 400 }
        );
      }
      writeXmlScriptDocument(id, content);
    }
    if (status) {
      updateXmlScriptFrontMatterStatus(id, status);
    }

    const expectedPauseRemoval = resolveShortFormPauseRemovalSettings({
      ...(typeof project.pauseRemovalMinSilenceDurationSecondsOverride === "number"
        ? { minSilenceDurationSeconds: project.pauseRemovalMinSilenceDurationSecondsOverride }
        : {}),
      ...(typeof project.pauseRemovalSilenceThresholdDbOverride === "number"
        ? { silenceThresholdDb: project.pauseRemovalSilenceThresholdDbOverride }
        : {}),
    });

    return NextResponse.json({
      success: true,
      data: getXmlScriptDocument(id, {
        expectedVoiceId: project.selectedVoiceId,
        expectedPauseRemoval,
      }),
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? `Failed to save XML script: ${error.message}`
            : "Failed to save XML script.",
      },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const project = getShortFormProject(id);
  if (!project) {
    return NextResponse.json({ success: false, error: "Project not found" }, { status: 404 });
  }

  const result = stopXmlScriptRun(id);
  if (project.autoRun?.status === "active") {
    stopShortFormAutoRun(id);
  }
  updateProjectMeta(id, {});

  const expectedPauseRemoval = resolveShortFormPauseRemovalSettings({
    ...(typeof project.pauseRemovalMinSilenceDurationSecondsOverride === "number"
      ? { minSilenceDurationSeconds: project.pauseRemovalMinSilenceDurationSecondsOverride }
      : {}),
    ...(typeof project.pauseRemovalSilenceThresholdDbOverride === "number"
      ? { silenceThresholdDb: project.pauseRemovalSilenceThresholdDbOverride }
      : {}),
  });

  return NextResponse.json({
    success: true,
    message: result.stopped
      ? "XML script pipeline stopped"
      : "XML script pipeline marked stopped",
    data: {
      result,
      xmlScript: getXmlScriptDocument(id, {
        expectedVoiceId: project.selectedVoiceId,
        expectedPauseRemoval,
      }),
    },
  });
}
