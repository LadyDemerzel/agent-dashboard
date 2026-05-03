export type ShortFormVisualGenerationModelId =
  | "openclaw-gpt-image-2"
  | "nano-banana-pro";

export interface ShortFormVisualGenerationModelOption {
  id: ShortFormVisualGenerationModelId;
  label: string;
  description: string;
  modelRef: string;
  strategy: "openclaw-infer" | "nano-banana";
}

export const DEFAULT_SHORT_FORM_VISUAL_GENERATION_MODEL_ID: ShortFormVisualGenerationModelId =
  "openclaw-gpt-image-2";

const SHORT_FORM_VISUAL_GENERATION_MODEL_OPTIONS: readonly ShortFormVisualGenerationModelOption[] =
  [
    {
      id: "openclaw-gpt-image-2",
      label: "OpenClaw gpt-image-2 via Codex OAuth",
      description:
        "Uses OpenClaw image generation with model openai/gpt-image-2 through Codex OAuth/subscription only by default. Direct OpenAI API-key billing is blocked unless explicitly enabled.",
      modelRef: "openai/gpt-image-2",
      strategy: "openclaw-infer",
    },
    {
      id: "nano-banana-pro",
      label: "Nano Banana Pro",
      description:
        "Preserves the existing Nano Banana Pro path through the current Gemini/OpenRouter image script.",
      modelRef: "google/gemini-3-pro-image-preview",
      strategy: "nano-banana",
    },
  ];

export function getShortFormVisualGenerationModelOptions(): readonly ShortFormVisualGenerationModelOption[] {
  return SHORT_FORM_VISUAL_GENERATION_MODEL_OPTIONS;
}

export function isShortFormVisualGenerationModelId(
  value: unknown,
): value is ShortFormVisualGenerationModelId {
  return SHORT_FORM_VISUAL_GENERATION_MODEL_OPTIONS.some(
    (option) => option.id === value,
  );
}

export function getShortFormVisualGenerationModelOption(
  value?: unknown,
): ShortFormVisualGenerationModelOption | undefined {
  return SHORT_FORM_VISUAL_GENERATION_MODEL_OPTIONS.find(
    (option) => option.id === value,
  );
}

export function normalizeShortFormVisualGenerationModelId(
  value: unknown,
  fallback: ShortFormVisualGenerationModelId = DEFAULT_SHORT_FORM_VISUAL_GENERATION_MODEL_ID,
): ShortFormVisualGenerationModelId {
  return isShortFormVisualGenerationModelId(value) ? value : fallback;
}
