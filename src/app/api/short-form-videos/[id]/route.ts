import { NextRequest, NextResponse } from "next/server";
import { getShortFormProject, updateProjectMeta } from "@/lib/short-form-videos";
import { resolveShortFormImageStyle } from "@/lib/short-form-image-styles";
import { getShortFormVideoRenderSettings } from "@/lib/short-form-video-render-settings";

export const dynamic = "force-dynamic";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const project = getShortFormProject(id);
  if (!project) {
    return NextResponse.json({ success: false, error: "Project not found" }, { status: 404 });
  }

  return NextResponse.json({ success: true, data: project });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const project = getShortFormProject(id);
  if (!project) {
    return NextResponse.json({ success: false, error: "Project not found" }, { status: 404 });
  }

  const body = await request.json().catch(() => ({}));
  const topic = typeof body.topic === "string" ? body.topic.trim() : undefined;
  const title = typeof body.title === "string" ? body.title.trim() : undefined;
  const selectedImageStyleId = typeof body.selectedImageStyleId === "string" ? body.selectedImageStyleId.trim() : undefined;
  const selectedVoiceId = typeof body.selectedVoiceId === "string" ? body.selectedVoiceId.trim() : undefined;

  if (selectedImageStyleId !== undefined) {
    const resolved = resolveShortFormImageStyle(selectedImageStyleId);
    if (resolved.resolvedStyleId !== selectedImageStyleId) {
      return NextResponse.json({ success: false, error: "Selected image style no longer exists" }, { status: 400 });
    }
  }

  if (selectedVoiceId !== undefined) {
    const settings = getShortFormVideoRenderSettings();
    if (!settings.voices.some((voice) => voice.id === selectedVoiceId)) {
      return NextResponse.json({ success: false, error: "Selected voice no longer exists" }, { status: 400 });
    }
  }

  const updated = updateProjectMeta(id, {
    ...(topic !== undefined ? { topic } : {}),
    ...(title !== undefined ? { title } : topic ? { title: topic } : {}),
    ...(selectedImageStyleId !== undefined ? { selectedImageStyleId } : {}),
    ...(selectedVoiceId !== undefined ? { selectedVoiceId } : {}),
  });

  return NextResponse.json({ success: true, data: updated });
}
