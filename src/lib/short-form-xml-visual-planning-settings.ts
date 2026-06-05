import fs from "fs";
import path from "path";
import { getVersionedShortFormSettingsPath } from "@/lib/short-form-settings-paths";
import {
  DEFAULT_MOTION_GRAPHIC_TEMPLATE_PROMPT_TEMPLATE,
  renderMotionGraphicTemplatePromptInjection,
} from "@/lib/short-form-motion-graphics";

export interface ShortFormXmlVisualPlanningSettings {
  planningGuidelinesTemplate: string;
  motionGraphicTemplatePromptTemplate: string;
  promptTemplate: string;
  revisePromptTemplate: string;
}

const SETTINGS_PATH = getVersionedShortFormSettingsPath("_xml-visual-planning-settings.json");

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
  `  <assets></assets>`,
  `  <timeline>`,
  `    <visual id=\"visual-1\" label=\"Hook setup\" start=\"0.00\" end=\"1.20\" cameraZoom=\"0.05\">`,
  `      <image id=\"hook-setup\" characterDriven=\"false\">`,
  `        <prompt>Describe the generated image for this visual.</prompt>`,
  `      </image>`,
  `    </visual>`,
  `    <visual id=\"visual-2\" label=\"Reuse hook image\" start=\"1.20\" end=\"2.40\" imageId=\"visual-1\" cameraZoomStart=\"0.02\" cameraZoomEnd=\"0.08\" />`,
  `    <visual id=\"visual-3\" label=\"Derived closeup\" start=\"2.40\" end=\"4.00\">`,
  `      <image id=\"derived-closeup\" basedOn=\"visual-1\" characterDriven=\"false\">`,
  `        <prompt>Describe a NEW image generated from the earlier visual-1 image as a reference.</prompt>`,
  `      </image>`,
  `    </visual>`,
  `    <visual id=\"visual-4\" label=\"Indicator\" start=\"4.00\" end=\"5.40\" visualType=\"motion_graphic\">`,
  `      <motionGraphic templateId=\"good-bad-indicator\">`,
  `        <timing item=\"text\" at=\"4.40\" />`,
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
  "### Image visuals",
  "- Do not define image prompts in <assets>. Keep <assets> empty unless a future non-image asset type is explicitly needed.",
  "- Define a generated image directly inside the timeline visual that first uses it: <visual ...><image id=\"image-id\" characterDriven=\"false\"><prompt>...</prompt></image></visual>.",
  "- A later image visual may exactly reuse an earlier image visual by setting imageId to that earlier visual id or earlier image id. Reuse must only point backward in timeline order.",
  "- A later image visual may generate a new reference-derived image by putting an inline <image basedOn=\"earlier-visual-id-or-image-id\"> inside the later <visual>. basedOn must only point backward in timeline order.",
  "- Never reference a future visual/image. If an image is needed earlier and later, define it at its first timeline use, then reuse it later.",
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
  "#### Allowed deterministic motion graphic templates:",
  "If no templates are listed below, use image visuals only.",
  "{{motionGraphicTemplates}}",
  "",
  "### XML usage for motion graphics",
  "- Do not define motion graphics inside <assets>. Motion graphics are not reusable assets.",
  "- Define each motion graphic directly inside exactly one <timeline><visual> as <visual visualType=\"motion_graphic\" start=\"...\" end=\"...\"><motionGraphic templateId=\"one_of_the_ids_above\">...</motionGraphic></visual>.",
  "- Each motion_graphic visual must have one inline <motionGraphic>; do not reference a separate motionGraphicId asset.",
  "- Configure only the listed fields. Do not write arbitrary HyperFrames, JavaScript, CSS, HTML, or renderer code.",
  "- Use <arg name=\"fieldName\">value</arg> for text/number fields.",
  "- To time a core item's animation-in, add animateIn=\"absolute_video_timestamp_seconds\" on the relevant <item>, <step>, or <line>, or add <timing item=\"title\" at=\"12.20\" /> / <timing item=\"cause\" at=\"12.35\" /> inside the inline motionGraphic. Timings are absolute timestamps in the full video timeline, not seconds relative to the motion graphic visual start.",
  "- Keep every motion graphic item timing within that visual's start/end bounds.",
  "- Only time the controllable animation-in items listed for that template. Items that visually belong together, such as a bar plus its value and label or a pie slice plus its legend row, animate together from the same timing.",
  "- For dataSeries fields, use repeated <item label=\"...\" value=\"...\" displayValue=\"...\" /> inside the motionGraphic.",
  "- For pie_chart, use the same dataSeries shape as bar_chart; values should be positive parts of a whole and displayValue should usually be a short percent label.",
  "- For line_growth_chart, set <arg name=\"direction\">increase</arg> for an up/right trend or <arg name=\"direction\">decrease</arg> for a down/right trend. Optional dataSeries points should match that direction. To show units on the moving counter, set <arg name=\"valueLabel\">90</arg> and optional <arg name=\"units\">homes</arg>; the renderer appends the unit text throughout the count-up.",
  "- For stringList fields, use repeated <step>...</step> inside the motionGraphic.",
  "- For timelineSteps fields, use repeated <step label=\"custom left label\">step text</step>. Omit label only when you want the renderer to auto-label steps as 01, 02, 03.",
  "- For ranked_podium and checklist split sequences, set <arg name=\"startIndex\">2</arg> to render earlier items already present and animate from item 2. Set <arg name=\"futureItemsMode\">hidden</arg> or <arg name=\"futureItemsMode\">blurred</arg> to control unrevealed later items.",
  "- For indicatorType fields, use exactly <arg name=\"indicatorType\">good</arg> or <arg name=\"indicatorType\">bad</arg>. The good-bad indicator template has only one text field: <arg name=\"text\">...</arg>.",
  "- For captionWordWallLines fields, use ordered <line size=\"regular\">spoken words for this row</line>, <line size=\"large\">intermediate emphasis row</line>, <line size=\"extra_large\">largest emphasis row</line>, and <blankLine /> entries inside the motionGraphic. Size is whole-line only; do not size individual inline words. Legacy <line emphasized=\"true\"> still maps to size=\"extra_large\".",
  "- For caption_word_wall specifically, line text must be exact spoken narration words in order from that visual's time range. The renderer uses forced-alignment word timestamps directly and does not use the deterministic caption JSON max-word chunks.",
  "- Motion graphics are normal visuals; they must not include captions/subtitles/transcript text unless a configured field explicitly represents ordinary on-slide text. The caption_word_wall template is the only full-screen caption replacement and should not be paired with ordinary bottom captions.",
  "- For image visuals, put an inline <image> inside the first <visual> that uses that image, then use imageId only on later visuals that reuse an earlier image visual. For motion_graphic visuals, do not set imageId or motionGraphicId; put the inline <motionGraphic> element inside the visual instead.",
  "",
  "### <timeline>/<visual>",
  "- <timeline><visual> entries should describe visuals: label, start/end timing, inline <image> for first-use generated image visuals, imageId for backward-only exact image reuse, inline <motionGraphic> for motion graphics, visualType, and optional camera motion.",
  "- For normal generated image visuals, put the <image> child directly inside the <visual>. Use visualType=\"motion_graphic\" plus an inline <motionGraphic> child for animated slides/charts/motion graphics.",
].join("\n");

const DEFAULT_FULL_GENERATE_PROMPT_TEMPLATE = [
  "# Goal",
  "Plan the visuals that should be displayed on screen for a short-form video and write the plan as an XML artifact.",
  "",
  "{{planningVisualsGuidelines}}",
  "",
  "Practical authoring rules:",
  "- Give each <visual> a concise label attribute so the dashboard can identify the beat on the visual timeline.",
  "- Prefer fewer reusable images than one fresh image per caption when continuity makes sense.",
  "- Distinguish exact image reuse from reference-derived new images clearly: exact reuse uses imageId on a later visual; reference-derived generation uses inline <image basedOn=\"earlier-visual-or-image-id\">.",
  "- Image reuse and basedOn are backward-only: they may reference image visuals that came earlier in the timeline, never later ones.",
  "- Prompts should describe the intended image clearly and specifically, including environment/background details when they matter.",
  "- No baked-in text in generated images.",
  "",
  "# Output contract",
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
  "- Prefer fewer reusable images than one fresh image per caption when continuity makes sense.",
  "- Distinguish exact image reuse from reference-derived new images clearly: exact reuse uses imageId on a later visual; reference-derived generation uses inline <image basedOn=\"earlier-visual-or-image-id\">.",
  "- Image reuse and basedOn are backward-only: they may reference image visuals that came earlier in the timeline, never later ones.",
  "- Prompts should describe the intended image clearly and specifically, including environment/background details when they matter.",
  "- No baked-in text in generated images.",
  "",
  "# Output contract",
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
    motionGraphicTemplatePromptTemplate: normalizePromptTemplate(
      candidate?.motionGraphicTemplatePromptTemplate,
      DEFAULT_MOTION_GRAPHIC_TEMPLATE_PROMPT_TEMPLATE,
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
  const settings = getShortFormXmlVisualPlanningSettings();
  const valuesWithMotionGraphics: Record<string, string | undefined> = {
    ...values,
    motionGraphicTemplates:
      values.motionGraphicTemplates ??
      renderMotionGraphicTemplatePromptInjection(
        undefined,
        settings.motionGraphicTemplatePromptTemplate,
      ),
  };
  return template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_match, key: string) => valuesWithMotionGraphics[key] ?? "");
}
