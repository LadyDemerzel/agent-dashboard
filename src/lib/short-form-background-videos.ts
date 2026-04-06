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
const SETTINGS_PATH = path.join(SHORT_FORM_VIDEOS_DIR, "_background-video-settings.json");
const BACKGROUND_VIDEOS_DIR = path.join(SHORT_FORM_VIDEOS_DIR, "_background-videos");
const DEFAULT_BACKGROUND_NAME = "Default background";
const DEFAULT_BACKGROUND_ID = "background-default";

export interface ShortFormBackgroundVideoEntry {
  id: string;
  name: string;
  notes?: string;
  videoRelativePath: string;
  videoUrl?: string;
  uploadedAt?: string;
  updatedAt?: string;
}

export interface ShortFormBackgroundVideoSettings {
  defaultBackgroundVideoId?: string;
  backgrounds: ShortFormBackgroundVideoEntry[];
}

export interface ShortFormResolvedBackgroundVideoSelection {
  background?: ShortFormBackgroundVideoEntry;
  resolvedBackgroundVideoId?: string;
  source: "project" | "default" | "fallback" | "none";
}

function ensureSettingsDir() {
  fs.mkdirSync(path.dirname(SETTINGS_PATH), { recursive: true });
}

function ensureBackgroundVideosDir() {
  fs.mkdirSync(BACKGROUND_VIDEOS_DIR, { recursive: true });
  return BACKGROUND_VIDEOS_DIR;
}

function normalizeString(value: unknown, fallback = "") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function isSafeRelativeMediaPath(relativePath: string, baseDir: string) {
  const resolved = path.resolve(baseDir, relativePath);
  return resolved === baseDir || resolved.startsWith(`${baseDir}${path.sep}`);
}

function resolveBackgroundVideoVersion(relativePath: string) {
  const absolutePath = path.join(getShortFormBackgroundVideosDir(), relativePath);
  if (!fs.existsSync(absolutePath) || !fs.statSync(absolutePath).isFile()) return null;
  return Math.round(fs.statSync(absolutePath).mtimeMs);
}

function hydrateBackgroundEntry(value: unknown, index: number): ShortFormBackgroundVideoEntry | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;

  const obj = value as Record<string, unknown>;
  const videoRelativePath = normalizeString(obj.videoRelativePath);
  if (!videoRelativePath || !isSafeRelativeMediaPath(videoRelativePath, getShortFormBackgroundVideosDir())) {
    return null;
  }

  const version = resolveBackgroundVideoVersion(videoRelativePath);
  return {
    id: normalizeString(obj.id, `${DEFAULT_BACKGROUND_ID}-${index + 1}`),
    name: normalizeString(obj.name, `${DEFAULT_BACKGROUND_NAME} ${index + 1}`),
    videoRelativePath,
    ...(normalizeString(obj.notes) ? { notes: normalizeString(obj.notes) } : {}),
    ...(normalizeString(obj.uploadedAt) ? { uploadedAt: normalizeString(obj.uploadedAt) } : {}),
    ...(normalizeString(obj.updatedAt) ? { updatedAt: normalizeString(obj.updatedAt) } : {}),
    ...(version !== null ? { videoUrl: `/api/short-form-videos/settings/background-videos/${videoRelativePath}?v=${version}` } : {}),
  };
}

function persistBackgroundEntry(value: unknown, index: number): ShortFormBackgroundVideoEntry | null {
  const hydrated = hydrateBackgroundEntry(value, index);
  if (!hydrated) return null;
  return {
    id: hydrated.id,
    name: hydrated.name,
    videoRelativePath: hydrated.videoRelativePath,
    ...(hydrated.notes ? { notes: hydrated.notes } : {}),
    ...(hydrated.uploadedAt ? { uploadedAt: hydrated.uploadedAt } : {}),
    ...(hydrated.updatedAt ? { updatedAt: hydrated.updatedAt } : {}),
  };
}

function ensureUniqueIds(entries: ShortFormBackgroundVideoEntry[]) {
  const used = new Set<string>();
  return entries.map((entry, index) => {
    let candidate = normalizeString(entry.id, `${DEFAULT_BACKGROUND_ID}-${index + 1}`);
    if (!candidate) candidate = `${DEFAULT_BACKGROUND_ID}-${index + 1}`;
    if (!used.has(candidate)) {
      used.add(candidate);
      return entry;
    }

    let suffix = 2;
    while (used.has(`${candidate}-${suffix}`)) suffix += 1;
    const nextId = `${candidate}-${suffix}`;
    used.add(nextId);
    return { ...entry, id: nextId };
  });
}

function normalizeSettings(value: unknown): ShortFormBackgroundVideoSettings {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { backgrounds: [] };
  }

  const obj = value as Record<string, unknown>;
  const rawBackgrounds = Array.isArray(obj.backgrounds) ? obj.backgrounds : [];
  const backgrounds = ensureUniqueIds(
    rawBackgrounds
      .map((entry, index) => hydrateBackgroundEntry(entry, index))
      .filter((entry): entry is ShortFormBackgroundVideoEntry => Boolean(entry))
  );
  const defaultBackgroundVideoId = normalizeString(obj.defaultBackgroundVideoId);

  return {
    ...(backgrounds.some((entry) => entry.id === defaultBackgroundVideoId) ? { defaultBackgroundVideoId } : {}),
    backgrounds,
  };
}

function cleanupRemovedBackgroundFiles(previous: ShortFormBackgroundVideoSettings, next: ShortFormBackgroundVideoSettings) {
  const removedRelativePaths = new Set(
    previous.backgrounds
      .map((entry) => entry.videoRelativePath)
      .filter((relativePath) => !next.backgrounds.some((entry) => entry.videoRelativePath === relativePath))
  );

  for (const relativePath of removedRelativePaths) {
    const absolutePath = path.resolve(getShortFormBackgroundVideosDir(), relativePath);
    const baseDir = path.resolve(getShortFormBackgroundVideosDir());
    if (absolutePath !== baseDir && absolutePath.startsWith(`${baseDir}${path.sep}`) && fs.existsSync(absolutePath)) {
      try {
        fs.unlinkSync(absolutePath);
      } catch {
        // Best effort cleanup only.
      }
    }
  }
}

export function getShortFormBackgroundVideosDir() {
  return ensureBackgroundVideosDir();
}

export function getShortFormBackgroundVideoSettings() {
  if (!fs.existsSync(SETTINGS_PATH)) return { backgrounds: [] } satisfies ShortFormBackgroundVideoSettings;

  try {
    return normalizeSettings(JSON.parse(fs.readFileSync(SETTINGS_PATH, "utf-8")));
  } catch {
    return { backgrounds: [] } satisfies ShortFormBackgroundVideoSettings;
  }
}

export function saveShortFormBackgroundVideoSettings(nextSettings: Partial<ShortFormBackgroundVideoSettings>) {
  ensureSettingsDir();
  const current = getShortFormBackgroundVideoSettings();
  const merged = normalizeSettings({
    ...current,
    ...nextSettings,
    backgrounds: nextSettings.backgrounds || current.backgrounds,
  });

  cleanupRemovedBackgroundFiles(current, merged);
  fs.writeFileSync(
    SETTINGS_PATH,
    JSON.stringify(
      {
        ...(merged.defaultBackgroundVideoId ? { defaultBackgroundVideoId: merged.defaultBackgroundVideoId } : {}),
        backgrounds: merged.backgrounds.map((entry, index) => persistBackgroundEntry(entry, index)).filter(Boolean),
      },
      null,
      2
    ),
    "utf-8"
  );

  return getShortFormBackgroundVideoSettings();
}

export function resolveShortFormBackgroundVideoSelection(preferredBackgroundVideoId?: string): ShortFormResolvedBackgroundVideoSelection {
  const settings = getShortFormBackgroundVideoSettings();
  const projectBackground = preferredBackgroundVideoId
    ? settings.backgrounds.find((background) => background.id === preferredBackgroundVideoId)
    : undefined;
  if (projectBackground) {
    return { background: projectBackground, resolvedBackgroundVideoId: projectBackground.id, source: "project" };
  }

  const defaultBackground = settings.defaultBackgroundVideoId
    ? settings.backgrounds.find((background) => background.id === settings.defaultBackgroundVideoId)
    : undefined;
  if (defaultBackground) {
    return { background: defaultBackground, resolvedBackgroundVideoId: defaultBackground.id, source: "default" };
  }

  const fallbackBackground = settings.backgrounds[0];
  if (fallbackBackground) {
    return { background: fallbackBackground, resolvedBackgroundVideoId: fallbackBackground.id, source: "fallback" };
  }

  return { source: "none" };
}

export function resolveShortFormBackgroundVideoAbsolutePath(relativePath: string) {
  const absolutePath = path.resolve(getShortFormBackgroundVideosDir(), relativePath);
  const baseDir = path.resolve(getShortFormBackgroundVideosDir());
  if (absolutePath !== baseDir && !absolutePath.startsWith(`${baseDir}${path.sep}`)) {
    throw new Error(`Invalid background video path: ${relativePath}`);
  }
  if (!fs.existsSync(absolutePath) || !fs.statSync(absolutePath).isFile()) {
    throw new Error(`Background video not found: ${relativePath}`);
  }
  return absolutePath;
}
