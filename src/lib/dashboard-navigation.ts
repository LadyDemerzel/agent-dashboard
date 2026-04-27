import {
  SHORT_FORM_DETAIL_SECTIONS,
  SHORT_FORM_SETTINGS_SECTIONS,
  type ShortFormDetailRouteSection,
  type ShortFormSettingsRouteSection,
} from '@/lib/short-form-video-navigation';

export interface DashboardBreadcrumbItem {
  label: string;
  href?: string;
  truncate?: boolean;
}

const TOP_LEVEL_LABELS: Record<string, string> = {
  '/': 'Dashboard',
  '/deliverables': 'Deliverables',
  '/research': 'Research',
  '/x-posts': 'X Posts',
  '/youtube-videos': 'YouTube Videos',
  '/short-form-video': 'Short-Form Video',
  '/timeline': 'Timeline',
  '/agents': 'Agents',
};

const SHORT_FORM_DETAIL_LABELS: Record<ShortFormDetailRouteSection, string> = {
  topic: 'Topic',
  hook: 'Hook',
  research: 'Research',
  'text-script': 'Text Script',
  'plan-visuals': 'Plan Visuals',
  'generate-visuals': 'Generate Visuals',
  'plan-sound-design': 'Plan Sound Design',
  'generate-sound-design': 'Generate Sound Design',
  'final-video': 'Final Video',
};

const SHORT_FORM_SETTINGS_LABELS: Record<ShortFormSettingsRouteSection, string> = {
  prompts: 'Prompts',
  audio: 'Audio',
  'sound-library': 'Sound Library',
  images: 'Images',
  captions: 'Captions',
  backgrounds: 'Backgrounds',
  music: 'Music',
};

function titleCaseSegment(segment: string) {
  return segment
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export function getRouteLabel(pathname: string) {
  return TOP_LEVEL_LABELS[pathname] || null;
}

export function buildDashboardBreadcrumbs(
  pathname: string,
  options?: { shortFormProjectLabel?: string }
): DashboardBreadcrumbItem[] {
  if (!pathname || pathname === '/') {
    return [{ label: 'Dashboard' }];
  }

  const segments = pathname.split('/').filter(Boolean);
  const topLevel = `/${segments[0]}`;
  const topLevelLabel = getRouteLabel(topLevel);

  if (!topLevelLabel) {
    return [{ label: 'Dashboard' }];
  }

  if (segments[0] === 'short-form-video') {
    const crumbs: DashboardBreadcrumbItem[] = [{ label: topLevelLabel, href: '/short-form-video' }];

    if (!segments[1]) {
      return [{ label: topLevelLabel }];
    }

    if (segments[1] === 'settings') {
      crumbs.push({ label: 'Settings', href: '/short-form-video/settings/prompts' });
      const section = segments[2] as ShortFormSettingsRouteSection | undefined;
      if (section && (SHORT_FORM_SETTINGS_SECTIONS as readonly string[]).includes(section)) {
        crumbs.push({ label: SHORT_FORM_SETTINGS_LABELS[section] });
      }
      return crumbs;
    }

    const projectId = segments[1];
    const projectLabel = options?.shortFormProjectLabel?.trim() || 'Project';

    crumbs.push({ label: projectLabel, href: projectId ? `/short-form-video/${projectId}/topic` : undefined, truncate: true });
    const section = segments[2] as ShortFormDetailRouteSection | undefined;
    if (section && (SHORT_FORM_DETAIL_SECTIONS as readonly string[]).includes(section)) {
      crumbs.push({ label: SHORT_FORM_DETAIL_LABELS[section] });
    }
    return crumbs;
  }

  const crumbs: DashboardBreadcrumbItem[] = [{ label: topLevelLabel, href: topLevel }];

  if (!segments[1]) {
    return [{ label: topLevelLabel }];
  }

  crumbs.push({ label: topLevel === '/agents' ? 'Agent' : 'Detail' });

  if (segments[2]) {
    crumbs.push({ label: titleCaseSegment(segments[2]) });
  }

  return crumbs;
}
