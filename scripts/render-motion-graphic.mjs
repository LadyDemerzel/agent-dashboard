#!/usr/bin/env node

import fs from "fs";
import os from "os";
import path from "path";
import { fileURLToPath, pathToFileURL } from "url";
import { spawnSync } from "child_process";
import * as fontkit from "fontkit";
import sharp from "sharp";

const WIDTH = 1080;
const HEIGHT = 1920;
const FPS = 30;
const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SHORT_FORM_VIDEOS_DIR = path.join(os.homedir(), "tenxsolo", "business", "content", "deliverables", "short-form-videos");
const BACKGROUND_VIDEO_SETTINGS_PATH = path.join(SHORT_FORM_VIDEOS_DIR, "_background-video-settings.json");
const BACKGROUND_VIDEOS_DIR = path.join(SHORT_FORM_VIDEOS_DIR, "_background-videos");
const MOTION_GRAPHIC_ASSETS_DIR = path.join(SHORT_FORM_VIDEOS_DIR, "_motion-graphic-assets");
const UNIFIED_BACKGROUND_IMAGE_PATH = path.join(MOTION_GRAPHIC_ASSETS_DIR, "process-flow-dark-pastel-watercolor-bg.png");
const UNIFIED_BACKGROUND_DARKEN_OVERLAY = "#000000@0.91";
const UNIFIED_FONT_FAMILY = "Inter";
const UNIFIED_PALETTE = {
  offWhite: "#e8e5dd",
  softGrey: "#cbc6bd",
  dimGrey: "#e8e5dd@0.48",
  faintGrey: "#e8e5dd@0.26",
  mutedBlue: "#a8bfd0@0.72",
  mutedSage: "#b8c8ad@0.72",
  mutedPeach: "#d6ae8f@0.74",
  mutedLavender: "#b9add1@0.72",
};
const STAT_REVEAL_TEXT_STYLE = {
  value: {
    fontFamily: UNIFIED_FONT_FAMILY,
    fontWeight: 400,
    fontSize: 186,
    color: UNIFIED_PALETTE.offWhite,
    lineHeight: (186 + 18) / 186,
    shadowOpacity: 0.78,
    shadowOffsetY: 6,
  },
  title: {
    fontFamily: UNIFIED_FONT_FAMILY,
    fontWeight: 400,
    fontSize: 64,
    color: UNIFIED_PALETTE.offWhite,
    maxChars: 20,
    lineGap: 20,
    lineHeight: (64 + 20) / 64,
    shadowOpacity: 0.72,
    shadowOffsetY: 4,
  },
};
const CAPTION_WORD_WALL_ACTIVE_WORD_BASE_FONT_WEIGHT = STAT_REVEAL_TEXT_STYLE.title.fontWeight;
const CAPTION_WORD_WALL_ACTIVE_WORD_PEAK_FONT_WEIGHT = 500;
const CAPTION_WORD_WALL_ACTIVE_WORD_PEAK_TRANSLATE_Y_EM = 0.09;
const CAPTION_WORD_WALL_ACTIVE_WORD_POP_KEYFRAMES = [
  { progress: 0, scale: 1, translateYEm: 0, fontWeight: CAPTION_WORD_WALL_ACTIVE_WORD_BASE_FONT_WEIGHT, easingToNext: "ease-out-quart" },
  { progress: 0.2, scale: 1.2, translateYEm: CAPTION_WORD_WALL_ACTIVE_WORD_PEAK_TRANSLATE_Y_EM, fontWeight: CAPTION_WORD_WALL_ACTIVE_WORD_PEAK_FONT_WEIGHT, easingToNext: "ease-out-cubic" },
  { progress: 1, scale: 1, translateYEm: 0, fontWeight: CAPTION_WORD_WALL_ACTIVE_WORD_BASE_FONT_WEIGHT },
];
const CAPTION_WORD_WALL_ACTIVE_WORD_MAX_SCALE = Math.max(...CAPTION_WORD_WALL_ACTIVE_WORD_POP_KEYFRAMES.map((frame) => frame.scale));
const CAPTION_WORD_WALL_ACTIVE_WORD_MAX_TRANSLATE_Y_EM = Math.max(...CAPTION_WORD_WALL_ACTIVE_WORD_POP_KEYFRAMES.map((frame) => frame.translateYEm));
const CAPTION_WORD_WALL_ACTIVE_WORD_MAX_FONT_WEIGHT = Math.max(...CAPTION_WORD_WALL_ACTIVE_WORD_POP_KEYFRAMES.map((frame) => frame.fontWeight));
const CAPTION_WORD_WALL_STYLE = {
  fontFamily: "CaptionWordWallInter",
  fallbackFontFamily: `${STAT_REVEAL_TEXT_STYLE.title.fontFamily}, Helvetica, Arial, sans-serif`,
  fontWeight: STAT_REVEAL_TEXT_STYLE.title.fontWeight,
  activeFontWeight: CAPTION_WORD_WALL_ACTIVE_WORD_MAX_FONT_WEIGHT,
  lineSizes: {
    regular: {
      mirrors: "stat_reveal.title",
      fontSize: STAT_REVEAL_TEXT_STYLE.title.fontSize,
      lineHeight: STAT_REVEAL_TEXT_STYLE.title.lineHeight,
      shadowOpacity: STAT_REVEAL_TEXT_STYLE.title.shadowOpacity,
      shadowOffsetY: STAT_REVEAL_TEXT_STYLE.title.shadowOffsetY,
    },
    large: {
      mirrors: "intermediate between stat_reveal.title and stat_reveal.value",
      fontSize: 112,
      lineHeight: (112 + 16) / 112,
      shadowOpacity: 0.75,
      shadowOffsetY: 5,
    },
    extra_large: {
      mirrors: "stat_reveal.value",
      fontSize: STAT_REVEAL_TEXT_STYLE.value.fontSize,
      lineHeight: STAT_REVEAL_TEXT_STYLE.value.lineHeight,
      shadowOpacity: STAT_REVEAL_TEXT_STYLE.value.shadowOpacity,
      shadowOffsetY: STAT_REVEAL_TEXT_STYLE.value.shadowOffsetY,
    },
  },
  wrapGapEm: 0,
  lineGapEm: STAT_REVEAL_TEXT_STYLE.title.lineGap / STAT_REVEAL_TEXT_STYLE.title.fontSize,
  blankGapEm: 0.42,
  spaceEm: 0.32,
  horizontalPadding: 124,
  activeScale: CAPTION_WORD_WALL_ACTIVE_WORD_MAX_SCALE,
  activeTranslateYEm: CAPTION_WORD_WALL_ACTIVE_WORD_MAX_TRANSLATE_Y_EM,
  activeWordColor: STAT_REVEAL_TEXT_STYLE.title.color,
  spokenWordColor: STAT_REVEAL_TEXT_STYLE.title.color,
  upcomingWordColor: "#bab7b1@0.42",
  shadowColor: "#000000",
  shadowBlur: 0,
};
const CAPTION_WORD_WALL_VERTICAL_REFLOW = {
  mode: "subtle-active-row-expanded-line-box-center-preserved",
  scaleExpansionTopShare: 0.68,
  scaleExpansionBottomShare: 0.32,
  expansionContributionMultiplier: 0.28,
  rowDisplacementMultiplier: 0.5,
};
const INTER_FONT_CANDIDATES = [
  process.env.INTER_FONT_FILE,
  path.join(REPO_ROOT, "public", "fonts", "InterVariable.ttf"),
  path.join(os.homedir(), ".cache", "convex", "dashboard", "out", "_next", "static", "media", "inter-latin-wght-normal.6c596dfc.woff2"),
  path.join(os.homedir(), ".cache", "convex", "dashboard", "out", "_next", "static", "media", "inter-latin-ext-wght-normal.3835a68e.woff2"),
].filter(Boolean);

function resolveFirstExistingPath(candidates) {
  return candidates.find((candidate) => typeof candidate === "string" && fs.existsSync(candidate)) || "";
}

const INTER_FONT_FILE = resolveFirstExistingPath(INTER_FONT_CANDIDATES);
const INTER_VARIABLE_FONT = (() => {
  if (!INTER_FONT_FILE) return null;
  try {
    const loaded = fontkit.openSync(INTER_FONT_FILE);
    return loaded?.variationAxes?.wght ? loaded : null;
  } catch {
    return null;
  }
})();
const INTER_VARIABLE_WEIGHT_AXIS = INTER_VARIABLE_FONT?.variationAxes?.wght || null;
const captionWordWallVariationFontCache = new Map();

function readArg(name, fallback) {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

function run(command, args) {
  const result = spawnSync(command, args, { encoding: "utf-8", maxBuffer: 10 * 1024 * 1024 });
  if (result.status !== 0) {
    throw new Error(`${command} failed with status ${result.status}:\n${result.stderr || result.stdout}`);
  }
  return result;
}

function ensureDir(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function asText(value, fallback = "") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function asNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function asOptionalTimingSeconds(value) {
  if (value === undefined || value === null || value === "") return undefined;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return undefined;
  return Math.max(0, Math.round(parsed * 1000) / 1000);
}

function timingAttrsFromObject(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const timing = asOptionalTimingSeconds(value.animateIn ?? value.revealAt ?? value.startAt ?? value.at ?? value.time);
  return timing === undefined ? {} : { animateIn: timing };
}

function normalizeAnimationTimings(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const normalized = {};
  for (const [key, raw] of Object.entries(value)) {
    if (Array.isArray(raw)) {
      const items = raw.map(asOptionalTimingSeconds);
      if (items.some((item) => item !== undefined)) normalized[key] = items;
      continue;
    }
    if (raw && typeof raw === "object") {
      const nested = normalizeAnimationTimings(raw);
      if (Object.keys(nested).length > 0) normalized[key] = nested;
      continue;
    }
    const timing = asOptionalTimingSeconds(raw);
    if (timing !== undefined) normalized[key] = timing;
  }
  return normalized;
}

function animationTimings(args = {}) {
  return normalizeAnimationTimings(args.animationTimings || args.timings || args.animateIn || {});
}

function directTiming(value) {
  return asOptionalTimingSeconds(value?.animateIn ?? value?.revealAt ?? value?.startAt ?? value?.at ?? value?.time);
}

function lookupTimingValue(source, key) {
  if (!source || typeof source !== "object" || Array.isArray(source)) return undefined;
  return source[key];
}

function timingValue(args, keys, fallback) {
  const timings = animationTimings(args);
  for (const key of Array.isArray(keys) ? keys : [keys]) {
    const timing = asOptionalTimingSeconds(lookupTimingValue(timings, key));
    if (timing !== undefined) return timing;
  }
  return fallback;
}

function itemTiming(args, sourceName, item, index, fallback, aliases = []) {
  const direct = directTiming(item);
  if (direct !== undefined) return direct;

  const timings = animationTimings(args);
  const names = [sourceName, ...aliases].filter(Boolean);
  for (const name of names) {
    const collection = lookupTimingValue(timings, name);
    if (Array.isArray(collection)) {
      const timing = asOptionalTimingSeconds(collection[index]);
      if (timing !== undefined) return timing;
    }
    if (collection && typeof collection === "object") {
      const byOneBasedIndex = asOptionalTimingSeconds(collection[index + 1] ?? collection[String(index + 1)]);
      if (byOneBasedIndex !== undefined) return byOneBasedIndex;
      const label = asText(item?.label || item?.text || "");
      if (label) {
        const byLabel = asOptionalTimingSeconds(collection[label]);
        if (byLabel !== undefined) return byLabel;
      }
    }

    const keyedTiming = asOptionalTimingSeconds(
      timings[`${name}.${index + 1}`]
      ?? timings[`${name}[${index + 1}]`]
      ?? timings[`${name}:${index + 1}`]
      ?? (item?.label ? timings[`${name}:${item.label}`] : undefined)
    );
    if (keyedTiming !== undefined) return keyedTiming;
  }
  return fallback;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function asList(value, fallback = []) {
  if (Array.isArray(value)) return value.map((item) => asText(item)).filter(Boolean);
  if (typeof value === "string") return value.split(/[|\n,]+/).map((item) => item.trim()).filter(Boolean);
  return fallback;
}

function autoTimelineLabel(index) {
  return String(index + 1).padStart(2, "0");
}

function asTimelineSteps(value, fallback = []) {
  const normalizeItem = (item, index) => {
    if (item && typeof item === "object") {
      const textValue = item.text ?? item.copy ?? item.title ?? item.step ?? item.value;
      const text = asText(textValue);
      if (!text) return null;
      return {
        label: asText(item.label ?? item.leftLabel ?? item.marker, autoTimelineLabel(index)).slice(0, 60),
        text,
        ...timingAttrsFromObject(item),
      };
    }
    const text = asText(item);
    return text ? { label: autoTimelineLabel(index), text } : null;
  };

  const source = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? value.split(/[|\n,]+/).map((item) => item.trim()).filter(Boolean)
      : fallback;
  const steps = source.map(normalizeItem).filter(Boolean);
  return steps.length > 0 ? steps : fallback.map(normalizeItem).filter(Boolean);
}

function hasTimelineSource(value) {
  if (Array.isArray(value)) return value.length > 0;
  return typeof value === "string" && value.trim().length > 0;
}

function asData(value) {
  if (Array.isArray(value)) {
    return value.map((item, index) => {
      if (item && typeof item === "object") {
        return {
          label: asText(item.label, `Item ${index + 1}`),
          value: asNumber(item.value, 0),
          displayValue: asText(item.displayValue, asText(item.value, "0")),
          ...timingAttrsFromObject(item),
        };
      }
      return { label: `Item ${index + 1}`, value: asNumber(item, 0), displayValue: asText(item, String(item ?? "0")) };
    }).filter((item) => item.label && Number.isFinite(item.value));
  }
  return [];
}

function normalizeCaptionWordWallLineSize(value, line = {}) {
  const raw = String(value || "").trim().toLowerCase().replace(/[\s-]+/g, "_");
  if (raw === "regular" || raw === "normal" || raw === "base") return "regular";
  if (raw === "large" || raw === "big") return "large";
  if (raw === "extra_large" || raw === "extralarge" || raw === "extra" || raw === "xl" || raw === "xlarge") return "extra_large";
  const emphasizedValue = line.emphasized ?? line.emphasis;
  return emphasizedValue === true || String(emphasizedValue || "").trim().toLowerCase() === "true" ? "extra_large" : "regular";
}

function asCaptionWordWallLines(value, fallback = []) {
  const source = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? value.split(/\r?\n/).map((line) => ({ text: line }))
      : fallback;
  return source
    .map((line) => {
      if (line && typeof line === "object") {
        const text = asText(line.text ?? line.caption ?? line.words);
        const blank = line.blank === true || !text;
        const size = normalizeCaptionWordWallLineSize(line.size ?? line.lineSize, line);
        return {
          ...(blank ? { blank: true } : { text }),
          ...(!blank ? { size } : {}),
          ...(size === "extra_large" && (line.emphasized === true || line.emphasis === true || String(line.emphasized || line.emphasis).toLowerCase() === "true") ? { emphasized: true } : {}),
          ...timingAttrsFromObject(line),
        };
      }
      const text = asText(line);
      return text ? { text } : { blank: true };
    })
    .filter((line) => line.blank || line.text);
}

function normalizeWordToken(value) {
  const normalized = String(value || "")
    .toLowerCase()
    .replace(/[’‘]/g, "'")
    .replace(/['`]/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, "");
  return normalized || String(value || "").toLowerCase().trim();
}

function splitDisplayWords(value) {
  return String(value || "").split(/\s+/).map((word) => word.trim()).filter(Boolean);
}

function readAlignmentWords(alignmentPath) {
  if (!alignmentPath || !fs.existsSync(alignmentPath)) return [];
  const payload = JSON.parse(fs.readFileSync(alignmentPath, "utf-8"));
  const items = Array.isArray(payload?.items) ? payload.items : [];
  return items
    .map((item, index) => ({
      index,
      text: asText(item?.text),
      normalized: normalizeWordToken(item?.text),
      start: Number(item?.start_time),
      end: Number(item?.end_time),
    }))
    .filter((item) => item.text && item.normalized && Number.isFinite(item.start) && Number.isFinite(item.end) && item.end >= item.start);
}

function estimateWordWidth(word, fontSize) {
  const weightedChars = String(word || "").split("").reduce((sum, char) => {
    if (/[ilI.,'!|]/.test(char)) return sum + 0.28;
    if (/[MW@#%&]/.test(char)) return sum + 0.86;
    if (/[A-Z0-9]/.test(char)) return sum + 0.62;
    return sum + 0.5;
  }, 0);
  return Math.max(fontSize * 0.35, weightedChars * fontSize);
}

function clampCaptionWordWallFontWeight(weight) {
  const parsed = Number(weight);
  const fallback = CAPTION_WORD_WALL_ACTIVE_WORD_BASE_FONT_WEIGHT;
  if (!Number.isFinite(parsed)) return fallback;
  const min = INTER_VARIABLE_WEIGHT_AXIS?.min ?? 100;
  const max = INTER_VARIABLE_WEIGHT_AXIS?.max ?? 900;
  return Math.max(min, Math.min(max, parsed));
}

function captionWordWallVariableFontForWeight(weight) {
  if (!INTER_VARIABLE_FONT) return null;
  const clampedWeight = clampCaptionWordWallFontWeight(weight);
  const cacheKey = clampedWeight.toFixed(2);
  const cached = captionWordWallVariationFontCache.get(cacheKey);
  if (cached) return cached;
  const variation = INTER_VARIABLE_FONT.getVariation({ wght: clampedWeight });
  captionWordWallVariationFontCache.set(cacheKey, variation);
  return variation;
}

function measureCaptionWordWallText(value, fontSize, fontWeight = CAPTION_WORD_WALL_ACTIVE_WORD_BASE_FONT_WEIGHT) {
  const textValue = String(value || "");
  const variation = captionWordWallVariableFontForWeight(fontWeight);
  if (!variation) {
    return textValue === " " ? Math.max(10, fontSize * CAPTION_WORD_WALL_STYLE.spaceEm) : estimateWordWidth(textValue, fontSize);
  }
  const run = variation.layout(textValue);
  const widthUnits = run.positions.reduce((sum, position) => sum + (Number(position.xAdvance) || 0), 0);
  return Math.max(0, widthUnits * (fontSize / variation.unitsPerEm));
}

function measureUnifiedTextWidth(value, fontSize, fontWeight = 400) {
  return measureCaptionWordWallText(String(value || ""), fontSize, fontWeight);
}

function measureUnifiedTextVisualBounds(value, fontSize, fontWeight = 400) {
  const textValue = String(value || "");
  const variation = captionWordWallVariableFontForWeight(fontWeight);
  if (!variation || !textValue) {
    const width = measureUnifiedTextWidth(textValue, fontSize, fontWeight);
    return { minX: 0, maxX: width, width };
  }
  const run = variation.layout(textValue);
  const scale = fontSize / variation.unitsPerEm;
  let cursorX = 0;
  let minX = Infinity;
  let maxX = -Infinity;
  for (let index = 0; index < run.glyphs.length; index += 1) {
    const glyph = run.glyphs[index];
    const position = run.positions[index];
    const bbox = glyph.bbox;
    const xOffset = Number(position.xOffset) || 0;
    const glyphMinX = (cursorX + xOffset + (Number(bbox?.minX) || 0)) * scale;
    const glyphMaxX = (cursorX + xOffset + (Number(bbox?.maxX) || 0)) * scale;
    if (glyphMaxX > glyphMinX) {
      minX = Math.min(minX, glyphMinX);
      maxX = Math.max(maxX, glyphMaxX);
    }
    cursorX += Number(position.xAdvance) || 0;
  }
  if (!Number.isFinite(minX) || !Number.isFinite(maxX) || maxX <= minX) {
    const width = measureUnifiedTextWidth(textValue, fontSize, fontWeight);
    return { minX: 0, maxX: width, width };
  }
  return { minX, maxX, width: maxX - minX };
}

function splitTextTokenToWidth(token, maxWidth, fontSize, fontWeight = 400) {
  const textToken = String(token || "");
  if (!textToken || measureUnifiedTextWidth(textToken, fontSize, fontWeight) <= maxWidth) return [textToken].filter(Boolean);
  const chunks = [];
  let chunk = "";
  for (const char of textToken) {
    const next = `${chunk}${char}`;
    if (chunk && measureUnifiedTextWidth(next, fontSize, fontWeight) > maxWidth) {
      chunks.push(chunk);
      chunk = char;
    } else {
      chunk = next;
    }
  }
  if (chunk) chunks.push(chunk);
  return chunks;
}

function wrapByPixelWidth(value, maxWidth, fontSize, options = {}) {
  const fontWeight = options.fontWeight ?? 400;
  const maxLines = options.maxLines ?? 4;
  const rawWords = asText(value).split(/\s+/).filter(Boolean);
  const words = rawWords.flatMap((word) => splitTextTokenToWidth(word, maxWidth, fontSize, fontWeight));
  const lines = [];
  let line = "";
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (line && measureUnifiedTextWidth(next, fontSize, fontWeight) > maxWidth) {
      lines.push(line);
      line = word;
      if (lines.length >= maxLines) break;
    } else {
      line = next;
    }
  }
  if (line && lines.length < maxLines) lines.push(line);
  return lines.length ? lines : [asText(value)];
}

function wrapByBalancedPixelWidth(value, maxWidth, fontSize, options = {}) {
  const fontWeight = options.fontWeight ?? 400;
  const maxLines = options.maxLines ?? 4;
  const textValue = asText(value);
  if (!textValue) return [textValue];
  if (measureUnifiedTextWidth(textValue, fontSize, fontWeight) <= maxWidth) return [textValue];

  const rawWords = textValue.split(/\s+/).filter(Boolean);
  const words = rawWords.flatMap((word) => splitTextTokenToWidth(word, maxWidth, fontSize, fontWeight));
  const candidates = [];

  const collect = (startIndex, lines) => {
    if (startIndex >= words.length) {
      candidates.push(lines);
      return;
    }
    if (lines.length >= maxLines) return;
    for (let endIndex = startIndex + 1; endIndex <= words.length; endIndex += 1) {
      const line = words.slice(startIndex, endIndex).join(" ");
      if (measureUnifiedTextWidth(line, fontSize, fontWeight) > maxWidth) break;
      collect(endIndex, [...lines, line]);
    }
  };

  collect(0, []);
  if (!candidates.length) return wrapByPixelWidth(value, maxWidth, fontSize, options);

  const minLineCount = Math.min(...candidates.map((candidate) => candidate.length));
  const best = candidates
    .filter((candidate) => candidate.length === minLineCount)
    .map((candidate) => {
      const widths = candidate.map((line) => measureUnifiedTextVisualBounds(line, fontSize, fontWeight).width);
      const maxLineWidth = Math.max(0, ...widths);
      const raggedness = widths.reduce((sum, width) => sum + ((maxLineWidth - width) ** 2), 0);
      return { candidate, score: raggedness + maxLineWidth * 0.02 };
    })
    .sort((a, b) => a.score - b.score)[0]?.candidate;

  return best || wrapByPixelWidth(value, maxWidth, fontSize, options);
}

function captionWordWallPathForText({ value, x, baselineY, fontSize, fontWeight, fill, filterId }) {
  const variation = captionWordWallVariableFontForWeight(fontWeight);
  if (!variation) return "";
  const run = variation.layout(String(value || ""));
  const scale = fontSize / variation.unitsPerEm;
  let cursorX = 0;
  const paths = [];
  for (let index = 0; index < run.glyphs.length; index += 1) {
    const glyph = run.glyphs[index];
    const position = run.positions[index];
    const pathData = glyph.path.toSVG();
    if (pathData) {
      const glyphX = x + ((Number(position.xOffset) || 0) + cursorX) * scale;
      const glyphY = baselineY - (Number(position.yOffset) || 0) * scale;
      paths.push(`<path d="${pathData}" transform="translate(${glyphX.toFixed(3)} ${glyphY.toFixed(3)}) scale(${scale.toFixed(6)} ${(-scale).toFixed(6)})"/>`);
    }
    cursorX += Number(position.xAdvance) || 0;
  }
  if (paths.length === 0) return "";
  return `<g fill="${fill}" filter="url(#${filterId})">${paths.join("")}</g>`;
}

function easeOutCubic(progress) {
  const p = Math.max(0, Math.min(1, Number(progress) || 0));
  return 1 - ((1 - p) ** 3);
}

function easeInCubic(progress) {
  const p = Math.max(0, Math.min(1, Number(progress) || 0));
  return p ** 3;
}

function easeInOutCubic(progress) {
  const p = Math.max(0, Math.min(1, Number(progress) || 0));
  return p < 0.5 ? 4 * p ** 3 : 1 - ((-2 * p + 2) ** 3) / 2;
}

function easeOutQuart(progress) {
  const p = Math.max(0, Math.min(1, Number(progress) || 0));
  return 1 - ((1 - p) ** 4);
}

function applyCaptionWordWallSegmentEasing(progress, easing) {
  if (easing === "ease-out-quart") return easeOutQuart(progress);
  if (easing === "ease-in-cubic") return easeInCubic(progress);
  if (easing === "ease-out-cubic") return easeOutCubic(progress);
  if (easing === "ease-in-out-cubic") return easeInOutCubic(progress);
  return Math.max(0, Math.min(1, Number(progress) || 0));
}

function interpolateNumber(from, to, progress) {
  return from + (to - from) * progress;
}

function activeWordPopFrame(progress) {
  const p = Math.max(0, Math.min(1, Number(progress) || 0));
  const keyframes = CAPTION_WORD_WALL_ACTIVE_WORD_POP_KEYFRAMES;
  if (p <= keyframes[0].progress) {
    return { scale: keyframes[0].scale, translateYEm: keyframes[0].translateYEm, fontWeight: keyframes[0].fontWeight };
  }
  for (let index = 0; index < keyframes.length - 1; index += 1) {
    const from = keyframes[index];
    const to = keyframes[index + 1];
    if (p <= to.progress) {
      const segmentProgress = (p - from.progress) / Math.max(0.0001, to.progress - from.progress);
      const easedProgress = applyCaptionWordWallSegmentEasing(segmentProgress, from.easingToNext);
      return {
        scale: interpolateNumber(from.scale, to.scale, easedProgress),
        translateYEm: interpolateNumber(from.translateYEm, to.translateYEm, easedProgress),
        fontWeight: interpolateNumber(from.fontWeight, to.fontWeight, easedProgress),
      };
    }
  }
  const last = keyframes[keyframes.length - 1];
  return {
    scale: last.scale,
    translateYEm: last.translateYEm,
    fontWeight: last.fontWeight,
  };
}

function captionWordWallActiveWordExpansion(fontSize, pop) {
  const scaleExpansion = Math.max(0, (Number(pop?.scale) || 1) - 1) * fontSize;
  const liftExpansion = Math.max(0, Number(pop?.translateYEm) || 0) * fontSize * (Number(pop?.scale) || 1);
  const rawTop = scaleExpansion * CAPTION_WORD_WALL_VERTICAL_REFLOW.scaleExpansionTopShare + liftExpansion;
  const rawBottom = scaleExpansion * CAPTION_WORD_WALL_VERTICAL_REFLOW.scaleExpansionBottomShare;
  const top = rawTop * CAPTION_WORD_WALL_VERTICAL_REFLOW.expansionContributionMultiplier;
  const bottom = rawBottom * CAPTION_WORD_WALL_VERTICAL_REFLOW.expansionContributionMultiplier;
  return {
    rawTop,
    rawBottom,
    rawTotal: rawTop + rawBottom,
    top,
    bottom,
    total: top + bottom,
  };
}

function resolveWordWallState(words, sampleTime) {
  if (sampleTime < words[0]?.start) return { activeIndex: -1, spokenThroughIndex: 0, progress: 0 };
  for (let index = 0; index < words.length; index += 1) {
    const word = words[index];
    if (sampleTime < word.start) return { activeIndex: -1, spokenThroughIndex: index, progress: 0 };
    if (word.start <= sampleTime && sampleTime < word.end) {
      const wordDuration = Math.max(0.001, word.end - word.start);
      const wordProgress = (sampleTime - word.start) / wordDuration;
      return {
        activeIndex: index,
        spokenThroughIndex: index,
        progress: Math.max(0, Math.min(1, wordProgress)),
      };
    }
  }
  return { activeIndex: -1, spokenThroughIndex: words.length, progress: 0 };
}

function buildCaptionWordWallTimeline({ lines, alignmentWords, visualStartSeconds, durationSeconds, allowSyntheticTiming = false }) {
  const normalizedLines = asCaptionWordWallLines(lines, [
    { text: "most people miss this part" },
    { text: "the words become the visual", size: "large" },
    { text: "with one extra large row", size: "extra_large" },
    { blank: true },
    { text: "and every highlight follows the voice" },
  ]);
  if (normalizedLines.length === 0) throw new Error("caption_word_wall requires at least one <line> or <blankLine /> entry.");

  const hasRealAlignment = alignmentWords.length > 0;
  if (!hasRealAlignment) {
    if (!allowSyntheticTiming) {
      throw new Error("caption_word_wall requires forced-alignment word timestamps. Run the XML Script narration/alignment steps before rendering this motion graphic.");
    }
    const spokenLines = normalizedLines.filter((line) => !line.blank && line.text);
    const fallbackWords = spokenLines.flatMap((line) => splitDisplayWords(line.text));
    if (fallbackWords.length === 0) throw new Error("caption_word_wall preview needs at least one spoken word.");
    const step = Math.max(0.08, durationSeconds / fallbackWords.length);
    let cursor = 0;
    const syntheticWords = fallbackWords.map((word, index) => ({
      index,
      text: word,
      normalized: normalizeWordToken(word),
      start: cursor + index * step,
      end: Math.min(durationSeconds, cursor + (index + 0.82) * step),
    }));
    return buildCaptionWordWallTimeline({ lines: normalizedLines, alignmentWords: syntheticWords, visualStartSeconds: 0, durationSeconds, allowSyntheticTiming: true });
  }

  let cursor = 0;
  const wordEntries = [];
  const resolvedLines = normalizedLines.map((line, lineIndex) => {
    if (line.blank) return { blank: true, size: "regular", emphasized: false, words: [] };
    const size = normalizeCaptionWordWallLineSize(line.size, line);
    const words = splitDisplayWords(line.text);
    const resolvedWords = words.map((wordText) => {
      const normalized = normalizeWordToken(wordText);
      let matchIndex = -1;
      for (let searchIndex = cursor; searchIndex < alignmentWords.length; searchIndex += 1) {
        if (alignmentWords[searchIndex]?.normalized === normalized) {
          matchIndex = searchIndex;
          break;
        }
      }
      if (matchIndex === -1) {
        throw new Error(`caption_word_wall could not match spoken word "${wordText}" in forced-alignment data. Keep <line> text exact and in narration order.`);
      }
      const matched = alignmentWords[matchIndex];
      cursor = matchIndex + 1;
      const localStart = matched.start - visualStartSeconds;
      const localEnd = matched.end - visualStartSeconds;
      if (localEnd < -0.05 || localStart > durationSeconds + 0.05) {
        throw new Error(`caption_word_wall word "${wordText}" is outside the visual start/end range. Align the motion graphic visual range with the spoken words it displays.`);
      }
      const entry = {
        text: wordText,
        normalized,
        start: Math.max(0, localStart),
        end: Math.min(durationSeconds, Math.max(localStart + 0.05, localEnd)),
        lineIndex,
        size,
        emphasized: size === "extra_large",
        globalIndex: wordEntries.length,
      };
      wordEntries.push(entry);
      return entry;
    });
    return {
      text: line.text,
      size,
      emphasized: size === "extra_large",
      words: resolvedWords,
      lineStart: directTiming(line) ?? resolvedWords[0]?.start ?? 0,
      lineEnd: resolvedWords[resolvedWords.length - 1]?.end ?? 0,
    };
  });

  if (wordEntries.length === 0) throw new Error("caption_word_wall needs at least one spoken word line.");
  return { lines: resolvedLines, words: wordEntries };
}

function layoutCaptionWordWall(timeline) {
  const style = CAPTION_WORD_WALL_STYLE;
  const maxWidth = WIDTH - style.horizontalPadding * 2;
  const maxHeight = HEIGHT - 480;
  const leftX = style.horizontalPadding;
  const scaleCandidates = [1, 0.94, 0.88, 0.82, 0.76, 0.7, 0.64, 0.58, 0.52];

  for (const scale of scaleCandidates) {
    const normalSize = Math.round(style.lineSizes.regular.fontSize * scale);
    const scaledLineSizes = Object.fromEntries(
      Object.entries(style.lineSizes).map(([size, lineStyle]) => [size, {
        ...lineStyle,
        fontSize: Math.round(lineStyle.fontSize * scale),
      }]),
    );
    const rows = [];
    for (let lineIndex = 0; lineIndex < timeline.lines.length; lineIndex += 1) {
      const line = timeline.lines[lineIndex];
      if (line.blank) {
        rows.push({ blank: true, lineIndex, height: Math.round(normalSize * style.blankGapEm), words: [] });
        continue;
      }
      const lineSize = scaledLineSizes[line.size] || scaledLineSizes.regular;
      const fontSize = lineSize.fontSize;
      const lineHeight = lineSize.lineHeight;
      const spaceWidth = Math.max(10, measureCaptionWordWallText(" ", fontSize, style.fontWeight));
      let current = [];
      let currentWidth = 0;
      let wrapIndex = 0;
      for (const word of line.words) {
        const width = measureCaptionWordWallText(word.text, fontSize, style.fontWeight);
        const activeWidth = measureCaptionWordWallText(word.text, fontSize * style.activeScale, style.activeFontWeight);
        const activeReserve = Math.max(10, activeWidth - width);
        const nextWidth = current.length ? currentWidth + spaceWidth + width : width;
        if (current.length && nextWidth + activeReserve > maxWidth) {
          rows.push({
            fontSize,
            size: line.size,
            emphasized: line.size === "extra_large",
            lineIndex,
            wrapIndex,
            words: current,
            width: currentWidth,
            height: Math.round(fontSize * lineHeight),
            spaceWidth,
            lineStart: line.lineStart,
            x: leftX,
          });
          wrapIndex += 1;
          current = [word];
          currentWidth = width;
        } else {
          current.push(word);
          currentWidth = nextWidth;
        }
      }
      if (current.length) {
        rows.push({
          fontSize,
          size: line.size,
          emphasized: line.size === "extra_large",
          lineIndex,
          wrapIndex,
          words: current,
          width: currentWidth,
          height: Math.round(fontSize * lineHeight),
          spaceWidth,
          lineStart: line.lineStart,
          x: leftX,
        });
      }
    }
    const gapAfter = (row, nextRow) => {
      if (!nextRow) return 0;
      if (row.blank || nextRow.blank) return Math.round(normalSize * style.blankGapEm);
      if (row.lineIndex === nextRow.lineIndex) return Math.round(normalSize * style.wrapGapEm);
      return Math.round(normalSize * style.lineGapEm);
    };
    const gaps = rows.map((row, index) => gapAfter(row, rows[index + 1]));
    const totalHeight = rows.reduce((sum, row, index) => sum + row.height + gaps[index], 0);
    if (totalHeight <= maxHeight || scale === scaleCandidates[scaleCandidates.length - 1]) {
      const maxActiveWordExpansion = Math.max(
        0,
        ...rows
          .filter((row) => !row.blank && Number.isFinite(row.fontSize))
          .map((row) => captionWordWallActiveWordExpansion(row.fontSize, {
            scale: CAPTION_WORD_WALL_ACTIVE_WORD_MAX_SCALE,
            translateYEm: CAPTION_WORD_WALL_ACTIVE_WORD_MAX_TRANSLATE_Y_EM,
          }).total),
      );
      const maxRawActiveWordExpansion = Math.max(
        0,
        ...rows
          .filter((row) => !row.blank && Number.isFinite(row.fontSize))
          .map((row) => captionWordWallActiveWordExpansion(row.fontSize, {
            scale: CAPTION_WORD_WALL_ACTIVE_WORD_MAX_SCALE,
            translateYEm: CAPTION_WORD_WALL_ACTIVE_WORD_MAX_TRANSLATE_Y_EM,
          }).rawTotal),
      );
      let y = Math.round((HEIGHT - totalHeight) / 2);
      return {
        alignment: "left",
        x: leftX,
        spacingMode: "svg-fixed-space-tspans-active-font-pop-with-vertical-reflow",
        rows: rows.map((row, index) => {
          const next = { ...row, y, gapAfter: gaps[index] };
          y += row.height + gaps[index];
          return next;
        }),
        normalSize,
        totalHeight,
        maxDynamicExpansion: maxActiveWordExpansion,
        maxRawDynamicExpansion: maxRawActiveWordExpansion,
        maxRowDisplacement: maxActiveWordExpansion * CAPTION_WORD_WALL_VERTICAL_REFLOW.rowDisplacementMultiplier,
      };
    }
  }
  throw new Error("Unable to layout caption_word_wall text.");
}

function svgEsc(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function captionWordWallFontCss() {
  if (!INTER_FONT_FILE) return "";
  const fontFormat = INTER_FONT_FILE.toLowerCase().endsWith(".ttf") ? "truetype" : "woff2";
  return `
  @font-face {
    font-family: '${CAPTION_WORD_WALL_STYLE.fontFamily}';
    src: url('${pathToFileURL(INTER_FONT_FILE).href}') format('${fontFormat}');
    font-weight: 100 900;
  }`;
}

function resolveCaptionWordWallFrameRows(layout, state) {
  const activeRowIndex = state.activeIndex >= 0
    ? layout.rows.findIndex((row) => !row.blank && row.words?.some((word) => word.globalIndex === state.activeIndex))
    : -1;
  if (activeRowIndex < 0) {
    return {
      rows: layout.rows,
      activeRowIndex,
      activeWordExpansion: { top: 0, bottom: 0, total: 0 },
      centerShift: 0,
      rowShift: 0,
    };
  }

  const activeRow = layout.rows[activeRowIndex];
  const pop = activeWordPopFrame(state.progress);
  const activeWordExpansion = captionWordWallActiveWordExpansion(activeRow.fontSize, pop);
  const centerShift = (activeWordExpansion.bottom - activeWordExpansion.top) * CAPTION_WORD_WALL_VERTICAL_REFLOW.rowDisplacementMultiplier;
  const rowShift = activeWordExpansion.total * CAPTION_WORD_WALL_VERTICAL_REFLOW.rowDisplacementMultiplier;
  const activeRowShift = -centerShift;
  return {
    rows: layout.rows.map((row, index) => {
      let yOffset = activeRowShift;
      if (index < activeRowIndex) yOffset = -rowShift;
      if (index > activeRowIndex) yOffset = rowShift;
      return {
        ...row,
        y: row.y + yOffset,
        baseY: row.y,
        verticalOffset: yOffset,
      };
    }),
    activeRowIndex,
    activeWordExpansion,
    centerShift,
    rowShift,
  };
}

function renderCaptionWordWallSvg(timeline, layout, state) {
  void timeline;
  const style = CAPTION_WORD_WALL_STYLE;
  const textNodes = [];
  const shadowFilter = (id, textStyle) => `
  <filter id="${id}" x="-20%" y="-25%" width="145%" height="160%">
    <feDropShadow dx="0" dy="${textStyle.shadowOffsetY}" stdDeviation="${style.shadowBlur}" flood-color="${style.shadowColor}" flood-opacity="${textStyle.shadowOpacity}"/>
  </filter>`;
  textNodes.push(`
<defs>
  <style><![CDATA[
${captionWordWallFontCss()}
    .caption-word-wall-text {
      font-family: '${style.fontFamily}', ${style.fallbackFontFamily};
      font-kerning: normal;
    }
  ]]></style>
  ${shadowFilter("titleTextShadow", STAT_REVEAL_TEXT_STYLE.title)}
  ${shadowFilter("largeTextShadow", CAPTION_WORD_WALL_STYLE.lineSizes.large)}
  ${shadowFilter("valueTextShadow", STAT_REVEAL_TEXT_STYLE.value)}
</defs>`);

  const frameLayout = resolveCaptionWordWallFrameRows(layout, state);
  for (const row of frameLayout.rows) {
    if (row.blank || !row.words?.length) continue;
    if (state.sampleTime + 0.0001 < row.lineStart) continue;
    const baselineY = row.y + row.fontSize;
    const filterId = row.size === "extra_large" ? "valueTextShadow" : row.size === "large" ? "largeTextShadow" : "titleTextShadow";
    if (INTER_VARIABLE_FONT) {
      let cursorX = row.x;
      const wordPaths = [];
      for (const word of row.words) {
        const wordState = word.globalIndex === state.activeIndex
          ? "active"
          : word.globalIndex < state.spokenThroughIndex
            ? "spoken"
            : "upcoming";
        const pop = wordState === "active" ? activeWordPopFrame(state.progress) : { scale: 1, translateYEm: 0, fontWeight: style.fontWeight };
        const fontSize = row.fontSize * pop.scale;
        const fontWeight = wordState === "active" ? pop.fontWeight : style.fontWeight;
        const liftPx = pop.translateYEm ? pop.translateYEm * fontSize : 0;
        const fill = svgColor(wordState === "active" ? style.activeWordColor : wordState === "spoken" ? style.spokenWordColor : style.upcomingWordColor);
        wordPaths.push(captionWordWallPathForText({
          value: word.text,
          x: cursorX,
          baselineY: baselineY - liftPx,
          fontSize,
          fontWeight,
          fill,
          filterId,
        }));
        cursorX += measureCaptionWordWallText(word.text, fontSize, fontWeight) + row.spaceWidth;
      }
      textNodes.push(`<g class="caption-word-wall-text" data-renderer="inter-variable-fontkit-paths">${wordPaths.join("")}</g>`);
      continue;
    }
    const tspans = [];
    for (const word of row.words) {
      const wordState = word.globalIndex === state.activeIndex
        ? "active"
        : word.globalIndex < state.spokenThroughIndex
          ? "spoken"
          : "upcoming";
      const pop = wordState === "active" ? activeWordPopFrame(state.progress) : { scale: 1, translateYEm: 0, fontWeight: style.fontWeight };
      const fontSize = Math.round(row.fontSize * pop.scale);
      const fontWeight = wordState === "active" ? Math.round(pop.fontWeight) : style.fontWeight;
      const fill = svgColor(wordState === "active" ? style.activeWordColor : wordState === "spoken" ? style.spokenWordColor : style.upcomingWordColor);
      if (tspans.length) {
        tspans.push(`<tspan font-size="${row.fontSize}" font-weight="${style.fontWeight}"> </tspan>`);
      }
      const baselineShift = pop.translateYEm ? ` baseline-shift="${(pop.translateYEm).toFixed(4)}em"` : "";
      tspans.push(`<tspan fill="${fill}" font-size="${fontSize}" font-weight="${fontWeight}"${baselineShift}>${svgEsc(word.text)}</tspan>`);
    }
    textNodes.push(`<text class="caption-word-wall-text" x="${row.x}" y="${baselineY}" text-anchor="start" xml:space="preserve" font-size="${row.fontSize}" font-weight="${style.fontWeight}" fill="${svgColor(style.upcomingWordColor)}" filter="url(#${filterId})">${tspans.join("")}</text>`);
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}">${textNodes.join("\n")}</svg>`;
}

async function renderCaptionWordWallFrames({ config, tempDir, duration }) {
  const args = { ...(config.defaultArgs || {}), ...(config.args || {}) };
  const visualStartSeconds = Number.isFinite(Number(config.visualStartSeconds)) ? Number(config.visualStartSeconds) : 0;
  const alignmentWords = readAlignmentWords(config.alignmentPath);
  const timeline = buildCaptionWordWallTimeline({
    lines: args.lines,
    alignmentWords,
    visualStartSeconds,
    durationSeconds: duration,
    allowSyntheticTiming: config.allowSyntheticTiming === true,
  });
  const layout = layoutCaptionWordWall(timeline);
  const frameDir = path.join(tempDir, "caption-word-wall-frames");
  fs.mkdirSync(frameDir, { recursive: true });
  const frameCount = Math.max(1, Math.ceil(duration * FPS));
  const renderCache = new Map();
  for (let frameIndex = 0; frameIndex < frameCount; frameIndex += 1) {
    const sampleTime = Math.min(duration - 0.0001, frameIndex / FPS + 0.5 / FPS);
    const state = resolveWordWallState(timeline.words, sampleTime);
    const visibleLineCount = timeline.lines.filter((line) => !line.blank && Number.isFinite(line.lineStart) && sampleTime + 0.0001 >= line.lineStart).length;
    const cacheKey = `${state.activeIndex}:${state.spokenThroughIndex}:${visibleLineCount}:${state.progress.toFixed(4)}`;
    const framePath = path.join(frameDir, `frame-${String(frameIndex + 1).padStart(5, "0")}.png`);
    const cached = renderCache.get(cacheKey);
    if (cached) {
      fs.copyFileSync(cached, framePath);
      continue;
    }
    const svg = renderCaptionWordWallSvg(timeline, layout, { ...state, sampleTime });
    await sharp(Buffer.from(svg)).png().toFile(framePath);
    renderCache.set(cacheKey, framePath);
  }
  return {
    framePattern: path.join(frameDir, "frame-%05d.png"),
    timeline,
    layout,
    frameCount,
    usesForcedAlignment: alignmentWords.length > 0,
  };
}

function esc(value) {
  return asText(value)
    .replace(/\\/g, "\\\\")
    .replace(/:/g, "\\:")
    .replace(/'/g, "’")
    .replace(/%/g, "\\%")
    .replace(/\[/g, "\\[")
    .replace(/\]/g, "\\]");
}

function ffColor(value) {
  return String(value || "")
    .replace(/^#([0-9a-fA-F]{6})(@.+)?$/, "0x$1$2");
}

function ffSingleQuoted(value) {
  return String(value || "").replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

function ffDrawTextFont(font) {
  if (typeof font === "string" && font && fs.existsSync(font)) return `fontfile='${ffSingleQuoted(font)}'`;
  return `font='${font || "Helvetica"}'`;
}

function svgColor(value) {
  const raw = String(value || "#ffffff");
  const match = raw.match(/^#([0-9a-fA-F]{2})([0-9a-fA-F]{2})([0-9a-fA-F]{2})(?:@([0-9.]+))?$/);
  if (!match) return raw.replace(/@.*$/, "");
  const [, r, g, b, alpha] = match;
  const opacity = alpha === undefined ? 1 : Math.max(0, Math.min(1, Number(alpha)));
  return `rgba(${parseInt(r, 16)}, ${parseInt(g, 16)}, ${parseInt(b, 16)}, ${opacity})`;
}

function escapeXml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function text(value, x, y, size, color = "#1f2933", extra = "", font = "Helvetica") {
  return `drawtext=text='${esc(value)}':${ffDrawTextFont(font)}:fontcolor=${ffColor(color)}:fontsize=${size}:line_spacing=18:x=${x}:y=${y}:expansion=none${extra}`;
}

function box(x, y, w, h, color, extra = "") {
  return `drawbox=x=${x}:y=${y}:w=${w}:h=${h}:color=${ffColor(color)}:t=fill${extra}`;
}

function progressExpr(start, duration = 0.45) {
  return `min(max((t-${start.toFixed(3)})/${duration.toFixed(3)}\\,0)\\,1)`;
}

function smoothStepExpr(start, duration = 0.45) {
  const p = progressExpr(start, duration);
  return `((${p})*(${p})*(3-2*(${p})))`;
}

function activeWindowExpr(start, end, fade = 0.32) {
  return `min(${smoothStepExpr(start, fade)}\\,1-(${smoothStepExpr(end, fade)}))`;
}

function processFlowAlphaExpr(revealStart, activeStart, activeEnd, finalBrightAt, dim = 0.46, fade = 0.34) {
  const reveal = smoothStepExpr(revealStart, fade);
  const active = activeWindowExpr(activeStart, activeEnd, 0.32);
  const finalBright = `gte(t\\,${finalBrightAt.toFixed(3)})`;
  return `(${reveal})*(${dim.toFixed(2)}+${(1 - dim).toFixed(2)}*max(${active}\\,${finalBright}))`;
}

function revealEnable(start) {
  return `:enable='gte(t\\,${start.toFixed(3)})'`;
}

function slideXExpr(x, start, distance = 66, duration = 0.5) {
  return `'${x}-${distance}*(1-${smoothStepExpr(start, duration)})'`;
}

function slideYDownExpr(y, start, distance = 48, duration = 0.5) {
  return `'${y}-${distance}*(1-${smoothStepExpr(start, duration)})'`;
}

function slideYUpExpr(y, start, distance = 48, duration = 0.5) {
  return `'${y}+${distance}*(1-${smoothStepExpr(start, duration)})'`;
}

function centerXExpr(centerX) {
  return `'${Math.round(centerX)}-text_w/2'`;
}

function rightXExpr(rightX) {
  return `'${Math.round(rightX)}-text_w'`;
}

function animatedText(value, x, y, size, color, start, distance = 48, extra = "", font = "Helvetica", duration = 0.5, alphaDuration = 0.34) {
  return text(value, slideXExpr(x, start, distance, duration), y, size, color, `${extra}:alpha='${smoothStepExpr(start, alphaDuration)}'${revealEnable(start)}`, font);
}

function animatedTextSlideDown(value, x, y, size, color, start, distance = 48, extra = "", font = "Helvetica", duration = 0.5, alphaDuration = 0.34) {
  return text(value, x, slideYDownExpr(y, start, distance, duration), size, color, `${extra}:alpha='${smoothStepExpr(start, alphaDuration)}'${revealEnable(start)}`, font);
}

function animatedRightAlignedTextSlideDown(value, rightX, y, size, color, start, distance = 48, extra = "", font = "Helvetica", duration = 0.5, alphaDuration = 0.34) {
  return text(value, rightXExpr(rightX), slideYDownExpr(y, start, distance, duration), size, color, `${extra}:alpha='${smoothStepExpr(start, alphaDuration)}'${revealEnable(start)}`, font);
}

function animatedTextSlideUp(value, x, y, size, color, start, distance = 48, extra = "", font = "Helvetica", duration = 0.5, alphaDuration = 0.34) {
  return text(value, x, slideYUpExpr(y, start, distance, duration), size, color, `${extra}:alpha='${smoothStepExpr(start, alphaDuration)}'${revealEnable(start)}`, font);
}

function animatedRightAlignedTextSlideUp(value, rightX, y, size, color, start, distance = 48, extra = "", font = "Helvetica", duration = 0.5, alphaDuration = 0.34) {
  return text(value, rightXExpr(rightX), slideYUpExpr(y, start, distance, duration), size, color, `${extra}:alpha='${smoothStepExpr(start, alphaDuration)}'${revealEnable(start)}`, font);
}

function animatedCenteredText(value, centerX, y, size, color, start, extra = "", font = "Helvetica", duration = 0.38) {
  return text(value, centerXExpr(centerX), y, size, color, `${extra}:alpha='${smoothStepExpr(start, duration)}'${revealEnable(start)}`, font);
}

function animatedRisingCenteredText(value, centerX, finalY, travelDistance, size, color, start, extra = "", font = "Helvetica", duration = 0.4) {
  const steps = Math.ceil(duration * FPS);
  const filters = [];
  for (let frameIndex = 0; frameIndex < steps; frameIndex += 1) {
    const segmentStart = start + frameIndex / FPS;
    const segmentEnd = start + (frameIndex + 1) / FPS;
    const progress = Math.min(1, Math.max(0, (frameIndex + 0.5) / steps));
    const eased = progress * progress * (3 - 2 * progress);
    const currentY = Math.round(finalY + travelDistance * (1 - eased));
    filters.push(text(value, centerXExpr(centerX), currentY, size, color, `${extra}:alpha=${eased.toFixed(4)}:enable='between(t\\,${segmentStart.toFixed(3)}\\,${segmentEnd.toFixed(3)})'`, font));
  }
  filters.push(text(value, centerXExpr(centerX), finalY, size, color, `${extra}:alpha=1:enable='gte(t\\,${(start + duration).toFixed(3)})'`, font));
  return filters;
}

function unifiedFont() {
  return INTER_FONT_FILE || UNIFIED_FONT_FAMILY;
}

function textShadow(strength = 0.72, y = 4) {
  return `:shadowcolor=0x000000@${strength.toFixed(2)}:shadowx=0:shadowy=${y}`;
}

function animatedUnifiedText(value, x, y, size, color, start, distance = 46, extra = "", duration = 0.52, alphaDuration = 0.34) {
  return animatedText(value, x, y, size, color, start, distance, `${textShadow()}${extra}`, unifiedFont(), duration, alphaDuration);
}

function animatedUnifiedTextSlideDown(value, x, y, size, color, start, distance = 46, extra = "", duration = 0.52, alphaDuration = 0.34) {
  return animatedTextSlideDown(value, x, y, size, color, start, distance, `${textShadow()}${extra}`, unifiedFont(), duration, alphaDuration);
}

function animatedUnifiedRightAlignedTextSlideDown(value, rightX, y, size, color, start, distance = 46, extra = "", duration = 0.52, alphaDuration = 0.34) {
  return animatedRightAlignedTextSlideDown(value, rightX, y, size, color, start, distance, `${textShadow()}${extra}`, unifiedFont(), duration, alphaDuration);
}

function animatedUnifiedTextSlideUp(value, x, y, size, color, start, distance = 46, extra = "", duration = 0.52, alphaDuration = 0.34) {
  return animatedTextSlideUp(value, x, y, size, color, start, distance, `${textShadow()}${extra}`, unifiedFont(), duration, alphaDuration);
}

function animatedUnifiedRightAlignedTextSlideUp(value, rightX, y, size, color, start, distance = 46, extra = "", duration = 0.52, alphaDuration = 0.34) {
  return animatedRightAlignedTextSlideUp(value, rightX, y, size, color, start, distance, `${textShadow()}${extra}`, unifiedFont(), duration, alphaDuration);
}

function animatedUnifiedCenteredText(value, centerX, y, size, color, start, extra = "", duration = 0.38) {
  return animatedCenteredText(value, centerX, y, size, color, start, `${textShadow()}${extra}`, unifiedFont(), duration);
}

function animatedUnifiedRisingCenteredText(value, centerX, finalY, travelDistance, size, color, start, extra = "", duration = 0.4) {
  return animatedRisingCenteredText(value, centerX, finalY, travelDistance, size, color, start, `${textShadow()}${extra}`, unifiedFont(), duration);
}

function animatedUnifiedTextLines(value, x, y, size, color, start, max = 24, lineGap = 18, distance = 46, extra = "", duration = 0.54, lineStagger = 0.045, alphaDuration = 0.34) {
  return wrap(value, max)
    .split("\n")
    .filter(Boolean)
    .map((line, lineIndex) => animatedUnifiedText(line, x, y + lineIndex * (size + lineGap), size, color, start + lineIndex * lineStagger, distance, extra, duration, alphaDuration));
}

function animatedUnifiedTextLinesSlideDown(value, x, y, size, color, start, max = 24, lineGap = 18, distance = 46, extra = "", duration = 0.54, lineStagger = 0, alphaDuration = 0.34) {
  return wrap(value, max)
    .split("\n")
    .filter(Boolean)
    .map((line, lineIndex) => animatedUnifiedTextSlideDown(line, x, y + lineIndex * (size + lineGap), size, color, start + lineIndex * lineStagger, distance, extra, duration, alphaDuration));
}

function animatedUnifiedCenteredTextLines(value, centerX, y, size, color, start, max = 24, lineGap = 18, extra = "", duration = 0.42, lineStagger = 0.045) {
  return wrap(value, max)
    .split("\n")
    .filter(Boolean)
    .map((line, lineIndex) => animatedUnifiedCenteredText(line, centerX, y + lineIndex * (size + lineGap), size, color, start + lineIndex * lineStagger, extra, duration));
}

function fixedRevealTiming(index, options = {}) {
  const firstRevealAt = options.firstRevealAt ?? 0.36;
  const revealDuration = options.revealDuration ?? 0.38;
  const gapAfterReveal = options.gapAfterReveal ?? 0.58;
  const revealAt = firstRevealAt + index * (revealDuration + gapAfterReveal);
  return {
    revealAt,
    revealDuration,
    finishAt: revealAt + revealDuration,
  };
}

const SUPPORTED_RENDERER_KEYS = new Set([
  "stat_reveal",
  "bar_chart",
  "pie_chart",
  "line_growth_chart",
  "comparison_before_after",
  "timeline",
  "cause_effect",
  "caption_word_wall",
  "ranked_podium",
  "checklist",
  "scorecard",
  "research_paper_card",
  "good_bad_indicator",
]);

const RENDERER_KEY_ALIASES = new Map([
  ["instruction", "good_bad_indicator"],
  ["warning_card", "good_bad_indicator"],
  ["good-bad-indicator", "good_bad_indicator"],
  ["step_checklist", "checklist"],
  ["process_flow", "timeline"],
  ["research_finding_card", "stat_reveal"],
]);

function normalizeRendererKey(value) {
  const key = asText(value);
  if (!key) return "";
  if (SUPPORTED_RENDERER_KEYS.has(key)) return key;
  return RENDERER_KEY_ALIASES.get(key) || "";
}

function resolveRendererKey(config) {
  return normalizeRendererKey(config?.rendererId)
    || normalizeRendererKey(config?.templateId)
    || asText(config?.rendererId || config?.templateId, "stat_reveal");
}

function resolveRendererArgs(config) {
  const defaultArgs = config?.defaultArgs && typeof config.defaultArgs === "object" && !Array.isArray(config.defaultArgs)
    ? config.defaultArgs
    : {};
  const providedArgs = config?.args && typeof config.args === "object" && !Array.isArray(config.args)
    ? config.args
    : {};
  const args = { ...defaultArgs, ...providedArgs };
  const rendererKey = resolveRendererKey(config);

  if (
    (rendererKey === "checklist" || rendererKey === "ranked_podium")
    && hasTimelineSource(providedArgs.steps)
    && !hasTimelineSource(providedArgs.items)
  ) {
    args.items = providedArgs.steps;
  }

  return args;
}

function sequentialStartIndex(value, itemCount) {
  const parsed = Math.round(asNumber(value, 1));
  if (!Number.isFinite(parsed)) return 1;
  return Math.max(1, Math.min(Math.max(1, itemCount), parsed));
}

function futureItemsMode(value) {
  const mode = String(value || "").trim().toLowerCase().replace(/[\s-]+/g, "_");
  if (mode === "blurred" || mode === "blur" || mode === "ghost" || mode === "dim") return "blurred";
  if (mode === "visible" || mode === "shown" || mode === "show") return "visible";
  return "hidden";
}

function chartDirection(value) {
  const raw = String(value || "").trim().toLowerCase().replace(/[\s-]+/g, "_");
  if (raw === "decrease" || raw === "decreasing" || raw === "down" || raw === "decline" || raw === "worse" || raw === "worsening" || raw === "shrink" || raw === "shrinking") return "decrease";
  return "increase";
}

function sequentialRevealTiming(index, startIndex, options = {}) {
  if (index + 1 < startIndex) {
    return { preRevealed: true, revealAt: 0, revealDuration: options.revealDuration ?? 0.42, finishAt: 0 };
  }
  const relativeIndex = index - (startIndex - 1);
  return { preRevealed: false, ...fixedRevealTiming(relativeIndex, options) };
}

function futureGhostText(value, x, y, size, color, revealAt, max = 24, lineGap = 18, rightAligned = false) {
  const lines = wrap(value, max).split("\n").filter(Boolean);
  return lines.map((line, lineIndex) => {
    const lineY = y + lineIndex * (size + lineGap);
    const xExpr = rightAligned ? rightXExpr(x) : x;
    return text(line, xExpr, lineY, size, color, `${textShadow(0.54, 3)}:alpha=0.22:enable='lt(t\\,${revealAt.toFixed(3)})'`, unifiedFont());
  });
}

function animatedBoxSlideDown(x, y, w, h, color, start, distance = 34, duration = 0.36) {
  return box(x, slideYDownExpr(y, start, distance, duration), w, h, color, `:enable='gte(t\\,${start.toFixed(3)})'`);
}

async function createChecklistBoxOverlay({
  tempDir,
  x,
  y,
  size,
  color,
  checked,
  start,
  index,
  fadeIn = 0.26,
  fadeOut = 0.18,
  exitStart,
  enterYOffset = 16,
  exitYOffset = 0,
}) {
  const imageSize = Math.round(size);
  const radius = Math.round(imageSize * 0.18);
  const strokeWidth = Math.max(5, Math.round(imageSize * 0.11));
  const checkPath = checked
    ? `<path d="M ${imageSize * 0.27} ${imageSize * 0.51} L ${imageSize * 0.43} ${imageSize * 0.67} L ${imageSize * 0.74} ${imageSize * 0.32}" fill="none" stroke="${svgColor(UNIFIED_PALETTE.offWhite)}" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round"/>`
    : "";
  const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="${imageSize}" height="${imageSize}" viewBox="0 0 ${imageSize} ${imageSize}">
  <rect x="0" y="0" width="${imageSize}" height="${imageSize}" rx="${radius}" ry="${radius}" fill="${svgColor(color)}"/>
  ${checkPath}
</svg>`;
  const filePath = path.join(tempDir || os.tmpdir(), `checklist-box-${checked ? "checked" : "empty"}-${index}.png`);
  await sharp(Buffer.from(svg), { density: 288 })
    .resize(imageSize, imageSize, { kernel: "lanczos3" })
    .png()
    .toFile(filePath);
  return {
    filePath,
    x: Math.round(x),
    y: Math.round(y),
    height: imageSize,
    start,
    fadeIn,
    fadeOut,
    exitStart,
    enterYOffset,
    exitYOffset,
    debugChecklistRoundedRectRadius: radius,
    debugChecklistCheckCentered: Boolean(checked),
    debugChecklistCheckPathCenteredInBox: checked ? true : undefined,
  };
}

function animatedVerticalRule(x, y, h, color, start, width = 4) {
  const p = smoothStepExpr(start, 0.5);
  return box(x, y, width, `'${h}*${p}'`, color, revealEnable(start));
}

function animatedVerticalRuleForDuration(x, y, h, color, start, duration, width = 4) {
  const steps = Math.max(1, Math.ceil(duration * FPS));
  const filters = [];
  for (let frameIndex = 0; frameIndex < steps; frameIndex += 1) {
    const segmentStart = start + frameIndex / FPS;
    const segmentEnd = Math.min(start + (frameIndex + 1) / FPS, start + duration);
    const progress = Math.min(1, Math.max(0, (frameIndex + 0.5) / steps));
    const eased = progress * progress * (3 - 2 * progress);
    const currentH = Math.max(1, Math.min(Math.floor(h * eased), Math.max(1, Math.floor(h) - 1)));
    filters.push(box(x, y, width, currentH, color, `:enable='between(t\\,${segmentStart.toFixed(3)}\\,${segmentEnd.toFixed(3)})'`));
  }
  filters.push(box(x, y, width, h, color, `:enable='gte(t\\,${(start + duration).toFixed(3)})'`));
  return filters;
}

function animatedHorizontalRule(x, y, w, h, color, start, duration = 0.58) {
  const steps = Math.ceil(duration * FPS);
  const filters = [];
  for (let frameIndex = 0; frameIndex < steps; frameIndex += 1) {
    const segmentStart = start + frameIndex / FPS;
    const segmentEnd = start + (frameIndex + 1) / FPS;
    const progress = Math.min(1, Math.max(0, (frameIndex + 0.5) / steps));
    const eased = progress * progress * (3 - 2 * progress);
    const currentW = Math.max(2, Math.round(w * eased));
    filters.push(box(x, y, currentW, h, color, `:enable='between(t\\,${segmentStart.toFixed(3)}\\,${segmentEnd.toFixed(3)})'`));
  }
  filters.push(box(x, y, w, h, color, `:enable='gte(t\\,${(start + duration).toFixed(3)})'`));
  return filters;
}

function animatedCenterOutHorizontalRule(x, y, w, h, color, start, duration = 0.36) {
  const steps = Math.ceil(duration * FPS);
  const filters = [];
  const centerX = x + w / 2;
  for (let frameIndex = 0; frameIndex < steps; frameIndex += 1) {
    const segmentStart = start + frameIndex / FPS;
    const segmentEnd = start + (frameIndex + 1) / FPS;
    const progress = Math.min(1, Math.max(0, (frameIndex + 0.5) / steps));
    const eased = progress * progress * (3 - 2 * progress);
    const currentW = Math.max(2, Math.round(w * eased));
    const currentX = Math.round(centerX - currentW / 2);
    filters.push(box(currentX, y, currentW, h, color, `:enable='between(t\\,${segmentStart.toFixed(3)}\\,${segmentEnd.toFixed(3)})'`));
  }
  filters.push(box(x, y, w, h, color, `:enable='gte(t\\,${(start + duration).toFixed(3)})'`));
  return filters;
}

function animatedBar(x, baseY, w, h, color, start, duration = 0.58) {
  const steps = Math.ceil(duration * FPS);
  const filters = [];
  for (let frameIndex = 0; frameIndex < steps; frameIndex += 1) {
    const segmentStart = start + frameIndex / FPS;
    const segmentEnd = start + (frameIndex + 1) / FPS;
    const progress = Math.min(1, Math.max(0, (frameIndex + 0.5) / steps));
    const eased = progress * progress * (3 - 2 * progress);
    const currentH = Math.max(2, Math.round(h * eased));
    filters.push(box(x, baseY - currentH, w, currentH, color, `:enable='between(t\\,${segmentStart.toFixed(3)}\\,${segmentEnd.toFixed(3)})'`));
  }
  filters.push(box(x, baseY - h, w, h, color, `:enable='gte(t\\,${(start + duration).toFixed(3)})'`));
  return filters;
}

function processFlowText(value, x, y, size, color, start, activeStart, activeEnd, finalBrightAt, distance = 48, extra = "", font = "Helvetica", duration = 0.5, dim = 0.46) {
  return text(value, x, slideYDownExpr(y, start, distance, duration), size, color, `${extra}:alpha='${processFlowAlphaExpr(start, activeStart, activeEnd, finalBrightAt, dim, duration)}'${revealEnable(start)}`, font);
}

function processFlowTextLines(value, x, y, size, color, start, activeStart, activeEnd, finalBrightAt, distance = 48, extra = "", font = "Helvetica", max = 24, duration = 0.52, lineStagger = 0) {
  return wrap(value, max)
    .split("\n")
    .filter(Boolean)
    .map((line, lineIndex) => processFlowText(line, x, y + lineIndex * (size + 18), size, color, start + lineIndex * lineStagger, activeStart, activeEnd, finalBrightAt, distance, extra, font, duration));
}

async function createDownArrowOverlay({
  tempDir,
  centerX,
  topY,
  height,
  color,
  start,
  index,
  fadeIn = 0.26,
  fadeOut = 0.32,
  exitStart,
  enterYOffset = 16,
  exitYOffset = 9,
  growDownDuration,
}) {
  const imageWidth = 64;
  const imageHeight = Math.max(52, Math.round(height));
  const x = Math.round(centerX - imageWidth / 2);
  const y = Math.round(topY);
  const stroke = svgColor(color);
  const midX = imageWidth / 2;
  const stemTop = 6;
  const tipY = imageHeight - 8;
  const stemBottom = tipY;
  const wingY = Math.max(stemTop + 18, tipY - 24);
  const wingSpan = 17;
  const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="${imageWidth}" height="${imageHeight}" viewBox="0 0 ${imageWidth} ${imageHeight}">
  <path d="M${midX} ${stemTop} V${stemBottom} M${midX - wingSpan} ${wingY} L${midX} ${tipY} L${midX + wingSpan} ${wingY}" fill="none" stroke="${stroke}" stroke-width="4.8" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke" shape-rendering="geometricPrecision"/>
</svg>`;
  const filePath = path.join(tempDir, `down-arrow-${index}.png`);
  await sharp(Buffer.from(svg), { density: 288 })
    .resize(imageWidth, imageHeight, { kernel: "lanczos3" })
    .png()
    .toFile(filePath);
  return {
    filePath,
    x,
    y,
    height: imageHeight,
    start,
    enterYOffset,
    exitYOffset,
    fadeIn,
    fadeOut,
    exitStart,
    growDownDuration,
    debugDownArrow: true,
    debugDownArrowCenterX: centerX,
    debugDownArrowTopY: topY,
    debugDownArrowHeight: imageHeight,
  };
}

async function createRoundedTextCardOverlay({
  tempDir,
  x,
  y,
  width,
  height,
  lines,
  fontSize,
  lineGap,
  color,
  start,
  index,
  paddingX = 30,
  paddingY = 28,
  radius = 20,
  fill = "#ffffff@0.05",
  stroke = "#e8e5dd@0.08",
  strokeWidth = 2,
  shadowPadding = 26,
  shadowDy = 12,
  shadowBlur = 13,
  shadowColor = "rgba(0,0,0,0.28)",
  fadeIn = 0.44,
  fadeOut = 0.32,
  exitStart,
  enterYOffset = 28,
  exitYOffset = 8,
}) {
  const cardWidth = Math.round(width);
  const cardHeight = Math.round(height);
  const imageWidth = cardWidth + shadowPadding * 2;
  const imageHeight = cardHeight + shadowPadding * 2 + Math.max(0, shadowDy);
  const cardX = shadowPadding;
  const cardY = shadowPadding;
  const shadowId = `cardTextShadow${index}`;
  const cardShadowId = `roundedCardShadow${index}`;
  const lineVisualBounds = lines.map((line) => measureUnifiedTextVisualBounds(line, fontSize, 400));
  const measuredTextWidth = Math.max(0, ...lineVisualBounds.map((bounds) => bounds.width));
  const textNodes = lines.map((line, lineIndex) => {
    const baselineY = cardY + paddingY + fontSize * 0.78 + lineIndex * (fontSize + lineGap);
    const bounds = lineVisualBounds[lineIndex] || { minX: 0 };
    if (INTER_VARIABLE_FONT) {
      const textPath = captionWordWallPathForText({
        value: line,
        x: cardX + paddingX - bounds.minX,
        baselineY,
        fontSize,
        fontWeight: 400,
        fill: svgColor(color),
        filterId: shadowId,
      });
      if (textPath) return textPath;
    }
    return `<text x="${cardX + paddingX}" y="${baselineY.toFixed(2)}" font-family="${UNIFIED_FONT_FAMILY}, Helvetica, Arial, sans-serif" font-size="${fontSize}" font-weight="400" fill="${svgColor(color)}" filter="url(#${shadowId})">${escapeXml(line)}</text>`;
  });
  const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="${imageWidth}" height="${imageHeight}" viewBox="0 0 ${imageWidth} ${imageHeight}">
  <defs>
    <filter id="${cardShadowId}" x="-18%" y="-18%" width="136%" height="150%">
      <feDropShadow dx="0" dy="${shadowDy}" stdDeviation="${shadowBlur}" flood-color="${shadowColor}"/>
    </filter>
    <filter id="${shadowId}" x="-12%" y="-60%" width="124%" height="220%">
      <feDropShadow dx="0" dy="4" stdDeviation="3" flood-color="rgba(0,0,0,0.68)"/>
    </filter>
  </defs>
  <rect x="${cardX + strokeWidth / 2}" y="${cardY + strokeWidth / 2}" width="${cardWidth - strokeWidth}" height="${cardHeight - strokeWidth}" rx="${radius}" ry="${radius}" fill="${svgColor(fill)}" stroke="${svgColor(stroke)}" stroke-width="${strokeWidth}" filter="url(#${cardShadowId})"/>
  ${textNodes.join("\n  ")}
</svg>`;
  const filePath = path.join(tempDir || os.tmpdir(), `rounded-text-card-${index}.png`);
  await sharp(Buffer.from(svg), { density: 288 })
    .resize(imageWidth, imageHeight, { kernel: "lanczos3" })
    .png()
    .toFile(filePath);
  return {
    filePath,
    x: Math.round(x - shadowPadding),
    y: Math.round(y - shadowPadding),
    width: imageWidth,
    height: imageHeight,
    start,
    enterYOffset,
    exitYOffset,
    fadeIn,
    fadeOut,
    exitStart,
    debugRoundedTextCard: true,
    debugRoundedTextCardRadius: radius,
    debugRoundedTextCardFill: fill,
    debugRoundedTextCardStroke: stroke,
    debugRoundedTextCardShadow: true,
    debugRoundedTextCardShadowColor: shadowColor,
    debugRoundedTextCardShadowDy: shadowDy,
    debugRoundedTextCardShadowBlur: shadowBlur,
    debugRoundedTextCardLines: lines,
    debugRoundedTextCardX: Math.round(x),
    debugRoundedTextCardY: Math.round(y),
    debugRoundedTextCardCenterX: Math.round(x + cardWidth / 2),
    debugRoundedTextCardWidth: cardWidth,
    debugRoundedTextCardHeight: cardHeight,
    debugRoundedTextCardImageWidth: imageWidth,
    debugRoundedTextCardImageHeight: imageHeight,
    debugRoundedTextCardPaddingX: paddingX,
    debugRoundedTextCardPaddingY: paddingY,
    debugRoundedTextCardTextWidth: measuredTextWidth,
    debugRoundedTextCardLeftPadding: paddingX,
    debugRoundedTextCardRightPadding: cardWidth - paddingX - measuredTextWidth,
    debugRoundedTextCardTextRenderMode: INTER_VARIABLE_FONT ? "fontkit-svg-paths" : "svg-text-fallback",
  };
}

const LUCIDE_ICON_PATHS = {
  circleCheck: [
    `<circle cx="12" cy="12" r="10"/>`,
    `<path d="m9 12 2 2 4-4"/>`,
  ],
  octagonX: [
    `<path d="M7.86 2h8.28L22 7.86v8.28L16.14 22H7.86L2 16.14V7.86L7.86 2z"/>`,
    `<path d="m15 9-6 6"/>`,
    `<path d="m9 9 6 6"/>`,
  ],
};

async function createLucideIconOverlay({
  tempDir,
  icon,
  centerX,
  topY,
  size,
  color,
  start,
  index,
  fadeIn = 0.28,
  fadeOut = 0.32,
  exitStart,
  enterYOffset = 16,
  exitYOffset = 8,
}) {
  const paths = LUCIDE_ICON_PATHS[icon] || LUCIDE_ICON_PATHS.circleCheck;
  const imageSize = Math.round(size);
  const x = Math.round(centerX - imageSize / 2);
  const y = Math.round(topY);
  const stroke = svgColor(color);
  // The dashboard UI uses shadcn/lucide React icons, but this renderer is an
  // FFmpeg process. Use lucide-equivalent SVG paths and rasterize via sharp.
  const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="${imageSize}" height="${imageSize}" viewBox="0 0 24 24">
  <g fill="none" stroke="${stroke}" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke">
    ${paths.join("\n    ")}
  </g>
</svg>`;
  const filePath = path.join(tempDir, `lucide-icon-${icon}-${index}.png`);
  await sharp(Buffer.from(svg), { density: 288 })
    .resize(imageSize, imageSize, { kernel: "lanczos3" })
    .png()
    .toFile(filePath);
  return { filePath, x, y, height: imageSize, start, enterYOffset, exitYOffset, fadeIn, fadeOut, exitStart };
}

async function createPieSliceOverlay({
  tempDir,
  centerX,
  centerY,
  radius,
  startAngle,
  endAngle,
  color,
  index,
  start,
  fadeIn = 0.34,
  fadeOut = 0.32,
  exitStart,
}) {
  const padding = 8;
  const imageSize = Math.round(radius * 2 + padding * 2);
  const localCenter = imageSize / 2;
  const startRad = (startAngle * Math.PI) / 180;
  const endRad = (endAngle * Math.PI) / 180;
  const startX = localCenter + radius * Math.cos(startRad);
  const startY = localCenter + radius * Math.sin(startRad);
  const endX = localCenter + radius * Math.cos(endRad);
  const endY = localCenter + radius * Math.sin(endRad);
  const largeArcFlag = endAngle - startAngle > 180 ? 1 : 0;
  const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="${imageSize}" height="${imageSize}" viewBox="0 0 ${imageSize} ${imageSize}">
  <path d="M${localCenter} ${localCenter} L${startX} ${startY} A${radius} ${radius} 0 ${largeArcFlag} 1 ${endX} ${endY} Z"
    fill="${svgColor(color)}"
    stroke="${svgColor("#e8e5dd@0.42")}"
    stroke-width="3"
    stroke-linejoin="round"/>
</svg>`;
  const filePath = path.join(tempDir, `pie-slice-${index}.png`);
  await sharp(Buffer.from(svg), { density: 288 })
    .resize(imageSize, imageSize, { kernel: "lanczos3" })
    .png()
    .toFile(filePath);
  return {
    filePath,
    x: Math.round(centerX - imageSize / 2),
    y: Math.round(centerY - imageSize / 2),
    height: imageSize,
    start,
    enterYOffset: 12,
    exitYOffset: 8,
    fadeIn,
    fadeOut,
    exitStart,
  };
}

function formatWithThousands(value) {
  const [whole, decimal = ""] = String(value).split(".");
  const formattedWhole = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return decimal ? `${formattedWhole}.${decimal}` : formattedWhole;
}

function animatedNumberFormatter(label) {
  const raw = asText(label);
  if (!raw) return null;
  const match = raw.match(/^(\s*[^0-9+\-.]*)([+-]?\d[\d,]*(?:\.\d+)?)(.*)$/);
  if (!match) return () => raw;
  const [, prefix, numericText, suffix] = match;
  const target = Number(numericText.replace(/,/g, ""));
  if (!Number.isFinite(target)) return () => raw;
  const decimals = numericText.includes(".") ? numericText.split(".").at(-1).length : 0;
  const useCommas = numericText.includes(",");
  const hasExplicitPlus = numericText.startsWith("+");
  return (progress) => {
    const clamped = clamp(progress, 0, 1);
    if (clamped >= 0.9995) return raw;
    const current = target * clamped;
    const rounded = decimals > 0 ? current.toFixed(decimals) : String(Math.round(current));
    const absFormatted = useCommas ? formatWithThousands(rounded.replace(/^-/, "")) : rounded.replace(/^-/, "");
    const sign = current < 0 ? "-" : hasExplicitPlus ? "+" : "";
    return `${prefix}${sign}${absFormatted}${suffix}`;
  };
}

function valueLabelWithUnits(valueLabel, units) {
  const label = asText(valueLabel);
  const cleanUnits = asText(units);
  if (!label || !cleanUnits) return label;
  const normalizedLabel = label.toLowerCase().replace(/\s+/g, " ").trim();
  const normalizedUnits = cleanUnits.toLowerCase().replace(/\s+/g, " ").trim();
  if (normalizedLabel.endsWith(` ${normalizedUnits}`) || normalizedLabel.endsWith(normalizedUnits)) return label;
  return `${label} ${cleanUnits}`;
}

function lineLength(points) {
  return points.slice(1).reduce((sum, point, index) => {
    const previous = points[index];
    return sum + Math.hypot(point.x - previous.x, point.y - previous.y);
  }, 0);
}

function partialPolylinePointsAtLength(points, targetLength) {
  if (points.length <= 1) return points;
  const totalLength = lineLength(points);
  const clampedTargetLength = clamp(targetLength, 0, totalLength);
  const partial = [{ ...points[0] }];
  let walked = 0;
  for (let index = 1; index < points.length; index += 1) {
    const previous = points[index - 1];
    const point = points[index];
    const segmentLength = Math.hypot(point.x - previous.x, point.y - previous.y);
    if (walked + segmentLength >= clampedTargetLength) {
      const segmentProgress = segmentLength <= 0 ? 1 : (clampedTargetLength - walked) / segmentLength;
      partial.push({
        x: previous.x + (point.x - previous.x) * segmentProgress,
        y: previous.y + (point.y - previous.y) * segmentProgress,
      });
      return partial;
    }
    partial.push({ ...point });
    walked += segmentLength;
  }
  return points.map((point) => ({ ...point }));
}

function partialPolylinePoints(points, progress) {
  const totalLength = lineLength(points);
  return partialPolylinePointsAtLength(points, Math.max(totalLength * 0.004, totalLength * clamp(progress, 0, 1)));
}

function retractPolylineEnd(points, distance) {
  const totalLength = lineLength(points);
  if (points.length <= 1 || totalLength <= 0) return points;
  return partialPolylinePointsAtLength(points, Math.max(2, totalLength - distance));
}

function lineTangent(points, fallbackPoints) {
  for (let index = points.length - 1; index > 0; index -= 1) {
    const current = points[index];
    const previous = points[index - 1];
    const dx = current.x - previous.x;
    const dy = current.y - previous.y;
    const length = Math.hypot(dx, dy);
    if (length > 0.001) return { x: dx / length, y: dy / length };
  }
  if (fallbackPoints.length > 1) {
    return lineTangent(fallbackPoints.slice(0, 2), []);
  }
  return { x: 1, y: 0 };
}

function arrowHeadPolygonPoints(tip, tangent, length, halfHeight, scale) {
  const scaledLength = length * scale;
  const scaledHalfHeight = halfHeight * scale;
  const perpendicular = { x: -tangent.y, y: tangent.x };
  const baseCenter = {
    x: tip.x - tangent.x * scaledLength,
    y: tip.y - tangent.y * scaledLength,
  };
  const left = {
    x: baseCenter.x + perpendicular.x * scaledHalfHeight,
    y: baseCenter.y + perpendicular.y * scaledHalfHeight,
  };
  const right = {
    x: baseCenter.x - perpendicular.x * scaledHalfHeight,
    y: baseCenter.y - perpendicular.y * scaledHalfHeight,
  };
  return [tip, left, right].map((point) => `${point.x.toFixed(1)},${point.y.toFixed(1)}`).join(" ");
}

function axisChevronPoints(axis, tip, length, spread) {
  if (axis === "x") {
    return [
      { x: tip.x - length, y: tip.y - spread },
      tip,
      { x: tip.x - length, y: tip.y + spread },
    ].map((point) => `${point.x.toFixed(1)},${point.y.toFixed(1)}`).join(" ");
  }
  return [
    { x: tip.x - spread, y: tip.y + length },
    tip,
    { x: tip.x + spread, y: tip.y + length },
  ].map((point) => `${point.x.toFixed(1)},${point.y.toFixed(1)}`).join(" ");
}

function opaqueColorOnBlack(value) {
  const raw = String(value || "#ffffff");
  const match = raw.match(/^#([0-9a-fA-F]{2})([0-9a-fA-F]{2})([0-9a-fA-F]{2})(?:@([0-9.]+))?$/);
  if (!match) return raw.replace(/@.*$/, "");
  const [, r, g, b, alpha] = match;
  if (alpha === undefined) return `#${r}${g}${b}`;
  const opacity = Math.max(0, Math.min(1, Number(alpha)));
  const toHex = (channel) => Math.round(parseInt(channel, 16) * opacity).toString(16).padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

async function createLineGrowthOverlay({
  tempDir,
  x,
  y,
  width,
  height,
  points,
  color,
  index,
  start,
  growRightDuration = 0.82,
  fadeOut = 0.32,
  exitStart,
  debugChartOrigin,
  debugChartCentering,
  valueLabel = "",
}) {
  const arrowMarkerWidth = 70;
  const arrowMarkerHeight = 42;
  const arrowTipToBaseLength = 57.5;
  const arrowHalfHeight = 16;
  const arrowIntroDuration = 1;
  const axisGrowDuration = 2;
  const axisArrowFadeInDuration = 0.3;
  const axisArrowLength = 15;
  const axisArrowSpread = 8;
  const gridStartOffset = 0;
  const gridLineCountPerAxis = 4;
  const gridTotalDuration = 3;
  const gridLineStagger = 0.4;
  const verticalGridStartDelay = gridLineStagger * 2;
  const gridLineGrowDuration = gridTotalDuration - verticalGridStartDelay - (gridLineCountPerAxis - 1) * gridLineStagger;
  const primaryLineStartOffset = gridStartOffset + 1;
  const valueLabelFadeInDuration = 1;
  const lineEndRetraction = 30;
  const leftPadding = 64;
  const topPadding = 116;
  const bottomPadding = 30;
  const renderWidth = width + leftPadding;
  const renderHeight = height + topPadding + bottomPadding;
  const opaqueColor = opaqueColorOnBlack(color);
  const stroke = svgColor(opaqueColor);
  const shadow = "rgba(0, 0, 0, 0.34)";
  const framesDir = path.join(tempDir, `line-growth-${index}-frames`);
  fs.mkdirSync(framesDir, { recursive: true });
  const renderPoints = points.map((point) => ({ x: point.x + leftPadding, y: point.y + topPadding }));
  const plotMinX = Math.min(...points.map((point) => point.x));
  const plotMaxX = Math.max(...points.map((point) => point.x));
  const plotMinY = Math.min(...points.map((point) => point.y));
  const plotMaxY = Math.max(...points.map((point) => point.y));
  const axisColor = svgColor(UNIFIED_PALETTE.faintGrey);
  const clipX = leftPadding + plotMinX;
  const clipBottomY = topPadding + plotMaxY;
  const axisTopY = topPadding + plotMinY;
  const axisBottomY = topPadding + plotMaxY;
  const axisLeftX = leftPadding + plotMinX;
  const axisRightX = leftPadding + plotMaxX;
  const axisW = axisRightX - axisLeftX;
  const axisH = axisBottomY - axisTopY;
  const sequenceDuration = primaryLineStartOffset + growRightDuration;
  const frameCount = Math.max(2, Math.ceil(sequenceDuration * FPS) + 1);
  const valueFormatter = animatedNumberFormatter(valueLabel);
  const frameFiles = [];
  let firstTip;
  let finalTip;
  let finalLineEnd;

  for (let frameIndex = 0; frameIndex < frameCount; frameIndex += 1) {
    const localTime = frameIndex / FPS;
    const lineRawProgress = clamp((localTime - primaryLineStartOffset) / growRightDuration, 0, 1);
    const eased = lineRawProgress * lineRawProgress * lineRawProgress;
    const lineActive = localTime >= primaryLineStartOffset;
    const partialPoints = lineActive ? partialPolylinePoints(renderPoints, eased) : [renderPoints[0]];
    const tip = partialPoints[partialPoints.length - 1] || renderPoints[0];
    const linePoints = lineActive ? retractPolylineEnd(partialPoints, lineEndRetraction) : [];
    const lineEnd = linePoints[linePoints.length - 1] || tip;
    if (frameIndex === 0) firstTip = { ...tip };
    if (lineRawProgress >= 1 || frameIndex === frameCount - 1) {
      finalTip = { ...tip };
      finalLineEnd = { ...lineEnd };
    }
    const pointList = linePoints.map((point) => `${point.x.toFixed(1)},${point.y.toFixed(1)}`).join(" ");
    const axisProgress = clamp(localTime / axisGrowDuration, 0, 1);
    const axisEased = axisProgress * axisProgress * (3 - 2 * axisProgress);
    const axisArrowOpacityProgress = clamp(localTime / axisArrowFadeInDuration, 0, 1);
    const axisArrowOpacity = axisArrowOpacityProgress * axisArrowOpacityProgress * (3 - 2 * axisArrowOpacityProgress);
    const currentXAxisEndX = axisLeftX + axisW * axisEased;
    const currentYAxisEndY = axisBottomY - axisH * axisEased;
    const xAxisArrowPoints = axisChevronPoints("x", { x: currentXAxisEndX, y: axisBottomY }, axisArrowLength, axisArrowSpread);
    const yAxisArrowPoints = axisChevronPoints("y", { x: axisLeftX, y: currentYAxisEndY }, axisArrowLength, axisArrowSpread);
    const arrowIntroProgress = clamp((localTime - primaryLineStartOffset) / arrowIntroDuration, 0, 1);
    const arrowIntroEased = arrowIntroProgress * arrowIntroProgress * (3 - 2 * arrowIntroProgress);
    const valueLabelFadeProgress = clamp((localTime - primaryLineStartOffset) / valueLabelFadeInDuration, 0, 1);
    const valueLabelOpacity = valueLabelFadeProgress * valueLabelFadeProgress * (3 - 2 * valueLabelFadeProgress);
    const currentLineLength = lineLength(partialPoints);
    const arrowScale = Math.min(arrowIntroEased, clamp(currentLineLength / arrowTipToBaseLength, 0, 1));
    const tangent = lineTangent(partialPoints, renderPoints);
    const arrowPoints = arrowHeadPolygonPoints(tip, tangent, arrowTipToBaseLength, arrowHalfHeight, arrowScale);
    const gridLineColor = svgColor("#e8e5dd@0.16");
    const gridLines = [];
    for (let gridIndex = 1; gridIndex <= gridLineCountPerAxis; gridIndex += 1) {
      const horizontalStart = gridStartOffset + (gridIndex - 1) * gridLineStagger;
      const horizontalProgress = clamp((localTime - horizontalStart) / gridLineGrowDuration, 0, 1);
      const horizontalEased = horizontalProgress * horizontalProgress * (3 - 2 * horizontalProgress);
      const horizontalY = axisBottomY - (axisH * gridIndex) / 5;
      const horizontalX2 = axisLeftX + axisW * horizontalEased;
      gridLines.push(`<line x1="${axisLeftX.toFixed(1)}" y1="${horizontalY.toFixed(1)}" x2="${horizontalX2.toFixed(1)}" y2="${horizontalY.toFixed(1)}" stroke="${gridLineColor}" stroke-width="2" stroke-linecap="butt" opacity="${(horizontalEased * 0.72).toFixed(4)}"/>`);

      const verticalStart = gridStartOffset + verticalGridStartDelay + (gridIndex - 1) * gridLineStagger;
      const verticalProgress = clamp((localTime - verticalStart) / gridLineGrowDuration, 0, 1);
      const verticalEased = verticalProgress * verticalProgress * (3 - 2 * verticalProgress);
      const verticalX = axisLeftX + (axisW * gridIndex) / 5;
      const verticalY2 = axisBottomY - axisH * verticalEased;
      gridLines.push(`<line x1="${verticalX.toFixed(1)}" y1="${axisBottomY.toFixed(1)}" x2="${verticalX.toFixed(1)}" y2="${verticalY2.toFixed(1)}" stroke="${gridLineColor}" stroke-width="2" stroke-linecap="butt" opacity="${(verticalEased * 0.64).toFixed(4)}"/>`);
    }
    const counterText = valueFormatter ? valueFormatter(eased) : "";
    const maxCounterWidth = renderWidth - 24;
    const baseCounterFontSize = 46;
    const baseCounterWidth = estimateWordWidth(counterText, baseCounterFontSize);
    const counterFontSize = counterText
      ? clamp(Math.floor(baseCounterFontSize * Math.min(1, maxCounterWidth / Math.max(1, baseCounterWidth))), 24, baseCounterFontSize)
      : baseCounterFontSize;
    const estimatedCounterWidth = Math.min(maxCounterWidth, Math.max(44, estimateWordWidth(counterText, counterFontSize)));
    const counterRightX = Math.min(renderWidth - 12, Math.max(axisLeftX + estimatedCounterWidth + 14, tip.x + 42));
    const counterSvg = counterText
      ? `<text x="${counterRightX.toFixed(1)}" y="${clamp(tip.y - 52, 48, renderHeight - 24).toFixed(1)}" text-anchor="end" font-family="${UNIFIED_FONT_FAMILY}, Helvetica, Arial, sans-serif" font-size="${counterFontSize}" font-weight="400" fill="${svgColor(UNIFIED_PALETTE.offWhite)}" fill-opacity="${valueLabelOpacity.toFixed(4)}" filter="url(#valueShadow)">${escapeXml(counterText)}</text>`
      : "";
    const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="${renderWidth}" height="${renderHeight}" viewBox="0 0 ${renderWidth} ${renderHeight}">
  <defs>
    <clipPath id="lineClip">
      <rect x="${clipX.toFixed(1)}" y="0" width="${Math.max(1, renderWidth - clipX).toFixed(1)}" height="${clipBottomY.toFixed(1)}"/>
    </clipPath>
    <filter id="valueShadow" x="-30%" y="-80%" width="160%" height="220%">
      <feDropShadow dx="0" dy="4" stdDeviation="0" flood-color="rgba(0, 0, 0, 0.72)"/>
    </filter>
  </defs>
  <g clip-path="url(#lineClip)">
    ${gridLines.join("\n    ")}
  </g>
  <g clip-path="url(#lineClip)">
    ${pointList ? `<polyline points="${pointList}" fill="none" stroke="${shadow}" stroke-width="13" stroke-linecap="round" stroke-linejoin="round" transform="translate(0 7)"/>` : ""}
    ${pointList ? `<polyline points="${pointList}" fill="none" stroke="${stroke}" stroke-width="10" stroke-linecap="round" stroke-linejoin="round"/>` : ""}
    ${lineActive ? `<polygon points="${arrowPoints}" fill="${stroke}" fill-opacity="${arrowIntroEased.toFixed(4)}"/>` : ""}
  </g>
  <line x1="${axisLeftX.toFixed(1)}" y1="${axisBottomY.toFixed(1)}" x2="${currentXAxisEndX.toFixed(1)}" y2="${axisBottomY.toFixed(1)}" stroke="${axisColor}" stroke-width="4" stroke-linecap="butt"/>
  <line x1="${axisLeftX.toFixed(1)}" y1="${axisBottomY.toFixed(1)}" x2="${axisLeftX.toFixed(1)}" y2="${currentYAxisEndY.toFixed(1)}" stroke="${axisColor}" stroke-width="4" stroke-linecap="butt"/>
  <polyline points="${xAxisArrowPoints}" fill="none" stroke="${axisColor}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" opacity="${axisArrowOpacity.toFixed(4)}"/>
  <polyline points="${yAxisArrowPoints}" fill="none" stroke="${axisColor}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" opacity="${axisArrowOpacity.toFixed(4)}"/>
  ${counterSvg}
</svg>`;
    const framePath = path.join(framesDir, `frame-${String(frameIndex).padStart(5, "0")}.png`);
    await sharp(Buffer.from(svg), { density: 288 })
      .resize(renderWidth, renderHeight, { kernel: "lanczos3" })
      .png()
      .toFile(framePath);
    frameFiles.push(framePath);
  }
  const filePath = path.join(framesDir, `frame-${String(frameCount - 1).padStart(5, "0")}.png`);
  return {
    filePath,
    framePattern: path.join(framesDir, "frame-%05d.png"),
    frameFiles,
    framesDir,
    x: x - leftPadding,
    y: y - topPadding,
    width: renderWidth,
    height: renderHeight,
    start,
    fadeIn: 0,
    fadeOut,
    exitStart,
    growRightDuration,
    frameSequenceDuration: sequenceDuration,
    debugChartOrigin,
    debugLineStart: points[0] ? { x: x + points[0].x, y: y + points[0].y } : undefined,
    debugLineCap: "round",
    debugLineColor: opaqueColor,
    debugArrowIntroDuration: arrowIntroDuration,
    debugValueLabelFadeInDuration: valueLabelFadeInDuration,
    debugArrowIntroStartsAt: start + primaryLineStartOffset,
    debugValueLabelFadeInStartsAt: start + primaryLineStartOffset,
    debugAxisGrowDuration: axisGrowDuration,
    debugAxisArrowheadCount: 2,
    debugAxisArrowheadStyle: "stroke-chevron",
    debugAxisArrowheadFadeInDuration: axisArrowFadeInDuration,
    debugAxisArrowheadsMoveWithAxes: true,
    debugAxesAnimationDirections: { x: "left-to-right", y: "bottom-to-top" },
    debugLineEndRetraction: lineEndRetraction,
    debugArrowMarkerCount: 1,
    debugArrowMarkerSize: { width: arrowMarkerWidth, height: arrowMarkerHeight },
    debugArrowHalfHeight: arrowHalfHeight,
    debugGridLineCount: gridLineCountPerAxis * 2,
    debugGridLinesBehindGraphAndAxes: true,
    debugGridLineAnimationDirections: { horizontal: "left-to-right-from-y-axis", vertical: "bottom-to-top-from-x-axis" },
    debugGridLineStaggerOrder: { horizontal: "bottom-to-top", vertical: "left-to-right" },
    debugGridStartOffset: gridStartOffset,
    debugGridTotalDuration: gridTotalDuration,
    debugGridLineStagger: gridLineStagger,
    debugGridLineGrowDuration: gridLineGrowDuration,
    debugVerticalGridStartsAfterHorizontalLineCount: 2,
    debugGridLinesStartAfterAxes: false,
    debugGridStartsWithAxes: gridStartOffset === 0,
    debugGridStartsWhenAxesHalfwayDone: false,
    debugPrimaryLineStartOffset: primaryLineStartOffset,
    debugPrimaryLineStartsAfterGrid: false,
    debugPrimaryLineStartDelayAfterGridStart: primaryLineStartOffset - gridStartOffset,
    debugPrimaryLineOverlapsGrid: primaryLineStartOffset < gridStartOffset + gridTotalDuration,
    debugPrimaryLineEasing: "ease-in-cubic",
    debugArrowAndCounterUsePrimaryLineEasing: true,
    debugPlotArea: { width: axisW, height: axisH, isSquare: axisW === axisH },
    debugChartCentering,
    debugAxesOverlayAboveLine: true,
    debugLineClipPreventsLeftAndBottomOverflow: true,
    debugLineClipEdges: { minX: plotMinX, maxY: plotMaxY },
    debugValueLabelPresent: Boolean(valueFormatter),
    debugValueLabelTarget: valueLabel || undefined,
    debugFrameCount: frameCount,
    debugFirstTip: firstTip ? { x: firstTip.x - leftPadding, y: firstTip.y - topPadding } : undefined,
    debugFinalTip: finalTip ? { x: finalTip.x - leftPadding, y: finalTip.y - topPadding } : undefined,
    debugFinalLineEnd: finalLineEnd ? { x: finalLineEnd.x - leftPadding, y: finalLineEnd.y - topPadding } : undefined,
    debugRenderPadding: { left: leftPadding, top: topPadding, bottom: bottomPadding },
    debugPoints: points,
  };
}

function wrap(value, max = 24) {
  const words = asText(value).split(/\s+/).filter(Boolean);
  const lines = [];
  let line = "";
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (next.length > max && line) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  return lines.slice(0, 4).join("\n");
}

function compactTimelineLabelLine(line, maxChars) {
  if (line.length <= maxChars) return line;
  if (maxChars <= 3) return line.slice(0, maxChars);
  return `${line.slice(0, maxChars - 3)}...`;
}

function timelineLabelLayout(value) {
  const maxCharsPerLine = 8;
  const maxLines = 2;
  let lines = wrap(value, maxCharsPerLine).split("\n").filter(Boolean);
  if (lines.length === 0) lines = ["01"];
  const hadOverflow = lines.length > maxLines || lines.some((line) => line.length > maxCharsPerLine + 2);
  lines = lines.slice(0, maxLines).map((line) => compactTimelineLabelLine(line, maxCharsPerLine));
  if (hadOverflow && lines.length > 0 && !lines[lines.length - 1].endsWith("...")) {
    lines[lines.length - 1] = compactTimelineLabelLine(`${lines[lines.length - 1]}...`, maxCharsPerLine);
  }
  const longestLineLength = Math.max(...lines.map((line) => line.length));
  const fontSize = lines.length > 1 ? 26 : longestLineLength >= 7 ? 30 : longestLineLength >= 6 ? 34 : 38;
  const lineGap = lines.length > 1 ? 6 : 0;
  const blockHeight = lines.length * fontSize + Math.max(0, lines.length - 1) * lineGap;
  return { lines, fontSize, lineGap, blockHeight };
}

function baseFilters(stylePreset) {
  void stylePreset;
  return [];
}

function statReveal(args, stylePreset, overlayInputs) {
  void overlayInputs;
  const valueStart = timingValue(args, ["value", "stat", "number"], 0.72);
  const titleStart = timingValue(args, "title", 1.12);
  const titleRevealDuration = 0.54;
  const valueStyle = STAT_REVEAL_TEXT_STYLE.value;
  const titleStyle = STAT_REVEAL_TEXT_STYLE.title;
  return [
    ...baseFilters(stylePreset),
    animatedUnifiedText(args.value || "73%", 124, 564, valueStyle.fontSize, valueStyle.color, valueStart, 58, textShadow(valueStyle.shadowOpacity, valueStyle.shadowOffsetY), 0.66),
    ...animatedUnifiedTextLines(args.title || "people notice the change", 132, 804, titleStyle.fontSize, titleStyle.color, titleStart, titleStyle.maxChars, titleStyle.lineGap, 52),
    ...animatedHorizontalRule(132, 1064, 616, 4, UNIFIED_PALETTE.faintGrey, titleStart, titleRevealDuration),
  ];
}

function barChart(args, stylePreset, overlayInputs) {
  void overlayInputs;
  const data = asData(args.data).slice(0, 5);
  const max = Math.max(1, ...data.map((item) => Math.abs(item.value)));
  const firstRevealAt = 0.36;
  const titleRevealDuration = 0.3;
  const barRevealDuration = 0.4;
  const barGapAfterReveal = 0.3;
  const revealSlotCount = Math.max(1, data.length);
  const titleRevealAt = timingValue(args, "title", firstRevealAt);
  const barRevealTimes = data.map((item, index) =>
    itemTiming(args, "data", item, index, fixedRevealTiming(index, { firstRevealAt, revealDuration: barRevealDuration, gapAfterReveal: barGapAfterReveal }).revealAt, ["bars", "bar", "items"]),
  );
  const lastRevealFinish = Math.max(
    firstRevealAt + (revealSlotCount - 1) * (barRevealDuration + barGapAfterReveal) + barRevealDuration,
    titleRevealAt + titleRevealDuration,
    ...barRevealTimes.map((revealAt) => revealAt + barRevealDuration),
  );
  const barBaseY = 1398;
  const barMaxH = 610;
  const gap = data.length <= 3 ? 64 : 42;
  const barW = Math.floor((820 - gap * Math.max(0, data.length - 1)) / Math.max(1, data.length));
  const accents = [UNIFIED_PALETTE.mutedBlue, UNIFIED_PALETTE.mutedSage, UNIFIED_PALETTE.mutedPeach, UNIFIED_PALETTE.mutedLavender, "#d7d2c9@0.66"];
  const filters = [
    ...baseFilters(stylePreset),
    ...animatedUnifiedTextLines(args.title || "What changed most", 124, 260, 62, UNIFIED_PALETTE.offWhite, titleRevealAt, 22, 18, 46, "", titleRevealDuration, 0, titleRevealDuration),
    ...animatedHorizontalRule(124, barBaseY + 22, 832, 3, UNIFIED_PALETTE.faintGrey, titleRevealAt, Math.max(0.1, lastRevealFinish - titleRevealAt)),
  ];
  data.forEach((item, i) => {
    const timing = fixedRevealTiming(i, { firstRevealAt, revealDuration: barRevealDuration, gapAfterReveal: barGapAfterReveal });
    timing.revealAt = barRevealTimes[i] ?? timing.revealAt;
    const x = 130 + i * (barW + gap);
    const centerX = x + barW / 2;
    const h = Math.max(40, Math.round((Math.abs(item.value) / max) * barMaxH));
    const valueY = barBaseY - h - 72;
    filters.push(...animatedBar(x, barBaseY, barW, h, accents[i % accents.length], timing.revealAt, timing.revealDuration));
    filters.push(...animatedUnifiedRisingCenteredText(item.displayValue || String(item.value), centerX, valueY, h, 34, UNIFIED_PALETTE.offWhite, timing.revealAt, textShadow(0.7, 3), timing.revealDuration));
    filters.push(...animatedUnifiedCenteredTextLines(item.label, centerX, barBaseY + 76, 28, UNIFIED_PALETTE.softGrey, timing.revealAt, 9, 9, "", timing.revealDuration, 0));
  });
  return filters;
}

async function pieChart(args, stylePreset, overlayInputs) {
  const data = asData(args.data).slice(0, 5);
  const rows = data.length > 0 ? data : [
    { label: "A", value: 35, displayValue: "35%" },
    { label: "B", value: 25, displayValue: "25%" },
    { label: "C", value: 40, displayValue: "40%" },
  ];
  const positiveRows = rows
    .map((item) => ({ ...item, value: Math.max(0, Math.abs(item.value)) }))
    .filter((item) => item.value > 0);
  const slices = positiveRows.length > 0 ? positiveRows : [{ label: "A", value: 1, displayValue: "100%" }];
  const total = slices.reduce((sum, item) => sum + item.value, 0);
  const accents = [UNIFIED_PALETTE.mutedBlue, UNIFIED_PALETTE.mutedSage, UNIFIED_PALETTE.mutedPeach, UNIFIED_PALETTE.mutedLavender, "#d7d2c9@0.78"];
  const firstRevealAt = 0.58;
  const sliceRevealDuration = 0.34;
  const sliceGapAfterReveal = 0.16;
  const titleRevealAt = timingValue(args, "title", 0.36);
  const chartCenterX = 540;
  const chartCenterY = 805;
  const radius = 284;
  const legendX = 166;
  const legendValueRightX = 914;
  const legendStartY = 1214;
  const legendGap = slices.length <= 3 ? 100 : 82;
  const legendTextSize = 36;
  const legendSwatchSize = Math.round(28 * (4 / 3));
  const legendTextVisibleHeight = Math.round(legendTextSize * 0.72);
  const legendSwatchOffsetY = Math.round((legendTextVisibleHeight - legendSwatchSize) / 2);
  const filters = [
    ...baseFilters(stylePreset),
    ...animatedUnifiedTextLines(args.title || "What changed most", 124, 260, 62, UNIFIED_PALETTE.offWhite, titleRevealAt, 22, 18, 46, "", 0.42, 0, 0.34),
  ];
  const sliceOverlayPromises = [];

  let currentAngle = -90;
  slices.forEach((item, index) => {
    const angle = index === slices.length - 1
      ? 270
      : currentAngle + (item.value / total) * 360;
    const timing = fixedRevealTiming(index, { firstRevealAt, revealDuration: sliceRevealDuration, gapAfterReveal: sliceGapAfterReveal });
    timing.revealAt = itemTiming(args, "data", item, index, timing.revealAt, ["slices", "slice", "items"]);
    sliceOverlayPromises.push(createPieSliceOverlay({
      tempDir: overlayInputs.tempDir,
      centerX: chartCenterX,
      centerY: chartCenterY,
      radius,
      startAngle: currentAngle,
      endAngle: angle,
      color: accents[index % accents.length],
      index,
      start: timing.revealAt,
      fadeIn: timing.revealDuration,
      exitStart: Math.max(2.5, (overlayInputs.duration || 6) - 0.7),
    }));

    const y = legendStartY + index * legendGap;
    filters.push(box(legendX, y + legendSwatchOffsetY, legendSwatchSize, legendSwatchSize, accents[index % accents.length], revealEnable(timing.revealAt)));
    filters.push(animatedUnifiedTextSlideDown(item.label, legendX + 62, y, legendTextSize, UNIFIED_PALETTE.offWhite, timing.revealAt + 0.08, 24, "", 0.34, 0.28));
    filters.push(animatedUnifiedRightAlignedTextSlideDown(item.displayValue || `${Math.round((item.value / total) * 100)}%`, legendValueRightX, y, legendTextSize, UNIFIED_PALETTE.dimGrey, timing.revealAt + 0.08, 24, "", 0.34, 0.28));
    currentAngle = angle;
  });

  overlayInputs.push(...await Promise.all(sliceOverlayPromises));
  return filters;
}

async function lineGrowthChart(args, stylePreset, overlayInputs) {
  const direction = chartDirection(args.direction);
  const fallbackRows = direction === "decrease"
    ? [
        { label: "Start", value: 86, displayValue: "86" },
        { label: "Week 2", value: 48, displayValue: "48" },
        { label: "Now", value: 22, displayValue: "22" },
      ]
    : [
        { label: "Start", value: 22, displayValue: "22" },
        { label: "Week 2", value: 48, displayValue: "48" },
        { label: "Now", value: 86, displayValue: "86" },
      ];
  const data = asData(args.data || args.points).slice(0, 6);
  const rows = data.length >= 2 ? data : fallbackRows;
  const chartY = 590;
  const chartW = 788;
  const chartH = chartW;
  const pad = 40;
  const axisW = chartW - pad * 2;
  const axisH = chartH - pad * 2;
  const axisX = WIDTH / 2 - axisW / 2;
  const axisY = chartY + chartH - pad;
  const lineDrawInDuration = 3;
  const startLabel = asText(args.startLabel || rows[0]?.label, "Start");
  const endLabel = asText(args.endLabel || rows[rows.length - 1]?.label, "Now");
  const valueLabel = Object.prototype.hasOwnProperty.call(args, "valueLabel")
    ? valueLabelWithUnits(args.valueLabel, args.units)
    : "";
  const title = asText(args.title, direction === "decrease" ? "Decline trend" : "Growth trend");
  const accent = direction === "decrease" ? UNIFIED_PALETTE.mutedPeach : UNIFIED_PALETTE.mutedSage;
  const titleRevealAt = timingValue(args, "title", 0.36);
  const chartRevealAt = timingValue(args, ["chart", "line", "trend"], 0.88);
  const xAxisLabelRevealAt = chartRevealAt + 0.84;
  const xAxisLabelRevealDuration = 0.42;
  const xAxisLabelSlideDistance = 14;
  const bendX = axisW * 0.66;
  const steepenedSecondSegmentRatio = 0.728;
  const points = direction === "decrease"
    ? [
        { x: 0, y: 0 },
        { x: bendX, y: axisH * (1 - steepenedSecondSegmentRatio) },
        { x: axisW, y: axisH },
      ]
    : [
        { x: 0, y: axisH },
        { x: bendX, y: axisH * steepenedSecondSegmentRatio },
        { x: axisW, y: 0 },
      ];
  const filters = [
    ...baseFilters(stylePreset),
    ...animatedUnifiedTextLines(title, 124, 260, 62, UNIFIED_PALETTE.offWhite, titleRevealAt, 22, 18, 46, "", 0.42, 0, 0.34),
    animatedUnifiedTextSlideUp(startLabel, axisX, axisY + 58, 30, UNIFIED_PALETTE.dimGrey, xAxisLabelRevealAt, xAxisLabelSlideDistance, textShadow(0.58, 3), xAxisLabelRevealDuration, xAxisLabelRevealDuration),
    animatedUnifiedRightAlignedTextSlideUp(endLabel, axisX + axisW, axisY + 58, 30, UNIFIED_PALETTE.dimGrey, xAxisLabelRevealAt + 0.08, xAxisLabelSlideDistance, textShadow(0.58, 3), xAxisLabelRevealDuration, xAxisLabelRevealDuration),
  ];

  overlayInputs.push(await createLineGrowthOverlay({
    tempDir: overlayInputs.tempDir,
    x: axisX,
    y: chartY + pad,
    width: axisW + 36,
    height: axisH + 24,
    points,
    color: accent,
    index: "main",
    start: chartRevealAt,
    growRightDuration: lineDrawInDuration,
    exitStart: Math.max(2.5, (overlayInputs.duration || 6) - 0.35),
    debugChartOrigin: { x: axisX, y: axisY },
    debugChartCentering: {
      frameCenterX: WIDTH / 2,
      plotLeftX: axisX,
      plotRightX: axisX + axisW,
      plotCenterX: axisX + axisW / 2,
      isHorizontallyCentered: Math.abs(axisX + axisW / 2 - WIDTH / 2) < 0.01,
    },
    valueLabel,
  }));
  return filters;
}

const COMPARISON_TIMING = {
  beforeStart: 1.08,
  beforeCopyOffset: 0.22,
  labelRevealDuration: 0.52,
  copyRevealDuration: 0.54,
  copyLineStagger: 0.045,
  afterDelayAfterBeforeFinish: 1,
  copyMaxChars: 13,
};

function comparisonWrappedLineCount(value, maxChars = COMPARISON_TIMING.copyMaxChars) {
  return Math.max(1, wrap(value, maxChars).split("\n").filter(Boolean).length);
}

function comparisonRevealTiming(args = {}) {
  const beforeText = args.before || "Problem state";
  const beforeCopyStart = COMPARISON_TIMING.beforeStart + COMPARISON_TIMING.beforeCopyOffset;
  const beforeCopyLineCount = comparisonWrappedLineCount(beforeText);
  const beforeLabelFinish = COMPARISON_TIMING.beforeStart + COMPARISON_TIMING.labelRevealDuration;
  const beforeCopyFinish = beforeCopyStart
    + Math.max(0, beforeCopyLineCount - 1) * COMPARISON_TIMING.copyLineStagger
    + COMPARISON_TIMING.copyRevealDuration;
  const beforeFinish = Math.max(beforeLabelFinish, beforeCopyFinish);
  const afterStart = beforeFinish + COMPARISON_TIMING.afterDelayAfterBeforeFinish;
  return {
    beforeStart: COMPARISON_TIMING.beforeStart,
    beforeCopyStart,
    beforeFinish,
    afterStart,
    afterCopyStart: afterStart + COMPARISON_TIMING.beforeCopyOffset,
    afterDelayAfterBeforeFinish: COMPARISON_TIMING.afterDelayAfterBeforeFinish,
    beforeCopyLineCount,
  };
}

function comparison(args, stylePreset, overlayInputs) {
  void overlayInputs;
  const timing = {
    ...comparisonRevealTiming(args),
  };
  const beforeOverride = timingValue(args, "before", timing.beforeStart);
  const afterOverride = timingValue(args, "after", timing.afterStart);
  timing.beforeStart = beforeOverride;
  timing.beforeCopyStart = beforeOverride + COMPARISON_TIMING.beforeCopyOffset;
  timing.afterStart = afterOverride;
  timing.afterCopyStart = afterOverride + COMPARISON_TIMING.beforeCopyOffset;
  return [
    ...baseFilters(stylePreset),
    animatedVerticalRule(538, 574, 720, UNIFIED_PALETTE.faintGrey, 0.92, 4),
    animatedUnifiedText(args.beforeLabel || "Before", 126, 612, 42, UNIFIED_PALETTE.dimGrey, timing.beforeStart, 32),
    ...animatedUnifiedTextLines(args.before || "Problem state", 126, 740, 56, UNIFIED_PALETTE.offWhite, timing.beforeCopyStart, COMPARISON_TIMING.copyMaxChars, 17, 44),
    animatedUnifiedText(args.afterLabel || "After", 600, 612, 42, UNIFIED_PALETTE.dimGrey, timing.afterStart, 32),
    ...animatedUnifiedTextLines(args.after || "Improved state", 600, 740, 56, UNIFIED_PALETTE.offWhite, timing.afterCopyStart, COMPARISON_TIMING.copyMaxChars, 17, 44),
  ];
}

function timeline(args, stylePreset, overlayInputs) {
  void overlayInputs;
  const steps = asTimelineSteps(args.steps, ["Setup", "Signal", "Visible change"]).slice(0, 5);
  const firstRevealAt = 0.64;
  // Fixed, duration-independent timing: each step reveals for 360ms, then the next step starts 300ms later.
  const stepRevealDuration = 0.36;
  const gapAfterStepReveal = 0.3;
  const stepRevealTimes = steps.map((step, index) =>
    itemTiming(args, "steps", step, index, fixedRevealTiming(index, { firstRevealAt, revealDuration: stepRevealDuration, gapAfterReveal: gapAfterStepReveal }).revealAt, ["items", "timeline"]),
  );
  const firstStepRevealAt = Math.min(...stepRevealTimes, firstRevealAt);
  const lastRevealFinish = Math.max(
    firstRevealAt + (steps.length - 1) * (stepRevealDuration + gapAfterStepReveal) + stepRevealDuration,
    ...stepRevealTimes.map((revealAt) => revealAt + stepRevealDuration),
  );
  const stepGap = steps.length <= 3 ? 266 : steps.length === 4 ? 218 : 180;
  const stepFontSize = steps.length <= 3 ? 54 : 48;
  const stepTextTopOffset = -14;
  const stepTextMaxChars = 24;
  const stepTextLineGap = 16;
  const stepSlideDistance = 44;
  const ruleH = 4;
  const ruleW = 62;
  const verticalRuleW = 4;
  const verticalRuleX = 260;
  const stepTextX = 338;
  const verticalRuleCenterX = verticalRuleX + verticalRuleW / 2;
  const ruleX = Math.round(verticalRuleCenterX - ruleW / 2);
  const labelSafeGap = 26;
  const labelRightX = ruleX - labelSafeGap;
  const labelCenterOffset = stepTextTopOffset + stepFontSize / 2 - 2;
  const labelLayouts = steps.map((step) => timelineLabelLayout(step.label));
  const lineCounts = steps.map((step) => Math.max(1, wrap(step.text, stepTextMaxChars).split("\n").filter(Boolean).length));
  const stepExtents = lineCounts.map((lineCount, i) => {
    const relativeY = i * stepGap;
    const textTop = relativeY + stepTextTopOffset;
    const textBottom = textTop + lineCount * stepFontSize + Math.max(0, lineCount - 1) * stepTextLineGap;
    const labelLayout = labelLayouts[i];
    const labelTop = relativeY + labelCenterOffset - labelLayout.blockHeight / 2;
    const labelBottom = labelTop + labelLayout.blockHeight;
    const ruleTop = Math.round(relativeY + stepTextTopOffset + stepFontSize / 2 - ruleH / 2);
    return {
      top: Math.min(textTop, labelTop, ruleTop),
      bottom: Math.max(textBottom, labelBottom, ruleTop + ruleH),
      ruleCenterY: ruleTop + ruleH / 2,
    };
  });
  const groupTop = Math.min(...stepExtents.map((extent) => extent.top));
  const groupBottom = Math.max(...stepExtents.map((extent) => extent.bottom));
  const startY = Math.round(HEIGHT / 2 - (groupTop + groupBottom) / 2);
  const firstRuleCenterY = startY + stepExtents[0].ruleCenterY;
  const lastRuleCenterY = startY + stepExtents[stepExtents.length - 1].ruleCenterY;
  const filters = [
    ...baseFilters(stylePreset),
    ...animatedVerticalRuleForDuration(verticalRuleX, firstRuleCenterY, lastRuleCenterY - firstRuleCenterY, UNIFIED_PALETTE.faintGrey, firstStepRevealAt, Math.max(0.1, lastRevealFinish - firstStepRevealAt), verticalRuleW),
  ];
  steps.forEach((step, i) => {
    const timing = fixedRevealTiming(i, { firstRevealAt, revealDuration: stepRevealDuration, gapAfterReveal: gapAfterStepReveal });
    timing.revealAt = stepRevealTimes[i] ?? timing.revealAt;
    const y = startY + i * stepGap;
    const connectorY = Math.round(y + stepTextTopOffset + stepFontSize / 2 - ruleH / 2);
    filters.push(...animatedCenterOutHorizontalRule(ruleX, connectorY, ruleW, ruleH, i % 2 ? UNIFIED_PALETTE.mutedSage : UNIFIED_PALETTE.mutedPeach, timing.revealAt, timing.revealDuration));
    const labelLayout = labelLayouts[i];
    const labelTop = y + labelCenterOffset - labelLayout.blockHeight / 2;
    labelLayout.lines.forEach((line, lineIndex) => {
      const lineY = labelTop + lineIndex * (labelLayout.fontSize + labelLayout.lineGap);
      filters.push(animatedUnifiedRightAlignedTextSlideDown(line, labelRightX, lineY, labelLayout.fontSize, UNIFIED_PALETTE.dimGrey, timing.revealAt, 28, textShadow(0.68, 3), timing.revealDuration, timing.revealDuration));
    });
    filters.push(...animatedUnifiedTextLinesSlideDown(step.text, stepTextX, y + stepTextTopOffset, stepFontSize, UNIFIED_PALETTE.offWhite, timing.revealAt, stepTextMaxChars, stepTextLineGap, stepSlideDistance, "", timing.revealDuration, 0, timing.revealDuration));
  });
  return filters;
}

function rankedPodium(args, stylePreset, overlayInputs) {
  void overlayInputs;
  const items = asTimelineSteps(args.steps || args.items, [
    { label: "01", text: "Most visible change" },
    { label: "02", text: "Faster feedback" },
    { label: "03", text: "Cleaner routine" },
  ]).slice(0, 5);
  const startIndex = sequentialStartIndex(args.startIndex ?? args.startRank ?? args.animateFromRank, items.length);
  const mode = futureItemsMode(args.futureItemsMode ?? args.futureMode ?? args.unrevealedItemsMode);
  const filters = [...baseFilters(stylePreset)];
  const rowH = items.length <= 3 ? 194 : 156;
  const gap = items.length <= 3 ? 62 : 42;
  const totalH = items.length * rowH + Math.max(0, items.length - 1) * gap;
  const startY = Math.round((HEIGHT - totalH) / 2) + (items.length <= 3 ? 32 : 10);
  const rankX = 126;
  const textX = 286;
  const rowW = 760;
  const accents = [UNIFIED_PALETTE.mutedPeach, UNIFIED_PALETTE.mutedBlue, UNIFIED_PALETTE.mutedSage, UNIFIED_PALETTE.mutedLavender, "#d7d2c9@0.66"];
  const revealOptions = { firstRevealAt: 0.42, revealDuration: 0.44, gapAfterReveal: 0.34 };

  items.forEach((item, index) => {
    const timing = sequentialRevealTiming(index, startIndex, revealOptions);
    const explicitRevealAt = itemTiming(args, "items", item, index, Number.NaN, ["steps", "ranks", "ranked"]);
    if (Number.isFinite(explicitRevealAt)) {
      timing.preRevealed = false;
      timing.revealAt = explicitRevealAt;
      timing.finishAt = explicitRevealAt + timing.revealDuration;
    }
    const y = startY + index * (rowH + gap);
    const rank = asText(item.label, String(index + 1).padStart(2, "0")).replace(/^#?/, "");
    const color = accents[index % accents.length];
    const rankSize = items.length <= 3 ? 92 : 72;
    const itemSize = items.length <= 3 ? 58 : 50;
    const itemMaxChars = items.length <= 3 ? 20 : 23;
    const rowRuleY = y + rowH - 24;

    if (!timing.preRevealed && mode !== "hidden") {
      filters.push(box(textX, rowRuleY, rowW, 3, "#e8e5dd@0.12", `:enable='lt(t\\,${timing.revealAt.toFixed(3)})'`));
      filters.push(...futureGhostText(`#${rank}`, rankX, y + 32, rankSize, UNIFIED_PALETTE.dimGrey, timing.revealAt, 5, 0));
      filters.push(...futureGhostText(item.text, textX, y + 34, itemSize, UNIFIED_PALETTE.dimGrey, timing.revealAt, itemMaxChars, 14));
    }

    if (timing.preRevealed) {
      filters.push(box(textX, rowRuleY, rowW, 3, color));
      filters.push(text(`#${rank}`, rankX, y + 32, rankSize, UNIFIED_PALETTE.offWhite, textShadow(0.74, 5), unifiedFont()));
      filters.push(...wrap(item.text, itemMaxChars).split("\n").filter(Boolean).map((line, lineIndex) =>
        text(line, textX, y + 34 + lineIndex * (itemSize + 14), itemSize, UNIFIED_PALETTE.offWhite, textShadow(0.72, 4), unifiedFont()),
      ));
      return;
    }

    filters.push(...animatedHorizontalRule(textX, rowRuleY, rowW, 3, color, timing.revealAt, timing.revealDuration));
    filters.push(animatedUnifiedText(`#${rank}`, rankX, y + 32, rankSize, UNIFIED_PALETTE.offWhite, timing.revealAt, 36, textShadow(0.74, 5), timing.revealDuration, timing.revealDuration));
    filters.push(...animatedUnifiedTextLinesSlideDown(item.text, textX, y + 34, itemSize, UNIFIED_PALETTE.offWhite, timing.revealAt + 0.08, itemMaxChars, 14, 34, "", timing.revealDuration, 0.02, timing.revealDuration));
  });
  return filters;
}

async function stepChecklist(args, stylePreset, overlayInputs) {
  const items = asTimelineSteps(args.steps || args.items, [
    { text: "Set the baseline" },
    { text: "Make the small adjustment" },
    { text: "Repeat it daily" },
  ]).slice(0, 6);
  const startIndex = sequentialStartIndex(args.startIndex ?? args.startItem ?? args.startStep ?? args.animateFromItem ?? args.animateFromStep, items.length);
  const mode = futureItemsMode(args.futureItemsMode ?? args.futureMode ?? args.unrevealedItemsMode);
  const filters = [...baseFilters(stylePreset)];
  const textSize = items.length <= 4 ? 56 : 48;
  const textMaxChars = items.length <= 4 ? 25 : 27;
  const textLineGap = 14;
  const checkSize = 64;
  const rowPaddingY = items.length <= 4 ? 34 : 28;
  const gap = items.length <= 4 ? 42 : 30;
  const itemLayouts = items.map((item) => {
    const lines = wrap(item.text, textMaxChars).split("\n").filter(Boolean);
    const textBlockH = lines.length * textSize + Math.max(0, lines.length - 1) * textLineGap;
    return {
      lines,
      textBlockH,
      rowH: Math.max(checkSize, textBlockH) + rowPaddingY * 2,
    };
  });
  const totalH = itemLayouts.reduce((sum, layout) => sum + layout.rowH, 0) + Math.max(0, items.length - 1) * gap;
  const startY = Math.round((HEIGHT - totalH) / 2);
  const boxX = 126;
  const textX = 236;
  const revealOptions = { firstRevealAt: 0.44, revealDuration: 0.42, gapAfterReveal: 0.36 };
  const tempDir = overlayInputs?.tempDir || fs.mkdtempSync(path.join(os.tmpdir(), "checklist-overlays-"));
  let y = startY;

  for (let index = 0; index < items.length; index += 1) {
    const item = items[index];
    const layout = itemLayouts[index];
    const timing = sequentialRevealTiming(index, startIndex, revealOptions);
    const explicitRevealAt = itemTiming(args, "items", item, index, Number.NaN, ["steps", "checklist"]);
    if (Number.isFinite(explicitRevealAt)) {
      timing.preRevealed = false;
      timing.revealAt = explicitRevealAt;
      timing.finishAt = explicitRevealAt + timing.revealDuration;
    }
    const rowH = layout.rowH;
    const boxY = Math.round(y + (rowH - checkSize) / 2);
    const textY = Math.round(y + (rowH - layout.textBlockH) / 2);

    if (!timing.preRevealed && mode !== "hidden") {
      overlayInputs.push(await createChecklistBoxOverlay({
        tempDir,
        x: boxX,
        y: boxY,
        size: checkSize,
        color: "#e8e5dd@0.08",
        checked: false,
        start: 0,
        index: index * 2,
        fadeIn: 0.001,
        fadeOut: 0.12,
        exitStart: Math.max(0, timing.revealAt - 0.12),
        enterYOffset: 0,
      }));
      filters.push(...futureGhostText(item.text, textX, textY, textSize, UNIFIED_PALETTE.dimGrey, timing.revealAt, textMaxChars, textLineGap));
    }

    if (timing.preRevealed) {
      overlayInputs.push(await createChecklistBoxOverlay({
        tempDir,
        x: boxX,
        y: boxY,
        size: checkSize,
        color: UNIFIED_PALETTE.mutedSage,
        checked: true,
        start: 0,
        index: index * 2 + 1,
        fadeIn: 0.001,
        enterYOffset: 0,
      }));
      filters.push(...layout.lines.map((line, lineIndex) =>
        text(line, textX, textY + lineIndex * (textSize + textLineGap), textSize, UNIFIED_PALETTE.offWhite, textShadow(0.72, 4), unifiedFont()),
      ));
      y += rowH + gap;
      continue;
    }

    overlayInputs.push(await createChecklistBoxOverlay({
      tempDir,
      x: boxX,
      y: boxY,
      size: checkSize,
      color: UNIFIED_PALETTE.mutedSage,
      checked: true,
      start: timing.revealAt,
      index: index * 2 + 1,
      fadeIn: 0.28,
      enterYOffset: 22,
    }));
    filters.push(...animatedUnifiedTextLinesSlideDown(item.text, textX, textY, textSize, UNIFIED_PALETTE.offWhite, timing.revealAt + 0.08, textMaxChars, textLineGap, 34, "", timing.revealDuration, 0.02, timing.revealDuration));
    y += rowH + gap;
  }
  return filters;
}

function scorecard(args, stylePreset, overlayInputs) {
  void overlayInputs;
  const data = asData(args.data).slice(0, 5);
  const rows = data.length > 0 ? data : [
    { label: "Clarity", value: 82, displayValue: "82" },
    { label: "Consistency", value: 68, displayValue: "68" },
    { label: "Effort", value: 91, displayValue: "91" },
  ];
  const max = Math.max(1, ...rows.map((item) => Math.abs(item.value)));
  const titleRevealAt = timingValue(args, "title", 0.36);
  const filters = [
    ...baseFilters(stylePreset),
    ...animatedUnifiedTextLines(args.title || "Scorecard", 124, 280, 66, UNIFIED_PALETTE.offWhite, titleRevealAt, 20, 18, 42, "", 0.42, 0.02, 0.34),
  ];
  const rowH = rows.length <= 3 ? 168 : 140;
  const gap = rows.length <= 3 ? 56 : 34;
  const startY = 590;
  const labelX = 126;
  const valueRightX = 946;
  const barX = 126;
  const barW = 820;
  const accents = [UNIFIED_PALETTE.mutedBlue, UNIFIED_PALETTE.mutedSage, UNIFIED_PALETTE.mutedPeach, UNIFIED_PALETTE.mutedLavender, "#d7d2c9@0.66"];

  rows.forEach((item, index) => {
    const timing = fixedRevealTiming(index, { firstRevealAt: 0.82, revealDuration: 0.42, gapAfterReveal: 0.28 });
    timing.revealAt = itemTiming(args, "data", item, index, timing.revealAt, ["rows", "items"]);
    const y = startY + index * (rowH + gap);
    const scoreW = Math.max(18, Math.round((Math.abs(item.value) / max) * barW));
    filters.push(animatedUnifiedTextSlideDown(item.label, labelX, y, 40, UNIFIED_PALETTE.offWhite, timing.revealAt, 30, "", timing.revealDuration, timing.revealDuration));
    filters.push(animatedUnifiedRightAlignedTextSlideDown(item.displayValue || String(item.value), valueRightX, y, 40, UNIFIED_PALETTE.dimGrey, timing.revealAt, 30, "", timing.revealDuration, timing.revealDuration));
    filters.push(box(barX, y + 72, barW, 8, UNIFIED_PALETTE.faintGrey, revealEnable(timing.revealAt)));
    filters.push(...animatedHorizontalRule(barX, y + 72, scoreW, 8, accents[index % accents.length], timing.revealAt + 0.08, timing.revealDuration));
  });
  return filters;
}

function researchPaperCard(args, stylePreset, overlayInputs) {
  void overlayInputs;
  const source = asText(args.source || args.journal, "Journal of Applied Research");
  const year = asText(args.year || args.date, "2024");
  const title = asText(args.title || args.paperTitle, "Posture cues and visible jawline definition");
  const finding = asText(args.finding || args.result || args.takeaway, "Consistency drove the visible change.");
  const filters = [...baseFilters(stylePreset)];
  const sheetX = 114;
  const sheetY = 286;
  const sheetW = 852;
  const sheetH = 1290;
  const ink = "#181714@0.92";
  const mutedInk = "#3a3832@0.62";
  const rule = "#27241f@0.22";
  const faintRule = "#27241f@0.12";
  const paper = "#f3efe6@0.94";
  const marginX = sheetX + 70;
  const rightX = sheetX + sheetW - 70;
  const paperRevealAt = timingValue(args, ["paper", "card", "sheet"], 0.28);
  const sourceRevealAt = timingValue(args, ["source", "journal"], 0.66);
  const titleRevealAt = timingValue(args, "title", 0.9);
  const findingRevealAt = timingValue(args, "finding", 1.5);

  filters.push(box(sheetX + 18, sheetY + 22, sheetW, sheetH, "#050505@0.18", revealEnable(Math.max(0, paperRevealAt - 0.04))));
  filters.push(animatedBoxSlideDown(sheetX, sheetY, sheetW, sheetH, paper, paperRevealAt, 26, 0.38));
  filters.push(box(sheetX + 24, sheetY + 24, sheetW - 48, sheetH - 48, "#000000@0.00", revealEnable(paperRevealAt + 0.04)));
  filters.push(...animatedHorizontalRule(marginX, sheetY + 128, sheetW - 140, 3, rule, paperRevealAt + 0.16, 0.42));
  filters.push(...animatedHorizontalRule(marginX, sheetY + 1132, sheetW - 140, 2, faintRule, findingRevealAt + 0.2, 0.44));

  filters.push(animatedUnifiedText("RESEARCH PAPER", marginX, sheetY + 72, 30, mutedInk, paperRevealAt + 0.22, 20, "", 0.34, 0.3));
  filters.push(animatedUnifiedRightAlignedTextSlideDown(year, rightX, sheetY + 72, 30, mutedInk, paperRevealAt + 0.22, 20, "", 0.34, 0.3));
  filters.push(...animatedUnifiedTextLines(source, marginX, sheetY + 176, 34, "#244968@0.82", sourceRevealAt, 32, 10, 26, "", 0.38, 0, 0.3));
  filters.push(...animatedUnifiedTextLines(title, marginX, sheetY + 278, 52, ink, titleRevealAt, 20, 15, 34, "", 0.48, 0.025, 0.32));

  filters.push(animatedUnifiedText("[1]", marginX, sheetY + 560, 38, mutedInk, titleRevealAt + 0.28, 20, "", 0.34, 0.28));
  filters.push(...animatedHorizontalRule(marginX + 82, sheetY + 584, 230, 3, rule, titleRevealAt + 0.28, 0.34));
  filters.push(...animatedHorizontalRule(marginX + 82, sheetY + 634, 520, 2, faintRule, titleRevealAt + 0.36, 0.34));
  filters.push(...animatedHorizontalRule(marginX + 82, sheetY + 682, 474, 2, faintRule, titleRevealAt + 0.42, 0.34));
  filters.push(...animatedHorizontalRule(marginX + 82, sheetY + 730, 554, 2, faintRule, titleRevealAt + 0.48, 0.34));

  filters.push(box(marginX, sheetY + 824, sheetW - 140, 156, "#d7d2c9@0.24", revealEnable(findingRevealAt)));
  filters.push(animatedUnifiedText("KEY FINDING", marginX + 34, sheetY + 858, 26, mutedInk, findingRevealAt + 0.08, 18, "", 0.32, 0.26));
  filters.push(...animatedUnifiedTextLines(finding, marginX + 34, sheetY + 908, 42, ink, findingRevealAt + 0.24, 27, 12, 30, "", 0.44, 0.02, 0.3));

  filters.push(animatedUnifiedText("doi:", marginX, sheetY + 1186, 24, mutedInk, findingRevealAt + 0.42, 16, "", 0.3, 0.24));
  filters.push(...animatedHorizontalRule(marginX + 62, sheetY + 1204, 342, 2, faintRule, findingRevealAt + 0.46, 0.32));
  return filters;
}

function normalizeIndicatorType(value) {
  const raw = String(value || "").trim().toLowerCase().replace(/[’']/g, "").replace(/[\s/-]+/g, "_");
  if (raw === "bad" || raw === "negative" || raw === "dont" || raw === "dont_stop" || raw === "do_not" || raw === "stop" || raw === "no") return "bad";
  return "good";
}

async function goodBadIndicator(args, stylePreset, overlayInputs) {
  const indicatorType = normalizeIndicatorType(args.indicatorType ?? args.instructionType ?? args.type ?? args.mode);
  const isGood = indicatorType === "good";
  const accent = isGood ? "#8fc99b@0.86" : "#e47d7d@0.84";
  const copy = asText(args.text, isGood ? "Lift from the lower lid" : "Stop if you feel pressure");
  const contentX = 124;
  const iconCenterX = contentX + 72;
  const iconTopY = 360;
  const iconSize = Math.round(144 * 1.3);
  const textTopY = 690;
  const textSize = 82;
  const textMaxChars = 15;
  const textLineGap = 22;
  const textLines = wrap(copy, textMaxChars).split("\n").filter(Boolean);
  const textBlockHeight = textSize + Math.max(0, textLines.length - 1) * (textSize + textLineGap);
  const ruleMarginTop = 56;
  const ruleY = Math.max(1040, textTopY + textBlockHeight + ruleMarginTop);
  const textRevealAt = timingValue(args, "text", 0.78);
  const iconRevealAt = textRevealAt;
  const ruleRevealAt = textRevealAt;
  overlayInputs.push(await createLucideIconOverlay({
    tempDir: overlayInputs.tempDir,
    icon: isGood ? "circleCheck" : "octagonX",
    centerX: iconCenterX,
    topY: iconTopY,
    size: iconSize,
    color: accent,
    start: iconRevealAt,
    index: indicatorType,
    fadeIn: 0.32,
    exitStart: Math.max(2.5, (overlayInputs.duration || 5) - 0.72),
  }));

  const filters = [...baseFilters(stylePreset)];
  filters.push(...animatedUnifiedTextLines(copy, contentX, textTopY, textSize, UNIFIED_PALETTE.offWhite, textRevealAt, textMaxChars, textLineGap, 50, textShadow(0.78, 5), 0.58, 0.035, 0.38));
  filters.push(...animatedHorizontalRule(contentX, ruleY, 720, 4, accent, ruleRevealAt, 0.5));
  return filters;
}

async function instruction(args, stylePreset, overlayInputs) {
  return goodBadIndicator(args, stylePreset, overlayInputs);
}

async function causeEffect(args, stylePreset, overlayInputs) {
  const cause = asText(args.cause, "Small daily tension");
  const effect = asText(args.effect, "Jaw and neck read tighter");
  const cardX = 96;
  const bodySize = 62;
  const bodyLineGap = 20;
  const cardPaddingX = 58;
  const cardPaddingY = 48;
  const layoutCenterX = WIDTH / 2;
  const maxCardW = WIDTH - cardX * 2;
  const maxTextW = maxCardW - cardPaddingX * 2;
  const arrowStemX = layoutCenterX;
  const arrowMargin = 84;
  const arrowHeight = 156;
  const causeRevealAt = timingValue(args, "cause", 0.5);
  const arrowStart = timingValue(args, "arrow", 1.12);
  const effectRevealAt = timingValue(args, "effect", 1.86);
  const arrowColor = UNIFIED_PALETTE.mutedBlue;
  const bodyLineHeight = bodySize + bodyLineGap;
  const textBlockHeight = (lineCount) => bodySize + Math.max(0, lineCount - 1) * bodyLineHeight;
  const cardLayout = (value) => {
    const lines = wrapByBalancedPixelWidth(value, maxTextW, bodySize, { fontWeight: 400, maxLines: 4 });
    const textWidth = Math.max(0, ...lines.map((line) => measureUnifiedTextVisualBounds(line, bodySize, 400).width));
    return {
      lines,
      textWidth,
      width: Math.min(maxCardW, Math.ceil(textWidth + cardPaddingX * 2)),
      height: cardPaddingY * 2 + textBlockHeight(lines.length || 1),
    };
  };
  const causeCard = cardLayout(cause);
  const effectCard = cardLayout(effect);
  const totalHeight = causeCard.height + arrowMargin + arrowHeight + arrowMargin + effectCard.height;
  const centerCardX = (card) => Math.round(layoutCenterX - card.width / 2);
  const causeCardY = Math.round((HEIGHT - totalHeight) / 2);
  const arrowTopY = causeCardY + causeCard.height + arrowMargin;
  const effectCardY = arrowTopY + arrowHeight + arrowMargin;
  const filters = [...baseFilters(stylePreset)];
  const cardOverlayOptions = {
    tempDir: overlayInputs.tempDir,
    fontSize: bodySize,
    lineGap: bodyLineGap,
    color: UNIFIED_PALETTE.offWhite,
    paddingX: cardPaddingX,
    paddingY: cardPaddingY,
    enterYOffset: -22,
    exitStart: Math.max(2.5, (overlayInputs.duration || 6) - 0.72),
  };
  overlayInputs.push(await createRoundedTextCardOverlay({
    ...cardOverlayOptions,
    x: centerCardX(causeCard),
    y: causeCardY,
    width: causeCard.width,
    height: causeCard.height,
    lines: causeCard.lines,
    start: causeRevealAt,
    index: "cause-effect-cause",
  }));
  overlayInputs.push(await createDownArrowOverlay({
    tempDir: overlayInputs.tempDir,
    centerX: arrowStemX,
    topY: arrowTopY,
    height: arrowHeight,
    color: arrowColor,
    start: arrowStart,
    index: "cause-effect",
    fadeIn: 0.76,
    fadeOut: 0.32,
    enterYOffset: 0,
    exitYOffset: 0,
    growDownDuration: 0.76,
  }));
  overlayInputs.push(await createRoundedTextCardOverlay({
    ...cardOverlayOptions,
    x: centerCardX(effectCard),
    y: effectCardY,
    width: effectCard.width,
    height: effectCard.height,
    lines: effectCard.lines,
    start: effectRevealAt,
    index: "cause-effect-effect",
  }));
  return filters;
}

async function processFlow(args, _stylePreset, overlayInputs) {
  const steps = asList(args.steps, ["Notice", "Adjust", "Repeat"]).slice(0, 5);
  const filters = [];
  const contentX = 126;
  const numberX = contentX + 4;
  const textX = contentX + 142;
  const arrowCenterX = textX + 34;
  const cardH = steps.length <= 3 ? 168 : 146;
  const gap = steps.length <= 3 ? 128 : steps.length === 4 ? 108 : 94;
  const totalH = steps.length * cardH + Math.max(0, steps.length - 1) * gap;
  const startY = Math.round((HEIGHT - totalH) / 2);
  const mediumFont = INTER_FONT_FILE || "Inter";
  const offWhiteGrey = UNIFIED_PALETTE.offWhite;
  const connectorDimGrey = "#e8e5dd@0.34";
  const connectorActiveGrey = "#e8e5dd@0.54";
  const textShadow = ":shadowcolor=0x000000@0.72:shadowx=0:shadowy=4";
  const numberShadow = ":shadowcolor=0x000000@0.64:shadowx=0:shadowy=3";
  const firstRevealAt = 0.42;
  // Fixed, duration-independent timing: each step reveals for 520ms, then the next step starts 300ms later.
  const stepRevealDuration = 0.52;
  const gapAfterStepReveal = 0.3;
  const stepStagger = stepRevealDuration + gapAfterStepReveal;
  const activeHold = 0.88;
  const arrowLead = 0.18;
  const lastRevealFinish = firstRevealAt + (steps.length - 1) * stepStagger + stepRevealDuration;

  for (let i = 0; i < steps.length; i += 1) {
    const step = steps[i];
    const revealAt = firstRevealAt + i * stepStagger;
    const activeStart = revealAt + 0.02;
    const activeEnd = activeStart + activeHold;
    const y = startY + i * (cardH + gap);
    filters.push(processFlowText(String(i + 1).padStart(2, "0"), numberX, y + 42, 48, offWhiteGrey, revealAt, activeStart, activeEnd, lastRevealFinish, 38, numberShadow, mediumFont, stepRevealDuration, 0.42));
    filters.push(...processFlowTextLines(step, textX, y + 34, steps.length <= 3 ? 58 : 51, offWhiteGrey, revealAt, activeStart, activeEnd, lastRevealFinish, 46, textShadow, mediumFont, 24, stepRevealDuration, 0));
    if (i < steps.length - 1) {
      const nextRevealAt = firstRevealAt + (i + 1) * stepStagger;
      const arrowRevealAt = Math.max(revealAt + 0.35, nextRevealAt - arrowLead);
      const arrowTop = y + cardH + 28;
      const arrowHeight = Math.min(56, gap - 50);
      overlayInputs.push(await createDownArrowOverlay({
        tempDir: overlayInputs.tempDir,
        centerX: arrowCenterX,
        topY: arrowTop,
        height: arrowHeight,
        color: connectorDimGrey,
        start: arrowRevealAt,
        index: `${i + 1}-dim`,
        enterYOffset: -22,
      }));
      overlayInputs.push(await createDownArrowOverlay({
        tempDir: overlayInputs.tempDir,
        centerX: arrowCenterX,
        topY: arrowTop,
        height: arrowHeight,
        color: connectorActiveGrey,
        start: arrowRevealAt + 0.04,
        index: `${i + 1}-active`,
        fadeIn: 0.24,
        fadeOut: 0.38,
        exitStart: nextRevealAt + activeHold,
        enterYOffset: -22,
      }));
    }
  }
  return filters;
}

async function filtersFor(config, overlayInputs) {
  const args = resolveRendererArgs(config);
  const rawRendererKey = asText(config.rendererId || config.templateId);
  const rendererKey = resolveRendererKey(config);
  if (rawRendererKey === "research_finding_card") {
    return statReveal(
      {
        value: asText(args.source, "Finding"),
        title: asText(args.finding, asText(args.implication, "Research finding")),
      },
      config.stylePreset,
      overlayInputs,
    );
  }
  if (rawRendererKey === "process_flow") {
    return timeline(args, config.stylePreset, overlayInputs);
  }
  if (rawRendererKey === "warning_card") {
    return goodBadIndicator(
      {
        indicatorType: "bad",
        text: asText(args.text || args.title || args.headline || args.body || args.description, "Stop if you feel pressure"),
      },
      config.stylePreset,
      overlayInputs,
    );
  }
  switch (rendererKey) {
    case "bar_chart": return barChart(args, config.stylePreset, overlayInputs);
    case "pie_chart": return pieChart(args, config.stylePreset, overlayInputs);
    case "line_growth_chart": return lineGrowthChart(args, config.stylePreset, overlayInputs);
    case "comparison_before_after": return comparison(args, config.stylePreset, overlayInputs);
    case "timeline": return timeline(args, config.stylePreset, overlayInputs);
    case "cause_effect": return causeEffect(args, config.stylePreset, overlayInputs);
    case "ranked_podium": return rankedPodium(args, config.stylePreset, overlayInputs);
    case "checklist":
    case "step_checklist": return stepChecklist(args, config.stylePreset, overlayInputs);
    case "scorecard": return scorecard(args, config.stylePreset, overlayInputs);
    case "research_paper_card": return researchPaperCard(args, config.stylePreset, overlayInputs);
    case "good_bad_indicator": return goodBadIndicator(args, config.stylePreset, overlayInputs);
    case "instruction": return goodBadIndicator(args, config.stylePreset, overlayInputs);
    case "stat_reveal":
    default: return statReveal(args, config.stylePreset, overlayInputs);
  }
}

function resolveBackgroundVideoPath(config) {
  const explicit = asText(config.backgroundVideoPath || config.backgroundPath || "");
  if (explicit && fs.existsSync(explicit)) return explicit;

  try {
    const settings = JSON.parse(fs.readFileSync(BACKGROUND_VIDEO_SETTINGS_PATH, "utf-8"));
    const backgrounds = Array.isArray(settings.backgrounds) ? settings.backgrounds : [];
    const selected = backgrounds.find((item) => item?.id === settings.defaultBackgroundVideoId) || backgrounds[0];
    const relative = asText(selected?.videoRelativePath || selected?.relativePath || "");
    const candidate = relative ? path.join(BACKGROUND_VIDEOS_DIR, relative) : "";
    if (candidate && fs.existsSync(candidate)) return candidate;
  } catch {
    // Fall back to generated solid color input below.
  }

  return "";
}

function resolveUnifiedBackgroundImagePath(config) {
  const explicit = asText(config.backgroundImagePath || config.backgroundStillPath || "");
  if (explicit && fs.existsSync(explicit)) return explicit;
  if (fs.existsSync(UNIFIED_BACKGROUND_IMAGE_PATH)) return UNIFIED_BACKGROUND_IMAGE_PATH;
  return "";
}

function buildFilterComplex({ config, filters, overlayInputs, duration }) {
  void config;
  const basePrep = [
    `scale=${WIDTH}:${HEIGHT}:force_original_aspect_ratio=increase`,
    `crop=${WIDTH}:${HEIGHT}`,
    "setsar=1",
    "fps=30",
    "format=rgba",
    box(0, 0, WIDTH, HEIGHT, UNIFIED_BACKGROUND_DARKEN_OVERLAY),
  ];
  const chain = [...basePrep, ...filters, `fade=t=in:st=0:d=0.35`, `fade=t=out:st=${Math.max(0.5, duration - 0.35).toFixed(3)}:d=0.35`];
  const graph = [`[0:v]${chain.join(",")}[base0]`];
  let previous = "base0";
  let inputCursor = 1;
  overlayInputs.forEach((overlay, index) => {
    const inputIndex = inputCursor;
    inputCursor += overlay.framePattern ? 1 : Array.isArray(overlay.frameFiles) && overlay.frameFiles.length > 0 ? overlay.frameFiles.length : 1;
    const prepared = `arrow${index}`;
    const out = `ov${index}`;
    const fadeIn = overlay.fadeIn ?? 0.26;
    const fadeOut = overlay.fadeOut ?? 0.32;
    const exitStart = overlay.exitStart ?? Math.max(overlay.start + fadeIn + 0.6, duration - 0.76 + index * 0.055);
    const disableAt = Math.min(duration, exitStart + fadeOut + 0.08);
    if (overlay.framePattern) {
      const sequenceDuration = overlay.frameSequenceDuration ?? overlay.growRightDuration ?? 0;
      const holdDuration = Math.max(0, duration - overlay.start - sequenceDuration + 0.2);
      const localExitStart = Math.max(0, exitStart - overlay.start);
      graph.push(`[${inputIndex}:v]format=rgba,tpad=stop_mode=clone:stop_duration=${holdDuration.toFixed(3)},fade=t=out:st=${localExitStart.toFixed(3)}:d=${fadeOut.toFixed(3)}:alpha=1,setpts=PTS+${overlay.start.toFixed(3)}/TB[${prepared}]`);
      graph.push(`[${previous}][${prepared}]overlay=x=${overlay.x}:y=${overlay.y}:enable='between(t\\,${overlay.start.toFixed(3)}\\,${disableAt.toFixed(3)})'[${out}]`);
      previous = out;
      return;
    }
    if (Array.isArray(overlay.frameFiles) && overlay.frameFiles.length > 0) {
      const frameDuration = 1 / FPS;
      overlay.frameFiles.forEach((_frameFile, frameIndex) => {
        const segmentStart = overlay.start + frameIndex * frameDuration;
        const segmentEnd = overlay.start + (frameIndex + 1) * frameDuration;
        const segmentPrepared = `${prepared}s${frameIndex}`;
        const segmentOut = `${out}s${frameIndex}`;
        graph.push(`[${inputIndex + frameIndex}:v]format=rgba[${segmentPrepared}]`);
        graph.push(`[${previous}][${segmentPrepared}]overlay=x=${overlay.x}:y=${overlay.y}:enable='between(t\\,${segmentStart.toFixed(3)}\\,${segmentEnd.toFixed(3)})'[${segmentOut}]`);
        previous = segmentOut;
      });
      graph.push(`[${inputIndex + overlay.frameFiles.length - 1}:v]format=rgba,fade=t=out:st=${exitStart.toFixed(3)}:d=${fadeOut.toFixed(3)}:alpha=1[${prepared}]`);
      graph.push(`[${previous}][${prepared}]overlay=x=${overlay.x}:y=${overlay.y}:enable='between(t\\,${(overlay.start + (overlay.frameFiles.length / FPS)).toFixed(3)}\\,${disableAt.toFixed(3)})'[${out}]`);
      previous = out;
      return;
    }
    if (overlay.growDownDuration) {
      const revealDuration = overlay.growDownDuration;
      const steps = Math.ceil(revealDuration * FPS);
      for (let frameIndex = 0; frameIndex < steps; frameIndex += 1) {
        const segmentStart = overlay.start + frameIndex / FPS;
        const segmentEnd = overlay.start + (frameIndex + 1) / FPS;
        const progress = Math.min(1, Math.max(0, (frameIndex + 0.5) / steps));
        const eased = progress * progress * (3 - 2 * progress);
        const currentH = Math.max(2, Math.round(overlay.height * eased));
        const segmentPrepared = `${prepared}s${frameIndex}`;
        const segmentOut = `${out}s${frameIndex}`;
        graph.push(`[${inputIndex}:v]format=rgba,crop=w=iw:h=${currentH}:x=0:y=0,colorchannelmixer=aa=${eased.toFixed(4)}[${segmentPrepared}]`);
        graph.push(`[${previous}][${segmentPrepared}]overlay=x=${overlay.x}:y=${overlay.y}:enable='between(t\\,${segmentStart.toFixed(3)}\\,${segmentEnd.toFixed(3)})'[${segmentOut}]`);
        previous = segmentOut;
      }
      graph.push(`[${inputIndex}:v]format=rgba,fade=t=out:st=${exitStart.toFixed(3)}:d=${fadeOut.toFixed(3)}:alpha=1[${prepared}]`);
      graph.push(`[${previous}][${prepared}]overlay=x=${overlay.x}:y=${overlay.y}:enable='between(t\\,${(overlay.start + revealDuration).toFixed(3)}\\,${disableAt.toFixed(3)})'[${out}]`);
      previous = out;
      return;
    }
    if (overlay.growRightDuration) {
      const revealDuration = overlay.growRightDuration;
      const overlayWidth = overlay.width ?? overlay.height;
      const steps = Math.ceil(revealDuration * FPS);
      for (let frameIndex = 0; frameIndex < steps; frameIndex += 1) {
        const segmentStart = overlay.start + frameIndex / FPS;
        const segmentEnd = overlay.start + (frameIndex + 1) / FPS;
        const progress = Math.min(1, Math.max(0, (frameIndex + 0.5) / steps));
        const eased = progress * progress * (3 - 2 * progress);
        const currentW = Math.max(2, Math.round(overlayWidth * eased));
        const segmentPrepared = `${prepared}s${frameIndex}`;
        const segmentOut = `${out}s${frameIndex}`;
        graph.push(`[${inputIndex}:v]format=rgba,crop=w=${currentW}:h=ih:x=0:y=0,colorchannelmixer=aa=${eased.toFixed(4)}[${segmentPrepared}]`);
        graph.push(`[${previous}][${segmentPrepared}]overlay=x=${overlay.x}:y=${overlay.y}:enable='between(t\\,${segmentStart.toFixed(3)}\\,${segmentEnd.toFixed(3)})'[${segmentOut}]`);
        previous = segmentOut;
      }
      graph.push(`[${inputIndex}:v]format=rgba,fade=t=out:st=${exitStart.toFixed(3)}:d=${fadeOut.toFixed(3)}:alpha=1[${prepared}]`);
      graph.push(`[${previous}][${prepared}]overlay=x=${overlay.x}:y=${overlay.y}:enable='between(t\\,${(overlay.start + revealDuration).toFixed(3)}\\,${disableAt.toFixed(3)})'[${out}]`);
      previous = out;
      return;
    }
    const yExpr = `'${overlay.y}+${overlay.enterYOffset ?? 14}*(1-${smoothStepExpr(overlay.start, fadeIn)})-${overlay.exitYOffset ?? 8}*${smoothStepExpr(exitStart, fadeOut)}'`;
    graph.push(`[${inputIndex}:v]format=rgba,fade=t=in:st=${overlay.start.toFixed(3)}:d=${fadeIn.toFixed(3)}:alpha=1,fade=t=out:st=${exitStart.toFixed(3)}:d=${fadeOut.toFixed(3)}:alpha=1[${prepared}]`);
    graph.push(`[${previous}][${prepared}]overlay=x=${overlay.x}:y=${yExpr}:enable='between(t\\,${overlay.start.toFixed(3)}\\,${disableAt.toFixed(3)})'[${out}]`);
    previous = out;
  });
  graph.push(`[${previous}]format=yuv420p[vout]`);
  return graph.join(";");
}

function buildCaptionWordWallFilterComplex({ duration }) {
  const basePrep = [
    `scale=${WIDTH}:${HEIGHT}:force_original_aspect_ratio=increase`,
    `crop=${WIDTH}:${HEIGHT}`,
    "setsar=1",
    "fps=30",
    "format=rgba",
    box(0, 0, WIDTH, HEIGHT, UNIFIED_BACKGROUND_DARKEN_OVERLAY),
  ];
  return [
    `[0:v]${basePrep.join(",")}[base0]`,
    "[1:v]format=rgba[wall0]",
    `[base0][wall0]overlay=0:0:shortest=1:eof_action=pass,fade=t=in:st=0:d=0.35,fade=t=out:st=${Math.max(0.5, duration - 0.35).toFixed(3)}:d=0.35,format=yuv420p[vout]`,
  ].join(";");
}

async function main() {
  const configPath = readArg("--config");
  const output = readArg("--output");
  const poster = readArg("--poster");
  if (!configPath || !output) throw new Error("Usage: render-motion-graphic.mjs --config config.json --output out.mp4 [--poster poster.png]");
  const config = JSON.parse(fs.readFileSync(configPath, "utf-8"));
  const rendererKey = resolveRendererKey(config);
  const isCaptionWordWall = rendererKey === "caption_word_wall";
  const duration = isCaptionWordWall
    ? Math.min(12, Math.max(0.5, asNumber(config.durationSeconds, 6)))
    : Math.min(12, Math.max(3, asNumber(config.durationSeconds, 6)));
  ensureDir(output);
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "motion-graphic-render-"));
  const overlayInputs = [];
  overlayInputs.tempDir = tempDir;
  overlayInputs.duration = duration;
  const backgroundImagePath = resolveUnifiedBackgroundImagePath(config);
  const backgroundVideoPath = backgroundImagePath ? "" : resolveBackgroundVideoPath(config);
  const inputArgs = backgroundImagePath
    ? ["-loop", "1", "-i", backgroundImagePath]
    : backgroundVideoPath
      ? ["-fflags", "+genpts+discardcorrupt", "-err_detect", "ignore_err", "-stream_loop", "-1", "-i", backgroundVideoPath]
      : ["-f", "lavfi", "-i", `color=c=0x101116:s=${WIDTH}x${HEIGHT}:d=${duration}:r=${FPS}`];
  let filterComplex;
  let rendererMetadata = {};
  if (isCaptionWordWall) {
    const wordWall = await renderCaptionWordWallFrames({ config, tempDir, duration });
    inputArgs.push("-framerate", String(FPS), "-i", wordWall.framePattern);
    filterComplex = buildCaptionWordWallFilterComplex({ duration });
    rendererMetadata = {
      renderer: "caption_word_wall",
      usesForcedAlignment: wordWall.usesForcedAlignment,
      displayWords: wordWall.timeline.words.map((word) => word.text),
      wordCount: wordWall.timeline.words.length,
      lineCount: wordWall.timeline.lines.length,
      lineVisibility: wordWall.timeline.lines
        .map((line, lineIndex) => line.blank ? null : ({
          lineIndex,
          firstWordStart: Number(line.lineStart.toFixed(3)),
          lastWordEnd: Number(line.lineEnd.toFixed(3)),
          size: line.size,
          text: line.text,
        }))
        .filter(Boolean),
      activeWordPop: {
        maxScale: CAPTION_WORD_WALL_STYLE.activeScale,
        maxTranslateYEm: CAPTION_WORD_WALL_STYLE.activeTranslateYEm,
        baseFontWeight: CAPTION_WORD_WALL_ACTIVE_WORD_BASE_FONT_WEIGHT,
        maxFontWeight: CAPTION_WORD_WALL_STYLE.activeFontWeight,
        progressBasis: "word spoken duration",
        keyframes: CAPTION_WORD_WALL_ACTIVE_WORD_POP_KEYFRAMES.map((frame) => ({
          progress: frame.progress,
          scale: frame.scale,
          translateYEm: frame.translateYEm,
          fontWeight: frame.fontWeight,
          ...(frame.easingToNext ? { easingToNext: frame.easingToNext } : {}),
        })),
        verticalReflow: {
          mode: CAPTION_WORD_WALL_VERTICAL_REFLOW.mode,
          description: "The active word's eased scale and lift create a reduced effective line-box expansion each frame; rows above and below shift by a tunable fraction so the wall breathes gently around the active word.",
          scaleExpansionTopShare: CAPTION_WORD_WALL_VERTICAL_REFLOW.scaleExpansionTopShare,
          scaleExpansionBottomShare: CAPTION_WORD_WALL_VERTICAL_REFLOW.scaleExpansionBottomShare,
          expansionContributionMultiplier: CAPTION_WORD_WALL_VERTICAL_REFLOW.expansionContributionMultiplier,
          rowDisplacementMultiplier: CAPTION_WORD_WALL_VERTICAL_REFLOW.rowDisplacementMultiplier,
          maxRawExpansionPx: Number(wordWall.layout.maxRawDynamicExpansion.toFixed(2)),
          maxReservedExpansionPx: Number(wordWall.layout.maxDynamicExpansion.toFixed(2)),
          maxRowDisplacementPx: Number(wordWall.layout.maxRowDisplacement.toFixed(2)),
          maxOuterPaddingPx: Number(((HEIGHT - wordWall.layout.totalHeight - wordWall.layout.maxDynamicExpansion) / 2).toFixed(2)),
        },
        fontWeightRenderMode: INTER_VARIABLE_FONT
          ? "InterVariable.ttf wght axis is sampled with fontkit per frame, converted to SVG paths, then rasterized by Sharp; this avoids Sharp/Pango's discrete SVG font-weight buckets"
          : "Fallback Sharp/Pango SVG text path; intermediate font-weight values may rasterize discretely depending on installed fonts",
        mode: INTER_VARIABLE_FONT
          ? "caption_word_wall keyframed onset pop with active Inter variable-font path scale, baseline lift, and continuous wght-axis interpolation"
          : "caption_word_wall keyframed onset pop with active tspan font-size expansion, baseline lift, and font-weight increase",
        variableFont: {
          requestedFamily: "Inter",
          loadedPath: INTER_FONT_FILE ? path.relative(REPO_ROOT, INTER_FONT_FILE) : null,
          renderer: INTER_VARIABLE_FONT ? "fontkit-svg-paths" : "sharp-pango-svg-text-fallback",
          weightAxis: INTER_VARIABLE_WEIGHT_AXIS
            ? {
                min: INTER_VARIABLE_WEIGHT_AXIS.min,
                default: INTER_VARIABLE_WEIGHT_AXIS.default,
                max: INTER_VARIABLE_WEIGHT_AXIS.max,
              }
            : null,
          activeWeightValues: `continuous values from ${CAPTION_WORD_WALL_ACTIVE_WORD_BASE_FONT_WEIGHT} to ${CAPTION_WORD_WALL_ACTIVE_WORD_PEAK_FONT_WEIGHT} to ${CAPTION_WORD_WALL_ACTIVE_WORD_BASE_FONT_WEIGHT} using the same eased progress as scale and lift`,
        },
      },
      typography: {
        lineSizes: Object.fromEntries(
          Object.entries(CAPTION_WORD_WALL_STYLE.lineSizes).map(([size, lineStyle]) => [size, {
            mirrors: lineStyle.mirrors,
            fontFamily: STAT_REVEAL_TEXT_STYLE.title.fontFamily,
            fontWeight: STAT_REVEAL_TEXT_STYLE.title.fontWeight,
            fontSize: lineStyle.fontSize,
            color: STAT_REVEAL_TEXT_STYLE.title.color,
            lineHeight: Number(lineStyle.lineHeight.toFixed(6)),
            shadowOpacity: lineStyle.shadowOpacity,
            shadowOffsetY: lineStyle.shadowOffsetY,
          }]),
        ),
        regular: {
          mirrors: "stat_reveal.title",
          fontFamily: STAT_REVEAL_TEXT_STYLE.title.fontFamily,
          fontWeight: STAT_REVEAL_TEXT_STYLE.title.fontWeight,
          fontSize: CAPTION_WORD_WALL_STYLE.lineSizes.regular.fontSize,
          color: STAT_REVEAL_TEXT_STYLE.title.color,
          lineGap: STAT_REVEAL_TEXT_STYLE.title.lineGap,
          lineHeight: Number(CAPTION_WORD_WALL_STYLE.lineSizes.regular.lineHeight.toFixed(6)),
          shadowOpacity: CAPTION_WORD_WALL_STYLE.lineSizes.regular.shadowOpacity,
          shadowOffsetY: CAPTION_WORD_WALL_STYLE.lineSizes.regular.shadowOffsetY,
        },
        large: {
          mirrors: CAPTION_WORD_WALL_STYLE.lineSizes.large.mirrors,
          fontFamily: STAT_REVEAL_TEXT_STYLE.title.fontFamily,
          fontWeight: STAT_REVEAL_TEXT_STYLE.title.fontWeight,
          fontSize: CAPTION_WORD_WALL_STYLE.lineSizes.large.fontSize,
          color: STAT_REVEAL_TEXT_STYLE.title.color,
          lineHeight: Number(CAPTION_WORD_WALL_STYLE.lineSizes.large.lineHeight.toFixed(6)),
          shadowOpacity: CAPTION_WORD_WALL_STYLE.lineSizes.large.shadowOpacity,
          shadowOffsetY: CAPTION_WORD_WALL_STYLE.lineSizes.large.shadowOffsetY,
        },
        extra_large: {
          mirrors: "stat_reveal.value",
          fontFamily: STAT_REVEAL_TEXT_STYLE.value.fontFamily,
          fontWeight: STAT_REVEAL_TEXT_STYLE.value.fontWeight,
          fontSize: CAPTION_WORD_WALL_STYLE.lineSizes.extra_large.fontSize,
          color: STAT_REVEAL_TEXT_STYLE.value.color,
          lineHeight: Number(CAPTION_WORD_WALL_STYLE.lineSizes.extra_large.lineHeight.toFixed(6)),
          shadowOpacity: CAPTION_WORD_WALL_STYLE.lineSizes.extra_large.shadowOpacity,
          shadowOffsetY: CAPTION_WORD_WALL_STYLE.lineSizes.extra_large.shadowOffsetY,
        },
        emphasized: {
          aliasFor: "extra_large",
          mirrors: "stat_reveal.value",
          fontFamily: STAT_REVEAL_TEXT_STYLE.value.fontFamily,
          fontWeight: STAT_REVEAL_TEXT_STYLE.value.fontWeight,
          fontSize: CAPTION_WORD_WALL_STYLE.lineSizes.extra_large.fontSize,
          color: STAT_REVEAL_TEXT_STYLE.value.color,
          lineHeight: Number(CAPTION_WORD_WALL_STYLE.lineSizes.extra_large.lineHeight.toFixed(6)),
          shadowOpacity: CAPTION_WORD_WALL_STYLE.lineSizes.extra_large.shadowOpacity,
          shadowOffsetY: CAPTION_WORD_WALL_STYLE.lineSizes.extra_large.shadowOffsetY,
        },
        upcomingWordColor: CAPTION_WORD_WALL_STYLE.upcomingWordColor,
        previousUpcomingWordColor: "#e8e5dd@0.42",
      },
      layout: {
        alignment: wordWall.layout.alignment,
        x: wordWall.layout.x,
        spacingMode: wordWall.layout.spacingMode,
        rows: wordWall.layout.rows
          .filter((row) => !row.blank)
          .map((row) => ({
            x: row.x,
            y: row.y,
            width: Number(row.width.toFixed(2)),
            fontSize: row.fontSize,
            size: row.size,
            emphasized: Boolean(row.emphasized),
            lineIndex: row.lineIndex,
            lineStart: Number(row.lineStart.toFixed(3)),
            wrapIndex: row.wrapIndex,
            gapAfter: row.gapAfter,
            words: row.words.map((word) => word.text),
          })),
      },
      frameCount: wordWall.frameCount,
    };
  } else {
    const filters = await filtersFor(config, overlayInputs);
    rendererMetadata = {
      renderer: rendererKey,
      resolvedArgs: resolveRendererArgs(config),
    };
    for (const overlay of overlayInputs) {
      if (overlay.framePattern) {
        inputArgs.push("-framerate", String(FPS), "-i", overlay.framePattern);
      } else if (Array.isArray(overlay.frameFiles) && overlay.frameFiles.length > 0) {
        for (const frameFile of overlay.frameFiles) {
          inputArgs.push("-loop", "1", "-i", frameFile);
        }
      } else {
        inputArgs.push("-loop", "1", "-i", overlay.filePath);
      }
    }
    filterComplex = buildFilterComplex({ config, filters, overlayInputs, duration });
  }
  try {
    run("ffmpeg", [
      "-y",
      ...inputArgs,
      "-filter_complex", filterComplex,
      "-map", "[vout]",
      "-t", String(duration),
      "-an",
      "-c:v", "libx264",
      "-pix_fmt", "yuv420p",
      "-r", String(FPS),
      "-movflags", "+faststart",
      output,
    ]);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
  if (poster) {
    ensureDir(poster);
    run("ffmpeg", ["-y", "-ss", "1", "-i", output, "-frames:v", "1", poster]);
  }
  console.log(JSON.stringify({ output, poster, durationSeconds: duration, backgroundImagePath: backgroundImagePath || null, backgroundVideoPath: backgroundVideoPath || null, ...rendererMetadata }, null, 2));
}

export {
  COMPARISON_TIMING,
  barChart,
  comparison,
  comparisonRevealTiming,
  statReveal,
  pieChart,
  lineGrowthChart,
  rankedPodium,
  scorecard,
  sequentialRevealTiming,
  stepChecklist,
  researchPaperCard,
  goodBadIndicator,
  instruction,
  causeEffect,
  resolveRendererKey,
  resolveRendererArgs,
};

const isCli = process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;

if (isCli) {
  try {
    await main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
