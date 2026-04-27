import fs from "fs";
import path from "path";
import { spawnSync } from "child_process";
import { extractBody, generateFrontMatter, parseFrontMatter } from "@/lib/frontmatter";
import {
  getShortFormSoundDesignSettings,
  getShortFormSoundLibraryDir,
  type ShortFormSoundAnchor,
  type ShortFormSoundLibraryEntry,
  type ShortFormSoundSemanticType,
  type ShortFormSoundTimingType,
} from "@/lib/short-form-sound-design-settings";

const HOME_DIR = process.env.HOME || "/Users/ittaisvidler";
const SHORT_FORM_VIDEOS_DIR = path.join(
  HOME_DIR,
  "tenxsolo",
  "business",
  "content",
  "deliverables",
  "short-form-videos"
);

export interface ShortFormSoundDesignEvent {
  id: string;
  type: ShortFormSoundSemanticType;
  track: string;
  anchor: ShortFormSoundAnchor;
  sceneId?: string;
  captionId?: string;
  offsetMs: number;
  gainDb?: number;
  fadeInMs?: number;
  fadeOutMs?: number;
  intensity?: string;
  rationale?: string;
  notes?: string;
  overlap?: "allow" | "avoid";
}

export interface ShortFormResolvedSoundDesignEvent extends ShortFormSoundDesignEvent {
  assetId?: string;
  assetName?: string;
  assetRelativePath?: string;
  timingType?: ShortFormSoundTimingType;
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
  status: "resolved" | "unresolved";
  resolutionReason?: string;
}

export interface ShortFormSoundDesignResolution {
  version: number;
  generatedAt: string;
  previewAudioRelativePath?: string;
  previewUpdatedAt?: string;
  events: ShortFormResolvedSoundDesignEvent[];
  stats: {
    total: number;
    resolved: number;
    unresolved: number;
  };
}

export interface ShortFormSoundDesignDocument {
  path: string;
  content: string;
  body: string;
  frontMatter: Record<string, unknown>;
  status: string;
  updatedAt?: string;
  events: ShortFormSoundDesignEvent[];
  resolution?: ShortFormSoundDesignResolution;
}

interface TimelineScene {
  id: string;
  number: number;
  caption: string;
  startTime?: number;
  endTime?: number;
}

interface TimelineCaption {
  id: string;
  index: number;
  text: string;
  start: number;
  end: number;
}

function ensureDir(dirPath: string) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function getProjectDir(projectId: string) {
  return path.join(SHORT_FORM_VIDEOS_DIR, projectId);
}

export function getShortFormSoundDesignPath(projectId: string) {
  return path.join(getProjectDir(projectId), "sound-design.md");
}

export function getShortFormSoundDesignWorkDir(projectId: string) {
  return path.join(getProjectDir(projectId), "output", "sound-design-work");
}

export function getShortFormSoundDesignResolutionPath(projectId: string) {
  return path.join(getShortFormSoundDesignWorkDir(projectId), "resolution.json");
}

export function getShortFormSoundDesignPreviewPath(projectId: string, fileName = "sound-design-preview.wav") {
  return path.join(getShortFormSoundDesignWorkDir(projectId), "preview", fileName);
}

export function getShortFormSoundDesignPreviewRelativePath(projectId: string, fileName = "sound-design-preview.wav") {
  const projectDir = getProjectDir(projectId);
  const previewPath = getShortFormSoundDesignPreviewPath(projectId, fileName);
  return path.relative(projectDir, previewPath).split(path.sep).join("/");
}

export type ShortFormSoundDesignPreviewMode = "full" | "without-sfx" | "effects-only";

export function getShortFormSoundDesignPreviewFileName(
  mode: ShortFormSoundDesignPreviewMode = "full",
  track?: string,
) {
  if (mode === "full" && !track) return "sound-design-preview.wav";
  const variantSlug = [mode, track || "all"]
    .join("-")
    .replace(/[^a-z0-9-]+/gi, "-")
    .toLowerCase();
  return `review-${variantSlug}.wav`;
}

export function getShortFormSoundDesignPreviewRelativePathForMode(
  projectId: string,
  mode: ShortFormSoundDesignPreviewMode = "full",
  track?: string,
) {
  return getShortFormSoundDesignPreviewRelativePath(projectId, getShortFormSoundDesignPreviewFileName(mode, track));
}

function normalizeString(value: unknown, fallback = "") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function normalizeOptionalString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function clampNumber(value: unknown, min: number, max: number, fallback: number, digits = 0) {
  const parsed = typeof value === "number" ? value : typeof value === "string" ? Number(value) : Number.NaN;
  if (!Number.isFinite(parsed)) return fallback;
  const factor = 10 ** digits;
  return Math.min(max, Math.max(min, Math.round(parsed * factor) / factor));
}

function safeReadJson(filePath: string) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf-8"));
  } catch {
    return null;
  }
}

function getTimelineScenes(projectId: string): TimelineScene[] {
  const projectDir = getProjectDir(projectId);
  const scenePath = path.join(projectDir, "scene-images.json");
  const raw = safeReadJson(scenePath);
  const scenes = Array.isArray(raw?.scenes) ? raw.scenes : [];
  return scenes
    .map((scene: unknown, index: number): TimelineScene | null => {
      const obj = scene && typeof scene === "object" && !Array.isArray(scene) ? scene as Record<string, unknown> : null;
      if (!obj) return null;
      return {
        id: normalizeString(obj.id, `scene-${index + 1}`),
        number: typeof obj.number === "number" && Number.isFinite(obj.number) ? obj.number : index + 1,
        caption: normalizeString(obj.caption, ""),
        startTime: typeof obj.startTime === "number" && Number.isFinite(obj.startTime) ? obj.startTime : undefined,
        endTime: typeof obj.endTime === "number" && Number.isFinite(obj.endTime) ? obj.endTime : undefined,
      };
    })
    .filter((scene: TimelineScene | null): scene is TimelineScene => Boolean(scene));
}

function getTimelineCaptions(projectId: string): TimelineCaption[] {
  const captionsPath = path.join(getProjectDir(projectId), "output", "xml-script-work", "captions", "caption-sections.json");
  const raw = safeReadJson(captionsPath);
  return Array.isArray(raw)
    ? raw
        .map((caption: unknown, index: number): TimelineCaption | null => {
          const obj = caption && typeof caption === "object" && !Array.isArray(caption) ? caption as Record<string, unknown> : null;
          if (!obj) return null;
          const start = typeof obj.start === "number" && Number.isFinite(obj.start) ? obj.start : Number.NaN;
          const end = typeof obj.end === "number" && Number.isFinite(obj.end) ? obj.end : Number.NaN;
          if (!Number.isFinite(start) || !Number.isFinite(end)) return null;
          return {
            id: normalizeString(obj.id, `caption-${index + 1}`),
            index: typeof obj.index === "number" && Number.isFinite(obj.index) ? obj.index : index,
            text: normalizeString(obj.text, ""),
            start,
            end,
          };
        })
        .filter((caption: TimelineCaption | null): caption is TimelineCaption => Boolean(caption))
    : [];
}

function parseAttributes(nodeSource: string) {
  const attributes: Record<string, string> = {};
  const regex = /(\w+)="([^"]*)"/g;
  let match = regex.exec(nodeSource);
  while (match) {
    attributes[match[1]] = match[2];
    match = regex.exec(nodeSource);
  }
  return attributes;
}

export function parseShortFormSoundDesignXml(content: string): ShortFormSoundDesignEvent[] {
  const xml = extractBody(content);
  const eventMatches = xml.match(/<event\b[^>]*\/>/g) || [];
  return eventMatches.map((match, index) => {
    const attributes = parseAttributes(match);
    const type = attributes.type === "riser" || attributes.type === "click" || attributes.type === "whoosh" || attributes.type === "ambience"
      ? attributes.type
      : "impact";
    const anchor = attributes.anchor === "scene-end"
      || attributes.anchor === "caption-start"
      || attributes.anchor === "caption-end"
      || attributes.anchor === "global-start"
      || attributes.anchor === "global-end"
      ? attributes.anchor
      : "scene-start";
    const overlap = attributes.overlap === "allow" ? "allow" : attributes.overlap === "avoid" ? "avoid" : undefined;
    return {
      id: normalizeString(attributes.id, `evt-${index + 1}`),
      type,
      track: normalizeString(attributes.track, type === "ambience" ? "ambience" : type === "riser" || type === "whoosh" ? "transitions" : "impacts"),
      anchor,
      sceneId: normalizeOptionalString(attributes.sceneId),
      captionId: normalizeOptionalString(attributes.captionId),
      offsetMs: clampNumber(attributes.offsetMs, -20_000, 20_000, 0, 0),
      gainDb: attributes.gainDb !== undefined ? clampNumber(attributes.gainDb, -36, 12, 0, 1) : undefined,
      fadeInMs: attributes.fadeInMs !== undefined ? clampNumber(attributes.fadeInMs, 0, 10_000, 0, 0) : undefined,
      fadeOutMs: attributes.fadeOutMs !== undefined ? clampNumber(attributes.fadeOutMs, 0, 10_000, 0, 0) : undefined,
      intensity: normalizeOptionalString(attributes.intensity),
      rationale: normalizeOptionalString(attributes.rationale),
      notes: normalizeOptionalString(attributes.notes),
      overlap,
    };
  });
}

export function buildDefaultShortFormSoundDesignDocument(projectId: string) {
  const docPath = getShortFormSoundDesignPath(projectId);
  const frontMatter = generateFrontMatter({
    title: "Plan Sound Design",
    status: "draft",
    date: new Date().toISOString().slice(0, 10),
    agent: "dashboard",
    category: "sound-design",
  });
  const xml = [
    "<soundDesign version=\"1\" duckingDb=\"-8\" maxConcurrentOneShots=\"2\">",
    "  <event id=\"evt-1\" type=\"impact\" track=\"impacts\" anchor=\"scene-start\" sceneId=\"scene-1\" offsetMs=\"-40\" gainDb=\"-5\" fadeInMs=\"0\" fadeOutMs=\"220\" intensity=\"medium\" rationale=\"Opening punctuation\" />",
    "</soundDesign>",
  ].join("\n");
  ensureDir(path.dirname(docPath));
  const content = `${frontMatter}\n${xml}\n`;
  fs.writeFileSync(docPath, content, "utf-8");
  return content;
}

function escapeXmlAttribute(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/\"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function pushEventLine(lines: string[], event: ShortFormSoundDesignEvent) {
  const attributes = [
    `id=\"${escapeXmlAttribute(event.id)}\"`,
    `type=\"${escapeXmlAttribute(event.type)}\"`,
    `track=\"${escapeXmlAttribute(event.track)}\"`,
    `anchor=\"${escapeXmlAttribute(event.anchor)}\"`,
    ...(event.sceneId ? [`sceneId=\"${escapeXmlAttribute(event.sceneId)}\"`] : []),
    ...(event.captionId ? [`captionId=\"${escapeXmlAttribute(event.captionId)}\"`] : []),
    `offsetMs=\"${Math.round(event.offsetMs)}\"`,
    ...(typeof event.gainDb === "number" ? [`gainDb=\"${event.gainDb}\"`] : []),
    ...(typeof event.fadeInMs === "number" ? [`fadeInMs=\"${Math.round(event.fadeInMs)}\"`] : []),
    ...(typeof event.fadeOutMs === "number" ? [`fadeOutMs=\"${Math.round(event.fadeOutMs)}\"`] : []),
    ...(event.intensity ? [`intensity=\"${escapeXmlAttribute(event.intensity)}\"`] : []),
    ...(event.rationale ? [`rationale=\"${escapeXmlAttribute(event.rationale)}\"`] : []),
    ...(event.notes ? [`notes=\"${escapeXmlAttribute(event.notes)}\"`] : []),
    ...(event.overlap ? [`overlap=\"${event.overlap}\"`] : []),
  ];
  lines.push(`  <event ${attributes.join(" ")} />`);
}

export function buildSuggestedShortFormSoundDesignDocument(
  projectId: string,
  options?: { topic?: string; selectedHook?: string; notes?: string }
) {
  const settings = getShortFormSoundDesignSettings();
  const scenes = getTimelineScenes(projectId);
  const captions = getTimelineCaptions(projectId);
  const hasSemantic = (semanticType: ShortFormSoundSemanticType) => settings.library.some((entry) => entry.semanticTypes.includes(semanticType));
  const events: ShortFormSoundDesignEvent[] = [];

  if (scenes[0]) {
    events.push({
      id: "evt-impact-open",
      type: "impact",
      track: "impacts",
      anchor: "scene-start",
      sceneId: scenes[0].id,
      offsetMs: -40,
      gainDb: -5,
      fadeInMs: 0,
      fadeOutMs: 220,
      intensity: "medium",
      rationale: "Punch the opening beat without overpowering the narration.",
      overlap: "avoid",
    });
  }

  if (hasSemantic("ambience") && (scenes.length > 1 || captions.length > 3)) {
    events.push({
      id: "evt-ambience-bed",
      type: "ambience",
      track: "ambience",
      anchor: "global-start",
      offsetMs: 0,
      gainDb: -18,
      fadeInMs: 240,
      fadeOutMs: 420,
      intensity: "low",
      rationale: "Low-level texture to keep the mix from feeling dry.",
      overlap: "allow",
    });
  }

  scenes.slice(1, 4).forEach((scene, index) => {
    events.push({
      id: `evt-transition-${index + 1}`,
      type: hasSemantic("whoosh") ? "whoosh" : "riser",
      track: "transitions",
      anchor: "scene-start",
      sceneId: scene.id,
      offsetMs: -60,
      gainDb: -8,
      fadeInMs: 20,
      fadeOutMs: 180,
      intensity: index === 0 ? "medium" : "low",
      rationale: `Carry momentum into ${scene.caption || `scene ${scene.number}`}.`,
      overlap: "avoid",
    });
  });

  if (captions[1] && hasSemantic("click")) {
    events.push({
      id: "evt-click-pivot",
      type: "click",
      track: "details",
      anchor: "caption-start",
      captionId: captions[1].id,
      offsetMs: 0,
      gainDb: -10,
      fadeInMs: 0,
      fadeOutMs: 120,
      intensity: "low",
      rationale: "Add a precise punctuation point on an early caption pivot.",
      overlap: "avoid",
    });
  }

  const frontMatter = generateFrontMatter({
    title: options?.topic ? `${options.topic} Plan Sound Design` : "Plan Sound Design",
    status: "draft",
    date: new Date().toISOString().slice(0, 10),
    agent: "dashboard",
    category: "sound-design",
    selectedHook: options?.selectedHook,
    notes: options?.notes,
  });

  const lines = [
    `<soundDesign version=\"1\" duckingDb=\"${settings.defaultDuckingDb}\" maxConcurrentOneShots=\"${settings.maxConcurrentOneShots}\">`,
  ];
  events.forEach((event) => pushEventLine(lines, event));
  lines.push("</soundDesign>");

  return `${frontMatter}\n${lines.join("\n")}\n`;
}

export function readShortFormSoundDesignDocument(projectId: string): ShortFormSoundDesignDocument {
  const docPath = getShortFormSoundDesignPath(projectId);
  if (!fs.existsSync(docPath)) {
    return {
      path: docPath,
      content: "",
      body: "",
      frontMatter: {},
      status: "draft",
      events: [],
      resolution: readShortFormSoundDesignResolution(projectId),
    };
  }
  const content = fs.readFileSync(docPath, "utf-8");
  const parsed = parseFrontMatter(content);
  const body = extractBody(content);
  const resolution = readShortFormSoundDesignResolution(projectId);
  return {
    path: docPath,
    content,
    body,
    frontMatter: parsed?.frontMatter || {},
    status: normalizeString(parsed?.frontMatter?.status, "draft"),
    updatedAt: fs.statSync(docPath).mtime.toISOString(),
    events: parseShortFormSoundDesignXml(content),
    ...(resolution ? { resolution } : {}),
  };
}

export function writeShortFormSoundDesignDocument(projectId: string, content: string) {
  const docPath = getShortFormSoundDesignPath(projectId);
  ensureDir(path.dirname(docPath));
  fs.writeFileSync(docPath, content, "utf-8");
  return readShortFormSoundDesignDocument(projectId);
}

export function readShortFormSoundDesignResolution(projectId: string): ShortFormSoundDesignResolution | undefined {
  const resolutionPath = getShortFormSoundDesignResolutionPath(projectId);
  const raw = safeReadJson(resolutionPath);
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return undefined;
  const obj = raw as Record<string, unknown>;
  const events = Array.isArray(obj.events) ? obj.events : [];
  const normalizedEvents = events.map((event) => {
    const item = event && typeof event === "object" && !Array.isArray(event) ? event as Record<string, unknown> : {};
    return {
      id: normalizeString(item.id),
      type: item.type === "riser" || item.type === "click" || item.type === "whoosh" || item.type === "ambience" ? item.type : "impact",
      track: normalizeString(item.track, "impacts"),
      anchor: item.anchor === "scene-end" || item.anchor === "caption-start" || item.anchor === "caption-end" || item.anchor === "global-start" || item.anchor === "global-end" ? item.anchor : "scene-start",
      sceneId: normalizeOptionalString(item.sceneId),
      captionId: normalizeOptionalString(item.captionId),
      offsetMs: clampNumber(item.offsetMs, -20_000, 20_000, 0, 0),
      gainDb: typeof item.gainDb === "number" && Number.isFinite(item.gainDb) ? item.gainDb : undefined,
      fadeInMs: typeof item.fadeInMs === "number" && Number.isFinite(item.fadeInMs) ? item.fadeInMs : undefined,
      fadeOutMs: typeof item.fadeOutMs === "number" && Number.isFinite(item.fadeOutMs) ? item.fadeOutMs : undefined,
      intensity: normalizeOptionalString(item.intensity),
      rationale: normalizeOptionalString(item.rationale),
      notes: normalizeOptionalString(item.notes),
      overlap: item.overlap === "allow" ? "allow" : item.overlap === "avoid" ? "avoid" : undefined,
      assetId: normalizeOptionalString(item.assetId),
      assetName: normalizeOptionalString(item.assetName),
      assetRelativePath: normalizeOptionalString(item.assetRelativePath),
      timingType: item.timingType === "bed" || item.timingType === "riser" ? item.timingType : item.timingType === "point" ? "point" : undefined,
      resolvedStartSeconds: clampNumber(item.resolvedStartSeconds, 0, 10_000, 0, 3),
      resolvedEndSeconds: typeof item.resolvedEndSeconds === "number" && Number.isFinite(item.resolvedEndSeconds)
        ? clampNumber(item.resolvedEndSeconds, 0, 10_000, item.resolvedEndSeconds, 3)
        : undefined,
      durationSeconds: typeof item.durationSeconds === "number" && Number.isFinite(item.durationSeconds)
        ? clampNumber(item.durationSeconds, 0, 10_000, item.durationSeconds, 3)
        : undefined,
      resolvedGainDb: clampNumber(item.resolvedGainDb, -36, 12, 0, 1),
      resolvedFadeInMs: clampNumber(item.resolvedFadeInMs, 0, 10_000, 0, 0),
      resolvedFadeOutMs: clampNumber(item.resolvedFadeOutMs, 0, 10_000, 0, 0),
      duckingDb: clampNumber(item.duckingDb, -24, 0, -8, 1),
      muted: item.muted === true,
      solo: item.solo === true,
      manualAssetId: normalizeOptionalString(item.manualAssetId),
      manualGainDb: typeof item.manualGainDb === "number" && Number.isFinite(item.manualGainDb) ? item.manualGainDb : undefined,
      manualNudgeMs: typeof item.manualNudgeMs === "number" && Number.isFinite(item.manualNudgeMs) ? Math.round(item.manualNudgeMs) : undefined,
      compatibleAssetIds: Array.isArray(item.compatibleAssetIds) ? item.compatibleAssetIds.filter((value): value is string => typeof value === "string" && value.trim().length > 0) : undefined,
      status: item.status === "resolved" ? "resolved" : "unresolved",
      resolutionReason: normalizeOptionalString(item.resolutionReason),
    } satisfies ShortFormResolvedSoundDesignEvent;
  });
  return {
    version: typeof obj.version === "number" && Number.isFinite(obj.version) ? obj.version : 1,
    generatedAt: normalizeString(obj.generatedAt, new Date().toISOString()),
    previewAudioRelativePath: normalizeOptionalString(obj.previewAudioRelativePath),
    previewUpdatedAt: normalizeOptionalString(obj.previewUpdatedAt),
    events: normalizedEvents,
    stats: {
      total: typeof obj.stats === "object" && obj.stats && !Array.isArray(obj.stats) && typeof (obj.stats as Record<string, unknown>).total === "number"
        ? Math.max(0, Math.round((obj.stats as Record<string, unknown>).total as number))
        : normalizedEvents.length,
      resolved: typeof obj.stats === "object" && obj.stats && !Array.isArray(obj.stats) && typeof (obj.stats as Record<string, unknown>).resolved === "number"
        ? Math.max(0, Math.round((obj.stats as Record<string, unknown>).resolved as number))
        : normalizedEvents.filter((event) => event.status === "resolved").length,
      unresolved: typeof obj.stats === "object" && obj.stats && !Array.isArray(obj.stats) && typeof (obj.stats as Record<string, unknown>).unresolved === "number"
        ? Math.max(0, Math.round((obj.stats as Record<string, unknown>).unresolved as number))
        : normalizedEvents.filter((event) => event.status !== "resolved").length,
    },
  };
}

export function writeShortFormSoundDesignResolution(projectId: string, resolution: ShortFormSoundDesignResolution) {
  const resolutionPath = getShortFormSoundDesignResolutionPath(projectId);
  ensureDir(path.dirname(resolutionPath));
  fs.writeFileSync(resolutionPath, JSON.stringify(resolution, null, 2), "utf-8");
  return resolution;
}

function findSceneAnchorTime(event: ShortFormSoundDesignEvent, scenes: TimelineScene[]) {
  const fallbackScene = scenes[0];
  const scene = event.sceneId ? scenes.find((item) => item.id === event.sceneId) : fallbackScene;
  if (!scene) return 0;
  if (event.anchor === "scene-end") return typeof scene.endTime === "number" ? scene.endTime : typeof scene.startTime === "number" ? scene.startTime : 0;
  return typeof scene.startTime === "number" ? scene.startTime : 0;
}

function findCaptionAnchorTime(event: ShortFormSoundDesignEvent, captions: TimelineCaption[]) {
  const fallbackCaption = captions[0];
  const caption = event.captionId ? captions.find((item) => item.id === event.captionId) : fallbackCaption;
  if (!caption) return 0;
  return event.anchor === "caption-end" ? caption.end : caption.start;
}

function getNarrationDuration(projectId: string) {
  const captions = getTimelineCaptions(projectId);
  if (captions.length > 0) {
    return captions[captions.length - 1].end;
  }
  const scenes = getTimelineScenes(projectId);
  if (scenes.length > 0) {
    const maxEnd = Math.max(...scenes.map((scene) => typeof scene.endTime === "number" ? scene.endTime : 0));
    return Number.isFinite(maxEnd) && maxEnd > 0 ? maxEnd : 0;
  }
  return 0;
}

function getAssetCompatibility(event: ShortFormSoundDesignEvent, asset: ShortFormSoundLibraryEntry) {
  let score = 0;
  if (asset.semanticTypes.includes(event.type)) score += 6;
  if (asset.timingType === "bed" && event.type === "ambience") score += 3;
  if (asset.timingType === "riser" && event.type === "riser") score += 3;
  if (asset.defaultAnchor === event.anchor) score += 2;
  const lowerTrack = event.track.toLowerCase();
  if (asset.category.toLowerCase().includes(lowerTrack)) score += 1;
  if ((event.intensity || "").length > 0 && asset.tags.some((tag) => tag.toLowerCase() === (event.intensity || "").toLowerCase())) score += 1;
  if (!asset.audioRelativePath) score -= 10;
  return score;
}

function getAssetDurationSeconds(asset: ShortFormSoundLibraryEntry) {
  return typeof asset.durationSeconds === "number" && Number.isFinite(asset.durationSeconds) && asset.durationSeconds > 0
    ? asset.durationSeconds
    : asset.timingType === "bed"
      ? 4
      : asset.timingType === "riser"
        ? 1.2
        : 0.6;
}

function resolveEventTime(projectId: string, event: ShortFormSoundDesignEvent, scenes: TimelineScene[], captions: TimelineCaption[]) {
  let anchorTime = 0;
  if (event.anchor === "caption-start" || event.anchor === "caption-end") {
    anchorTime = findCaptionAnchorTime(event, captions);
  } else if (event.anchor === "global-end") {
    anchorTime = getNarrationDuration(projectId);
  } else if (event.anchor === "global-start") {
    anchorTime = 0;
  } else {
    anchorTime = findSceneAnchorTime(event, scenes);
  }
  return Math.max(0, anchorTime + event.offsetMs / 1000);
}

function resolveBedEventEnd(options: {
  event: ShortFormSoundDesignEvent;
  start: number;
  duration: number;
  assetDuration: number;
  scenes: TimelineScene[];
  captions: TimelineCaption[];
}) {
  const { event, start, duration, assetDuration, scenes, captions } = options;
  const fallbackEnd = Math.min(duration || start + assetDuration, start + assetDuration);

  if (event.anchor === "global-start" || event.anchor === "global-end") {
    return duration > 0 ? Math.max(start, duration) : start + assetDuration;
  }

  if (event.anchor === "caption-start" || event.anchor === "caption-end") {
    const caption = event.captionId ? captions.find((item) => item.id === event.captionId) : captions[0];
    return caption?.end || fallbackEnd;
  }

  const scene = event.sceneId ? scenes.find((item) => item.id === event.sceneId) : scenes[0];
  return typeof scene?.endTime === "number" ? Math.max(start, scene.endTime) : fallbackEnd;
}

export function resolveShortFormSoundDesign(projectId: string, overrides?: ShortFormResolvedSoundDesignEvent[]) {
  const settings = getShortFormSoundDesignSettings();
  const doc = readShortFormSoundDesignDocument(projectId);
  const scenes = getTimelineScenes(projectId);
  const captions = getTimelineCaptions(projectId);
  const duration = getNarrationDuration(projectId);
  const existingById = new Map<string, ShortFormResolvedSoundDesignEvent>();
  (overrides || doc.resolution?.events || []).forEach((event) => {
    existingById.set(event.id, event);
  });

  const resolvedEvents = doc.events.map((event) => {
    const prior = existingById.get(event.id);
    const compatibleAssets = settings.library
      .filter((asset) => asset.audioRelativePath)
      .map((asset) => ({ asset, score: getAssetCompatibility(event, asset) }))
      .sort((left, right) => right.score - left.score);
    const manualAsset = prior?.manualAssetId ? settings.library.find((asset) => asset.id === prior.manualAssetId) : undefined;
    const asset = manualAsset || compatibleAssets[0]?.asset;
    const assetDuration = asset ? getAssetDurationSeconds(asset) : undefined;
    const assetAnchorOffsetSeconds = assetDuration ? assetDuration * (asset?.anchorRatio || 0) : 0;
    const baseStart = resolveEventTime(projectId, event, scenes, captions);
    const start = Math.max(0, baseStart + ((prior?.manualNudgeMs || 0) / 1000) - assetAnchorOffsetSeconds);
    const fadeInMs = typeof event.fadeInMs === "number" ? event.fadeInMs : asset?.defaultFadeInMs || 0;
    const fadeOutMs = typeof event.fadeOutMs === "number" ? event.fadeOutMs : asset?.defaultFadeOutMs || 0;
    const gainDb = typeof prior?.manualGainDb === "number"
      ? prior.manualGainDb
      : typeof event.gainDb === "number"
        ? event.gainDb
        : asset?.defaultGainDb || 0;
    const end = asset && asset.timingType === "bed"
      ? resolveBedEventEnd({
          event,
          start,
          duration,
          assetDuration: getAssetDurationSeconds(asset),
          scenes,
          captions,
        })
      : assetDuration
        ? start + assetDuration
        : undefined;

    return {
      ...event,
      assetId: asset?.id,
      assetName: asset?.name,
      assetRelativePath: asset?.audioRelativePath,
      timingType: asset?.timingType,
      resolvedStartSeconds: start,
      ...(typeof end === "number" ? { resolvedEndSeconds: Math.max(start, end) } : {}),
      ...(typeof assetDuration === "number" ? { durationSeconds: assetDuration } : {}),
      resolvedGainDb: gainDb,
      resolvedFadeInMs: fadeInMs,
      resolvedFadeOutMs: fadeOutMs,
      duckingDb: settings.defaultDuckingDb,
      muted: prior?.muted === true,
      solo: prior?.solo === true,
      manualAssetId: prior?.manualAssetId,
      manualGainDb: prior?.manualGainDb,
      manualNudgeMs: prior?.manualNudgeMs,
      compatibleAssetIds: compatibleAssets.filter((item) => item.score > -4).map((item) => item.asset.id),
      status: asset?.audioRelativePath ? "resolved" : "unresolved",
      resolutionReason: asset?.audioRelativePath
        ? (manualAsset ? "manual-asset-selection" : compatibleAssets[0] ? "semantic-library-match" : "fallback")
        : "No uploaded sound asset matched this semantic event.",
    } satisfies ShortFormResolvedSoundDesignEvent;
  });

  const resolution: ShortFormSoundDesignResolution = {
    version: 1,
    generatedAt: new Date().toISOString(),
    previewAudioRelativePath: doc.resolution?.previewAudioRelativePath,
    previewUpdatedAt: doc.resolution?.previewUpdatedAt,
    events: resolvedEvents,
    stats: {
      total: resolvedEvents.length,
      resolved: resolvedEvents.filter((event) => event.status === "resolved").length,
      unresolved: resolvedEvents.filter((event) => event.status !== "resolved").length,
    },
  };

  writeShortFormSoundDesignResolution(projectId, resolution);
  return resolution;
}

function getAudioDurationSeconds(audioPath: string) {
  const result = spawnSync("ffprobe", [
    "-v",
    "error",
    "-show_entries",
    "format=duration",
    "-of",
    "default=noprint_wrappers=1:nokey=1",
    audioPath,
  ], { encoding: "utf-8" });
  const parsed = Number(result.stdout?.trim() || "");
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

function buildAtempoFilters(playbackRate: number) {
  const clamped = Math.min(100, Math.max(0.01, playbackRate));
  const filters: string[] = [];
  let remaining = clamped;
  while (remaining > 2) {
    filters.push("atempo=2.0");
    remaining /= 2;
  }
  while (remaining < 0.5) {
    filters.push("atempo=0.5");
    remaining /= 0.5;
  }
  filters.push(`atempo=${remaining.toFixed(5)}`);
  return filters;
}

function ffmpegSupportsFilter(filterName: string) {
  const result = spawnSync("ffmpeg", ["-hide_banner", "-filters"], { encoding: "utf-8" });
  return (result.stdout || "").includes(filterName);
}

export function renderShortFormSoundDesignPreview(options: {
  projectId: string;
  narrationPath: string;
  musicPath?: string;
  musicVolume?: number;
  includeNarration?: boolean;
  includeMusic?: boolean;
  includeSoundEffects?: boolean;
  onlyTrack?: string;
  outputFileName?: string;
  persistAsDefault?: boolean;
}) {
  const {
    projectId,
    narrationPath,
    musicPath,
    musicVolume,
    includeNarration = true,
    includeMusic = true,
    includeSoundEffects = true,
    onlyTrack,
    outputFileName = "sound-design-preview.wav",
    persistAsDefault = outputFileName === "sound-design-preview.wav",
  } = options;
  const resolution = readShortFormSoundDesignResolution(projectId) || resolveShortFormSoundDesign(projectId);
  const previewPath = getShortFormSoundDesignPreviewPath(projectId, outputFileName);
  const previewRelativePath = getShortFormSoundDesignPreviewRelativePath(projectId, outputFileName);
  ensureDir(path.dirname(previewPath));

  if (includeNarration && !fs.existsSync(narrationPath)) {
    throw new Error("Missing narration WAV for sound-design preview.");
  }

  const activeEventsBase = resolution.events.filter((event) => event.status === "resolved" && !event.muted && event.assetRelativePath);
  const anySolo = activeEventsBase.some((event) => event.solo);
  const activeEvents = (anySolo ? activeEventsBase.filter((event) => event.solo) : activeEventsBase)
    .filter((event) => !onlyTrack || event.track === onlyTrack);
  const inputArgs = ["-y"];
  const filterLines: string[] = [];
  const backgroundLabels: string[] = [];
  let inputIndex = 0;

  if (includeNarration) {
    inputArgs.push("-i", narrationPath);
    filterLines.push(`[${inputIndex}:a]volume=1.0[narr]`);
    inputIndex += 1;
  }

  if (includeMusic && musicPath && fs.existsSync(musicPath)) {
    inputArgs.push("-i", musicPath);
    filterLines.push(`[${inputIndex}:a]volume=${Number.isFinite(musicVolume as number) ? Number(musicVolume).toFixed(3) : "0.160"}[music]`);
    backgroundLabels.push("[music]");
    inputIndex += 1;
  }

  if (includeSoundEffects) {
    for (const event of activeEvents) {
      const relativePath = event.assetRelativePath;
      if (!relativePath) continue;
      const absolutePath = path.join(getShortFormSoundLibraryDir(), relativePath);
      if (!fs.existsSync(absolutePath)) continue;
      const desiredDuration = typeof event.resolvedEndSeconds === "number"
        ? Math.max(0.05, event.resolvedEndSeconds - event.resolvedStartSeconds)
        : event.durationSeconds || getAudioDurationSeconds(absolutePath) || 0.6;
      const sourceDuration = getAudioDurationSeconds(absolutePath) || desiredDuration;
      const streamLoop = event.timingType === "bed" && desiredDuration > sourceDuration + 0.02;
      if (streamLoop) inputArgs.push("-stream_loop", "-1");
      inputArgs.push("-i", absolutePath);
      const gainScale = Math.pow(10, event.resolvedGainDb / 20);
      const fadeInSeconds = Math.max(0, (event.resolvedFadeInMs || 0) / 1000);
      const fadeOutSeconds = Math.max(0, (event.resolvedFadeOutMs || 0) / 1000);
      const delayMs = Math.max(0, Math.round(event.resolvedStartSeconds * 1000));
      const filters = [
        `atrim=0:${desiredDuration.toFixed(3)}`,
        `volume=${gainScale.toFixed(5)}`,
        ...(fadeInSeconds > 0 ? [`afade=t=in:st=0:d=${fadeInSeconds.toFixed(3)}`] : []),
        ...(fadeOutSeconds > 0 && desiredDuration > 0.05 ? [`afade=t=out:st=${Math.max(0, desiredDuration - fadeOutSeconds).toFixed(3)}:d=${Math.min(fadeOutSeconds, desiredDuration).toFixed(3)}`] : []),
        `adelay=${delayMs}|${delayMs}`,
      ];
      const label = `evt${inputIndex}`;
      filterLines.push(`[${inputIndex}:a]${filters.join(",")}[${label}]`);
      backgroundLabels.push(`[${label}]`);
      inputIndex += 1;
    }
  }

  const hasNarration = includeNarration;
  const hasBackground = backgroundLabels.length > 0;
  if (!hasNarration && !hasBackground) {
    throw new Error(onlyTrack
      ? `No resolved sound-design events are available on the ${onlyTrack} track for preview.`
      : "No audio sources are available for this preview mode.");
  }

  let outputLabel = hasNarration ? "[narr]" : backgroundLabels[0] || "";
  if (hasBackground) {
    if (backgroundLabels.length > 1) {
      filterLines.push(`${backgroundLabels.join("")}amix=inputs=${backgroundLabels.length}:normalize=0:dropout_transition=0[bgraw]`);
      outputLabel = "[bgraw]";
    } else {
      outputLabel = backgroundLabels[0]!;
    }
  }

  if (hasNarration && hasBackground) {
    if (ffmpegSupportsFilter("sidechaincompress")) {
      const threshold = 0.04;
      filterLines.push(`${outputLabel}[narr]sidechaincompress=threshold=${threshold}:ratio=10:attack=15:release=280:makeup=1[duckedbg]`);
    } else {
      filterLines.push(`${outputLabel}volume=0.75[duckedbg]`);
    }
    filterLines.push(`[narr][duckedbg]amix=inputs=2:normalize=0:weights='1 1'[mix]`);
    outputLabel = "[mix]";
  }

  const ffmpegArgs = [
    ...inputArgs,
    ...(filterLines.length > 0 ? ["-filter_complex", filterLines.join(";")] : []),
    "-map",
    outputLabel,
    "-c:a",
    "pcm_s16le",
    previewPath,
  ];

  const result = spawnSync("ffmpeg", ffmpegArgs, { encoding: "utf-8", maxBuffer: 10 * 1024 * 1024 });
  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout || "Failed to render sound-design preview audio.");
  }

  if (persistAsDefault) {
    const updated = readShortFormSoundDesignResolution(projectId) || resolution;
    updated.previewAudioRelativePath = previewRelativePath;
    updated.previewUpdatedAt = new Date().toISOString();
    writeShortFormSoundDesignResolution(projectId, updated);
  }

  return { previewPath, previewRelativePath };
}
