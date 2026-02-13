import { NextResponse } from "next/server";
import { getAgentFiles, isValidAgent } from "@/lib/agent-files";
import { getAgent } from "@/lib/agents";
import { getAgentStatusWithSessions } from "@/lib/sessions";
import fs from "fs";
import path from "path";

const AGENTS_DIR = path.join(
  process.env.HOME || "/Users/ittaisvidler",
  ".openclaw",
  "agents"
);

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ agent: string }> }
) {
  const { agent: agentId } = await params;

  if (!isValidAgent(agentId)) {
    return NextResponse.json({ error: "Agent not found" }, { status: 404 });
  }

  const agent = getAgent(agentId);
  const files = getAgentFiles(agentId);
  const sessionStatus = getAgentStatusWithSessions();

  if (!agent || !files) {
    return NextResponse.json({ error: "Agent not found" }, { status: 404 });
  }

  return NextResponse.json({
    agent,
    files,
    sessionStatus: sessionStatus[agentId] || { status: "idle" },
  });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ agent: string }> }
) {
  const { agent: agentId } = await params;

  if (!isValidAgent(agentId)) {
    return NextResponse.json({ error: "Agent not found" }, { status: 404 });
  }

  try {
    const body = await request.json();
    const { file, content } = body;

    if (!file || !content) {
      return NextResponse.json(
        { error: "File name and content are required" },
        { status: 400 }
      );
    }

    // Validate file name to prevent directory traversal
    const validFiles = ["SOUL.md", "AGENTS.md", "USER.md", "TOOLS.md", "HEARTBEAT.md", "IDENTITY.md", "MEMORY.md"];
    if (!validFiles.includes(file)) {
      return NextResponse.json(
        { error: "Invalid file name" },
        { status: 400 }
      );
    }

    const filePath = path.join(AGENTS_DIR, agentId, file);
    
    // Ensure directory exists
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    // Write file
    fs.writeFileSync(filePath, content, "utf-8");

    return NextResponse.json({ success: true, message: `${file} saved successfully` });
  } catch (error) {
    console.error("Failed to save agent file:", error);
    return NextResponse.json(
      { error: "Failed to save file", details: String(error) },
      { status: 500 }
    );
  }
}
