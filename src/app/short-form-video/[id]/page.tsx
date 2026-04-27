import { redirect } from 'next/navigation';

export default async function ShortFormVideoDetailRootPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/short-form-video/${id}/topic`);
}
