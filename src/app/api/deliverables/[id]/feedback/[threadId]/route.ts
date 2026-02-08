import { NextRequest, NextResponse } from "next/server";
import { getDeliverables } from "@/lib/files";
import { updateThreadStatus } from "@/lib/feedback";
import path from "path";

const BUSINESS_ROOT = path.join(
  process.env.HOME || "/Users/ittaisvidler",
  "tenxsolo",
  "business"
);

export const dynamic = "force-dynamic";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; threadId: string }> }
) {
  const { id, threadId } = await params;
  const deliverables = getDeliverables();
  const deliverable = deliverables.find((d) => d.id === id);

  if (!deliverable) {
    return NextResponse.json(
      { error: "Deliverable not found" },
      { status: 404 }
    );
  }

  const body = await request.json();
  const { status } = body;

  if (status !== "open" && status !== "resolved") {
    return NextResponse.json(
      { error: "status must be 'open' or 'resolved'" },
      { status: 400 }
    );
  }

  const filePath = path.join(BUSINESS_ROOT, deliverable.relativePath);
  const thread = updateThreadStatus(filePath, threadId, status);

  if (!thread) {
    return NextResponse.json(
      { error: "Thread not found" },
      { status: 404 }
    );
  }

  return NextResponse.json({ thread });
}
