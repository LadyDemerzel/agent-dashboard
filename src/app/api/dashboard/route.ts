import { NextResponse } from "next/server";
import { getAgentStats, getDeliverables } from "@/lib/files";
import { getResearchFiles } from "@/lib/research";
import { getAgentStatusWithSessions } from "@/lib/sessions";

export const dynamic = "force-dynamic";

export async function GET() {
  const stats = getAgentStats();
  const deliverables = getDeliverables();
  const researchFiles = getResearchFiles();
  const sessionStatus = getAgentStatusWithSessions();

  return NextResponse.json({
    stats,
    deliverables,
    researchFiles,
    sessionStatus,
  });
}
