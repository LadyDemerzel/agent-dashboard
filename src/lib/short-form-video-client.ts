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

export interface StageAgentRunClient {
  sessionId?: string;
  startedAt?: string;
  failedAt?: string;
  completedAt?: string;
  lastEventAt?: string;
  errorMessage?: string;
  completionReason?: string;
}

export interface StageRevisionClient {
  requestedAt?: string;
  requestText?: string;
  threadId?: string;
  sceneId?: string;
  mode?: 'generate' | 'revise';
  action?: 'generate' | 'revise' | 'request-scene-change';
  isPending: boolean;
  isFailed: boolean;
  isStale: boolean;
  warning?: string;
  agentRun?: StageAgentRunClient;
}

export interface SceneImageProgressSummaryClient {
  total: number;
  completed: number;
  pending: number;
  scope: 'all' | 'single';
  targetSceneId?: string;
}

export interface StageDoc {
  exists: boolean;
  status: string;
  content: string;
  updatedAt?: string;
  openThreads: number;
  pending?: boolean;
  validationError?: string;
  revision?: StageRevisionClient;
}

export interface VideoPipelineDetailClient {
  id: string;
  label: string;
  format: 'text' | 'json';
  content: string;
}

export interface VideoPipelineStepClient {
  id: string;
  label: string;
  status: 'completed' | 'active' | 'pending' | 'failed';
  summary?: string;
  updatedAt?: string;
  details?: VideoPipelineDetailClient[];
}

export interface VideoPipelineClient {
  status: 'running' | 'completed' | 'failed' | 'idle';
  workDir?: string;
  manifestPath?: string;
  transcriptPath?: string;
  alignmentInputPath?: string;
  alignmentOutputPath?: string;
  warning?: string;
  steps: VideoPipelineStepClient[];
}

export interface Scene {
  id: string;
  number: number;
  caption: string;
  image?: string;
  previewImage?: string;
  notes?: string;
  status?: 'completed' | 'in-progress';
}

export interface ShortFormProjectClient {
  id: string;
  title: string;
  topic: string;
  createdAt: string;
  updatedAt: string;
  pendingStages: Array<'hooks' | 'research' | 'script' | 'scene-images' | 'video'>;
  selectedHookId?: string;
  selectedHookText?: string;
  selectedImageStyleId?: string;
  selectedImageStyleName?: string;
  selectedVoiceId?: string;
  selectedVoiceName?: string;
  hooks: {
    pending: boolean;
    generations: HookGeneration[];
    selectedHookId?: string;
    selectedHookText?: string;
    validationError?: string;
  };
  research: StageDoc;
  script: StageDoc;
  sceneImages: StageDoc & { scenes: Scene[]; sceneProgress?: SceneImageProgressSummaryClient };
  video: StageDoc & { videoUrl?: string; videoPath?: string; pipeline?: VideoPipelineClient };
}

export interface ShortFormProjectRowClient {
  id: string;
  title: string;
  topic: string;
  updatedAt: string;
  createdAt: string;
  currentStage: string;
  hooks: { selectedHookText?: string };
  research: { status: string };
  script: { status: string };
  sceneImages: { status: string; sceneCount: number };
  video: { status: string; videoUrl?: string };
}

function asObject(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function asOptionalString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function asBoolean(value: unknown, fallback = false): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function normalizeHookOption(value: unknown): HookOption | null {
  const obj = asObject(value);
  const id = asString(obj.id);
  const text = asString(obj.text);

  if (!id || !text) return null;

  return {
    id,
    text,
    rationale: asOptionalString(obj.rationale),
  };
}

function normalizeHookGeneration(value: unknown): HookGeneration | null {
  const obj = asObject(value);
  const id = asString(obj.id);
  const createdAt = asString(obj.createdAt);
  const options = Array.isArray(obj.options)
    ? obj.options.map(normalizeHookOption).filter((option): option is HookOption => Boolean(option))
    : [];

  if (!id || !createdAt || options.length === 0) return null;

  return {
    id,
    createdAt,
    description: asOptionalString(obj.description),
    options,
  };
}

function normalizeVideoPipeline(value: unknown): VideoPipelineClient | undefined {
  const obj = asObject(value);
  if (Object.keys(obj).length === 0) return undefined;

  const steps = Array.isArray(obj.steps)
    ? obj.steps
        .map((step) => {
          const stepObj = asObject(step);
          const id = asString(stepObj.id);
          const label = asString(stepObj.label);
          if (!id || !label) return null;

          const details = Array.isArray(stepObj.details)
            ? stepObj.details
                .map((detail) => {
                  const detailObj = asObject(detail);
                  const detailId = asString(detailObj.id);
                  const detailLabel = asString(detailObj.label);
                  const format = detailObj.format === 'json' ? 'json' : 'text';
                  const content = asString(detailObj.content);
                  if (!detailId || !detailLabel || !content) return null;
                  return { id: detailId, label: detailLabel, format, content } as VideoPipelineDetailClient;
                })
                .filter((detail): detail is VideoPipelineDetailClient => Boolean(detail))
            : [];

          const status = stepObj.status === 'completed'
            ? 'completed'
            : stepObj.status === 'active'
              ? 'active'
              : stepObj.status === 'failed'
                ? 'failed'
                : 'pending';

          return {
            id,
            label,
            status,
            summary: asOptionalString(stepObj.summary),
            updatedAt: asOptionalString(stepObj.updatedAt),
            details,
          } as VideoPipelineStepClient;
        })
        .filter((step): step is VideoPipelineStepClient => Boolean(step))
    : [];

  return {
    status: obj.status === 'completed' ? 'completed' : obj.status === 'failed' ? 'failed' : obj.status === 'running' ? 'running' : 'idle',
    workDir: asOptionalString(obj.workDir),
    manifestPath: asOptionalString(obj.manifestPath),
    transcriptPath: asOptionalString(obj.transcriptPath),
    alignmentInputPath: asOptionalString(obj.alignmentInputPath),
    alignmentOutputPath: asOptionalString(obj.alignmentOutputPath),
    warning: asOptionalString(obj.warning),
    steps,
  };
}

function normalizeStageDoc(value: unknown): StageDoc {
  const obj = asObject(value);
  const revisionObj = asObject(obj.revision);
  const agentRunObj = asObject(revisionObj.agentRun);

  const revision: StageRevisionClient | undefined = Object.keys(revisionObj).length > 0
    ? {
        requestedAt: asOptionalString(revisionObj.requestedAt),
        requestText: asOptionalString(revisionObj.requestText),
        threadId: asOptionalString(revisionObj.threadId),
        sceneId: asOptionalString(revisionObj.sceneId),
        mode:
          revisionObj.mode === 'generate'
            ? 'generate'
            : revisionObj.mode === 'revise'
              ? 'revise'
              : undefined,
        action:
          revisionObj.action === 'generate'
            ? 'generate'
            : revisionObj.action === 'revise'
              ? 'revise'
              : revisionObj.action === 'request-scene-change'
                ? 'request-scene-change'
                : undefined,
        isPending: asBoolean(revisionObj.isPending),
        isFailed: asBoolean(revisionObj.isFailed),
        isStale: asBoolean(revisionObj.isStale),
        warning: asOptionalString(revisionObj.warning),
        agentRun: Object.keys(agentRunObj).length > 0
          ? {
              sessionId: asOptionalString(agentRunObj.sessionId),
              startedAt: asOptionalString(agentRunObj.startedAt),
              failedAt: asOptionalString(agentRunObj.failedAt),
              completedAt: asOptionalString(agentRunObj.completedAt),
              lastEventAt: asOptionalString(agentRunObj.lastEventAt),
              errorMessage: asOptionalString(agentRunObj.errorMessage),
              completionReason: asOptionalString(agentRunObj.completionReason),
            }
          : undefined,
      }
    : undefined;

  return {
    exists: asBoolean(obj.exists),
    status: asString(obj.status, 'draft'),
    content: asString(obj.content),
    updatedAt: asOptionalString(obj.updatedAt),
    openThreads: typeof obj.openThreads === 'number' ? obj.openThreads : 0,
    pending: asBoolean(obj.pending),
    validationError: asOptionalString(obj.validationError),
    revision,
  };
}

function normalizeScene(value: unknown): Scene | null {
  const obj = asObject(value);
  const id = asString(obj.id);
  const caption = asString(obj.caption);
  const number = typeof obj.number === 'number' ? obj.number : 0;

  if (!id || !caption || number < 1) return null;

  return {
    id,
    number,
    caption,
    image: asOptionalString(obj.image),
    previewImage: asOptionalString(obj.previewImage),
    notes: asOptionalString(obj.notes),
    status: obj.status === 'in-progress' ? 'in-progress' : obj.status === 'completed' ? 'completed' : undefined,
  };
}

function normalizeSceneImageProgressSummary(value: unknown): SceneImageProgressSummaryClient | undefined {
  const obj = asObject(value);
  if (Object.keys(obj).length === 0) return undefined;

  const total = typeof obj.total === 'number' ? obj.total : 0;
  const completed = typeof obj.completed === 'number' ? obj.completed : 0;
  const pending = typeof obj.pending === 'number' ? obj.pending : 0;

  if (total < 1) return undefined;

  return {
    total,
    completed,
    pending,
    scope: obj.scope === 'single' ? 'single' : 'all',
    targetSceneId: asOptionalString(obj.targetSceneId),
  };
}

export function normalizeShortFormProject(value: unknown): ShortFormProjectClient {
  const obj = asObject(value);
  const hooks = asObject(obj.hooks);
  const research = normalizeStageDoc(obj.research);
  const script = normalizeStageDoc(obj.script);
  const sceneImagesObj = asObject(obj.sceneImages);
  const videoObj = asObject(obj.video);
  const sceneImagesBase = normalizeStageDoc(sceneImagesObj);
  const videoBase = normalizeStageDoc(videoObj);

  const generations = Array.isArray(hooks.generations)
    ? hooks.generations.map(normalizeHookGeneration).filter((generation): generation is HookGeneration => Boolean(generation))
    : [];

  const pendingStages = Array.isArray(obj.pendingStages)
    ? obj.pendingStages.filter(
        (stage): stage is 'hooks' | 'research' | 'script' | 'scene-images' | 'video' =>
          stage === 'hooks' || stage === 'research' || stage === 'script' || stage === 'scene-images' || stage === 'video'
      )
    : [];

  const scenes = Array.isArray(sceneImagesObj.scenes)
    ? sceneImagesObj.scenes
        .map(normalizeScene)
        .filter((scene): scene is Scene => Boolean(scene))
    : [];

  return {
    id: asString(obj.id),
    title: asString(obj.title),
    topic: asString(obj.topic),
    createdAt: asString(obj.createdAt),
    updatedAt: asString(obj.updatedAt),
    pendingStages,
    selectedHookId: asOptionalString(obj.selectedHookId),
    selectedHookText: asOptionalString(obj.selectedHookText),
    selectedImageStyleId: asOptionalString(obj.selectedImageStyleId),
    selectedImageStyleName: asOptionalString(obj.selectedImageStyleName),
    selectedVoiceId: asOptionalString(obj.selectedVoiceId),
    selectedVoiceName: asOptionalString(obj.selectedVoiceName),
    hooks: {
      pending: asBoolean(hooks.pending),
      generations,
      selectedHookId: asOptionalString(hooks.selectedHookId),
      selectedHookText: asOptionalString(hooks.selectedHookText),
      validationError: asOptionalString(hooks.validationError),
    },
    research,
    script,
    sceneImages: {
      ...sceneImagesBase,
      scenes,
      sceneProgress: normalizeSceneImageProgressSummary(sceneImagesObj.sceneProgress),
    },
    video: {
      ...videoBase,
      videoUrl: asOptionalString(videoObj.videoUrl),
      videoPath: asOptionalString(videoObj.videoPath),
      pipeline: normalizeVideoPipeline(videoObj.pipeline),
    },
  };
}

export function normalizeShortFormProjectRow(value: unknown): ShortFormProjectRowClient {
  const obj = asObject(value);
  const project = normalizeShortFormProject(value);
  const rawSceneImages = asObject(obj.sceneImages);
  const rawSceneCount = rawSceneImages.sceneCount;
  const sceneCount = typeof rawSceneCount === 'number' && Number.isFinite(rawSceneCount)
    ? rawSceneCount
    : project.sceneImages.scenes.length;

  return {
    id: project.id,
    title: project.title,
    topic: project.topic,
    updatedAt: project.updatedAt,
    createdAt: project.createdAt,
    currentStage: asString(obj.currentStage),
    hooks: { selectedHookText: project.hooks.selectedHookText ?? project.selectedHookText },
    research: { status: project.research.status },
    script: { status: project.script.status },
    sceneImages: { status: project.sceneImages.status, sceneCount },
    video: { status: project.video.status, videoUrl: project.video.videoUrl },
  };
}
