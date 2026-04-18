export type ShortFormCaptionAnimationLegacyPreset = 'none' | 'stable-pop' | 'fluid-pop' | 'pulse' | 'glow';
export type ShortFormCaptionAnimationLayoutMode = 'stable' | 'fluid';
export type ShortFormCaptionAnimationTimingMode = 'word-relative' | 'fixed';
export type ShortFormCaptionAnimationEasing =
  | 'linear'
  | 'ease-in-quad'
  | 'ease-out-quad'
  | 'ease-in-out-quad'
  | 'ease-out-cubic'
  | 'ease-in-out-cubic'
  | 'ease-out-back';
export type ShortFormCaptionAnimationColorMode = 'style-active-word' | 'style-outline' | 'style-shadow' | 'custom';

export interface ShortFormCaptionAnimationKeyframe {
  time: number;
  value: number;
  easing?: ShortFormCaptionAnimationEasing;
}

export interface ShortFormCaptionAnimationTrack {
  keyframes: ShortFormCaptionAnimationKeyframe[];
}

export interface ShortFormCaptionAnimationTiming {
  mode: ShortFormCaptionAnimationTimingMode;
  multiplier: number;
  minMs: number;
  maxMs: number;
  fixedMs: number;
}

export interface ShortFormCaptionAnimationColors {
  outlineColorMode: ShortFormCaptionAnimationColorMode;
  outlineColor?: string;
  shadowColorMode: ShortFormCaptionAnimationColorMode;
  shadowColor?: string;
  glowColorMode: ShortFormCaptionAnimationColorMode;
  glowColor?: string;
}

export interface ShortFormCaptionAnimationMotion {
  scale: ShortFormCaptionAnimationTrack;
  translateXEm: ShortFormCaptionAnimationTrack;
  translateYEm: ShortFormCaptionAnimationTrack;
  extraOutlineWidth: ShortFormCaptionAnimationTrack;
  extraBlur: ShortFormCaptionAnimationTrack;
  glowStrength: ShortFormCaptionAnimationTrack;
  shadowOpacityMultiplier: ShortFormCaptionAnimationTrack;
}

export interface ShortFormCaptionAnimationPresetConfig {
  version: 1;
  layoutMode: ShortFormCaptionAnimationLayoutMode;
  timing: ShortFormCaptionAnimationTiming;
  colors: ShortFormCaptionAnimationColors;
  motion: ShortFormCaptionAnimationMotion;
}

export interface ShortFormCaptionAnimationPresetEntry {
  id: string;
  slug: ShortFormCaptionAnimationLegacyPreset | string;
  name: string;
  description: string;
  builtIn?: boolean;
  config: ShortFormCaptionAnimationPresetConfig;
  createdAt?: string;
  updatedAt?: string;
}

export interface ShortFormCaptionAnimationResolvedFrame {
  scale: number;
  translateXEm: number;
  translateYEm: number;
  extraOutlineWidth: number;
  extraBlur: number;
  glowStrength: number;
  shadowOpacityMultiplier: number;
}

const BUILT_IN_CREATED_AT = '2026-04-18T00:00:00.000Z';
const DEFAULT_EASING: ShortFormCaptionAnimationEasing = 'linear';

function track(keyframes: Array<[number, number, ShortFormCaptionAnimationEasing?]>): ShortFormCaptionAnimationTrack {
  return {
    keyframes: keyframes.map(([time, value, easing]) => ({ time, value, ...(easing ? { easing } : {}) })),
  };
}

function cloneTrack(source: ShortFormCaptionAnimationTrack): ShortFormCaptionAnimationTrack {
  return {
    keyframes: source.keyframes.map((frame) => ({ ...frame })),
  };
}

export function cloneCaptionAnimationConfig(config: ShortFormCaptionAnimationPresetConfig): ShortFormCaptionAnimationPresetConfig {
  return {
    version: 1,
    layoutMode: config.layoutMode,
    timing: { ...config.timing },
    colors: { ...config.colors },
    motion: {
      scale: cloneTrack(config.motion.scale),
      translateXEm: cloneTrack(config.motion.translateXEm),
      translateYEm: cloneTrack(config.motion.translateYEm),
      extraOutlineWidth: cloneTrack(config.motion.extraOutlineWidth),
      extraBlur: cloneTrack(config.motion.extraBlur),
      glowStrength: cloneTrack(config.motion.glowStrength),
      shadowOpacityMultiplier: cloneTrack(config.motion.shadowOpacityMultiplier),
    },
  };
}

export const BUILT_IN_CAPTION_ANIMATION_PRESET_IDS = {
  none: 'caption-animation-none',
  stablePop: 'caption-animation-stable-pop',
  fluidPop: 'caption-animation-fluid-pop',
  pulse: 'caption-animation-pulse',
  glow: 'caption-animation-glow',
} as const;

export const DEFAULT_CAPTION_ANIMATION_PRESET_ID = BUILT_IN_CAPTION_ANIMATION_PRESET_IDS.stablePop;

const BUILT_IN_CAPTION_ANIMATION_PRESET_CONFIGS: Record<string, ShortFormCaptionAnimationPresetConfig> = {
  [BUILT_IN_CAPTION_ANIMATION_PRESET_IDS.none]: {
    version: 1,
    layoutMode: 'stable',
    timing: { mode: 'word-relative', multiplier: 1, minMs: 120, maxMs: 1000, fixedMs: 240 },
    colors: {
      outlineColorMode: 'style-outline',
      shadowColorMode: 'style-shadow',
      glowColorMode: 'style-active-word',
    },
    motion: {
      scale: track([[0, 1], [1, 1]]),
      translateXEm: track([[0, 0], [1, 0]]),
      translateYEm: track([[0, 0], [1, 0]]),
      extraOutlineWidth: track([[0, 0], [1, 0]]),
      extraBlur: track([[0, 0], [1, 0]]),
      glowStrength: track([[0, 0], [1, 0]]),
      shadowOpacityMultiplier: track([[0, 1], [1, 1]]),
    },
  },
  [BUILT_IN_CAPTION_ANIMATION_PRESET_IDS.stablePop]: {
    version: 1,
    layoutMode: 'stable',
    timing: { mode: 'word-relative', multiplier: 1, minMs: 120, maxMs: 240, fixedMs: 240 },
    colors: {
      outlineColorMode: 'style-active-word',
      shadowColorMode: 'style-active-word',
      glowColorMode: 'style-active-word',
    },
    motion: {
      scale: track([[0, 1, 'linear'], [0.16, 1.18, 'ease-out-cubic'], [1, 1, 'ease-out-cubic']]),
      translateXEm: track([[0, 0], [1, 0]]),
      translateYEm: track([[0, 0, 'linear'], [0.16, -0.11, 'ease-out-cubic'], [1, 0, 'ease-out-cubic']]),
      extraOutlineWidth: track([[0, 1.1], [0.5, 0.5, 'ease-out-cubic'], [1, 0, 'ease-out-cubic']]),
      extraBlur: track([[0, 1.8], [0.5, 1.1, 'ease-out-cubic'], [1, 0.6, 'ease-out-cubic']]),
      glowStrength: track([[0, 0.14], [0.35, 0.24, 'ease-out-cubic'], [1, 0.06, 'ease-out-cubic']]),
      shadowOpacityMultiplier: track([[0, 0.95], [0.45, 1.12, 'ease-out-cubic'], [1, 0.88, 'ease-out-cubic']]),
    },
  },
  [BUILT_IN_CAPTION_ANIMATION_PRESET_IDS.fluidPop]: {
    version: 1,
    layoutMode: 'fluid',
    timing: { mode: 'word-relative', multiplier: 1, minMs: 120, maxMs: 240, fixedMs: 240 },
    colors: {
      outlineColorMode: 'style-active-word',
      shadowColorMode: 'style-active-word',
      glowColorMode: 'style-active-word',
    },
    motion: {
      scale: track([[0, 1, 'linear'], [0.16, 1.18, 'ease-out-cubic'], [1, 1, 'ease-out-cubic']]),
      translateXEm: track([[0, 0], [1, 0]]),
      translateYEm: track([[0, 0, 'linear'], [0.16, -0.11, 'ease-out-cubic'], [1, 0, 'ease-out-cubic']]),
      extraOutlineWidth: track([[0, 1.1], [0.5, 0.5, 'ease-out-cubic'], [1, 0, 'ease-out-cubic']]),
      extraBlur: track([[0, 1.8], [0.5, 1.1, 'ease-out-cubic'], [1, 0.6, 'ease-out-cubic']]),
      glowStrength: track([[0, 0.14], [0.35, 0.24, 'ease-out-cubic'], [1, 0.06, 'ease-out-cubic']]),
      shadowOpacityMultiplier: track([[0, 0.95], [0.45, 1.12, 'ease-out-cubic'], [1, 0.88, 'ease-out-cubic']]),
    },
  },
  [BUILT_IN_CAPTION_ANIMATION_PRESET_IDS.pulse]: {
    version: 1,
    layoutMode: 'stable',
    timing: { mode: 'word-relative', multiplier: 1, minMs: 180, maxMs: 320, fixedMs: 320 },
    colors: {
      outlineColorMode: 'style-outline',
      shadowColorMode: 'style-shadow',
      glowColorMode: 'style-active-word',
    },
    motion: {
      scale: track([[0, 1.03], [0.25, 1.08, 'ease-out-quad'], [0.5, 1.03, 'ease-in-out-cubic'], [0.75, 0.98, 'ease-in-out-cubic'], [1, 1.03, 'ease-in-out-cubic']]),
      translateXEm: track([[0, 0], [1, 0]]),
      translateYEm: track([[0, -0.03], [1, -0.03]]),
      extraOutlineWidth: track([[0, 0], [1, 0]]),
      extraBlur: track([[0, 0.2], [0.5, 0.4, 'ease-in-out-cubic'], [1, 0.2, 'ease-in-out-cubic']]),
      glowStrength: track([[0, 0.18], [0.5, 0.36, 'ease-in-out-cubic'], [1, 0.18, 'ease-in-out-cubic']]),
      shadowOpacityMultiplier: track([[0, 1], [0.5, 1.16, 'ease-in-out-cubic'], [1, 1, 'ease-in-out-cubic']]),
    },
  },
  [BUILT_IN_CAPTION_ANIMATION_PRESET_IDS.glow]: {
    version: 1,
    layoutMode: 'stable',
    timing: { mode: 'word-relative', multiplier: 1, minMs: 160, maxMs: 300, fixedMs: 300 },
    colors: {
      outlineColorMode: 'style-active-word',
      shadowColorMode: 'style-active-word',
      glowColorMode: 'style-active-word',
    },
    motion: {
      scale: track([[0, 1.02], [0.5, 1.06, 'ease-in-out-cubic'], [1, 1.02, 'ease-in-out-cubic']]),
      translateXEm: track([[0, 0], [1, 0]]),
      translateYEm: track([[0, -0.015], [1, -0.015]]),
      extraOutlineWidth: track([[0, 0.5], [0.5, 0.85, 'ease-in-out-cubic'], [1, 0.5, 'ease-in-out-cubic']]),
      extraBlur: track([[0, 0.8], [0.5, 1.2, 'ease-in-out-cubic'], [1, 0.8, 'ease-in-out-cubic']]),
      glowStrength: track([[0, 0.55], [0.5, 0.9, 'ease-in-out-cubic'], [1, 0.55, 'ease-in-out-cubic']]),
      shadowOpacityMultiplier: track([[0, 1.15], [0.5, 1.35, 'ease-in-out-cubic'], [1, 1.15, 'ease-in-out-cubic']]),
    },
  },
};

export const DEFAULT_SHORT_FORM_CAPTION_ANIMATION_PRESETS: ShortFormCaptionAnimationPresetEntry[] = [
  {
    id: BUILT_IN_CAPTION_ANIMATION_PRESET_IDS.none,
    slug: 'none',
    name: 'None',
    description: 'Keep the 3-state word colors without added motion.',
    builtIn: true,
    config: cloneCaptionAnimationConfig(BUILT_IN_CAPTION_ANIMATION_PRESET_CONFIGS[BUILT_IN_CAPTION_ANIMATION_PRESET_IDS.none]),
    createdAt: BUILT_IN_CREATED_AT,
    updatedAt: BUILT_IN_CREATED_AT,
  },
  {
    id: BUILT_IN_CAPTION_ANIMATION_PRESET_IDS.stablePop,
    slug: 'stable-pop',
    name: 'Stable Pop',
    description: 'Snappy pop animation with locked word slots so neighbors do not shift.',
    builtIn: true,
    config: cloneCaptionAnimationConfig(BUILT_IN_CAPTION_ANIMATION_PRESET_CONFIGS[BUILT_IN_CAPTION_ANIMATION_PRESET_IDS.stablePop]),
    createdAt: BUILT_IN_CREATED_AT,
    updatedAt: BUILT_IN_CREATED_AT,
  },
  {
    id: BUILT_IN_CAPTION_ANIMATION_PRESET_IDS.fluidPop,
    slug: 'fluid-pop',
    name: 'Fluid Pop',
    description: 'The active word pops while neighboring words reflow within the locked line.',
    builtIn: true,
    config: cloneCaptionAnimationConfig(BUILT_IN_CAPTION_ANIMATION_PRESET_CONFIGS[BUILT_IN_CAPTION_ANIMATION_PRESET_IDS.fluidPop]),
    createdAt: BUILT_IN_CREATED_AT,
    updatedAt: BUILT_IN_CREATED_AT,
  },
  {
    id: BUILT_IN_CAPTION_ANIMATION_PRESET_IDS.pulse,
    slug: 'pulse',
    name: 'Pulse',
    description: 'A softer rhythmic emphasis with gentle scale breathing and glow.',
    builtIn: true,
    config: cloneCaptionAnimationConfig(BUILT_IN_CAPTION_ANIMATION_PRESET_CONFIGS[BUILT_IN_CAPTION_ANIMATION_PRESET_IDS.pulse]),
    createdAt: BUILT_IN_CREATED_AT,
    updatedAt: BUILT_IN_CREATED_AT,
  },
  {
    id: BUILT_IN_CAPTION_ANIMATION_PRESET_IDS.glow,
    slug: 'glow',
    name: 'Glow',
    description: 'A brighter active-word glow with a slightly stronger outline and shadow.',
    builtIn: true,
    config: cloneCaptionAnimationConfig(BUILT_IN_CAPTION_ANIMATION_PRESET_CONFIGS[BUILT_IN_CAPTION_ANIMATION_PRESET_IDS.glow]),
    createdAt: BUILT_IN_CREATED_AT,
    updatedAt: BUILT_IN_CREATED_AT,
  },
];

export function getBuiltInCaptionAnimationPresetByLegacySlug(slug: unknown) {
  const normalized = typeof slug === 'string' ? slug.trim() : '';
  return DEFAULT_SHORT_FORM_CAPTION_ANIMATION_PRESETS.find((preset) => preset.slug === normalized) || null;
}

export function mapLegacyCaptionAnimationPresetToId(slug: unknown, fallback: string = DEFAULT_CAPTION_ANIMATION_PRESET_ID) {
  if (slug === 'word-highlight' || slug === 'pop') return BUILT_IN_CAPTION_ANIMATION_PRESET_IDS.stablePop;
  return getBuiltInCaptionAnimationPresetByLegacySlug(slug)?.id || fallback;
}

function normalizeNumber(value: unknown, fallback: number, min: number, max: number, decimals = 3) {
  const parsed = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : Number.NaN;
  if (!Number.isFinite(parsed)) return fallback;
  return Number(Math.min(max, Math.max(min, parsed)).toFixed(decimals));
}

function normalizeInteger(value: unknown, fallback: number, min: number, max: number) {
  const parsed = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : Number.NaN;
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, Math.round(parsed)));
}

function normalizeHexColor(value: unknown) {
  const normalized = typeof value === 'string' ? value.trim().toUpperCase() : '';
  return /^#[0-9A-F]{6}$/.test(normalized) ? normalized : undefined;
}

function normalizeEasing(value: unknown, fallback: ShortFormCaptionAnimationEasing = DEFAULT_EASING): ShortFormCaptionAnimationEasing {
  return value === 'linear'
    || value === 'ease-in-quad'
    || value === 'ease-out-quad'
    || value === 'ease-in-out-quad'
    || value === 'ease-out-cubic'
    || value === 'ease-in-out-cubic'
    || value === 'ease-out-back'
    ? value
    : fallback;
}

function normalizeColorMode(value: unknown, fallback: ShortFormCaptionAnimationColorMode): ShortFormCaptionAnimationColorMode {
  return value === 'style-active-word' || value === 'style-outline' || value === 'style-shadow' || value === 'custom'
    ? value
    : fallback;
}

function normalizeLayoutMode(value: unknown, fallback: ShortFormCaptionAnimationLayoutMode): ShortFormCaptionAnimationLayoutMode {
  return value === 'fluid' || value === 'stable' ? value : fallback;
}

function normalizeTimingMode(value: unknown, fallback: ShortFormCaptionAnimationTimingMode): ShortFormCaptionAnimationTimingMode {
  return value === 'fixed' || value === 'word-relative' ? value : fallback;
}

function normalizeTrack(
  value: unknown,
  fallback: ShortFormCaptionAnimationTrack,
  min: number,
  max: number,
  decimals = 4,
): ShortFormCaptionAnimationTrack {
  const frames = Array.isArray((value as ShortFormCaptionAnimationTrack | undefined)?.keyframes)
    ? (value as ShortFormCaptionAnimationTrack).keyframes
    : Array.isArray(value)
      ? value as ShortFormCaptionAnimationKeyframe[]
      : [];
  const normalized = frames
    .flatMap((frame, index) => {
      if (!frame || typeof frame !== 'object' || Array.isArray(frame)) return [];
      const time = normalizeNumber((frame as ShortFormCaptionAnimationKeyframe).time, index === 0 ? 0 : 1, 0, 1, 4);
      const fallbackFrame = fallback.keyframes[Math.min(index, fallback.keyframes.length - 1)] || fallback.keyframes[0];
      const value = normalizeNumber((frame as ShortFormCaptionAnimationKeyframe).value, fallbackFrame?.value ?? 0, min, max, decimals);
      const easing = normalizeEasing((frame as ShortFormCaptionAnimationKeyframe).easing, fallbackFrame?.easing ?? DEFAULT_EASING);
      return [{ time, value, easing } satisfies ShortFormCaptionAnimationKeyframe];
    })
    .sort((a, b) => a.time - b.time || a.value - b.value);

  if (normalized.length === 0) return cloneTrack(fallback);
  if (normalized[0]!.time > 0) {
    normalized.unshift({ ...normalized[0]!, time: 0 });
  }
  if (normalized[normalized.length - 1]!.time < 1) {
    normalized.push({ ...normalized[normalized.length - 1]!, time: 1 });
  }
  return { keyframes: normalized };
}

export function normalizeCaptionAnimationPresetConfig(
  value: unknown,
  fallback: ShortFormCaptionAnimationPresetConfig = BUILT_IN_CAPTION_ANIMATION_PRESET_CONFIGS[DEFAULT_CAPTION_ANIMATION_PRESET_ID],
): ShortFormCaptionAnimationPresetConfig {
  const obj = value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
  const timing = obj.timing && typeof obj.timing === 'object' && !Array.isArray(obj.timing)
    ? obj.timing as Record<string, unknown>
    : {};
  const colors = obj.colors && typeof obj.colors === 'object' && !Array.isArray(obj.colors)
    ? obj.colors as Record<string, unknown>
    : {};
  const motion = obj.motion && typeof obj.motion === 'object' && !Array.isArray(obj.motion)
    ? obj.motion as Record<string, unknown>
    : {};

  return {
    version: 1,
    layoutMode: normalizeLayoutMode(obj.layoutMode, fallback.layoutMode),
    timing: {
      mode: normalizeTimingMode(timing.mode, fallback.timing.mode),
      multiplier: normalizeNumber(timing.multiplier, fallback.timing.multiplier, 0.1, 4, 3),
      minMs: normalizeInteger(timing.minMs, fallback.timing.minMs, 40, 2000),
      maxMs: normalizeInteger(timing.maxMs, fallback.timing.maxMs, 40, 2000),
      fixedMs: normalizeInteger(timing.fixedMs, fallback.timing.fixedMs, 40, 2000),
    },
    colors: {
      outlineColorMode: normalizeColorMode(colors.outlineColorMode, fallback.colors.outlineColorMode),
      ...(normalizeHexColor(colors.outlineColor) ? { outlineColor: normalizeHexColor(colors.outlineColor) } : normalizeHexColor(fallback.colors.outlineColor) ? { outlineColor: normalizeHexColor(fallback.colors.outlineColor) } : {}),
      shadowColorMode: normalizeColorMode(colors.shadowColorMode, fallback.colors.shadowColorMode),
      ...(normalizeHexColor(colors.shadowColor) ? { shadowColor: normalizeHexColor(colors.shadowColor) } : normalizeHexColor(fallback.colors.shadowColor) ? { shadowColor: normalizeHexColor(fallback.colors.shadowColor) } : {}),
      glowColorMode: normalizeColorMode(colors.glowColorMode, fallback.colors.glowColorMode),
      ...(normalizeHexColor(colors.glowColor) ? { glowColor: normalizeHexColor(colors.glowColor) } : normalizeHexColor(fallback.colors.glowColor) ? { glowColor: normalizeHexColor(fallback.colors.glowColor) } : {}),
    },
    motion: {
      scale: normalizeTrack(motion.scale, fallback.motion.scale, 0.2, 4, 4),
      translateXEm: normalizeTrack(motion.translateXEm, fallback.motion.translateXEm, -4, 4, 4),
      translateYEm: normalizeTrack(motion.translateYEm, fallback.motion.translateYEm, -4, 4, 4),
      extraOutlineWidth: normalizeTrack(motion.extraOutlineWidth, fallback.motion.extraOutlineWidth, 0, 16, 4),
      extraBlur: normalizeTrack(motion.extraBlur, fallback.motion.extraBlur, 0, 20, 4),
      glowStrength: normalizeTrack(motion.glowStrength, fallback.motion.glowStrength, 0, 2.5, 4),
      shadowOpacityMultiplier: normalizeTrack(motion.shadowOpacityMultiplier, fallback.motion.shadowOpacityMultiplier, 0, 4, 4),
    },
  };
}

export function normalizeCaptionAnimationPresetEntry(
  value: unknown,
  fallback: ShortFormCaptionAnimationPresetEntry,
  index = 0,
): ShortFormCaptionAnimationPresetEntry | null {
  const obj = value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
  const id = typeof obj.id === 'string' && obj.id.trim() ? obj.id.trim() : fallback.id || `caption-animation-${index + 1}`;
  const name = typeof obj.name === 'string' && obj.name.trim() ? obj.name.trim() : fallback.name || `Caption animation ${index + 1}`;
  const slug = typeof obj.slug === 'string' && obj.slug.trim() ? obj.slug.trim() : fallback.slug;
  const description = typeof obj.description === 'string' && obj.description.trim() ? obj.description.trim() : fallback.description;
  const config = normalizeCaptionAnimationPresetConfig(obj.config, fallback.config);
  return {
    id,
    slug,
    name,
    description,
    builtIn: typeof obj.builtIn === 'boolean' ? obj.builtIn : Boolean(fallback.builtIn),
    config,
    ...(typeof obj.createdAt === 'string' && obj.createdAt.trim() ? { createdAt: obj.createdAt.trim() } : fallback.createdAt ? { createdAt: fallback.createdAt } : {}),
    ...(typeof obj.updatedAt === 'string' && obj.updatedAt.trim() ? { updatedAt: obj.updatedAt.trim() } : fallback.updatedAt ? { updatedAt: fallback.updatedAt } : {}),
  };
}

export function ensureUniqueCaptionAnimationPresetIds(presets: ShortFormCaptionAnimationPresetEntry[]) {
  const seen = new Set<string>();
  return presets.map((preset, index) => {
    let nextId = preset.id.trim() || `caption-animation-${index + 1}`;
    let suffix = 2;
    while (seen.has(nextId)) {
      nextId = `${preset.id || 'caption-animation'}-${suffix}`;
      suffix += 1;
    }
    seen.add(nextId);
    return { ...preset, id: nextId };
  });
}

export function getCaptionAnimationPresetById(
  presets: ShortFormCaptionAnimationPresetEntry[],
  id: string | null | undefined,
  fallbackId: string = DEFAULT_CAPTION_ANIMATION_PRESET_ID,
) {
  if (id) {
    const direct = presets.find((preset) => preset.id === id);
    if (direct) return direct;
  }
  return presets.find((preset) => preset.id === fallbackId)
    || presets.find((preset) => preset.slug === 'stable-pop')
    || presets[0]
    || DEFAULT_SHORT_FORM_CAPTION_ANIMATION_PRESETS.find((preset) => preset.id === fallbackId)
    || DEFAULT_SHORT_FORM_CAPTION_ANIMATION_PRESETS[0];
}

function applyEasing(easing: ShortFormCaptionAnimationEasing, value: number) {
  const t = Math.max(0, Math.min(1, value));
  switch (easing) {
    case 'ease-in-quad':
      return t * t;
    case 'ease-out-quad':
      return 1 - ((1 - t) * (1 - t));
    case 'ease-in-out-quad':
      return t < 0.5 ? 2 * t * t : 1 - (((-2 * t + 2) ** 2) / 2);
    case 'ease-out-cubic':
      return 1 - ((1 - t) ** 3);
    case 'ease-in-out-cubic':
      return t < 0.5 ? 4 * t * t * t : 1 - (((-2 * t + 2) ** 3) / 2);
    case 'ease-out-back': {
      const c1 = 1.70158;
      const c3 = c1 + 1;
      return 1 + (c3 * ((t - 1) ** 3)) + (c1 * ((t - 1) ** 2));
    }
    case 'linear':
    default:
      return t;
  }
}

export function evaluateCaptionAnimationTrack(trackConfig: ShortFormCaptionAnimationTrack, progress: number) {
  const frames = trackConfig.keyframes.length > 0 ? trackConfig.keyframes : [{ time: 0, value: 0 }, { time: 1, value: 0 }];
  const t = Math.max(0, Math.min(1, progress));
  if (t <= frames[0]!.time) return frames[0]!.value;
  for (let index = 1; index < frames.length; index += 1) {
    const previous = frames[index - 1]!;
    const current = frames[index]!;
    if (t <= current.time) {
      const span = Math.max(0.0001, current.time - previous.time);
      const localProgress = applyEasing(current.easing || DEFAULT_EASING, (t - previous.time) / span);
      return previous.value + ((current.value - previous.value) * localProgress);
    }
  }
  return frames[frames.length - 1]!.value;
}

export function resolveCaptionAnimationDurationSeconds(config: ShortFormCaptionAnimationPresetConfig, wordDurationSeconds: number) {
  const safeDuration = Math.max(0.04, wordDurationSeconds || 0.04);
  if (config.timing.mode === 'fixed') {
    return Math.max(0.04, Math.min(safeDuration, config.timing.fixedMs / 1000));
  }
  const requestedSeconds = safeDuration * config.timing.multiplier;
  return Math.max(config.timing.minMs / 1000, Math.min(safeDuration, config.timing.maxMs / 1000, requestedSeconds));
}

export function resolveCaptionAnimationProgress(
  config: ShortFormCaptionAnimationPresetConfig,
  wordProgress: number,
  wordDurationSeconds: number,
) {
  const safeWordDuration = Math.max(0.04, wordDurationSeconds || 0.04);
  const sampleSeconds = Math.max(0, Math.min(1, wordProgress)) * safeWordDuration;
  const animationDurationSeconds = resolveCaptionAnimationDurationSeconds(config, safeWordDuration);
  return Math.max(0, Math.min(1, sampleSeconds / Math.max(0.04, animationDurationSeconds)));
}

export function resolveCaptionAnimationFrame(
  config: ShortFormCaptionAnimationPresetConfig,
  wordProgress: number,
  wordDurationSeconds: number,
): ShortFormCaptionAnimationResolvedFrame {
  const progress = resolveCaptionAnimationProgress(config, wordProgress, wordDurationSeconds);
  return {
    scale: evaluateCaptionAnimationTrack(config.motion.scale, progress),
    translateXEm: evaluateCaptionAnimationTrack(config.motion.translateXEm, progress),
    translateYEm: evaluateCaptionAnimationTrack(config.motion.translateYEm, progress),
    extraOutlineWidth: evaluateCaptionAnimationTrack(config.motion.extraOutlineWidth, progress),
    extraBlur: evaluateCaptionAnimationTrack(config.motion.extraBlur, progress),
    glowStrength: evaluateCaptionAnimationTrack(config.motion.glowStrength, progress),
    shadowOpacityMultiplier: evaluateCaptionAnimationTrack(config.motion.shadowOpacityMultiplier, progress),
  };
}

export function getCaptionAnimationTrackPeakValue(trackConfig: ShortFormCaptionAnimationTrack) {
  return trackConfig.keyframes.reduce((max, frame) => Math.max(max, frame.value), Number.NEGATIVE_INFINITY);
}

export function getCaptionAnimationTrackMaxAbsValue(trackConfig: ShortFormCaptionAnimationTrack) {
  return trackConfig.keyframes.reduce((max, frame) => Math.max(max, Math.abs(frame.value)), 0);
}

export function resolveCaptionAnimationColor(
  mode: ShortFormCaptionAnimationColorMode,
  palette: { activeWordColor: string; outlineColor: string; shadowColor: string },
  customColor?: string,
) {
  if (mode === 'custom' && customColor && /^#[0-9A-F]{6}$/i.test(customColor)) {
    return customColor.toUpperCase();
  }
  if (mode === 'style-outline') return palette.outlineColor;
  if (mode === 'style-shadow') return palette.shadowColor;
  return palette.activeWordColor;
}

export function getCaptionAnimationPreviewMetadata(preset: ShortFormCaptionAnimationPresetEntry) {
  return {
    usesStableWordSlots: preset.config.layoutMode !== 'fluid',
    peakScale: Math.max(1, getCaptionAnimationTrackPeakValue(preset.config.motion.scale)),
    maxTranslateXEm: getCaptionAnimationTrackMaxAbsValue(preset.config.motion.translateXEm),
    maxTranslateYEm: getCaptionAnimationTrackMaxAbsValue(preset.config.motion.translateYEm),
    maxExtraBlur: Math.max(0, getCaptionAnimationTrackPeakValue(preset.config.motion.extraBlur)),
    maxExtraOutlineWidth: Math.max(0, getCaptionAnimationTrackPeakValue(preset.config.motion.extraOutlineWidth)),
  };
}
