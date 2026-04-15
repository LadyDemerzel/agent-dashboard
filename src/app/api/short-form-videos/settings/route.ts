import { NextRequest, NextResponse } from "next/server";
import {
  getShortFormPromptDefinitions,
  getShortFormWorkflowPrompts,
  saveShortFormWorkflowPrompts,
  type ShortFormPromptKey,
} from "@/lib/short-form-workflow-prompts";
import {
  getShortFormImageStyleSettings,
  saveShortFormImageStyleSettings,
  type ShortFormImageStyleSettings,
} from "@/lib/short-form-image-styles";
import {
  getShortFormVideoRenderSettings,
  saveShortFormVideoRenderSettings,
  type ShortFormVideoRenderSettings,
} from "@/lib/short-form-video-render-settings";
import {
  getShortFormBackgroundVideoSettings,
  saveShortFormBackgroundVideoSettings,
  type ShortFormBackgroundVideoSettings,
} from "@/lib/short-form-background-videos";
import {
  getShortFormTextScriptSettings,
  saveShortFormTextScriptSettings,
  type ShortFormTextScriptSettings,
} from "@/lib/short-form-text-script-settings";

export const dynamic = "force-dynamic";

function buildPayload() {
  return {
    prompts: getShortFormWorkflowPrompts(),
    definitions: getShortFormPromptDefinitions(),
    imageStyles: getShortFormImageStyleSettings(),
    videoRender: getShortFormVideoRenderSettings(),
    backgroundVideos: getShortFormBackgroundVideoSettings(),
    textScript: getShortFormTextScriptSettings(),
  };
}

function mergeImageStylesPatch(patch: Partial<ShortFormImageStyleSettings>) {
  const current = getShortFormImageStyleSettings();
  return {
    ...current,
    ...patch,
    promptTemplates: patch.promptTemplates
      ? {
          ...current.promptTemplates,
          ...patch.promptTemplates,
        }
      : current.promptTemplates,
  } satisfies ShortFormImageStyleSettings;
}

function mergeVideoRenderPatch(patch: Partial<ShortFormVideoRenderSettings>) {
  const current = getShortFormVideoRenderSettings();
  return {
    ...current,
    ...patch,
    voices: patch.voices || current.voices,
    musicTracks: patch.musicTracks || current.musicTracks,
  } satisfies ShortFormVideoRenderSettings;
}

function mergeBackgroundVideosPatch(patch: Partial<ShortFormBackgroundVideoSettings>) {
  const current = getShortFormBackgroundVideoSettings();
  return {
    ...current,
    ...patch,
    backgrounds: patch.backgrounds || current.backgrounds,
  } satisfies ShortFormBackgroundVideoSettings;
}

export async function GET() {
  return NextResponse.json({
    success: true,
    data: buildPayload(),
  });
}

export async function PATCH(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const prompts = body && typeof body === "object" && !Array.isArray(body) ? body.prompts : undefined;
  const imageStyles = body && typeof body === "object" && !Array.isArray(body) ? body.imageStyles : undefined;
  const videoRender = body && typeof body === "object" && !Array.isArray(body) ? body.videoRender : undefined;
  const backgroundVideos = body && typeof body === "object" && !Array.isArray(body) ? body.backgroundVideos : undefined;
  const textScript = body && typeof body === "object" && !Array.isArray(body) ? body.textScript : undefined;

  if (prompts === undefined && imageStyles === undefined && videoRender === undefined && backgroundVideos === undefined && textScript === undefined) {
    return NextResponse.json({ success: false, error: "prompts, imageStyles, videoRender, backgroundVideos, or textScript is required" }, { status: 400 });
  }

  if (prompts !== undefined) {
    if (!prompts || typeof prompts !== "object" || Array.isArray(prompts)) {
      return NextResponse.json({ success: false, error: "prompts must be an object" }, { status: 400 });
    }

    const updates: Partial<Record<ShortFormPromptKey, string>> = {};

    for (const definition of getShortFormPromptDefinitions()) {
      const value = prompts[definition.key];
      if (value === undefined) continue;
      if (typeof value !== "string" || !value.trim()) {
        return NextResponse.json(
          { success: false, error: `${definition.title} prompt must be a non-empty string` },
          { status: 400 }
        );
      }
      updates[definition.key] = value;
    }

    saveShortFormWorkflowPrompts(updates);
  }

  if (imageStyles !== undefined) {
    if (!imageStyles || typeof imageStyles !== "object" || Array.isArray(imageStyles)) {
      return NextResponse.json({ success: false, error: "imageStyles must be an object" }, { status: 400 });
    }

    const candidate = mergeImageStylesPatch(imageStyles as Partial<ShortFormImageStyleSettings>);
    if (typeof candidate.commonConstraints !== "string" || !candidate.commonConstraints.trim()) {
      return NextResponse.json({ success: false, error: "Common constraints must be a non-empty string" }, { status: 400 });
    }
    if (!Array.isArray(candidate.styles) || candidate.styles.length === 0) {
      return NextResponse.json({ success: false, error: "At least one image style is required" }, { status: 400 });
    }

    saveShortFormImageStyleSettings(candidate);
  }

  if (videoRender !== undefined) {
    if (!videoRender || typeof videoRender !== "object" || Array.isArray(videoRender)) {
      return NextResponse.json({ success: false, error: "videoRender must be an object" }, { status: 400 });
    }

    const candidate = mergeVideoRenderPatch(videoRender as Partial<ShortFormVideoRenderSettings>);
    if (!Array.isArray(candidate.voices) || candidate.voices.length === 0) {
      return NextResponse.json({ success: false, error: "At least one saved voice is required" }, { status: 400 });
    }
    if (typeof candidate.defaultVoiceId !== "string" || !candidate.defaultVoiceId.trim()) {
      return NextResponse.json({ success: false, error: "Default voice must be selected" }, { status: 400 });
    }
    if (!candidate.voices.some((voice) => voice.id === candidate.defaultVoiceId)) {
      return NextResponse.json({ success: false, error: "Default voice must reference an existing saved voice" }, { status: 400 });
    }
    if (!Array.isArray(candidate.musicTracks) || candidate.musicTracks.length === 0) {
      return NextResponse.json({ success: false, error: "At least one saved music preset is required" }, { status: 400 });
    }
    if (typeof candidate.defaultMusicTrackId !== "string" || !candidate.defaultMusicTrackId.trim()) {
      return NextResponse.json({ success: false, error: "Default music preset must be selected" }, { status: 400 });
    }
    if (!candidate.musicTracks.some((track) => track.id === candidate.defaultMusicTrackId)) {
      return NextResponse.json({ success: false, error: "Default music preset must reference an existing saved preset" }, { status: 400 });
    }
    if (typeof candidate.musicVolume !== "number" || Number.isNaN(candidate.musicVolume) || candidate.musicVolume < 0 || candidate.musicVolume > 1) {
      return NextResponse.json({ success: false, error: "Music volume must be a number between 0 and 1" }, { status: 400 });
    }

    if (typeof candidate.captionMaxWords !== "number" || Number.isNaN(candidate.captionMaxWords) || candidate.captionMaxWords < 2 || candidate.captionMaxWords > 12) {
      return NextResponse.json({ success: false, error: "Caption max words must be a number between 2 and 12" }, { status: 400 });
    }

    for (const voice of candidate.voices) {
      if (typeof voice.id !== "string" || !voice.id.trim()) {
        return NextResponse.json({ success: false, error: "Each voice must have an id" }, { status: 400 });
      }
      if (typeof voice.name !== "string" || !voice.name.trim()) {
        return NextResponse.json({ success: false, error: "Each voice must have a name" }, { status: 400 });
      }
      if (voice.mode !== "voice-design" && voice.mode !== "custom-voice") {
        return NextResponse.json({ success: false, error: `Voice ${voice.name} has an unsupported mode` }, { status: 400 });
      }
      if (typeof voice.voiceDesignPrompt !== "string" || !voice.voiceDesignPrompt.trim()) {
        return NextResponse.json({ success: false, error: `Voice ${voice.name} needs a VoiceDesign prompt` }, { status: 400 });
      }
      if (typeof voice.previewText !== "string" || !voice.previewText.trim()) {
        return NextResponse.json({ success: false, error: `Voice ${voice.name} needs preview sample text` }, { status: 400 });
      }
      if (voice.mode === "custom-voice" && (typeof voice.speaker !== "string" || !voice.speaker.trim())) {
        return NextResponse.json({ success: false, error: `Legacy/custom voice ${voice.name} must include a speaker` }, { status: 400 });
      }
    }

    for (const track of candidate.musicTracks) {
      if (typeof track.id !== "string" || !track.id.trim()) {
        return NextResponse.json({ success: false, error: "Each music preset must have an id" }, { status: 400 });
      }
      if (typeof track.name !== "string" || !track.name.trim()) {
        return NextResponse.json({ success: false, error: "Each music preset must have a name" }, { status: 400 });
      }
      if (typeof track.prompt !== "string" || !track.prompt.trim()) {
        return NextResponse.json({ success: false, error: `Music preset ${track.name} needs a prompt` }, { status: 400 });
      }
      if (
        track.previewDurationSeconds !== undefined
        && (typeof track.previewDurationSeconds !== "number" || Number.isNaN(track.previewDurationSeconds) || track.previewDurationSeconds < 6 || track.previewDurationSeconds > 30)
      ) {
        return NextResponse.json({ success: false, error: `Music preset ${track.name} must use a preview duration between 6 and 30 seconds` }, { status: 400 });
      }
    }

    saveShortFormVideoRenderSettings(candidate);
  }

  if (textScript !== undefined) {
    if (!textScript || typeof textScript !== "object" || Array.isArray(textScript)) {
      return NextResponse.json({ success: false, error: "textScript must be an object" }, { status: 400 });
    }

    const candidate = {
      ...getShortFormTextScriptSettings(),
      ...(textScript as Partial<ShortFormTextScriptSettings>),
    } satisfies ShortFormTextScriptSettings;

    if (typeof candidate.generatePrompt !== "string" || !candidate.generatePrompt.trim()) {
      return NextResponse.json({ success: false, error: "Text-script full generate prompt template must be a non-empty string" }, { status: 400 });
    }
    if (typeof candidate.revisePrompt !== "string" || !candidate.revisePrompt.trim()) {
      return NextResponse.json({ success: false, error: "Text-script full revise prompt template must be a non-empty string" }, { status: 400 });
    }
    if (typeof candidate.reviewPrompt !== "string" || !candidate.reviewPrompt.trim()) {
      return NextResponse.json({ success: false, error: "Text-script full review prompt template must be a non-empty string" }, { status: 400 });
    }
    if (typeof candidate.defaultMaxIterations !== "number" || Number.isNaN(candidate.defaultMaxIterations) || candidate.defaultMaxIterations < 1 || candidate.defaultMaxIterations > 8) {
      return NextResponse.json({ success: false, error: "Default text-script max iterations must be a number between 1 and 8" }, { status: 400 });
    }

    saveShortFormTextScriptSettings(candidate);
  }

  if (backgroundVideos !== undefined) {
    if (!backgroundVideos || typeof backgroundVideos !== "object" || Array.isArray(backgroundVideos)) {
      return NextResponse.json({ success: false, error: "backgroundVideos must be an object" }, { status: 400 });
    }

    const candidate = mergeBackgroundVideosPatch(backgroundVideos as Partial<ShortFormBackgroundVideoSettings>);
    if (!Array.isArray(candidate.backgrounds)) {
      return NextResponse.json({ success: false, error: "Background library must be an array" }, { status: 400 });
    }
    if (candidate.backgrounds.length > 0) {
      if (typeof candidate.defaultBackgroundVideoId !== "string" || !candidate.defaultBackgroundVideoId.trim()) {
        return NextResponse.json({ success: false, error: "Default background video must be selected when the library is not empty" }, { status: 400 });
      }
      if (!candidate.backgrounds.some((background) => background.id === candidate.defaultBackgroundVideoId)) {
        return NextResponse.json({ success: false, error: "Default background video must reference an existing library item" }, { status: 400 });
      }
    }

    for (const background of candidate.backgrounds) {
      if (typeof background.id !== "string" || !background.id.trim()) {
        return NextResponse.json({ success: false, error: "Each background video must have an id" }, { status: 400 });
      }
      if (typeof background.name !== "string" || !background.name.trim()) {
        return NextResponse.json({ success: false, error: "Each background video must have a name" }, { status: 400 });
      }
      if (typeof background.videoRelativePath !== "string" || !background.videoRelativePath.trim()) {
        return NextResponse.json({ success: false, error: `Background video ${background.name} is missing its media path` }, { status: 400 });
      }
    }

    saveShortFormBackgroundVideoSettings(candidate);
  }

  return NextResponse.json({
    success: true,
    data: buildPayload(),
  });
}
