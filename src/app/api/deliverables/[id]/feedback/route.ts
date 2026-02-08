import { NextRequest, NextResponse } from "next/server";
import { getDeliverables } from "@/lib/files";
import { createThread, getThreadsForDeliverable } from "@/lib/feedback";
import path from "path";

const BUSINESS_ROOT = path.join(
  process.env.HOME || "/Users/ittaisvidler",
  "tenxsolo",
  "business"
);

export const dynamic = "force-dynamic";

export async function GET(
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

  const filePath = path.join(BUSINESS_ROOT, deliverable.relativePath);
  const threads = getThreadsForDeliverable(filePath);

  return NextResponse.json({ threads });
}

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
  const { startLine, endLine, content, author = "user" } = body;

  if (!content) {
    return NextResponse.json(
      { error: "content is required" },
      { status: 400 }
    );
  }

  // Allow null/undefined startLine and endLine for top-level comments
  const hasLineNumbers = typeof startLine === "number" && typeof endLine === "number";

  const filePath = path.join(BUSINESS_ROOT, deliverable.relativePath);
  
  const thread = createThread(
    filePath,
    id,
    deliverable.agentId,
    hasLineNumbers ? startLine : null,
    hasLineNumbers ? endLine : null,
    content,
    author
  );

  return NextResponse.json({ thread }, { status: 201 });
}
