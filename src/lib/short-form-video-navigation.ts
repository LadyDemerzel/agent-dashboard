export const SHORT_FORM_DETAIL_SECTIONS = [
  'topic',
  'hook',
  'research',
  'text-script',
  'plan-visuals',
  'generate-visuals',
  'plan-sound-design',
  'generate-sound-design',
  'final-video',
] as const;

export type ShortFormDetailRouteSection = (typeof SHORT_FORM_DETAIL_SECTIONS)[number];

export const LEGACY_SHORT_FORM_DETAIL_SECTION_REDIRECTS: Record<string, ShortFormDetailRouteSection> = {
  visuals: 'generate-visuals',
  'sound-design': 'plan-sound-design',
};

export const SHORT_FORM_SETTINGS_SECTIONS = [
  'prompts',
  'audio',
  'sound-library',
  'images',
  'captions',
  'backgrounds',
  'music',
] as const;

export type ShortFormSettingsRouteSection = (typeof SHORT_FORM_SETTINGS_SECTIONS)[number];

export const LEGACY_SHORT_FORM_SETTINGS_SECTION_REDIRECTS: Record<string, { section: ShortFormSettingsRouteSection; hash?: string }> = {
  'sound-design': { section: 'sound-library' },
  'visuals-style': { section: 'images', hash: 'image-styles' },
};

export function isShortFormDetailRouteSection(value: string): value is ShortFormDetailRouteSection {
  return (SHORT_FORM_DETAIL_SECTIONS as readonly string[]).includes(value);
}

export function isShortFormSettingsRouteSection(value: string): value is ShortFormSettingsRouteSection {
  return (SHORT_FORM_SETTINGS_SECTIONS as readonly string[]).includes(value);
}

export function buildShortFormDetailHref(projectId: string, section: ShortFormDetailRouteSection) {
  return `/short-form-video/${projectId}/${section}`;
}

export function buildShortFormSettingsHref(
  section: ShortFormSettingsRouteSection,
  options?: { hash?: string; query?: string | URLSearchParams }
) {
  const base = `/short-form-video/settings/${section}`;
  const query = options?.query
    ? `?${typeof options.query === 'string' ? options.query : options.query.toString()}`
    : '';
  const hash = options?.hash ? `#${options.hash}` : '';
  return `${base}${query}${hash}`;
}

export const SHORT_FORM_SETTINGS_ANCHOR_TO_SECTION: Record<string, ShortFormSettingsRouteSection> = {
  'prompt-hooks': 'prompts',
  'prompt-research': 'prompts',
  'text-script-prompts': 'prompts',
  'xml-visual-planning': 'prompts',
  'pause-removal': 'audio',
  'tts-voice': 'audio',
  'sound-library': 'sound-library',
  'image-templates': 'images',
  'image-styles': 'images',
  'caption-styles': 'captions',
  'background-videos': 'backgrounds',
  'music-library': 'music',
};
