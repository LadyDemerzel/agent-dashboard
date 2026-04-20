import fs from "fs";
import path from "path";
import { SHORT_FORM_VIDEOS_DIR } from "@/lib/short-form-videos";

export interface ShortFormXmlVisualPlanningSettings {
  promptTemplate: string;
  revisionNotesPromptTemplate: string;
}

const SETTINGS_PATH = path.join(SHORT_FORM_VIDEOS_DIR, "_xml-visual-planning-settings.json");

const DEFAULT_REVISION_NOTES_PROMPT_TEMPLATE = "Revision notes: {{revisionNotes}}";

const LEGACY_PLACEHOLDER_REPLACEMENTS: Array<[string, string]> = [
  ["{{selectedHookLine}}", "Selected hook: {{selectedHook}}"],
  ["{{revisionNotesLine}}", "{{revisionNotesBlock}}"],
];

const DEFAULT_PROMPT_TEMPLATE = [
  "Write the XML script artifact for a short-form video workflow refactor.",
  "",
  "You must write the final XML to the exact path below, with YAML front matter followed by raw XML only:",
  "{{xmlScriptPath}}",
  "",
  "Project topic: {{topic}}",
  "Selected hook: {{selectedHook}}",
  "{{revisionNotesBlock}}",
  "",
  "Inputs you must read before writing:",
  "- Approved plain text script: {{textScriptPath}}",
  "- Exact narration transcript used for TTS/alignment: {{transcriptPath}}",
  "- Forced-alignment JSON: {{alignmentPath}}",
  "- Deterministic caption JSON (for timing/context only; do NOT copy it into XML): {{captionPlanPath}}",
  "",
  "Required XML schema:",
  `<video version=\"2\">`,
  `  <topic>...</topic>`,
  `  <script>...</script>`,
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
  `  </timeline>`,
  `</video>`,
  "",
  "Semantics:",
  "- <script> must match the approved plain text narration.",
  "- Captions do NOT belong in the XML anymore. Do not emit <caption> nodes anywhere.",
  "- The caption JSON is a separate deterministic artifact used by the final renderer and review timeline.",
  "- <timeline><visual> entries should only describe visuals: label, start/end timing, imageId, and optional camera motion.",
  "- <assets>/<image id> defines reusable underlying image assets.",
  "- Reusing the exact same image asset = multiple <visual> entries with the same imageId.",
  "- Generating a NEW image from a previous image reference = define a new <image id=... basedOn=...> asset.",
  "- Ensure there is an actual visual or camera change at least every 3 seconds across the timeline.",
  "- Camera motion/framing belongs on <visual> attributes, not on <image> assets.",
  "- `cameraZoom` means a static zoom/framing value only.",
  "- Use `cameraZoomStart` + `cameraZoomEnd` when you want an explicit animated zoom.",
  "- Keep camera motion sparse and subtle by default.",
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

function ensureSettingsDir() {
  fs.mkdirSync(path.dirname(SETTINGS_PATH), { recursive: true });
}

function normalizePromptTemplate(value: unknown) {
  if (typeof value !== "string" || !value.trim()) {
    return DEFAULT_PROMPT_TEMPLATE;
  }

  let normalized = value.replace(/\r/g, "").trim();
  for (const [legacyPlaceholder, replacement] of LEGACY_PLACEHOLDER_REPLACEMENTS) {
    normalized = normalized.replaceAll(legacyPlaceholder, replacement);
  }

  normalized = normalized.replace(/^[ \t]*Revision notes:\s*\{\{\s*revisionNotes\s*\}\}[ \t]*$/gm, "{{revisionNotesBlock}}");

  return normalized;
}

function normalizeRevisionNotesPromptTemplate(value: unknown) {
  if (typeof value !== "string" || !value.trim()) {
    return DEFAULT_REVISION_NOTES_PROMPT_TEMPLATE;
  }

  return value.replace(/\r/g, "").trim();
}

function normalize(candidate: Partial<ShortFormXmlVisualPlanningSettings> | null | undefined): ShortFormXmlVisualPlanningSettings {
  return {
    promptTemplate: normalizePromptTemplate(candidate?.promptTemplate),
    revisionNotesPromptTemplate: normalizeRevisionNotesPromptTemplate(candidate?.revisionNotesPromptTemplate),
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
  const withConditionalRevisionNotesBlock = template.replace(
    /^[ \t]*\{\{\s*revisionNotesBlock\s*\}\}[ \t]*\n?/gm,
    values.revisionNotesBlock ? `${values.revisionNotesBlock}\n` : ""
  );

  return withConditionalRevisionNotesBlock.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_match, key: string) => values[key] ?? "");
}
