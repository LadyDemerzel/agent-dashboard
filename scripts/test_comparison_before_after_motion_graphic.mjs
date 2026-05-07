import assert from "node:assert/strict";

import {
  COMPARISON_TIMING,
  comparison,
  comparisonRevealTiming,
} from "./render-motion-graphic.mjs";

function seconds(value) {
  return Number(value.toFixed(3));
}

const shortTiming = comparisonRevealTiming({ before: "Problem state" });
assert.equal(
  seconds(shortTiming.afterStart - shortTiming.beforeFinish),
  COMPARISON_TIMING.afterDelayAfterBeforeFinish,
  "after side should start 1s after the before side finishes",
);
assert.equal(shortTiming.afterStart, 2.84);

const longTiming = comparisonRevealTiming({
  before: "Tension stacked under the chin makes the jawline read worse",
});
assert.ok(longTiming.beforeCopyLineCount > shortTiming.beforeCopyLineCount, "long before copy should wrap onto more lines");
assert.ok(longTiming.afterStart > shortTiming.afterStart, "after side should wait for wrapped before copy to finish");
assert.equal(
  seconds(longTiming.afterStart - longTiming.beforeFinish),
  COMPARISON_TIMING.afterDelayAfterBeforeFinish,
  "wrapped before copy should still leave a 1s gap before the after side",
);

const filters = comparison(
  {
    beforeLabel: "Before",
    afterLabel: "After",
    before: "Problem state",
    after: "Improved state",
  },
  "dark-pastel-watercolor",
  [],
);

const boxFilters = filters.filter((filter) => filter.startsWith("drawbox="));
assert.equal(boxFilters.length, 1, "comparison should keep only the vertical divider box");
assert.ok(boxFilters[0].includes("x=538"), "remaining box should be the vertical divider");
assert.ok(
  !filters.some((filter) => filter.includes("y=1124") || filter.includes("w=236:h=3")),
  "before/after horizontal underlines should not be rendered",
);

const afterLabelFilter = filters.find((filter) => filter.includes("text='After'"));
assert.ok(afterLabelFilter, "after label filter should render");
assert.ok(
  afterLabelFilter.includes(`gte(t\\,${shortTiming.afterStart.toFixed(3)})`),
  "after label should use the derived delayed start",
);

const afterCopyFilter = filters.find((filter) => filter.includes("text='Improved'"));
assert.ok(afterCopyFilter, "after copy filter should render");
assert.ok(
  afterCopyFilter.includes(`gte(t\\,${shortTiming.afterCopyStart.toFixed(3)})`),
  "after copy should retain its side-relative offset after the delayed label start",
);

console.log("comparison before/after motion graphic tests passed");
