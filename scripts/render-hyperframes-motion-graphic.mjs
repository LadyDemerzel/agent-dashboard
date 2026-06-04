#!/usr/bin/env node

import fs from "fs";
import os from "os";
import path from "path";
import { fileURLToPath, pathToFileURL } from "url";
import { spawnSync } from "child_process";

const WIDTH = 1080;
const HEIGHT = 1920;
const FPS = 30;
const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SHORT_FORM_VIDEOS_DIR = path.join(os.homedir(), "tenxsolo", "business", "content", "deliverables", "short-form-videos");
const MOTION_GRAPHIC_ASSETS_DIR = path.join(SHORT_FORM_VIDEOS_DIR, "_motion-graphic-assets");
const UNIFIED_BACKGROUND_IMAGE_PATH = path.join(MOTION_GRAPHIC_ASSETS_DIR, "process-flow-dark-pastel-watercolor-bg.png");
const HYPERFRAMES_CLI = path.join(REPO_ROOT, "node_modules", "hyperframes", "dist", "cli.js");
const GSAP_SCRIPT = path.join(REPO_ROOT, "node_modules", "gsap", "dist", "gsap.min.js");
const VIDEO_RENDER_SETTINGS_PATH = path.join(REPO_ROOT, "settings", "short-form-video", "_video-render-settings.json");
const CAPTION_WORD_WALL_HORIZONTAL_PADDING = Math.round(WIDTH * 0.15);
const CAPTION_WORD_WALL_TEXT_WIDTH = WIDTH - (CAPTION_WORD_WALL_HORIZONTAL_PADDING * 2);

const PALETTE = {
  offWhite: "#e8e5dd",
  softGrey: "#cbc6bd",
  dimGrey: "rgba(232,229,221,0.48)",
  faintGrey: "rgba(232,229,221,0.26)",
  mutedBlue: "rgba(168,191,208,0.78)",
  mutedSage: "rgba(184,200,173,0.78)",
  mutedPeach: "rgba(214,174,143,0.8)",
  mutedLavender: "rgba(185,173,209,0.78)",
  darkPanel: "rgba(232,229,221,0.06)",
  darkStroke: "rgba(232,229,221,0.12)",
};
const ACCENTS = [PALETTE.mutedBlue, PALETTE.mutedSage, PALETTE.mutedPeach, PALETTE.mutedLavender, "rgba(215,210,201,0.72)"];
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

function readArg(name, fallback) {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd || REPO_ROOT,
    encoding: "utf-8",
    maxBuffer: 32 * 1024 * 1024,
  });
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

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function cssString(value, fallback = "") {
  return String(value ?? fallback).replace(/["\\\n\r]/g, "");
}

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
  if ((rendererKey === "checklist" || rendererKey === "ranked_podium") && hasListSource(providedArgs.steps) && !hasListSource(providedArgs.items)) {
    args.items = providedArgs.steps;
  }
  return args;
}

function asOptionalTimingSeconds(value) {
  if (value === undefined || value === null || value === "") return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, Math.round(parsed * 1000) / 1000) : undefined;
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

function timingValue(args, keys, fallback) {
  const timings = animationTimings(args);
  for (const key of Array.isArray(keys) ? keys : [keys]) {
    const timing = asOptionalTimingSeconds(timings[key]);
    if (timing !== undefined) return timing;
  }
  return fallback;
}

function itemTiming(args, sourceName, item, index, fallback, aliases = []) {
  const direct = directTiming(item);
  if (direct !== undefined) return direct;
  const timings = animationTimings(args);
  for (const name of [sourceName, ...aliases].filter(Boolean)) {
    const collection = timings[name];
    if (Array.isArray(collection)) {
      const timing = asOptionalTimingSeconds(collection[index]);
      if (timing !== undefined) return timing;
    }
    if (collection && typeof collection === "object") {
      const byIndex = asOptionalTimingSeconds(collection[index + 1] ?? collection[String(index + 1)]);
      if (byIndex !== undefined) return byIndex;
      const label = asText(item?.label || item?.text || "");
      if (label) {
        const byLabel = asOptionalTimingSeconds(collection[label]);
        if (byLabel !== undefined) return byLabel;
      }
    }
    const keyed = asOptionalTimingSeconds(
      timings[`${name}.${index + 1}`]
      ?? timings[`${name}[${index + 1}]`]
      ?? timings[`${name}:${index + 1}`]
      ?? (item?.label ? timings[`${name}:${item.label}`] : undefined),
    );
    if (keyed !== undefined) return keyed;
  }
  return fallback;
}

function fixedRevealTiming(index, options = {}) {
  const firstRevealAt = options.firstRevealAt ?? 0.36;
  const revealDuration = options.revealDuration ?? 0.38;
  const gapAfterReveal = options.gapAfterReveal ?? 0.58;
  const revealAt = firstRevealAt + index * (revealDuration + gapAfterReveal);
  return { revealAt, revealDuration, finishAt: revealAt + revealDuration };
}

function wrap(value, max = 24, maxLines = 4) {
  const words = asText(value).split(/\s+/).filter(Boolean);
  const lines = [];
  let line = "";
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (line && next.length > max) {
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

function hasListSource(value) {
  return Array.isArray(value) ? value.length > 0 : typeof value === "string" && value.trim().length > 0;
}

function asTimelineSteps(value, fallback = []) {
  const source = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? value.split(/[|\n,]+/).map((item) => item.trim()).filter(Boolean)
      : fallback;
  return source.map((item, index) => {
    if (item && typeof item === "object") {
      const text = asText(item.text ?? item.copy ?? item.title ?? item.step ?? item.value);
      if (!text) return null;
      return {
        label: asText(item.label ?? item.leftLabel ?? item.marker, String(index + 1).padStart(2, "0")).slice(0, 60),
        text,
        ...((directTiming(item) !== undefined) ? { animateIn: directTiming(item) } : {}),
      };
    }
    const text = asText(item);
    return text ? { label: String(index + 1).padStart(2, "0"), text } : null;
  }).filter(Boolean);
}

function asData(value) {
  if (!Array.isArray(value)) return [];
  return value.map((item, index) => {
    if (item && typeof item === "object") {
      return {
        label: asText(item.label, `Item ${index + 1}`),
        value: asNumber(item.value, 0),
        displayValue: asText(item.displayValue, asText(item.value, "0")),
        ...((directTiming(item) !== undefined) ? { animateIn: directTiming(item) } : {}),
      };
    }
    return { label: `Item ${index + 1}`, value: asNumber(item, 0), displayValue: asText(item, String(item ?? "0")) };
  }).filter((item) => item.label && Number.isFinite(item.value));
}

function normalizeWordToken(value) {
  const normalized = String(value || "")
    .toLowerCase()
    .replace(/[’‘]/g, "'")
    .replace(/['`]/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, "");
  return normalized || String(value || "").toLowerCase().trim();
}

function readAlignmentWords(alignmentPath) {
  if (!alignmentPath || !fs.existsSync(alignmentPath)) return [];
  const payload = JSON.parse(fs.readFileSync(alignmentPath, "utf-8"));
  const items = Array.isArray(payload?.items) ? payload.items : [];
  return items.map((item, index) => ({
    index,
    text: asText(item?.text),
    normalized: normalizeWordToken(item?.text),
    start: Number(item?.start_time),
    end: Number(item?.end_time),
  })).filter((item) => item.text && item.normalized && Number.isFinite(item.start) && Number.isFinite(item.end) && item.end >= item.start);
}

function splitDisplayWords(value) {
  return String(value || "").split(/\s+/).map((word) => word.trim()).filter(Boolean);
}

function htmlElement(id, className, style, content = "", attrs = "") {
  return `<div id="${id}" class="clip ${className}" data-track-index="1" ${attrs} style="${style}">${content}</div>`;
}

function textBlock(id, lines, x, y, options = {}) {
  const size = options.size ?? 58;
  const lineGap = options.lineGap ?? 16;
  const align = options.align || "left";
  const width = options.width || 820;
  const color = options.color || PALETTE.offWhite;
  const content = lines.map((line) => `<div>${escapeHtml(line)}</div>`).join("");
  return htmlElement(
    id,
    `text-block ${options.className || ""}`,
    `left:${x}px;top:${y}px;width:${width}px;font-size:${size}px;line-height:${size + lineGap}px;text-align:${align};color:${color};`,
    content,
  );
}

function reveal(timeline, selector, at, options = {}) {
  const duration = options.duration ?? 0.42;
  const y = options.y ?? 34;
  timeline.push(`tl.fromTo(${JSON.stringify(selector)}, {opacity:0, y:${y}}, {opacity:1, y:0, duration:${duration}, ease:"power3.out"}, ${Number(at).toFixed(3)});`);
}

function scaleReveal(timeline, selector, at, options = {}) {
  const duration = options.duration ?? 0.42;
  timeline.push(`tl.fromTo(${JSON.stringify(selector)}, {opacity:0, scale:${options.fromScale ?? 0.96}}, {opacity:1, scale:1, duration:${duration}, ease:"power3.out"}, ${Number(at).toFixed(3)});`);
}

function buildBaseBackground(config) {
  const backgroundImagePath = resolveBackgroundImagePath(config);
  const imageLayer = backgroundImagePath
    ? `<img class="background-image" src="${pathToFileURL(backgroundImagePath).href}" alt="" />`
    : "";
  return `
    ${imageLayer}
    <div class="background-dim"></div>
    <div class="grain"></div>
  `;
}

function resolveBackgroundImagePath(config) {
  const raw = asText(config?.backgroundImagePath);
  if (raw && fs.existsSync(raw)) return raw;
  return fs.existsSync(UNIFIED_BACKGROUND_IMAGE_PATH) ? UNIFIED_BACKGROUND_IMAGE_PATH : "";
}

function statReveal(args, timeline) {
  const valueStart = timingValue(args, ["value", "stat", "number"], 0.72);
  const titleStart = timingValue(args, "title", 1.12);
  const html = [
    textBlock("stat-value", [asText(args.value, "73%")], 124, 548, { size: 186, lineGap: 18, width: 860, className: "massive" }),
    textBlock("stat-title", wrap(args.title || "people notice the change", 20), 132, 800, { size: 64, lineGap: 20, width: 820 }),
    htmlElement("stat-rule", "rule", "left:132px;top:1064px;width:616px;height:4px;background:rgba(232,229,221,.26);transform-origin:left center;"),
  ];
  reveal(timeline, "#stat-value", valueStart, { y: 58, duration: 0.66 });
  reveal(timeline, "#stat-title", titleStart, { y: 52, duration: 0.52 });
  timeline.push(`tl.fromTo("#stat-rule", {opacity:0, scaleX:0}, {opacity:1, scaleX:1, duration:.54, ease:"power3.out"}, ${titleStart.toFixed(3)});`);
  return html.join("\n");
}

function barChart(args, timeline) {
  const rows = asData(args.data).slice(0, 5);
  const data = rows.length ? rows : [{ label: "A", value: 35, displayValue: "35" }, { label: "B", value: 68, displayValue: "68" }, { label: "C", value: 92, displayValue: "92" }];
  const max = Math.max(1, ...data.map((item) => Math.abs(item.value)));
  const titleRevealAt = timingValue(args, "title", 0.36);
  const barBaseY = 1398;
  const barMaxH = 610;
  const gap = data.length <= 3 ? 64 : 42;
  const barW = Math.floor((820 - gap * Math.max(0, data.length - 1)) / Math.max(1, data.length));
  const html = [textBlock("bar-title", wrap(args.title || "What changed most", 22), 124, 260, { size: 62, lineGap: 18 })];
  reveal(timeline, "#bar-title", titleRevealAt, { duration: 0.34 });
  data.forEach((item, index) => {
    const fallback = fixedRevealTiming(index, { firstRevealAt: 0.36, revealDuration: 0.4, gapAfterReveal: 0.3 }).revealAt;
    const at = itemTiming(args, "data", item, index, fallback, ["bars", "bar", "items"]);
    const x = 130 + index * (barW + gap);
    const h = Math.max(40, Math.round((Math.abs(item.value) / max) * barMaxH));
    const centerX = x + barW / 2;
    html.push(htmlElement(`bar-${index}`, "bar", `left:${x}px;top:${barBaseY - h}px;width:${barW}px;height:${h}px;background:${ACCENTS[index % ACCENTS.length]};border-radius:14px 14px 0 0;transform-origin:center bottom;`));
    html.push(textBlock(`bar-value-${index}`, [item.displayValue || String(item.value)], centerX - 110, barBaseY - h - 82, { width: 220, size: 34, align: "center" }));
    html.push(textBlock(`bar-label-${index}`, wrap(item.label, 9, 2), centerX - 110, barBaseY + 76, { width: 220, size: 28, lineGap: 9, align: "center", color: PALETTE.softGrey }));
    timeline.push(`tl.fromTo("#bar-${index}", {opacity:0, scaleY:0}, {opacity:1, scaleY:1, duration:.4, ease:"power3.out"}, ${at.toFixed(3)});`);
    reveal(timeline, `#bar-value-${index}`, at, { y: h, duration: 0.4 });
    reveal(timeline, `#bar-label-${index}`, at, { y: 22, duration: 0.32 });
  });
  html.push(htmlElement("bar-axis", "rule", `left:124px;top:${barBaseY + 22}px;width:832px;height:3px;background:${PALETTE.faintGrey};transform-origin:left center;`));
  timeline.push(`tl.fromTo("#bar-axis", {opacity:0, scaleX:0}, {opacity:1, scaleX:1, duration:1.1, ease:"power2.out"}, ${titleRevealAt.toFixed(3)});`);
  return html.join("\n");
}

function pieSlicePath(cx, cy, r, startDeg, endDeg) {
  const start = (startDeg * Math.PI) / 180;
  const end = (endDeg * Math.PI) / 180;
  const x1 = cx + r * Math.cos(start);
  const y1 = cy + r * Math.sin(start);
  const x2 = cx + r * Math.cos(end);
  const y2 = cy + r * Math.sin(end);
  const large = endDeg - startDeg > 180 ? 1 : 0;
  return `M ${cx} ${cy} L ${x1.toFixed(1)} ${y1.toFixed(1)} A ${r} ${r} 0 ${large} 1 ${x2.toFixed(1)} ${y2.toFixed(1)} Z`;
}

function pieChart(args, timeline) {
  const rows = asData(args.data).slice(0, 5);
  const positive = (rows.length ? rows : [{ label: "A", value: 35, displayValue: "35%" }, { label: "B", value: 25, displayValue: "25%" }, { label: "C", value: 40, displayValue: "40%" }])
    .map((item) => ({ ...item, value: Math.max(0, Math.abs(item.value)) }))
    .filter((item) => item.value > 0);
  const data = positive.length ? positive : [{ label: "A", value: 1, displayValue: "100%" }];
  const total = data.reduce((sum, item) => sum + item.value, 0);
  const titleRevealAt = timingValue(args, "title", 0.36);
  const html = [textBlock("pie-title", wrap(args.title || "What changed most", 22), 124, 260, { size: 62, lineGap: 18 })];
  reveal(timeline, "#pie-title", titleRevealAt, { duration: 0.42 });
  let angle = -90;
  const paths = [];
  data.forEach((item, index) => {
    const nextAngle = index === data.length - 1 ? 270 : angle + (item.value / total) * 360;
    paths.push(`<path id="pie-slice-${index}" d="${pieSlicePath(540, 805, 284, angle, nextAngle)}" fill="${ACCENTS[index % ACCENTS.length]}" stroke="rgba(232,229,221,.42)" stroke-width="3" opacity="0"/>`);
    const at = itemTiming(args, "data", item, index, fixedRevealTiming(index, { firstRevealAt: 0.58, revealDuration: 0.34, gapAfterReveal: 0.16 }).revealAt, ["slices", "slice", "items"]);
    timeline.push(`tl.fromTo("#pie-slice-${index}", {opacity:0, scale:.96, transformOrigin:"540px 805px"}, {opacity:1, scale:1, duration:.34, ease:"power3.out"}, ${at.toFixed(3)});`);
    const y = 1214 + index * (data.length <= 3 ? 100 : 82);
    html.push(htmlElement(`pie-swatch-${index}`, "swatch", `left:166px;top:${y + 3}px;width:37px;height:37px;background:${ACCENTS[index % ACCENTS.length]};border-radius:6px;`));
    html.push(textBlock(`pie-label-${index}`, [item.label], 228, y, { width: 520, size: 36 }));
    html.push(textBlock(`pie-value-${index}`, [item.displayValue || `${Math.round((item.value / total) * 100)}%`], 720, y, { width: 194, size: 36, align: "right", color: PALETTE.dimGrey }));
    reveal(timeline, `#pie-swatch-${index}, #pie-label-${index}, #pie-value-${index}`, at + 0.08, { y: 24, duration: 0.28 });
    angle = nextAngle;
  });
  html.push(`<svg class="svg-layer" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}">${paths.join("\n")}</svg>`);
  return html.join("\n");
}

function chartDirection(value) {
  const raw = String(value || "").trim().toLowerCase().replace(/[\s-]+/g, "_");
  return /decrease|decline|down|worse|shrink/.test(raw) ? "decrease" : "increase";
}

function animatedNumberFormatterSource(label) {
  const raw = asText(label);
  if (!raw) return "null";
  const match = raw.match(/^(\s*[^0-9+\-.]*)([+-]?\d[\d,]*(?:\.\d+)?)(.*)$/);
  if (!match) return `function(){ return ${JSON.stringify(raw)}; }`;
  const [, prefix, numericText, suffix] = match;
  const target = Number(numericText.replace(/,/g, ""));
  if (!Number.isFinite(target)) return `function(){ return ${JSON.stringify(raw)}; }`;
  const decimals = numericText.includes(".") ? numericText.split(".").at(-1).length : 0;
  const useCommas = numericText.includes(",");
  const hasExplicitPlus = numericText.startsWith("+");
  return `function(progress) {
    const clamped = Math.max(0, Math.min(1, Number(progress) || 0));
    if (clamped >= 0.9995) return ${JSON.stringify(raw)};
    const current = ${target} * clamped;
    const rounded = ${decimals > 0} ? current.toFixed(${decimals}) : String(Math.round(current));
    const unsigned = rounded.replace(/^-/, "");
    const formatted = ${useCommas} ? unsigned.replace(/\\B(?=(\\d{3})+(?!\\d))/g, ",") : unsigned;
    const sign = current < 0 ? "-" : ${hasExplicitPlus} ? "+" : "";
    return ${JSON.stringify(prefix)} + sign + formatted + ${JSON.stringify(suffix)};
  }`;
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

function timelineLabelLayout(value) {
  const maxCharsPerLine = 8;
  const maxLines = 2;
  let lines = wrap(value, maxCharsPerLine, maxLines);
  if (lines.length === 0) lines = ["01"];
  const hadOverflow = lines.length > maxLines || lines.some((line) => line.length > maxCharsPerLine + 2);
  lines = lines.slice(0, maxLines).map((line) => {
    if (line.length <= maxCharsPerLine) return line;
    return `${line.slice(0, Math.max(0, maxCharsPerLine - 3))}...`;
  });
  if (hadOverflow && lines.length > 0 && !lines[lines.length - 1].endsWith("...")) {
    const line = lines[lines.length - 1];
    lines[lines.length - 1] = `${line.slice(0, Math.max(0, maxCharsPerLine - 3))}...`;
  }
  const longestLineLength = Math.max(...lines.map((line) => line.length));
  const fontSize = lines.length > 1 ? 26 : longestLineLength >= 7 ? 30 : longestLineLength >= 6 ? 34 : 38;
  const lineGap = lines.length > 1 ? 6 : 0;
  const blockHeight = lines.length * fontSize + Math.max(0, lines.length - 1) * lineGap;
  return { lines, fontSize, lineGap, blockHeight };
}

function lineGrowthChart(args, timeline) {
  const direction = chartDirection(args.direction);
  const title = asText(args.title, direction === "decrease" ? "Decline trend" : "Growth trend");
  const titleRevealAt = timingValue(args, "title", 0.36);
  const chartRevealAt = timingValue(args, ["chart", "line", "trend"], 0.88);
  const chartY = 590;
  const chartW = 788;
  const chartH = chartW;
  const pad = 40;
  const axisW = chartW - pad * 2;
  const axisH = chartH - pad * 2;
  const axisX = WIDTH / 2 - axisW / 2;
  const axisY = chartY + chartH - pad;
  const axisTopY = chartY + pad;
  const axisRightX = axisX + axisW;
  const bendX = axisW * 0.66;
  const steepenedSecondSegmentRatio = 0.728;
  const localPoints = direction === "decrease"
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
  const points = localPoints.map((point) => ({ x: axisX + point.x, y: axisTopY + point.y }));
  const rawValueLabel = Object.prototype.hasOwnProperty.call(args, "valueLabel")
    ? valueLabelWithUnits(args.valueLabel, args.units)
    : "";
  const html = [
    textBlock("line-title", wrap(title, 22), 124, 260, { size: 62, lineGap: 18 }),
    `<svg class="svg-layer" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}">
      <defs>
        <clipPath id="line-growth-clip">
          <rect x="${axisX}" y="0" width="${axisW + 84}" height="${axisY}"/>
        </clipPath>
        <filter id="line-growth-value-shadow" x="-30%" y="-80%" width="160%" height="220%">
          <feDropShadow dx="0" dy="4" stdDeviation="0" flood-color="rgba(0,0,0,.72)"/>
        </filter>
      </defs>
      <g id="line-growth-chart" opacity="1">
        <g id="line-growth-grid" clip-path="url(#line-growth-clip)">
          ${[1, 2, 3, 4].map((i) => {
            const hY = axisY - (axisH * i) / 5;
            const vX = axisX + (axisW * i) / 5;
            return `<line id="line-grid-h-${i}" x1="${axisX}" y1="${hY}" x2="${axisX}" y2="${hY}" stroke="rgba(232,229,221,.16)" stroke-width="2" stroke-linecap="butt" opacity="0"/>
                    <line id="line-grid-v-${i}" x1="${vX}" y1="${axisY}" x2="${vX}" y2="${axisY}" stroke="rgba(232,229,221,.16)" stroke-width="2" stroke-linecap="butt" opacity="0"/>`;
          }).join("")}
        </g>
        <g id="line-growth-primary" clip-path="url(#line-growth-clip)">
          <polyline id="growth-line-shadow" points="" fill="none" stroke="rgba(0,0,0,.34)" stroke-width="13" stroke-linecap="round" stroke-linejoin="round" transform="translate(0 7)"/>
          <polyline id="growth-line" points="" fill="none" stroke="${direction === "decrease" ? PALETTE.mutedPeach : PALETTE.mutedSage}" stroke-width="10" stroke-linecap="round" stroke-linejoin="round"/>
          <polygon id="growth-arrow" points="" fill="${direction === "decrease" ? PALETTE.mutedPeach : PALETTE.mutedSage}" opacity="0"/>
        </g>
        <line id="line-axis-x" x1="${axisX}" y1="${axisY}" x2="${axisX}" y2="${axisY}" stroke="${PALETTE.faintGrey}" stroke-width="4" stroke-linecap="butt"/>
        <line id="line-axis-y" x1="${axisX}" y1="${axisY}" x2="${axisX}" y2="${axisY}" stroke="${PALETTE.faintGrey}" stroke-width="4" stroke-linecap="butt"/>
        <polyline id="line-axis-x-arrow" points="" fill="none" stroke="${PALETTE.faintGrey}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" opacity="0"/>
        <polyline id="line-axis-y-arrow" points="" fill="none" stroke="${PALETTE.faintGrey}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" opacity="0"/>
        <text id="line-value-counter" x="${axisRightX}" y="${axisTopY - 52}" text-anchor="end" font-family="Inter, Helvetica, Arial, sans-serif" font-size="46" font-weight="400" fill="${PALETTE.offWhite}" opacity="0" filter="url(#line-growth-value-shadow)"></text>
      </g>
    </svg>`,
    textBlock("line-start-label", [asText(args.startLabel, "Start")], axisX - 2, axisY + 58, { width: 220, size: 30, color: PALETTE.dimGrey }),
    textBlock("line-end-label", [asText(args.endLabel, "Now")], axisRightX - 220, axisY + 58, { width: 220, size: 30, align: "right", color: PALETTE.dimGrey }),
  ];
  reveal(timeline, "#line-title", titleRevealAt, { duration: 0.42 });
  timeline.push(`
      const lineGrowthPoints = ${JSON.stringify(points)};
      const lineGrowthAxis = ${JSON.stringify({ axisX, axisY, axisTopY, axisRightX, axisW, axisH, valueLabel: rawValueLabel })};
      const lineGrowthFormatValue = ${animatedNumberFormatterSource(rawValueLabel)};
      function lineGrowthClamp(value, min, max) { return Math.max(min, Math.min(max, value)); }
      function lineGrowthSmooth(progress) { const p = lineGrowthClamp(progress, 0, 1); return p * p * (3 - 2 * p); }
      function lineGrowthLength(points) {
        let total = 0;
        for (let i = 1; i < points.length; i += 1) total += Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
        return total;
      }
      function lineGrowthPartialAtLength(points, targetLength) {
        if (points.length <= 1) return points;
        const total = lineGrowthLength(points);
        const clampedTarget = lineGrowthClamp(targetLength, 0, total);
        const partial = [{ ...points[0] }];
        let walked = 0;
        for (let i = 1; i < points.length; i += 1) {
          const previous = points[i - 1];
          const point = points[i];
          const segmentLength = Math.hypot(point.x - previous.x, point.y - previous.y);
          if (walked + segmentLength >= clampedTarget) {
            const segmentProgress = segmentLength <= 0 ? 1 : (clampedTarget - walked) / segmentLength;
            partial.push({ x: previous.x + (point.x - previous.x) * segmentProgress, y: previous.y + (point.y - previous.y) * segmentProgress });
            return partial;
          }
          partial.push({ ...point });
          walked += segmentLength;
        }
        return points.map((point) => ({ ...point }));
      }
      function lineGrowthPartial(points, progress) {
        const total = lineGrowthLength(points);
        return lineGrowthPartialAtLength(points, Math.max(total * 0.004, total * lineGrowthClamp(progress, 0, 1)));
      }
      function lineGrowthRetractEnd(points, distance) {
        const total = lineGrowthLength(points);
        if (points.length <= 1 || total <= 0) return points;
        return lineGrowthPartialAtLength(points, Math.max(2, total - distance));
      }
      function lineGrowthTangent(points, fallback) {
        for (let i = points.length - 1; i > 0; i -= 1) {
          const current = points[i];
          const previous = points[i - 1];
          const dx = current.x - previous.x;
          const dy = current.y - previous.y;
          const length = Math.hypot(dx, dy);
          if (length > 0.001) return { x: dx / length, y: dy / length };
        }
        return fallback.length > 1 ? lineGrowthTangent(fallback.slice(0, 2), []) : { x: 1, y: 0 };
      }
      function lineGrowthArrowPoints(tip, tangent, length, halfHeight, scale) {
        const scaledLength = length * scale;
        const scaledHalfHeight = halfHeight * scale;
        const perpendicular = { x: -tangent.y, y: tangent.x };
        const baseCenter = { x: tip.x - tangent.x * scaledLength, y: tip.y - tangent.y * scaledLength };
        return [
          tip,
          { x: baseCenter.x + perpendicular.x * scaledHalfHeight, y: baseCenter.y + perpendicular.y * scaledHalfHeight },
          { x: baseCenter.x - perpendicular.x * scaledHalfHeight, y: baseCenter.y - perpendicular.y * scaledHalfHeight },
        ].map((point) => point.x.toFixed(1) + "," + point.y.toFixed(1)).join(" ");
      }
      function lineGrowthAxisChevron(axis, tip, length, spread) {
        const points = axis === "x"
          ? [{ x: tip.x - length, y: tip.y - spread }, tip, { x: tip.x - length, y: tip.y + spread }]
          : [{ x: tip.x - spread, y: tip.y + length }, tip, { x: tip.x + spread, y: tip.y + length }];
        return points.map((point) => point.x.toFixed(1) + "," + point.y.toFixed(1)).join(" ");
      }
      function updateLineGrowth(progress) {
        const p = lineGrowthClamp(progress, 0, 1);
        const eased = p * p * p;
        const partial = lineGrowthPartial(lineGrowthPoints, eased);
        const linePoints = p > 0 ? lineGrowthRetractEnd(partial, 30) : [];
        const tip = partial[partial.length - 1] || lineGrowthPoints[0];
        const tangent = lineGrowthTangent(partial, lineGrowthPoints);
        const arrowIntro = lineGrowthSmooth(p);
        const currentLength = lineGrowthLength(partial);
        const arrowScale = Math.min(arrowIntro, lineGrowthClamp(currentLength / 57.5, 0, 1));
        const pointString = linePoints.map((point) => point.x.toFixed(1) + "," + point.y.toFixed(1)).join(" ");
        document.querySelector("#growth-line").setAttribute("points", pointString);
        document.querySelector("#growth-line-shadow").setAttribute("points", pointString);
        document.querySelector("#growth-arrow").setAttribute("points", p > 0 ? lineGrowthArrowPoints(tip, tangent, 57.5, 16, arrowScale) : "");
        document.querySelector("#growth-arrow").setAttribute("opacity", String(arrowIntro));
        const counter = document.querySelector("#line-value-counter");
        if (lineGrowthFormatValue && lineGrowthAxis.valueLabel) {
          const text = lineGrowthFormatValue(eased);
          counter.textContent = text;
          const approxWidth = Math.max(44, String(text).length * 26);
          const rightX = Math.min(lineGrowthAxis.axisRightX + 64, Math.max(lineGrowthAxis.axisX + approxWidth + 14, tip.x + 42));
          counter.setAttribute("x", rightX.toFixed(1));
          counter.setAttribute("y", lineGrowthClamp(tip.y - 52, 48, ${HEIGHT - 24}).toFixed(1));
          counter.setAttribute("opacity", String(lineGrowthSmooth(p)));
        }
      }
      updateLineGrowth(0);
      const lineGrowthAxisState = { progress: 0 };
      const lineGrowthGridState = { progress: 0 };
      function updateLineGrowthAxes(progress) {
        const p = lineGrowthSmooth(progress);
        const x2 = lineGrowthAxis.axisX + lineGrowthAxis.axisW * p;
        const y2 = lineGrowthAxis.axisY - lineGrowthAxis.axisH * p;
        document.querySelector("#line-axis-x").setAttribute("x2", x2.toFixed(1));
        document.querySelector("#line-axis-y").setAttribute("y2", y2.toFixed(1));
        document.querySelector("#line-axis-x-arrow").setAttribute("points", lineGrowthAxisChevron("x", { x: x2, y: lineGrowthAxis.axisY }, 15, 8));
        document.querySelector("#line-axis-y-arrow").setAttribute("points", lineGrowthAxisChevron("y", { x: lineGrowthAxis.axisX, y: y2 }, 15, 8));
        document.querySelector("#line-axis-x-arrow").setAttribute("opacity", String(lineGrowthSmooth(progress / 0.15)));
        document.querySelector("#line-axis-y-arrow").setAttribute("opacity", String(lineGrowthSmooth(progress / 0.15)));
      }
      function updateLineGrowthGrid(localTime) {
        const gridLineGrowDuration = 3 - 0.8 - 3 * 0.4;
        for (let i = 1; i <= 4; i += 1) {
          const hStart = (i - 1) * 0.4;
          const hProgress = lineGrowthSmooth((localTime - hStart) / gridLineGrowDuration);
          const hLine = document.querySelector("#line-grid-h-" + i);
          const hY = lineGrowthAxis.axisY - (lineGrowthAxis.axisH * i) / 5;
          hLine.setAttribute("x2", (lineGrowthAxis.axisX + lineGrowthAxis.axisW * hProgress).toFixed(1));
          hLine.setAttribute("opacity", String(hProgress * 0.72));
          const vStart = 0.8 + (i - 1) * 0.4;
          const vProgress = lineGrowthSmooth((localTime - vStart) / gridLineGrowDuration);
          const vLine = document.querySelector("#line-grid-v-" + i);
          const vX = lineGrowthAxis.axisX + (lineGrowthAxis.axisW * i) / 5;
          vLine.setAttribute("x2", vX.toFixed(1));
          vLine.setAttribute("y2", (lineGrowthAxis.axisY - lineGrowthAxis.axisH * vProgress).toFixed(1));
          vLine.setAttribute("opacity", String(vProgress * 0.64));
          hLine.setAttribute("y1", hY.toFixed(1));
          hLine.setAttribute("y2", hY.toFixed(1));
        }
      }
      updateLineGrowthAxes(0);
      updateLineGrowthGrid(0);
  `);
  timeline.push(`tl.to(lineGrowthAxisState, {progress:1, duration:2, ease:"none", onUpdate:function(){ updateLineGrowthAxes(lineGrowthAxisState.progress); }}, ${chartRevealAt.toFixed(3)});`);
  timeline.push(`tl.to(lineGrowthGridState, {progress:3, duration:3, ease:"none", onUpdate:function(){ updateLineGrowthGrid(lineGrowthGridState.progress); }}, ${chartRevealAt.toFixed(3)});`);
  timeline.push(`tl.to({progress:0}, {progress:1, duration:3, ease:"power3.in", onUpdate:function(){ updateLineGrowth(this.targets()[0].progress); }}, ${(chartRevealAt + 1).toFixed(3)});`);
  reveal(timeline, "#line-start-label, #line-end-label", chartRevealAt + 0.84, { y: 14, duration: 0.42 });
  return html.join("\n");
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

function comparisonRevealTiming(args = {}) {
  const beforeLines = wrap(args.before || "Problem state", COMPARISON_TIMING.copyMaxChars);
  const beforeCopyStart = COMPARISON_TIMING.beforeStart + COMPARISON_TIMING.beforeCopyOffset;
  const beforeFinish = Math.max(
    COMPARISON_TIMING.beforeStart + COMPARISON_TIMING.labelRevealDuration,
    beforeCopyStart + Math.max(0, beforeLines.length - 1) * COMPARISON_TIMING.copyLineStagger + COMPARISON_TIMING.copyRevealDuration,
  );
  const afterStart = beforeFinish + COMPARISON_TIMING.afterDelayAfterBeforeFinish;
  return { beforeStart: COMPARISON_TIMING.beforeStart, beforeCopyStart, beforeFinish, afterStart, afterCopyStart: afterStart + COMPARISON_TIMING.beforeCopyOffset };
}

function comparison(args, timeline) {
  const base = comparisonRevealTiming(args);
  const beforeStart = timingValue(args, "before", base.beforeStart);
  const afterStart = timingValue(args, "after", base.afterStart);
  const html = [
    htmlElement("comparison-divider", "rule", `left:538px;top:574px;width:4px;height:720px;background:${PALETTE.faintGrey};transform-origin:center top;`),
    textBlock("comparison-before-label", [asText(args.beforeLabel, "Before")], 126, 612, { size: 42, color: PALETTE.dimGrey }),
    textBlock("comparison-before-copy", wrap(args.before || "Problem state", COMPARISON_TIMING.copyMaxChars), 126, 740, { size: 56, lineGap: 17, width: 400 }),
    textBlock("comparison-after-label", [asText(args.afterLabel, "After")], 600, 612, { size: 42, color: PALETTE.dimGrey }),
    textBlock("comparison-after-copy", wrap(args.after || "Improved state", COMPARISON_TIMING.copyMaxChars), 600, 740, { size: 56, lineGap: 17, width: 400 }),
  ];
  timeline.push(`tl.fromTo("#comparison-divider", {opacity:0, scaleY:0}, {opacity:1, scaleY:1, duration:.5, ease:"power3.out"}, .92);`);
  reveal(timeline, "#comparison-before-label", beforeStart, { duration: 0.52 });
  reveal(timeline, "#comparison-before-copy", beforeStart + COMPARISON_TIMING.beforeCopyOffset, { duration: 0.54 });
  reveal(timeline, "#comparison-after-label", afterStart, { duration: 0.52 });
  reveal(timeline, "#comparison-after-copy", afterStart + COMPARISON_TIMING.beforeCopyOffset, { duration: 0.54 });
  return html.join("\n");
}

function timelineGraphic(args, timeline) {
  const steps = asTimelineSteps(args.steps, ["Setup", "Signal", "Visible change"]).slice(0, 5);
  const firstRevealAt = 0.64;
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
  const lineCounts = steps.map((step) => Math.max(1, wrap(step.text, stepTextMaxChars).length));
  const stepExtents = lineCounts.map((lineCount, index) => {
    const relativeY = index * stepGap;
    const textTop = relativeY + stepTextTopOffset;
    const textBottom = textTop + lineCount * stepFontSize + Math.max(0, lineCount - 1) * stepTextLineGap;
    const labelLayout = labelLayouts[index];
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
  const html = [
    htmlElement("timeline-rule", "rule", `left:${verticalRuleX}px;top:${firstRuleCenterY}px;width:${verticalRuleW}px;height:${Math.max(1, lastRuleCenterY - firstRuleCenterY)}px;background:${PALETTE.faintGrey};transform-origin:center top;`),
  ];
  timeline.push(`tl.fromTo("#timeline-rule", {opacity:0, scaleY:0}, {opacity:1, scaleY:1, duration:${Math.max(0.1, lastRevealFinish - firstStepRevealAt)}, ease:"power2.out"}, ${firstStepRevealAt.toFixed(3)});`);
  steps.forEach((step, index) => {
    const at = stepRevealTimes[index] ?? fixedRevealTiming(index, { firstRevealAt, revealDuration: stepRevealDuration, gapAfterReveal: gapAfterStepReveal }).revealAt;
    const y = startY + index * stepGap;
    const connectorY = Math.round(y + stepTextTopOffset + stepFontSize / 2 - ruleH / 2);
    html.push(htmlElement(`timeline-connector-${index}`, "rule", `left:${ruleX}px;top:${connectorY}px;width:${ruleW}px;height:${ruleH}px;background:${index % 2 ? PALETTE.mutedSage : PALETTE.mutedPeach};transform-origin:center center;`));
    const labelLayout = labelLayouts[index];
    const labelTop = y + labelCenterOffset - labelLayout.blockHeight / 2;
    html.push(textBlock(`timeline-label-${index}`, labelLayout.lines, labelRightX - 120, labelTop, { width: 120, size: labelLayout.fontSize, lineGap: labelLayout.lineGap, align: "right", color: PALETTE.dimGrey }));
    html.push(textBlock(`timeline-text-${index}`, wrap(step.text, stepTextMaxChars), stepTextX, y + stepTextTopOffset, { width: 660, size: stepFontSize, lineGap: stepTextLineGap }));
    timeline.push(`tl.fromTo("#timeline-connector-${index}", {opacity:0, scaleX:0}, {opacity:1, scaleX:1, duration:${stepRevealDuration}, ease:"power3.out"}, ${at.toFixed(3)});`);
    reveal(timeline, `#timeline-label-${index}`, at, { y: 28, duration: stepRevealDuration });
    reveal(timeline, `#timeline-text-${index}`, at, { y: 44, duration: stepRevealDuration });
  });
  return html.join("\n");
}

function rankedPodium(args, timeline) {
  const items = asTimelineSteps(args.steps || args.items, [{ label: "01", text: "Most visible change" }, { label: "02", text: "Faster feedback" }, { label: "03", text: "Cleaner routine" }]).slice(0, 5);
  const rowH = items.length <= 3 ? 194 : 156;
  const gap = items.length <= 3 ? 62 : 42;
  const totalH = items.length * rowH + Math.max(0, items.length - 1) * gap;
  const startY = Math.round((HEIGHT - totalH) / 2) + (items.length <= 3 ? 32 : 10);
  const html = [];
  items.forEach((item, index) => {
    const at = itemTiming(args, "items", item, index, fixedRevealTiming(index, { firstRevealAt: 0.42, revealDuration: 0.44, gapAfterReveal: 0.34 }).revealAt, ["steps", "ranks", "ranked"]);
    const y = startY + index * (rowH + gap);
    html.push(htmlElement(`rank-rule-${index}`, "rule", `left:286px;top:${y + rowH - 24}px;width:760px;height:3px;background:${ACCENTS[index % ACCENTS.length]};transform-origin:left center;`));
    html.push(textBlock(`rank-number-${index}`, [`#${asText(item.label, String(index + 1).padStart(2, "0")).replace(/^#?/, "")}`], 126, y + 28, { width: 160, size: items.length <= 3 ? 92 : 72 }));
    html.push(textBlock(`rank-text-${index}`, wrap(item.text, items.length <= 3 ? 20 : 23), 286, y + 34, { width: 760, size: items.length <= 3 ? 58 : 50, lineGap: 14 }));
    timeline.push(`tl.fromTo("#rank-rule-${index}", {opacity:0, scaleX:0}, {opacity:1, scaleX:1, duration:.44, ease:"power3.out"}, ${at.toFixed(3)});`);
    reveal(timeline, `#rank-number-${index}, #rank-text-${index}`, at, { y: 34, duration: 0.44 });
  });
  return html.join("\n");
}

function checklist(args, timeline) {
  const items = asTimelineSteps(args.steps || args.items, ["Set the baseline", "Make the small adjustment", "Repeat it daily"]).slice(0, 6);
  const textSize = items.length <= 4 ? 56 : 48;
  const rowH = items.length <= 4 ? 128 : 104;
  const gap = items.length <= 4 ? 42 : 30;
  const totalH = items.length * rowH + Math.max(0, items.length - 1) * gap;
  const startY = Math.round((HEIGHT - totalH) / 2);
  const html = [];
  items.forEach((item, index) => {
    const at = itemTiming(args, "items", item, index, fixedRevealTiming(index, { firstRevealAt: 0.44, revealDuration: 0.42, gapAfterReveal: 0.36 }).revealAt, ["steps", "checklist"]);
    const y = startY + index * (rowH + gap);
    html.push(htmlElement(`check-box-${index}`, "check-box", `left:126px;top:${y + 22}px;width:64px;height:64px;border-radius:12px;background:${PALETTE.mutedSage};`));
    html.push(htmlElement(`check-mark-${index}`, "check-mark", `left:142px;top:${y + 38}px;width:32px;height:20px;border-left:7px solid ${PALETTE.offWhite};border-bottom:7px solid ${PALETTE.offWhite};transform:rotate(-45deg);`));
    html.push(textBlock(`check-text-${index}`, wrap(item.text, items.length <= 4 ? 25 : 27), 236, y + 16, { width: 760, size: textSize, lineGap: 14 }));
    scaleReveal(timeline, `#check-box-${index}`, at, { duration: 0.3, fromScale: 0.8 });
    timeline.push(`tl.fromTo("#check-mark-${index}", {opacity:0, scale:.7, rotate:-45}, {opacity:1, scale:1, rotate:-45, duration:.26, ease:"back.out(1.7)"}, ${(at + 0.1).toFixed(3)});`);
    reveal(timeline, `#check-text-${index}`, at, { y: 28, duration: 0.42 });
  });
  return html.join("\n");
}

function scorecard(args, timeline) {
  const data = asData(args.data).slice(0, 5);
  const rows = data.length > 0 ? data : [
    { label: "Clarity", value: 82, displayValue: "82" },
    { label: "Consistency", value: 68, displayValue: "68" },
    { label: "Effort", value: 91, displayValue: "91" },
  ];
  const max = Math.max(1, ...rows.map((item) => Math.abs(item.value)));
  const titleRevealAt = timingValue(args, "title", 0.36);
  const rowH = rows.length <= 3 ? 168 : 140;
  const gap = rows.length <= 3 ? 56 : 34;
  const startY = 590;
  const labelX = 126;
  const valueRightX = 946;
  const barX = 126;
  const barW = 820;
  const html = [textBlock("score-title", wrap(args.title || "Scorecard", 20), 124, 280, { size: 66, lineGap: 18 })];
  reveal(timeline, "#score-title", titleRevealAt, { y: 42, duration: 0.42 });
  rows.forEach((item, index) => {
    const at = itemTiming(args, "data", item, index, fixedRevealTiming(index, { firstRevealAt: 0.82, revealDuration: 0.42, gapAfterReveal: 0.28 }).revealAt, ["rows", "items"]);
    const y = startY + index * (rowH + gap);
    const scoreW = Math.max(18, Math.round((Math.abs(item.value) / max) * barW));
    html.push(textBlock(`score-label-${index}`, [item.label], labelX, y, { width: 620, size: 40 }));
    html.push(textBlock(`score-value-${index}`, [item.displayValue || String(item.value)], valueRightX - 220, y, { width: 220, size: 40, align: "right", color: PALETTE.dimGrey }));
    html.push(htmlElement(`score-track-${index}`, "score-track", `left:${barX}px;top:${y + 72}px;width:${barW}px;height:8px;background:${PALETTE.faintGrey};`));
    html.push(htmlElement(`score-bar-${index}`, "score-bar", `left:${barX}px;top:${y + 72}px;width:${scoreW}px;height:8px;background:${ACCENTS[index % ACCENTS.length]};transform-origin:left center;`));
    reveal(timeline, `#score-label-${index}`, at, { y: 30, duration: 0.42 });
    reveal(timeline, `#score-value-${index}`, at, { y: 30, duration: 0.42 });
    timeline.push(`tl.fromTo("#score-track-${index}", {opacity:0}, {opacity:1, duration:.01}, ${at.toFixed(3)});`);
    timeline.push(`tl.fromTo("#score-bar-${index}", {opacity:0, scaleX:0}, {opacity:1, scaleX:1, duration:.42, ease:"power3.out"}, ${(at + 0.08).toFixed(3)});`);
  });
  return html.join("\n");
}

function researchPaperCard(args, timeline) {
  const html = [
    htmlElement("paper-card", "paper-card", `left:112px;top:440px;width:856px;min-height:780px;border:2px solid ${PALETTE.darkStroke};border-radius:8px;background:${PALETTE.darkPanel};padding:62px 58px;`),
    textBlock("paper-source", [asText(args.source, "Study")], 172, 510, { size: 34, color: PALETTE.dimGrey }),
    textBlock("paper-title", wrap(args.title || "Research finding", 19), 172, 610, { width: 720, size: 58, lineGap: 18 }),
    textBlock("paper-finding", wrap(args.finding || args.paper || "One finding changes how this should be read.", 23), 172, 900, { width: 720, size: 48, lineGap: 16, color: PALETTE.softGrey }),
  ];
  scaleReveal(timeline, "#paper-card", timingValue(args, "paper", 0.46), { duration: 0.44, fromScale: 0.985 });
  reveal(timeline, "#paper-source", timingValue(args, "source", 0.72), { duration: 0.34 });
  reveal(timeline, "#paper-title", timingValue(args, "title", 0.96), { duration: 0.44 });
  reveal(timeline, "#paper-finding", timingValue(args, "finding", 1.32), { duration: 0.44 });
  return html.join("\n");
}

function goodBadIndicator(args, timeline) {
  const type = String(args.type || args.indicator || args.indicatorType || "good").toLowerCase().includes("bad") ? "bad" : "good";
  const color = type === "bad" ? PALETTE.mutedPeach : PALETTE.mutedSage;
  const symbol = type === "bad" ? "×" : "✓";
  const text = asText(args.text || args.copy || args.title, type === "bad" ? "Avoid this" : "Do this");
  const html = [
    htmlElement("indicator-circle", "indicator-circle", `left:390px;top:470px;width:300px;height:300px;border-radius:999px;border:8px solid ${color};display:grid;place-items:center;font-size:190px;color:${color};`, escapeHtml(symbol)),
    textBlock("indicator-text", wrap(text, 18), 132, 850, { width: 816, size: 72, lineGap: 20, align: "center" }),
  ];
  scaleReveal(timeline, "#indicator-circle", timingValue(args, "icon", 0.56), { duration: 0.42, fromScale: 0.72 });
  reveal(timeline, "#indicator-text", timingValue(args, "text", 0.96), { y: 42, duration: 0.46 });
  return html.join("\n");
}

function causeEffect(args, timeline) {
  const cause = asText(args.cause, "Small daily tension");
  const effect = asText(args.effect, "Jaw and neck read tighter");
  const bodySize = 72;
  const bodyLineGap = 22;
  const textPaddingX = 20;
  const textPaddingY = 14;
  const maxTextW = WIDTH - 160 * 2;
  const arrowHeight = 156;
  const arrowMargin = 84;
  const arrowWidth = 128;
  const arrowStrokeWidth = 16;
  const causeRevealAt = timingValue(args, "cause", 0.5);
  const arrowStart = timingValue(args, "arrow", 1.12);
  const effectRevealAt = timingValue(args, "effect", 1.86);
  const textLayout = (value) => {
    const lines = wrap(value, 18, 4);
    const longest = Math.max(1, ...lines.map((line) => line.length));
    const width = Math.min(maxTextW, Math.ceil(Math.max(360, longest * bodySize * 0.54) + textPaddingX * 2));
    const height = (textPaddingY * 2) + bodySize + Math.max(0, lines.length - 1) * (bodySize + bodyLineGap);
    return { lines, width, height };
  };
  const causeBlock = textLayout(cause);
  const effectBlock = textLayout(effect);
  const totalHeight = causeBlock.height + arrowMargin + arrowHeight + arrowMargin + effectBlock.height;
  const causeBlockY = Math.round((HEIGHT - totalHeight) / 2);
  const arrowTopY = causeBlockY + causeBlock.height + arrowMargin;
  const effectBlockY = arrowTopY + arrowHeight + arrowMargin;
  const centerX = WIDTH / 2;
  const centerBlockX = (block) => Math.round(centerX - block.width / 2);
  const textHtml = (id, block, x, y) => htmlElement(
    id,
    "cause-effect-text",
    `left:${x}px;top:${y}px;width:${block.width}px;height:${block.height}px;padding:${textPaddingY}px ${textPaddingX}px;text-align:center;`,
    `<div style="font-size:${bodySize}px;line-height:${bodySize + bodyLineGap}px;font-weight:500;color:${PALETTE.offWhite};text-shadow:0 8px 0 rgba(0,0,0,.62);">${block.lines.map((line) => `<div>${escapeHtml(line)}</div>`).join("")}</div>`,
  );
  const html = [
    textHtml("cause-card", causeBlock, centerBlockX(causeBlock), causeBlockY),
    htmlElement("cause-arrow", "arrow", `left:${centerX - arrowWidth / 2}px;top:${arrowTopY}px;width:${arrowWidth}px;height:${arrowHeight}px;`, `<svg width="${arrowWidth}" height="${arrowHeight}" viewBox="0 0 ${arrowWidth} ${arrowHeight}"><path id="cause-arrow-path" d="M64 8 V${arrowHeight - 34} M30 ${arrowHeight - 68} L64 ${arrowHeight - 10} L98 ${arrowHeight - 68}" fill="none" stroke="${PALETTE.mutedBlue}" stroke-width="${arrowStrokeWidth}" stroke-linecap="round" stroke-linejoin="round"/></svg>`),
    textHtml("effect-card", effectBlock, centerBlockX(effectBlock), effectBlockY),
  ];
  reveal(timeline, "#cause-card", causeRevealAt, { y: -22, duration: 0.44 });
  timeline.push(`tl.fromTo("#cause-arrow", {opacity:0}, {opacity:1, duration:.18}, ${arrowStart.toFixed(3)});`);
  timeline.push(`tl.fromTo("#cause-arrow", {scaleY:0, transformOrigin:"center top"}, {scaleY:1, duration:.76, ease:"power2.out"}, ${arrowStart.toFixed(3)});`);
  reveal(timeline, "#effect-card", effectRevealAt, { y: -22, duration: 0.44 });
  return html.join("\n");
}

function normalizeCaptionWordWallLineSize(value, line = {}) {
  const raw = String(value || "").trim().toLowerCase().replace(/[\s-]+/g, "_");
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
  return source.map((line) => {
    if (line && typeof line === "object") {
      const text = asText(line.text ?? line.caption ?? line.words);
      const blank = line.blank === true || !text;
      const size = normalizeCaptionWordWallLineSize(line.size ?? line.lineSize, line);
      return blank ? { blank: true } : { text, size, animateIn: directTiming(line) };
    }
    const text = asText(line);
    return text ? { text, size: "regular" } : { blank: true };
  }).filter((line) => line.blank || line.text);
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
  let wordsSource = alignmentWords;
  if (wordsSource.length === 0) {
    if (!allowSyntheticTiming) throw new Error("caption_word_wall requires forced-alignment word timestamps. Run the XML Script narration/alignment steps before rendering this motion graphic.");
    const fallbackWords = normalizedLines.filter((line) => !line.blank).flatMap((line) => splitDisplayWords(line.text));
    const step = Math.max(0.08, durationSeconds / Math.max(1, fallbackWords.length));
    wordsSource = fallbackWords.map((word, index) => ({ text: word, normalized: normalizeWordToken(word), start: index * step, end: Math.min(durationSeconds, (index + 0.82) * step) }));
    visualStartSeconds = 0;
  }
  const rangeToleranceSeconds = 0.05;
  let cursor = Number.isFinite(visualStartSeconds) && visualStartSeconds > 0
    ? Math.max(0, wordsSource.findIndex((word) => word.end >= visualStartSeconds - rangeToleranceSeconds))
    : 0;
  if (cursor < 0) cursor = wordsSource.length;
  const entries = [];
  const resolvedLines = normalizedLines.map((line, lineIndex) => {
    if (line.blank) return { blank: true, size: "regular", words: [] };
    const lineWords = splitDisplayWords(line.text).map((wordText) => {
      const normalized = normalizeWordToken(wordText);
      let matchIndex = -1;
      for (let searchIndex = cursor; searchIndex < wordsSource.length; searchIndex += 1) {
        if (wordsSource[searchIndex]?.normalized === normalized) {
          matchIndex = searchIndex;
          break;
        }
      }
      if (matchIndex === -1) throw new Error(`caption_word_wall could not match spoken word "${wordText}" in forced-alignment data. Keep <line> text exact and in narration order.`);
      const matched = wordsSource[matchIndex];
      cursor = matchIndex + 1;
      const localStart = matched.start - visualStartSeconds;
      const localEnd = matched.end - visualStartSeconds;
      if (localEnd < -rangeToleranceSeconds || localStart > durationSeconds + rangeToleranceSeconds) {
        throw new Error(`caption_word_wall word "${wordText}" is outside the visual start/end range. Align the motion graphic visual range with the spoken words it displays.`);
      }
      const entry = {
        text: wordText,
        start: Math.max(0, localStart),
        end: Math.min(durationSeconds, Math.max(localStart + 0.05, localEnd)),
        lineIndex,
        globalIndex: entries.length,
      };
      entries.push(entry);
      return entry;
    });
    return { ...line, words: lineWords, lineStart: line.animateIn ?? lineWords[0]?.start ?? 0 };
  });
  return { lines: resolvedLines, words: entries };
}

function readDefaultCaptionStyle() {
  const fallback = {
    fontFamily: "Arial",
    fontWeight: 900,
    fontSize: 90,
    activeWordColor: "#FFFFFF",
    spokenWordColor: "#D0D0D0",
    upcomingWordColor: "#5E5E5E",
    outlineColor: "#111111",
    outlineWidth: 12,
    shadowColor: "#000000",
    shadowStrength: 8,
    shadowBlur: 2.2,
    shadowOffsetX: 0,
    shadowOffsetY: 3.4,
  };
  try {
    const settings = JSON.parse(fs.readFileSync(VIDEO_RENDER_SETTINGS_PATH, "utf-8"));
    const styles = Array.isArray(settings.captionStyles) ? settings.captionStyles : [];
    const selected = styles.find((style) => style?.id === settings.defaultCaptionStyleId) || styles[0];
    return selected && typeof selected === "object" ? { ...fallback, ...selected } : fallback;
  } catch {
    return fallback;
  }
}

function captionStyleNumber(style, key, fallback, min, max) {
  const parsed = Number(style?.[key]);
  const value = Number.isFinite(parsed) ? parsed : fallback;
  return Math.min(max, Math.max(min, value));
}

function captionWallSizeRatio(size) {
  if (size === "extra_large") return 3.1;
  if (size === "large") return 1.45;
  return 0.82;
}

function captionWallFontWeight(size, baseFontWeight) {
  if (size === "extra_large") return 1000;
  if (size === "large") return Math.max(850, baseFontWeight);
  return Math.max(500, Math.min(650, baseFontWeight - 300));
}

function estimateCaptionLineWidth(text, fontSize) {
  const words = splitDisplayWords(text);
  const letters = words.join("").length;
  const tokenGaps = Math.max(0, words.length - 1);
  return (letters * fontSize * 0.57) + (tokenGaps * fontSize * 0.95);
}

function estimateCaptionWordWidth(word, fontSize) {
  return Math.max(fontSize * 0.42, word.length * fontSize * 0.57);
}

function estimateCaptionWrappedRows(text, fontSize, wordGap, safeWidth) {
  const words = splitDisplayWords(text);
  if (words.length === 0) return 1;
  let rows = 1;
  let rowWidth = 0;
  words.forEach((word) => {
    const wordWidth = estimateCaptionWordWidth(word, fontSize);
    const nextWidth = rowWidth <= 0 ? wordWidth : rowWidth + wordGap + wordWidth;
    if (rowWidth > 0 && nextWidth > safeWidth) {
      rows += 1;
      rowWidth = wordWidth;
      return;
    }
    rowWidth = nextWidth;
  });
  return rows;
}

function captionTextShadow(style, multiplier = 1) {
  const shadowColor = cssString(style.shadowColor, "#000000");
  const offsetX = captionStyleNumber(style, "shadowOffsetX", 0, -60, 60) * multiplier;
  const offsetY = captionStyleNumber(style, "shadowOffsetY", 3.4, -60, 60) * multiplier;
  const blur = captionStyleNumber(style, "shadowBlur", 2.2, 0, 40) * multiplier;
  const strength = captionStyleNumber(style, "shadowStrength", 8, 0, 40) * multiplier;
  const heavyOffsetY = offsetY + Math.max(0, strength * 0.34);
  return `${offsetX.toFixed(1)}px ${heavyOffsetY.toFixed(1)}px ${blur.toFixed(1)}px ${shadowColor}`;
}

function buildCaptionWordWallLayout(lines, style) {
  const safeWidth = CAPTION_WORD_WALL_TEXT_WIDTH;
  const baseFontSize = captionStyleNumber(style, "fontSize", 90, 36, 180);
  const baseOutlineWidth = captionStyleNumber(style, "outlineWidth", 12, 0, 28);
  const baseFontWeight = Math.round(captionStyleNumber(style, "fontWeight", 900, 100, 1000));
  const rawItems = lines.map((line) => {
    if (line.blank) {
      return {
        ...line,
        height: Math.round(baseFontSize * 0.54),
        gapAfter: Math.round(baseFontSize * 0.08),
      };
    }
    const ratio = captionWallSizeRatio(line.size);
    const rawFontSize = baseFontSize * ratio;
    const longestWordWidth = splitDisplayWords(line.text).reduce((max, word) => Math.max(max, estimateCaptionWordWidth(word, rawFontSize * 1.18)), 1);
    const widthScale = Math.min(1, safeWidth / longestWordWidth);
    return {
      ...line,
      ratio,
      rawFontSize,
      widthScale,
      fontWeight: captionWallFontWeight(line.size, baseFontWeight),
    };
  });
  const measureItems = (stackScale) => rawItems.map((item) => {
    const uniformLineGap = Math.max(4, Math.round(baseFontSize * 0.025 * stackScale));
    if (item.blank) {
      return {
        ...item,
        height: Math.max(4, Math.round(baseFontSize * 0.06 * stackScale)),
        gapAfter: uniformLineGap,
      };
    }
    const fontSize = Math.max(42, Math.round(item.rawFontSize * item.widthScale * stackScale));
    const outlineWidth = Math.max(1, Math.round(baseOutlineWidth * item.ratio * item.widthScale * stackScale * 10) / 10);
    const activeFontSize = Math.round(fontSize * 1.16);
    const wordGap = Math.max(28, Math.round((fontSize * 0.18) + (outlineWidth * 2.2)));
    const rowGap = Math.max(2, Math.round(fontSize * 0.018));
    const wrappedRows = estimateCaptionWrappedRows(item.text, activeFontSize, wordGap, safeWidth);
    const rowHeight = Math.ceil((fontSize * 0.9) + (outlineWidth * 1.1));
    return {
      ...item,
      fontSize,
      outlineWidth,
      wordGap,
      rowGap,
      wrappedRows,
      lineHeight: rowHeight,
      height: (wrappedRows * rowHeight) + ((wrappedRows - 1) * rowGap),
      gapAfter: uniformLineGap,
    };
  });
  const heightThrough = (items, index) => {
    let height = 0;
    for (let lineIndex = 0; lineIndex <= index; lineIndex += 1) {
      const item = items[lineIndex];
      if (!item) continue;
      height += item.height;
      if (lineIndex < index) height += item.gapAfter;
    }
    return height;
  };
  const initialItems = measureItems(1);
  const lastVisibleIndex = initialItems.reduce((last, item, index) => item.blank ? last : index, -1);
  const maxVisibleHeight = lastVisibleIndex >= 0 ? heightThrough(initialItems, lastVisibleIndex) : 0;
  const stackScale = Math.min(1, (HEIGHT - 360) / Math.max(1, maxVisibleHeight));
  const measured = measureItems(stackScale);
  let cursorY = 0;
  return measured.map((item, index) => {
    const y = cursorY;
    cursorY += item.height + item.gapAfter;
    return {
      ...item,
      y,
      visibleHeight: item.blank ? 0 : heightThrough(measured, index),
    };
  });
}

function captionWordWall(args, config, timeline) {
  const duration = Math.max(0.1, asNumber(config.durationSeconds, 6));
  const visualStartSeconds = Number.isFinite(Number(config.visualStartSeconds)) ? Number(config.visualStartSeconds) : 0;
  const data = buildCaptionWordWallTimeline({
    lines: args.lines,
    alignmentWords: readAlignmentWords(config.alignmentPath),
    visualStartSeconds,
    durationSeconds: duration,
    allowSyntheticTiming: config.allowSyntheticTiming === true,
  });
  const captionStyle = readDefaultCaptionStyle();
  const activeColor = cssString(captionStyle.activeWordColor, "#FFFFFF");
  const spokenColor = cssString(captionStyle.spokenWordColor, "#D0D0D0");
  const upcomingColor = cssString(captionStyle.upcomingWordColor, "#5E5E5E");
  const outlineColor = cssString(captionStyle.outlineColor, "#111111");
  const fontFamily = cssString(captionStyle.fontFamily, "Arial");
  const layout = buildCaptionWordWallLayout(data.lines, captionStyle);
  const html = [];
  const visibleTargets = [];
  data.lines.forEach((line, lineIndex) => {
    const metrics = layout[lineIndex];
    if (!metrics || line.blank) return;
    const id = `word-line-${lineIndex}`;
    const targetY = Math.round((HEIGHT - metrics.visibleHeight) / 2);
    visibleTargets.push({ at: line.lineStart ?? 0, y: targetY });
    const lineShadow = captionTextShadow(captionStyle, metrics.fontSize / captionStyleNumber(captionStyle, "fontSize", 90, 36, 180));
    const tokenStyle = [
      `--caption-active:${activeColor}`,
      `--caption-spoken:${spokenColor}`,
      `--caption-upcoming:${upcomingColor}`,
      `--caption-outline:${outlineColor}`,
      `--caption-outline-width:${metrics.outlineWidth}px`,
      `--caption-shadow:${lineShadow}`,
      `--caption-word-gap:${metrics.wordGap || 8}px`,
      `--caption-row-gap:${metrics.rowGap || 8}px`,
    ].join(";");
    html.push(htmlElement(
      id,
      "word-line",
      [
        `left:${CAPTION_WORD_WALL_HORIZONTAL_PADDING}px`,
        `top:${metrics.y}px`,
        `width:${CAPTION_WORD_WALL_TEXT_WIDTH}px`,
        `height:${metrics.height}px`,
        `font-family:${fontFamily}, Arial, sans-serif`,
        `font-weight:${metrics.fontWeight}`,
        `font-size:${metrics.fontSize}px`,
        `line-height:${metrics.lineHeight}px`,
        `text-align:left`,
        `white-space:normal`,
        `color:${upcomingColor}`,
        tokenStyle,
      ].join(";"),
      line.words.map((word) => `<span id="word-${word.globalIndex}" class="word-token">${escapeHtml(word.text)}</span>`).join(""),
    ));
    reveal(timeline, `#${id}`, line.lineStart ?? 0, { y: Math.round(metrics.fontSize * 0.22), duration: 0.28 });
  });
  const firstTarget = visibleTargets[0]?.y ?? Math.round(HEIGHT / 2);
  timeline.push(`tl.set("#caption-word-wall-stack", {y:${firstTarget}}, 0);`);
  let lastY = firstTarget;
  visibleTargets.forEach((target, index) => {
    if (target.y === lastY) return;
    const at = Math.max(0, target.at - (index === 0 ? 0 : 0.02));
    timeline.push(`tl.to("#caption-word-wall-stack", {y:${target.y}, duration:${index === 0 ? "0.001" : "0.42"}, ease:"power3.inOut"}, ${at.toFixed(3)});`);
    lastY = target.y;
  });
  data.words.forEach((word) => {
    const durationSeconds = Math.max(0.08, word.end - word.start);
    const metrics = layout[word.lineIndex] || {};
    const activeOutline = Math.round(((metrics.outlineWidth || 8) * 1.12) * 10) / 10;
    const activeFontSize = Math.round((metrics.fontSize || 90) * 1.16);
    const activeShadow = captionTextShadow(captionStyle, (metrics.fontSize || 90) / captionStyleNumber(captionStyle, "fontSize", 90, 36, 180) * 1.08);
    const beforeWordsByLine = new Map();
    const afterWordsByLine = new Map();
    data.words.forEach((entry) => {
      if (entry.globalIndex === word.globalIndex) return;
      const bucket = entry.globalIndex < word.globalIndex ? beforeWordsByLine : afterWordsByLine;
      const ids = bucket.get(entry.lineIndex) || [];
      ids.push(`#word-${entry.globalIndex}`);
      bucket.set(entry.lineIndex, ids);
    });
    beforeWordsByLine.forEach((ids, lineIndex) => {
      const lineMetrics = layout[lineIndex] || {};
      timeline.push(`tl.set("${ids.join(",")}", {color:${JSON.stringify(spokenColor)}, fontSize:"${lineMetrics.fontSize || 90}px", y:0, webkitTextStrokeWidth:"${lineMetrics.outlineWidth || 8}px", textShadow:"var(--caption-shadow)"}, ${word.start.toFixed(3)});`);
    });
    afterWordsByLine.forEach((ids, lineIndex) => {
      const lineMetrics = layout[lineIndex] || {};
      timeline.push(`tl.set("${ids.join(",")}", {color:${JSON.stringify(upcomingColor)}, fontSize:"${lineMetrics.fontSize || 90}px", y:0, webkitTextStrokeWidth:"${lineMetrics.outlineWidth || 8}px", textShadow:"var(--caption-shadow)"}, ${word.start.toFixed(3)});`);
    });
    timeline.push(`tl.fromTo("#word-${word.globalIndex}", {color:${JSON.stringify(activeColor)}, opacity:1, fontSize:"${activeFontSize}px", y:${-Math.round((metrics.fontSize || 90) * 0.08)}, webkitTextStrokeWidth:"${activeOutline}px", textShadow:${JSON.stringify(activeShadow)}}, {color:${JSON.stringify(spokenColor)}, fontSize:"${metrics.fontSize || 90}px", y:0, webkitTextStrokeWidth:"${metrics.outlineWidth || 8}px", textShadow:"var(--caption-shadow)", duration:${durationSeconds.toFixed(3)}, ease:"power3.out"}, ${word.start.toFixed(3)});`);
  });
  return htmlElement(
    "caption-word-wall-stack",
    "caption-word-wall-stack",
    `left:0;top:0;width:${WIDTH}px;height:${HEIGHT}px;opacity:1;`,
    html.join("\n"),
  );
}

function buildTemplateHtml(config) {
  const rendererKey = resolveRendererKey(config);
  const args = resolveRendererArgs(config);
  const timeline = [];
  let body = "";
  switch (rendererKey) {
    case "bar_chart":
      body = barChart(args, timeline);
      break;
    case "pie_chart":
      body = pieChart(args, timeline);
      break;
    case "line_growth_chart":
      body = lineGrowthChart(args, timeline);
      break;
    case "comparison_before_after":
      body = comparison(args, timeline);
      break;
    case "timeline":
      body = timelineGraphic(args, timeline);
      break;
    case "cause_effect":
      body = causeEffect(args, timeline);
      break;
    case "caption_word_wall":
      body = captionWordWall(args, config, timeline);
      break;
    case "ranked_podium":
      body = rankedPodium(args, timeline);
      break;
    case "checklist":
      body = checklist(args, timeline);
      break;
    case "scorecard":
      body = scorecard(args, timeline);
      break;
    case "research_paper_card":
      body = researchPaperCard(args, timeline);
      break;
    case "good_bad_indicator":
    case "instruction":
      body = goodBadIndicator(args, timeline);
      break;
    case "stat_reveal":
    default:
      body = statReveal(args, timeline);
      break;
  }
  return { body, timeline, rendererKey };
}

function buildCompositionHtml(config) {
  const duration = Math.max(0.1, asNumber(config.durationSeconds, 6));
  const { body, timeline, rendererKey } = buildTemplateHtml(config);
  return {
    rendererKey,
    html: `<!doctype html>
<html lang="en" data-resolution="portrait">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=${WIDTH}, height=${HEIGHT}" />
    <script src="./gsap.min.js"></script>
    <style>
      * { box-sizing: border-box; }
      html, body { margin: 0; width: ${WIDTH}px; height: ${HEIGHT}px; overflow: hidden; background: #000; }
      .stage { position: relative; width: ${WIDTH}px; height: ${HEIGHT}px; overflow: hidden; background: #060606; color: ${PALETTE.offWhite}; font-family: Inter, Helvetica, Arial, sans-serif; letter-spacing: 0; }
      .background-image { position:absolute; inset:0; width:100%; height:100%; object-fit:cover; }
      .background-dim { position:absolute; inset:0; background: rgba(0,0,0,.91); }
      .grain { position:absolute; inset:0; opacity:.04; background-image: radial-gradient(circle at 20% 10%, #fff 0, transparent 1px), radial-gradient(circle at 70% 80%, #fff 0, transparent 1px); background-size: 42px 42px, 61px 61px; }
      .clip { position:absolute; z-index: 2; transform-origin: center center; text-shadow: 0 4px 0 rgba(0,0,0,.7); }
      .svg-layer { position:absolute; inset:0; z-index:2; overflow:visible; }
      .text-block { font-weight: 400; }
      .massive { font-weight: 400; }
      .rule, .bar, .swatch, .dot, .check-box, .check-mark, .indicator-circle, .paper-card, .arrow { opacity: 0; }
      .caption-word-wall-stack { overflow: visible; will-change: transform; }
      .word-line { opacity: 0; overflow: visible; text-shadow: var(--caption-shadow); display:flex; flex-wrap:wrap; align-content:flex-start; align-items:flex-start; justify-content:flex-start; row-gap:var(--caption-row-gap); }
      .word-token {
        display:inline-block;
        line-height: 1;
        margin: 0;
        padding-right: var(--caption-word-gap);
        opacity:1;
        color: var(--caption-upcoming);
        transform-origin:center center;
        -webkit-text-stroke: var(--caption-outline-width) var(--caption-outline);
        paint-order: stroke fill;
        text-shadow: var(--caption-shadow);
        will-change: transform, color;
      }
      .word-token:last-child { padding-right: 0; }
    </style>
  </head>
  <body>
    <div id="root" class="stage" data-composition-id="main" data-start="0" data-duration="${duration}" data-width="${WIDTH}" data-height="${HEIGHT}">
      ${buildBaseBackground(config)}
      ${body}
    </div>
    <script>
      window.__timelines = window.__timelines || {};
      const tl = gsap.timeline({ paused: true });
      ${timeline.join("\n      ")}
      window.__timelines["main"] = tl;
    </script>
  </body>
</html>`,
  };
}

function writeHyperframesProject(config, tempDir) {
  if (!fs.existsSync(GSAP_SCRIPT)) throw new Error("HyperFrames motion graphics require gsap. Run npm install first.");
  fs.copyFileSync(GSAP_SCRIPT, path.join(tempDir, "gsap.min.js"));
  const composition = buildCompositionHtml(config);
  fs.writeFileSync(path.join(tempDir, "index.html"), composition.html, "utf-8");
  fs.writeFileSync(path.join(tempDir, "hyperframes.json"), `${JSON.stringify({ entry: "index.html" }, null, 2)}\n`, "utf-8");
  return composition;
}

function runHyperframes(tempDir, output) {
  if (!fs.existsSync(HYPERFRAMES_CLI)) throw new Error("HyperFrames CLI is not installed. Run npm install first.");
  run(process.execPath, [HYPERFRAMES_CLI, "lint", tempDir, "--json"], { cwd: REPO_ROOT });
  run(process.execPath, [
    HYPERFRAMES_CLI,
    "render",
    tempDir,
    "--output",
    output,
    "--fps",
    String(FPS),
    "--quality",
    "standard",
    "--workers",
    "1",
    "--no-browser-gpu",
    "--quiet",
  ], { cwd: REPO_ROOT });
}

function extractPoster(output, poster, duration) {
  if (!poster) return;
  ensureDir(poster);
  const sampleAt = Math.min(Math.max(0.1, duration / 2), Math.max(0.1, duration - 0.05));
  run("ffmpeg", ["-y", "-ss", sampleAt.toFixed(3), "-i", output, "-frames:v", "1", poster], { cwd: REPO_ROOT });
}

async function main() {
  const configPath = readArg("--config");
  const output = readArg("--output");
  const poster = readArg("--poster");
  if (!configPath || !output) throw new Error("Usage: render-hyperframes-motion-graphic.mjs --config config.json --output out.mp4 [--poster poster.png]");
  const config = JSON.parse(fs.readFileSync(configPath, "utf-8"));
  const duration = Math.max(0.1, asNumber(config.durationSeconds, 6));
  ensureDir(output);
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "hyperframes-motion-graphic-"));
  let rendererKey = "stat_reveal";
  try {
    const composition = writeHyperframesProject(config, tempDir);
    rendererKey = composition.rendererKey;
    runHyperframes(tempDir, output);
    extractPoster(output, poster, duration);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
  console.log(JSON.stringify({
    output,
    poster,
    durationSeconds: duration,
    renderer: rendererKey,
    rendererEngine: "hyperframes",
    fps: FPS,
    backgroundImagePath: resolveBackgroundImagePath(config) || null,
  }, null, 2));
}

const isCli = process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (isCli) {
  try {
    await main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

export {
  buildCompositionHtml,
  comparisonRevealTiming,
  fixedRevealTiming,
  resolveRendererArgs,
  resolveRendererKey,
};
