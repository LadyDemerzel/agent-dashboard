import { NextRequest, NextResponse } from "next/server";
import { getXPost } from "@/lib/xposts";
import { updateThreadStatus } from "@/lib/feedback";

export const dynamic = "force-dynamic";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; threadId: string }> }
) {
  const { id, threadId } = await params;
  const post = getXPost(id);

  if (!post) {
    return NextResponse.json({ error: "Post not found" }, { status: 404 });
  }

  const body = await request.json();
  const { status } = body;

  if (status !== "open" && status !== "resolved") {
    return NextResponse.json(
      { error: "status must be 'open' or 'resolved'" },
      { status: 400 }
    );
  }

  const thread = updateThreadStatus(post.filePath, threadId, status);

  if (!thread) {
    return NextResponse.json({ error: "Thread not found" }, { status: 404 });
  }

  return NextResponse.json({ thread });
}
