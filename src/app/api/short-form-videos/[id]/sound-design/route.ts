import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { randomUUID } from "crypto";
import { spawn } from "child_process";
import { appendStatusLog } from "@/lib/status";
import { getShortFormProject, updateLatestStageRequest, updateProjectMeta, updateStageFrontMatterStatus } from "@/lib/short-form-videos";
import {
  getShortFormSoundDesignPath,
  getShortFormSoundDesignWorkDir,
  readShortFormSoundDesignDocument,
  resolveShortFormSoundDesign,
  writeShortFormSoundDesignDocument,
} from "@/lib/short-form-sound-design";
import { buildShortFormSoundDesignPrompt } from "@/lib/short-form-sound-design-settings";
import { getXmlScriptPath } from "@/lib/short-form-xml-script";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const HOME_DIR = process.env.HOME || "/Users/ittaisvidler";
const REPO_ROOT = path.join(HOME_DIR, "tenxsolo", "systems", "agent-dashboard");
const WORKER_PATH = path.join(REPO_ROOT, "scripts", "sound-design-worker.mjs");
const DEFAULT_RELIABLE_MODEL = process.env.SHORT_FORM_RELIABLE_MODEL || "openai/gpt-5.5";
const DEFAULT_RETRY_MODEL = process.env.SHORT_FORM_RETRY_MODEL || "";
const MIN_GENERATED_SOUND_DESIGN_EFFECTS = 12;

function isApprovedStatus(status?: string) {
  return status === "approved" || status === "published";
}

function isNeedsReviewStatus(status?: string) {
  const normalized = status?.trim().toLowerCase().replace(/[-_]+/g, " ");
  return normalized === "needs review" || normalized === "review";
}

function ensureDir(dirPath: string) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function writeRunFailureStatus(jobPath: string, payload: Record<string, unknown>) {
  const statusPath = jobPath.replace(/\.job\.json$/, ".status.json");
  let existing: Record<string, unknown> = {};
  if (fs.existsSync(statusPath)) {
    try {
      existing = JSON.parse(fs.readFileSync(statusPath, "utf-8")) as Record<string, unknown>;
    } catch {
      existing = {};
    }
  }

  fs.writeFileSync(statusPath, JSON.stringify({
    ...existing,
    ...payload,
    status: "failed",
    finishedAt: new Date().toISOString(),
  }, null, 2), "utf-8");
}

function launchSoundDesignWorker(projectId: string, jobPath: string) {
  const child = spawn(process.execPath, [WORKER_PATH, jobPath], {
    cwd: REPO_ROOT,
    stdio: "ignore",
  });

  child.once("error", (error) => {
    writeRunFailureStatus(jobPath, {
      projectId,
      errorMessage: error instanceof Error ? error.message : String(error),
    });
    updateProjectMeta(projectId, { pendingSoundDesign: false });
  });

  child.once("exit", (code, signal) => {
    updateProjectMeta(projectId, { pendingSoundDesign: false });

    if (code === 0) {
      try {
        const doc = readShortFormSoundDesignDocument(projectId);
        if (!isNeedsReviewStatus(doc.status) && !isApprovedStatus(doc.status)) {
          updateStageFrontMatterStatus(projectId, "sound-design", "needs review");
          appendStatusLog(
            getShortFormSoundDesignPath(projectId),
            doc.status || "draft",
            "needs review",
            "dashboard",
            "Plan Sound Design generated",
          );
        }
        resolveShortFormSoundDesign(projectId);
        const latestDoc = readShortFormSoundDesignDocument(projectId);
        if (!isApprovedStatus(latestDoc.status)) {
          updateProjectMeta(projectId, {
            soundDesignDecision: undefined,
            soundDesignSkipReason: undefined,
            soundDesignApprovalWarning: undefined,
          });
        }
      } catch (error) {
        writeRunFailureStatus(jobPath, {
          projectId,
          errorMessage: error instanceof Error ? error.message : String(error),
        });
      }
      return;
    }

    writeRunFailureStatus(jobPath, {
      projectId,
      errorMessage: signal
        ? `Sound-design worker exited from signal ${signal}`
        : `Sound-design worker exited with code ${code ?? "unknown"}`,
    });
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

  const soundDesignPath = getShortFormSoundDesignPath(id);
  const resolution = fs.existsSync(soundDesignPath) ? resolveShortFormSoundDesign(id) : undefined;
  const doc = readShortFormSoundDesignDocument(id);
  return NextResponse.json({ success: true, data: { ...doc, resolution } });
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
  const action = body.action === "resolve" ? "resolve" : "generate";
  const notes = typeof body.notes === "string" ? body.notes.trim() : "";
  const content = typeof body.content === "string" ? body.content : undefined;
  const xmlScriptPath = getXmlScriptPath(id);
  const captionPlanPath = path.join(HOME_DIR, "tenxsolo", "business", "content", "deliverables", "short-form-videos", id, "output", "xml-script-work", "captions", "caption-sections.json");

  if (!fs.existsSync(xmlScriptPath)) {
    return NextResponse.json({ success: false, error: "XML visuals plan is missing. Run Plan Visuals first." }, { status: 400 });
  }
  if (!fs.existsSync(captionPlanPath)) {
    return NextResponse.json({ success: false, error: "Caption timing is missing. Run XML Script first so sound design can use transcript/alignment context for timestamp planning." }, { status: 400 });
  }

  if (content !== undefined) {
    writeShortFormSoundDesignDocument(id, content);
    updateProjectMeta(id, { soundDesignDecision: undefined, soundDesignSkipReason: undefined, soundDesignApprovalWarning: undefined });
  }

  if (action === "resolve") {
    if (!fs.existsSync(getShortFormSoundDesignPath(id))) {
      return NextResponse.json({ success: false, error: "Plan Sound Design XML is missing. Generate the plan before resolving sound-design assets." }, { status: 400 });
    }
    const resolution = resolveShortFormSoundDesign(id);
    return NextResponse.json({
      success: true,
      data: {
        ...readShortFormSoundDesignDocument(id),
        resolution,
        message: "Sound-design events were re-resolved against the saved sound library.",
      },
    });
  }

  const runsDir = path.join(getShortFormSoundDesignWorkDir(id), "runs");
  ensureDir(runsDir);
  const runId = randomUUID();
  const requestedAt = new Date().toISOString();
  const jobPath = path.join(runsDir, `${runId}.job.json`);
  fs.writeFileSync(jobPath, JSON.stringify({
    runId,
    projectId: id,
    agentTarget: project.agentTargets.effective["sound-design"],
    prompt: buildShortFormSoundDesignPrompt(project.id, {
      topic: project.topic || project.title || "Untitled short-form video",
      selectedHook: project.selectedHookText || "No selected hook yet",
      revisionNotes: notes,
    }),
    soundDesignPath: getShortFormSoundDesignPath(id),
    requestedAt,
    minEffectCount: MIN_GENERATED_SOUND_DESIGN_EFFECTS,
    preferredModels: [DEFAULT_RELIABLE_MODEL, DEFAULT_RETRY_MODEL].filter(Boolean),
  }, null, 2), "utf-8");

  updateLatestStageRequest(id, "sound-design", {
    requestedAt,
    runId,
    action: project.soundDesign.exists ? "revise" : "generate",
    mode: project.soundDesign.exists ? "revise" : "generate",
    ...(notes ? { notes } : {}),
  });
  updateProjectMeta(id, { pendingSoundDesign: true, soundDesignApprovalWarning: undefined });

  try {
    launchSoundDesignWorker(id, jobPath);
  } catch (error) {
    updateProjectMeta(id, { pendingSoundDesign: false });
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : "Failed to start sound-design generation",
    }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    runId,
    data: {
      ...readShortFormSoundDesignDocument(id),
      runId,
      requestedAt,
      pending: true,
      message: notes ? "Sound-design regeneration started." : "Sound-design generation started.",
    },
  }, { status: 202 });
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

  const body = await request.json().catch(() => ({}));
  const content = typeof body.content === "string" ? body.content : undefined;
  const resolutionEvents = Array.isArray(body.resolutionEvents) ? body.resolutionEvents : undefined;

  if (content === undefined && resolutionEvents === undefined) {
    return NextResponse.json({ success: false, error: "content or resolutionEvents is required" }, { status: 400 });
  }

  if (content !== undefined) {
    writeShortFormSoundDesignDocument(id, content);
  }

  const resolution = resolveShortFormSoundDesign(id, resolutionEvents as never);
  updateProjectMeta(id, { soundDesignDecision: undefined, soundDesignSkipReason: undefined, soundDesignApprovalWarning: undefined });

  return NextResponse.json({
    success: true,
    data: {
      ...readShortFormSoundDesignDocument(id),
      resolution,
    },
  });
}
