import { NextRequest, NextResponse } from "next/server";
import { getDeliverables } from "@/lib/files";
import { addComment, updateThreadStatus } from "@/lib/feedback";
import path from "path";

const BUSINESS_ROOT = path.join(
  process.env.HOME || "/Users/ittaisvidler",
  "tenxsolo",
  "business"
);

export const dynamic = "force-dynamic";

export async function POST(
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
  const { content, author } = body;

  if (!content || !author || (author !== "user" && author !== "agent")) {
    return NextResponse.json(
      { error: "content and author ('user' or 'agent') are required" },
      { status: 400 }
    );
  }

  const filePath = path.join(BUSINESS_ROOT, deliverable.relativePath);
  const comment = addComment(filePath, threadId, content, author);

  if (!comment) {
    return NextResponse.json(
      { error: "Thread not found" },
      { status: 404 }
    );
  }

  return NextResponse.json({ comment }, { status: 201 });
}
