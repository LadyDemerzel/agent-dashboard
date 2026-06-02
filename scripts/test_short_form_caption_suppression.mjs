import assert from "node:assert/strict";
import {
  deriveMotionGraphicRangesFromVideoManifest,
  mergeTimeRanges,
  subtractTimeRanges,
  suppressCaptionTimelineForRanges,
} from "./short-form-caption-suppression.mjs";

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

console.log("short-form caption suppression tests passed");
