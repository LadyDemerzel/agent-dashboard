import { NextRequest, NextResponse } from "next/server";
import { getShortFormProject, selectShortFormProjectPayload, updateProjectMeta } from "@/lib/short-form-videos";
import { resolveShortFormImageStyle } from "@/lib/short-form-image-styles";
import { getShortFormVideoRenderSettings } from "@/lib/short-form-video-render-settings";
import { getSoundDesignHandoffState } from "@/lib/short-form-sound-design-handoff";
import { isShortFormVisualGenerationModelId } from "@/lib/short-form-visual-generation";
import { normalizeShortFormAutoRunState } from "@/lib/short-form-auto-run";
import { reconcileStaleShortFormAutoRun } from "@/lib/short-form-auto-run-orchestrator";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const project = reconcileStaleShortFormAutoRun(id) || getShortFormProject(id);
  if (!project) {
    return NextResponse.json({ success: false, error: "Project not found" }, { status: 404 });
  }

  const view = request.nextUrl.searchParams.get("view") || request.nextUrl.searchParams.get("section");
  return NextResponse.json({
    success: true,
    data: selectShortFormProjectPayload(project, view),
  });
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
  const title = typeof body.title === "string"
    ? body.title.trim()
    : typeof body.name === "string"
      ? body.name.trim()
      : undefined;
  const selectedImageStyleId = typeof body.selectedImageStyleId === "string" ? body.selectedImageStyleId.trim() : undefined;
  const visualGenerationModelIdOverride = body.visualGenerationModelIdOverride === null
    ? null
    : typeof body.visualGenerationModelIdOverride === "string"
      ? body.visualGenerationModelIdOverride.trim()
      : undefined;
  const selectedVoiceId = typeof body.selectedVoiceId === "string" ? body.selectedVoiceId.trim() : undefined;
  const selectedMusicId = body.selectedMusicId === null ? null : typeof body.selectedMusicId === "string" ? body.selectedMusicId.trim() : undefined;
  const selectedCaptionStyleId = body.selectedCaptionStyleId === null ? null : typeof body.selectedCaptionStyleId === "string" ? body.selectedCaptionStyleId.trim() : undefined;
  const soundDesignDecision = body.soundDesignDecision === null
    ? null
    : body.soundDesignDecision === "approved" || body.soundDesignDecision === "skipped"
      ? body.soundDesignDecision
      : undefined;
  const soundDesignSkipReason = body.soundDesignSkipReason === null
    ? null
    : typeof body.soundDesignSkipReason === "string"
      ? body.soundDesignSkipReason.trim()
      : undefined;
  const textScriptMaxIterationsOverride = body.textScriptMaxIterationsOverride === null
    ? null
    : typeof body.textScriptMaxIterationsOverride === "number" && Number.isFinite(body.textScriptMaxIterationsOverride)
      ? Math.max(1, Math.min(8, Math.round(body.textScriptMaxIterationsOverride)))
      : undefined;
  const captionMaxWordsOverride = body.captionMaxWordsOverride === null
    ? null
    : typeof body.captionMaxWordsOverride === "number" && Number.isFinite(body.captionMaxWordsOverride)
      ? Math.max(2, Math.min(12, Math.round(body.captionMaxWordsOverride)))
      : undefined;
  const pauseRemovalMinSilenceDurationSecondsOverride = body.pauseRemovalMinSilenceDurationSecondsOverride === null
    ? null
    : typeof body.pauseRemovalMinSilenceDurationSecondsOverride === "number" && Number.isFinite(body.pauseRemovalMinSilenceDurationSecondsOverride)
      ? Math.min(2.5, Math.max(0.01, Math.round(body.pauseRemovalMinSilenceDurationSecondsOverride * 100) / 100))
      : undefined;
  const pauseRemovalSilenceThresholdDbOverride = body.pauseRemovalSilenceThresholdDbOverride === null
    ? null
    : typeof body.pauseRemovalSilenceThresholdDbOverride === "number" && Number.isFinite(body.pauseRemovalSilenceThresholdDbOverride)
      ? Math.min(-5, Math.max(-80, Math.round(body.pauseRemovalSilenceThresholdDbOverride * 10) / 10))
      : undefined;
  const autoRun = body.autoRun === null
    ? null
    : body.autoRun && typeof body.autoRun === "object" && !Array.isArray(body.autoRun)
      ? normalizeShortFormAutoRunState(body.autoRun)
      : undefined;

  if (selectedImageStyleId !== undefined) {
    const resolved = resolveShortFormImageStyle(selectedImageStyleId);
    if (resolved.resolvedStyleId !== selectedImageStyleId) {
      return NextResponse.json({ success: false, error: "Selected image style no longer exists" }, { status: 400 });
    }
  }

  if (
    visualGenerationModelIdOverride !== undefined
    && visualGenerationModelIdOverride !== null
    && !isShortFormVisualGenerationModelId(visualGenerationModelIdOverride)
  ) {
    return NextResponse.json(
      { success: false, error: "Selected visual generation provider/model is unsupported" },
      { status: 400 },
    );
  }

  if (selectedVoiceId !== undefined || selectedMusicId !== undefined || selectedCaptionStyleId !== undefined) {
    const settings = getShortFormVideoRenderSettings();
    if (selectedVoiceId !== undefined && !settings.voices.some((voice) => voice.id === selectedVoiceId)) {
      return NextResponse.json({ success: false, error: "Selected voice no longer exists" }, { status: 400 });
    }
    if (selectedMusicId !== undefined && selectedMusicId !== null && !settings.musicTracks.some((track) => track.id === selectedMusicId)) {
      return NextResponse.json({ success: false, error: "Selected music preset no longer exists" }, { status: 400 });
    }
    if (
      selectedCaptionStyleId !== undefined
      && selectedCaptionStyleId !== null
      && !settings.captionStyles.some((style) => style.id === selectedCaptionStyleId)
    ) {
      return NextResponse.json({ success: false, error: "Selected caption style no longer exists" }, { status: 400 });
    }
  }

  if (soundDesignDecision === "skipped" && !(soundDesignSkipReason || project.soundDesignSkipReason)) {
    return NextResponse.json({ success: false, error: "Add a brief reason before skipping sound design" }, { status: 400 });
  }

  if (title !== undefined && !title) {
    return NextResponse.json({ success: false, error: "Video name cannot be empty" }, { status: 400 });
  }

  if (soundDesignDecision === "approved") {
    const handoff = getSoundDesignHandoffState({
      soundDesignDecision,
      soundDesignSkipReason: soundDesignSkipReason ?? project.soundDesignSkipReason,
      soundDesign: project.soundDesign,
    });
    if (!handoff.canApprove) {
      return NextResponse.json({
        success: false,
        error: handoff.gateReason || "Generate Sound Design must have a resolved preview mix before it can be approved.",
      }, { status: 400 });
    }
  }

  const soundDesignApprovalWarning = soundDesignDecision === "approved"
    ? getSoundDesignHandoffState({
        soundDesignDecision,
        soundDesignSkipReason: soundDesignSkipReason ?? project.soundDesignSkipReason,
        soundDesign: project.soundDesign,
      }).approvalWarnings.join(" ")
    : undefined;

  const updated = updateProjectMeta(id, {
    ...(topic !== undefined ? { topic } : {}),
    ...(title !== undefined ? { name: title, title } : topic ? { name: topic, title: topic } : {}),
    ...(selectedImageStyleId !== undefined ? { selectedImageStyleId } : {}),
    ...(visualGenerationModelIdOverride !== undefined
      ? {
          visualGenerationModelIdOverride:
            visualGenerationModelIdOverride === null
              ? undefined
              : visualGenerationModelIdOverride,
        }
      : {}),
    ...(selectedVoiceId !== undefined ? { selectedVoiceId } : {}),
    ...(selectedMusicId !== undefined ? { selectedMusicId: selectedMusicId === null ? undefined : selectedMusicId } : {}),
    ...(selectedCaptionStyleId !== undefined ? { selectedCaptionStyleId: selectedCaptionStyleId === null ? undefined : selectedCaptionStyleId } : {}),
    ...(soundDesignDecision !== undefined
      ? {
          soundDesignDecision: soundDesignDecision === null ? undefined : soundDesignDecision,
          soundDesignSkipReason:
            soundDesignDecision === "skipped"
              ? (soundDesignSkipReason === null ? undefined : soundDesignSkipReason || undefined)
              : undefined,
          soundDesignApprovalWarning: soundDesignApprovalWarning || undefined,
        }
      : soundDesignSkipReason !== undefined
        ? { soundDesignSkipReason: soundDesignSkipReason === null ? undefined : soundDesignSkipReason || undefined }
        : {}),
    ...(textScriptMaxIterationsOverride !== undefined
      ? { textScriptMaxIterationsOverride: textScriptMaxIterationsOverride === null ? undefined : textScriptMaxIterationsOverride }
      : {}),
    ...(captionMaxWordsOverride !== undefined
      ? { captionMaxWordsOverride: captionMaxWordsOverride === null ? undefined : captionMaxWordsOverride }
      : {}),
    ...(pauseRemovalMinSilenceDurationSecondsOverride !== undefined
      ? {
          pauseRemovalMinSilenceDurationSecondsOverride:
            pauseRemovalMinSilenceDurationSecondsOverride === null
              ? undefined
              : pauseRemovalMinSilenceDurationSecondsOverride,
        }
      : {}),
    ...(pauseRemovalSilenceThresholdDbOverride !== undefined
      ? {
          pauseRemovalSilenceThresholdDbOverride:
            pauseRemovalSilenceThresholdDbOverride === null
              ? undefined
              : pauseRemovalSilenceThresholdDbOverride,
        }
      : {}),
    ...(autoRun !== undefined
      ? { autoRun: autoRun === null ? undefined : autoRun }
      : {}),
  });

  return NextResponse.json({ success: true, data: updated });
}
