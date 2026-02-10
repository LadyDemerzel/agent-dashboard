import { NextRequest, NextResponse } from "next/server";
import { isValidAgent } from "@/lib/agent-files";
import { getAgentStatus, setAgentStatus } from "@/lib/agent-status";

export const dynamic = "force-dynamic";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ agent: string }> }
) {
  const { agent: agentId } = await params;

  if (!isValidAgent(agentId)) {
    return NextResponse.json({ error: "Invalid agent" }, { status: 404 });
  }

  const status = getAgentStatus(agentId);
  if (!status) {
    return NextResponse.json({
      status: "idle",
      updatedAt: new Date().toISOString(),
    });
  }

  return NextResponse.json(status);
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ agent: string }> }
) {
  const { agent: agentId } = await params;

  if (!isValidAgent(agentId)) {
    return NextResponse.json({ error: "Invalid agent" }, { status: 404 });
  }

  const body = await request.json();
  const { status, deliverableId, progress, eta, message, priority } = body;

  if (!status) {
    return NextResponse.json(
      { error: "status is required" },
      { status: 400 }
    );
  }

  const entry = setAgentStatus(agentId, {
    status,
    deliverableId,
    progress,
    eta,
    message,
    priority,
  });

  return NextResponse.json(entry);
}
