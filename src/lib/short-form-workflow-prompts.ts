import fs from "fs";
import path from "path";
import type { ShortFormStageKey } from "@/lib/short-form-videos";
import { getVersionedShortFormSettingsPath } from "@/lib/short-form-settings-paths";

export type ShortFormPromptKey =
  | "hooksGenerate"
  | "hooksMore"
  | "researchGenerate"
  | "researchRevise"
  | "sceneImagesGenerate"
  | "sceneImagesRevise"
  | "videoGenerate"
  | "videoRevise";

export interface ShortFormPromptDefinition {
  key: ShortFormPromptKey;
  title: string;
  description: string;
  stage: "hooks" | ShortFormStageKey;
}

export type ShortFormWorkflowPrompts = Record<ShortFormPromptKey, string>;

export const SHORT_FORM_PROMPT_DEFINITIONS: ShortFormPromptDefinition[] = [
  {
    key: "hooksGenerate",
    title: "Hook generation",
    description: "Initial hook generation request sent to Scribe/content-hooks.",
    stage: "hooks",
  },
  {
    key: "hooksMore",
    title: "More hooks",
    description: "Additional hook generation when the user requests another batch.",
    stage: "hooks",
  },
  {
    key: "researchGenerate",
    title: "Research generation",
    description: "Initial research request sent to Oracle after a hook is selected.",
    stage: "research",
  },
  {
    key: "researchRevise",
    title: "Research revision",
    description: "Revision request sent to Oracle when research needs changes.",
    stage: "research",
  },
  {
    key: "sceneImagesGenerate",
    title: "Scene image generation",
    description: "Initial storyboard image request handled by the direct dashboard xml-scene-images workflow.",
    stage: "scene-images",
  },
  {
    key: "sceneImagesRevise",
    title: "Scene image revision",
    description: "Revision request for the direct scene-image workflow, including single-scene change requests.",
    stage: "scene-images",
  },
  {
    key: "videoGenerate",
    title: "Final video generation",
    description: "Initial render request handled by the direct dashboard xml-scene-video workflow.",
    stage: "video",
  },
  {
    key: "videoRevise",
    title: "Final video revision",
    description: "Revision or regeneration request for the direct final-video workflow.",
    stage: "video",
  },
];

const SETTINGS_PATH = getVersionedShortFormSettingsPath("_workflow-settings.json");
const WORKFLOW_PROMPT_MIGRATIONS_KEY = "__workflowPromptMigrations";
const LEGACY_RESEARCH_XML_PROMPT_RESET_KEY = "researchXmlPromptReset";

type StoredWorkflowPromptSettings = Record<string, unknown>;

const DEFAULT_SHORT_FORM_WORKFLOW_PROMPTS: ShortFormWorkflowPrompts = {
  hooksGenerate: [
    "You are working on a short-form video project in the Agent Dashboard web app.",
    "Topic: {{topic}}",
    "{{selectedHookLine}}",
    "Generate multiple short-form video hooks for this topic using the content-hooks skill.",
    "{{priorHooksBlock}}",
    "Produce 5 strong hook options optimized for vertical short-form video.",
    "Each option should be punchy, immediately visual, and no more than 10 words long.",
    "Keep hook punctuation minimal: no dashes, colons, semicolons, or periods. Apostrophes, quotes, and parentheses are okay if truly needed.",
    "{{hooksPayloadHint}}",
    "Project directory: {{projectDir}}",
  ].join("\n\n"),
  hooksMore: [
    "You are working on a short-form video project in the Agent Dashboard web app.",
    "Topic: {{topic}}",
    "{{selectedHookLine}}",
    "Generate additional hooks. Extra direction from user: {{descriptionOrFallback}}",
    "{{priorHooksBlock}}",
    "Produce 5 strong hook options optimized for vertical short-form video.",
    "Each option should be punchy, immediately visual, and no more than 10 words long.",
    "Keep hook punctuation minimal: no dashes, colons, semicolons, or periods. Apostrophes, quotes, and parentheses are okay if truly needed.",
    "{{hooksPayloadHint}}",
    "Project directory: {{projectDir}}",
  ].join("\n\n"),
  researchGenerate: [
    "Create research for a short-form video project.",
    "Topic: {{topic}}",
    "{{selectedHookLine}}",
    "Write concise but substantive research that will support a short-form video script.",
    "Write the finished artifact to disk — do not stop at a draft in chat.",
    "Save to: {{researchPath}}",
    "Execution contract:",
    "- This is an artifact-writing task for the Research stage.",
    "- You must create the on-disk artifact, not just draft the content in chat.",
    "- Required artifact path: {{researchPath}}",
    "- Use the write/edit tool on the exact path above.",
    "- Before finishing, read back {{researchPath}} and verify the research is present.",
    "- If you cannot write or verify the artifact, explicitly say the task FAILED and explain why.",
    "Use YAML front matter with title, status: needs review, date, agent: Oracle, tags: [short-form-video, research].",
    "The body should be markdown and should help Scribe write a strong plain narration script first, then later inform the XML captions + visuals step.",
    "Project directory: {{projectDir}}",
  ].join("\n\n"),
  researchRevise: [
    "Create research for a short-form video project.",
    "Topic: {{topic}}",
    "{{selectedHookLine}}",
    "Revise the existing research based on this feedback:\n{{notesOrFallback}}",
    "Update the on-disk artifact in place — do not stop at a draft in chat.",
    "Save to: {{researchPath}}",
    "Execution contract:",
    "- This is an artifact-writing task for the Research stage.",
    "- You must update the existing on-disk artifact in place, not just draft the content in chat.",
    "- Required artifact path: {{researchPath}}",
    "- Use the write/edit tool on the exact path above. Do not create a second alternate file.",
    "- Before finishing, read back {{researchPath}} and verify the revised research is present.",
    "- If you cannot write or verify the artifact, explicitly say the task FAILED and explain why.",
    "Use YAML front matter with title, status: needs review, date, agent: Oracle, tags: [short-form-video, research].",
    "The body should be markdown and should help Scribe write a strong plain narration script first, then later inform the XML captions + visuals step.",
    "Project directory: {{projectDir}}",
  ].join("\n\n"),
  sceneImagesGenerate: [
    "Generate visuals for a short-form XML script using the xml-scene-images skill.",
    "Topic: {{topic}}",
    "Selected hook: {{selectedHookTextOrFallback}}",
    "Generate the scene-image set from the XML script.",
    "You must write the required review doc and manifest files to disk before finishing.",
    "Read script from: {{scriptPath}}",
    "CRITICAL IMAGE RULE: the generated art from Nano Banana / the image model must contain NO baked-in text, letters, subtitles, labels, UI chrome, or watermark. Captions are added separately later.",
    "CRITICAL COMPOSITION RULE: every scene image must feel like one unified full-frame composition, not a collage, inset card, framed print, mockup, split-panel, picture-in-picture, sticker cutout, or cropped foreground pasted onto a separate background.",
    "Do not generate white borders, paper frames, margins, boxed inserts, polaroid/card treatment, floating portrait rectangles, or separate top/bottom panels. The charcoal/dark background must belong to the same actual scene and continue naturally behind the subject.",
    "Preserve top caption-safe headroom by letting the real scene background continue upward into very dark negative space with a soft gradient / atmospheric falloff. Never interpret that safe area as a literal header, banner, title-card region, plaque, boxed strip, or other clean rectangular top block.",
    "Avoid any hard horizontal divider near the top. The background, lighting, haze, and texture should flow continuously through the full frame, with the upper region feeling like a natural extension of the same environment rather than a separate panel.",
    "If a scene direction implies comparison, anatomy emphasis, or multiple ideas, solve it inside one cohesive composition using lighting, pose, depth, or subtle integrated visual cues — not divider lines, before/after cards, side-by-side tiles, or framed sub-images.",
    "Use the XML <script> only as story context. Read visuals from <timeline><visual>; generated image prompts are defined inline as <visual><image><prompt>...</prompt></image></visual> at the first timeline use.",
    "Use each <visual> label as the manifest/review caption metadata, not as text to render inside the generated artwork.",
    "Honor XML v2 image reuse deterministically: a later <visual imageId=\"earlier-visual-or-image-id\"> reuses that earlier visual image instead of regenerating it.",
    "Honor XML v2 image derivation deterministically: when an inline <visual><image basedOn=\"earlier-visual-or-image-id\"> uses basedOn, generate that derived image after its earlier parent and use the parent image as the reference input.",
    "If the selected style supplies a primary character reference, treat that character's visible outfit/wardrobe as part of the stable identity and preserve it across scene generation and revisions unless the XML scene direction explicitly calls for a change.",
    "Favor soft cohesive blending and full-bleed composition. The main subject should feel naturally embedded in the environment/background, with no harsh rectangular crop edges or pasted-on foreground look.",
    "Save a review document to: {{sceneDocPath}} with YAML front matter including status: needs review and a short markdown summary.",
    "Also save a strict JSON manifest to: {{sceneManifestPath}}",
    "Execution contract:",
    "- This is an artifact-writing task for the Generate Visuals stage.",
    "- You must create the required on-disk artifacts, not just draft content in chat.",
    "- Required artifact paths: {{sceneDocPath}} and {{sceneManifestPath}}",
    "- Use the write/edit tool on the exact paths above.",
    "- Before finishing, read back {{sceneDocPath}} and {{sceneManifestPath}} and confirm the manifest is valid JSON with a non-empty top-level scenes array.",
    "- If you cannot write or verify the artifacts, explicitly say the task FAILED and explain why.",
    "Manifest shape: { \"scenes\": [ { \"id\": \"scene-1\", \"number\": 1, \"caption\": \"...\", \"image\": \"scenes/scene-01-uncaptioned-1080x1920.png\", \"previewImage\": \"scenes/scene-01-captioned-1080x1920.png\", \"notes\": \"optional\" } ] }",
    "Validation rules: output valid JSON only with no markdown fences/comments/trailing commas; scenes must be an array; every scene needs a non-empty id, unique positive integer number, non-empty caption, and at least one relative project path in image or previewImage; notes is optional but must be a string if included.",
    "The previewImage should be the captioned preview. The image should be the clean scene image.",
    "Project directory: {{projectDir}}",
  ].join("\n\n"),
  sceneImagesRevise: [
    "Generate visuals for a short-form XML script using the xml-scene-images skill.",
    "Topic: {{topic}}",
    "Selected hook: {{selectedHookTextOrFallback}}",
    "Revise the scene images based on this feedback:\n{{notesOrFallback}}",
    "You must update the required review doc and manifest files on disk before finishing.",
    "Read script from: {{scriptPath}}",
    "CRITICAL IMAGE RULE: the generated art from Nano Banana / the image model must contain NO baked-in text, letters, subtitles, labels, UI chrome, or watermark. Captions are added separately later.",
    "CRITICAL COMPOSITION RULE: every scene image must feel like one unified full-frame composition, not a collage, inset card, framed print, mockup, split-panel, picture-in-picture, sticker cutout, or cropped foreground pasted onto a separate background.",
    "Do not generate white borders, paper frames, margins, boxed inserts, polaroid/card treatment, floating portrait rectangles, or separate top/bottom panels. The charcoal/dark background must belong to the same actual scene and continue naturally behind the subject.",
    "Preserve top caption-safe headroom by letting the real scene background continue upward into very dark negative space with a soft gradient / atmospheric falloff. Never interpret that safe area as a literal header, banner, title-card region, plaque, boxed strip, or other clean rectangular top block.",
    "Avoid any hard horizontal divider near the top. The background, lighting, haze, and texture should flow continuously through the full frame, with the upper region feeling like a natural extension of the same environment rather than a separate panel.",
    "If a scene direction implies comparison, anatomy emphasis, or multiple ideas, solve it inside one cohesive composition using lighting, pose, depth, or subtle integrated visual cues — not divider lines, before/after cards, side-by-side tiles, or framed sub-images.",
    "Use the XML <script> only as story context. Read visuals from <timeline><visual>; generated image prompts are defined inline as <visual><image><prompt>...</prompt></image></visual> at the first timeline use.",
    "Use each <visual> label as the manifest/review caption metadata, not as text to render inside the generated artwork.",
    "Honor XML v2 image reuse deterministically: a later <visual imageId=\"earlier-visual-or-image-id\"> reuses that earlier visual image instead of regenerating it.",
    "Honor XML v2 image derivation deterministically: when an inline <visual><image basedOn=\"earlier-visual-or-image-id\"> uses basedOn, generate that derived image after its earlier parent and use the parent image as the reference input.",
    "If the selected style supplies a primary character reference, treat that character's visible outfit/wardrobe as part of the stable identity and preserve it across scene generation and revisions unless the XML scene direction explicitly calls for a change.",
    "Favor soft cohesive blending and full-bleed composition. The main subject should feel naturally embedded in the environment/background, with no harsh rectangular crop edges or pasted-on foreground look.",
    "Save a review document to: {{sceneDocPath}} with YAML front matter including status: needs review and a short markdown summary.",
    "Also save a strict JSON manifest to: {{sceneManifestPath}}",
    "Execution contract:",
    "- This is an artifact-writing task for the Generate Visuals stage.",
    "- You must update the required on-disk artifacts in place, not just draft content in chat.",
    "- Required artifact paths: {{sceneDocPath}} and {{sceneManifestPath}}",
    "- Use the write/edit tool on the exact paths above. Do not create second alternate files.",
    "- Before finishing, read back {{sceneDocPath}} and {{sceneManifestPath}} and confirm the manifest is valid JSON with a non-empty top-level scenes array.",
    "- If you cannot write or verify the artifacts, explicitly say the task FAILED and explain why.",
    "Manifest shape: { \"scenes\": [ { \"id\": \"scene-1\", \"number\": 1, \"caption\": \"...\", \"image\": \"scenes/scene-01-uncaptioned-1080x1920.png\", \"previewImage\": \"scenes/scene-01-captioned-1080x1920.png\", \"notes\": \"optional\" } ] }",
    "Validation rules: output valid JSON only with no markdown fences/comments/trailing commas; scenes must be an array; every scene needs a non-empty id, unique positive integer number, non-empty caption, and at least one relative project path in image or previewImage; notes is optional but must be a string if included.",
    "The previewImage should be the captioned preview. The image should be the clean scene image.",
    "Project directory: {{projectDir}}",
  ].join("\n\n"),
  videoGenerate: [
    "Generate the final short-form video using the xml-scene-video skill.",
    "Topic: {{topic}}",
    "Render the final vertical short-form video from the XML script and generated visuals.",
    "Use the updated xml-scene-video defaults explicitly: full-video Qwen3-TTS narration, transcript-driven Qwen3-ForcedAligner-0.6B timing against the known full script, and no renderer-level fallback music.",
    "Do not invoke ACE-Step or any other music generator from this workflow. Final audio comes from the approved Generate Sound Design mix, including any planned music segments.",
    "Do not switch to macOS say unless Qwen fails and an emergency fallback is absolutely required. Qwen should be the intended path for this workflow.",
    "Use the skill's bundled generate_video.py workflow rather than rebuilding the ffmpeg/TTS/music pipeline ad hoc.",
    "Recommended command shape: uv run --with pillow python3 ~/.openclaw/skills/xml-scene-video/scripts/generate_video.py --xml {{scriptPath}} --images-dir {{sceneImagesDir}} --output {{finalVideoPath}} --work-dir {{videoWorkDir}} --tts-engine qwen --existing-voice {{xmlNarrationPath}} --existing-alignment {{xmlAlignmentPath}} --no-music --force",
    "Use the scene manifest to confirm scene ordering/captions, but assemble from the generated image files in {{sceneImagesDir}} using the uncaptioned assets for motion and caption overlays separately.",
    "Read any per-scene cameraPanX, cameraPanY, cameraZoom, cameraZoomStart, cameraZoomEnd, and cameraShake attributes from the XML and apply them to the scene image motion only, not to the caption overlay layer.",
    "Camera motion is fully opt-in: if a cameraPanX/cameraPanY/cameraZoom/cameraZoomStart/cameraZoomEnd/cameraShake attribute is omitted, do not apply that effect. `cameraZoom` means static framing only; animated zoom should only happen when cameraZoomStart/cameraZoomEnd are explicitly present. If a scene omits all camera motion attributes, render it with no added camera motion.",
    "You must write both the playable video artifact and the review doc to disk before finishing.",
    "Read script from: {{scriptPath}}",
    "Read scene manifest from: {{sceneManifestPath}}",
    "Scene images directory: {{sceneImagesDir}}",
    "Working directory for generated intermediates: {{videoWorkDir}}",
    "Save the playable video to: {{finalVideoPath}}",
    "Save a markdown review document to: {{videoDocPath}} with YAML front matter including status: needs review and notes about what was generated. Mention that the default path used Qwen narration from the XML <script> plus the approved Generate Sound Design mix.",
    "Execution contract:",
    "- This is an artifact-writing task for the Final Video stage.",
    "- You must create the required playable video and review document on disk, not just describe the render in chat.",
    "- Required artifact paths: {{finalVideoPath}} and {{videoDocPath}}",
    "- Before finishing, confirm {{finalVideoPath}} exists and read back {{videoDocPath}}.",
    "- If you cannot write or verify the artifacts, explicitly say the task FAILED and explain why.",
    "Project directory: {{projectDir}}",
  ].join("\n\n"),
  videoRevise: [
    "Generate the final short-form video using the xml-scene-video skill.",
    "Topic: {{topic}}",
    "Revise or regenerate the final video based on this feedback:\n{{notesOrFallback}}",
    "Keep the updated xml-scene-video defaults explicit during the revision unless the feedback specifically requests something else: full-video Qwen3-TTS narration, transcript-driven Qwen3-ForcedAligner-0.6B timing against the known full script, and no renderer-level fallback music.",
    "Do not invoke ACE-Step or any other music generator from this workflow. Final audio comes from the approved Generate Sound Design mix, including any planned music segments.",
    "Do not switch to macOS say unless Qwen fails and an emergency fallback is absolutely required. Qwen should be the intended path for this workflow.",
    "Use the skill's bundled generate_video.py workflow rather than rebuilding the ffmpeg/TTS/music pipeline ad hoc.",
    "Recommended command shape: uv run --with pillow python3 ~/.openclaw/skills/xml-scene-video/scripts/generate_video.py --xml {{scriptPath}} --images-dir {{sceneImagesDir}} --output {{finalVideoPath}} --work-dir {{videoWorkDir}} --tts-engine qwen --existing-voice {{xmlNarrationPath}} --existing-alignment {{xmlAlignmentPath}} --no-music --force",
    "Use the scene manifest to confirm scene ordering/captions, but assemble from the generated image files in {{sceneImagesDir}} using the uncaptioned assets for motion and caption overlays separately.",
    "Read any per-scene cameraPanX, cameraPanY, cameraZoom, cameraZoomStart, cameraZoomEnd, and cameraShake attributes from the XML and apply them to the scene image motion only, not to the caption overlay layer.",
    "Camera motion is fully opt-in: if a cameraPanX/cameraPanY/cameraZoom/cameraZoomStart/cameraZoomEnd/cameraShake attribute is omitted, do not apply that effect. `cameraZoom` means static framing only; animated zoom should only happen when cameraZoomStart/cameraZoomEnd are explicitly present. If a scene omits all camera motion attributes, render it with no added camera motion.",
    "You must update both the playable video artifact and the review doc on disk before finishing.",
    "Read script from: {{scriptPath}}",
    "Read scene manifest from: {{sceneManifestPath}}",
    "Scene images directory: {{sceneImagesDir}}",
    "Working directory for generated intermediates: {{videoWorkDir}}",
    "Save the playable video to: {{finalVideoPath}}",
    "Save a markdown review document to: {{videoDocPath}} with YAML front matter including status: needs review and notes about what was generated. Mention that the revision stayed on the Qwen-from-<script> + approved Generate Sound Design mix path.",
    "Execution contract:",
    "- This is an artifact-writing task for the Final Video stage.",
    "- You must update the required playable video and review document on disk, not just describe the render in chat.",
    "- Required artifact paths: {{finalVideoPath}} and {{videoDocPath}}",
    "- Before finishing, confirm {{finalVideoPath}} exists and read back {{videoDocPath}}.",
    "- If you cannot write or verify the artifacts, explicitly say the task FAILED and explain why.",
    "Project directory: {{projectDir}}",
  ].join("\n\n"),
};

const SHORT_FORM_PROMPT_KEYS = Object.keys(DEFAULT_SHORT_FORM_WORKFLOW_PROMPTS) as ShortFormPromptKey[];

function ensureSettingsDir() {
  fs.mkdirSync(path.dirname(SETTINGS_PATH), { recursive: true });
}

function shouldResetStoredPrompt(key: ShortFormPromptKey, prompt: string) {
  const normalized = prompt.replace(/\r/g, "").trim();
  switch (key) {
    case "researchGenerate":
    case "researchRevise":
      return normalized.includes("help Scribe write a multi-scene vertical-video XML script");
    default:
      return false;
  }
}

function readStoredSettings(): StoredWorkflowPromptSettings {
  if (!fs.existsSync(SETTINGS_PATH)) return {};

  try {
    const parsed = JSON.parse(fs.readFileSync(SETTINGS_PATH, "utf-8")) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    return parsed as StoredWorkflowPromptSettings;
  } catch {
    return {};
  }
}

function hasCompletedLegacyResearchReset(stored: StoredWorkflowPromptSettings) {
  const migrations = stored[WORKFLOW_PROMPT_MIGRATIONS_KEY];
  return Boolean(
    migrations
      && typeof migrations === "object"
      && !Array.isArray(migrations)
      && (migrations as Record<string, unknown>)[LEGACY_RESEARCH_XML_PROMPT_RESET_KEY] === true
  );
}

function migrateStoredPrompts(stored: StoredWorkflowPromptSettings) {
  const migrated: Partial<ShortFormWorkflowPrompts> = {};
  const shouldRunLegacyResearchReset = !hasCompletedLegacyResearchReset(stored);

  for (const key of SHORT_FORM_PROMPT_KEYS) {
    const current = stored[key];
    if (typeof current !== "string") continue;
    if (shouldRunLegacyResearchReset && shouldResetStoredPrompt(key, current)) {
      migrated[key] = DEFAULT_SHORT_FORM_WORKFLOW_PROMPTS[key];
      continue;
    }
    migrated[key] = current;
  }
  return migrated;
}

function readStoredPrompts(): Partial<ShortFormWorkflowPrompts> {
  return migrateStoredPrompts(readStoredSettings());
}

export function getShortFormWorkflowPrompts(): ShortFormWorkflowPrompts {
  return {
    ...DEFAULT_SHORT_FORM_WORKFLOW_PROMPTS,
    ...readStoredPrompts(),
  };
}

function buildMigrationMetadata(stored: StoredWorkflowPromptSettings) {
  const existing = stored[WORKFLOW_PROMPT_MIGRATIONS_KEY];
  return {
    ...(existing && typeof existing === "object" && !Array.isArray(existing)
      ? (existing as Record<string, unknown>)
      : {}),
    [LEGACY_RESEARCH_XML_PROMPT_RESET_KEY]: true,
  };
}

export function saveShortFormWorkflowPrompts(nextPrompts: Partial<ShortFormWorkflowPrompts>) {
  ensureSettingsDir();
  const stored = readStoredSettings();
  const current = getShortFormWorkflowPrompts();
  const merged = {
    ...current,
    ...nextPrompts,
  } satisfies ShortFormWorkflowPrompts;

  const nextStored: StoredWorkflowPromptSettings = {
    ...stored,
    [WORKFLOW_PROMPT_MIGRATIONS_KEY]: buildMigrationMetadata(stored),
  };

  for (const key of SHORT_FORM_PROMPT_KEYS) {
    nextStored[key] = merged[key];
  }

  fs.writeFileSync(SETTINGS_PATH, JSON.stringify(nextStored, null, 2), "utf-8");
  return merged;
}

export function getShortFormPromptDefinitions() {
  return SHORT_FORM_PROMPT_DEFINITIONS;
}

export function renderShortFormPrompt(template: string, values: Record<string, string | undefined>) {
  return template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_match, key: string) => values[key] ?? "");
}
