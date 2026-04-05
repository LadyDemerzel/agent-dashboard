import { NextRequest, NextResponse } from "next/server";
import {
  createShortFormProject,
  getShortFormProject,
  listShortFormProjectRows,
  updateProjectMeta,
} from "@/lib/short-form-videos";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ success: true, data: listShortFormProjectRows() });
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const topic = typeof body.topic === "string" ? body.topic.trim() : "";

  const meta = createShortFormProject(topic);
  if (topic) {
    updateProjectMeta(meta.id, {
      topic,
      title: topic,
    });
  }

  const project = getShortFormProject(meta.id);
  return NextResponse.json({ success: true, data: project }, { status: 201 });
}
