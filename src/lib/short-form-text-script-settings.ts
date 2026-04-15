import fs from "fs";
import path from "path";
import { SHORT_FORM_VIDEOS_DIR } from "@/lib/short-form-videos";

export interface ShortFormTextScriptSettings {
  defaultMaxIterations: number;
  generatePrompt: string;
  revisePrompt: string;
  reviewPrompt: string;
}

const SETTINGS_PATH = path.join(SHORT_FORM_VIDEOS_DIR, "_text-script-settings.json");
const LEGACY_WORKFLOW_SETTINGS_PATH = path.join(SHORT_FORM_VIDEOS_DIR, "_workflow-settings.json");
export const SHORT_FORM_TEXT_SCRIPT_PASSING_SCORE = 95;

const DEFAULT_GENERATE_WRITER_FRAGMENT = [
  "Create the plain full text script for the Agent Dashboard short-form workflow.",
  "Topic: {{topic}}",
  "Selected hook: {{selectedHookTextOrFallback}}",
  "Use the `video-script-retention` skill as the retention rulebook for this draft. Do not recreate the playbook inside this prompt.",
  "Use the approved research and selected hook to write the narration text only — no XML, no scene list, no image directions.",
  "Use the approved research as actual proof, not just background context. When it includes studies, statistics, named findings, measurements, or other concrete data, work the strongest specifics directly into the script to support claims and increase credibility.",
  "Prefer concrete research-backed details over vague authority language like 'research shows' or 'studies say' when the approved research gives you something more specific.",
  "Keep the research usage persuasive and spoken-natural. The script should feel sharp, engaging, and high-retention, not dry, citation-heavy, or academic.",
  "Write the finished text script to disk — do not stop at a draft in chat.",
  "Save to: {{scriptPath}}",
  "Use YAML front matter with title, status: needs review, date, agent: Scribe, tags: [short-form-video, text-script].",
  "The body after front matter must be plain script prose only.",
  "Return YAML front matter followed by the plain text script only — no prose before or after the artifact, and no markdown code fences.",
  "Target total runtime roughly 60–120 seconds.",
  "The first sentence is the hook and must be 10 or fewer words.",
  "Write the hook as a normal opening sentence in the same paragraph as the rest of the script — do not put it on its own line or add a special line break after it.",
  "End the hook sentence with a period.",
  "Do not write captions, scene breakdowns, timing marks, XML tags, bullet lists, or image notes in this artifact.",
  "Approved research:\n{{approvedResearch}}",
  "Project directory: {{projectDir}}",
].join("\n\n");

const DEFAULT_REVISE_WRITER_FRAGMENT = [
  "Create the plain full text script for the Agent Dashboard short-form workflow.",
  "Topic: {{topic}}",
  "Selected hook: {{selectedHookTextOrFallback}}",
  "Use the `video-script-retention` skill as the retention rulebook for this rewrite. Do not recreate the playbook inside this prompt.",
  "{{revisionInstructionLine}}",
  "Rebuild the script around the approved research, not around generic claims. When the approved research includes studies, statistics, named findings, measurements, or other concrete data, use the strongest relevant specifics directly in the narration where they make the point more credible and persuasive.",
  "Prefer concrete research-backed details over vague authority language like 'research shows' or 'studies say' when the approved research gives you something more specific.",
  "Keep the research usage persuasive and spoken-natural. The rewrite should stay bold, engaging, and high-retention rather than drifting into dry or academic phrasing.",
  "Update the existing text script on disk in place — do not stop at a draft in chat.",
  "Save to: {{scriptPath}}",
  "Use YAML front matter with title, status: needs review, date, agent: Scribe, tags: [short-form-video, text-script].",
  "The body after front matter must be plain script prose only.",
  "Return YAML front matter followed by the plain text script only — no prose before or after the artifact, and no markdown code fences.",
  "Target total runtime roughly 60–120 seconds unless the feedback clearly asks for something else.",
  "Keep the first sentence as the hook within 10 or fewer words.",
  "Keep the hook as a normal opening sentence in the same paragraph as the rest of the script — no standalone hook line and no special line break after it.",
  "End the hook sentence with a period.",
  "Do not write captions, scene breakdowns, timing marks, XML tags, bullet lists, or image notes in this artifact.",
  "Approved research:\n{{approvedResearch}}",
  "Project directory: {{projectDir}}",
].join("\n\n");

const DEFAULT_REVIEW_FRAGMENT = [
  "Use the `video-script-retention-grader` skill for every text-script review in this workflow.",
  "",
  "Read these exact grading references before scoring the draft:",
  "- {{graderSkillPath}}",
  "- {{graderRubricPath}}",
  "",
  "Review the current short-form narration draft against the rubric and the approved research already present in the run context.",
  "",
  "Required output and file-handling rules:",
  "- Save each review to the matching `iterations/NN-review.md` path for that draft.",
  "- Follow the skill's required output format exactly: `Readable report` first, then one fenced `json` block.",
  "- The JSON block must stay valid and complete because the workflow copies `overall_grade.score_100`, the decision, and rewrite-ready feedback into `{{runManifestPath}}`.",
  "- Set the review decision to `pass` only when `overall_grade.score_100 >= {{passingScore}}`; otherwise set it to `needs-improvement`.",
  "- After each review, update the matching iteration entry in `{{runManifestPath}}` with the overall grade, decision, summary, and actionable feedback from the review output.",
  "",
  "Research-grounding rules:",
  "- Use the approved research from the run context as grading context, not just the draft in isolation.",
  "- If the approved research includes studies, statistics, named findings, measurements, or other concrete data, grade whether the script uses the strongest relevant specifics directly and persuasively instead of falling back to vague lines like `research shows`.",
  "- If the script leaves strong approved research unused, or uses it vaguely when specifics were available, call that out clearly in the rule-by-rule feedback, top fixes, and overall grade.",
  "- Reward scripts that turn research details into credibility and authority without sounding dry, citation-heavy, or academic.",
  "- Keep the feedback rewrite-ready so the next draft can act on it directly.",
].join("\n");

const LEGACY_REVIEW_PROMPT_MARKERS = [
  "Review the current short-form narration draft and decide whether it passes or needs improvement.",
  "Decision rules:",
  "Core criteria:",
  "- there should always be one or more curiosity loops open",
];

const PRE_RESEARCH_DEFAULT_REVIEW_PROMPT_MARKERS = [
  "Use the `video-script-retention-grader` skill for every text-script review in this workflow.",
  "Follow the skill's required output format exactly: `Readable report` first, then `JSON report` with one fenced `json` block.",
  "Keep the feedback rewrite-ready so the next draft can act on it directly.",
  "The JSON report must stay valid and complete because the workflow copies its overall grade into run.json.",
];

function buildWriterPromptTemplate(fragment: string) {
  return [
    "You are handling exactly one writer iteration inside the Agent Dashboard short-form text-script workflow.",
    "The backend owns the draft -> grade -> improve loop. Do not self-manage multiple iterations, do not grade your own draft, and do not update run.json.",
    "",
    "Read and follow these exact writer references before drafting:",
    "- {{retentionSkillPath}}",
    "- {{retentionPlaybookPath}}",
    "",
    "Workflow context:",
    "- Topic: {{topic}}",
    "- Selected hook: {{selectedHookTextOrFallback}}",
    "- Workflow mode: {{workflowMode}}",
    "- Current iteration: {{iterationNumber}} of {{maxIterations}}",
    "- Iteration draft output path: {{draftPath}}",
    "- Final published script path: {{scriptPath}}",
    "- Run manifest path: {{runManifestPath}}",
    "- Revision notes: {{revisionNotesOrNone}}",
    "",
    "Approved research:",
    "{{approvedResearch}}",
    "",
    "{{priorDraftBlock}}",
    "{{priorReviewBlock}}",
    `Override note: if the dashboard writer instructions below mention a final "Save to:" path, ignore that path for this session and write only to {{draftPath}}. The backend will publish the final approved draft to {{scriptPath}} later.`,
    "",
    "Dashboard writer instructions for this project:",
    fragment,
    "",
    "Artifact requirements:",
    "- Write exactly one YAML-front-matter markdown draft to {{draftPath}}.",
    "- The body after front matter must be plain narration prose only.",
    "- Do not include XML, scene lists, image notes, grader feedback, bullet lists, or markdown code fences in the body.",
    "- After writing, read back {{draftPath}} and verify the body contains no XML tags like <video>, <script>, <scene>, <text>, or <image>.",
    "- End after that single draft is written and verified.",
  ].join("\n");
}

function buildReviewPromptTemplate(fragment: string) {
  return [
    "You are handling exactly one grader iteration inside the Agent Dashboard short-form text-script workflow.",
    "The backend owns the draft -> grade -> improve loop. Do not rewrite the draft, do not self-manage multiple iterations, and do not update run.json.",
    "",
    "Use the `video-script-retention-grader` skill for this review and read these exact grading references before scoring:",
    "- {{graderSkillPath}}",
    "- {{graderRubricPath}}",
    "",
    "Workflow context:",
    "- Topic: {{topic}}",
    "- Selected hook: {{selectedHookTextOrFallback}}",
    "- Current iteration: {{iterationNumber}} of {{maxIterations}}",
    "- Passing score: {{passingScore}}/100",
    "- Draft input path: {{draftPath}}",
    "- Review output path: {{reviewPath}}",
    "- Run manifest path: {{runManifestPath}}",
    "",
    "Approved research:",
    "{{approvedResearch}}",
    "",
    "Current draft content:",
    "{{draftBody}}",
    "",
    "Dashboard grader instructions for this project:",
    fragment,
    "",
    "Artifact requirements:",
    "- Save the full readable report plus the required fenced JSON report to {{reviewPath}}.",
    "- Follow the grader skill's required output format exactly: `Readable report` first, then one fenced `json` block.",
    "- The JSON must be valid and complete, with one rules entry for every rubric rule.",
    "- The backend will decide pass vs needs-improvement using {{passingScore}}/100 and will update run.json itself. Do not edit run.json.",
    "- After writing, read back {{reviewPath}} and verify the fenced JSON block parses cleanly.",
  ].join("\n");
}

const DEFAULT_SHORT_FORM_TEXT_SCRIPT_SETTINGS: ShortFormTextScriptSettings = {
  defaultMaxIterations: 3,
  generatePrompt: buildWriterPromptTemplate(DEFAULT_GENERATE_WRITER_FRAGMENT),
  revisePrompt: buildWriterPromptTemplate(DEFAULT_REVISE_WRITER_FRAGMENT),
  reviewPrompt: buildReviewPromptTemplate(DEFAULT_REVIEW_FRAGMENT),
};

const FULL_WRITER_PROMPT_MARKERS = [
  "You are handling exactly one writer iteration inside the Agent Dashboard short-form text-script workflow.",
  "{{draftPath}}",
  "{{runManifestPath}}",
  "Dashboard writer instructions for this project:",
  "Artifact requirements:",
];

const FULL_REVIEW_PROMPT_MARKERS = [
  "You are handling exactly one grader iteration inside the Agent Dashboard short-form text-script workflow.",
  "{{reviewPath}}",
  "{{draftBody}}",
  "Dashboard grader instructions for this project:",
  "Artifact requirements:",
];

function ensureSettingsDir() {
  fs.mkdirSync(path.dirname(SETTINGS_PATH), { recursive: true });
}

function normalizePromptText(value: string) {
  return value.replace(/\r/g, "").trim();
}

function readLegacyWorkflowSettings() {
  if (!fs.existsSync(LEGACY_WORKFLOW_SETTINGS_PATH)) {
    return {};
  }

  try {
    const parsed = JSON.parse(fs.readFileSync(LEGACY_WORKFLOW_SETTINGS_PATH, "utf-8")) as {
      scriptGenerate?: unknown;
      scriptRevise?: unknown;
    };
    return {
      scriptGenerate: typeof parsed.scriptGenerate === "string" ? parsed.scriptGenerate : undefined,
      scriptRevise: typeof parsed.scriptRevise === "string" ? parsed.scriptRevise : undefined,
    };
  } catch {
    return {};
  }
}

function usesCurrentResearchSpecificityLanguage(prompt: string) {
  return /Use the approved research as actual proof/i.test(prompt)
    || /Rebuild the script around the approved research/i.test(prompt)
    || /Use the approved research and selected hook to write the narration text only/i.test(prompt);
}

function shouldResetLegacyWriterFragment(kind: "generate" | "revise", fragment: string) {
  const normalized = normalizePromptText(fragment);
  return /Create an XML short-form video script/i.test(normalized)
    || /Required XML shape:/i.test(normalized)
    || /The markdown body after front matter must be raw XML only\./i.test(normalized)
    || /<scene><text>caption<\/text><image>visual direction<\/image><\/scene>/i.test(normalized)
    || /Revise the existing XML script based on this feedback:/i.test(normalized)
    || /Target total runtime roughly 25(?:\s*[–-]\s*| to )50 seconds/i.test(normalized)
    || (
      /Use curiosity loops aggressively/i.test(normalized)
      && /Avoid hedging and throat-clearing/i.test(normalized)
      && !/video-script-retention/i.test(normalized)
    )
    || (
      /Use the `video-script-retention` skill as the retention rulebook/i.test(normalized)
      && /Approved research:\s*\{\{approvedResearch\}\}/i.test(normalized)
      && !usesCurrentResearchSpecificityLanguage(normalized)
    )
    || (kind === "revise" && /Target total runtime roughly 60(?:\s*[–-]\s*| to )120 seconds/i.test(normalized) === false
      && /Target total runtime roughly/i.test(normalized));
}

function normalizeLegacyWriterFragment(
  kind: "generate" | "revise",
  value: unknown,
  { migrateLegacy }: { migrateLegacy: boolean }
) {
  const fallback = kind === "generate" ? DEFAULT_GENERATE_WRITER_FRAGMENT : DEFAULT_REVISE_WRITER_FRAGMENT;
  if (typeof value !== "string" || !value.trim()) {
    return fallback;
  }

  const normalized = normalizePromptText(value);
  if (migrateLegacy && shouldResetLegacyWriterFragment(kind, normalized)) {
    return fallback;
  }
  return normalized;
}

function stripEmbeddedLegacyReviewFragment(prompt: string) {
  const legacyStart = prompt.indexOf("Review the current short-form narration draft and decide whether it passes or needs improvement.");
  if (legacyStart === -1) return prompt;

  const prefix = prompt.slice(0, legacyStart).trimEnd();
  return prefix || DEFAULT_REVIEW_FRAGMENT;
}

function normalizeGeneratePrompt(
  value: unknown,
  options: { migrateLegacy: boolean; legacyFragment?: string }
) {
  const fallback = buildWriterPromptTemplate(
    normalizeLegacyWriterFragment("generate", options.legacyFragment, options)
  );
  if (typeof value !== "string" || !value.trim()) {
    return fallback;
  }

  const normalized = normalizePromptText(value);
  if (!options.migrateLegacy) {
    return normalized;
  }
  if (FULL_WRITER_PROMPT_MARKERS.every((marker) => normalized.includes(marker))) {
    return normalized;
  }

  return buildWriterPromptTemplate(normalizeLegacyWriterFragment("generate", normalized, options));
}

function normalizeRevisePrompt(
  value: unknown,
  options: { migrateLegacy: boolean; legacyFragment?: string }
) {
  const fallback = buildWriterPromptTemplate(
    normalizeLegacyWriterFragment("revise", options.legacyFragment, options)
  );
  if (typeof value !== "string" || !value.trim()) {
    return fallback;
  }

  const normalized = normalizePromptText(value);
  if (!options.migrateLegacy) {
    return normalized;
  }
  if (FULL_WRITER_PROMPT_MARKERS.every((marker) => normalized.includes(marker))) {
    return normalized;
  }

  return buildWriterPromptTemplate(normalizeLegacyWriterFragment("revise", normalized, options));
}

function normalizeReviewPrompt(value: unknown, { migrateLegacy }: { migrateLegacy: boolean }) {
  if (typeof value !== "string" || !value.trim()) {
    return DEFAULT_SHORT_FORM_TEXT_SCRIPT_SETTINGS.reviewPrompt;
  }

  const stripped = stripEmbeddedLegacyReviewFragment(normalizePromptText(value));
  if (!migrateLegacy) {
    return stripped;
  }
  if (FULL_REVIEW_PROMPT_MARKERS.every((marker) => stripped.includes(marker))) {
    return stripped;
  }
  if (LEGACY_REVIEW_PROMPT_MARKERS.every((marker) => stripped.includes(marker))) {
    return DEFAULT_SHORT_FORM_TEXT_SCRIPT_SETTINGS.reviewPrompt;
  }
  if (
    PRE_RESEARCH_DEFAULT_REVIEW_PROMPT_MARKERS.every((marker) => stripped.includes(marker))
    && !stripped.includes("Use the approved research from the run context as grading context")
  ) {
    return DEFAULT_SHORT_FORM_TEXT_SCRIPT_SETTINGS.reviewPrompt;
  }
  if (
    stripped.includes("Use the `video-script-retention-grader` skill")
    || stripped.includes("Follow the skill's required output format exactly")
    || stripped.includes("Review the current short-form narration draft")
    || stripped.includes("overall_grade.score_100")
    || stripped.includes("JSON report")
  ) {
    return buildReviewPromptTemplate(stripped);
  }

  return stripped;
}

function normalize(
  candidate: Partial<ShortFormTextScriptSettings> | null | undefined,
  options: { migrateLegacy: boolean }
): ShortFormTextScriptSettings {
  const defaultMaxIterationsRaw = candidate?.defaultMaxIterations;
  const defaultMaxIterations = typeof defaultMaxIterationsRaw === "number" && Number.isFinite(defaultMaxIterationsRaw)
    ? Math.max(1, Math.min(8, Math.round(defaultMaxIterationsRaw)))
    : DEFAULT_SHORT_FORM_TEXT_SCRIPT_SETTINGS.defaultMaxIterations;

  const legacyWorkflowSettings = options.migrateLegacy ? readLegacyWorkflowSettings() : {};

  return {
    defaultMaxIterations,
    generatePrompt: normalizeGeneratePrompt(candidate?.generatePrompt, {
      migrateLegacy: options.migrateLegacy,
      legacyFragment: legacyWorkflowSettings.scriptGenerate,
    }),
    revisePrompt: normalizeRevisePrompt(candidate?.revisePrompt, {
      migrateLegacy: options.migrateLegacy,
      legacyFragment: legacyWorkflowSettings.scriptRevise,
    }),
    reviewPrompt: normalizeReviewPrompt(candidate?.reviewPrompt, options),
  };
}

export function getShortFormTextScriptSettings(): ShortFormTextScriptSettings {
  let parsed: Partial<ShortFormTextScriptSettings> | undefined;
  if (fs.existsSync(SETTINGS_PATH)) {
    try {
      parsed = JSON.parse(fs.readFileSync(SETTINGS_PATH, "utf-8")) as Partial<ShortFormTextScriptSettings>;
    } catch {
      parsed = undefined;
    }
  }

  return normalize(parsed, { migrateLegacy: true });
}

export function saveShortFormTextScriptSettings(patch: Partial<ShortFormTextScriptSettings>) {
  ensureSettingsDir();
  const current = getShortFormTextScriptSettings();
  const next = normalize({ ...current, ...patch }, { migrateLegacy: false });
  fs.writeFileSync(SETTINGS_PATH, JSON.stringify(next, null, 2), "utf-8");
  return next;
}
