import { NextRequest, NextResponse } from "next/server";
import { duplicateShortFormProject, getShortFormProject } from "@/lib/short-form-videos";

export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const title = typeof body.title === "string" ? body.title.trim() : undefined;

  const meta = duplicateShortFormProject(id, { title });
  if (!meta) {
    return NextResponse.json({ success: false, error: "Project not found" }, { status: 404 });
  }

  const project = getShortFormProject(meta.id);
  return NextResponse.json({ success: true, data: project }, { status: 201 });
}
