import { NextRequest, NextResponse } from "next/server";
import { getDeliverables } from "@/lib/files";
import { 
  readVersionHistory, 
  getVersionHistoryList,
  addVersion,
  initializeVersionHistory
} from "@/lib/versions";

export const dynamic = "force-dynamic";

// GET /api/deliverables/[id]/versions - List all versions
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

  const versions = getVersionHistoryList(deliverable.filePath);
  const history = readVersionHistory(deliverable.filePath);

  return NextResponse.json({
    versions,
    currentVersion: history.currentVersion,
  });
}

// POST /api/deliverables/[id]/versions - Create a new version
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
      deliverable.filePath,
      content,
      updatedBy,
      comment,
      feedbackAddressed
    );

    return NextResponse.json({
      success: true,
      version: entry,
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 }
    );
  }
}

// PUT /api/deliverables/[id]/versions - Initialize version history
export async function PUT(
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

  try {
    const body = await request.json();
    const { content, agentName } = body;

    if (!content || !agentName) {
      return NextResponse.json(
        { error: "Missing required fields: content, agentName" },
        { status: 400 }
      );
    }

    initializeVersionHistory(deliverable.filePath, content, agentName);

    const history = readVersionHistory(deliverable.filePath);

    return NextResponse.json({
      success: true,
      currentVersion: history.currentVersion,
      versions: history.versions.length,
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 }
    );
  }
}