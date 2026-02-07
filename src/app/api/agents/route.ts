import { NextResponse } from "next/server";
import { AGENTS } from "@/lib/agents";
import { getAgentStats } from "@/lib/files";

export const dynamic = "force-dynamic";

export async function GET() {
  const stats = getAgentStats();

  const agents = AGENTS.map((agent) => ({
    ...agent,
    deliverableCount: stats[agent.id]?.deliverableCount ?? 0,
    lastActivity: stats[agent.id]?.lastActivity ?? agent.lastActivity,
  }));

  return NextResponse.json(agents);
}
