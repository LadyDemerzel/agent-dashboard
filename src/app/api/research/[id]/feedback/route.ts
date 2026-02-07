import { NextRequest, NextResponse } from "next/server";
import { getResearchFiles } from "@/lib/research";
import {
  appendStatusLog,
  updateDeliverableStatus,
  DeliverableStatus,
} from "@/lib/status";
import fs from "fs";
import path from "path";
import { exec } from "child_process";

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
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const files = getResearchFiles();
  const file = files.find((f) => f.id === id);

  if (!file) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await request.json();
  const { status, feedback, note } = body;

  if (!status) {
    return NextResponse.json(
      { error: "Status is required" },
      { status: 400 }
    );
  }

  const filePath = path.join(RESEARCH_DIR, file.filename);
  const oldStatus = file.status;
  const newStatus = status as DeliverableStatus;

  // Update status in the file
  updateDeliverableStatus(filePath, newStatus);

  // Append to status log
  appendStatusLog(
    filePath,
    oldStatus,
    newStatus,
    "ittai",
    note || `Status changed to ${status}`
  );

  // If requesting changes, save feedback and spawn Echo to revise
  if (newStatus === "requested changes" && feedback) {
    // Save feedback file
    const feedbackDir = path.join(RESEARCH_DIR, "feedback");
    if (!fs.existsSync(feedbackDir)) {
      fs.mkdirSync(feedbackDir, { recursive: true });
    }

    const today = new Date().toISOString().split("T")[0];
    const feedbackPath = path.join(
      feedbackDir,
      `${file.filename.replace(".md", "")}-feedback-${today}.md`
    );

    const feedbackMd = `# Feedback on ${file.title}
**Date:** ${today}
**From:** Ittai
**Status Change:** ${oldStatus} → requested changes

## Feedback
${feedback}

## Action Required
Revise the research based on this feedback and resubmit for review.
`;

    fs.writeFileSync(feedbackPath, feedbackMd, "utf-8");

    // Spawn Echo session to revise
    spawnAgentRevision("echo", filePath, feedbackPath, file.filename);
  }

  return NextResponse.json({
    success: true,
    status: newStatus,
    logged: true,
  });
}

function spawnAgentRevision(
  agentId: string,
  deliverablePath: string,
  feedbackPath: string,
  filename: string
) {
  const task = `You have received feedback on your research deliverable. Please:

1. Read the research at: ${deliverablePath}
2. Read the feedback at: ${feedbackPath}
3. Revise the research based on the feedback
4. Update the status from "requested changes" to "needs review" in the file
5. Write a status log entry by creating/updating the file: ${deliverablePath.replace(".md", "-status-log.json")}
   - Add entry: {"timestamp": "${new Date().toISOString()}", "from": "requested changes", "to": "needs review", "by": "${agentId}", "note": "Revised based on feedback"}

Focus on addressing the specific feedback. Keep the same format and structure.`;

  // Use sessions_spawn via claude CLI
  const cmd = `claude -p "${task.replace(/"/g, '\\"')}" --allowedTools "Read,Write,Edit" 2>/dev/null &`;

  exec(cmd, { cwd: process.env.HOME }, (error) => {
    if (error) {
      console.error(`Failed to spawn ${agentId} session:`, error.message);
    }
  });
}
