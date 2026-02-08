import { NextResponse } from "next/server";
import { getAgentStatusWithSessions } from "@/lib/sessions";

export const dynamic = "force-dynamic";

export async function GET() {
  const statusMap = getAgentStatusWithSessions();
  return NextResponse.json(statusMap);
}
