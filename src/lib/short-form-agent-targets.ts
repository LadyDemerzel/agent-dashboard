import fs from "fs";
import path from "path";
import {
  DEFAULT_SHORT_FORM_AGENT_TARGETS,
  SHORT_FORM_AGENT_TARGET_SCOPES,
  isShortFormAgentTargetId,
  type ResolvedShortFormAgentTargets,
  type ShortFormAgentTargetId,
  type ShortFormAgentTargetMap,
  type ShortFormAgentTargetOverrides,
  type ShortFormAgentTargetSettings,
} from "@/lib/short-form-agent-target-types";

export {
  DEFAULT_SHORT_FORM_AGENT_TARGETS,
  SHORT_FORM_AGENT_TARGET_IDS,
  SHORT_FORM_AGENT_TARGET_OPTIONS,
  SHORT_FORM_AGENT_TARGET_SCOPES,
  isShortFormAgentTargetId,
  isShortFormAgentTargetScope,
  type ResolvedShortFormAgentTargets,
  type ShortFormAgentTargetId,
  type ShortFormAgentTargetMap,
  type ShortFormAgentTargetOverrides,
  type ShortFormAgentTargetScope,
  type ShortFormAgentTargetSettings,
} from "@/lib/short-form-agent-target-types";

const HOME_DIR = process.env.HOME || "/Users/ittaisvidler";
const SETTINGS_PATH = path.join(
  HOME_DIR,
  "tenxsolo",
  "systems",
  "agent-dashboard",
  "settings",
  "short-form-video",
  "_agent-target-settings.json",
);

export function normalizeShortFormAgentTargetId(
  value: unknown,
  fallback: ShortFormAgentTargetId,
): ShortFormAgentTargetId {
  return isShortFormAgentTargetId(value) ? value : fallback;
}

export function getOpenClawAgentIdForTarget(
  target: ShortFormAgentTargetId,
  fallbackAgentId: "scribe" | "oracle",
): "scribe" | "oracle" {
  if (target === "openclaw-oracle") return "oracle";
  if (target === "openclaw-scribe") return "scribe";
  return fallbackAgentId;
}

function normalizeTargetMap(value: unknown): ShortFormAgentTargetMap {
  const source = value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
  return SHORT_FORM_AGENT_TARGET_SCOPES.reduce<ShortFormAgentTargetMap>((targets, scope) => {
    targets[scope] = normalizeShortFormAgentTargetId(source[scope], DEFAULT_SHORT_FORM_AGENT_TARGETS[scope]);
    return targets;
  }, { ...DEFAULT_SHORT_FORM_AGENT_TARGETS });
}

export function normalizeShortFormAgentTargetOverrides(value: unknown): ShortFormAgentTargetOverrides {
  const source = value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
  return SHORT_FORM_AGENT_TARGET_SCOPES.reduce<ShortFormAgentTargetOverrides>((targets, scope) => {
    const candidate = source[scope];
    if (candidate === null) return targets;
    if (isShortFormAgentTargetId(candidate)) {
      targets[scope] = candidate;
    }
    return targets;
  }, {});
}

export function getShortFormAgentTargetSettings(): ShortFormAgentTargetSettings {
  if (!fs.existsSync(SETTINGS_PATH)) {
    return { defaults: { ...DEFAULT_SHORT_FORM_AGENT_TARGETS } };
  }

  try {
    const parsed = JSON.parse(fs.readFileSync(SETTINGS_PATH, "utf-8")) as Record<string, unknown>;
    return {
      defaults: normalizeTargetMap(parsed.defaults),
    };
  } catch {
    return { defaults: { ...DEFAULT_SHORT_FORM_AGENT_TARGETS } };
  }
}

export function saveShortFormAgentTargetSettings(settings: ShortFormAgentTargetSettings) {
  fs.mkdirSync(path.dirname(SETTINGS_PATH), { recursive: true });
  const normalized: ShortFormAgentTargetSettings = {
    defaults: normalizeTargetMap(settings.defaults),
  };
  fs.writeFileSync(SETTINGS_PATH, JSON.stringify(normalized, null, 2), "utf-8");
  return normalized;
}

export function resolveShortFormAgentTargets(
  overrides?: ShortFormAgentTargetOverrides,
): ResolvedShortFormAgentTargets {
  const settings = getShortFormAgentTargetSettings();
  const normalizedOverrides = normalizeShortFormAgentTargetOverrides(overrides);
  return {
    defaults: settings.defaults,
    overrides: normalizedOverrides,
    effective: SHORT_FORM_AGENT_TARGET_SCOPES.reduce<ShortFormAgentTargetMap>((targets, scope) => {
      targets[scope] = normalizedOverrides[scope] || settings.defaults[scope];
      return targets;
    }, { ...settings.defaults }),
  };
}
