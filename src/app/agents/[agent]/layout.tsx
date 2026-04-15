import type { Metadata } from "next";
import type { ReactNode } from "react";
import { getAgent } from "@/lib/agents";
import { createEntityPageTitle, createPageMetadata } from "@/lib/metadata";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ agent: string }>;
}): Promise<Metadata> {
  const { agent: agentId } = await params;
  const agent = getAgent(agentId);

  return createPageMetadata(
    createEntityPageTitle("Agent", agent?.name),
    agent ? `${agent.name}'s dashboard workspace, files, and live status.` : undefined
  );
}

export default function AgentDetailLayout({ children }: { children: ReactNode }) {
  return children;
}
