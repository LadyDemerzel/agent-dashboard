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
const DEFAULT_VOICE_SPEAKER = "Aiden";
const DEFAULT_VOICE_INSTRUCT = "Educated American male narrator, slightly deeper and lower-pitched, polished and confident, calm authority, crisp social-video pacing, speak only English, no other languages or non-speech sounds.";
const DEFAULT_VOICE_PREVIEW_TEXT = "Your jawline doesn't start at your jaw. It starts with how your whole neck and face are stacking.";
const DEFAULT_VOICE_MODE = "voice-design";
const DEFAULT_VOICE_ID = "voice-calm-authority";
const DEFAULT_MUSIC_PROMPT = "instrumental cinematic curiosity underscore, mysterious but pleasant, warm synth pulse, light percussion, airy textures, subtle piano and marimba accents, sense of discovery, modern and polished, no horror, no dread, no dark drones, no jump scares, no vocals, no singing, no choir, no spoken voice";
const DEFAULT_MUSIC_VOLUME = "0.38";
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
  return {
    defaultVoiceId: voice.id,
    voices: [voice],
  };
}

function readVideoRenderSettings() {
  const defaultVoice = createDefaultVoice();
  const defaultSettings = {
    defaultVoiceId: defaultVoice.id,
    voices: [defaultVoice],
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
    return {
      defaultVoiceId: normalizedVoices.some((voice) => voice.id === defaultVoiceId) ? defaultVoiceId : normalizedVoices[0].id,
      voices: normalizedVoices,
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

function writeJson(filePath, value) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2), "utf-8");
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

function readProjectTopic(projectId) {
  const projectJsonPath = path.join(getProjectDir(projectId), "project.json");
  if (!fs.existsSync(projectJsonPath)) return "";
  try {
    const project = JSON.parse(fs.readFileSync(projectJsonPath, "utf-8"));
    return typeof project.topic === "string" ? project.topic.trim() : "";
  } catch {
    return "";
  }
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

function buildSceneImagesReviewDoc(projectId, scenes, options = {}) {
  const projectDir = getProjectDir(projectId);
  const existingDocPath = path.join(projectDir, "scene-images.md");
  const topic = readProjectTopic(projectId);
  const existingMeta = readExistingDocMetadata(existingDocPath);
  const status = normalizeDocStatus(existingMeta.status);
  const title = existingMeta.title || (topic ? `Scene Images: ${topic}` : "Scene Images");
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
    "# Scene Images Review Document",
    "",
    "## Summary",
    "",
    `${scopeLabel} The direct dashboard workflow now calls the xml-scene-images generator deterministically instead of routing this execution step through Scribe. Each scene should have an uncaptioned export for assembly and a captioned preview for review.`,
    "",
    `This run ${modeLabel} **${scenes.length} scene images** using the structured Nano Banana path with the selected style **${options.imageStyleName || "Default charcoal"}**: one consistent character reference, the selected shared/per-style art direction, natural top caption-safe headroom, unified full-frame composition, and no baked-in text inside the artwork. When the XML marks a scene with referencePreviousSceneImage=\"true\", the generator also feeds in the previous actual generated scene image as an extra continuity reference.${styleReferenceLine}`,
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
    "- `scenes/scene-XX-uncaptioned-1080x1920.png` — clean scene image for video assembly",
    "- `scenes/scene-XX-captioned-1080x1920.png` — preview image with caption overlay",
    "- `scenes/scene-XX.png` — legacy copy of the clean scene image",
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
    image: toRelativeProjectPath(job.projectId, scene?.uncaptioned) || toRelativeProjectPath(job.projectId, scene?.raw_legacy),
    previewImage: toRelativeProjectPath(job.projectId, scene?.captioned),
    notes: typeof scene?.image_prompt === "string" && scene.image_prompt.trim() ? scene.image_prompt.trim() : undefined,
    duration: typeof scene?.duration === "string" && scene.duration.trim() ? scene.duration.trim() : undefined,
  })).filter((scene) => scene.caption && (scene.image || scene.previewImage));

  if (scenes.length === 0) return;

  fs.writeFileSync(
    path.join(projectDir, "scene-images.json"),
    JSON.stringify({
      scenes: scenes.map(({ id, number, caption, image, previewImage, notes }) => ({
        id,
        number,
        caption,
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
    "This run stayed on the default deterministic pipeline: full-video Qwen narration from the XML `<script>`, transcript-driven Qwen forced alignment for scene timing, uncaptioned scene images for motion, separate caption overlays, ACE-Step instrumental background music, and any scene-level XML camera motion applied only to the image layer when explicitly present in the XML (otherwise the scene stays static).",
    ...(config.notes ? ["", "## Request notes", "", config.notes] : []),
    ...(alignmentWarning ? ["", "## Alignment warning", "", alignmentWarning] : []),
    "",
    "## Outputs",
    "",
    `- Final video: \`${relativeVideo}\``,
    `- Work directory: \`${relativeWorkDir}\``,
    `- Narration voice: Qwen / ${selectedVoice.mode === "voice-design" ? `VoiceDesign \`${selectedVoice.name}\`` : `legacy custom voice \`${selectedVoice.name}\` / speaker \`${selectedVoice.speaker || DEFAULT_VOICE_SPEAKER}\``}`,
    `- Voice prompt: ${selectedVoice.voiceDesignPrompt}`,
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
  const { url, token } = getGatewayConfig();
  if (!token) {
    throw new Error("Hooks token not found in config");
  }

  const isRetry = attemptIndex > 0;
  const retryNotice = isRetry
    ? [
        "RETRY NOTICE — THE PREVIOUS SHORT-FORM RUN DID NOT PRODUCE THE REQUIRED ON-DISK ARTIFACTS.",
        "Start fresh from the task below. Do not summarize only in chat.",
        "You must write/update the exact required artifact paths and verify them before finishing.",
      ].join("\n\n")
    : "";

  const response = await fetch(`${url}/hooks/agent`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      message: isRetry ? `${retryNotice}\n\n${job.task}` : job.task,
      agentId: job.agentId,
      name: `${job.label}-attempt-${attemptIndex + 1}`,
      sessionKey: `${job.sessionKeyBase}:${job.runId}:attempt-${attemptIndex + 1}`,
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
    "--common-constraints",
    config.imageCommonConstraints || "",
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

  const preferredVoiceId = readProjectMeta(job.projectId)?.selectedVoiceId;
  const selectedVoice = resolveVoiceSelection(preferredVoiceId).voice;

  const runDir = path.join(getProjectDir(job.projectId), ".workflow-runs", job.runId);
  ensureDir(runDir);
  ensureDir(path.dirname(config.finalVideoPath));
  ensureDir(config.videoWorkDir);

  const runtimeXmlPath = resolveXmlRuntimePath(config.scriptPath, runDir, "video-runtime.xml");
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
    "--tts-engine",
    "qwen",
    "--qwen-mode",
    selectedVoice.mode,
    ...(selectedVoice.mode === "custom-voice"
      ? ["--voice-speaker", selectedVoice.speaker || DEFAULT_VOICE_SPEAKER]
      : []),
    "--voice-instruct",
    selectedVoice.mode === "custom-voice"
      ? (selectedVoice.legacyInstruct || selectedVoice.voiceDesignPrompt || DEFAULT_VOICE_INSTRUCT)
      : selectedVoice.voiceDesignPrompt,
    "--ace-step-url",
    DEFAULT_ACE_STEP_URL,
    "--music-prompt",
    DEFAULT_MUSIC_PROMPT,
    "--music-volume",
    DEFAULT_MUSIC_VOLUME,
    "--force",
  ];

  const result = runCommand("uv", args);
  fs.writeFileSync(config.videoDocPath, buildVideoReviewDoc(job.projectId, config, selectedVoice), "utf-8");
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

  writeJson(statusPath, {
    status: "running",
    runId: job.runId,
    stage: job.stage,
    projectId: job.projectId,
    startedAt,
    attempts,
  });

  if (job.directConfig?.kind === "scene-images" || job.directConfig?.kind === "video") {
    const attempt = {
      index: 1,
      mode: "direct-workflow",
      startedAt: new Date().toISOString(),
    };
    attempts.push(attempt);

    try {
      const directResult = job.directConfig.kind === "scene-images"
        ? runDirectSceneImages(job)
        : runDirectVideo(job);
      attempt.command = directResult.command;
      attempt.stdout = directResult.stdout;
      attempt.stderr = directResult.stderr;
      const verified = await waitForArtifacts(
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

      writeJson(statusPath, {
        status: "verified",
        runId: job.runId,
        stage: job.stage,
        projectId: job.projectId,
        startedAt,
        verifiedAt: new Date().toISOString(),
        attempts,
      });
      return;
    } catch (error) {
      attempt.error = error instanceof Error ? error.message : String(error);
      attempt.finishedAt = new Date().toISOString();
      writeJson(statusPath, {
        status: "failed",
        runId: job.runId,
        stage: job.stage,
        projectId: job.projectId,
        startedAt,
        failedAt: new Date().toISOString(),
        attempts,
      });
      return;
    }
  }

  const models = Array.isArray(job.preferredModels) && job.preferredModels.length > 0
    ? job.preferredModels
    : ["openai-codex/gpt-5.4", "openrouter/anthropic/claude-3-haiku"];

  for (let index = 0; index < models.length; index += 1) {
    const model = models[index];
    const attempt = {
      index: index + 1,
      model,
      startedAt: new Date().toISOString(),
    };
    attempts.push(attempt);
    writeJson(statusPath, {
      status: "running",
      runId: job.runId,
      stage: job.stage,
      projectId: job.projectId,
      startedAt,
      attempts,
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
        writeJson(statusPath, {
          status: "verified",
          runId: job.runId,
          stage: job.stage,
          projectId: job.projectId,
          startedAt,
          verifiedAt: new Date().toISOString(),
          attempts,
        });
        return;
      }
    } catch (error) {
      attempt.error = error instanceof Error ? error.message : String(error);
      attempt.finishedAt = new Date().toISOString();
    }
  }

  writeJson(statusPath, {
    status: "failed",
    runId: job.runId,
    stage: job.stage,
    projectId: job.projectId,
    startedAt,
    failedAt: new Date().toISOString(),
    attempts,
  });
}

main().catch(() => process.exit(1));
