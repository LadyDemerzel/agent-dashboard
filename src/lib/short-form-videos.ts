import fs from "fs";
import path from "path";
import { parseFrontMatter, generateFrontMatter, extractBody } from "@/lib/frontmatter";
import { readStatusLog } from "@/lib/status";
import { readFeedback, type FeedbackThread } from "@/lib/feedback";
import { resolveShortFormImageStyle } from "@/lib/short-form-image-styles";
import { resolveShortFormVoiceSelection } from "@/lib/short-form-video-render-settings";

export type ShortFormStageKey = "research" | "script" | "scene-images" | "video";
export type PendingStageKey = "hooks" | ShortFormStageKey;

export interface HookOption {
  id: string;
  text: string;
  rationale?: string;
}

export interface HookGeneration {
  id: string;
  createdAt: string;
  description?: string;
  options: HookOption[];
}

const HOOK_SELECTION_SEPARATOR = "::";

function buildHookSelectionId(generationId: string, optionId: string) {
  return `${generationId}${HOOK_SELECTION_SEPARATOR}${optionId}`;
}

function splitHookSelectionId(selectionId?: string) {
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

function canonicalizeHookGenerations(generations: HookGeneration[]): HookGeneration[] {
  return generations.map((generation) => ({
    ...generation,
    options: generation.options.map((option) => ({
      ...option,
      id: buildHookSelectionId(generation.id, option.id),
    })),
  }));
}

function resolveSelectedHook(
  generations: HookGeneration[],
  selectedHookId?: string,
  selectedHookText?: string
): { id: string; text: string } | null {
  const parsedSelectionId = splitHookSelectionId(selectedHookId);

  if (parsedSelectionId) {
    const generation = generations.find((item) => item.id === parsedSelectionId.generationId);
    const option = generation?.options.find((item) => item.id === parsedSelectionId.optionId);
    if (generation && option) {
      return {
        id: buildHookSelectionId(generation.id, option.id),
        text: option.text,
      };
    }
  }

  if (selectedHookText) {
    for (const generation of generations) {
      const option = generation.options.find((item) => item.text === selectedHookText);
      if (option) {
        return {
          id: buildHookSelectionId(generation.id, option.id),
          text: option.text,
        };
      }
    }
  }

  if (selectedHookId) {
    for (const generation of generations) {
      const option = generation.options.find((item) => item.id === selectedHookId);
      if (option) {
        return {
          id: buildHookSelectionId(generation.id, option.id),
          text: option.text,
        };
      }
    }
  }

  return null;
}

export interface SceneImageArtifact {
  id: string;
  number: number;
  caption: string;
  image?: string;
  previewImage?: string;
  notes?: string;
  status?: "completed" | "in-progress";
}

export interface SceneImageProgressSummary {
  total: number;
  completed: number;
  pending: number;
  scope: "all" | "single";
  targetSceneId?: string;
}

interface GeneratedSceneImageArtifact extends SceneImageArtifact {
  duration?: string;
}

export interface StageRequestContext {
  requestedAt: string;
  runId?: string;
  action: "generate" | "revise" | "request-scene-change";
  mode: "generate" | "revise";
  notes?: string;
  sceneId?: string;
}

export interface HookRequestContext {
  requestedAt: string;
  runId?: string;
  action: "generate" | "more";
  description?: string;
}

export interface ShortFormProjectMeta {
  id: string;
  topic: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  selectedHookId?: string;
  selectedHookText?: string;
  pendingHooks?: boolean;
  pendingResearch?: boolean;
  pendingScript?: boolean;
  pendingSceneImages?: boolean;
  pendingVideo?: boolean;
  selectedImageStyleId?: string;
  selectedVoiceId?: string;
  latestHookRequest?: HookRequestContext;
  latestStageRequests?: Partial<Record<ShortFormStageKey, StageRequestContext>>;
}

export interface StageAgentRunSummary {
  runId?: string;
  source?: "workflow-run" | "agent-session";
  status?: "running" | "verified" | "failed";
  sessionId?: string;
  startedAt?: string;
  failedAt?: string;
  completedAt?: string;
  lastEventAt?: string;
  errorMessage?: string;
  completionReason?: string;
}

export interface StageRevisionState {
  requestedAt?: string;
  requestText?: string;
  threadId?: string;
  sceneId?: string;
  mode?: "generate" | "revise";
  action?: "generate" | "revise" | "request-scene-change";
  isPending: boolean;
  isFailed: boolean;
  isStale: boolean;
  warning?: string;
  agentRun?: StageAgentRunSummary;
}

export interface StageDocumentSummary {
  exists: boolean;
  status: string;
  content: string;
  updatedAt?: string;
  openThreads: number;
  pending?: boolean;
  validationError?: string;
  revision?: StageRevisionState;
}

export interface VideoPipelineDetail {
  id: string;
  label: string;
  format: "text" | "json";
  content: string;
}

export interface VideoPipelineStep {
  id: string;
  label: string;
  status: "completed" | "active" | "pending" | "failed";
  summary?: string;
  updatedAt?: string;
  details?: VideoPipelineDetail[];
}

export interface VideoPipelineSummary {
  status: "running" | "completed" | "failed" | "idle";
  workDir?: string;
  manifestPath?: string;
  transcriptPath?: string;
  alignmentInputPath?: string;
  alignmentOutputPath?: string;
  warning?: string;
  steps: VideoPipelineStep[];
}

export interface ShortFormProject {
  id: string;
  topic: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  selectedHookId?: string;
  selectedHookText?: string;
  selectedImageStyleId?: string;
  selectedImageStyleName?: string;
  selectedVoiceId?: string;
  selectedVoiceName?: string;
  currentStage: string;
  pendingStages: PendingStageKey[];
  hooks: {
    pending: boolean;
    generations: HookGeneration[];
    selectedHookId?: string;
    selectedHookText?: string;
    validationError?: string;
  };
  research: StageDocumentSummary;
  script: StageDocumentSummary;
  sceneImages: StageDocumentSummary & {
    scenes: SceneImageArtifact[];
    sceneProgress?: SceneImageProgressSummary;
  };
  video: StageDocumentSummary & {
    videoUrl?: string;
    videoPath?: string;
    pipeline?: VideoPipelineSummary;
  };
}

export interface ShortFormProjectRow {
  id: string;
  topic: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  currentStage: string;
  hooks: {
    selectedHookText?: string;
  };
  research: {
    status: string;
  };
  script: {
    status: string;
  };
  sceneImages: {
    status: string;
    sceneCount: number;
  };
  video: {
    status: string;
    videoUrl?: string;
  };
}

interface JsonReadResult<T> {
  data: T;
  error?: string;
}

const HOME_DIR = process.env.HOME || "/Users/ittaisvidler";
export const SHORT_FORM_VIDEOS_DIR = path.join(
  HOME_DIR,
  "tenxsolo",
  "business",
  "content",
  "deliverables",
  "short-form-videos"
);

const STAGE_PLACEHOLDER_BODIES: Record<ShortFormStageKey, string> = {
  research: "# Research\n\nWaiting for Oracle to generate research.",
  script: "<video>\n  <topic>Waiting for topic</topic>\n  <script><!-- Waiting for Scribe to generate the full spoken script --></script>\n  <scene>\n    <text>Waiting for captions</text>\n    <image>Waiting for scene direction</image>\n  </scene>\n</video>",
  "scene-images": "# Scene Images\n\nWaiting for the dashboard workflow to generate the storyboard images and manifest.",
  video: "# Final Video\n\nWaiting for the dashboard workflow to generate the final rendered video.",
};

const OPENCLAW_DIR = path.join(HOME_DIR, ".openclaw");
const AGENT_FOR_STAGE: Record<ShortFormStageKey, "oracle" | "scribe"> = {
  research: "oracle",
  script: "scribe",
  "scene-images": "scribe",
  video: "scribe",
};

function getWorkflowRunDir(projectId: string) {
  return path.join(getProjectDir(projectId), ".workflow-runs");
}

function getStageRunInactivityFailureMs(stage: ShortFormStageKey) {
  switch (stage) {
    case "research":
    case "script":
      return 10 * 60_000;
    case "scene-images":
      return 45 * 60_000;
    case "video":
      return 60 * 60_000;
  }
}

function ensureDir(dirPath: string) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

export function ensureShortFormRoot() {
  ensureDir(SHORT_FORM_VIDEOS_DIR);
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}

function createId(topic?: string) {
  const now = new Date();
  const stamp = now
    .toISOString()
    .replace(/[-:TZ.]/g, "")
    .slice(0, 14);
  const slug = topic ? slugify(topic) : "project";
  return `${slug || "project"}-${stamp}`;
}

export function getProjectDir(projectId: string) {
  return path.join(SHORT_FORM_VIDEOS_DIR, projectId);
}

export function getProjectMetaPath(projectId: string) {
  return path.join(getProjectDir(projectId), "project.json");
}

export function getHooksPath(projectId: string) {
  return path.join(getProjectDir(projectId), "hooks.json");
}

export function getStageFilePath(projectId: string, stage: ShortFormStageKey) {
  const projectDir = getProjectDir(projectId);
  switch (stage) {
    case "research":
      return path.join(projectDir, "research.md");
    case "script":
      return path.join(projectDir, "script.md");
    case "scene-images":
      return path.join(projectDir, "scene-images.md");
    case "video":
      return path.join(projectDir, "video.md");
  }
}

export function getSceneManifestPath(projectId: string) {
  return path.join(getProjectDir(projectId), "scene-images.json");
}

function getSceneGeneratorManifestPath(projectId: string) {
  return path.join(getProjectDir(projectId), "scenes", "manifest.json");
}

export function getVideoArtifactPath(projectId: string) {
  const projectDir = getProjectDir(projectId);
  const candidates = [
    "final-video.mp4",
    "video.mp4",
    path.join("output", "final-video.mp4"),
    path.join("output", "video.mp4"),
  ];

  for (const candidate of candidates) {
    const full = path.join(projectDir, candidate);
    if (fs.existsSync(full)) return full;
  }

  return undefined;
}

function readJsonFile<T>(filePath: string, fallback: T): T {
  if (!fs.existsSync(filePath)) return fallback;
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf-8")) as T;
  } catch {
    return fallback;
  }
}

function readJsonFileDetailed<T>(filePath: string, fallback: T): JsonReadResult<T> {
  if (!fs.existsSync(filePath)) return { data: fallback };

  try {
    return {
      data: JSON.parse(fs.readFileSync(filePath, "utf-8")) as T,
    };
  } catch (error) {
    return {
      data: fallback,
      error: error instanceof Error ? error.message : "Invalid JSON",
    };
  }
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isOptionalString(value: unknown): value is string | undefined {
  return value === undefined || typeof value === "string";
}

function isIsoDateString(value: string) {
  return !Number.isNaN(Date.parse(value));
}

function validateRelativeMediaPath(value: unknown, fieldPath: string) {
  if (value === undefined) return undefined;
  if (!isNonEmptyString(value)) {
    return `${fieldPath} must be a non-empty string when provided.`;
  }

  if (path.isAbsolute(value)) {
    return `${fieldPath} must be a project-relative path, not an absolute path.`;
  }

  if (value.includes("..")) {
    return `${fieldPath} must stay inside the project directory.`;
  }

  return undefined;
}

function validateHooksPayload(payload: unknown): JsonReadResult<HookGeneration[]> {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return {
      data: [],
      error: 'hooks.json must be an object with a top-level "generations" array.',
    };
  }

  const generations = (payload as { generations?: unknown }).generations;
  if (!Array.isArray(generations)) {
    return {
      data: [],
      error: 'hooks.json must include a top-level "generations" array.',
    };
  }

  const normalized: HookGeneration[] = [];

  for (let generationIndex = 0; generationIndex < generations.length; generationIndex += 1) {
    const generation = generations[generationIndex];
    const prefix = `hooks.json generations[${generationIndex}]`;

    if (!generation || typeof generation !== "object" || Array.isArray(generation)) {
      return { data: [], error: `${prefix} must be an object.` };
    }

    const id = (generation as { id?: unknown }).id;
    const createdAt = (generation as { createdAt?: unknown }).createdAt;
    const description = (generation as { description?: unknown }).description;
    const options = (generation as { options?: unknown }).options;

    if (!isNonEmptyString(id)) {
      return { data: [], error: `${prefix}.id must be a non-empty string.` };
    }

    if (!isNonEmptyString(createdAt) || !isIsoDateString(createdAt)) {
      return { data: [], error: `${prefix}.createdAt must be a valid ISO-8601 timestamp.` };
    }

    if (!isOptionalString(description)) {
      return { data: [], error: `${prefix}.description must be a string when provided.` };
    }

    if (!Array.isArray(options) || options.length === 0) {
      return { data: [], error: `${prefix}.options must be a non-empty array.` };
    }

    const normalizedOptions: HookOption[] = [];

    for (let optionIndex = 0; optionIndex < options.length; optionIndex += 1) {
      const option = options[optionIndex];
      const optionPrefix = `${prefix}.options[${optionIndex}]`;

      if (!option || typeof option !== "object" || Array.isArray(option)) {
        return { data: [], error: `${optionPrefix} must be an object.` };
      }

      const optionId = (option as { id?: unknown }).id;
      const text = (option as { text?: unknown }).text;
      const rationale = (option as { rationale?: unknown }).rationale;

      if (!isNonEmptyString(optionId)) {
        return { data: [], error: `${optionPrefix}.id must be a non-empty string.` };
      }

      if (!isNonEmptyString(text)) {
        return { data: [], error: `${optionPrefix}.text must be a non-empty string.` };
      }

      if (!isOptionalString(rationale)) {
        return { data: [], error: `${optionPrefix}.rationale must be a string when provided.` };
      }

      normalizedOptions.push({
        id: optionId,
        text: text.trim(),
        ...(typeof rationale === "string" && rationale.trim() ? { rationale: rationale.trim() } : {}),
      });
    }

    normalized.push({
      id,
      createdAt,
      ...(typeof description === "string" && description.trim() ? { description: description.trim() } : {}),
      options: normalizedOptions,
    });
  }

  return { data: normalized };
}

function validateSceneManifestPayload(payload: unknown): JsonReadResult<SceneImageArtifact[]> {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return {
      data: [],
      error: 'scene-images.json must be an object with a top-level "scenes" array.',
    };
  }

  const scenes = (payload as { scenes?: unknown }).scenes;
  if (!Array.isArray(scenes)) {
    return {
      data: [],
      error: 'scene-images.json must include a top-level "scenes" array.',
    };
  }

  const normalized: SceneImageArtifact[] = [];
  const numbers = new Set<number>();

  for (let sceneIndex = 0; sceneIndex < scenes.length; sceneIndex += 1) {
    const scene = scenes[sceneIndex];
    const prefix = `scene-images.json scenes[${sceneIndex}]`;

    if (!scene || typeof scene !== "object" || Array.isArray(scene)) {
      return { data: [], error: `${prefix} must be an object.` };
    }

    const id = (scene as { id?: unknown }).id;
    const number = (scene as { number?: unknown }).number;
    const caption = (scene as { caption?: unknown }).caption;
    const image = (scene as { image?: unknown }).image;
    const previewImage = (scene as { previewImage?: unknown }).previewImage;
    const notes = (scene as { notes?: unknown }).notes;

    if (!isNonEmptyString(id)) {
      return { data: [], error: `${prefix}.id must be a non-empty string.` };
    }

    if (!Number.isInteger(number) || Number(number) < 1) {
      return { data: [], error: `${prefix}.number must be a positive integer.` };
    }

    if (numbers.has(Number(number))) {
      return { data: [], error: `${prefix}.number must be unique. Duplicate scene number ${number} found.` };
    }
    numbers.add(Number(number));

    if (!isNonEmptyString(caption)) {
      return { data: [], error: `${prefix}.caption must be a non-empty string.` };
    }

    const imageError = validateRelativeMediaPath(image, `${prefix}.image`);
    if (imageError) return { data: [], error: imageError };

    const previewImageError = validateRelativeMediaPath(previewImage, `${prefix}.previewImage`);
    if (previewImageError) return { data: [], error: previewImageError };

    if (!image && !previewImage) {
      return {
        data: [],
        error: `${prefix} must include at least one of image or previewImage so the storyboard can be reviewed.`,
      };
    }

    if (!isOptionalString(notes)) {
      return { data: [], error: `${prefix}.notes must be a string when provided.` };
    }

    normalized.push({
      id,
      number: Number(number),
      caption: caption.trim(),
      ...(typeof image === "string" && image.trim() ? { image: image.trim() } : {}),
      ...(typeof previewImage === "string" && previewImage.trim() ? { previewImage: previewImage.trim() } : {}),
      ...(typeof notes === "string" && notes.trim() ? { notes: notes.trim() } : {}),
    });
  }

  return { data: normalized };
}

export function readProjectMeta(projectId: string): ShortFormProjectMeta | null {
  return readJsonFile<ShortFormProjectMeta | null>(getProjectMetaPath(projectId), null);
}

export function saveProjectMeta(projectId: string, data: ShortFormProjectMeta) {
  ensureDir(getProjectDir(projectId));
  fs.writeFileSync(getProjectMetaPath(projectId), JSON.stringify(data, null, 2), "utf-8");
}

export function createShortFormProject(topic = "") {
  ensureShortFormRoot();
  const id = createId(topic);
  const projectDir = getProjectDir(id);
  ensureDir(projectDir);
  ensureDir(path.join(projectDir, "scenes"));
  ensureDir(path.join(projectDir, "output"));

  const now = new Date().toISOString();
  const { resolvedStyleId } = resolveShortFormImageStyle();
  const meta: ShortFormProjectMeta = {
    id,
    topic,
    title: topic || "Untitled short-form video",
    createdAt: now,
    updatedAt: now,
    selectedImageStyleId: resolvedStyleId,
  };

  saveProjectMeta(id, meta);
  return meta;
}

export function updateProjectMeta(projectId: string, updates: Partial<ShortFormProjectMeta>) {
  const existing = readProjectMeta(projectId);
  if (!existing) return null;

  const next: ShortFormProjectMeta = {
    ...existing,
    ...updates,
    latestStageRequests: {
      ...existing.latestStageRequests,
      ...updates.latestStageRequests,
    },
    updatedAt: new Date().toISOString(),
  };

  saveProjectMeta(projectId, next);
  return next;
}

export function getLatestHookRequest(projectId: string) {
  return readProjectMeta(projectId)?.latestHookRequest;
}

export function updateLatestHookRequest(projectId: string, request: HookRequestContext) {
  return updateProjectMeta(projectId, { latestHookRequest: request });
}

export function getLatestStageRequest(projectId: string, stage: ShortFormStageKey) {
  return readProjectMeta(projectId)?.latestStageRequests?.[stage];
}

export function updateLatestStageRequest(projectId: string, stage: ShortFormStageKey, request: StageRequestContext) {
  const existing = readProjectMeta(projectId);
  if (!existing) return null;

  return updateProjectMeta(projectId, {
    latestStageRequests: {
      ...existing.latestStageRequests,
      [stage]: request,
    },
  });
}

function readHooksResult(projectId: string): JsonReadResult<HookGeneration[]> {
  const json = readJsonFileDetailed<{ generations?: unknown }>(getHooksPath(projectId), { generations: [] });
  if (json.error) {
    return {
      data: [],
      error: `hooks.json could not be parsed: ${json.error}`,
    };
  }

  return validateHooksPayload(json.data);
}

export function readHooksDetailed(projectId: string): JsonReadResult<HookGeneration[]> {
  return readHooksResult(projectId);
}

export function readHooks(projectId: string): HookGeneration[] {
  return readHooksResult(projectId).data;
}

export function saveHooks(projectId: string, generations: HookGeneration[]) {
  ensureDir(getProjectDir(projectId));
  fs.writeFileSync(getHooksPath(projectId), JSON.stringify({ generations }, null, 2), "utf-8");
  updateProjectMeta(projectId, {});
  return generations;
}

function toRelativeProjectMediaPath(projectId: string, value: unknown) {
  if (typeof value !== "string" || !value.trim()) return undefined;

  const trimmed = value.trim();
  const projectDir = getProjectDir(projectId);

  if (path.isAbsolute(trimmed)) {
    const relative = path.relative(projectDir, trimmed);
    if (!relative.startsWith("..") && !path.isAbsolute(relative)) {
      return relative.split(path.sep).join("/");
    }
    return undefined;
  }

  return trimmed.split(path.sep).join("/");
}

function readPrimarySceneManifestResult(projectId: string): JsonReadResult<SceneImageArtifact[]> {
  const json = readJsonFileDetailed<{ scenes?: unknown }>(getSceneManifestPath(projectId), { scenes: [] });
  if (json.error) {
    return {
      data: [],
      error: `scene-images.json could not be parsed: ${json.error}`,
    };
  }

  return validateSceneManifestPayload(json.data);
}

function readGeneratedSceneManifestResult(projectId: string): JsonReadResult<GeneratedSceneImageArtifact[]> {
  const filePath = getSceneGeneratorManifestPath(projectId);
  const json = readJsonFileDetailed<{ scenes?: unknown }>(filePath, { scenes: [] });
  if (json.error) {
    return {
      data: [],
      error: `scenes/manifest.json could not be parsed: ${json.error}`,
    };
  }

  const payload = json.data;
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return {
      data: [],
      error: 'scenes/manifest.json must be an object with a top-level "scenes" array.',
    };
  }

  const scenes = (payload as { scenes?: unknown }).scenes;
  if (!Array.isArray(scenes)) {
    return {
      data: [],
      error: 'scenes/manifest.json must include a top-level "scenes" array.',
    };
  }

  const normalized: GeneratedSceneImageArtifact[] = [];
  const numbers = new Set<number>();

  for (let sceneIndex = 0; sceneIndex < scenes.length; sceneIndex += 1) {
    const scene = scenes[sceneIndex];
    const prefix = `scenes/manifest.json scenes[${sceneIndex}]`;

    if (!scene || typeof scene !== "object" || Array.isArray(scene)) {
      return { data: [], error: `${prefix} must be an object.` };
    }

    const number = (scene as { index?: unknown }).index;
    const caption = (scene as { text?: unknown }).text;
    const image = toRelativeProjectMediaPath(projectId, (scene as { uncaptioned?: unknown }).uncaptioned)
      ?? toRelativeProjectMediaPath(projectId, (scene as { raw_legacy?: unknown }).raw_legacy);
    const previewImage = toRelativeProjectMediaPath(projectId, (scene as { captioned?: unknown }).captioned);
    const imagePrompt = (scene as { image_prompt?: unknown }).image_prompt;
    const duration = (scene as { duration?: unknown }).duration;

    if (!Number.isInteger(number) || Number(number) < 1) {
      return { data: [], error: `${prefix}.index must be a positive integer.` };
    }

    if (numbers.has(Number(number))) {
      return { data: [], error: `${prefix}.index must be unique. Duplicate scene index ${number} found.` };
    }
    numbers.add(Number(number));

    if (!isNonEmptyString(caption)) {
      return { data: [], error: `${prefix}.text must be a non-empty string.` };
    }

    if (!image && !previewImage) {
      return { data: [], error: `${prefix} must include at least one generated image path.` };
    }

    if (typeof duration !== "undefined" && !isOptionalString(duration)) {
      return { data: [], error: `${prefix}.duration must be a string when provided.` };
    }

    if (typeof imagePrompt !== "undefined" && !isOptionalString(imagePrompt)) {
      return { data: [], error: `${prefix}.image_prompt must be a string when provided.` };
    }

    normalized.push({
      id: `scene-${Number(number)}`,
      number: Number(number),
      caption: caption.trim(),
      ...(image ? { image } : {}),
      ...(previewImage ? { previewImage } : {}),
      ...(typeof imagePrompt === "string" && imagePrompt.trim() ? { notes: imagePrompt.trim() } : {}),
      ...(typeof duration === "string" && duration.trim() ? { duration: duration.trim() } : {}),
    });
  }

  return { data: normalized };
}

function getFileMtimeMs(filePath: string) {
  if (!fs.existsSync(filePath)) return 0;

  try {
    return fs.statSync(filePath).mtimeMs;
  } catch {
    return 0;
  }
}

function sceneMediaPathExists(projectId: string, relativePath?: string) {
  if (!relativePath) return false;

  try {
    return fs.existsSync(path.join(getProjectDir(projectId), relativePath));
  } catch {
    return false;
  }
}

function sceneManifestNeedsSync(projectId: string, primary: JsonReadResult<SceneImageArtifact[]>, generated: GeneratedSceneImageArtifact[]) {
  if (primary.error || primary.data.length !== generated.length) return true;

  for (let index = 0; index < generated.length; index += 1) {
    const next = generated[index];
    const current = primary.data[index];
    if (!current) return true;

    if (
      current.id !== next.id ||
      current.number !== next.number ||
      current.caption !== next.caption ||
      current.image !== next.image ||
      current.previewImage !== next.previewImage ||
      current.notes !== next.notes
    ) {
      return true;
    }

    if ((current.image && !sceneMediaPathExists(projectId, current.image)) || (current.previewImage && !sceneMediaPathExists(projectId, current.previewImage))) {
      return true;
    }
  }

  return false;
}

function sceneImagesDocNeedsSync(
  projectId: string,
  scenes: Array<{ number: number; caption: string; duration?: string }>,
  manifestWasSynced: boolean,
  generatedMtime: number,
  docPath: string
) {
  const latestRequest = getLatestStageRequest(projectId, "scene-images");
  const latestRequestMs = latestRequest?.requestedAt ? Date.parse(latestRequest.requestedAt) : Number.NaN;
  const generatedIsFreshForLatestRequest = Number.isFinite(latestRequestMs)
    ? generatedMtime > latestRequestMs + 1_000
    : true;

  if (!generatedIsFreshForLatestRequest) {
    return false;
  }

  if (manifestWasSynced || !fs.existsSync(docPath) || generatedMtime > getFileMtimeMs(docPath) + 1000) return true;

  const content = fs.readFileSync(docPath, "utf-8");
  const parsed = parseFrontMatter(content);
  const sceneCount = parsed?.frontMatter.scene_count;
  if (Number(sceneCount) !== scenes.length) return true;

  const body = extractBody(content);
  const firstCaption = scenes[0]?.caption;
  const lastCaption = scenes[scenes.length - 1]?.caption;
  if ((firstCaption && !body.includes(firstCaption)) || (lastCaption && !body.includes(lastCaption))) {
    return true;
  }

  return false;
}

function formatSceneImagesDuration(scenes: Array<{ duration?: string }>) {
  let total = 0;

  for (const scene of scenes) {
    if (!scene.duration) return undefined;
    const match = scene.duration.match(/^(\d+)s$/i);
    if (!match) return undefined;
    total += Number(match[1]);
  }

  return total > 0 ? `${total}s` : undefined;
}

function buildSceneImagesReviewDocument(projectId: string, scenes: Array<{ number: number; caption: string; duration?: string }>) {
  const filePath = getStageFilePath(projectId, "scene-images");
  const existing = fs.existsSync(filePath) ? fs.readFileSync(filePath, "utf-8") : "";
  const parsed = existing ? parseFrontMatter(existing) : null;
  const topic = readProjectMeta(projectId)?.topic?.trim() || undefined;
  const totalDuration = formatSceneImagesDuration(scenes);
  const existingStatus = typeof parsed?.frontMatter.status === "string" ? parsed.frontMatter.status.trim() : "";
  const status = existingStatus && existingStatus !== "draft" && existingStatus !== "requested changes"
    ? existingStatus
    : "needs review";
  const title = typeof parsed?.frontMatter.title === "string" && parsed.frontMatter.title.trim()
    ? parsed.frontMatter.title.trim()
    : topic
      ? `Scene Images: ${topic}`
      : "Scene Images";

  const frontMatter = generateFrontMatter({
    title,
    status,
    date: new Date().toISOString(),
    agent: "Scribe",
    tags: ["short-form-video", "scene-images"],
    ...(topic ? { topic } : {}),
    scene_count: scenes.length,
    ...(totalDuration ? { total_duration: totalDuration } : {}),
    updatedAt: new Date().toISOString(),
  });

  const rows = scenes
    .map((scene) => `| ${scene.number} | ${scene.duration || "—"} | ${scene.caption.replace(/\|/g, "\\|")} |`)
    .join("\n");

  return [
    frontMatter,
    "",
    "# Scene Images Review Document",
    "",
    "## Summary",
    "",
    `Generated **${scenes.length} scene images** for the latest approved XML script. Each scene should have an uncaptioned export for assembly and a captioned preview for review.`,
    "",
    "## Scene Breakdown",
    "",
    "| Scene | Duration | Caption |",
    "|-------|----------|---------|",
    rows,
    "",
    "## Files Generated",
    "",
    "- `scenes/scene-XX-uncaptioned-1080x1920.png` — clean scene image for video assembly",
    "- `scenes/scene-XX-captioned-1080x1920.png` — preview image with caption overlay",
    "- `scenes/scene-XX.png` — legacy copy of the clean scene image",
    "",
    "## Location",
    "",
    "All scene image files are stored under `scenes/`. The dashboard manifest and review document are auto-synced from the latest generated scene set.",
  ].join("\n");
}

export function synchronizeSceneImagesArtifacts(projectId: string) {
  const generated = readGeneratedSceneManifestResult(projectId);
  if (generated.error || generated.data.length === 0) return;

  const primary = readPrimarySceneManifestResult(projectId);
  const primaryPath = getSceneManifestPath(projectId);
  const generatedPath = getSceneGeneratorManifestPath(projectId);
  const docPath = getStageFilePath(projectId, "scene-images");

  const generatedMtime = getFileMtimeMs(generatedPath);
  const primaryMtime = getFileMtimeMs(primaryPath);

  const shouldSyncManifest =
    generatedMtime > primaryMtime + 1000 ||
    sceneManifestNeedsSync(projectId, primary, generated.data);

  if (shouldSyncManifest) {
    const strictManifest = {
      scenes: generated.data.map(({ id, number, caption, image, previewImage, notes }) => ({
        id,
        number,
        caption,
        ...(image ? { image } : {}),
        ...(previewImage ? { previewImage } : {}),
        ...(notes ? { notes } : {}),
      })),
    };
    fs.writeFileSync(primaryPath, JSON.stringify(strictManifest, null, 2), "utf-8");
  }

  if (sceneImagesDocNeedsSync(projectId, generated.data, shouldSyncManifest, generatedMtime, docPath)) {
    fs.writeFileSync(docPath, buildSceneImagesReviewDocument(projectId, generated.data), "utf-8");
  }
}

function readSceneManifestResult(projectId: string): JsonReadResult<SceneImageArtifact[]> {
  synchronizeSceneImagesArtifacts(projectId);
  return readPrimarySceneManifestResult(projectId);
}

export function readSceneManifest(projectId: string): SceneImageArtifact[] {
  return readSceneManifestResult(projectId).data;
}

function normalizeStatus(content: string | undefined, fallback = "draft") {
  if (!content) return fallback;
  const parsed = parseFrontMatter(content);
  const status = parsed?.frontMatter.status;
  return typeof status === "string" && status.trim() ? status : fallback;
}

export function ensureStageDocument(
  projectId: string,
  stage: ShortFormStageKey,
  defaults?: { title?: string; agent?: string; body?: string; status?: string; tags?: string[] }
) {
  const filePath = getStageFilePath(projectId, stage);
  if (fs.existsSync(filePath)) return filePath;

  const content = [
    generateFrontMatter({
      title: defaults?.title || stage,
      status: defaults?.status || "draft",
      date: new Date().toISOString(),
      agent: defaults?.agent || "scribe",
      tags: defaults?.tags || ["short-form-video", stage],
    }),
    "",
    defaults?.body || "",
  ].join("\n");

  fs.writeFileSync(filePath, content, "utf-8");
  return filePath;
}

function getOpenThreadCountForFile(filePath: string) {
  const dir = path.dirname(filePath);
  const base = path.basename(filePath, ".md");
  const feedbackPath = path.join(dir, `${base}-feedback.json`);
  const data = readJsonFile<{ threads?: Array<{ status?: string }> }>(feedbackPath, {});
  return (data.threads || []).filter((thread) => thread.status === "open").length;
}

function getLatestOpenTopLevelThread(filePath: string): FeedbackThread | undefined {
  const feedback = readFeedback(filePath);
  return [...feedback.threads]
    .filter((thread) => thread.status === "open" && (thread.startLine === null || thread.endLine === null))
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
}

function getLatestRequestedChangesLog(filePath: string) {
  const statusLog = readStatusLog(filePath);
  return [...statusLog.logs]
    .filter((entry) => entry.to === "requested changes")
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0];
}

function getLatestRequestText(thread?: FeedbackThread, fallback?: string) {
  const latestComment = thread?.comments?.[thread.comments.length - 1]?.content?.trim();
  if (latestComment) return latestComment;
  const trimmedFallback = fallback?.trim();
  return trimmedFallback || undefined;
}

function hasFreshFileAtPath(filePath: string, requestedAtMs: number) {
  if (!Number.isFinite(requestedAtMs) || !fs.existsSync(filePath)) return false;

  try {
    return fs.statSync(filePath).mtimeMs > requestedAtMs + 1_000;
  } catch {
    return false;
  }
}

function getProjectMediaVersion(projectId: string, relativePath?: string) {
  if (!relativePath) return undefined;

  const absolutePath = path.join(getProjectDir(projectId), relativePath);
  const mtimeMs = getFileMtimeMs(absolutePath);
  return mtimeMs > 0 ? String(Math.floor(mtimeMs)) : undefined;
}

function parseSceneIdToIndex(sceneId?: string) {
  if (typeof sceneId !== "string") return undefined;
  const match = sceneId.trim().match(/scene-(\d+)/i);
  if (!match) return undefined;
  const value = Number(match[1]);
  return Number.isInteger(value) && value > 0 ? value : undefined;
}

function normalizeXmlText(value: string) {
  return value
    .replace(/<!--([\s\S]*?)-->/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function readExpectedScriptScenes(projectId: string): Array<{ id: string; number: number; caption: string }> {
  const scriptPath = getStageFilePath(projectId, "script");
  if (!fs.existsSync(scriptPath)) return [];

  try {
    const xml = extractBody(fs.readFileSync(scriptPath, "utf-8"));
    const matches = Array.from(xml.matchAll(/<scene\b[^>]*>([\s\S]*?)<\/scene>/gi));
    return matches.map((match, index) => {
      const number = index + 1;
      const sceneBlock = match[0] || "";
      const captionMatch = sceneBlock.match(/<text>([\s\S]*?)<\/text>/i);
      const caption = normalizeXmlText(captionMatch?.[1] || "") || `Scene ${number}`;
      return { id: `scene-${number}`, number, caption };
    });
  } catch {
    return [];
  }
}

function getDerivedSceneRelativePaths(number: number) {
  const padded = String(number).padStart(2, "0");
  return {
    image: `scenes/scene-${padded}-uncaptioned-1080x1920.png`,
    previewImage: `scenes/scene-${padded}-captioned-1080x1920.png`,
  };
}

function buildSceneArtifactFromDerivedPaths(
  projectId: string,
  scene: { id: string; number: number; caption: string; notes?: string },
  options?: { requireFreshSinceMs?: number }
): SceneImageArtifact {
  const derived = getDerivedSceneRelativePaths(scene.number);
  const imagePath = path.join(getProjectDir(projectId), derived.image);
  const previewImagePath = path.join(getProjectDir(projectId), derived.previewImage);
  const requireFreshSinceMs = options?.requireFreshSinceMs;
  const imageExists = Number.isFinite(requireFreshSinceMs)
    ? hasFreshFileAtPath(imagePath, requireFreshSinceMs as number)
    : fs.existsSync(imagePath);
  const previewExists = Number.isFinite(requireFreshSinceMs)
    ? hasFreshFileAtPath(previewImagePath, requireFreshSinceMs as number)
    : fs.existsSync(previewImagePath);

  return {
    id: scene.id,
    number: scene.number,
    caption: scene.caption,
    notes: scene.notes,
    image: imageExists ? toMediaUrl(projectId, derived.image, getProjectMediaVersion(projectId, derived.image)) : undefined,
    previewImage: previewExists ? toMediaUrl(projectId, derived.previewImage, getProjectMediaVersion(projectId, derived.previewImage)) : undefined,
  };
}

function buildSceneImagesProgressState(projectId: string, scenes: SceneImageArtifact[], doc: StageDocumentSummary) {
  const revision = doc.revision;
  const isPending = Boolean(doc.pending || revision?.isPending);
  if (!isPending) {
    return {
      scenes: scenes.map((scene) => ({ ...scene, status: "completed" as const })),
      sceneProgress: scenes.length > 0
        ? { total: scenes.length, completed: scenes.length, pending: 0, scope: "all" as const }
        : undefined,
    };
  }

  const requestedAtMs = revision?.requestedAt ? Date.parse(revision.requestedAt) : Number.NaN;
  const targetSceneIndex = parseSceneIdToIndex(revision?.action === "request-scene-change" ? revision.sceneId ?? undefined : undefined);
  const expectedScenes = readExpectedScriptScenes(projectId);
  const manifestByNumber = new Map(scenes.map((scene) => [scene.number, scene]));
  const orderedNumbers = expectedScenes.length > 0
    ? expectedScenes.map((scene) => scene.number)
    : Array.from(manifestByNumber.keys()).sort((a, b) => a - b);

  if (targetSceneIndex && !orderedNumbers.includes(targetSceneIndex)) {
    orderedNumbers.push(targetSceneIndex);
    orderedNumbers.sort((a, b) => a - b);
  }

  const scoped = Boolean(targetSceneIndex);
  const mergedScenes = orderedNumbers.map((number) => {
    const expected = expectedScenes.find((scene) => scene.number === number);
    const current = manifestByNumber.get(number);
    const base = {
      id: current?.id || expected?.id || `scene-${number}`,
      number,
      caption: current?.caption || expected?.caption || `Scene ${number}`,
      notes: current?.notes,
    };

    const shouldTrackFreshness = Number.isFinite(requestedAtMs) && (!scoped || number === targetSceneIndex);

    if (shouldTrackFreshness) {
      const freshScene = buildSceneArtifactFromDerivedPaths(projectId, base, { requireFreshSinceMs: requestedAtMs });
      if (freshScene.previewImage || freshScene.image) {
        return { ...freshScene, status: "completed" as const };
      }
      return { ...base, status: "in-progress" as const };
    }

    if (current) {
      return { ...current, status: "completed" as const };
    }

    const existingScene = buildSceneArtifactFromDerivedPaths(projectId, base);
    if (existingScene.previewImage || existingScene.image) {
      return { ...existingScene, status: "completed" as const };
    }

    return { ...base, status: "in-progress" as const };
  });

  const completed = mergedScenes.filter((scene) => scene.status === "completed").length;
  const total = mergedScenes.length;
  const pending = Math.max(total - completed, 0);

  return {
    scenes: mergedScenes,
    sceneProgress: total > 0
      ? {
          total,
          completed,
          pending,
          scope: scoped ? "single" as const : "all" as const,
          ...(revision?.action === "request-scene-change" && revision.sceneId ? { targetSceneId: revision.sceneId } : {}),
        }
      : undefined,
  };
}

function hasFreshSceneImageMedia(projectId: string, scenes: SceneImageArtifact[], requestedAtMs: number) {
  if (!Number.isFinite(requestedAtMs) || scenes.length === 0) return false;

  return scenes.some((scene) => {
    const candidatePaths = [scene.image, scene.previewImage].filter((value): value is string => Boolean(value));
    return candidatePaths.some((relativePath) => hasFreshFileAtPath(path.join(getProjectDir(projectId), relativePath), requestedAtMs));
  });
}

function hasFreshStageArtifact(projectId: string, stage: ShortFormStageKey, doc: StageDocumentSummary, requestedAt?: string) {
  const requestedAtMs = requestedAt ? Date.parse(requestedAt) : Number.NaN;
  const filePath = getStageFilePath(projectId, stage);
  const stageDocUpdated = hasFreshFileAtPath(filePath, requestedAtMs);

  switch (stage) {
    case "research":
    case "script": {
      return stageDocUpdated && hasMeaningfulStageOutput(stage, doc);
    }
    case "scene-images": {
      const manifest = readSceneManifestResult(projectId);
      const manifestUpdated = hasFreshFileAtPath(getSceneManifestPath(projectId), requestedAtMs);
      const mediaUpdated = hasFreshSceneImageMedia(projectId, manifest.data, requestedAtMs);
      return stageDocUpdated && manifestUpdated && mediaUpdated && manifest.data.length > 0;
    }
    case "video": {
      const videoArtifactPath = getVideoArtifactPath(projectId);
      const videoUpdated = videoArtifactPath ? hasFreshFileAtPath(videoArtifactPath, requestedAtMs) : false;
      return stageDocUpdated && videoUpdated;
    }
  }
}

function hasFreshHooksArtifact(projectId: string, requestedAt?: string) {
  const requestedAtMs = requestedAt ? Date.parse(requestedAt) : Number.NaN;
  const hooks = readHooksResult(projectId);
  return hooks.data.length > 0 && hasFreshFileAtPath(getHooksPath(projectId), requestedAtMs);
}

function findRelevantHookWorkflowRun(
  projectId: string,
  requestedAt?: string,
  runId?: string,
): StageAgentRunSummary | undefined {
  const runDir = getWorkflowRunDir(projectId);
  if (!fs.existsSync(runDir)) return undefined;

  const requestedAtMs = requestedAt ? Date.parse(requestedAt) : Number.NaN;
  const statusFiles = fs
    .readdirSync(runDir)
    .filter((entry) => entry.endsWith(".status.json"))
    .map((entry) => {
      const fullPath = path.join(runDir, entry);
      let mtimeMs = 0;
      try {
        mtimeMs = fs.statSync(fullPath).mtimeMs;
      } catch {
        mtimeMs = 0;
      }
      return { entry, fullPath, mtimeMs };
    })
    .sort((a, b) => b.mtimeMs - a.mtimeMs);

  for (const candidate of statusFiles) {
    let raw = "";
    try {
      raw = fs.readFileSync(candidate.fullPath, "utf-8");
    } catch {
      continue;
    }

    try {
      const parsed = JSON.parse(raw) as {
        kind?: "hooks";
        runId?: string;
        projectId?: string;
        status?: "running" | "verified" | "failed";
        startedAt?: string;
        verifiedAt?: string;
        failedAt?: string;
        attempts?: Array<{
          startedAt?: string;
          finishedAt?: string;
          error?: string;
          spawnResult?: { sessionId?: string; id?: string };
        }>;
      };

      if (parsed.kind !== "hooks" || parsed.projectId !== projectId) continue;
      if (runId && parsed.runId !== runId) continue;

      const runStartedAtMs = parsed.startedAt ? Date.parse(parsed.startedAt) : Number.NaN;
      if (!runId && Number.isFinite(requestedAtMs) && Number.isFinite(runStartedAtMs) && runStartedAtMs < requestedAtMs - 60_000) {
        continue;
      }

      const attempts = Array.isArray(parsed.attempts) ? parsed.attempts : [];
      const latestAttempt = attempts[attempts.length - 1];
      const errorAttempt = [...attempts].reverse().find((attempt) => typeof attempt.error === "string" && attempt.error.trim());
      const sessionId = latestAttempt?.spawnResult?.sessionId || latestAttempt?.spawnResult?.id;
      const lastEventAt = latestAttempt?.finishedAt || latestAttempt?.startedAt || parsed.startedAt;

      return {
        runId: parsed.runId,
        source: "workflow-run",
        status: parsed.status,
        sessionId,
        startedAt: parsed.startedAt,
        failedAt: parsed.failedAt,
        completedAt: parsed.status === "verified" ? parsed.verifiedAt : parsed.failedAt,
        lastEventAt,
        errorMessage: errorAttempt?.error,
        completionReason: parsed.status,
      };
    } catch {
      continue;
    }
  }

  return undefined;
}

function findRelevantWorkflowRun(
  projectId: string,
  stage: ShortFormStageKey,
  requestedAt?: string,
  runId?: string,
): StageAgentRunSummary | undefined {
  const runDir = getWorkflowRunDir(projectId);
  if (!fs.existsSync(runDir)) return undefined;

  const requestedAtMs = requestedAt ? Date.parse(requestedAt) : Number.NaN;
  const statusFiles = fs
    .readdirSync(runDir)
    .filter((entry) => entry.endsWith(".status.json"))
    .map((entry) => {
      const fullPath = path.join(runDir, entry);
      let mtimeMs = 0;
      try {
        mtimeMs = fs.statSync(fullPath).mtimeMs;
      } catch {
        mtimeMs = 0;
      }
      return { entry, fullPath, mtimeMs };
    })
    .sort((a, b) => b.mtimeMs - a.mtimeMs);

  for (const candidate of statusFiles) {
    let raw = "";
    try {
      raw = fs.readFileSync(candidate.fullPath, "utf-8");
    } catch {
      continue;
    }

    try {
      const parsed = JSON.parse(raw) as {
        runId?: string;
        projectId?: string;
        stage?: ShortFormStageKey;
        status?: "running" | "verified" | "failed";
        startedAt?: string;
        verifiedAt?: string;
        failedAt?: string;
        attempts?: Array<{
          startedAt?: string;
          finishedAt?: string;
          error?: string;
          spawnResult?: { sessionId?: string; id?: string };
        }>;
      };

      if (parsed.projectId !== projectId || parsed.stage !== stage) continue;
      if (runId && parsed.runId !== runId) continue;

      const runStartedAtMs = parsed.startedAt ? Date.parse(parsed.startedAt) : Number.NaN;
      if (!runId && Number.isFinite(requestedAtMs) && Number.isFinite(runStartedAtMs) && runStartedAtMs < requestedAtMs - 60_000) {
        continue;
      }

      const attempts = Array.isArray(parsed.attempts) ? parsed.attempts : [];
      const latestAttempt = attempts[attempts.length - 1];
      const errorAttempt = [...attempts].reverse().find((attempt) => typeof attempt.error === "string" && attempt.error.trim());
      const sessionId = latestAttempt?.spawnResult?.sessionId || latestAttempt?.spawnResult?.id;
      const lastEventAt = latestAttempt?.finishedAt || latestAttempt?.startedAt || parsed.startedAt;

      return {
        runId: parsed.runId,
        source: "workflow-run",
        status: parsed.status,
        sessionId,
        startedAt: parsed.startedAt,
        failedAt: parsed.failedAt,
        completedAt: parsed.status === "verified" ? parsed.verifiedAt : parsed.failedAt,
        lastEventAt,
        errorMessage: errorAttempt?.error,
        completionReason: parsed.status,
      };
    } catch {
      continue;
    }
  }

  return undefined;
}

function findRelevantAgentRun(stage: ShortFormStageKey, filePath: string, requestedAt?: string): StageAgentRunSummary | undefined {
  const sessionsDir = path.join(OPENCLAW_DIR, "agents", AGENT_FOR_STAGE[stage], "sessions");
  if (!fs.existsSync(sessionsDir)) return undefined;

  const requestedAtMs = requestedAt ? Date.parse(requestedAt) : Number.NaN;
  const candidateFiles = fs
    .readdirSync(sessionsDir)
    .filter((entry) => entry.endsWith(".jsonl"))
    .map((entry) => {
      const fullPath = path.join(sessionsDir, entry);
      let mtimeMs = 0;
      try {
        mtimeMs = fs.statSync(fullPath).mtimeMs;
      } catch {
        mtimeMs = 0;
      }
      return { entry, fullPath, mtimeMs };
    })
    .sort((a, b) => b.mtimeMs - a.mtimeMs)
    .slice(0, 200);

  for (const candidate of candidateFiles) {
    if (Number.isFinite(requestedAtMs) && candidate.mtimeMs < requestedAtMs - 60_000) {
      continue;
    }

    let raw = "";
    try {
      raw = fs.readFileSync(candidate.fullPath, "utf-8");
    } catch {
      continue;
    }

    if (!raw.includes(filePath)) continue;

    let sessionId: string | undefined;
    let startedAt: string | undefined;
    let failedAt: string | undefined;
    let completedAt: string | undefined;
    let lastEventAt: string | undefined;
    let errorMessage: string | undefined;
    let completionReason: string | undefined;

    const lines = raw.split("\n").filter(Boolean);
    for (const line of lines) {
      try {
        const entry = JSON.parse(line) as {
          id?: string;
          timestamp?: string;
          errorMessage?: string;
          stopReason?: string;
          type?: string;
          message?: {
            role?: string;
            errorMessage?: string;
          };
        };

        if (typeof entry.timestamp === "string") {
          lastEventAt = entry.timestamp;
        }

        if (!sessionId && entry.type === "session" && typeof entry.id === "string") {
          sessionId = entry.id;
          startedAt = entry.timestamp;
        }

        const lineError = entry.errorMessage || entry.message?.errorMessage;
        if (typeof lineError === "string" && lineError.trim()) {
          errorMessage = lineError.trim();
          failedAt = entry.timestamp;
        }

        if (
          entry.type === "message" &&
          entry.message?.role === "assistant" &&
          typeof entry.stopReason === "string" &&
          entry.stopReason !== "toolUse"
        ) {
          completedAt = entry.timestamp;
          completionReason = entry.stopReason;
        }
      } catch {
        // Ignore malformed lines.
      }
    }

    return {
      source: "agent-session",
      sessionId,
      startedAt,
      failedAt,
      completedAt,
      lastEventAt,
      errorMessage,
      completionReason,
    };
  }

  return undefined;
}

function deriveStageRevisionState(
  projectId: string,
  stage: ShortFormStageKey,
  doc: StageDocumentSummary,
  options?: { pending?: boolean }
): StageRevisionState | undefined {
  const filePath = getStageFilePath(projectId, stage);
  if (!fs.existsSync(filePath)) return undefined;

  const latestThread = getLatestOpenTopLevelThread(filePath);
  const latestRequestLog = getLatestRequestedChangesLog(filePath);
  const latestRequest = getLatestStageRequest(projectId, stage);
  const requestedAt = latestRequest?.requestedAt || latestThread?.createdAt || latestRequestLog?.timestamp;
  const requestText = latestRequest?.notes || getLatestRequestText(latestThread, latestRequestLog?.note);
  const mode = latestRequest?.mode || (doc.status === "requested changes" ? "revise" : undefined);
  const action = latestRequest?.action || (mode === "revise" ? "revise" : undefined);

  if (!requestedAt || !mode) {
    return undefined;
  }

  const hasFreshArtifact = hasFreshStageArtifact(projectId, stage, doc, requestedAt);
  if (hasFreshArtifact) {
    return undefined;
  }

  const shouldTrack = mode === "revise"
    ? doc.status === "requested changes" || Boolean(options?.pending)
    : Boolean(options?.pending) || !hasMeaningfulStageOutput(stage, doc);

  if (!shouldTrack) {
    return undefined;
  }

  const workflowRun = findRelevantWorkflowRun(projectId, stage, requestedAt, latestRequest?.runId);
  const agentRun = workflowRun || findRelevantAgentRun(stage, filePath, requestedAt);
  const now = Date.now();
  const lastEventMs = agentRun?.lastEventAt ? Date.parse(agentRun.lastEventAt) : Number.NaN;
  const runInactive = !workflowRun && Number.isFinite(lastEventMs)
    ? now - lastEventMs >= getStageRunInactivityFailureMs(stage)
    : false;
  const runCompleted = workflowRun
    ? agentRun?.status === "failed"
    : Boolean(agentRun?.completedAt) || runInactive;
  const isFailed = workflowRun
    ? agentRun?.status === "failed"
    : Boolean(agentRun?.errorMessage) || runCompleted;
  const isPending = workflowRun
    ? agentRun?.status === "running"
    : !isFailed;
  const isStale = !workflowRun;
  const stageName = stage === "scene-images" ? "scene image" : stage;
  const warning = isFailed
    ? agentRun?.errorMessage
      ? `The latest ${stageName} ${mode === "generate" ? "generation" : "revision"} run ended before a new artifact was written. ${agentRun.errorMessage}`
      : `The latest ${stageName} ${mode === "generate" ? "generation" : "revision"} run appears to have finished without writing the required artifact(s).`
    : undefined;

  return {
    requestedAt,
    requestText,
    threadId: latestThread?.id,
    sceneId: latestRequest?.sceneId,
    mode,
    action,
    isPending,
    isFailed,
    isStale,
    warning,
    agentRun,
  };
}

function readStageDocument(projectId: string, stage: ShortFormStageKey, options?: { pending?: boolean }): StageDocumentSummary {
  const filePath = getStageFilePath(projectId, stage);
  if (!fs.existsSync(filePath)) {
    return {
      exists: false,
      status: "draft",
      content: "",
      openThreads: 0,
    };
  }

  const content = fs.readFileSync(filePath, "utf-8");
  const stats = fs.statSync(filePath);
  const summary: StageDocumentSummary = {
    exists: true,
    status: normalizeStatus(content),
    content,
    updatedAt: stats.mtime.toISOString(),
    openThreads: getOpenThreadCountForFile(filePath),
  };
  summary.revision = deriveStageRevisionState(projectId, stage, summary, options);
  return summary;
}

function toMediaUrl(projectId: string, relativePath: string, version?: string) {
  const basePath = `/api/short-form-videos/${projectId}/media/${relativePath.split(path.sep).join("/")}`;
  return version ? `${basePath}?v=${encodeURIComponent(version)}` : basePath;
}

function getSceneImagesStage(projectId: string, options?: { pending?: boolean }) {
  synchronizeSceneImagesArtifacts(projectId);
  const doc = readStageDocument(projectId, "scene-images", options);
  const manifest = readSceneManifestResult(projectId);
  const manifestScenes = manifest.data.map((scene) => ({
    ...scene,
    image: scene.image ? toMediaUrl(projectId, scene.image, getProjectMediaVersion(projectId, scene.image)) : undefined,
    previewImage: scene.previewImage ? toMediaUrl(projectId, scene.previewImage, getProjectMediaVersion(projectId, scene.previewImage)) : undefined,
  }));
  const progressState = buildSceneImagesProgressState(projectId, manifestScenes, doc);
  return { ...doc, scenes: progressState.scenes, sceneProgress: progressState.sceneProgress, validationError: manifest.error };
}

function getVideoWorkDir(projectId: string) {
  return path.join(getProjectDir(projectId), "output", "xml-scene-video-work");
}

function readTextFileIfExists(filePath: string) {
  if (!fs.existsSync(filePath)) return undefined;
  try {
    return fs.readFileSync(filePath, "utf-8");
  } catch {
    return undefined;
  }
}

function readJsonFileIfExists(filePath: string) {
  if (!fs.existsSync(filePath)) return undefined;
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf-8")) as Record<string, unknown>;
  } catch {
    return undefined;
  }
}

function getFileUpdatedAt(filePath: string) {
  if (!fs.existsSync(filePath)) return undefined;
  try {
    return fs.statSync(filePath).mtime.toISOString();
  } catch {
    return undefined;
  }
}

function getLatestMatchingFileUpdatedAt(dirPath: string, matcher: (entry: string) => boolean) {
  if (!fs.existsSync(dirPath)) return undefined;

  try {
    const latestMs = fs
      .readdirSync(dirPath)
      .filter((entry) => matcher(entry))
      .map((entry) => {
        try {
          return fs.statSync(path.join(dirPath, entry)).mtimeMs;
        } catch {
          return 0;
        }
      })
      .reduce((latest, value) => Math.max(latest, value), 0);

    return latestMs > 0 ? new Date(latestMs).toISOString() : undefined;
  } catch {
    return undefined;
  }
}

function hasFreshMatchingFileAtPath(dirPath: string, requestedAtMs: number, matcher: (entry: string) => boolean) {
  if (!Number.isFinite(requestedAtMs) || !fs.existsSync(dirPath)) return false;

  try {
    return fs.readdirSync(dirPath).some((entry) => matcher(entry) && hasFreshFileAtPath(path.join(dirPath, entry), requestedAtMs));
  } catch {
    return false;
  }
}

function stringifyDebugContent(value: unknown) {
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function summarizeAlignmentDebug(value: Record<string, unknown> | undefined) {
  if (!value) return undefined;

  const strategy = typeof value.alignment_strategy === "string" ? value.alignment_strategy : undefined;
  const warning = typeof value.alignment_warning === "string" ? value.alignment_warning : undefined;
  const matched = typeof value.matched_token_count === "number" ? value.matched_token_count : undefined;
  const expected = typeof value.expected_token_count === "number" ? value.expected_token_count : undefined;
  const coverageRatio = typeof value.coverage_ratio === "number" ? value.coverage_ratio : undefined;

  const parts = [
    strategy ? `Strategy: ${strategy}` : undefined,
    matched !== undefined && expected !== undefined ? `Matched ${matched}/${expected} expected tokens` : undefined,
    coverageRatio !== undefined ? `Coverage ${(coverageRatio * 100).toFixed(0)}%` : undefined,
    warning,
  ].filter(Boolean);

  return parts.length > 0 ? parts.join(" · ") : undefined;
}

function buildVideoPipelineSummary(
  projectId: string,
  doc: StageDocumentSummary,
  videoArtifactPath?: string,
  agentRun?: StageAgentRunSummary,
): VideoPipelineSummary | undefined {
  const workDir = getVideoWorkDir(projectId);
  const manifestPath = path.join(workDir, "manifest.json");
  const transcriptPath = path.join(workDir, "voice", "voiceover-script.txt");
  const sceneTranscriptPath = path.join(workDir, "voice", "scene-transcript.json");
  const combinedVoicePath = path.join(workDir, "voice", "voiceover-full.wav");
  const alignmentInputPath = path.join(workDir, "alignment", "alignment-input.json");
  const alignmentOutputPath = path.join(workDir, "alignment", "word-timestamps.json");
  const motionScenesDir = path.join(workDir, "motion-scenes");
  const captionedScenesDir = path.join(workDir, "captioned-scenes");
  const visualOnlyPath = path.join(motionScenesDir, "visual-with-captions.mp4");
  const generatedMusicPath = path.join(workDir, "music", "background-music-ace-step.wav");

  const hasAnyArtifacts = [
    manifestPath,
    transcriptPath,
    sceneTranscriptPath,
    combinedVoicePath,
    alignmentInputPath,
    alignmentOutputPath,
    visualOnlyPath,
    generatedMusicPath,
    videoArtifactPath,
  ].some((filePath) => Boolean(filePath && fs.existsSync(filePath)));

  if (!hasAnyArtifacts && !doc.pending && !agentRun) {
    return undefined;
  }

  const manifest = readJsonFileIfExists(manifestPath);
  const manifestAlignment = manifest && typeof manifest.alignment === "object" && manifest.alignment && !Array.isArray(manifest.alignment)
    ? manifest.alignment as Record<string, unknown>
    : undefined;
  const transcript = readTextFileIfExists(transcriptPath);
  const sceneTranscript = readJsonFileIfExists(sceneTranscriptPath);
  const alignmentInput = readJsonFileIfExists(alignmentInputPath);
  const alignmentOutput = readJsonFileIfExists(alignmentOutputPath);
  const runFailed = agentRun?.status === "failed" || doc.revision?.isFailed;
  const runActive = Boolean(doc.pending || doc.revision?.isPending || agentRun?.status === "running");
  const requestedAtMs = doc.revision?.requestedAt ? Date.parse(doc.revision.requestedAt) : Number.NaN;
  const shouldRequireFreshArtifacts = Number.isFinite(requestedAtMs) && Boolean(doc.revision?.isPending || runFailed || runActive);

  const stepDone = (filePath?: string) => {
    if (!filePath || !fs.existsSync(filePath)) return false;
    if (!shouldRequireFreshArtifacts) return true;
    return hasFreshFileAtPath(filePath, requestedAtMs);
  };
  const stepStatus = (done: boolean, isCurrent: boolean) => {
    if (runFailed && !done && isCurrent) return "failed" as const;
    if (done) return "completed" as const;
    if (runActive && isCurrent) return "active" as const;
    return "pending" as const;
  };

  const transcriptDone = stepDone(transcriptPath);
  const voiceDone = stepDone(combinedVoicePath);
  const alignmentDone = stepDone(alignmentOutputPath);
  const timingFromManifestDone = Boolean(manifestAlignment) && (!shouldRequireFreshArtifacts || hasFreshFileAtPath(manifestPath, requestedAtMs));
  const timingFromRenderedScenesDone = shouldRequireFreshArtifacts
    ? hasFreshMatchingFileAtPath(motionScenesDir, requestedAtMs, (entry) => /^scene-\d+\.mp4$/i.test(entry)) ||
      hasFreshMatchingFileAtPath(captionedScenesDir, requestedAtMs, (entry) => /^scene-\d+\.mp4$/i.test(entry))
    : Boolean(
        getLatestMatchingFileUpdatedAt(motionScenesDir, (entry) => /^scene-\d+\.mp4$/i.test(entry)) ||
        getLatestMatchingFileUpdatedAt(captionedScenesDir, (entry) => /^scene-\d+\.mp4$/i.test(entry))
      );
  const timingDone = timingFromManifestDone || timingFromRenderedScenesDone || stepDone(visualOnlyPath) || stepDone(videoArtifactPath);
  const timingSummary = timingFromManifestDone
    ? summarizeAlignmentDebug(manifestAlignment) || "Scene timing was derived from the alignment step."
    : timingFromRenderedScenesDone || stepDone(visualOnlyPath) || stepDone(videoArtifactPath)
      ? "Scene timing was inferred from downstream render artifacts."
      : "Waiting for scene boundary and duration calculations.";
  const timingUpdatedAt = getFileUpdatedAt(manifestPath)
    || getLatestMatchingFileUpdatedAt(motionScenesDir, (entry) => /^scene-\d+\.mp4$/i.test(entry))
    || getLatestMatchingFileUpdatedAt(captionedScenesDir, (entry) => /^scene-\d+\.mp4$/i.test(entry))
    || getFileUpdatedAt(visualOnlyPath)
    || (videoArtifactPath ? getFileUpdatedAt(videoArtifactPath) : undefined);
  const visualDone = stepDone(visualOnlyPath);
  const musicDone = Boolean(
    (typeof manifest?.music === "string" && stepDone(manifest.music)) || stepDone(generatedMusicPath)
  );
  const finalDone = stepDone(videoArtifactPath);

  const currentStep = !transcriptDone
    ? "transcript"
    : !voiceDone
      ? "voice"
      : !alignmentDone
        ? "alignment"
        : !timingDone
          ? "timing"
          : !visualDone
            ? "visual"
            : !musicDone
              ? "music"
              : !finalDone
                ? "final"
                : undefined;

  const steps: VideoPipelineStep[] = [
    {
      id: "transcript",
      label: "Prepare Qwen transcript",
      status: stepStatus(transcriptDone, currentStep === "transcript"),
      summary: transcriptDone ? "Transcript written for the full-video narration." : "Waiting for the narration transcript to be written.",
      updatedAt: getFileUpdatedAt(transcriptPath),
      details: [
        transcript ? { id: "transcript", label: "Transcript passed to Qwen3-TTS", format: "text", content: transcript } : undefined,
        sceneTranscript ? { id: "scene-transcript", label: "Scene transcript breakdown", format: "json", content: stringifyDebugContent(sceneTranscript) } : undefined,
      ].filter((detail): detail is VideoPipelineDetail => Boolean(detail)),
    },
    {
      id: "voice",
      label: "Generate narration audio",
      status: stepStatus(voiceDone, currentStep === "voice"),
      summary: voiceDone ? `Narration audio exists${typeof manifest?.voice_duration === "number" ? ` (${manifest.voice_duration.toFixed(2)}s)` : ""}.` : "Waiting for the combined narration WAV.",
      updatedAt: getFileUpdatedAt(combinedVoicePath),
      details: [
        manifest && (manifest.tts_engine || manifest.tts_voice || manifest.voice_instruct)
          ? {
              id: "tts-config",
              label: "Narration settings",
              format: "json",
              content: stringifyDebugContent({
                tts_engine: manifest.tts_engine,
                tts_voice: manifest.tts_voice,
                voice_instruct: manifest.voice_instruct,
                combined_voice: manifest.combined_voice,
                voice_duration: manifest.voice_duration,
              }),
            }
          : undefined,
      ].filter((detail): detail is VideoPipelineDetail => Boolean(detail)),
    },
    {
      id: "alignment",
      label: "Run force alignment",
      status: stepStatus(alignmentDone, currentStep === "alignment"),
      summary: alignmentDone ? (summarizeAlignmentDebug(manifestAlignment) || "Force-alignment output is available.") : "Waiting for the alignment model input/output.",
      updatedAt: getFileUpdatedAt(alignmentOutputPath),
      details: [
        alignmentInput ? { id: "alignment-input", label: "Data passed to force alignment", format: "json", content: stringifyDebugContent(alignmentInput) } : undefined,
        alignmentOutput ? { id: "alignment-output", label: "Force-alignment output", format: "json", content: stringifyDebugContent(alignmentOutput) } : undefined,
        manifestAlignment ? { id: "alignment-debug", label: "Alignment diagnostics", format: "json", content: stringifyDebugContent(manifestAlignment) } : undefined,
      ].filter((detail): detail is VideoPipelineDetail => Boolean(detail)),
    },
    {
      id: "timing",
      label: "Derive scene timing",
      status: stepStatus(timingDone, currentStep === "timing"),
      summary: timingSummary,
      updatedAt: timingUpdatedAt,
      details: manifest
        ? [{ id: "manifest-timing", label: "Manifest timing snapshot", format: "json", content: stringifyDebugContent({ alignment: manifest.alignment, scene_durations: manifest.scene_durations, scenes: manifest.scenes }) }]
        : [],
    },
    {
      id: "visual",
      label: "Render scene videos",
      status: stepStatus(visualDone, currentStep === "visual"),
      summary: visualDone ? "Captioned scene videos were concatenated into a visual-only pass." : "Waiting for motion scenes and caption overlays.",
      updatedAt: getFileUpdatedAt(visualOnlyPath),
      details: manifest
        ? [{ id: "scene-videos", label: "Scene render outputs", format: "json", content: stringifyDebugContent(manifest.scenes) }]
        : [],
    },
    {
      id: "music",
      label: "Add background music",
      status: stepStatus(musicDone, currentStep === "music"),
      summary: musicDone ? "Background music is available for the final mix." : "Waiting for the music track or ACE-Step generation.",
      updatedAt: typeof manifest?.music === "string" ? getFileUpdatedAt(manifest.music) : getFileUpdatedAt(generatedMusicPath),
      details: manifest
        ? [{ id: "music", label: "Music settings", format: "json", content: stringifyDebugContent({ music: manifest.music, music_prompt: manifest.music_prompt, music_volume: manifest.music_volume, ace_step_log: manifest.ace_step_log }) }]
        : [],
    },
    {
      id: "final",
      label: "Assemble final video",
      status: stepStatus(finalDone, currentStep === "final"),
      summary: finalDone ? "Final MP4 written successfully." : "Waiting for the final muxed MP4 artifact.",
      updatedAt: videoArtifactPath ? getFileUpdatedAt(videoArtifactPath) : undefined,
      details: manifest
        ? [{ id: "manifest", label: "Full video manifest", format: "json", content: stringifyDebugContent(manifest) }]
        : [],
    },
  ];

  return {
    status: runFailed ? "failed" : finalDone ? "completed" : runActive ? "running" : "idle",
    workDir,
    manifestPath: fs.existsSync(manifestPath) ? manifestPath : undefined,
    transcriptPath: fs.existsSync(transcriptPath) ? transcriptPath : undefined,
    alignmentInputPath: fs.existsSync(alignmentInputPath) ? alignmentInputPath : undefined,
    alignmentOutputPath: fs.existsSync(alignmentOutputPath) ? alignmentOutputPath : undefined,
    warning: typeof manifestAlignment?.alignment_warning === "string" ? manifestAlignment.alignment_warning : doc.revision?.warning,
    steps,
  };
}

function getVideoStage(projectId: string, options?: { pending?: boolean }) {
  const doc = readStageDocument(projectId, "video", options);
  const videoArtifactPath = getVideoArtifactPath(projectId);
  const videoPath = videoArtifactPath
    ? path.relative(getProjectDir(projectId), videoArtifactPath).split(path.sep).join("/")
    : undefined;

  return {
    ...doc,
    videoPath,
    videoUrl: videoPath ? toMediaUrl(projectId, videoPath) : undefined,
    pipeline: buildVideoPipelineSummary(projectId, doc, videoArtifactPath, doc.revision?.agentRun),
  };
}

function inferCurrentStage(project: {
  selectedHookText?: string;
  research: StageDocumentSummary;
  script: StageDocumentSummary;
  sceneImages: StageDocumentSummary & { scenes: SceneImageArtifact[]; sceneProgress?: SceneImageProgressSummary };
  video: StageDocumentSummary & { videoUrl?: string };
}) {
  if (project.video.videoUrl) return "video";
  if (project.sceneImages.scenes.length > 0) return "scene-images";
  if (project.script.exists) return "script";
  if (project.research.exists) return "research";
  if (project.selectedHookText) return "hook";
  return "topic";
}

function hasMeaningfulStageOutput(stage: ShortFormStageKey, doc: StageDocumentSummary) {
  if (!doc.exists) return false;
  if (doc.status !== "draft") return true;

  const body = extractBody(doc.content).trim();
  return body.length > 0 && body !== STAGE_PLACEHOLDER_BODIES[stage].trim();
}

function reconcilePendingStages(
  projectId: string,
  meta: ShortFormProjectMeta,
  state: {
    hooks: JsonReadResult<HookGeneration[]>;
    hookRun?: StageAgentRunSummary;
    hookArtifactFresh: boolean;
    research: StageDocumentSummary;
    script: StageDocumentSummary;
    sceneImages: StageDocumentSummary & { scenes: SceneImageArtifact[]; sceneProgress?: SceneImageProgressSummary; validationError?: string };
    video: StageDocumentSummary & { videoUrl?: string };
  }
) {
  const updates: Partial<ShortFormProjectMeta> = {};

  if (
    meta.pendingHooks &&
    (state.hookArtifactFresh || Boolean(state.hooks.error) || state.hookRun?.status === "failed")
  ) {
    updates.pendingHooks = false;
  }

  if (
    meta.pendingResearch &&
    ((hasMeaningfulStageOutput("research", state.research) && !state.research.revision?.isPending) || state.research.revision?.isFailed)
  ) {
    updates.pendingResearch = false;
  }

  if (
    meta.pendingScript &&
    ((hasMeaningfulStageOutput("script", state.script) && !state.script.revision?.isPending) || state.script.revision?.isFailed)
  ) {
    updates.pendingScript = false;
  }

  const latestSceneImageRequest = meta.latestStageRequests?.["scene-images"];
  const sceneImageArtifactsFresh = hasFreshStageArtifact(projectId, "scene-images", state.sceneImages, latestSceneImageRequest?.requestedAt);

  if (
    meta.pendingSceneImages &&
    (((sceneImageArtifactsFresh || Boolean(state.sceneImages.validationError)) && !state.sceneImages.revision?.isPending) ||
      state.sceneImages.revision?.isFailed)
  ) {
    updates.pendingSceneImages = false;
  }

  if (
    meta.pendingVideo &&
    (((Boolean(state.video.videoUrl) || hasMeaningfulStageOutput("video", state.video)) && !state.video.revision?.isPending) ||
      state.video.revision?.isFailed)
  ) {
    updates.pendingVideo = false;
  }

  if (Object.keys(updates).length > 0) {
    return updateProjectMeta(projectId, updates) || { ...meta, ...updates };
  }

  return meta;
}

function getPendingStages(
  meta: ShortFormProjectMeta,
  state?: {
    research?: StageDocumentSummary;
    script?: StageDocumentSummary;
    sceneImages?: StageDocumentSummary;
    video?: StageDocumentSummary;
  }
): PendingStageKey[] {
  return [
    meta.pendingHooks ? "hooks" : null,
    meta.pendingResearch || state?.research?.revision?.isPending ? "research" : null,
    meta.pendingScript || state?.script?.revision?.isPending ? "script" : null,
    meta.pendingSceneImages || state?.sceneImages?.revision?.isPending ? "scene-images" : null,
    meta.pendingVideo || state?.video?.revision?.isPending ? "video" : null,
  ].filter((stage): stage is PendingStageKey => Boolean(stage));
}

export function getShortFormProject(projectId: string): ShortFormProject | null {
  const meta = readProjectMeta(projectId);
  if (!meta) return null;

  const hooksResult = readHooksResult(projectId);
  const latestHookRequest = meta.latestHookRequest;
  const hookArtifactFresh = hasFreshHooksArtifact(projectId, latestHookRequest?.requestedAt);
  const hookRun = hookArtifactFresh
    ? undefined
    : findRelevantHookWorkflowRun(projectId, latestHookRequest?.requestedAt, latestHookRequest?.runId);
  const hookRunError = hookRun?.status === "failed"
    ? hookRun.errorMessage || "The latest hook generation run finished without writing hooks.json."
    : undefined;
  const research = { ...readStageDocument(projectId, "research", { pending: Boolean(meta.pendingResearch) }), pending: Boolean(meta.pendingResearch) };
  const script = { ...readStageDocument(projectId, "script", { pending: Boolean(meta.pendingScript) }), pending: Boolean(meta.pendingScript) };
  const sceneImages = { ...getSceneImagesStage(projectId, { pending: Boolean(meta.pendingSceneImages) }), pending: Boolean(meta.pendingSceneImages) };
  const video = { ...getVideoStage(projectId, { pending: Boolean(meta.pendingVideo) }), pending: Boolean(meta.pendingVideo) };

  const nextMeta = reconcilePendingStages(projectId, meta, {
    hooks: hooksResult,
    hookRun,
    hookArtifactFresh,
    research,
    script,
    sceneImages,
    video,
  });

  const resolvedSelectedHook = resolveSelectedHook(
    hooksResult.data,
    nextMeta.selectedHookId,
    nextMeta.selectedHookText
  );
  const canonicalHookGenerations = canonicalizeHookGenerations(hooksResult.data);
  const selectedHookId = resolvedSelectedHook?.id;
  const selectedHookText = resolvedSelectedHook?.text ?? nextMeta.selectedHookText;
  const resolvedImageStyle = resolveShortFormImageStyle(nextMeta.selectedImageStyleId);
  const resolvedVoice = resolveShortFormVoiceSelection(nextMeta.selectedVoiceId);

  const resolvedResearch = { ...research, pending: Boolean(nextMeta.pendingResearch || research.revision?.isPending) };
  const resolvedScript = { ...script, pending: Boolean(nextMeta.pendingScript || script.revision?.isPending) };
  const resolvedSceneImages = { ...sceneImages, pending: Boolean(nextMeta.pendingSceneImages || sceneImages.revision?.isPending) };
  const resolvedVideo = { ...video, pending: Boolean(nextMeta.pendingVideo || video.revision?.isPending) };

  const project: ShortFormProject = {
    id: nextMeta.id,
    topic: nextMeta.topic,
    title: nextMeta.title,
    createdAt: nextMeta.createdAt,
    updatedAt: nextMeta.updatedAt,
    selectedHookId,
    selectedHookText,
    selectedImageStyleId: resolvedImageStyle.resolvedStyleId,
    selectedImageStyleName: resolvedImageStyle.style.name,
    selectedVoiceId: resolvedVoice.resolvedVoiceId,
    selectedVoiceName: resolvedVoice.voice.name,
    currentStage: "topic",
    pendingStages: getPendingStages(nextMeta, {
      research: resolvedResearch,
      script: resolvedScript,
      sceneImages: resolvedSceneImages,
      video: resolvedVideo,
    }),
    hooks: {
      pending: Boolean(nextMeta.pendingHooks),
      generations: canonicalHookGenerations,
      selectedHookId,
      selectedHookText,
      validationError: hooksResult.error || hookRunError,
    },
    research: resolvedResearch,
    script: resolvedScript,
    sceneImages: resolvedSceneImages,
    video: resolvedVideo,
  };

  project.currentStage = inferCurrentStage(project);
  return project;
}

function readStageStatusSummary(projectId: string, stage: ShortFormStageKey) {
  const filePath = getStageFilePath(projectId, stage);
  if (!fs.existsSync(filePath)) {
    return { status: "draft" };
  }

  try {
    return {
      status: normalizeStatus(fs.readFileSync(filePath, "utf-8")),
    };
  } catch {
    return { status: "draft" };
  }
}

export function listShortFormProjectRows(): ShortFormProjectRow[] {
  ensureShortFormRoot();
  const dirs = fs
    .readdirSync(SHORT_FORM_VIDEOS_DIR)
    .filter((entry) => fs.statSync(path.join(SHORT_FORM_VIDEOS_DIR, entry)).isDirectory());

  const projects = dirs
    .map((dir): ShortFormProjectRow | null => {
      const meta = readProjectMeta(dir);
      if (!meta) return null;

      const research = readStageStatusSummary(dir, "research");
      const script = readStageStatusSummary(dir, "script");
      const sceneImages = readStageStatusSummary(dir, "scene-images");
      const sceneCount = readSceneManifestResult(dir).data.length;
      const video = readStageStatusSummary(dir, "video");
      const videoArtifactPath = getVideoArtifactPath(dir);
      const videoPath = videoArtifactPath
        ? path.relative(getProjectDir(dir), videoArtifactPath).split(path.sep).join("/")
        : undefined;
      const currentStage = videoPath
        ? "video"
        : sceneCount > 0
          ? "scene-images"
          : script.status !== "draft"
            ? "script"
            : research.status !== "draft"
              ? "research"
              : meta.selectedHookText
                ? "hook"
                : "topic";

      return {
        id: meta.id,
        topic: meta.topic,
        title: meta.title,
        createdAt: meta.createdAt,
        updatedAt: meta.updatedAt,
        currentStage,
        hooks: {
          selectedHookText: meta.selectedHookText,
        },
        research,
        script,
        sceneImages: {
          status: sceneImages.status,
          sceneCount,
        },
        video: {
          status: video.status,
          videoUrl: videoPath ? toMediaUrl(dir, videoPath) : undefined,
        },
      };
    })
    .filter((project): project is ShortFormProjectRow => Boolean(project));

  return projects.sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );
}

export function listShortFormProjects(): ShortFormProject[] {
  ensureShortFormRoot();
  const dirs = fs
    .readdirSync(SHORT_FORM_VIDEOS_DIR)
    .filter((entry) => fs.statSync(path.join(SHORT_FORM_VIDEOS_DIR, entry)).isDirectory());

  const projects = dirs
    .map((dir) => getShortFormProject(dir))
    .filter((project): project is ShortFormProject => Boolean(project));

  return projects.sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );
}

export function writeStageDocument(projectId: string, stage: ShortFormStageKey, content: string) {
  const filePath = getStageFilePath(projectId, stage);
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, content, "utf-8");
  updateProjectMeta(projectId, {});
  return filePath;
}

export function updateStageFrontMatterStatus(
  projectId: string,
  stage: ShortFormStageKey,
  status: string
) {
  const filePath = getStageFilePath(projectId, stage);
  if (!fs.existsSync(filePath)) return null;

  const content = fs.readFileSync(filePath, "utf-8");
  const parsed = parseFrontMatter(content);
  if (!parsed) {
    const next = [
      generateFrontMatter({ title: `${stage}`, status, date: new Date().toISOString() }),
      "",
      content,
    ].join("\n");
    fs.writeFileSync(filePath, next, "utf-8");
    return next;
  }

  const next = `${generateFrontMatter({
    ...parsed.frontMatter,
    status,
    updatedAt: new Date().toISOString(),
  })}\n\n${parsed.body}`;
  fs.writeFileSync(filePath, next, "utf-8");
  updateProjectMeta(projectId, {});
  return next;
}

export function updatePendingStage(projectId: string, stage: PendingStageKey, pending: boolean) {
  const fieldMap = {
    hooks: "pendingHooks",
    research: "pendingResearch",
    script: "pendingScript",
    "scene-images": "pendingSceneImages",
    video: "pendingVideo",
  } as const;

  const field = fieldMap[stage];
  return updateProjectMeta(projectId, { [field]: pending } as Partial<ShortFormProjectMeta>);
}
