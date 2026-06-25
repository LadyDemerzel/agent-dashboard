import {
  getShortFormPromptDefinitions,
  getShortFormWorkflowPrompts,
} from "@/lib/short-form-workflow-prompts";
import { getShortFormHookSettings } from "@/lib/short-form-hook-settings";
import { getShortFormImageStyleSettings } from "@/lib/short-form-image-styles";
import { getShortFormVideoRenderSettings } from "@/lib/short-form-video-render-settings";
import { getShortFormTextScriptSettings } from "@/lib/short-form-text-script-settings";
import { getShortFormXmlVisualPlanningSettings } from "@/lib/short-form-xml-visual-planning-settings";
import {
  getShortFormMotionGraphicsSettings,
  SUPPORTED_MOTION_GRAPHIC_RENDERERS,
} from "@/lib/short-form-motion-graphics";
import {
  appendSoundLibraryUrls,
  getShortFormSoundDesignSettings,
} from "@/lib/short-form-sound-design-settings";
import { getShortFormAgentTargetSettings } from "@/lib/short-form-agent-targets";

export function getShortFormSettingsPayload() {
  return {
    prompts: getShortFormWorkflowPrompts(),
    definitions: getShortFormPromptDefinitions(),
    hook: getShortFormHookSettings(),
    imageStyles: getShortFormImageStyleSettings(),
    videoRender: getShortFormVideoRenderSettings(),
    textScript: getShortFormTextScriptSettings(),
    xmlVisualPlanning: getShortFormXmlVisualPlanningSettings(),
    motionGraphics: getShortFormMotionGraphicsSettings(),
    supportedMotionGraphicRenderers: SUPPORTED_MOTION_GRAPHIC_RENDERERS,
    soundDesign: appendSoundLibraryUrls(getShortFormSoundDesignSettings()),
    agentTargets: getShortFormAgentTargetSettings(),
  };
}
