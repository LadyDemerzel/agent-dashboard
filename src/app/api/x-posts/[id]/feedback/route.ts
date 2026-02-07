import { NextRequest, NextResponse } from "next/server";
import { getXPost, saveFeedback } from "@/lib/xposts";

export const dynamic = "force-dynamic";

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
  const { feedback, rating, doMore, doLess, tryNew } = body;

  if (!feedback || !rating) {
    return NextResponse.json(
      { error: "Feedback and rating are required" },
      { status: 400 }
    );
  }

  const filename = saveFeedback(
    post.postNumber,
    post.content,
    feedback,
    rating,
    doMore || "",
    doLess || "",
    tryNew || ""
  );

  return NextResponse.json({ success: true, filename });
}
