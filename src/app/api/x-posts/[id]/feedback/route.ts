import { NextRequest, NextResponse } from "next/server";
import { getXPost, saveFeedback } from "@/lib/xposts";
import {
  appendStatusLog,
  updateDeliverableStatus,
  DeliverableStatus,
} from "@/lib/status";
import { createThread } from "@/lib/feedback";

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
  const { feedback, rating, doMore, doLess, tryNew, status, note, updatedBy } = body;

  // If this is a status change request (from StatusChangeForm)
  if (status) {
    const oldStatus = post.status;
    const newStatus = status as DeliverableStatus;

    // Update status in file
    updateDeliverableStatus(post.filePath, newStatus);

    // Append to status log
    const feedbackContent = note || feedback;
    appendStatusLog(
      post.filePath,
      oldStatus,
      newStatus,
      updatedBy || "ittai",
      feedbackContent || `Status changed to ${status}`
    );

    if (newStatus === "requested changes" && feedbackContent) {
      createThread(post.filePath, id, "scribe", null, null, feedbackContent, "user");
    }

    return NextResponse.json({
      success: true,
      status: newStatus,
      logged: true,
    });
  }

  // Original feedback flow (FeedbackForm with rating)
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
