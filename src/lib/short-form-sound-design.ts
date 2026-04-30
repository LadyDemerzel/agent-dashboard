import fs from "fs";
import path from "path";
import { spawnSync } from "child_process";
import { extractBody, generateFrontMatter, parseFrontMatter } from "@/lib/frontmatter";
import {
  getShortFormSoundDesignSettings,
  getShortFormSoundLibraryDir,
  type ShortFormSoundFrequencyBand,
  type ShortFormSoundLibraryEntry,
  type ShortFormSoundLiteralness,
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
  assetId?: string;
  startSeconds: number;
  endSeconds?: number;
  durationSeconds?: number;
  description?: string;
  searchQuery?: string;
  category?: string;
  priority?: "must-have" | "nice-to-have" | "optional";
  anchor?: string;
  sceneId?: string;
  captionId?: string;
  offsetMs?: number;
  gainDb?: number;
  fadeInMs?: number;
  fadeOutMs?: number;
  intensity?: string;
  rationale?: string;
  notes?: string;
  overlap?: "allow" | "avoid" | "layered";
  groupId?: string;
  frequencyBand?: ShortFormSoundFrequencyBand;
  layerRole?: string;
  stylePalette?: string;
  literalness?: ShortFormSoundLiteralness;
  musicDuckingDb?: number;
  musicEqCutDb?: number;
  musicEqFrequencyHz?: number;
  musicEqQ?: number;
  musicLowCutHz?: number;
  musicHighCutHz?: number;
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

export interface ShortFormSoundDesignMixSettings {
  defaultDuckingDb: number;
  maxConcurrentOneShots: number;
  musicDuckingDb: number;
  musicEqCutDb: number;
  musicEqFrequencyHz: number;
  musicEqQ: number;
  musicLowCutHz: number;
  musicHighCutHz: number;
}

export interface ShortFormSoundDesignResolution {
  version: number;
  generatedAt: string;
  previewAudioRelativePath?: string;
  previewUpdatedAt?: string;
  mixSettings?: ShortFormSoundDesignMixSettings;
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
  mixSettings?: ShortFormSoundDesignMixSettings;
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

interface TimelineVisual {
  id: string;
  label: string;
  start: number;
  end?: number;
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

function clampOptionalNumber(value: unknown, min: number, max: number, digits = 0) {
  const parsed = typeof value === "number" ? value : typeof value === "string" ? Number(value) : Number.NaN;
  if (!Number.isFinite(parsed)) return undefined;
  const factor = 10 ** digits;
  return Math.min(max, Math.max(min, Math.round(parsed * factor) / factor));
}

function normalizeFrequencyBand(value: unknown): ShortFormSoundFrequencyBand | undefined {
  return value === "low" || value === "mid" || value === "high" || value === "full-range" ? value : undefined;
}

function normalizeLiteralness(value: unknown): ShortFormSoundLiteralness | undefined {
  return value === "literal" || value === "stylized" || value === "emotional-metaphor" ? value : undefined;
}

function normalizeEventType(value: unknown): ShortFormSoundSemanticType {
  return value === "riser" || value === "click" || value === "whoosh" || value === "ambience" || value === "music-riser" || value === "music-reverb-tail" || value === "mix-duck" || value === "mix-eq"
    ? value
    : "impact";
}

function isAssetBackedEventType(type: ShortFormSoundSemanticType): type is "impact" | "riser" | "click" | "whoosh" | "ambience" {
  return type === "impact" || type === "riser" || type === "click" || type === "whoosh" || type === "ambience";
}

function normalizeKey(value: unknown) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function findSoundLibraryAssetByReference(reference: unknown, library = getShortFormSoundDesignSettings().library) {
  const normalized = normalizeKey(reference);
  if (!normalized) return undefined;
  return library.find((asset) => asset.id.toLowerCase() === normalized)
    || library.find((asset) => asset.name.toLowerCase() === normalized)
    || library.find((asset) => asset.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") === normalized);
}

function resolveEventTypeAndAsset(attributes: Record<string, string>) {
  const library = getShortFormSoundDesignSettings().library;
  const semanticType = normalizeEventType(attributes.type);
  const explicitAsset = findSoundLibraryAssetByReference(attributes.assetId, library);
  const typeAsset = explicitAsset || findSoundLibraryAssetByReference(attributes.type, library);
  const assetSemanticType = typeAsset?.semanticTypes.find((type) => isAssetBackedEventType(type));
  return {
    type: typeAsset && semanticType === "impact" && attributes.type !== "impact"
      ? assetSemanticType || semanticType
      : semanticType,
    assetId: typeAsset?.id,
  };
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


function getTimelineVisuals(projectId: string): TimelineVisual[] {
  const xmlScriptPath = path.join(getProjectDir(projectId), "xml-script.md");
  if (!fs.existsSync(xmlScriptPath)) return [];
  const xml = extractBody(fs.readFileSync(xmlScriptPath, "utf-8"));
  const visualMatches = xml.match(/<visual\b[^>]*(?:\/>|>[\s\S]*?<\/visual>)/g) || [];
  return visualMatches
    .map((match, index): TimelineVisual | null => {
      const attributes = parseAttributes(match);
      const start = clampOptionalNumber(attributes.start, 0, 10_000, 3);
      if (typeof start !== "number") return null;
      const end = clampOptionalNumber(attributes.end, 0, 10_000, 3);
      return {
        id: normalizeString(attributes.id, `visual-${index + 1}`),
        label: normalizeString(attributes.label, `Visual ${index + 1}`),
        start,
        ...(typeof end === "number" ? { end } : {}),
      };
    })
    .filter((visual): visual is TimelineVisual => Boolean(visual));
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

function parseOpeningTagAttributes(nodeSource: string, tagName: string) {
  const openingTag = nodeSource.match(new RegExp(`<${tagName}\\b[^>]*>`))?.[0] || nodeSource;
  return parseAttributes(openingTag);
}

function normalizeOverlap(value: unknown): "allow" | "avoid" | "layered" | undefined {
  return value === "allow" || value === "avoid" || value === "layered" ? value : undefined;
}

export function parseShortFormSoundDesignRootAttributes(content: string) {
  const xml = extractBody(content);
  const rootMatch = xml.match(/<(?:soundDesign|sound_design)\b[^>]*>/);
  return rootMatch ? parseAttributes(rootMatch[0]) : {};
}

export function resolveShortFormSoundDesignMixSettings(content?: string, events: ShortFormSoundDesignEvent[] = []): ShortFormSoundDesignMixSettings {
  const settings = getShortFormSoundDesignSettings();
  const root = content ? parseShortFormSoundDesignRootAttributes(content) : {};
  const base: ShortFormSoundDesignMixSettings = {
    defaultDuckingDb: clampNumber(root.duckingDb, -24, 0, settings.defaultDuckingDb, 1),
    maxConcurrentOneShots: clampNumber(root.maxConcurrentOneShots, 1, 8, settings.maxConcurrentOneShots, 0),
    musicDuckingDb: clampNumber(root.musicDuckingDb, -24, 0, settings.musicDuckingDb, 1),
    musicEqCutDb: clampNumber(root.musicEqCutDb, -18, 0, settings.musicEqCutDb, 1),
    musicEqFrequencyHz: clampNumber(root.musicEqFrequencyHz, 120, 8000, settings.musicEqFrequencyHz, 0),
    musicEqQ: clampNumber(root.musicEqQ, 0.1, 10, settings.musicEqQ, 2),
    musicLowCutHz: clampNumber(root.musicLowCutHz, 0, 500, settings.musicLowCutHz, 0),
    musicHighCutHz: clampNumber(root.musicHighCutHz, 0, 20000, settings.musicHighCutHz, 0),
  };
  // Per-effect music controls are aggregate mix intentions, not sequenced automation.
  // Resolve them deterministically by choosing conservative values: strongest duck/cut,
  // narrowest high/low pass range, and EQ frequency/Q from the event with the strongest cut.
  let strongestEqCutEvent: ShortFormSoundDesignEvent | undefined;
  for (const event of events) {
    if (typeof event.musicDuckingDb === "number") base.musicDuckingDb = Math.min(base.musicDuckingDb, event.musicDuckingDb);
    if (typeof event.musicEqCutDb === "number" && event.musicEqCutDb < base.musicEqCutDb) {
      base.musicEqCutDb = event.musicEqCutDb;
      strongestEqCutEvent = event;
    }
    if (typeof event.musicLowCutHz === "number") base.musicLowCutHz = Math.max(base.musicLowCutHz, event.musicLowCutHz);
    if (typeof event.musicHighCutHz === "number" && event.musicHighCutHz > 0) {
      base.musicHighCutHz = base.musicHighCutHz > 0 ? Math.min(base.musicHighCutHz, event.musicHighCutHz) : event.musicHighCutHz;
    }
  }
  if (strongestEqCutEvent) {
    if (typeof strongestEqCutEvent.musicEqFrequencyHz === "number") base.musicEqFrequencyHz = strongestEqCutEvent.musicEqFrequencyHz;
    if (typeof strongestEqCutEvent.musicEqQ === "number") base.musicEqQ = strongestEqCutEvent.musicEqQ;
  }
  return base;
}

export function parseShortFormSoundDesignXml(content: string): ShortFormSoundDesignEvent[] {
  const xml = extractBody(content);
  const events: ShortFormSoundDesignEvent[] = [];
  const trackMatches = xml.match(/<track\b[^>]*(?:\/>|>[\s\S]*?<\/track>)/g) || [];

  trackMatches.forEach((trackMatch, trackIndex) => {
    const trackAttrs = parseOpeningTagAttributes(trackMatch, "track");
    const trackId = normalizeString(trackAttrs.id || trackAttrs.name, `track-${trackIndex + 1}`);
    const effectMatches = trackMatch.match(/<effect\b[^>]*\/>/g) || [];
    effectMatches.forEach((effectMatch, effectIndex) => {
      const attributes = parseAttributes(effectMatch);
      const { type, assetId } = resolveEventTypeAndAsset(attributes);
      const startSeconds = clampNumber(attributes.start ?? attributes.startSeconds, 0, 10_000, 0, 3);
      const endSeconds = clampOptionalNumber(attributes.end ?? attributes.endSeconds, 0, 10_000, 3);
      const durationSeconds = clampOptionalNumber(attributes.duration ?? attributes.durationSeconds, 0.01, 10_000, 3);
      const overlap = normalizeOverlap(attributes.overlap);
      const priority = attributes.priority === "nice-to-have" || attributes.priority === "optional" ? attributes.priority : attributes.priority === "must-have" ? "must-have" : undefined;
      events.push({
        id: normalizeString(attributes.id, `fx-${trackIndex + 1}-${effectIndex + 1}`),
        type,
        track: trackId,
        assetId,
        startSeconds,
        ...(typeof endSeconds === "number" ? { endSeconds: Math.max(startSeconds, endSeconds) } : {}),
        ...(typeof durationSeconds === "number" ? { durationSeconds } : {}),
        description: normalizeOptionalString(attributes.description),
        searchQuery: normalizeOptionalString(attributes.searchQuery || attributes.query),
        category: normalizeOptionalString(attributes.category || trackAttrs.category),
        priority,
        gainDb: attributes.gainDb !== undefined ? clampNumber(attributes.gainDb, -36, 12, 0, 1) : undefined,
        fadeInMs: attributes.fadeInMs !== undefined ? clampNumber(attributes.fadeInMs, 0, 10_000, 0, 0) : undefined,
        fadeOutMs: attributes.fadeOutMs !== undefined ? clampNumber(attributes.fadeOutMs, 0, 10_000, 0, 0) : undefined,
        intensity: normalizeOptionalString(attributes.intensity),
        rationale: normalizeOptionalString(attributes.rationale),
        notes: normalizeOptionalString(attributes.notes),
        overlap,
        groupId: normalizeOptionalString(attributes.groupId),
        frequencyBand: normalizeFrequencyBand(attributes.frequencyBand),
        layerRole: normalizeOptionalString(attributes.layerRole || attributes.role),
        stylePalette: normalizeOptionalString(attributes.stylePalette),
        literalness: normalizeLiteralness(attributes.literalness),
        musicDuckingDb: clampOptionalNumber(attributes.musicDuckingDb, -24, 0, 1),
        musicEqCutDb: clampOptionalNumber(attributes.musicEqCutDb, -18, 0, 1),
        musicEqFrequencyHz: clampOptionalNumber(attributes.musicEqFrequencyHz, 120, 8000, 0),
        musicEqQ: clampOptionalNumber(attributes.musicEqQ, 0.1, 10, 2),
        musicLowCutHz: clampOptionalNumber(attributes.musicLowCutHz, 0, 500, 0),
        musicHighCutHz: clampOptionalNumber(attributes.musicHighCutHz, 0, 20000, 0),
      });
    });
  });

  if (events.length > 0) return events;

  // Legacy compatibility: older artifacts used flat <event /> tags anchored to scenes/captions.
  // New artifacts must use <track><effect start=...> with timestamp placement only.
  const eventMatches = xml.match(/<event\b[^>]*\/>/g) || [];
  return eventMatches.map((match, index) => {
    const attributes = parseAttributes(match);
    const { type, assetId } = resolveEventTypeAndAsset(attributes);
    const anchor = attributes.anchor === "scene-end"
      || attributes.anchor === "caption-start"
      || attributes.anchor === "caption-end"
      || attributes.anchor === "global-start"
      || attributes.anchor === "global-end"
      ? attributes.anchor
      : "scene-start";
    const overlap = normalizeOverlap(attributes.overlap);
    return {
      id: normalizeString(attributes.id, `evt-${index + 1}`),
      type,
      track: normalizeString(attributes.track, type === "ambience" ? "ambience" : type === "riser" || type === "whoosh" ? "transitions" : "impacts"),
      assetId,
      startSeconds: 0,
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
      groupId: normalizeOptionalString(attributes.groupId),
      frequencyBand: normalizeFrequencyBand(attributes.frequencyBand),
      layerRole: normalizeOptionalString(attributes.layerRole),
      stylePalette: normalizeOptionalString(attributes.stylePalette),
      literalness: normalizeLiteralness(attributes.literalness),
      musicDuckingDb: clampOptionalNumber(attributes.musicDuckingDb, -24, 0, 1),
      musicEqCutDb: clampOptionalNumber(attributes.musicEqCutDb, -18, 0, 1),
      musicEqFrequencyHz: clampOptionalNumber(attributes.musicEqFrequencyHz, 120, 8000, 0),
      musicEqQ: clampOptionalNumber(attributes.musicEqQ, 0.1, 10, 2),
      musicLowCutHz: clampOptionalNumber(attributes.musicLowCutHz, 0, 500, 0),
      musicHighCutHz: clampOptionalNumber(attributes.musicHighCutHz, 0, 20000, 0),
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
    "<sound_design version=\"2\" duckingDb=\"-8\" maxConcurrentOneShots=\"2\" musicDuckingDb=\"-6\" musicEqCutDb=\"-4\" musicEqFrequencyHz=\"1800\" musicEqQ=\"1.1\" musicLowCutHz=\"60\" musicHighCutHz=\"0\">",
    "  <track id=\"impacts\" role=\"punctuation\" gainDb=\"0\">",
    "    <effect id=\"fx-opening-hit\" type=\"impact\" start=\"0.00\" duration=\"0.60\" gainDb=\"-5\" fadeInMs=\"0\" fadeOutMs=\"220\" intensity=\"medium\" groupId=\"open-low-mid-high\" frequencyBand=\"mid\" layerRole=\"body\" literalness=\"stylized\" searchQuery=\"premium editorial soft opening hit\" rationale=\"Opening punctuation timed by absolute timestamp.\" />",
    "  </track>",
    "</sound_design>",
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

function buildEffectAttributes(event: ShortFormSoundDesignEvent) {
  return [
    `id=\"${escapeXmlAttribute(event.id)}\"`,
    `type=\"${escapeXmlAttribute(event.type)}\"`,
    `start=\"${event.startSeconds.toFixed(3)}\"`,
    ...(typeof event.endSeconds === "number" ? [`end=\"${event.endSeconds.toFixed(3)}\"`] : []),
    ...(typeof event.durationSeconds === "number" ? [`duration=\"${event.durationSeconds.toFixed(3)}\"`] : []),
    ...(event.description ? [`description=\"${escapeXmlAttribute(event.description)}\"`] : []),
    ...(event.searchQuery ? [`searchQuery=\"${escapeXmlAttribute(event.searchQuery)}\"`] : []),
    ...(event.category ? [`category=\"${escapeXmlAttribute(event.category)}\"`] : []),
    ...(event.priority ? [`priority=\"${event.priority}\"`] : []),
    ...(typeof event.gainDb === "number" ? [`gainDb=\"${event.gainDb}\"`] : []),
    ...(typeof event.fadeInMs === "number" ? [`fadeInMs=\"${Math.round(event.fadeInMs)}\"`] : []),
    ...(typeof event.fadeOutMs === "number" ? [`fadeOutMs=\"${Math.round(event.fadeOutMs)}\"`] : []),
    ...(event.intensity ? [`intensity=\"${escapeXmlAttribute(event.intensity)}\"`] : []),
    ...(event.rationale ? [`rationale=\"${escapeXmlAttribute(event.rationale)}\"`] : []),
    ...(event.notes ? [`notes=\"${escapeXmlAttribute(event.notes)}\"`] : []),
    ...(event.overlap ? [`overlap=\"${event.overlap}\"`] : []),
    ...(event.groupId ? [`groupId=\"${escapeXmlAttribute(event.groupId)}\"`] : []),
    ...(event.frequencyBand ? [`frequencyBand=\"${event.frequencyBand}\"`] : []),
    ...(event.layerRole ? [`layerRole=\"${escapeXmlAttribute(event.layerRole)}\"`] : []),
    ...(event.stylePalette ? [`stylePalette=\"${escapeXmlAttribute(event.stylePalette)}\"`] : []),
    ...(event.literalness ? [`literalness=\"${event.literalness}\"`] : []),
    ...(typeof event.musicDuckingDb === "number" ? [`musicDuckingDb=\"${event.musicDuckingDb}\"`] : []),
    ...(typeof event.musicEqCutDb === "number" ? [`musicEqCutDb=\"${event.musicEqCutDb}\"`] : []),
    ...(typeof event.musicEqFrequencyHz === "number" ? [`musicEqFrequencyHz=\"${event.musicEqFrequencyHz}\"`] : []),
    ...(typeof event.musicEqQ === "number" ? [`musicEqQ=\"${event.musicEqQ}\"`] : []),
    ...(typeof event.musicLowCutHz === "number" ? [`musicLowCutHz=\"${event.musicLowCutHz}\"`] : []),
    ...(typeof event.musicHighCutHz === "number" ? [`musicHighCutHz=\"${event.musicHighCutHz}\"`] : []),
  ];
}

function pushTrackLines(lines: string[], track: string, events: ShortFormSoundDesignEvent[]) {
  lines.push(`  <track id=\"${escapeXmlAttribute(track)}\">`);
  events.forEach((event) => {
    lines.push(`    <effect ${buildEffectAttributes(event).join(" ")} />`);
  });
  lines.push("  </track>");
}


export function buildSuggestedShortFormSoundDesignDocument(
  projectId: string,
  options?: { topic?: string; selectedHook?: string; notes?: string }
) {
  const settings = getShortFormSoundDesignSettings();
  const visuals = getTimelineVisuals(projectId);
  const captions = getTimelineCaptions(projectId);
  const duration = getNarrationDuration(projectId);
  const hasSemantic = (semanticType: "impact" | "riser" | "click" | "whoosh" | "ambience") => settings.library.some((entry) => entry.semanticTypes.includes(semanticType));
  const events: ShortFormSoundDesignEvent[] = [];
  const firstVisual = visuals[0];

  events.push({
    id: "fx-opening-hit",
    type: "impact",
    track: "impacts",
    startSeconds: Math.max(0, firstVisual?.start ?? captions[0]?.start ?? 0),
    durationSeconds: 0.6,
    gainDb: -5,
    fadeInMs: 0,
    fadeOutMs: 220,
    intensity: "medium",
    description: "Opening punctuation hit",
    searchQuery: "premium editorial soft opening hit",
    rationale: "Punch the opening timestamp without tying the cue to a caption boundary.",
    overlap: "avoid",
    groupId: "opening-layered-hit",
    frequencyBand: "mid",
    layerRole: "body",
    stylePalette: "premium editorial",
    literalness: "stylized",
    priority: "must-have",
  });

  if (hasSemantic("ambience") && duration > 3) {
    events.push({
      id: "fx-ambience-bed",
      type: "ambience",
      track: "ambience",
      startSeconds: 0,
      endSeconds: duration || Math.max(4, visuals.at(-1)?.end || 4),
      gainDb: -18,
      fadeInMs: 240,
      fadeOutMs: 420,
      intensity: "low",
      description: "Low-level editorial air bed",
      searchQuery: "subtle premium air texture ambience bed",
      rationale: "Low-level texture to keep the mix from feeling dry across the full timed edit.",
      overlap: "allow",
      groupId: "global-air-bed",
      frequencyBand: "high",
      layerRole: "air",
      stylePalette: "premium editorial",
      literalness: "emotional-metaphor",
      priority: "nice-to-have",
    });
  }

  visuals.slice(1, 4).forEach((visual, index) => {
    events.push({
      id: `fx-transition-${index + 1}`,
      type: hasSemantic("whoosh") ? "whoosh" : "riser",
      track: "transitions",
      startSeconds: Math.max(0, visual.start - 0.08),
      durationSeconds: 0.7,
      gainDb: -8,
      fadeInMs: 20,
      fadeOutMs: 180,
      intensity: index === 0 ? "medium" : "low",
      description: `Transition into ${visual.label}`,
      searchQuery: "clean editorial transition whoosh riser",
      rationale: `Carry momentum into the visual beat at ${visual.start.toFixed(2)}s (${visual.label}).`,
      overlap: "avoid",
      groupId: `transition-${index + 1}-layered`,
      frequencyBand: index === 0 ? "mid" : "high",
      layerRole: index === 0 ? "motion" : "air",
      stylePalette: "premium editorial",
      literalness: "stylized",
      priority: "nice-to-have",
    });
  });

  if (captions[1] && hasSemantic("click")) {
    const pivotTime = captions[1].start + Math.min(0.18, Math.max(0, (captions[1].end - captions[1].start) / 3));
    events.push({
      id: "fx-early-pivot-click",
      type: "click",
      track: "details",
      startSeconds: pivotTime,
      durationSeconds: 0.25,
      gainDb: -10,
      fadeInMs: 0,
      fadeOutMs: 120,
      intensity: "low",
      description: "Small early argument pivot tick",
      searchQuery: "subtle clean UI tick punctuation",
      rationale: "Add a precise punctuation point near an early narration pivot; timestamp can sit inside the caption span, not on its boundary.",
      overlap: "avoid",
      frequencyBand: "high",
      layerRole: "tick",
      stylePalette: "premium editorial",
      literalness: "stylized",
      priority: "optional",
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
    `<sound_design version=\"2\" duckingDb=\"${settings.defaultDuckingDb}\" maxConcurrentOneShots=\"${settings.maxConcurrentOneShots}\" musicDuckingDb=\"${settings.musicDuckingDb}\" musicEqCutDb=\"${settings.musicEqCutDb}\" musicEqFrequencyHz=\"${settings.musicEqFrequencyHz}\" musicEqQ=\"${settings.musicEqQ}\" musicLowCutHz=\"${settings.musicLowCutHz}\" musicHighCutHz=\"${settings.musicHighCutHz}\">`,
  ];
  const byTrack = new Map<string, ShortFormSoundDesignEvent[]>();
  events.forEach((event) => {
    byTrack.set(event.track, [...(byTrack.get(event.track) || []), event]);
  });
  byTrack.forEach((trackEvents, track) => pushTrackLines(lines, track, trackEvents));
  lines.push("</sound_design>");

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
      mixSettings: resolveShortFormSoundDesignMixSettings(),
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
    mixSettings: resolveShortFormSoundDesignMixSettings(content, parseShortFormSoundDesignXml(content)),
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
      type: normalizeEventType(item.type),
      track: normalizeString(item.track, "impacts"),
      startSeconds: clampNumber(item.startSeconds ?? item.resolvedStartSeconds, 0, 10_000, 0, 3),
      endSeconds: typeof item.endSeconds === "number" && Number.isFinite(item.endSeconds) ? clampNumber(item.endSeconds, 0, 10_000, item.endSeconds, 3) : undefined,
      description: normalizeOptionalString(item.description),
      searchQuery: normalizeOptionalString(item.searchQuery),
      category: normalizeOptionalString(item.category),
      priority: item.priority === "must-have" || item.priority === "nice-to-have" || item.priority === "optional" ? item.priority : undefined,
      anchor: normalizeOptionalString(item.anchor),
      sceneId: normalizeOptionalString(item.sceneId),
      captionId: normalizeOptionalString(item.captionId),
      offsetMs: typeof item.offsetMs === "number" && Number.isFinite(item.offsetMs) ? clampNumber(item.offsetMs, -20_000, 20_000, 0, 0) : undefined,
      gainDb: typeof item.gainDb === "number" && Number.isFinite(item.gainDb) ? item.gainDb : undefined,
      fadeInMs: typeof item.fadeInMs === "number" && Number.isFinite(item.fadeInMs) ? item.fadeInMs : undefined,
      fadeOutMs: typeof item.fadeOutMs === "number" && Number.isFinite(item.fadeOutMs) ? item.fadeOutMs : undefined,
      intensity: normalizeOptionalString(item.intensity),
      rationale: normalizeOptionalString(item.rationale),
      notes: normalizeOptionalString(item.notes),
      overlap: normalizeOverlap(item.overlap),
      groupId: normalizeOptionalString(item.groupId),
      frequencyBand: normalizeFrequencyBand(item.frequencyBand),
      layerRole: normalizeOptionalString(item.layerRole),
      stylePalette: normalizeOptionalString(item.stylePalette),
      literalness: normalizeLiteralness(item.literalness),
      musicDuckingDb: clampOptionalNumber(item.musicDuckingDb, -24, 0, 1),
      musicEqCutDb: clampOptionalNumber(item.musicEqCutDb, -18, 0, 1),
      musicEqFrequencyHz: clampOptionalNumber(item.musicEqFrequencyHz, 120, 8000, 0),
      musicEqQ: clampOptionalNumber(item.musicEqQ, 0.1, 10, 2),
      musicLowCutHz: clampOptionalNumber(item.musicLowCutHz, 0, 500, 0),
      musicHighCutHz: clampOptionalNumber(item.musicHighCutHz, 0, 20000, 0),
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
    mixSettings: obj.mixSettings && typeof obj.mixSettings === "object" && !Array.isArray(obj.mixSettings)
      ? {
          defaultDuckingDb: clampNumber((obj.mixSettings as Record<string, unknown>).defaultDuckingDb, -24, 0, -8, 1),
          maxConcurrentOneShots: clampNumber((obj.mixSettings as Record<string, unknown>).maxConcurrentOneShots, 1, 8, 2, 0),
          musicDuckingDb: clampNumber((obj.mixSettings as Record<string, unknown>).musicDuckingDb, -24, 0, -6, 1),
          musicEqCutDb: clampNumber((obj.mixSettings as Record<string, unknown>).musicEqCutDb, -18, 0, -4, 1),
          musicEqFrequencyHz: clampNumber((obj.mixSettings as Record<string, unknown>).musicEqFrequencyHz, 120, 8000, 1800, 0),
          musicEqQ: clampNumber((obj.mixSettings as Record<string, unknown>).musicEqQ, 0.1, 10, 1.1, 2),
          musicLowCutHz: clampNumber((obj.mixSettings as Record<string, unknown>).musicLowCutHz, 0, 500, 60, 0),
          musicHighCutHz: clampNumber((obj.mixSettings as Record<string, unknown>).musicHighCutHz, 0, 20000, 0, 0),
        }
      : undefined,
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
  if (event.assetId && asset.id === event.assetId) score += 100;
  if (isAssetBackedEventType(event.type) && asset.semanticTypes.includes(event.type)) score += 6;
  if (asset.timingType === "bed" && event.type === "ambience") score += 3;
  if (asset.timingType === "riser" && event.type === "riser") score += 3;
  const lowerTrack = event.track.toLowerCase();
  if (asset.category.toLowerCase().includes(lowerTrack)) score += 1;
  if ((event.intensity || "").length > 0 && asset.tags.some((tag) => tag.toLowerCase() === (event.intensity || "").toLowerCase())) score += 1;
  if (event.frequencyBand && asset.frequencyBand === event.frequencyBand) score += 2;
  if (event.layerRole && (asset.layerRoles || []).some((role) => role.toLowerCase() === event.layerRole!.toLowerCase())) score += 2;
  if (event.stylePalette && (asset.stylePalettes || []).some((palette) => palette.toLowerCase() === event.stylePalette!.toLowerCase())) score += 1;
  if (event.literalness && asset.literalness === event.literalness) score += 1;
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
  if (!event.anchor) {
    return Math.max(0, event.startSeconds);
  }

  // Legacy compatibility for old scene/caption-anchored <event /> artifacts. New XML uses absolute timestamps.
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
  return Math.max(0, anchorTime + (event.offsetMs || 0) / 1000);
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

  if (!event.anchor) {
    if (typeof event.endSeconds === "number") return Math.max(start, event.endSeconds);
    if (typeof event.durationSeconds === "number") return start + event.durationSeconds;
    return start + assetDuration;
  }

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

function priorityRank(event: ShortFormResolvedSoundDesignEvent) {
  if (event.priority === "must-have") return 3;
  if (event.priority === "nice-to-have") return 2;
  if (event.priority === "optional") return 0;
  return 1;
}

function oneShotWindow(event: ShortFormResolvedSoundDesignEvent) {
  const start = Math.max(0, event.resolvedStartSeconds);
  const end = typeof event.resolvedEndSeconds === "number"
    ? Math.max(start + 0.01, event.resolvedEndSeconds)
    : start + Math.max(0.05, event.durationSeconds || 0.6);
  return { start, end };
}

function windowsOverlap(left: { start: number; end: number }, right: { start: number; end: number }) {
  return left.start < right.end + 0.001 && left.end > right.start - 0.001;
}

function enforceMaxConcurrentOneShots(
  events: ShortFormResolvedSoundDesignEvent[],
  maxConcurrentOneShots: number,
) {
  const limit = Math.max(1, Math.round(maxConcurrentOneShots));
  const candidates = events
    .filter((event) => event.status === "resolved" && !event.muted && event.timingType !== "bed" && event.assetRelativePath)
    .map((event, index) => ({ event, index, window: oneShotWindow(event) }))
    .sort((left, right) => {
      const priorityDelta = priorityRank(right.event) - priorityRank(left.event);
      if (priorityDelta !== 0) return priorityDelta;
      const gainDelta = right.event.resolvedGainDb - left.event.resolvedGainDb;
      if (gainDelta !== 0) return gainDelta;
      const timeDelta = left.window.start - right.window.start;
      if (timeDelta !== 0) return timeDelta;
      return left.event.id.localeCompare(right.event.id);
    });

  const kept: typeof candidates = [];
  const mutedIds = new Set<string>();
  for (const candidate of candidates) {
    const overlappingKept = kept.filter((keptCandidate) => windowsOverlap(candidate.window, keptCandidate.window));
    if (overlappingKept.length >= limit) {
      mutedIds.add(candidate.event.id);
      continue;
    }
    kept.push(candidate);
  }

  if (mutedIds.size === 0) return events;
  return events.map((event) => {
    if (!mutedIds.has(event.id)) return event;
    const reason = `auto-muted: maxConcurrentOneShots=${limit} would be exceeded by overlapping one-shot cues; lower-ranked event dropped from mix after priority/gain/time ordering`;
    return {
      ...event,
      muted: true,
      resolutionReason: event.resolutionReason ? `${event.resolutionReason}; ${reason}` : reason,
    };
  });
}

export function resolveShortFormSoundDesign(projectId: string, overrides?: ShortFormResolvedSoundDesignEvent[]) {
  const settings = getShortFormSoundDesignSettings();
  const doc = readShortFormSoundDesignDocument(projectId);
  const scenes = getTimelineScenes(projectId);
  const captions = getTimelineCaptions(projectId);
  const duration = getNarrationDuration(projectId);
  const mixSettings = resolveShortFormSoundDesignMixSettings(doc.content, doc.events);
  const existingById = new Map<string, ShortFormResolvedSoundDesignEvent>();
  (overrides || doc.resolution?.events || []).forEach((event) => {
    existingById.set(event.id, event);
  });

  let resolvedEvents: ShortFormResolvedSoundDesignEvent[] = doc.events.map((event) => {
    const prior = existingById.get(event.id);
    if (!isAssetBackedEventType(event.type)) {
      const start = resolveEventTime(projectId, event, scenes, captions);
      return {
        ...event,
        resolvedStartSeconds: start,
        resolvedGainDb: typeof event.gainDb === "number" ? event.gainDb : 0,
        resolvedFadeInMs: typeof event.fadeInMs === "number" ? event.fadeInMs : 0,
        resolvedFadeOutMs: typeof event.fadeOutMs === "number" ? event.fadeOutMs : 0,
        duckingDb: mixSettings.defaultDuckingDb,
        muted: prior?.muted === true,
        solo: prior?.solo === true,
        manualGainDb: prior?.manualGainDb,
        manualNudgeMs: prior?.manualNudgeMs,
        compatibleAssetIds: [],
        status: "resolved",
        resolutionReason: "music-or-mix-control-event",
      } satisfies ShortFormResolvedSoundDesignEvent;
    }
    const compatibleAssets = settings.library
      .filter((asset) => asset.audioRelativePath)
      .map((asset) => ({ asset, score: getAssetCompatibility(event, asset) }))
      .sort((left, right) => right.score - left.score);
    const manualAsset = prior?.manualAssetId ? settings.library.find((asset) => asset.id === prior.manualAssetId) : undefined;
    const requestedAsset = event.assetId ? settings.library.find((asset) => asset.id === event.assetId) : undefined;
    const asset = manualAsset || requestedAsset || compatibleAssets[0]?.asset;
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
    const explicitEnd = typeof event.endSeconds === "number"
      ? Math.max(start, event.endSeconds)
      : typeof event.durationSeconds === "number"
        ? start + event.durationSeconds
        : undefined;
    const end = typeof explicitEnd === "number"
      ? explicitEnd
      : asset && asset.timingType === "bed"
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
      ...(typeof event.durationSeconds === "number" ? { durationSeconds: event.durationSeconds } : typeof assetDuration === "number" ? { durationSeconds: assetDuration } : {}),
      resolvedGainDb: gainDb,
      resolvedFadeInMs: fadeInMs,
      resolvedFadeOutMs: fadeOutMs,
      duckingDb: mixSettings.defaultDuckingDb,
      muted: prior?.muted === true,
      solo: prior?.solo === true,
      manualAssetId: prior?.manualAssetId,
      manualGainDb: prior?.manualGainDb,
      manualNudgeMs: prior?.manualNudgeMs,
      compatibleAssetIds: compatibleAssets.filter((item) => item.score > -4).map((item) => item.asset.id),
      status: asset?.audioRelativePath ? "resolved" : "unresolved",
      resolutionReason: asset?.audioRelativePath
        ? (manualAsset ? "manual-asset-selection" : requestedAsset ? "requested-asset-match" : compatibleAssets[0] ? "semantic-library-match" : "fallback")
        : requestedAsset
          ? `Requested sound asset ${requestedAsset.id} has no uploaded audio file.`
          : "No uploaded sound asset matched this semantic event.",
    } satisfies ShortFormResolvedSoundDesignEvent;
  });

  resolvedEvents = enforceMaxConcurrentOneShots(resolvedEvents, mixSettings.maxConcurrentOneShots);

  const resolution: ShortFormSoundDesignResolution = {
    version: 2,
    generatedAt: new Date().toISOString(),
    previewAudioRelativePath: doc.resolution?.previewAudioRelativePath,
    previewUpdatedAt: doc.resolution?.previewUpdatedAt,
    mixSettings,
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

function dbToVolume(db: number) {
  return Math.pow(10, db / 20);
}

function buildMusicMixFilters(musicVolume: number | undefined, mixSettings: ShortFormSoundDesignMixSettings) {
  const filters = [`volume=${Number.isFinite(musicVolume as number) ? Number(musicVolume).toFixed(3) : "0.160"}`];
  if (mixSettings.musicLowCutHz > 0 && ffmpegSupportsFilter("highpass")) {
    filters.push(`highpass=f=${Math.round(mixSettings.musicLowCutHz)}`);
  }
  if (mixSettings.musicHighCutHz > 0 && ffmpegSupportsFilter("lowpass")) {
    filters.push(`lowpass=f=${Math.round(mixSettings.musicHighCutHz)}`);
  }
  if (mixSettings.musicEqCutDb < 0 && ffmpegSupportsFilter("equalizer")) {
    filters.push(`equalizer=f=${Math.round(mixSettings.musicEqFrequencyHz)}:t=q:w=${mixSettings.musicEqQ.toFixed(2)}:g=${mixSettings.musicEqCutDb.toFixed(1)}`);
  }
  return filters;
}

function buildDuckedBackgroundFilters(inputLabel: string, narrationLabel: string, outputLabel: string, duckingDb: number) {
  if (ffmpegSupportsFilter("sidechaincompress")) {
    const ratio = Math.max(2, Math.min(20, Math.abs(duckingDb) * 1.4));
    return `${inputLabel}${narrationLabel}sidechaincompress=threshold=0.04:ratio=${ratio.toFixed(1)}:attack=15:release=280:makeup=1${outputLabel}`;
  }
  return `${inputLabel}volume=${dbToVolume(duckingDb).toFixed(5)}${outputLabel}`;
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
  const mixSettings = resolution.mixSettings || resolveShortFormSoundDesignMixSettings();
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
  const musicLabels: string[] = [];
  const sfxLabels: string[] = [];
  let inputIndex = 0;

  if (includeNarration) {
    inputArgs.push("-i", narrationPath);
    filterLines.push(`[${inputIndex}:a]volume=1.0[narr]`);
    inputIndex += 1;
  }

  if (includeMusic && musicPath && fs.existsSync(musicPath)) {
    inputArgs.push("-i", musicPath);
    filterLines.push(`[${inputIndex}:a]${buildMusicMixFilters(musicVolume, mixSettings).join(",")}[music]`);
    musicLabels.push("[music]");
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
      sfxLabels.push(`[${label}]`);
      inputIndex += 1;
    }
  }

  const hasNarration = includeNarration;
  const backgroundLabels: string[] = [];
  if (musicLabels.length > 0) {
    const musicLabel = musicLabels[0]!;
    if (hasNarration) {
      filterLines.push(buildDuckedBackgroundFilters(musicLabel, "[narr]", "[duckedmusic]", mixSettings.musicDuckingDb));
      backgroundLabels.push("[duckedmusic]");
    } else {
      backgroundLabels.push(musicLabel);
    }
  }
  if (sfxLabels.length > 0) {
    const sfxLabel = sfxLabels.length > 1 ? "[sfxraw]" : sfxLabels[0]!;
    if (sfxLabels.length > 1) {
      filterLines.push(`${sfxLabels.join("")}amix=inputs=${sfxLabels.length}:normalize=0:dropout_transition=0${sfxLabel}`);
    }
    if (hasNarration) {
      filterLines.push(buildDuckedBackgroundFilters(sfxLabel, "[narr]", "[duckedsfx]", mixSettings.defaultDuckingDb));
      backgroundLabels.push("[duckedsfx]");
    } else {
      backgroundLabels.push(sfxLabel);
    }
  }
  const hasBackground = backgroundLabels.length > 0;
  if (!hasNarration && !hasBackground) {
    throw new Error(onlyTrack
      ? `No resolved sound-design events are available on the ${onlyTrack} track for preview.`
      : "No audio sources are available for this preview mode.");
  }

  let outputLabel = hasNarration ? "[narr]" : backgroundLabels[0] || "";
  if (hasNarration && hasBackground) {
    filterLines.push(`[narr]${backgroundLabels.join("")}amix=inputs=${backgroundLabels.length + 1}:normalize=0:weights='${[1, ...backgroundLabels.map(() => 1)].join(" ")}'[mix]`);
    outputLabel = "[mix]";
  } else if (hasBackground) {
    if (backgroundLabels.length > 1) {
      filterLines.push(`${backgroundLabels.join("")}amix=inputs=${backgroundLabels.length}:normalize=0:dropout_transition=0[bgraw]`);
      outputLabel = "[bgraw]";
    } else {
      outputLabel = backgroundLabels[0]!;
    }
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
