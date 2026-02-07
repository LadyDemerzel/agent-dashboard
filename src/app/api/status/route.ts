import { NextResponse } from "next/server";
import { AGENTS } from "@/lib/agents";
import { getAgentStats, getDeliverables } from "@/lib/files";

export const dynamic = "force-dynamic";

export async function GET() {
  const stats = getAgentStats();
  const deliverables = getDeliverables();

  const totalDeliverables = deliverables.length;
  const byStatus = {
    draft: deliverables.filter((d) => d.status === "draft").length,
    review: deliverables.filter((d) => d.status === "review").length,
    approved: deliverables.filter((d) => d.status === "approved").length,
    published: deliverables.filter((d) => d.status === "published").length,
  };

  const activeAgents = AGENTS.filter((a) => a.status === "working").length;

  return NextResponse.json({
    totalAgents: AGENTS.length,
    activeAgents,
    totalDeliverables,
    byStatus,
    lastUpdated: new Date().toISOString(),
  });
}
