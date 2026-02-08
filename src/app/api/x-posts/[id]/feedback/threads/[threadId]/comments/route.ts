import { NextRequest, NextResponse } from "next/server";
import { getXPost } from "@/lib/xposts";
import { addComment } from "@/lib/feedback";

export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; threadId: string }> }
) {
  const { id, threadId } = await params;
  const post = getXPost(id);

  if (!post) {
    return NextResponse.json({ error: "Post not found" }, { status: 404 });
  }

  const body = await request.json();
  const { content, author } = body;

  if (!content || !author || (author !== "user" && author !== "agent")) {
    return NextResponse.json(
      { error: "content and author ('user' or 'agent') are required" },
      { status: 400 }
    );
  }

  const comment = addComment(post.filePath, threadId, content, author);

  if (!comment) {
    return NextResponse.json({ error: "Thread not found" }, { status: 404 });
  }

  return NextResponse.json({ comment }, { status: 201 });
}
