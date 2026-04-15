import type { Metadata } from "next";
import type { ReactNode } from "react";
import { getResearchFiles } from "@/lib/research";
import { createEntityPageTitle, createPageMetadata } from "@/lib/metadata";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const file = getResearchFiles().find((item) => item.id === id);

  return createPageMetadata(
    createEntityPageTitle("Research", file?.title),
    file ? "Research deliverable details and feedback history." : undefined
  );
}

export default function ResearchDetailLayout({ children }: { children: ReactNode }) {
  return children;
}
