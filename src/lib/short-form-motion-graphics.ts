import fs from "fs";
import path from "path";
import { SHORT_FORM_VIDEOS_DIR } from "@/lib/short-form-videos";

export const SUPPORTED_MOTION_GRAPHIC_RENDERERS = [
  "stat_reveal",
  "bar_chart",
  "comparison_before_after",
  "timeline",
  "process_flow",
  "research_finding_card",
] as const;

export type MotionGraphicRendererId = (typeof SUPPORTED_MOTION_GRAPHIC_RENDERERS)[number];
export type MotionGraphicFieldType = "text" | "textarea" | "number" | "stringList" | "dataSeries";

export interface MotionGraphicTemplateField {
  name: string;
  label: string;
  type: MotionGraphicFieldType;
  required?: boolean;
  description?: string;
  defaultValue?: string | number | string[] | Array<{ label: string; value: number | string; displayValue?: string }>;
}

export interface MotionGraphicTemplateConfig {
  id: string;
  rendererId: MotionGraphicRendererId;
  displayName: string;
  description: string;
  whenToUse: string;
  durationSeconds: number;
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

const DEFAULT_TEMPLATES: MotionGraphicTemplateConfig[] = [
  {
    id: "stat_reveal",
    rendererId: "stat_reveal",
    displayName: "Stat reveal",
    description: "Large animated number over the unified dark pastel watercolor background with minimal supporting context.",
    whenToUse: "Use for a single memorable statistic, percentage, dollar amount, study result, or surprising quantified claim that should feel premium and focused.",
    durationSeconds: 6,
    stylePreset: DEFAULT_STYLE_PRESET,
    defaultArgs: { eyebrow: "Key finding", value: "73%", title: "people notice the change", note: "Use one credible, specific stat only." },
    fields: [
      { name: "eyebrow", label: "Eyebrow", type: "text", defaultValue: "Key finding" },
      { name: "value", label: "Main value", type: "text", required: true, defaultValue: "73%" },
      { name: "title", label: "Title", type: "text", required: true, defaultValue: "people notice the change" },
      { name: "note", label: "Note/source line", type: "textarea", defaultValue: "Short source or context line." },
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
    stylePreset: DEFAULT_STYLE_PRESET,
    defaultArgs: { title: "What changed most", subtitle: "Relative lift", data: [{ label: "A", value: 35, displayValue: "35" }, { label: "B", value: 68, displayValue: "68" }, { label: "C", value: 92, displayValue: "92" }] },
    fields: [
      { name: "title", label: "Title", type: "text", required: true, defaultValue: "What changed most" },
      { name: "subtitle", label: "Subtitle", type: "text", defaultValue: "Relative lift" },
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
    stylePreset: DEFAULT_STYLE_PRESET,
    defaultArgs: { title: "The visible difference", beforeLabel: "Before", afterLabel: "After", before: "Tension stacked under the chin", after: "Neck long, jawline reads cleaner" },
    fields: [
      { name: "title", label: "Title", type: "text", required: true, defaultValue: "The visible difference" },
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
    stylePreset: DEFAULT_STYLE_PRESET,
    defaultArgs: { title: "What happens next", steps: ["Setup", "Signal", "Visible change"] },
    fields: [
      { name: "title", label: "Title", type: "text", required: true, defaultValue: "What happens next" },
      { name: "steps", label: "Timeline steps", type: "stringList", required: true, defaultValue: ["Setup", "Signal", "Visible change"] },
    ],
    enabled: true,
  },
  {
    id: "process_flow",
    rendererId: "process_flow",
    displayName: "Process flow",
    description: "Minimal 3–5 step process text with directional connectors over a heavily dimmed dark pastel watercolor background.",
    whenToUse: "Use for frameworks, checklists, causal chains, anatomy mechanisms, or repeatable operating procedures when a simple text/connectors-only motion graphic should feel premium and focused.",
    durationSeconds: 7,
    stylePreset: DEFAULT_STYLE_PRESET,
    defaultArgs: { steps: ["Notice", "Adjust", "Repeat"] },
    fields: [
      { name: "steps", label: "Process steps", type: "stringList", required: true, defaultValue: ["Notice", "Adjust", "Repeat"] },
    ],
    enabled: true,
  },
  {
    id: "research_finding_card",
    rendererId: "research_finding_card",
    displayName: "Research finding card",
    description: "Editorial research note over the unified dark pastel watercolor background with source, finding, and implication, without a card box.",
    whenToUse: "Use when citing research, evidence, expert reports, or turning a study into a clear practical takeaway without visual clutter.",
    durationSeconds: 6,
    stylePreset: DEFAULT_STYLE_PRESET,
    defaultArgs: { source: "Study finding", finding: "Small posture changes altered perceived facial definition.", implication: "Use this as support, not as a magic-result promise." },
    fields: [
      { name: "source", label: "Source/study label", type: "text", required: true, defaultValue: "Study finding" },
      { name: "finding", label: "Finding", type: "textarea", required: true, defaultValue: "Core research finding." },
      { name: "implication", label: "Implication", type: "textarea", defaultValue: "Practical takeaway." },
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

function normalizeField(value: unknown, fallback: MotionGraphicTemplateField): MotionGraphicTemplateField {
  const candidate = value && typeof value === "object" && !Array.isArray(value) ? value as Partial<MotionGraphicTemplateField> : {};
  const type = ["text", "textarea", "number", "stringList", "dataSeries"].includes(String(candidate.type))
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
  const rendererId = isRendererId(candidate.rendererId) ? candidate.rendererId : fallback.rendererId;
  const fields = Array.isArray(candidate.fields) && candidate.fields.length > 0
    ? candidate.fields.map((field, fieldIndex) => normalizeField(field, fallback.fields[fieldIndex] || fallback.fields[0]))
    : fallback.fields;
  const rawDefaultArgs = candidate.defaultArgs && typeof candidate.defaultArgs === "object" && !Array.isArray(candidate.defaultArgs)
    ? candidate.defaultArgs as Record<string, unknown>
    : fallback.defaultArgs;
  const defaultArgs = rendererId === "process_flow"
    ? Object.fromEntries(Object.entries(rawDefaultArgs).filter(([key]) => key !== "title"))
    : rawDefaultArgs;
  const processFlowFields = fields.filter((field) => field.name !== "title");
  const fallbackProcessFlowFields = fallback.fields.filter((field) => field.name !== "title");
  const normalizedFields = rendererId === "process_flow"
    ? (processFlowFields.length > 0 ? processFlowFields : fallbackProcessFlowFields)
    : fields;
  return {
    id: cleanString(candidate.id, fallback.id || `motion-graphic-${index + 1}`),
    rendererId,
    displayName: cleanString(candidate.displayName, fallback.displayName),
    description: cleanString(candidate.description, fallback.description),
    whenToUse: cleanString(candidate.whenToUse, fallback.whenToUse),
    durationSeconds: typeof candidate.durationSeconds === "number" && Number.isFinite(candidate.durationSeconds)
      ? Math.min(12, Math.max(3, candidate.durationSeconds))
      : fallback.durationSeconds,
    stylePreset: cleanString(candidate.stylePreset, fallback.stylePreset || DEFAULT_STYLE_PRESET),
    defaultArgs,
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
      return id && !DEFAULT_TEMPLATES.some((fallback) => fallback.id === id);
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
      `  durationSeconds default: ${template.durationSeconds}`,
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
    "- Reference it from the timeline as <visual visualType=\"motion_graphic\" motionGraphicId=\"...\" start=\"...\" end=\"...\" label=\"...\" />.",
    "- Motion graphics are normal visuals; they must not include captions/subtitles/transcript text unless a configured field explicitly represents ordinary on-slide text.",
    "- Use imageId for image visuals and motionGraphicId for motion_graphic visuals; do not put both on the same <visual>.",
  ].join("\n");
}

export const MOTION_GRAPHICS_SETTINGS_PATH = SETTINGS_PATH;
