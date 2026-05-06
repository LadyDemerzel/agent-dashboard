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
const CAPTION_WORD_WALL_ACTIVE_WORD_POP_KEYFRAMES = [
  { progress: 0, scale: 1, translateYEm: 0, fontWeight: CAPTION_WORD_WALL_ACTIVE_WORD_BASE_FONT_WEIGHT, easingToNext: "ease-out-quart" },
  { progress: 0.2, scale: 1.2, translateYEm: 0.5, fontWeight: CAPTION_WORD_WALL_ACTIVE_WORD_PEAK_FONT_WEIGHT, easingToNext: "ease-out-cubic" },
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

function asData(value) {
  if (Array.isArray(value)) {
    return value.map((item, index) => {
      if (item && typeof item === "object") {
        return {
          label: asText(item.label, `Item ${index + 1}`),
          value: asNumber(item.value, 0),
          displayValue: asText(item.displayValue, asText(item.value, "0")),
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
      lineStart: resolvedWords[0]?.start ?? 0,
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
      let y = Math.round((HEIGHT - totalHeight) / 2);
      return {
        alignment: "left",
        x: leftX,
        spacingMode: "svg-fixed-space-tspans-active-font-pop",
        rows: rows.map((row, index) => {
          const next = { ...row, y, gapAfter: gaps[index] };
          y += row.height + gaps[index];
          return next;
        }),
        normalSize,
        totalHeight,
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

  for (const row of layout.rows) {
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
    .replace(/'/g, "\\'")
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

function animatedBox(x, y, w, h, color, start) {
  return box(x, y, w, h, color, revealEnable(start));
}

function animatedBoxSlideDown(x, y, w, h, color, start, distance = 34, duration = 0.36) {
  return box(x, slideYDownExpr(y, start, distance, duration), w, h, color, `:enable='gte(t\\,${start.toFixed(3)})'`);
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
  return { filePath, x, y, height: imageHeight, start, enterYOffset, exitYOffset, fadeIn, fadeOut, exitStart, growDownDuration };
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
  const titleStart = 1.12;
  const titleRevealDuration = 0.54;
  const valueStyle = STAT_REVEAL_TEXT_STYLE.value;
  const titleStyle = STAT_REVEAL_TEXT_STYLE.title;
  return [
    ...baseFilters(stylePreset),
    animatedUnifiedText(args.value || "73%", 124, 564, valueStyle.fontSize, valueStyle.color, 0.72, 58, textShadow(valueStyle.shadowOpacity, valueStyle.shadowOffsetY), 0.66),
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
  const lastRevealFinish = firstRevealAt + (revealSlotCount - 1) * (barRevealDuration + barGapAfterReveal) + barRevealDuration;
  const barBaseY = 1398;
  const barMaxH = 610;
  const gap = data.length <= 3 ? 64 : 42;
  const barW = Math.floor((820 - gap * Math.max(0, data.length - 1)) / Math.max(1, data.length));
  const accents = [UNIFIED_PALETTE.mutedBlue, UNIFIED_PALETTE.mutedSage, UNIFIED_PALETTE.mutedPeach, UNIFIED_PALETTE.mutedLavender, "#d7d2c9@0.66"];
  const filters = [
    ...baseFilters(stylePreset),
    ...animatedUnifiedTextLines(args.title || "What changed most", 124, 260, 62, UNIFIED_PALETTE.offWhite, firstRevealAt, 22, 18, 46, "", titleRevealDuration, 0, titleRevealDuration),
    ...animatedHorizontalRule(124, barBaseY + 22, 832, 3, UNIFIED_PALETTE.faintGrey, firstRevealAt, lastRevealFinish - firstRevealAt),
  ];
  data.forEach((item, i) => {
    const timing = fixedRevealTiming(i, { firstRevealAt, revealDuration: barRevealDuration, gapAfterReveal: barGapAfterReveal });
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

function comparison(args, stylePreset, overlayInputs) {
  void overlayInputs;
  const leftStart = 1.08;
  const rightStart = 2.38;
  return [
    ...baseFilters(stylePreset),
    animatedVerticalRule(538, 574, 720, UNIFIED_PALETTE.faintGrey, 0.92, 4),
    animatedUnifiedText(args.beforeLabel || "Before", 126, 612, 42, UNIFIED_PALETTE.dimGrey, leftStart, 32),
    ...animatedUnifiedTextLines(args.before || "Problem state", 126, 740, 56, UNIFIED_PALETTE.offWhite, leftStart + 0.22, 13, 17, 44),
    animatedBox(126, 1124, 236, 3, UNIFIED_PALETTE.faintGrey, leftStart + 0.46),
    animatedUnifiedText(args.afterLabel || "After", 600, 612, 42, UNIFIED_PALETTE.dimGrey, rightStart, 32),
    ...animatedUnifiedTextLines(args.after || "Improved state", 600, 740, 56, UNIFIED_PALETTE.offWhite, rightStart + 0.22, 13, 17, 44),
    animatedBox(600, 1124, 236, 3, UNIFIED_PALETTE.faintGrey, rightStart + 0.46),
  ];
}

function timeline(args, stylePreset, overlayInputs) {
  void overlayInputs;
  const steps = asTimelineSteps(args.steps, ["Setup", "Signal", "Visible change"]).slice(0, 5);
  const firstRevealAt = 0.64;
  // Fixed, duration-independent timing: each step reveals for 360ms, then the next step starts 300ms later.
  const stepRevealDuration = 0.36;
  const gapAfterStepReveal = 0.3;
  const lastRevealFinish = firstRevealAt + (steps.length - 1) * (stepRevealDuration + gapAfterStepReveal) + stepRevealDuration;
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
    ...animatedVerticalRuleForDuration(verticalRuleX, firstRuleCenterY, lastRuleCenterY - firstRuleCenterY, UNIFIED_PALETTE.faintGrey, firstRevealAt, lastRevealFinish - firstRevealAt, verticalRuleW),
  ];
  steps.forEach((step, i) => {
    const timing = fixedRevealTiming(i, { firstRevealAt, revealDuration: stepRevealDuration, gapAfterReveal: gapAfterStepReveal });
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

async function causeEffect(args, stylePreset, overlayInputs) {
  const cause = asText(args.cause, "Small daily tension");
  const effect = asText(args.effect, "Jaw and neck read tighter");
  const contentX = 126;
  const arrowStemX = contentX + 48;
  const labelSize = 34;
  const bodySize = 62;
  const bodyLineGap = 20;
  const labelToTextGap = 86;
  const arrowMargin = 84;
  const arrowHeight = 156;
  const arrowStart = 1.12;
  const arrowColor = UNIFIED_PALETTE.mutedBlue;
  const labelColor = UNIFIED_PALETTE.dimGrey;
  const bodyLineHeight = bodySize + bodyLineGap;
  const causeLines = wrap(cause, 21).split("\n").filter(Boolean);
  const effectLines = wrap(effect, 21).split("\n").filter(Boolean);
  const textBlockHeight = (lineCount) => bodySize + Math.max(0, lineCount - 1) * bodyLineHeight;
  const sectionHeight = (lineCount) => labelToTextGap + textBlockHeight(lineCount);
  const causeHeight = sectionHeight(causeLines.length || 1);
  const effectHeight = sectionHeight(effectLines.length || 1);
  const totalHeight = causeHeight + arrowMargin + arrowHeight + arrowMargin + effectHeight;
  const causeLabelY = Math.round((HEIGHT - totalHeight) / 2);
  const causeTextY = causeLabelY + labelToTextGap;
  const arrowTopY = causeLabelY + causeHeight + arrowMargin;
  const effectLabelY = arrowTopY + arrowHeight + arrowMargin;
  const effectTextY = effectLabelY + labelToTextGap;
  const filters = [
    ...baseFilters(stylePreset),
    animatedUnifiedTextSlideDown("CAUSE", contentX, causeLabelY, labelSize, labelColor, 0.36, 28, textShadow(0.68, 3), 0.44, 0.44),
    ...animatedUnifiedTextLinesSlideDown(cause, contentX, causeTextY, bodySize, UNIFIED_PALETTE.offWhite, 0.56, 21, bodyLineGap, 44, "", 0.54, 0.045),
    animatedUnifiedTextSlideDown("EFFECT", contentX, effectLabelY, labelSize, labelColor, 1.7, 28, textShadow(0.68, 3), 0.44, 0.44),
    ...animatedUnifiedTextLinesSlideDown(effect, contentX, effectTextY, bodySize, UNIFIED_PALETTE.offWhite, 1.9, 21, bodyLineGap, 44, "", 0.54, 0.045),
  ];
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
  const args = { ...(config.defaultArgs || {}), ...(config.args || {}) };
  const rendererKey = config.rendererId || config.templateId;
  if (rendererKey === "research_finding_card") {
    return statReveal(
      {
        value: asText(args.source, "Finding"),
        title: asText(args.finding, asText(args.implication, "Research finding")),
      },
      config.stylePreset,
      overlayInputs,
    );
  }
  if (rendererKey === "process_flow") {
    return timeline(args, config.stylePreset, overlayInputs);
  }
  switch (rendererKey) {
    case "bar_chart": return barChart(args, config.stylePreset, overlayInputs);
    case "comparison_before_after": return comparison(args, config.stylePreset, overlayInputs);
    case "timeline": return timeline(args, config.stylePreset, overlayInputs);
    case "cause_effect": return causeEffect(args, config.stylePreset, overlayInputs);
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
  overlayInputs.forEach((overlay, index) => {
    const inputIndex = index + 1;
    const prepared = `arrow${index}`;
    const out = `ov${index}`;
    const fadeIn = overlay.fadeIn ?? 0.26;
    const fadeOut = overlay.fadeOut ?? 0.32;
    const exitStart = overlay.exitStart ?? Math.max(overlay.start + fadeIn + 0.6, duration - 0.76 + index * 0.055);
    const disableAt = Math.min(duration, exitStart + fadeOut + 0.08);
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
  const isCaptionWordWall = (config.rendererId || config.templateId) === "caption_word_wall";
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
    for (const overlay of overlayInputs) {
      inputArgs.push("-loop", "1", "-i", overlay.filePath);
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

try {
  await main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
