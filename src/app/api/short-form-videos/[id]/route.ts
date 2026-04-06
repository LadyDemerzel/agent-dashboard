import { NextRequest, NextResponse } from "next/server";
import { getShortFormProject, updateProjectMeta } from "@/lib/short-form-videos";
import { resolveShortFormImageStyle } from "@/lib/short-form-image-styles";
import { getShortFormVideoRenderSettings } from "@/lib/short-form-video-render-settings";
import { getShortFormBackgroundVideoSettings } from "@/lib/short-form-background-videos";

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
  const selectedMusicId = typeof body.selectedMusicId === "string" ? body.selectedMusicId.trim() : undefined;
  const selectedBackgroundVideoId = typeof body.selectedBackgroundVideoId === "string" ? body.selectedBackgroundVideoId.trim() : undefined;

  if (selectedImageStyleId !== undefined) {
    const resolved = resolveShortFormImageStyle(selectedImageStyleId);
    if (resolved.resolvedStyleId !== selectedImageStyleId) {
      return NextResponse.json({ success: false, error: "Selected image style no longer exists" }, { status: 400 });
    }
  }

  if (selectedVoiceId !== undefined || selectedMusicId !== undefined) {
    const settings = getShortFormVideoRenderSettings();
    if (selectedVoiceId !== undefined && !settings.voices.some((voice) => voice.id === selectedVoiceId)) {
      return NextResponse.json({ success: false, error: "Selected voice no longer exists" }, { status: 400 });
    }
    if (selectedMusicId !== undefined && !settings.musicTracks.some((track) => track.id === selectedMusicId)) {
      return NextResponse.json({ success: false, error: "Selected music preset no longer exists" }, { status: 400 });
    }
  }

  if (selectedBackgroundVideoId !== undefined) {
    const settings = getShortFormBackgroundVideoSettings();
    if (!settings.backgrounds.some((background) => background.id === selectedBackgroundVideoId)) {
      return NextResponse.json({ success: false, error: "Selected background video no longer exists" }, { status: 400 });
    }
  }

  const updated = updateProjectMeta(id, {
    ...(topic !== undefined ? { topic } : {}),
    ...(title !== undefined ? { title } : topic ? { title: topic } : {}),
    ...(selectedImageStyleId !== undefined ? { selectedImageStyleId } : {}),
    ...(selectedVoiceId !== undefined ? { selectedVoiceId } : {}),
    ...(selectedMusicId !== undefined ? { selectedMusicId } : {}),
    ...(selectedBackgroundVideoId !== undefined ? { selectedBackgroundVideoId } : {}),
  });

  return NextResponse.json({ success: true, data: updated });
}
