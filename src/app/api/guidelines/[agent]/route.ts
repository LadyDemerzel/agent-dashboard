import { NextRequest, NextResponse } from "next/server";
import {
  isValidAgent,
  getGuidelineFiles,
  saveGuidelineFile,
} from "@/lib/guidelines";

export const dynamic = "force-dynamic";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ agent: string }> }
) {
  const { agent: agentId } = await params;

  if (!isValidAgent(agentId)) {
    return NextResponse.json({ error: "Invalid agent" }, { status: 404 });
  }

  const files = getGuidelineFiles(agentId);
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

  if (file !== "SOUL.md" && file !== "AGENTS.md") {
    return NextResponse.json(
      { error: "Can only edit SOUL.md or AGENTS.md" },
      { status: 400 }
    );
  }

  const success = saveGuidelineFile(agentId, file, content);

  if (!success) {
    return NextResponse.json(
      { error: "Failed to save file" },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true, file, agentId });
}
