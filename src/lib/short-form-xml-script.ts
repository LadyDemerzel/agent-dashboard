import fs from "fs";
import path from "path";
import { extractBody, generateFrontMatter, parseFrontMatter } from "@/lib/frontmatter";
import {
  resolveShortFormVoiceSelection,
  type ShortFormPauseRemovalSettings,
} from "@/lib/short-form-video-render-settings";

export interface XmlScriptPipelineDetail {
  id: string;
  label: string;
  format: "text" | "json";
  content: string;
}

export interface XmlScriptPipelineStep {
  id: string;
  label: string;
  status: "completed" | "active" | "pending" | "failed";
  summary?: string;
  updatedAt?: string;
  progressPercent?: number;
  progressLabel?: string;
  details?: XmlScriptPipelineDetail[];
}

export interface XmlCaptionSection {
  id: string;
  index: number;
  text: string;
  start: number;
  end: number;
  wordCount?: number;
}

export interface XmlScriptPipelineSummary {
  status: "running" | "completed" | "failed" | "idle";
  workDir?: string;
  audioPath?: string;
  originalAudioPath?: string;
  transcriptPath?: string;
  alignmentInputPath?: string;
  alignmentOutputPath?: string;
  captionPlanPath?: string;
  pauseRemovalSettingsPath?: string;
  warning?: string;
  steps: XmlScriptPipelineStep[];
}

export interface XmlScriptDocumentSummary {
  exists: boolean;
  status: string;
  content: string;
  updatedAt?: string;
  pending?: boolean;
  audioUrl?: string;
  audioPath?: string;
  originalAudioUrl?: string;
  originalAudioPath?: string;
  captions?: XmlCaptionSection[];
  pipeline?: XmlScriptPipelineSummary;
}

interface XmlScriptRunStatus {
  runId?: string;
  task?: "full" | "narration" | "silence" | "captions" | "visuals";
  status?: "running" | "verified" | "failed";
  startedAt?: string;
  verifiedAt?: string;
  failedAt?: string;
  errorMessage?: string;
  progress?: {
    step?: string;
    label?: string;
    percent?: number;
    current?: number;
    total?: number;
  };
  attempts?: Array<Record<string, unknown>>;
}

interface XmlScriptRunStatusFile extends XmlScriptRunStatus {
  filePath: string;
  mtimeMs: number;
}

const XML_SCRIPT_STALE_RUNNING_MS = 30 * 60 * 1000;
const XML_SCRIPT_STALE_NO_PROGRESS_MS = 2 * 60 * 1000;

function readJson<T>(filePath: string): T | undefined {
  if (!fs.existsSync(filePath)) return undefined;
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf-8")) as T;
  } catch {
    return undefined;
  }
}

function readText(filePath: string) {
  if (!fs.existsSync(filePath)) return undefined;
  try {
    return fs.readFileSync(filePath, "utf-8");
  } catch {
    return undefined;
  }
}

function normalizeComparableText(value: unknown) {
  return typeof value === "string" ? value.replace(/\r\n/g, "\n").trim() : undefined;
}

function stringify(value: unknown) {
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function fileUpdatedAt(filePath: string) {
  if (!fs.existsSync(filePath)) return undefined;
  try {
    return fs.statSync(filePath).mtime.toISOString();
  } catch {
    return undefined;
  }
}

function timestampToIso(value?: number) {
  return typeof value === "number" && Number.isFinite(value) ? new Date(value).toISOString() : undefined;
}

function normalizeStatus(content: string | undefined, fallback = "draft") {
  if (!content) return fallback;
  const parsed = parseFrontMatter(content);
  const status = parsed?.frontMatter.status;
  return typeof status === "string" && status.trim() ? status : fallback;
}

function getProjectDir(projectId: string) {
  return path.join(process.env.HOME || "/Users/ittaisvidler", "tenxsolo", "business", "content", "deliverables", "short-form-videos", projectId);
}

function toMediaUrl(projectId: string, relativePath: string) {
  const normalized = relativePath.split(path.sep).join("/");
  const absolutePath = path.join(getProjectDir(projectId), relativePath);
  let version = "";
  try {
    if (fs.existsSync(absolutePath)) {
      version = `?v=${encodeURIComponent(String(Math.floor(fs.statSync(absolutePath).mtimeMs)))}`;
    }
  } catch {}
  return `/api/short-form-videos/${projectId}/media/${normalized}${version}`;
}

export function getXmlScriptPath(projectId: string) {
  return path.join(getProjectDir(projectId), "xml-script.md");
}

export function getXmlScriptWorkDir(projectId: string) {
  return path.join(getProjectDir(projectId), "output", "xml-script-work");
}

export function getXmlScriptRunsDir(projectId: string) {
  return path.join(getProjectDir(projectId), ".xml-script-runs");
}

export function ensureXmlScriptDocument(projectId: string, topic: string) {
  const filePath = getXmlScriptPath(projectId);
  if (fs.existsSync(filePath)) return filePath;

  const content = [
    generateFrontMatter({
      title: `${topic || "Short-form video"} XML script`,
      status: "draft",
      date: new Date().toISOString(),
      agent: "workflow",
      tags: ["short-form-video", "xml-script"],
    }),
    "",
    "<video version=\"2\">\n  <script><!-- Waiting for the XML script pipeline to generate narration, alignment, captions, and visuals. --></script>\n  <assets></assets>\n  <timeline></timeline>\n</video>",
  ].join("\n");

  fs.writeFileSync(filePath, content, "utf-8");
  return filePath;
}

export function writeXmlScriptDocument(projectId: string, content: string) {
  const filePath = getXmlScriptPath(projectId);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, "utf-8");
  return filePath;
}

export function updateXmlScriptFrontMatterStatus(projectId: string, status: string) {
  const filePath = getXmlScriptPath(projectId);
  if (!fs.existsSync(filePath)) return null;
  const content = fs.readFileSync(filePath, "utf-8");
  const parsed = parseFrontMatter(content);
  if (!parsed) {
    const next = `${generateFrontMatter({ title: "XML script", status, date: new Date().toISOString(), agent: "workflow", tags: ["short-form-video", "xml-script"] })}\n\n${content}`;
    fs.writeFileSync(filePath, next, "utf-8");
    return next;
  }
  const next = `${generateFrontMatter({ ...parsed.frontMatter, status, updatedAt: new Date().toISOString() })}\n\n${parsed.body}`;
  fs.writeFileSync(filePath, next, "utf-8");
  return next;
}

function toTimestamp(value: unknown) {
  if (typeof value !== "string" || !value.trim()) return undefined;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function readRunStatuses(projectId: string): XmlScriptRunStatusFile[] {
  const runDir = getXmlScriptRunsDir(projectId);
  if (!fs.existsSync(runDir)) return [];
  try {
    return fs.readdirSync(runDir)
      .filter((entry) => entry.endsWith(".status.json"))
      .map((entry) => {
        const filePath = path.join(runDir, entry);
        const status = readJson<XmlScriptRunStatus>(filePath);
        if (!status) return undefined;
        return {
          ...status,
          filePath,
          mtimeMs: fs.statSync(filePath).mtimeMs,
        } satisfies XmlScriptRunStatusFile;
      })
      .filter((status): status is XmlScriptRunStatusFile => Boolean(status))
      .sort((a, b) => b.mtimeMs - a.mtimeMs);
  } catch {
    return [];
  }
}

function getLatestArtifactTimestamp(filePaths: string[]) {
  const timestamps = filePaths
    .map((filePath) => {
      try {
        return fs.existsSync(filePath) ? fs.statSync(filePath).mtimeMs : undefined;
      } catch {
        return undefined;
      }
    })
    .filter((value): value is number => typeof value === "number" && Number.isFinite(value));
  return timestamps.length > 0 ? Math.max(...timestamps) : undefined;
}

function getRunLastProgressTimestamp(run: XmlScriptRunStatusFile) {
  const attemptTimestamps = Array.isArray(run.attempts)
    ? run.attempts.flatMap((attempt) => [toTimestamp(attempt?.startedAt), toTimestamp(attempt?.finishedAt)].filter((value): value is number => typeof value === "number"))
    : [];

  return Math.max(
    run.mtimeMs,
    toTimestamp(run.startedAt) ?? 0,
    toTimestamp(run.verifiedAt) ?? 0,
    toTimestamp(run.failedAt) ?? 0,
    ...attemptTimestamps,
  );
}

function isStaleRunningRun(run: XmlScriptRunStatusFile, latestArtifactTimestamp?: number) {
  if (run.status !== "running") return false;

  const now = Date.now();
  const startedAt = toTimestamp(run.startedAt) ?? run.mtimeMs;
  const lastProgressAt = getRunLastProgressTimestamp(run);
  const hasAttempts = Array.isArray(run.attempts) && run.attempts.length > 0;

  if (!hasAttempts && now - lastProgressAt > XML_SCRIPT_STALE_NO_PROGRESS_MS) {
    return true;
  }

  if (now - lastProgressAt > XML_SCRIPT_STALE_RUNNING_MS) {
    return true;
  }

  if (latestArtifactTimestamp && latestArtifactTimestamp > startedAt + XML_SCRIPT_STALE_RUNNING_MS) {
    return true;
  }

  return false;
}

function readLatestRunStatus(projectId: string, artifactPaths: string[]): XmlScriptRunStatusFile | undefined {
  const statuses = readRunStatuses(projectId);
  if (statuses.length === 0) return undefined;

  const latestArtifactTimestamp = getLatestArtifactTimestamp(artifactPaths);
  const resolved = statuses.find((status) => !isStaleRunningRun(status, latestArtifactTimestamp));
  return resolved;
}

function getFreshArtifactTimestamp(filePath: string, freshnessFloorMs?: number) {
  if (!fs.existsSync(filePath)) return undefined;
  try {
    const mtimeMs = fs.statSync(filePath).mtimeMs;
    if (typeof freshnessFloorMs === "number" && Number.isFinite(freshnessFloorMs) && mtimeMs + 1000 < freshnessFloorMs) {
      return undefined;
    }
    return mtimeMs;
  } catch {
    return undefined;
  }
}

function roundPauseSetting(value: number, digits: number) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function pauseRemovalSettingsMatch(
  actual: unknown,
  expected?: ShortFormPauseRemovalSettings
) {
  if (!expected) return true;
  if (!actual || typeof actual !== "object" || Array.isArray(actual)) return false;

  const obj = actual as Record<string, unknown>;
  const actualMin = typeof obj.minSilenceDurationSeconds === "number" ? obj.minSilenceDurationSeconds : Number.NaN;
  const actualThreshold = typeof obj.silenceThresholdDb === "number" ? obj.silenceThresholdDb : Number.NaN;

  if (!Number.isFinite(actualMin) || !Number.isFinite(actualThreshold)) return false;

  return roundPauseSetting(actualMin, 2) === roundPauseSetting(expected.minSilenceDurationSeconds, 2)
    && roundPauseSetting(actualThreshold, 1) === roundPauseSetting(expected.silenceThresholdDb, 1);
}

export function getXmlScriptDocument(
  projectId: string,
  options?: { expectedVoiceId?: string; expectedPauseRemoval?: ShortFormPauseRemovalSettings }
): XmlScriptDocumentSummary {
  const filePath = getXmlScriptPath(projectId);
  const workDir = getXmlScriptWorkDir(projectId);
  const audioRelative = path.join("output", "xml-script-work", "voice", "narration-full.wav");
  const originalAudioRelative = path.join("output", "xml-script-work", "voice", "narration-original.wav");
  const transcriptPath = path.join(workDir, "voice", "text-script.txt");
  const voiceSelectionPath = path.join(workDir, "voice", "voice-selection.json");
  const pauseRemovalSettingsPath = path.join(workDir, "voice", "pause-removal-settings.json");
  const pauseRemovalReportPath = path.join(workDir, "voice", "pause-removal-result.json");
  const alignmentInputPath = path.join(workDir, "alignment", "alignment-input.json");
  const alignmentOutputPath = path.join(workDir, "alignment", "word-timestamps.json");
  const captionPlanPath = path.join(workDir, "captions", "caption-sections.json");
  const promptPath = path.join(workDir, "authoring", "xml-authoring-prompt.txt");
  const latestRun = readLatestRunStatus(projectId, [
    filePath,
    path.join(getProjectDir(projectId), audioRelative),
    path.join(getProjectDir(projectId), originalAudioRelative),
    alignmentOutputPath,
    captionPlanPath,
  ]);

  const content = fs.existsSync(filePath) ? fs.readFileSync(filePath, "utf-8") : "";
  const exists = Boolean(content);
  const status = normalizeStatus(content);
  const audioPath = path.join(getProjectDir(projectId), audioRelative);
  const originalAudioPath = path.join(getProjectDir(projectId), originalAudioRelative);
  const latestRunStartedAtMs = toTimestamp(latestRun?.startedAt);
  const activeTask = latestRun?.task || "full";
  const voiceSelectionFreshAt = fs.existsSync(voiceSelectionPath) ? fs.statSync(voiceSelectionPath).mtimeMs : undefined;
  const maxFreshnessFloor = (...values: Array<number | undefined>) => values
    .filter((value): value is number => typeof value === "number" && Number.isFinite(value))
    .reduce<number | undefined>((max, value) => (typeof max === "number" ? Math.max(max, value) : value), undefined);
  const audioRunFreshnessFloorMs = maxFreshnessFloor(
    voiceSelectionFreshAt,
    activeTask === "full" || activeTask === "narration" || activeTask === "silence" ? latestRunStartedAtMs : undefined,
  );
  const originalAudioFreshAt = getFreshArtifactTimestamp(
    originalAudioPath,
    maxFreshnessFloor(
      voiceSelectionFreshAt,
      activeTask === "full" || activeTask === "narration" ? latestRunStartedAtMs : undefined,
    )
  );
  const pauseRemovalSettingsFreshAt = getFreshArtifactTimestamp(pauseRemovalSettingsPath, audioRunFreshnessFloorMs);
  const xmlBody = extractBody(content);
  const processedAudioFreshAt = getFreshArtifactTimestamp(
    audioPath,
    maxFreshnessFloor(originalAudioFreshAt, pauseRemovalSettingsFreshAt, audioRunFreshnessFloorMs)
  );
  const transcriptFreshAt = getFreshArtifactTimestamp(
    transcriptPath,
    activeTask === "full" || activeTask === "narration" || activeTask === "silence" ? latestRunStartedAtMs : undefined
  );
  const alignmentInputFreshAt = getFreshArtifactTimestamp(
    alignmentInputPath,
    maxFreshnessFloor(processedAudioFreshAt, audioRunFreshnessFloorMs)
  );
  const transcriptContent = readText(transcriptPath);
  const alignmentInput = readJson<Record<string, unknown>>(alignmentInputPath);
  const normalizedTranscriptText = normalizeComparableText(transcriptContent);
  const normalizedAlignmentInputText = normalizeComparableText(alignmentInput?.text);
  const transcriptChangedSinceAlignment = Boolean(
    normalizedTranscriptText
    && normalizedAlignmentInputText
    && normalizedTranscriptText !== normalizedAlignmentInputText
  ) || Boolean(normalizedTranscriptText && !normalizedAlignmentInputText && transcriptFreshAt);
  const alignmentTranscriptDependencyFreshAt = transcriptChangedSinceAlignment
    ? transcriptFreshAt
    : alignmentInputFreshAt;
  const alignmentFreshAt = getFreshArtifactTimestamp(
    alignmentOutputPath,
    maxFreshnessFloor(processedAudioFreshAt, alignmentTranscriptDependencyFreshAt, audioRunFreshnessFloorMs)
  );
  const captionsFreshAt = getFreshArtifactTimestamp(
    captionPlanPath,
    maxFreshnessFloor(
      alignmentFreshAt,
      transcriptChangedSinceAlignment ? transcriptFreshAt : undefined,
      activeTask === "full" || activeTask === "captions" ? latestRunStartedAtMs : undefined,
    )
  );
  const promptFreshAt = getFreshArtifactTimestamp(promptPath, activeTask === "full" || activeTask === "visuals" ? latestRunStartedAtMs : undefined);
  const xmlFreshAt = getFreshArtifactTimestamp(
    filePath,
    maxFreshnessFloor(captionsFreshAt, activeTask === "full" || activeTask === "visuals" ? latestRunStartedAtMs : undefined)
  );
  const selectedVoice = readJson<{ id?: string; name?: string; resolvedVoiceId?: string }>(voiceSelectionPath);
  const expectedVoice = resolveShortFormVoiceSelection(options?.expectedVoiceId);
  const actualVoiceId = selectedVoice?.resolvedVoiceId || selectedVoice?.id;
  const voiceMatchesExpected = !actualVoiceId || actualVoiceId === expectedVoice.resolvedVoiceId;
  const pauseRemovalSettings = readJson<ShortFormPauseRemovalSettings>(pauseRemovalSettingsPath);
  const pauseRemovalReport = readJson<Record<string, unknown>>(pauseRemovalReportPath);
  const pauseRemovalMatchesExpected = pauseRemovalSettingsMatch(pauseRemovalSettings, options?.expectedPauseRemoval);

  const narrationDone = Boolean(originalAudioFreshAt) && voiceMatchesExpected;
  const silenceRemovalDone = Boolean(processedAudioFreshAt) && narrationDone && pauseRemovalMatchesExpected;
  const alignmentDone = Boolean(alignmentFreshAt) && silenceRemovalDone;
  const captionsDone = Boolean(captionsFreshAt) && alignmentDone;
  const xmlDone = Boolean(xmlFreshAt)
    && xmlBody.trim().length > 0
    && !xmlBody.includes("Waiting for the XML script pipeline")
    && captionsDone;
  const transcriptFresh = Boolean(transcriptFreshAt);
  const alignmentInputFresh = Boolean(alignmentInputFreshAt);
  const promptFresh = Boolean(promptFreshAt);
  const runFailed = latestRun?.status === "failed";
  const runActive = latestRun?.status === "running";
  const activeProgressStep = latestRun?.progress?.step;
  const activeProgressPercent = typeof latestRun?.progress?.percent === "number" ? Math.max(0, Math.min(100, latestRun.progress.percent)) : undefined;
  const activeProgressLabel = typeof latestRun?.progress?.label === "string" ? latestRun.progress.label : undefined;
  const voiceMismatchWarning = actualVoiceId && !voiceMatchesExpected
    ? `Narration artifacts were last generated with ${selectedVoice?.name || actualVoiceId}, but this project is now set to ${expectedVoice.voice.name}. Re-run Narration Audio so the original narration, silence-removed narration, alignment, and caption plan match the selected voice.`
    : undefined;
  const pauseRemovalMismatchWarning = options?.expectedPauseRemoval && !pauseRemovalMatchesExpected
    ? "Pause-removal artifacts were generated with older silence settings. Re-run pause removal + alignment so downstream captions and final video use the latest narration timing."
    : undefined;

  const doneMap: Record<string, boolean> = {
    narration: narrationDone,
    "silence-removal": silenceRemovalDone,
    alignment: alignmentDone,
    captions: captionsDone,
    xml: xmlDone,
  };
  const stepFailed = (stepId: string, done: boolean) => {
    if (!runFailed || done) return false;
    if (activeTask === "full") return true;
    if (activeTask === "narration") return stepId === "narration" || stepId === "silence-removal" || stepId === "alignment";
    if (activeTask === "silence") return stepId === "silence-removal" || stepId === "alignment";
    if (activeTask === "captions") return stepId === "captions";
    if (activeTask === "visuals") return stepId === "xml";
    return false;
  };
  const stepActive = (stepId: string, prerequisitesMet = true) => {
    if (!runActive || !prerequisitesMet) return false;
    if (activeTask === "full") return activeProgressStep ? activeProgressStep === stepId : !doneMap[stepId];
    if (activeTask === "narration") {
      if (activeProgressStep) return activeProgressStep === stepId;
      if (stepId === "narration") return true;
      if (stepId === "silence-removal") return narrationDone;
      if (stepId === "alignment") return silenceRemovalDone;
      return false;
    }
    if (activeTask === "silence") {
      if (activeProgressStep) return activeProgressStep === stepId;
      if (stepId === "silence-removal") return true;
      if (stepId === "alignment") return silenceRemovalDone;
      return false;
    }
    if (activeTask === "captions") return stepId === "captions";
    if (activeTask === "visuals") return stepId === "xml";
    return false;
  };

  const resolveStepStatus = (stepId: string, done: boolean, prerequisitesMet = true) => {
    if (stepFailed(stepId, done)) return "failed" as const;
    if (stepActive(stepId, prerequisitesMet)) return "active" as const;
    if (done) return "completed" as const;
    return "pending" as const;
  };

  const steps: XmlScriptPipelineStep[] = [
    {
      id: "narration",
      label: "Generate original narration audio",
      status: resolveStepStatus("narration", narrationDone),
      summary: narrationDone ? "Original AI narration audio is ready for comparison and downstream processing." : "Waiting for Qwen narration output.",
      updatedAt: narrationDone ? timestampToIso(originalAudioFreshAt) : undefined,
      progressPercent: activeProgressStep === "narration" ? activeProgressPercent : undefined,
      progressLabel: activeProgressStep === "narration" ? activeProgressLabel : undefined,
      details: [
        transcriptFresh
          ? { id: "transcript", label: "Narration transcript", format: "text", content: fs.readFileSync(transcriptPath, "utf-8") }
          : undefined,
        fs.existsSync(voiceSelectionPath)
          ? { id: "voice-selection", label: "Narration voice selection", format: "json", content: stringify(readJson(voiceSelectionPath)) }
          : undefined,
      ].filter((item): item is XmlScriptPipelineDetail => Boolean(item)),
    },
    {
      id: "silence-removal",
      label: "Remove pauses / silences",
      status: resolveStepStatus("silence-removal", silenceRemovalDone, narrationDone || fs.existsSync(originalAudioPath) || fs.existsSync(audioPath)),
      summary: silenceRemovalDone
        ? "Silence-removed narration audio is ready and becomes the downstream source of truth."
        : "Waiting for the pause-removal pass to create the silence-removed narration WAV.",
      updatedAt: silenceRemovalDone ? timestampToIso(processedAudioFreshAt) : undefined,
      progressPercent: activeProgressStep === "silence-removal" ? activeProgressPercent : undefined,
      progressLabel: activeProgressStep === "silence-removal" ? activeProgressLabel : undefined,
      details: [
        pauseRemovalSettingsFreshAt
          ? { id: "pause-removal-settings", label: "Pause-removal settings", format: "json", content: stringify(pauseRemovalSettings) }
          : undefined,
        silenceRemovalDone
          ? {
              id: "pause-removal-artifacts",
              label: "Pause-removal artifacts",
              format: "json",
              content: stringify({
                originalAudioPath,
                processedAudioPath: audioPath,
                reportPath: pauseRemovalReportPath,
                ...(pauseRemovalReport || {}),
              }),
            }
          : undefined,
      ].filter((item): item is XmlScriptPipelineDetail => Boolean(item)),
    },
    {
      id: "alignment",
      label: "Run forced alignment",
      status: resolveStepStatus("alignment", alignmentDone, silenceRemovalDone || fs.existsSync(audioPath)),
      summary: alignmentDone ? "Forced-alignment output is available for the silence-removed narration." : "Waiting for alignment input/output.",
      updatedAt: alignmentDone ? timestampToIso(alignmentFreshAt) : undefined,
      progressPercent: activeProgressStep === "alignment" ? activeProgressPercent : undefined,
      progressLabel: activeProgressStep === "alignment" ? activeProgressLabel : undefined,
      details: [
        alignmentInputFresh
          ? { id: "alignment-input", label: "Alignment input", format: "json", content: stringify(readJson(alignmentInputPath)) }
          : undefined,
        alignmentDone
          ? { id: "alignment-output", label: "Alignment output", format: "json", content: stringify(readJson(alignmentOutputPath)) }
          : undefined,
      ].filter((item): item is XmlScriptPipelineDetail => Boolean(item)),
    },
    {
      id: "captions",
      label: "Generate deterministic captions",
      status: resolveStepStatus("captions", captionsDone, alignmentDone),
      summary: captionsDone ? "Deterministic caption JSON was derived from the latest alignment." : "Waiting for deterministic caption output.",
      updatedAt: captionsDone ? timestampToIso(captionsFreshAt) : undefined,
      details: [
        captionsDone
          ? { id: "caption-plan", label: "Deterministic captions JSON", format: "json", content: stringify(readJson(captionPlanPath)) }
          : undefined,
      ].filter((item): item is XmlScriptPipelineDetail => Boolean(item)),
    },
    {
      id: "xml",
      label: "Plan visuals",
      status: resolveStepStatus("xml", xmlDone, captionsDone),
      summary: xmlDone ? "XML visuals file written successfully." : "Waiting for XML authoring output.",
      updatedAt: xmlDone ? timestampToIso(xmlFreshAt) : undefined,
      details: [
        promptFresh
          ? { id: "xml-prompt", label: "Authoring prompt", format: "text", content: fs.readFileSync(promptPath, "utf-8") }
          : undefined,
      ].filter((item): item is XmlScriptPipelineDetail => Boolean(item)),
    },
  ];

  const captionPayload = readJson<{ captions?: Array<Record<string, unknown>> }>(captionPlanPath);
  const captions = Array.isArray(captionPayload?.captions)
    ? captionPayload.captions
        .map((item, index) => ({
          id: typeof item.id === "string" && item.id.trim() ? item.id.trim() : `caption-${index + 1}`,
          index: typeof item.index === "number" ? item.index : index + 1,
          text: typeof item.text === "string" ? item.text : "",
          start: typeof item.start === "number" ? item.start : 0,
          end: typeof item.end === "number" ? item.end : 0,
          wordCount: typeof item.wordCount === "number" ? item.wordCount : undefined,
        }))
        .filter((item) => item.text && item.end > item.start)
    : undefined;

  return {
    exists,
    status,
    content,
    updatedAt: exists ? timestampToIso(xmlFreshAt) || fileUpdatedAt(filePath) : undefined,
    pending: runActive,
    audioUrl: processedAudioFreshAt ? toMediaUrl(projectId, audioRelative) : undefined,
    audioPath: processedAudioFreshAt ? audioRelative.split(path.sep).join("/") : undefined,
    originalAudioUrl: originalAudioFreshAt ? toMediaUrl(projectId, originalAudioRelative) : undefined,
    originalAudioPath: originalAudioFreshAt ? originalAudioRelative.split(path.sep).join("/") : undefined,
    captions,
    pipeline: {
      status: runFailed ? "failed" : xmlDone ? "completed" : runActive ? "running" : "idle",
      workDir,
      audioPath: processedAudioFreshAt ? audioPath : undefined,
      originalAudioPath: originalAudioFreshAt ? originalAudioPath : undefined,
      transcriptPath: transcriptFresh ? transcriptPath : undefined,
      alignmentInputPath: alignmentInputFresh ? alignmentInputPath : undefined,
      alignmentOutputPath: alignmentDone ? alignmentOutputPath : undefined,
      captionPlanPath: captionsDone ? captionPlanPath : undefined,
      pauseRemovalSettingsPath: pauseRemovalSettingsFreshAt ? pauseRemovalSettingsPath : undefined,
      warning: [voiceMismatchWarning, pauseRemovalMismatchWarning, latestRun?.errorMessage].filter(Boolean).join(" ") || undefined,
      steps,
    },
  };
}
