import { NextRequest, NextResponse } from "next/server";
import { getResearchFiles } from "@/lib/research";
import { updateThreadStatus } from "@/lib/feedback";
import path from "path";

const RESEARCH_DIR = path.join(
  process.env.HOME || "/Users/ittaisvidler",
  "tenxsolo",
  "business",
  "market-research",
  "deliverables"
);

export const dynamic = "force-dynamic";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; threadId: string }> }
) {
  const { id, threadId } = await params;
  const files = getResearchFiles();
  const file = files.find((f) => f.id === id);

  if (!file) {
    return NextResponse.json({ error: "Research not found" }, { status: 404 });
  }

  const body = await request.json();
  const { status } = body;

  if (status !== "open" && status !== "resolved") {
    return NextResponse.json(
      { error: "status must be 'open' or 'resolved'" },
      { status: 400 }
    );
  }

  const filePath = path.join(RESEARCH_DIR, file.filename);
  const thread = updateThreadStatus(filePath, threadId, status);

  if (!thread) {
    return NextResponse.json({ error: "Thread not found" }, { status: 404 });
  }

  return NextResponse.json({ thread });
}
