import { NextRequest, NextResponse } from "next/server";
import { addComment } from "@/lib/feedback";
import { getShortFormProject, getStageFilePath, type ShortFormStageKey } from "@/lib/short-form-videos";

export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; stage: string; threadId: string }> }
) {
  const { id, stage: rawStage, threadId } = await params;
  const stage = rawStage as ShortFormStageKey;
  const project = getShortFormProject(id);
  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  const body = await request.json().catch(() => ({}));
  const content = typeof body.content === "string" ? body.content : "";
  const author = body.author === "agent" ? "agent" : "user";

  if (!content.trim()) {
    return NextResponse.json({ error: "content is required" }, { status: 400 });
  }

  const comment = addComment(getStageFilePath(id, stage), threadId, content, author);
  if (!comment) {
    return NextResponse.json({ error: "Thread not found" }, { status: 404 });
  }

  return NextResponse.json({ comment }, { status: 201 });
}
