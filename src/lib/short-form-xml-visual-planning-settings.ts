import fs from "fs";
import path from "path";
import { SHORT_FORM_VIDEOS_DIR } from "@/lib/short-form-videos";
import { renderMotionGraphicTemplatePromptInjection } from "@/lib/short-form-motion-graphics";

export interface ShortFormXmlVisualPlanningSettings {
  planningGuidelinesTemplate: string;
  promptTemplate: string;
  revisePromptTemplate: string;
}

const SETTINGS_PATH = path.join(SHORT_FORM_VIDEOS_DIR, "_xml-visual-planning-settings.json");

const DEFAULT_PLANNING_GUIDELINES_TEMPLATE = [
  "# Context for the short-form video",
  "Inputs you must read before planning visuals and writing the XML plan:",
  "- Topic of the short form video: {{topic}}",
  "- Hook for the short form video: {{selectedHook}}",
  "- Plain text script that is narrated out-loud for the short form video: {{textScriptPath}}",
  "- Exact narration transcript used for TTS/alignment: {{transcriptPath}}",
  "- Forced-alignment JSON: {{alignmentPath}}",
  "- Captions/subtitles JSON (for timing/context only; do NOT copy it into XML): {{captionPlanPath}}",
  "",
  "# XML Artifact",
  "You must write the final XML to the exact path below, with YAML front matter followed by raw XML only:",
  "{{xmlScriptPath}}",
  "",
  "Required XML schema:",
  `<video version=\"2\">`,
  `  <assets>`,
  `    <image id=\"asset-id\">`,
  `      <prompt>Describe one reusable image asset.</prompt>`,
  `    </image>`,
  `    <image id=\"asset-id-2\" basedOn=\"asset-id\">`,
  `      <prompt>Describe a NEW image to generate using the prior asset as a reference.</prompt>`,
  `    </image>`,
  `  </assets>`,
  `  <timeline>`,
  `    <visual id=\"visual-1\" label=\"Hook setup\" start=\"0.00\" end=\"1.20\" imageId=\"asset-id\" cameraZoom=\"0.05\" />`,
  `    <visual id=\"visual-2\" label=\"Reveal\" start=\"1.20\" end=\"2.40\" imageId=\"asset-id\" cameraZoomStart=\"0.02\" cameraZoomEnd=\"0.08\" />`,
  `    <visual id=\"visual-3\" label=\"Indicator\" start=\"2.40\" end=\"4.00\" visualType=\"motion_graphic\">`,
  `      <motionGraphic templateId=\"good-bad-indicator\">`,
  `        <timing item=\"text\" at=\"2.90\" />`,
  `        <arg name=\"indicatorType\">good</arg>`,
  `        <arg name=\"text\">Train the start, not the strain</arg>`,
  `      </motionGraphic>`,
  `    </visual>`,
  `  </timeline>`,
  `</video>`,
  "",
  "## XML Semantics",
  "### Captions",
  "- Captions do NOT belong in the XML. Do not emit <caption> nodes anywhere.",
  "- The caption JSON is a separate deterministic artifact used by the final renderer and review timeline.",
  "",
  "### <assets>/<image>",
  "- <assets>/<image id> defines reusable underlying image assets.",
  "- Prompts should describe the intended image clearly and specifically, including environment/background details when they matter.",
  "- No baked-in text in generated images.",
  "",
  "### Motion graphics",
  "- Motion graphics do NOT belong in <assets>. Do not define reusable <assets>/<motionGraphic> entries.",
  "- Define each motion graphic directly inside its one timeline visual as <visual visualType=\"motion_graphic\" start=\"...\" end=\"...\"><motionGraphic templateId=\"...\">...</motionGraphic></visual>.",
  "- Motion graphics are one-to-one with their <visual>; do not reuse them and do not reference them through motionGraphicId.",
  "- Motion graphic text should work as read-along support for the narration in the same visual window: preserve key spoken words when useful, but shorten or adapt labels when readability or context calls for it.",
  "- Time each template item to the matching spoken phrase using the transcript/alignment data, while keeping all animation timestamps inside that visual's start/end bounds.",
  "- Do not turn motion graphics into captions/subtitles; they should emphasize the most useful words, concepts, comparisons, steps, or labels on screen.",
  "- Motion graphics may include animation-in timings for template core items. Use absolute video timestamps on <item>, <step>, or <line> animateIn attributes, or on <timing item=\"title\" at=\"absolute_video_timestamp_seconds\" /> entries.",
  "- Motion graphic timing values are absolute timestamps in the full video, not seconds relative to the visual start. Keep every timing inside that visual's start/end bounds.",
  "- Configure only the allowed motion graphic template fields listed below.",
  "",
  "{{motionGraphicTemplates}}",
  "",
  "### <timeline>/<visual>",
  "- <timeline><visual> entries should describe visuals: label, start/end timing, imageId for image visuals, inline <motionGraphic> for motion graphics, visualType, and optional camera motion.",
  "- Use imageId for normal generated image visuals. Use visualType=\"motion_graphic\" plus an inline <motionGraphic> child for animated slides/charts/motion graphics.",
].join("\n");

const DEFAULT_FULL_GENERATE_PROMPT_TEMPLATE = [
  "# Goal",
  "Plan the visuals that should be displayed on screen for a short-form video and write the plan as an XML artifact.",
  "",
  "{{planningVisualsGuidelines}}",
  "",
  "Practical authoring rules:",
  "- Give each <visual> a concise label attribute so the dashboard can identify the beat on the visual timeline.",
  "- Prefer fewer reusable assets than one fresh asset per caption when continuity makes sense.",
  "- Distinguish exact asset reuse from reference-derived new assets clearly through image ids and basedOn.",
  "- Prompts should describe the intended image clearly and specifically, including environment/background details when they matter.",
  "- No baked-in text in generated images.",
  "",
  "Output contract:",
  "- Write directly to the xml-script.md path above.",
  "- Include YAML front matter with status: needs review, agent: workflow, and suitable title/tags.",
  "- After writing, read the file back and verify it exists on disk.",
  "",
  "Project directory: {{projectDir}}",
].join("\n");

const DEFAULT_FULL_REVISE_PROMPT_TEMPLATE = [
  "# Goal",
  "Revise the visuals that should be displayed on screen for a short-form video and write the revised plan as an XML artifact.",
  "",
  "{{planningVisualsGuidelines}}",
  "",
  "Practical authoring rules:",
  "- Give each <visual> a concise label attribute so the dashboard can identify the beat on the visual timeline.",
  "- Prefer fewer reusable assets than one fresh asset per caption when continuity makes sense.",
  "- Distinguish exact asset reuse from reference-derived new assets clearly through image ids and basedOn.",
  "- Prompts should describe the intended image clearly and specifically, including environment/background details when they matter.",
  "- No baked-in text in generated images.",
  "",
  "Output contract:",
  "- Write directly to the xml-script.md path above.",
  "- Include YAML front matter with status: needs review, agent: workflow, and suitable title/tags.",
  "- After writing, read the file back and verify it exists on disk.",
  "",
  "# Revising the visual plans XML artifact",
  "- Apply the specific revision notes below to the existing Plan Visuals XML artifact.",
  "- If xml-script.md already exists, read it first.",
  "- The regenerated Plan Visuals XML must make meaningful body-level changes from the existing XML.",
  "- Rewriting the same XML with only front matter/status/timestamp changes is invalid.",
  "",
  "### Revision notes:",
  "{{revisionNotes}}",
  "",
  "Project directory: {{projectDir}}",
].join("\n");

function ensureSettingsDir() {
  fs.mkdirSync(path.dirname(SETTINGS_PATH), { recursive: true });
}

function normalizePromptTemplate(value: unknown, fallback: string) {
  if (typeof value !== "string" || !value.trim()) {
    return fallback;
  }

  return value.replace(/\r/g, "").trim();
}

function normalize(candidate: Partial<ShortFormXmlVisualPlanningSettings> | null | undefined): ShortFormXmlVisualPlanningSettings {
  return {
    planningGuidelinesTemplate: normalizePromptTemplate(
      candidate?.planningGuidelinesTemplate,
      DEFAULT_PLANNING_GUIDELINES_TEMPLATE,
    ),
    promptTemplate: normalizePromptTemplate(
      candidate?.promptTemplate,
      DEFAULT_FULL_GENERATE_PROMPT_TEMPLATE,
    ),
    revisePromptTemplate: normalizePromptTemplate(
      candidate?.revisePromptTemplate,
      DEFAULT_FULL_REVISE_PROMPT_TEMPLATE,
    ),
  };
}

export function getShortFormXmlVisualPlanningSettings(): ShortFormXmlVisualPlanningSettings {
  let parsed: Partial<ShortFormXmlVisualPlanningSettings> | undefined;
  if (fs.existsSync(SETTINGS_PATH)) {
    try {
      parsed = JSON.parse(fs.readFileSync(SETTINGS_PATH, "utf-8")) as Partial<ShortFormXmlVisualPlanningSettings>;
    } catch {
      parsed = undefined;
    }
  }

  return normalize(parsed);
}

export function saveShortFormXmlVisualPlanningSettings(patch: Partial<ShortFormXmlVisualPlanningSettings>) {
  ensureSettingsDir();
  const current = getShortFormXmlVisualPlanningSettings();
  const next = normalize({ ...current, ...patch });
  fs.writeFileSync(SETTINGS_PATH, JSON.stringify(next, null, 2), "utf-8");
  return next;
}

export function renderShortFormXmlVisualPlanningPrompt(template: string, values: Record<string, string | undefined>) {
  const valuesWithMotionGraphics: Record<string, string | undefined> = {
    ...values,
    motionGraphicTemplates: values.motionGraphicTemplates ?? renderMotionGraphicTemplatePromptInjection(),
  };
  return template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_match, key: string) => valuesWithMotionGraphics[key] ?? "");
}
