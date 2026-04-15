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
  updateXmlScriptFrontMatterStatus,
  writeXmlScriptDocument,
} from "@/lib/short-form-xml-script";
import { updateProjectMeta } from "@/lib/short-form-videos";
import { getShortFormVideoRenderSettings, resolveShortFormVoiceSelection } from "@/lib/short-form-video-render-settings";

export const dynamic = "force-dynamic";

const HOME_DIR = process.env.HOME || "/Users/ittaisvidler";
const REPO_ROOT = path.join(HOME_DIR, "tenxsolo", "systems", "agent-dashboard");
const WORKER_PATH = path.join(REPO_ROOT, "scripts", "xml-script-worker.mjs");
const DEFAULT_RELIABLE_MODEL = process.env.SHORT_FORM_RELIABLE_MODEL || "codex/gpt-5.4";
const DEFAULT_RETRY_MODEL = process.env.SHORT_FORM_RETRY_MODEL || "openrouter/anthropic/claude-3-haiku";

type XmlWorkflowTask = "full" | "narration" | "captions" | "visuals";

function normalizeXmlWorkflowTask(value: unknown): XmlWorkflowTask {
  return value === "narration" || value === "captions" || value === "visuals" ? value : "full";
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

  return [
    "Write the XML script artifact for a short-form video workflow refactor.",
    "",
    "You must write the final XML to the exact path below, with YAML front matter followed by raw XML only:",
    xmlScriptPath,
    "",
    `Project topic: ${project.topic || "Untitled short-form video"}`,
    project.selectedHookText ? `Selected hook: ${project.selectedHookText}` : "",
    notes ? `Revision notes: ${notes}` : "",
    "",
    "Inputs you must read before writing:",
    `- Approved plain text script: ${textScriptPath}`,
    `- Exact narration transcript used for TTS/alignment: ${transcriptPath}`,
    `- Forced-alignment JSON: ${alignmentPath}`,
    `- Deterministic caption JSON (for timing/context only; do NOT copy it into XML): ${captionPlanPath}`,
    "",
    "Required XML schema:",
    `<video version=\"2\">`,
    `  <topic>...</topic>`,
    `  <script>...</script>`,
    `  <assets>`,
    `    <image id=\"asset-id\">`,
    `      <prompt>Describe one reusable green-screen image asset.</prompt>`,
    `    </image>`,
    `    <image id=\"asset-id-2\" basedOn=\"asset-id\">`,
    `      <prompt>Describe a NEW image to generate using the prior asset as a reference.</prompt>`,
    `    </image>`,
    `  </assets>`,
    `  <timeline>`,
    `    <visual id=\"visual-1\" label=\"Hook setup\" start=\"0.00\" end=\"1.20\" imageId=\"asset-id\" cameraZoom=\"0.05\" />`,
    `    <visual id=\"visual-2\" label=\"Reveal\" start=\"1.20\" end=\"2.40\" imageId=\"asset-id\" cameraZoomStart=\"0.02\" cameraZoomEnd=\"0.08\" />`,
    `  </timeline>`,

    `</video>`,
    "",
    "Semantics:",
    "- <script> must match the approved plain text narration.",
    "- Captions do NOT belong in the XML anymore. Do not emit <caption> nodes anywhere.",
    "- The caption JSON is a separate deterministic artifact used by the final renderer and review timeline.",
    "- <timeline><visual> entries should only describe visuals: label, start/end timing, imageId, and optional camera motion.",
    "- <assets>/<image id> defines reusable underlying image assets.",
    "- Reusing the exact same image asset = multiple <visual> entries with the same imageId.",
    "- Generating a NEW image from a previous image reference = define a new <image id=... basedOn=...> asset.",
    "- Visuals must be green-screen foreground plates for downstream compositing.",
    "- Ensure there is an actual visual or camera change at least every 3 seconds across the timeline.",
    "- Camera motion/framing belongs on <visual> attributes, not on <image> assets.",
    "- `cameraZoom` means a static zoom/framing value only.",
    "- Use `cameraZoomStart` + `cameraZoomEnd` when you want an explicit animated zoom.",
    "- Keep camera motion sparse and subtle by default.",
    "",
    "Practical authoring rules:",
    "- Give each <visual> a concise label attribute so the dashboard can identify the beat on the visual timeline.",
    "- Prefer fewer reusable assets than one fresh asset per caption when continuity makes sense.",
    "- Distinguish exact asset reuse from reference-derived new assets clearly through image ids and basedOn.",
    "- Prompts should describe the green-screen foreground plate only, not a scenic background.",
    "- No baked-in text in generated images.",
    "",
    "Output contract:",
    "- Write directly to the xml-script.md path above.",
    "- Include YAML front matter with status: needs review, agent: workflow, and suitable title/tags.",
    "- After writing, read the file back and verify it exists on disk.",
    "",
    `Project directory: ${projectDir}`,
  ].filter(Boolean).join("\n");
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
  return NextResponse.json({ success: true, data: getXmlScriptDocument(id, { expectedVoiceId: project.selectedVoiceId }) });
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
  const currentDoc = getXmlScriptDocument(id, { expectedVoiceId: project.selectedVoiceId });
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
      mode: selectedVoice.voice.mode,
      voiceDesignPrompt: selectedVoice.voice.voiceDesignPrompt,
      ...(selectedVoice.voice.speaker ? { speaker: selectedVoice.voice.speaker } : {}),
      ...(selectedVoice.voice.legacyInstruct ? { legacyInstruct: selectedVoice.voice.legacyInstruct } : {}),
      source: selectedVoice.source,
      resolvedVoiceId: selectedVoice.resolvedVoiceId,
    },
    preferredModels: [DEFAULT_RELIABLE_MODEL, DEFAULT_RETRY_MODEL].filter(Boolean),
    captionMaxWords,
    requestedAt,
  }, null, 2), "utf-8");
  writeJson(statusPath, { status: "running", runId, projectId: id, task, startedAt: requestedAt, attempts: [] });

  if (task === "full" || task === "visuals") {
    updateXmlScriptFrontMatterStatus(id, "needs review");
  }
  updateProjectMeta(id, {});

  const child = spawn(process.execPath, [WORKER_PATH, jobPath], {
    cwd: REPO_ROOT,
    detached: true,
    stdio: "ignore",
  });
  child.unref();

  const taskLabel = task === "narration"
    ? "Narration Audio"
    : task === "captions"
      ? "Plan Captions"
      : task === "visuals"
        ? "Plan Visuals"
        : "XML workflow";

  return NextResponse.json({ success: true, runId, message: `${taskLabel} started`, data: getXmlScriptDocument(id, { expectedVoiceId: project.selectedVoiceId }) });
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
  const status = typeof body.status === "string" ? body.status : undefined;

  if (content !== undefined) {
    writeXmlScriptDocument(id, content);
  }
  if (status) {
    updateXmlScriptFrontMatterStatus(id, status);
  }

  return NextResponse.json({ success: true, data: getXmlScriptDocument(id, { expectedVoiceId: project.selectedVoiceId }) });
}
