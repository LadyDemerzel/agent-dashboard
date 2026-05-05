import fs from "fs";
import path from "path";
import { NextRequest, NextResponse } from "next/server";
import { getShortFormProject, updateProjectMeta } from "@/lib/short-form-videos";
import {
  autoFixShortFormSoundDesignAudibility,
  getShortFormSoundDesignPreviewFileName,
  renderShortFormSoundDesignPreview,
  resolveShortFormSoundDesign,
  readShortFormSoundDesignDocument,
} from "@/lib/short-form-sound-design";
import {
  getShortFormMusicLibraryDir,
  getShortFormVideoRenderSettings,
  resolveShortFormMusicSelection,
} from "@/lib/short-form-video-render-settings";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const HOME_DIR = process.env.HOME || "/Users/ittaisvidler";

function getNarrationPath(projectId: string) {
  return path.join(
    HOME_DIR,
    "tenxsolo",
    "business",
    "content",
    "deliverables",
    "short-form-videos",
    projectId,
    "output",
    "xml-script-work",
    "voice",
    "narration-full.wav"
  );
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const project = getShortFormProject(id);
  if (!project) {
    return NextResponse.json({ success: false, error: "Project not found" }, { status: 404 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const autoFix = body && typeof body.action === "string" && body.action.trim() === "auto-fix";
    const requestedMode = body && typeof body.mode === "string" ? body.mode.trim() : "full";
    if (requestedMode !== "full" && requestedMode !== "without-sfx" && requestedMode !== "effects-only") {
      return NextResponse.json({ success: false, error: "mode must be one of full, without-sfx, or effects-only" }, { status: 400 });
    }
    const mode = requestedMode;
    const track = body && typeof body.track === "string" && body.track.trim() ? body.track.trim() : undefined;
    const narrationPath = getNarrationPath(id);
    if ((mode === "full" || mode === "without-sfx") && !fs.existsSync(narrationPath)) {
      return NextResponse.json({ success: false, error: "Narration audio is missing. Run XML Script first." }, { status: 400 });
    }

    const autoFixResult = autoFix ? autoFixShortFormSoundDesignAudibility(id) : undefined;
    const resolution = autoFixResult?.resolution || resolveShortFormSoundDesign(id);
    if (mode === "effects-only" && track) {
      const availableTracks = new Set(
        resolution.events
          .filter((event) => event.status === "resolved" && !event.muted && event.assetRelativePath)
          .map((event) => event.track)
          .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
      );
      if (!availableTracks.has(track)) {
        return NextResponse.json({
          success: false,
          error: availableTracks.size > 0
            ? `Track \"${track}\" is unavailable for review. Choose one of: ${Array.from(availableTracks).sort().join(", ")}.`
            : "No resolved sound-design tracks are available for isolated review yet.",
        }, { status: 400 });
      }
    }

    const selectedMusic = resolveShortFormMusicSelection(project.selectedMusicId);
    const musicPath = selectedMusic.music?.generatedAudioRelativePath
      ? path.join(getShortFormMusicLibraryDir(), selectedMusic.music.generatedAudioRelativePath)
      : undefined;
    const settings = getShortFormVideoRenderSettings();
    const outputFileName = getShortFormSoundDesignPreviewFileName(mode, track);
    const result = renderShortFormSoundDesignPreview({
      projectId: id,
      narrationPath,
      musicPath,
      musicVolume: settings.musicVolume,
      includeNarration: mode !== "effects-only",
      includeMusic: mode !== "effects-only",
      includeSoundEffects: mode !== "without-sfx",
      onlyTrack: mode === "effects-only" ? track : undefined,
      outputFileName,
      persistAsDefault: mode === "full" && !track,
    });
    const doc = readShortFormSoundDesignDocument(id);
    updateProjectMeta(id, {
      soundDesignDecision: undefined,
      soundDesignSkipReason: undefined,
      soundDesignApprovalWarning: undefined,
    });

    return NextResponse.json({
      success: true,
      data: {
        ...doc,
        previewAudioRelativePath: result.previewRelativePath,
        previewAudioUrl: `/api/short-form-videos/${id}/media/${result.previewRelativePath}`,
        previewMode: mode,
        previewTrack: track || null,
        resolution: doc.resolution,
        ...(autoFixResult ? {
          autoFix: {
            changedEventCount: autoFixResult.changedEventCount,
            changedMusicSegmentCount: autoFixResult.changedMusicSegmentCount,
            boostDb: autoFixResult.boostDb,
          },
          message: `Auto-fixed audibility by boosting ${autoFixResult.changedEventCount} events and ${autoFixResult.changedMusicSegmentCount} music segments, then rendered a fresh preview.`,
        } : {}),
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to render sound-design preview";
    const status = /missing|no resolved|no audio sources/i.test(message) ? 400 : 500;
    return NextResponse.json({ success: false, error: message }, { status });
  }
}
