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

export type ShortFormQwenVoiceMode = "voice-design" | "custom-voice";
export type ShortFormVoiceSourceType = "generated" | "uploaded-reference";
export type ShortFormCaptionAnimationPreset = "none" | "stable-pop" | "fluid-pop" | "pulse" | "glow";

export interface ShortFormVoiceLibraryEntry {
  id: string;
  name: string;
  sourceType?: ShortFormVoiceSourceType;
  mode: ShortFormQwenVoiceMode;
  voiceDesignPrompt: string;
  notes: string;
  previewText: string;
  speaker?: string;
  legacyInstruct?: string;
  referenceAudioRelativePath?: string;
  referenceText?: string;
  referencePrompt?: string;
  referenceMode?: ShortFormQwenVoiceMode;
  referenceSpeaker?: string;
  referenceGeneratedAt?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface ShortFormMusicLibraryEntry {
  id: string;
  name: string;
  prompt: string;
  notes: string;
  previewDurationSeconds?: number;
  generatedAudioRelativePath?: string;
  generatedDurationSeconds?: number;
  generatedPrompt?: string;
  generatedAt?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface ShortFormCaptionStyleEntry {
  id: string;
  name: string;
  fontFamily: string;
  fontWeight: number;
  fontSize: number;
  wordSpacing: number;
  horizontalPadding: number;
  bottomMargin: number;
  activeWordColor: string;
  spokenWordColor: string;
  upcomingWordColor: string;
  outlineColor: string;
  outlineWidth: number;
  shadowColor: string;
  shadowStrength: number;
  shadowBlur: number;
  shadowOffsetX: number;
  shadowOffsetY: number;
  backgroundEnabled: boolean;
  backgroundColor: string;
  backgroundOpacity: number;
  backgroundPadding: number;
  backgroundRadius: number;
  animationPreset: ShortFormCaptionAnimationPreset;
  createdAt?: string;
  updatedAt?: string;
}

export interface ShortFormResolvedVoiceSelection {
  voice: ShortFormVoiceLibraryEntry;
  resolvedVoiceId: string;
  source: "project" | "default" | "fallback";
}

export interface ShortFormResolvedMusicSelection {
  music?: ShortFormMusicLibraryEntry;
  resolvedMusicId?: string;
  source: "project" | "default" | "fallback" | "none";
}

export interface ShortFormResolvedCaptionStyleSelection {
  captionStyle: ShortFormCaptionStyleEntry;
  resolvedCaptionStyleId: string;
  source: "project" | "default" | "fallback";
}

export interface ShortFormPauseRemovalSettings {
  minSilenceDurationSeconds: number;
  silenceThresholdDb: number;
}

export interface ShortFormVideoRenderSettings {
  defaultVoiceId: string;
  voices: ShortFormVoiceLibraryEntry[];
  defaultMusicTrackId?: string;
  musicVolume: number;
  musicTracks: ShortFormMusicLibraryEntry[];
  defaultCaptionStyleId: string;
  captionStyles: ShortFormCaptionStyleEntry[];
  captionMaxWords: number;
  pauseRemoval: ShortFormPauseRemovalSettings;
}

const SETTINGS_PATH = path.join(SHORT_FORM_VIDEOS_DIR, "_video-render-settings.json");
const VOICE_TESTS_DIR = path.join(SHORT_FORM_VIDEOS_DIR, "_voice-tests");
const VOICE_LIBRARY_DIR = path.join(SHORT_FORM_VIDEOS_DIR, "_voice-library");
const MUSIC_TESTS_DIR = path.join(SHORT_FORM_VIDEOS_DIR, "_music-tests");
const MUSIC_LIBRARY_DIR = path.join(SHORT_FORM_VIDEOS_DIR, "_music-library");

const DEFAULT_VOICE_DESIGN_PROMPT =
  "Educated American male narrator, slightly deeper and lower-pitched, polished and confident, calm authority, crisp social-video pacing, speak only English, no other languages or non-speech sounds.";
const DEFAULT_PREVIEW_TEXT =
  "Most people think their face shape is fixed, but posture, breathing, and muscular balance change more than you expect. In this lesson, I will walk through the habits that matter most, the mistakes that waste effort, and the small adjustments that create visible changes over time. Keep your shoulders relaxed, your neck long, and your breathing steady as we go step by step.";
const DEFAULT_LEGACY_SPEAKER = "Aiden";
const DEFAULT_LEGACY_INSTRUCT = DEFAULT_VOICE_DESIGN_PROMPT;
const DEFAULT_VOICE_ID = "voice-calm-authority";
const DEFAULT_MUSIC_ID = "music-curiosity-underscore";
const DEFAULT_MUSIC_PROMPT =
  "instrumental cinematic curiosity underscore, mysterious but pleasant, warm synth pulse, light percussion, airy textures, subtle piano and marimba accents, sense of discovery, modern and polished, no horror, no dread, no dark drones, no jump scares, no vocals, no singing, no choir, no spoken voice";
const DEFAULT_MUSIC_VOLUME = 0.38;
const DEFAULT_MUSIC_PREVIEW_DURATION_SECONDS = 12;
const DEFAULT_CAPTION_STYLE_ID = "caption-classic-highlight";
const DEFAULT_CAPTION_HORIZONTAL_PADDING = 80;
const DEFAULT_CAPTION_BOTTOM_MARGIN = 220;
const DEFAULT_CAPTION_MAX_WORDS = 6;
const DEFAULT_CAPTION_FONT_WEIGHT = 700;
const DEFAULT_PAUSE_REMOVAL_MIN_SILENCE_DURATION_SECONDS = 0.35;
const DEFAULT_PAUSE_REMOVAL_SILENCE_THRESHOLD_DB = -40;
const CAPTION_FONT_WEIGHT_SUFFIX_RE = /\s+(thin|hairline|extra\s*light|ultra\s*light|light|book|regular|normal|medium|semi\s*bold|semibold|demi\s*bold|bold|extra\s*bold|ultra\s*bold|black|heavy)\s*$/i;

export const DEFAULT_SHORT_FORM_PAUSE_REMOVAL_SETTINGS: ShortFormPauseRemovalSettings = {
  minSilenceDurationSeconds: DEFAULT_PAUSE_REMOVAL_MIN_SILENCE_DURATION_SECONDS,
  silenceThresholdDb: DEFAULT_PAUSE_REMOVAL_SILENCE_THRESHOLD_DB,
};

export const DEFAULT_SHORT_FORM_VOICE: ShortFormVoiceLibraryEntry = {
  id: DEFAULT_VOICE_ID,
  name: "Calm Authority",
  sourceType: "generated",
  mode: "voice-design",
  voiceDesignPrompt: DEFAULT_VOICE_DESIGN_PROMPT,
  notes: "Starter VoiceDesign preset for short-form narration.",
  previewText: DEFAULT_PREVIEW_TEXT,
  createdAt: "2026-04-05T00:00:00.000Z",
  updatedAt: "2026-04-05T00:00:00.000Z",
};

export const DEFAULT_SHORT_FORM_MUSIC: ShortFormMusicLibraryEntry = {
  id: DEFAULT_MUSIC_ID,
  name: "Curiosity underscore",
  prompt: DEFAULT_MUSIC_PROMPT,
  notes: "Starter instrumental ACE-Step preset for short-form videos.",
  previewDurationSeconds: DEFAULT_MUSIC_PREVIEW_DURATION_SECONDS,
  createdAt: "2026-04-06T00:00:00.000Z",
  updatedAt: "2026-04-06T00:00:00.000Z",
};

export const DEFAULT_SHORT_FORM_CAPTION_STYLES: ShortFormCaptionStyleEntry[] = [
  {
    id: DEFAULT_CAPTION_STYLE_ID,
    name: "Classic highlight",
    fontFamily: "Arial",
    fontWeight: DEFAULT_CAPTION_FONT_WEIGHT,
    fontSize: 72,
    wordSpacing: -4,
    horizontalPadding: DEFAULT_CAPTION_HORIZONTAL_PADDING,
    bottomMargin: DEFAULT_CAPTION_BOTTOM_MARGIN,
    activeWordColor: "#FFFFFF",
    spokenWordColor: "#D0D0D0",
    upcomingWordColor: "#5E5E5E",
    outlineColor: "#000000",
    outlineWidth: 3.5,
    shadowColor: "#000000",
    shadowStrength: 1.2,
    shadowBlur: 2.2,
    shadowOffsetX: 0,
    shadowOffsetY: 3.4,
    backgroundEnabled: false,
    backgroundColor: "#000000",
    backgroundOpacity: 0.45,
    backgroundPadding: 20,
    backgroundRadius: 24,
    animationPreset: "stable-pop",
    createdAt: "2026-04-16T00:00:00.000Z",
    updatedAt: "2026-04-16T00:00:00.000Z",
  },
  {
    id: "caption-soft-box",
    name: "Soft box",
    fontFamily: "Arial",
    fontWeight: DEFAULT_CAPTION_FONT_WEIGHT,
    fontSize: 68,
    wordSpacing: 0,
    horizontalPadding: DEFAULT_CAPTION_HORIZONTAL_PADDING,
    bottomMargin: DEFAULT_CAPTION_BOTTOM_MARGIN,
    activeWordColor: "#FFF7D6",
    spokenWordColor: "#D9D4C7",
    upcomingWordColor: "#6E6A61",
    outlineColor: "#000000",
    outlineWidth: 2.8,
    shadowColor: "#000000",
    shadowStrength: 0.8,
    shadowBlur: 1.8,
    shadowOffsetX: 0,
    shadowOffsetY: 2.6,
    backgroundEnabled: true,
    backgroundColor: "#111111",
    backgroundOpacity: 0.62,
    backgroundPadding: 24,
    backgroundRadius: 28,
    animationPreset: "pulse",
    createdAt: "2026-04-16T00:00:00.000Z",
    updatedAt: "2026-04-16T00:00:00.000Z",
  },
  {
    id: "caption-high-contrast-glow",
    name: "High-contrast glow",
    fontFamily: "Arial",
    fontWeight: DEFAULT_CAPTION_FONT_WEIGHT,
    fontSize: 74,
    wordSpacing: 0,
    horizontalPadding: DEFAULT_CAPTION_HORIZONTAL_PADDING,
    bottomMargin: DEFAULT_CAPTION_BOTTOM_MARGIN,
    activeWordColor: "#FFFFFF",
    spokenWordColor: "#C7CCFF",
    upcomingWordColor: "#4F5570",
    outlineColor: "#06070A",
    outlineWidth: 4.2,
    shadowColor: "#0C122B",
    shadowStrength: 1.8,
    shadowBlur: 3,
    shadowOffsetX: 0,
    shadowOffsetY: 4.6,
    backgroundEnabled: false,
    backgroundColor: "#0A0C14",
    backgroundOpacity: 0.4,
    backgroundPadding: 20,
    backgroundRadius: 24,
    animationPreset: "glow",
    createdAt: "2026-04-16T00:00:00.000Z",
    updatedAt: "2026-04-16T00:00:00.000Z",
  },
];

export const DEFAULT_SHORT_FORM_CAPTION_STYLE: ShortFormCaptionStyleEntry = DEFAULT_SHORT_FORM_CAPTION_STYLES[0];

const DEFAULT_SETTINGS: ShortFormVideoRenderSettings = {
  defaultVoiceId: DEFAULT_SHORT_FORM_VOICE.id,
  voices: [DEFAULT_SHORT_FORM_VOICE],
  defaultMusicTrackId: DEFAULT_SHORT_FORM_MUSIC.id,
  musicVolume: DEFAULT_MUSIC_VOLUME,
  musicTracks: [DEFAULT_SHORT_FORM_MUSIC],
  defaultCaptionStyleId: DEFAULT_SHORT_FORM_CAPTION_STYLE.id,
  captionStyles: DEFAULT_SHORT_FORM_CAPTION_STYLES,
  captionMaxWords: DEFAULT_CAPTION_MAX_WORDS,
  pauseRemoval: DEFAULT_SHORT_FORM_PAUSE_REMOVAL_SETTINGS,
};

function ensureSettingsDir() {
  fs.mkdirSync(path.dirname(SETTINGS_PATH), { recursive: true });
}

function normalizeString(value: unknown, fallback = "") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function normalizeMode(value: unknown): ShortFormQwenVoiceMode {
  return value === "custom-voice" ? "custom-voice" : "voice-design";
}

function normalizeVoiceSourceType(value: unknown): ShortFormVoiceSourceType {
  return value === "uploaded-reference" ? "uploaded-reference" : "generated";
}

function buildUploadedReferenceFallbackPrompt(name: string) {
  const normalizedName = name.trim() || "uploaded reference voice";
  return `Use the uploaded reference clip for the saved voice \"${normalizedName}\" when cloning narration.`;
}

function normalizeCaptionAnimationPreset(
  value: unknown,
  fallback: ShortFormCaptionAnimationPreset = DEFAULT_SHORT_FORM_CAPTION_STYLE.animationPreset
): ShortFormCaptionAnimationPreset {
  if (value === "word-highlight" || value === "pop") return "stable-pop";
  return value === "none" || value === "stable-pop" || value === "fluid-pop" || value === "pulse" || value === "glow" ? value : fallback;
}

function normalizeHexColor(value: unknown, fallback: string) {
  const normalized = typeof value === "string" ? value.trim() : "";
  if (!/^#([0-9a-f]{6})$/i.test(normalized)) return fallback;
  return normalized.toUpperCase();
}

function clampMusicVolume(value: unknown, fallback = DEFAULT_MUSIC_VOLUME) {
  const parsed = typeof value === "number" ? value : typeof value === "string" ? Number(value) : Number.NaN;
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(1, Math.max(0, parsed));
}

function clampCaptionFontSize(value: unknown, fallback = DEFAULT_SHORT_FORM_CAPTION_STYLE.fontSize) {
  const parsed = typeof value === "number" ? value : typeof value === "string" ? Number(value) : Number.NaN;
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(120, Math.max(32, Math.round(parsed)));
}

function clampCaptionFontWeight(value: unknown, fallback = DEFAULT_CAPTION_FONT_WEIGHT) {
  const parsed = typeof value === "number" ? value : typeof value === "string" ? Number(value) : Number.NaN;
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(900, Math.max(100, Math.round(parsed / 100) * 100));
}

function clampCaptionWordSpacing(value: unknown, fallback = 0) {
  const parsed = typeof value === "number" ? value : typeof value === "string" ? Number(value) : Number.NaN;
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(32, Math.max(-20, Math.round(parsed * 10) / 10));
}

function clampCaptionOutlineWidth(value: unknown, fallback = DEFAULT_SHORT_FORM_CAPTION_STYLE.outlineWidth) {
  const parsed = typeof value === "number" ? value : typeof value === "string" ? Number(value) : Number.NaN;
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(12, Math.max(0, Math.round(parsed * 10) / 10));
}

function clampCaptionShadowStrength(value: unknown, fallback = DEFAULT_SHORT_FORM_CAPTION_STYLE.shadowStrength) {
  const parsed = typeof value === "number" ? value : typeof value === "string" ? Number(value) : Number.NaN;
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(12, Math.max(0, Math.round(parsed * 10) / 10));
}

function defaultCaptionShadowBlur(shadowStrength: number) {
  return Math.min(16, Math.max(0, Math.round((0.8 + shadowStrength * 1.2) * 10) / 10));
}

function defaultCaptionShadowOffsetY(shadowStrength: number) {
  return Math.min(32, Math.max(0, Math.round((1 + shadowStrength * 2) * 10) / 10));
}

function clampCaptionShadowBlur(
  value: unknown,
  fallback = defaultCaptionShadowBlur(DEFAULT_SHORT_FORM_CAPTION_STYLE.shadowStrength)
) {
  const parsed = typeof value === "number" ? value : typeof value === "string" ? Number(value) : Number.NaN;
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(16, Math.max(0, Math.round(parsed * 10) / 10));
}

function clampCaptionShadowOffset(
  value: unknown,
  fallback = 0
) {
  const parsed = typeof value === "number" ? value : typeof value === "string" ? Number(value) : Number.NaN;
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(32, Math.max(-32, Math.round(parsed * 10) / 10));
}

function clampCaptionBackgroundOpacity(value: unknown, fallback = DEFAULT_SHORT_FORM_CAPTION_STYLE.backgroundOpacity) {
  const parsed = typeof value === "number" ? value : typeof value === "string" ? Number(value) : Number.NaN;
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(1, Math.max(0, Math.round(parsed * 100) / 100));
}

function clampCaptionBackgroundPadding(value: unknown, fallback = DEFAULT_SHORT_FORM_CAPTION_STYLE.backgroundPadding) {
  const parsed = typeof value === "number" ? value : typeof value === "string" ? Number(value) : Number.NaN;
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(96, Math.max(0, Math.round(parsed)));
}

function clampCaptionBackgroundRadius(value: unknown, fallback = DEFAULT_SHORT_FORM_CAPTION_STYLE.backgroundRadius) {
  const parsed = typeof value === "number" ? value : typeof value === "string" ? Number(value) : Number.NaN;
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(96, Math.max(0, Math.round(parsed)));
}

function clampCaptionHorizontalPadding(value: unknown, fallback = DEFAULT_CAPTION_HORIZONTAL_PADDING) {
  const parsed = typeof value === "number" ? value : typeof value === "string" ? Number(value) : Number.NaN;
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(320, Math.max(0, Math.round(parsed)));
}

function clampCaptionBottomMargin(value: unknown, fallback = DEFAULT_CAPTION_BOTTOM_MARGIN) {
  const parsed = typeof value === "number" ? value : typeof value === "string" ? Number(value) : Number.NaN;
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(900, Math.max(0, Math.round(parsed)));
}

function inferCaptionFontWeightFromFamily(value: string) {
  const normalized = value.trim().replace(/\s+/g, " ");
  if (!normalized) return undefined;
  if (/\b(thin|hairline)\b/i.test(normalized)) return 100;
  if (/\b(extra\s*light|ultra\s*light)\b/i.test(normalized)) return 200;
  if (/\blight\b/i.test(normalized)) return 300;
  if (/\b(book|regular|normal)\b/i.test(normalized)) return 400;
  if (/\bmedium\b/i.test(normalized)) return 500;
  if (/\b(demi\s*bold|semi\s*bold|semibold)\b/i.test(normalized)) return 600;
  if (/\b(extra\s*bold|ultra\s*bold)\b/i.test(normalized)) return 800;
  if (/\b(black|heavy)\b/i.test(normalized)) return 900;
  if (/\bbold\b/i.test(normalized)) return 700;
  return undefined;
}

function sanitizeCaptionFontFamily(value: string, fallback = DEFAULT_SHORT_FORM_CAPTION_STYLE.fontFamily) {
  let next = value.trim().replace(/\s+/g, " ");
  while (CAPTION_FONT_WEIGHT_SUFFIX_RE.test(next)) {
    next = next.replace(CAPTION_FONT_WEIGHT_SUFFIX_RE, "").trim();
  }
  return next || fallback;
}

function clampCaptionMaxWords(value: unknown, fallback = DEFAULT_CAPTION_MAX_WORDS) {
  const parsed = typeof value === "number" ? value : typeof value === "string" ? Number(value) : Number.NaN;
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(12, Math.max(2, Math.round(parsed)));
}

function clampPauseRemovalMinSilenceDurationSeconds(
  value: unknown,
  fallback = DEFAULT_PAUSE_REMOVAL_MIN_SILENCE_DURATION_SECONDS
) {
  const parsed = typeof value === "number" ? value : typeof value === "string" ? Number(value) : Number.NaN;
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(2.5, Math.max(0.1, Math.round(parsed * 100) / 100));
}

function clampPauseRemovalSilenceThresholdDb(
  value: unknown,
  fallback = DEFAULT_PAUSE_REMOVAL_SILENCE_THRESHOLD_DB
) {
  const parsed = typeof value === "number" ? value : typeof value === "string" ? Number(value) : Number.NaN;
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(-5, Math.max(-80, Math.round(parsed * 10) / 10));
}

function normalizePauseRemovalSettings(
  value: unknown,
  fallback: ShortFormPauseRemovalSettings = DEFAULT_SHORT_FORM_PAUSE_REMOVAL_SETTINGS
): ShortFormPauseRemovalSettings {
  const obj = value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};

  return {
    minSilenceDurationSeconds: clampPauseRemovalMinSilenceDurationSeconds(
      obj.minSilenceDurationSeconds,
      fallback.minSilenceDurationSeconds
    ),
    silenceThresholdDb: clampPauseRemovalSilenceThresholdDb(
      obj.silenceThresholdDb,
      fallback.silenceThresholdDb
    ),
  };
}

function normalizePreviewDurationSeconds(value: unknown, fallback = DEFAULT_MUSIC_PREVIEW_DURATION_SECONDS) {
  const parsed = typeof value === "number" ? value : typeof value === "string" ? Number(value) : Number.NaN;
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(30, Math.max(6, Math.round(parsed)));
}

function normalizeStoredRelativePath(value: unknown) {
  if (typeof value !== "string" || !value.trim()) return undefined;
  const normalized = value.trim().split(path.sep).join("/").replace(/^\/+/, "");
  if (!normalized || normalized.includes("..") || path.isAbsolute(normalized)) return undefined;
  return normalized;
}

function resolveMusicLibraryAbsolutePath(relativePath: string) {
  return path.resolve(MUSIC_LIBRARY_DIR, relativePath);
}

function resolveVoiceLibraryAbsolutePath(relativePath: string) {
  return path.resolve(VOICE_LIBRARY_DIR, relativePath);
}

function readReusableVoiceArtifact(
  voice: ShortFormVoiceLibraryEntry,
  obj: Record<string, unknown>
): Pick<
  ShortFormVoiceLibraryEntry,
  "referenceAudioRelativePath" | "referenceText" | "referencePrompt" | "referenceMode" | "referenceSpeaker" | "referenceGeneratedAt"
> | null {
  const referenceAudioRelativePath = normalizeStoredRelativePath(obj.referenceAudioRelativePath);
  const referenceText = normalizeString(obj.referenceText);
  const referencePrompt = normalizeString(obj.referencePrompt);
  const referenceMode = obj.referenceMode === "custom-voice"
    ? "custom-voice"
    : obj.referenceMode === "voice-design"
      ? "voice-design"
      : undefined;
  const referenceSpeaker = normalizeString(obj.referenceSpeaker) || undefined;
  const voiceLibraryDir = path.resolve(VOICE_LIBRARY_DIR);

  if (!referenceAudioRelativePath || !referenceText) return null;
  if (voice.sourceType !== "uploaded-reference") {
    if (!referencePrompt) return null;
    if (referencePrompt !== voice.voiceDesignPrompt) return null;
    if (referenceMode !== voice.mode) return null;
    if (voice.mode === "custom-voice" && referenceSpeaker !== (voice.speaker || undefined)) return null;
  }

  const absolutePath = resolveVoiceLibraryAbsolutePath(referenceAudioRelativePath);
  if (
    (absolutePath !== voiceLibraryDir && !absolutePath.startsWith(`${voiceLibraryDir}${path.sep}`))
    || !fs.existsSync(absolutePath)
    || !fs.statSync(absolutePath).isFile()
  ) {
    return null;
  }

  return {
    referenceAudioRelativePath,
    referenceText,
    ...(referencePrompt ? { referencePrompt } : {}),
    ...(referenceMode ? { referenceMode } : {}),
    ...(referenceSpeaker ? { referenceSpeaker } : {}),
    ...(normalizeString(obj.referenceGeneratedAt) ? { referenceGeneratedAt: normalizeString(obj.referenceGeneratedAt) } : {}),
  };
}

function readReusableMusicArtifact(track: ShortFormMusicLibraryEntry, obj: Record<string, unknown>) {
  const generatedAudioRelativePath = normalizeStoredRelativePath(obj.generatedAudioRelativePath);
  const generatedPrompt = normalizeString(obj.generatedPrompt);
  const generatedDurationSeconds = normalizePreviewDurationSeconds(
    obj.generatedDurationSeconds,
    track.previewDurationSeconds || DEFAULT_MUSIC_PREVIEW_DURATION_SECONDS
  );
  const musicLibraryDir = path.resolve(MUSIC_LIBRARY_DIR);

  if (!generatedAudioRelativePath || !generatedPrompt) return null;
  if (generatedPrompt !== track.prompt) return null;
  if (generatedDurationSeconds !== (track.previewDurationSeconds || DEFAULT_MUSIC_PREVIEW_DURATION_SECONDS)) return null;

  const absolutePath = resolveMusicLibraryAbsolutePath(generatedAudioRelativePath);
  if (
    (absolutePath !== musicLibraryDir && !absolutePath.startsWith(`${musicLibraryDir}${path.sep}`))
    || !fs.existsSync(absolutePath)
    || !fs.statSync(absolutePath).isFile()
  ) {
    return null;
  }

  return {
    generatedAudioRelativePath,
    generatedPrompt,
    generatedDurationSeconds,
    generatedAt: normalizeString(obj.generatedAt) || undefined,
  } satisfies Pick<ShortFormMusicLibraryEntry, "generatedAudioRelativePath" | "generatedPrompt" | "generatedDurationSeconds" | "generatedAt">;
}

function ensureUniqueVoiceIds(voices: ShortFormVoiceLibraryEntry[]) {
  const used = new Set<string>();
  return voices.map((voice, index) => {
    let candidate = normalizeString(voice.id, `voice-${index + 1}`);
    if (!candidate) candidate = `voice-${index + 1}`;
    if (!used.has(candidate)) {
      used.add(candidate);
      return voice;
    }

    let suffix = 2;
    while (used.has(`${candidate}-${suffix}`)) suffix += 1;
    const nextId = `${candidate}-${suffix}`;
    used.add(nextId);
    return { ...voice, id: nextId };
  });
}

function ensureUniqueMusicIds(tracks: ShortFormMusicLibraryEntry[]) {
  const used = new Set<string>();
  return tracks.map((track, index) => {
    let candidate = normalizeString(track.id, `music-${index + 1}`);
    if (!candidate) candidate = `music-${index + 1}`;
    if (!used.has(candidate)) {
      used.add(candidate);
      return track;
    }

    let suffix = 2;
    while (used.has(`${candidate}-${suffix}`)) suffix += 1;
    const nextId = `${candidate}-${suffix}`;
    used.add(nextId);
    return { ...track, id: nextId };
  });
}

function ensureUniqueCaptionStyleIds(styles: ShortFormCaptionStyleEntry[]) {
  const used = new Set<string>();
  return styles.map((style, index) => {
    let candidate = normalizeString(style.id, `caption-style-${index + 1}`);
    if (!candidate) candidate = `caption-style-${index + 1}`;
    if (!used.has(candidate)) {
      used.add(candidate);
      return style;
    }

    let suffix = 2;
    while (used.has(`${candidate}-${suffix}`)) suffix += 1;
    const nextId = `${candidate}-${suffix}`;
    used.add(nextId);
    return { ...style, id: nextId };
  });
}

function normalizeVoiceEntry(value: unknown, fallback: ShortFormVoiceLibraryEntry, index: number): ShortFormVoiceLibraryEntry | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const obj = value as Record<string, unknown>;
  const mode = normalizeMode(obj.mode);
  const sourceType = normalizeVoiceSourceType(obj.sourceType);
  const normalizedName = normalizeString(obj.name, fallback.name || `Voice ${index + 1}`);
  const promptFallback = sourceType === "uploaded-reference"
    ? buildUploadedReferenceFallbackPrompt(normalizedName)
    : mode === "voice-design"
      ? fallback.voiceDesignPrompt
      : normalizeString(obj.legacyInstruct, fallback.legacyInstruct || fallback.voiceDesignPrompt);

  const normalized: ShortFormVoiceLibraryEntry = {
    id: normalizeString(obj.id, fallback.id || `voice-${index + 1}`),
    name: normalizedName,
    sourceType,
    mode,
    voiceDesignPrompt: normalizeString(obj.voiceDesignPrompt, promptFallback),
    notes: normalizeString(obj.notes, fallback.notes),
    previewText: normalizeString(obj.previewText, fallback.previewText),
    ...(normalizeString(obj.createdAt) ? { createdAt: normalizeString(obj.createdAt) } : {}),
    ...(normalizeString(obj.updatedAt) ? { updatedAt: normalizeString(obj.updatedAt) } : {}),
  };

  if (mode === "custom-voice") {
    normalized.speaker = normalizeString(obj.speaker, fallback.speaker || DEFAULT_LEGACY_SPEAKER);
    normalized.legacyInstruct = normalizeString(
      obj.legacyInstruct,
      fallback.legacyInstruct || fallback.voiceDesignPrompt || DEFAULT_LEGACY_INSTRUCT
    );
    normalized.voiceDesignPrompt = normalizeString(
      obj.voiceDesignPrompt,
      normalized.legacyInstruct || fallback.voiceDesignPrompt || DEFAULT_LEGACY_INSTRUCT
    );
  }

  if (!normalized.id || !normalized.name || !normalized.voiceDesignPrompt || !normalized.previewText) {
    return null;
  }

  const artifact = readReusableVoiceArtifact(normalized, obj);
  if (artifact) {
    normalized.referenceAudioRelativePath = artifact.referenceAudioRelativePath;
    normalized.referenceText = artifact.referenceText;
    if (artifact.referencePrompt) normalized.referencePrompt = artifact.referencePrompt;
    if (artifact.referenceMode) normalized.referenceMode = artifact.referenceMode;
    if (artifact.referenceSpeaker) normalized.referenceSpeaker = artifact.referenceSpeaker;
    if (artifact.referenceGeneratedAt) normalized.referenceGeneratedAt = artifact.referenceGeneratedAt;
  }

  return normalized;
}

function normalizeMusicEntry(value: unknown, fallback: ShortFormMusicLibraryEntry, index: number): ShortFormMusicLibraryEntry | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const obj = value as Record<string, unknown>;
  const normalized: ShortFormMusicLibraryEntry = {
    id: normalizeString(obj.id, fallback.id || `music-${index + 1}`),
    name: normalizeString(obj.name, fallback.name || `Music ${index + 1}`),
    prompt: normalizeString(obj.prompt, fallback.prompt),
    notes: normalizeString(obj.notes, fallback.notes),
    previewDurationSeconds: normalizePreviewDurationSeconds(obj.previewDurationSeconds, fallback.previewDurationSeconds),
    ...(normalizeString(obj.createdAt) ? { createdAt: normalizeString(obj.createdAt) } : {}),
    ...(normalizeString(obj.updatedAt) ? { updatedAt: normalizeString(obj.updatedAt) } : {}),
  };

  if (!normalized.id || !normalized.name || !normalized.prompt) {
    return null;
  }

  const artifact = readReusableMusicArtifact(normalized, obj);
  if (artifact) {
    normalized.generatedAudioRelativePath = artifact.generatedAudioRelativePath;
    normalized.generatedPrompt = artifact.generatedPrompt;
    normalized.generatedDurationSeconds = artifact.generatedDurationSeconds;
    if (artifact.generatedAt) normalized.generatedAt = artifact.generatedAt;
  }

  return normalized;
}

function normalizeCaptionStyleEntry(
  value: unknown,
  fallback: ShortFormCaptionStyleEntry,
  index: number
): ShortFormCaptionStyleEntry | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const obj = value as Record<string, unknown>;
  const rawFontFamily = normalizeString(obj.fontFamily, fallback.fontFamily);
  const sanitizedFontFamily = sanitizeCaptionFontFamily(rawFontFamily, fallback.fontFamily);
  const inferredFontWeight = inferCaptionFontWeightFromFamily(rawFontFamily)
    ?? fallback.fontWeight
    ?? DEFAULT_CAPTION_FONT_WEIGHT;
  const shadowStrength = clampCaptionShadowStrength(obj.shadowStrength, fallback.shadowStrength);
  const normalized: ShortFormCaptionStyleEntry = {
    id: normalizeString(obj.id, fallback.id || `caption-style-${index + 1}`),
    name: normalizeString(obj.name, fallback.name || `Caption style ${index + 1}`),
    fontFamily: sanitizedFontFamily,
    fontWeight: clampCaptionFontWeight(obj.fontWeight, inferredFontWeight),
    fontSize: clampCaptionFontSize(obj.fontSize, fallback.fontSize),
    wordSpacing: clampCaptionWordSpacing(obj.wordSpacing, fallback.wordSpacing ?? 0),
    horizontalPadding: clampCaptionHorizontalPadding(obj.horizontalPadding, fallback.horizontalPadding),
    bottomMargin: clampCaptionBottomMargin(obj.bottomMargin, fallback.bottomMargin),
    activeWordColor: normalizeHexColor(obj.activeWordColor, fallback.activeWordColor),
    spokenWordColor: normalizeHexColor(obj.spokenWordColor, fallback.spokenWordColor),
    upcomingWordColor: normalizeHexColor(obj.upcomingWordColor, fallback.upcomingWordColor),
    outlineColor: normalizeHexColor(obj.outlineColor, fallback.outlineColor),
    outlineWidth: clampCaptionOutlineWidth(obj.outlineWidth, fallback.outlineWidth),
    shadowColor: normalizeHexColor(obj.shadowColor, fallback.shadowColor),
    shadowStrength,
    shadowBlur: clampCaptionShadowBlur(
      obj.shadowBlur,
      fallback.shadowBlur ?? defaultCaptionShadowBlur(shadowStrength)
    ),
    shadowOffsetX: clampCaptionShadowOffset(obj.shadowOffsetX, fallback.shadowOffsetX ?? 0),
    shadowOffsetY: clampCaptionShadowOffset(
      obj.shadowOffsetY,
      fallback.shadowOffsetY ?? defaultCaptionShadowOffsetY(shadowStrength)
    ),
    backgroundEnabled: typeof obj.backgroundEnabled === "boolean"
      ? obj.backgroundEnabled
      : Boolean(obj.backgroundBoxEnabled),
    backgroundColor: normalizeHexColor(obj.backgroundColor, fallback.backgroundColor),
    backgroundOpacity: clampCaptionBackgroundOpacity(obj.backgroundOpacity, fallback.backgroundOpacity),
    backgroundPadding: clampCaptionBackgroundPadding(obj.backgroundPadding, fallback.backgroundPadding),
    backgroundRadius: clampCaptionBackgroundRadius(obj.backgroundRadius, fallback.backgroundRadius),
    animationPreset: normalizeCaptionAnimationPreset(obj.animationPreset, fallback.animationPreset),
    ...(normalizeString(obj.createdAt) ? { createdAt: normalizeString(obj.createdAt) } : {}),
    ...(normalizeString(obj.updatedAt) ? { updatedAt: normalizeString(obj.updatedAt) } : {}),
  };

  if (!normalized.id || !normalized.name || !normalized.fontFamily) {
    return null;
  }

  return normalized;
}

function migrateLegacyQwenVoice(value: unknown): ShortFormVideoRenderSettings | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const obj = value as Record<string, unknown>;
  const legacy = obj.qwenVoice as Record<string, unknown> | undefined;
  if (!legacy || typeof legacy !== "object" || Array.isArray(legacy)) {
    return null;
  }

  const speaker = normalizeString(legacy.speaker, DEFAULT_LEGACY_SPEAKER);
  const instruct = normalizeString(legacy.instruct, DEFAULT_LEGACY_INSTRUCT);
  const previewText = normalizeString(legacy.previewText, DEFAULT_PREVIEW_TEXT);
  const voice: ShortFormVoiceLibraryEntry = {
    id: "voice-migrated-legacy",
    name: `Migrated legacy voice (${speaker})`,
    mode: "custom-voice",
    voiceDesignPrompt: instruct,
    notes: "Migrated automatically from the previous speaker + instruction settings.",
    previewText,
    speaker,
    legacyInstruct: instruct,
  };

  return {
    defaultVoiceId: voice.id,
    voices: [voice],
    defaultMusicTrackId: DEFAULT_SHORT_FORM_MUSIC.id,
    musicVolume: DEFAULT_MUSIC_VOLUME,
    musicTracks: [DEFAULT_SHORT_FORM_MUSIC],
    defaultCaptionStyleId: DEFAULT_SHORT_FORM_CAPTION_STYLE.id,
    captionStyles: DEFAULT_SHORT_FORM_CAPTION_STYLES,
    captionMaxWords: DEFAULT_CAPTION_MAX_WORDS,
    pauseRemoval: DEFAULT_SHORT_FORM_PAUSE_REMOVAL_SETTINGS,
  };
}

function normalizeSettings(value: unknown): ShortFormVideoRenderSettings {
  const migrated = migrateLegacyQwenVoice(value);
  if (migrated) return migrated;

  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return DEFAULT_SETTINGS;
  }

  const obj = value as Record<string, unknown>;
  const rawVoices = Array.isArray(obj.voices) ? obj.voices : [];
  const normalizedVoices = rawVoices
    .map((voice, index) => normalizeVoiceEntry(voice, DEFAULT_SHORT_FORM_VOICE, index))
    .filter((voice): voice is ShortFormVoiceLibraryEntry => Boolean(voice));
  const voices = ensureUniqueVoiceIds(normalizedVoices.length > 0 ? normalizedVoices : [DEFAULT_SHORT_FORM_VOICE]);
  const defaultVoiceId = normalizeString(obj.defaultVoiceId, voices[0]?.id || DEFAULT_SHORT_FORM_VOICE.id);
  const resolvedDefaultVoiceId = voices.some((voice) => voice.id === defaultVoiceId) ? defaultVoiceId : voices[0].id;

  const rawMusicTracks = Array.isArray(obj.musicTracks) ? obj.musicTracks : [];
  const normalizedMusicTracks = rawMusicTracks
    .map((track, index) => normalizeMusicEntry(track, DEFAULT_SHORT_FORM_MUSIC, index))
    .filter((track): track is ShortFormMusicLibraryEntry => Boolean(track));
  const musicTracks = ensureUniqueMusicIds(normalizedMusicTracks.length > 0 ? normalizedMusicTracks : [DEFAULT_SHORT_FORM_MUSIC]);
  const defaultMusicTrackId = normalizeString(obj.defaultMusicTrackId, musicTracks[0]?.id || DEFAULT_SHORT_FORM_MUSIC.id);
  const resolvedDefaultMusicTrackId = musicTracks.some((track) => track.id === defaultMusicTrackId)
    ? defaultMusicTrackId
    : musicTracks[0]?.id;

  const rawCaptionStyles = Array.isArray(obj.captionStyles) ? obj.captionStyles : [];
  const normalizedCaptionStyles = rawCaptionStyles
    .map((style, index) => normalizeCaptionStyleEntry(style, DEFAULT_SHORT_FORM_CAPTION_STYLES[index] || DEFAULT_SHORT_FORM_CAPTION_STYLE, index))
    .filter((style): style is ShortFormCaptionStyleEntry => Boolean(style));
  const captionStyles = ensureUniqueCaptionStyleIds(normalizedCaptionStyles.length > 0 ? normalizedCaptionStyles : DEFAULT_SHORT_FORM_CAPTION_STYLES);
  const defaultCaptionStyleId = normalizeString(obj.defaultCaptionStyleId, captionStyles[0]?.id || DEFAULT_SHORT_FORM_CAPTION_STYLE.id);
  const resolvedDefaultCaptionStyleId = captionStyles.some((style) => style.id === defaultCaptionStyleId)
    ? defaultCaptionStyleId
    : captionStyles[0].id;

  return {
    defaultVoiceId: resolvedDefaultVoiceId,
    voices,
    ...(resolvedDefaultMusicTrackId ? { defaultMusicTrackId: resolvedDefaultMusicTrackId } : {}),
    musicVolume: clampMusicVolume(obj.musicVolume, DEFAULT_MUSIC_VOLUME),
    musicTracks,
    defaultCaptionStyleId: resolvedDefaultCaptionStyleId,
    captionStyles,
    captionMaxWords: clampCaptionMaxWords(obj.captionMaxWords, DEFAULT_CAPTION_MAX_WORDS),
    pauseRemoval: normalizePauseRemovalSettings(obj.pauseRemoval),
  };
}

export function getShortFormVideoRenderSettings() {
  if (!fs.existsSync(SETTINGS_PATH)) return DEFAULT_SETTINGS;

  try {
    return normalizeSettings(JSON.parse(fs.readFileSync(SETTINGS_PATH, "utf-8")));
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function resolveShortFormVoiceSelection(preferredVoiceId?: string): ShortFormResolvedVoiceSelection {
  const settings = getShortFormVideoRenderSettings();
  const projectVoice = preferredVoiceId ? settings.voices.find((voice) => voice.id === preferredVoiceId) : undefined;
  if (projectVoice) {
    return { voice: projectVoice, resolvedVoiceId: projectVoice.id, source: "project" };
  }

  const defaultVoice = settings.voices.find((voice) => voice.id === settings.defaultVoiceId);
  if (defaultVoice) {
    return { voice: defaultVoice, resolvedVoiceId: defaultVoice.id, source: "default" };
  }

  const fallbackVoice = settings.voices[0] || DEFAULT_SHORT_FORM_VOICE;
  return { voice: fallbackVoice, resolvedVoiceId: fallbackVoice.id, source: "fallback" };
}

export function resolveShortFormMusicSelection(preferredMusicId?: string): ShortFormResolvedMusicSelection {
  const settings = getShortFormVideoRenderSettings();
  const projectMusic = preferredMusicId ? settings.musicTracks.find((track) => track.id === preferredMusicId) : undefined;
  if (projectMusic) {
    return { music: projectMusic, resolvedMusicId: projectMusic.id, source: "project" };
  }

  const defaultMusic = settings.defaultMusicTrackId
    ? settings.musicTracks.find((track) => track.id === settings.defaultMusicTrackId)
    : undefined;
  if (defaultMusic) {
    return { music: defaultMusic, resolvedMusicId: defaultMusic.id, source: "default" };
  }

  const fallbackMusic = settings.musicTracks[0];
  if (fallbackMusic) {
    return { music: fallbackMusic, resolvedMusicId: fallbackMusic.id, source: "fallback" };
  }

  return { source: "none" };
}

export function resolveShortFormCaptionStyleSelection(preferredCaptionStyleId?: string): ShortFormResolvedCaptionStyleSelection {
  const settings = getShortFormVideoRenderSettings();
  const projectCaptionStyle = preferredCaptionStyleId
    ? settings.captionStyles.find((style) => style.id === preferredCaptionStyleId)
    : undefined;
  if (projectCaptionStyle) {
    return { captionStyle: projectCaptionStyle, resolvedCaptionStyleId: projectCaptionStyle.id, source: "project" };
  }

  const defaultCaptionStyle = settings.captionStyles.find((style) => style.id === settings.defaultCaptionStyleId);
  if (defaultCaptionStyle) {
    return { captionStyle: defaultCaptionStyle, resolvedCaptionStyleId: defaultCaptionStyle.id, source: "default" };
  }

  const fallbackCaptionStyle = settings.captionStyles[0] || DEFAULT_SHORT_FORM_CAPTION_STYLE;
  return { captionStyle: fallbackCaptionStyle, resolvedCaptionStyleId: fallbackCaptionStyle.id, source: "fallback" };
}

export function resolveShortFormPauseRemovalSettings(overrides?: Partial<ShortFormPauseRemovalSettings>) {
  const settings = getShortFormVideoRenderSettings();
  return normalizePauseRemovalSettings({
    ...settings.pauseRemoval,
    ...(overrides || {}),
  });
}

export function saveShortFormVideoRenderSettings(nextSettings: Partial<ShortFormVideoRenderSettings>) {
  ensureSettingsDir();
  const current = getShortFormVideoRenderSettings();
  const merged = normalizeSettings({
    ...current,
    ...nextSettings,
    voices: nextSettings.voices || current.voices,
    musicTracks: nextSettings.musicTracks || current.musicTracks,
    captionStyles: nextSettings.captionStyles || current.captionStyles,
  });

  fs.writeFileSync(SETTINGS_PATH, JSON.stringify(merged, null, 2), "utf-8");
  return merged;
}

export function getShortFormVoiceTestsDir() {
  fs.mkdirSync(VOICE_TESTS_DIR, { recursive: true });
  return VOICE_TESTS_DIR;
}

export function getShortFormVoiceLibraryDir() {
  fs.mkdirSync(VOICE_LIBRARY_DIR, { recursive: true });
  return VOICE_LIBRARY_DIR;
}

export function getShortFormMusicTestsDir() {
  fs.mkdirSync(MUSIC_TESTS_DIR, { recursive: true });
  return MUSIC_TESTS_DIR;
}

export function getShortFormMusicLibraryDir() {
  fs.mkdirSync(MUSIC_LIBRARY_DIR, { recursive: true });
  return MUSIC_LIBRARY_DIR;
}
