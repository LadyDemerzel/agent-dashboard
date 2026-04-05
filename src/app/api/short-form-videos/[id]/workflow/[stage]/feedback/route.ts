import { NextRequest, NextResponse } from "next/server";
import { createThread, getThreadsForDeliverable } from "@/lib/feedback";
import { getShortFormProject, getStageFilePath, type ShortFormStageKey } from "@/lib/short-form-videos";

export const dynamic = "force-dynamic";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; stage: string }> }
) {
  const { id, stage: rawStage } = await params;
  const stage = rawStage as ShortFormStageKey;
  const project = getShortFormProject(id);
  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  const filePath = getStageFilePath(id, stage);
  return NextResponse.json({ threads: getThreadsForDeliverable(filePath) });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; stage: string }> }
) {
  const { id, stage: rawStage } = await params;
  const stage = rawStage as ShortFormStageKey;
  const project = getShortFormProject(id);
  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  const body = await request.json().catch(() => ({}));
  const { content, startLine, endLine, author = "user" } = body;

  if (!content) {
    return NextResponse.json({ error: "content is required" }, { status: 400 });
  }

  const hasLineNumbers = typeof startLine === "number" && typeof endLine === "number";
  const filePath = getStageFilePath(id, stage);
  const thread = createThread(
    filePath,
    `${id}:${stage}`,
    stage === "research" ? "oracle" : stage === "script" ? "scribe" : "workflow",
    hasLineNumbers ? startLine : null,
    hasLineNumbers ? endLine : null,
    content,
    author
  );

  return NextResponse.json({ thread }, { status: 201 });
}
