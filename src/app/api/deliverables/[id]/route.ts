import { NextRequest, NextResponse } from "next/server";
import { getDeliverables } from "@/lib/files";
import fs from "fs";
import path from "path";

const BUSINESS_ROOT = path.join(
  process.env.HOME || "/Users/ittaisvidler",
  "tenxsolo",
  "business"
);

export const dynamic = "force-dynamic";

export async function PATCH(
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
  const { content } = body;

  if (content === undefined) {
    return NextResponse.json(
      { error: "Content is required" },
      { status: 400 }
    );
  }

  const filePath = path.join(BUSINESS_ROOT, deliverable.relativePath);

  if (!fs.existsSync(filePath)) {
    return NextResponse.json(
      { error: "File not found" },
      { status: 404 }
    );
  }

  try {
    fs.writeFileSync(filePath, content, "utf-8");
    return NextResponse.json({
      success: true,
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Failed to update deliverable:", error);
    return NextResponse.json(
      { error: "Failed to update deliverable" },
      { status: 500 }
    );
  }
}
