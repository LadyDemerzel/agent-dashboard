import { NextRequest, NextResponse } from "next/server";
import { getResearchFiles } from "@/lib/research";
import {
  appendStatusLog,
  updateDeliverableStatus,
  DeliverableStatus,
} from "@/lib/status";
import { createThread } from "@/lib/feedback";
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
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const files = getResearchFiles();
  const file = files.find((f) => f.id === id);

  if (!file) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await request.json();
  const { status, note, feedback, updatedBy } = body;

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
  const feedbackContent = note || feedback;
  appendStatusLog(
    filePath,
    oldStatus,
    newStatus,
    updatedBy || "ittai",
    feedbackContent || `Status changed to ${status}`
  );

  if (newStatus === "requested changes" && feedbackContent) {
    createThread(filePath, id, "echo", null, null, feedbackContent, "user");
  }

  return NextResponse.json({
    success: true,
    status: newStatus,
    logged: true,
  });
}
