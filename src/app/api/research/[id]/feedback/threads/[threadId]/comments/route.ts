import { NextRequest, NextResponse } from "next/server";
import { getResearchFiles } from "@/lib/research";
import { addComment } from "@/lib/feedback";
import path from "path";

const RESEARCH_DIR = path.join(
  process.env.HOME || "/Users/ittaisvidler",
  "tenxsolo",
  "business",
  "market-research",
  "deliverables"
);

export const dynamic = "force-dynamic";

export async function POST(
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
  const { content, author } = body;

  if (!content || !author || (author !== "user" && author !== "agent")) {
    return NextResponse.json(
      { error: "content and author ('user' or 'agent') are required" },
      { status: 400 }
    );
  }

  const filePath = path.join(RESEARCH_DIR, file.filename);
  const comment = addComment(filePath, threadId, content, author);

  if (!comment) {
    return NextResponse.json({ error: "Thread not found" }, { status: 404 });
  }

  return NextResponse.json({ comment }, { status: 201 });
}
