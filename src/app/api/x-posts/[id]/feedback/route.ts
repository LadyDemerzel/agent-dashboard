import { NextRequest, NextResponse } from "next/server";
import { getXPost, saveFeedback } from "@/lib/xposts";
import {
  appendStatusLog,
  updateDeliverableStatus,
  DeliverableStatus,
} from "@/lib/status";
import { createThread } from "@/lib/feedback";
import { snapshotVersionOnStatusChange } from "@/lib/version-ops";
import { deleteDeliverable } from "@/lib/delete";
import { spawnAgentForFeedback, shouldSpawnAgent } from "@/lib/agent-spawn";
import fs from "fs";
import path from "path";

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

    snapshotVersionOnStatusChange(post.filePath, oldStatus, newStatus, updatedBy || "ittai", feedbackContent);

    if (newStatus === "requested changes" && feedbackContent) {
      createThread(post.filePath, id, "scribe", null, null, feedbackContent, "user");
    }

    // Spawn the agent if status changed to "requested changes"
    let spawnResult = null;
    if (shouldSpawnAgent(oldStatus, newStatus)) {
      const relativePath = path.relative(
        path.join(process.env.HOME || "/Users/ittaisvidler", "tenxsolo", "business"),
        post.filePath
      );
      spawnResult = await spawnAgentForFeedback(
        "scribe",
        id,
        relativePath,
        updatedBy || "ittai"
      );
    }

    return NextResponse.json({
      success: true,
      status: newStatus,
      logged: true,
      spawn: spawnResult,
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

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  // Resolve file path directly from ID (YYYY-MM-DD_post-N) to handle archived posts too
  const match = id.match(/^(\d{4}-\d{2}-\d{2})_post-(\d+)$/);
  if (!match) {
    return NextResponse.json({ error: "Invalid post ID" }, { status: 400 });
  }

  const postsDir = path.join(
    process.env.HOME || "/Users/ittaisvidler",
    "tenxsolo", "business", "content", "deliverables", "x-posts"
  );
  const filePath = path.join(postsDir, match[1], `post-${match[2]}.md`);

  if (!fs.existsSync(filePath)) {
    return NextResponse.json({ error: "Post not found" }, { status: 404 });
  }

  const result = deleteDeliverable(filePath);

  return NextResponse.json({
    success: true,
    deleted: result.deleted,
  });
}
