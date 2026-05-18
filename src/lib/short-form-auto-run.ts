import type { ShortFormDetailRouteSection } from "@/lib/short-form-video-navigation";

export type ShortFormAutoRunStepId =
  | "research"
  | "text-script"
  | "generate-narration-audio"
  | "plan-captions"
  | "plan-visuals"
  | "generate-visuals"
  | "plan-sound-design"
  | "generate-sound-design"
  | "final-video";

export type ShortFormAutoRunStatus =
  | "active"
  | "completed"
  | "stopped"
  | "failed";

export interface ShortFormAutoRunStepDefinition {
  id: ShortFormAutoRunStepId;
  label: string;
  timeoutMs: number;
  hardTimeoutMs?: number;
  staleProgressTimeoutMs?: number;
}

export interface ShortFormAutoRunState {
  id: string;
  status: ShortFormAutoRunStatus;
  startedFrom: ShortFormDetailRouteSection;
  selectedSteps: ShortFormAutoRunStepId[];
  skippedSteps: ShortFormAutoRunStepId[];
  completedSteps: ShortFormAutoRunStepId[];
  waitingSteps: ShortFormAutoRunStepId[];
  currentStep?: ShortFormAutoRunStepId;
  failedStep?: ShortFormAutoRunStepId;
  error?: string;
  startedAt: string;
  updatedAt: string;
  finishedAt?: string;
}

export const SHORT_FORM_AUTO_RUN_STEPS: ShortFormAutoRunStepDefinition[] = [
  { id: "research", label: "Research", timeoutMs: 12 * 60_000 },
  {
    id: "text-script",
    label: "Text Script",
    timeoutMs: 15 * 60_000,
    hardTimeoutMs: 90 * 60_000,
    staleProgressTimeoutMs: 20 * 60_000,
  },
  {
    id: "generate-narration-audio",
    label: "Generate Narration Audio",
    timeoutMs: 35 * 60_000,
  },
  { id: "plan-captions", label: "Plan Captions", timeoutMs: 12 * 60_000 },
  { id: "plan-visuals", label: "Plan Visuals", timeoutMs: 20 * 60_000 },
  { id: "generate-visuals", label: "Generate Visuals", timeoutMs: 65 * 60_000 },
  {
    id: "plan-sound-design",
    label: "Plan Sound Design",
    timeoutMs: 25 * 60_000,
  },
  {
    id: "generate-sound-design",
    label: "Generate Sound Design",
    timeoutMs: 20 * 60_000,
  },
  { id: "final-video", label: "Final Video", timeoutMs: 80 * 60_000 },
];

export const SHORT_FORM_AUTO_RUN_SECTION_TO_STEP_ID: Partial<
  Record<ShortFormDetailRouteSection, ShortFormAutoRunStepId>
> = {
  research: "research",
  "text-script": "text-script",
  "generate-narration-audio": "generate-narration-audio",
  "plan-captions": "plan-captions",
  "plan-visuals": "plan-visuals",
  "generate-visuals": "generate-visuals",
  "plan-sound-design": "plan-sound-design",
  "generate-sound-design": "generate-sound-design",
  "final-video": "final-video",
};

export const SHORT_FORM_AUTO_RUN_STEP_TO_SECTION: Record<
  ShortFormAutoRunStepId,
  ShortFormDetailRouteSection
> = {
  research: "research",
  "text-script": "text-script",
  "generate-narration-audio": "generate-narration-audio",
  "plan-captions": "plan-captions",
  "plan-visuals": "plan-visuals",
  "generate-visuals": "generate-visuals",
  "plan-sound-design": "plan-sound-design",
  "generate-sound-design": "generate-sound-design",
  "final-video": "final-video",
};

const AUTO_RUN_STEP_IDS = new Set(
  SHORT_FORM_AUTO_RUN_STEPS.map((step) => step.id),
);

const AUTO_RUN_STATUSES = new Set<ShortFormAutoRunStatus>([
  "active",
  "completed",
  "stopped",
  "failed",
]);

function asObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function asStepId(value: unknown): ShortFormAutoRunStepId | undefined {
  return typeof value === "string" && AUTO_RUN_STEP_IDS.has(value as ShortFormAutoRunStepId)
    ? (value as ShortFormAutoRunStepId)
    : undefined;
}

function asStepIds(value: unknown): ShortFormAutoRunStepId[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<ShortFormAutoRunStepId>();
  return value.reduce<ShortFormAutoRunStepId[]>((steps, item) => {
    const stepId = asStepId(item);
    if (!stepId || seen.has(stepId)) return steps;
    seen.add(stepId);
    steps.push(stepId);
    return steps;
  }, []);
}

function asOptionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function asRequiredString(value: unknown, fallback: string) {
  return asOptionalString(value) || fallback;
}

function asIsoString(value: unknown, fallback: string) {
  const text = asOptionalString(value);
  return text && Number.isFinite(Date.parse(text)) ? text : fallback;
}

function asOptionalIsoString(value: unknown) {
  const text = asOptionalString(value);
  return text && Number.isFinite(Date.parse(text)) ? text : undefined;
}

function asDetailSection(value: unknown): ShortFormDetailRouteSection {
  if (typeof value !== "string") return "topic";
  return value as ShortFormDetailRouteSection;
}

export function normalizeShortFormAutoRunState(
  value: unknown,
): ShortFormAutoRunState | undefined {
  const obj = asObject(value);
  if (Object.keys(obj).length === 0) return undefined;

  const now = new Date().toISOString();
  const status = AUTO_RUN_STATUSES.has(obj.status as ShortFormAutoRunStatus)
    ? (obj.status as ShortFormAutoRunStatus)
    : "stopped";

  return {
    id: asRequiredString(obj.id, `auto-run-${Date.now()}`),
    status,
    startedFrom: asDetailSection(obj.startedFrom),
    selectedSteps: asStepIds(obj.selectedSteps),
    skippedSteps: asStepIds(obj.skippedSteps),
    completedSteps: asStepIds(obj.completedSteps),
    waitingSteps: asStepIds(obj.waitingSteps),
    currentStep: asStepId(obj.currentStep),
    failedStep: asStepId(obj.failedStep),
    error: asOptionalString(obj.error),
    startedAt: asIsoString(obj.startedAt, now),
    updatedAt: asIsoString(obj.updatedAt, now),
    finishedAt: asOptionalIsoString(obj.finishedAt),
  };
}

export function getShortFormAutoRunStepLabel(stepId: ShortFormAutoRunStepId) {
  return SHORT_FORM_AUTO_RUN_STEPS.find((step) => step.id === stepId)?.label || stepId;
}

export function getShortFormAutoRunStartedFromLabel(
  section: ShortFormDetailRouteSection,
) {
  const stepId = SHORT_FORM_AUTO_RUN_SECTION_TO_STEP_ID[section];
  if (stepId) return getShortFormAutoRunStepLabel(stepId);
  if (section === "topic") return "Topic";
  if (section === "hook") return "Hook";
  return section;
}

export function isShortFormAutoRunStepId(
  value: unknown,
): value is ShortFormAutoRunStepId {
  return typeof value === "string" && AUTO_RUN_STEP_IDS.has(value as ShortFormAutoRunStepId);
}

export function getShortFormAutoRunCurrentStep(
  section: ShortFormDetailRouteSection,
) {
  const stepId = SHORT_FORM_AUTO_RUN_SECTION_TO_STEP_ID[section];
  return stepId ? SHORT_FORM_AUTO_RUN_STEPS.find((step) => step.id === stepId) : undefined;
}

export function getShortFormAutoRunSubsequentSteps(
  section: ShortFormDetailRouteSection,
) {
  const currentStepId = SHORT_FORM_AUTO_RUN_SECTION_TO_STEP_ID[section];
  const currentIndex = currentStepId
    ? SHORT_FORM_AUTO_RUN_STEPS.findIndex((step) => step.id === currentStepId)
    : section === "topic" || section === "hook"
      ? -1
      : SHORT_FORM_AUTO_RUN_STEPS.length - 1;

  return currentIndex >= 0
    ? SHORT_FORM_AUTO_RUN_STEPS.slice(currentIndex + 1)
    : SHORT_FORM_AUTO_RUN_STEPS;
}

export function buildShortFormAutoRunState({
  startedFrom,
  selectedSubsequentSteps,
}: {
  startedFrom: ShortFormDetailRouteSection;
  selectedSubsequentSteps?: ShortFormAutoRunStepId[];
}): ShortFormAutoRunState {
  const currentStep = getShortFormAutoRunCurrentStep(startedFrom);
  const subsequentSteps = getShortFormAutoRunSubsequentSteps(startedFrom);
  const requestedSubsequentStepIds = selectedSubsequentSteps
    ? new Set(selectedSubsequentSteps)
    : undefined;
  const selectedSubsequent = requestedSubsequentStepIds
    ? subsequentSteps.filter((step) => requestedSubsequentStepIds.has(step.id))
    : subsequentSteps;
  const includedSteps = [
    ...(currentStep ? [currentStep] : []),
    ...selectedSubsequent,
  ];
  const selectedSteps = includedSteps.map((step) => step.id);
  const selectedSet = new Set(selectedSteps);
  const currentIndex = currentStep
    ? SHORT_FORM_AUTO_RUN_STEPS.findIndex((step) => step.id === currentStep.id)
    : startedFrom === "topic" || startedFrom === "hook"
      ? -1
      : SHORT_FORM_AUTO_RUN_STEPS.length - 1;
  const inScopeSteps = currentIndex >= 0
    ? SHORT_FORM_AUTO_RUN_STEPS.slice(currentIndex)
    : SHORT_FORM_AUTO_RUN_STEPS;
  const now = new Date().toISOString();

  return {
    id: `auto-run-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    status: "active",
    startedFrom,
    selectedSteps,
    skippedSteps: inScopeSteps
      .map((step) => step.id)
      .filter((stepId) => !selectedSet.has(stepId)),
    completedSteps: [],
    waitingSteps: selectedSteps,
    startedAt: now,
    updatedAt: now,
  };
}
