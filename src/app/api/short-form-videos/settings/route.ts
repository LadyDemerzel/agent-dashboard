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

export const dynamic = "force-dynamic";

function buildPayload() {
  return {
    prompts: getShortFormWorkflowPrompts(),
    definitions: getShortFormPromptDefinitions(),
    imageStyles: getShortFormImageStyleSettings(),
    videoRender: getShortFormVideoRenderSettings(),
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
  } satisfies ShortFormVideoRenderSettings;
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

  if (prompts === undefined && imageStyles === undefined && videoRender === undefined) {
    return NextResponse.json({ success: false, error: "prompts, imageStyles, or videoRender is required" }, { status: 400 });
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

    saveShortFormVideoRenderSettings(candidate);
  }

  return NextResponse.json({
    success: true,
    data: buildPayload(),
  });
}
