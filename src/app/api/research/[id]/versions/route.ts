import { NextRequest, NextResponse } from "next/server";
import { getResearchFiles } from "@/lib/research";
import {
  getVersionHistoryList,
  readVersionHistory,
  addVersion,
  initializeVersionHistory,
} from "@/lib/versions";
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
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const filePath = path.join(RESEARCH_DIR, file.filename);
  const versions = getVersionHistoryList(filePath);
  const history = readVersionHistory(filePath);

  return NextResponse.json({
    versions,
    currentVersion: history.currentVersion,
  });
}

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

  try {
    const body = await request.json();
    const { content, updatedBy, comment, feedbackAddressed } = body;

    if (!content || !updatedBy) {
      return NextResponse.json(
        { error: "Missing required fields: content, updatedBy" },
        { status: 400 }
      );
    }

    const filePath = path.join(RESEARCH_DIR, file.filename);
    const entry = addVersion(
      filePath,
      content,
      updatedBy,
      comment,
      feedbackAddressed
    );

    return NextResponse.json({ success: true, version: entry });
  } catch {
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const files = getResearchFiles();
  const file = files.find((f) => f.id === id);

  if (!file) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    const body = await request.json();
    const { content, agentName } = body;

    if (!content || !agentName) {
      return NextResponse.json(
        { error: "Missing required fields: content, agentName" },
        { status: 400 }
      );
    }

    const filePath = path.join(RESEARCH_DIR, file.filename);
    initializeVersionHistory(filePath, content, agentName);
    const history = readVersionHistory(filePath);

    return NextResponse.json({
      success: true,
      currentVersion: history.currentVersion,
      versions: history.versions.length,
    });
  } catch {
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 }
    );
  }
}
