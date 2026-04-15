#!/usr/bin/env node

import fs from "fs";
import path from "path";
import { spawnSync } from "child_process";

const jobPath = process.argv[2];

if (!jobPath) {
  process.exit(1);
}

const HOME_DIR = process.env.HOME || "/Users/ittaisvidler";
const XML_SCENE_IMAGES_SCRIPT = path.join(HOME_DIR, ".openclaw", "skills", "xml-scene-images", "scripts", "generate_from_xml.py");
const XML_SCENE_VIDEO_SCRIPT = path.join(HOME_DIR, ".openclaw", "skills", "xml-scene-video", "scripts", "generate_video.py");
const DEFAULT_IMAGE_MODEL = "google/gemini-3-pro-image-preview";
const DEFAULT_IMAGE_RESOLUTION = "1K";
const DEFAULT_IMAGE_ASPECT_RATIO = "9:16";
const DEFAULT_IMAGE_HEADER_PERCENT = "28";
const DEFAULT_IMAGE_STYLE_PRESET = "dark-charcoal-natural-header";
const DEFAULT_IMAGE_SUBJECT = "same androgynous high-fashion model across all scenes, sharp eye area, defined cheekbones, elegant neutral styling";
const DEFAULT_IMAGE_STYLE_PROMPT = "Preserve a natural top caption-safe background area as a real continuation of the same scene, not a boxed header or hard divider. No tiling, split panels, framed prints, inset cards, mockups, collage layouts, or floating rectangles unless explicitly requested. No readable text, labels, subtitles, UI chrome, or watermarks inside the generated artwork. Keep every image as one cohesive full-frame composition with the subject naturally embedded into the environment. Clean dramatic high-contrast pencil-and-charcoal illustration, premium modern TikTok aesthetic, dark smoky atmospheric background, restrained vivid red accents only on the key focal area, minimal clutter.";
const GREEN_SCREEN_SCENE_CONSTRAINTS = [
  "CRITICAL BACKGROUND RULE: render the character and all foreground props against a uniform pure chroma-key green background (#00FF00 or equivalent vivid studio greenscreen) that fills the entire frame edge to edge.",
  "The greenscreen should stay distinctly green, not cyan/teal/blue-green: keep blue in the backdrop as close to zero as possible so the background does not drift toward aqua.",
  "The greenscreen should read like a single flat digital/studio fill: no realistic environment, scenic background, textured backdrop, painted strokes, gradient background, corner darkening, mottled noise, shadows cast onto a wall, floor reflections, haze, smoke, or colored light spill in the green area.",
  "Keep the subject fully in front of the greenscreen with clean silhouette separation, crisp but natural edges, minimal semi-transparent wisps, and no motion blur or smeared edges that would make chroma keying difficult.",
  "Avoid green clothing, green accessories, green makeup, green props, or green translucent objects on the subject. Prefer wardrobe and props that contrast strongly against green.",
  "Lighting should be even and flattering on the subject while keeping the greenscreen flat, vivid, uniform, and easy to key across the whole frame."
].join(" ");
const DEFAULT_VOICE_SPEAKER = "Aiden";
const DEFAULT_VOICE_INSTRUCT = "Educated American male narrator, slightly deeper and lower-pitched, polished and confident, calm authority, crisp social-video pacing, speak only English, no other languages or non-speech sounds.";
const DEFAULT_VOICE_PREVIEW_TEXT = "Your jawline doesn't start at your jaw. It starts with how your whole neck and face are stacking.";
const DEFAULT_VOICE_MODE = "voice-design";
const DEFAULT_VOICE_ID = "voice-calm-authority";
const DEFAULT_MUSIC_PROMPT = "instrumental cinematic curiosity underscore, mysterious but pleasant, warm synth pulse, light percussion, airy textures, subtle piano and marimba accents, sense of discovery, modern and polished, no horror, no dread, no dark drones, no jump scares, no vocals, no singing, no choir, no spoken voice";
const DEFAULT_MUSIC_VOLUME = "0.38";
const DEFAULT_MUSIC_ID = "music-curiosity-underscore";
const DEFAULT_MUSIC_PREVIEW_DURATION_SECONDS = 12;
const DEFAULT_ACE_STEP_URL = "http://127.0.0.1:8011";
const STYLE_REFERENCE_IMAGES_DIR = path.join(
  HOME_DIR,
  "tenxsolo",
  "business",
  "content",
  "deliverables",
  "short-form-videos",
  "_style-reference-images",
);
const VIDEO_RENDER_SETTINGS_PATH = path.join(
  HOME_DIR,
  "tenxsolo",
  "business",
  "content",
  "deliverables",
  "short-form-videos",
  "_video-render-settings.json",
);

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf-8"));
}

function normalizeString(value, fallback) {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function createDefaultVoice() {
  return {
    id: DEFAULT_VOICE_ID,
    name: "Calm Authority",
    mode: DEFAULT_VOICE_MODE,
    voiceDesignPrompt: DEFAULT_VOICE_INSTRUCT,
    notes: "Starter VoiceDesign preset for short-form narration.",
    previewText: DEFAULT_VOICE_PREVIEW_TEXT,
  };
}

function normalizeVoiceMode(value, fallback = DEFAULT_VOICE_MODE) {
  return value === "custom-voice" ? "custom-voice" : fallback;
}

function normalizeVoiceEntry(value, fallback, index) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const mode = normalizeVoiceMode(value.mode, fallback.mode);
  const voice = {
    id: normalizeString(value.id, fallback.id || `voice-${index + 1}`),
    name: normalizeString(value.name, fallback.name || `Voice ${index + 1}`),
    mode,
    voiceDesignPrompt: normalizeString(
      value.voiceDesignPrompt,
      normalizeString(value.legacyInstruct, fallback.voiceDesignPrompt || DEFAULT_VOICE_INSTRUCT)
    ),
    notes: normalizeString(value.notes, fallback.notes || ""),
    previewText: normalizeString(value.previewText, fallback.previewText || DEFAULT_VOICE_PREVIEW_TEXT),
  };

  if (mode === "custom-voice") {
    voice.speaker = normalizeString(value.speaker, fallback.speaker || DEFAULT_VOICE_SPEAKER);
    voice.legacyInstruct = normalizeString(value.legacyInstruct, fallback.legacyInstruct || voice.voiceDesignPrompt);
    voice.voiceDesignPrompt = normalizeString(value.voiceDesignPrompt, voice.legacyInstruct || DEFAULT_VOICE_INSTRUCT);
  }

  return voice;
}

function ensureUniqueVoiceIds(voices) {
  const used = new Set();
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

function createDefaultMusic() {
  return {
    id: DEFAULT_MUSIC_ID,
    name: "Curiosity underscore",
    prompt: DEFAULT_MUSIC_PROMPT,
    notes: "Starter instrumental ACE-Step preset for short-form videos.",
    previewDurationSeconds: DEFAULT_MUSIC_PREVIEW_DURATION_SECONDS,
  };
}

function normalizeMusicEntry(value, fallback, index) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const prompt = normalizeString(value.prompt, fallback.prompt);
  const parsedDuration = Number(value.previewDurationSeconds);
  return {
    id: normalizeString(value.id, fallback.id || `music-${index + 1}`),
    name: normalizeString(value.name, fallback.name || `Music ${index + 1}`),
    prompt,
    notes: normalizeString(value.notes, fallback.notes || ""),
    previewDurationSeconds: Number.isFinite(parsedDuration)
      ? Math.min(30, Math.max(6, Math.round(parsedDuration)))
      : fallback.previewDurationSeconds,
  };
}

function ensureUniqueMusicIds(tracks) {
  const used = new Set();
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

function migrateLegacyQwenVoice(parsed) {
  const speaker = normalizeString(parsed?.qwenVoice?.speaker, DEFAULT_VOICE_SPEAKER);
  const instruct = normalizeString(parsed?.qwenVoice?.instruct, DEFAULT_VOICE_INSTRUCT);
  const previewText = normalizeString(parsed?.qwenVoice?.previewText, DEFAULT_VOICE_PREVIEW_TEXT);
  const voice = {
    id: "voice-migrated-legacy",
    name: `Migrated legacy voice (${speaker})`,
    mode: "custom-voice",
    speaker,
    legacyInstruct: instruct,
    voiceDesignPrompt: instruct,
    notes: "Migrated automatically from the previous speaker + instruction settings.",
    previewText,
  };
  const music = createDefaultMusic();
  return {
    defaultVoiceId: voice.id,
    voices: [voice],
    defaultMusicTrackId: music.id,
    musicVolume: Number(DEFAULT_MUSIC_VOLUME),
    musicTracks: [music],
  };
}

function readVideoRenderSettings() {
  const defaultVoice = createDefaultVoice();
  const defaultMusic = createDefaultMusic();
  const defaultSettings = {
    defaultVoiceId: defaultVoice.id,
    voices: [defaultVoice],
    defaultMusicTrackId: defaultMusic.id,
    musicVolume: Number(DEFAULT_MUSIC_VOLUME),
    musicTracks: [defaultMusic],
  };

  if (!fs.existsSync(VIDEO_RENDER_SETTINGS_PATH)) {
    return defaultSettings;
  }

  try {
    const parsed = JSON.parse(fs.readFileSync(VIDEO_RENDER_SETTINGS_PATH, "utf-8"));
    if (parsed?.qwenVoice && typeof parsed.qwenVoice === "object") {
      return migrateLegacyQwenVoice(parsed);
    }

    const rawVoices = Array.isArray(parsed?.voices) ? parsed.voices : [];
    const voices = ensureUniqueVoiceIds(
      rawVoices
        .map((voice, index) => normalizeVoiceEntry(voice, defaultVoice, index))
        .filter(Boolean)
    );
    const normalizedVoices = voices.length > 0 ? voices : [defaultVoice];
    const defaultVoiceId = normalizeString(parsed?.defaultVoiceId, normalizedVoices[0].id);

    const rawMusicTracks = Array.isArray(parsed?.musicTracks) ? parsed.musicTracks : [];
    const musicTracks = ensureUniqueMusicIds(
      rawMusicTracks
        .map((track, index) => normalizeMusicEntry(track, defaultMusic, index))
        .filter(Boolean)
    );
    const normalizedMusicTracks = musicTracks.length > 0 ? musicTracks : [defaultMusic];
    const defaultMusicTrackId = normalizeString(parsed?.defaultMusicTrackId, normalizedMusicTracks[0].id);
    const musicVolume = Number.isFinite(Number(parsed?.musicVolume))
      ? Math.min(1, Math.max(0, Number(parsed.musicVolume)))
      : Number(DEFAULT_MUSIC_VOLUME);

    return {
      defaultVoiceId: normalizedVoices.some((voice) => voice.id === defaultVoiceId) ? defaultVoiceId : normalizedVoices[0].id,
      voices: normalizedVoices,
      defaultMusicTrackId: normalizedMusicTracks.some((track) => track.id === defaultMusicTrackId)
        ? defaultMusicTrackId
        : normalizedMusicTracks[0].id,
      musicVolume,
      musicTracks: normalizedMusicTracks,
    };
  } catch {
    return defaultSettings;
  }
}

function resolveVoiceSelection(preferredVoiceId) {
  const settings = readVideoRenderSettings();
  const projectVoice = preferredVoiceId ? settings.voices.find((voice) => voice.id === preferredVoiceId) : undefined;
  if (projectVoice) {
    return { voice: projectVoice, resolvedVoiceId: projectVoice.id, source: "project" };
  }
  const defaultVoice = settings.voices.find((voice) => voice.id === settings.defaultVoiceId);
  if (defaultVoice) {
    return { voice: defaultVoice, resolvedVoiceId: defaultVoice.id, source: "default" };
  }
  const fallbackVoice = settings.voices[0] || createDefaultVoice();
  return { voice: fallbackVoice, resolvedVoiceId: fallbackVoice.id, source: "fallback" };
}

function resolveMusicSelection(preferredMusicId) {
  const settings = readVideoRenderSettings();
  const projectMusic = preferredMusicId ? settings.musicTracks.find((track) => track.id === preferredMusicId) : undefined;
  if (projectMusic) {
    return { music: projectMusic, resolvedMusicId: projectMusic.id, source: "project", musicVolume: settings.musicVolume };
  }
  const defaultMusic = settings.defaultMusicTrackId ? settings.musicTracks.find((track) => track.id === settings.defaultMusicTrackId) : undefined;
  if (defaultMusic) {
    return { music: defaultMusic, resolvedMusicId: defaultMusic.id, source: "default", musicVolume: settings.musicVolume };
  }
  const fallbackMusic = settings.musicTracks[0];
  if (fallbackMusic) {
    return { music: fallbackMusic, resolvedMusicId: fallbackMusic.id, source: "fallback", musicVolume: settings.musicVolume };
  }
  return { source: "none", musicVolume: settings.musicVolume };
}

function writeJson(filePath, value) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2), "utf-8");
}

function getProjectMetaPath(projectId) {
  return path.join(getProjectDir(projectId), "project.json");
}

function getProjectDir(projectId) {
  return path.join(
    HOME_DIR,
    "tenxsolo",
    "business",
    "content",
    "deliverables",
    "short-form-videos",
    projectId,
  );
}

function getSceneGeneratorManifestPath(projectId) {
  return path.join(getProjectDir(projectId), "scenes", "manifest.json");
}

function toRelativeProjectPath(projectId, value) {
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

function formatSceneImagesDuration(scenes) {
  let total = 0;
  for (const scene of scenes) {
    if (!scene.duration) return undefined;
    const match = String(scene.duration).match(/^(\d+)s$/i);
    if (!match) return undefined;
    total += Number(match[1]);
  }
  return total > 0 ? `${total}s` : undefined;
}

function readProjectMeta(projectId) {
  const projectJsonPath = getProjectMetaPath(projectId);
  if (!fs.existsSync(projectJsonPath)) return undefined;
  try {
    return JSON.parse(fs.readFileSync(projectJsonPath, "utf-8"));
  } catch {
    return undefined;
  }
}

function updateProjectMeta(projectId, updates) {
  const projectJsonPath = getProjectMetaPath(projectId);
  const existing = readProjectMeta(projectId);
  if (!existing || typeof existing !== "object") {
    return;
  }

  writeJson(projectJsonPath, {
    ...existing,
    ...updates,
    updatedAt: new Date().toISOString(),
  });
}

function getPendingFieldForStage(stage) {
  switch (stage) {
    case "research":
      return "pendingResearch";
    case "script":
      return "pendingScript";
    case "scene-images":
      return "pendingSceneImages";
    case "video":
      return "pendingVideo";
    default:
      return undefined;
  }
}

function setStagePending(projectId, stage, pending) {
  const field = getPendingFieldForStage(stage);
  if (!field) return;
  updateProjectMeta(projectId, { [field]: pending });
}

let activeRunContext;

function finalizeRun(overrides = {}) {
  if (!activeRunContext) {
    return;
  }

  const status = overrides.status || "failed";
  const isTerminal = status !== "running";
  if (activeRunContext.finalized && isTerminal) {
    return;
  }

  const { job, statusPath, startedAt, attempts } = activeRunContext;
  const timestamp = new Date().toISOString();
  const payload = {
    status,
    runId: job.runId,
    stage: job.stage,
    projectId: job.projectId,
    startedAt,
    attempts,
    ...overrides,
  };

  if (status === "verified" && !payload.verifiedAt) {
    payload.verifiedAt = timestamp;
  }
  if (status === "failed" && !payload.failedAt) {
    payload.failedAt = timestamp;
  }

  try {
    writeJson(statusPath, payload);
  } catch {
    // Best effort: preserve the original failure reason if we can, but never throw from cleanup.
  }

  if (isTerminal) {
    try {
      setStagePending(job.projectId, job.stage, false);
    } catch {
      // Best effort cleanup only.
    }
  }

  activeRunContext.finalized = isTerminal;
}

function readProjectTopic(projectId) {
  const project = readProjectMeta(projectId);
  return typeof project?.topic === "string" ? project.topic.trim() : "";
}

function readExistingDocMetadata(docPath) {
  if (!fs.existsSync(docPath)) {
    return { title: "", status: "" };
  }

  try {
    const existing = fs.readFileSync(docPath, "utf-8");
    const titleMatch = existing.match(/\ntitle:\s*"?([^\n"]+)"?/i);
    const statusMatch = existing.match(/\nstatus:\s*([^\n]+)/i);
    return {
      title: titleMatch?.[1]?.trim() || "",
      status: statusMatch?.[1]?.trim() || "",
    };
  } catch {
    return { title: "", status: "" };
  }
}

function normalizeDocStatus(existingStatus) {
  return existingStatus && existingStatus !== "draft" && existingStatus !== "requested changes"
    ? existingStatus
    : "needs review";
}

function stripFrontMatter(content) {
  if (!content.startsWith("---")) {
    return content.trim();
  }

  const match = content.match(/^---\s*\n[\s\S]*?\n---\s*\n?([\s\S]*)$/);
  return (match ? match[1] : content).trim();
}

function resolveXmlRuntimePath(scriptPath, runDir, name) {
  const raw = fs.readFileSync(scriptPath, "utf-8");
  const xml = stripFrontMatter(raw);
  if (!xml.trim()) {
    throw new Error(`Script file does not contain XML body: ${scriptPath}`);
  }
  ensureDir(runDir);
  const runtimePath = path.join(runDir, name);
  fs.writeFileSync(runtimePath, `${xml.trim()}\n`, "utf-8");
  return runtimePath;
}

function parseSceneIdToIndex(sceneId) {
  if (typeof sceneId !== "string") return undefined;
  const match = sceneId.trim().match(/scene-(\d+)/i);
  if (!match) return undefined;
  const value = Number(match[1]);
  return Number.isInteger(value) && value > 0 ? value : undefined;
}

function parseSceneRuntimeSpec(xmlPath) {
  if (!fs.existsSync(xmlPath)) return [];
  const xml = fs.readFileSync(xmlPath, "utf-8");
  const sceneMatches = [...xml.matchAll(/<scene\b([^>]*)>/g)];
  return sceneMatches.map((match, index) => {
    const attrs = match[1] || "";
    const refMatch = attrs.match(/referencePreviousSceneImage\s*=\s*"([^"]+)"/i);
    const raw = refMatch?.[1]?.trim().toLowerCase();
    const referencePreviousSceneImage = raw ? ["1", "true", "yes", "y", "on"].includes(raw) : false;
    return { index: index + 1, referencePreviousSceneImage };
  });
}

function expandSceneIndexesForContinuity(xmlPath, requestedIndexes) {
  const normalized = [...new Set((Array.isArray(requestedIndexes) ? requestedIndexes : [])
    .map((value) => Number(value))
    .filter((value) => Number.isInteger(value) && value > 0))].sort((a, b) => a - b);
  if (normalized.length === 0) return [];

  const scenes = parseSceneRuntimeSpec(xmlPath);
  if (scenes.length === 0) return normalized;

  const expanded = new Set(normalized);
  for (const requestedIndex of normalized) {
    let cursor = requestedIndex + 1;
    while (cursor <= scenes.length) {
      const scene = scenes[cursor - 1];
      if (!scene?.referencePreviousSceneImage) break;
      expanded.add(cursor);
      cursor += 1;
    }
  }

  return [...expanded].sort((a, b) => a - b);
}

function resolveStyleReferenceAbsolutePath(relativePath) {
  if (typeof relativePath !== "string" || !relativePath.trim()) {
    throw new Error("Style reference image path is missing.");
  }

  const absolutePath = path.resolve(STYLE_REFERENCE_IMAGES_DIR, relativePath.trim());
  const baseDir = path.resolve(STYLE_REFERENCE_IMAGES_DIR);
  if (absolutePath !== baseDir && !absolutePath.startsWith(`${baseDir}${path.sep}`)) {
    throw new Error(`Invalid style reference image path: ${relativePath}`);
  }
  if (!fs.existsSync(absolutePath) || !fs.statSync(absolutePath).isFile()) {
    throw new Error(`Style reference image not found: ${relativePath}`);
  }
  return absolutePath;
}

function withGreenScreenPromptTemplates(promptTemplates = {}) {
  const next = { ...promptTemplates };
  const sceneTemplate = normalizeString(next.sceneTemplate, "");
  const styleInstructionsTemplate = normalizeString(next.styleInstructionsTemplate, "");

  next.sceneTemplate = [
    sceneTemplate,
    "",
    "Greenscreen render requirement: output the subject as a clean foreground plate over a uniform chroma-key green background, with no scenic/environment background baked into the image.",
    "Do not reuse, repaint, approximate, or preserve any background/environment from style references, character references, prior scenes, or implied scene descriptions. Carry over only the subject identity, outfit continuity, medium, palette, and lighting treatment on the subject itself.",
  ]
    .filter(Boolean)
    .join("\n")
    .trim();
  next.styleInstructionsTemplate = [
    styleInstructionsTemplate,
    "",
    "Greenscreen compositing requirement: {{greenScreenConstraintBlock}}",
    "When greenscreen output is requested, any instruction about background continuation, scenic atmosphere, or matching the reference background is overridden. Match only the artistic treatment on the foreground subject/props; never inherit the reference background itself.",
  ]
    .filter(Boolean)
    .join("\n")
    .trim();
  return next;
}

function sanitizeGreenScreenConstraints(value) {
  const text = normalizeString(value, "");
  if (!text) return "";

  return text
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => !/(caption-safe background area|real continuation of the same scene|background continuing upward|subject naturally embedded into the environment|same environment)/i.test(line))
    .join("\n");
}

function sanitizeGreenScreenStylePrompt(value) {
  const text = normalizeString(value, "");
  const override = "For greenscreen output, preserve only the artistic medium, palette, rendering approach, and lighting treatment on the foreground subject. Do not recreate or preserve any environment/background from references or prior scenes.";
  return [text, override].filter(Boolean).join(" ").trim();
}

function sanitizeGreenScreenReferenceInstructions(value, usageType) {
  const text = normalizeString(value, "");
  if (usageType === "character") {
    return [
      text,
      "Use this reference only for recurring character identity, face, hair, body proportions, and outfit continuity. Ignore its original background/environment completely.",
    ].filter(Boolean).join(" ").trim();
  }

  return [
    text.replace(/\bbackgrounds?\b/gi, "visual treatment"),
    "Use this reference for medium, palette, brushwork, and lighting style only. Do not copy, preserve, or reinterpret its background/environment when generating greenscreen output.",
  ].filter(Boolean).join(" ").trim();
}

function runCommand(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd,
    env: { ...process.env, ...(options.env || {}) },
    encoding: "utf-8",
    maxBuffer: 10 * 1024 * 1024,
  });

  if (result.status !== 0) {
    throw new Error([
      `${command} exited with status ${result.status ?? "unknown"}`,
      result.stdout?.trim() ? `stdout:\n${result.stdout.trim()}` : "",
      result.stderr?.trim() ? `stderr:\n${result.stderr.trim()}` : "",
    ].filter(Boolean).join("\n\n"));
  }

  return {
    stdout: result.stdout || "",
    stderr: result.stderr || "",
  };
}

async function waitForArtifactPaths(paths, requestedAtMs, timeoutMs, pollMs) {
  const isFreshSince = (filePath) => {
    if (!fs.existsSync(filePath)) return false;
    try {
      return fs.statSync(filePath).mtimeMs >= requestedAtMs - 250;
    } catch {
      return false;
    }
  };

  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const allPresent = paths.every((filePath) => isFreshSince(filePath));
    if (allPresent) {
      return true;
    }
    await sleep(pollMs);
  }
  return paths.every((filePath) => isFreshSince(filePath));
}

function readTextFileStrict(filePath, label = "file") {
  if (!fs.existsSync(filePath)) {
    throw new Error(`${label} not found: ${filePath}`);
  }
  return fs.readFileSync(filePath, "utf-8");
}

function ensureValidTextScriptDraft(content, filePath) {
  if (!normalizeString(content, "")) {
    throw new Error(`Draft file is empty: ${filePath}`);
  }
  if (!content.startsWith("---")) {
    throw new Error(`Draft file is missing YAML front matter: ${filePath}`);
  }
  const body = stripFrontMatter(content);
  if (!body.trim()) {
    throw new Error(`Draft body is empty after front matter: ${filePath}`);
  }
  if (/<\/?(video|script|scene|text|image)\b/i.test(body)) {
    throw new Error(`Draft body still contains XML tags and is not a plain narration script: ${filePath}`);
  }
  return body.trim();
}

function extractJsonReportBlock(reviewContent, reviewPath) {
  const matches = [...reviewContent.matchAll(/```json\s*([\s\S]*?)```/gi)];
  let lastError = "";
  for (let index = matches.length - 1; index >= 0; index -= 1) {
    try {
      return JSON.parse(matches[index][1]);
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }
  }
  throw new Error(lastError
    ? `Review output does not contain a valid fenced JSON block (${reviewPath}): ${lastError}`
    : `Review output does not contain a fenced JSON block (${reviewPath}).`);
}

function toStringList(value) {
  return Array.isArray(value)
    ? value.map((item) => normalizeString(item, "")).filter(Boolean)
    : [];
}

function formatPromptList(items, emptyText = "- None.") {
  if (!Array.isArray(items) || items.length === 0) return emptyText;
  return items.map((item) => `- ${item}`).join("\n");
}

function renderTextScriptPromptTemplate(template, values) {
  return String(template || "").replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_match, key) => {
    const value = values?.[key];
    return value === undefined || value === null ? "" : String(value);
  });
}

function normalizeRuleFeedback(rule, index) {
  if (!rule || typeof rule !== "object" || Array.isArray(rule)) return null;
  const ruleNumber = Number(rule.rule_number);
  const ruleTitle = normalizeString(rule.rule_title, `Rule ${index + 1}`);
  const score = Number(rule.score);
  const why = toStringList(rule.why);
  const howToRaise = toStringList(rule.how_to_raise);
  const preserve = toStringList(rule.preserve);
  return {
    ruleNumber: Number.isFinite(ruleNumber) ? Math.max(1, Math.round(ruleNumber)) : index + 1,
    ruleTitle,
    score: Number.isFinite(score) ? Math.max(1, Math.min(10, Math.round(score))) : undefined,
    why,
    howToRaise,
    preserve,
  };
}

function formatRuleFeedbackForPrompt(ruleFeedback) {
  if (!Array.isArray(ruleFeedback) || ruleFeedback.length === 0) {
    return "- None.";
  }

  return ruleFeedback.map((rule) => {
    const why = rule.why[0] || "No rule-specific explanation captured.";
    const raise = rule.howToRaise[0] || "No concrete fix captured.";
    return `- Rule ${rule.ruleNumber}: ${rule.ruleTitle}${rule.score ? ` (${rule.score}/10)` : ""}\n  Why: ${why}\n  Raise: ${raise}`;
  }).join("\n");
}

function parseTextScriptReview(reviewContent, passingScore) {
  const json = extractJsonReportBlock(reviewContent, "review output");
  const overallScore = Number(json?.overall_grade?.score_100);
  if (!Number.isFinite(overallScore)) {
    throw new Error("Review JSON is missing overall_grade.score_100.");
  }

  const reviewSummary = normalizeString(
    json?.overall_grade?.summary,
    overallScore >= passingScore ? "Draft passed the grading threshold." : "Draft needs another revision."
  );
  const topFixes = toStringList(json?.top_fixes);
  const ruleFeedback = (Array.isArray(json?.rules) ? json.rules : [])
    .map((rule, index) => normalizeRuleFeedback(rule, index))
    .filter(Boolean);
  const ruleFeedbackSummary = ruleFeedback.map((rule) => {
    const preserve = rule.preserve[0];
    const raise = rule.howToRaise[0] || rule.why[0] || "No rewrite guidance captured.";
    return `${rule.ruleNumber}. ${rule.ruleTitle}${rule.score ? ` (${rule.score}/10)` : ""}: ${raise}${preserve ? ` Preserve: ${preserve}` : ""}`;
  });

  return {
    overallGrade: Math.max(0, Math.min(100, Math.round(overallScore))),
    reviewDecision: overallScore >= passingScore ? "pass" : "needs-improvement",
    reviewSummary,
    reviewFeedback: [
      reviewSummary ? `Summary: ${reviewSummary}` : "",
      topFixes.length > 0 ? `Top fixes:\n${formatPromptList(topFixes)}` : "",
      ruleFeedbackSummary.length > 0 ? `Rule feedback:\n${ruleFeedbackSummary.map((line) => `- ${line}`).join("\n")}` : "",
    ].filter(Boolean).join("\n\n"),
    topFixes,
    ruleFeedback,
    json,
  };
}

function getIterationDraftFilename(iterationNumber) {
  return `${String(iterationNumber).padStart(2, "0")}-draft.md`;
}

function getIterationReviewFilename(iterationNumber) {
  return `${String(iterationNumber).padStart(2, "0")}-review.md`;
}

function toPosixRelative(baseDir, targetPath) {
  return path.relative(baseDir, targetPath).split(path.sep).join("/");
}

function createTextScriptRunManifest(config) {
  return {
    runId: config.textScriptRunId,
    startedAt: new Date().toISOString(),
    mode: config.mode,
    status: "running",
    maxIterations: config.maxIterations,
    passingScore: config.passingScore,
    overrideMaxIterations: typeof config.overrideMaxIterations === "number" ? config.overrideMaxIterations : null,
    reviewPrompt: config.reviewPromptTemplate,
    activeStep: "writing",
    activeIterationNumber: 1,
    activeStatusText: `Writing draft 1 of ${config.maxIterations}`,
    iterations: [],
  };
}

function writeTextScriptRunManifest(config, manifest) {
  ensureDir(config.runDir);
  ensureDir(config.iterationsDir);
  fs.writeFileSync(config.runManifestPath, JSON.stringify(manifest, null, 2), "utf-8");
}

function updateTextScriptProgress(config, manifest, progress) {
  manifest.activeStep = progress.activeStep;
  manifest.activeIterationNumber = progress.activeIterationNumber;
  manifest.activeStatusText = progress.activeStatusText;
  writeTextScriptRunManifest(config, manifest);
  finalizeRun({
    status: "running",
    textScriptRunId: config.textScriptRunId,
    activeStep: progress.activeStep,
    activeIterationNumber: progress.activeIterationNumber,
    activeStatusText: progress.activeStatusText,
  });
}

function upsertTextScriptIteration(manifest, iterationNumber, patch) {
  const existingIndex = manifest.iterations.findIndex((item) => Number(item?.number) === iterationNumber);
  const existing = existingIndex >= 0 ? manifest.iterations[existingIndex] : {};
  const next = {
    ...existing,
    ...patch,
    number: iterationNumber,
  };

  if (existingIndex >= 0) {
    manifest.iterations[existingIndex] = next;
  } else {
    manifest.iterations.push(next);
    manifest.iterations.sort((a, b) => Number(a.number || 0) - Number(b.number || 0));
  }

  return next;
}

function buildTextScriptWriterPrompt(config, options) {
  const priorDraftBody = normalizeString(
    options.priorDraftContent ? stripFrontMatter(options.priorDraftContent) : "",
    ""
  );
  const priorDraftBlock = priorDraftBody
    ? ["Prior draft to improve:", priorDraftBody].join("\n")
    : "";
  const priorReviewBlock = options.priorReview
    ? [
        "Prior grader summary:",
        options.priorReview.reviewSummary || "No grader summary captured.",
        "",
        "Prior grader top fixes:",
        formatPromptList(options.priorReview.topFixes),
        "",
        "Prior grader rule feedback:",
        formatRuleFeedbackForPrompt(options.priorReview.ruleFeedback),
      ].join("\n")
    : "";
  const template = config.writerPromptMode === "generate"
    ? config.generatePromptTemplate
    : config.revisePromptTemplate;

  return renderTextScriptPromptTemplate(template, {
    retentionSkillPath: config.retentionSkillPath,
    retentionPlaybookPath: config.retentionPlaybookPath,
    topic: config.topic || "Untitled short-form video",
    selectedHookTextOrFallback: config.selectedHookText || "No explicit hook is selected. Use the topic context.",
    workflowMode: config.mode,
    iterationNumber: options.iterationNumber,
    maxIterations: config.maxIterations,
    draftPath: options.draftPath,
    scriptPath: config.scriptPath,
    runManifestPath: config.runManifestPath,
    revisionNotesOrNone: config.notes || "None.",
    approvedResearch: normalizeString(config.approvedResearch, "No approved research provided."),
    priorDraftBlock,
    priorReviewBlock,
    revisionInstructionLine: config.notes
      ? `Revise the existing plain text script based on this feedback:\n${config.notes}`
      : "No specific revision notes were supplied. Regenerate the existing plain text script in place as a clean rerun from the approved inputs, preserving the current workflow requirements and writing the refreshed result back to the same path.",
    projectDir: config.projectDir,
  });
}

function buildTextScriptGraderPrompt(config, options) {
  return renderTextScriptPromptTemplate(config.reviewPromptTemplate, {
    graderSkillPath: config.graderSkillPath,
    graderRubricPath: config.graderRubricPath,
    topic: config.topic || "Untitled short-form video",
    selectedHookTextOrFallback: config.selectedHookText || "No explicit hook is selected. Grade against the topic context.",
    iterationNumber: options.iterationNumber,
    maxIterations: config.maxIterations,
    passingScore: config.passingScore,
    draftPath: options.draftPath,
    reviewPath: options.reviewPath,
    runManifestPath: config.runManifestPath,
    approvedResearch: normalizeString(config.approvedResearch, "No approved research provided."),
    draftBody: options.draftBody,
  });
}

async function spawnWorkflowAttempt({
  agentId,
  label,
  message,
  model,
  sessionKey,
}) {
  const { url, token } = getGatewayConfig();
  if (!token) {
    throw new Error("Hooks token not found in config");
  }

  const response = await fetch(`${url}/hooks/agent`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      message,
      agentId,
      name: label,
      sessionKey,
      wakeMode: "now",
      deliver: false,
      model,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Webhook failed: ${response.status} ${errorText}`);
  }

  return response.json();
}

async function runTextScriptAgentStep(job, options) {
  const attempts = activeRunContext?.attempts || [];
  const models = Array.isArray(job.preferredModels) && job.preferredModels.length > 0
    ? job.preferredModels
    : ["codex/gpt-5.4", "openrouter/anthropic/claude-3-haiku"];
  let lastError = "Unknown error";

  for (let modelIndex = 0; modelIndex < models.length; modelIndex += 1) {
    const model = models[modelIndex];
    const attempt = {
      index: attempts.length + 1,
      mode: "text-script-agent",
      step: options.step,
      iterationNumber: options.iterationNumber,
      model,
      startedAt: new Date().toISOString(),
    };
    attempts.push(attempt);

    try {
      const stepStartedAt = Date.now();
      const spawnResult = await spawnWorkflowAttempt({
        agentId: options.agentId,
        label: `${job.label}-${options.step}-${String(options.iterationNumber).padStart(2, "0")}-attempt-${modelIndex + 1}`,
        message: options.prompt,
        model,
        sessionKey: `${job.sessionKeyBase}:${job.runId}:text-script:${options.step}:${options.iterationNumber}:attempt-${modelIndex + 1}`,
      });
      attempt.spawnResult = spawnResult;
      attempt.sessionId = spawnResult?.sessionId || spawnResult?.id;

      const verified = await waitForArtifactPaths(
        options.artifactPaths,
        stepStartedAt,
        typeof job.verificationTimeoutMs === "number" ? job.verificationTimeoutMs : 10 * 60_000,
        typeof job.verificationPollMs === "number" ? job.verificationPollMs : 5_000,
      );
      attempt.verified = verified;
      if (!verified) {
        throw new Error(`The ${options.step} step did not write its required artifact(s) in time.`);
      }

      const result = await options.verifyResult();
      attempt.finishedAt = new Date().toISOString();
      return {
        model,
        spawnResult,
        sessionId: attempt.sessionId,
        ...result,
      };
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
      attempt.error = lastError;
      attempt.finishedAt = new Date().toISOString();
    }
  }

  throw new Error(lastError);
}

function publishFinalTextScript(config, manifest, iterationNumber, draftContent, status, statusText) {
  fs.writeFileSync(config.scriptPath, draftContent, "utf-8");
  const publishedContent = readTextFileStrict(config.scriptPath, "final published script");
  if (publishedContent !== draftContent) {
    throw new Error("Final published script does not match the final iteration draft.");
  }

  manifest.iterations = manifest.iterations.map((entry) => ({
    ...entry,
    isFinal: Number(entry.number) === iterationNumber,
  }));
  manifest.finalIterationNumber = iterationNumber;
  manifest.status = status;
  manifest.completedAt = new Date().toISOString();
  manifest.activeStep = "completed";
  manifest.activeIterationNumber = iterationNumber;
  manifest.activeStatusText = statusText;
  writeTextScriptRunManifest(config, manifest);
}

function failTextScriptRun(config, errorMessage) {
  if (!config?.runManifestPath) return;

  let manifest;
  try {
    manifest = fs.existsSync(config.runManifestPath)
      ? JSON.parse(fs.readFileSync(config.runManifestPath, "utf-8"))
      : createTextScriptRunManifest(config);
  } catch {
    manifest = createTextScriptRunManifest(config);
  }

  manifest.status = "failed";
  manifest.completedAt = new Date().toISOString();
  manifest.activeStatusText = errorMessage;
  writeTextScriptRunManifest(config, manifest);
}

async function runDirectTextScript(job) {
  const config = job.directConfig?.config;
  if (!config) {
    throw new Error("Missing direct text-script config");
  }

  ensureDir(config.runDir);
  ensureDir(config.iterationsDir);

  const manifest = createTextScriptRunManifest(config);
  writeTextScriptRunManifest(config, manifest);

  let priorDraftContent = normalizeString(config.currentScriptContent, "");
  if (priorDraftContent.includes("Waiting for Scribe to generate the plain narration text script.")) {
    priorDraftContent = "";
  }
  let priorReview;

  for (let iterationNumber = 1; iterationNumber <= config.maxIterations; iterationNumber += 1) {
    const draftPath = path.join(config.iterationsDir, getIterationDraftFilename(iterationNumber));
    const reviewPath = path.join(config.iterationsDir, getIterationReviewFilename(iterationNumber));
    const draftRelativePath = toPosixRelative(config.runDir, draftPath);
    const reviewRelativePath = toPosixRelative(config.runDir, reviewPath);

    updateTextScriptProgress(config, manifest, {
      activeStep: "writing",
      activeIterationNumber: iterationNumber,
      activeStatusText: `Writing draft ${iterationNumber} of ${config.maxIterations}`,
    });

    const writerResult = await runTextScriptAgentStep(job, {
      agentId: job.agentId,
      step: "writing",
      iterationNumber,
      prompt: buildTextScriptWriterPrompt(config, {
        iterationNumber,
        draftPath,
        priorDraftContent,
        priorReview,
      }),
      artifactPaths: [draftPath],
      verifyResult: async () => {
        const draftContent = readTextFileStrict(draftPath, "draft");
        const draftBody = ensureValidTextScriptDraft(draftContent, draftPath);
        return { draftContent, draftBody };
      },
    });

    const draftTimestamp = new Date().toISOString();
    upsertTextScriptIteration(manifest, iterationNumber, {
      number: iterationNumber,
      kind: "generated",
      createdAt: draftTimestamp,
      updatedAt: draftTimestamp,
      draftPath: draftRelativePath,
      reviewPath: reviewRelativePath,
      writerSessionId: writerResult.sessionId,
      writerModel: writerResult.model,
      isFinal: false,
    });
    writeTextScriptRunManifest(config, manifest);

    updateTextScriptProgress(config, manifest, {
      activeStep: "reviewing",
      activeIterationNumber: iterationNumber,
      activeStatusText: `Grading draft ${iterationNumber} of ${config.maxIterations}`,
    });

    const reviewResult = await runTextScriptAgentStep(job, {
      agentId: job.agentId,
      step: "reviewing",
      iterationNumber,
      prompt: buildTextScriptGraderPrompt(config, {
        iterationNumber,
        draftPath,
        reviewPath,
        draftBody: writerResult.draftBody,
      }),
      artifactPaths: [reviewPath],
      verifyResult: async () => {
        const reviewContent = readTextFileStrict(reviewPath, "review");
        const parsedReview = parseTextScriptReview(reviewContent, config.passingScore);
        return { reviewContent, parsedReview };
      },
    });

    const reviewedTimestamp = new Date().toISOString();
    upsertTextScriptIteration(manifest, iterationNumber, {
      updatedAt: reviewedTimestamp,
      overallGrade: reviewResult.parsedReview.overallGrade,
      reviewDecision: reviewResult.parsedReview.reviewDecision,
      reviewSummary: reviewResult.parsedReview.reviewSummary,
      reviewFeedback: reviewResult.parsedReview.reviewFeedback,
      reviewerSessionId: reviewResult.sessionId,
      reviewerModel: reviewResult.model,
      topFixes: reviewResult.parsedReview.topFixes,
      ruleFeedback: reviewResult.parsedReview.ruleFeedback,
    });
    writeTextScriptRunManifest(config, manifest);

    if (reviewResult.parsedReview.reviewDecision === "pass") {
      publishFinalTextScript(
        config,
        manifest,
        iterationNumber,
        writerResult.draftContent,
        "passed",
        `Passed on draft ${iterationNumber} with ${reviewResult.parsedReview.overallGrade}/100`,
      );
      return {
        finalStatus: "passed",
        finalIterationNumber: iterationNumber,
      };
    }

    priorDraftContent = writerResult.draftContent;
    priorReview = reviewResult.parsedReview;

    if (iterationNumber < config.maxIterations) {
      updateTextScriptProgress(config, manifest, {
        activeStep: "improving",
        activeIterationNumber: iterationNumber + 1,
        activeStatusText: `Improving draft ${iterationNumber} for draft ${iterationNumber + 1}`,
      });
      continue;
    }

    publishFinalTextScript(
      config,
      manifest,
      iterationNumber,
      writerResult.draftContent,
      "max-iterations-reached",
      `Max iterations reached after draft ${iterationNumber} with ${reviewResult.parsedReview.overallGrade}/100`,
    );
    return {
      finalStatus: "max-iterations-reached",
      finalIterationNumber: iterationNumber,
    };
  }

  throw new Error("Text-script workflow exited without producing a final draft.");
}

function buildSceneImagesReviewDoc(projectId, scenes, options = {}) {
  const projectDir = getProjectDir(projectId);
  const existingDocPath = path.join(projectDir, "scene-images.md");
  const topic = readProjectTopic(projectId);
  const existingMeta = readExistingDocMetadata(existingDocPath);
  const status = normalizeDocStatus(existingMeta.status);
  const title = existingMeta.title || (topic ? `Visuals: ${topic}` : "Scene Images");
  const totalDuration = formatSceneImagesDuration(scenes);
  const rows = scenes
    .map((scene) => `| ${scene.number} | ${scene.duration || "—"} | ${String(scene.caption).replace(/\|/g, "\\|")} |`)
    .join("\n");
  const scopeIndexes = Array.isArray(options.sceneIndexes) ? options.sceneIndexes.filter((value) => Number.isInteger(value) && value > 0) : [];
  const scopeIndex = scopeIndexes.length === 1 ? scopeIndexes[0] : parseSceneIdToIndex(options.sceneId);
  const modeLabel = options.mode === "revise" ? "revised" : "generated";
  const scopeLabel = scopeIndexes.length > 1
    ? `Regenerated scenes ${scopeIndexes.join(", ")} because the targeted scene change required deterministic downstream continuity updates.`
    : scopeIndex
      ? `Regenerated scene ${scopeIndex} while preserving the rest of the scene set.`
      : `${options.mode === "revise" ? "Regenerated the storyboard image set" : "Generated the storyboard image set"} from the approved XML script.`;
  const styleReferenceCount = Array.isArray(options.imageStyleReferences) ? options.imageStyleReferences.length : 0;
  const styleReferenceLine = styleReferenceCount > 0
    ? ` This style also supplied ${styleReferenceCount} reusable style-level reference image${styleReferenceCount === 1 ? "" : "s"} with per-reference usage instructions, and those references were passed into Nano Banana for both style grounding and scene generation.`
    : "";

  return [
    "---",
    `title: "${title.replace(/"/g, '\\"')}"`,
    `status: ${status}`,
    `date: "${new Date().toISOString()}"`,
    "agent: workflow",
    "tags:",
    "  - short-form-video",
    "  - scene-images",
    ...(topic ? [`topic: "${topic.replace(/"/g, '\\"')}"`] : []),
    `scene_count: ${scenes.length}`,
    ...(totalDuration ? [`total_duration: ${totalDuration}`] : []),
    `updatedAt: "${new Date().toISOString()}"`,
    "---",
    "",
    "# Visuals Review Document",
    "",
    "## Summary",
    "",
    `${scopeLabel} The direct dashboard workflow now calls the xml-scene-images generator deterministically instead of routing this execution step through Scribe. Each scene should now output a raw green-screen foreground plate for assembly, while dashboard preview videos composite that plate over the project's selected looping background video.`,
    "",
    `This run ${modeLabel} **${scenes.length} visuals** using the structured Nano Banana path with the selected style **${options.imageStyleName || "Default charcoal"}**: one consistent character reference, the selected shared/per-style art direction, natural top caption-safe headroom, and a hard greenscreen requirement so the final video can chroma-key the subject over a persistent looping background video. The generated artwork still contains no baked-in text. When the XML marks a scene with referencePreviousSceneImage=\"true\", the generator also feeds in the previous actual generated scene image as an extra continuity reference.${styleReferenceLine}`,
    ...(options.notes ? ["", "## Request notes", "", options.notes] : []),
    "",
    "## Scene Breakdown",
    "",
    "| Scene | Duration | Caption |",
    "|-------|----------|---------|",
    rows,
    "",
    "## Files Generated",
    "",
    "- `scenes/scene-XX-uncaptioned-1080x1920.png` — raw green-screen scene image for chroma-key assembly",
    "- `scenes/scene-XX-captioned-1080x1920.png` — legacy captioned image preview (kept for compatibility)",
    "- `scenes/scene-XX.png` — legacy copy of the raw green-screen scene image",
    "- dashboard scene preview videos — generated on demand by compositing the raw scene plate over the selected background video",
    "- `scenes/manifest.json` — generator manifest with image prompts and absolute output paths",
    "- `scene-images.json` — dashboard manifest with relative project paths for review UI",
    "",
    "## Location",
    "",
    "All scene image files are stored under `scenes/`. The dashboard manifest and review document are auto-synced from the latest generated scene set.",
  ].join("\n");
}

function syncSceneImageArtifacts(job) {
  if (job.stage !== "scene-images") return;

  const projectDir = getProjectDir(job.projectId);
  const generatedPath = getSceneGeneratorManifestPath(job.projectId);
  if (!fs.existsSync(generatedPath)) return;

  let generated;
  try {
    generated = JSON.parse(fs.readFileSync(generatedPath, "utf-8"));
  } catch {
    return;
  }

  const rawScenes = Array.isArray(generated?.scenes) ? generated.scenes : [];
  if (rawScenes.length === 0) return;

  const scenes = rawScenes.map((scene, index) => ({
    id: `scene-${Number(scene?.index || index + 1)}`,
    number: Number(scene?.index || index + 1),
    caption: typeof scene?.text === "string" ? scene.text.trim() : "",
    startTime: typeof scene?.start === "number" ? scene.start : undefined,
    endTime: typeof scene?.end === "number" ? scene.end : undefined,
    image: toRelativeProjectPath(job.projectId, scene?.uncaptioned) || toRelativeProjectPath(job.projectId, scene?.raw_legacy),
    previewImage: toRelativeProjectPath(job.projectId, scene?.captioned),
    notes: typeof scene?.image_prompt === "string" && scene.image_prompt.trim() ? scene.image_prompt.trim() : undefined,
    duration: typeof scene?.duration === "string" && scene.duration.trim() ? scene.duration.trim() : undefined,
  })).filter((scene) => scene.caption && (scene.image || scene.previewImage));

  if (scenes.length === 0) return;

  fs.writeFileSync(
    path.join(projectDir, "scene-images.json"),
    JSON.stringify({
      scenes: scenes.map(({ id, number, caption, startTime, endTime, image, previewImage, notes }) => ({
        id,
        number,
        caption,
        ...(typeof startTime === "number" ? { startTime } : {}),
        ...(typeof endTime === "number" ? { endTime } : {}),
        ...(image ? { image } : {}),
        ...(previewImage ? { previewImage } : {}),
        ...(notes ? { notes } : {}),
      })),
    }, null, 2),
    "utf-8",
  );

  const docOptions = job.directConfig?.kind === "scene-images" ? job.directConfig.config : {};
  fs.writeFileSync(path.join(projectDir, "scene-images.md"), buildSceneImagesReviewDoc(job.projectId, scenes, docOptions), "utf-8");
}

function readXmlVoiceSelection(projectId) {
  const voiceSelectionPath = path.join(getProjectDir(projectId), "output", "xml-script-work", "voice", "voice-selection.json");
  if (!fs.existsSync(voiceSelectionPath)) return null;
  try {
    const value = JSON.parse(fs.readFileSync(voiceSelectionPath, "utf-8"));
    if (!value || typeof value !== "object") return null;
    const fallback = createDefaultVoice();
    const mode = normalizeVoiceMode(value.mode, fallback.mode);
    return {
      id: normalizeString(value.id, fallback.id),
      name: normalizeString(value.name, fallback.name),
      mode,
      voiceDesignPrompt: normalizeString(value.voiceDesignPrompt, fallback.voiceDesignPrompt),
      ...(mode === "custom-voice"
        ? {
            speaker: normalizeString(value.speaker, fallback.speaker || DEFAULT_VOICE_SPEAKER),
            legacyInstruct: normalizeString(value.legacyInstruct, fallback.legacyInstruct || fallback.voiceDesignPrompt),
          }
        : {}),
    };
  } catch {
    return null;
  }
}

function buildVideoReviewDoc(projectId, config, selectedVoice = createDefaultVoice()) {
  const topic = readProjectTopic(projectId);
  const existingMeta = readExistingDocMetadata(config.videoDocPath);
  const status = normalizeDocStatus(existingMeta.status);
  const title = existingMeta.title || (topic ? `Final Video: ${topic}` : "Final Video");
  const manifestPath = path.join(config.videoWorkDir, "manifest.json");
  let alignmentWarning = "";

  if (fs.existsSync(manifestPath)) {
    try {
      const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf-8"));
      alignmentWarning = typeof manifest?.alignment_warning === "string" ? manifest.alignment_warning.trim() : "";
    } catch {}
  }

  const relativeVideo = toRelativeProjectPath(projectId, config.finalVideoPath) || config.finalVideoPath;
  const relativeWorkDir = toRelativeProjectPath(projectId, config.videoWorkDir) || config.videoWorkDir;

  return [
    "---",
    `title: "${title.replace(/"/g, '\\"')}"`,
    `status: ${status}`,
    `date: "${new Date().toISOString()}"`,
    "agent: workflow",
    "tags:",
    "  - short-form-video",
    "  - final-video",
    ...(topic ? [`topic: "${topic.replace(/"/g, '\\"')}"`] : []),
    `updatedAt: "${new Date().toISOString()}"`,
    "---",
    "",
    "# Final Video Review Document",
    "",
    "## Summary",
    "",
    `${config.mode === "revise" ? "Regenerated" : "Generated"} the final vertical short-form video through the direct dashboard workflow. This execution path now calls the xml-scene-video renderer deterministically instead of routing the render through Scribe.`,
    "",
    "This run stayed on the default deterministic pipeline: the final renderer reused the narration and forced-alignment artifacts from the XML Script step as the source of truth, then rendered the looping background video track, chroma-keyed the green-screen visual plates as foreground elements, overlaid captions separately, added ACE-Step instrumental background music, and applied any per-visual XML camera motion only to the image layer when explicitly present in the XML (otherwise the visual stays static).",
    ...(config.notes ? ["", "## Request notes", "", config.notes] : []),
    ...(alignmentWarning ? ["", "## Alignment warning", "", alignmentWarning] : []),
    "",
    "## Outputs",
    "",
    `- Final video: \`${relativeVideo}\``,
    `- Work directory: \`${relativeWorkDir}\``,
    `- Narration voice: Qwen / ${selectedVoice.mode === "voice-design" ? `VoiceDesign \`${selectedVoice.name}\`` : `legacy custom voice \`${selectedVoice.name}\` / speaker \`${selectedVoice.speaker || DEFAULT_VOICE_SPEAKER}\``}`,
    `- Voice prompt: ${selectedVoice.voiceDesignPrompt}`,
    `- Looping background video: ${config.backgroundVideoName ? `\`${config.backgroundVideoName}\`` : "Not configured"}`,
    "- Music path: ACE-Step instrumental default",
  ].join("\n");
}

function getGatewayConfig() {
  let url = "http://127.0.0.1:18789";
  let token = "";

  const configPath = path.join(HOME_DIR, ".openclaw", "openclaw.json");

  if (fs.existsSync(configPath)) {
    try {
      const config = JSON.parse(fs.readFileSync(configPath, "utf-8"));
      if (config.gateway?.port) url = `http://127.0.0.1:${config.gateway.port}`;
      if (config.hooks?.token) token = config.hooks.token;
    } catch {
      // ignore malformed local config
    }
  }

  return { url, token };
}

function hasFreshArtifact(filePath, requestedAtMs) {
  if (!fs.existsSync(filePath)) return false;

  try {
    return fs.statSync(filePath).mtimeMs > requestedAtMs + 1000;
  } catch {
    return false;
  }
}

async function waitForArtifacts(job, requiredArtifacts, requestedAtMs, timeoutMs, pollMs) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    syncSceneImageArtifacts(job);
    const allPresent = requiredArtifacts.every((filePath) => hasFreshArtifact(filePath, requestedAtMs));
    if (allPresent) {
      return true;
    }

    await sleep(pollMs);
  }

  syncSceneImageArtifacts(job);
  return requiredArtifacts.every((filePath) => hasFreshArtifact(filePath, requestedAtMs));
}

async function spawnAttempt(job, model, attemptIndex) {
  const isRetry = attemptIndex > 0;
  const retryNotice = isRetry
    ? [
        "RETRY NOTICE — THE PREVIOUS SHORT-FORM RUN DID NOT PRODUCE THE REQUIRED ON-DISK ARTIFACTS.",
        "Start fresh from the task below. Do not summarize only in chat.",
        "You must write/update the exact required artifact paths and verify them before finishing.",
      ].join("\n\n")
    : "";

  return spawnWorkflowAttempt({
    agentId: job.agentId,
    label: `${job.label}-attempt-${attemptIndex + 1}`,
    message: isRetry ? `${retryNotice}\n\n${job.task}` : job.task,
    model,
    sessionKey: `${job.sessionKeyBase}:${job.runId}:attempt-${attemptIndex + 1}`,
  });
}

function runDirectSceneImages(job) {
  const config = job.directConfig?.config;
  if (!config) {
    throw new Error("Missing direct scene-images config");
  }

  const runDir = path.join(getProjectDir(job.projectId), ".workflow-runs", job.runId);
  ensureDir(runDir);
  ensureDir(config.outputDir);

  const runtimeXmlPath = resolveXmlRuntimePath(config.scriptPath, runDir, "scene-images-runtime.xml");
  const styleReferences = Array.isArray(config.imageStyleReferences) ? config.imageStyleReferences : [];
  const primaryCharacterReference = styleReferences.find((reference) => reference?.usageType === "character");
  const extraReferencesPayload = styleReferences
    .filter((reference) => reference && reference.id !== primaryCharacterReference?.id)
    .map((reference) => ({
      path: resolveStyleReferenceAbsolutePath(reference.imageRelativePath),
      label: reference.label,
      usageType: reference.usageType || "general",
      usageInstructions: sanitizeGreenScreenReferenceInstructions(
        reference.usageInstructions || "Use this reference as supporting visual context when helpful.",
        reference.usageType || "general",
      ),
    }));
  const extraReferencesJsonPath = path.join(runDir, "style-references.json");
  fs.writeFileSync(extraReferencesJsonPath, JSON.stringify(extraReferencesPayload, null, 2), "utf-8");
  const promptTemplatesJsonPath = path.join(runDir, "nano-banana-prompt-templates.json");
  if (config.imagePromptTemplates && typeof config.imagePromptTemplates === "object") {
    const promptTemplates = withGreenScreenPromptTemplates({
      ...config.imagePromptTemplates,
      greenScreenConstraintBlock: GREEN_SCREEN_SCENE_CONSTRAINTS,
    });
    fs.writeFileSync(promptTemplatesJsonPath, JSON.stringify(promptTemplates, null, 2), "utf-8");
  }

  const args = [
    "run",
    "--with",
    "pillow",
    "python3",
    XML_SCENE_IMAGES_SCRIPT,
    runtimeXmlPath,
    "--output-dir",
    config.outputDir,
    "--model",
    DEFAULT_IMAGE_MODEL,
    "--resolution",
    DEFAULT_IMAGE_RESOLUTION,
    "--aspect-ratio",
    DEFAULT_IMAGE_ASPECT_RATIO,
    "--header-percent",
    String(config.imageStyleHeaderPercent || DEFAULT_IMAGE_HEADER_PERCENT),
    "--style-preset",
    DEFAULT_IMAGE_STYLE_PRESET,
    "--subject",
    config.imageStyleSubject || DEFAULT_IMAGE_SUBJECT,
    "--common-constraints",
    [sanitizeGreenScreenConstraints(config.imageCommonConstraints || ""), GREEN_SCREEN_SCENE_CONSTRAINTS].filter(Boolean).join("\n\n"),
    "--style-extra",
    sanitizeGreenScreenStylePrompt(config.imageStylePrompt || DEFAULT_IMAGE_STYLE_PROMPT),
    "--extra-references-json",
    extraReferencesJsonPath,
    "--force",
  ];

  if (fs.existsSync(promptTemplatesJsonPath)) {
    args.push("--prompt-templates-json", promptTemplatesJsonPath);
  }

  if (primaryCharacterReference?.imageRelativePath) {
    args.push("--character-reference", resolveStyleReferenceAbsolutePath(primaryCharacterReference.imageRelativePath));
  } else {
    const existingReference = path.join(config.outputDir, "character-reference.png");
    if (fs.existsSync(existingReference)) {
      args.push("--character-reference", existingReference);
    }
  }

  const requestedSceneIndexes = [parseSceneIdToIndex(config.sceneId)].filter(Boolean);
  const sceneIndexes = expandSceneIndexesForContinuity(runtimeXmlPath, requestedSceneIndexes);
  if (sceneIndexes.length > 0) {
    args.push("--only-scenes", ...sceneIndexes.map((index) => String(index)));
    config.sceneIndexes = sceneIndexes;
  }
  if (config.notes && config.notes.trim()) {
    const primarySceneIndex = sceneIndexes[0];
    if (primarySceneIndex) {
      args.push("--scene-extra-direction", `${primarySceneIndex}::${config.notes.trim()}`);
    } else {
      args.push("--extra-direction", config.notes.trim());
    }
  }

  const result = runCommand("uv", args);
  syncSceneImageArtifacts(job);
  return {
    command: ["uv", ...args].join(" "),
    stdout: result.stdout.trim(),
    stderr: result.stderr.trim(),
  };
}

function runDirectVideo(job) {
  const config = job.directConfig?.config;
  if (!config) {
    throw new Error("Missing direct video config");
  }

  const projectMeta = readProjectMeta(job.projectId) || {};
  const selectedMusic = resolveMusicSelection(projectMeta.selectedMusicId);
  if (!config.backgroundVideoPath) {
    throw new Error("Missing background video selection for final-video generation. Configure a background video in short-form settings and select one on the project before rendering.");
  }

  const runDir = path.join(getProjectDir(job.projectId), ".workflow-runs", job.runId);
  ensureDir(runDir);
  ensureDir(path.dirname(config.finalVideoPath));
  ensureDir(config.videoWorkDir);

  const runtimeXmlPath = resolveXmlRuntimePath(config.scriptPath, runDir, "video-runtime.xml");
  const xmlWorkDir = path.join(getProjectDir(job.projectId), "output", "xml-script-work");
  const captionsJsonPath = path.join(xmlWorkDir, "captions", "caption-sections.json");
  const existingVoicePath = path.join(xmlWorkDir, "voice", "narration-full.wav");
  const existingAlignmentPath = path.join(xmlWorkDir, "alignment", "word-timestamps.json");
  if (!fs.existsSync(existingVoicePath) || !fs.existsSync(existingAlignmentPath) || !fs.existsSync(captionsJsonPath)) {
    throw new Error("Missing XML narration/alignment/caption artifacts for final-video generation. Run the XML Script step first so Final Video can reuse its narration WAV, forced-alignment JSON, and deterministic captions JSON.");
  }

  const xmlSelectedVoice = readXmlVoiceSelection(job.projectId) || resolveVoiceSelection(projectMeta.selectedVoiceId).voice;
  const args = [
    "run",
    "--with",
    "pillow",
    "python3",
    XML_SCENE_VIDEO_SCRIPT,
    "--xml",
    runtimeXmlPath,
    "--images-dir",
    config.sceneImagesDir,
    "--output",
    config.finalVideoPath,
    "--work-dir",
    config.videoWorkDir,
    "--background-video",
    config.backgroundVideoPath,
    "--tts-engine",
    "qwen",
    "--qwen-mode",
    xmlSelectedVoice.mode,
    ...(xmlSelectedVoice.mode === "custom-voice"
      ? ["--voice-speaker", xmlSelectedVoice.speaker || DEFAULT_VOICE_SPEAKER]
      : []),
    "--voice-instruct",
    xmlSelectedVoice.mode === "custom-voice"
      ? (xmlSelectedVoice.legacyInstruct || xmlSelectedVoice.voiceDesignPrompt || DEFAULT_VOICE_INSTRUCT)
      : xmlSelectedVoice.voiceDesignPrompt,
    "--ace-step-url",
    DEFAULT_ACE_STEP_URL,
    "--existing-voice",
    existingVoicePath,
    "--existing-alignment",
    existingAlignmentPath,
    "--captions-json",
    captionsJsonPath,
    "--music-prompt",
    selectedMusic.music?.prompt || DEFAULT_MUSIC_PROMPT,
    "--music-volume",
    String(selectedMusic.musicVolume ?? Number(DEFAULT_MUSIC_VOLUME)),
    "--force",
  ];

  const result = runCommand("uv", args);
  fs.writeFileSync(config.videoDocPath, buildVideoReviewDoc(job.projectId, config, xmlSelectedVoice), "utf-8");
  return {
    command: ["uv", ...args].join(" "),
    stdout: result.stdout.trim(),
    stderr: result.stderr.trim(),
  };
}

async function main() {
  const job = readJson(jobPath);
  const statusPath = jobPath.replace(/\.job\.json$/, ".status.json");
  const requestedAtMs = Date.parse(job.requestedAt || new Date().toISOString());
  const attempts = [];
  const startedAt = new Date().toISOString();

  activeRunContext = {
    job,
    statusPath,
    startedAt,
    attempts,
    finalized: false,
  };

  finalizeRun({
    status: "running",
  });

  if (job.directConfig?.kind === "text-script" || job.directConfig?.kind === "scene-images" || job.directConfig?.kind === "video") {
    const attempt = {
      index: 1,
      mode: "direct-workflow",
      startedAt: new Date().toISOString(),
    };
    attempts.push(attempt);

    try {
      const directResult = job.directConfig.kind === "text-script"
        ? await runDirectTextScript(job)
        : job.directConfig.kind === "scene-images"
          ? runDirectSceneImages(job)
          : runDirectVideo(job);
      attempt.command = directResult.command;
      attempt.stdout = directResult.stdout;
      attempt.stderr = directResult.stderr;
      attempt.directResult = directResult;
      const verified = job.directConfig.kind === "text-script"
        ? true
        : await waitForArtifacts(
            job,
            job.requiredArtifacts,
            requestedAtMs,
            typeof job.verificationTimeoutMs === "number" ? job.verificationTimeoutMs : 120000,
            typeof job.verificationPollMs === "number" ? job.verificationPollMs : 5000,
          );
      attempt.verified = verified;
      attempt.finishedAt = new Date().toISOString();

      if (!verified) {
        throw new Error("Direct workflow finished, but the required artifact(s) were not detected as fresh on disk.");
      }

      finalizeRun({
        status: "verified",
        ...(job.directConfig.kind === "text-script"
          ? {
              textScriptRunId: job.directConfig.config.textScriptRunId,
              activeStep: "completed",
            }
          : {}),
      });
      return;
    } catch (error) {
      attempt.error = error instanceof Error ? error.message : String(error);
      attempt.finishedAt = new Date().toISOString();
      if (job.directConfig.kind === "text-script") {
        failTextScriptRun(job.directConfig.config, attempt.error);
      }
      finalizeRun({
        status: "failed",
        errorMessage: attempt.error,
      });
      return;
    }
  }

  const models = Array.isArray(job.preferredModels) && job.preferredModels.length > 0
    ? job.preferredModels
    : ["codex/gpt-5.4", "openrouter/anthropic/claude-3-haiku"];

  for (let index = 0; index < models.length; index += 1) {
    const model = models[index];
    const attempt = {
      index: index + 1,
      model,
      startedAt: new Date().toISOString(),
    };
    attempts.push(attempt);
    finalizeRun({
      status: "running",
    });

    try {
      const spawnResult = await spawnAttempt(job, model, index);
      attempt.spawnResult = spawnResult;
      const verified = await waitForArtifacts(
        job,
        job.requiredArtifacts,
        requestedAtMs,
        typeof job.verificationTimeoutMs === "number" ? job.verificationTimeoutMs : 120000,
        typeof job.verificationPollMs === "number" ? job.verificationPollMs : 5000,
      );
      attempt.verified = verified;
      attempt.finishedAt = new Date().toISOString();

      if (verified) {
        finalizeRun({
          status: "verified",
        });
        return;
      }
    } catch (error) {
      attempt.error = error instanceof Error ? error.message : String(error);
      attempt.finishedAt = new Date().toISOString();
    }
  }

  const latestError = [...attempts]
    .reverse()
    .find((attempt) => typeof attempt.error === "string" && attempt.error.trim())
    ?.error;
  finalizeRun({
    status: "failed",
    ...(latestError ? { errorMessage: latestError } : {}),
  });
}

process.on("uncaughtException", (error) => {
  if (activeRunContext?.job?.directConfig?.kind === "text-script") {
    failTextScriptRun(activeRunContext.job.directConfig.config, error instanceof Error ? error.message : String(error));
  }
  finalizeRun({
    status: "failed",
    errorMessage: error instanceof Error ? error.message : String(error),
  });
  process.exit(1);
});

process.on("unhandledRejection", (reason) => {
  if (activeRunContext?.job?.directConfig?.kind === "text-script") {
    failTextScriptRun(activeRunContext.job.directConfig.config, reason instanceof Error ? reason.message : String(reason));
  }
  finalizeRun({
    status: "failed",
    errorMessage: reason instanceof Error ? reason.message : String(reason),
  });
  process.exit(1);
});

main().catch((error) => {
  if (activeRunContext?.job?.directConfig?.kind === "text-script") {
    failTextScriptRun(activeRunContext.job.directConfig.config, error instanceof Error ? error.message : String(error));
  }
  finalizeRun({
    status: "failed",
    errorMessage: error instanceof Error ? error.message : String(error),
  });
  process.exit(1);
});
