import fs from "fs";
import path from "path";
import { getVersionedShortFormSettingsPath } from "@/lib/short-form-settings-paths";

export interface ShortFormHookSettings {
  hookWritingGuidelinesTemplate: string;
  hooksPayloadHintTemplate: string;
}

const SETTINGS_PATH = getVersionedShortFormSettingsPath("_hook-settings.json");

const DEFAULT_HOOK_WRITING_GUIDELINES_TEMPLATE = [
  "# Guidelines for writing short-form hooks",
  "",
  "You are writing spoken opener hooks for vertical short-form video. Do not use the content-hooks skill or any other separate hook-writing skill; all hook-writing rules are in this rendered prompt template.",
  "",
  "## Output standard",
  "- Generate hooks that sound natural when spoken out loud as the first sentence of a video.",
  "- Optimize for immediate viewer retention, not clever headline writing.",
  "- Default to 10 words or fewer unless the surrounding prompt explicitly allows more.",
  "- Make every hook immediately visual, concrete, and easy to understand on the first listen.",
  "- Keep punctuation minimal. Avoid dashes, colons, semicolons, and periods unless the surrounding prompt explicitly asks for them.",
  "- Avoid vague generic content words: tips, hacks, ways to, learn.",
  "- Avoid medical/legal certainty unless the topic and research explicitly support it.",
  "- Do not write clickbait that the video cannot pay off.",
  "",
  "## Core psychology",
  "- Curiosity: open a loop without explaining the whole answer.",
  "- Desire: name the visible outcome the viewer wants.",
  "- Pain: call out a mistake, hidden cause, or frustrating symptom.",
  "- Believability: use concrete details, mechanisms, science, or authority when available.",
  "- Specificity: prefer exact objects, behaviors, time windows, body parts, outcomes, or numbers over abstractions.",
  "- Contrast: make the viewer feel a useful before/after, normal/weird, obvious/hidden, or expected/unexpected gap.",
  "",
  "Every hook should use at least two of those levers.",
  "",
  "## Short-form hook shapes to adapt",
  "- Hidden cause: `Your [visible outcome] may come from [unexpected small cause]`.",
  "- Mistake warning: `Most people [do action] in the wrong direction`.",
  "- Mechanism reveal: `This tiny [habit/object/muscle] changes your [outcome]`.",
  "- Counterintuitive turn: `The fix is not [obvious thing]`.",
  "- Science-backed: `[Specific evidence/mechanism] explains why [surprising result]`.",
  "- Authority warning: `[Expert/source] would not start with [common action]`.",
  "- If I started today: `If I started [goal] today I would fix this first`.",
  "- One thing: `Use this one [cue/action] before [common problem]`.",
  "- Nobody tells you: `Nobody tells you [specific hidden truth]`.",
  "- Not behind yet: `You are not behind until you miss [specific trigger]`.",
  "",
  "## Quality checklist",
  "- The first three words create motion, tension, or specificity.",
  "- A viewer can picture the topic without reading the caption.",
  "- The hook promises a payoff the script can deliver quickly.",
  "- The hook is not just a title; it works as spoken narration.",
  "- The hook does not sound like a generic YouTube framework pasted onto the topic.",
  "- If five hooks are requested, make the five meaningfully different angles, not small rewrites.",
].join("\n");

const DEFAULT_HOOKS_PAYLOAD_HINT_TEMPLATE = [
  "Save the result to {{hooksPath}} as strict JSON with this shape:",
  "{",
  '  "generations": [',
  "    {",
  '      "id": "gen-001",',
  '      "createdAt": "ISO-8601",',
  '      "options": [',
  '        { "id": "hook-001", "text": "..." }',
  "      ]",
  "    }",
  "  ]",
  "}",
  "Validation rules:",
  "- Output valid JSON only. No markdown fences, comments, prose, or trailing commas.",
  "- generations must be an array.",
  "- Every generation needs a non-empty id, valid createdAt timestamp, and a non-empty options array.",
  "- Every option needs only a non-empty id and text.",
  "- Do not add any other fields to generations or individual hooks.",
  "- If the file already exists, read it first and append a new generation instead of overwriting earlier generations.",
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

function normalize(candidate: Partial<ShortFormHookSettings> | null | undefined): ShortFormHookSettings {
  return {
    hookWritingGuidelinesTemplate: normalizePromptTemplate(
      candidate?.hookWritingGuidelinesTemplate,
      DEFAULT_HOOK_WRITING_GUIDELINES_TEMPLATE,
    ),
    hooksPayloadHintTemplate: normalizePromptTemplate(
      candidate?.hooksPayloadHintTemplate,
      DEFAULT_HOOKS_PAYLOAD_HINT_TEMPLATE,
    ),
  };
}

export function getShortFormHookSettings(): ShortFormHookSettings {
  let parsed: Partial<ShortFormHookSettings> | undefined;
  if (fs.existsSync(SETTINGS_PATH)) {
    try {
      parsed = JSON.parse(fs.readFileSync(SETTINGS_PATH, "utf-8")) as Partial<ShortFormHookSettings>;
    } catch {
      parsed = undefined;
    }
  }

  return normalize(parsed);
}

export function saveShortFormHookSettings(patch: Partial<ShortFormHookSettings>) {
  ensureSettingsDir();
  const current = getShortFormHookSettings();
  const next = normalize({ ...current, ...patch });
  fs.writeFileSync(SETTINGS_PATH, JSON.stringify(next, null, 2), "utf-8");
  return next;
}

export function renderShortFormHookPrompt(template: string, values: Record<string, string | undefined>) {
  return template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_match, key: string) => values[key] ?? "");
}
