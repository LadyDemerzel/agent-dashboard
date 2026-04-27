import fs from "fs";
import path from "path";

const HOME_DIR = process.env.HOME || "/Users/ittaisvidler";
const SHORT_FORM_VIDEOS_DIR = path.join(
  HOME_DIR,
  "tenxsolo",
  "business",
  "content",
  "deliverables",
  "short-form-videos"
);

const SETTINGS_PATH = path.join(SHORT_FORM_VIDEOS_DIR, "_sound-design-settings.json");
const SOUND_LIBRARY_DIR = path.join(SHORT_FORM_VIDEOS_DIR, "_sound-library");

const DEFAULT_PLANNING_BRIEF_TEMPLATE = [
  "Create a tasteful but confidently designed sound-design plan for this short-form video.",
  "Use the saved sound-design library when choosing semantic sound cues.",
  "Bias away from under-designing. Plan richer, more frequent sound effects where the edit supports them, especially on transitions, reveals, movement, scene changes, and strong caption beats.",
  "Keep narration clear and well-supported, but do not default to sparse minimal coverage.",
  "Return compact XML inside <soundDesign> with self-closing <event /> tags.",
].join("\n");

const DEFAULT_REVISION_PROMPT_TEMPLATE = "Revision notes: {{revisionNotes}}";

const LEGACY_PROMPT_HINTS = [
  "Create a tasteful sound-design plan for this short-form video.",
  "Create a tasteful but confidently designed sound-design plan for this short-form video.",
  "Use the saved sound-design library when choosing semantic sound cues.",
  "Prefer restraint, clarity, and timing that supports the narration.",
  "Keep narration clear and well-supported, but do not default to sparse minimal coverage.",
  "Return compact XML inside <soundDesign> with self-closing <event /> tags.",
];

function buildTopLevelSoundDesignPromptTemplate(planningBriefTemplate: string) {
  return [
    "You are handling the Plan Sound Design artifact for the Agent Dashboard short-form workflow.",
    "",
    "Write the final sound-design markdown artifact to this exact path:",
    "{{soundDesignPath}}",
    "",
    "Workflow context:",
    "- Project topic: {{topic}}",
    "- Selected hook: {{selectedHookTextOrFallback}}",
    "- Project directory: {{projectDir}}",
    "",
    "{{revisionNotesBlock}}",
    "Inputs you must read before writing:",
    "- XML script artifact: {{xmlScriptPath}}",
    "- Caption timing JSON: {{captionPlanPath}}",
    "- Scene manifest JSON: {{sceneManifestPath}}",
    "",
    "Saved sound library JSON:",
    "{{soundLibraryJson}}",
    "",
    "Dashboard planning instructions for this project:",
    planningBriefTemplate,
    "",
    "Artifact requirements:",
    "- Write YAML front matter first with title, status: needs review, date, agent: Scribe, and category: sound-design.",
    "- After the front matter, write raw <soundDesign> XML only.",
    "- Use one <soundDesign version=\"1\" duckingDb=\"...\" maxConcurrentOneShots=\"...\"> root element.",
    "- Inside it, return only self-closing <event /> tags for timed cues.",
    "- Every event must include id, type, track, anchor, and the relevant sceneId or captionId when timing depends on them.",
    "- Keep cues tasteful and narration-supportive, but do not under-design the soundtrack.",
    "- Bias toward purposeful cue density where the edit supports it, especially across hook punctuation, transitions, reveals, motion accents, and major caption turns.",
    "- Use the saved library as the allowed source palette when choosing cue types and event intent.",
    "- Write the updated artifact back to {{soundDesignPath}}, then read it back and verify the file exists and contains a <soundDesign> root.",
  ].join("\n");
}

const DEFAULT_PROMPT_TEMPLATE = buildTopLevelSoundDesignPromptTemplate(DEFAULT_PLANNING_BRIEF_TEMPLATE);

const DEFAULT_SOUND_LIBRARY: ShortFormSoundLibraryEntry[] = [
  {
    id: "impact-soft-hit",
    name: "Soft hit",
    category: "Impact",
    semanticTypes: ["impact"],
    tags: ["subtle", "reveal", "punctuation"],
    timingType: "point",
    defaultAnchor: "scene-start",
    defaultGainDb: -5,
    defaultFadeInMs: 0,
    defaultFadeOutMs: 180,
    recommendedUses: "Opening punctuation, reveal beats, subtle emphasis.",
    avoidUses: "Avoid stacking on every caption beat.",
    notes: "Starter slot. Upload a real asset and save the library.",
    license: "Internal",
    createdAt: "2026-04-21T00:00:00.000Z",
    updatedAt: "2026-04-21T00:00:00.000Z",
  },
  {
    id: "whoosh-subtle-transition",
    name: "Subtle transition whoosh",
    category: "Whoosh",
    semanticTypes: ["whoosh"],
    tags: ["transition", "movement", "clean"],
    timingType: "point",
    defaultAnchor: "scene-start",
    defaultGainDb: -7,
    defaultFadeInMs: 0,
    defaultFadeOutMs: 240,
    recommendedUses: "Scene transitions and motion accents.",
    avoidUses: "Avoid on static scenes or every sentence.",
    notes: "Starter slot. Upload a real asset and save the library.",
    license: "Internal",
    createdAt: "2026-04-21T00:00:00.000Z",
    updatedAt: "2026-04-21T00:00:00.000Z",
  },
  {
    id: "ambience-air-bed",
    name: "Air texture",
    category: "Ambience",
    semanticTypes: ["ambience"],
    tags: ["texture", "air", "light"],
    timingType: "bed",
    defaultAnchor: "scene-start",
    defaultGainDb: -18,
    defaultFadeInMs: 220,
    defaultFadeOutMs: 320,
    recommendedUses: "Quiet atmospheric support under sparse sections.",
    avoidUses: "Avoid when narration or music is already dense.",
    notes: "Starter slot. Upload a real asset and save the library.",
    license: "Internal",
    createdAt: "2026-04-21T00:00:00.000Z",
    updatedAt: "2026-04-21T00:00:00.000Z",
  },
];

export type ShortFormSoundSemanticType = "impact" | "riser" | "click" | "whoosh" | "ambience";
export type ShortFormSoundTimingType = "point" | "bed" | "riser";
export type ShortFormSoundAnchor = "scene-start" | "scene-end" | "caption-start" | "caption-end" | "global-start" | "global-end";

export interface ShortFormSoundLibraryEntry {
  id: string;
  name: string;
  category: string;
  semanticTypes: ShortFormSoundSemanticType[];
  tags: string[];
  timingType: ShortFormSoundTimingType;
  defaultAnchor: ShortFormSoundAnchor;
  defaultGainDb: number;
  defaultFadeInMs: number;
  defaultFadeOutMs: number;
  recommendedUses: string;
  avoidUses: string;
  notes: string;
  source?: string;
  license?: string;
  audioRelativePath?: string;
  audioUrl?: string;
  durationSeconds?: number;
  sampleRate?: number;
  channels?: number;
  anchorRatio?: number;
  waveformPeaks?: number[];
  uploadedAt?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface ShortFormSoundDesignSettings {
  promptTemplate: string;
  revisionPromptTemplate: string;
  defaultDuckingDb: number;
  maxConcurrentOneShots: number;
  library: ShortFormSoundLibraryEntry[];
}

export interface ShortFormSoundDesignTrackGroup {
  id: string;
  name: string;
  gainDb: number;
  notes?: string;
}

export type ShortFormSoundDesignAnchor = ShortFormSoundAnchor;
export type ShortFormSoundDesignTiming = ShortFormSoundTimingType;

export interface ShortFormSoundDesignEvent {
  id: string;
  type: ShortFormSoundSemanticType;
  trackGroupId?: string;
  track?: string;
  anchor: ShortFormSoundDesignAnchor;
  sceneId?: string;
  captionId?: string;
  offsetMs: number;
  gainDb?: number;
  fadeInMs?: number;
  fadeOutMs?: number;
  notes?: string;
  rationale?: string;
  overlap?: "allow" | "avoid";
}

export interface ShortFormSoundDesignMix {
  defaultDuckingDb: number;
  maxConcurrentOneShots: number;
}

export interface ShortFormSoundDesignArtifact {
  version: number;
  source: "generated" | "manual";
  createdAt: string;
  updatedAt: string;
  promptSnapshot?: string;
  notes?: string;
  mix?: ShortFormSoundDesignMix;
  trackGroups: ShortFormSoundDesignTrackGroup[];
  events: ShortFormSoundDesignEvent[];
}

export interface ShortFormSoundDesignSummary {
  exists: boolean;
  path: string;
  content: string;
  updatedAt?: string;
  artifact?: ShortFormSoundDesignArtifact | null;
  previewPath?: string;
  finalMixPath?: string;
}

function ensureDir(dirPath: string) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function normalizeString(value: unknown, fallback = "") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function normalizeOptionalString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function normalizeStringArray(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0).map((item) => item.trim())
    : [];
}

function normalizeNumber(value: unknown, min: number, max: number, fallback: number, digits = 0) {
  const parsed = typeof value === "number" ? value : typeof value === "string" ? Number(value) : Number.NaN;
  if (!Number.isFinite(parsed)) return fallback;
  const factor = 10 ** digits;
  const rounded = Math.round(parsed * factor) / factor;
  return Math.min(max, Math.max(min, rounded));
}

function normalizeOptionalNumber(value: unknown, min: number, max: number, digits = 0) {
  const parsed = typeof value === "number" ? value : typeof value === "string" ? Number(value) : Number.NaN;
  if (!Number.isFinite(parsed)) return undefined;
  const factor = 10 ** digits;
  const rounded = Math.round(parsed * factor) / factor;
  return Math.min(max, Math.max(min, rounded));
}

function normalizeSemanticTypes(value: unknown): ShortFormSoundSemanticType[] {
  const allowed = new Set<ShortFormSoundSemanticType>(["impact", "riser", "click", "whoosh", "ambience"]);
  const types = normalizeStringArray(value).filter((item): item is ShortFormSoundSemanticType => allowed.has(item as ShortFormSoundSemanticType));
  return types.length > 0 ? types : ["impact"];
}

function normalizeTimingType(value: unknown): ShortFormSoundTimingType {
  return value === "bed" || value === "riser" ? value : "point";
}

function normalizeAnchor(value: unknown): ShortFormSoundAnchor {
  return value === "scene-end"
    || value === "caption-start"
    || value === "caption-end"
    || value === "global-start"
    || value === "global-end"
    ? value
    : "scene-start";
}

function normalizeWaveformPeaks(value: unknown) {
  return Array.isArray(value)
    ? value
        .map((item) => (typeof item === "number" && Number.isFinite(item) ? Math.max(0, Math.min(1, item)) : null))
        .filter((item): item is number => item !== null)
    : undefined;
}

function resolveSoundLibraryAbsolutePath(relativePath?: string) {
  if (!relativePath) return null;
  const baseDir = path.resolve(SOUND_LIBRARY_DIR);
  const absolutePath = path.resolve(baseDir, relativePath);
  if (absolutePath !== baseDir && !absolutePath.startsWith(`${baseDir}${path.sep}`)) {
    return null;
  }
  return absolutePath;
}

function analyzeStoredWavFile(filePath: string, bucketCount = 240) {
  try {
    const buffer = fs.readFileSync(filePath);
    if (buffer.length < 44) return {};
    if (buffer.toString("ascii", 0, 4) !== "RIFF" || buffer.toString("ascii", 8, 12) !== "WAVE") {
      return {};
    }

    let channels = 0;
    let sampleRate = 0;
    let bitsPerSample = 0;
    let blockAlign = 0;
    let dataOffset = 0;
    let dataSize = 0;

    for (let offset = 12; offset + 8 <= buffer.length;) {
      const chunkId = buffer.toString("ascii", offset, offset + 4);
      const chunkSize = buffer.readUInt32LE(offset + 4);
      const chunkDataStart = offset + 8;
      const chunkDataEnd = Math.min(buffer.length, chunkDataStart + chunkSize);

      if (chunkId === "fmt " && chunkDataEnd - chunkDataStart >= 16) {
        const audioFormat = buffer.readUInt16LE(chunkDataStart);
        if (audioFormat !== 1 && audioFormat !== 65534) {
          return {};
        }
        channels = buffer.readUInt16LE(chunkDataStart + 2);
        sampleRate = buffer.readUInt32LE(chunkDataStart + 4);
        blockAlign = buffer.readUInt16LE(chunkDataStart + 12);
        bitsPerSample = buffer.readUInt16LE(chunkDataStart + 14);
      } else if (chunkId === "data") {
        dataOffset = chunkDataStart;
        dataSize = Math.max(0, chunkDataEnd - chunkDataStart);
      }

      offset = chunkDataStart + chunkSize + (chunkSize % 2);
    }

    if (!channels || !sampleRate || !bitsPerSample || !blockAlign || !dataOffset || !dataSize) {
      return {};
    }

    const bytesPerSample = bitsPerSample / 8;
    if (!Number.isInteger(bytesPerSample) || bytesPerSample <= 0) {
      return {};
    }

    const totalFrames = Math.floor(dataSize / blockAlign);
    const durationSeconds = totalFrames > 0
      ? Math.round((totalFrames / sampleRate) * 1000) / 1000
      : undefined;

    const safeBucketCount = Math.max(32, Math.min(512, Math.round(bucketCount)));
    const peaks = Array.from({ length: safeBucketCount }, () => 0);

    for (let frameIndex = 0; frameIndex < totalFrames; frameIndex += 1) {
      const bucketIndex = Math.min(safeBucketCount - 1, Math.floor((frameIndex * safeBucketCount) / totalFrames));
      const frameOffset = dataOffset + frameIndex * blockAlign;
      let framePeak = 0;

      for (let channelIndex = 0; channelIndex < channels; channelIndex += 1) {
        const sampleOffset = frameOffset + channelIndex * bytesPerSample;
        if (sampleOffset + bytesPerSample > buffer.length) {
          continue;
        }

        let normalizedSample = 0;
        if (bitsPerSample === 8) {
          normalizedSample = Math.abs(buffer.readUInt8(sampleOffset) - 128) / 128;
        } else if (bitsPerSample === 16) {
          normalizedSample = Math.abs(buffer.readInt16LE(sampleOffset)) / 32768;
        } else if (bitsPerSample === 24) {
          normalizedSample = Math.abs(buffer.readIntLE(sampleOffset, 3)) / 8388608;
        } else if (bitsPerSample === 32) {
          normalizedSample = Math.abs(buffer.readInt32LE(sampleOffset)) / 2147483648;
        } else {
          return {
            durationSeconds,
            sampleRate,
            channels,
          };
        }

        if (normalizedSample > framePeak) {
          framePeak = normalizedSample;
        }
      }

      if (framePeak > peaks[bucketIndex]) {
        peaks[bucketIndex] = framePeak;
      }
    }

    return {
      durationSeconds,
      sampleRate,
      channels,
      waveformPeaks: peaks.map((peak) => Math.round(Math.max(0, Math.min(1, peak)) * 1000) / 1000),
    };
  } catch {
    return {};
  }
}

export function getStoredSoundLibraryAudioAnalysis(relativePath?: string) {
  const absolutePath = resolveSoundLibraryAbsolutePath(relativePath);
  if (!absolutePath || !fs.existsSync(absolutePath) || !fs.statSync(absolutePath).isFile()) {
    return {};
  }
  return analyzeStoredWavFile(absolutePath);
}

function buildSoundAudioUrl(relativePath?: string, cacheKey?: string) {
  if (!relativePath) return undefined;
  const encodedPath = relativePath
    .split("/")
    .filter(Boolean)
    .map((part) => encodeURIComponent(part))
    .join("/");
  return `/api/short-form-videos/settings/sound-library-files/${encodedPath}${cacheKey ? `?v=${encodeURIComponent(cacheKey)}` : ""}`;
}

function normalizeLibraryEntry(candidate: Partial<ShortFormSoundLibraryEntry> | null | undefined, index: number): ShortFormSoundLibraryEntry {
  const now = new Date().toISOString();
  const uploadedAt = normalizeOptionalString(candidate?.uploadedAt);
  const updatedAt = normalizeOptionalString(candidate?.updatedAt) || uploadedAt;
  return {
    id: normalizeString(candidate?.id, `sound-${index + 1}`),
    name: normalizeString(candidate?.name, `Sound ${index + 1}`),
    category: normalizeString(candidate?.category, "Impact"),
    semanticTypes: normalizeSemanticTypes(candidate?.semanticTypes),
    tags: normalizeStringArray(candidate?.tags),
    timingType: normalizeTimingType(candidate?.timingType),
    defaultAnchor: normalizeAnchor(candidate?.defaultAnchor),
    defaultGainDb: normalizeNumber(candidate?.defaultGainDb, -36, 12, -6, 1),
    defaultFadeInMs: normalizeNumber(candidate?.defaultFadeInMs, 0, 10_000, 0, 0),
    defaultFadeOutMs: normalizeNumber(candidate?.defaultFadeOutMs, 0, 10_000, 180, 0),
    recommendedUses: normalizeString(candidate?.recommendedUses, ""),
    avoidUses: normalizeString(candidate?.avoidUses, ""),
    notes: normalizeString(candidate?.notes, ""),
    source: normalizeOptionalString(candidate?.source),
    license: normalizeOptionalString(candidate?.license),
    audioRelativePath: normalizeOptionalString(candidate?.audioRelativePath),
    durationSeconds: normalizeOptionalNumber(candidate?.durationSeconds, 0, 600, 3),
    sampleRate: normalizeOptionalNumber(candidate?.sampleRate, 1, 384000, 0),
    channels: normalizeOptionalNumber(candidate?.channels, 1, 64, 0),
    anchorRatio: normalizeOptionalNumber(candidate?.anchorRatio, 0, 1, 3) ?? 0,
    waveformPeaks: normalizeWaveformPeaks(candidate?.waveformPeaks),
    uploadedAt,
    createdAt: normalizeOptionalString(candidate?.createdAt) || now,
    updatedAt: updatedAt || now,
  };
}

function normalizePromptTemplate(value: unknown) {
  if (typeof value !== "string" || !value.trim()) {
    return DEFAULT_PROMPT_TEMPLATE;
  }

  let normalized = value.replace(/\r/g, "").trim();
  normalized = normalized.replaceAll("{{selectedHook}}", "{{selectedHookTextOrFallback}}");
  normalized = normalized.replace(/^[ \t]*Revision notes:\s*\{\{\s*revisionNotes\s*\}\}[ \t]*$/gm, "{{revisionNotesBlock}}");
  normalized = normalized.replace(
    "Create a tasteful sound-design plan for this short-form video.",
    "Create a tasteful but confidently designed sound-design plan for this short-form video.",
  );
  normalized = normalized.replace(
    "Prefer restraint, clarity, and timing that supports the narration.",
    "Bias away from under-designing. Plan richer, more frequent sound effects where the edit supports them, especially on transitions, reveals, movement, scene changes, and strong caption beats. Keep narration clear and well-supported, but do not default to sparse minimal coverage.",
  );
  normalized = normalized.replace(
    "- Keep cues tasteful, sparse, and narration-supportive. Prefer fewer better events over dense layering.",
    "- Keep cues tasteful and narration-supportive, but do not under-design the soundtrack.\n- Bias toward purposeful cue density where the edit supports it, especially across hook punctuation, transitions, reveals, motion accents, and major caption turns.",
  );

  const alreadyTopLevel = normalized.includes("{{soundDesignPath}}")
    || normalized.includes("Saved sound library JSON:")
    || normalized.includes("Artifact requirements:")
    || normalized.includes("Write the final sound-design markdown artifact to this exact path:");

  if (!alreadyTopLevel) {
    const legacyHintMatches = LEGACY_PROMPT_HINTS.filter((hint) => normalized.includes(hint)).length;
    if (legacyHintMatches >= 2) {
      normalized = buildTopLevelSoundDesignPromptTemplate(normalized);
    }
  }

  return normalized;
}

function normalizeRevisionPromptTemplate(value: unknown) {
  if (typeof value !== "string" || !value.trim()) {
    return DEFAULT_REVISION_PROMPT_TEMPLATE;
  }

  return value.replace(/\r/g, "").trim();
}

function normalizeSettings(candidate: Partial<ShortFormSoundDesignSettings> | null | undefined): ShortFormSoundDesignSettings {
  return {
    promptTemplate: normalizePromptTemplate(candidate?.promptTemplate),
    revisionPromptTemplate: normalizeRevisionPromptTemplate(candidate?.revisionPromptTemplate),
    defaultDuckingDb: normalizeNumber(candidate?.defaultDuckingDb, -24, 0, -8, 1),
    maxConcurrentOneShots: normalizeNumber(candidate?.maxConcurrentOneShots, 1, 8, 2, 0),
    library: Array.isArray(candidate?.library) && candidate.library.length > 0
      ? candidate.library.map((entry, index) => normalizeLibraryEntry(entry, index))
      : DEFAULT_SOUND_LIBRARY.map((entry, index) => normalizeLibraryEntry(entry, index)),
  };
}

export function getShortFormSoundLibraryDir() {
  return SOUND_LIBRARY_DIR;
}

export function getShortFormSoundDesignSettings(): ShortFormSoundDesignSettings {
  let parsed: Partial<ShortFormSoundDesignSettings> | undefined;
  if (fs.existsSync(SETTINGS_PATH)) {
    try {
      parsed = JSON.parse(fs.readFileSync(SETTINGS_PATH, "utf-8")) as Partial<ShortFormSoundDesignSettings>;
    } catch {
      parsed = undefined;
    }
  }
  return normalizeSettings(parsed);
}

export function saveShortFormSoundDesignSettings(patch: Partial<ShortFormSoundDesignSettings>) {
  ensureDir(path.dirname(SETTINGS_PATH));
  const current = getShortFormSoundDesignSettings();
  const next = normalizeSettings({
    ...current,
    ...patch,
    ...(patch.library ? { library: patch.library } : {}),
  });
  fs.writeFileSync(SETTINGS_PATH, JSON.stringify(next, null, 2), "utf-8");
  return next;
}

export function appendSoundLibraryUrls(settings: ShortFormSoundDesignSettings): ShortFormSoundDesignSettings {
  return {
    ...settings,
    library: settings.library.map((entry) => ({
      ...entry,
      ...(!entry.waveformPeaks || entry.waveformPeaks.length === 0 || !entry.durationSeconds || !entry.sampleRate || !entry.channels
        ? getStoredSoundLibraryAudioAnalysis(entry.audioRelativePath)
        : {}),
      audioUrl: buildSoundAudioUrl(entry.audioRelativePath, entry.updatedAt || entry.uploadedAt),
    })),
  };
}

function getProjectDir(projectId: string) {
  return path.join(SHORT_FORM_VIDEOS_DIR, projectId);
}

export function getProjectSoundDesignPath(projectId: string) {
  return path.join(getProjectDir(projectId), "sound-design.json");
}

export function getProjectSoundDesignPreviewPath(projectId: string) {
  return path.join(getProjectDir(projectId), "output", "sound-design-work", "preview", "sound-design-preview.wav");
}

export function getProjectSoundDesignFinalMixPath(projectId: string) {
  return path.join(getProjectDir(projectId), "output", "sound-design-work", "final", "sound-design-final.wav");
}

function normalizeTrackGroup(candidate: Partial<ShortFormSoundDesignTrackGroup> | null | undefined, index: number): ShortFormSoundDesignTrackGroup {
  return {
    id: normalizeString(candidate?.id, `group-${index + 1}`),
    name: normalizeString(candidate?.name, `Track group ${index + 1}`),
    gainDb: normalizeNumber(candidate?.gainDb, -36, 12, 0, 1),
    notes: normalizeOptionalString(candidate?.notes),
  };
}

function normalizeArtifactEvent(candidate: Partial<ShortFormSoundDesignEvent> | null | undefined, index: number): ShortFormSoundDesignEvent {
  const type = normalizeSemanticTypes([candidate?.type])[0];
  return {
    id: normalizeString(candidate?.id, `evt-${index + 1}`),
    type,
    trackGroupId: normalizeOptionalString(candidate?.trackGroupId),
    track: normalizeOptionalString(candidate?.track) || (type === "ambience" ? "ambience" : type === "riser" || type === "whoosh" ? "transitions" : "impacts"),
    anchor: normalizeAnchor(candidate?.anchor),
    sceneId: normalizeOptionalString(candidate?.sceneId),
    captionId: normalizeOptionalString(candidate?.captionId),
    offsetMs: normalizeNumber(candidate?.offsetMs, -20_000, 20_000, 0, 0),
    gainDb: normalizeOptionalNumber(candidate?.gainDb, -36, 12, 1),
    fadeInMs: normalizeOptionalNumber(candidate?.fadeInMs, 0, 10_000, 0),
    fadeOutMs: normalizeOptionalNumber(candidate?.fadeOutMs, 0, 10_000, 0),
    notes: normalizeOptionalString(candidate?.notes),
    rationale: normalizeOptionalString(candidate?.rationale),
    overlap: candidate?.overlap === "allow" ? "allow" : candidate?.overlap === "avoid" ? "avoid" : undefined,
  };
}

function buildDefaultTrackGroups(settings: ShortFormSoundDesignSettings): ShortFormSoundDesignTrackGroup[] {
  const fromLibrary = Array.from(new Set(settings.library.map((entry) => normalizeString(entry.category, "")).filter(Boolean))).slice(0, 4);
  const labels = fromLibrary.length > 0 ? fromLibrary : ["Impacts", "Transitions", "Ambience"];
  return labels.map((label, index) => ({
    id: label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || `group-${index + 1}`,
    name: label,
    gainDb: 0,
  }));
}

export function resolveSoundDesignArtifact(value: unknown, settings = getShortFormSoundDesignSettings()): ShortFormSoundDesignArtifact {
  const candidate = value && typeof value === "object" && !Array.isArray(value)
    ? value as Partial<ShortFormSoundDesignArtifact>
    : {};
  const now = new Date().toISOString();
  const trackGroups = Array.isArray(candidate.trackGroups)
    ? candidate.trackGroups.map((group, index) => normalizeTrackGroup(group, index))
    : buildDefaultTrackGroups(settings);
  return {
    version: normalizeNumber(candidate.version, 1, 99, 1, 0),
    source: candidate.source === "manual" ? "manual" : "generated",
    createdAt: normalizeString(candidate.createdAt, now),
    updatedAt: normalizeString(candidate.updatedAt, now),
    promptSnapshot: normalizeOptionalString(candidate.promptSnapshot),
    notes: normalizeOptionalString(candidate.notes),
    mix: {
      defaultDuckingDb: normalizeNumber(candidate.mix?.defaultDuckingDb, -24, 0, settings.defaultDuckingDb, 1),
      maxConcurrentOneShots: normalizeNumber(candidate.mix?.maxConcurrentOneShots, 1, 8, settings.maxConcurrentOneShots, 0),
    },
    trackGroups,
    events: Array.isArray(candidate.events)
      ? candidate.events.map((event, index) => normalizeArtifactEvent(event, index))
      : [],
  };
}

export function getProjectSoundDesign(projectId: string): ShortFormSoundDesignSummary {
  const filePath = getProjectSoundDesignPath(projectId);
  if (!fs.existsSync(filePath)) {
    return {
      exists: false,
      path: filePath,
      content: "",
      previewPath: getProjectSoundDesignPreviewPath(projectId),
      finalMixPath: getProjectSoundDesignFinalMixPath(projectId),
    };
  }

  const content = fs.readFileSync(filePath, "utf-8");
  let artifact: ShortFormSoundDesignArtifact | null = null;
  try {
    artifact = resolveSoundDesignArtifact(JSON.parse(content));
  } catch {
    artifact = null;
  }

  return {
    exists: true,
    path: filePath,
    content,
    updatedAt: fs.statSync(filePath).mtime.toISOString(),
    artifact,
    previewPath: getProjectSoundDesignPreviewPath(projectId),
    finalMixPath: getProjectSoundDesignFinalMixPath(projectId),
  };
}

export function writeProjectSoundDesign(projectId: string, artifact: ShortFormSoundDesignArtifact) {
  const filePath = getProjectSoundDesignPath(projectId);
  ensureDir(path.dirname(filePath));
  const normalized = resolveSoundDesignArtifact(artifact);
  fs.writeFileSync(filePath, JSON.stringify(normalized, null, 2), "utf-8");
  return normalized;
}

export function renderShortFormSoundDesignPrompt(template: string, values: Record<string, string | undefined>) {
  const withConditionalRevisionNotesBlock = template.replace(
    /^[ \t]*\{\{\s*revisionNotesBlock\s*\}\}[ \t]*\n?/gm,
    values.revisionNotesBlock ? `${values.revisionNotesBlock}\n` : ""
  );

  return withConditionalRevisionNotesBlock.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_match, key: string) => values[key] ?? "");
}

export function buildShortFormSoundDesignPrompt(projectId: string, options: {
  topic?: string;
  selectedHook?: string;
  revisionNotes?: string;
}) {
  const settings = getShortFormSoundDesignSettings();
  const projectDir = getProjectDir(projectId);
  const soundDesignPath = path.join(projectDir, "sound-design.md");
  const xmlScriptPath = path.join(projectDir, "xml-script.md");
  const captionPlanPath = path.join(projectDir, "output", "xml-script-work", "captions", "caption-sections.json");
  const sceneManifestPath = path.join(projectDir, "scene-images.json");
  const selectedHookText = options.selectedHook?.trim() || "No selected hook yet";
  const revisionNotes = options.revisionNotes?.trim() || "";
  const revisionNotesBlock = revisionNotes
    ? renderShortFormSoundDesignPrompt(settings.revisionPromptTemplate, {
        revisionNotes,
        soundDesignPath,
      })
    : undefined;

  return renderShortFormSoundDesignPrompt(settings.promptTemplate, {
    topic: options.topic?.trim() || "Untitled short-form video",
    selectedHook: selectedHookText,
    selectedHookTextOrFallback: selectedHookText,
    revisionNotes,
    revisionNotesBlock,
    projectId,
    projectDir,
    soundDesignPath,
    xmlScriptPath,
    captionPlanPath,
    sceneManifestPath,
    soundLibraryJson: JSON.stringify(settings.library, null, 2),
  });
}

export function generateShortFormSoundDesign(projectId: string, options: {
  topic?: string;
  selectedHook?: string;
  revisionNotes?: string;
}): ShortFormSoundDesignArtifact {
  const settings = getShortFormSoundDesignSettings();
  const now = new Date().toISOString();
  return resolveSoundDesignArtifact({
    version: 1,
    source: "generated",
    createdAt: now,
    updatedAt: now,
    promptSnapshot: buildShortFormSoundDesignPrompt(projectId, options),
    notes: options.revisionNotes?.trim() || undefined,
    mix: {
      defaultDuckingDb: settings.defaultDuckingDb,
      maxConcurrentOneShots: settings.maxConcurrentOneShots,
    },
    trackGroups: buildDefaultTrackGroups(settings),
    events: [],
  }, settings);
}

export function resolveAudioMixInputs(projectId: string, artifact?: ShortFormSoundDesignArtifact) {
  const resolvedArtifact = artifact || getProjectSoundDesign(projectId).artifact || undefined;
  const settings = getShortFormSoundDesignSettings();
  const libraryById = new Map(settings.library.map((entry) => [entry.id, entry]));
  return (resolvedArtifact?.events || []).map((event) => {
    const match = event.trackGroupId ? libraryById.get(event.trackGroupId) : undefined;
    return {
      eventId: event.id,
      trackGroupId: event.trackGroupId,
      audioRelativePath: match?.audioRelativePath,
    };
  });
}
