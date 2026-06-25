export const SHORT_FORM_AGENT_TARGET_IDS = [
  "openclaw-scribe",
  "openclaw-oracle",
  "claude-code",
] as const;

export type ShortFormAgentTargetId = (typeof SHORT_FORM_AGENT_TARGET_IDS)[number];

export const SHORT_FORM_AGENT_TARGET_SCOPES = [
  "hooks",
  "research",
  "text-script",
  "plan-visuals",
  "sound-design",
] as const;

export type ShortFormAgentTargetScope = (typeof SHORT_FORM_AGENT_TARGET_SCOPES)[number];

export type ShortFormAgentTargetMap = Record<ShortFormAgentTargetScope, ShortFormAgentTargetId>;
export type ShortFormAgentTargetOverrides = Partial<Record<ShortFormAgentTargetScope, ShortFormAgentTargetId>>;

export interface ShortFormAgentTargetSettings {
  defaults: ShortFormAgentTargetMap;
}

export interface ResolvedShortFormAgentTargets {
  defaults: ShortFormAgentTargetMap;
  overrides: ShortFormAgentTargetOverrides;
  effective: ShortFormAgentTargetMap;
}

export const SHORT_FORM_AGENT_TARGET_OPTIONS: Array<{
  id: ShortFormAgentTargetId;
  label: string;
  shortLabel: string;
  description: string;
}> = [
  {
    id: "openclaw-scribe",
    label: "OpenClaw Scribe",
    shortLabel: "Scribe",
    description: "Run the rendered prompt through the Scribe OpenClaw agent.",
  },
  {
    id: "openclaw-oracle",
    label: "OpenClaw Oracle",
    shortLabel: "Oracle",
    description: "Run the rendered prompt through the Oracle OpenClaw agent.",
  },
  {
    id: "claude-code",
    label: "Claude Code",
    shortLabel: "Claude",
    description: "Run the rendered prompt with Claude Code CLI non-interactive mode.",
  },
];

export const DEFAULT_SHORT_FORM_AGENT_TARGETS: ShortFormAgentTargetMap = {
  hooks: "openclaw-scribe",
  research: "openclaw-oracle",
  "text-script": "openclaw-scribe",
  "plan-visuals": "openclaw-scribe",
  "sound-design": "openclaw-scribe",
};

export function isShortFormAgentTargetId(value: unknown): value is ShortFormAgentTargetId {
  return typeof value === "string" && SHORT_FORM_AGENT_TARGET_IDS.includes(value as ShortFormAgentTargetId);
}

export function isShortFormAgentTargetScope(value: unknown): value is ShortFormAgentTargetScope {
  return typeof value === "string" && SHORT_FORM_AGENT_TARGET_SCOPES.includes(value as ShortFormAgentTargetScope);
}

