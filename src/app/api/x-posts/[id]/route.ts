import { NextResponse } from "next/server";
import { getXPost, getFeedbackForPost } from "@/lib/xposts";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const post = getXPost(id);

  if (!post) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const feedback = getFeedbackForPost(post.postNumber);

  return NextResponse.json({ ...post, feedback });
}
