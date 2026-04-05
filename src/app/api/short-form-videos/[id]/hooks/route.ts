import { NextRequest, NextResponse } from "next/server";
import { enqueueShortFormHookRun } from "@/lib/short-form-hook-runner";
import {
  getHooksPath,
  getProjectDir,
  getShortFormProject,
  readHooksDetailed,
  saveHooks,
  updatePendingStage,
  updateProjectMeta,
  updateLatestHookRequest,
  type HookGeneration,
} from "@/lib/short-form-videos";
import { getShortFormWorkflowPrompts, renderShortFormPrompt } from "@/lib/short-form-workflow-prompts";

export const dynamic = "force-dynamic";

const HOOK_SELECTION_SEPARATOR = "::";

function buildHookSelectionId(generationId: string, optionId: string) {
  return `${generationId}${HOOK_SELECTION_SEPARATOR}${optionId}`;
}

function parseHookSelectionId(selectionId?: string) {
  if (!selectionId || !selectionId.includes(HOOK_SELECTION_SEPARATOR)) {
    return null;
  }

  const separatorIndex = selectionId.indexOf(HOOK_SELECTION_SEPARATOR);
  const generationId = selectionId.slice(0, separatorIndex);
  const optionId = selectionId.slice(separatorIndex + HOOK_SELECTION_SEPARATOR.length);

  if (!generationId || !optionId) {
    return null;
  }

  return { generationId, optionId };
}

function buildHookTask(project: NonNullable<ReturnType<typeof getShortFormProject>>, action: "generate" | "more", description: string) {
  const prompts = getShortFormWorkflowPrompts();
  const template = action === "more" ? prompts.hooksMore : prompts.hooksGenerate;
  const priorHooks = project.hooks.generations.flatMap((generation) => generation.options.map((option) => option.text));
  const hooksPath = getHooksPath(project.id);
  const projectDir = getProjectDir(project.id);
  const payloadHint = `Save the result to ${hooksPath} as strict JSON with this shape:\n{\n  "generations": [\n    {\n      "id": "gen-001",\n      "createdAt": "ISO-8601",\n      "description": "optional context",\n      "options": [\n        { "id": "hook-001", "text": "...", "rationale": "..." }\n      ]\n    }\n  ]\n}\nValidation rules:\n- Output valid JSON only. No markdown fences, comments, prose, or trailing commas.\n- generations must be an array.\n- Every generation needs a non-empty id, valid createdAt timestamp, and a non-empty options array.\n- Every option needs non-empty id and text. rationale is optional but must be a string if included.\nIf the file already exists, read it first and append a new generation instead of overwriting earlier generations.`;

  return renderShortFormPrompt(template, {
    topic: project.topic,
    selectedHookLine: project.selectedHookText ? `Currently selected hook: ${project.selectedHookText}` : "",
    descriptionOrFallback: description || "None.",
    priorHooksBlock: priorHooks.length > 0
      ? `Previously generated hooks (avoid duplicates, but stay adjacent in tone if useful):\n- ${priorHooks.join("\n- ")}`
      : "",
    hooksPayloadHint: payloadHint,
    projectDir,
  });
}

function normalizeOptionalString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function findHookIndex(generations: HookGeneration[], hookSelectionId: string) {
  const parsed = parseHookSelectionId(hookSelectionId);
  if (!parsed) return null;

  const generationIndex = generations.findIndex((generation) => generation.id === parsed.generationId);
  if (generationIndex === -1) return null;

  const optionIndex = generations[generationIndex]?.options.findIndex((option) => option.id === parsed.optionId) ?? -1;
  if (optionIndex === -1) return null;

  return {
    generationIndex,
    optionIndex,
    generationId: parsed.generationId,
    optionId: parsed.optionId,
  };
}

function getFirstHookSelection(generations: HookGeneration[]) {
  for (const generation of generations) {
    const option = generation.options[0];
    if (option) {
      return {
        id: buildHookSelectionId(generation.id, option.id),
        text: option.text,
      };
    }
  }

  return null;
}

function buildManualGeneration(now: string, text: string, rationale?: string): HookGeneration {
  const stamp = Date.now();
  return {
    id: `manual-${stamp}`,
    createdAt: now,
    description: "Manual hook added in dashboard",
    options: [
      {
        id: `hook-${stamp}`,
        text,
        ...(rationale ? { rationale } : {}),
      },
    ],
  };
}

function blockManualHookMutation(project: NonNullable<ReturnType<typeof getShortFormProject>>) {
  if (project.hooks.pending) {
    return NextResponse.json(
      { success: false, error: "Wait for the current hook generation run to finish before manually changing hooks." },
      { status: 409 }
    );
  }

  if (project.hooks.validationError) {
    return NextResponse.json(
      { success: false, error: `hooks.json is malformed: ${project.hooks.validationError}` },
      { status: 409 }
    );
  }

  return null;
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
  const action = typeof body.action === "string" ? body.action : "generate";

  if (action === "select") {
    const hookId = typeof body.hookId === "string" ? body.hookId : "";
    if (!hookId) {
      return NextResponse.json({ success: false, error: "hookId is required" }, { status: 400 });
    }

    const selectedHook = project.hooks.generations
      .flatMap((generation) => generation.options)
      .find((option) => option.id === hookId);

    if (!selectedHook) {
      return NextResponse.json({ success: false, error: "Selected hook no longer exists" }, { status: 400 });
    }

    const updated = updateProjectMeta(id, {
      selectedHookId: selectedHook.id,
      selectedHookText: selectedHook.text,
    });

    return NextResponse.json({ success: true, data: updated });
  }

  if (!project.topic.trim()) {
    return NextResponse.json({ success: false, error: "Add a topic first" }, { status: 400 });
  }

  const description = typeof body.description === "string" ? body.description.trim() : "";
  const task = buildHookTask(project, action === "more" ? "more" : "generate", description);

  const requestedAt = new Date().toISOString();
  updatePendingStage(id, "hooks", true);

  try {
    const run = enqueueShortFormHookRun({
      projectId: id,
      label: `short-form-hooks-${id}`,
      sessionKeyBase: `hook:short-form:${id}:hooks`,
      task,
      requestedAt,
      requiredArtifacts: [getHooksPath(id)],
    });

    updateLatestHookRequest(id, {
      requestedAt,
      runId: run.runId,
      action: action === "more" ? "more" : "generate",
      ...(description ? { description } : {}),
    });

    return NextResponse.json({
      success: true,
      message: "Hook generation queued",
      runId: run.runId,
    });
  } catch (error) {
    updatePendingStage(id, "hooks", false);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Failed to queue hooks" },
      { status: 500 }
    );
  }
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

  const blocked = blockManualHookMutation(project);
  if (blocked) return blocked;

  const body = await request.json().catch(() => ({}));
  const action = typeof body.action === "string" ? body.action : "";
  const text = normalizeOptionalString(body.text);
  const rationale = normalizeOptionalString(body.rationale);

  if (action !== "add" && action !== "edit") {
    return NextResponse.json({ success: false, error: "Unsupported hook mutation" }, { status: 400 });
  }

  if (!text) {
    return NextResponse.json({ success: false, error: "Hook text is required" }, { status: 400 });
  }

  const hooksResult = readHooksDetailed(id);
  if (hooksResult.error) {
    return NextResponse.json({ success: false, error: hooksResult.error }, { status: 409 });
  }

  const generations = hooksResult.data.map((generation) => ({
    ...generation,
    options: generation.options.map((option) => ({ ...option })),
  }));

  if (action === "add") {
    const now = new Date().toISOString();
    const generation = buildManualGeneration(now, text, rationale);
    const option = generation.options[0]!;
    generations.push(generation);
    saveHooks(id, generations);

    const selected = project.hooks.selectedHookId
      ? {
          selectedHookId: project.hooks.selectedHookId,
          selectedHookText: project.hooks.selectedHookText,
        }
      : {
          selectedHookId: buildHookSelectionId(generation.id, option.id),
          selectedHookText: option.text,
        };

    updateProjectMeta(id, selected);
    return NextResponse.json({ success: true, data: getShortFormProject(id) });
  }

  const hookId = typeof body.hookId === "string" ? body.hookId : "";
  if (!hookId) {
    return NextResponse.json({ success: false, error: "hookId is required" }, { status: 400 });
  }

  const match = findHookIndex(generations, hookId);
  if (!match) {
    return NextResponse.json({ success: false, error: "Hook no longer exists" }, { status: 404 });
  }

  const option = generations[match.generationIndex]!.options[match.optionIndex]!;
  generations[match.generationIndex]!.options[match.optionIndex] = {
    ...option,
    text,
    ...(rationale ? { rationale } : {}),
  };

  saveHooks(id, generations);

  if (project.hooks.selectedHookId === hookId) {
    updateProjectMeta(id, {
      selectedHookId: hookId,
      selectedHookText: text,
    });
  }

  return NextResponse.json({ success: true, data: getShortFormProject(id) });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const project = getShortFormProject(id);

  if (!project) {
    return NextResponse.json({ success: false, error: "Project not found" }, { status: 404 });
  }

  const blocked = blockManualHookMutation(project);
  if (blocked) return blocked;

  const body = await request.json().catch(() => ({}));
  const hookId = typeof body.hookId === "string" ? body.hookId : "";

  if (!hookId) {
    return NextResponse.json({ success: false, error: "hookId is required" }, { status: 400 });
  }

  const hooksResult = readHooksDetailed(id);
  if (hooksResult.error) {
    return NextResponse.json({ success: false, error: hooksResult.error }, { status: 409 });
  }

  const generations = hooksResult.data.map((generation) => ({
    ...generation,
    options: generation.options.map((option) => ({ ...option })),
  }));

  const match = findHookIndex(generations, hookId);
  if (!match) {
    return NextResponse.json({ success: false, error: "Hook no longer exists" }, { status: 404 });
  }

  generations[match.generationIndex]!.options.splice(match.optionIndex, 1);
  if (generations[match.generationIndex]!.options.length === 0) {
    generations.splice(match.generationIndex, 1);
  }

  saveHooks(id, generations);

  if (project.hooks.selectedHookId === hookId) {
    const fallbackSelection = getFirstHookSelection(generations);
    updateProjectMeta(id, {
      selectedHookId: fallbackSelection?.id,
      selectedHookText: fallbackSelection?.text,
    });
  }

  return NextResponse.json({ success: true, data: getShortFormProject(id) });
}
