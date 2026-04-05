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

export interface ShortFormResolvedVoiceSelection {
  voice: ShortFormVoiceLibraryEntry;
  resolvedVoiceId: string;
  source: "project" | "default" | "fallback";
}

export interface ShortFormVideoRenderSettings {
  defaultVoiceId: string;
  voices: ShortFormVoiceLibraryEntry[];
}

const SETTINGS_PATH = path.join(SHORT_FORM_VIDEOS_DIR, "_video-render-settings.json");
const VOICE_TESTS_DIR = path.join(SHORT_FORM_VIDEOS_DIR, "_voice-tests");

const DEFAULT_VOICE_DESIGN_PROMPT =
  "Educated American male narrator, slightly deeper and lower-pitched, polished and confident, calm authority, crisp social-video pacing, speak only English, no other languages or non-speech sounds.";
const DEFAULT_PREVIEW_TEXT =
  "Your jawline doesn't start at your jaw. It starts with how your whole neck and face are stacking.";
const DEFAULT_LEGACY_SPEAKER = "Aiden";
const DEFAULT_LEGACY_INSTRUCT = DEFAULT_VOICE_DESIGN_PROMPT;
const DEFAULT_VOICE_ID = "voice-calm-authority";

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

const DEFAULT_SETTINGS: ShortFormVideoRenderSettings = {
  defaultVoiceId: DEFAULT_SHORT_FORM_VOICE.id,
  voices: [DEFAULT_SHORT_FORM_VOICE],
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

  return {
    defaultVoiceId: resolvedDefaultVoiceId,
    voices,
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

export function saveShortFormVideoRenderSettings(nextSettings: Partial<ShortFormVideoRenderSettings>) {
  ensureSettingsDir();
  const current = getShortFormVideoRenderSettings();
  const merged = normalizeSettings({
    ...current,
    ...nextSettings,
    voices: nextSettings.voices || current.voices,
  });

  fs.writeFileSync(SETTINGS_PATH, JSON.stringify(merged, null, 2), "utf-8");
  return merged;
}

export function getShortFormVoiceTestsDir() {
  fs.mkdirSync(VOICE_TESTS_DIR, { recursive: true });
  return VOICE_TESTS_DIR;
}
