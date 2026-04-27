import { notFound, redirect } from 'next/navigation';
import { ShortFormVideoSettingsView } from '@/components/short-form-video/ShortFormVideoSettingsView';
import {
  LEGACY_SHORT_FORM_SETTINGS_SECTION_REDIRECTS,
  buildShortFormSettingsHref,
  isShortFormSettingsRouteSection,
} from '@/lib/short-form-video-navigation';

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

  return <ShortFormVideoSettingsView activeSection={section} />;
}
