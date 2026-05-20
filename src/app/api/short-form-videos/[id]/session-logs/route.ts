import { NextRequest, NextResponse } from "next/server";
import { getShortFormProject } from "@/lib/short-form-videos";
import { readShortFormSessionLogs } from "@/lib/short-form-session-logs";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const project = getShortFormProject(id);
  if (!project) {
    return NextResponse.json({ success: false, error: "Project not found" }, { status: 404 });
  }

  const searchParams = request.nextUrl.searchParams;
  const agentId = searchParams.get("agentId") || "";
  const sessionId = searchParams.get("sessionId") || "";
  const sessionKey = searchParams.get("sessionKey") || undefined;
  const maxEntries = Number(searchParams.get("maxEntries") || "240");

  if (!agentId || (!sessionId && !sessionKey)) {
    return NextResponse.json({
      success: true,
      data: {
        agentId,
        sessionId,
        sessionKey,
        entries: [],
      },
    });
  }

  const logs = readShortFormSessionLogs(agentId, sessionId, {
    maxEntries: Number.isFinite(maxEntries) ? maxEntries : undefined,
    sessionKey,
  });

  if (!logs) {
    return NextResponse.json({ success: false, error: "Invalid session log request" }, { status: 400 });
  }

  return NextResponse.json({ success: true, data: logs });
}
