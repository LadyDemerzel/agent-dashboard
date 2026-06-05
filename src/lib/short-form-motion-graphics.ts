import fs from "fs";
import path from "path";
import { formatMotionGraphicAnimationTimingControls } from "@/lib/short-form-motion-graphic-timing-controls";
import { getVersionedShortFormSettingsPath } from "@/lib/short-form-settings-paths";

export const SUPPORTED_MOTION_GRAPHIC_RENDERERS = [
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
] as const;

export type MotionGraphicRendererId = (typeof SUPPORTED_MOTION_GRAPHIC_RENDERERS)[number];
export type MotionGraphicFieldType = "text" | "textarea" | "number" | "stringList" | "timelineSteps" | "dataSeries" | "captionWordWallLines" | "indicatorType";

export interface MotionGraphicTemplateField {
  name: string;
  label: string;
  type: MotionGraphicFieldType;
  required?: boolean;
  description?: string;
  defaultValue?: string | number | string[] | Array<{ label: string; text: string }> | Array<{ label: string; value: number | string; displayValue?: string }> | Array<{ text?: string; size?: "regular" | "large" | "extra_large"; emphasized?: boolean; blank?: boolean }>;
}

export interface MotionGraphicDeterministicSoundCue {
  id: string;
  type: "impact" | "riser" | "click" | "whoosh";
  track?: string;
  offsetSeconds?: number;
  offsetRatio?: number;
  repeat?: {
    source: "data" | "steps" | "items" | "lines";
    firstOffsetSeconds: number;
    stepSeconds: number;
    maxCount: number;
  };
  durationSeconds?: number;
  gainDb?: number;
  fadeInMs?: number;
  fadeOutMs?: number;
  description: string;
  searchQuery: string;
  frequencyBand?: "low" | "mid" | "high" | "full-range";
  layerRole?: string;
  literalness?: "literal" | "stylized" | "emotional-metaphor";
  priority?: "must-have" | "nice-to-have" | "optional";
}

export interface MotionGraphicTemplateConfig {
  id: string;
  rendererId: MotionGraphicRendererId;
  displayName: string;
  description: string;
  whenToUse: string;
  additionalUsageInstructions: string;
  durationSeconds: number;
  durationGuidance: string;
  stylePreset: string;
  defaultArgs: Record<string, unknown>;
  fields: MotionGraphicTemplateField[];
  deterministicSoundEffects?: MotionGraphicDeterministicSoundCue[];
  enabled: boolean;
}

export interface ShortFormMotionGraphicsSettings {
  defaultStylePreset: string;
  templates: MotionGraphicTemplateConfig[];
}

const SETTINGS_PATH = getVersionedShortFormSettingsPath("_motion-graphics-settings.json");
const DEFAULT_STYLE_PRESET = "dark-pastel-watercolor";
const GOOD_BAD_INDICATOR_TEMPLATE_ID = "good-bad-indicator";
const CHECKLIST_TEMPLATE_ID = "checklist";
const REMOVED_TEMPLATE_IDS = new Set(["research_finding_card", "process_flow", "warning_card", "instruction"]);
const LEGACY_RENDERER_ALIASES: Record<string, MotionGraphicRendererId> = {
  instruction: "good_bad_indicator",
  step_checklist: "checklist",
};
const DEFAULT_TEMPLATES: MotionGraphicTemplateConfig[] = [
  {
    id: "stat_reveal",
    rendererId: "stat_reveal",
    displayName: "Stat reveal",
    description: "Large animated number over the unified dark pastel watercolor background with minimal supporting context.",
    whenToUse: "Use for a single memorable statistic, percentage, dollar amount, study result, or surprising quantified claim that should feel premium and focused.",
    additionalUsageInstructions: "",
    durationSeconds: 6,
    durationGuidance: "Usually 4-6 seconds: long enough for the number to reveal, settle, and give the viewer a beat to read the title.",
    stylePreset: DEFAULT_STYLE_PRESET,
    defaultArgs: { value: "73%", title: "people notice the change" },
    fields: [
      { name: "value", label: "Main value", type: "text", required: true, defaultValue: "73%", description: "The large central statistic, number, percentage, or short quantified phrase that should be the visual's main focus." },
      { name: "title", label: "Title", type: "text", required: true, defaultValue: "people notice the change", description: "Short supporting context below the value. Use it to explain what the number means without adding a full sentence." },
    ],
    deterministicSoundEffects: [
      { id: "value-pop", type: "impact", offsetSeconds: 0.72, durationSeconds: 0.32, gainDb: -10, fadeOutMs: 120, description: "Soft accent as the main stat resolves", searchQuery: "premium soft reveal pop impact", frequencyBand: "mid", layerRole: "body", literalness: "stylized", priority: "nice-to-have" },
      { id: "title-tick", type: "click", offsetSeconds: 1.12, durationSeconds: 0.16, gainDb: -12, fadeOutMs: 80, description: "Subtle tick as supporting title text appears", searchQuery: "subtle clean text tick", frequencyBand: "high", layerRole: "tick", literalness: "stylized", priority: "optional" },
    ],
    enabled: true,
  },
  {
    id: "bar_chart",
    rendererId: "bar_chart",
    displayName: "Bar chart",
    description: "Minimal animated bar chart over the unified dark pastel watercolor background with subdued labels and pastel accents.",
    whenToUse: "Use when comparing 2–5 categories, routines, channels, habits, or measured outcomes.",
    additionalUsageInstructions: "",
    durationSeconds: 7,
    durationGuidance: "Around 2 seconds for the setup plus about 1 second per bar, so 3 bars should land around 5 seconds and 5 bars around 7 seconds.",
    stylePreset: DEFAULT_STYLE_PRESET,
    defaultArgs: { title: "What changed most", data: [{ label: "A", value: 35, displayValue: "35" }, { label: "B", value: 68, displayValue: "68" }, { label: "C", value: 92, displayValue: "92" }] },
    fields: [
      { name: "title", label: "Title", type: "text", required: true, defaultValue: "What changed most", description: "Compact chart headline that tells viewers what the bars compare. Keep it short enough to read before the bars animate." },
      { name: "data", label: "Data points", type: "dataSeries", required: true, defaultValue: [{ label: "A", value: 35, displayValue: "35" }, { label: "B", value: 68, displayValue: "68" }], description: "Use 2-5 <item label=\"Category\" value=\"68\" displayValue=\"68%\" /> entries. The numeric value controls bar height; displayValue is the readable label shown with the bar." },
    ],
    deterministicSoundEffects: [
      { id: "bar-reveal", type: "click", repeat: { source: "data", firstOffsetSeconds: 0.36, stepSeconds: 0.7, maxCount: 5 }, durationSeconds: 0.16, gainDb: -11, fadeOutMs: 90, description: "Sparse tick as each bar animates in", searchQuery: "clean data bar tick pop", frequencyBand: "high", layerRole: "tick", literalness: "stylized", priority: "nice-to-have" },
    ],
    enabled: true,
  },
  {
    id: "pie_chart",
    rendererId: "pie_chart",
    displayName: "Pie chart",
    description: "Minimal animated pie chart over the unified dark pastel watercolor background with pastel slices and a compact legend.",
    whenToUse: "Use when showing a part-to-whole split across 2-5 categories, such as shares, proportions, budget/time allocation, or outcome mix.",
    additionalUsageInstructions: "",
    durationSeconds: 7,
    durationGuidance: "Around 2 seconds for setup plus about 0.5 seconds per slice, so 3-5 slices usually lands around 5-7 seconds.",
    stylePreset: DEFAULT_STYLE_PRESET,
    defaultArgs: {
      title: "What changed most",
      data: [
        { label: "A", value: 35, displayValue: "35%" },
        { label: "B", value: 25, displayValue: "25%" },
        { label: "C", value: 40, displayValue: "40%" },
      ],
    },
    fields: [
      { name: "title", label: "Title", type: "text", required: true, defaultValue: "What changed most", description: "Compact chart headline that explains what the slices add up to or compare." },
      {
        name: "data",
        label: "Pie slices",
        type: "dataSeries",
        required: true,
        description: "Use <item label=\"Category\" value=\"35\" displayValue=\"35%\" />. Positive values are normalized into the full pie.",
        defaultValue: [
          { label: "A", value: 35, displayValue: "35%" },
          { label: "B", value: 25, displayValue: "25%" },
          { label: "C", value: 40, displayValue: "40%" },
        ],
      },
    ],
    deterministicSoundEffects: [
      { id: "slice-reveal", type: "click", repeat: { source: "data", firstOffsetSeconds: 0.58, stepSeconds: 0.5, maxCount: 5 }, durationSeconds: 0.16, gainDb: -11, fadeOutMs: 90, description: "Light tick as each pie slice appears", searchQuery: "soft chart slice tick", frequencyBand: "high", layerRole: "tick", literalness: "stylized", priority: "nice-to-have" },
    ],
    enabled: true,
  },
  {
    id: "line_growth_chart",
    rendererId: "line_growth_chart",
    displayName: "Line growth chart",
    description: "Simple Cartesian chart with muted axes and an animated arrow line that grows to the right, either upward for increase or downward for decrease.",
    whenToUse: "Use when one metric improves, grows, declines, worsens, or shrinks over time and the viewer needs a simple directional trend instead of exact chart detail.",
    additionalUsageInstructions: "",
    durationSeconds: 6,
    durationGuidance: "Usually 5-7 seconds: reveal the title and axes first, then let the arrow line grow across the chart for a full 3 seconds and hold the final value.",
    stylePreset: DEFAULT_STYLE_PRESET,
    defaultArgs: {
      title: "Growth trend",
      direction: "increase",
      startLabel: "Start",
      endLabel: "Now",
      valueLabel: "86",
      units: "",
      data: [
        { label: "Start", value: 22, displayValue: "22" },
        { label: "Week 2", value: 48, displayValue: "48" },
        { label: "Now", value: 86, displayValue: "86" },
      ],
    },
    fields: [
      { name: "title", label: "Title", type: "text", required: true, defaultValue: "Growth trend", description: "Short headline for the trend. Name the metric or change the line represents." },
      {
        name: "direction",
        label: "Direction",
        type: "text",
        required: true,
        description: "Exactly one of: increase, decrease. increase animates up/right; decrease animates down/right.",
        defaultValue: "increase",
      },
      { name: "startLabel", label: "Start label", type: "text", defaultValue: "Start", description: "Small label for the left/start side of the chart, such as Before, Week 1, Baseline, or Start." },
      { name: "endLabel", label: "End label", type: "text", defaultValue: "Now", description: "Small label for the right/final side of the chart, such as After, Now, Week 4, or Result." },
      { name: "valueLabel", label: "Final value label", type: "text", required: false, defaultValue: "86", description: "Optional. When present, it counts up from 0 and follows the arrowhead." },
      { name: "units", label: "Counter units", type: "text", required: false, defaultValue: "", description: "Optional unit text appended to the animated value, such as homes, leads, dollars, or clients. Example: valueLabel 90 with units homes renders as 90 homes while counting up." },
      {
        name: "data",
        label: "Trend points",
        type: "dataSeries",
        required: false,
        description: "Optional <item label=\"Week 1\" value=\"22\" displayValue=\"22\" /> points. Use rising values for increase and falling values for decrease.",
        defaultValue: [
          { label: "Start", value: 22, displayValue: "22" },
          { label: "Week 2", value: 48, displayValue: "48" },
          { label: "Now", value: 86, displayValue: "86" },
        ],
      },
    ],
    deterministicSoundEffects: [
      { id: "axes-start", type: "click", offsetSeconds: 0.88, durationSeconds: 0.16, gainDb: -12, fadeOutMs: 80, description: "Quiet tick as the chart frame starts drawing", searchQuery: "subtle graph axis tick", frequencyBand: "high", layerRole: "tick", literalness: "stylized", priority: "optional" },
      { id: "line-finish", type: "impact", offsetSeconds: 3.88, durationSeconds: 0.28, gainDb: -10, fadeOutMs: 130, description: "Soft payoff accent when the trend line reaches its final value", searchQuery: "soft data reveal impact pop", frequencyBand: "mid", layerRole: "punctuation", literalness: "stylized", priority: "nice-to-have" },
    ],
    enabled: true,
  },
  {
    id: "comparison_before_after",
    rendererId: "comparison_before_after",
    displayName: "Before / after comparison",
    description: "Minimal two-column comparison over the unified dark pastel watercolor background with no panels or card boxes.",
    whenToUse: "Use for transformations, posture/routine contrasts, old-vs-new workflow, or mistake-vs-fix moments.",
    additionalUsageInstructions: "",
    durationSeconds: 6,
    durationGuidance: "Usually 5-7 seconds: give the before side time to read first, then reveal the after side with a short pause before the visual ends.",
    stylePreset: DEFAULT_STYLE_PRESET,
    defaultArgs: { beforeLabel: "Before", afterLabel: "After", before: "Tension stacked under the chin", after: "Neck long, jawline reads cleaner" },
    fields: [
      { name: "beforeLabel", label: "Before label", type: "text", defaultValue: "Before", description: "Short label for the left/problem state. Use labels like Before, Old way, Mistake, or Without." },
      { name: "afterLabel", label: "After label", type: "text", defaultValue: "After", description: "Short label for the right/improved state. Use labels like After, New way, Fix, or With." },
      { name: "before", label: "Before copy", type: "textarea", required: true, defaultValue: "Problem state", description: "Concise text describing the initial, weaker, risky, or less desirable state. Keep it parallel with the after copy." },
      { name: "after", label: "After copy", type: "textarea", required: true, defaultValue: "Improved state", description: "Concise text describing the improved, corrected, or more desirable state. Keep it parallel with the before copy." },
    ],
    deterministicSoundEffects: [
      { id: "before-reveal", type: "click", offsetSeconds: 1.08, durationSeconds: 0.16, gainDb: -12, fadeOutMs: 80, description: "Subtle tick as the before side appears", searchQuery: "soft comparison tick", frequencyBand: "high", layerRole: "tick", literalness: "stylized", priority: "optional" },
      { id: "after-reveal", type: "impact", offsetSeconds: 2.9, durationSeconds: 0.28, gainDb: -10, fadeOutMs: 130, description: "Soft accent as the after side lands", searchQuery: "premium before after reveal pop", frequencyBand: "mid", layerRole: "punctuation", literalness: "stylized", priority: "nice-to-have" },
    ],
    enabled: true,
  },
  {
    id: "timeline",
    rendererId: "timeline",
    displayName: "Timeline",
    description: "Minimal stepped timeline over the unified dark pastel watercolor background with smooth equal-segment reveals.",
    whenToUse: "Use for sequence, history, program phases, study timeline, or what happens over the next few seconds/days/weeks.",
    additionalUsageInstructions: "Timeline step labels should all belong to the same semantic category of abstraction. Do not mix label types in one timeline, such as using a date for one step label and a percentage for another step label.",
    durationSeconds: 7,
    durationGuidance: "Around 3 seconds for each step on the timeline, e.g. 4 steps should be around 12 seconds.",
    stylePreset: DEFAULT_STYLE_PRESET,
    defaultArgs: { steps: [{ label: "DAY 1", text: "Setup" }, { label: "DAY 7", text: "Signal" }, { label: "DAY 30", text: "Visible change" }] },
    fields: [
      {
        name: "steps",
        label: "Timeline steps",
        type: "timelineSteps",
        required: true,
        description: "Array of { label, text } objects. Legacy string arrays still work and auto-label as 01, 02, 03.",
        defaultValue: [{ label: "DAY 1", text: "Setup" }, { label: "DAY 7", text: "Signal" }, { label: "DAY 30", text: "Visible change" }],
      },
    ],
    deterministicSoundEffects: [
      { id: "step-activate", type: "click", repeat: { source: "steps", firstOffsetSeconds: 0.64, stepSeconds: 0.66, maxCount: 5 }, durationSeconds: 0.16, gainDb: -11, fadeOutMs: 90, description: "Tick as each timeline step activates", searchQuery: "clean timeline step tick", frequencyBand: "high", layerRole: "tick", literalness: "stylized", priority: "nice-to-have" },
    ],
    enabled: true,
  },
  {
    id: "cause_effect",
    rendererId: "cause_effect",
    displayName: "Cause / effect",
    description: "Center-aligned cause-to-effect relationship with rounded translucent content cards, subtle shadows, and a deterministic downward arrow reveal over the unified dark pastel watercolor background.",
    whenToUse: "Use when explaining mechanisms, causal relationships, inputs that drive outcomes, or why one action creates a visible result.",
    additionalUsageInstructions: "",
    durationSeconds: 6,
    durationGuidance: "Usually 5-7 seconds: give the cause a readable beat, then reveal the arrow and effect with enough time for the effect copy to land.",
    stylePreset: DEFAULT_STYLE_PRESET,
    defaultArgs: { cause: "Small daily tension", effect: "Jaw and neck read tighter" },
    fields: [
      { name: "cause", label: "Cause", type: "textarea", required: true, defaultValue: "Small daily tension", description: "The input, habit, condition, or mechanism that starts the causal chain. Keep it short and concrete." },
      { name: "effect", label: "Effect", type: "textarea", required: true, defaultValue: "Jaw and neck read tighter", description: "The outcome or visible consequence produced by the cause. Phrase it as the result viewers should remember." },
    ],
    deterministicSoundEffects: [
      { id: "cause-card", type: "click", offsetSeconds: 0.5, durationSeconds: 0.16, gainDb: -12, fadeOutMs: 80, description: "Light tick as the cause card enters", searchQuery: "soft card enter tick", frequencyBand: "high", layerRole: "tick", literalness: "stylized", priority: "optional" },
      { id: "arrow-whoosh", type: "whoosh", offsetSeconds: 1.12, durationSeconds: 0.5, gainDb: -12, fadeInMs: 20, fadeOutMs: 180, description: "Soft downward motion accent as the arrow grows", searchQuery: "soft short arrow whoosh", frequencyBand: "mid", layerRole: "motion", literalness: "stylized", priority: "nice-to-have" },
      { id: "effect-card", type: "impact", offsetSeconds: 1.86, durationSeconds: 0.26, gainDb: -10, fadeOutMs: 120, description: "Soft impact as the effect card lands", searchQuery: "soft card landing impact", frequencyBand: "mid", layerRole: "punctuation", literalness: "stylized", priority: "nice-to-have" },
    ],
    enabled: true,
  },
  {
    id: "caption_word_wall",
    rendererId: "caption_word_wall",
    displayName: "Caption word wall",
    description: "Full-screen caption wall that replaces both the normal scene visual and bottom captions, using forced-alignment word timing with stat-reveal-style typography and an active-word pop.",
    whenToUse: "Use for retention-heavy moments where the spoken words should take over the full frame as a kinetic caption wall instead of sitting over a generated image.",
    additionalUsageInstructions: "",
    durationSeconds: 6,
    durationGuidance: "Match the exact spoken narration range for the caption wall. The start/end times should cover only the words represented by the configured lines.",
    stylePreset: DEFAULT_STYLE_PRESET,
    defaultArgs: {
      lines: [
        { text: "most people miss this part" },
        { text: "the words become the visual", size: "large" },
        { text: "with one extra large row", size: "extra_large" },
        { blank: true },
        { text: "and every highlight follows the voice" },
      ],
    },
    fields: [
      {
        name: "lines",
        label: "Caption lines",
        type: "captionWordWallLines",
        required: true,
        description: "Ordered caption wall lines. Use blank entries for intentional empty spacer lines. Set size=\"regular\", size=\"large\", or size=\"extra_large\" per whole line.",
        defaultValue: [
          { text: "most people miss this part" },
          { text: "the words become the visual", size: "large" },
          { text: "with one extra large row", size: "extra_large" },
          { blank: true },
          { text: "and every highlight follows the voice" },
        ],
      },
    ],
    deterministicSoundEffects: [
      { id: "line-appear", type: "click", repeat: { source: "lines", firstOffsetSeconds: 0.35, stepSeconds: 0.5, maxCount: 4 }, durationSeconds: 0.12, gainDb: -13, fadeOutMs: 70, description: "Very subtle tick as caption-wall lines become visible", searchQuery: "minimal kinetic typography tick", frequencyBand: "high", layerRole: "tick", literalness: "stylized", priority: "optional" },
    ],
    enabled: true,
  },
  {
    id: "ranked_podium",
    rendererId: "ranked_podium",
    displayName: "Ranked list / podium",
    description: "Animated ranking with oversized rank numbers and podium-like rows over the unified dark pastel watercolor background.",
    whenToUse: "Use for top-3/top-5 lists, ranked mistakes, priorities, symptoms, channels, exercises, or results where ranking order matters.",
    additionalUsageInstructions: "",
    durationSeconds: 7,
    durationGuidance: "Around 1 second per ranking. For multi-visual sequences, set startIndex to the first rank that should animate in this visual.",
    stylePreset: DEFAULT_STYLE_PRESET,
    defaultArgs: {
      items: [
        { label: "01", text: "Most visible change" },
        { label: "02", text: "Faster feedback" },
        { label: "03", text: "Cleaner routine" },
      ],
      startIndex: 1,
      futureItemsMode: "hidden",
    },
    fields: [
      {
        name: "items",
        label: "Ranked items",
        type: "timelineSteps",
        required: true,
        description: "Use ordered <step> entries. Labels are rank markers and auto-label as 01, 02, 03 when omitted.",
        defaultValue: [
          { label: "01", text: "Most visible change" },
          { label: "02", text: "Faster feedback" },
          { label: "03", text: "Cleaner routine" },
        ],
      },
      {
        name: "startIndex",
        label: "Start rank",
        type: "number",
        defaultValue: 1,
        description: "1-based rank to animate first. Earlier ranks render already present at time 0 for split multi-visual sequences.",
      },
      {
        name: "futureItemsMode",
        label: "Future rank state",
        type: "text",
        defaultValue: "hidden",
        description: "hidden hides unrevealed future ranks; blurred shows muted ghost rows before they animate/unblur.",
      },
    ],
    deterministicSoundEffects: [
      { id: "rank-reveal", type: "click", repeat: { source: "items", firstOffsetSeconds: 0.42, stepSeconds: 0.78, maxCount: 5 }, durationSeconds: 0.16, gainDb: -11, fadeOutMs: 90, description: "Tick as each ranked row animates in", searchQuery: "clean ranked list tick", frequencyBand: "high", layerRole: "tick", literalness: "stylized", priority: "nice-to-have" },
    ],
    enabled: true,
  },
  {
    id: CHECKLIST_TEMPLATE_ID,
    rendererId: "checklist",
    displayName: "Checklist",
    description: "Animated checklist with deterministic check marks, concise item copy, and optional future-item ghosting.",
    whenToUse: "Use for routines, protocols, decision checklists, action lists, and ordered items that should feel complete as they appear.",
    additionalUsageInstructions: "",
    durationSeconds: 7,
    durationGuidance: "Around 1 second per checklist item. For multi-visual sequences, set startIndex to the first item that should animate in this visual.",
    stylePreset: DEFAULT_STYLE_PRESET,
    defaultArgs: {
      items: [
        { text: "Set the baseline" },
        { text: "Make the small adjustment" },
        { text: "Repeat it daily" },
      ],
      startIndex: 1,
      futureItemsMode: "hidden",
    },
    fields: [
      {
        name: "items",
        label: "Checklist items",
        type: "timelineSteps",
        required: true,
        description: "Use ordered <step>copy</step> entries. Labels are ignored by this template.",
        defaultValue: [
          { text: "Set the baseline" },
          { text: "Make the small adjustment" },
          { text: "Repeat it daily" },
        ],
      },
      {
        name: "startIndex",
        label: "Start item",
        type: "number",
        defaultValue: 1,
        description: "1-based item to animate first. Earlier items render already checked at time 0 for split multi-visual sequences.",
      },
      {
        name: "futureItemsMode",
        label: "Future item state",
        type: "text",
        defaultValue: "hidden",
        description: "hidden hides unchecked future items; blurred shows muted unchecked rows before they animate/check.",
      },
    ],
    deterministicSoundEffects: [
      { id: "check-activate", type: "click", repeat: { source: "items", firstOffsetSeconds: 0.44, stepSeconds: 0.78, maxCount: 6 }, durationSeconds: 0.16, gainDb: -11, fadeOutMs: 90, description: "Tick as each checklist item checks in", searchQuery: "soft checklist tick check", frequencyBand: "high", layerRole: "tick", literalness: "stylized", priority: "nice-to-have" },
    ],
    enabled: true,
  },
  {
    id: "scorecard",
    rendererId: "scorecard",
    displayName: "Scorecard",
    description: "Animated metric scorecard with rows, values, and compact progress bars.",
    whenToUse: "Use for grading a routine, comparing criteria, assessing risk, showing before/after subscores, or summarizing an evaluation.",
    additionalUsageInstructions: "",
    durationSeconds: 6,
    durationGuidance: "Usually 5-7 seconds for 3-5 metrics with a short title reveal and one row reveal per beat.",
    stylePreset: DEFAULT_STYLE_PRESET,
    defaultArgs: {
      title: "Scorecard",
      data: [
        { label: "Clarity", value: 82, displayValue: "82" },
        { label: "Consistency", value: 68, displayValue: "68" },
        { label: "Effort", value: 91, displayValue: "91" },
      ],
    },
    fields: [
      { name: "title", label: "Title", type: "text", required: true, defaultValue: "Scorecard", description: "Short title naming what is being scored or compared across the rows." },
      {
        name: "data",
        label: "Score rows",
        type: "dataSeries",
        required: true,
        description: "Use <item label=\"Metric\" value=\"82\" displayValue=\"82/100\" />. Values are normalized against the largest row.",
        defaultValue: [
          { label: "Clarity", value: 82, displayValue: "82" },
          { label: "Consistency", value: 68, displayValue: "68" },
          { label: "Effort", value: 91, displayValue: "91" },
        ],
      },
    ],
    deterministicSoundEffects: [
      { id: "row-reveal", type: "click", repeat: { source: "data", firstOffsetSeconds: 0.82, stepSeconds: 0.7, maxCount: 5 }, durationSeconds: 0.16, gainDb: -11, fadeOutMs: 90, description: "Tick as each scorecard row and bar appears", searchQuery: "clean scorecard row tick", frequencyBand: "high", layerRole: "tick", literalness: "stylized", priority: "nice-to-have" },
    ],
    enabled: true,
  },
  {
    id: "research_paper_card",
    rendererId: "research_paper_card",
    displayName: "Research paper card",
    description: "Animated study-card visual with source, paper title, and one plain-English finding.",
    whenToUse: "Use when citing a study, paper, review, clinical trial, author group, journal, or named research result.",
    additionalUsageInstructions: "",
    durationSeconds: 6,
    durationGuidance: "Usually 5-7 seconds: reveal the paper/source first, then the finding.",
    stylePreset: DEFAULT_STYLE_PRESET,
    defaultArgs: {
      source: "Journal of Applied Research",
      year: "2024",
      title: "Daily posture cues changed perceived jawline definition",
      finding: "The visible difference came from consistency, not intensity.",
    },
    fields: [
      { name: "source", label: "Source / journal", type: "text", defaultValue: "Journal of Applied Research", description: "Short journal, institution, author group, or credible source name shown at the top of the paper card." },
      { name: "year", label: "Year", type: "text", defaultValue: "2024", description: "Short year or date cue for the study/source. Leave concise so it reads like a citation detail." },
      { name: "title", label: "Paper title", type: "textarea", required: true, defaultValue: "Daily posture cues changed perceived jawline definition", description: "Compressed paper or study title. Keep it credible and short enough to fit as a formal title block." },
      { name: "finding", label: "Finding", type: "textarea", required: true, defaultValue: "The visible difference came from consistency, not intensity.", description: "One plain-English takeaway from the source. Prefer a single concise finding over an abstract-style summary." },
    ],
    deterministicSoundEffects: [
      { id: "paper-enter", type: "whoosh", offsetSeconds: 0.28, durationSeconds: 0.38, gainDb: -12, fadeInMs: 20, fadeOutMs: 140, description: "Soft paper-card entrance motion accent", searchQuery: "soft paper card whoosh", frequencyBand: "mid", layerRole: "motion", literalness: "stylized", priority: "nice-to-have" },
      { id: "finding-highlight", type: "impact", offsetSeconds: 1.5, durationSeconds: 0.26, gainDb: -10, fadeOutMs: 130, description: "Subtle accent as the key finding block appears", searchQuery: "premium paper finding reveal pop", frequencyBand: "mid", layerRole: "punctuation", literalness: "stylized", priority: "nice-to-have" },
    ],
    enabled: true,
  },
  {
    id: GOOD_BAD_INDICATOR_TEMPLATE_ID,
    rendererId: "good_bad_indicator",
    displayName: "Good/Bad Indicator",
    description: "Minimal good/bad indicator card with one indicator type and one short supporting line. Good uses a green accent; bad uses a red accent.",
    whenToUse: "Use to highlight that something is good or bad, such as a helpful habit, risky behavior, recommended choice, mistake, or warning moment.",
    additionalUsageInstructions: "",
    durationSeconds: 5,
    durationGuidance: "Usually 4-6 seconds: reveal the good/bad icon, underline, and short readable line together, then hold.",
    stylePreset: DEFAULT_STYLE_PRESET,
    defaultArgs: {
      indicatorType: "good",
      text: "Lift from the lower lid",
    },
    fields: [
      {
        name: "indicatorType",
        label: "Indicator type",
        type: "indicatorType",
        required: true,
        description: "Exactly one of: good, bad. Use good for positive/recommended items; use bad for negative/risky items.",
        defaultValue: "good",
      },
      { name: "text", label: "Indicator text", type: "textarea", required: true, defaultValue: "Lift from the lower lid", description: "Short rule, habit, mistake, warning, or recommendation that the good/bad indicator should emphasize." },
    ],
    deterministicSoundEffects: [
      { id: "icon-enter", type: "click", offsetSeconds: 0.78, durationSeconds: 0.16, gainDb: -11, fadeOutMs: 90, description: "Tick as the good/bad icon appears with the indicator text", searchQuery: "soft icon tick", frequencyBand: "high", layerRole: "tick", literalness: "stylized", priority: "nice-to-have" },
      { id: "rule-confirm", type: "impact", offsetSeconds: 0.78, durationSeconds: 0.24, gainDb: -11, fadeOutMs: 120, description: "Soft confirmation accent as the rule underline resolves with the indicator text", searchQuery: "soft confirmation impact", frequencyBand: "mid", layerRole: "punctuation", literalness: "stylized", priority: "optional" },
    ],
    enabled: true,
  },
];

function ensureSettingsDir() {
  fs.mkdirSync(path.dirname(SETTINGS_PATH), { recursive: true });
}

function isRendererId(value: unknown): value is MotionGraphicRendererId {
  return typeof value === "string" && (SUPPORTED_MOTION_GRAPHIC_RENDERERS as readonly string[]).includes(value);
}

function resolveRendererId(value: unknown, fallback: MotionGraphicRendererId) {
  if (typeof value === "string" && value in LEGACY_RENDERER_ALIASES) return LEGACY_RENDERER_ALIASES[value];
  return isRendererId(value) ? value : fallback;
}

function isLegacyRendererAlias(value: unknown) {
  return typeof value === "string" && value in LEGACY_RENDERER_ALIASES;
}

function cleanString(value: unknown, fallback: string) {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function cleanOptionalString(value: unknown, fallback = "") {
  return typeof value === "string" ? value.trim() : fallback;
}

function autoTimelineStepLabel(index: number) {
  return String(index + 1).padStart(2, "0");
}

function normalizeTimelineStep(value: unknown, index: number) {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const candidate = value as { label?: unknown; leftLabel?: unknown; marker?: unknown; text?: unknown; copy?: unknown; title?: unknown; step?: unknown; value?: unknown };
    const text = cleanString(candidate.text ?? candidate.copy ?? candidate.title ?? candidate.step ?? candidate.value, "");
    if (!text) return null;
    return {
      label: cleanString(candidate.label ?? candidate.leftLabel ?? candidate.marker, autoTimelineStepLabel(index)),
      text,
    };
  }
  const text = cleanString(value, "");
  return text ? { label: autoTimelineStepLabel(index), text } : null;
}

function normalizeTimelineSteps(value: unknown) {
  return Array.isArray(value)
    ? value.map((step, index) => normalizeTimelineStep(step, index)).filter((step): step is { label: string; text: string } => Boolean(step))
    : [];
}

function normalizeChecklistItems(value: unknown) {
  return normalizeTimelineSteps(value).map((item) => ({ text: item.text }));
}

function normalizeCaptionWordWallLineSize(value: unknown, candidate: { emphasized?: unknown; emphasis?: unknown } = {}) {
  const raw = String(value || "").trim().toLowerCase().replace(/[\s-]+/g, "_");
  if (raw === "regular" || raw === "normal" || raw === "base") return "regular" as const;
  if (raw === "large" || raw === "big") return "large" as const;
  if (raw === "extra_large" || raw === "extralarge" || raw === "extra" || raw === "xl" || raw === "xlarge") return "extra_large" as const;
  return candidate.emphasized === true || candidate.emphasis === true || String(candidate.emphasized || candidate.emphasis).toLowerCase() === "true" ? "extra_large" as const : "regular" as const;
}

function normalizeCaptionWordWallLines(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value
    .map((line) => {
      if (line && typeof line === "object" && !Array.isArray(line)) {
        const candidate = line as { text?: unknown; caption?: unknown; words?: unknown; size?: unknown; lineSize?: unknown; emphasized?: unknown; emphasis?: unknown; blank?: unknown };
        const blank = candidate.blank === true || String(candidate.text ?? candidate.caption ?? candidate.words ?? "").trim() === "";
        const size = normalizeCaptionWordWallLineSize(candidate.size ?? candidate.lineSize, candidate);
        return {
          ...(blank ? { blank: true } : { text: cleanString(candidate.text ?? candidate.caption ?? candidate.words, "") }),
          ...(!blank ? { size } : {}),
        };
      }
      const text = cleanString(line, "");
      return text ? { text } : { blank: true };
    })
    .filter((line) => ("blank" in line && line.blank) || ("text" in line && Boolean(line.text)));
}

function normalizeIndicatorType(value: unknown) {
  const raw = String(value || "").trim().toLowerCase().replace(/[’']/g, "").replace(/[\s/-]+/g, "_");
  if (raw === "bad" || raw === "negative" || raw === "dont" || raw === "dont_stop" || raw === "do_not" || raw === "stop" || raw === "no") return "bad";
  return "good";
}

function normalizeChartDirection(value: unknown) {
  const raw = String(value || "").trim().toLowerCase().replace(/[\s-]+/g, "_");
  if (raw === "decrease" || raw === "decreasing" || raw === "down" || raw === "decline" || raw === "worse" || raw === "worsening" || raw === "shrink" || raw === "shrinking") return "decrease";
  return "increase";
}

function normalizeTimelineDefaultArgs(args: Record<string, unknown>) {
  const steps = normalizeTimelineSteps(args.steps);
  return steps.length > 0 ? { ...args, steps } : args;
}

function normalizeChecklistDefaultArgs(args: Record<string, unknown>, fallback: Record<string, unknown>) {
  const items = normalizeChecklistItems(args.items).length > 0
    ? normalizeChecklistItems(args.items)
    : normalizeChecklistItems(args.steps).length > 0
      ? normalizeChecklistItems(args.steps)
      : normalizeChecklistItems(fallback.items);
  const rest = { ...args };
  delete rest.steps;
  const startStep = rest.startStep;
  const animateFromStep = rest.animateFromStep;
  delete rest.startStep;
  delete rest.animateFromStep;
  return {
    ...rest,
    items,
    startIndex: rest.startIndex ?? startStep ?? animateFromStep ?? fallback.startIndex ?? 1,
    futureItemsMode: cleanString(rest.futureItemsMode, cleanString(fallback.futureItemsMode, "hidden")),
  };
}

function normalizeField(value: unknown, fallback: MotionGraphicTemplateField): MotionGraphicTemplateField {
  const candidate = value && typeof value === "object" && !Array.isArray(value) ? value as Partial<MotionGraphicTemplateField> : {};
  const rawCandidateType = typeof candidate.type === "string" ? String(candidate.type) : undefined;
  const candidateType = rawCandidateType === "instructionType" ? "indicatorType" : rawCandidateType;
  const type = ["text", "textarea", "number", "stringList", "timelineSteps", "dataSeries", "captionWordWallLines", "indicatorType"].includes(String(candidateType))
    ? candidateType as MotionGraphicFieldType
    : fallback.type;
  return {
    name: cleanString(candidate.name, fallback.name),
    label: cleanString(candidate.label, fallback.label),
    type,
    required: Boolean(candidate.required ?? fallback.required),
    description: cleanString(candidate.description, fallback.description || ""),
    defaultValue: candidate.defaultValue ?? fallback.defaultValue,
  };
}

function normalizeDeterministicSoundCue(value: unknown, fallback?: MotionGraphicDeterministicSoundCue): MotionGraphicDeterministicSoundCue | null {
  const candidate = value && typeof value === "object" && !Array.isArray(value) ? value as Partial<MotionGraphicDeterministicSoundCue> : {};
  const id = cleanString(candidate.id, fallback?.id || "");
  const type = candidate.type === "impact" || candidate.type === "riser" || candidate.type === "click" || candidate.type === "whoosh"
    ? candidate.type
    : fallback?.type;
  if (!id || !type) return null;
  const repeatCandidate = candidate.repeat && typeof candidate.repeat === "object" && !Array.isArray(candidate.repeat)
    ? candidate.repeat as Partial<NonNullable<MotionGraphicDeterministicSoundCue["repeat"]>>
    : undefined;
  const repeatFallback = fallback?.repeat;
  const repeatSource = repeatCandidate?.source === "data" || repeatCandidate?.source === "steps" || repeatCandidate?.source === "items" || repeatCandidate?.source === "lines"
    ? repeatCandidate.source
    : repeatFallback?.source;
  const repeat = repeatSource
    ? {
        source: repeatSource,
        firstOffsetSeconds: typeof repeatCandidate?.firstOffsetSeconds === "number" && Number.isFinite(repeatCandidate.firstOffsetSeconds)
          ? Math.max(0, Math.min(10, repeatCandidate.firstOffsetSeconds))
          : repeatFallback?.firstOffsetSeconds ?? 0,
        stepSeconds: typeof repeatCandidate?.stepSeconds === "number" && Number.isFinite(repeatCandidate.stepSeconds)
          ? Math.max(0.05, Math.min(5, repeatCandidate.stepSeconds))
          : repeatFallback?.stepSeconds ?? 0.5,
        maxCount: typeof repeatCandidate?.maxCount === "number" && Number.isFinite(repeatCandidate.maxCount)
          ? Math.max(1, Math.min(12, Math.round(repeatCandidate.maxCount)))
          : repeatFallback?.maxCount ?? 4,
      }
    : undefined;
  return {
    id,
    type,
    track: cleanString(candidate.track, fallback?.track || "motion-graphics"),
    offsetSeconds: typeof candidate.offsetSeconds === "number" && Number.isFinite(candidate.offsetSeconds)
      ? Math.max(0, Math.min(10, candidate.offsetSeconds))
      : fallback?.offsetSeconds,
    offsetRatio: typeof candidate.offsetRatio === "number" && Number.isFinite(candidate.offsetRatio)
      ? Math.max(0, Math.min(1, candidate.offsetRatio))
      : fallback?.offsetRatio,
    ...(repeat ? { repeat } : {}),
    durationSeconds: typeof candidate.durationSeconds === "number" && Number.isFinite(candidate.durationSeconds)
      ? Math.max(0.04, Math.min(3, candidate.durationSeconds))
      : fallback?.durationSeconds,
    gainDb: typeof candidate.gainDb === "number" && Number.isFinite(candidate.gainDb)
      ? Math.max(-36, Math.min(12, candidate.gainDb))
      : fallback?.gainDb,
    fadeInMs: typeof candidate.fadeInMs === "number" && Number.isFinite(candidate.fadeInMs)
      ? Math.max(0, Math.min(10_000, Math.round(candidate.fadeInMs)))
      : fallback?.fadeInMs,
    fadeOutMs: typeof candidate.fadeOutMs === "number" && Number.isFinite(candidate.fadeOutMs)
      ? Math.max(0, Math.min(10_000, Math.round(candidate.fadeOutMs)))
      : fallback?.fadeOutMs,
    description: cleanString(candidate.description, fallback?.description || "Deterministic motion graphic sound cue"),
    searchQuery: cleanString(candidate.searchQuery, fallback?.searchQuery || "subtle motion graphic tick"),
    frequencyBand: candidate.frequencyBand === "low" || candidate.frequencyBand === "mid" || candidate.frequencyBand === "high" || candidate.frequencyBand === "full-range"
      ? candidate.frequencyBand
      : fallback?.frequencyBand,
    layerRole: cleanString(candidate.layerRole, fallback?.layerRole || ""),
    literalness: candidate.literalness === "literal" || candidate.literalness === "stylized" || candidate.literalness === "emotional-metaphor"
      ? candidate.literalness
      : fallback?.literalness,
    priority: candidate.priority === "must-have" || candidate.priority === "nice-to-have" || candidate.priority === "optional"
      ? candidate.priority
      : fallback?.priority,
  };
}

function normalizeDeterministicSoundCues(value: unknown, fallback: MotionGraphicDeterministicSoundCue[] = []) {
  const candidate = Array.isArray(value) ? value : [];
  const source = candidate.length > 0 ? candidate : fallback;
  return source
    .map((cue, index) => normalizeDeterministicSoundCue(cue, fallback[index]))
    .filter((cue): cue is MotionGraphicDeterministicSoundCue => Boolean(cue));
}

function normalizeTemplate(value: unknown, fallback: MotionGraphicTemplateConfig, index: number): MotionGraphicTemplateConfig {
  const candidate = value && typeof value === "object" && !Array.isArray(value) ? value as Partial<MotionGraphicTemplateConfig> : {};
  const hasUnsupportedRenderer = typeof candidate.rendererId === "string" && !isRendererId(candidate.rendererId) && !isLegacyRendererAlias(candidate.rendererId);
  const rendererId = resolveRendererId(candidate.rendererId, fallback.rendererId);
  const fields = !hasUnsupportedRenderer && Array.isArray(candidate.fields) && candidate.fields.length > 0
    ? candidate.fields.map((field, fieldIndex) => normalizeField(field, fallback.fields[fieldIndex] || fallback.fields[0]))
    : fallback.fields;
  const rawDefaultArgs = !hasUnsupportedRenderer && candidate.defaultArgs && typeof candidate.defaultArgs === "object" && !Array.isArray(candidate.defaultArgs)
    ? candidate.defaultArgs as Record<string, unknown>
    : fallback.defaultArgs;
  const defaultArgs = Object.fromEntries(
    Object.entries(rawDefaultArgs).filter(([key]) => {
      if (rendererId === "stat_reveal") return key !== "eyebrow" && key !== "note";
      if (rendererId === "bar_chart" || rendererId === "pie_chart" || rendererId === "line_growth_chart") return key !== "subtitle";
      if (rendererId === "timeline") return key !== "title";
      if (rendererId === "comparison_before_after") return key !== "title";
      if (rendererId === "good_bad_indicator") return key === "indicatorType" || key === "instructionType" || key === "text";
      return true;
    }),
  );
  const normalizedDefaultArgs = rendererId === "timeline"
    ? normalizeTimelineDefaultArgs(defaultArgs)
    : rendererId === "checklist"
      ? normalizeChecklistDefaultArgs(defaultArgs, fallback.defaultArgs)
    : rendererId === "caption_word_wall" && normalizeCaptionWordWallLines(defaultArgs.lines).length > 0
      ? { ...defaultArgs, lines: normalizeCaptionWordWallLines(defaultArgs.lines) }
      : rendererId === "good_bad_indicator"
        ? { indicatorType: normalizeIndicatorType(defaultArgs.indicatorType ?? defaultArgs.instructionType), text: cleanString(defaultArgs.text, cleanString((defaultArgs as { title?: unknown; body?: unknown }).title ?? (defaultArgs as { body?: unknown }).body, "Lift from the lower lid")) }
        : rendererId === "line_growth_chart"
          ? { ...defaultArgs, direction: normalizeChartDirection(defaultArgs.direction), units: cleanString(defaultArgs.units, cleanString(fallback.defaultArgs.units, "")) }
      : defaultArgs;
  const normalizedFields = (() => {
    if (rendererId === "stat_reveal") {
      const statRevealFields = fields.filter((field) => field.name !== "eyebrow" && field.name !== "note");
      const fallbackStatRevealFields = fallback.fields.filter((field) => field.name !== "eyebrow" && field.name !== "note");
      return statRevealFields.length > 0 ? statRevealFields : fallbackStatRevealFields;
    }
    if (rendererId === "bar_chart" || rendererId === "pie_chart") {
      const barChartFields = fields.filter((field) => field.name !== "subtitle");
      const fallbackBarChartFields = fallback.fields.filter((field) => field.name !== "subtitle");
      return barChartFields.length > 0 ? barChartFields : fallbackBarChartFields;
    }
    if (rendererId === "line_growth_chart") {
      const lineFields = fields.filter((field) => field.name !== "subtitle");
      const fallbackLineFields = fallback.fields.filter((field) => field.name !== "subtitle");
      const fallbackFieldNames = new Set(fallbackLineFields.map((field) => field.name));
      const selectedFields = lineFields.length > 0
        ? [
            ...fallbackLineFields.map((fallbackField) =>
              lineFields.find((field) => field.name === fallbackField.name) || fallbackField,
            ),
            ...lineFields.filter((field) => !fallbackFieldNames.has(field.name)),
          ]
        : fallbackLineFields;
      return selectedFields.map((field) => field.name === "direction"
        ? {
            ...field,
            required: true,
            description: "Exactly one of: increase, decrease. increase animates up/right; decrease animates down/right.",
            defaultValue: normalizeChartDirection(field.defaultValue),
          }
        : field.name === "valueLabel"
          ? {
              ...field,
              description: field.description || "Optional final numeric value. When present, it counts up from 0 and follows the arrowhead.",
            }
        : field.name === "units"
          ? {
              ...field,
              type: "text" as const,
              required: false,
              description: field.description || "Optional unit text appended to the animated value, such as homes, leads, dollars, or clients. Example: valueLabel 90 with units homes renders as 90 homes while counting up.",
              defaultValue: cleanString(field.defaultValue, ""),
            }
        : field);
    }
    if (rendererId === "timeline") {
      const timelineFields = fields.filter((field) => field.name !== "title");
      const fallbackTimelineFields = fallback.fields.filter((field) => field.name !== "title");
      const selectedFields = timelineFields.length > 0 ? timelineFields : fallbackTimelineFields;
      return selectedFields.map((field) => {
        if (field.name !== "steps") return field;
        const defaultValue = normalizeTimelineSteps(field.defaultValue);
        return {
          ...field,
          type: "timelineSteps" as const,
          description: field.description || "Array of { label, text } objects. Legacy string arrays still work and auto-label as 01, 02, 03.",
          defaultValue: defaultValue.length > 0 ? defaultValue : field.defaultValue,
        };
      });
    }
    if (rendererId === "checklist") {
      const fallbackByName = new Map(fallback.fields.map((field) => [field.name, field]));
      const legacyItemsField = fields.find((field) => field.name === "items" || field.name === "steps");
      const startIndexField = fields.find((field) => field.name === "startIndex" || field.name === "startStep" || field.name === "animateFromStep");
      const futureItemsField = fields.find((field) => field.name === "futureItemsMode");
      return [
        {
          ...(legacyItemsField || fallbackByName.get("items")),
          name: "items",
          label: "Checklist items",
          type: "timelineSteps" as const,
          required: true,
          description: "Use ordered <step>copy</step> entries. Labels are ignored by this template.",
          defaultValue: normalizeChecklistItems(legacyItemsField?.defaultValue).length > 0
            ? normalizeChecklistItems(legacyItemsField?.defaultValue)
            : fallbackByName.get("items")?.defaultValue,
        },
        {
          ...(startIndexField || fallbackByName.get("startIndex")),
          name: "startIndex",
          label: "Start item",
          type: "number" as const,
          description: "1-based item to animate first. Earlier items render already checked at time 0 for split multi-visual sequences.",
          defaultValue: startIndexField?.defaultValue ?? fallbackByName.get("startIndex")?.defaultValue ?? 1,
        },
        {
          ...(futureItemsField || fallbackByName.get("futureItemsMode")),
          name: "futureItemsMode",
          label: "Future item state",
          type: "text" as const,
          description: "hidden hides unchecked future items; blurred shows muted unchecked rows before they animate/check.",
          defaultValue: cleanString(futureItemsField?.defaultValue, cleanString(fallbackByName.get("futureItemsMode")?.defaultValue, "hidden")),
        },
      ];
    }
    if (rendererId === "comparison_before_after") {
      const comparisonFields = fields.filter((field) => field.name !== "title");
      const fallbackComparisonFields = fallback.fields.filter((field) => field.name !== "title");
      return comparisonFields.length > 0 ? comparisonFields : fallbackComparisonFields;
    }
    if (rendererId === "caption_word_wall") {
      const wordWallFields = fields.filter((field) => field.name === "lines");
      const fallbackWordWallFields = fallback.fields.filter((field) => field.name === "lines");
      const selectedFields = wordWallFields.length > 0 ? wordWallFields : fallbackWordWallFields;
      return selectedFields.map((field) => ({
        ...field,
        type: "captionWordWallLines" as const,
        description: "Ordered line objects: { text, size?: \"regular\" | \"large\" | \"extra_large\" } or { blank: true }. Size is whole-line only; do not size individual inline words. Legacy emphasized=true maps to size=\"extra_large\".",
        defaultValue: normalizeCaptionWordWallLines(field.defaultValue).length > 0
          ? normalizeCaptionWordWallLines(field.defaultValue)
          : field.defaultValue,
      }));
    }
    if (rendererId === "good_bad_indicator") {
      const selectedFields = fields.filter((field) => field.name === "indicatorType" || field.name === "instructionType" || field.name === "text");
      const builtInIndicatorFields = DEFAULT_TEMPLATES.find((template) => template.id === GOOD_BAD_INDICATOR_TEMPLATE_ID)?.fields || [];
      const fallbackIndicatorFields = fallback.fields.filter((field) => field.name === "indicatorType" || field.name === "instructionType" || field.name === "text");
      const baseFields = fallbackIndicatorFields.length > 0 ? fallbackIndicatorFields : builtInIndicatorFields;
      return (selectedFields.length > 0 ? selectedFields : baseFields).map((field) => {
        if (field.name === "indicatorType" || field.name === "instructionType") {
          return {
            ...field,
            name: "indicatorType",
            label: field.label === "Instruction type" ? "Indicator type" : field.label,
            type: "indicatorType" as const,
            required: true,
            description: "Exactly one of: good, bad. Use good for positive/recommended items; use bad for negative/risky items.",
            defaultValue: normalizeIndicatorType(field.defaultValue),
          };
        }
        return {
          ...field,
          name: "text",
          label: field.label === "Instruction text" ? "Indicator text" : field.label || "Indicator text",
          type: "textarea" as const,
          required: true,
        };
      });
    }
    return fields;
  })();
  const fallbackFieldsByName = new Map(fallback.fields.map((field) => [field.name, field]));
  const normalizedFieldsWithDescriptions = normalizedFields.map((field) => {
    const fallbackField = fallbackFieldsByName.get(field.name);
    const description = cleanString(field.description, fallbackField?.description || "");
    return description ? { ...field, description } : field;
  });
  const isLegacyChecklistTemplate = fallback.id === CHECKLIST_TEMPLATE_ID && candidate.id === "step_checklist";
  return {
    id: isLegacyChecklistTemplate ? fallback.id : cleanString(candidate.id, fallback.id || `motion-graphic-${index + 1}`),
    rendererId,
    displayName: rendererId === "checklist" ? "Checklist" : cleanString(candidate.displayName, fallback.displayName),
    description: rendererId === "checklist" ? fallback.description : cleanString(candidate.description, fallback.description),
    whenToUse: rendererId === "checklist" ? fallback.whenToUse : cleanString(candidate.whenToUse, fallback.whenToUse),
    additionalUsageInstructions: cleanOptionalString(candidate.additionalUsageInstructions, fallback.additionalUsageInstructions || ""),
    durationSeconds: typeof candidate.durationSeconds === "number" && Number.isFinite(candidate.durationSeconds)
      ? Math.min(12, Math.max(3, candidate.durationSeconds))
      : fallback.durationSeconds,
    durationGuidance: rendererId === "checklist" ? fallback.durationGuidance : cleanString(candidate.durationGuidance, fallback.durationGuidance),
    stylePreset: cleanString(candidate.stylePreset, fallback.stylePreset || DEFAULT_STYLE_PRESET),
    defaultArgs: normalizedDefaultArgs,
    fields: normalizedFieldsWithDescriptions,
    deterministicSoundEffects: normalizeDeterministicSoundCues(candidate.deterministicSoundEffects, fallback.deterministicSoundEffects || []),
    enabled: candidate.enabled !== false,
  };
}

function normalizeSettings(candidate: Partial<ShortFormMotionGraphicsSettings> | null | undefined): ShortFormMotionGraphicsSettings {
  const inputTemplates = Array.isArray(candidate?.templates) ? candidate?.templates || [] : [];
  const byId = new Map(inputTemplates.map((template) => [typeof (template as { id?: unknown }).id === "string" ? (template as { id: string }).id : "", template]));
  const mergedBuiltIns = DEFAULT_TEMPLATES.map((fallback, index) => {
    const legacyInstructionTemplate = fallback.id === GOOD_BAD_INDICATOR_TEMPLATE_ID ? byId.get("instruction") : undefined;
    const legacyChecklistTemplate = fallback.id === CHECKLIST_TEMPLATE_ID ? byId.get("step_checklist") : undefined;
    return normalizeTemplate(byId.get(fallback.id) ?? legacyInstructionTemplate ?? legacyChecklistTemplate, fallback, index);
  });
  const customTemplates = inputTemplates
    .filter((template) => {
      const id = typeof (template as { id?: unknown }).id === "string" ? (template as { id: string }).id : "";
      return id && !REMOVED_TEMPLATE_IDS.has(id) && !DEFAULT_TEMPLATES.some((fallback) => fallback.id === id || (fallback.id === CHECKLIST_TEMPLATE_ID && id === "step_checklist"));
    })
    .map((template, index) => normalizeTemplate(template, DEFAULT_TEMPLATES[0], DEFAULT_TEMPLATES.length + index));

  return {
    defaultStylePreset: cleanString(candidate?.defaultStylePreset, DEFAULT_STYLE_PRESET),
    templates: [...mergedBuiltIns, ...customTemplates],
  };
}

export function getShortFormMotionGraphicsSettings(): ShortFormMotionGraphicsSettings {
  let parsed: Partial<ShortFormMotionGraphicsSettings> | undefined;
  if (fs.existsSync(SETTINGS_PATH)) {
    try {
      parsed = JSON.parse(fs.readFileSync(SETTINGS_PATH, "utf-8")) as Partial<ShortFormMotionGraphicsSettings>;
    } catch {
      parsed = undefined;
    }
  }
  return normalizeSettings(parsed);
}

export function saveShortFormMotionGraphicsSettings(patch: Partial<ShortFormMotionGraphicsSettings>) {
  ensureSettingsDir();
  const current = getShortFormMotionGraphicsSettings();
  const next = normalizeSettings({ ...current, ...patch });
  fs.writeFileSync(SETTINGS_PATH, JSON.stringify(next, null, 2), "utf-8");
  return next;
}

export const DEFAULT_MOTION_GRAPHIC_TEMPLATE_PROMPT_TEMPLATE = [
  "- {{templateId}} ({{displayName}})",
  "  rendererId: {{rendererId}}",
  "  Duration seconds: {{durationSeconds}}",
  "  Duration guidance: {{durationGuidance}}",
  "  stylePreset default: {{stylePreset}}",
  "  Description: {{description}}",
  "  When to use: {{whenToUse}}",
  "  Additional usage instructions: {{additionalUsageInstructions}}",
  "  Controllable animation-in timing items: {{animationTimingControls}}.",
  "  Built-in internal SFX JSON:",
  "{{deterministicSoundEffectsJson}}",
  "  Configurable fields JSON:",
  "{{fieldsJson}}",
].join("\n");

function renderMotionGraphicTemplatePromptBlock(template: MotionGraphicTemplateConfig, promptTemplate: string) {
  const values: Record<string, string> = {
    additionalUsageInstructions: template.additionalUsageInstructions || "None.",
    animationTimingControls: formatMotionGraphicAnimationTimingControls(template.rendererId),
    description: template.description,
    deterministicSoundEffectsJson: JSON.stringify(template.deterministicSoundEffects || [], null, 2),
    displayName: template.displayName,
    durationGuidance: template.durationGuidance,
    durationSeconds: String(template.durationSeconds),
    fieldsJson: JSON.stringify(template.fields, null, 2),
    rendererId: template.rendererId,
    stylePreset: template.stylePreset,
    templateId: template.id,
    whenToUse: template.whenToUse,
  };

  return promptTemplate.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_match, key: string) => values[key] ?? "");
}

export function renderMotionGraphicTemplatePromptInjection(
  settings = getShortFormMotionGraphicsSettings(),
  templatePromptTemplate = DEFAULT_MOTION_GRAPHIC_TEMPLATE_PROMPT_TEMPLATE,
) {
  return settings.templates
    .filter((template) => template.enabled)
    .map((template) => renderMotionGraphicTemplatePromptBlock(template, templatePromptTemplate))
    .join("\n");
}

export const MOTION_GRAPHICS_SETTINGS_PATH = SETTINGS_PATH;
