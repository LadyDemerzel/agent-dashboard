import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import sharp from "sharp";

import {
  lineGrowthChart,
  pieChart,
  rankedPodium,
  scorecard,
  sequentialRevealTiming,
  stepChecklist,
  researchPaperCard,
  goodBadIndicator,
  instruction,
  causeEffect,
  resolveRendererKey,
} from "./render-motion-graphic.mjs";

async function measureVisibleRoundedTextCardPadding(overlay) {
  const { data, info } = await sharp(overlay.filePath).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const cardX = Math.round((info.width - overlay.debugRoundedTextCardWidth) / 2);
  const cardY = Math.round((info.height - overlay.debugRoundedTextCardHeight - overlay.debugRoundedTextCardShadowDy) / 2);
  let minX = Infinity;
  let maxX = -Infinity;

  for (let y = cardY; y < cardY + overlay.debugRoundedTextCardHeight; y += 1) {
    for (let x = cardX; x < cardX + overlay.debugRoundedTextCardWidth; x += 1) {
      const offset = (y * info.width + x) * 4;
      const red = data[offset];
      const green = data[offset + 1];
      const blue = data[offset + 2];
      const alpha = data[offset + 3];
      if (alpha > 120 && red > 120 && green > 120 && blue > 120) {
        minX = Math.min(minX, x);
        maxX = Math.max(maxX, x);
      }
    }
  }

  assert.ok(Number.isFinite(minX) && Number.isFinite(maxX), "rounded text card visual padding test should find rendered text pixels");
  return {
    left: minX - cardX,
    right: cardX + overlay.debugRoundedTextCardWidth - 1 - maxX,
    textWidth: maxX - minX + 1,
  };
}

const preRevealed = sequentialRevealTiming(0, 2, { firstRevealAt: 0.42, revealDuration: 0.44, gapAfterReveal: 0.34 });
assert.equal(preRevealed.preRevealed, true);
assert.equal(preRevealed.revealAt, 0);

const animatedSecond = sequentialRevealTiming(1, 2, { firstRevealAt: 0.42, revealDuration: 0.44, gapAfterReveal: 0.34 });
assert.equal(animatedSecond.preRevealed, false);
assert.equal(animatedSecond.revealAt, 0.42);

assert.equal(
  resolveRendererKey({ templateId: "good-bad-indicator", rendererId: "good-bad-indicator" }),
  "good_bad_indicator",
  "good-bad-indicator template ids must resolve to the deterministic good/bad renderer",
);
assert.equal(
  resolveRendererKey({ templateId: "good-bad-indicator" }),
  "good_bad_indicator",
  "renderer resolution must fall back from known template id to the matching renderer id",
);

const rankedFilters = rankedPodium(
  {
    steps: [
      { label: "01", text: "Already present" },
      { label: "02", text: "Animate this rank" },
      { label: "03", text: "Future rank" },
    ],
    startIndex: 2,
    futureItemsMode: "blurred",
  },
  "dark-pastel-watercolor",
  [],
);
assert.ok(rankedFilters.some((filter) => filter.includes("text='#01'") && !filter.includes("enable='gte")), "rank 1 should render already present");
assert.ok(rankedFilters.some((filter) => filter.includes("text='#02'") && filter.includes("lt(t\\,0.420)")), "rank 2 should have a muted pre-reveal ghost when blurred");
assert.ok(rankedFilters.some((filter) => filter.includes("text='#02'") && filter.includes("gte(t\\,0.420)")), "rank 2 should animate at the first reveal beat");

const checklistOverlayInputs = [];
checklistOverlayInputs.tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "checklist-template-test-"));
checklistOverlayInputs.duration = 6;
const hiddenChecklistFilters = await stepChecklist(
  {
    items: [
      "Already checked",
      "Animate this item with enough words that it wraps cleanly onto multiple lines without hitting the following item",
      "Hidden future item",
    ],
    startIndex: 2,
    futureItemsMode: "hidden",
  },
  "dark-pastel-watercolor",
  checklistOverlayInputs,
);
assert.ok(checklistOverlayInputs.some((overlay) => overlay.debugChecklistCheckCentered && overlay.start === 0), "item 1 should render already checked with a centered check overlay");
assert.ok(checklistOverlayInputs.every((overlay) => overlay.debugChecklistRoundedRectRadius > 0), "checklist boxes should use rounded corners");
assert.ok(!hiddenChecklistFilters.some((filter) => filter.includes("lt(t\\,0.420)")), "hidden checklist mode should not render future ghosts");
assert.ok(checklistOverlayInputs.some((overlay) => overlay.debugChecklistCheckCentered && overlay.start === 0.44), "item 2 should animate its centered check overlay at the first reveal beat");
assert.ok(!hiddenChecklistFilters.some((filter) => filter.includes("STEP")), "checklist should not render step labels");
assert.ok(!hiddenChecklistFilters.some((filter) => filter.includes("w=690:h=2")), "checklist should not render horizontal divider lines");
const wrappedChecklistTextFilters = hiddenChecklistFilters.filter((filter) =>
  filter.includes("text='Animate this item") || filter.includes("text='wraps cleanly") || filter.includes("text='multiple lines"),
);
assert.ok(wrappedChecklistTextFilters.length >= 3, "checklist row height should account for wrapped item text");
const wrappedChecklistYs = wrappedChecklistTextFilters
  .map((filter) => Number(filter.match(/:y='?([0-9.]+)/)?.[1]))
  .filter(Number.isFinite);
const futureItemY = Number(hiddenChecklistFilters.find((filter) => filter.includes("text='Hidden future item'"))?.match(/:y='?([0-9.]+)/)?.[1]);
assert.ok(wrappedChecklistYs.length >= 3 && Number.isFinite(futureItemY), "checklist test should capture wrapped and following item positions");
assert.ok(Math.max(...wrappedChecklistYs) + 48 < futureItemY, "following checklist item should start below the wrapped item block");

const scorecardFilters = scorecard(
  { title: "Fit score", data: [{ label: "Clarity", value: 80, displayValue: "80" }] },
  "dark-pastel-watercolor",
  [],
);
assert.ok(scorecardFilters.some((filter) => filter.includes("text='Fit score'")), "scorecard title should render");
assert.ok(scorecardFilters.some((filter) => filter.includes("text='Clarity'")), "scorecard metric label should render");

const pieOverlayInputs = [];
pieOverlayInputs.tempDir = process.cwd();
pieOverlayInputs.duration = 6;
const pieFilters = await pieChart(
  { title: "Share of change", data: [{ label: "A", value: 35, displayValue: "35%" }, { label: "B", value: 65, displayValue: "65%" }] },
  "dark-pastel-watercolor",
  pieOverlayInputs,
);
assert.ok(pieFilters.some((filter) => filter.includes("text='Share of change'")), "pie chart should render title");
assert.ok(pieFilters.some((filter) => filter.includes("text='A'")), "pie chart should render slice labels");
assert.ok(!pieFilters.some((filter) => filter.includes("x=242:y=507:w=596:h=596")), "pie chart should not render a square background panel behind the pie");
assert.ok(pieFilters.some((filter) => filter.includes("x=166:y=1209:w=37:h=37")), "pie chart legend color marker should be 33% larger and vertically centered against the visible legend text");
assert.ok(!pieFilters.some((filter) => filter.includes("x=166:y=1214:w=37:h=37")), "pie chart legend marker should not top-align with the legend text row");
assert.ok(!pieFilters.some((filter) => filter.includes("x=166:y=1229:w=28:h=28")), "pie chart legend should not use the old smaller, lower color marker");
assert.equal(pieOverlayInputs.length, 2, "pie chart should create one slice overlay per data point");

const growthOverlayInputs = [];
growthOverlayInputs.tempDir = process.cwd();
growthOverlayInputs.duration = 6;
const growthFilters = await lineGrowthChart(
  { title: "Growth trend", direction: "increase" },
  "dark-pastel-watercolor",
  growthOverlayInputs,
);
assert.ok(growthFilters.some((filter) => filter.includes("text='Growth trend'")), "line growth chart should render increase title");
assert.ok(growthOverlayInputs.some((overlay) => overlay.filePath.includes("line-growth-main")), "line growth chart should create a growth-line overlay");
const growthLineOverlay = growthOverlayInputs.find((overlay) => overlay.filePath.includes("line-growth-main"));
assert.equal(growthLineOverlay?.growRightDuration, 3, "increase line chart should draw the arrow over 3 full seconds");
assert.deepEqual(growthLineOverlay?.debugLineStart, growthLineOverlay?.debugChartOrigin, "increase line chart should start at the plotted 0,0 origin");
assert.equal(growthLineOverlay?.debugPoints?.[0]?.x, 0, "increase line chart origin start should not be offset right from the Y-axis");
assert.equal(growthLineOverlay?.debugLineCap, "round", "increase line chart should render a rounded left/start line cap");
assert.equal(growthLineOverlay?.debugLineColor, "#84907d", "increase line/arrow color should be opaque while visually matching the old translucent sage");
assert.equal(growthLineOverlay?.debugArrowIntroDuration, 1, "line growth chart arrowhead should fade/scale in over 1000ms");
assert.equal(growthLineOverlay?.debugArrowIntroStartsAt, growthLineOverlay?.start + growthLineOverlay?.debugPrimaryLineStartOffset, "line growth chart arrowhead animation should start with the primary line growth");
assert.equal(growthLineOverlay?.debugAxisGrowDuration, 2, "line growth chart axes should grow in over 2 full seconds");
assert.deepEqual(growthLineOverlay?.debugAxesAnimationDirections, { x: "left-to-right", y: "bottom-to-top" }, "line growth chart axes should grow rightward and upward");
assert.equal(growthLineOverlay?.debugAxisArrowheadCount, 2, "line growth chart should render two Cartesian axis arrowheads");
assert.equal(growthLineOverlay?.debugAxisArrowheadStyle, "stroke-chevron", "axis arrowheads should be chevron stroke arrowheads instead of filled triangles");
assert.equal(growthLineOverlay?.debugAxisArrowheadFadeInDuration, 0.3, "axis arrowheads should fade in over 300ms");
assert.equal(growthLineOverlay?.debugAxisArrowheadsMoveWithAxes, true, "axis arrowheads should move with growing axis endpoints");
assert.equal(growthLineOverlay?.debugLineEndRetraction, 30, "line growth chart should retract the line endpoint under the arrowhead");
assert.equal(growthLineOverlay?.debugArrowMarkerCount, 1, "line growth chart should render one clean arrowhead");
assert.deepEqual(growthLineOverlay?.debugArrowMarkerSize, { width: 70, height: 42 }, "line growth chart arrowhead should use a shorter vertical triangle");
assert.equal(growthLineOverlay?.debugArrowHalfHeight, 16, "line growth chart arrowhead triangle should be vertically shortened but still read taller than wide on the diagonal");
assert.equal(growthLineOverlay?.debugGridLineCount, 8, "line growth chart should render subtle graph-paper grid lines");
assert.equal(growthLineOverlay?.debugGridLinesBehindGraphAndAxes, true, "line growth chart grid lines should stay behind the graph and axes");
assert.deepEqual(
  growthLineOverlay?.debugGridLineAnimationDirections,
  { horizontal: "left-to-right-from-y-axis", vertical: "bottom-to-top-from-x-axis" },
  "line growth chart grid lines should grow out from the Cartesian axes",
);
assert.deepEqual(
  growthLineOverlay?.debugGridLineStaggerOrder,
  { horizontal: "bottom-to-top", vertical: "left-to-right" },
  "line growth chart grid lines should preserve the requested stagger order",
);
assert.equal(growthLineOverlay?.debugGridLinesStartAfterAxes, false, "line growth chart grid lines should not wait for the axes to finish animating");
assert.equal(growthLineOverlay?.debugGridStartsWithAxes, true, "grid animation should begin exactly when the axes begin");
assert.equal(growthLineOverlay?.debugGridStartsWhenAxesHalfwayDone, false, "grid animation should no longer wait until the 2s axes animation is halfway done");
assert.equal(growthLineOverlay?.debugGridStartOffset, 0, "grid animation should start at the beginning of the axes animation");
assert.equal(growthLineOverlay?.debugGridLineStagger, 0.4, "line growth chart grid lines should use a more pronounced stagger");
assert.equal(growthLineOverlay?.debugGridTotalDuration, 3, "all line growth chart grid lines should take a full 3 seconds total to animate in");
assert.equal(growthLineOverlay?.debugGridLineGrowDuration, 1, "individual grid line growth should fill the 3s staggered grid sequence");
assert.equal(growthLineOverlay?.debugVerticalGridStartsAfterHorizontalLineCount, 2, "vertical grid lines should wait until the first two horizontal grid lines have started");
assert.equal(growthLineOverlay?.debugPrimaryLineStartsAfterGrid, false, "primary line should start before the grid has fully animated in");
assert.equal(growthLineOverlay?.debugPrimaryLineStartOffset, 1, "primary line should start 1 second into the overlay sequence");
assert.equal(growthLineOverlay?.debugPrimaryLineStartDelayAfterGridStart, 1, "primary line should start 1 second after grid animation begins");
assert.equal(growthLineOverlay?.debugPrimaryLineOverlapsGrid, true, "primary line should overlap the grid animation");
assert.equal(growthLineOverlay?.debugPrimaryLineEasing, "ease-in-cubic", "primary line growth should accelerate and move fastest near the end");
assert.equal(growthLineOverlay?.debugArrowAndCounterUsePrimaryLineEasing, true, "arrowhead and counter should stay synced to the eased primary line progress");
assert.deepEqual(growthLineOverlay?.debugPlotArea, { width: 708, height: 708, isSquare: true }, "line growth chart plotting area should be a perfect square");
assert.deepEqual(
  growthLineOverlay?.debugChartCentering,
  { frameCenterX: 540, plotLeftX: 186, plotRightX: 894, plotCenterX: 540, isHorizontallyCentered: true },
  "line growth chart square plot should be horizontally centered in the 1080px frame",
);
assert.equal(growthLineOverlay?.debugAxesOverlayAboveLine, true, "line growth chart should draw chart axes above the animated line overlay");
assert.equal(growthLineOverlay?.debugLineClipPreventsLeftAndBottomOverflow, true, "line growth chart should clip line/arrow overflow left of and below the axes");
assert.deepEqual(growthLineOverlay?.debugLineClipEdges, { minX: 0, maxY: 708 }, "line growth chart clip should preserve plotted origin semantics at the chart axes");
assert.equal(growthLineOverlay?.debugFrameCount, 121, "line growth chart should render one animated frame per 30fps frame across axes, grid, and primary line sequencing");
assert.equal(growthLineOverlay?.frameFiles?.length, 121, "line growth chart should feed each generated line/arrowhead frame to FFmpeg");
assert.ok(growthLineOverlay?.framePattern?.includes("frame-%05d.png"), "line growth chart should use a frame sequence so the arrowhead follows the line tip");
assert.equal(growthLineOverlay?.debugValueLabelPresent, false, "line growth chart should not render a value label when valueLabel is omitted");
const growthStartLabelFilter = growthFilters.find((filter) => filter.includes("text='Start'"));
const growthEndLabelFilter = growthFilters.find((filter) => filter.includes("text='Now'"));
assert.ok(growthStartLabelFilter?.includes("+14*(1-"), "line growth chart start x-axis label should slide up from below");
assert.ok(growthStartLabelFilter?.includes(":alpha='"), "line growth chart start x-axis label should fade in");
assert.ok(growthStartLabelFilter?.includes("gte(t\\,1.720)"), "line growth chart start x-axis label should animate during the axes/grid handoff");
assert.ok(growthEndLabelFilter?.includes("+14*(1-"), "line growth chart end x-axis label should slide up from below");
assert.ok(growthEndLabelFilter?.includes(":alpha='"), "line growth chart end x-axis label should fade in");
assert.ok(growthEndLabelFilter?.includes("gte(t\\,1.800)"), "line growth chart end x-axis label should subtly stagger after the start label");
assert.ok(Math.abs((growthLineOverlay?.debugFirstTip?.x ?? 999) - (growthLineOverlay?.debugPoints?.[0]?.x ?? 0)) < 4, "arrowhead should start at the current line tip from the first growth frame");
assert.ok(Math.abs((growthLineOverlay?.debugFirstTip?.y ?? 999) - (growthLineOverlay?.debugPoints?.[0]?.y ?? 0)) < 4, "arrowhead should start at the current line tip from the first growth frame");
assert.ok(
  Math.abs((growthLineOverlay?.debugFinalTip?.x ?? 999) - (growthLineOverlay?.debugPoints?.at(-1)?.x ?? 0)) < 0.01
    && Math.abs((growthLineOverlay?.debugFinalTip?.y ?? 999) - (growthLineOverlay?.debugPoints?.at(-1)?.y ?? 0)) < 0.01,
  "arrowhead should finish at the final line tip",
);
assert.equal(growthLineOverlay?.debugFinalTip?.x, growthLineOverlay?.debugPoints?.at(-1)?.x, "increase arrowhead should end at the graph's right edge");
assert.ok((growthLineOverlay?.debugFinalLineEnd?.x ?? 999) < (growthLineOverlay?.debugFinalTip?.x ?? 0), "increase line should end behind the arrowhead before the tip");
assert.ok(
  Math.hypot(
    (growthLineOverlay?.debugFinalTip?.x ?? 0) - (growthLineOverlay?.debugFinalLineEnd?.x ?? 0),
    (growthLineOverlay?.debugFinalTip?.y ?? 0) - (growthLineOverlay?.debugFinalLineEnd?.y ?? 0),
  ) >= 25,
  "increase line endpoint should be visibly retracted from the arrowhead tip",
);
assert.equal(growthLineOverlay?.debugPoints?.at(-1)?.y, 0, "increase arrowhead should end at the graph's top-right corner");
assert.ok(
  Math.abs((growthLineOverlay?.debugPoints?.[1]?.x ?? 0) - growthLineOverlay?.debugPlotArea.width * 0.66) < 0.01,
  "increase line bend should land 66% of the way through the x-axis",
);
assert.ok(
  Math.abs((growthLineOverlay?.debugPoints?.[1]?.y ?? 0) - 515.424) < 0.01,
  "increase line bend should be about 30% steeper than the prior post-bend segment",
);
assert.ok(
  (growthLineOverlay?.debugPoints?.[1]?.y - growthLineOverlay?.debugPoints?.[2]?.y) > (growthLineOverlay?.debugPoints?.[0]?.y - growthLineOverlay?.debugPoints?.[1]?.y),
  "increase line should start with a lower slope and become steeper after the bend",
);
assert.ok(!growthFilters.some((filter) => filter.includes("x=724:y=674:w=170:h=4")), "line growth chart should not render the old horizontal line below the value label");

const growthValueOverlayInputs = [];
growthValueOverlayInputs.tempDir = process.cwd();
growthValueOverlayInputs.duration = 6;
const growthValueFilters = await lineGrowthChart(
  { title: "Growth trend", direction: "increase", valueLabel: "+86%" },
  "dark-pastel-watercolor",
  growthValueOverlayInputs,
);
const growthValueOverlay = growthValueOverlayInputs.find((overlay) => overlay.filePath.includes("line-growth-main"));
assert.ok(growthValueFilters.some((filter) => filter.includes("text='Growth trend'")), "line growth chart with a value should still render the title");
assert.equal(growthValueOverlay?.debugValueLabelPresent, true, "line growth chart should render a moving counter when valueLabel is present");
assert.equal(growthValueOverlay?.debugValueLabelTarget, "+86%", "line growth chart should preserve the target value label formatting");
assert.equal(growthValueOverlay?.debugValueLabelFadeInDuration, 1, "line growth chart counter should fade in over 1000ms");
assert.equal(growthValueOverlay?.debugValueLabelFadeInStartsAt, growthValueOverlay?.start + growthValueOverlay?.debugPrimaryLineStartOffset, "line growth chart counter fade should start with the primary line growth");

const growthUnitsOverlayInputs = [];
growthUnitsOverlayInputs.tempDir = process.cwd();
growthUnitsOverlayInputs.duration = 6;
await lineGrowthChart(
  { title: "Growth trend", direction: "increase", valueLabel: "90", units: "homes" },
  "dark-pastel-watercolor",
  growthUnitsOverlayInputs,
);
const growthUnitsOverlay = growthUnitsOverlayInputs.find((overlay) => overlay.filePath.includes("line-growth-main"));
assert.equal(growthUnitsOverlay?.debugValueLabelTarget, "90 homes", "line growth chart should append optional units to the moving counter");

const declineOverlayInputs = [];
declineOverlayInputs.tempDir = process.cwd();
declineOverlayInputs.duration = 6;
const declineFilters = await lineGrowthChart(
  { direction: "decrease" },
  "dark-pastel-watercolor",
  declineOverlayInputs,
);
assert.ok(declineFilters.some((filter) => filter.includes("text='Decline trend'")), "line growth chart should render decrease fallback title");
assert.ok(declineOverlayInputs.some((overlay) => overlay.filePath.includes("line-growth-main")), "decrease line chart should create a growth-line overlay");
const declineLineOverlay = declineOverlayInputs.find((overlay) => overlay.filePath.includes("line-growth-main"));
assert.equal(declineLineOverlay?.growRightDuration, 3, "decrease line chart should draw the arrow over 3 full seconds");
assert.equal(declineLineOverlay?.debugArrowMarkerCount, 1, "decrease line chart should render one clean arrowhead");
assert.equal(declineLineOverlay?.debugLineColor, "#9e816a", "decrease line/arrow color should be opaque while visually matching the old translucent peach");
assert.equal(declineLineOverlay?.debugFinalTip?.x, declineLineOverlay?.debugPoints?.at(-1)?.x, "decrease arrowhead should end at the graph's right edge");
assert.ok((declineLineOverlay?.debugFinalLineEnd?.x ?? 999) < (declineLineOverlay?.debugFinalTip?.x ?? 0), "decrease line should end behind the arrowhead before the tip");
assert.deepEqual(declineLineOverlay?.debugPlotArea, { width: 708, height: 708, isSquare: true }, "decrease line chart plotting area should be a perfect square");
assert.equal(declineLineOverlay?.debugPoints?.at(-1)?.y, 708, "decrease arrowhead should end at the graph's bottom-right corner");
assert.ok(
  Math.abs((declineLineOverlay?.debugPoints?.[1]?.x ?? 0) - declineLineOverlay?.debugPlotArea.width * 0.66) < 0.01,
  "decrease line bend should land 66% of the way through the x-axis",
);

const paperFilters = researchPaperCard(
  { source: "Nature", year: "2025", title: "A useful study", finding: "Small changes compound." },
  "dark-pastel-watercolor",
  [],
);
assert.ok(paperFilters.some((filter) => filter.includes("text='RESEARCH PAPER'")), "research paper card should render a paper label");
assert.ok(paperFilters.some((filter) => filter.includes("text='Nature'")), "research paper card should render the source");

const causeEffectOverlayInputs = [];
causeEffectOverlayInputs.tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "cause-effect-template-test-"));
causeEffectOverlayInputs.duration = 6;
const causeEffectFilters = await causeEffect(
  { cause: "Tiny daily tension", effect: "Neck and jaw read cleaner" },
  "dark-pastel-watercolor",
  causeEffectOverlayInputs,
);
assert.ok(!causeEffectFilters.some((filter) => filter.includes("text='CAUSE'")), "cause/effect should not render the literal Cause label");
assert.ok(!causeEffectFilters.some((filter) => filter.includes("text='EFFECT'")), "cause/effect should not render the literal Effect label");
const causeEffectCards = causeEffectOverlayInputs.filter((overlay) => overlay.debugRoundedTextCard);
assert.equal(causeEffectCards.length, 2, "cause/effect should render one rounded content card for each configured text value");
assert.ok(causeEffectCards.every((overlay) => overlay.debugRoundedTextCardRadius > 0), "cause/effect content cards should use rounded corners");
assert.ok(causeEffectCards.every((overlay) => overlay.debugRoundedTextCardFill === "#ffffff@0.05"), "cause/effect content cards should preserve the requested 5% translucent white background");
assert.ok(causeEffectCards.every((overlay) => overlay.debugRoundedTextCardStroke === "#e8e5dd@0.08"), "cause/effect content cards should use an 8% light border");
assert.ok(causeEffectCards.every((overlay) => overlay.debugRoundedTextCardShadow), "cause/effect content cards should render with a subtle drop shadow");
assert.ok(causeEffectCards.every((overlay) => overlay.debugRoundedTextCardShadowDy <= 12), "cause/effect content card shadow should stay tasteful");
assert.ok(causeEffectCards.every((overlay) => Math.abs(overlay.debugRoundedTextCardCenterX - 540) <= 1), "cause/effect content cards should be centered on the vertical layout axis");
assert.ok(causeEffectCards.every((overlay) => overlay.enterYOffset < 0), "cause/effect content cards should slide down into place on entry");
assert.ok(causeEffectCards.every((overlay) => overlay.debugRoundedTextCardPaddingX === 58), "cause/effect content cards should increase horizontal inner padding by about 33%");
assert.ok(causeEffectCards.every((overlay) => overlay.debugRoundedTextCardPaddingY === 48), "cause/effect content cards should increase vertical inner padding by about 33%");
assert.ok(causeEffectCards.every((overlay) => overlay.debugRoundedTextCardWidth < 888), "cause/effect content cards should hug short content instead of keeping the full old card width");
assert.ok(
  causeEffectCards.every((overlay) => Math.abs(overlay.debugRoundedTextCardWidth - Math.ceil(overlay.debugRoundedTextCardTextWidth + overlay.debugRoundedTextCardPaddingX * 2)) <= 1),
  "cause/effect content card width should equal measured text plus symmetric horizontal padding without an extra right-side offset",
);
assert.ok(
  causeEffectCards.every((overlay) => Math.abs(overlay.debugRoundedTextCardRightPadding - overlay.debugRoundedTextCardLeftPadding) <= 1),
  "cause/effect content card right padding should visually match left padding within rounding tolerance",
);
assert.ok(causeEffectCards.some((overlay) => overlay.debugRoundedTextCardLines.join(" ").includes("Tiny daily tension")), "cause/effect should preserve configurable cause text inside its card");
assert.ok(causeEffectCards.some((overlay) => overlay.debugRoundedTextCardLines.join(" ").includes("Neck and jaw read cleaner")), "cause/effect should preserve configurable effect text inside its card");
assert.ok(causeEffectOverlayInputs.some((overlay) => overlay.filePath.includes("down-arrow-cause-effect")), "cause/effect should keep the deterministic downward arrow reveal");
const causeEffectArrow = causeEffectOverlayInputs.find((overlay) => overlay.debugDownArrow && overlay.filePath.includes("down-arrow-cause-effect"));
assert.ok(causeEffectArrow, "cause/effect should expose the deterministic downward arrow overlay");
assert.equal(causeEffectArrow.debugDownArrowCenterX, 540, "cause/effect arrow should align with the centered card column");
const causeCard = causeEffectCards.find((overlay) => overlay.debugRoundedTextCardLines.join(" ").includes("Tiny daily tension"));
const effectCard = causeEffectCards.find((overlay) => overlay.debugRoundedTextCardLines.join(" ").includes("Neck and jaw read cleaner"));
assert.ok(causeCard && effectCard, "cause/effect should expose both card layouts for alignment checks");
assert.ok(
  Math.abs((causeCard.debugRoundedTextCardY + (effectCard.debugRoundedTextCardY + effectCard.debugRoundedTextCardHeight)) / 2 - 960) <= 1,
  "cause/effect boxes and arrow should be vertically centered as one layout group",
);

const screenshotLikeCauseEffectOverlayInputs = [];
screenshotLikeCauseEffectOverlayInputs.tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "cause-effect-template-screenshot-like-test-"));
screenshotLikeCauseEffectOverlayInputs.duration = 6;
await causeEffect(
  { cause: "Small daily tension", effect: "Jaw and neck read tighter" },
  "dark-pastel-watercolor",
  screenshotLikeCauseEffectOverlayInputs,
);
const screenshotLikeCards = screenshotLikeCauseEffectOverlayInputs.filter((overlay) => overlay.debugRoundedTextCard);
assert.equal(screenshotLikeCards.length, 2, "screenshot-like cause/effect sample should render both rounded cards");
for (const card of screenshotLikeCards) {
  const visualPadding = await measureVisibleRoundedTextCardPadding(card);
  assert.ok(
    Math.abs(visualPadding.left - visualPadding.right) <= 3,
    `cause/effect rendered card visible left/right padding should match; got left=${visualPadding.left}, right=${visualPadding.right}`,
  );
  assert.ok(
    visualPadding.left >= 54 && visualPadding.right >= 54,
    `cause/effect rendered card should preserve the requested generous padding; got left=${visualPadding.left}, right=${visualPadding.right}`,
  );
}

const wrappedCauseEffectOverlayInputs = [];
wrappedCauseEffectOverlayInputs.tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "cause-effect-template-wrapped-test-"));
wrappedCauseEffectOverlayInputs.duration = 6;
await causeEffect(
  {
    cause: "A long chain of daily jaw and neck tension that needs to wrap cleanly",
    effect: "Cleaner posture signal",
  },
  "dark-pastel-watercolor",
  wrappedCauseEffectOverlayInputs,
);
const wrappedCauseCard = wrappedCauseEffectOverlayInputs
  .filter((overlay) => overlay.debugRoundedTextCard)
  .find((overlay) => overlay.debugRoundedTextCardLines.join(" ").includes("daily jaw and neck tension"));
assert.ok(wrappedCauseCard, "cause/effect should render a wrapped long cause card");
assert.ok(wrappedCauseCard.debugRoundedTextCardLines.length > 1, "cause/effect long card text should wrap before clipping");
assert.equal(
  wrappedCauseCard.debugRoundedTextCardHeight,
  wrappedCauseCard.debugRoundedTextCardPaddingY * 2 + 62 + (wrappedCauseCard.debugRoundedTextCardLines.length - 1) * (62 + 20),
  "cause/effect wrapped card height should account for all wrapped lines and padding",
);
assert.ok(
  wrappedCauseCard.debugRoundedTextCardWidth >= wrappedCauseCard.debugRoundedTextCardTextWidth + wrappedCauseCard.debugRoundedTextCardPaddingX * 2,
  "cause/effect wrapped card width should account for wrapped text and padding",
);
assert.ok(
  Math.abs(wrappedCauseCard.debugRoundedTextCardWidth - Math.ceil(wrappedCauseCard.debugRoundedTextCardTextWidth + wrappedCauseCard.debugRoundedTextCardPaddingX * 2)) <= 1,
  "cause/effect wrapped card width should not carry the old one-sided +8px surplus when under the max-width cap",
);

const overlayInputs = [];
overlayInputs.tempDir = process.cwd();
overlayInputs.duration = 5;
const goodIndicatorFilters = await goodBadIndicator(
  { indicatorType: "good", text: "Lift from the lower lid" },
  "dark-pastel-watercolor",
  overlayInputs,
);
assert.ok(!goodIndicatorFilters.some((filter) => filter.includes("text='GOOD'")), "good/bad indicator should not render a Good label");
assert.ok(!goodIndicatorFilters.some((filter) => filter.includes("drawbox=x=124:y=360")), "good/bad indicator should not render an icon background panel");
assert.ok(goodIndicatorFilters.some((filter) => filter.includes("text='Lift from the'")), "good/bad indicator should render its single text field");
assert.ok(overlayInputs.some((overlay) => overlay.filePath.includes("circleCheck")), "Good indicator should use the lucide circle-check SVG overlay");
assert.equal(overlayInputs.find((overlay) => overlay.filePath.includes("circleCheck"))?.height, Math.round(144 * 1.3), "Good indicator icon should be 30% larger than the previous 144px size");

const stopOverlayInputs = [];
stopOverlayInputs.tempDir = process.cwd();
stopOverlayInputs.duration = 5;
const badIndicatorFilters = await goodBadIndicator(
  { indicatorType: "bad", text: "Stop if you feel pressure" },
  "dark-pastel-watercolor",
  stopOverlayInputs,
);
assert.ok(!badIndicatorFilters.some((filter) => filter.includes("text='BAD'")), "good/bad indicator should not render a Bad label");
assert.ok(!badIndicatorFilters.some((filter) => filter.includes("drawbox=x=124:y=360")), "Bad indicator should not render an icon background panel");
assert.ok(stopOverlayInputs.some((overlay) => overlay.filePath.includes("octagonX")), "Bad indicator should use the lucide octagon-x SVG overlay");
assert.equal(stopOverlayInputs.find((overlay) => overlay.filePath.includes("octagonX"))?.height, Math.round(144 * 1.3), "Bad indicator icon should be 30% larger than the previous 144px size");

const legacyOverlayInputs = [];
legacyOverlayInputs.tempDir = process.cwd();
legacyOverlayInputs.duration = 5;
await instruction(
  { instructionType: "don't/stop", text: "Legacy saved config" },
  "dark-pastel-watercolor",
  legacyOverlayInputs,
);
assert.ok(legacyOverlayInputs.some((overlay) => overlay.filePath.includes("octagonX")), "Legacy instruction renderer id and instructionType args should still render the bad indicator");

const doIconPath = overlayInputs.find((overlay) => overlay.filePath.includes("circleCheck"))?.filePath;
const stopIconPath = stopOverlayInputs.find((overlay) => overlay.filePath.includes("octagonX"))?.filePath;
for (const overlay of [...pieOverlayInputs, ...growthOverlayInputs, ...growthValueOverlayInputs, ...declineOverlayInputs]) {
  if (overlay.filePath) fs.rmSync(overlay.filePath, { force: true });
  if (overlay.framesDir) fs.rmSync(overlay.framesDir, { recursive: true, force: true });
}
if (doIconPath) fs.rmSync(doIconPath, { force: true });
if (stopIconPath) fs.rmSync(stopIconPath, { force: true });
for (const overlay of legacyOverlayInputs) {
  if (overlay.filePath) fs.rmSync(overlay.filePath, { force: true });
}
fs.rmSync(checklistOverlayInputs.tempDir, { recursive: true, force: true });
fs.rmSync(causeEffectOverlayInputs.tempDir, { recursive: true, force: true });
fs.rmSync(wrappedCauseEffectOverlayInputs.tempDir, { recursive: true, force: true });

console.log("new motion graphic template tests passed");
