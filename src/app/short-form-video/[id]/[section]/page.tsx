import { notFound, redirect } from 'next/navigation';
import { ShortFormVideoDetailView } from '@/components/short-form-video/ShortFormVideoDetailView';
import {
  LEGACY_SHORT_FORM_DETAIL_SECTION_REDIRECTS,
  isShortFormDetailRouteSection,
} from '@/lib/short-form-video-navigation';

export default async function ShortFormVideoDetailSectionPage({
  params,
}: {
  params: Promise<{ id: string; section: string }>;
}) {
  const { id, section } = await params;

  if (!isShortFormDetailRouteSection(section)) {
    const redirectSection = LEGACY_SHORT_FORM_DETAIL_SECTION_REDIRECTS[section];
    if (redirectSection) {
      redirect(`/short-form-video/${id}/${redirectSection}`);
    }
    notFound();
  }

  return <ShortFormVideoDetailView projectId={id} activeSection={section} />;
}
