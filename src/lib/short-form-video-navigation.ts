export const SHORT_FORM_DETAIL_SECTIONS = [
  'topic',
  'hook',
  'research',
  'text-script',
  'generate-narration-audio',
  'plan-captions',
  'plan-visuals',
  'generate-visuals',
  'plan-sound-design',
  'generate-sound-design',
  'final-video',
] as const;

export type ShortFormDetailRouteSection = (typeof SHORT_FORM_DETAIL_SECTIONS)[number];

export const LEGACY_SHORT_FORM_DETAIL_SECTION_REDIRECTS: Record<string, ShortFormDetailRouteSection> = {
  visuals: 'generate-visuals',
  'narration-audio': 'generate-narration-audio',
  'sound-design': 'plan-sound-design',
};

export const SHORT_FORM_SETTINGS_SECTIONS = [
  'topic',
  'hook',
  'research',
  'text-script',
  'generate-narration-audio',
  'plan-captions',
  'plan-visuals',
  'generate-visuals-motion-graphics',
  'generate-visuals-image-generation-prompts',
  'generate-visuals-image-styles',
  'plan-sound-design',
  'generate-sound-design',
  'final-video',
] as const;

export type ShortFormSettingsRouteSection = (typeof SHORT_FORM_SETTINGS_SECTIONS)[number];

export const SHORT_FORM_SETTINGS_SECTION_TITLES = {
  topic: 'Topic',
  hook: 'Hook',
  research: 'Research',
  'text-script': 'Text Script',
  'generate-narration-audio': 'Generate Narration Audio',
  'plan-captions': 'Plan Captions',
  'plan-visuals': 'Plan Visuals',
  'generate-visuals-motion-graphics': 'Motion Graphics',
  'generate-visuals-image-generation-prompts': 'Image Generation Prompts',
  'generate-visuals-image-styles': 'Image Styles',
  'plan-sound-design': 'Plan Sound Design',
  'generate-sound-design': 'Generate Sound Design',
  'final-video': 'Final Video',
} satisfies Record<ShortFormSettingsRouteSection, string>;

export function getShortFormSettingsSectionTitle(section: ShortFormSettingsRouteSection): string {
  return SHORT_FORM_SETTINGS_SECTION_TITLES[section];
}

export const LEGACY_SHORT_FORM_SETTINGS_SECTION_REDIRECTS: Record<string, { section: ShortFormSettingsRouteSection; hash?: string }> = {
  prompts: { section: 'hook', hash: 'prompt-hooks' },
  audio: { section: 'generate-narration-audio' },
  'sound-library': { section: 'plan-sound-design', hash: 'sound-library' },
  images: { section: 'generate-visuals-image-styles' },
  captions: { section: 'plan-captions', hash: 'caption-styles' },
  backgrounds: { section: 'final-video', hash: 'background-videos' },
  music: { section: 'final-video', hash: 'music-library' },
  'sound-design': { section: 'plan-sound-design' },
  'generate-visuals': { section: 'generate-visuals-motion-graphics' },
  'motion-graphics': { section: 'generate-visuals-motion-graphics' },
  'image-templates': { section: 'generate-visuals-image-generation-prompts' },
  'image-styles': { section: 'generate-visuals-image-styles' },
  'visuals-style': { section: 'generate-visuals-image-styles' },
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
  'prompt-hooks': 'hook',
  'prompt-research': 'research',
  'text-script-prompts': 'text-script',
  'xml-visual-planning': 'plan-visuals',
  'pause-removal': 'generate-narration-audio',
  'tts-voice': 'generate-narration-audio',
  'sound-library': 'plan-sound-design',
  'motion-graphics': 'generate-visuals-motion-graphics',
  'image-templates': 'generate-visuals-image-generation-prompts',
  'image-styles': 'generate-visuals-image-styles',
  'caption-styles': 'plan-captions',
  'background-videos': 'final-video',
  'music-library': 'final-video',
  'final-video-render': 'final-video',
};
