import { NextRequest, NextResponse } from "next/server";
import {
  isValidAgent,
  getAgentFiles,
  saveAgentFile,
  AgentFileName,
} from "@/lib/agent-files";

export const dynamic = "force-dynamic";

const VALID_FILES: AgentFileName[] = [
  "SOUL.md",
  "AGENTS.md",
  "USER.md",
  "TOOLS.md",
  "BOOTSTRAP.md",
  "HEARTBEAT.md",
  "IDENTITY.md",
  "MEMORY.md",
];

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ agent: string }> }
) {
  const { agent: agentId } = await params;

  if (!isValidAgent(agentId)) {
    return NextResponse.json({ error: "Invalid agent" }, { status: 404 });
  }

  const files = getAgentFiles(agentId);
  if (!files) {
    return NextResponse.json({ error: "Files not found" }, { status: 404 });
  }

  return NextResponse.json(files);
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
  const { file, content } = body;

  if (!file || !content) {
    return NextResponse.json(
      { error: "File and content are required" },
      { status: 400 }
    );
  }

  if (!VALID_FILES.includes(file as AgentFileName)) {
    return NextResponse.json(
      { error: `Can only edit one of: ${VALID_FILES.join(", ")}` },
      { status: 400 }
    );
  }

  const success = saveAgentFile(agentId, file as AgentFileName, content);

  if (!success) {
    return NextResponse.json(
      { error: "Failed to save file" },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true, file, agentId });
}
