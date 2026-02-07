import { NextRequest, NextResponse } from "next/server";
import { getXPost, saveFeedback } from "@/lib/xposts";
import {
  appendStatusLog,
  updateDeliverableStatus,
  DeliverableStatus,
} from "@/lib/status";
import fs from "fs";
import path from "path";
import { exec } from "child_process";

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
  const { feedback, rating, doMore, doLess, tryNew, status, note } = body;

  // If this is a status change request (from StatusChangeForm)
  if (status) {
    const oldStatus = post.status;
    const newStatus = status as DeliverableStatus;

    // Update status in file
    updateDeliverableStatus(post.filePath, newStatus);

    // Append to status log
    appendStatusLog(
      post.filePath,
      oldStatus,
      newStatus,
      "ittai",
      note || feedback || `Status changed to ${status}`
    );

    // If requesting changes, save feedback and spawn Scribe
    if (newStatus === "requested changes" && feedback) {
      const feedbackDir = path.dirname(post.filePath);
      const feedbackFilePath = path.join(
        feedbackDir,
        `post-${post.postNumber}-revision-feedback.md`
      );

      const feedbackMd = `# Revision Feedback for Post ${post.postNumber}
**Date:** ${new Date().toISOString().split("T")[0]}
**From:** Ittai
**Status Change:** ${oldStatus} → requested changes

## Feedback
${feedback}

## Action Required
Revise this post based on the feedback and resubmit for review.
`;

      fs.writeFileSync(feedbackFilePath, feedbackMd, "utf-8");

      // Spawn Scribe session to revise
      spawnAgentRevision(post.filePath, feedbackFilePath, post.postNumber);
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

function spawnAgentRevision(
  deliverablePath: string,
  feedbackPath: string,
  postNumber: number
) {
  const task = `You have received feedback on X post #${postNumber}. Please:

1. Read the post at: ${deliverablePath}
2. Read the feedback at: ${feedbackPath}
3. Revise the post based on the feedback
4. Update the status from "requested changes" to "needs review" in the file
5. Write a status log entry by creating/updating the file: ${deliverablePath.replace(".md", "-status-log.json")}
   - Add entry: {"timestamp": "${new Date().toISOString()}", "from": "requested changes", "to": "needs review", "by": "scribe", "note": "Revised based on feedback"}

Keep the same post format. Focus on addressing the specific feedback.`;

  const cmd = `claude -p "${task.replace(/"/g, '\\"')}" --allowedTools "Read,Write,Edit" 2>/dev/null &`;

  exec(cmd, { cwd: process.env.HOME }, (error) => {
    if (error) {
      console.error("Failed to spawn scribe session:", error.message);
    }
  });
}
