import { NextRequest, NextResponse } from "next/server";
import { getXPost } from "@/lib/xposts";
import { createThread, getThreadsForDeliverable } from "@/lib/feedback";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const post = getXPost(id);

  if (!post) {
    return NextResponse.json({ error: "Post not found" }, { status: 404 });
  }

  const threads = getThreadsForDeliverable(post.filePath);

  return NextResponse.json({ threads });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const post = getXPost(id);

  if (!post) {
    return NextResponse.json({ error: "Post not found" }, { status: 404 });
  }

  const body = await request.json();
  const { startLine, endLine, content, author = "user" } = body;

  if (!content) {
    return NextResponse.json(
      { error: "content is required" },
      { status: 400 }
    );
  }

  // Allow null/undefined startLine and endLine for top-level comments
  const hasLineNumbers = typeof startLine === "number" && typeof endLine === "number";

  const thread = createThread(
    post.filePath,
    id,
    "scribe", // X Posts are done by Scribe agent
    hasLineNumbers ? startLine : null,
    hasLineNumbers ? endLine : null,
    content,
    author
  );

  return NextResponse.json({ thread }, { status: 201 });
}
