import { NextRequest, NextResponse } from "next/server";
import {
  getShortFormPromptDefinitions,
  saveShortFormWorkflowPrompts,
  type ShortFormPromptKey,
} from "@/lib/short-form-workflow-prompts";
import {
  getShortFormImageStyleSettings,
  normalizeShortFormNanoBananaPromptTemplates,
  saveShortFormImageStyleSettings,
  type ShortFormImageStyleSettings,
} from "@/lib/short-form-image-styles";
import {
  getShortFormVideoRenderSettings,
  saveShortFormVideoRenderSettings,
  type ShortFormVideoRenderSettings,
} from "@/lib/short-form-video-render-settings";
import {
  getShortFormTextScriptSettings,
  saveShortFormTextScriptSettings,
  type ShortFormTextScriptSettings,
} from "@/lib/short-form-text-script-settings";
import {
  getShortFormXmlVisualPlanningSettings,
  saveShortFormXmlVisualPlanningSettings,
  type ShortFormXmlVisualPlanningSettings,
} from "@/lib/short-form-xml-visual-planning-settings";
import {
  getShortFormMotionGraphicsSettings,
  saveShortFormMotionGraphicsSettings,
  SUPPORTED_MOTION_GRAPHIC_RENDERERS,
  type ShortFormMotionGraphicsSettings,
} from "@/lib/short-form-motion-graphics";
import {
  getShortFormSoundDesignSettings,
  saveShortFormSoundDesignSettings,
  type ShortFormSoundDesignSettings,
} from "@/lib/short-form-sound-design-settings";
import { getShortFormSettingsPayload } from "@/lib/short-form-settings";

export const dynamic = "force-dynamic";

const LEGACY_MOTION_GRAPHIC_RENDERERS = new Set(["instruction", "step_checklist", "checklist"]);

function mergeImagePromptTemplates(
  current: ShortFormImageStyleSettings["promptTemplates"],
  patch: Partial<ShortFormImageStyleSettings>["promptTemplates"],
) {
  if (!patch) return current;

  const rawPatch = patch as unknown as Record<string, unknown>;
  const hasLegacySceneTemplate =
    typeof rawPatch.sceneTemplate === "string" &&
    typeof rawPatch.imageGenerationTemplate !== "string";

  return normalizeShortFormNanoBananaPromptTemplates({
    ...current,
    ...patch,
    ...(hasLegacySceneTemplate ? { imageGenerationTemplate: rawPatch.sceneTemplate } : {}),
  });
}

function mergeImageStylesPatch(patch: Partial<ShortFormImageStyleSettings>) {
  const current = getShortFormImageStyleSettings();
  return {
    ...current,
    ...patch,
    promptTemplates: mergeImagePromptTemplates(current.promptTemplates, patch.promptTemplates),
  } satisfies ShortFormImageStyleSettings;
}

function mergeVideoRenderPatch(patch: Partial<ShortFormVideoRenderSettings>) {
  const current = getShortFormVideoRenderSettings();
  return {
    ...current,
    ...patch,
    voices: patch.voices || current.voices,
    musicTracks: patch.musicTracks || current.musicTracks,
    animationPresets: patch.animationPresets || current.animationPresets,
    captionStyles: patch.captionStyles || current.captionStyles,
    pauseRemoval: patch.pauseRemoval
      ? {
          ...current.pauseRemoval,
          ...patch.pauseRemoval,
        }
      : current.pauseRemoval,
  } satisfies ShortFormVideoRenderSettings;
}

function mergeSoundDesignPatch(patch: Partial<ShortFormSoundDesignSettings>) {
  const current = getShortFormSoundDesignSettings();
  return {
    ...current,
    ...patch,
    library: patch.library || current.library,
  } satisfies ShortFormSoundDesignSettings;
}

export async function GET() {
  return NextResponse.json({
    success: true,
    data: getShortFormSettingsPayload(),
  });
}

export async function PATCH(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const prompts = body && typeof body === "object" && !Array.isArray(body) ? body.prompts : undefined;
  const imageStyles = body && typeof body === "object" && !Array.isArray(body) ? body.imageStyles : undefined;
  const videoRender = body && typeof body === "object" && !Array.isArray(body) ? body.videoRender : undefined;
  const textScript = body && typeof body === "object" && !Array.isArray(body) ? body.textScript : undefined;
  const xmlVisualPlanning = body && typeof body === "object" && !Array.isArray(body) ? body.xmlVisualPlanning : undefined;
  const motionGraphics = body && typeof body === "object" && !Array.isArray(body) ? body.motionGraphics : undefined;
  const soundDesign = body && typeof body === "object" && !Array.isArray(body) ? body.soundDesign : undefined;

  if (prompts === undefined && imageStyles === undefined && videoRender === undefined && textScript === undefined && xmlVisualPlanning === undefined && motionGraphics === undefined && soundDesign === undefined) {
    return NextResponse.json({ success: false, error: "prompts, imageStyles, videoRender, textScript, xmlVisualPlanning, motionGraphics, or soundDesign is required" }, { status: 400 });
  }

  if (prompts !== undefined) {
    if (!prompts || typeof prompts !== "object" || Array.isArray(prompts)) {
      return NextResponse.json({ success: false, error: "prompts must be an object" }, { status: 400 });
    }

    const updates: Partial<Record<ShortFormPromptKey, string>> = {};

    const promptPatch = prompts as Partial<Record<ShortFormPromptKey, unknown>>;
    for (const definition of getShortFormPromptDefinitions()) {
      const value = promptPatch[definition.key];
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
    if (!Array.isArray(candidate.animationPresets) || candidate.animationPresets.length === 0) {
      return NextResponse.json({ success: false, error: "At least one saved animation preset is required" }, { status: 400 });
    }
    if (!Array.isArray(candidate.captionStyles) || candidate.captionStyles.length === 0) {
      return NextResponse.json({ success: false, error: "At least one saved caption style is required" }, { status: 400 });
    }
    if (typeof candidate.defaultCaptionStyleId !== "string" || !candidate.defaultCaptionStyleId.trim()) {
      return NextResponse.json({ success: false, error: "Default caption style must be selected" }, { status: 400 });
    }
    if (!candidate.captionStyles.some((style) => style.id === candidate.defaultCaptionStyleId)) {
      return NextResponse.json({ success: false, error: "Default caption style must reference an existing saved style" }, { status: 400 });
    }
    if (typeof candidate.musicVolume !== "number" || Number.isNaN(candidate.musicVolume) || candidate.musicVolume < 0 || candidate.musicVolume > 1) {
      return NextResponse.json({ success: false, error: "Music volume must be a number between 0 and 1" }, { status: 400 });
    }
    if (typeof candidate.captionMaxWords !== "number" || Number.isNaN(candidate.captionMaxWords) || candidate.captionMaxWords < 2 || candidate.captionMaxWords > 12) {
      return NextResponse.json({ success: false, error: "Caption max words must be a number between 2 and 12" }, { status: 400 });
    }
    if (!candidate.pauseRemoval || typeof candidate.pauseRemoval !== "object") {
      return NextResponse.json({ success: false, error: "Pause removal settings are required" }, { status: 400 });
    }
    if (
      typeof candidate.pauseRemoval.minSilenceDurationSeconds !== "number"
      || Number.isNaN(candidate.pauseRemoval.minSilenceDurationSeconds)
      || candidate.pauseRemoval.minSilenceDurationSeconds < 0.01
      || candidate.pauseRemoval.minSilenceDurationSeconds > 2.5
    ) {
      return NextResponse.json({ success: false, error: "Pause removal minimum silence duration must be a number between 0.01 and 2.5 seconds" }, { status: 400 });
    }
    if (
      typeof candidate.pauseRemoval.silenceThresholdDb !== "number"
      || Number.isNaN(candidate.pauseRemoval.silenceThresholdDb)
      || candidate.pauseRemoval.silenceThresholdDb < -80
      || candidate.pauseRemoval.silenceThresholdDb > -5
    ) {
      return NextResponse.json({ success: false, error: "Pause removal silence threshold must be a number between -80 and -5 dB" }, { status: 400 });
    }

    for (const voice of candidate.voices) {
      const sourceType = voice.sourceType === "uploaded-reference" ? "uploaded-reference" : "generated";
      if (typeof voice.id !== "string" || !voice.id.trim()) {
        return NextResponse.json({ success: false, error: "Each voice must have an id" }, { status: 400 });
      }
      if (typeof voice.name !== "string" || !voice.name.trim()) {
        return NextResponse.json({ success: false, error: "Each voice must have a name" }, { status: 400 });
      }
      if (voice.mode !== "voice-design" && voice.mode !== "custom-voice") {
        return NextResponse.json({ success: false, error: `Voice ${voice.name} has an unsupported mode` }, { status: 400 });
      }
      if (sourceType !== "uploaded-reference" && (typeof voice.voiceDesignPrompt !== "string" || !voice.voiceDesignPrompt.trim())) {
        return NextResponse.json({ success: false, error: `Voice ${voice.name} needs a VoiceDesign prompt` }, { status: 400 });
      }
      if (typeof voice.previewText !== "string" || !voice.previewText.trim()) {
        return NextResponse.json({ success: false, error: `Voice ${voice.name} needs preview sample text` }, { status: 400 });
      }
      if (sourceType === "uploaded-reference") {
        if (typeof voice.referenceAudioRelativePath !== "string" || !voice.referenceAudioRelativePath.trim()) {
          return NextResponse.json({ success: false, error: `Uploaded reference voice ${voice.name} must include an uploaded audio file` }, { status: 400 });
        }
        if (typeof voice.referenceText !== "string" || !voice.referenceText.trim()) {
          return NextResponse.json({ success: false, error: `Uploaded reference voice ${voice.name} must include the transcript of the uploaded clip` }, { status: 400 });
        }
      }
      if (sourceType !== "uploaded-reference" && voice.mode === "custom-voice" && (typeof voice.speaker !== "string" || !voice.speaker.trim())) {
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

    for (const preset of candidate.animationPresets) {
      if (typeof preset.id !== "string" || !preset.id.trim()) {
        return NextResponse.json({ success: false, error: "Each animation preset must have an id" }, { status: 400 });
      }
      if (typeof preset.name !== "string" || !preset.name.trim()) {
        return NextResponse.json({ success: false, error: "Each animation preset must have a name" }, { status: 400 });
      }
      if (!preset.config || typeof preset.config !== "object" || Array.isArray(preset.config)) {
        return NextResponse.json({ success: false, error: `Animation preset ${preset.name} must include a config object` }, { status: 400 });
      }
      const presetConfig = preset.config as unknown as Record<string, unknown>;
      if (!["stable", "fluid"].includes(typeof presetConfig.layoutMode === "string" ? presetConfig.layoutMode : "")) {
        return NextResponse.json({ success: false, error: `Animation preset ${preset.name} must use a supported layout mode` }, { status: 400 });
      }
      const timing = presetConfig.timing;
      if (!timing || typeof timing !== "object" || Array.isArray(timing)) {
        return NextResponse.json({ success: false, error: `Animation preset ${preset.name} must include timing settings` }, { status: 400 });
      }
      const timingConfig = timing as Record<string, unknown>;
      if (typeof timingConfig.timingOffsetMs !== "number" || Number.isNaN(timingConfig.timingOffsetMs) || timingConfig.timingOffsetMs < -2000 || timingConfig.timingOffsetMs > 2000) {
        return NextResponse.json({ success: false, error: `Animation preset ${preset.name} must use a timing offset between -2000 and 2000 ms` }, { status: 400 });
      }
      const motion = presetConfig.motion;
      if (!motion || typeof motion !== "object" || Array.isArray(motion)) {
        return NextResponse.json({ success: false, error: `Animation preset ${preset.name} must include motion tracks` }, { status: 400 });
      }
      for (const key of ["scale", "translateXEm", "translateYEm", "extraOutlineWidth", "extraBlur", "glowStrength", "shadowOpacityMultiplier"] as const) {
        const track = motion[key as keyof typeof motion] as { keyframes?: unknown } | undefined;
        if (!track || !Array.isArray(track.keyframes) || track.keyframes.length < 2) {
          return NextResponse.json({ success: false, error: `Animation preset ${preset.name} must include at least 2 keyframes for ${key}` }, { status: 400 });
        }
      }
    }

    for (const style of candidate.captionStyles) {
      if (typeof style.id !== "string" || !style.id.trim()) {
        return NextResponse.json({ success: false, error: "Each caption style must have an id" }, { status: 400 });
      }
      if (typeof style.name !== "string" || !style.name.trim()) {
        return NextResponse.json({ success: false, error: "Each caption style must have a name" }, { status: 400 });
      }
      if (typeof style.fontFamily !== "string" || !style.fontFamily.trim()) {
        return NextResponse.json({ success: false, error: `Caption style ${style.name} must include a font family` }, { status: 400 });
      }
      if (typeof style.fontWeight !== "number" || Number.isNaN(style.fontWeight) || style.fontWeight < 100 || style.fontWeight > 900) {
        return NextResponse.json({ success: false, error: `Caption style ${style.name} must use a font weight between 100 and 900` }, { status: 400 });
      }
      if (typeof style.fontSize !== "number" || Number.isNaN(style.fontSize) || style.fontSize < 24 || style.fontSize > 160) {
        return NextResponse.json({ success: false, error: `Caption style ${style.name} must use a font size between 24 and 160` }, { status: 400 });
      }
      if (typeof style.wordSpacing !== "number" || Number.isNaN(style.wordSpacing) || style.wordSpacing < -20 || style.wordSpacing > 32) {
        return NextResponse.json({ success: false, error: `Caption style ${style.name} must use word spacing between -20 and 32 pixels` }, { status: 400 });
      }
      if (typeof style.horizontalPadding !== "number" || Number.isNaN(style.horizontalPadding) || style.horizontalPadding < 0 || style.horizontalPadding > 320) {
        return NextResponse.json({ success: false, error: `Caption style ${style.name} must use side padding between 0 and 320 pixels` }, { status: 400 });
      }
      if (typeof style.bottomMargin !== "number" || Number.isNaN(style.bottomMargin) || style.bottomMargin < 0 || style.bottomMargin > 900) {
        return NextResponse.json({ success: false, error: `Caption style ${style.name} must use a bottom margin between 0 and 900 pixels` }, { status: 400 });
      }
      for (const [label, color] of [
        ["active word color", style.activeWordColor],
        ["spoken word color", style.spokenWordColor],
        ["upcoming word color", style.upcomingWordColor],
        ["outline color", style.outlineColor],
        ["shadow color", style.shadowColor],
        ["background color", style.backgroundColor],
      ] as const) {
        if (typeof color !== "string" || !/^#[0-9A-Fa-f]{6}$/.test(color)) {
          return NextResponse.json({ success: false, error: `Caption style ${style.name} has an invalid ${label}` }, { status: 400 });
        }
      }
      if (typeof style.outlineWidth !== "number" || Number.isNaN(style.outlineWidth) || style.outlineWidth < 0 || style.outlineWidth > 12) {
        return NextResponse.json({ success: false, error: `Caption style ${style.name} must use an outline width between 0 and 12` }, { status: 400 });
      }
      if (typeof style.shadowStrength !== "number" || Number.isNaN(style.shadowStrength) || style.shadowStrength < 0 || style.shadowStrength > 12) {
        return NextResponse.json({ success: false, error: `Caption style ${style.name} must use a shadow strength between 0 and 12` }, { status: 400 });
      }
      if (typeof style.shadowBlur !== "number" || Number.isNaN(style.shadowBlur) || style.shadowBlur < 0 || style.shadowBlur > 16) {
        return NextResponse.json({ success: false, error: `Caption style ${style.name} must use a shadow blur between 0 and 16` }, { status: 400 });
      }
      if (typeof style.shadowOffsetX !== "number" || Number.isNaN(style.shadowOffsetX) || style.shadowOffsetX < -32 || style.shadowOffsetX > 32) {
        return NextResponse.json({ success: false, error: `Caption style ${style.name} must use a shadow X offset between -32 and 32` }, { status: 400 });
      }
      if (typeof style.shadowOffsetY !== "number" || Number.isNaN(style.shadowOffsetY) || style.shadowOffsetY < -32 || style.shadowOffsetY > 32) {
        return NextResponse.json({ success: false, error: `Caption style ${style.name} must use a shadow Y offset between -32 and 32` }, { status: 400 });
      }
      if (typeof style.backgroundEnabled !== "boolean") {
        return NextResponse.json({ success: false, error: `Caption style ${style.name} must declare whether the background box is enabled` }, { status: 400 });
      }
      if (typeof style.backgroundOpacity !== "number" || Number.isNaN(style.backgroundOpacity) || style.backgroundOpacity < 0 || style.backgroundOpacity > 1) {
        return NextResponse.json({ success: false, error: `Caption style ${style.name} must use a background opacity between 0 and 1` }, { status: 400 });
      }
      if (typeof style.animationPresetId !== "string" || !style.animationPresetId.trim()) {
        return NextResponse.json({ success: false, error: `Caption style ${style.name} must reference an animation preset` }, { status: 400 });
      }
      if (!candidate.animationPresets.some((preset) => preset.id === style.animationPresetId)) {
        return NextResponse.json({ success: false, error: `Caption style ${style.name} references a missing animation preset` }, { status: 400 });
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
    if (typeof candidate.enforceNaturalContractions !== "boolean") {
      return NextResponse.json({ success: false, error: "Text-script contraction post-processing must be enabled or disabled" }, { status: 400 });
    }
    if (typeof candidate.formatNumericPercentages !== "boolean") {
      return NextResponse.json({ success: false, error: "Text-script numeric percent post-processing must be enabled or disabled" }, { status: 400 });
    }

    saveShortFormTextScriptSettings(candidate);
  }

  if (xmlVisualPlanning !== undefined) {
    if (!xmlVisualPlanning || typeof xmlVisualPlanning !== "object" || Array.isArray(xmlVisualPlanning)) {
      return NextResponse.json({ success: false, error: "xmlVisualPlanning must be an object" }, { status: 400 });
    }

    const candidate = {
      ...getShortFormXmlVisualPlanningSettings(),
      ...(xmlVisualPlanning as Partial<ShortFormXmlVisualPlanningSettings>),
    } satisfies ShortFormXmlVisualPlanningSettings;

    if (typeof candidate.planningGuidelinesTemplate !== "string" || !candidate.planningGuidelinesTemplate.trim()) {
      return NextResponse.json({ success: false, error: "Visual-planning guidelines prompt template must be a non-empty string" }, { status: 400 });
    }
    if (typeof candidate.motionGraphicTemplatePromptTemplate !== "string" || !candidate.motionGraphicTemplatePromptTemplate.trim()) {
      return NextResponse.json({ success: false, error: "Individual motion-graphic template prompt must be a non-empty string" }, { status: 400 });
    }
    if (typeof candidate.promptTemplate !== "string" || !candidate.promptTemplate.trim()) {
      return NextResponse.json({ success: false, error: "Visual-planning full generate prompt template must be a non-empty string" }, { status: 400 });
    }
    if (typeof candidate.revisePromptTemplate !== "string" || !candidate.revisePromptTemplate.trim()) {
      return NextResponse.json({ success: false, error: "Visual-planning full revise prompt template must be a non-empty string" }, { status: 400 });
    }

    saveShortFormXmlVisualPlanningSettings(candidate);
  }

  if (motionGraphics !== undefined) {
    if (!motionGraphics || typeof motionGraphics !== "object" || Array.isArray(motionGraphics)) {
      return NextResponse.json({ success: false, error: "motionGraphics must be an object" }, { status: 400 });
    }

    const candidate = {
      ...getShortFormMotionGraphicsSettings(),
      ...(motionGraphics as Partial<ShortFormMotionGraphicsSettings>),
    } satisfies ShortFormMotionGraphicsSettings;

    if (!Array.isArray(candidate.templates) || candidate.templates.length === 0) {
      return NextResponse.json({ success: false, error: "At least one motion graphics template is required" }, { status: 400 });
    }

    const seenTemplateIds = new Set<string>();
    for (const template of candidate.templates) {
      if (typeof template.id !== "string" || !template.id.trim()) {
        return NextResponse.json({ success: false, error: "Each motion graphics template must have an id" }, { status: 400 });
      }
      if (seenTemplateIds.has(template.id)) {
        return NextResponse.json({ success: false, error: `Motion graphics template id ${template.id} is duplicated` }, { status: 400 });
      }
      seenTemplateIds.add(template.id);
      if (!SUPPORTED_MOTION_GRAPHIC_RENDERERS.includes(template.rendererId) && !LEGACY_MOTION_GRAPHIC_RENDERERS.has(template.rendererId)) {
        return NextResponse.json({ success: false, error: `Motion graphics template ${template.id} uses an unsupported deterministic renderer` }, { status: 400 });
      }
      if (typeof template.displayName !== "string" || !template.displayName.trim()) {
        return NextResponse.json({ success: false, error: `Motion graphics template ${template.id} needs a display name` }, { status: 400 });
      }
      if (typeof template.description !== "string" || !template.description.trim()) {
        return NextResponse.json({ success: false, error: `Motion graphics template ${template.displayName} needs a description` }, { status: 400 });
      }
      if (typeof template.whenToUse !== "string" || !template.whenToUse.trim()) {
        return NextResponse.json({ success: false, error: `Motion graphics template ${template.displayName} needs when-to-use guidance` }, { status: 400 });
      }
      if ("additionalUsageInstructions" in template && typeof template.additionalUsageInstructions !== "string") {
        return NextResponse.json({ success: false, error: `Motion graphics template ${template.displayName} additional usage instructions must be plain text` }, { status: 400 });
      }
      if ("xmlInstructions" in template && typeof template.xmlInstructions !== "string") {
        return NextResponse.json({ success: false, error: `Motion graphics template ${template.displayName} XML instructions must be plain text` }, { status: 400 });
      }
      if ("exampleXml" in template && typeof template.exampleXml !== "string") {
        return NextResponse.json({ success: false, error: `Motion graphics template ${template.displayName} example XML must be plain text` }, { status: 400 });
      }
      if (typeof template.previewDurationSeconds !== "number" || Number.isNaN(template.previewDurationSeconds) || template.previewDurationSeconds < 3 || template.previewDurationSeconds > 12) {
        return NextResponse.json({ success: false, error: `Motion graphics template ${template.displayName} preview duration must be between 3 and 12 seconds` }, { status: 400 });
      }
      if ("durationGuidance" in template && typeof template.durationGuidance !== "string") {
        return NextResponse.json({ success: false, error: `Motion graphics template ${template.displayName} duration guidance must be plain text` }, { status: 400 });
      }
      if (!Array.isArray(template.fields) || template.fields.length === 0) {
        return NextResponse.json({ success: false, error: `Motion graphics template ${template.displayName} needs at least one configurable field` }, { status: 400 });
      }
    }

    saveShortFormMotionGraphicsSettings(candidate);
  }

  if (soundDesign !== undefined) {
    if (!soundDesign || typeof soundDesign !== "object" || Array.isArray(soundDesign)) {
      return NextResponse.json({ success: false, error: "soundDesign must be an object" }, { status: 400 });
    }

    const candidate = mergeSoundDesignPatch(soundDesign as Partial<ShortFormSoundDesignSettings>);
    if (typeof candidate.promptTemplate !== "string" || !candidate.promptTemplate.trim()) {
      return NextResponse.json({ success: false, error: "Sound-design prompt template must be a non-empty string" }, { status: 400 });
    }
    if (typeof candidate.revisionPromptTemplate !== "string" || !candidate.revisionPromptTemplate.trim()) {
      return NextResponse.json({ success: false, error: "Sound-design revision prompt template must be a non-empty string" }, { status: 400 });
    }
    if (typeof candidate.defaultDuckingDb !== "number" || Number.isNaN(candidate.defaultDuckingDb) || candidate.defaultDuckingDb < -24 || candidate.defaultDuckingDb > 0) {
      return NextResponse.json({ success: false, error: "Sound-design ducking must be a number between -24 and 0 dB" }, { status: 400 });
    }
    if (typeof candidate.maxConcurrentOneShots !== "number" || Number.isNaN(candidate.maxConcurrentOneShots) || candidate.maxConcurrentOneShots < 1 || candidate.maxConcurrentOneShots > 8) {
      return NextResponse.json({ success: false, error: "Max concurrent one-shots must be between 1 and 8" }, { status: 400 });
    }
    if (typeof candidate.musicDuckingDb !== "number" || Number.isNaN(candidate.musicDuckingDb) || candidate.musicDuckingDb < -24 || candidate.musicDuckingDb > 0) {
      return NextResponse.json({ success: false, error: "Music ducking must be a number between -24 and 0 dB" }, { status: 400 });
    }
    if (typeof candidate.musicEqCutDb !== "number" || Number.isNaN(candidate.musicEqCutDb) || candidate.musicEqCutDb < -18 || candidate.musicEqCutDb > 0) {
      return NextResponse.json({ success: false, error: "Music EQ cut must be a number between -18 and 0 dB" }, { status: 400 });
    }
    if (typeof candidate.musicEqFrequencyHz !== "number" || Number.isNaN(candidate.musicEqFrequencyHz) || candidate.musicEqFrequencyHz < 120 || candidate.musicEqFrequencyHz > 8000) {
      return NextResponse.json({ success: false, error: "Music EQ frequency must be between 120 and 8000 Hz" }, { status: 400 });
    }
    if (typeof candidate.musicEqQ !== "number" || Number.isNaN(candidate.musicEqQ) || candidate.musicEqQ < 0.1 || candidate.musicEqQ > 10) {
      return NextResponse.json({ success: false, error: "Music EQ Q must be between 0.1 and 10" }, { status: 400 });
    }
    if (typeof candidate.musicLowCutHz !== "number" || Number.isNaN(candidate.musicLowCutHz) || candidate.musicLowCutHz < 0 || candidate.musicLowCutHz > 500) {
      return NextResponse.json({ success: false, error: "Music low-cut frequency must be between 0 and 500 Hz" }, { status: 400 });
    }
    if (typeof candidate.musicHighCutHz !== "number" || Number.isNaN(candidate.musicHighCutHz) || candidate.musicHighCutHz < 0 || candidate.musicHighCutHz > 20000) {
      return NextResponse.json({ success: false, error: "Music high-cut frequency must be between 0 and 20000 Hz" }, { status: 400 });
    }
    if (!Array.isArray(candidate.library)) {
      return NextResponse.json({ success: false, error: "Sound library must be an array" }, { status: 400 });
    }
    if (candidate.library.length === 0) {
      return NextResponse.json({ success: false, error: "At least one sound-library entry is required" }, { status: 400 });
    }

    const seenSoundIds = new Set<string>();
    for (const sound of candidate.library) {
      if (typeof sound.id !== "string" || !sound.id.trim()) {
        return NextResponse.json({ success: false, error: "Each sound-library entry must have an id" }, { status: 400 });
      }
      if (seenSoundIds.has(sound.id)) {
        return NextResponse.json({ success: false, error: `Sound-library entry id ${sound.id} is duplicated. Save unique ids before continuing.` }, { status: 400 });
      }
      seenSoundIds.add(sound.id);
      if (typeof sound.name !== "string" || !sound.name.trim()) {
        return NextResponse.json({ success: false, error: "Each sound-library entry must have a name" }, { status: 400 });
      }
      if (typeof sound.category !== "string" || !sound.category.trim()) {
        return NextResponse.json({ success: false, error: `Sound ${sound.name} must have a category` }, { status: 400 });
      }
      if (!Array.isArray(sound.semanticTypes) || sound.semanticTypes.length === 0) {
        return NextResponse.json({ success: false, error: `Sound ${sound.name} must include at least one semantic type` }, { status: 400 });
      }
      if (!Array.isArray(sound.tags)) {
        return NextResponse.json({ success: false, error: `Sound ${sound.name} must include tags as an array` }, { status: 400 });
      }
      if (!["point", "bed", "riser"].includes(sound.timingType)) {
        return NextResponse.json({ success: false, error: `Sound ${sound.name} must use a valid timing type` }, { status: 400 });
      }
      // defaultAnchor is legacy metadata only; new sound-design placement is timestamp-based.
      if (typeof sound.defaultGainDb !== "number" || Number.isNaN(sound.defaultGainDb) || sound.defaultGainDb < -36 || sound.defaultGainDb > 12) {
        return NextResponse.json({ success: false, error: `Sound ${sound.name} must use a default gain between -36 and 12 dB` }, { status: 400 });
      }
      if (typeof sound.defaultFadeInMs !== "number" || Number.isNaN(sound.defaultFadeInMs) || sound.defaultFadeInMs < 0 || sound.defaultFadeInMs > 10_000) {
        return NextResponse.json({ success: false, error: `Sound ${sound.name} must use a fade-in between 0 and 10000 ms` }, { status: 400 });
      }
      if (typeof sound.defaultFadeOutMs !== "number" || Number.isNaN(sound.defaultFadeOutMs) || sound.defaultFadeOutMs < 0 || sound.defaultFadeOutMs > 10_000) {
        return NextResponse.json({ success: false, error: `Sound ${sound.name} must use a fade-out between 0 and 10000 ms` }, { status: 400 });
      }
      if (sound.stylePalettes !== undefined && !Array.isArray(sound.stylePalettes)) {
        return NextResponse.json({ success: false, error: `Sound ${sound.name} style palettes must be an array` }, { status: 400 });
      }
      if (sound.frequencyBand !== undefined && !["low", "mid", "high", "full-range"].includes(sound.frequencyBand)) {
        return NextResponse.json({ success: false, error: `Sound ${sound.name} has an invalid frequency band` }, { status: 400 });
      }
      if (sound.layerRoles !== undefined && !Array.isArray(sound.layerRoles)) {
        return NextResponse.json({ success: false, error: `Sound ${sound.name} layer roles must be an array` }, { status: 400 });
      }
      if (sound.literalness !== undefined && !["literal", "stylized", "emotional-metaphor"].includes(sound.literalness)) {
        return NextResponse.json({ success: false, error: `Sound ${sound.name} has an invalid literalness value` }, { status: 400 });
      }
      if (typeof sound.anchorRatio !== "number" || Number.isNaN(sound.anchorRatio) || sound.anchorRatio < 0 || sound.anchorRatio > 1) {
        return NextResponse.json({ success: false, error: `Sound ${sound.name} must use an anchor ratio between 0 and 1` }, { status: 400 });
      }
    }

    saveShortFormSoundDesignSettings(candidate);
  }

  return NextResponse.json({
    success: true,
    data: getShortFormSettingsPayload(),
  });
}
