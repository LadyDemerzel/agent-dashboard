import fs from "fs";
import path from "path";
import { SHORT_FORM_VIDEOS_DIR } from "@/lib/short-form-videos";

export const SUPPORTED_MOTION_GRAPHIC_RENDERERS = [
  "stat_reveal",
  "bar_chart",
  "comparison_before_after",
  "timeline",
  "cause_effect",
  "caption_word_wall",
] as const;

export type MotionGraphicRendererId = (typeof SUPPORTED_MOTION_GRAPHIC_RENDERERS)[number];
export type MotionGraphicFieldType = "text" | "textarea" | "number" | "stringList" | "timelineSteps" | "dataSeries" | "captionWordWallLines";

export interface MotionGraphicTemplateField {
  name: string;
  label: string;
  type: MotionGraphicFieldType;
  required?: boolean;
  description?: string;
  defaultValue?: string | number | string[] | Array<{ label: string; text: string }> | Array<{ label: string; value: number | string; displayValue?: string }> | Array<{ text?: string; size?: "regular" | "large" | "extra_large"; emphasized?: boolean; blank?: boolean }>;
}

export interface MotionGraphicTemplateConfig {
  id: string;
  rendererId: MotionGraphicRendererId;
  displayName: string;
  description: string;
  whenToUse: string;
  durationSeconds: number;
  durationGuidance: string;
  stylePreset: string;
  defaultArgs: Record<string, unknown>;
  fields: MotionGraphicTemplateField[];
  enabled: boolean;
}

export interface ShortFormMotionGraphicsSettings {
  defaultStylePreset: string;
  templates: MotionGraphicTemplateConfig[];
}

const SETTINGS_PATH = path.join(SHORT_FORM_VIDEOS_DIR, "_motion-graphics-settings.json");
const DEFAULT_STYLE_PRESET = "dark-pastel-watercolor";
const REMOVED_TEMPLATE_IDS = new Set(["research_finding_card", "process_flow"]);

const DEFAULT_TEMPLATES: MotionGraphicTemplateConfig[] = [
  {
    id: "stat_reveal",
    rendererId: "stat_reveal",
    displayName: "Stat reveal",
    description: "Large animated number over the unified dark pastel watercolor background with minimal supporting context.",
    whenToUse: "Use for a single memorable statistic, percentage, dollar amount, study result, or surprising quantified claim that should feel premium and focused.",
    durationSeconds: 6,
    durationGuidance: "Usually 4-6 seconds: long enough for the number to reveal, settle, and give the viewer a beat to read the title.",
    stylePreset: DEFAULT_STYLE_PRESET,
    defaultArgs: { value: "73%", title: "people notice the change" },
    fields: [
      { name: "value", label: "Main value", type: "text", required: true, defaultValue: "73%" },
      { name: "title", label: "Title", type: "text", required: true, defaultValue: "people notice the change" },
    ],
    enabled: true,
  },
  {
    id: "bar_chart",
    rendererId: "bar_chart",
    displayName: "Bar chart",
    description: "Minimal animated bar chart over the unified dark pastel watercolor background with subdued labels and pastel accents.",
    whenToUse: "Use when comparing 2–5 categories, routines, channels, habits, or measured outcomes.",
    durationSeconds: 7,
    durationGuidance: "Around 2 seconds for the setup plus about 1 second per bar, so 3 bars should land around 5 seconds and 5 bars around 7 seconds.",
    stylePreset: DEFAULT_STYLE_PRESET,
    defaultArgs: { title: "What changed most", data: [{ label: "A", value: 35, displayValue: "35" }, { label: "B", value: 68, displayValue: "68" }, { label: "C", value: 92, displayValue: "92" }] },
    fields: [
      { name: "title", label: "Title", type: "text", required: true, defaultValue: "What changed most" },
      { name: "data", label: "Data points", type: "dataSeries", required: true, defaultValue: [{ label: "A", value: 35, displayValue: "35" }, { label: "B", value: 68, displayValue: "68" }] },
    ],
    enabled: true,
  },
  {
    id: "comparison_before_after",
    rendererId: "comparison_before_after",
    displayName: "Before / after comparison",
    description: "Minimal two-column comparison over the unified dark pastel watercolor background with no panels or card boxes.",
    whenToUse: "Use for transformations, posture/routine contrasts, old-vs-new workflow, or mistake-vs-fix moments.",
    durationSeconds: 6,
    durationGuidance: "Usually 5-7 seconds: give the before side time to read first, then reveal the after side with a short pause before the visual ends.",
    stylePreset: DEFAULT_STYLE_PRESET,
    defaultArgs: { beforeLabel: "Before", afterLabel: "After", before: "Tension stacked under the chin", after: "Neck long, jawline reads cleaner" },
    fields: [
      { name: "beforeLabel", label: "Before label", type: "text", defaultValue: "Before" },
      { name: "afterLabel", label: "After label", type: "text", defaultValue: "After" },
      { name: "before", label: "Before copy", type: "textarea", required: true, defaultValue: "Problem state" },
      { name: "after", label: "After copy", type: "textarea", required: true, defaultValue: "Improved state" },
    ],
    enabled: true,
  },
  {
    id: "timeline",
    rendererId: "timeline",
    displayName: "Timeline",
    description: "Minimal stepped timeline over the unified dark pastel watercolor background with smooth equal-segment reveals.",
    whenToUse: "Use for sequence, history, program phases, study timeline, or what happens over the next few seconds/days/weeks.",
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
    enabled: true,
  },
  {
    id: "cause_effect",
    rendererId: "cause_effect",
    displayName: "Cause / effect",
    description: "Vertically stacked cause-to-effect relationship over the unified dark pastel watercolor background with a deterministic downward arrow reveal.",
    whenToUse: "Use when explaining mechanisms, causal relationships, inputs that drive outcomes, or why one action creates a visible result.",
    durationSeconds: 6,
    durationGuidance: "Usually 5-7 seconds: give the cause a readable beat, then reveal the arrow and effect with enough time for the effect copy to land.",
    stylePreset: DEFAULT_STYLE_PRESET,
    defaultArgs: { cause: "Small daily tension", effect: "Jaw and neck read tighter" },
    fields: [
      { name: "cause", label: "Cause", type: "textarea", required: true, defaultValue: "Small daily tension" },
      { name: "effect", label: "Effect", type: "textarea", required: true, defaultValue: "Jaw and neck read tighter" },
    ],
    enabled: true,
  },
  {
    id: "caption_word_wall",
    rendererId: "caption_word_wall",
    displayName: "Caption word wall",
    description: "Full-screen caption wall that replaces both the normal scene visual and bottom captions, using forced-alignment word timing with stat-reveal-style typography and an active-word pop.",
    whenToUse: "Use for retention-heavy moments where the spoken words should take over the full frame as a kinetic caption wall instead of sitting over a generated image.",
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
    enabled: true,
  },
];

function ensureSettingsDir() {
  fs.mkdirSync(path.dirname(SETTINGS_PATH), { recursive: true });
}

function isRendererId(value: unknown): value is MotionGraphicRendererId {
  return typeof value === "string" && (SUPPORTED_MOTION_GRAPHIC_RENDERERS as readonly string[]).includes(value);
}

function cleanString(value: unknown, fallback: string) {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
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

function normalizeTimelineDefaultArgs(args: Record<string, unknown>) {
  const steps = normalizeTimelineSteps(args.steps);
  return steps.length > 0 ? { ...args, steps } : args;
}

function normalizeField(value: unknown, fallback: MotionGraphicTemplateField): MotionGraphicTemplateField {
  const candidate = value && typeof value === "object" && !Array.isArray(value) ? value as Partial<MotionGraphicTemplateField> : {};
  const type = ["text", "textarea", "number", "stringList", "timelineSteps", "dataSeries", "captionWordWallLines"].includes(String(candidate.type))
    ? candidate.type as MotionGraphicFieldType
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

function normalizeTemplate(value: unknown, fallback: MotionGraphicTemplateConfig, index: number): MotionGraphicTemplateConfig {
  const candidate = value && typeof value === "object" && !Array.isArray(value) ? value as Partial<MotionGraphicTemplateConfig> : {};
  const hasUnsupportedRenderer = typeof candidate.rendererId === "string" && !isRendererId(candidate.rendererId);
  const rendererId = isRendererId(candidate.rendererId) ? candidate.rendererId : fallback.rendererId;
  const fields = !hasUnsupportedRenderer && Array.isArray(candidate.fields) && candidate.fields.length > 0
    ? candidate.fields.map((field, fieldIndex) => normalizeField(field, fallback.fields[fieldIndex] || fallback.fields[0]))
    : fallback.fields;
  const rawDefaultArgs = !hasUnsupportedRenderer && candidate.defaultArgs && typeof candidate.defaultArgs === "object" && !Array.isArray(candidate.defaultArgs)
    ? candidate.defaultArgs as Record<string, unknown>
    : fallback.defaultArgs;
  const defaultArgs = Object.fromEntries(
    Object.entries(rawDefaultArgs).filter(([key]) => {
      if (rendererId === "stat_reveal") return key !== "eyebrow" && key !== "note";
      if (rendererId === "bar_chart") return key !== "subtitle";
      if (rendererId === "timeline") return key !== "title";
      if (rendererId === "comparison_before_after") return key !== "title";
      return true;
    }),
  );
  const normalizedDefaultArgs = rendererId === "timeline"
    ? normalizeTimelineDefaultArgs(defaultArgs)
    : rendererId === "caption_word_wall" && normalizeCaptionWordWallLines(defaultArgs.lines).length > 0
      ? { ...defaultArgs, lines: normalizeCaptionWordWallLines(defaultArgs.lines) }
      : defaultArgs;
  const normalizedFields = (() => {
    if (rendererId === "stat_reveal") {
      const statRevealFields = fields.filter((field) => field.name !== "eyebrow" && field.name !== "note");
      const fallbackStatRevealFields = fallback.fields.filter((field) => field.name !== "eyebrow" && field.name !== "note");
      return statRevealFields.length > 0 ? statRevealFields : fallbackStatRevealFields;
    }
    if (rendererId === "bar_chart") {
      const barChartFields = fields.filter((field) => field.name !== "subtitle");
      const fallbackBarChartFields = fallback.fields.filter((field) => field.name !== "subtitle");
      return barChartFields.length > 0 ? barChartFields : fallbackBarChartFields;
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
    return fields;
  })();
  return {
    id: cleanString(candidate.id, fallback.id || `motion-graphic-${index + 1}`),
    rendererId,
    displayName: cleanString(candidate.displayName, fallback.displayName),
    description: cleanString(candidate.description, fallback.description),
    whenToUse: cleanString(candidate.whenToUse, fallback.whenToUse),
    durationSeconds: typeof candidate.durationSeconds === "number" && Number.isFinite(candidate.durationSeconds)
      ? Math.min(12, Math.max(3, candidate.durationSeconds))
      : fallback.durationSeconds,
    durationGuidance: cleanString(candidate.durationGuidance, fallback.durationGuidance),
    stylePreset: cleanString(candidate.stylePreset, fallback.stylePreset || DEFAULT_STYLE_PRESET),
    defaultArgs: normalizedDefaultArgs,
    fields: normalizedFields,
    enabled: candidate.enabled !== false,
  };
}

function normalizeSettings(candidate: Partial<ShortFormMotionGraphicsSettings> | null | undefined): ShortFormMotionGraphicsSettings {
  const inputTemplates = Array.isArray(candidate?.templates) ? candidate?.templates || [] : [];
  const byId = new Map(inputTemplates.map((template) => [typeof (template as { id?: unknown }).id === "string" ? (template as { id: string }).id : "", template]));
  const mergedBuiltIns = DEFAULT_TEMPLATES.map((fallback, index) => normalizeTemplate(byId.get(fallback.id), fallback, index));
  const customTemplates = inputTemplates
    .filter((template) => {
      const id = typeof (template as { id?: unknown }).id === "string" ? (template as { id: string }).id : "";
      return id && !REMOVED_TEMPLATE_IDS.has(id) && !DEFAULT_TEMPLATES.some((fallback) => fallback.id === id);
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

export function renderMotionGraphicTemplatePromptInjection(settings = getShortFormMotionGraphicsSettings()) {
  const enabledTemplates = settings.templates.filter((template) => template.enabled);
  if (enabledTemplates.length === 0) {
    return "Motion graphics are currently disabled in settings. Use image assets only.";
  }

  const templateBlocks = enabledTemplates.map((template) => {
    const fields = template.fields.map((field) => {
      const defaultText = field.defaultValue === undefined ? "" : ` Default: ${JSON.stringify(field.defaultValue)}`;
      const requiredText = field.required ? " Required." : "";
      return `  - ${field.name} (${field.type}): ${field.label}.${requiredText}${field.description ? ` ${field.description}` : ""}${defaultText}`;
    }).join("\n");
    return [
      `- ${template.id} (${template.displayName})`,
      `  rendererId: ${template.rendererId}`,
      `  Duration guidance: ${template.durationGuidance}`,
      `  stylePreset default: ${template.stylePreset}`,
      `  Description: ${template.description}`,
      `  When to use: ${template.whenToUse}`,
      `  Configurable fields:`,
      fields,
    ].join("\n");
  }).join("\n\n");

  return [
    "Allowed deterministic motion_graphic templates:",
    templateBlocks,
    "",
    "XML usage for motion graphics:",
    "- Define reusable motion assets inside <assets> as <motionGraphic id=\"...\" templateId=\"one_of_the_ids_above\">.",
    "- Configure only the listed fields. Do not write arbitrary Remotion, JavaScript, CSS, HTML, or renderer code.",
    "- Use <arg name=\"fieldName\">value</arg> for text/number fields.",
    "- For dataSeries fields, use repeated <item label=\"...\" value=\"...\" displayValue=\"...\" /> inside the motionGraphic.",
    "- For stringList fields, use repeated <step>...</step> inside the motionGraphic.",
    "- For timelineSteps fields, use repeated <step label=\"custom left label\">step text</step>. Omit label only when you want the renderer to auto-label steps as 01, 02, 03.",
    "- For captionWordWallLines fields, use ordered <line size=\"regular\">spoken words for this row</line>, <line size=\"large\">intermediate emphasis row</line>, <line size=\"extra_large\">largest emphasis row</line>, and <blankLine /> entries inside the motionGraphic. Size is whole-line only; do not size individual inline words. Legacy <line emphasized=\"true\"> still maps to size=\"extra_large\".",
    "- For caption_word_wall specifically, line text must be exact spoken narration words in order from that visual's time range. The renderer uses forced-alignment word timestamps directly and does not use the deterministic caption JSON max-word chunks.",
    "- Reference it from the timeline as <visual visualType=\"motion_graphic\" motionGraphicId=\"...\" start=\"...\" end=\"...\" label=\"...\" />.",
    "- Motion graphics are normal visuals; they must not include captions/subtitles/transcript text unless a configured field explicitly represents ordinary on-slide text. The caption_word_wall template is the only full-screen caption replacement and should not be paired with ordinary bottom captions.",
    "- Use imageId for image visuals and motionGraphicId for motion_graphic visuals; do not put both on the same <visual>.",
  ].join("\n");
}

export const MOTION_GRAPHICS_SETTINGS_PATH = SETTINGS_PATH;
