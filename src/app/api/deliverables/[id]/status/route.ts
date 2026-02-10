import { NextRequest, NextResponse } from "next/server";
import { getDeliverables } from "@/lib/files";
import {
  appendStatusLog,
  updateDeliverableStatus,
  DeliverableStatus,
} from "@/lib/status";
import { createThread } from "@/lib/feedback";
import path from "path";

const BUSINESS_ROOT = path.join(
  process.env.HOME || "/Users/ittaisvidler",
  "tenxsolo",
  "business"
);

export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const deliverables = getDeliverables();
  const deliverable = deliverables.find((d) => d.id === id);

  if (!deliverable) {
    return NextResponse.json(
      { error: "Deliverable not found" },
      { status: 404 }
    );
  }

  const body = await request.json();
  const { status, note, updatedBy } = body;

  if (!status) {
    return NextResponse.json(
      { error: "Status is required" },
      { status: 400 }
    );
  }

  const filePath = path.join(BUSINESS_ROOT, deliverable.relativePath);
  const oldStatus = deliverable.status;
  const newStatus = status as DeliverableStatus;

  updateDeliverableStatus(filePath, newStatus);
  appendStatusLog(
    filePath,
    oldStatus,
    newStatus,
    updatedBy || "ittai",
    note || `Status changed to ${status}`
  );

  if (newStatus === "requested changes" && note) {
    createThread(filePath, id, deliverable.agentId, null, null, note, "user");
  }

  return NextResponse.json({
    success: true,
    status: newStatus,
    logged: true,
  });
}
