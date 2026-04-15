import type { Metadata } from "next";
import type { ReactNode } from "react";
import { getDeliverables } from "@/lib/files";
import { createEntityPageTitle, createPageMetadata } from "@/lib/metadata";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const deliverable = getDeliverables().find((item) => item.id === id);

  return createPageMetadata(
    createEntityPageTitle("Deliverable", deliverable?.title),
    deliverable ? `${deliverable.agentName} deliverable details.` : undefined
  );
}

export default function DeliverableDetailLayout({ children }: { children: ReactNode }) {
  return children;
}
