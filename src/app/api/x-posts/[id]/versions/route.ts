import { NextRequest, NextResponse } from "next/server";
import { getXPost } from "@/lib/xposts";
import {
  getVersionHistoryList,
  readVersionHistory,
  addVersion,
  initializeVersionHistory,
} from "@/lib/versions";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const post = getXPost(id);

  if (!post) {
    return NextResponse.json({ error: "Post not found" }, { status: 404 });
  }

  const versions = getVersionHistoryList(post.filePath);
  const history = readVersionHistory(post.filePath);

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
  const post = getXPost(id);

  if (!post) {
    return NextResponse.json({ error: "Post not found" }, { status: 404 });
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

    const entry = addVersion(
      post.filePath,
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
  const post = getXPost(id);

  if (!post) {
    return NextResponse.json({ error: "Post not found" }, { status: 404 });
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

    initializeVersionHistory(post.filePath, content, agentName);
    const history = readVersionHistory(post.filePath);

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
