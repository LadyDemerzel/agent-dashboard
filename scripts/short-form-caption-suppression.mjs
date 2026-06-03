import fs from "fs";

const MIN_VISIBLE_CAPTION_SECONDS = 0.04;
const MIN_VISIBLE_WORD_SECONDS = 0.01;
const CAPTION_SUPPRESSION_RENDER_SAFETY_SECONDS = 0.02;

function finiteNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function isMotionGraphicScene(scene) {
  return (
    scene?.visual_type === "motion_graphic"
    || scene?.applied_motion?.mode === "motion_graphic_template"
    || (typeof scene?.motion_graphic_source_video === "string" && scene.motion_graphic_source_video.trim())
    || (typeof scene?.final_video_input === "string" && scene.final_video_input.trim() && scene?.applied_motion?.source_motion_graphic_video)
  );
}

export function mergeTimeRanges(ranges) {
  const normalized = (Array.isArray(ranges) ? ranges : [])
    .map((range) => ({
      start: finiteNumber(range?.start),
      end: finiteNumber(range?.end),
    }))
    .filter((range) => range.start !== null && range.end !== null && range.end > range.start)
    .sort((a, b) => a.start - b.start || a.end - b.end);

  const merged = [];
  for (const range of normalized) {
    const previous = merged[merged.length - 1];
    if (previous && range.start <= previous.end + 0.001) {
      previous.end = Math.max(previous.end, range.end);
    } else {
      merged.push({ ...range });
    }
  }
  return merged;
}

export function subtractTimeRanges(start, end, blockedRanges) {
  const safeStart = finiteNumber(start);
  const safeEnd = finiteNumber(end);
  if (safeStart === null || safeEnd === null || safeEnd <= safeStart) return [];

  let visible = [{ start: safeStart, end: safeEnd }];
  for (const blocked of mergeTimeRanges(blockedRanges)) {
    visible = visible.flatMap((range) => {
      if (blocked.end <= range.start || blocked.start >= range.end) return [range];
      return [
        { start: range.start, end: Math.min(range.end, blocked.start) },
        { start: Math.max(range.start, blocked.end), end: range.end },
      ].filter((candidate) => candidate.end - candidate.start >= MIN_VISIBLE_CAPTION_SECONDS);
    });
    if (visible.length === 0) break;
  }
  return visible;
}

function trimCaptionWordsToRange(words, range) {
  return (Array.isArray(words) ? words : [])
    .map((word) => {
      const wordStart = finiteNumber(word?.start);
      const wordEnd = finiteNumber(word?.end);
      if (wordStart === null || wordEnd === null || wordEnd <= wordStart) return null;
      if (wordEnd <= range.start || wordStart >= range.end) return null;
      const start = Math.max(range.start, wordStart);
      const end = Math.min(range.end, wordEnd);
      if (end - start < MIN_VISIBLE_WORD_SECONDS) return null;
      return {
        ...word,
        start,
        end,
      };
    })
    .filter(Boolean);
}

function buildCaptionTextFromWords(words, fallbackText) {
  const text = (Array.isArray(words) ? words : [])
    .map((word) => String(word?.text || "").trim())
    .filter(Boolean)
    .join(" ");
  return text || String(fallbackText || "").trim();
}

export function suppressCaptionTimelineForRanges(captionTimeline, blockedRanges) {
  const mergedBlockedRanges = mergeTimeRanges(blockedRanges);
  if (mergedBlockedRanges.length === 0) return Array.isArray(captionTimeline) ? captionTimeline : [];

  const suppressed = [];
  for (const caption of Array.isArray(captionTimeline) ? captionTimeline : []) {
    const visibleRanges = subtractTimeRanges(caption?.start, caption?.end, mergedBlockedRanges);
    if (visibleRanges.length === 0) continue;

    if (
      visibleRanges.length === 1
      && Math.abs(visibleRanges[0].start - Number(caption.start)) <= 0.001
      && Math.abs(visibleRanges[0].end - Number(caption.end)) <= 0.001
    ) {
      suppressed.push(caption);
      continue;
    }

    visibleRanges.forEach((range, index) => {
      const words = trimCaptionWordsToRange(caption.words, range);
      if (Array.isArray(caption.words) && words.length === 0) return;
      suppressed.push({
        ...caption,
        id: `${caption.id || `caption-${caption.index || suppressed.length + 1}`}-visible-${index + 1}`,
        text: buildCaptionTextFromWords(words, caption.text),
        start: range.start,
        end: range.end,
        ...(Array.isArray(caption.words) ? { words } : {}),
      });
    });
  }
  return suppressed;
}

export function buildOffsetAwareCaptionSuppressionRanges(blockedRanges, timingOffsetMs) {
  const offsetSeconds = (finiteNumber(timingOffsetMs) ?? 0) / 1000;
  if (Math.abs(offsetSeconds) < 0.0001) return mergeTimeRanges(blockedRanges);

  return mergeTimeRanges(blockedRanges).map((range) => ({
    ...range,
    start: offsetSeconds < 0 && range.start <= 0 ? 0 : range.start - offsetSeconds,
    end: range.end - offsetSeconds,
  }));
}

export function buildEffectiveCaptionSuppressionRanges(blockedRanges, timingOffsetMs) {
  const originalRanges = mergeTimeRanges(blockedRanges);
  const offsetAwareRanges = buildOffsetAwareCaptionSuppressionRanges(originalRanges, timingOffsetMs);
  return mergeTimeRanges([...originalRanges, ...offsetAwareRanges].map((range) => ({
    ...range,
    start: Math.max(0, range.start - CAPTION_SUPPRESSION_RENDER_SAFETY_SECONDS),
    end: range.end + CAPTION_SUPPRESSION_RENDER_SAFETY_SECONDS,
  })));
}

export function deriveMotionGraphicRangesFromVideoManifest(manifest) {
  const scenes = Array.isArray(manifest?.scenes) ? manifest.scenes : [];
  const ranges = [];
  let cursor = 0;

  for (const scene of scenes) {
    const duration = finiteNumber(scene?.duration);
    const start = finiteNumber(scene?.background_start) ?? cursor;
    const end = finiteNumber(scene?.background_end) ?? (duration !== null ? start + duration : null);
    if (isMotionGraphicScene(scene) && end !== null && end > start) {
      ranges.push({
        start,
        end,
        sceneIndex: finiteNumber(scene?.index),
      });
    }
    cursor = end !== null && end > start
      ? end
      : cursor + Math.max(0, duration ?? 0);
  }

  return mergeTimeRanges(ranges);
}

export function readMotionGraphicSuppressionRanges(manifestPath) {
  if (!manifestPath || !fs.existsSync(manifestPath)) return [];
  try {
    return deriveMotionGraphicRangesFromVideoManifest(JSON.parse(fs.readFileSync(manifestPath, "utf-8")));
  } catch {
    return [];
  }
}
