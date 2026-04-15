import type { Metadata } from "next";
import type { ReactNode } from "react";
import { getShortFormProject } from "@/lib/short-form-videos";
import { createEntityPageTitle, createPageMetadata } from "@/lib/metadata";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const project = getShortFormProject(id);
  const title = project?.title || project?.topic || id;

  return createPageMetadata(
    createEntityPageTitle("Short-Form Project", title),
    project ? "Short-form workflow review, feedback, and generation controls." : undefined
  );
}

export default function ShortFormVideoDetailLayout({ children }: { children: ReactNode }) {
  return children;
}
