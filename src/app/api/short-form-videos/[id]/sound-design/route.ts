import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { randomUUID } from "crypto";
import { spawnSync } from "child_process";
import { getShortFormProject, updateProjectMeta } from "@/lib/short-form-videos";
import {
  buildDefaultShortFormSoundDesignDocument,
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
const DEFAULT_RELIABLE_MODEL = process.env.SHORT_FORM_RELIABLE_MODEL || "codex/gpt-5.4";
const DEFAULT_RETRY_MODEL = process.env.SHORT_FORM_RETRY_MODEL || "openrouter/anthropic/claude-3-haiku";

function ensureDir(dirPath: string) {
  fs.mkdirSync(dirPath, { recursive: true });
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

  if (!fs.existsSync(getShortFormSoundDesignPath(id))) {
    buildDefaultShortFormSoundDesignDocument(id);
  }

  const resolution = resolveShortFormSoundDesign(id);
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
    return NextResponse.json({ success: false, error: "Caption timing is missing. Run XML Script first so sound design can anchor to captions." }, { status: 400 });
  }

  if (!fs.existsSync(getShortFormSoundDesignPath(id))) {
    buildDefaultShortFormSoundDesignDocument(id);
  }

  if (content !== undefined) {
    writeShortFormSoundDesignDocument(id, content);
    updateProjectMeta(id, { soundDesignDecision: undefined, soundDesignSkipReason: undefined });
  }

  if (action === "resolve") {
    const resolution = resolveShortFormSoundDesign(id);
    updateProjectMeta(id, { soundDesignDecision: undefined, soundDesignSkipReason: undefined });
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
    prompt: buildShortFormSoundDesignPrompt(project.id, {
      topic: project.topic || project.title || "Untitled short-form video",
      selectedHook: project.selectedHookText || "No selected hook yet",
      revisionNotes: notes,
    }),
    soundDesignPath: getShortFormSoundDesignPath(id),
    requestedAt,
    preferredModels: [DEFAULT_RELIABLE_MODEL, DEFAULT_RETRY_MODEL].filter(Boolean),
  }, null, 2), "utf-8");

  updateProjectMeta(id, { pendingSoundDesign: true });

  const result = spawnSync(process.execPath, [WORKER_PATH, jobPath], {
    cwd: REPO_ROOT,
    encoding: "utf-8",
    maxBuffer: 20 * 1024 * 1024,
  });

  updateProjectMeta(id, { pendingSoundDesign: false });

  if (result.status !== 0) {
    return NextResponse.json({
      success: false,
      error: result.stderr?.trim() || result.stdout?.trim() || "Sound-design generation failed",
    }, { status: 500 });
  }

  const resolution = resolveShortFormSoundDesign(id);
  updateProjectMeta(id, { soundDesignDecision: undefined, soundDesignSkipReason: undefined });
  return NextResponse.json({
    success: true,
    data: {
      ...readShortFormSoundDesignDocument(id),
      resolution,
      runId,
      requestedAt,
      message: notes ? "Sound-design regeneration finished." : "Sound-design generation finished.",
    },
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
  updateProjectMeta(id, { soundDesignDecision: undefined, soundDesignSkipReason: undefined });

  return NextResponse.json({
    success: true,
    data: {
      ...readShortFormSoundDesignDocument(id),
      resolution,
    },
  });
}
