import path from "node:path";

const MIN_OVERLAY_FPS = 12;
const MAX_OVERLAY_FPS = 60;
const FRAME_EPSILON_SECONDS = 0.0001;

export function normalizeOverlayTrackFps(fps) {
  const value = Number(fps);
  if (!Number.isFinite(value) || value <= 0) return 30;
  return Math.max(MIN_OVERLAY_FPS, Math.min(MAX_OVERLAY_FPS, value));
}

export function normalizeCaptionOverlayEntries(entries, outputDir) {
  return (Array.isArray(entries) ? entries : [])
    .filter((entry) => entry && typeof entry === "object")
    .map((entry) => {
      const relativePath = typeof entry.relativePath === "string" ? entry.relativePath : "";
      return {
        relativePath,
        absolutePath: relativePath ? path.join(outputDir, relativePath) : "",
        start: Number(entry.start),
        end: Number(entry.end),
        frameIndex: Number.isInteger(Number(entry.frameIndex)) ? Number(entry.frameIndex) : null,
      };
    })
    .filter((entry) => entry.relativePath && Number.isFinite(entry.start) && Number.isFinite(entry.end) && entry.end > entry.start)
    .sort((a, b) => a.start - b.start || a.end - b.end || (a.frameIndex ?? 0) - (b.frameIndex ?? 0));
}

export function buildCaptionOverlayFramePlan({ entries, outputDir, blankOverlayPath, totalDurationSeconds, fps }) {
  const safeFps = normalizeOverlayTrackFps(fps);
  const safeDuration = Number(totalDurationSeconds);
  if (!Number.isFinite(safeDuration) || safeDuration <= 0) {
    throw new Error("Caption overlay track requires a positive base video duration.");
  }

  const frameCount = Math.max(1, Math.ceil(safeDuration * safeFps));
  const frames = Array.from({ length: frameCount }, (_, index) => ({
    index,
    start: index / safeFps,
    end: (index + 1) / safeFps,
    path: blankOverlayPath,
    source: "blank",
  }));

  const normalizedEntries = normalizeCaptionOverlayEntries(entries, outputDir);
  for (const entry of normalizedEntries) {
    if (entry.frameIndex != null) {
      if (entry.frameIndex >= 0 && entry.frameIndex < frameCount) {
        frames[entry.frameIndex] = {
          ...frames[entry.frameIndex],
          path: entry.absolutePath,
          source: entry.relativePath,
        };
      }
      continue;
    }

    const startFrame = Math.max(0, Math.floor((entry.start + FRAME_EPSILON_SECONDS) * safeFps));
    const endFrame = Math.min(frameCount, Math.max(startFrame + 1, Math.ceil((entry.end - FRAME_EPSILON_SECONDS) * safeFps)));
    for (let frameIndex = startFrame; frameIndex < endFrame; frameIndex += 1) {
      frames[frameIndex] = {
        ...frames[frameIndex],
        path: entry.absolutePath,
        source: entry.relativePath,
      };
    }
  }

  return {
    fps: safeFps,
    frameCount,
    frames,
    entries: normalizedEntries,
  };
}

export function formatCaptionOverlayFrameAudit(framePlan) {
  return framePlan.frames
    .map((frame) => [
      `frame ${String(frame.index).padStart(6, "0")}`,
      `start ${frame.start.toFixed(3)}`,
      `end ${frame.end.toFixed(3)}`,
      `file '${String(frame.path).replace(/'/g, `'\\''`)}'`,
      `source ${frame.source}`,
    ].join(" "))
    .join("\n");
}
