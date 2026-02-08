import { NextRequest, NextResponse } from "next/server";
import { getResearchFiles } from "@/lib/research";
import { createThread, getThreadsForDeliverable } from "@/lib/feedback";
import path from "path";

const RESEARCH_DIR = path.join(
  process.env.HOME || "/Users/ittaisvidler",
  "tenxsolo",
  "business",
  "market-research",
  "deliverables"
);

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const files = getResearchFiles();
  const file = files.find((f) => f.id === id);

  if (!file) {
    return NextResponse.json({ error: "Research not found" }, { status: 404 });
  }

  const filePath = path.join(RESEARCH_DIR, file.filename);
  const threads = getThreadsForDeliverable(filePath);

  return NextResponse.json({ threads });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const files = getResearchFiles();
  const file = files.find((f) => f.id === id);

  if (!file) {
    return NextResponse.json({ error: "Research not found" }, { status: 404 });
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

  const filePath = path.join(RESEARCH_DIR, file.filename);
  
  const thread = createThread(
    filePath,
    id,
    "echo", // Research is done by Echo agent
    hasLineNumbers ? startLine : null,
    hasLineNumbers ? endLine : null,
    content,
    author
  );

  return NextResponse.json({ thread }, { status: 201 });
}
