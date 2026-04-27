import type { Metadata } from "next";
import type { ReactNode } from "react";
import { ShortFormVideoDetailShell } from "@/components/short-form-video/ShortFormVideoDetailShell";
import { createEntityPageTitle, createPageMetadata } from "@/lib/metadata";
import { normalizeShortFormProject } from "@/lib/short-form-video-client";
import { getShortFormProject } from "@/lib/short-form-videos";

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

export default async function ShortFormVideoDetailLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const project = getShortFormProject(id);

  return (
    <ShortFormVideoDetailShell
      projectId={id}
      initialProject={project ? normalizeShortFormProject(project) : null}
    >
      {children}
    </ShortFormVideoDetailShell>
  );
}
