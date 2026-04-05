import { NextRequest, NextResponse } from "next/server";
import { updateThreadStatus } from "@/lib/feedback";
import { getShortFormProject, getStageFilePath, type ShortFormStageKey } from "@/lib/short-form-videos";

export const dynamic = "force-dynamic";

export async function PATCH(
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
  const status = body.status === "resolved" ? "resolved" : "open";
  const updated = updateThreadStatus(getStageFilePath(id, stage), threadId, status);

  if (!updated) {
    return NextResponse.json({ error: "Thread not found" }, { status: 404 });
  }

  return NextResponse.json({ thread: updated });
}
