import { notFound, redirect } from 'next/navigation';
import type { Metadata } from 'next';
import type { ComponentProps } from 'react';
import { ShortFormVideoSettingsView } from '@/components/short-form-video/ShortFormVideoSettingsView';
import {
  LEGACY_SHORT_FORM_SETTINGS_SECTION_REDIRECTS,
  buildShortFormSettingsHref,
  getShortFormSettingsSectionTitle,
  isShortFormSettingsRouteSection,
} from '@/lib/short-form-video-navigation';
import { createPageMetadata } from '@/lib/metadata';
import { getShortFormSettingsPayload } from '@/lib/short-form-settings';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ section: string }>;
}): Promise<Metadata> {
  const { section } = await params;
  if (!isShortFormSettingsRouteSection(section)) {
    return createPageMetadata('Settings');
  }

  return createPageMetadata(
    `Settings: ${getShortFormSettingsSectionTitle(section)}`,
    'Configure prompts, voice, visuals, background videos, and music for the short-form workflow.',
  );
}

export default async function ShortFormVideoSettingsSectionPage({
  params,
}: {
  params: Promise<{ section: string }>;
}) {
  const { section } = await params;

  if (!isShortFormSettingsRouteSection(section)) {
    const legacyRedirect = LEGACY_SHORT_FORM_SETTINGS_SECTION_REDIRECTS[section];
    if (legacyRedirect) {
      redirect(buildShortFormSettingsHref(legacyRedirect.section, { hash: legacyRedirect.hash }));
    }
    notFound();
  }

  const initialSettings =
    getShortFormSettingsPayload() as unknown as ComponentProps<
      typeof ShortFormVideoSettingsView
    >['initialSettings'];

  return (
    <ShortFormVideoSettingsView
      activeSection={section}
      initialSettings={initialSettings}
    />
  );
}
