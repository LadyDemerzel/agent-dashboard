#!/usr/bin/env node

import fs from "fs";
import os from "os";
import path from "path";
import { spawnSync } from "child_process";
import sharp from "sharp";

const WIDTH = 1080;
const HEIGHT = 1920;
const FPS = 30;
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
const INTER_FONT_CANDIDATES = [
  process.env.INTER_FONT_FILE,
  path.join(os.homedir(), ".cache", "convex", "dashboard", "out", "_next", "static", "media", "inter-latin-wght-normal.6c596dfc.woff2"),
  path.join(os.homedir(), ".cache", "convex", "dashboard", "out", "_next", "static", "media", "inter-latin-ext-wght-normal.3835a68e.woff2"),
].filter(Boolean);

function resolveFirstExistingPath(candidates) {
  return candidates.find((candidate) => typeof candidate === "string" && fs.existsSync(candidate)) || "";
}

const INTER_FONT_FILE = resolveFirstExistingPath(INTER_FONT_CANDIDATES);

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

function processFlowAlphaExpr(revealStart, activeStart, activeEnd, dim = 0.46, fade = 0.34) {
  const reveal = smoothStepExpr(revealStart, fade);
  const active = activeWindowExpr(activeStart, activeEnd, 0.32);
  return `(${reveal})*(${dim.toFixed(2)}+${(1 - dim).toFixed(2)}*(${active}))`;
}

function revealEnable(start) {
  return `:enable='gte(t\\,${start.toFixed(3)})'`;
}

function slideXExpr(x, start, distance = 66, duration = 0.5) {
  return `'${x}-${distance}*(1-${smoothStepExpr(start, duration)})'`;
}

function animatedText(value, x, y, size, color, start, distance = 48, extra = "", font = "Helvetica", duration = 0.5) {
  return text(value, slideXExpr(x, start, distance, duration), y, size, color, `${extra}:alpha='${smoothStepExpr(start, 0.34)}'${revealEnable(start)}`, font);
}

function unifiedFont() {
  return INTER_FONT_FILE || UNIFIED_FONT_FAMILY;
}

function textShadow(strength = 0.72, y = 4) {
  return `:shadowcolor=0x000000@${strength.toFixed(2)}:shadowx=0:shadowy=${y}`;
}

function animatedUnifiedText(value, x, y, size, color, start, distance = 46, extra = "", duration = 0.52) {
  return animatedText(value, x, y, size, color, start, distance, `${textShadow()}${extra}`, unifiedFont(), duration);
}

function animatedUnifiedTextLines(value, x, y, size, color, start, max = 24, lineGap = 18, distance = 46, extra = "") {
  return wrap(value, max)
    .split("\n")
    .filter(Boolean)
    .map((line, lineIndex) => animatedUnifiedText(line, x, y + lineIndex * (size + lineGap), size, color, start + lineIndex * 0.045, distance, extra, 0.54));
}

function clipDuration(overlayInputs, fallback = 6) {
  return typeof overlayInputs?.duration === "number" && Number.isFinite(overlayInputs.duration)
    ? overlayInputs.duration
    : fallback;
}

function sequenceTiming(index, count, duration, options = {}) {
  const startPad = options.startPad ?? 0.36;
  const endPad = options.endPad ?? 0.74;
  const usable = Math.max(1.6, duration - startPad - endPad);
  const segment = usable / Math.max(1, count);
  const segmentStart = startPad + index * segment;
  const revealAt = segmentStart + Math.min(0.34, Math.max(0.12, segment * 0.17));
  const activeEnd = Math.min(duration - 0.36, startPad + (index + 1) * segment - 0.06);
  return { segment, segmentStart, revealAt, activeEnd };
}

function animatedBox(x, y, w, h, color, start) {
  return box(x, y, w, h, color, revealEnable(start));
}

function animatedVerticalRule(x, y, h, color, start, width = 4) {
  const p = smoothStepExpr(start, 0.5);
  return box(x, y, width, `'${h}*${p}'`, color, revealEnable(start));
}

function animatedBar(x, baseY, w, h, color, start) {
  const p = smoothStepExpr(start, 0.58);
  return box(x, `'${baseY}-${h}*${p}'`, w, `'max(2\\,${h}*${p})'`, color, revealEnable(start));
}

function processFlowText(value, x, y, size, color, start, activeStart, activeEnd, distance = 48, extra = "", font = "Helvetica", duration = 0.5, dim = 0.46) {
  return text(value, slideXExpr(x, start, distance, duration), y, size, color, `${extra}:alpha='${processFlowAlphaExpr(start, activeStart, activeEnd, dim)}'${revealEnable(start)}`, font);
}

function processFlowTextLines(value, x, y, size, color, start, activeStart, activeEnd, distance = 48, extra = "", font = "Helvetica", max = 24) {
  return wrap(value, max)
    .split("\n")
    .filter(Boolean)
    .map((line, lineIndex) => processFlowText(line, x, y + lineIndex * (size + 18), size, color, start + lineIndex * 0.04, activeStart, activeEnd, distance, extra, font, 0.52));
}

async function createDownArrowOverlay({ tempDir, centerX, topY, height, color, start, index, fadeIn = 0.26, fadeOut = 0.32, exitStart }) {
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
  return { filePath, x, y, start, enterYOffset: 16, exitYOffset: 9, fadeIn, fadeOut, exitStart };
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

function baseFilters(stylePreset) {
  void stylePreset;
  return [];
}

function statReveal(args, stylePreset, overlayInputs) {
  const duration = clipDuration(overlayInputs, 6);
  const noteStart = Math.min(duration - 1.28, 2.24);
  return [
    ...baseFilters(stylePreset),
    animatedUnifiedText(args.eyebrow || "Key finding", 126, 296, 38, UNIFIED_PALETTE.dimGrey, 0.38, 34),
    animatedUnifiedText(args.value || "73%", 124, 564, 186, UNIFIED_PALETTE.offWhite, 0.72, 58, textShadow(0.78, 6), 0.66),
    ...animatedUnifiedTextLines(args.title || "people notice the change", 132, 804, 64, UNIFIED_PALETTE.offWhite, 1.12, 20, 20, 52),
    animatedBox(132, 1064, 616, 4, UNIFIED_PALETTE.faintGrey, 1.72),
    ...animatedUnifiedTextLines(args.note || "Short source or context line.", 132, 1138, 39, UNIFIED_PALETTE.softGrey, noteStart, 31, 16, 38),
  ];
}

function barChart(args, stylePreset, overlayInputs) {
  const data = asData(args.data).slice(0, 5);
  const max = Math.max(1, ...data.map((item) => Math.abs(item.value)));
  const duration = clipDuration(overlayInputs, 7);
  const barBaseY = 1398;
  const barMaxH = 610;
  const gap = data.length <= 3 ? 64 : 42;
  const barW = Math.floor((820 - gap * Math.max(0, data.length - 1)) / Math.max(1, data.length));
  const accents = [UNIFIED_PALETTE.mutedBlue, UNIFIED_PALETTE.mutedSage, UNIFIED_PALETTE.mutedPeach, UNIFIED_PALETTE.mutedLavender, "#d7d2c9@0.66"];
  const filters = [
    ...baseFilters(stylePreset),
    ...animatedUnifiedTextLines(args.title || "What changed most", 124, 260, 62, UNIFIED_PALETTE.offWhite, 0.36, 22, 18),
    animatedUnifiedText(args.subtitle || "Relative lift", 128, 420, 34, UNIFIED_PALETTE.dimGrey, 0.66, 34),
    animatedBox(124, barBaseY + 22, 832, 3, UNIFIED_PALETTE.faintGrey, 0.94),
  ];
  data.forEach((item, i) => {
    const timing = sequenceTiming(i, data.length, duration, { startPad: 1.04, endPad: 1.1 });
    const x = 130 + i * (barW + gap);
    const h = Math.max(40, Math.round((Math.abs(item.value) / max) * barMaxH));
    const valueY = barBaseY - h - 72;
    filters.push(animatedBar(x, barBaseY, barW, h, accents[i % accents.length], timing.revealAt));
    filters.push(animatedUnifiedText(item.displayValue || String(item.value), x, valueY, 34, UNIFIED_PALETTE.offWhite, timing.revealAt + 0.22, 24, textShadow(0.7, 3), 0.46));
    filters.push(...animatedUnifiedTextLines(item.label, x, barBaseY + 76, 28, UNIFIED_PALETTE.softGrey, timing.revealAt + 0.32, 9, 9, 18));
  });
  return filters;
}

function comparison(args, stylePreset, overlayInputs) {
  const duration = clipDuration(overlayInputs, 6);
  const leftStart = 1.08;
  const rightStart = Math.min(duration - 1.8, 2.38);
  return [
    ...baseFilters(stylePreset),
    ...animatedUnifiedTextLines(args.title || "The visible difference", 124, 246, 60, UNIFIED_PALETTE.offWhite, 0.36, 22, 18),
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
  const steps = asList(args.steps, ["Setup", "Signal", "Visible change"]).slice(0, 5);
  const duration = clipDuration(overlayInputs, 7);
  const stepGap = steps.length <= 3 ? 266 : steps.length === 4 ? 218 : 180;
  const totalH = (steps.length - 1) * stepGap;
  const startY = Math.round((HEIGHT - totalH) / 2) + (steps.length <= 3 ? 80 : 40);
  const filters = [
    ...baseFilters(stylePreset),
    ...animatedUnifiedTextLines(args.title || "What happens next", 124, 232, 60, UNIFIED_PALETTE.offWhite, 0.36, 22, 18),
    animatedVerticalRule(228, startY - 22, totalH + 44, UNIFIED_PALETTE.faintGrey, 0.86, 4),
  ];
  steps.forEach((step, i) => {
    const timing = sequenceTiming(i, steps.length, duration, { startPad: 0.82, endPad: 1.0 });
    const y = startY + i * stepGap;
    filters.push(animatedBox(198, y + 20, 62, 4, i % 2 ? UNIFIED_PALETTE.mutedSage : UNIFIED_PALETTE.mutedPeach, timing.revealAt));
    filters.push(animatedUnifiedText(String(i + 1).padStart(2, "0"), 124, y - 8, 38, UNIFIED_PALETTE.dimGrey, timing.revealAt, 28, textShadow(0.68, 3), 0.46));
    filters.push(...animatedUnifiedTextLines(step, 306, y - 14, steps.length <= 3 ? 54 : 48, UNIFIED_PALETTE.offWhite, timing.revealAt + 0.14, 24, 16, 44));
  });
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

  const clipDuration = typeof overlayInputs.duration === "number" && Number.isFinite(overlayInputs.duration)
    ? overlayInputs.duration
    : 7;
  const segmentDuration = clipDuration / Math.max(1, steps.length);
  const revealLead = Math.min(0.42, Math.max(0.22, segmentDuration * 0.18));
  const activeHold = Math.min(segmentDuration * 0.82, Math.max(0.78, segmentDuration - 0.28));

  for (let i = 0; i < steps.length; i += 1) {
    const step = steps[i];
    const segmentStart = i * segmentDuration;
    const revealAt = Math.max(0.26, segmentStart + revealLead);
    const activeStart = revealAt + 0.02;
    const activeEnd = Math.min(clipDuration - 0.3, segmentStart + activeHold);
    const y = startY + i * (cardH + gap);
    filters.push(processFlowText(String(i + 1).padStart(2, "0"), numberX, y + 42, 48, offWhiteGrey, revealAt + 0.1, activeStart, activeEnd, 38, numberShadow, mediumFont, 0.5, 0.42));
    filters.push(...processFlowTextLines(step, textX, y + 34, steps.length <= 3 ? 58 : 51, offWhiteGrey, revealAt + 0.16, activeStart, activeEnd, 46, textShadow, mediumFont, 24));
    if (i < steps.length - 1) {
      const nextSegmentStart = (i + 1) * segmentDuration;
      const nextRevealAt = Math.max(0.26, nextSegmentStart + revealLead);
      const arrowRevealAt = Math.max(revealAt + 0.35, nextRevealAt - Math.min(0.34, segmentDuration * 0.16));
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
        exitStart: Math.min(clipDuration - 0.35, nextSegmentStart + activeHold),
      }));
    }
  }
  return filters;
}

function researchCard(args, stylePreset, overlayInputs) {
  const duration = clipDuration(overlayInputs, 6);
  const findingStart = 0.96;
  const implicationStart = Math.min(duration - 1.7, 2.74);
  return [
    ...baseFilters(stylePreset),
    animatedUnifiedText("RESEARCH NOTE", 126, 276, 34, UNIFIED_PALETTE.dimGrey, 0.36, 30),
    ...animatedUnifiedTextLines(args.source || "Study finding", 126, 388, 40, UNIFIED_PALETTE.softGrey, 0.58, 28, 14, 34),
    ...animatedUnifiedTextLines(args.finding || "Core research finding.", 126, 592, 62, UNIFIED_PALETTE.offWhite, findingStart, 20, 19, 52),
    animatedBox(126, 1134, 620, 4, UNIFIED_PALETTE.faintGrey, implicationStart - 0.34),
    ...animatedUnifiedTextLines(args.implication || "Practical takeaway.", 126, 1222, 42, UNIFIED_PALETTE.softGrey, implicationStart, 29, 15, 38),
  ];
}

async function filtersFor(config, overlayInputs) {
  const args = { ...(config.defaultArgs || {}), ...(config.args || {}) };
  switch (config.rendererId || config.templateId) {
    case "bar_chart": return barChart(args, config.stylePreset, overlayInputs);
    case "comparison_before_after": return comparison(args, config.stylePreset, overlayInputs);
    case "timeline": return timeline(args, config.stylePreset, overlayInputs);
    case "process_flow": return processFlow(args, config.stylePreset, overlayInputs);
    case "research_finding_card": return researchCard(args, config.stylePreset, overlayInputs);
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

function rendererIdFor(config) {
  return String(config.rendererId || config.templateId || "stat_reveal");
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
    const yExpr = `'${overlay.y}+${overlay.enterYOffset ?? 14}*(1-${smoothStepExpr(overlay.start, fadeIn)})-${overlay.exitYOffset ?? 8}*${smoothStepExpr(exitStart, fadeOut)}'`;
    graph.push(`[${inputIndex}:v]format=rgba,fade=t=in:st=${overlay.start.toFixed(3)}:d=${fadeIn.toFixed(3)}:alpha=1,fade=t=out:st=${exitStart.toFixed(3)}:d=${fadeOut.toFixed(3)}:alpha=1[${prepared}]`);
    graph.push(`[${previous}][${prepared}]overlay=x=${overlay.x}:y=${yExpr}:enable='between(t\\,${overlay.start.toFixed(3)}\\,${disableAt.toFixed(3)})'[${out}]`);
    previous = out;
  });
  graph.push(`[${previous}]format=yuv420p[vout]`);
  return graph.join(";");
}

async function main() {
  const configPath = readArg("--config");
  const output = readArg("--output");
  const poster = readArg("--poster");
  if (!configPath || !output) throw new Error("Usage: render-motion-graphic.mjs --config config.json --output out.mp4 [--poster poster.png]");
  const config = JSON.parse(fs.readFileSync(configPath, "utf-8"));
  const duration = Math.min(12, Math.max(3, asNumber(config.durationSeconds, 6)));
  ensureDir(output);
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "motion-graphic-render-"));
  const overlayInputs = [];
  overlayInputs.tempDir = tempDir;
  overlayInputs.duration = duration;
  const filters = await filtersFor(config, overlayInputs);
  const backgroundImagePath = resolveUnifiedBackgroundImagePath(config);
  const backgroundVideoPath = backgroundImagePath ? "" : resolveBackgroundVideoPath(config);
  const inputArgs = backgroundImagePath
    ? ["-loop", "1", "-i", backgroundImagePath]
    : backgroundVideoPath
      ? ["-fflags", "+genpts+discardcorrupt", "-err_detect", "ignore_err", "-stream_loop", "-1", "-i", backgroundVideoPath]
      : ["-f", "lavfi", "-i", `color=c=0x101116:s=${WIDTH}x${HEIGHT}:d=${duration}:r=${FPS}`];
  for (const overlay of overlayInputs) {
    inputArgs.push("-loop", "1", "-i", overlay.filePath);
  }
  const filterComplex = buildFilterComplex({ config, filters, overlayInputs, duration });
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
  console.log(JSON.stringify({ output, poster, durationSeconds: duration, backgroundImagePath: backgroundImagePath || null, backgroundVideoPath: backgroundVideoPath || null }, null, 2));
}

try {
  await main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
