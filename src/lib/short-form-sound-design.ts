import fs from "fs";
import path from "path";
import crypto from "crypto";
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
import {
  getShortFormMotionGraphicsSettings,
  type MotionGraphicDeterministicSoundCue,
  type MotionGraphicTemplateConfig,
} from "@/lib/short-form-motion-graphics";
import { getShortFormMusicLibraryDir, getShortFormVideoRenderSettings } from "@/lib/short-form-video-render-settings";

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

export interface ShortFormSoundDesignMusicSegment {
  id: string;
  trackId?: string;
  startSeconds: number;
  endSeconds?: number;
  durationSeconds?: number;
  gainDb?: number;
  fadeInMs?: number;
  fadeOutMs?: number;
  mood?: string;
  pacing?: string;
  rationale?: string;
}

export interface ShortFormResolvedSoundDesignMusicSegment extends ShortFormSoundDesignMusicSegment {
  musicTrackId?: string;
  musicTrackName?: string;
  musicRelativePath?: string;
  resolvedStartSeconds: number;
  resolvedEndSeconds: number;
  resolvedGainDb: number;
  resolvedFadeInMs: number;
  resolvedFadeOutMs: number;
  status: "resolved" | "unresolved";
  resolutionReason?: string;
}

export interface ShortFormSoundDesignMixSettings {
  defaultDuckingDb: number;
  ambienceDuckingDb: number;
  motionDuckingDb: number;
  transientDuckingDb: number;
  transientBusGainDb: number;
  maxConcurrentOneShots: number;
  musicDuckingDb: number;
  musicDuckingUnderTransientsDb: number;
  musicEqCutDb: number;
  musicEqFrequencyHz: number;
  musicEqQ: number;
  musicLowCutHz: number;
  musicHighCutHz: number;
  outputSampleRate: number;
  outputChannels: number;
  masterLoudnessTargetLufs: number;
  masterTruePeakDb: number;
}

export interface ShortFormSoundDesignQaIssue {
  severity: "warn" | "fail";
  code: string;
  message: string;
}

export interface ShortFormSoundDesignAudioMetrics {
  relativePath?: string;
  durationSeconds?: number;
  sampleRate?: number;
  channels?: number;
  integratedLufs?: number;
  truePeakDb?: number;
  peakDb?: number;
  rmsDb?: number;
}

export interface ShortFormSoundDesignAudibilitySample {
  eventId: string;
  type: ShortFormSoundSemanticType;
  track: string;
  bus: "ambience" | "motion" | "transient" | "music-control";
  startSeconds: number;
  endSeconds: number;
  fullRmsDb?: number;
  noSfxRmsDb?: number;
  sfxOnlyRmsDb?: number;
  diffRmsDb?: number;
  /** Difference between full-mix RMS and no-SFX RMS in the cue window. >= 1.5 dB means the cue actually lifted the mix after final mastering. */
  perceptualDeltaDb?: number;
  audible: boolean;
  /** True when the cue had measurable energy on the SFX bus but did not raise the full mix RMS by >= 1.5 dB after mastering. */
  buriedAfterMastering?: boolean;
}

export interface ShortFormSoundDesignQaReport {
  status: "pass" | "warn" | "fail";
  generatedAt: string;
  previewFresh: boolean;
  finalFresh: boolean;
  finalInputFingerprint?: string;
  finalInputLastChangedAt?: string;
  fullMix?: ShortFormSoundDesignAudioMetrics;
  noSfxMix?: ShortFormSoundDesignAudioMetrics;
  sfxOnlyMix?: ShortFormSoundDesignAudioMetrics;
  /** Music + nothing else (no narration, no SFX). Drives the music-too-quiet QA check. */
  musicOnlyMix?: ShortFormSoundDesignAudioMetrics;
  finalOutput?: ShortFormSoundDesignAudioMetrics;
  fullVsNoSfxCorrelation?: number;
  fullVsNoSfxDiffRmsDb?: number;
  audibleEventPercent?: number;
  audibleEvents?: number;
  measuredEvents?: number;
  buriedEvents?: number;
  transientAudibleEventPercent?: number;
  measuredTransientEvents?: number;
  audibleSamples?: ShortFormSoundDesignAudibilitySample[];
  issues: ShortFormSoundDesignQaIssue[];
}

export interface ShortFormSoundDesignResolution {
  version: number;
  generatedAt: string;
  previewAudioRelativePath?: string;
  previewUpdatedAt?: string;
  mixSettings?: ShortFormSoundDesignMixSettings;
  qa?: ShortFormSoundDesignQaReport;
  musicSegments?: ShortFormResolvedSoundDesignMusicSegment[];
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
  visualType?: "image" | "motion_graphic";
  motionGraphicId?: string;
  motionGraphicTemplateId?: string;
  motionGraphicRendererId?: string;
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
  visualType?: "image" | "motion_graphic";
  motionGraphicId?: string;
}

interface MotionGraphicTimelineSegment {
  id: string;
  number: number;
  label: string;
  start: number;
  end: number;
  motionGraphicId?: string;
  templateId: string;
  rendererId?: string;
  args: Record<string, unknown>;
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

export type ShortFormSoundDesignPreviewMode = "full" | "without-sfx" | "effects-only" | "music-only";

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
  const normalized = typeof value === "string" ? value.trim().toLowerCase() : value;
  if (normalized === "music-ducking" || normalized === "music-duck" || normalized === "ducking" || normalized === "near-silence") return "mix-duck";
  if (normalized === "music-eq" || normalized === "eq-carve") return "mix-eq";
  return normalized === "riser" || normalized === "click" || normalized === "whoosh" || normalized === "ambience" || normalized === "music-riser" || normalized === "music-reverb-tail" || normalized === "mix-duck" || normalized === "mix-eq"
    ? normalized
    : "impact";
}

function isAssetBackedEventType(type: ShortFormSoundSemanticType): type is "impact" | "riser" | "click" | "whoosh" | "ambience" {
  return type === "impact" || type === "riser" || type === "click" || type === "whoosh" || type === "ambience";
}

function classifySoundDesignBus(event: {
  type: ShortFormSoundSemanticType;
  timingType?: ShortFormSoundTimingType;
  layerRole?: string;
}): "ambience" | "motion" | "transient" | "music-control" {
  if (event.type === "ambience" || event.timingType === "bed") return "ambience";
  if (event.type === "riser" || event.type === "whoosh" || (event.layerRole || "").toLowerCase() === "motion") return "motion";
  if (event.type === "impact" || event.type === "click") return "transient";
  return "music-control";
}

function isMeasuredAudibilityEvent(event: ShortFormResolvedSoundDesignEvent) {
  if (event.status !== "resolved" || event.muted || !event.assetRelativePath) return false;
  const bus = classifySoundDesignBus(event);
  return bus === "motion" || bus === "transient";
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

function decodeXmlText(value: string) {
  return value
    .replace(/&quot;/g, "\"")
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

function getTimelineScenes(projectId: string): TimelineScene[] {
  const projectDir = getProjectDir(projectId);
  const scenePath = path.join(projectDir, "scene-images.json");
  const raw = safeReadJson(scenePath);
  const scenes: unknown[] = Array.isArray(raw?.scenes) ? raw.scenes : [];
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
        visualType: obj.visualType === "motion_graphic" ? "motion_graphic" : "image",
        motionGraphicId: normalizeOptionalString(obj.motionGraphicId),
        motionGraphicTemplateId: normalizeOptionalString(obj.motionGraphicTemplateId),
        motionGraphicRendererId: normalizeOptionalString(obj.motionGraphicRendererId),
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
        visualType: attributes.visualType === "motion_graphic" || attributes.type === "motion_graphic" || Boolean(attributes.motionGraphicId || attributes.motionId || attributes.motionGraphic) ? "motion_graphic" : "image",
        motionGraphicId: normalizeOptionalString(attributes.motionGraphicId || attributes.motionId || attributes.motionGraphic),
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

function parseMotionGraphicAssetsFromXml(projectId: string) {
  const xmlScriptPath = path.join(getProjectDir(projectId), "xml-script.md");
  if (!fs.existsSync(xmlScriptPath)) return new Map<string, { id: string; templateId: string; rendererId?: string; args: Record<string, unknown> }>();
  const xml = extractBody(fs.readFileSync(xmlScriptPath, "utf-8"));
  const assetsBody = xml.match(/<assets\b[^>]*>([\s\S]*?)<\/assets>/i)?.[1] || "";
  const assets = new Map<string, { id: string; templateId: string; rendererId?: string; args: Record<string, unknown> }>();
  for (const match of assetsBody.matchAll(/<motionGraphic\b([^>]*)>([\s\S]*?)<\/motionGraphic>/gi)) {
    const attributes = parseAttributes(match[1] || "");
    const id = normalizeOptionalString(attributes.id);
    const templateId = normalizeOptionalString(attributes.templateId || attributes.template || attributes.motionGraphicType);
    if (!id || !templateId) continue;
    const body = match[2] || "";
    const args: Record<string, unknown> = {};
    for (const argMatch of body.matchAll(/<arg\b([^>]*)>([\s\S]*?)<\/arg>/gi)) {
      const argAttrs = parseAttributes(argMatch[1] || "");
      const name = normalizeOptionalString(argAttrs.name);
      if (!name) continue;
      const text = decodeXmlText((argMatch[2] || "").replace(/\s+/g, " ").trim());
      const numeric = Number(text);
      args[name] = text && Number.isFinite(numeric) && /^[-+]?\d+(?:\.\d+)?$/.test(text) ? numeric : text;
    }
    const data = Array.from(body.matchAll(/<item\b([^>]*?)\/?\s*>/gi))
      .map((itemMatch) => {
        const itemAttrs = parseAttributes(itemMatch[1] || "");
        const label = normalizeOptionalString(itemAttrs.label);
        const value = normalizeOptionalString(itemAttrs.value);
        if (!label || !value) return null;
        const numericValue = Number(value);
        return {
          label: decodeXmlText(label),
          value: Number.isFinite(numericValue) ? numericValue : decodeXmlText(value),
          ...(itemAttrs.displayValue ? { displayValue: decodeXmlText(itemAttrs.displayValue) } : {}),
        };
      })
      .filter((item): item is { label: string; value: number | string; displayValue?: string } => Boolean(item));
    if (data.length > 0) args.data = data;
    const steps = Array.from(body.matchAll(/<step\b([^>]*)>([\s\S]*?)<\/step>/gi))
      .map((stepMatch) => {
        const stepAttrs = parseAttributes(stepMatch[1] || "");
        const text = decodeXmlText((stepMatch[2] || "").replace(/\s+/g, " ").trim());
        if (!text) return null;
        const label = normalizeOptionalString(stepAttrs.label || stepAttrs.leftLabel || stepAttrs.marker);
        return label ? { label: decodeXmlText(label), text } : { text };
      })
      .filter((step): step is { label?: string; text: string } => Boolean(step));
    if (steps.length > 0) {
      args.steps = steps;
      args.items = steps;
    }
    const lines = Array.from(body.matchAll(/<(line|blankLine)\b([^>]*)\/?\s*>(?:([\s\S]*?)<\/\1>)?/gi))
      .map((lineMatch) => {
        const tagName = String(lineMatch[1] || "").toLowerCase();
        if (tagName === "blankline") return { blank: true };
        const text = decodeXmlText((lineMatch[3] || "").replace(/\s+/g, " ").trim());
        return text ? { text } : { blank: true };
      });
    if (lines.length > 0) args.lines = lines;
    assets.set(id, {
      id,
      templateId,
      rendererId: normalizeOptionalString(attributes.rendererId),
      args,
    });
  }
  return assets;
}

function readGeneratedMotionGraphicScenes(projectId: string): TimelineScene[] {
  const manifestPath = path.join(getProjectDir(projectId), "scenes", "manifest.json");
  const raw = safeReadJson(manifestPath);
  const scenes: unknown[] = Array.isArray(raw?.scenes) ? raw.scenes : [];
  return scenes
    .map((scene: unknown, index: number): TimelineScene | null => {
      const obj = scene && typeof scene === "object" && !Array.isArray(scene) ? scene as Record<string, unknown> : null;
      if (!obj || obj.visual_type !== "motion_graphic") return null;
      const start = typeof obj.start === "number" && Number.isFinite(obj.start) ? obj.start : undefined;
      const end = typeof obj.end === "number" && Number.isFinite(obj.end) ? obj.end : undefined;
      return {
        id: normalizeString(obj.visual_id, `scene-${index + 1}`),
        number: typeof obj.index === "number" && Number.isFinite(obj.index) ? obj.index : index + 1,
        caption: normalizeString(obj.text, `Motion graphic ${index + 1}`),
        startTime: start,
        endTime: end,
        visualType: "motion_graphic",
        motionGraphicId: normalizeOptionalString(obj.motion_graphic_id),
        motionGraphicTemplateId: normalizeOptionalString(obj.motion_graphic_template_id),
        motionGraphicRendererId: normalizeOptionalString(obj.motion_graphic_renderer_id),
      };
    })
    .filter((scene): scene is TimelineScene => Boolean(scene));
}

function motionGraphicsTemplateMatches(template: MotionGraphicTemplateConfig, templateId?: string, rendererId?: string) {
  const normalizedTemplateId = normalizeKey(templateId);
  const normalizedRendererId = normalizeKey(rendererId);
  return Boolean(
    (normalizedTemplateId && (normalizeKey(template.id) === normalizedTemplateId || normalizeKey(template.rendererId) === normalizedTemplateId))
    || (normalizedRendererId && (normalizeKey(template.rendererId) === normalizedRendererId || normalizeKey(template.id) === normalizedRendererId))
  );
}

function getMotionGraphicTimelineSegments(projectId: string): MotionGraphicTimelineSegment[] {
  const xmlAssets = parseMotionGraphicAssetsFromXml(projectId);
  const xmlVisuals = getTimelineVisuals(projectId).filter((visual) => visual.visualType === "motion_graphic");
  const visualAssetById = new Map(xmlVisuals.map((visual) => [visual.id, visual.motionGraphicId]));
  const scenes = getTimelineScenes(projectId);
  const sourceScenes = scenes.some((scene) => scene.visualType === "motion_graphic")
    ? scenes.filter((scene) => scene.visualType === "motion_graphic")
    : readGeneratedMotionGraphicScenes(projectId);
  return sourceScenes
    .map((scene): MotionGraphicTimelineSegment | null => {
      const motionGraphicId = scene.motionGraphicId || visualAssetById.get(scene.id);
      const asset = motionGraphicId ? xmlAssets.get(motionGraphicId) : undefined;
      const templateId = scene.motionGraphicTemplateId || asset?.templateId;
      const start = typeof scene.startTime === "number" ? scene.startTime : undefined;
      const end = typeof scene.endTime === "number" ? scene.endTime : undefined;
      if (!templateId || typeof start !== "number" || typeof end !== "number" || end <= start) return null;
      return {
        id: scene.id,
        number: scene.number,
        label: scene.caption,
        start,
        end,
        motionGraphicId,
        templateId,
        rendererId: scene.motionGraphicRendererId || asset?.rendererId,
        args: asset?.args || {},
      };
    })
    .filter((segment): segment is MotionGraphicTimelineSegment => Boolean(segment));
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
    ambienceDuckingDb: clampNumber(root.ambienceDuckingDb, -24, 0, settings.ambienceDuckingDb, 1),
    motionDuckingDb: clampNumber(root.motionDuckingDb, -24, 0, settings.motionDuckingDb, 1),
    transientDuckingDb: clampNumber(root.transientDuckingDb, -12, 6, settings.transientDuckingDb, 1),
    transientBusGainDb: clampNumber(root.transientBusGainDb, -12, 12, settings.transientBusGainDb, 1),
    maxConcurrentOneShots: clampNumber(root.maxConcurrentOneShots, 1, 8, settings.maxConcurrentOneShots, 0),
    musicDuckingDb: clampNumber(root.musicDuckingDb, -24, 0, settings.musicDuckingDb, 1),
    musicDuckingUnderTransientsDb: clampNumber(root.musicDuckingUnderTransientsDb, -18, 0, settings.musicDuckingUnderTransientsDb, 1),
    musicEqCutDb: clampNumber(root.musicEqCutDb, -18, 0, settings.musicEqCutDb, 1),
    musicEqFrequencyHz: clampNumber(root.musicEqFrequencyHz, 120, 8000, settings.musicEqFrequencyHz, 0),
    musicEqQ: clampNumber(root.musicEqQ, 0.1, 10, settings.musicEqQ, 2),
    musicLowCutHz: clampNumber(root.musicLowCutHz, 0, 500, settings.musicLowCutHz, 0),
    musicHighCutHz: clampNumber(root.musicHighCutHz, 0, 20000, settings.musicHighCutHz, 0),
    outputSampleRate: clampNumber(root.outputSampleRate, 22050, 192000, settings.outputSampleRate, 0),
    outputChannels: clampNumber(root.outputChannels, 1, 8, settings.outputChannels, 0),
    masterLoudnessTargetLufs: clampNumber(root.masterLoudnessTargetLufs, -24, -8, settings.masterLoudnessTargetLufs, 1),
    masterTruePeakDb: clampNumber(root.masterTruePeakDb, -6, -0.1, settings.masterTruePeakDb, 1),
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

function parseMusicSegmentNode(nodeSource: string, index: number): ShortFormSoundDesignMusicSegment {
  const attributes = parseAttributes(nodeSource);
  const startSeconds = clampNumber(attributes.start ?? attributes.startSeconds, 0, 10_000, 0, 3);
  const endSeconds = clampOptionalNumber(attributes.end ?? attributes.endSeconds, 0, 10_000, 3);
  const durationSeconds = clampOptionalNumber(attributes.duration ?? attributes.durationSeconds, 0.01, 10_000, 3);
  return {
    id: normalizeString(attributes.id, `music-segment-${index + 1}`),
    trackId: normalizeOptionalString(attributes.trackId || attributes.musicTrackId || attributes.assetId),
    startSeconds,
    ...(typeof endSeconds === "number" ? { endSeconds: Math.max(startSeconds, endSeconds) } : {}),
    ...(typeof durationSeconds === "number" ? { durationSeconds } : {}),
    gainDb: clampOptionalNumber(attributes.gainDb, -36, 12, 1),
    fadeInMs: clampOptionalNumber(attributes.fadeInMs, 0, 10_000, 0),
    fadeOutMs: clampOptionalNumber(attributes.fadeOutMs, 0, 10_000, 0),
    mood: normalizeOptionalString(attributes.mood),
    pacing: normalizeOptionalString(attributes.pacing),
    rationale: normalizeOptionalString(attributes.rationale || attributes.notes),
  };
}

export function parseShortFormSoundDesignMusicSegments(content: string): ShortFormSoundDesignMusicSegment[] {
  const xml = extractBody(content);
  const matches: string[] = [];

  // Keep generic <segment /> parsing scoped to explicit music containers so future
  // timeline/scene segment tags cannot accidentally become soundtrack cues.
  const musicSegmentBlocks = xml.match(/<music_segments\b[^>]*>[\s\S]*?<\/music_segments>/g) || [];
  for (const block of musicSegmentBlocks) {
    matches.push(...(block.match(/<segment\b[^>]*\/>/g) || []));
  }

  // Backward-compatible direct music cue forms.
  matches.push(...(xml.match(/<music_segment\b[^>]*\/>/g) || []));
  matches.push(...(xml.match(/<music\b(?!_segments\b)[^>]*\/>/g) || []));

  // Also accept <music> containers with nested <segment /> cues.
  const musicBlocks = xml.match(/<music\b(?!_segments\b)[^>]*>[\s\S]*?<\/music>/g) || [];
  for (const block of musicBlocks) {
    matches.push(...(block.match(/<segment\b[^>]*\/>/g) || []));
  }

  const seen = new Set<string>();
  return matches
    .map((match, index) => parseMusicSegmentNode(match, index))
    .filter((segment) => {
      const key = `${segment.id}:${segment.startSeconds}:${segment.trackId || ""}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
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
    "<sound_design version=\"2\" duckingDb=\"-8\" ambienceDuckingDb=\"-8\" motionDuckingDb=\"-3\" transientDuckingDb=\"0\" transientBusGainDb=\"3\" maxConcurrentOneShots=\"2\" musicDuckingDb=\"-6\" musicEqCutDb=\"-4\" musicEqFrequencyHz=\"1800\" musicEqQ=\"1.1\" musicLowCutHz=\"60\" musicHighCutHz=\"0\" outputSampleRate=\"48000\" outputChannels=\"2\" masterLoudnessTargetLufs=\"-15\" masterTruePeakDb=\"-1.5\">",
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
  const scenes = getTimelineScenes(projectId);
  const visuals = getTimelineVisuals(projectId);
  const captions = getTimelineCaptions(projectId);
  const duration = getNarrationDuration(projectId);
  const hasSemantic = (semanticType: "impact" | "riser" | "click" | "whoosh" | "ambience") => settings.library.some((entry) => entry.semanticTypes.includes(semanticType));
  const events: ShortFormSoundDesignEvent[] = [];
  const firstVisual = visuals[0];
  const beatScenes = scenes.length > 0 ? scenes : visuals.map((visual, index) => ({
    id: visual.id,
    number: index + 1,
    caption: visual.label,
    startTime: visual.start,
    endTime: visual.end,
  }));

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

  beatScenes.slice(1, Math.min(beatScenes.length, 12)).forEach((visual, index) => {
    const sceneStart = typeof visual.startTime === "number" ? visual.startTime : 0;
    const sceneEnd = typeof visual.endTime === "number" ? visual.endTime : sceneStart + 1.2;
    const sceneDuration = Math.max(0.2, sceneEnd - sceneStart);
    events.push({
      id: `fx-transition-${index + 1}`,
      type: hasSemantic("whoosh") ? "whoosh" : "riser",
      track: "transitions",
      startSeconds: Math.max(0, sceneStart - 0.08),
      durationSeconds: Math.min(0.9, Math.max(0.3, sceneDuration * 0.65)),
      gainDb: -8,
      fadeInMs: 20,
      fadeOutMs: 180,
      intensity: index === 0 ? "medium" : "low",
      description: `Transition into ${visual.caption}`,
      searchQuery: "clean editorial transition whoosh riser",
      rationale: `Carry momentum into the visual beat at ${sceneStart.toFixed(2)}s (${visual.caption}).`,
      overlap: "avoid",
      groupId: `transition-${index + 1}-layered`,
      frequencyBand: index === 0 ? "mid" : "high",
      layerRole: index === 0 ? "motion" : "air",
      stylePalette: "premium editorial",
      literalness: "stylized",
      priority: "nice-to-have",
    });
    if (hasSemantic("click")) {
      events.push({
        id: `fx-cut-click-${index + 1}`,
        type: "click",
        track: "details",
        startSeconds: Math.max(0, sceneStart + Math.min(0.08, sceneDuration * 0.12)),
        durationSeconds: 0.18,
        gainDb: -6,
        fadeInMs: 0,
        fadeOutMs: 90,
        intensity: "low",
        description: `Scene-cut punctuation for ${visual.caption}`,
        searchQuery: "punchy editorial ui tick click",
        rationale: `Lock a transient accent to the cut into scene ${visual.number}.`,
        overlap: "avoid",
        groupId: `transition-${index + 1}-layered`,
        frequencyBand: "high",
        layerRole: "tick",
        stylePalette: "premium editorial",
        literalness: "stylized",
        priority: "must-have",
      });
    }
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
    `<sound_design version=\"2\" duckingDb=\"${settings.defaultDuckingDb}\" ambienceDuckingDb=\"${settings.ambienceDuckingDb}\" motionDuckingDb=\"${settings.motionDuckingDb}\" transientDuckingDb=\"${settings.transientDuckingDb}\" transientBusGainDb=\"${settings.transientBusGainDb}\" maxConcurrentOneShots=\"${settings.maxConcurrentOneShots}\" musicDuckingDb=\"${settings.musicDuckingDb}\" musicEqCutDb=\"${settings.musicEqCutDb}\" musicEqFrequencyHz=\"${settings.musicEqFrequencyHz}\" musicEqQ=\"${settings.musicEqQ}\" musicLowCutHz=\"${settings.musicLowCutHz}\" musicHighCutHz=\"${settings.musicHighCutHz}\" outputSampleRate=\"${settings.outputSampleRate}\" outputChannels=\"${settings.outputChannels}\" masterLoudnessTargetLufs=\"${settings.masterLoudnessTargetLufs}\" masterTruePeakDb=\"${settings.masterTruePeakDb}\">`,
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

function normalizeResolvedMusicSegment(item: unknown, index: number): ShortFormResolvedSoundDesignMusicSegment {
  const obj = item && typeof item === "object" && !Array.isArray(item) ? item as Record<string, unknown> : {};
  const start = clampNumber(obj.startSeconds ?? obj.resolvedStartSeconds, 0, 10_000, 0, 3);
  const end = typeof obj.resolvedEndSeconds === "number" && Number.isFinite(obj.resolvedEndSeconds)
    ? clampNumber(obj.resolvedEndSeconds, 0, 10_000, obj.resolvedEndSeconds, 3)
    : typeof obj.endSeconds === "number" && Number.isFinite(obj.endSeconds)
      ? clampNumber(obj.endSeconds, 0, 10_000, obj.endSeconds, 3)
      : start + Math.max(0.05, clampNumber(obj.durationSeconds, 0.05, 10_000, 12, 3));
  return {
    id: normalizeString(obj.id, `music-segment-${index + 1}`),
    trackId: normalizeOptionalString(obj.trackId),
    musicTrackId: normalizeOptionalString(obj.musicTrackId || obj.trackId),
    musicTrackName: normalizeOptionalString(obj.musicTrackName),
    musicRelativePath: normalizeOptionalString(obj.musicRelativePath),
    startSeconds: start,
    endSeconds: typeof obj.endSeconds === "number" ? clampNumber(obj.endSeconds, 0, 10_000, end, 3) : undefined,
    durationSeconds: typeof obj.durationSeconds === "number" ? clampNumber(obj.durationSeconds, 0.05, 10_000, obj.durationSeconds, 3) : undefined,
    gainDb: typeof obj.gainDb === "number" ? clampNumber(obj.gainDb, -36, 12, obj.gainDb, 1) : undefined,
    fadeInMs: typeof obj.fadeInMs === "number" ? clampNumber(obj.fadeInMs, 0, 10_000, obj.fadeInMs, 0) : undefined,
    fadeOutMs: typeof obj.fadeOutMs === "number" ? clampNumber(obj.fadeOutMs, 0, 10_000, obj.fadeOutMs, 0) : undefined,
    mood: normalizeOptionalString(obj.mood),
    pacing: normalizeOptionalString(obj.pacing),
    rationale: normalizeOptionalString(obj.rationale),
    resolvedStartSeconds: start,
    resolvedEndSeconds: Math.max(start + 0.05, end),
    resolvedGainDb: clampNumber(obj.resolvedGainDb ?? obj.gainDb, -36, 12, 0, 1),
    resolvedFadeInMs: clampNumber(obj.resolvedFadeInMs ?? obj.fadeInMs, 0, 10_000, 500, 0),
    resolvedFadeOutMs: clampNumber(obj.resolvedFadeOutMs ?? obj.fadeOutMs, 0, 10_000, 700, 0),
    status: obj.status === "resolved" ? "resolved" : "unresolved",
    resolutionReason: normalizeOptionalString(obj.resolutionReason),
  };
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
          ambienceDuckingDb: clampNumber((obj.mixSettings as Record<string, unknown>).ambienceDuckingDb, -24, 0, clampNumber((obj.mixSettings as Record<string, unknown>).defaultDuckingDb, -24, 0, -8, 1), 1),
          motionDuckingDb: clampNumber((obj.mixSettings as Record<string, unknown>).motionDuckingDb, -24, 0, -3, 1),
          transientDuckingDb: clampNumber((obj.mixSettings as Record<string, unknown>).transientDuckingDb, -12, 6, 0, 1),
          transientBusGainDb: clampNumber((obj.mixSettings as Record<string, unknown>).transientBusGainDb, -12, 12, 3, 1),
          maxConcurrentOneShots: clampNumber((obj.mixSettings as Record<string, unknown>).maxConcurrentOneShots, 1, 8, 2, 0),
          musicDuckingDb: clampNumber((obj.mixSettings as Record<string, unknown>).musicDuckingDb, -24, 0, -6, 1),
          musicDuckingUnderTransientsDb: clampNumber((obj.mixSettings as Record<string, unknown>).musicDuckingUnderTransientsDb, -18, 0, -2, 1),
          musicEqCutDb: clampNumber((obj.mixSettings as Record<string, unknown>).musicEqCutDb, -18, 0, -4, 1),
          musicEqFrequencyHz: clampNumber((obj.mixSettings as Record<string, unknown>).musicEqFrequencyHz, 120, 8000, 1800, 0),
          musicEqQ: clampNumber((obj.mixSettings as Record<string, unknown>).musicEqQ, 0.1, 10, 1.1, 2),
          musicLowCutHz: clampNumber((obj.mixSettings as Record<string, unknown>).musicLowCutHz, 0, 500, 60, 0),
          musicHighCutHz: clampNumber((obj.mixSettings as Record<string, unknown>).musicHighCutHz, 0, 20000, 0, 0),
          outputSampleRate: clampNumber((obj.mixSettings as Record<string, unknown>).outputSampleRate, 22050, 192000, 48000, 0),
          outputChannels: clampNumber((obj.mixSettings as Record<string, unknown>).outputChannels, 1, 8, 2, 0),
          masterLoudnessTargetLufs: clampNumber((obj.mixSettings as Record<string, unknown>).masterLoudnessTargetLufs, -24, -8, -16, 1),
          masterTruePeakDb: clampNumber((obj.mixSettings as Record<string, unknown>).masterTruePeakDb, -6, -0.1, -1.5, 1),
        }
      : undefined,
    qa: obj.qa && typeof obj.qa === "object" && !Array.isArray(obj.qa)
      ? {
          status: (obj.qa as Record<string, unknown>).status === "fail" || (obj.qa as Record<string, unknown>).status === "warn" ? (obj.qa as Record<string, unknown>).status as "fail" | "warn" : "pass",
          generatedAt: normalizeString((obj.qa as Record<string, unknown>).generatedAt, new Date().toISOString()),
          previewFresh: (obj.qa as Record<string, unknown>).previewFresh === true,
          finalFresh: (obj.qa as Record<string, unknown>).finalFresh === true,
          finalInputFingerprint: normalizeOptionalString((obj.qa as Record<string, unknown>).finalInputFingerprint),
          finalInputLastChangedAt: normalizeOptionalString((obj.qa as Record<string, unknown>).finalInputLastChangedAt),
          fullMix: ((obj.qa as Record<string, unknown>).fullMix as ShortFormSoundDesignAudioMetrics | undefined),
          noSfxMix: ((obj.qa as Record<string, unknown>).noSfxMix as ShortFormSoundDesignAudioMetrics | undefined),
          sfxOnlyMix: ((obj.qa as Record<string, unknown>).sfxOnlyMix as ShortFormSoundDesignAudioMetrics | undefined),
          musicOnlyMix: ((obj.qa as Record<string, unknown>).musicOnlyMix as ShortFormSoundDesignAudioMetrics | undefined),
          finalOutput: ((obj.qa as Record<string, unknown>).finalOutput as ShortFormSoundDesignAudioMetrics | undefined),
          fullVsNoSfxCorrelation: clampOptionalNumber((obj.qa as Record<string, unknown>).fullVsNoSfxCorrelation, -1, 1, 4),
          fullVsNoSfxDiffRmsDb: clampOptionalNumber((obj.qa as Record<string, unknown>).fullVsNoSfxDiffRmsDb, -120, 12, 1),
          audibleEventPercent: clampOptionalNumber((obj.qa as Record<string, unknown>).audibleEventPercent, 0, 100, 1),
          audibleEvents: clampOptionalNumber((obj.qa as Record<string, unknown>).audibleEvents, 0, 10000, 0),
          measuredEvents: clampOptionalNumber((obj.qa as Record<string, unknown>).measuredEvents, 0, 10000, 0),
          buriedEvents: clampOptionalNumber((obj.qa as Record<string, unknown>).buriedEvents, 0, 10000, 0),
          transientAudibleEventPercent: clampOptionalNumber((obj.qa as Record<string, unknown>).transientAudibleEventPercent, 0, 100, 1),
          measuredTransientEvents: clampOptionalNumber((obj.qa as Record<string, unknown>).measuredTransientEvents, 0, 10000, 0),
          audibleSamples: Array.isArray((obj.qa as Record<string, unknown>).audibleSamples)
            ? ((obj.qa as Record<string, unknown>).audibleSamples as ShortFormSoundDesignAudibilitySample[])
            : undefined,
          issues: Array.isArray((obj.qa as Record<string, unknown>).issues)
            ? ((obj.qa as Record<string, unknown>).issues as ShortFormSoundDesignQaIssue[])
            : [],
        }
      : undefined,
    musicSegments: Array.isArray(obj.musicSegments)
      ? obj.musicSegments.map((segment, index) => normalizeResolvedMusicSegment(segment, index))
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

const AUDIBILITY_AUTO_FIX_CODES = new Set([
  "sfx-correlation-too-high",
  "sfx-bus-too-quiet-vs-noSfx",
  "sfx-bus-quiet-vs-noSfx",
  "audible-event-coverage-low",
  "audible-event-coverage-moderate",
  "transient-punch-low",
  "sfx-bus-too-quiet",
  "events-buried-after-mastering",
  "music-too-quiet",
  "music-bus-near-silent",
]);

function clampAutoFixGain(value: number, maxGainDb: number) {
  return Math.round(Math.min(maxGainDb, Math.max(-36, value)) * 2) / 2;
}

function getAutoFixEventBoostDb(resolution: ShortFormSoundDesignResolution) {
  const qa = resolution.qa;
  const diffBoost = typeof qa?.fullVsNoSfxDiffRmsDb === "number"
    ? Math.max(0, -25 - qa.fullVsNoSfxDiffRmsDb)
    : 0;
  const busBoost = typeof qa?.sfxOnlyMix?.integratedLufs === "number"
    ? Math.max(0, -20 - qa.sfxOnlyMix.integratedLufs)
    : 0;
  const coverageBoost = typeof qa?.audibleEventPercent === "number" && qa.audibleEventPercent < 78 ? 4 : 0;
  return Math.min(8, Math.max(3, diffBoost, busBoost, coverageBoost));
}

export function hasAutoFixableSoundDesignQaFailure(resolution?: ShortFormSoundDesignResolution) {
  const issues = resolution?.qa?.issues || [];
  return issues.some((issue) => AUDIBILITY_AUTO_FIX_CODES.has(issue.code));
}

export function autoFixShortFormSoundDesignAudibility(projectId: string) {
  const resolution = readShortFormSoundDesignResolution(projectId) || resolveShortFormSoundDesign(projectId);
  if (!hasAutoFixableSoundDesignQaFailure(resolution)) {
    throw new Error("No auto-fixable sound-design QA failures were found.");
  }

  const eventBoostDb = getAutoFixEventBoostDb(resolution);
  let boostedEvents = 0;
  let boostedMusicSegments = 0;
  const nextEvents = resolution.events.map((event) => {
    if (event.status !== "resolved" || event.muted || !event.assetRelativePath || !isMeasuredAudibilityEvent(event)) {
      return event;
    }
    const bus = classifySoundDesignBus(event);
    const currentGain = typeof event.manualGainDb === "number" ? event.manualGainDb : event.resolvedGainDb;
    const boost = bus === "ambience" ? Math.min(3, eventBoostDb) : eventBoostDb;
    const maxGainDb = bus === "ambience" ? -16 : bus === "motion" ? -4 : -3;
    const manualGainDb = clampAutoFixGain(currentGain + boost, maxGainDb);
    if (manualGainDb <= currentGain) return event;
    boostedEvents += 1;
    return {
      ...event,
      manualGainDb,
      resolvedGainDb: manualGainDb,
    };
  });

  const nextMusicSegments = (resolution.musicSegments || []).map((segment) => {
    if (segment.status !== "resolved" || !segment.musicRelativePath) return segment;
    const currentGain = segment.resolvedGainDb;
    const resolvedGainDb = clampAutoFixGain(currentGain + Math.min(5, eventBoostDb), -10);
    if (resolvedGainDb <= currentGain) return segment;
    boostedMusicSegments += 1;
    return {
      ...segment,
      gainDb: resolvedGainDb,
      resolvedGainDb,
    };
  });

  if (boostedEvents === 0 && boostedMusicSegments === 0) {
    throw new Error("Sound-design gains are already at the safe auto-fix ceiling.");
  }

  const updated: ShortFormSoundDesignResolution = {
    ...resolution,
    generatedAt: new Date().toISOString(),
    qa: undefined,
    events: nextEvents,
    ...(nextMusicSegments.length > 0 ? { musicSegments: nextMusicSegments } : {}),
  };
  writeShortFormSoundDesignResolution(projectId, updated);
  return {
    resolution: updated,
    changedEventCount: boostedEvents,
    changedMusicSegmentCount: boostedMusicSegments,
    boostDb: Math.round(eventBoostDb * 10) / 10,
  };
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

function stableHash(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash >>> 0);
}

function selectCompatibleAsset(
  event: ShortFormSoundDesignEvent,
  compatibleAssets: Array<{ asset: ShortFormSoundLibraryEntry; score: number }>,
) {
  if (compatibleAssets.length === 0) return undefined;
  const topScore = compatibleAssets[0]!.score;
  const eventType = event.type;
  const semanticCandidates = isAssetBackedEventType(eventType)
    ? compatibleAssets.filter((item) => item.asset.semanticTypes.includes(eventType) && item.score >= topScore - 3)
    : [];
  const candidates = semanticCandidates.length >= 2
    ? semanticCandidates
    : compatibleAssets.filter((item) => item.score >= topScore - 2);
  const pool = candidates.length > 0 ? candidates : compatibleAssets;
  return pool[stableHash(`${event.type}:${event.id}:${event.startSeconds}:${event.frequencyBand || ""}:${event.layerRole || ""}`) % pool.length]?.asset;
}

function slugifySoundCueId(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "cue";
}

function deterministicCueRepeatCount(cue: MotionGraphicDeterministicSoundCue, args: Record<string, unknown>) {
  if (!cue.repeat) return 1;
  const value = args[cue.repeat.source];
  const count = Array.isArray(value) ? value.filter((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return true;
    return (item as { blank?: unknown }).blank !== true;
  }).length : 0;
  return Math.max(1, Math.min(cue.repeat.maxCount, count || 1));
}

function deterministicCueOffset(cue: MotionGraphicDeterministicSoundCue, index: number, duration: number) {
  if (cue.repeat) return cue.repeat.firstOffsetSeconds + index * cue.repeat.stepSeconds;
  if (typeof cue.offsetSeconds === "number") return cue.offsetSeconds;
  if (typeof cue.offsetRatio === "number") return duration * cue.offsetRatio;
  return Math.min(0.5, duration * 0.25);
}

function defaultDeterministicCueGain(type: ShortFormSoundSemanticType) {
  if (type === "impact") return -10;
  if (type === "whoosh" || type === "riser") return -12;
  return -11;
}

function buildDeterministicMotionGraphicSoundEvents(projectId: string): ShortFormSoundDesignEvent[] {
  const settings = getShortFormMotionGraphicsSettings();
  const segments = getMotionGraphicTimelineSegments(projectId);
  if (segments.length === 0) return [];
  const events: ShortFormSoundDesignEvent[] = [];
  for (const segment of segments) {
    const template = settings.templates.find((candidate) =>
      motionGraphicsTemplateMatches(candidate, segment.templateId, segment.rendererId)
    );
    const cues = template?.deterministicSoundEffects || [];
    if (!template || cues.length === 0) continue;
    const duration = Math.max(0, segment.end - segment.start);
    if (duration < 0.5) continue;
    const safeStart = segment.start + Math.min(0.18, duration * 0.25);
    const safeEnd = segment.end - Math.min(0.18, duration * 0.25);
    for (const cue of cues) {
      const repeatCount = deterministicCueRepeatCount(cue, segment.args);
      for (let index = 0; index < repeatCount; index += 1) {
        const offset = deterministicCueOffset(cue, index, duration);
        const startSeconds = segment.start + offset;
        if (startSeconds < safeStart || startSeconds > safeEnd) continue;
        const idParts = [
          "det-mg",
          String(segment.number).padStart(2, "0"),
          slugifySoundCueId(segment.motionGraphicId || segment.id),
          slugifySoundCueId(template.id),
          slugifySoundCueId(cue.id),
          repeatCount > 1 ? String(index + 1) : "",
        ].filter(Boolean);
        events.push({
          id: idParts.join("-"),
          type: cue.type,
          track: cue.track || "motion-graphics",
          startSeconds: Math.round(startSeconds * 1000) / 1000,
          durationSeconds: cue.durationSeconds || (cue.type === "whoosh" || cue.type === "riser" ? 0.42 : 0.16),
          gainDb: typeof cue.gainDb === "number" ? cue.gainDb : defaultDeterministicCueGain(cue.type),
          fadeInMs: typeof cue.fadeInMs === "number" ? cue.fadeInMs : cue.type === "whoosh" || cue.type === "riser" ? 20 : 0,
          fadeOutMs: typeof cue.fadeOutMs === "number" ? cue.fadeOutMs : cue.type === "whoosh" || cue.type === "riser" ? 180 : 90,
          description: cue.description,
          searchQuery: cue.searchQuery,
          category: "Motion Graphic",
          priority: cue.priority || "nice-to-have",
          rationale: `Deterministic internal motion-graphic cue for ${template.displayName}: ${cue.description}. Generated from known template timing, not Scribe planning.`,
          notes: "deterministic-motion-graphic-internal-sfx",
          overlap: "avoid",
          groupId: `motion-graphic-${segment.number}-${template.id}`,
          frequencyBand: cue.frequencyBand,
          layerRole: cue.layerRole || (cue.type === "whoosh" || cue.type === "riser" ? "motion" : "tick"),
          stylePalette: "premium editorial",
          literalness: cue.literalness || "stylized",
        });
      }
    }
  }
  return events;
}

function buildDeterministicMotionGraphicPreviewSoundEvents(options: {
  template: Pick<MotionGraphicTemplateConfig, "id" | "displayName" | "defaultArgs" | "deterministicSoundEffects">;
  durationSeconds: number;
  args?: Record<string, unknown>;
}): ShortFormSoundDesignEvent[] {
  const { template } = options;
  const cues = template.deterministicSoundEffects || [];
  const duration = Math.max(0, options.durationSeconds);
  if (cues.length === 0 || duration < 0.5) return [];

  const args = options.args || template.defaultArgs || {};
  const events: ShortFormSoundDesignEvent[] = [];
  const safeStart = Math.min(0.18, duration * 0.25);
  const safeEnd = duration - Math.min(0.18, duration * 0.25);
  for (const cue of cues) {
    const repeatCount = deterministicCueRepeatCount(cue, args);
    for (let index = 0; index < repeatCount; index += 1) {
      const startSeconds = deterministicCueOffset(cue, index, duration);
      if (startSeconds < safeStart || startSeconds > safeEnd) continue;
      const idParts = [
        "det-mg-preview",
        slugifySoundCueId(template.id),
        slugifySoundCueId(cue.id),
        repeatCount > 1 ? String(index + 1) : "",
      ].filter(Boolean);
      events.push({
        id: idParts.join("-"),
        type: cue.type,
        track: cue.track || "motion-graphics",
        startSeconds: Math.round(startSeconds * 1000) / 1000,
        durationSeconds: cue.durationSeconds || (cue.type === "whoosh" || cue.type === "riser" ? 0.42 : 0.16),
        gainDb: typeof cue.gainDb === "number" ? cue.gainDb : defaultDeterministicCueGain(cue.type),
        fadeInMs: typeof cue.fadeInMs === "number" ? cue.fadeInMs : cue.type === "whoosh" || cue.type === "riser" ? 20 : 0,
        fadeOutMs: typeof cue.fadeOutMs === "number" ? cue.fadeOutMs : cue.type === "whoosh" || cue.type === "riser" ? 180 : 90,
        description: cue.description,
        searchQuery: cue.searchQuery,
        category: "Motion Graphic",
        priority: cue.priority || "nice-to-have",
        rationale: `Deterministic internal motion-graphic preview cue for ${template.displayName}: ${cue.description}. Generated from known template timing, not Scribe planning.`,
        notes: "deterministic-motion-graphic-preview-internal-sfx",
        overlap: "avoid",
        groupId: `motion-graphic-preview-${template.id}`,
        frequencyBand: cue.frequencyBand,
        layerRole: cue.layerRole || (cue.type === "whoosh" || cue.type === "riser" ? "motion" : "tick"),
        stylePalette: "premium editorial",
        literalness: cue.literalness || "stylized",
      });
    }
  }
  return events;
}

function mergePlannedAndDeterministicSoundEvents(
  plannedEvents: ShortFormSoundDesignEvent[],
  deterministicEvents: ShortFormSoundDesignEvent[],
) {
  if (deterministicEvents.length === 0) return plannedEvents;
  const plannedIds = new Set(plannedEvents.map((event) => event.id));
  return [
    ...plannedEvents,
    ...deterministicEvents.filter((event) => !plannedIds.has(event.id)),
  ];
}

function resolveShortFormSoundDesignMusicSegments(content: string): ShortFormResolvedSoundDesignMusicSegment[] {
  const plannedSegments = parseShortFormSoundDesignMusicSegments(content);
  if (plannedSegments.length === 0) return [];
  const settings = getShortFormVideoRenderSettings();
  const musicTracks = settings.musicTracks;
  const defaultTrack = settings.defaultMusicTrackId
    ? musicTracks.find((track) => track.id === settings.defaultMusicTrackId)
    : undefined;
  const fallbackTrack = defaultTrack || musicTracks[0];
  return plannedSegments.map((segment, index) => {
    const track = segment.trackId
      ? musicTracks.find((candidate) => candidate.id === segment.trackId || candidate.name.toLowerCase() === segment.trackId!.toLowerCase())
      : fallbackTrack;
    const sourceDuration = typeof track?.generatedDurationSeconds === "number" && track.generatedDurationSeconds > 0
      ? track.generatedDurationSeconds
      : track?.previewDurationSeconds || 12;
    const end = typeof segment.endSeconds === "number"
      ? Math.max(segment.startSeconds + 0.05, segment.endSeconds)
      : segment.startSeconds + Math.max(0.05, segment.durationSeconds || sourceDuration || 12);
    return {
      ...segment,
      musicTrackId: track?.id,
      musicTrackName: track?.name,
      musicRelativePath: track?.generatedAudioRelativePath,
      resolvedStartSeconds: segment.startSeconds,
      resolvedEndSeconds: end,
      resolvedGainDb: typeof segment.gainDb === "number" ? segment.gainDb : 0,
      resolvedFadeInMs: typeof segment.fadeInMs === "number" ? segment.fadeInMs : index === 0 ? 350 : 700,
      resolvedFadeOutMs: typeof segment.fadeOutMs === "number" ? segment.fadeOutMs : 900,
      status: track?.generatedAudioRelativePath ? "resolved" : "unresolved",
      resolutionReason: track?.generatedAudioRelativePath
        ? "saved-music-segment-match"
        : track
          ? `Music track ${track.id} has no generated audio file.`
          : "No saved music track matched this segment.",
    } satisfies ShortFormResolvedSoundDesignMusicSegment;
  });
}

export function resolveShortFormSoundDesign(projectId: string, overrides?: ShortFormResolvedSoundDesignEvent[]) {
  const settings = getShortFormSoundDesignSettings();
  const doc = readShortFormSoundDesignDocument(projectId);
  const scenes = getTimelineScenes(projectId);
  const captions = getTimelineCaptions(projectId);
  const duration = getNarrationDuration(projectId);
  const deterministicEvents = buildDeterministicMotionGraphicSoundEvents(projectId);
  const events = mergePlannedAndDeterministicSoundEvents(doc.events, deterministicEvents);
  const mixSettings = resolveShortFormSoundDesignMixSettings(doc.content, events);
  const existingById = new Map<string, ShortFormResolvedSoundDesignEvent>();
  (overrides || doc.resolution?.events || []).forEach((event) => {
    existingById.set(event.id, event);
  });

  let resolvedEvents: ShortFormResolvedSoundDesignEvent[] = events.map((event) => {
    const prior = existingById.get(event.id);
    if (!isAssetBackedEventType(event.type)) {
      const start = resolveEventTime(projectId, event, scenes, captions);
      return {
        ...event,
        resolvedStartSeconds: start,
        resolvedGainDb: typeof event.gainDb === "number" ? event.gainDb : 0,
        resolvedFadeInMs: typeof event.fadeInMs === "number" ? event.fadeInMs : 0,
        resolvedFadeOutMs: typeof event.fadeOutMs === "number" ? event.fadeOutMs : 0,
        duckingDb: mixSettings.musicDuckingDb,
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
    const asset = manualAsset || requestedAsset || selectCompatibleAsset(event, compatibleAssets);
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

    const bus = classifySoundDesignBus({ ...event, timingType: asset?.timingType });
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
      duckingDb: bus === "ambience"
        ? mixSettings.ambienceDuckingDb
        : bus === "motion"
          ? mixSettings.motionDuckingDb
          : mixSettings.transientDuckingDb,
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
  const resolvedMusicSegments = resolveShortFormSoundDesignMusicSegments(doc.content);

  const resolution: ShortFormSoundDesignResolution = {
    version: 2,
    generatedAt: new Date().toISOString(),
    previewAudioRelativePath: doc.resolution?.previewAudioRelativePath,
    previewUpdatedAt: doc.resolution?.previewUpdatedAt,
    mixSettings,
    qa: undefined,
    ...(resolvedMusicSegments.length > 0 ? { musicSegments: resolvedMusicSegments } : {}),
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

function getAudioFileMetrics(filePath: string): ShortFormSoundDesignAudioMetrics {
  if (!fs.existsSync(filePath)) return {};
  const probe = spawnSync("ffprobe", [
    "-v",
    "error",
    "-select_streams",
    "a:0",
    "-show_entries",
    "stream=sample_rate,channels",
    "-show_entries",
    "format=duration",
    "-of",
    "json",
    filePath,
  ], { encoding: "utf-8" });
  const metrics: ShortFormSoundDesignAudioMetrics = {};
  try {
    const parsed = JSON.parse(probe.stdout || "{}") as {
      streams?: Array<{ sample_rate?: string; channels?: number }>;
      format?: { duration?: string };
    };
    const stream = Array.isArray(parsed.streams) ? parsed.streams[0] : undefined;
    const sampleRate = Number(stream?.sample_rate || "");
    const channels = Number(stream?.channels || "");
    const durationSeconds = Number(parsed.format?.duration || "");
    if (Number.isFinite(sampleRate) && sampleRate > 0) metrics.sampleRate = sampleRate;
    if (Number.isFinite(channels) && channels > 0) metrics.channels = channels;
    if (Number.isFinite(durationSeconds) && durationSeconds > 0) metrics.durationSeconds = Math.round(durationSeconds * 1000) / 1000;
  } catch {}

  const loudness = spawnSync("ffmpeg", [
    "-hide_banner",
    "-i",
    filePath,
    "-af",
    "loudnorm=I=-15:TP=-1.5:LRA=11:print_format=json",
    "-f",
    "null",
    "-",
  ], { encoding: "utf-8", maxBuffer: 8 * 1024 * 1024 });
  const loudnessMatch = `${loudness.stderr || ""}\n${loudness.stdout || ""}`.match(/\{\s*"input_i"[\s\S]*?\}/m);
  if (loudnessMatch) {
    try {
      const parsed = JSON.parse(loudnessMatch[0]) as {
        input_i?: string;
        input_tp?: string;
      };
      const integratedLufs = Number(parsed.input_i || "");
      const truePeakDb = Number(parsed.input_tp || "");
      if (Number.isFinite(integratedLufs)) metrics.integratedLufs = integratedLufs;
      if (Number.isFinite(truePeakDb)) metrics.truePeakDb = truePeakDb;
    } catch {}
  }

  const volumeDetect = spawnSync("ffmpeg", [
    "-hide_banner",
    "-i",
    filePath,
    "-af",
    "volumedetect",
    "-f",
    "null",
    "-",
  ], { encoding: "utf-8", maxBuffer: 4 * 1024 * 1024 });
  const volumeText = `${volumeDetect.stderr || ""}\n${volumeDetect.stdout || ""}`;
  const meanMatch = volumeText.match(/mean_volume:\s*(-?\d+(?:\.\d+)?)\s*dB/i);
  const peakMatch = volumeText.match(/max_volume:\s*(-?\d+(?:\.\d+)?)\s*dB/i);
  if (meanMatch) metrics.rmsDb = Number(meanMatch[1]);
  if (peakMatch) metrics.peakDb = Number(peakMatch[1]);
  return metrics;
}

function readWavMonoSamples(filePath: string) {
  const buffer = fs.readFileSync(filePath);
  if (buffer.length < 44 || buffer.toString("ascii", 0, 4) !== "RIFF" || buffer.toString("ascii", 8, 12) !== "WAVE") {
    throw new Error(`Unsupported WAV file: ${filePath}`);
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
    throw new Error(`Incomplete WAV metadata: ${filePath}`);
  }
  const bytesPerSample = bitsPerSample / 8;
  const totalFrames = Math.floor(dataSize / blockAlign);
  const samples = new Float32Array(totalFrames);
  for (let frameIndex = 0; frameIndex < totalFrames; frameIndex += 1) {
    const frameOffset = dataOffset + frameIndex * blockAlign;
    let mono = 0;
    for (let channelIndex = 0; channelIndex < channels; channelIndex += 1) {
      const sampleOffset = frameOffset + channelIndex * bytesPerSample;
      let normalizedSample = 0;
      if (bitsPerSample === 8) {
        normalizedSample = (buffer.readUInt8(sampleOffset) - 128) / 128;
      } else if (bitsPerSample === 16) {
        normalizedSample = buffer.readInt16LE(sampleOffset) / 32768;
      } else if (bitsPerSample === 24) {
        normalizedSample = buffer.readIntLE(sampleOffset, 3) / 8388608;
      } else if (bitsPerSample === 32) {
        normalizedSample = buffer.readInt32LE(sampleOffset) / 2147483648;
      } else {
        throw new Error(`Unsupported WAV bit depth: ${bitsPerSample}`);
      }
      mono += normalizedSample;
    }
    samples[frameIndex] = mono / channels;
  }
  return { sampleRate, samples };
}

function rmsToDb(rms: number) {
  if (!Number.isFinite(rms) || rms <= 0) return -120;
  return Math.round((20 * Math.log10(rms)) * 10) / 10;
}

function computeWindowRms(samples: Float32Array, startIndex: number, endIndex: number) {
  const safeStart = Math.max(0, Math.min(samples.length, startIndex));
  const safeEnd = Math.max(safeStart + 1, Math.min(samples.length, endIndex));
  let sum = 0;
  let count = 0;
  for (let index = safeStart; index < safeEnd; index += 1) {
    const value = samples[index] || 0;
    sum += value * value;
    count += 1;
  }
  return Math.sqrt(sum / Math.max(1, count));
}

function computeCorrelation(left: Float32Array, right: Float32Array) {
  const length = Math.min(left.length, right.length);
  if (length < 2) return undefined;
  let sumLeft = 0;
  let sumRight = 0;
  for (let index = 0; index < length; index += 1) {
    sumLeft += left[index] || 0;
    sumRight += right[index] || 0;
  }
  const meanLeft = sumLeft / length;
  const meanRight = sumRight / length;
  let numerator = 0;
  let denomLeft = 0;
  let denomRight = 0;
  for (let index = 0; index < length; index += 1) {
    const a = (left[index] || 0) - meanLeft;
    const b = (right[index] || 0) - meanRight;
    numerator += a * b;
    denomLeft += a * a;
    denomRight += b * b;
  }
  const denominator = Math.sqrt(denomLeft * denomRight);
  if (!Number.isFinite(denominator) || denominator <= 0) return undefined;
  return Math.round((numerator / denominator) * 10000) / 10000;
}

function computeDifferenceRmsDb(left: Float32Array, right: Float32Array) {
  const length = Math.min(left.length, right.length);
  if (length < 1) return undefined;
  let sum = 0;
  for (let index = 0; index < length; index += 1) {
    const diff = (left[index] || 0) - (right[index] || 0);
    sum += diff * diff;
  }
  return rmsToDb(Math.sqrt(sum / length));
}

function stableStringifySoundDesignInput(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringifySoundDesignInput(item)).join(",")}]`;
  }
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${stableStringifySoundDesignInput(record[key])}`).join(",")}}`;
  }
  return JSON.stringify(value ?? null);
}

function hashSoundDesignInput(value: unknown): string {
  return crypto.createHash("sha256").update(stableStringifySoundDesignInput(value)).digest("hex");
}

function getSoundDesignInputFileSignature(role: string, relativePath: string, absolutePath: string) {
  if (!fs.existsSync(absolutePath)) {
    return { role, relativePath, exists: false };
  }
  const stat = fs.statSync(absolutePath);
  return {
    role,
    relativePath,
    exists: true,
    size: stat.size,
    mtimeMs: Math.round(stat.mtimeMs),
  };
}

function getSoundDesignDocumentSignature(relativePath: string, absolutePath: string) {
  if (!fs.existsSync(absolutePath)) {
    return { role: "sound-design-doc", relativePath, exists: false };
  }
  const body = extractBody(fs.readFileSync(absolutePath, "utf-8")).trim();
  return {
    role: "sound-design-doc",
    relativePath,
    exists: true,
    bodyBytes: Buffer.byteLength(body, "utf-8"),
    bodyHash: crypto.createHash("sha256").update(body).digest("hex"),
  };
}

function getSoundDesignFinalInputSnapshot(projectId: string, resolution?: ShortFormSoundDesignResolution) {
  const projectDir = getProjectDir(projectId);
  const docPath = getShortFormSoundDesignPath(projectId);
  const resolvedEvents = Array.isArray(resolution?.events) ? resolution.events : [];
  const activeEventsBase = resolvedEvents.filter((event) => event.status === "resolved" && !event.muted && event.assetRelativePath);
  const anySolo = activeEventsBase.some((event) => event.solo === true);
  const activeEvents = anySolo ? activeEventsBase.filter((event) => event.solo === true) : activeEventsBase;
  const activeMusicSegments = (resolution?.musicSegments || []).filter((segment) => segment.status === "resolved" && segment.musicRelativePath);
  const fileSignatures = [
    getSoundDesignDocumentSignature("sound-design.md", docPath),
    ...activeEvents.map((event) => getSoundDesignInputFileSignature(
      "sound-asset",
      event.assetRelativePath || "",
      path.join(getShortFormSoundLibraryDir(), event.assetRelativePath || ""),
    )),
    ...activeMusicSegments.map((segment) => getSoundDesignInputFileSignature(
      "music-asset",
      segment.musicRelativePath || "",
      path.join(getShortFormMusicLibraryDir(), segment.musicRelativePath || ""),
    )),
  ];
  const existingMtimes = fileSignatures
    .map((signature) => "mtimeMs" in signature && typeof signature.mtimeMs === "number" ? signature.mtimeMs : 0)
    .filter((mtimeMs) => mtimeMs > 0);
  const lastChangedAtMs = existingMtimes.length > 0 ? Math.max(...existingMtimes) : 0;
  const input = {
    version: resolution?.version || 0,
    mixSettings: resolution?.mixSettings || null,
    events: activeEvents,
    musicSegments: activeMusicSegments,
    files: fileSignatures,
  };
  return {
    fingerprint: hashSoundDesignInput(input),
    lastChangedAtMs,
    lastChangedAt: lastChangedAtMs > 0 ? new Date(lastChangedAtMs).toISOString() : undefined,
    projectDir,
  };
}

function getProjectSoundDesignFreshness(projectId: string, previewRelativePath?: string, resolution?: ShortFormSoundDesignResolution) {
  const projectDir = getProjectDir(projectId);
  const previewPath = previewRelativePath ? path.join(projectDir, previewRelativePath) : undefined;
  const finalVideoPath = path.join(projectDir, "output", "final-video.mp4");
  const baselineMtime = Math.max(
    Date.parse(resolution?.generatedAt || "") || 0,
  );
  const finalInputSnapshot = getSoundDesignFinalInputSnapshot(projectId, resolution);
  const previewFresh = Boolean(previewPath && fs.existsSync(previewPath) && fs.statSync(previewPath).mtimeMs >= baselineMtime - 250);
  const finalMtime = fs.existsSync(finalVideoPath) ? fs.statSync(finalVideoPath).mtimeMs : 0;
  const priorFinalInputFingerprint = resolution?.qa?.finalInputFingerprint;
  const finalFingerprintMatches = typeof priorFinalInputFingerprint === "string" && priorFinalInputFingerprint.length > 0
    ? priorFinalInputFingerprint === finalInputSnapshot.fingerprint
    : true;
  const finalFresh = Boolean(finalMtime > 0 && finalFingerprintMatches && finalMtime >= finalInputSnapshot.lastChangedAtMs - 250);
  return { previewFresh, finalFresh, finalInputSnapshot };
}

function buildSoundDesignQaReport(options: {
  projectId: string;
  resolution: ShortFormSoundDesignResolution;
  fullMixPath: string;
  noSfxMixPath: string;
  sfxOnlyMixPath: string;
  musicOnlyMixPath?: string;
  finalOutputPath?: string;
}): ShortFormSoundDesignQaReport {
  const { projectId, resolution, fullMixPath, noSfxMixPath, sfxOnlyMixPath, musicOnlyMixPath, finalOutputPath } = options;
  const fullMix = getAudioFileMetrics(fullMixPath);
  const noSfxMix = getAudioFileMetrics(noSfxMixPath);
  const sfxOnlyMix = getAudioFileMetrics(sfxOnlyMixPath);
  const musicOnlyMix = musicOnlyMixPath && fs.existsSync(musicOnlyMixPath) ? getAudioFileMetrics(musicOnlyMixPath) : undefined;
  const finalOutput = finalOutputPath && fs.existsSync(finalOutputPath) ? getAudioFileMetrics(finalOutputPath) : undefined;
  const fullSamples = readWavMonoSamples(fullMixPath);
  const noSfxSamples = readWavMonoSamples(noSfxMixPath);
  const sfxOnlySamples = readWavMonoSamples(sfxOnlyMixPath);
  const fullVsNoSfxCorrelation = computeCorrelation(fullSamples.samples, noSfxSamples.samples);
  const fullVsNoSfxDiffRmsDb = computeDifferenceRmsDb(fullSamples.samples, noSfxSamples.samples);
  const measuredEvents = resolution.events.filter((event) => isMeasuredAudibilityEvent(event));
  const audibleSamples: ShortFormSoundDesignAudibilitySample[] = measuredEvents.map((event) => {
    const bus = classifySoundDesignBus(event);
    const startSeconds = Math.max(0, event.resolvedStartSeconds - (bus === "transient" ? 0.03 : 0.06));
    const nominalEnd = typeof event.resolvedEndSeconds === "number"
      ? event.resolvedEndSeconds
      : event.resolvedStartSeconds + Math.max(0.08, event.durationSeconds || (bus === "transient" ? 0.18 : 0.55));
    const endSeconds = Math.max(startSeconds + 0.08, Math.min(nominalEnd + (bus === "transient" ? 0.08 : 0.14), startSeconds + (bus === "transient" ? 0.35 : 0.85)));
    const startIndex = Math.floor(startSeconds * fullSamples.sampleRate);
    const endIndex = Math.ceil(endSeconds * fullSamples.sampleRate);
    const fullRmsDb = rmsToDb(computeWindowRms(fullSamples.samples, startIndex, endIndex));
    const noSfxRmsDb = rmsToDb(computeWindowRms(noSfxSamples.samples, startIndex, endIndex));
    const sfxOnlyRmsDb = rmsToDb(computeWindowRms(sfxOnlySamples.samples, startIndex, endIndex));
    let diffSum = 0;
    const safeEnd = Math.min(endIndex, fullSamples.samples.length, noSfxSamples.samples.length);
    for (let index = Math.max(0, startIndex); index < safeEnd; index += 1) {
      const diff = (fullSamples.samples[index] || 0) - (noSfxSamples.samples[index] || 0);
      diffSum += diff * diff;
    }
    const diffRmsDb = rmsToDb(Math.sqrt(diffSum / Math.max(1, safeEnd - Math.max(0, startIndex))));
    const diffGapDb = fullRmsDb - diffRmsDb;
    const perceptualDeltaDb = typeof fullRmsDb === "number" && typeof noSfxRmsDb === "number"
      ? Math.round((fullRmsDb - noSfxRmsDb) * 10) / 10
      : undefined;
    // Click cues are short (30-80ms), so RMS averaged over a 150ms window doesn't move much
    // even when they're plainly audible to a listener. Use a more forgiving threshold for them.
    const isClickEvent = event.type === "click";
    const minPerceptualDelta = isClickEvent
      ? 0.8
      : bus === "transient"
        ? 1.2
        : 1.0;
    const passesDiffRms = isClickEvent
      ? diffRmsDb >= -32 && diffGapDb <= 22
      : bus === "transient"
        ? diffRmsDb >= -30 && diffGapDb <= 18
        : diffRmsDb >= -34 && diffGapDb <= 21;
    const passesPerceptual = typeof perceptualDeltaDb === "number" && perceptualDeltaDb >= minPerceptualDelta;
    const audible = passesDiffRms && passesPerceptual;
    // SFX bus had real energy (diffRms above -34 for clicks, -36 otherwise) but the full mix barely moved.
    const buriedThreshold = isClickEvent ? -34 : -36;
    const buriedAfterMastering = !passesPerceptual && typeof diffRmsDb === "number" && diffRmsDb >= buriedThreshold;
    return {
      eventId: event.id,
      type: event.type,
      track: event.track,
      bus,
      startSeconds: Math.round(startSeconds * 1000) / 1000,
      endSeconds: Math.round(endSeconds * 1000) / 1000,
      fullRmsDb,
      noSfxRmsDb,
      sfxOnlyRmsDb,
      diffRmsDb,
      perceptualDeltaDb,
      audible,
      buriedAfterMastering,
    };
  });

  const audibleEvents = audibleSamples.filter((sample) => sample.audible).length;
  const transientSamples = audibleSamples.filter((sample) => sample.bus === "transient");
  const transientAudible = transientSamples.filter((sample) => sample.audible).length;
  const audibleEventPercent = audibleSamples.length > 0 ? Math.round((audibleEvents / audibleSamples.length) * 1000) / 10 : undefined;
  const transientAudibleEventPercent = transientSamples.length > 0 ? Math.round((transientAudible / transientSamples.length) * 1000) / 10 : undefined;
  const issues: ShortFormSoundDesignQaIssue[] = [];
  if (typeof fullVsNoSfxCorrelation === "number" && fullVsNoSfxCorrelation >= 0.992) {
    issues.push({ severity: "warn", code: "sfx-correlation-too-high", message: `Full mix and no-SFX mix are very similar (${fullVsNoSfxCorrelation.toFixed(4)} correlation). The SFX bus may be sparse or quiet across the whole video.` });
  }
  // Aggregate SFX audibility: compare the SFX bus's integrated LUFS to the narration+music bus.
  // RMS-difference over the whole video is unreliable when SFX bursts are short and music+narration
  // is continuous -- LUFS is gated and captures the perceived loudness of active windows.
  if (typeof sfxOnlyMix.integratedLufs === "number" && typeof noSfxMix.integratedLufs === "number") {
    const sfxVsNoSfxLufsDelta = sfxOnlyMix.integratedLufs - noSfxMix.integratedLufs;
    if (sfxVsNoSfxLufsDelta <= -8) {
      issues.push({
        severity: "fail",
        code: "sfx-bus-too-quiet-vs-noSfx",
        message: `SFX bus is ${(-sfxVsNoSfxLufsDelta).toFixed(1)} LU below the narration+music bus (sfx ${sfxOnlyMix.integratedLufs.toFixed(1)} LUFS vs noSfx ${noSfxMix.integratedLufs.toFixed(1)} LUFS). Raise transient/riser/impact gainDb or reduce musicDuckingUnderTransientsDb depth.`,
      });
    } else if (sfxVsNoSfxLufsDelta <= -4) {
      issues.push({
        severity: "warn",
        code: "sfx-bus-quiet-vs-noSfx",
        message: `SFX bus is ${(-sfxVsNoSfxLufsDelta).toFixed(1)} LU below the narration+music bus (sfx ${sfxOnlyMix.integratedLufs.toFixed(1)} LUFS vs noSfx ${noSfxMix.integratedLufs.toFixed(1)} LUFS).`,
      });
    }
  }
  if (typeof audibleEventPercent === "number") {
    if (audibleEventPercent < 45) {
      issues.push({ severity: "fail", code: "audible-event-coverage-low", message: `Only ${audibleEventPercent.toFixed(1)}% of measured motion/transient events read audibly in the mix.` });
    } else if (audibleEventPercent < 65) {
      issues.push({ severity: "warn", code: "audible-event-coverage-moderate", message: `${audibleEventPercent.toFixed(1)}% of measured motion/transient events read audibly. Some cues are getting masked by music+narration.` });
    }
  }
  if (typeof transientAudibleEventPercent === "number" && transientAudibleEventPercent < 50) {
    issues.push({ severity: "warn", code: "transient-punch-low", message: `Transient punch coverage is ${transientAudibleEventPercent.toFixed(1)}%. Several clicks/impacts are below the music+narration floor in their windows.` });
  }
  // Only fail "events-buried-after-mastering" for non-click events. Clicks are intentionally
  // 30-80 ms transients that often don't lift a 150 ms RMS window even when clearly audible.
  // For impacts/risers/whooshes the RMS-lift check is meaningful.
  const nonClickBuriedCount = audibleSamples.filter((sample) => sample.buriedAfterMastering && sample.type !== "click").length;
  const clickBuriedCount = audibleSamples.filter((sample) => sample.buriedAfterMastering && sample.type === "click").length;
  if (nonClickBuriedCount > 0) {
    const nonClickMeasured = audibleSamples.filter((sample) => sample.type !== "click").length;
    const percent = nonClickMeasured > 0 ? (nonClickBuriedCount / nonClickMeasured) * 100 : 0;
    const severity: ShortFormSoundDesignQaIssue["severity"] = percent >= 35 ? "fail" : "warn";
    issues.push({
      severity,
      code: "events-buried-after-mastering",
      message: `${nonClickBuriedCount} impact/riser/whoosh cue${nonClickBuriedCount === 1 ? "" : "s"} had real SFX-bus energy but failed to lift the full mix by >= 1.0 dB after final limiting. Raise their gainDb or reduce music gain in those windows.`,
    });
  }
  if (clickBuriedCount > 0 && audibleSamples.filter((sample) => sample.type === "click").length > 0) {
    const clickCount = audibleSamples.filter((sample) => sample.type === "click").length;
    const percent = (clickBuriedCount / clickCount) * 100;
    if (percent >= 70) {
      issues.push({
        severity: "warn",
        code: "clicks-mostly-buried",
        message: `${clickBuriedCount} of ${clickCount} click cues did not measurably lift the full mix RMS. Clicks are short, so this often reads fine to a listener -- but if you can't hear them in the preview, raise their gainDb to -6 dB or louder.`,
      });
    }
  }
  if ((sfxOnlyMix.integratedLufs ?? -99) <= -30) {
    issues.push({ severity: "warn", code: "sfx-bus-too-quiet", message: `SFX-only render is very quiet (${(sfxOnlyMix.integratedLufs ?? -99).toFixed(1)} LUFS).` });
  }
  // Music audibility: compare the music-only bus loudness against the no-SFX mix (which is music + narration).
  // If music sits more than 12 LU below the narration+music bus, it is effectively inaudible in the final mix.
  if (musicOnlyMix && typeof musicOnlyMix.integratedLufs === "number") {
    const noSfxLufs = noSfxMix.integratedLufs;
    if (typeof noSfxLufs === "number") {
      const musicVsNarrationDelta = noSfxLufs - musicOnlyMix.integratedLufs;
      if (musicVsNarrationDelta >= 12) {
        const severity: ShortFormSoundDesignQaIssue["severity"] = musicVsNarrationDelta >= 16 ? "fail" : "warn";
        issues.push({
          severity,
          code: "music-too-quiet",
          message: `Music bus sits ${musicVsNarrationDelta.toFixed(1)} LU below the narration+music mix (music ${musicOnlyMix.integratedLufs.toFixed(1)} LUFS vs noSfx ${noSfxLufs.toFixed(1)} LUFS). Raise music segment gainDb, drop musicDuckingDb, or reduce musicDuckingUnderTransientsDb.`,
        });
      }
    }
    if (musicOnlyMix.integratedLufs <= -30) {
      issues.push({
        severity: "fail",
        code: "music-bus-near-silent",
        message: `Music-only render is near silent (${musicOnlyMix.integratedLufs.toFixed(1)} LUFS). The agent-planned music gainDb is not making it into the rendered mix.`,
      });
    }
  }
  if ((fullMix.sampleRate || 0) < 48000 || (fullMix.channels || 0) < 2) {
    issues.push({ severity: "fail", code: "preview-format-low-quality", message: `Preview mix is ${fullMix.sampleRate || "unknown"} Hz / ${fullMix.channels || "unknown"} ch instead of 48k stereo.` });
  }
  if (finalOutput && ((finalOutput.sampleRate || 0) < 48000 || (finalOutput.channels || 0) < 2)) {
    issues.push({ severity: "warn", code: "final-format-low-quality", message: `Final output is ${finalOutput.sampleRate || "unknown"} Hz / ${finalOutput.channels || "unknown"} ch instead of 48k stereo.` });
  }
  const freshness = getProjectSoundDesignFreshness(projectId, resolution.previewAudioRelativePath, resolution);
  if (!freshness.previewFresh) {
    issues.push({ severity: "fail", code: "preview-stale", message: "Preview mix is stale relative to the current sound-design plan or resolution." });
  }
  if (finalOutputPath && !freshness.finalFresh) {
    issues.push({ severity: "warn", code: "final-stale", message: "Final video is stale relative to the current sound-design plan or resolution." });
  }
  return {
    status: issues.some((issue) => issue.severity === "fail") ? "fail" : issues.length > 0 ? "warn" : "pass",
    generatedAt: new Date().toISOString(),
    previewFresh: freshness.previewFresh,
    finalFresh: freshness.finalFresh,
    finalInputFingerprint: freshness.finalInputSnapshot.fingerprint,
    finalInputLastChangedAt: freshness.finalInputSnapshot.lastChangedAt,
    fullMix,
    noSfxMix,
    sfxOnlyMix,
    ...(musicOnlyMix ? { musicOnlyMix } : {}),
    ...(finalOutput ? { finalOutput } : {}),
    fullVsNoSfxCorrelation,
    fullVsNoSfxDiffRmsDb,
    audibleEventPercent,
    audibleEvents,
    measuredEvents: audibleSamples.length,
    buriedEvents: audibleSamples.length - audibleEvents,
    transientAudibleEventPercent,
    measuredTransientEvents: transientSamples.length,
    audibleSamples,
    issues,
  };
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

function buildDuckedBackgroundFilters(inputLabel: string, narrationLabel: string, outputLabel: string, duckingDb: number, options?: {
  attackMs?: number;
  releaseMs?: number;
  threshold?: number;
}) {
  if (ffmpegSupportsFilter("sidechaincompress")) {
    const ratio = Math.max(2, Math.min(20, Math.abs(duckingDb) * 1.4));
    return `${inputLabel}${narrationLabel}sidechaincompress=threshold=${(options?.threshold ?? 0.04).toFixed(3)}:ratio=${ratio.toFixed(1)}:attack=${Math.max(1, Math.round(options?.attackMs ?? 15))}:release=${Math.max(10, Math.round(options?.releaseMs ?? 280))}:makeup=1${outputLabel}`;
  }
  return `${inputLabel}volume=${dbToVolume(duckingDb).toFixed(5)}${outputLabel}`;
}

function buildTransientBusFilters(inputLabel: string, outputLabel: string, mixSettings: ShortFormSoundDesignMixSettings) {
  const filters = [`volume=${dbToVolume(mixSettings.transientBusGainDb).toFixed(5)}`];
  if (ffmpegSupportsFilter("acompressor")) {
    filters.push("acompressor=threshold=0.18:ratio=2.2:attack=2:release=80:makeup=1");
  }
  return `${inputLabel}${filters.join(",")}${outputLabel}`;
}

function buildMusicUnderTransientsDuck(musicLabel: string, transientKeyLabel: string, outputLabel: string, duckingDb: number) {
  if (!ffmpegSupportsFilter("sidechaincompress") || duckingDb >= 0) return null;
  const ratio = Math.max(2, Math.min(20, Math.abs(duckingDb) * 1.4));
  return `${musicLabel}${transientKeyLabel}sidechaincompress=threshold=0.06:ratio=${ratio.toFixed(1)}:attack=4:release=180:makeup=1${outputLabel}`;
}

function buildMasteredOutputFilters(inputLabel: string, outputLabel: string, mixSettings: ShortFormSoundDesignMixSettings) {
  const filters: string[] = [];
  if (ffmpegSupportsFilter("loudnorm")) {
    filters.push(`loudnorm=I=${mixSettings.masterLoudnessTargetLufs.toFixed(1)}:TP=${mixSettings.masterTruePeakDb.toFixed(1)}:LRA=11`);
  }
  if (ffmpegSupportsFilter("alimiter")) {
    filters.push(`alimiter=limit=${dbToVolume(mixSettings.masterTruePeakDb).toFixed(5)}:level=disabled`);
  }
  if (filters.length === 0) return null;
  return `${inputLabel}${filters.join(",")}${outputLabel}`;
}

export interface MotionGraphicPreviewSoundEffectResolution {
  events: ShortFormResolvedSoundDesignEvent[];
  mixSettings: ShortFormSoundDesignMixSettings;
}

export interface MotionGraphicPreviewSoundEffectRenderResult extends MotionGraphicPreviewSoundEffectResolution {
  audioPath?: string;
  rendered: boolean;
  stats: {
    total: number;
    resolved: number;
    unresolved: number;
  };
  skippedReason?: string;
}

export function resolveMotionGraphicPreviewSoundEffects(options: {
  template: Pick<MotionGraphicTemplateConfig, "id" | "displayName" | "defaultArgs" | "deterministicSoundEffects">;
  durationSeconds: number;
  args?: Record<string, unknown>;
}): MotionGraphicPreviewSoundEffectResolution {
  const settings = getShortFormSoundDesignSettings();
  const events = buildDeterministicMotionGraphicPreviewSoundEvents(options);
  const mixSettings = resolveShortFormSoundDesignMixSettings(undefined, events);
  const resolvedEvents = events.map((event) => {
    if (!isAssetBackedEventType(event.type)) {
      return {
        ...event,
        resolvedStartSeconds: event.startSeconds,
        resolvedGainDb: typeof event.gainDb === "number" ? event.gainDb : 0,
        resolvedFadeInMs: typeof event.fadeInMs === "number" ? event.fadeInMs : 0,
        resolvedFadeOutMs: typeof event.fadeOutMs === "number" ? event.fadeOutMs : 0,
        duckingDb: mixSettings.musicDuckingDb,
        compatibleAssetIds: [],
        status: "resolved",
        resolutionReason: "music-or-mix-control-event",
      } satisfies ShortFormResolvedSoundDesignEvent;
    }

    const compatibleAssets = settings.library
      .filter((asset) => asset.audioRelativePath)
      .map((asset) => ({ asset, score: getAssetCompatibility(event, asset) }))
      .sort((left, right) => right.score - left.score);
    const requestedAsset = event.assetId
      ? settings.library.find((asset) => asset.id === event.assetId)
      : undefined;
    const asset = requestedAsset || selectCompatibleAsset(event, compatibleAssets);
    const assetDuration = asset ? getAssetDurationSeconds(asset) : undefined;
    const assetAnchorOffsetSeconds = assetDuration ? assetDuration * (asset?.anchorRatio || 0) : 0;
    const start = Math.max(0, event.startSeconds - assetAnchorOffsetSeconds);
    const fadeInMs = typeof event.fadeInMs === "number" ? event.fadeInMs : asset?.defaultFadeInMs || 0;
    const fadeOutMs = typeof event.fadeOutMs === "number" ? event.fadeOutMs : asset?.defaultFadeOutMs || 0;
    const gainDb = typeof event.gainDb === "number" ? event.gainDb : asset?.defaultGainDb || 0;
    const explicitEnd = typeof event.endSeconds === "number"
      ? Math.max(start, event.endSeconds)
      : typeof event.durationSeconds === "number"
        ? start + event.durationSeconds
        : undefined;
    const end = typeof explicitEnd === "number"
      ? explicitEnd
      : assetDuration
        ? start + assetDuration
        : undefined;
    const bus = classifySoundDesignBus({ ...event, timingType: asset?.timingType });
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
      duckingDb: bus === "ambience"
        ? mixSettings.ambienceDuckingDb
        : bus === "motion"
          ? mixSettings.motionDuckingDb
          : mixSettings.transientDuckingDb,
      compatibleAssetIds: compatibleAssets.filter((item) => item.score > -4).map((item) => item.asset.id),
      status: asset?.audioRelativePath ? "resolved" : "unresolved",
      resolutionReason: asset?.audioRelativePath
        ? (requestedAsset ? "requested-asset-match" : compatibleAssets[0] ? "semantic-library-match" : "fallback")
        : requestedAsset
          ? `Requested sound asset ${requestedAsset.id} has no uploaded audio file.`
          : "No uploaded sound asset matched this semantic event.",
    } satisfies ShortFormResolvedSoundDesignEvent;
  });

  return {
    events: enforceMaxConcurrentOneShots(resolvedEvents, mixSettings.maxConcurrentOneShots),
    mixSettings,
  };
}

export function renderMotionGraphicPreviewSoundEffects(options: {
  template: Pick<MotionGraphicTemplateConfig, "id" | "displayName" | "defaultArgs" | "deterministicSoundEffects">;
  durationSeconds: number;
  outputPath: string;
  args?: Record<string, unknown>;
}): MotionGraphicPreviewSoundEffectRenderResult {
  const { events, mixSettings } = resolveMotionGraphicPreviewSoundEffects(options);
  const activeEvents = events.filter((event) => event.status === "resolved" && !event.muted && event.assetRelativePath);
  const stats = {
    total: events.length,
    resolved: events.filter((event) => event.status === "resolved").length,
    unresolved: events.filter((event) => event.status !== "resolved").length,
  };

  if (events.length === 0) {
    return { events, mixSettings, rendered: false, stats, skippedReason: "template-has-no-deterministic-sfx" };
  }
  if (activeEvents.length === 0) {
    return { events, mixSettings, rendered: false, stats, skippedReason: "no-matching-sfx-assets" };
  }

  ensureDir(path.dirname(options.outputPath));
  const inputArgs = ["-y"];
  const filterLines: string[] = [];
  const ambienceLabels: string[] = [];
  const motionLabels: string[] = [];
  const transientLabels: string[] = [];
  let inputIndex = 0;

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
    const bus = classifySoundDesignBus(event);
    if (bus === "ambience") ambienceLabels.push(`[${label}]`);
    else if (bus === "motion") motionLabels.push(`[${label}]`);
    else transientLabels.push(`[${label}]`);
    inputIndex += 1;
  }

  const backgroundLabels: string[] = [];
  if (ambienceLabels.length > 0) {
    const ambienceLabel = ambienceLabels.length > 1 ? "[ambienceraw]" : ambienceLabels[0]!;
    if (ambienceLabels.length > 1) {
      filterLines.push(`${ambienceLabels.join("")}amix=inputs=${ambienceLabels.length}:normalize=0:dropout_transition=0${ambienceLabel}`);
    }
    backgroundLabels.push(ambienceLabel);
  }

  if (motionLabels.length > 0) {
    const motionLabel = motionLabels.length > 1 ? "[motionraw]" : motionLabels[0]!;
    if (motionLabels.length > 1) {
      filterLines.push(`${motionLabels.join("")}amix=inputs=${motionLabels.length}:normalize=0:dropout_transition=0${motionLabel}`);
    }
    backgroundLabels.push(motionLabel);
  }

  if (transientLabels.length > 0) {
    const transientLabel = transientLabels.length > 1 ? "[transientraw]" : transientLabels[0]!;
    if (transientLabels.length > 1) {
      filterLines.push(`${transientLabels.join("")}amix=inputs=${transientLabels.length}:normalize=0:dropout_transition=0${transientLabel}`);
    }
    filterLines.push(buildTransientBusFilters(transientLabel, "[transientbus]", mixSettings));
    backgroundLabels.push("[transientbus]");
  }

  if (backgroundLabels.length === 0) {
    return { events, mixSettings, rendered: false, stats, skippedReason: "resolved-sfx-assets-missing-from-disk" };
  }

  let outputLabel = backgroundLabels[0]!;
  if (backgroundLabels.length > 1) {
    filterLines.push(`${backgroundLabels.join("")}amix=inputs=${backgroundLabels.length}:normalize=0:dropout_transition=0[bgraw]`);
    const mastered = buildMasteredOutputFilters("[bgraw]", "[bgmix]", mixSettings);
    if (mastered) {
      filterLines.push(mastered);
      outputLabel = "[bgmix]";
    } else {
      outputLabel = "[bgraw]";
    }
  } else {
    const mastered = buildMasteredOutputFilters(backgroundLabels[0]!, "[bgmix]", mixSettings);
    if (mastered) {
      filterLines.push(mastered);
      outputLabel = "[bgmix]";
    }
  }

  const ffmpegArgs = [
    ...inputArgs,
    "-filter_complex",
    filterLines.join(";"),
    "-map",
    outputLabel,
    "-t",
    String(Math.max(0.5, options.durationSeconds)),
    "-ac",
    String(Math.max(1, Math.round(mixSettings.outputChannels))),
    "-ar",
    String(Math.max(22050, Math.round(mixSettings.outputSampleRate))),
    "-c:a",
    "pcm_s16le",
    options.outputPath,
  ];

  const result = spawnSync("ffmpeg", ffmpegArgs, { encoding: "utf-8", maxBuffer: 10 * 1024 * 1024 });
  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout || "Failed to render motion-graphic preview sound effects.");
  }

  return {
    events,
    mixSettings,
    audioPath: options.outputPath,
    rendered: true,
    stats,
  };
}

function renderShortFormSoundDesignPreviewVariant(options: {
  projectId: string;
  narrationPath: string;
  musicPath?: string;
  musicVolume?: number;
  includeNarration: boolean;
  includeMusic: boolean;
  includeSoundEffects: boolean;
  onlyTrack?: string;
  outputFileName: string;
}) {
  const {
    projectId,
    narrationPath,
    musicPath,
    musicVolume,
    includeNarration,
    includeMusic,
    includeSoundEffects,
    onlyTrack,
    outputFileName,
  } = options;
  const resolution = readShortFormSoundDesignResolution(projectId) || resolveShortFormSoundDesign(projectId);
  const mixSettings = resolution.mixSettings || resolveShortFormSoundDesignMixSettings();
  const previewPath = getShortFormSoundDesignPreviewPath(projectId, outputFileName);
  const previewRelativePath = getShortFormSoundDesignPreviewRelativePath(projectId, outputFileName);
  ensureDir(path.dirname(previewPath));

  const activeEventsBase = resolution.events.filter((event) => event.status === "resolved" && !event.muted && event.assetRelativePath);
  const anySolo = activeEventsBase.some((event) => event.solo);
  const activeEvents = (anySolo ? activeEventsBase.filter((event) => event.solo) : activeEventsBase)
    .filter((event) => !onlyTrack || event.track === onlyTrack);
  const inputArgs = ["-y"];
  const filterLines: string[] = [];
  const musicLabels: string[] = [];
  const ambienceLabels: string[] = [];
  const motionLabels: string[] = [];
  const transientLabels: string[] = [];
  let inputIndex = 0;

  if (includeNarration) {
    inputArgs.push("-i", narrationPath);
    filterLines.push(`[${inputIndex}:a]volume=1.0[narr]`);
    inputIndex += 1;
  }

  const activeMusicSegments = includeMusic
    ? (resolution.musicSegments || []).filter((segment) => segment.status === "resolved" && segment.musicRelativePath)
    : [];

  if (includeMusic && activeMusicSegments.length > 0) {
    for (const segment of activeMusicSegments) {
      const relativePath = segment.musicRelativePath;
      if (!relativePath) continue;
      const absolutePath = path.join(getShortFormMusicLibraryDir(), relativePath);
      if (!fs.existsSync(absolutePath)) continue;
      const startSeconds = Math.max(0, segment.resolvedStartSeconds);
      const desiredDuration = Math.max(0.05, segment.resolvedEndSeconds - startSeconds);
      const sourceDuration = getAudioDurationSeconds(absolutePath) || desiredDuration;
      if (desiredDuration > sourceDuration + 0.02) inputArgs.push("-stream_loop", "-1");
      inputArgs.push("-i", absolutePath);
      // Music segment gainDb is the literal relative gain. The legacy musicVolume
      // multiplier only applied when there were no segments (single static music
      // bed). Multiplying both would double-attenuate music and bury it under
      // narration + the new music-under-transients sidechain.
      const segmentVolume = dbToVolume(segment.resolvedGainDb || 0);
      const fadeInSeconds = Math.max(0, (segment.resolvedFadeInMs || 0) / 1000);
      const fadeOutSeconds = Math.max(0, (segment.resolvedFadeOutMs || 0) / 1000);
      const delayMs = Math.max(0, Math.round(startSeconds * 1000));
      const filters = [
        `atrim=0:${desiredDuration.toFixed(3)}`,
        ...buildMusicMixFilters(segmentVolume, mixSettings),
        ...(fadeInSeconds > 0 ? [`afade=t=in:st=0:d=${Math.min(fadeInSeconds, desiredDuration).toFixed(3)}`] : []),
        ...(fadeOutSeconds > 0 && desiredDuration > 0.05 ? [`afade=t=out:st=${Math.max(0, desiredDuration - fadeOutSeconds).toFixed(3)}:d=${Math.min(fadeOutSeconds, desiredDuration).toFixed(3)}`] : []),
        `adelay=${delayMs}|${delayMs}`,
      ];
      const label = `music${inputIndex}`;
      filterLines.push(`[${inputIndex}:a]${filters.join(",")}[${label}]`);
      musicLabels.push(`[${label}]`);
      inputIndex += 1;
    }
  } else if (includeMusic && musicPath && fs.existsSync(musicPath)) {
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
      const bus = classifySoundDesignBus(event);
      if (bus === "ambience") ambienceLabels.push(`[${label}]`);
      else if (bus === "motion") motionLabels.push(`[${label}]`);
      else transientLabels.push(`[${label}]`);
      inputIndex += 1;
    }
  }

  const hasNarration = includeNarration;
  const backgroundLabels: string[] = [];

  let pendingMusicLabel: string | null = null;
  if (musicLabels.length > 0) {
    const musicLabel = musicLabels.length > 1 ? "[musicraw]" : musicLabels[0]!;
    if (musicLabels.length > 1) {
      filterLines.push(`${musicLabels.join("")}amix=inputs=${musicLabels.length}:normalize=0:dropout_transition=0${musicLabel}`);
    }
    if (hasNarration) {
      filterLines.push(buildDuckedBackgroundFilters(musicLabel, "[narr]", "[duckedmusic]", mixSettings.musicDuckingDb));
      pendingMusicLabel = "[duckedmusic]";
    } else {
      pendingMusicLabel = musicLabel;
    }
  }

  if (ambienceLabels.length > 0) {
    const ambienceLabel = ambienceLabels.length > 1 ? "[ambienceraw]" : ambienceLabels[0]!;
    if (ambienceLabels.length > 1) {
      filterLines.push(`${ambienceLabels.join("")}amix=inputs=${ambienceLabels.length}:normalize=0:dropout_transition=0${ambienceLabel}`);
    }
    if (hasNarration) {
      filterLines.push(buildDuckedBackgroundFilters(ambienceLabel, "[narr]", "[duckedambience]", mixSettings.ambienceDuckingDb, { attackMs: 18, releaseMs: 320 }));
      backgroundLabels.push("[duckedambience]");
    } else {
      backgroundLabels.push(ambienceLabel);
    }
  }

  if (motionLabels.length > 0) {
    const motionLabel = motionLabels.length > 1 ? "[motionraw]" : motionLabels[0]!;
    if (motionLabels.length > 1) {
      filterLines.push(`${motionLabels.join("")}amix=inputs=${motionLabels.length}:normalize=0:dropout_transition=0${motionLabel}`);
    }
    if (hasNarration) {
      filterLines.push(buildDuckedBackgroundFilters(motionLabel, "[narr]", "[duckedmotion]", mixSettings.motionDuckingDb, { attackMs: 10, releaseMs: 180, threshold: 0.05 }));
      backgroundLabels.push("[duckedmotion]");
    } else {
      backgroundLabels.push(motionLabel);
    }
  }

  let transientKeyLabel: string | null = null;
  if (transientLabels.length > 0) {
    const transientLabel = transientLabels.length > 1 ? "[transientraw]" : transientLabels[0]!;
    if (transientLabels.length > 1) {
      filterLines.push(`${transientLabels.join("")}amix=inputs=${transientLabels.length}:normalize=0:dropout_transition=0${transientLabel}`);
    }
    filterLines.push(buildTransientBusFilters(transientLabel, "[transientbus]", mixSettings));
    transientKeyLabel = "[transientbus]";
    if (hasNarration && mixSettings.transientDuckingDb < 0) {
      filterLines.push(buildDuckedBackgroundFilters("[transientbus]", "[narr]", "[duckedtransients]", mixSettings.transientDuckingDb, { attackMs: 3, releaseMs: 70, threshold: 0.08 }));
      backgroundLabels.push("[duckedtransients]");
    } else {
      backgroundLabels.push("[transientbus]");
    }
  }

  if (pendingMusicLabel) {
    let finalMusicLabel = pendingMusicLabel;
    if (transientKeyLabel && mixSettings.musicDuckingUnderTransientsDb < 0) {
      const filter = buildMusicUnderTransientsDuck(pendingMusicLabel, transientKeyLabel, "[musicfinal]", mixSettings.musicDuckingUnderTransientsDb);
      if (filter) {
        filterLines.push(filter);
        finalMusicLabel = "[musicfinal]";
      }
    }
    backgroundLabels.unshift(finalMusicLabel);
  }

  if (!hasNarration && backgroundLabels.length === 0) {
    throw new Error(onlyTrack
      ? `No resolved sound-design events are available on the ${onlyTrack} track for preview.`
      : "No audio sources are available for this preview mode.");
  }

  let outputLabel = hasNarration ? "[narr]" : backgroundLabels[0] || "";
  if (hasNarration && backgroundLabels.length > 0) {
    filterLines.push(`[narr]${backgroundLabels.join("")}amix=inputs=${backgroundLabels.length + 1}:normalize=0:weights='${[1, ...backgroundLabels.map(() => 1)].join(" ")}'[mixraw]`);
    const mastered = buildMasteredOutputFilters("[mixraw]", "[mix]", mixSettings);
    if (mastered) {
      filterLines.push(mastered);
      outputLabel = "[mix]";
    } else {
      outputLabel = "[mixraw]";
    }
  } else if (backgroundLabels.length > 0) {
    if (backgroundLabels.length > 1) {
      filterLines.push(`${backgroundLabels.join("")}amix=inputs=${backgroundLabels.length}:normalize=0:dropout_transition=0[bgraw]`);
      const mastered = buildMasteredOutputFilters("[bgraw]", "[bgmix]", mixSettings);
      if (mastered) {
        filterLines.push(mastered);
        outputLabel = "[bgmix]";
      } else {
        outputLabel = "[bgraw]";
      }
    } else {
      const mastered = buildMasteredOutputFilters(backgroundLabels[0]!, "[bgmix]", mixSettings);
      if (mastered) {
        filterLines.push(mastered);
        outputLabel = "[bgmix]";
      } else {
        outputLabel = backgroundLabels[0]!;
      }
    }
  }

  const ffmpegArgs = [
    ...inputArgs,
    ...(filterLines.length > 0 ? ["-filter_complex", filterLines.join(";")] : []),
    "-map",
    outputLabel,
    "-ac",
    String(Math.max(1, Math.round(mixSettings.outputChannels))),
    "-ar",
    String(Math.max(22050, Math.round(mixSettings.outputSampleRate))),
    "-c:a",
    "pcm_s16le",
    previewPath,
  ];

  const result = spawnSync("ffmpeg", ffmpegArgs, { encoding: "utf-8", maxBuffer: 10 * 1024 * 1024 });
  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout || "Failed to render sound-design preview audio.");
  }

  return { previewPath, previewRelativePath };
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
  if (includeNarration && !fs.existsSync(narrationPath)) {
    throw new Error("Missing narration WAV for sound-design preview.");
  }
  const result = renderShortFormSoundDesignPreviewVariant({
    projectId,
    narrationPath,
    musicPath,
    musicVolume,
    includeNarration,
    includeMusic,
    includeSoundEffects,
    onlyTrack,
    outputFileName,
  });

  if (persistAsDefault) {
    const resolution = readShortFormSoundDesignResolution(projectId) || resolveShortFormSoundDesign(projectId);
    const withoutSfx = renderShortFormSoundDesignPreviewVariant({
      projectId,
      narrationPath,
      musicPath,
      musicVolume,
      includeNarration: true,
      includeMusic: true,
      includeSoundEffects: false,
      outputFileName: getShortFormSoundDesignPreviewFileName("without-sfx"),
    });
    const effectsOnly = renderShortFormSoundDesignPreviewVariant({
      projectId,
      narrationPath,
      musicPath,
      musicVolume,
      includeNarration: false,
      includeMusic: false,
      includeSoundEffects: true,
      outputFileName: getShortFormSoundDesignPreviewFileName("effects-only"),
    });
    let musicOnlyPath: string | undefined;
    const hasMusicSegments = (resolution.musicSegments || []).some((segment) => segment.status === "resolved" && segment.musicRelativePath);
    const hasMusicFile = Boolean(musicPath && fs.existsSync(musicPath));
    if (hasMusicSegments || hasMusicFile) {
      try {
        const musicOnly = renderShortFormSoundDesignPreviewVariant({
          projectId,
          narrationPath,
          musicPath,
          musicVolume,
          includeNarration: false,
          includeMusic: true,
          includeSoundEffects: false,
          outputFileName: getShortFormSoundDesignPreviewFileName("music-only"),
        });
        musicOnlyPath = musicOnly.previewPath;
      } catch {
        musicOnlyPath = undefined;
      }
    }
    const updated = readShortFormSoundDesignResolution(projectId) || resolution;
    updated.previewAudioRelativePath = result.previewRelativePath;
    updated.previewUpdatedAt = new Date().toISOString();
    updated.qa = buildSoundDesignQaReport({
      projectId,
      resolution: updated,
      fullMixPath: result.previewPath,
      noSfxMixPath: withoutSfx.previewPath,
      sfxOnlyMixPath: effectsOnly.previewPath,
      musicOnlyMixPath: musicOnlyPath,
      finalOutputPath: path.join(getProjectDir(projectId), "output", "final-video.mp4"),
    });
    writeShortFormSoundDesignResolution(projectId, updated);
  }

  return result;
}
