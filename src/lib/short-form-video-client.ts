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
  scope: 'all' | 'single' | 'chain';
  targetSceneId?: string;
  targetSceneIds?: string[];
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


export interface TextScriptIterationClient {
  number: number;
  kind: 'generated' | 'manual';
  createdAt?: string;
  updatedAt?: string;
  draftPath?: string;
  draftContent: string;
  reviewPath?: string;
  overallGrade?: number;
  reviewDecision?: 'pass' | 'needs-improvement' | 'manual-edit';
  reviewFeedback?: string;
  reviewContent?: string;
  reviewSummary?: string;
  isFinal?: boolean;
}

export interface TextScriptRunClient {
  runId: string;
  startedAt?: string;
  completedAt?: string;
  mode?: 'generate' | 'revise';
  status: 'passed' | 'max-iterations-reached' | 'manual-edit' | 'running' | 'failed' | 'unknown';
  maxIterations: number;
  passingScore?: number;
  overrideMaxIterations?: number;
  reviewPrompt?: string;
  finalIterationNumber?: number;
  activeStep?: 'writing' | 'reviewing' | 'improving' | 'completed';
  activeIterationNumber?: number;
  activeStatusText?: string;
  iterations: TextScriptIterationClient[];
}

export interface VideoPipelineDetailClient {
  id: string;
  label: string;
  format: 'text' | 'json';
  content: string;
}

export interface XmlPipelineStepClient {
  id: string;
  label: string;
  status: 'completed' | 'active' | 'pending' | 'failed';
  summary?: string;
  updatedAt?: string;
  progressPercent?: number;
  progressLabel?: string;
  details?: VideoPipelineDetailClient[];
}

export interface XmlPipelineClient {
  status: 'running' | 'completed' | 'failed' | 'idle';
  workDir?: string;
  audioPath?: string;
  originalAudioPath?: string;
  transcriptPath?: string;
  alignmentInputPath?: string;
  alignmentOutputPath?: string;
  captionPlanPath?: string;
  warning?: string;
  steps: XmlPipelineStepClient[];
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

export interface CaptionSection {
  id: string;
  index: number;
  text: string;
  start: number;
  end: number;
  wordCount?: number;
}

export interface Scene {
  id: string;
  number: number;
  caption: string;
  startTime?: number;
  endTime?: number;
  image?: string;
  previewImage?: string;
  previewVideo?: string;
  previewVideoBackgroundId?: string;
  notes?: string;
  imageId?: string;
  basedOnImageId?: string;
  reusedExistingAsset?: boolean;
  visualId?: string;
  status?: 'completed' | 'in-progress';
}

export interface SoundDesignResolvedEventClient {
  id: string;
  type: 'impact' | 'riser' | 'click' | 'whoosh' | 'ambience' | 'music-riser' | 'music-reverb-tail' | 'mix-duck' | 'mix-eq';
  track: string;
  anchor: string;
  sceneId?: string;
  captionId?: string;
  offsetMs: number;
  assetId?: string;
  assetName?: string;
  assetRelativePath?: string;
  timingType?: 'point' | 'bed' | 'riser';
  resolvedStartSeconds: number;
  resolvedEndSeconds?: number;
  durationSeconds?: number;
  resolvedGainDb: number;
  resolvedFadeInMs: number;
  resolvedFadeOutMs: number;
  duckingDb: number;
  muted?: boolean;
  solo?: boolean;
  manualAssetId?: string;
  manualGainDb?: number;
  manualNudgeMs?: number;
  compatibleAssetIds?: string[];
  status: 'resolved' | 'unresolved';
  resolutionReason?: string;
  rationale?: string;
  notes?: string;
  overlap?: 'allow' | 'avoid';
  groupId?: string;
  frequencyBand?: 'low' | 'mid' | 'high' | 'full-range';
  layerRole?: string;
  stylePalette?: string;
  literalness?: 'literal' | 'stylized' | 'emotional-metaphor';
  musicDuckingDb?: number;
  musicEqCutDb?: number;
  musicEqFrequencyHz?: number;
  musicEqQ?: number;
  musicLowCutHz?: number;
  musicHighCutHz?: number;
}

export interface SoundDesignSummaryClient extends StageDoc {
  previewAudioUrl?: string;
  previewAudioPath?: string;
  reviewAudioUrls?: Record<string, string>;
  resolution?: {
    version: number;
    generatedAt: string;
    previewAudioRelativePath?: string;
    previewUpdatedAt?: string;
    events: SoundDesignResolvedEventClient[];
    stats: {
      total: number;
      resolved: number;
      unresolved: number;
    };
  };
}

export interface ShortFormProjectClient {
  id: string;
  title: string;
  topic: string;
  createdAt: string;
  updatedAt: string;
  pendingStages: Array<'hooks' | 'research' | 'script' | 'scene-images' | 'sound-design' | 'video'>;
  selectedHookId?: string;
  selectedHookText?: string;
  selectedImageStyleId?: string;
  selectedImageStyleName?: string;
  selectedVoiceId?: string;
  selectedVoiceName?: string;
  selectedMusicId?: string;
  selectedMusicName?: string;
  selectedBackgroundVideoId?: string;
  selectedBackgroundVideoName?: string;
  selectedCaptionStyleId?: string;
  selectedCaptionStyleName?: string;
  captionStyleOverrideId?: string;
  soundDesignDecision?: 'approved' | 'skipped';
  soundDesignSkipReason?: string;
  chromaKeyEnabled: boolean;
  chromaKeyEnabledSource: 'project' | 'default';
  chromaKeyEnabledOverride?: boolean;
  captionMaxWordsOverride?: number;
  pauseRemovalMinSilenceDurationSecondsOverride?: number;
  pauseRemovalSilenceThresholdDbOverride?: number;
  hooks: {
    pending: boolean;
    generations: HookGeneration[];
    selectedHookId?: string;
    selectedHookText?: string;
    validationError?: string;
  };
  research: StageDoc;
  script: StageDoc & { textScriptRuns?: TextScriptRunClient[]; textScriptLatestRunId?: string; textScriptMaxIterationsOverride?: number };
  xmlScript: StageDoc & {
    audioUrl?: string;
    audioPath?: string;
    originalAudioUrl?: string;
    originalAudioPath?: string;
    captions?: CaptionSection[];
    pipeline?: XmlPipelineClient;
  };
  sceneImages: StageDoc & { scenes: Scene[]; sceneProgress?: SceneImageProgressSummaryClient };
  soundDesign: SoundDesignSummaryClient;
  video: StageDoc & { videoUrl?: string; videoPath?: string; pipeline?: VideoPipelineClient };
}

export interface ShortFormProjectRowClient {
  id: string;
  title: string;
  topic: string;
  updatedAt: string;
  createdAt: string;
  currentStage: string;
  hooks: { selectedHookText?: string; pending?: boolean };
  research: { status: string; pending?: boolean };
  script: { status: string; pending?: boolean; textScriptLatestRunId?: string; textScriptMaxIterationsOverride?: number };
  xmlScript: {
    status: string;
    pending?: boolean;
    audioUrl?: string;
    captionsCount?: number;
    pipeline?: XmlPipelineClient;
  };
  sceneImages: { status: string; sceneCount: number; pending?: boolean };
  soundDesign: { status: string; eventCount: number; pending?: boolean };
  video: { status: string; videoUrl?: string; pending?: boolean };
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

function normalizeCaptionSection(value: unknown): CaptionSection | null {
  const obj = asObject(value);
  const id = asString(obj.id);
  const text = asString(obj.text);
  const index = typeof obj.index === 'number' ? obj.index : 0;
  const start = typeof obj.start === 'number' ? obj.start : Number.NaN;
  const end = typeof obj.end === 'number' ? obj.end : Number.NaN;
  if (!id || !text || index < 1 || !Number.isFinite(start) || !Number.isFinite(end) || end <= start) return null;
  return { id, index, text, start, end, wordCount: typeof obj.wordCount === 'number' ? obj.wordCount : undefined };
}

function normalizePipelineDetail(value: unknown): VideoPipelineDetailClient | null {
  const detailObj = asObject(value);
  const detailId = asString(detailObj.id);
  const detailLabel = asString(detailObj.label);
  const format = detailObj.format === 'json' ? 'json' : 'text';
  const content = asString(detailObj.content);
  if (!detailId || !detailLabel || !content) return null;
  return { id: detailId, label: detailLabel, format, content };
}

function normalizeXmlPipeline(value: unknown): XmlPipelineClient | undefined {
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
            ? stepObj.details.map(normalizePipelineDetail).filter((detail): detail is VideoPipelineDetailClient => Boolean(detail))
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
            progressPercent: typeof stepObj.progressPercent === 'number' ? stepObj.progressPercent : undefined,
            progressLabel: asOptionalString(stepObj.progressLabel),
            details,
          } as XmlPipelineStepClient;
        })
        .filter((step): step is XmlPipelineStepClient => Boolean(step))
    : [];

  return {
    status: obj.status === 'completed' ? 'completed' : obj.status === 'failed' ? 'failed' : obj.status === 'running' ? 'running' : 'idle',
    workDir: asOptionalString(obj.workDir),
    audioPath: asOptionalString(obj.audioPath),
    originalAudioPath: asOptionalString(obj.originalAudioPath),
    transcriptPath: asOptionalString(obj.transcriptPath),
    alignmentInputPath: asOptionalString(obj.alignmentInputPath),
    alignmentOutputPath: asOptionalString(obj.alignmentOutputPath),
    captionPlanPath: asOptionalString(obj.captionPlanPath),
    warning: asOptionalString(obj.warning),
    steps,
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
            ? stepObj.details.map(normalizePipelineDetail).filter((detail): detail is VideoPipelineDetailClient => Boolean(detail))
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

function normalizeTextScriptIteration(value: unknown): TextScriptIterationClient | null {
  const obj = asObject(value);
  const number = typeof obj.number === 'number' ? obj.number : 0;
  const draftContent = asString(obj.draftContent);
  if (number < 1 || !draftContent) return null;

  return {
    number,
    kind: obj.kind === 'manual' ? 'manual' : 'generated',
    createdAt: asOptionalString(obj.createdAt),
    updatedAt: asOptionalString(obj.updatedAt),
    draftPath: asOptionalString(obj.draftPath),
    draftContent,
    reviewPath: asOptionalString(obj.reviewPath),
    overallGrade: typeof obj.overallGrade === 'number' ? obj.overallGrade : undefined,
    reviewDecision: obj.reviewDecision === 'pass'
      ? 'pass'
      : obj.reviewDecision === 'needs-improvement'
        ? 'needs-improvement'
        : obj.reviewDecision === 'manual-edit'
          ? 'manual-edit'
          : undefined,
    reviewFeedback: asOptionalString(obj.reviewFeedback),
    reviewContent: asOptionalString(obj.reviewContent),
    reviewSummary: asOptionalString(obj.reviewSummary),
    isFinal: typeof obj.isFinal === 'boolean' ? obj.isFinal : undefined,
  };
}

function normalizeTextScriptRun(value: unknown): TextScriptRunClient | undefined {
  const obj = asObject(value);
  const runId = asString(obj.runId);
  if (!runId) return undefined;

  const iterations = Array.isArray(obj.iterations)
    ? obj.iterations.map(normalizeTextScriptIteration).filter((item): item is TextScriptIterationClient => Boolean(item))
    : [];

  return {
    runId,
    startedAt: asOptionalString(obj.startedAt),
    completedAt: asOptionalString(obj.completedAt),
    mode: obj.mode === 'revise' ? 'revise' : obj.mode === 'generate' ? 'generate' : undefined,
    status: obj.status === 'passed'
      ? 'passed'
      : obj.status === 'max-iterations-reached'
        ? 'max-iterations-reached'
        : obj.status === 'manual-edit'
          ? 'manual-edit'
          : obj.status === 'running'
            ? 'running'
            : obj.status === 'failed'
              ? 'failed'
            : 'unknown',
    maxIterations: typeof obj.maxIterations === 'number' ? obj.maxIterations : Math.max(1, iterations.length || 1),
    passingScore: typeof obj.passingScore === 'number' ? obj.passingScore : undefined,
    overrideMaxIterations: typeof obj.overrideMaxIterations === 'number' ? obj.overrideMaxIterations : undefined,
    reviewPrompt: asOptionalString(obj.reviewPrompt),
    finalIterationNumber: typeof obj.finalIterationNumber === 'number' ? obj.finalIterationNumber : undefined,
    activeStep: obj.activeStep === 'writing'
      ? 'writing'
      : obj.activeStep === 'reviewing'
        ? 'reviewing'
        : obj.activeStep === 'improving'
          ? 'improving'
          : obj.activeStep === 'completed'
            ? 'completed'
            : undefined,
    activeIterationNumber: typeof obj.activeIterationNumber === 'number' ? obj.activeIterationNumber : undefined,
    activeStatusText: asOptionalString(obj.activeStatusText),
    iterations,
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
    startTime: typeof obj.startTime === 'number' ? obj.startTime : undefined,
    endTime: typeof obj.endTime === 'number' ? obj.endTime : undefined,
    image: asOptionalString(obj.image),
    previewImage: asOptionalString(obj.previewImage),
    previewVideo: asOptionalString(obj.previewVideo),
    previewVideoBackgroundId: asOptionalString(obj.previewVideoBackgroundId),
    notes: asOptionalString(obj.notes),
    imageId: asOptionalString(obj.imageId),
    basedOnImageId: asOptionalString(obj.basedOnImageId),
    reusedExistingAsset: typeof obj.reusedExistingAsset === 'boolean' ? obj.reusedExistingAsset : undefined,
    visualId: asOptionalString(obj.visualId),
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
    scope: obj.scope === 'single' ? 'single' : obj.scope === 'chain' ? 'chain' : 'all',
    targetSceneId: asOptionalString(obj.targetSceneId),
    targetSceneIds: Array.isArray(obj.targetSceneIds)
      ? obj.targetSceneIds.filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
      : undefined,
  };
}

export function normalizeShortFormProject(value: unknown): ShortFormProjectClient {
  const obj = asObject(value);
  const hooks = asObject(obj.hooks);
  const research = normalizeStageDoc(obj.research);
  const scriptObj = asObject(obj.script);
  const script = normalizeStageDoc(scriptObj);
  const xmlScriptObj = asObject(obj.xmlScript);
  const xmlScriptCaptions = Array.isArray(xmlScriptObj.captions) ? xmlScriptObj.captions.map(normalizeCaptionSection).filter((item): item is CaptionSection => Boolean(item)) : undefined;
  const xmlScript = normalizeStageDoc(xmlScriptObj);
  const sceneImagesObj = asObject(obj.sceneImages);
  const soundDesignObj = asObject(obj.soundDesign);
  const videoObj = asObject(obj.video);
  const sceneImagesBase = normalizeStageDoc(sceneImagesObj);
  const soundDesignBase = normalizeStageDoc(soundDesignObj);
  const videoBase = normalizeStageDoc(videoObj);

  const generations = Array.isArray(hooks.generations)
    ? hooks.generations.map(normalizeHookGeneration).filter((generation): generation is HookGeneration => Boolean(generation))
    : [];

  const pendingStages = Array.isArray(obj.pendingStages)
    ? obj.pendingStages.filter(
        (stage): stage is 'hooks' | 'research' | 'script' | 'scene-images' | 'sound-design' | 'video' =>
          stage === 'hooks'
          || stage === 'research'
          || stage === 'script'
          || stage === 'scene-images'
          || stage === 'sound-design'
          || stage === 'video'
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
    selectedMusicId: asOptionalString(obj.selectedMusicId),
    selectedMusicName: asOptionalString(obj.selectedMusicName),
    selectedBackgroundVideoId: asOptionalString(obj.selectedBackgroundVideoId),
    selectedBackgroundVideoName: asOptionalString(obj.selectedBackgroundVideoName),
    selectedCaptionStyleId: asOptionalString(obj.selectedCaptionStyleId),
    selectedCaptionStyleName: asOptionalString(obj.selectedCaptionStyleName),
    captionStyleOverrideId: asOptionalString(obj.captionStyleOverrideId),
    soundDesignDecision: obj.soundDesignDecision === 'approved' || obj.soundDesignDecision === 'skipped' ? obj.soundDesignDecision : undefined,
    soundDesignSkipReason: asOptionalString(obj.soundDesignSkipReason),
    chromaKeyEnabled: asBoolean(obj.chromaKeyEnabled),
    chromaKeyEnabledSource: obj.chromaKeyEnabledSource === 'project' ? 'project' : 'default',
    chromaKeyEnabledOverride: typeof obj.chromaKeyEnabledOverride === 'boolean' ? obj.chromaKeyEnabledOverride : undefined,
    captionMaxWordsOverride: typeof obj.captionMaxWordsOverride === 'number' ? obj.captionMaxWordsOverride : undefined,
    pauseRemovalMinSilenceDurationSecondsOverride: typeof obj.pauseRemovalMinSilenceDurationSecondsOverride === 'number'
      ? obj.pauseRemovalMinSilenceDurationSecondsOverride
      : undefined,
    pauseRemovalSilenceThresholdDbOverride: typeof obj.pauseRemovalSilenceThresholdDbOverride === 'number'
      ? obj.pauseRemovalSilenceThresholdDbOverride
      : undefined,
    hooks: {
      pending: asBoolean(hooks.pending),
      generations,
      selectedHookId: asOptionalString(hooks.selectedHookId),
      selectedHookText: asOptionalString(hooks.selectedHookText),
      validationError: asOptionalString(hooks.validationError),
    },
    research,
    script: {
      ...script,
      textScriptRuns: Array.isArray(scriptObj.textScriptRuns)
        ? scriptObj.textScriptRuns
            .map(normalizeTextScriptRun)
            .filter((run): run is TextScriptRunClient => Boolean(run))
        : undefined,
      textScriptLatestRunId: asOptionalString(scriptObj.textScriptLatestRunId),
      textScriptMaxIterationsOverride: typeof scriptObj.textScriptMaxIterationsOverride === 'number'
        ? scriptObj.textScriptMaxIterationsOverride
        : undefined,
    },
    xmlScript: {
      ...xmlScript,
      audioUrl: asOptionalString(xmlScriptObj.audioUrl),
      audioPath: asOptionalString(xmlScriptObj.audioPath),
      originalAudioUrl: asOptionalString(xmlScriptObj.originalAudioUrl),
      originalAudioPath: asOptionalString(xmlScriptObj.originalAudioPath),
      captions: xmlScriptCaptions,
      pipeline: normalizeXmlPipeline(xmlScriptObj.pipeline),
    },
    sceneImages: {
      ...sceneImagesBase,
      scenes,
      sceneProgress: normalizeSceneImageProgressSummary(sceneImagesObj.sceneProgress),
    },
    soundDesign: {
      ...soundDesignBase,
      previewAudioUrl: asOptionalString(soundDesignObj.previewAudioUrl),
      previewAudioPath: asOptionalString(soundDesignObj.previewAudioPath),
      reviewAudioUrls: (() => {
        const reviewAudioUrls = asObject(soundDesignObj.reviewAudioUrls);
        const entries = Object.entries(reviewAudioUrls)
          .filter((entry): entry is [string, string] => typeof entry[0] === 'string' && typeof entry[1] === 'string' && entry[1].length > 0);
        return entries.length > 0 ? Object.fromEntries(entries) : undefined;
      })(),
      resolution: (() => {
        const resolution = asObject(soundDesignObj.resolution);
        const events = Array.isArray(resolution.events)
          ? resolution.events.map((event) => {
              const item = asObject(event);
              return {
                id: asString(item.id),
                type: item.type === 'riser' || item.type === 'click' || item.type === 'whoosh' || item.type === 'ambience' || item.type === 'music-riser' || item.type === 'music-reverb-tail' || item.type === 'mix-duck' || item.type === 'mix-eq' ? item.type : 'impact',
                track: asString(item.track),
                anchor: asString(item.anchor),
                sceneId: asOptionalString(item.sceneId),
                captionId: asOptionalString(item.captionId),
                offsetMs: typeof item.offsetMs === 'number' ? item.offsetMs : 0,
                assetId: asOptionalString(item.assetId),
                assetName: asOptionalString(item.assetName),
                assetRelativePath: asOptionalString(item.assetRelativePath),
                timingType: item.timingType === 'bed' || item.timingType === 'riser' ? item.timingType : item.timingType === 'point' ? 'point' : undefined,
                resolvedStartSeconds: typeof item.resolvedStartSeconds === 'number' ? item.resolvedStartSeconds : 0,
                resolvedEndSeconds: typeof item.resolvedEndSeconds === 'number' ? item.resolvedEndSeconds : undefined,
                durationSeconds: typeof item.durationSeconds === 'number' ? item.durationSeconds : undefined,
                resolvedGainDb: typeof item.resolvedGainDb === 'number' ? item.resolvedGainDb : 0,
                resolvedFadeInMs: typeof item.resolvedFadeInMs === 'number' ? item.resolvedFadeInMs : 0,
                resolvedFadeOutMs: typeof item.resolvedFadeOutMs === 'number' ? item.resolvedFadeOutMs : 0,
                duckingDb: typeof item.duckingDb === 'number' ? item.duckingDb : -8,
                muted: asBoolean(item.muted),
                solo: asBoolean(item.solo),
                manualAssetId: asOptionalString(item.manualAssetId),
                manualGainDb: typeof item.manualGainDb === 'number' ? item.manualGainDb : undefined,
                manualNudgeMs: typeof item.manualNudgeMs === 'number' ? item.manualNudgeMs : undefined,
                compatibleAssetIds: Array.isArray(item.compatibleAssetIds)
                  ? item.compatibleAssetIds.filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
                  : undefined,
                status: item.status === 'resolved' ? 'resolved' : 'unresolved',
                resolutionReason: asOptionalString(item.resolutionReason),
                rationale: asOptionalString(item.rationale),
                notes: asOptionalString(item.notes),
                overlap: item.overlap === 'allow' ? 'allow' : item.overlap === 'avoid' ? 'avoid' : undefined,
                groupId: asOptionalString(item.groupId),
                frequencyBand: item.frequencyBand === 'low' || item.frequencyBand === 'mid' || item.frequencyBand === 'high' || item.frequencyBand === 'full-range' ? item.frequencyBand : undefined,
                layerRole: asOptionalString(item.layerRole),
                stylePalette: asOptionalString(item.stylePalette),
                literalness: item.literalness === 'literal' || item.literalness === 'stylized' || item.literalness === 'emotional-metaphor' ? item.literalness : undefined,
                musicDuckingDb: typeof item.musicDuckingDb === 'number' ? item.musicDuckingDb : undefined,
                musicEqCutDb: typeof item.musicEqCutDb === 'number' ? item.musicEqCutDb : undefined,
                musicEqFrequencyHz: typeof item.musicEqFrequencyHz === 'number' ? item.musicEqFrequencyHz : undefined,
                musicEqQ: typeof item.musicEqQ === 'number' ? item.musicEqQ : undefined,
                musicLowCutHz: typeof item.musicLowCutHz === 'number' ? item.musicLowCutHz : undefined,
                musicHighCutHz: typeof item.musicHighCutHz === 'number' ? item.musicHighCutHz : undefined,
              } as SoundDesignResolvedEventClient;
            })
          : [];
        if (!events.length && typeof resolution.version !== 'number' && typeof resolution.generatedAt !== 'string') {
          return undefined;
        }
        return {
          version: typeof resolution.version === 'number' ? resolution.version : 1,
          generatedAt: asString(resolution.generatedAt),
          previewAudioRelativePath: asOptionalString(resolution.previewAudioRelativePath),
          previewUpdatedAt: asOptionalString(resolution.previewUpdatedAt),
          events,
          stats: {
            total: typeof asObject(resolution.stats).total === 'number' ? Number(asObject(resolution.stats).total) : events.length,
            resolved: typeof asObject(resolution.stats).resolved === 'number' ? Number(asObject(resolution.stats).resolved) : events.filter((event) => event.status === 'resolved').length,
            unresolved: typeof asObject(resolution.stats).unresolved === 'number' ? Number(asObject(resolution.stats).unresolved) : events.filter((event) => event.status !== 'resolved').length,
          },
        };
      })(),
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
  const hooks = asObject(obj.hooks);
  const research = asObject(obj.research);
  const script = asObject(obj.script);
  const xmlScript = asObject(obj.xmlScript);
  const sceneImagesBase = asObject(obj.sceneImages);
  const soundDesignBase = asObject(obj.soundDesign);
  const videoBase = asObject(obj.video);
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
    hooks: {
      selectedHookText: project.hooks.selectedHookText ?? project.selectedHookText,
      pending: asBoolean(hooks.pending),
    },
    research: { status: project.research.status, pending: asBoolean(research.pending) },
    script: {
      status: project.script.status,
      pending: asBoolean(script.pending),
      textScriptLatestRunId: project.script.textScriptLatestRunId,
      textScriptMaxIterationsOverride: project.script.textScriptMaxIterationsOverride,
    },
    xmlScript: {
      status: project.xmlScript.status,
      pending: asBoolean(xmlScript.pending),
      audioUrl: project.xmlScript.audioUrl,
      captionsCount: project.xmlScript.captions?.length || 0,
      pipeline: project.xmlScript.pipeline,
    },
    sceneImages: { status: project.sceneImages.status, sceneCount, pending: asBoolean(sceneImagesBase.pending) },
    soundDesign: {
      status: asString(soundDesignBase.status, project.soundDesign.status),
      eventCount: typeof soundDesignBase.eventCount === 'number' && Number.isFinite(soundDesignBase.eventCount)
        ? soundDesignBase.eventCount
        : project.soundDesign.resolution?.events.length || 0,
      pending: asBoolean(soundDesignBase.pending),
    },
    video: { status: project.video.status, videoUrl: project.video.videoUrl, pending: asBoolean(videoBase.pending) },
  };
}
