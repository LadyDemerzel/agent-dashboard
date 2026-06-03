import assert from "node:assert/strict";
import {
  buildEffectiveCaptionSuppressionRanges,
  buildOffsetAwareCaptionSuppressionRanges,
  deriveMotionGraphicRangesFromVideoManifest,
  mergeTimeRanges,
  subtractTimeRanges,
  suppressCaptionTimelineForRanges,
} from "./short-form-caption-suppression.mjs";

function roundRanges(ranges) {
  return ranges.map((range) => ({
    start: Math.round(range.start * 1000) / 1000,
    end: Math.round(range.end * 1000) / 1000,
  }));
}

const merged = mergeTimeRanges([
  { start: 2, end: 3 },
  { start: 1, end: 2.0005 },
  { start: 4, end: 5 },
]);
assert.deepEqual(merged, [
  { start: 1, end: 3 },
  { start: 4, end: 5 },
]);

assert.deepEqual(
  subtractTimeRanges(0, 6, [{ start: 1, end: 2 }, { start: 4, end: 5 }]),
  [
    { start: 0, end: 1 },
    { start: 2, end: 4 },
    { start: 5, end: 6 },
  ],
);

const ranges = deriveMotionGraphicRangesFromVideoManifest({
  scenes: [
    { index: 1, duration: 1.2, background_start: 0, background_end: 1.2 },
    {
      index: 2,
      duration: 2,
      background_start: 1.2,
      background_end: 3.2,
      visual_type: "motion_graphic",
      applied_motion: { mode: "motion_graphic_template" },
    },
    { index: 3, duration: 1.1, background_start: 3.2, background_end: 4.3 },
  ],
});
assert.deepEqual(ranges, [{ start: 1.2, end: 3.2 }]);

const words = [
  { text: "before", start: 0.2, end: 0.5 },
  { text: "during", start: 1.4, end: 1.8 },
  { text: "after", start: 3.4, end: 3.8 },
];
const suppressed = suppressCaptionTimelineForRanges([
  { id: "caption-1", index: 1, text: "before during after", start: 0, end: 4, words },
  { id: "caption-2", index: 2, text: "covered", start: 1.4, end: 2.5, words: [words[1]] },
  { id: "caption-3", index: 3, text: "visible", start: 4.1, end: 4.8, words: [{ text: "visible", start: 4.2, end: 4.5 }] },
], ranges);

assert.equal(suppressed.length, 3);
assert.deepEqual(
  suppressed.map((caption) => ({ id: caption.id, start: caption.start, end: caption.end, text: caption.text })),
  [
    { id: "caption-1-visible-1", start: 0, end: 1.2, text: "before" },
    { id: "caption-1-visible-2", start: 3.2, end: 4, text: "after" },
    { id: "caption-3", start: 4.1, end: 4.8, text: "visible" },
  ],
);
assert.deepEqual(suppressed.map((caption) => caption.words?.map((word) => word.text)), [
  ["before"],
  ["after"],
  ["visible"],
]);

const negativeOffsetSuppressionRanges = buildOffsetAwareCaptionSuppressionRanges([{ start: 0, end: 5 }], -130);
assert.deepEqual(negativeOffsetSuppressionRanges, [{ start: 0, end: 5.13 }]);
const negativeOffsetSuppressed = suppressCaptionTimelineForRanges([
  {
    id: "caption-after-motion",
    index: 4,
    text: "after motion",
    start: 5.04,
    end: 5.8,
    words: [
      { text: "after", start: 5.04, end: 5.28 },
      { text: "motion", start: 5.28, end: 5.8 },
    ],
  },
], negativeOffsetSuppressionRanges);
assert.deepEqual(
  negativeOffsetSuppressed.map((caption) => ({ start: caption.start, end: caption.end, text: caption.text })),
  [{ start: 5.13, end: 5.8, text: "after motion" }],
);

const negativeOffsetEffectiveSuppressionRanges = buildEffectiveCaptionSuppressionRanges([{ start: 5, end: 6 }], -130);
assert.deepEqual(roundRanges(negativeOffsetEffectiveSuppressionRanges), [{ start: 4.98, end: 6.15 }]);
const negativeOffsetDuringMotionSuppressed = suppressCaptionTimelineForRanges([
  {
    id: "caption-spoken-during-motion",
    index: 5,
    text: "during motion",
    start: 5.04,
    end: 5.12,
    words: [
      { text: "during", start: 5.04, end: 5.08 },
      { text: "motion", start: 5.08, end: 5.12 },
    ],
  },
], negativeOffsetEffectiveSuppressionRanges);
assert.deepEqual(negativeOffsetDuringMotionSuppressed, []);

const positiveOffsetSuppressionRanges = buildOffsetAwareCaptionSuppressionRanges([{ start: 5, end: 6 }], 130);
assert.deepEqual(positiveOffsetSuppressionRanges, [{ start: 4.87, end: 5.87 }]);
const positiveOffsetSuppressed = suppressCaptionTimelineForRanges([
  {
    id: "caption-before-motion",
    index: 5,
    text: "before motion",
    start: 4.2,
    end: 4.96,
    words: [
      { text: "before", start: 4.2, end: 4.6 },
      { text: "motion", start: 4.6, end: 4.96 },
    ],
  },
], positiveOffsetSuppressionRanges);
assert.deepEqual(
  positiveOffsetSuppressed.map((caption) => ({ start: caption.start, end: caption.end, text: caption.text })),
  [{ start: 4.2, end: 4.87, text: "before motion" }],
);

const positiveOffsetEffectiveSuppressionRanges = buildEffectiveCaptionSuppressionRanges([{ start: 5, end: 6 }], 130);
assert.deepEqual(roundRanges(positiveOffsetEffectiveSuppressionRanges), [{ start: 4.85, end: 6.02 }]);
const positiveOffsetDuringMotionSuppressed = suppressCaptionTimelineForRanges([
  {
    id: "caption-spoken-during-motion-after",
    index: 6,
    text: "during motion",
    start: 5.9,
    end: 5.98,
    words: [
      { text: "during", start: 5.9, end: 5.94 },
      { text: "motion", start: 5.94, end: 5.98 },
    ],
  },
], positiveOffsetEffectiveSuppressionRanges);
assert.deepEqual(positiveOffsetDuringMotionSuppressed, []);

console.log("short-form caption suppression tests passed");
