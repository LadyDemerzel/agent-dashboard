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

export interface ShortFormVoiceLibraryEntry {
  id: string;
  name: string;
  mode: ShortFormQwenVoiceMode;
  voiceDesignPrompt: string;
  notes: string;
  previewText: string;
  speaker?: string;
  legacyInstruct?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface ShortFormMusicLibraryEntry {
  id: string;
  name: string;
  prompt: string;
  notes: string;
  previewDurationSeconds?: number;
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

export interface ShortFormVideoRenderSettings {
  defaultVoiceId: string;
  voices: ShortFormVoiceLibraryEntry[];
  defaultMusicTrackId?: string;
  musicVolume: number;
  musicTracks: ShortFormMusicLibraryEntry[];
  captionMaxWords: number;
}

const SETTINGS_PATH = path.join(SHORT_FORM_VIDEOS_DIR, "_video-render-settings.json");
const VOICE_TESTS_DIR = path.join(SHORT_FORM_VIDEOS_DIR, "_voice-tests");
const MUSIC_TESTS_DIR = path.join(SHORT_FORM_VIDEOS_DIR, "_music-tests");

const DEFAULT_VOICE_DESIGN_PROMPT =
  "Educated American male narrator, slightly deeper and lower-pitched, polished and confident, calm authority, crisp social-video pacing, speak only English, no other languages or non-speech sounds.";
const DEFAULT_PREVIEW_TEXT =
  "Your jawline doesn't start at your jaw. It starts with how your whole neck and face are stacking.";
const DEFAULT_LEGACY_SPEAKER = "Aiden";
const DEFAULT_LEGACY_INSTRUCT = DEFAULT_VOICE_DESIGN_PROMPT;
const DEFAULT_VOICE_ID = "voice-calm-authority";
const DEFAULT_MUSIC_ID = "music-curiosity-underscore";
const DEFAULT_MUSIC_PROMPT =
  "instrumental cinematic curiosity underscore, mysterious but pleasant, warm synth pulse, light percussion, airy textures, subtle piano and marimba accents, sense of discovery, modern and polished, no horror, no dread, no dark drones, no jump scares, no vocals, no singing, no choir, no spoken voice";
const DEFAULT_MUSIC_VOLUME = 0.38;
const DEFAULT_MUSIC_PREVIEW_DURATION_SECONDS = 12;
const DEFAULT_CAPTION_MAX_WORDS = 6;

export const DEFAULT_SHORT_FORM_VOICE: ShortFormVoiceLibraryEntry = {
  id: DEFAULT_VOICE_ID,
  name: "Calm Authority",
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

const DEFAULT_SETTINGS: ShortFormVideoRenderSettings = {
  defaultVoiceId: DEFAULT_SHORT_FORM_VOICE.id,
  voices: [DEFAULT_SHORT_FORM_VOICE],
  defaultMusicTrackId: DEFAULT_SHORT_FORM_MUSIC.id,
  musicVolume: DEFAULT_MUSIC_VOLUME,
  musicTracks: [DEFAULT_SHORT_FORM_MUSIC],
  captionMaxWords: DEFAULT_CAPTION_MAX_WORDS,
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

function clampMusicVolume(value: unknown, fallback = DEFAULT_MUSIC_VOLUME) {
  const parsed = typeof value === "number" ? value : typeof value === "string" ? Number(value) : Number.NaN;
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(1, Math.max(0, parsed));
}

function clampCaptionMaxWords(value: unknown, fallback = DEFAULT_CAPTION_MAX_WORDS) {
  const parsed = typeof value === "number" ? value : typeof value === "string" ? Number(value) : Number.NaN;
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(12, Math.max(2, Math.round(parsed)));
}

function normalizePreviewDurationSeconds(value: unknown, fallback = DEFAULT_MUSIC_PREVIEW_DURATION_SECONDS) {
  const parsed = typeof value === "number" ? value : typeof value === "string" ? Number(value) : Number.NaN;
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(30, Math.max(6, Math.round(parsed)));
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

function normalizeVoiceEntry(value: unknown, fallback: ShortFormVoiceLibraryEntry, index: number): ShortFormVoiceLibraryEntry | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const obj = value as Record<string, unknown>;
  const mode = normalizeMode(obj.mode);
  const promptFallback = mode === "voice-design"
    ? fallback.voiceDesignPrompt
    : normalizeString(obj.legacyInstruct, fallback.legacyInstruct || fallback.voiceDesignPrompt);

  const normalized: ShortFormVoiceLibraryEntry = {
    id: normalizeString(obj.id, fallback.id || `voice-${index + 1}`),
    name: normalizeString(obj.name, fallback.name || `Voice ${index + 1}`),
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
    captionMaxWords: DEFAULT_CAPTION_MAX_WORDS,
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

  return {
    defaultVoiceId: resolvedDefaultVoiceId,
    voices,
    ...(resolvedDefaultMusicTrackId ? { defaultMusicTrackId: resolvedDefaultMusicTrackId } : {}),
    musicVolume: clampMusicVolume(obj.musicVolume, DEFAULT_MUSIC_VOLUME),
    musicTracks,
    captionMaxWords: clampCaptionMaxWords(obj.captionMaxWords, DEFAULT_CAPTION_MAX_WORDS),
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

export function saveShortFormVideoRenderSettings(nextSettings: Partial<ShortFormVideoRenderSettings>) {
  ensureSettingsDir();
  const current = getShortFormVideoRenderSettings();
  const merged = normalizeSettings({
    ...current,
    ...nextSettings,
    voices: nextSettings.voices || current.voices,
    musicTracks: nextSettings.musicTracks || current.musicTracks,
  });

  fs.writeFileSync(SETTINGS_PATH, JSON.stringify(merged, null, 2), "utf-8");
  return merged;
}

export function getShortFormVoiceTestsDir() {
  fs.mkdirSync(VOICE_TESTS_DIR, { recursive: true });
  return VOICE_TESTS_DIR;
}

export function getShortFormMusicTestsDir() {
  fs.mkdirSync(MUSIC_TESTS_DIR, { recursive: true });
  return MUSIC_TESTS_DIR;
}
