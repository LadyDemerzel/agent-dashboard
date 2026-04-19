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
const STATIC_CAPTION_OVERLAY_SCRIPT = path.join(HOME_DIR, "tenxsolo", "systems", "agent-dashboard", "scripts", "render_static_caption_overlays.py");
const ANIMATED_CAPTION_OVERLAY_SCRIPT = path.join(HOME_DIR, "tenxsolo", "systems", "agent-dashboard", "scripts", "render_animated_caption_overlays.py");
const DEFAULT_IMAGE_MODEL = "google/gemini-3-pro-image-preview";
const DEFAULT_IMAGE_RESOLUTION = "1K";
const DEFAULT_IMAGE_ASPECT_RATIO = "9:16";
const DEFAULT_IMAGE_HEADER_PERCENT = "28";
const DEFAULT_IMAGE_STYLE_PRESET = "dark-charcoal-natural-header";
const DEFAULT_IMAGE_SUBJECT = "same androgynous high-fashion model across all scenes, sharp eye area, defined cheekbones, elegant neutral styling";
const DEFAULT_IMAGE_STYLE_PROMPT = "Clean dramatic high-contrast pencil-and-charcoal illustration, premium modern TikTok aesthetic, dark smoky atmospheric background, restrained vivid red accents only on the key focal area, minimal clutter.";
const DEFAULT_VOICE_SPEAKER = "Aiden";
const DEFAULT_VOICE_INSTRUCT = "Educated American male narrator, slightly deeper and lower-pitched, polished and confident, calm authority, crisp social-video pacing, speak only English, no other languages or non-speech sounds.";
const DEFAULT_VOICE_PREVIEW_TEXT = "Most people think their face shape is fixed, but posture, breathing, and muscular balance change more than you expect. In this lesson, I will walk through the habits that matter most, the mistakes that waste effort, and the small adjustments that create visible changes over time. Keep your shoulders relaxed, your neck long, and your breathing steady as we go step by step.";
const DEFAULT_VOICE_MODE = "voice-design";
const DEFAULT_VOICE_ID = "voice-calm-authority";
const DEFAULT_MUSIC_PROMPT = "instrumental cinematic curiosity underscore, mysterious but pleasant, warm synth pulse, light percussion, airy textures, subtle piano and marimba accents, sense of discovery, modern and polished, no horror, no dread, no dark drones, no jump scares, no vocals, no singing, no choir, no spoken voice";
const DEFAULT_MUSIC_VOLUME = "0.38";
const DEFAULT_MUSIC_ID = "music-curiosity-underscore";
const DEFAULT_MUSIC_PREVIEW_DURATION_SECONDS = 12;
const DEFAULT_CAPTION_STYLE_ID = "caption-classic-highlight";
const DEFAULT_CAPTION_HORIZONTAL_PADDING = 80;
const DEFAULT_CAPTION_BOTTOM_MARGIN = 220;
const DEFAULT_CAPTION_FONT_WEIGHT = 700;
const CAPTION_FONT_WEIGHT_SUFFIX_RE = /\s+(thin|hairline|extra\s*light|ultra\s*light|light|book|regular|normal|medium|semi\s*bold|semibold|demi\s*bold|bold|extra\s*bold|ultra\s*bold|black|heavy)\s*$/i;
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
const MUSIC_LIBRARY_DIR = path.join(
  HOME_DIR,
  "tenxsolo",
  "business",
  "content",
  "deliverables",
  "short-form-videos",
  "_music-library",
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

function normalizeStoredRelativePath(value) {
  if (typeof value !== "string" || !value.trim()) return undefined;
  const normalized = value.trim().split(path.sep).join("/").replace(/^\/+/, "");
  if (!normalized || normalized.includes("..") || path.isAbsolute(normalized)) return undefined;
  return normalized;
}

function resolveMusicLibraryAbsolutePath(relativePath) {
  return path.resolve(MUSIC_LIBRARY_DIR, relativePath);
}

function readReusableMusicArtifact(track, value) {
  const generatedAudioRelativePath = normalizeStoredRelativePath(value.generatedAudioRelativePath);
  const generatedPrompt = normalizeString(value.generatedPrompt, "");
  const generatedDurationSeconds = Number.isFinite(Number(value.generatedDurationSeconds))
    ? Math.min(30, Math.max(6, Math.round(Number(value.generatedDurationSeconds))))
    : (track.previewDurationSeconds || DEFAULT_MUSIC_PREVIEW_DURATION_SECONDS);
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
    generatedAt: normalizeString(value.generatedAt, "") || undefined,
  };
}

function createDefaultVoice() {
  return {
    id: DEFAULT_VOICE_ID,
    name: "Calm Authority",
    sourceType: "generated",
    mode: DEFAULT_VOICE_MODE,
    voiceDesignPrompt: DEFAULT_VOICE_INSTRUCT,
    notes: "Starter VoiceDesign preset for short-form narration.",
    previewText: DEFAULT_VOICE_PREVIEW_TEXT,
  };
}

function normalizeVoiceMode(value, fallback = DEFAULT_VOICE_MODE) {
  return value === "custom-voice" ? "custom-voice" : fallback;
}

function normalizeVoiceSourceType(value) {
  return value === "uploaded-reference" ? "uploaded-reference" : "generated";
}

function buildUploadedReferenceFallbackPrompt(name) {
  const normalizedName = normalizeString(name, "uploaded reference voice") || "uploaded reference voice";
  return `Use the uploaded reference clip for the saved voice \"${normalizedName}\" when cloning narration.`;
}

function normalizeVoiceEntry(value, fallback, index) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const mode = normalizeVoiceMode(value.mode, fallback.mode);
  const sourceType = normalizeVoiceSourceType(value.sourceType);
  const name = normalizeString(value.name, fallback.name || `Voice ${index + 1}`);
  const voice = {
    id: normalizeString(value.id, fallback.id || `voice-${index + 1}`),
    name,
    sourceType,
    mode,
    voiceDesignPrompt: normalizeString(
      value.voiceDesignPrompt,
      sourceType === "uploaded-reference"
        ? buildUploadedReferenceFallbackPrompt(name)
        : normalizeString(value.legacyInstruct, fallback.voiceDesignPrompt || DEFAULT_VOICE_INSTRUCT)
    ),
    notes: normalizeString(value.notes, fallback.notes || ""),
    previewText: normalizeString(value.previewText, fallback.previewText || DEFAULT_VOICE_PREVIEW_TEXT),
  };

  if (mode === "custom-voice") {
    voice.speaker = normalizeString(value.speaker, fallback.speaker || DEFAULT_VOICE_SPEAKER);
    voice.legacyInstruct = normalizeString(value.legacyInstruct, fallback.legacyInstruct || voice.voiceDesignPrompt);
    voice.voiceDesignPrompt = normalizeString(value.voiceDesignPrompt, voice.legacyInstruct || DEFAULT_VOICE_INSTRUCT);
  }

  if (typeof value.referenceAudioRelativePath === "string" && value.referenceAudioRelativePath.trim()) {
    voice.referenceAudioRelativePath = value.referenceAudioRelativePath.trim();
  }
  if (typeof value.referenceText === "string" && value.referenceText.trim()) {
    voice.referenceText = value.referenceText.trim();
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

const BUILT_IN_CAPTION_ANIMATION_PRESET_IDS = {
  none: "caption-animation-none",
  stablePop: "caption-animation-stable-pop",
  fluidPop: "caption-animation-fluid-pop",
  pulse: "caption-animation-pulse",
  glow: "caption-animation-glow",
};

const DEFAULT_CAPTION_ANIMATION_PRESET_ID = BUILT_IN_CAPTION_ANIMATION_PRESET_IDS.stablePop;

function track(keyframes) {
  return {
    keyframes: keyframes.map(([time, value, easing]) => ({ time, value, ...(easing ? { easing } : {}) })),
  };
}

function cloneTrack(trackConfig) {
  return {
    keyframes: Array.isArray(trackConfig?.keyframes) ? trackConfig.keyframes.map((frame) => ({ ...frame })) : [],
  };
}

function cloneAnimationConfig(config) {
  return {
    version: 1,
    layoutMode: config.layoutMode,
    timing: { ...config.timing },
    colors: { ...config.colors },
    motion: {
      scale: cloneTrack(config.motion.scale),
      translateXEm: cloneTrack(config.motion.translateXEm),
      translateYEm: cloneTrack(config.motion.translateYEm),
      extraOutlineWidth: cloneTrack(config.motion.extraOutlineWidth),
      extraBlur: cloneTrack(config.motion.extraBlur),
      glowStrength: cloneTrack(config.motion.glowStrength),
      shadowOpacityMultiplier: cloneTrack(config.motion.shadowOpacityMultiplier),
    },
  };
}

const BUILT_IN_CAPTION_ANIMATION_PRESET_CONFIGS = {
  [BUILT_IN_CAPTION_ANIMATION_PRESET_IDS.none]: {
    version: 1,
    layoutMode: "stable",
    timing: { mode: "word-relative", multiplier: 1, minMs: 120, maxMs: 1000, fixedMs: 240 },
    colors: { outlineColorMode: "style-outline", shadowColorMode: "style-shadow", glowColorMode: "style-active-word" },
    motion: {
      scale: track([[0, 1], [1, 1]]),
      translateXEm: track([[0, 0], [1, 0]]),
      translateYEm: track([[0, 0], [1, 0]]),
      extraOutlineWidth: track([[0, 0], [1, 0]]),
      extraBlur: track([[0, 0], [1, 0]]),
      glowStrength: track([[0, 0], [1, 0]]),
      shadowOpacityMultiplier: track([[0, 1], [1, 1]]),
    },
  },
  [BUILT_IN_CAPTION_ANIMATION_PRESET_IDS.stablePop]: {
    version: 1,
    layoutMode: "stable",
    timing: { mode: "word-relative", multiplier: 1, minMs: 120, maxMs: 240, fixedMs: 240 },
    colors: { outlineColorMode: "style-active-word", shadowColorMode: "style-active-word", glowColorMode: "style-active-word" },
    motion: {
      scale: track([[0, 1, "linear"], [0.16, 1.18, "ease-out-cubic"], [1, 1, "ease-out-cubic"]]),
      translateXEm: track([[0, 0], [1, 0]]),
      translateYEm: track([[0, 0, "linear"], [0.16, -0.11, "ease-out-cubic"], [1, 0, "ease-out-cubic"]]),
      extraOutlineWidth: track([[0, 1.1], [0.5, 0.5, "ease-out-cubic"], [1, 0, "ease-out-cubic"]]),
      extraBlur: track([[0, 1.8], [0.5, 1.1, "ease-out-cubic"], [1, 0.6, "ease-out-cubic"]]),
      glowStrength: track([[0, 0.14], [0.35, 0.24, "ease-out-cubic"], [1, 0.06, "ease-out-cubic"]]),
      shadowOpacityMultiplier: track([[0, 0.95], [0.45, 1.12, "ease-out-cubic"], [1, 0.88, "ease-out-cubic"]]),
    },
  },
  [BUILT_IN_CAPTION_ANIMATION_PRESET_IDS.fluidPop]: {
    version: 1,
    layoutMode: "fluid",
    timing: { mode: "word-relative", multiplier: 1, minMs: 120, maxMs: 240, fixedMs: 240 },
    colors: { outlineColorMode: "style-active-word", shadowColorMode: "style-active-word", glowColorMode: "style-active-word" },
    motion: {
      scale: track([[0, 1, "linear"], [0.16, 1.18, "ease-out-cubic"], [1, 1, "ease-out-cubic"]]),
      translateXEm: track([[0, 0], [1, 0]]),
      translateYEm: track([[0, 0, "linear"], [0.16, -0.11, "ease-out-cubic"], [1, 0, "ease-out-cubic"]]),
      extraOutlineWidth: track([[0, 1.1], [0.5, 0.5, "ease-out-cubic"], [1, 0, "ease-out-cubic"]]),
      extraBlur: track([[0, 1.8], [0.5, 1.1, "ease-out-cubic"], [1, 0.6, "ease-out-cubic"]]),
      glowStrength: track([[0, 0.14], [0.35, 0.24, "ease-out-cubic"], [1, 0.06, "ease-out-cubic"]]),
      shadowOpacityMultiplier: track([[0, 0.95], [0.45, 1.12, "ease-out-cubic"], [1, 0.88, "ease-out-cubic"]]),
    },
  },
  [BUILT_IN_CAPTION_ANIMATION_PRESET_IDS.pulse]: {
    version: 1,
    layoutMode: "stable",
    timing: { mode: "word-relative", multiplier: 1, minMs: 180, maxMs: 320, fixedMs: 320 },
    colors: { outlineColorMode: "style-outline", shadowColorMode: "style-shadow", glowColorMode: "style-active-word" },
    motion: {
      scale: track([[0, 1.03], [0.25, 1.08, "ease-out-quad"], [0.5, 1.03, "ease-in-out-cubic"], [0.75, 0.98, "ease-in-out-cubic"], [1, 1.03, "ease-in-out-cubic"]]),
      translateXEm: track([[0, 0], [1, 0]]),
      translateYEm: track([[0, -0.03], [1, -0.03]]),
      extraOutlineWidth: track([[0, 0], [1, 0]]),
      extraBlur: track([[0, 0.2], [0.5, 0.4, "ease-in-out-cubic"], [1, 0.2, "ease-in-out-cubic"]]),
      glowStrength: track([[0, 0.18], [0.5, 0.36, "ease-in-out-cubic"], [1, 0.18, "ease-in-out-cubic"]]),
      shadowOpacityMultiplier: track([[0, 1], [0.5, 1.16, "ease-in-out-cubic"], [1, 1, "ease-in-out-cubic"]]),
    },
  },
  [BUILT_IN_CAPTION_ANIMATION_PRESET_IDS.glow]: {
    version: 1,
    layoutMode: "stable",
    timing: { mode: "word-relative", multiplier: 1, minMs: 160, maxMs: 300, fixedMs: 300 },
    colors: { outlineColorMode: "style-active-word", shadowColorMode: "style-active-word", glowColorMode: "style-active-word" },
    motion: {
      scale: track([[0, 1.02], [0.5, 1.06, "ease-in-out-cubic"], [1, 1.02, "ease-in-out-cubic"]]),
      translateXEm: track([[0, 0], [1, 0]]),
      translateYEm: track([[0, -0.015], [1, -0.015]]),
      extraOutlineWidth: track([[0, 0.5], [0.5, 0.85, "ease-in-out-cubic"], [1, 0.5, "ease-in-out-cubic"]]),
      extraBlur: track([[0, 0.8], [0.5, 1.2, "ease-in-out-cubic"], [1, 0.8, "ease-in-out-cubic"]]),
      glowStrength: track([[0, 0.55], [0.5, 0.9, "ease-in-out-cubic"], [1, 0.55, "ease-in-out-cubic"]]),
      shadowOpacityMultiplier: track([[0, 1.15], [0.5, 1.35, "ease-in-out-cubic"], [1, 1.15, "ease-in-out-cubic"]]),
    },
  },
};

function createDefaultAnimationPresets() {
  return [
    { id: BUILT_IN_CAPTION_ANIMATION_PRESET_IDS.none, slug: "none", name: "None", description: "Keep the 3-state word colors without added motion.", builtIn: true, config: cloneAnimationConfig(BUILT_IN_CAPTION_ANIMATION_PRESET_CONFIGS[BUILT_IN_CAPTION_ANIMATION_PRESET_IDS.none]) },
    { id: BUILT_IN_CAPTION_ANIMATION_PRESET_IDS.stablePop, slug: "stable-pop", name: "Stable Pop", description: "Snappy pop animation with locked word slots so neighbors do not shift.", builtIn: true, config: cloneAnimationConfig(BUILT_IN_CAPTION_ANIMATION_PRESET_CONFIGS[BUILT_IN_CAPTION_ANIMATION_PRESET_IDS.stablePop]) },
    { id: BUILT_IN_CAPTION_ANIMATION_PRESET_IDS.fluidPop, slug: "fluid-pop", name: "Fluid Pop", description: "The active word pops while neighboring words reflow within the locked line.", builtIn: true, config: cloneAnimationConfig(BUILT_IN_CAPTION_ANIMATION_PRESET_CONFIGS[BUILT_IN_CAPTION_ANIMATION_PRESET_IDS.fluidPop]) },
    { id: BUILT_IN_CAPTION_ANIMATION_PRESET_IDS.pulse, slug: "pulse", name: "Pulse", description: "A softer rhythmic emphasis with gentle scale breathing and glow.", builtIn: true, config: cloneAnimationConfig(BUILT_IN_CAPTION_ANIMATION_PRESET_CONFIGS[BUILT_IN_CAPTION_ANIMATION_PRESET_IDS.pulse]) },
    { id: BUILT_IN_CAPTION_ANIMATION_PRESET_IDS.glow, slug: "glow", name: "Glow", description: "A brighter active-word glow with a slightly stronger outline and shadow.", builtIn: true, config: cloneAnimationConfig(BUILT_IN_CAPTION_ANIMATION_PRESET_CONFIGS[BUILT_IN_CAPTION_ANIMATION_PRESET_IDS.glow]) },
  ];
}

function createDefaultCaptionStyles() {
  return [
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
      animationPresetId: DEFAULT_CAPTION_ANIMATION_PRESET_ID,
      animationPreset: "stable-pop",
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
      animationPresetId: BUILT_IN_CAPTION_ANIMATION_PRESET_IDS.pulse,
      animationPreset: "pulse",
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
      animationPresetId: BUILT_IN_CAPTION_ANIMATION_PRESET_IDS.glow,
      animationPreset: "glow",
    },
  ];
}

function clampCaptionFontSize(value, fallback = 72) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(160, Math.max(24, Math.round(parsed)));
}

function clampCaptionFontWeight(value, fallback = DEFAULT_CAPTION_FONT_WEIGHT) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(900, Math.max(100, Math.round(parsed / 100) * 100));
}

function clampCaptionWordSpacing(value, fallback = 0) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(32, Math.max(-20, Math.round(parsed * 10) / 10));
}

function clampOutlineWidth(value, fallback = 3.5) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(12, Math.max(0, Math.round(parsed * 10) / 10));
}

function clampShadowStrength(value, fallback = 1.2) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(12, Math.max(0, Math.round(parsed * 10) / 10));
}

function defaultShadowBlur(shadowStrength) {
  return Math.min(16, Math.max(0, Math.round((0.8 + shadowStrength * 1.2) * 10) / 10));
}

function defaultShadowOffsetY(shadowStrength) {
  return Math.min(32, Math.max(0, Math.round((1 + shadowStrength * 2) * 10) / 10));
}

function clampShadowBlur(value, fallback = defaultShadowBlur(1.2)) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(16, Math.max(0, Math.round(parsed * 10) / 10));
}

function clampShadowOffset(value, fallback = 0) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(32, Math.max(-32, Math.round(parsed * 10) / 10));
}

function clampUnitInterval(value, fallback = 0.45) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(1, Math.max(0, Math.round(parsed * 100) / 100));
}

function clampCaptionBackgroundPadding(value, fallback = 20) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(96, Math.max(0, Math.round(parsed)));
}

function clampCaptionBackgroundRadius(value, fallback = 24) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(96, Math.max(0, Math.round(parsed)));
}

function clampCaptionHorizontalPadding(value, fallback = DEFAULT_CAPTION_HORIZONTAL_PADDING) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(320, Math.max(0, Math.round(parsed)));
}

function clampCaptionBottomMargin(value, fallback = DEFAULT_CAPTION_BOTTOM_MARGIN) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(900, Math.max(0, Math.round(parsed)));
}

function inferCaptionFontWeightFromFamily(value) {
  const normalized = String(value || "").trim().replace(/\s+/g, " ");
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

function sanitizeCaptionFontFamily(value, fallback = "Arial") {
  let next = String(value || "").trim().replace(/\s+/g, " ");
  while (CAPTION_FONT_WEIGHT_SUFFIX_RE.test(next)) {
    next = next.replace(CAPTION_FONT_WEIGHT_SUFFIX_RE, "").trim();
  }
  return next || fallback;
}

function normalizeHexColor(value, fallback) {
  if (typeof value !== "string") return fallback;
  const normalized = value.trim().replace(/^#/, "");
  if (!/^[0-9a-fA-F]{6}$/.test(normalized)) return fallback;
  return `#${normalized.toUpperCase()}`;
}

function normalizeCaptionAnimationPreset(value, fallback = "stable-pop") {
  if (value === "word-highlight" || value === "pop") return "stable-pop";
  return value === "none" || value === "stable-pop" || value === "fluid-pop" || value === "pulse" || value === "glow" ? value : fallback;
}

function mapLegacyCaptionAnimationPresetToId(value, fallback = DEFAULT_CAPTION_ANIMATION_PRESET_ID) {
  const preset = normalizeCaptionAnimationPreset(value, "stable-pop");
  if (preset === "none") return BUILT_IN_CAPTION_ANIMATION_PRESET_IDS.none;
  if (preset === "fluid-pop") return BUILT_IN_CAPTION_ANIMATION_PRESET_IDS.fluidPop;
  if (preset === "pulse") return BUILT_IN_CAPTION_ANIMATION_PRESET_IDS.pulse;
  if (preset === "glow") return BUILT_IN_CAPTION_ANIMATION_PRESET_IDS.glow;
  return BUILT_IN_CAPTION_ANIMATION_PRESET_IDS.stablePop || fallback;
}

function normalizeAnimationLayoutMode(value, fallback = "stable") {
  return value === "fluid" || value === "stable" ? value : fallback;
}

function normalizeAnimationTimingMode(value, fallback = "word-relative") {
  return value === "fixed" || value === "word-relative" ? value : fallback;
}

function normalizeAnimationColorMode(value, fallback = "style-active-word") {
  return value === "style-active-word" || value === "style-outline" || value === "style-shadow" || value === "custom" ? value : fallback;
}

function normalizeAnimationEasing(value, fallback = "linear") {
  return value === "linear" || value === "ease-in-quad" || value === "ease-out-quad" || value === "ease-in-out-quad" || value === "ease-out-cubic" || value === "ease-in-out-cubic" || value === "ease-out-back"
    ? value
    : fallback;
}

function normalizeAnimationNumber(value, fallback, min, max, decimals = 4) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Number(Math.min(max, Math.max(min, parsed)).toFixed(decimals));
}

function normalizeAnimationInteger(value, fallback, min, max) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, Math.round(parsed)));
}

function normalizeAnimationTrack(value, fallback, min, max, decimals = 4) {
  const frames = Array.isArray(value?.keyframes)
    ? value.keyframes
    : Array.isArray(value)
      ? value
      : [];
  const normalized = frames
    .flatMap((frame, index) => {
      if (!frame || typeof frame !== "object" || Array.isArray(frame)) return [];
      const fallbackFrame = fallback.keyframes[Math.min(index, fallback.keyframes.length - 1)] || fallback.keyframes[0];
      return [{
        time: normalizeAnimationNumber(frame.time, index === 0 ? 0 : 1, 0, 1, 4),
        value: normalizeAnimationNumber(frame.value, fallbackFrame?.value ?? 0, min, max, decimals),
        easing: normalizeAnimationEasing(frame.easing, fallbackFrame?.easing || "linear"),
      }];
    })
    .sort((a, b) => a.time - b.time || a.value - b.value);

  if (normalized.length === 0) return cloneTrack(fallback);
  if (normalized[0].time > 0) normalized.unshift({ ...normalized[0], time: 0 });
  if (normalized[normalized.length - 1].time < 1) normalized.push({ ...normalized[normalized.length - 1], time: 1 });
  return { keyframes: normalized };
}

function normalizeAnimationConfig(value, fallback) {
  const safeFallback = fallback || BUILT_IN_CAPTION_ANIMATION_PRESET_CONFIGS[DEFAULT_CAPTION_ANIMATION_PRESET_ID];
  const obj = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  const timing = obj.timing && typeof obj.timing === "object" && !Array.isArray(obj.timing) ? obj.timing : {};
  const colors = obj.colors && typeof obj.colors === "object" && !Array.isArray(obj.colors) ? obj.colors : {};
  const motion = obj.motion && typeof obj.motion === "object" && !Array.isArray(obj.motion) ? obj.motion : {};
  return {
    version: 1,
    layoutMode: normalizeAnimationLayoutMode(obj.layoutMode, safeFallback.layoutMode),
    timing: {
      mode: normalizeAnimationTimingMode(timing.mode, safeFallback.timing.mode),
      multiplier: normalizeAnimationNumber(timing.multiplier, safeFallback.timing.multiplier, 0.1, 4, 3),
      minMs: normalizeAnimationInteger(timing.minMs, safeFallback.timing.minMs, 40, 2000),
      maxMs: normalizeAnimationInteger(timing.maxMs, safeFallback.timing.maxMs, 40, 2000),
      fixedMs: normalizeAnimationInteger(timing.fixedMs, safeFallback.timing.fixedMs, 40, 2000),
    },
    colors: {
      outlineColorMode: normalizeAnimationColorMode(colors.outlineColorMode, safeFallback.colors.outlineColorMode),
      ...(normalizeHexColor(colors.outlineColor, "") ? { outlineColor: normalizeHexColor(colors.outlineColor, "") } : normalizeHexColor(safeFallback.colors.outlineColor, "") ? { outlineColor: normalizeHexColor(safeFallback.colors.outlineColor, "") } : {}),
      shadowColorMode: normalizeAnimationColorMode(colors.shadowColorMode, safeFallback.colors.shadowColorMode),
      ...(normalizeHexColor(colors.shadowColor, "") ? { shadowColor: normalizeHexColor(colors.shadowColor, "") } : normalizeHexColor(safeFallback.colors.shadowColor, "") ? { shadowColor: normalizeHexColor(safeFallback.colors.shadowColor, "") } : {}),
      glowColorMode: normalizeAnimationColorMode(colors.glowColorMode, safeFallback.colors.glowColorMode),
      ...(normalizeHexColor(colors.glowColor, "") ? { glowColor: normalizeHexColor(colors.glowColor, "") } : normalizeHexColor(safeFallback.colors.glowColor, "") ? { glowColor: normalizeHexColor(safeFallback.colors.glowColor, "") } : {}),
    },
    motion: {
      scale: normalizeAnimationTrack(motion.scale, safeFallback.motion.scale, 0.2, 4, 4),
      translateXEm: normalizeAnimationTrack(motion.translateXEm, safeFallback.motion.translateXEm, -4, 4, 4),
      translateYEm: normalizeAnimationTrack(motion.translateYEm, safeFallback.motion.translateYEm, -4, 4, 4),
      extraOutlineWidth: normalizeAnimationTrack(motion.extraOutlineWidth, safeFallback.motion.extraOutlineWidth, 0, 16, 4),
      extraBlur: normalizeAnimationTrack(motion.extraBlur, safeFallback.motion.extraBlur, 0, 20, 4),
      glowStrength: normalizeAnimationTrack(motion.glowStrength, safeFallback.motion.glowStrength, 0, 2.5, 4),
      shadowOpacityMultiplier: normalizeAnimationTrack(motion.shadowOpacityMultiplier, safeFallback.motion.shadowOpacityMultiplier, 0, 4, 4),
    },
  };
}

function normalizeAnimationPresetEntry(value, fallback, index) {
  const obj = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  return {
    id: normalizeString(obj.id, fallback.id || `caption-animation-${index + 1}`),
    slug: normalizeString(obj.slug, fallback.slug || "stable-pop"),
    name: normalizeString(obj.name, fallback.name || `Caption animation ${index + 1}`),
    description: normalizeString(obj.description, fallback.description || ""),
    builtIn: typeof obj.builtIn === "boolean" ? obj.builtIn : Boolean(fallback.builtIn),
    config: normalizeAnimationConfig(obj.config, fallback.config),
  };
}

function ensureUniqueAnimationPresetIds(presets) {
  const used = new Set();
  return presets.map((preset, index) => {
    let candidate = normalizeString(preset.id, `caption-animation-${index + 1}`);
    if (!candidate) candidate = `caption-animation-${index + 1}`;
    if (!used.has(candidate)) {
      used.add(candidate);
      return preset;
    }
    let suffix = 2;
    while (used.has(`${candidate}-${suffix}`)) suffix += 1;
    const nextId = `${candidate}-${suffix}`;
    used.add(nextId);
    return { ...preset, id: nextId };
  });
}

function getAnimationPresetById(presets, id, fallbackId = DEFAULT_CAPTION_ANIMATION_PRESET_ID) {
  if (id) {
    const direct = presets.find((preset) => preset.id === id);
    if (direct) return direct;
  }
  return presets.find((preset) => preset.id === fallbackId)
    || presets.find((preset) => preset.slug === "stable-pop")
    || presets[0]
    || createDefaultAnimationPresets()[0];
}

function normalizeFontPath(value) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function normalizeCaptionStyleEntry(value, fallback, index, animationPresets = createDefaultAnimationPresets()) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const fontPath = normalizeFontPath(value.fontPath);
  const backgroundEnabled = typeof value.backgroundEnabled === "boolean"
    ? value.backgroundEnabled
    : Boolean(value.backgroundBoxEnabled);
  const rawFontFamily = normalizeString(value.fontFamily, fallback.fontFamily || "Arial");
  const shadowStrength = clampShadowStrength(value.shadowStrength, fallback.shadowStrength);
  const requestedAnimationPresetId = normalizeString(
    value.animationPresetId,
    mapLegacyCaptionAnimationPresetToId(value.animationPreset, fallback.animationPresetId || DEFAULT_CAPTION_ANIMATION_PRESET_ID),
  );
  const resolvedAnimationPreset = getAnimationPresetById(animationPresets, requestedAnimationPresetId, fallback.animationPresetId || DEFAULT_CAPTION_ANIMATION_PRESET_ID);
  const normalized = {
    id: normalizeString(value.id, fallback.id || `caption-style-${index + 1}`),
    name: normalizeString(value.name, fallback.name || `Caption style ${index + 1}`),
    fontFamily: sanitizeCaptionFontFamily(rawFontFamily, fallback.fontFamily || "Arial"),
    fontWeight: clampCaptionFontWeight(
      value.fontWeight,
      inferCaptionFontWeightFromFamily(rawFontFamily) ?? fallback.fontWeight ?? DEFAULT_CAPTION_FONT_WEIGHT,
    ),
    fontSize: clampCaptionFontSize(value.fontSize, fallback.fontSize),
    wordSpacing: clampCaptionWordSpacing(value.wordSpacing, fallback.wordSpacing ?? 0),
    horizontalPadding: clampCaptionHorizontalPadding(value.horizontalPadding, fallback.horizontalPadding ?? DEFAULT_CAPTION_HORIZONTAL_PADDING),
    bottomMargin: clampCaptionBottomMargin(value.bottomMargin, fallback.bottomMargin ?? DEFAULT_CAPTION_BOTTOM_MARGIN),
    activeWordColor: normalizeHexColor(value.activeWordColor, fallback.activeWordColor),
    spokenWordColor: normalizeHexColor(value.spokenWordColor, fallback.spokenWordColor),
    upcomingWordColor: normalizeHexColor(value.upcomingWordColor, fallback.upcomingWordColor),
    outlineColor: normalizeHexColor(value.outlineColor, fallback.outlineColor),
    outlineWidth: clampOutlineWidth(value.outlineWidth, fallback.outlineWidth),
    shadowColor: normalizeHexColor(value.shadowColor, fallback.shadowColor),
    shadowStrength,
    shadowBlur: clampShadowBlur(value.shadowBlur, fallback.shadowBlur ?? defaultShadowBlur(shadowStrength)),
    shadowOffsetX: clampShadowOffset(value.shadowOffsetX, fallback.shadowOffsetX ?? 0),
    shadowOffsetY: clampShadowOffset(value.shadowOffsetY, fallback.shadowOffsetY ?? defaultShadowOffsetY(shadowStrength)),
    backgroundEnabled,
    backgroundColor: normalizeHexColor(value.backgroundColor, fallback.backgroundColor),
    backgroundOpacity: clampUnitInterval(value.backgroundOpacity, fallback.backgroundOpacity),
    backgroundPadding: clampCaptionBackgroundPadding(value.backgroundPadding, fallback.backgroundPadding ?? 20),
    backgroundRadius: clampCaptionBackgroundRadius(value.backgroundRadius, fallback.backgroundRadius ?? 24),
    animationPresetId: resolvedAnimationPreset.id,
    animationPreset: resolvedAnimationPreset.slug,
    ...(fontPath ? { fontPath } : {}),
  };
  if (!normalized.id || !normalized.name || !normalized.fontFamily) return null;
  return normalized;
}

function ensureUniqueCaptionStyleIds(styles) {
  const used = new Set();
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

function normalizeMusicEntry(value, fallback, index) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const prompt = normalizeString(value.prompt, fallback.prompt);
  const parsedDuration = Number(value.previewDurationSeconds);
  const normalized = {
    id: normalizeString(value.id, fallback.id || `music-${index + 1}`),
    name: normalizeString(value.name, fallback.name || `Music ${index + 1}`),
    prompt,
    notes: normalizeString(value.notes, fallback.notes || ""),
    previewDurationSeconds: Number.isFinite(parsedDuration)
      ? Math.min(30, Math.max(6, Math.round(parsedDuration)))
      : fallback.previewDurationSeconds,
  };
  const artifact = readReusableMusicArtifact(normalized, value);
  if (artifact) {
    normalized.generatedAudioRelativePath = artifact.generatedAudioRelativePath;
    normalized.generatedPrompt = artifact.generatedPrompt;
    normalized.generatedDurationSeconds = artifact.generatedDurationSeconds;
    if (artifact.generatedAt) normalized.generatedAt = artifact.generatedAt;
  }
  return normalized;
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
    defaultCaptionStyleId: DEFAULT_CAPTION_STYLE_ID,
    animationPresets: createDefaultAnimationPresets(),
    captionStyles: createDefaultCaptionStyles(),
  };
}

function readVideoRenderSettings() {
  const defaultVoice = createDefaultVoice();
  const defaultMusic = createDefaultMusic();
  const defaultAnimationPresets = createDefaultAnimationPresets();
  const defaultCaptionStyles = createDefaultCaptionStyles();
  const defaultSettings = {
    defaultVoiceId: defaultVoice.id,
    voices: [defaultVoice],
    defaultMusicTrackId: defaultMusic.id,
    musicVolume: Number(DEFAULT_MUSIC_VOLUME),
    musicTracks: [defaultMusic],
    defaultCaptionStyleId: defaultCaptionStyles[0].id,
    animationPresets: defaultAnimationPresets,
    captionStyles: defaultCaptionStyles,
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

    const rawAnimationPresets = Array.isArray(parsed?.animationPresets) ? parsed.animationPresets : [];
    const animationPresets = ensureUniqueAnimationPresetIds(
      rawAnimationPresets
        .map((preset, index) => normalizeAnimationPresetEntry(preset, defaultAnimationPresets[index] || defaultAnimationPresets[0], index))
        .filter(Boolean)
    );
    const normalizedAnimationPresets = animationPresets.length > 0 ? animationPresets : defaultAnimationPresets;

    const rawCaptionStyles = Array.isArray(parsed?.captionStyles) ? parsed.captionStyles : [];
    const normalizedCaptionStyles = ensureUniqueCaptionStyleIds(
      rawCaptionStyles
        .map((style, index) => normalizeCaptionStyleEntry(style, defaultCaptionStyles[index] || defaultCaptionStyles[0], index, normalizedAnimationPresets))
        .filter(Boolean)
    );
    const captionStyles = normalizedCaptionStyles.length > 0 ? normalizedCaptionStyles : defaultCaptionStyles;
    const defaultCaptionStyleId = normalizeString(parsed?.defaultCaptionStyleId, captionStyles[0].id);

    return {
      defaultVoiceId: normalizedVoices.some((voice) => voice.id === defaultVoiceId) ? defaultVoiceId : normalizedVoices[0].id,
      voices: normalizedVoices,
      defaultMusicTrackId: normalizedMusicTracks.some((track) => track.id === defaultMusicTrackId)
        ? defaultMusicTrackId
        : normalizedMusicTracks[0].id,
      musicVolume,
      musicTracks: normalizedMusicTracks,
      defaultCaptionStyleId: captionStyles.some((style) => style.id === defaultCaptionStyleId)
        ? defaultCaptionStyleId
        : captionStyles[0].id,
      animationPresets: normalizedAnimationPresets,
      captionStyles,
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

function resolveCaptionStyleSelection(preferredCaptionStyleId) {
  const settings = readVideoRenderSettings();
  const projectStyle = preferredCaptionStyleId ? settings.captionStyles.find((style) => style.id === preferredCaptionStyleId) : undefined;
  if (projectStyle) {
    const animationPreset = getAnimationPresetById(settings.animationPresets, projectStyle.animationPresetId);
    return {
      style: { ...projectStyle, animationPresetId: animationPreset.id, animationPreset: animationPreset.slug },
      animationPreset,
      resolvedAnimationPresetId: animationPreset.id,
      resolvedCaptionStyleId: projectStyle.id,
      source: "project",
    };
  }
  const defaultStyle = settings.captionStyles.find((style) => style.id === settings.defaultCaptionStyleId);
  if (defaultStyle) {
    const animationPreset = getAnimationPresetById(settings.animationPresets, defaultStyle.animationPresetId);
    return {
      style: { ...defaultStyle, animationPresetId: animationPreset.id, animationPreset: animationPreset.slug },
      animationPreset,
      resolvedAnimationPresetId: animationPreset.id,
      resolvedCaptionStyleId: defaultStyle.id,
      source: "default",
    };
  }
  const fallbackStyle = settings.captionStyles[0] || createDefaultCaptionStyles()[0];
  const animationPreset = getAnimationPresetById(settings.animationPresets, fallbackStyle.animationPresetId);
  return {
    style: { ...fallbackStyle, animationPresetId: animationPreset.id, animationPreset: animationPreset.slug },
    animationPreset,
    resolvedAnimationPresetId: animationPreset.id,
    resolvedCaptionStyleId: fallbackStyle.id,
    source: "fallback",
  };
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

function updateDirectVideoProgress(activeStep, activeStatusText) {
  finalizeRun({
    status: "running",
    activeStep,
    activeStatusText,
  });
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

function parseXmlAttributes(raw) {
  const attributes = {};
  if (typeof raw !== "string" || !raw.trim()) return attributes;

  for (const match of raw.matchAll(/([A-Za-z_:][\w:.-]*)\s*=\s*(["'])([\s\S]*?)\2/g)) {
    const key = match[1]?.trim();
    if (!key) continue;
    attributes[key] = match[3] || "";
  }

  return attributes;
}

function parseVisualRuntimeSpec(xmlPath) {
  if (!fs.existsSync(xmlPath)) {
    return { visuals: [], assetDependencies: new Map() };
  }

  const xml = fs.readFileSync(xmlPath, "utf-8");
  const assetDependencies = new Map();
  const assetsBody = xml.match(/<assets\b[^>]*>([\s\S]*?)<\/assets>/i)?.[1] || "";
  const timelineBody = xml.match(/<timeline\b[^>]*>([\s\S]*?)<\/timeline>/i)?.[1] || "";

  for (const match of assetsBody.matchAll(/<image\b([^>]*)>([\s\S]*?)<\/image>/gi)) {
    const attributes = parseXmlAttributes(match[1] || "");
    const imageId = typeof attributes.id === "string" ? attributes.id.trim() : "";
    if (!imageId) continue;
    const basedOnImageId = typeof attributes.basedOn === "string" ? attributes.basedOn.trim() : "";
    assetDependencies.set(imageId, basedOnImageId || undefined);
  }

  const visuals = [...timelineBody.matchAll(/<visual\b([^>]*?)(?:\/>|>([\s\S]*?)<\/visual>)/gi)].map((match, index) => {
    const attributes = parseXmlAttributes(match[1] || "");
    const imageId = typeof attributes.imageId === "string" ? attributes.imageId.trim() : "";
    return {
      index: index + 1,
      imageId: imageId || undefined,
    };
  });

  return { visuals, assetDependencies };
}

function collectDependentAssetIds(assetDependencies, rootAssetIds) {
  const seeds = [...new Set((Array.isArray(rootAssetIds) ? rootAssetIds : [])
    .map((value) => (typeof value === "string" ? value.trim() : ""))
    .filter(Boolean))];
  if (seeds.length === 0) return new Set();

  const reverseDependencies = new Map();
  for (const [imageId, basedOnImageId] of assetDependencies.entries()) {
    if (!basedOnImageId) continue;
    const children = reverseDependencies.get(basedOnImageId) || [];
    children.push(imageId);
    reverseDependencies.set(basedOnImageId, children);
  }

  const dependentIds = new Set(seeds);
  const queue = [...seeds];
  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) continue;
    for (const childId of reverseDependencies.get(current) || []) {
      if (dependentIds.has(childId)) continue;
      dependentIds.add(childId);
      queue.push(childId);
    }
  }

  return dependentIds;
}

function expandSceneIndexesForDependencies(xmlPath, requestedIndexes) {
  const normalized = [...new Set((Array.isArray(requestedIndexes) ? requestedIndexes : [])
    .map((value) => Number(value))
    .filter((value) => Number.isInteger(value) && value > 0))].sort((a, b) => a - b);
  if (normalized.length === 0) return [];

  const { visuals, assetDependencies } = parseVisualRuntimeSpec(xmlPath);
  if (visuals.length === 0) return normalized;

  const expanded = new Set(normalized);
  const requestedAssetIds = collectDependentAssetIds(
    assetDependencies,
    normalized
      .map((index) => visuals[index - 1]?.imageId)
      .filter((value) => typeof value === "string" && value.trim())
  );

  if (requestedAssetIds.size > 0) {
    for (const visual of visuals) {
      if (visual?.imageId && requestedAssetIds.has(visual.imageId)) {
        expanded.add(visual.index);
      }
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

let cachedFfmpegFilters;

function ffmpegSupportsFilter(filterName) {
  if (!cachedFfmpegFilters) {
    const result = spawnSync("ffmpeg", ["-hide_banner", "-filters"], {
      encoding: "utf-8",
      maxBuffer: 10 * 1024 * 1024,
    });
    cachedFfmpegFilters = result.status === 0 ? `${result.stdout || ""}\n${result.stderr || ""}` : "";
  }

  const pattern = new RegExp(`\\b${String(filterName).replace(/[.*+?^${}()|[\\]\\]/g, "\\$&")}\\b`);
  return pattern.test(cachedFfmpegFilters || "");
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
    `This run ${modeLabel} **${scenes.length} visuals** using the structured Nano Banana path with the selected style **${options.imageStyleName || "Default charcoal"}**: one consistent character reference, the saved editable style-instructions template plus per-style art direction, natural top caption-safe headroom, and a hard greenscreen requirement so the final video can chroma-key the subject over a persistent looping background video. The generated artwork still contains no baked-in text. Reused XML imageIds stay deterministic, and any XML asset declared with basedOn keeps reference-derived variants explicit in the XML and manifest for debugging.${styleReferenceLine}`,
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
    "- `scenes/scene-XX-captioned-1080x1920.png` — captioned image preview for review",
    "- `scenes/scene-XX.png` — compatibility alias of the raw green-screen scene image",
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
      sourceType: normalizeVoiceSourceType(value.sourceType),
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

function normalizeWordToken(value) {
  if (typeof value !== "string") return "";
  const normalized = value
    .toLowerCase()
    .replace(/[’']/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, "");
  return normalized || value.toLowerCase().trim();
}

function splitCaptionDisplayWords(text) {
  return String(text || "")
    .trim()
    .split(/\s+/)
    .map((word) => word.trim())
    .filter(Boolean);
}

function readAlignmentWords(alignmentPath) {
  try {
    const payload = JSON.parse(fs.readFileSync(alignmentPath, "utf-8"));
    const items = Array.isArray(payload?.items) ? payload.items : [];
    return items
      .map((item, index) => ({
        index,
        text: typeof item?.text === "string" ? item.text : "",
        normalized: normalizeWordToken(item?.text || ""),
        start: Number.isFinite(Number(item?.start_time)) ? Number(item.start_time) : null,
        end: Number.isFinite(Number(item?.end_time)) ? Number(item.end_time) : null,
      }))
      .filter((item) => item.text && item.start !== null && item.end !== null && item.end >= item.start);
  } catch {
    return [];
  }
}

function readCaptionSections(captionsJsonPath) {
  try {
    const payload = JSON.parse(fs.readFileSync(captionsJsonPath, "utf-8"));
    const captions = Array.isArray(payload?.captions) ? payload.captions : [];
    return captions
      .map((caption, index) => ({
        id: typeof caption?.id === "string" ? caption.id : `caption-${index + 1}`,
        index: Number.isFinite(Number(caption?.index)) ? Number(caption.index) : index + 1,
        text: typeof caption?.text === "string" ? caption.text.trim() : "",
        start: Number.isFinite(Number(caption?.start)) ? Number(caption.start) : 0,
        end: Number.isFinite(Number(caption?.end)) ? Number(caption.end) : 0,
      }))
      .filter((caption) => caption.text && caption.end > caption.start)
      .sort((a, b) => a.index - b.index || a.start - b.start || a.end - b.end);
  } catch {
    return [];
  }
}

function fillMissingWordTimings(mappedWords, segmentStart, segmentEnd) {
  const safeStart = Math.max(0, Number(segmentStart) || 0);
  const safeEnd = Math.max(safeStart + 0.05, Number(segmentEnd) || safeStart + 0.05);
  const total = mappedWords.length;
  for (let index = 0; index < total; index += 1) {
    const word = mappedWords[index];
    if (Number.isFinite(word.start) && Number.isFinite(word.end) && word.end > word.start) continue;

    const previousKnown = [...mappedWords.slice(0, index)].reverse().find((item) => Number.isFinite(item.start) && Number.isFinite(item.end));
    const nextKnown = mappedWords.slice(index + 1).find((item) => Number.isFinite(item.start) && Number.isFinite(item.end));
    const regionStart = previousKnown ? previousKnown.end : safeStart;
    const regionEnd = nextKnown ? nextKnown.start : safeEnd;
    const remainingUnknown = mappedWords
      .slice(index)
      .findIndex((item, innerIndex) => innerIndex > 0 && Number.isFinite(item.start) && Number.isFinite(item.end));
    const slots = remainingUnknown === -1 ? total - index : remainingUnknown;
    const span = Math.max(0.05, regionEnd - regionStart);
    const step = span / Math.max(1, slots);
    word.start = regionStart;
    word.end = Math.min(safeEnd, regionStart + step);
  }

  for (let index = 0; index < total; index += 1) {
    const word = mappedWords[index];
    const nextWord = mappedWords[index + 1];
    word.start = Math.max(safeStart, Number.isFinite(word.start) ? word.start : safeStart);
    const fallbackEnd = nextWord && Number.isFinite(nextWord.start) ? nextWord.start : safeEnd;
    word.end = Math.max(word.start + 0.05, Number.isFinite(word.end) ? word.end : fallbackEnd);
    if (nextWord && Number.isFinite(nextWord.start) && word.end > nextWord.start) {
      word.end = Math.max(word.start + 0.05, nextWord.start);
    }
  }
}

function mapCaptionWordsToAlignment(captions, alignmentWords) {
  let cursor = 0;
  let previousCaptionEnd = 0;
  return captions.map((caption) => {
    const displayWords = splitCaptionDisplayWords(caption.text);
    const mappedWords = displayWords.map((displayWord) => ({
      text: displayWord,
      normalized: normalizeWordToken(displayWord),
      start: null,
      end: null,
    }));

    for (let wordIndex = 0; wordIndex < mappedWords.length; wordIndex += 1) {
      const target = mappedWords[wordIndex];
      let matchedIndex = -1;
      for (let searchIndex = cursor; searchIndex < alignmentWords.length; searchIndex += 1) {
        const candidate = alignmentWords[searchIndex];
        if (!candidate?.normalized) continue;
        if (candidate.normalized === target.normalized) {
          matchedIndex = searchIndex;
          break;
        }
      }

      if (matchedIndex !== -1) {
        const matched = alignmentWords[matchedIndex];
        target.start = matched.start;
        target.end = matched.end;
        cursor = matchedIndex + 1;
      }
    }

    const matchedWords = mappedWords.filter((word) => Number.isFinite(word.start) && Number.isFinite(word.end) && word.end > word.start);
    const fallbackStart = Math.max(previousCaptionEnd, Number(caption.start) || 0);
    const fallbackEnd = Math.max(fallbackStart + 0.05, Number(caption.end) || fallbackStart + 0.6);
    const inferredStart = matchedWords.length > 0 ? matchedWords[0].start : fallbackStart;
    const inferredEnd = matchedWords.length > 0 ? matchedWords[matchedWords.length - 1].end : fallbackEnd;

    fillMissingWordTimings(mappedWords, inferredStart, inferredEnd);

    const normalizedStart = mappedWords.length > 0 && Number.isFinite(mappedWords[0].start)
      ? mappedWords[0].start
      : inferredStart;
    const normalizedEnd = mappedWords.length > 0 && Number.isFinite(mappedWords[mappedWords.length - 1].end)
      ? mappedWords[mappedWords.length - 1].end
      : inferredEnd;
    const safeStart = Math.max(previousCaptionEnd, Number(normalizedStart) || fallbackStart);
    const safeEnd = Math.max(safeStart + 0.05, Number(normalizedEnd) || fallbackEnd);
    previousCaptionEnd = safeEnd;

    return {
      ...caption,
      start: safeStart,
      end: safeEnd,
      words: mappedWords,
    };
  });
}

function assTimeFromSeconds(value) {
  const totalCentiseconds = Math.max(0, Math.round(Number(value || 0) * 100));
  const hours = Math.floor(totalCentiseconds / 360000);
  const minutes = Math.floor((totalCentiseconds % 360000) / 6000);
  const seconds = Math.floor((totalCentiseconds % 6000) / 100);
  const centiseconds = totalCentiseconds % 100;
  return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}.${String(centiseconds).padStart(2, "0")}`;
}

function assEscape(text) {
  return String(text || "")
    .replace(/\\/g, "\\\\")
    .replace(/{/g, "\\{")
    .replace(/}/g, "\\}")
    .replace(/\n/g, "\\N");
}

function hexToAssColor(hex, alpha = 0) {
  const normalized = normalizeHexColor(hex, "#FFFFFF").slice(1);
  const r = normalized.slice(0, 2);
  const g = normalized.slice(2, 4);
  const b = normalized.slice(4, 6);
  const a = Math.min(255, Math.max(0, Math.round(alpha * 255)));
  return `&H${a.toString(16).padStart(2, "0").toUpperCase()}${b}${g}${r}&`;
}

function assNumber(value) {
  const parsed = Number(value || 0);
  if (!Number.isFinite(parsed)) return "0";
  return Number.isInteger(parsed) ? String(parsed) : parsed.toFixed(1).replace(/\.0$/, "");
}

function resolveShadowOpacity(style) {
  const shadowStrength = Math.max(0, Number(style.shadowStrength) || 0);
  if (shadowStrength <= 0) return 0;
  return Math.min(0.95, 0.16 + (shadowStrength * 0.1));
}

function buildShadowTags(style) {
  return [
    `\\4c${hexToAssColor(style.shadowColor, 1 - resolveShadowOpacity(style))}`,
    `\\xshad${assNumber(style.shadowOffsetX)}`,
    `\\yshad${assNumber(style.shadowOffsetY)}`,
    `\\blur${assNumber(style.shadowBlur)}`,
  ].join("");
}

function resolveCaptionFontWeight(style) {
  const parsed = Number(style?.fontWeight);
  if (!Number.isFinite(parsed)) return DEFAULT_CAPTION_FONT_WEIGHT;
  return Math.min(900, Math.max(100, Math.round(parsed / 100) * 100));
}

function resolveAssBoldFlag(style) {
  return resolveCaptionFontWeight(style) >= 600 ? -1 : 0;
}

function buildCaptionWeightTags(style) {
  return `\\b${resolveCaptionFontWeight(style)}`;
}

function buildActiveWordTags(style) {
  const preset = style.animationPreset || "stable-pop";
  const tags = [`\\c${hexToAssColor(style.activeWordColor)}`, buildCaptionWeightTags(style), buildShadowTags(style), "\\fscx100", "\\fscy100"];

  if (preset === "pulse") {
    tags.push("\\t(0,120,\\fscx106\\fscy106)", "\\t(120,260,\\fscx100\\fscy100)");
  } else if (preset === "glow") {
    tags.push(`\\3c${hexToAssColor(style.activeWordColor)}`, `\\blur${assNumber(Math.max((style.shadowBlur || 0) + 0.8, 1.2))}`, "\\t(0,160,\\fscx104\\fscy104)", "\\t(160,260,\\fscx100\\fscy100)");
  } else if (preset === "none") {
    // keep the active word color only
  } else {
    const popBlurStart = Math.max((style.shadowBlur || 0) + 1.8, 2.2);
    const popBlurMid = Math.max((style.shadowBlur || 0) + 1.1, 1.6);
    const popBlurEnd = Math.max((style.shadowBlur || 0) + 0.6, 1.0);
    const popOutlineStart = Math.max((style.outlineWidth || 0) + 1.1, 1.4);
    const popOutlineMid = Math.max((style.outlineWidth || 0) + 0.5, style.outlineWidth || 0);
    tags.push(
      `\\3c${hexToAssColor(style.activeWordColor)}`,
      `\\4c${hexToAssColor(style.activeWordColor, 0.28)}`,
      `\\bord${assNumber(popOutlineStart)}`,
      `\\blur${assNumber(popBlurStart)}`,
      `\\t(0,120,\\bord${assNumber(popOutlineMid)}\\blur${assNumber(popBlurMid)})`,
      `\\t(120,260,\\bord${assNumber(style.outlineWidth || 0)}\\blur${assNumber(popBlurEnd)})`,
    );
  }

  return `{${tags.join("")}}`;
}

function buildCaptionStateText(words, activeIndex, style, styleName) {
  const resetTags = `{\\r${styleName}${buildCaptionWeightTags(style)}${buildShadowTags(style)}}`;
  const linePrefix = `{${buildCaptionWeightTags(style)}${buildShadowTags(style)}}`;
  return `${linePrefix}${words.map((word, index) => {
    const escaped = assEscape(word.text);
    if (index < activeIndex) {
      return `{\\c${hexToAssColor(style.spokenWordColor)}}${escaped}${resetTags}`;
    }
    if (index === activeIndex) {
      return `${buildActiveWordTags(style)}${escaped}${resetTags}`;
    }
    return `{\\c${hexToAssColor(style.upcomingWordColor)}}${escaped}${resetTags}`;
  }).join(" ")}`;
}
function buildAnimatedCaptionAssContent(captionTimeline, style, styleName = "CaptionStyleV1") {

  const outlineColor = hexToAssColor(style.outlineColor);
  const shadowBackColor = hexToAssColor(style.shadowColor, 1 - resolveShadowOpacity(style));
  const boxBackColor = hexToAssColor(style.backgroundColor, 1 - style.backgroundOpacity);
  const boxStyleName = `${styleName}Box`;
  const header = [
    "[Script Info]",
    "ScriptType: v4.00+",
    "PlayResX: 1080",
    "PlayResY: 1920",
    "WrapStyle: 0",
    "ScaledBorderAndShadow: yes",
    "",
    "[V4+ Styles]",
    "Format: Name,Fontname,Fontsize,PrimaryColour,SecondaryColour,OutlineColour,BackColour,Bold,Italic,Underline,StrikeOut,ScaleX,ScaleY,Spacing,Angle,BorderStyle,Outline,Shadow,Alignment,MarginL,MarginR,MarginV,Encoding",
    `Style: ${styleName},${style.fontFamily},${style.fontSize},${hexToAssColor(style.upcomingWordColor)},${hexToAssColor(style.activeWordColor)},${outlineColor},${shadowBackColor},${resolveAssBoldFlag(style)},0,0,0,100,100,0,0,1,${style.outlineWidth},${style.shadowStrength > 0 ? 1 : 0},2,${style.horizontalPadding},${style.horizontalPadding},${style.bottomMargin},1`,
    ...(style.backgroundEnabled
      ? [`Style: ${boxStyleName},${style.fontFamily},${style.fontSize},${hexToAssColor("#FFFFFF", 1)},${hexToAssColor("#FFFFFF", 1)},${hexToAssColor("#000000", 1)},${boxBackColor},${resolveAssBoldFlag(style)},0,0,0,100,100,0,0,3,0,0,2,${style.horizontalPadding},${style.horizontalPadding},${style.bottomMargin},1`]
      : []),
    "",
    "[Events]",
    "Format: Layer,Start,End,Style,Name,MarginL,MarginR,MarginV,Effect,Text",
  ];

  const events = [];
  for (const caption of captionTimeline) {
    const words = Array.isArray(caption.words) ? caption.words : [];
    if (words.length === 0) continue;

    const safeCaptionStart = Math.max(0, caption.start);
    const safeCaptionEnd = Math.max(safeCaptionStart + 0.05, caption.end);
    const intervals = [];
    const plainText = words.map((word) => assEscape(word.text)).join(" ");

    if (words[0].start > safeCaptionStart) {
      intervals.push({ start: safeCaptionStart, end: words[0].start, activeIndex: -1 });
    }

    for (let index = 0; index < words.length; index += 1) {
      const word = words[index];
      const nextWord = words[index + 1];
      intervals.push({ start: word.start, end: word.end, activeIndex: index });
      const holdEnd = nextWord ? nextWord.start : safeCaptionEnd;
      if (holdEnd > word.end + 0.01) {
        intervals.push({ start: word.end, end: holdEnd, activeIndex: index + 1 });
      }
    }

    for (const interval of intervals) {
      const start = Math.max(safeCaptionStart, Number(interval.start) || safeCaptionStart);
      const end = Math.min(safeCaptionEnd, Number(interval.end) || safeCaptionEnd);
      if (end - start < 0.04) continue;
      const activeIndex = Math.min(words.length - 1, interval.activeIndex);
      const text = activeIndex < 0
        ? `{${buildCaptionWeightTags(style)}${buildShadowTags(style)}}${words.map((word) => `{\\c${hexToAssColor(style.upcomingWordColor)}}${assEscape(word.text)}{\\r${styleName}${buildCaptionWeightTags(style)}${buildShadowTags(style)}}`).join(" ")}`
        : buildCaptionStateText(words, activeIndex, style, styleName);
      if (style.backgroundEnabled) {
        events.push(`Dialogue: 0,${assTimeFromSeconds(start)},${assTimeFromSeconds(end)},${boxStyleName},,${style.horizontalPadding},${style.horizontalPadding},${style.bottomMargin},,{\\1a&HFF&\\3a&HFF&}${plainText}`);
      }
      events.push(`Dialogue: 1,${assTimeFromSeconds(start)},${assTimeFromSeconds(end)},${styleName},,${style.horizontalPadding},${style.horizontalPadding},${style.bottomMargin},,${text}`);
    }
  }

  return `${header.join("\n")}\n${events.join("\n")}\n`;
}

function escapeSubtitlesFilterPath(filePath) {
  return String(filePath)
    .replace(/\\/g, "\\\\")
    .replace(/:/g, "\\:")
    .replace(/,/g, "\\,")
    .replace(/'/g, "\\\\'")
    .replace(/\[/g, "\\[")
    .replace(/\]/g, "\\]");
}

function toProjectRelativePath(projectId, absolutePath) {
  return path.relative(getProjectDir(projectId), absolutePath).split(path.sep).join("/");
}

function writeBaseVideoArtifact(finalVideoPath, videoWorkDir) {
  const baseVideoPath = path.join(videoWorkDir, "final-base-video.mp4");
  ensureDir(path.dirname(baseVideoPath));
  fs.copyFileSync(finalVideoPath, baseVideoPath);
  return baseVideoPath;
}

function renderStaticCaptionOverlays({ captionsJsonPath, videoWorkDir, captionStyleSelection }) {
  const outputDir = path.join(videoWorkDir, "caption-overlays-static");
  ensureDir(outputDir);
  const style = captionStyleSelection.style;
  runCommand("uv", [
    "run",
    "--with",
    "pillow",
    "python3",
    STATIC_CAPTION_OVERLAY_SCRIPT,
    "--captions-json",
    captionsJsonPath,
    "--output-dir",
    outputDir,
    "--font-family",
    style.fontFamily,
    ...(style.fontPath ? ["--font-path", style.fontPath] : []),
    "--font-size",
    String(style.fontSize),
    "--font-weight",
    String(style.fontWeight || DEFAULT_CAPTION_FONT_WEIGHT),
    "--horizontal-padding",
    String(style.horizontalPadding),
    "--bottom-margin",
    String(style.bottomMargin),
    "--text-color",
    style.activeWordColor,
    "--outline-color",
    style.outlineColor,
    "--outline-width",
    String(style.outlineWidth),
    "--shadow-color",
    style.shadowColor,
    "--shadow-strength",
    String(style.shadowStrength),
    "--shadow-blur",
    String(style.shadowBlur),
    "--shadow-offset-x",
    String(style.shadowOffsetX),
    "--shadow-offset-y",
    String(style.shadowOffsetY),
    "--background-color",
    style.backgroundColor,
    "--background-opacity",
    String(style.backgroundOpacity),
    "--background-padding",
    String(style.backgroundPadding),
    "--background-radius",
    String(style.backgroundRadius),
    ...(style.backgroundEnabled ? ["--background-enabled"] : []),
  ]);

  const manifestPath = path.join(outputDir, "manifest.json");
  const manifest = readJson(manifestPath);
  const entries = Array.isArray(manifest?.entries)
    ? manifest.entries.filter((entry) => entry && typeof entry === "object")
    : [];

  return {
    outputDir,
    manifestPath,
    entries,
  };
}

function renderAnimatedCaptionOverlays({ captionTimeline, videoWorkDir, captionStyleSelection, fps }) {
  const outputDir = path.join(videoWorkDir, "caption-overlays-animated");
  ensureDir(outputDir);
  const style = captionStyleSelection.style;
  const animationPreset = captionStyleSelection.animationPreset && captionStyleSelection.animationPreset.config
    ? captionStyleSelection.animationPreset
    : null;
  const timelinePath = path.join(outputDir, "timeline.json");
  fs.writeFileSync(timelinePath, JSON.stringify({ captions: captionTimeline }, null, 2), "utf-8");

  runCommand("uv", [
    "run",
    "--with",
    "pillow",
    "python3",
    ANIMATED_CAPTION_OVERLAY_SCRIPT,
    "--timeline-json",
    timelinePath,
    "--output-dir",
    outputDir,
    "--font-family",
    style.fontFamily,
    ...(style.fontPath ? ["--font-path", style.fontPath] : []),
    "--font-size",
    String(style.fontSize),
    "--font-weight",
    String(style.fontWeight || DEFAULT_CAPTION_FONT_WEIGHT),
    "--word-spacing",
    String(style.wordSpacing || 0),
    "--horizontal-padding",
    String(style.horizontalPadding),
    "--bottom-margin",
    String(style.bottomMargin),
    "--active-word-color",
    style.activeWordColor,
    "--spoken-word-color",
    style.spokenWordColor,
    "--upcoming-word-color",
    style.upcomingWordColor,
    "--outline-color",
    style.outlineColor,
    "--outline-width",
    String(style.outlineWidth),
    "--shadow-color",
    style.shadowColor,
    "--shadow-strength",
    String(style.shadowStrength),
    "--shadow-blur",
    String(style.shadowBlur),
    "--shadow-offset-x",
    String(style.shadowOffsetX),
    "--shadow-offset-y",
    String(style.shadowOffsetY),
    "--background-color",
    style.backgroundColor,
    "--background-opacity",
    String(style.backgroundOpacity),
    "--background-padding",
    String(style.backgroundPadding),
    "--background-radius",
    String(style.backgroundRadius),
    "--animation-preset",
    String(animationPreset?.slug || style.animationPreset || "stable-pop"),
    ...(animationPreset ? ["--animation-config-json", JSON.stringify(animationPreset.config)] : []),
    "--fps",
    String(fps || 30),
    ...(style.backgroundEnabled ? ["--background-enabled"] : []),
  ]);

  const manifestPath = path.join(outputDir, "manifest.json");
  const manifest = readJson(manifestPath);
  const entries = Array.isArray(manifest?.entries)
    ? manifest.entries.filter((entry) => entry && typeof entry === "object")
    : [];

  return {
    outputDir,
    manifestPath,
    entries,
  };
}

function escapeConcatFilePath(filePath) {
  return String(filePath).replace(/'/g, `'\\''`);
}

function getMediaDurationSeconds(filePath) {
  const result = runCommand("ffprobe", [
    "-v",
    "error",
    "-show_entries",
    "format=duration",
    "-of",
    "default=noprint_wrappers=1:nokey=1",
    filePath,
  ]);
  const duration = Number(result.stdout.trim());
  if (!Number.isFinite(duration) || duration <= 0) {
    throw new Error(`Could not determine media duration for ${filePath}`);
  }
  return duration;
}

function getMediaFrameRate(filePath) {
  try {
    const result = runCommand("ffprobe", [
      "-v",
      "error",
      "-select_streams",
      "v:0",
      "-show_entries",
      "stream=avg_frame_rate,r_frame_rate",
      "-of",
      "default=noprint_wrappers=1:nokey=1",
      filePath,
    ]);
    const lines = String(result.stdout || "")
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
    for (const line of lines) {
      const [numeratorText, denominatorText] = line.split("/");
      const numerator = Number(numeratorText);
      const denominator = Number(denominatorText || "1");
      if (Number.isFinite(numerator) && Number.isFinite(denominator) && denominator > 0) {
        const fps = numerator / denominator;
        if (Number.isFinite(fps) && fps >= 12 && fps <= 120) {
          return fps;
        }
      }
    }
  } catch {}
  return 30;
}

function buildCaptionOverlayTrack({ overlayManifest, totalDurationSeconds, emptyMessage, buildMessage }) {
  const entries = Array.isArray(overlayManifest.entries)
    ? overlayManifest.entries
      .filter((entry) => entry && typeof entry === "object")
      .map((entry) => ({
        relativePath: typeof entry.relativePath === "string" ? entry.relativePath : "",
        start: Number(entry.start),
        end: Number(entry.end),
      }))
      .filter((entry) => entry.relativePath && Number.isFinite(entry.start) && Number.isFinite(entry.end) && entry.end > entry.start)
      .sort((a, b) => a.start - b.start || a.end - b.end)
    : [];

  if (entries.length === 0) {
    throw new Error(emptyMessage);
  }

  const mergedEntries = [];
  for (const entry of entries) {
    const previous = mergedEntries[mergedEntries.length - 1];
    if (
      previous
      && previous.relativePath === entry.relativePath
      && Math.abs(previous.end - entry.start) <= 0.001
    ) {
      previous.end = entry.end;
    } else {
      mergedEntries.push({ ...entry });
    }
  }


  const blankOverlayPath = path.join(overlayManifest.outputDir, "blank-overlay.png");
  if (!fs.existsSync(blankOverlayPath)) {
    runCommand("ffmpeg", [
      "-y",
      "-f",
      "lavfi",
      "-i",
      "color=c=black@0.0:s=1080x1920,format=rgba",
      "-frames:v",
      "1",
      blankOverlayPath,
    ]);
  }

  const concatPath = path.join(overlayManifest.outputDir, "overlay-track.concat.txt");
  const overlayTrackPath = path.join(overlayManifest.outputDir, "overlay-track.mov");
  const lines = [];
  let cursor = 0;
  let lastPathForConcat = blankOverlayPath;

  const pushStill = (filePath, durationSeconds) => {
    const safeDuration = Number(durationSeconds);
    if (!Number.isFinite(safeDuration) || safeDuration <= 0.001) return;
    lines.push(`file '${escapeConcatFilePath(filePath)}'`);
    lines.push(`duration ${safeDuration.toFixed(3)}`);
    lastPathForConcat = filePath;
  };

  for (const entry of mergedEntries) {
    const absoluteImagePath = path.join(overlayManifest.outputDir, entry.relativePath);
    if (!fs.existsSync(absoluteImagePath)) continue;

    if (entry.start > cursor + 0.001) {
      pushStill(blankOverlayPath, entry.start - cursor);
    }

    pushStill(absoluteImagePath, entry.end - entry.start);
    cursor = Math.max(cursor, entry.end);
  }

  if (totalDurationSeconds > cursor + 0.001) {
    pushStill(blankOverlayPath, totalDurationSeconds - cursor);
  }

  if (lines.length === 0) {
    throw new Error(buildMessage);
  }

  lines.push(`file '${escapeConcatFilePath(lastPathForConcat)}'`);
  fs.writeFileSync(concatPath, `${lines.join("\n")}\n`, "utf-8");

  runCommand("ffmpeg", [
    "-y",
    "-f",
    "concat",
    "-safe",
    "0",
    "-i",
    concatPath,
    "-c:v",
    "qtrle",
    "-pix_fmt",
    "argb",
    overlayTrackPath,
  ]);

  return {
    blankOverlayPath,
    concatPath,
    overlayTrackPath,
  };
}

function applyCaptionOverlayBurnIn({ baseVideoPath, finalVideoPath, overlayManifest, outputPrefix }) {
  const overlayTrack = buildCaptionOverlayTrack({
    overlayManifest,
    totalDurationSeconds: getMediaDurationSeconds(baseVideoPath),
    emptyMessage: "Caption overlay renderer could not run because no overlay entries were generated.",
    buildMessage: "Caption overlay renderer could not build a concat track.",
  });
  const tempOutputPath = path.join(path.dirname(finalVideoPath), `${outputPrefix}-${Date.now()}.mp4`);

  runCommand("ffmpeg", [
    "-y",
    "-i",
    baseVideoPath,
    "-i",
    overlayTrack.overlayTrackPath,
    "-filter_complex",
    "[0:v][1:v]overlay=0:0:shortest=1:eof_action=pass[v]",
    "-map",
    "[v]",
    "-map",
    "0:a?",
    "-c:v",
    "libx264",
    "-preset",
    "medium",
    "-crf",
    "18",
    "-pix_fmt",
    "yuv420p",
    "-c:a",
    "copy",
    "-movflags",
    "+faststart",
    tempOutputPath,
  ]);

  fs.renameSync(tempOutputPath, finalVideoPath);
  return overlayTrack;
}

function applyAnimatedCaptionBurnIn({ baseVideoPath, finalVideoPath, videoWorkDir, alignmentPath, captionsJsonPath, captionStyleSelection }) {
  const alignmentWords = readAlignmentWords(alignmentPath);
  const captions = readCaptionSections(captionsJsonPath);
  if (alignmentWords.length === 0 || captions.length === 0) {
    throw new Error("Could not build animated caption subtitles because the alignment words or caption sections were missing.");
  }

  const timeline = mapCaptionWordsToAlignment(captions, alignmentWords);
  const assPath = path.join(videoWorkDir, "captions-word-highlight.ass");
  ensureDir(path.dirname(assPath));
  fs.writeFileSync(assPath, buildAnimatedCaptionAssContent(timeline, captionStyleSelection.style), "utf-8");

  const overlayFps = getMediaFrameRate(baseVideoPath);
  const overlayPresetSlug = captionStyleSelection.animationPreset?.slug || captionStyleSelection.style.animationPreset || "stable-pop";
  const usesConfigDrivenPreset = Boolean(captionStyleSelection.animationPreset?.config);
  const requiresStableWordSpacingOverlay = Math.abs(Number(captionStyleSelection.style.wordSpacing) || 0) > 0.01;

  if (usesConfigDrivenPreset || requiresStableWordSpacingOverlay) {
    const overlayManifest = renderAnimatedCaptionOverlays({
      captionTimeline: timeline,
      videoWorkDir,
      captionStyleSelection,
      fps: overlayFps,
    });

    const overlayTrack = applyCaptionOverlayBurnIn({
      baseVideoPath,
      finalVideoPath,
      overlayManifest,
      outputPrefix: usesConfigDrivenPreset ? `final-with-${overlayPresetSlug}-config-overlay-captions` : "final-with-word-spacing-overlay-captions",
    });

    return {
      mode: "animated-image-overlay-v1",
      requestedMode: usesConfigDrivenPreset ? `${overlayPresetSlug}-config-overlay-v1` : "word-spacing-overlay-v1",
      assPath,
      timeline,
      baseVideoPath,
      overlayManifestPath: overlayManifest.manifestPath,
      overlayDir: overlayManifest.outputDir,
      overlayVideoPath: overlayTrack.overlayTrackPath,
      overlayConcatPath: overlayTrack.concatPath,
      renderer: "pillow-word-highlight-v1",
      fallbackReason: usesConfigDrivenPreset
        ? `Caption preset ${captionStyleSelection.animationPreset?.name || overlayPresetSlug} now renders through the animated overlay renderer so the saved config-driven timing, easing, motion tracks, layout mode, and color-source settings are applied during final render.`
        : "Non-zero caption word spacing now uses the animated overlay renderer because ASS/libass cannot tighten or widen inter-word gaps independently without compromising glyph spacing; the overlay path applies the exact saved word spacing while preserving fixed word slots.",
    };
  }

  const renderAnimatedOverlayFallback = (assReason) => {
    const overlayManifest = renderAnimatedCaptionOverlays({
      captionTimeline: timeline,
      videoWorkDir,
      captionStyleSelection,
      fps: overlayFps,
    });

    try {
      const overlayTrack = applyCaptionOverlayBurnIn({
        baseVideoPath,
        finalVideoPath,
        overlayManifest,
        outputPrefix: "final-with-animated-overlay-captions",
      });

      return {
        mode: "animated-image-overlay-v1",
        requestedMode: "ass-word-highlight-v1",
        assPath,
        timeline,
        baseVideoPath,
        overlayManifestPath: overlayManifest.manifestPath,
        overlayDir: overlayManifest.outputDir,
        overlayVideoPath: overlayTrack.overlayTrackPath,
        overlayConcatPath: overlayTrack.concatPath,
        renderer: "pillow-word-highlight-v1",
        assUnavailableReason: assReason,
      };
    } catch (overlayError) {
      const overlayReason = overlayError instanceof Error ? overlayError.message : String(overlayError);
      throw new Error(`Animated caption rendering failed. ASS/libass path error: ${assReason}. Overlay fallback error: ${overlayReason}`);
    }
  };

  if (!ffmpegSupportsFilter("subtitles")) {
    return renderAnimatedOverlayFallback("ffmpeg subtitles filter is unavailable on this machine, so the dashboard used the Pillow animated overlay renderer instead.");
  }

  const tempOutputPath = path.join(videoWorkDir, `final-with-captions-${Date.now()}.mp4`);
  const fontDir = captionStyleSelection.style.fontPath && fs.existsSync(captionStyleSelection.style.fontPath)
    ? path.dirname(captionStyleSelection.style.fontPath)
    : null;
  const subtitlesFilter = fontDir
    ? `subtitles=filename=${escapeSubtitlesFilterPath(assPath)}:fontsdir=${escapeSubtitlesFilterPath(fontDir)}`
    : `subtitles=filename=${escapeSubtitlesFilterPath(assPath)}`;

  try {
    runCommand("ffmpeg", [
      "-y",
      "-i",
      baseVideoPath,
      "-vf",
      subtitlesFilter,
      "-c:v",
      "libx264",
      "-preset",
      "medium",
      "-crf",
      "18",
      "-pix_fmt",
      "yuv420p",
      "-c:a",
      "copy",
      "-movflags",
      "+faststart",
      tempOutputPath,
    ]);

    fs.renameSync(tempOutputPath, finalVideoPath);
    return {
      mode: "ass-word-highlight-v1",
      requestedMode: "ass-word-highlight-v1",
      assPath,
      timeline,
      baseVideoPath,
    };
  } catch (assError) {
    return renderAnimatedOverlayFallback(assError instanceof Error ? assError.message : String(assError));
  }
}

function updateVideoManifestCaptionRendering(projectId, config, captionStyleSelection, captionRender) {
  const manifestPath = path.join(config.videoWorkDir, "manifest.json");
  let manifest = {};
  if (fs.existsSync(manifestPath)) {
    try {
      manifest = JSON.parse(fs.readFileSync(manifestPath, "utf-8"));
    } catch {
      manifest = {};
    }
  }

  manifest.caption_rendering = {
    mode: captionRender.mode,
    requestedMode: captionRender.requestedMode,
    captionStyleId: captionStyleSelection.resolvedCaptionStyleId,
    captionStyleName: captionStyleSelection.style.name,
    captionStyleSource: captionStyleSelection.source,
    animationPreset: captionStyleSelection.style.animationPreset,
    animationPresetId: captionStyleSelection.resolvedAnimationPresetId || captionStyleSelection.style.animationPresetId,
    ...(captionStyleSelection.animationPreset?.name ? { animationPresetName: captionStyleSelection.animationPreset.name } : {}),
    fontWeight: captionStyleSelection.style.fontWeight,
    wordSpacing: captionStyleSelection.style.wordSpacing,
    assRelativePath: toProjectRelativePath(projectId, captionRender.assPath),
    baseVideoRelativePath: toProjectRelativePath(projectId, captionRender.baseVideoPath),
    ...(captionRender.overlayManifestPath ? { overlayManifestRelativePath: toProjectRelativePath(projectId, captionRender.overlayManifestPath) } : {}),
    ...(captionRender.overlayDir ? { overlayDirRelativePath: toProjectRelativePath(projectId, captionRender.overlayDir) } : {}),
    ...(captionRender.overlayVideoPath ? { overlayVideoRelativePath: toProjectRelativePath(projectId, captionRender.overlayVideoPath) } : {}),
    ...(captionRender.overlayConcatPath ? { overlayConcatRelativePath: toProjectRelativePath(projectId, captionRender.overlayConcatPath) } : {}),
    ...(captionRender.renderer ? { renderer: captionRender.renderer } : {}),
    ...(captionRender.assUnavailableReason ? { assUnavailableReason: captionRender.assUnavailableReason } : {}),
    ...(captionRender.fallbackReason ? { fallbackReason: captionRender.fallbackReason } : {}),
    updatedAt: new Date().toISOString(),
  };

  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), "utf-8");
}

function buildVideoReviewDoc(projectId, config, selectedVoice = createDefaultVoice(), selectedMusic, captionStyleSelection) {
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
    "This run stayed on the default deterministic pipeline: the final renderer reused the narration and forced-alignment artifacts from the XML Script step as the source of truth, then rendered the looping background video track, chroma-keyed the green-screen visual plates as foreground elements, burned in word-level captions with active, spoken, and upcoming highlighting, reused the saved soundtrack WAV chosen in the short-form settings, and applied any per-visual XML camera motion only to the image layer when explicitly present in the XML (otherwise the visual stays static).",
    ...(config.notes ? ["", "## Request notes", "", config.notes] : []),
    ...(alignmentWarning ? ["", "## Alignment warning", "", alignmentWarning] : []),
    "",
    "## Outputs",
    "",
    `- Final video: \`${relativeVideo}\``,
    `- Work directory: \`${relativeWorkDir}\``,
    `- Narration voice: Qwen / ${selectedVoice.sourceType === "uploaded-reference"
      ? `uploaded reference voice \`${selectedVoice.name}\``
      : selectedVoice.mode === "voice-design"
        ? `VoiceDesign \`${selectedVoice.name}\``
        : `legacy custom voice \`${selectedVoice.name}\` / speaker \`${selectedVoice.speaker || DEFAULT_VOICE_SPEAKER}\``}`,
    `- Voice prompt: ${selectedVoice.sourceType === "uploaded-reference" ? "Uses the saved uploaded reference clip for voice-clone narration." : selectedVoice.voiceDesignPrompt}`,
    `- Looping background video: ${config.backgroundVideoName ? `\`${config.backgroundVideoName}\`` : "Not configured"}`,
    `- Caption style: ${captionStyleSelection?.style?.name ? `\`${captionStyleSelection.style.name}\` (${captionStyleSelection.animationPreset?.name || captionStyleSelection.style.animationPreset || captionStyleSelection.style.animationPresetId || "animation preset"})` : config.captionStyleName ? `\`${config.captionStyleName}\`` : "Default/fallback"}`,
    `- Music path: ${selectedMusic?.generatedAudioRelativePath ? `\`${selectedMusic.generatedAudioRelativePath}\`` : "Not configured"}`,
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
      usageInstructions: reference.usageInstructions || "Use this reference as supporting visual context when helpful.",
    }));
  const extraReferencesJsonPath = path.join(runDir, "style-references.json");
  fs.writeFileSync(extraReferencesJsonPath, JSON.stringify(extraReferencesPayload, null, 2), "utf-8");
  const promptTemplatesJsonPath = path.join(runDir, "nano-banana-prompt-templates.json");
  if (config.imagePromptTemplates && typeof config.imagePromptTemplates === "object") {
    fs.writeFileSync(promptTemplatesJsonPath, JSON.stringify(config.imagePromptTemplates, null, 2), "utf-8");
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
    "--style-extra",
    config.imageStylePrompt || DEFAULT_IMAGE_STYLE_PROMPT,
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
  const sceneIndexes = expandSceneIndexesForDependencies(runtimeXmlPath, requestedSceneIndexes);
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
  const videoRenderSettings = readVideoRenderSettings();
  const defaultCaptionStyles = createDefaultCaptionStyles();
  const requestedAnimationPreset = config.animationPreset
    ? normalizeAnimationPresetEntry(
        config.animationPreset,
        getAnimationPresetById(
          videoRenderSettings.animationPresets,
          normalizeString(
            config.animationPreset.id,
            config.captionStyle?.animationPresetId || DEFAULT_CAPTION_ANIMATION_PRESET_ID,
          ),
        ),
        0,
      )
    : null;
  const animationPresetsForRun = requestedAnimationPreset
    ? ensureUniqueAnimationPresetIds([
        requestedAnimationPreset,
        ...videoRenderSettings.animationPresets.filter((preset) => preset.id !== requestedAnimationPreset.id),
      ])
    : videoRenderSettings.animationPresets;
  const configuredCaptionStyle = config.captionStyle
    ? normalizeCaptionStyleEntry(
        config.captionStyle,
        defaultCaptionStyles.find((style) => style.id === config.captionStyleId) || defaultCaptionStyles[0],
        0,
        animationPresetsForRun,
      )
    : null;
  const captionStyleSelection = configuredCaptionStyle
    ? (() => {
        const animationPreset = requestedAnimationPreset && configuredCaptionStyle.animationPresetId === requestedAnimationPreset.id
          ? requestedAnimationPreset
          : getAnimationPresetById(animationPresetsForRun, configuredCaptionStyle.animationPresetId);
        return {
          style: { ...configuredCaptionStyle, animationPresetId: animationPreset.id, animationPreset: animationPreset.slug },
          animationPreset,
          resolvedAnimationPresetId: animationPreset.id,
          resolvedCaptionStyleId: normalizeString(config.captionStyleId, configuredCaptionStyle.id),
          source: config.captionStyleSource === "project" || config.captionStyleSource === "default" || config.captionStyleSource === "fallback"
            ? config.captionStyleSource
            : "fallback",
        };
      })()
    : resolveCaptionStyleSelection(projectMeta.selectedCaptionStyleId);
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
  const reusableMusicPath = selectedMusic.music?.generatedAudioRelativePath
    ? resolveMusicLibraryAbsolutePath(selectedMusic.music.generatedAudioRelativePath)
    : null;
  if (!reusableMusicPath || !fs.existsSync(reusableMusicPath)) {
    throw new Error("Missing saved soundtrack file for final-video generation. Open Short-form workflow settings, save the music library, and generate the soundtrack file once for the selected preset before rendering.");
  }

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
    "--music",
    reusableMusicPath,
    "--music-volume",
    String(selectedMusic.musicVolume ?? Number(DEFAULT_MUSIC_VOLUME)),
    "--force",
  ];

  updateDirectVideoProgress("prepare-inputs", "Loading XML narration, alignment, caption, background, and soundtrack inputs.");
  updateDirectVideoProgress("render-base-video", "Rendering the base final video from the XML scene pipeline.");
  const result = runCommand("uv", args);
  const baseVideoPath = writeBaseVideoArtifact(config.finalVideoPath, config.videoWorkDir);
  updateDirectVideoProgress("burn-captions", "Burning captions into the rendered base video.");
  const captionRender = applyAnimatedCaptionBurnIn({
    baseVideoPath,
    finalVideoPath: config.finalVideoPath,
    videoWorkDir: config.videoWorkDir,
    alignmentPath: existingAlignmentPath,
    captionsJsonPath,
    captionStyleSelection,
  });
  updateDirectVideoProgress("finalize-output", "Saving final-video metadata and review artifacts.");
  updateVideoManifestCaptionRendering(job.projectId, config, captionStyleSelection, captionRender);
  fs.writeFileSync(config.videoDocPath, buildVideoReviewDoc(job.projectId, config, xmlSelectedVoice, selectedMusic.music, captionStyleSelection), "utf-8");
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
          : job.directConfig.kind === "video"
            ? {
                activeStep: "completed",
                activeStatusText: "Final video ready",
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
