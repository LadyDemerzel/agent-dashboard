"use client";

import {
  type CSSProperties,
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import useSWR from "swr";
import { ChevronDown, MoreVertical, Pencil, Search, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { RefreshIconButton } from "@/components/RefreshIconButton";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { OrbitLoader, Skeleton } from "@/components/ui/loading";
import {
  ShortFormSubpageShell,
  ValidationNotice,
  WorkflowSectionHeader,
} from "@/components/short-form-video/WorkflowShared";
import { CaptionStylePreview } from "@/components/short-form-video/CaptionStylePreview";
import { useShortFormSettingsShellNav } from "@/components/short-form-video/ShortFormVideoSettingsShell";
import { apiDataFetcher, realtimeSWRConfig } from "@/lib/swr-fetcher";
import { usePageScrollRestoration } from "@/components/usePageScrollRestoration";
import { cn } from "@/lib/utils";
import { type ShortFormSettingsRouteSection } from "@/lib/short-form-video-navigation";
import {
  cloneCaptionAnimationConfig,
  DEFAULT_CAPTION_ANIMATION_PRESET_ID,
  DEFAULT_SHORT_FORM_CAPTION_ANIMATION_PRESETS,
  getCaptionAnimationPresetById,
  normalizeCaptionAnimationPresetConfig,
  type ShortFormCaptionAnimationColorMode,
  type ShortFormCaptionAnimationEasing,
  type ShortFormCaptionAnimationPresetConfig,
  type ShortFormCaptionAnimationPresetEntry,
  type ShortFormCaptionAnimationTrack,
} from "@/lib/short-form-caption-animation";
import {
  getShortFormVisualGenerationModelOptions,
  type ShortFormVisualGenerationModelId,
} from "@/lib/short-form-visual-generation";
import {
  formatMotionGraphicAnimationTimingControls,
  getMotionGraphicTimingControlConfig,
} from "@/lib/short-form-motion-graphic-timing-controls";

type PromptKey =
  | "hooksGenerate"
  | "hooksMore"
  | "researchGenerate"
  | "researchRevise"
  | "sceneImagesGenerate"
  | "sceneImagesRevise"
  | "videoGenerate"
  | "videoRevise";

type TextScriptPromptTemplateKey =
  | "generatePrompt"
  | "revisePrompt"
  | "reviewPrompt";

type XmlVisualPlanningPromptTemplateKey =
  | "planningGuidelinesTemplate"
  | "motionGraphicTemplatePromptTemplate"
  | "promptTemplate"
  | "revisePromptTemplate";

type SoundDesignPromptTemplateKey =
  | "promptTemplate"
  | "revisionPromptTemplate";

type ImagePromptTemplateKey =
  | "imageGenerationTemplate"
  | "basedOnReferenceTemplate"
  | "continuityWithReferenceTemplate"
  | "extraReferencesTemplate"
  | "individualExtraReferenceTemplate";

type PromptTemplateId =
  | PromptKey
  | `textScript.${TextScriptPromptTemplateKey}`
  | `xmlVisualPlanning.${XmlVisualPlanningPromptTemplateKey}`
  | `soundDesign.${SoundDesignPromptTemplateKey}`
  | `imageStyles.${ImagePromptTemplateKey}`;

type SettingsSectionId =
  | "tts-voice"
  | "pause-removal"
  | "music-library"
  | "sound-library"
  | "caption-styles"
  | "image-templates"
  | "image-styles"
  | "motion-graphics"
  | "prompt-hooks"
  | "prompt-research"
  | "text-script-prompts"
  | "xml-visual-planning";

interface PromptDefinition {
  key: PromptKey;
  title: string;
  description: string;
  stage: "hooks" | "research" | "script" | "scene-images" | "video";
}

type StyleReferenceUsageType =
  | "general"
  | "style"
  | "character"
  | "lighting"
  | "composition"
  | "palette";

interface StyleReferenceImage {
  id: string;
  label?: string;
  usageType: StyleReferenceUsageType;
  usageInstructions: string;
  imageRelativePath: string;
  imageUrl?: string;
  uploadedAt?: string;
}

interface PersistedStyleTestImage {
  runId: string;
  cleanRelativePath?: string;
  previewRelativePath?: string;
  updatedAt?: string;
  cleanImageUrl?: string;
  previewImageUrl?: string;
}

interface ImageStyle {
  id: string;
  name: string;
  description?: string;
  stylePrompt: string;
  headerPercent: number;
  testTopic: string;
  testCaption: string;
  testImagePrompt: string;
  references?: StyleReferenceImage[];
  lastTestImage?: PersistedStyleTestImage;
}

interface NanoBananaPromptTemplates {
  imageGenerationTemplate: string;
  basedOnReferenceTemplate: string;
  continuityWithReferenceTemplate: string;
  extraReferencesTemplate: string;
  individualExtraReferenceTemplate: string;
}

interface ImageStyleSettings {
  defaultVisualGenerationModelId: ShortFormVisualGenerationModelId;
  defaultStyleId: string;
  styles: ImageStyle[];
  promptTemplates: NanoBananaPromptTemplates;
}

interface PromptPlaceholderRow {
  placeholder: string;
  explanation: string;
  example: string;
}

const VISUAL_GENERATION_MODEL_OPTIONS =
  getShortFormVisualGenerationModelOptions();

const MOTION_TEMPLATE_QUERY_PARAM = "motionTemplate";
const AUDIO_KIND_QUERY_PARAM = "audioKind";
const AUDIO_ID_QUERY_PARAM = "audioId";

const NANO_BANANA_PLACEHOLDER_ROWS = [
  {
    placeholder: "{{attachmentIndex}}",
    explanation:
      "Extra reference template only. The 1-based attachment number for this individual reference image.",
    example: "2",
  },
  {
    placeholder: "{{basedOnAttachmentIndex}}",
    explanation:
      "Based-on reference template only. The 1-based attachment number for the XML basedOn parent/base image.",
    example: "3",
  },
  {
    placeholder: "{{basedOnImageId}}",
    explanation:
      "Based-on reference template only. The XML image id referenced by the current asset's basedOn attribute.",
    example: "source-profile",
  },
  {
    placeholder: "{{basedOnReferenceInstructions}}",
    explanation:
      "The rendered Based-on reference template. Empty unless the current XML v2 asset has a basedOn parent/base image attached.",
    example:
      "Attached reference image 3 is the parent/base image for this XML basedOn asset...",
  },
  {
    placeholder: "{{extraReferencesInstructions}}",
    explanation:
      "The rendered Extra references template. Empty when there are no active extra references. Character references render only for characterDriven XML images.",
    example:
      "Additional attached reference images are provided. Use each one only for the role described below...",
  },
  {
    placeholder: "{{headerPercent}}",
    explanation:
      "The selected style's caption-safe top-area percentage from the style library.",
    example: "28",
  },
  {
    placeholder: "{{imageDescription}}",
    explanation:
      "The current image description for the scene image. This is the main per-asset visual instruction from the XML asset prompt or legacy scene prompt.",
    example:
      "Single full-frame side-profile portrait showing improved neck alignment and a cleaner jawline silhouette.",
  },
  {
    placeholder: "{{individualExtraReferences}}",
    explanation:
      "Extra references template only. The rendered Individual extra reference template for each active reference image, joined with newlines. Character references render only for characterDriven XML images.",
    example:
      "- Attached reference image 2 (Lighting ref): usage type 'lighting'. Use this reference for soft rim lighting and subtle studio falloff.",
  },
  {
    placeholder: "{{label}}",
    explanation:
      "Extra reference template only. The reference image label from the selected style.",
    example: "Lighting ref",
  },
  {
    placeholder: "{{script}}",
    explanation:
      "The full spoken script context for the current short-form video, pulled from the XML or generated script.",
    example:
      "Your jawline changes when posture changes, because your neck position affects the tissue under your chin.",
  },
  {
    placeholder: "{{styleInstructions}}",
    explanation:
      "The effective style art direction text from the selected style. This includes the style prompt plus any reference-driven guidance added by the runtime.",
    example:
      "Clean dramatic high-contrast pencil-and-charcoal illustration, premium modern TikTok aesthetic, restrained vivid red accents only on the key focal area.",
  },
  {
    placeholder: "{{topic}}",
    explanation:
      "The project topic from the short-form video metadata. This comes from the XML video topic or dashboard project topic field.",
    example: "Facial posture reset",
  },
  {
    placeholder: "{{usageInstructions}}",
    explanation:
      "Extra reference template only. The selected style's instructions for how to use this reference image.",
    example: "Use this reference for soft rim lighting and subtle studio falloff.",
  },
  {
    placeholder: "{{usageType}}",
    explanation:
      "Extra reference template only. The selected role for this reference image.",
    example: "lighting",
  },
] as const;

const XML_VISUAL_PLANNING_PLACEHOLDER_ROWS = [
  {
    placeholder: "{{alignmentPath}}",
    explanation:
      "Absolute path to the forced-alignment word-timestamps JSON produced earlier in the XML pipeline.",
    example:
      "/Users/ittaisvidler/tenxsolo/business/content/deliverables/short-form-videos/abc123/output/xml-script-work/alignment/word-timestamps.json",
  },
  {
    placeholder: "{{captionPlanPath}}",
    explanation:
      "Absolute path to the deterministic caption JSON that visual planning can reference for timing context.",
    example:
      "/Users/ittaisvidler/tenxsolo/business/content/deliverables/short-form-videos/abc123/output/xml-script-work/captions/caption-sections.json",
  },
  {
    placeholder: "{{existingXmlBodySummary}}",
    explanation:
      "A generated state summary of the existing xml-script.md body, used only if this placeholder is present in the template.",
    example:
      "The current artifact body is 18742 characters; your saved body must differ from it.",
  },
  {
    placeholder: "{{motionGraphicTemplates}}",
    explanation:
      "Renders the Individual motion graphic template prompt once for each enabled motion graphic template, then concatenates the rendered blocks with a newline.",
    example:
      "- bar_chart (Bar chart)\n  rendererId: bar_chart\n  Duration seconds: 7...",
  },
  {
    placeholder: "{{planningVisualsGuidelines}}",
    explanation:
      "The fully rendered Guidelines for planning visuals template. Use this in the Full generate and Full revise prompt templates wherever the shared visual-planning instructions should appear.",
    example:
      "# Context for the short-form video\nInputs you must read before planning visuals...",
  },
  {
    placeholder: "{{projectDir}}",
    explanation: "Absolute project root for the short-form deliverable.",
    example:
      "/Users/ittaisvidler/tenxsolo/business/content/deliverables/short-form-videos/abc123",
  },
  {
    placeholder: "{{revisionNotes}}",
    explanation:
      "The raw rerun revision notes text. This is only populated in the Full revise prompt template because that template is selected only when notes exist.",
    example: "Make backward image reuse more explicit and reduce camera motion.",
  },
  {
    placeholder: "{{selectedHook}}",
    explanation:
      "The approved hook text only. Put any surrounding label text directly in the editable prompt template.",
    example: "Your jawline changed because your posture changed",
  },
  {
    placeholder: "{{textScriptPath}}",
    explanation:
      "Absolute path to the approved plain narration text script for this project.",
    example:
      "/Users/ittaisvidler/tenxsolo/business/content/deliverables/short-form-videos/abc123/script.md",
  },
  {
    placeholder: "{{topic}}",
    explanation:
      "The short-form project topic, with the same fallback the runtime uses when the topic is empty.",
    example: "Facial posture reset",
  },
  {
    placeholder: "{{transcriptPath}}",
    explanation:
      "Absolute path to the exact narration transcript file used for TTS and alignment reuse.",
    example:
      "/Users/ittaisvidler/tenxsolo/business/content/deliverables/short-form-videos/abc123/output/xml-script-work/voice/text-script.txt",
  },
  {
    placeholder: "{{xmlScriptPath}}",
    explanation:
      "Absolute path where Scribe must write the final xml-script.md artifact.",
    example:
      "/Users/ittaisvidler/tenxsolo/business/content/deliverables/short-form-videos/abc123/xml-script.md",
  },
] as const;

const XML_MOTION_GRAPHIC_TEMPLATE_PLACEHOLDER_ROWS = [
  {
    placeholder: "{{additionalUsageInstructions}}",
    explanation:
      "The template-specific additionalUsageInstructions field from the motion-graphics settings, or None. when it is empty.",
    example:
      "Only communicate one thing/idea/point in the indicator text.",
  },
  {
    placeholder: "{{animationTimingControls}}",
    explanation:
      "The renderer-specific core items Scribe may time with animateIn or <timing> entries.",
    example: "title; each data <item> / bar group",
  },
  {
    placeholder: "{{description}}",
    explanation: "The motion-graphics template description from settings.",
    example:
      "Minimal animated bar chart over the unified dark pastel watercolor background with subdued labels and pastel accents.",
  },
  {
    placeholder: "{{deterministicSoundEffectsJson}}",
    explanation:
      "Pretty-printed JSON array of the template's built-in deterministic sound effect metadata from settings.",
    example: "[\n  { \"id\": \"bar-reveal\", \"type\": \"click\", ... }\n]",
  },
  {
    placeholder: "{{displayName}}",
    explanation: "The human-readable motion-graphics template display name.",
    example: "Bar chart",
  },
  {
    placeholder: "{{durationGuidance}}",
    explanation: "The template-specific duration guidance from settings.",
    example:
      "Around 2 seconds for the setup plus about 1 second per bar.",
  },
  {
    placeholder: "{{exampleXml}}",
    explanation:
      "A minimal template-specific XML example from the motion-graphics settings, or None. when it is empty.",
    example:
      "<visual id=\"visual-5\" label=\"Outcome comparison\" start=\"12.00\" end=\"18.00\" visualType=\"motion_graphic\">\n  <motionGraphic templateId=\"bar_chart\">\n    ...\n  </motionGraphic>\n</visual>",
  },
  {
    placeholder: "{{fieldsJson}}",
    explanation:
      "Pretty-printed JSON array of the template's configurable fields from settings, including names, labels, types, descriptions, and required flags.",
    example:
      "[\n  { \"name\": \"title\", \"label\": \"Title\", \"type\": \"text\", ... }\n]",
  },
  {
    placeholder: "{{rendererId}}",
    explanation: "The deterministic renderer ID used by the dashboard for this template.",
    example: "bar_chart",
  },
  {
    placeholder: "{{templateId}}",
    explanation:
      "The XML templateId Scribe should put on the inline <motionGraphic> element.",
    example: "bar_chart",
  },
  {
    placeholder: "{{whenToUse}}",
    explanation: "The motion-graphics template's when-to-use guidance from settings.",
    example:
      "Use when comparing 2-5 categories, routines, channels, habits, or measured outcomes.",
  },
  {
    placeholder: "{{xmlInstructions}}",
    explanation:
      "Template-specific XML authoring rules from the motion-graphics settings, or None. when it is empty.",
    example:
      "Use repeated <item label=\"...\" value=\"...\" displayValue=\"...\" /> entries for the data field.",
  },
] as const;

function PromptPlaceholderTable({
  title,
  rows,
}: {
  title: string;
  rows: readonly PromptPlaceholderRow[];
}) {
  return (
    <div className="text-xs text-muted-foreground">
      <p className="font-medium text-foreground">{title}</p>
      <div className="mt-2 overflow-x-auto">
        <table className="min-w-full border-collapse text-left text-xs text-muted-foreground">
          <thead>
            <tr className="border-b border-border/70 text-[11px] uppercase tracking-wide text-muted-foreground">
              <th className="px-2 py-2 font-medium">Placeholder</th>
              <th className="px-2 py-2 font-medium">What it represents</th>
              <th className="px-2 py-2 font-medium">Example value</th>
            </tr>
          </thead>
          <tbody>
            {[...rows]
              .sort((a, b) => a.placeholder.localeCompare(b.placeholder))
              .map((row) => (
                <tr
                  key={row.placeholder}
                  className="border-b border-border/50 align-top last:border-b-0"
                >
                  <td className="px-2 py-2 font-mono text-[11px] text-foreground">
                    {row.placeholder}
                  </td>
                  <td className="px-2 py-2 leading-5">{row.explanation}</td>
                  <td className="whitespace-pre-wrap px-2 py-2 leading-5 text-foreground/80">
                    {row.example}
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function PromptPlaceholderCard({
  title,
  rows,
}: {
  title: string;
  rows: readonly PromptPlaceholderRow[];
}) {
  return (
    <Card className="p-5">
      <PromptPlaceholderTable title={title} rows={rows} />
    </Card>
  );
}

type VoiceMode = "voice-design" | "custom-voice";
type VoiceSourceType = "generated" | "uploaded-reference";
type MusicSourceType = "ai-generated" | "imported";

interface VoiceLibraryEntry {
  id: string;
  name: string;
  sourceType?: VoiceSourceType;
  mode: VoiceMode;
  voiceDesignPrompt: string;
  notes: string;
  previewText: string;
  speaker?: string;
  legacyInstruct?: string;
  referenceAudioRelativePath?: string;
  referenceText?: string;
  referencePrompt?: string;
  referenceMode?: VoiceMode;
  referenceSpeaker?: string;
  referenceGeneratedAt?: string;
}

interface MusicLibraryEntry {
  id: string;
  name: string;
  sourceType?: MusicSourceType;
  prompt: string;
  notes: string;
  previewDurationSeconds?: number;
  generatedAudioRelativePath?: string;
  generatedDurationSeconds?: number;
  generatedPrompt?: string;
  generatedAt?: string;
  mood?: string;
  pacing?: string;
  bpm?: number;
  key?: string;
  energy?: string;
  tags?: string[];
  recommendedSections?: string[];
  emotionalArc?: string;
  intensityCurve?: string;
  bestSceneTypes?: string[];
  comparableTo?: string[];
  transitionInPattern?: string;
  transitionOutPattern?: string;
  loopFriendly?: boolean;
  availableForPlanning?: boolean;
  preferredForPlanning?: boolean;
  availableForGeneration?: boolean;
  preferredForBackground?: boolean;
  source?: string;
  license?: string;
  creator?: string;
  originalFileName?: string;
  durationSeconds?: number;
  sampleRate?: number;
  channels?: number;
  integratedLufs?: number;
  originalIntegratedLufs?: number;
  normalizationTargetLufs?: number;
  normalizedAt?: string;
}

interface CaptionStyleEntry {
  id: string;
  name: string;
  fontFamily: string;
  fontWeight: number;
  fontSize: number;
  wordSpacing: number;
  horizontalPadding: number;
  bottomMargin: number;
  activeWordColor: string;
  spokenWordColor: string;
  upcomingWordColor: string;
  outlineColor: string;
  outlineWidth: number;
  shadowColor: string;
  shadowStrength: number;
  shadowBlur: number;
  shadowOffsetX: number;
  shadowOffsetY: number;
  backgroundEnabled: boolean;
  backgroundColor: string;
  backgroundOpacity: number;
  backgroundPadding: number;
  backgroundRadius: number;
  animationPresetId: string;
  animationPreset?: string;
}

type AnimationPresetEntry = ShortFormCaptionAnimationPresetEntry;

interface VideoRenderSettings {
  defaultVoiceId: string;
  voices: VoiceLibraryEntry[];
  musicVolume: number;
  musicTracks: MusicLibraryEntry[];
  defaultCaptionStyleId: string;
  animationPresets: AnimationPresetEntry[];
  captionStyles: CaptionStyleEntry[];
  captionMaxWords: number;
  pauseRemoval: {
    minSilenceDurationSeconds: number;
    silenceThresholdDb: number;
  };
}

interface TextScriptSettings {
  defaultMaxIterations: number;
  enforceNaturalContractions: boolean;
  formatNumericPercentages: boolean;
  generatePrompt: string;
  revisePrompt: string;
  reviewPrompt: string;
}

interface XmlVisualPlanningSettings {
  planningGuidelinesTemplate: string;
  motionGraphicTemplatePromptTemplate: string;
  promptTemplate: string;
  revisePromptTemplate: string;
}

type MotionGraphicFieldType = "text" | "textarea" | "number" | "stringList" | "timelineSteps" | "dataSeries" | "captionWordWallLines" | "indicatorType";

interface MotionGraphicTemplateField {
  name: string;
  label: string;
  type: MotionGraphicFieldType;
  required?: boolean;
  description?: string;
}

interface MotionGraphicTemplateConfig {
  id: string;
  rendererId: string;
  displayName: string;
  description: string;
  whenToUse: string;
  additionalUsageInstructions: string;
  xmlInstructions?: string;
  exampleXml?: string;
  previewDurationSeconds: number;
  durationGuidance: string;
  previewArgs: Record<string, unknown>;
  fields: MotionGraphicTemplateField[];
  deterministicSoundEffects?: unknown[];
  enabled: boolean;
}

interface MotionGraphicsSettings {
  templates: MotionGraphicTemplateConfig[];
}

function resolveMotionTemplateSelection({
  templates,
  currentId,
  requestedId,
}: {
  templates: MotionGraphicTemplateConfig[];
  currentId: string | null;
  requestedId: string | null;
}) {
  if (requestedId && templates.some((template) => template.id === requestedId)) {
    return requestedId;
  }
  if (currentId && templates.some((template) => template.id === currentId)) {
    return currentId;
  }
  return templates[0]?.id || null;
}

interface SoundLibraryEntry {
  id: string;
  name: string;
  category: string;
  semanticTypes: Array<"impact" | "riser" | "click" | "whoosh" | "ambience">;
  tags: string[];
  stylePalettes?: string[];
  frequencyBand?: "low" | "mid" | "high" | "full-range";
  layerRoles?: string[];
  literalness?: "literal" | "stylized" | "emotional-metaphor";
  timingType: "point" | "bed" | "riser";
  defaultAnchor:
    | "scene-start"
    | "scene-end"
    | "caption-start"
    | "caption-end"
    | "global-start"
    | "global-end";
  defaultGainDb: number;
  defaultFadeInMs: number;
  defaultFadeOutMs: number;
  recommendedUses: string;
  avoidUses: string;
  notes: string;
  source?: string;
  license?: string;
  audioRelativePath?: string;
  audioUrl?: string;
  durationSeconds?: number;
  sampleRate?: number;
  channels?: number;
  anchorRatio?: number;
  waveformPeaks?: number[];
  uploadedAt?: string;
  availableForPlanning?: boolean;
  preferredForPlanning?: boolean;
  availableForGeneration?: boolean;
  preferredForGeneration?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

interface SoundDesignSettings {
  promptTemplate: string;
  revisionPromptTemplate: string;
  defaultDuckingDb: number;
  maxConcurrentOneShots: number;
  musicDuckingDb: number;
  musicEqCutDb: number;
  musicEqFrequencyHz: number;
  musicEqQ: number;
  musicLowCutHz: number;
  musicHighCutHz: number;
  library: SoundLibraryEntry[];
}

const SOUND_MIX_DEFAULT_FIELDS = [
  "defaultDuckingDb",
  "maxConcurrentOneShots",
  "musicDuckingDb",
  "musicEqCutDb",
  "musicEqFrequencyHz",
  "musicEqQ",
  "musicLowCutHz",
  "musicHighCutHz",
] as const satisfies ReadonlyArray<keyof SoundDesignSettings>;

type SoundMixDefaultField = (typeof SOUND_MIX_DEFAULT_FIELDS)[number];

function pickSoundMixDefaults(settings: SoundDesignSettings | null) {
  if (!settings) return null;
  return Object.fromEntries(
    SOUND_MIX_DEFAULT_FIELDS.map((key) => [key, settings[key]]),
  ) as Pick<SoundDesignSettings, SoundMixDefaultField>;
}

type SoundLibraryCategoryFilter = "all" | "__uncategorized__" | string;

type SoundLibraryFileFilter = "all" | "with-audio" | "missing-audio";
type AudioLibraryAvailabilityFilter =
  | "all"
  | "planning"
  | "not-planning"
  | "generation"
  | "not-generation";
type AudioLibraryTypeFilter = "all" | "music" | "sfx";
type AudioLibrarySelectionKind = "music" | "sfx";

interface AudioLibraryPickerSelection {
  kind: AudioLibrarySelectionKind;
  id: string;
}

function parseAudioLibraryKind(value: string | null): AudioLibrarySelectionKind | null {
  return value === "music" || value === "sfx" ? value : null;
}

function resolveAudioLibrarySelection({
  musicTracks,
  soundLibrary,
  current,
  requested,
}: {
  musicTracks: MusicLibraryEntry[];
  soundLibrary: SoundLibraryEntry[];
  current: AudioLibraryPickerSelection | null;
  requested: AudioLibraryPickerSelection | null;
}): AudioLibraryPickerSelection | null {
  if (
    requested?.kind === "music" &&
    musicTracks.some((track) => track.id === requested.id)
  ) {
    return requested;
  }
  if (
    requested?.kind === "sfx" &&
    soundLibrary.some((sound) => sound.id === requested.id)
  ) {
    return requested;
  }
  if (
    current?.kind === "music" &&
    musicTracks.some((track) => track.id === current.id)
  ) {
    return current;
  }
  if (
    current?.kind === "sfx" &&
    soundLibrary.some((sound) => sound.id === current.id)
  ) {
    return current;
  }
  if (soundLibrary[0]) return { kind: "sfx", id: soundLibrary[0].id };
  if (musicTracks[0]) return { kind: "music", id: musicTracks[0].id };
  return null;
}

interface SoundLibraryCategorySummary {
  key: string;
  value: SoundLibraryCategoryFilter;
  label: string;
  totalCount: number;
  matchingCount: number;
  withAudioCount: number;
  missingAudioCount: number;
}

interface SettingsResponse {
  success: boolean;
  data?: {
    prompts: Record<PromptKey, string>;
    definitions: PromptDefinition[];
    imageStyles: ImageStyleSettings;
    videoRender: VideoRenderSettings;
    textScript: TextScriptSettings;
    xmlVisualPlanning: XmlVisualPlanningSettings;
    motionGraphics: MotionGraphicsSettings;
    supportedMotionGraphicRenderers: string[];
    soundDesign: SoundDesignSettings;
  };
  error?: string;
}

type SettingsData = NonNullable<SettingsResponse["data"]>;

interface StyleTestResponse {
  success: boolean;
  data?: {
    runId: string;
    cleanRelativePath?: string;
    previewRelativePath?: string;
    updatedAt?: string;
    cleanImageUrl?: string;
    previewImageUrl?: string;
  };
  error?: string;
}

interface TtsPreviewResponse {
  success: boolean;
  data?: {
    audioUrl: string;
    reusedExisting: boolean;
    voice: VoiceLibraryEntry;
    videoRender: VideoRenderSettings;
  };
  error?: string;
}

interface MusicPreviewResponse {
  success: boolean;
  data?: {
    audioUrl: string;
    reusedExisting: boolean;
    track: MusicLibraryEntry;
    videoRender: VideoRenderSettings;
  };
  error?: string;
}

interface MotionGraphicPreviewResponse {
  success: boolean;
  data?: {
    templateId: string;
    rendererId: string;
    previewKey: string;
    videoUrl: string;
    posterUrl: string;
    reusedExisting: boolean;
    durationSeconds: number;
  };
  error?: string;
}

interface StyleTestState {
  isLoading: boolean;
  error: string | null;
  cleanImageUrl: string | null;
  previewImageUrl: string | null;
}

interface MotionGraphicPreviewState {
  isLoading: boolean;
  error: string | null;
  previewKey: string | null;
  videoUrl: string | null;
  posterUrl: string | null;
  reusedExisting: boolean | null;
}

interface StyleReferenceUploadState {
  isUploading: boolean;
  error: string | null;
}

interface SoundUploadState {
  isUploading: boolean;
  error: string | null;
}

interface VoiceReferenceUploadState {
  isUploading: boolean;
  error: string | null;
}

interface VoiceReferenceUploadResponse {
  success: boolean;
  data?: {
    referenceAudioRelativePath: string;
    audioUrl?: string;
    uploadedAt?: string;
  };
  error?: string;
}

interface TtsPreviewState {
  isLoading: boolean;
  error: string | null;
  audioUrl: string | null;
  reusedExisting: boolean | null;
}

interface MusicPreviewState {
  isLoading: boolean;
  error: string | null;
  audioUrl: string | null;
  reusedExisting: boolean | null;
}

interface SectionFeedback {
  saving: boolean;
  error: string | null;
  message: string | null;
}

const PROMPT_TEMPLATE_PLACEHOLDER_PATTERN = /\{\{\s*[a-zA-Z0-9_]+\s*\}\}/g;
const PROMPT_TEMPLATE_EDITOR_TEXT_CLASS =
  "box-border w-full px-6 py-2 text-sm leading-5 whitespace-pre-wrap break-words [overflow-wrap:break-word] [tab-size:2]";
const PROMPT_TEMPLATE_EDITOR_TEXT_STYLE: CSSProperties = {
  fontFamily:
    'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace',
  fontFeatureSettings: '"liga" 0, "calt" 0',
  fontVariantLigatures: "none",
  letterSpacing: "0",
  textIndent: "0",
};

type PromptTemplatePreviewValues = Record<string, string>;

function getPromptPlaceholderName(placeholder: string) {
  return placeholder.match(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/)?.[1] || "";
}

function createPromptTemplatePreviewValues(
  rows: ReadonlyArray<PromptPlaceholderRow>,
): PromptTemplatePreviewValues {
  return rows.reduce<PromptTemplatePreviewValues>((values, row) => {
    const placeholderName = getPromptPlaceholderName(row.placeholder);
    const example = row.example.trim() || `Example ${placeholderName || "value"}`;
    values[row.placeholder] = example;
    if (placeholderName) {
      values[placeholderName] = example;
    }
    return values;
  }, {});
}

function setPromptTemplatePreviewValue(
  values: PromptTemplatePreviewValues,
  placeholderName: string,
  value: string | number | boolean | null | undefined,
) {
  const renderedValue =
    value === null || value === undefined ? "" : String(value);
  values[placeholderName] = renderedValue;
  values[`{{${placeholderName}}}`] = renderedValue;
}

function mergePromptTemplatePreviewValues(
  base: PromptTemplatePreviewValues,
  overrides: Record<string, string | number | boolean | null | undefined>,
) {
  const values = { ...base };
  Object.entries(overrides).forEach(([key, value]) => {
    setPromptTemplatePreviewValue(values, key, value);
  });
  return values;
}

function renderPromptTemplatePreviewString(
  template: string,
  previewValues: PromptTemplatePreviewValues,
) {
  return template.replace(
    PROMPT_TEMPLATE_PLACEHOLDER_PATTERN,
    (placeholder) => {
      const placeholderName = getPromptPlaceholderName(placeholder);
      return (
        previewValues[placeholder] ||
        previewValues[placeholderName] ||
        `Example ${placeholderName || "value"}`
      );
    },
  );
}

function stringifyPromptPreviewJson(value: unknown) {
  return JSON.stringify(value, null, 2);
}

function getMotionTemplateTimingControls(rendererId: string) {
  return formatMotionGraphicAnimationTimingControls(rendererId);
}

function getPromptPreviewMotionTemplate(
  motionGraphicsSettings: MotionGraphicsSettings | null,
  selectedMotionTemplateId?: string | null,
) {
  const templates = motionGraphicsSettings?.templates || [];
  const selectedTemplate = templates.find(
    (template) => template.id === selectedMotionTemplateId,
  );
  return (
    (selectedTemplate?.enabled ? selectedTemplate : null) ||
    templates.find((template) => template.enabled) ||
    selectedTemplate ||
    templates[0] ||
    null
  );
}

function createMotionGraphicTemplatePromptPreviewValues(
  motionGraphicsSettings: MotionGraphicsSettings | null,
  selectedMotionTemplateId?: string | null,
) {
  const base = XML_MOTION_GRAPHIC_TEMPLATE_PROMPT_PREVIEW_VALUES;
  const template = getPromptPreviewMotionTemplate(
    motionGraphicsSettings,
    selectedMotionTemplateId,
  );

  if (!template) return base;

  return mergePromptTemplatePreviewValues(base, {
    additionalUsageInstructions:
      template.additionalUsageInstructions || "None.",
    animationTimingControls: getMotionTemplateTimingControls(
      template.rendererId,
    ),
    description: template.description,
    deterministicSoundEffectsJson: stringifyPromptPreviewJson(
      template.deterministicSoundEffects || [],
    ),
    displayName: template.displayName,
    durationGuidance: template.durationGuidance,
    exampleXml: template.exampleXml || "None.",
    fieldsJson: stringifyPromptPreviewJson(template.fields),
    rendererId: template.rendererId,
    templateId: template.id,
    whenToUse: template.whenToUse,
    xmlInstructions: template.xmlInstructions || "None.",
  });
}

function renderMotionGraphicTemplatesPreviewValue(
  motionGraphicsSettings: MotionGraphicsSettings | null,
  motionGraphicTemplatePromptTemplate: string,
) {
  const enabledTemplates =
    motionGraphicsSettings?.templates.filter((template) => template.enabled) ||
    [];

  if (enabledTemplates.length === 0) {
    return "If no templates are listed below, use image visuals only.";
  }

  return enabledTemplates
    .map((template) =>
      renderPromptTemplatePreviewString(
        motionGraphicTemplatePromptTemplate,
        createMotionGraphicTemplatePromptPreviewValues(
          {
            templates: [template],
          },
          template.id,
        ),
      ),
    )
    .join("\n");
}

function createXmlVisualPlanningPromptPreviewValues({
  xmlVisualPlanningSettings,
  motionGraphicsSettings,
}: {
  xmlVisualPlanningSettings: XmlVisualPlanningSettings | null;
  motionGraphicsSettings: MotionGraphicsSettings | null;
}) {
  let values = { ...XML_VISUAL_PLANNING_PROMPT_PREVIEW_VALUES };

  const motionGraphicTemplatePromptTemplate =
    xmlVisualPlanningSettings?.motionGraphicTemplatePromptTemplate || "";
  const motionGraphicTemplates = motionGraphicTemplatePromptTemplate
    ? renderMotionGraphicTemplatesPreviewValue(
        motionGraphicsSettings,
        motionGraphicTemplatePromptTemplate,
      )
    : values.motionGraphicTemplates || values["{{motionGraphicTemplates}}"];

  values = mergePromptTemplatePreviewValues(values, {
    motionGraphicTemplates,
  });

  if (xmlVisualPlanningSettings?.planningGuidelinesTemplate) {
    values = mergePromptTemplatePreviewValues(values, {
      planningVisualsGuidelines: renderPromptTemplatePreviewString(
        xmlVisualPlanningSettings.planningGuidelinesTemplate,
        values,
      ),
    });
  }

  return values;
}

function createSoundDesignPromptPreviewValues({
  soundDesignSettings,
  videoRender,
}: {
  soundDesignSettings: SoundDesignSettings | null;
  videoRender: VideoRenderSettings | null;
}) {
  const soundLibrary = (soundDesignSettings?.library || []).slice(0, 8).map(
    (sound) => ({
      id: sound.id,
      name: sound.name,
      category: sound.category,
      semanticTypes: sound.semanticTypes,
      tags: sound.tags,
      timingType: sound.timingType,
      defaultAnchor: sound.defaultAnchor,
      defaultGainDb: sound.defaultGainDb,
      availableForPlanning: sound.availableForPlanning,
      preferredForPlanning: sound.preferredForPlanning,
      recommendedUses: sound.recommendedUses,
    }),
  );
  const musicLibrary = (videoRender?.musicTracks || []).slice(0, 6).map(
    (track) => ({
      id: track.id,
      name: track.name,
      mood: track.mood,
      pacing: track.pacing,
      energy: track.energy,
      tags: track.tags,
      recommendedSections: track.recommendedSections,
      preferredForPlanning: track.preferredForPlanning,
      prompt: track.prompt,
    }),
  );
  const revisionNotes =
    SOUND_DESIGN_PROMPT_PREVIEW_VALUES.revisionNotes ||
    SOUND_DESIGN_PROMPT_PREVIEW_VALUES["{{revisionNotes}}"];
  const revisionNotesBlock = soundDesignSettings?.revisionPromptTemplate
    ? renderPromptTemplatePreviewString(
        soundDesignSettings.revisionPromptTemplate,
        mergePromptTemplatePreviewValues(
          SOUND_DESIGN_REVISION_PROMPT_PREVIEW_VALUES,
          {
            revisionNotes,
          },
        ),
      )
    : SOUND_DESIGN_PROMPT_PREVIEW_VALUES.revisionNotesBlock;

  return mergePromptTemplatePreviewValues(SOUND_DESIGN_PROMPT_PREVIEW_VALUES, {
    musicLibraryJson: stringifyPromptPreviewJson(musicLibrary),
    revisionNotesBlock,
    soundLibraryJson: stringifyPromptPreviewJson(soundLibrary),
  });
}

function createNanoBananaPromptPreviewValues(
  imageStyles: ImageStyleSettings | null,
  selectedStyle: ImageStyle | null,
) {
  if (!imageStyles || !selectedStyle) return NANO_BANANA_PROMPT_PREVIEW_VALUES;

  const reference = selectedStyle.references?.[0] || null;
  const individualExtraReferenceValues = mergePromptTemplatePreviewValues(
    NANO_BANANA_PROMPT_PREVIEW_VALUES,
    {
      attachmentIndex: reference ? 2 : 2,
      label: reference?.label || "Lighting ref",
      usageInstructions:
        reference?.usageInstructions ||
        "Use this reference for soft rim lighting and subtle studio falloff.",
      usageType: reference?.usageType || "lighting",
    },
  );
  const individualExtraReferences =
    reference && imageStyles.promptTemplates.individualExtraReferenceTemplate
      ? renderPromptTemplatePreviewString(
          imageStyles.promptTemplates.individualExtraReferenceTemplate,
          individualExtraReferenceValues,
        )
      : NANO_BANANA_PROMPT_PREVIEW_VALUES.individualExtraReferences;
  const extraReferenceValues = mergePromptTemplatePreviewValues(
    individualExtraReferenceValues,
    {
      individualExtraReferences,
    },
  );
  const extraReferencesInstructions =
    reference && imageStyles.promptTemplates.extraReferencesTemplate
      ? renderPromptTemplatePreviewString(
          imageStyles.promptTemplates.extraReferencesTemplate,
          extraReferenceValues,
        )
      : NANO_BANANA_PROMPT_PREVIEW_VALUES.extraReferencesInstructions;
  const basedOnReferenceInstructions =
    imageStyles.promptTemplates.basedOnReferenceTemplate
      ? renderPromptTemplatePreviewString(
          imageStyles.promptTemplates.basedOnReferenceTemplate,
          mergePromptTemplatePreviewValues(NANO_BANANA_PROMPT_PREVIEW_VALUES, {
            basedOnAttachmentIndex: 3,
            basedOnImageId: "source-profile",
          }),
        )
      : NANO_BANANA_PROMPT_PREVIEW_VALUES.basedOnReferenceInstructions;

  return mergePromptTemplatePreviewValues(NANO_BANANA_PROMPT_PREVIEW_VALUES, {
    basedOnReferenceInstructions,
    extraReferencesInstructions,
    headerPercent: selectedStyle.headerPercent,
    imageDescription: selectedStyle.testImagePrompt,
    individualExtraReferences,
    script: selectedStyle.testCaption,
    styleInstructions: selectedStyle.stylePrompt,
    topic: selectedStyle.testTopic,
    ...(reference
      ? {
          label: reference.label || "Style reference",
          usageInstructions: reference.usageInstructions,
          usageType: reference.usageType,
        }
      : {}),
  });
}

function renderPromptTemplateText(value: string) {
  const nodes: ReactNode[] = [];
  let lastIndex = 0;

  for (const match of value.matchAll(PROMPT_TEMPLATE_PLACEHOLDER_PATTERN)) {
    const index = match.index ?? 0;
    if (index > lastIndex) {
      nodes.push(value.slice(lastIndex, index));
    }
    nodes.push(
      <span
        key={`${match[0]}-${index}`}
        className="rounded bg-primary/20 text-transparent"
      >
        {match[0]}
      </span>,
    );
    lastIndex = index + match[0].length;
  }

  if (lastIndex < value.length) {
    nodes.push(value.slice(lastIndex));
  }

  return nodes.length > 0 ? nodes : "\u00a0";
}

function renderPromptTemplatePreviewText(
  value: string,
  previewValues: PromptTemplatePreviewValues,
) {
  const nodes: ReactNode[] = [];
  let lastIndex = 0;

  for (const match of value.matchAll(PROMPT_TEMPLATE_PLACEHOLDER_PATTERN)) {
    const index = match.index ?? 0;
    if (index > lastIndex) {
      nodes.push(value.slice(lastIndex, index));
    }
    const placeholder = match[0];
    const placeholderName = getPromptPlaceholderName(placeholder);
    const renderedValue =
      previewValues[placeholder] ||
      previewValues[placeholderName] ||
      `Example ${placeholderName || "value"}`;
    nodes.push(
      <span
        key={`${placeholder}-${index}`}
        title={`${placeholder} rendered value`}
        className="box-decoration-clone rounded bg-primary/15 px-1 py-0.5 text-primary"
      >
        {renderedValue}
      </span>,
    );
    lastIndex = index + placeholder.length;
  }

  if (lastIndex < value.length) {
    nodes.push(value.slice(lastIndex));
  }

  return nodes.length > 0 ? nodes : "\u00a0";
}

function PromptTemplateTextarea({
  value,
  onChange,
  onFocus,
  onBlur,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  onFocus?: () => void;
  onBlur?: () => void;
  className?: string;
}) {
  const highlightRef = useRef<HTMLDivElement | null>(null);

  const syncHighlightScroll = useCallback(
    (textarea: HTMLTextAreaElement) => {
      if (!highlightRef.current) return;
      highlightRef.current.style.transform = `translate(${-textarea.scrollLeft}px, ${-textarea.scrollTop}px)`;
    },
    [],
  );

  return (
    <div className="relative rounded-md border border-input bg-background">
      <div
        aria-hidden="true"
          className={cn(
            "pointer-events-none absolute inset-0 z-0 overflow-hidden rounded-md text-transparent",
            PROMPT_TEMPLATE_EDITOR_TEXT_CLASS,
            className,
          )}
          style={PROMPT_TEMPLATE_EDITOR_TEXT_STYLE}
        >
        <div
          ref={highlightRef}
          className="min-h-full w-full"
        >
          {renderPromptTemplateText(value)}
          {value.endsWith("\n") ? "\u00a0" : null}
        </div>
      </div>
      <Textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onFocus={onFocus}
        onBlur={onBlur}
        onScroll={(event) => syncHighlightScroll(event.currentTarget)}
        spellCheck={false}
        autoCorrect="off"
        autoCapitalize="off"
        className={cn(
          "relative z-10 border-transparent bg-transparent text-foreground shadow-none selection:bg-primary/30 focus-visible:ring-1 focus-visible:ring-ring",
          PROMPT_TEMPLATE_EDITOR_TEXT_CLASS,
          className,
        )}
        style={PROMPT_TEMPLATE_EDITOR_TEXT_STYLE}
      />
    </div>
  );
}

function PromptTemplateEditorCard({
  title,
  description,
  value,
  onChange,
  onFocus,
  onBlur,
  feedback,
  dirty,
  saving,
  onSave,
  onReset,
  minHeightClassName = "min-h-[280px]",
  previewValues = {},
  children,
}: {
  title: string;
  description?: string;
  value: string;
  onChange: (value: string) => void;
  onFocus?: () => void;
  onBlur?: () => void;
  feedback: SectionFeedback;
  dirty: boolean;
  saving: boolean;
  onSave: () => void;
  onReset: () => void;
  minHeightClassName?: string;
  previewValues?: PromptTemplatePreviewValues;
  children?: ReactNode;
}) {
  return (
    <Card className="space-y-3 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-medium text-foreground">{title}</h3>
          {description ? (
            <p className="mt-1 text-xs text-muted-foreground">
              {description}
            </p>
          ) : null}
        </div>
        <SectionActions
          dirty={dirty}
          saving={saving}
          saveLabel="Save template"
          resetLabel="Restore"
          onSave={onSave}
          onReset={onReset}
        />
      </div>
      <PromptTemplateTextarea
        value={value}
        onChange={onChange}
        onFocus={onFocus}
        onBlur={onBlur}
        className={minHeightClassName}
      />
      <details className="group rounded-md border border-border bg-muted/20">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-3 py-2 text-xs font-medium text-foreground [&::-webkit-details-marker]:hidden">
          <span>Prompt preview</span>
          <span
            aria-hidden="true"
            className="text-muted-foreground transition-transform group-open:rotate-90"
          >
            &gt;
          </span>
        </summary>
        <div className="border-t border-border bg-background">
          <div
            className={cn(
              "max-h-[360px] min-h-[120px] overflow-auto text-foreground",
              PROMPT_TEMPLATE_EDITOR_TEXT_CLASS,
            )}
            style={PROMPT_TEMPLATE_EDITOR_TEXT_STYLE}
          >
            {renderPromptTemplatePreviewText(value, previewValues)}
            {value.endsWith("\n") ? "\u00a0" : null}
          </div>
        </div>
      </details>
      <SectionFeedbackNotice feedback={feedback} />
      {children ? <div className="space-y-1 text-xs text-muted-foreground">{children}</div> : null}
    </Card>
  );
}

const STYLE_REFERENCE_USAGE_OPTIONS: {
  value: StyleReferenceUsageType;
  label: string;
}[] = [
  { value: "general", label: "General" },
  { value: "style", label: "Style / aesthetic" },
  { value: "character", label: "Primary character" },
  { value: "lighting", label: "Lighting" },
  { value: "composition", label: "Composition" },
  { value: "palette", label: "Palette / color" },
];

const CAPTION_ANIMATION_EASING_OPTIONS: Array<{
  value: ShortFormCaptionAnimationEasing;
  label: string;
}> = [
  { value: "linear", label: "Linear" },
  { value: "ease-in-quad", label: "Ease in quad" },
  { value: "ease-out-quad", label: "Ease out quad" },
  { value: "ease-in-out-quad", label: "Ease in out quad" },
  { value: "ease-out-cubic", label: "Ease out cubic" },
  { value: "ease-in-out-cubic", label: "Ease in out cubic" },
  { value: "ease-out-back", label: "Ease out back" },
];

const CAPTION_ANIMATION_COLOR_MODE_OPTIONS: Array<{
  value: ShortFormCaptionAnimationColorMode;
  label: string;
}> = [
  { value: "style-active-word", label: "Use active word color" },
  { value: "style-outline", label: "Use caption outline color" },
  { value: "style-shadow", label: "Use caption shadow color" },
  { value: "custom", label: "Use custom color" },
];

const CAPTION_ANIMATION_TRACK_LABELS: Array<{
  key: keyof ShortFormCaptionAnimationPresetConfig["motion"];
  label: string;
  helper: string;
}> = [
  {
    key: "scale",
    label: "Scale",
    helper: "Multiplicative scale over the active-word lifetime.",
  },
  {
    key: "translateXEm",
    label: "Translate X (em)",
    helper: "Horizontal motion in em units.",
  },
  {
    key: "translateYEm",
    label: "Translate Y (em)",
    helper:
      "Vertical motion in em units. Positive values lift upward in preview/render.",
  },
  {
    key: "extraOutlineWidth",
    label: "Extra outline width",
    helper: "Adds outline thickness on top of the caption style outline.",
  },
  {
    key: "extraBlur",
    label: "Extra blur",
    helper: "Adds glow / blur on top of the caption style shadow blur.",
  },
  {
    key: "glowStrength",
    label: "Glow strength",
    helper: "Controls the intensity of the active-word glow layer.",
  },
  {
    key: "shadowOpacityMultiplier",
    label: "Shadow opacity multiplier",
    helper: "Scales the shadow alpha during the animation.",
  },
];

const CAPTION_FONT_WEIGHT_OPTIONS: Array<{ value: number; label: string }> = [
  { value: 300, label: "Light (300)" },
  { value: 400, label: "Regular (400)" },
  { value: 500, label: "Medium (500)" },
  { value: 600, label: "Semibold (600)" },
  { value: 700, label: "Bold (700)" },
  { value: 800, label: "Extra Bold (800)" },
  { value: 900, label: "Black (900)" },
];

const PROMPT_GROUPS: Array<{
  id: SettingsSectionId;
  title: string;
  description: string;
  keys: PromptKey[];
}> = [
  {
    id: "prompt-hooks",
    title: "Hook prompts",
    description:
      "Templates still used for hook generation and “more hooks” requests.",
    keys: ["hooksGenerate", "hooksMore"],
  },
  {
    id: "prompt-research",
    title: "Research prompts",
    description: "Templates still used when Oracle writes or revises research.",
    keys: ["researchGenerate", "researchRevise"],
  },
];

const PROMPT_GROUP_PLACEHOLDER_ROWS: Record<"prompt-hooks" | "prompt-research", PromptPlaceholderRow[]> = {
  "prompt-hooks": [
    {
      placeholder: "{{topic}}",
      explanation: "The short-form project topic.",
      example: "Facial posture reset",
    },
    {
      placeholder: "{{selectedHookLine}}",
      explanation: "A preformatted selected-hook line when one exists; otherwise an empty string.",
      example: "Currently selected hook: Your face may look uneven from tiny muscle habits",
    },
    {
      placeholder: "{{descriptionOrFallback}}",
      explanation: "Extra direction supplied when requesting more hooks, or the fallback text `None.`.",
      example: "Make these more curiosity-driven and less clinical.",
    },
    {
      placeholder: "{{priorHooksBlock}}",
      explanation: "A formatted list of previously generated hooks so the next batch can avoid duplicates.",
      example: "Previously generated hooks (avoid duplicates...):\n- Your face may look uneven from tiny muscle habits",
    },
    {
      placeholder: "{{hooksPayloadHint}}",
      explanation: "The visible JSON file-writing and validation instructions for the hooks artifact.",
      example: "Save the result to .../hooks.json as strict JSON with this shape...",
    },
    {
      placeholder: "{{projectDir}}",
      explanation: "Absolute project root for the short-form deliverable.",
      example: "/Users/ittaisvidler/.../short-form-videos/project-id",
    },
  ],
  "prompt-research": [
    {
      placeholder: "{{topic}}",
      explanation: "The short-form project topic.",
      example: "Facial posture reset",
    },
    {
      placeholder: "{{selectedHookLine}}",
      explanation: "A preformatted selected-hook line when one exists; otherwise an empty string.",
      example: "Selected hook: Your face may look uneven from tiny muscle habits",
    },
    {
      placeholder: "{{notesOrFallback}}",
      explanation: "Revision notes for a Research rerun, or an empty string when none were supplied.",
      example: "Add stronger sources around facial muscle activation.",
    },
    {
      placeholder: "{{researchPath}}",
      explanation: "Absolute path where Oracle must write or update the Research artifact.",
      example: "/Users/ittaisvidler/.../short-form-videos/project-id/research.md",
    },
    {
      placeholder: "{{projectDir}}",
      explanation: "Absolute project root for the short-form deliverable.",
      example: "/Users/ittaisvidler/.../short-form-videos/project-id",
    },
  ],
};

const TEXT_SCRIPT_PLACEHOLDER_ROWS: PromptPlaceholderRow[] = [
  {
    placeholder: "{{retentionSkillPath}}",
    explanation: "Absolute path to the retention writer skill instructions.",
    example: "/Users/ittaisvidler/.openclaw/skills/video-script-retention/SKILL.md",
  },
  {
    placeholder: "{{retentionPlaybookPath}}",
    explanation: "Absolute path to the retention playbook reference file.",
    example: "/Users/ittaisvidler/.openclaw/skills/video-script-retention/references/playbook.md",
  },
  {
    placeholder: "{{graderSkillPath}}",
    explanation: "Absolute path to the retention grader skill instructions.",
    example: "/Users/ittaisvidler/.openclaw/skills/video-script-retention-grader/SKILL.md",
  },
  {
    placeholder: "{{graderRubricPath}}",
    explanation: "Absolute path to the grader rubric reference file.",
    example: "/Users/ittaisvidler/.openclaw/skills/video-script-retention-grader/references/rubric.md",
  },
  {
    placeholder: "{{topic}}",
    explanation: "The short-form project topic.",
    example: "Facial posture reset",
  },
  {
    placeholder: "{{selectedHookTextOrFallback}}",
    explanation: "The selected hook text, or fallback text when no hook is selected.",
    example: "Your face may look uneven from tiny muscle habits",
  },
  {
    placeholder: "{{workflowMode}}",
    explanation: "Whether the current Text Script loop was started as generate or revise.",
    example: "revise",
  },
  {
    placeholder: "{{iterationNumber}}",
    explanation: "The current draft/review iteration number inside the Text Script loop.",
    example: "2",
  },
  {
    placeholder: "{{maxIterations}}",
    explanation: "The maximum number of writer/reviewer iterations allowed for this run.",
    example: "3",
  },
  {
    placeholder: "{{passingScore}}",
    explanation: "The score threshold the backend uses when deciding whether a reviewed draft passes.",
    example: "95",
  },
  {
    placeholder: "{{draftPath}}",
    explanation: "Absolute path where the writer must save the current iteration draft.",
    example: "/Users/ittaisvidler/.../text-script-work/runs/run-id/iterations/01-draft.md",
  },
  {
    placeholder: "{{reviewPath}}",
    explanation: "Absolute path where the grader must save the current iteration review.",
    example: "/Users/ittaisvidler/.../text-script-work/runs/run-id/iterations/01-review.md",
  },
  {
    placeholder: "{{scriptPath}}",
    explanation: "Absolute path to the final published Text Script artifact.",
    example: "/Users/ittaisvidler/.../short-form-videos/project-id/script.md",
  },
  {
    placeholder: "{{runManifestPath}}",
    explanation: "Absolute path to the Text Script loop manifest owned by the backend.",
    example: "/Users/ittaisvidler/.../text-script-work/runs/run-id/run.json",
  },
  {
    placeholder: "{{revisionNotesOrNone}}",
    explanation: "Raw revision notes for the run, or `None.` when there are no notes.",
    example: "Make the first proof beat more specific.",
  },
  {
    placeholder: "{{revisionInstructionLine}}",
    explanation: "A preformatted revise/regenerate instruction line derived from the supplied notes.",
    example: "Revise the existing plain text script based on this feedback:\nMake the first proof beat more specific.",
  },
  {
    placeholder: "{{approvedResearch}}",
    explanation: "The approved Research artifact content used as grounding context.",
    example: "---\ntitle: ...\n---\n# Research\n...",
  },
  {
    placeholder: "{{currentScriptContent}}",
    explanation: "The current script content passed into the run config for revision context; use priorDraftBlock for iteration-local draft context.",
    example: "---\ntitle: ...\n---\nYour face may look uneven...",
  },
  {
    placeholder: "{{priorDraftBlock}}",
    explanation: "A formatted prior-draft block for iterations after the first draft, or empty on the first draft.",
    example: "Prior draft to improve:\nYour face may look uneven...",
  },
  {
    placeholder: "{{priorReviewBlock}}",
    explanation: "A formatted prior-review summary and feedback block after a failed review, or empty before review feedback exists.",
    example: "Prior grader summary:\nStrong hook, weak proof specificity...",
  },
  {
    placeholder: "{{draftBody}}",
    explanation: "The current draft body supplied to the review prompt.",
    example: "Your face may look uneven from tiny muscle habits. Try this test...",
  },
  {
    placeholder: "{{projectDir}}",
    explanation: "Absolute project root for the short-form deliverable.",
    example: "/Users/ittaisvidler/.../short-form-videos/project-id",
  },
];

const SOUND_DESIGN_PLACEHOLDER_ROWS: PromptPlaceholderRow[] = [
  {
    placeholder: "{{topic}}",
    explanation: "The short-form project topic.",
    example: "Facial posture reset",
  },
  {
    placeholder: "{{selectedHook}}",
    explanation: "The selected hook text only.",
    example: "Your face may look uneven from tiny muscle habits",
  },
  {
    placeholder: "{{selectedHookTextOrFallback}}",
    explanation: "The selected hook text, or fallback text when no hook is selected.",
    example: "Your face may look uneven from tiny muscle habits",
  },
  {
    placeholder: "{{revisionNotes}}",
    explanation: "Raw Plan Sound Design revision notes.",
    example: "Make the opening more cinematic and reduce ticks after 30 seconds.",
  },
  {
    placeholder: "{{revisionNotesBlock}}",
    explanation: "The rendered conditional revision-notes template output, or empty when no notes exist.",
    example: "Revision notes: Make the opening more cinematic...",
  },
  {
    placeholder: "{{projectId}}",
    explanation: "The short-form project id.",
    example: "facial-posture-reset-20260519162000",
  },
  {
    placeholder: "{{projectDir}}",
    explanation: "Absolute project root for the short-form deliverable.",
    example: "/Users/ittaisvidler/.../short-form-videos/project-id",
  },
  {
    placeholder: "{{soundDesignPath}}",
    explanation: "Absolute path where Scribe must write the sound-design artifact.",
    example: "/Users/ittaisvidler/.../short-form-videos/project-id/sound-design.md",
  },
  {
    placeholder: "{{xmlScriptPath}}",
    explanation: "Absolute path to the XML visual plan artifact.",
    example: "/Users/ittaisvidler/.../short-form-videos/project-id/xml-script.md",
  },
  {
    placeholder: "{{captionPlanPath}}",
    explanation: "Absolute path to the deterministic caption timing JSON.",
    example: "/Users/ittaisvidler/.../output/xml-script-work/captions/caption-sections.json",
  },
  {
    placeholder: "{{sceneManifestPath}}",
    explanation: "Absolute path to the generated visual timing/cut manifest JSON.",
    example: "/Users/ittaisvidler/.../short-form-videos/project-id/scenes/manifest.json",
  },
  {
    placeholder: "{{visualBeatMapJson}}",
    explanation: "Compact JSON summary of scene cuts, visual ids, labels, and timing windows.",
    example: "{ \"sceneCount\": 19, \"cuts\": [ ... ] }",
  },
  {
    placeholder: "{{soundLibraryJson}}",
    explanation: "Compact JSON payload of saved sound-library entries available for planning.",
    example: "[{ \"id\": \"impact-soft-organic-hit\", \"category\": \"Impact\", ... }]",
  },
  {
    placeholder: "{{musicLibraryJson}}",
    explanation: "Compact JSON payload of saved music-library tracks available for planning.",
    example: "[{ \"id\": \"music-cinematic-tension\", \"mood\": \"tense\", ... }]",
  },
  {
    placeholder: "{{existingSoundDesignBodySummary}}",
    explanation: "A generated state summary of the existing sound-design XML body, used only if this placeholder is present in the template.",
    example: "The current artifact body is 14666 characters; your saved body must differ from it.",
  },
];

const SOUND_DESIGN_REVISION_PLACEHOLDER_ROWS: PromptPlaceholderRow[] = [
  {
    placeholder: "{{revisionNotes}}",
    explanation: "Raw Plan Sound Design revision notes.",
    example: "Make the opening more cinematic and reduce ticks after 30 seconds.",
  },
  {
    placeholder: "{{soundDesignPath}}",
    explanation: "Absolute path to the existing sound-design artifact.",
    example: "/Users/ittaisvidler/.../short-form-videos/project-id/sound-design.md",
  },
];

const PROMPT_GROUP_PREVIEW_VALUES: Record<
  "prompt-hooks" | "prompt-research",
  PromptTemplatePreviewValues
> = {
  "prompt-hooks": createPromptTemplatePreviewValues(
    PROMPT_GROUP_PLACEHOLDER_ROWS["prompt-hooks"],
  ),
  "prompt-research": createPromptTemplatePreviewValues(
    PROMPT_GROUP_PLACEHOLDER_ROWS["prompt-research"],
  ),
};

const TEXT_SCRIPT_PROMPT_PREVIEW_VALUES =
  createPromptTemplatePreviewValues(TEXT_SCRIPT_PLACEHOLDER_ROWS);
const XML_VISUAL_PLANNING_PROMPT_PREVIEW_VALUES =
  createPromptTemplatePreviewValues(XML_VISUAL_PLANNING_PLACEHOLDER_ROWS);
const XML_MOTION_GRAPHIC_TEMPLATE_PROMPT_PREVIEW_VALUES =
  createPromptTemplatePreviewValues(XML_MOTION_GRAPHIC_TEMPLATE_PLACEHOLDER_ROWS);
const SOUND_DESIGN_PROMPT_PREVIEW_VALUES =
  createPromptTemplatePreviewValues(SOUND_DESIGN_PLACEHOLDER_ROWS);
const SOUND_DESIGN_REVISION_PROMPT_PREVIEW_VALUES =
  createPromptTemplatePreviewValues(SOUND_DESIGN_REVISION_PLACEHOLDER_ROWS);
const NANO_BANANA_PROMPT_PREVIEW_VALUES =
  createPromptTemplatePreviewValues(NANO_BANANA_PLACEHOLDER_ROWS);

const PROMPT_TEMPLATE_IDS = [
  "hooksGenerate",
  "hooksMore",
  "researchGenerate",
  "researchRevise",
  "textScript.generatePrompt",
  "textScript.revisePrompt",
  "textScript.reviewPrompt",
  "xmlVisualPlanning.planningGuidelinesTemplate",
  "xmlVisualPlanning.motionGraphicTemplatePromptTemplate",
  "xmlVisualPlanning.promptTemplate",
  "xmlVisualPlanning.revisePromptTemplate",
  "soundDesign.promptTemplate",
  "soundDesign.revisionPromptTemplate",
  "imageStyles.imageGenerationTemplate",
  "imageStyles.basedOnReferenceTemplate",
  "imageStyles.extraReferencesTemplate",
  "imageStyles.individualExtraReferenceTemplate",
] as const satisfies PromptTemplateId[];

const SETTINGS_PAGE_META: Record<
  ShortFormSettingsRouteSection,
  {
    eyebrow: string;
    title: string;
    description: string;
    summaryLabel: string;
    sectionIds: SettingsSectionId[];
    pageActionSectionId?: SettingsSectionId;
  }
> = {
  topic: {
    eyebrow: "Short-form workflow settings",
    title: "Topic",
    description:
      "The Topic workflow step currently has no global prompt or rendering settings.",
    summaryLabel: "No global settings",
    sectionIds: [],
  },
  hook: {
    eyebrow: "Short-form workflow settings",
    title: "Hook",
    description:
      "Edit the hook-generation prompts used when the Hook workflow page asks Scribe for hook options.",
    summaryLabel: "2 prompt templates",
    sectionIds: ["prompt-hooks"],
  },
  research: {
    eyebrow: "Short-form workflow settings",
    title: "Research",
    description:
      "Edit the research prompts used when the Research workflow page asks Oracle to generate or revise research.",
    summaryLabel: "2 prompt templates",
    sectionIds: ["prompt-research"],
  },
  "text-script": {
    eyebrow: "Short-form workflow settings",
    title: "Text Script",
    description:
      "Edit the full Scribe prompt templates, iteration defaults, and post-processing rules used by the Text Script workflow page.",
    summaryLabel: "3 full prompts",
    sectionIds: ["text-script-prompts"],
  },
  "generate-narration-audio": {
    eyebrow: "Short-form workflow settings",
    title: "Generate Narration Audio",
    description:
      "Tune narration voice defaults and silence-trimming behavior used by the Generate Narration Audio workflow page.",
    summaryLabel: "2 editable sections",
    sectionIds: ["pause-removal", "tts-voice"],
  },
  "plan-captions": {
    eyebrow: "Short-form workflow settings",
    title: "Plan Captions",
    description:
      "Edit reusable caption styles, linked animation presets, and the default deterministic caption chunking rules.",
    summaryLabel: "Shared caption style library",
    sectionIds: ["caption-styles"],
    pageActionSectionId: "caption-styles",
  },
  "plan-visuals": {
    eyebrow: "Short-form workflow settings",
    title: "Plan Visuals",
    description:
      "Edit the complete Scribe prompt surface used when Plan Visuals generates or revises the XML visual plan.",
    summaryLabel: "Full XML planning prompt",
    sectionIds: ["xml-visual-planning"],
  },
  "generate-visuals-motion-graphics": {
    eyebrow: "Generate Visuals Settings",
    title: "Motion Graphics",
    description:
      "Maintain deterministic animated slides, charts, lists, and caption-wall templates available to Scribe during Plan Visuals.",
    summaryLabel: "Template library",
    sectionIds: ["motion-graphics"],
  },
  "generate-visuals-image-generation-prompts": {
    eyebrow: "Generate Visuals Settings",
    title: "Image Generation Prompts",
    description:
      "Edit the real prompt templates used by direct dashboard scene-image generation.",
    summaryLabel: "Prompt templates",
    sectionIds: ["image-templates"],
  },
  "generate-visuals-image-styles": {
    eyebrow: "Generate Visuals Settings",
    title: "Image Styles",
    description:
      "Maintain reusable image styles, reference images, and the global image-generation provider/model default.",
    summaryLabel: "Style library",
    sectionIds: ["image-styles"],
    pageActionSectionId: "image-styles",
  },
  "plan-sound-design": {
    eyebrow: "Short-form workflow settings",
    title: "Plan Sound Design",
    description:
      "Manage the full Plan Sound Design prompt and conditional revision-notes prompt.",
    summaryLabel: "2 prompt templates",
    sectionIds: ["sound-library"],
  },
  "generate-sound-design": {
    eyebrow: "Short-form workflow settings",
    title: "Generate Sound Design",
    description:
      "Manage mix defaults and saved audio clips used by project sound-design resolution.",
    summaryLabel: "Selected sounds",
    sectionIds: ["sound-library"],
  },
};

function getSettingsSectionSaveLabel(sectionId: SettingsSectionId) {
  switch (sectionId) {
    case "tts-voice":
      return "Save voice library";
    case "pause-removal":
      return "Save pause-removal defaults";
    case "music-library":
      return "Save music library";
    case "sound-library":
      return "Save sound library settings";
    case "caption-styles":
      return "Save caption styles";
    case "image-styles":
      return "Save style library";
    case "motion-graphics":
      return "Save template";
    case "image-templates":
      return "Save image prompt templates";
    case "prompt-hooks":
    case "prompt-research":
    case "text-script-prompts":
    case "xml-visual-planning":
      return "Save settings";
  }
}

function buildStyleTestsById(
  styles: ImageStyle[],
): Record<string, StyleTestState> {
  return styles.reduce<Record<string, StyleTestState>>((acc, style) => {
    if (
      style.lastTestImage?.cleanImageUrl ||
      style.lastTestImage?.previewImageUrl
    ) {
      acc[style.id] = {
        isLoading: false,
        error: null,
        cleanImageUrl: style.lastTestImage.cleanImageUrl || null,
        previewImageUrl: style.lastTestImage.previewImageUrl || null,
      };
    }
    return acc;
  }, {});
}

function createEmptySectionFeedback(): Record<
  SettingsSectionId,
  SectionFeedback
> {
  return {
    "tts-voice": { saving: false, error: null, message: null },
    "pause-removal": { saving: false, error: null, message: null },
    "music-library": { saving: false, error: null, message: null },
    "sound-library": { saving: false, error: null, message: null },
    "caption-styles": { saving: false, error: null, message: null },
    "image-templates": { saving: false, error: null, message: null },
    "image-styles": { saving: false, error: null, message: null },
    "motion-graphics": { saving: false, error: null, message: null },
    "prompt-hooks": { saving: false, error: null, message: null },
    "prompt-research": { saving: false, error: null, message: null },
    "text-script-prompts": { saving: false, error: null, message: null },
    "xml-visual-planning": { saving: false, error: null, message: null },
  };
}

function createEmptyPromptTemplateFeedback(): Record<
  PromptTemplateId,
  SectionFeedback
> {
  return Object.fromEntries(
    PROMPT_TEMPLATE_IDS.map((id) => [
      id,
      { saving: false, error: null, message: null },
    ]),
  ) as Record<PromptTemplateId, SectionFeedback>;
}

function serializeForCompare(value: unknown) {
  return JSON.stringify(value);
}

function buildMotionTemplatePreviewKey(template: MotionGraphicTemplateConfig) {
  return serializeForCompare({
    id: template.id,
    rendererId: template.rendererId,
    previewDurationSeconds: template.previewDurationSeconds,
    previewArgs: template.previewArgs,
    deterministicSoundEffects: template.deterministicSoundEffects || [],
  });
}

function createEmptyMotionPreviewState(
  previewKey: string,
): MotionGraphicPreviewState {
  return {
    isLoading: true,
    error: null,
    previewKey,
    videoUrl: null,
    posterUrl: null,
    reusedExisting: null,
  };
}

function pickPromptValues(
  source: Partial<Record<PromptKey, string>>,
  keys: PromptKey[],
) {
  return keys.reduce<Partial<Record<PromptKey, string>>>((acc, key) => {
    acc[key] = source[key] || "";
    return acc;
  }, {});
}

function createStyleDraft(index: number): ImageStyle {
  return {
    id: `style-${Date.now()}-${index}`,
    name: `New style ${index}`,
    description: "",
    stylePrompt:
      "Premium modern social-video aesthetic, cohesive full-frame composition, dramatic but tasteful lighting, minimal clutter.",
    headerPercent: 28,
    testTopic: "Facial posture reset",
    testCaption: "Your jawline changes when posture changes",
    testImagePrompt:
      "Single full-frame side-profile portrait in a dark studio, subtle posture cue through neck alignment, natural negative space near the top.",
    references: [],
  };
}

function createVoiceDraft(index: number): VoiceLibraryEntry {
  return {
    id: `voice-${Date.now()}-${index}`,
    name: `New voice ${index}`,
    sourceType: "generated",
    mode: "voice-design",
    voiceDesignPrompt:
      "Educated American English narrator with calm authority, polished pacing, natural warmth, and crisp short-form delivery. Speak only English and avoid non-speech sounds.",
    notes: "",
    previewText:
      "Most people think their face shape is fixed, but posture, breathing, and muscular balance change more than you expect. In this lesson, I will walk through the habits that matter most, the mistakes that waste effort, and the small adjustments that create visible changes over time. Keep your shoulders relaxed, your neck long, and your breathing steady as we go step by step.",
  };
}

function createUploadedReferenceVoiceDraft(index: number): VoiceLibraryEntry {
  return {
    id: `voice-upload-${Date.now()}-${index}`,
    name: `Uploaded voice ${index}`,
    sourceType: "uploaded-reference",
    mode: "voice-design",
    voiceDesignPrompt: "Use the uploaded reference clip for voice cloning.",
    notes: "",
    previewText:
      "Most people think their face shape is fixed, but posture, breathing, and muscular balance change more than you expect. In this lesson, I will walk through the habits that matter most, the mistakes that waste effort, and the small adjustments that create visible changes over time. Keep your shoulders relaxed, your neck long, and your breathing steady as we go step by step.",
    referenceText: "",
  };
}

function createMusicDraft(index: number): MusicLibraryEntry {
  return {
    id: `music-${Date.now()}-${index}`,
    name: `New soundtrack ${index}`,
    sourceType: "ai-generated",
    prompt:
      "instrumental modern short-form social-video underscore, polished and cinematic, no vocals, no spoken voice, no choir",
    notes: "",
    previewDurationSeconds: 12,
  };
}

function createSoundDraft(
  index: number,
  overrides?: Partial<SoundLibraryEntry>,
): SoundLibraryEntry {
  return {
    id: overrides?.id || `sound-${Date.now()}-${index}`,
    name: overrides?.name || `New sound ${index}`,
    category: overrides?.category ?? "Impact",
    semanticTypes: overrides?.semanticTypes || ["impact"],
    tags: overrides?.tags || [],
    stylePalettes: overrides?.stylePalettes || [],
    frequencyBand: overrides?.frequencyBand,
    layerRoles: overrides?.layerRoles || [],
    literalness: overrides?.literalness,
    timingType: overrides?.timingType || "point",
    defaultAnchor: overrides?.defaultAnchor || "scene-start",
    defaultGainDb: overrides?.defaultGainDb ?? -6,
    defaultFadeInMs: overrides?.defaultFadeInMs ?? 0,
    defaultFadeOutMs: overrides?.defaultFadeOutMs ?? 180,
    recommendedUses: overrides?.recommendedUses ?? "",
    avoidUses: overrides?.avoidUses ?? "",
    notes: overrides?.notes ?? "",
    source: overrides?.source,
    license: overrides?.license ?? "Internal",
    audioRelativePath: overrides?.audioRelativePath,
    audioUrl: overrides?.audioUrl,
    durationSeconds: overrides?.durationSeconds,
    sampleRate: overrides?.sampleRate,
    channels: overrides?.channels,
    anchorRatio: overrides?.anchorRatio,
    waveformPeaks: overrides?.waveformPeaks,
    uploadedAt: overrides?.uploadedAt,
    createdAt: overrides?.createdAt,
    updatedAt: overrides?.updatedAt,
  };
}

function createCaptionStyleDraft(index: number): CaptionStyleEntry {
  return {
    id: `caption-style-${Date.now()}-${index}`,
    name: `New caption style ${index}`,
    fontFamily: "Arial",
    fontWeight: 700,
    fontSize: 72,
    wordSpacing: 0,
    horizontalPadding: 80,
    bottomMargin: 220,
    activeWordColor: "#FFFFFF",
    spokenWordColor: "#D0D0D0",
    upcomingWordColor: "#5E5E5E",
    outlineColor: "#000000",
    outlineWidth: 3.5,
    shadowColor: "#000000",
    shadowStrength: 1.2,
    shadowBlur: 2.2,
    shadowOffsetX: 0,
    shadowOffsetY: 3.4,
    backgroundEnabled: false,
    backgroundColor: "#000000",
    backgroundOpacity: 0.45,
    backgroundPadding: 20,
    backgroundRadius: 24,
    animationPresetId: DEFAULT_CAPTION_ANIMATION_PRESET_ID,
    animationPreset: "stable-pop",
  };
}

function createAnimationPresetDraft(index: number): AnimationPresetEntry {
  const template =
    DEFAULT_SHORT_FORM_CAPTION_ANIMATION_PRESETS.find(
      (preset) => preset.id === DEFAULT_CAPTION_ANIMATION_PRESET_ID,
    ) || DEFAULT_SHORT_FORM_CAPTION_ANIMATION_PRESETS[0];
  return {
    id: `caption-animation-${Date.now()}-${index}`,
    slug: `custom-${Date.now()}-${index}`,
    name: `Custom animation ${index}`,
    description: "Editable caption animation preset.",
    config: cloneCaptionAnimationConfig(template.config),
  };
}

function buildUniqueAnimationPresetName(
  presets: AnimationPresetEntry[],
  baseName: string,
) {
  let nextName = `${baseName} copy`;
  let suffix = 2;
  const existing = new Set(presets.map((preset) => preset.name.toLowerCase()));
  while (existing.has(nextName.toLowerCase())) {
    nextName = `${baseName} copy ${suffix}`;
    suffix += 1;
  }
  return nextName;
}

function buildUniqueAnimationPresetId(
  presets: AnimationPresetEntry[],
  name: string,
) {
  const base = slugify(name) || "caption-animation";
  let candidate = base;
  let suffix = 2;
  const existing = new Set(presets.map((preset) => preset.id));
  while (existing.has(candidate)) {
    candidate = `${base}-${suffix}`;
    suffix += 1;
  }
  return candidate;
}

function parseAnimationPresetConfigJson(
  value: string,
  fallback: ShortFormCaptionAnimationPresetConfig,
) {
  try {
    return normalizeCaptionAnimationPresetConfig(JSON.parse(value), fallback);
  } catch {
    return null;
  }
}

function formatAnimationPresetConfigJson(
  config: ShortFormCaptionAnimationPresetConfig,
) {
  return JSON.stringify(config, null, 2);
}

function slugify(text: string) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

function getSoundLibraryCategoryLabel(category: string) {
  const trimmed = category.trim();
  return trimmed || "Uncategorized";
}

function getSoundLibraryCategoryKey(category: string) {
  const trimmed = category.trim().toLowerCase();
  return trimmed || "__uncategorized__";
}

function matchesMusicLibraryFileFilter(
  track: MusicLibraryEntry,
  filter: SoundLibraryFileFilter,
) {
  if (filter === "with-audio") return Boolean(track.generatedAudioRelativePath);
  if (filter === "missing-audio") return !track.generatedAudioRelativePath;
  return true;
}

function matchesSoundLibraryFileFilter(
  sound: SoundLibraryEntry,
  filter: SoundLibraryFileFilter,
) {
  if (filter === "with-audio") return Boolean(sound.audioRelativePath);
  if (filter === "missing-audio") return !sound.audioRelativePath;
  return true;
}

function matchesAudioLibraryAvailabilityFilter(
  asset:
    | Pick<SoundLibraryEntry, "availableForPlanning" | "availableForGeneration">
    | Pick<MusicLibraryEntry, "availableForPlanning" | "availableForGeneration">,
  filter: AudioLibraryAvailabilityFilter,
) {
  if (filter === "planning") return asset.availableForPlanning === true;
  if (filter === "not-planning") return asset.availableForPlanning !== true;
  if (filter === "generation") return asset.availableForGeneration === true;
  if (filter === "not-generation") return asset.availableForGeneration !== true;
  return true;
}

function matchesSoundLibraryCategoryFilter(
  sound: SoundLibraryEntry,
  filter: SoundLibraryCategoryFilter,
) {
  if (filter === "all") return true;
  const categoryKey = getSoundLibraryCategoryKey(sound.category);
  if (filter === "__uncategorized__")
    return categoryKey === "__uncategorized__";
  return categoryKey === filter.trim().toLowerCase();
}

function matchesMusicLibraryCategoryFilter(filter: SoundLibraryCategoryFilter) {
  if (filter === "all") return true;
  return filter.trim().toLowerCase() === "music";
}

function buildMusicLibrarySearchHaystack(track: MusicLibraryEntry) {
  return [
    "music",
    "soundtrack",
    track.id,
    track.name,
    track.prompt,
    track.notes,
    track.mood || "",
    track.pacing || "",
    track.key || "",
    track.energy || "",
    track.emotionalArc || "",
    track.intensityCurve || "",
    (track.tags || []).join(" "),
    (track.recommendedSections || []).join(" "),
    (track.bestSceneTypes || []).join(" "),
    (track.comparableTo || []).join(" "),
    track.transitionInPattern || "",
    track.transitionOutPattern || "",
    track.source || "",
    track.license || "",
    track.creator || "",
    track.originalFileName || "",
    track.generatedAudioRelativePath || "",
  ]
    .join(" ")
    .toLowerCase();
}

function matchesMusicLibrarySearch(track: MusicLibraryEntry, tokens: string[]) {
  if (tokens.length === 0) return true;
  const haystack = buildMusicLibrarySearchHaystack(track);
  return tokens.every((token) => haystack.includes(token));
}

function buildSoundLibrarySearchHaystack(sound: SoundLibraryEntry) {
  return [
    sound.id,
    sound.name,
    sound.category,
    sound.semanticTypes.join(" "),
    sound.tags.join(" "),
    (sound.stylePalettes || []).join(" "),
    sound.frequencyBand || "",
    (sound.layerRoles || []).join(" "),
    sound.literalness || "",
    sound.recommendedUses,
    sound.avoidUses,
    sound.notes,
    sound.source || "",
    sound.license || "",
    sound.audioRelativePath || "",
  ]
    .join(" ")
    .toLowerCase();
}

function matchesSoundLibrarySearch(sound: SoundLibraryEntry, tokens: string[]) {
  if (tokens.length === 0) return true;
  const haystack = buildSoundLibrarySearchHaystack(sound);
  return tokens.every((token) => haystack.includes(token));
}

async function parseResponse(response: Response) {
  const payload = (await response.json().catch(() => ({}))) as SettingsResponse;
  if (!response.ok || payload.success === false || !payload.data) {
    throw new Error(
      payload.error || "Failed to load short-form workflow settings",
    );
  }
  return payload.data;
}

async function parseStyleTestResponse(response: Response) {
  const payload = (await response
    .json()
    .catch(() => ({}))) as StyleTestResponse;
  if (!response.ok || payload.success === false || !payload.data) {
    throw new Error(payload.error || "Failed to generate style test image");
  }
  return payload.data;
}

async function parseMotionGraphicPreviewResponse(response: Response) {
  const payload = (await response
    .json()
    .catch(() => ({}))) as MotionGraphicPreviewResponse;
  if (!response.ok || payload.success === false || !payload.data) {
    throw new Error(payload.error || "Failed to render motion graphics preview");
  }
  return payload.data;
}

async function parseTtsPreviewResponse(response: Response) {
  const payload = (await response
    .json()
    .catch(() => ({}))) as TtsPreviewResponse;
  if (!response.ok || payload.success === false || !payload.data) {
    throw new Error(payload.error || "Failed to generate saved voice sample");
  }
  return payload.data;
}

function hasSavedVoiceSample(voice: VoiceLibraryEntry | null | undefined) {
  if (!voice?.referenceAudioRelativePath || !voice.referenceText) return false;
  if (voice.sourceType === "uploaded-reference") return true;
  if (!voice.referencePrompt || !voice.referenceMode) return false;
  if (
    voice.referencePrompt !== voice.voiceDesignPrompt ||
    voice.referenceMode !== voice.mode
  )
    return false;
  if (voice.mode === "custom-voice" && voice.referenceSpeaker !== voice.speaker)
    return false;
  return true;
}

function buildSavedVoiceAudioUrl(
  voice: VoiceLibraryEntry | null | undefined,
  cacheBust?: number,
) {
  if (!voice?.referenceAudioRelativePath) return null;
  const encodedPath = voice.referenceAudioRelativePath
    .split("/")
    .filter(Boolean)
    .map((part) => encodeURIComponent(part))
    .join("/");
  const query = cacheBust ? `?v=${cacheBust}` : "";
  return `/api/short-form-videos/settings/voice-library-files/${encodedPath}${query}`;
}

function getVoiceSourceLabel(voice: VoiceLibraryEntry | null | undefined) {
  return voice?.sourceType === "uploaded-reference"
    ? "Uploaded reference"
    : voice?.mode === "custom-voice"
      ? "Legacy custom voice"
      : "Generated VoiceDesign";
}

async function parseMusicPreviewResponse(response: Response) {
  const payload = (await response
    .json()
    .catch(() => ({}))) as MusicPreviewResponse;
  if (!response.ok || payload.success === false || !payload.data) {
    throw new Error(
      payload.error || "Failed to generate saved soundtrack file",
    );
  }
  return payload.data;
}

function hasGeneratedSoundtrack(track: MusicLibraryEntry | null | undefined) {
  if (!track?.generatedAudioRelativePath) return false;
  const expectedDuration = track.previewDurationSeconds || 12;
  return (
    track.generatedPrompt === track.prompt &&
    track.generatedDurationSeconds === expectedDuration
  );
}

function getMusicSourceType(track: MusicLibraryEntry | null | undefined): MusicSourceType {
  if (track?.sourceType === "imported") return "imported";
  if (track?.sourceType === "ai-generated") return "ai-generated";
  return track?.source || track?.license || track?.creator || track?.originalFileName
    ? "imported"
    : "ai-generated";
}

function getMusicTrackReadiness(track: MusicLibraryEntry) {
  if (!track.generatedAudioRelativePath) return "missing audio";
  if (
    !track.mood &&
    !track.energy &&
    !track.pacing &&
    !track.tags?.length &&
    !track.recommendedSections?.length &&
    !track.bestSceneTypes?.length
  ) {
    return "needs metadata";
  }
  return "ready";
}

function getSoundReadiness(sound: SoundLibraryEntry) {
  if (!sound.audioRelativePath) return "missing audio";
  if (
    !sound.tags.length &&
    !sound.stylePalettes?.length &&
    !sound.layerRoles?.length &&
    !sound.recommendedUses.trim()
  ) {
    return "needs metadata";
  }
  return "ready";
}

function isReadyAudioAsset(readiness: string) {
  return readiness === "ready";
}

function buildSavedMusicAudioUrl(
  track: MusicLibraryEntry | null | undefined,
  cacheBust?: number,
) {
  if (!track?.generatedAudioRelativePath) return null;
  const encodedPath = track.generatedAudioRelativePath
    .split("/")
    .filter(Boolean)
    .map((part) => encodeURIComponent(part))
    .join("/");
  const query = cacheBust ? `?v=${cacheBust}` : "";
  return `/api/short-form-videos/settings/music-library-files/${encodedPath}${query}`;
}

function buildSavedSoundAudioUrl(
  sound: SoundLibraryEntry | null | undefined,
  cacheBust?: number,
) {
  if (!sound?.audioRelativePath) return null;
  const encodedPath = sound.audioRelativePath
    .split("/")
    .filter(Boolean)
    .map((part) => encodeURIComponent(part))
    .join("/");
  const query = cacheBust ? `?v=${cacheBust}` : "";
  return `/api/short-form-videos/settings/sound-library-files/${encodedPath}${query}`;
}

function clampNumber(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function formatSecondsLabel(value?: number) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "0.00s";
  if (value >= 60) {
    const minutes = Math.floor(value / 60);
    const seconds = value - minutes * 60;
    return `${minutes}:${seconds.toFixed(2).padStart(5, "0")}`;
  }
  return `${value < 1 ? value.toFixed(3) : value.toFixed(2)}s`;
}

function snapWaveformRatio(
  rawRatio: number,
  peaks: number[],
  searchRadius: number,
) {
  const maxIndex = peaks.length - 1;
  if (maxIndex <= 0) return clampNumber(rawRatio, 0, 1);

  const targetIndex = clampNumber(rawRatio * maxIndex, 0, maxIndex);
  let bestIndex = Math.round(targetIndex);
  let bestScore = -Infinity;

  for (let offset = -searchRadius; offset <= searchRadius; offset += 1) {
    const candidateIndex = clampNumber(
      Math.round(targetIndex + offset),
      0,
      maxIndex,
    );
    const peak = peaks[candidateIndex] ?? 0;
    const distance = Math.abs(candidateIndex - targetIndex);
    const score = peak * 1.25 - distance * 0.16;
    if (score > bestScore) {
      bestScore = score;
      bestIndex = candidateIndex;
    }
  }

  return bestIndex / maxIndex;
}

function WaveformPreview({
  peaks,
  anchorRatio,
  durationSeconds,
  timingType,
  currentTimeSeconds,
  onSeekAudio,
  onAnchorChange,
}: {
  peaks?: number[];
  anchorRatio?: number;
  durationSeconds?: number;
  timingType?: SoundLibraryEntry["timingType"];
  currentTimeSeconds?: number;
  onSeekAudio?: (seconds: number) => void;
  onAnchorChange?: (ratio: number) => void;
}) {
  const activePointerScopeRef = useRef<"overview" | "detail" | null>(null);
  const safeRatio = clampNumber(
    typeof anchorRatio === "number" && Number.isFinite(anchorRatio)
      ? anchorRatio
      : 0,
    0,
    1,
  );
  const hasRealWaveform = Boolean(peaks && peaks.length > 0);
  const bars = hasRealWaveform
    ? peaks!.slice(0, 240)
    : Array.from({ length: 240 }, () => 0.18);
  const maxBarIndex = Math.max(1, bars.length - 1);
  const anchorIndex = Math.round(safeRatio * maxBarIndex);
  const anchorSeconds =
    typeof durationSeconds === "number" && Number.isFinite(durationSeconds)
      ? clampNumber(durationSeconds * safeRatio, 0, durationSeconds)
      : undefined;
  const playheadRatio =
    typeof durationSeconds === "number" &&
    durationSeconds > 0 &&
    typeof currentTimeSeconds === "number" &&
    Number.isFinite(currentTimeSeconds)
      ? clampNumber(currentTimeSeconds / durationSeconds, 0, 1)
      : undefined;
  const playheadIndex =
    typeof playheadRatio === "number"
      ? Math.round(playheadRatio * maxBarIndex)
      : null;
  const detailBarCount = Math.min(40, bars.length);
  const detailStartIndex = clampNumber(
    anchorIndex - Math.floor(detailBarCount / 2),
    0,
    Math.max(0, bars.length - detailBarCount),
  );
  const detailBars = bars.slice(
    detailStartIndex,
    detailStartIndex + detailBarCount,
  );
  const fineNudgeRatio =
    typeof durationSeconds === "number" && durationSeconds > 0
      ? 0.005 / durationSeconds
      : 0.005;
  const coarseNudgeRatio =
    typeof durationSeconds === "number" && durationSeconds > 0
      ? 0.025 / durationSeconds
      : 0.025;

  function commitAnchor(nextRatio: number, scope: "overview" | "detail") {
    if (!onAnchorChange) return;
    const clamped = clampNumber(nextRatio, 0, 1);
    const snapped =
      hasRealWaveform && timingType === "point"
        ? snapWaveformRatio(clamped, bars, scope === "detail" ? 2 : 5)
        : clamped;
    onAnchorChange(Number(snapped.toFixed(3)));
  }

  function resolvePointerRatio(
    event: React.PointerEvent<HTMLButtonElement>,
    scope: "overview" | "detail",
  ) {
    const rect = event.currentTarget.getBoundingClientRect();
    if (rect.width <= 0) return null;
    const pointerRatio = clampNumber(
      (event.clientX - rect.left) / rect.width,
      0,
      1,
    );
    if (scope === "overview" || detailBars.length <= 1) {
      return pointerRatio;
    }
    return (
      (detailStartIndex + pointerRatio * (detailBars.length - 1)) / maxBarIndex
    );
  }

  function handlePointerDown(scope: "overview" | "detail") {
    return (event: React.PointerEvent<HTMLButtonElement>) => {
      if (!onAnchorChange) return;
      activePointerScopeRef.current = scope;
      event.currentTarget.setPointerCapture(event.pointerId);
      const nextRatio = resolvePointerRatio(event, scope);
      if (nextRatio !== null) {
        commitAnchor(nextRatio, scope);
      }
    };
  }

  function handlePointerMove(scope: "overview" | "detail") {
    return (event: React.PointerEvent<HTMLButtonElement>) => {
      if (
        !onAnchorChange ||
        activePointerScopeRef.current !== scope ||
        (event.buttons & 1) === 0
      )
        return;
      const nextRatio = resolvePointerRatio(event, scope);
      if (nextRatio !== null) {
        commitAnchor(nextRatio, scope);
      }
    };
  }

  function handlePointerUp(scope: "overview" | "detail") {
    return (event: React.PointerEvent<HTMLButtonElement>) => {
      if (activePointerScopeRef.current === scope) {
        activePointerScopeRef.current = null;
      }
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
    };
  }

  function renderWaveformTrack(
    trackBars: number[],
    scope: "overview" | "detail",
    startIndex: number,
    label: string,
    helper: string,
    heightClassName: string,
  ) {
    const trackIndexCount = Math.max(1, trackBars.length - 1);
    const anchorLeft = clampNumber(
      (anchorIndex - startIndex) / trackIndexCount,
      0,
      1,
    );
    const playheadLeft =
      playheadIndex === null
        ? null
        : clampNumber((playheadIndex - startIndex) / trackIndexCount, 0, 1);

    return (
      <div className="space-y-1.5">
        <div className="flex items-center justify-between gap-2 text-[11px] uppercase tracking-wide text-muted-foreground">
          <span>{label}</span>
          <span className="normal-case tracking-normal">{helper}</span>
        </div>
        <button
          type="button"
          onPointerDown={handlePointerDown(scope)}
          onPointerMove={handlePointerMove(scope)}
          onPointerUp={handlePointerUp(scope)}
          onPointerCancel={handlePointerUp(scope)}
          className={`relative flex w-full touch-none select-none items-end gap-px overflow-hidden rounded-lg border px-2 py-2 text-left ${heightClassName} ${onAnchorChange ? "cursor-ew-resize border-cyan-400/30 bg-background/80 hover:border-cyan-300/50" : "border-border bg-background/70"}`}
        >
          {trackBars.map((peak, index) => (
            <div
              key={`${scope}-${startIndex + index}-${peak}`}
              className="flex-1 rounded-sm bg-cyan-400/70"
              style={{
                height: `${Math.max(scope === "detail" ? 14 : 8, Math.round(Math.max(0.05, peak) * 100))}%`,
              }}
            />
          ))}
          {playheadLeft !== null ? (
            <div
              className="pointer-events-none absolute inset-y-1 w-px bg-fuchsia-300/80"
              style={{ left: `calc(${playheadLeft * 100}% - 0.5px)` }}
            />
          ) : null}
          {onAnchorChange ? (
            <>
              <div
                className="pointer-events-none absolute inset-y-1 w-0.5 bg-amber-300"
                style={{ left: `calc(${anchorLeft * 100}% - 1px)` }}
              />
              <div
                className="pointer-events-none absolute top-1 -translate-x-1/2 rounded bg-amber-300/20 px-2 py-0.5 text-[10px] font-medium text-amber-100"
                style={{ left: `${anchorLeft * 100}%` }}
              >
                Anchor
              </div>
            </>
          ) : null}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {renderWaveformTrack(
        bars,
        "overview",
        0,
        "Overview",
        hasRealWaveform && timingType === "point"
          ? "Drag anywhere, point sounds snap to nearby peaks."
          : "Drag or click to place the source sync point.",
        "h-20",
      )}
      {hasRealWaveform
        ? renderWaveformTrack(
            detailBars,
            "detail",
            detailStartIndex,
            "Fine trim",
            "Zoomed around the current sync point for tighter placement.",
            "h-24",
          )
        : null}
      {onAnchorChange ? (
        <div className="space-y-2 rounded-lg border border-border/70 bg-background/50 p-3 text-xs text-muted-foreground">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span>
              Anchor position:{" "}
              <span className="font-medium text-foreground">
                {Math.round(safeRatio * 100)}%
              </span>
              {typeof anchorSeconds === "number" ? (
                <span> ({formatSecondsLabel(anchorSeconds)})</span>
              ) : null}
              {typeof playheadRatio === "number" ? (
                <span>
                  {" "}
                  · playhead {formatSecondsLabel(currentTimeSeconds)}
                </span>
              ) : null}
            </span>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() =>
                  commitAnchor(safeRatio - coarseNudgeRatio, "detail")
                }
              >
                -25ms
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() =>
                  commitAnchor(safeRatio - fineNudgeRatio, "detail")
                }
              >
                -5ms
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() =>
                  commitAnchor(safeRatio + fineNudgeRatio, "detail")
                }
              >
                +5ms
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() =>
                  commitAnchor(safeRatio + coarseNudgeRatio, "detail")
                }
              >
                +25ms
              </Button>
              {typeof durationSeconds === "number" && durationSeconds > 0 ? (
                <Input
                  type="number"
                  min={0}
                  max={durationSeconds}
                  step={0.01}
                  value={
                    typeof anchorSeconds === "number"
                      ? anchorSeconds.toFixed(3)
                      : ""
                  }
                  onChange={(event) => {
                    const nextSeconds = Number(event.target.value);
                    if (!Number.isFinite(nextSeconds)) return;
                    commitAnchor(nextSeconds / durationSeconds, "detail");
                  }}
                  className="h-8 w-24 text-xs"
                />
              ) : null}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => commitAnchor(0, "overview")}
            >
              Start
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => commitAnchor(0.5, "overview")}
            >
              Middle
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => commitAnchor(1, "overview")}
            >
              End
            </Button>
            {typeof playheadRatio === "number" ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => commitAnchor(playheadRatio, "detail")}
              >
                Set from playhead
              </Button>
            ) : null}
            {typeof anchorSeconds === "number" && onSeekAudio ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => onSeekAudio(anchorSeconds)}
              >
                Preview sync point
              </Button>
            ) : null}
          </div>
        </div>
      ) : null}
      {!hasRealWaveform ? (
        <div className="text-xs text-muted-foreground">
          Waveform peaks are unavailable for this asset, so the editor is
          showing a simplified placeholder track.
        </div>
      ) : null}
    </div>
  );
}

function SectionActions({
  dirty,
  saving,
  saveLabel,
  resetLabel = "Reset",
  onSave,
  onReset,
}: {
  dirty: boolean;
  saving: boolean;
  saveLabel: string;
  resetLabel?: string;
  onSave: () => void;
  onReset: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span
        className={`rounded-full border px-2.5 py-1 text-[11px] uppercase tracking-wide ${
          dirty
            ? "border-amber-500/30 bg-amber-500/10 text-amber-100"
            : "border-emerald-500/30 bg-emerald-500/10 text-emerald-100"
        }`}
      >
        {dirty ? "Unsaved changes" : "Saved"}
      </span>
      <Button
        variant="outline"
        size="sm"
        onClick={onReset}
        disabled={!dirty || saving}
      >
        {resetLabel}
      </Button>
      <Button size="sm" onClick={onSave} disabled={!dirty || saving}>
        {saving ? "Saving…" : saveLabel}
      </Button>
    </div>
  );
}

function AudioClipKindBadge({
  leftLabel,
  rightLabel,
}: {
  leftLabel: string;
  rightLabel: string;
}) {
  return (
    <span className="inline-flex overflow-hidden rounded-md border border-sky-400/30 bg-sky-500/10 text-[11px] font-semibold text-sky-100">
      <span className="px-2 py-0.5">{leftLabel}</span>
      <span className="border-l border-sky-300/25 px-2 py-0.5 text-sky-200">
        {rightLabel}
      </span>
    </span>
  );
}

function SectionFeedbackNotice({ feedback }: { feedback: SectionFeedback }) {
  if (feedback.error) {
    return (
      <ValidationNotice
        title="Section save failed"
        message={feedback.error}
        className="mt-4"
      />
    );
  }
  if (feedback.message) {
    return (
      <div className="mt-4 rounded-lg border border-emerald-500/25 bg-emerald-500/10 p-3 text-sm text-emerald-100">
        {feedback.message}
      </div>
    );
  }
  return null;
}

function roundToStep(value: number, step: number) {
  if (!Number.isFinite(value)) return value;
  if (!Number.isFinite(step) || step <= 0) return value;
  const decimals = String(step).includes(".")
    ? String(step).split(".")[1]!.length
    : 0;
  const rounded = Math.round(value / step) * step;
  return Number(rounded.toFixed(decimals));
}

function formatNumericDraft(value: number, step: number) {
  if (!Number.isFinite(value)) return "";
  const decimals = String(step).includes(".")
    ? String(step).split(".")[1]!.length
    : 0;
  if (decimals === 0) return String(Math.round(value));
  return value
    .toFixed(decimals)
    .replace(/\.0+$/, "")
    .replace(/(\.\d*?)0+$/, "$1");
}

function buildUniqueCaptionStyleName(
  styles: CaptionStyleEntry[],
  sourceName: string,
) {
  const normalized = new Set(
    styles.map((style) => style.name.trim().toLowerCase()),
  );
  const base = `${sourceName.trim() || "Caption style"} copy`;
  let candidate = base;
  let suffix = 2;
  while (normalized.has(candidate.toLowerCase())) {
    candidate = `${base} ${suffix}`;
    suffix += 1;
  }
  return candidate;
}

function buildUniqueCaptionStyleId(styles: CaptionStyleEntry[], name: string) {
  const used = new Set(styles.map((style) => style.id));
  const base = slugify(name) || "caption-style";
  let candidate = `${base}-${Date.now()}`;
  let suffix = 2;
  while (used.has(candidate)) {
    candidate = `${base}-${Date.now()}-${suffix}`;
    suffix += 1;
  }
  return candidate;
}

function CaptionStyleNumberField({
  label,
  value,
  min,
  max,
  step = 1,
  helper,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  helper?: string;
  onChange: (value: number) => void;
}) {
  const [draft, setDraft] = useState(() => formatNumericDraft(value, step));

  useEffect(() => {
    setDraft(formatNumericDraft(value, step));
  }, [step, value]);

  const commit = (raw: string) => {
    const nextRaw = raw.trim();
    if (!nextRaw || nextRaw === "-" || nextRaw === "." || nextRaw === "-.") {
      setDraft(formatNumericDraft(value, step));
      return;
    }
    const parsed = Number(nextRaw.replace(",", "."));
    if (!Number.isFinite(parsed)) {
      setDraft(formatNumericDraft(value, step));
      return;
    }
    const nextValue = Math.max(min, Math.min(max, roundToStep(parsed, step)));
    onChange(nextValue);
    setDraft(formatNumericDraft(nextValue, step));
  };

  const nudge = (direction: -1 | 1) => {
    const nextValue = Math.max(
      min,
      Math.min(max, roundToStep(value + direction * step, step)),
    );
    onChange(nextValue);
    setDraft(formatNumericDraft(nextValue, step));
  };

  return (
    <div className="space-y-2 rounded-lg border border-border bg-background/40 p-3">
      <div className="flex items-center justify-between gap-3">
        <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </label>
        <span className="text-xs font-medium text-foreground">
          {formatNumericDraft(value, step)}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          className="h-12 w-12 shrink-0 px-0 text-lg"
          onClick={() => nudge(-1)}
        >
          −
        </Button>
        <Input
          type="text"
          inputMode={step < 1 || min < 0 ? "decimal" : "numeric"}
          enterKeyHint="done"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={(event) => commit(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              commit(draft);
            }
          }}
          className="h-12 text-center text-base"
          aria-label={label}
        />
        <Button
          type="button"
          variant="outline"
          className="h-12 w-12 shrink-0 px-0 text-lg"
          onClick={() => nudge(1)}
        >
          +
        </Button>
      </div>
      {helper ? (
        <p className="text-xs text-muted-foreground">{helper}</p>
      ) : null}
    </div>
  );
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function motionArgText(value: unknown) {
  return typeof value === "string" ? value : value == null ? "" : String(value);
}

function motionArgArray(value: unknown) {
  return Array.isArray(value) ? value : [];
}

function parseOptionalMotionNumber(value: string) {
  if (!value.trim()) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function motionFieldTypeLabel(type: MotionGraphicFieldType) {
  switch (type) {
    case "captionWordWallLines":
      return "array · caption lines";
    case "dataSeries":
      return "array · data rows";
    case "indicatorType":
      return "good/bad selector";
    case "stringList":
      return "array · text items";
    case "timelineSteps":
      return "array · step objects";
    default:
      return type;
  }
}

function isArrayMotionField(type: MotionGraphicFieldType) {
  return (
    type === "captionWordWallLines" ||
    type === "dataSeries" ||
    type === "stringList" ||
    type === "timelineSteps"
  );
}

interface MotionFieldParameter {
  name: string;
  label: string;
  valueType: string;
  required?: boolean;
  timing?: boolean;
  options?: string[];
}

function getMotionFieldParameters(
  field: MotionGraphicTemplateField,
  timingControllable: boolean,
): MotionFieldParameter[] {
  switch (field.type) {
    case "dataSeries":
      return [
        { name: "label", label: "Label", valueType: "text", required: true },
        { name: "value", label: "Value", valueType: "number", required: true },
        { name: "displayValue", label: "Display value", valueType: "text" },
        { name: "animateIn", label: "Animate in", valueType: "timestamp", timing: true },
      ];
    case "timelineSteps":
      return [
        { name: "label", label: "Label", valueType: "text" },
        { name: "text", label: "Text", valueType: "text", required: true },
        { name: "animateIn", label: "Animate in", valueType: "timestamp", timing: true },
      ];
    case "captionWordWallLines":
      return [
        { name: "text", label: "Line text", valueType: "text" },
        {
          name: "size",
          label: "Line size",
          valueType: "option",
          options: ["regular", "large", "extra_large"],
        },
        { name: "blank", label: "Blank spacer", valueType: "boolean" },
        { name: "emphasized", label: "Emphasized", valueType: "boolean" },
        { name: "animateIn", label: "Animate in", valueType: "timestamp", timing: true },
      ];
    case "stringList":
      return [{ name: "item", label: "Text item", valueType: "text", required: true }];
    case "indicatorType":
      return [
        {
          name: field.name,
          label: field.label,
          valueType: "option",
          required: field.required,
          timing: timingControllable,
          options: ["good", "bad"],
        },
      ];
    default:
      return [
        {
          name: field.name,
          label: field.label,
          valueType: field.type === "number" ? "number" : "text",
          required: field.required,
          timing: timingControllable,
        },
      ];
  }
}

function motionFieldShapeLabel(field: MotionGraphicTemplateField) {
  if (field.type === "dataSeries") return "Array of data row objects";
  if (field.type === "timelineSteps") return "Array of step objects";
  if (field.type === "captionWordWallLines") return "Array of caption line objects";
  if (field.type === "stringList") return "Array of text values";
  return "Single value";
}

function MotionArgTextInput({
  label,
  description,
  value,
  textarea = false,
  onChange,
}: {
  label: string;
  description?: string;
  value: unknown;
  textarea?: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <div className="space-y-2">
      <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </label>
      {description ? (
        <p className="text-xs text-muted-foreground">{description}</p>
      ) : null}
      {textarea ? (
        <Textarea
          value={motionArgText(value)}
          onChange={(event) => onChange(event.target.value)}
        />
      ) : (
        <Input
          value={motionArgText(value)}
          onChange={(event) => onChange(event.target.value)}
        />
      )}
    </div>
  );
}

function MotionArgNumberInput({
  label,
  description,
  value,
  onChange,
}: {
  label: string;
  description?: string;
  value: unknown;
  onChange: (value: number) => void;
}) {
  return (
    <div className="space-y-2">
      <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </label>
      {description ? (
        <p className="text-xs text-muted-foreground">{description}</p>
      ) : null}
      <Input
        type="number"
        value={motionArgText(value)}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </div>
  );
}

function motionFieldLabel(field: MotionGraphicTemplateField) {
  return `${field.label}${field.required ? "" : " (optional)"}`;
}

function MotionFieldHeading({ field }: { field: MotionGraphicTemplateField }) {
  return (
    <div className="space-y-1">
      <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {motionFieldLabel(field)}
      </label>
      {field.description ? (
        <p className="text-xs text-muted-foreground">{field.description}</p>
      ) : null}
    </div>
  );
}

function MotionRemoveRowButton({
  label,
  onClick,
}: {
  label: string;
  onClick: () => void;
}) {
  return (
    <Button
      type="button"
      variant="destructive"
      size="icon"
      className="h-8 w-8"
      aria-label={label}
      title={label}
      onClick={onClick}
    >
      <Trash2 className="h-4 w-4" aria-hidden="true" />
    </Button>
  );
}

function MotionPreviewValuesEditor({
  template,
  onChangeArg,
  onChangePreviewDuration,
}: {
  template: MotionGraphicTemplateConfig;
  onChangeArg: (name: string, value: unknown) => void;
  onChangePreviewDuration: (value: number) => void;
}) {
  const fieldNames = new Set(template.fields.map((field) => field.name));
  const extraArgs = Object.entries(template.previewArgs).filter(
    ([name]) => !fieldNames.has(name) && name !== "animationTimings",
  );
  const animationTimings = isPlainRecord(template.previewArgs.animationTimings)
    ? template.previewArgs.animationTimings
    : {};
  const timingTargets = getMotionGraphicTimingControlConfig(template.rendererId)
    .controls
    .filter((target) => /^[a-zA-Z0-9_-]+$/.test(target));

  function updateAnimationTiming(target: string, value: number | undefined) {
    const nextTimings = { ...animationTimings };
    if (value === undefined) {
      delete nextTimings[target];
    } else {
      nextTimings[target] = value;
    }
    onChangeArg("animationTimings", nextTimings);
  }

  const renderField = (field: MotionGraphicTemplateField) => {
    const value =
      template.previewArgs[field.name] !== undefined
        ? template.previewArgs[field.name]
        : "";
    const updateArrayItem = (
      index: number,
      patch: Record<string, unknown>,
      fallback: Record<string, unknown>,
    ) => {
      const current = motionArgArray(value);
      const next = current.map((item, itemIndex) =>
        itemIndex === index
          ? { ...fallback, ...(isPlainRecord(item) ? item : {}), ...patch }
          : item,
      );
      onChangeArg(field.name, next);
    };
    const removeArrayItem = (index: number) => {
      onChangeArg(
        field.name,
        motionArgArray(value).filter((_, itemIndex) => itemIndex !== index),
      );
    };

    if (field.type === "textarea") {
      return (
        <MotionArgTextInput
          key={field.name}
          label={motionFieldLabel(field)}
          description={field.description}
          value={value}
          textarea
          onChange={(next) => onChangeArg(field.name, next)}
        />
      );
    }
    if (field.type === "number") {
      return (
        <MotionArgNumberInput
          key={field.name}
          label={motionFieldLabel(field)}
          description={field.description}
          value={value}
          onChange={(next) => onChangeArg(field.name, next)}
        />
      );
    }
    if (field.type === "indicatorType") {
      return (
        <div key={field.name} className="space-y-2">
          <MotionFieldHeading field={field} />
          <Select
            value={motionArgText(value) || "good"}
            onChange={(event) => onChangeArg(field.name, event.target.value)}
          >
            <option value="good">Good</option>
            <option value="bad">Bad</option>
          </Select>
        </div>
      );
    }
    if (field.type === "stringList") {
      const rows = motionArgArray(value).map((item) => motionArgText(item));
      return (
        <div key={field.name} className="space-y-2">
          <MotionFieldHeading field={field} />
          <div className="space-y-2">
            {rows.map((item, index) => (
              <div key={index} className="flex gap-2">
                <Input
                  value={item}
                  onChange={(event) => {
                    const next = [...rows];
                    next[index] = event.target.value;
                    onChangeArg(field.name, next);
                  }}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => removeArrayItem(index)}
                >
                  Remove
                </Button>
              </div>
            ))}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onChangeArg(field.name, [...rows, ""])}
            >
              Add item
            </Button>
          </div>
        </div>
      );
    }
    if (field.type === "dataSeries") {
      const rows = motionArgArray(value);
      return (
        <div key={field.name} className="space-y-3">
          <MotionFieldHeading field={field} />
          <div className="overflow-x-auto rounded-md border border-border bg-background/50">
            <table className="w-full min-w-[42rem] text-left text-sm">
              <thead className="border-b border-border text-xs font-medium uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-3 py-2">Label</th>
                  <th className="w-28 px-3 py-2">Value</th>
                  <th className="px-3 py-2">Display value</th>
                  <th className="w-28 px-3 py-2">Animate in</th>
                  <th className="w-12 px-3 py-2" aria-label="Actions" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.map((item, index) => {
                  const row = isPlainRecord(item) ? item : {};
                  return (
                    <tr key={index}>
                      <td className="px-3 py-2">
                        <Input
                          value={motionArgText(row.label)}
                          placeholder="Label"
                          onChange={(event) =>
                            updateArrayItem(index, { label: event.target.value }, {})
                          }
                        />
                      </td>
                      <td className="px-3 py-2">
                        <Input
                          type="number"
                          value={motionArgText(row.value)}
                          placeholder="Value"
                          onChange={(event) =>
                            updateArrayItem(index, { value: Number(event.target.value) }, {})
                          }
                        />
                      </td>
                      <td className="px-3 py-2">
                        <Input
                          value={motionArgText(row.displayValue)}
                          placeholder="Display value"
                          onChange={(event) =>
                            updateArrayItem(index, { displayValue: event.target.value }, {})
                          }
                        />
                      </td>
                      <td className="px-3 py-2">
                        <Input
                          type="number"
                          step="0.01"
                          value={motionArgText(row.animateIn)}
                          placeholder="Animate in"
                          onChange={(event) =>
                            updateArrayItem(index, { animateIn: parseOptionalMotionNumber(event.target.value) }, {})
                          }
                        />
                      </td>
                      <td className="px-3 py-2">
                        <MotionRemoveRowButton
                          label={`Remove ${field.label} row ${index + 1}`}
                          onClick={() => removeArrayItem(index)}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() =>
                onChangeArg(field.name, [
                  ...rows,
                  { label: "New", value: 0, displayValue: "0" },
                ])
              }
            >
              Add row
            </Button>
          </div>
        </div>
      );
    }
    if (field.type === "timelineSteps") {
      const rows = motionArgArray(value);
      return (
        <div key={field.name} className="space-y-3">
          <MotionFieldHeading field={field} />
          <div className="overflow-x-auto rounded-md border border-border bg-background/50">
            <table className="w-full min-w-[34rem] text-left text-sm">
              <thead className="border-b border-border text-xs font-medium uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="w-36 px-3 py-2">Label</th>
                  <th className="px-3 py-2">Text</th>
                  <th className="w-28 px-3 py-2">Animate in</th>
                  <th className="w-12 px-3 py-2" aria-label="Actions" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.map((item, index) => {
                  const row = isPlainRecord(item) ? item : { text: motionArgText(item) };
                  return (
                    <tr key={index}>
                      <td className="px-3 py-2">
                        <Input
                          value={motionArgText(row.label)}
                          placeholder="Label"
                          onChange={(event) =>
                            updateArrayItem(index, { label: event.target.value }, {})
                          }
                        />
                      </td>
                      <td className="px-3 py-2">
                        <Input
                          value={motionArgText(row.text)}
                          placeholder="Text"
                          onChange={(event) =>
                            updateArrayItem(index, { text: event.target.value }, {})
                          }
                        />
                      </td>
                      <td className="px-3 py-2">
                        <Input
                          type="number"
                          step="0.01"
                          value={motionArgText(row.animateIn)}
                          placeholder="Animate in"
                          onChange={(event) =>
                            updateArrayItem(index, { animateIn: parseOptionalMotionNumber(event.target.value) }, {})
                          }
                        />
                      </td>
                      <td className="px-3 py-2">
                        <MotionRemoveRowButton
                          label={`Remove ${field.label} row ${index + 1}`}
                          onClick={() => removeArrayItem(index)}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() =>
                onChangeArg(field.name, [...rows, { label: "", text: "" }])
              }
            >
              Add step
            </Button>
          </div>
        </div>
      );
    }
    if (field.type === "captionWordWallLines") {
      const rows = motionArgArray(value);
      return (
        <div key={field.name} className="space-y-3">
          <MotionFieldHeading field={field} />
          <div className="overflow-x-auto rounded-md border border-border bg-background/50">
            <table className="w-full min-w-[44rem] text-left text-sm">
              <thead className="border-b border-border text-xs font-medium uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-3 py-2">Line text</th>
                  <th className="w-36 px-3 py-2">Size</th>
                  <th className="w-28 px-3 py-2">Animate in</th>
                  <th className="w-24 px-3 py-2">Blank</th>
                  <th className="w-28 px-3 py-2">Emphasized</th>
                  <th className="w-12 px-3 py-2" aria-label="Actions" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.map((item, index) => {
                  const row = isPlainRecord(item) ? item : { text: motionArgText(item) };
                  const blank = Boolean(row.blank);
                  return (
                    <tr key={index}>
                      <td className="px-3 py-2">
                        <Input
                          value={motionArgText(row.text)}
                          placeholder="Line text"
                          disabled={blank}
                          onChange={(event) =>
                            updateArrayItem(index, { text: event.target.value, blank: false }, {})
                          }
                        />
                      </td>
                      <td className="px-3 py-2">
                        <Select
                          value={motionArgText(row.size) || "regular"}
                          disabled={blank}
                          onChange={(event) =>
                            updateArrayItem(index, { size: event.target.value }, {})
                          }
                        >
                          <option value="regular">Regular</option>
                          <option value="large">Large</option>
                          <option value="extra_large">Extra large</option>
                        </Select>
                      </td>
                      <td className="px-3 py-2">
                        <Input
                          type="number"
                          step="0.01"
                          value={motionArgText(row.animateIn)}
                          placeholder="Animate in"
                          onChange={(event) =>
                            updateArrayItem(index, { animateIn: parseOptionalMotionNumber(event.target.value) }, {})
                          }
                        />
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="checkbox"
                          checked={blank}
                          aria-label={`Blank spacer line ${index + 1}`}
                          onChange={(event) =>
                            updateArrayItem(
                              index,
                              event.target.checked
                                ? { blank: true, text: "" }
                                : { blank: false },
                              {},
                            )
                          }
                        />
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="checkbox"
                          checked={Boolean(row.emphasized)}
                          disabled={blank}
                          aria-label={`Emphasized line ${index + 1}`}
                          onChange={(event) =>
                            updateArrayItem(index, { emphasized: event.target.checked }, {})
                          }
                        />
                      </td>
                      <td className="px-3 py-2">
                        <MotionRemoveRowButton
                          label={`Remove ${field.label} row ${index + 1}`}
                          onClick={() => removeArrayItem(index)}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onChangeArg(field.name, [...rows, { text: "" }])}
            >
              Add line
            </Button>
          </div>
        </div>
      );
    }

    return (
      <MotionArgTextInput
        key={field.name}
        label={motionFieldLabel(field)}
        description={field.description}
        value={value}
        onChange={(next) => onChangeArg(field.name, next)}
      />
    );
  };

  return (
    <Card className="space-y-4 p-5">
      <div>
        <h3 className="text-sm font-medium text-foreground">Preview values</h3>
      </div>
      <div className="space-y-4">
        <div className="space-y-2">
          <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Preview duration seconds
          </label>
          <Input
            type="number"
            min={3}
            max={12}
            value={template.previewDurationSeconds}
            onChange={(event) => onChangePreviewDuration(Number(event.target.value))}
          />
          <p className="text-xs text-muted-foreground">
            Used only for this settings-page preview. Real project renders use the visual start/end times in Scribe&apos;s XML.
          </p>
        </div>
        {template.fields.map((field) => (
          <div key={field.name}>{renderField(field)}</div>
        ))}
        {extraArgs.length > 0 ? (
          <div className="grid gap-3 md:grid-cols-2">
            {extraArgs.map(([name, value]) => (
              <MotionArgTextInput
                key={name}
                label={name}
                value={value}
                onChange={(next) => onChangeArg(name, next)}
              />
            ))}
          </div>
        ) : null}
        {timingTargets.length > 0 ? (
          <div className="space-y-3 rounded-md border border-border bg-background/50 p-3">
            <div>
              <h4 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Preview animation timings
              </h4>
              <p className="mt-1 text-xs text-muted-foreground">
                Seconds from the start of this preview clip. Row-based timings are edited directly on their rows above.
              </p>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              {timingTargets.map((target) => (
                <div key={target} className="space-y-2">
                  <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    {target}
                  </label>
                  <Input
                    type="number"
                    min={0}
                    max={template.previewDurationSeconds}
                    step="0.01"
                    value={motionArgText(animationTimings[target])}
                    placeholder="Unset"
                    onChange={(event) =>
                      updateAnimationTiming(
                        target,
                        parseOptionalMotionNumber(event.target.value),
                      )
                    }
                  />
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </Card>
  );
}

function MotionConfigurableFieldsSummary({
  template,
}: {
  template: MotionGraphicTemplateConfig;
}) {
  const timingConfig = getMotionGraphicTimingControlConfig(template.rendererId);
  const timingFields = new Set(timingConfig.fields);
  const extraTargets = timingConfig.extraTargets || [];
  return (
    <Card className="space-y-3 p-5">
      <div>
        <h3 className="text-sm font-medium text-foreground">
          Configurable fields Scribe sees
        </h3>
        <p className="mt-1 text-xs text-muted-foreground">
          This is the readable field schema injected into the Plan Visuals prompt.
          Fields with timing support can receive an exact animation-in timestamp.
        </p>
      </div>
      <div className="space-y-3">
        {template.fields.map((field) => {
          const timingControllable = timingFields.has(field.name);
          const parameters = getMotionFieldParameters(field, timingControllable);
          return (
            <div
              key={field.name}
              className="space-y-3 rounded-md border border-border bg-muted/20 p-3"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-medium text-foreground">
                    {field.label}
                  </p>
                  <p className="font-mono text-xs text-muted-foreground">
                    {field.name}
                  </p>
                </div>
                <div className="flex flex-wrap gap-1">
                  <Badge variant="outline">{motionFieldTypeLabel(field.type)}</Badge>
                  {isArrayMotionField(field.type) ? (
                    <Badge variant="secondary">Array</Badge>
                  ) : null}
                  {timingControllable ? (
                    <Badge variant="success">Timing controllable</Badge>
                  ) : null}
                  {field.required ? <Badge variant="secondary">Required</Badge> : null}
                </div>
              </div>
              <div className="rounded-md border border-border/70 bg-background/50 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    {motionFieldShapeLabel(field)}
                  </p>
                  {timingControllable ? (
                    <span className="text-xs text-emerald-200">
                      Supports animateIn
                    </span>
                  ) : null}
                </div>
                <div className="mt-3 grid gap-2">
                  {parameters.map((parameter) => (
                    <div
                      key={parameter.name}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border/60 bg-muted/20 px-3 py-2"
                    >
                      <div>
                        <p className="text-sm text-foreground">{parameter.label}</p>
                        <p className="font-mono text-xs text-muted-foreground">
                          {parameter.name}
                        </p>
                      </div>
                      <div className="flex flex-wrap justify-end gap-1">
                        <Badge variant="outline">{parameter.valueType}</Badge>
                        {parameter.options?.map((option) => (
                          <Badge key={option} variant="secondary">
                            {option}
                          </Badge>
                        ))}
                        {parameter.timing ? (
                          <Badge variant="success">Timing</Badge>
                        ) : null}
                        {parameter.required ? (
                          <Badge variant="secondary">Required</Badge>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              {field.description ? (
                <p className="text-xs leading-5 text-muted-foreground">
                  {field.description}
                </p>
              ) : null}
            </div>
          );
        })}
      </div>
      {extraTargets.length > 0 ? (
        <div className="rounded-md border border-border bg-muted/20 p-3">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Additional renderer timing targets
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {extraTargets.map((target) => (
              <Badge key={target} variant="success">
                {target}
              </Badge>
            ))}
          </div>
        </div>
      ) : null}
    </Card>
  );
}

function AnimationPresetTrackEditor({
  label,
  helper,
  track,
  min,
  max,
  step = 0.01,
  onChange,
}: {
  label: string;
  helper: string;
  track: ShortFormCaptionAnimationTrack;
  min: number;
  max: number;
  step?: number;
  onChange: (track: ShortFormCaptionAnimationTrack) => void;
}) {
  const updateKeyframe = (
    index: number,
    patch: Partial<ShortFormCaptionAnimationTrack["keyframes"][number]>,
  ) => {
    onChange({
      keyframes: track.keyframes.map((frame, frameIndex) =>
        frameIndex === index ? { ...frame, ...patch } : frame,
      ),
    });
  };

  const removeKeyframe = (index: number) => {
    if (track.keyframes.length <= 2) return;
    onChange({
      keyframes: track.keyframes.filter(
        (_, frameIndex) => frameIndex !== index,
      ),
    });
  };

  const addKeyframe = () => {
    const lastFrame = track.keyframes[track.keyframes.length - 1] || {
      time: 1,
      value: 0,
      easing: "linear" as const,
    };
    onChange({
      keyframes: [
        ...track.keyframes,
        { ...lastFrame, time: 1, easing: lastFrame.easing || "linear" },
      ],
    });
  };

  return (
    <div className="space-y-3 rounded-lg border border-border bg-background/40 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h5 className="text-sm font-medium text-foreground">{label}</h5>
          <p className="mt-1 text-xs text-muted-foreground">{helper}</p>
        </div>
        <Button type="button" size="sm" variant="outline" onClick={addKeyframe}>
          Add keyframe
        </Button>
      </div>

      <div className="space-y-3">
        {track.keyframes.map((frame, index) => (
          <div
            key={`${label}-${index}-${frame.time}-${frame.value}`}
            className="grid gap-3 rounded-lg border border-border/70 bg-background/70 p-3 md:grid-cols-[repeat(3,minmax(0,1fr))_auto]"
          >
            <div className="space-y-2">
              <label className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                Time
              </label>
              <Input
                type="number"
                min={0}
                max={1}
                step={0.01}
                value={frame.time}
                onChange={(event) =>
                  updateKeyframe(index, { time: Number(event.target.value) })
                }
              />
            </div>
            <div className="space-y-2">
              <label className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                Value
              </label>
              <Input
                type="number"
                min={min}
                max={max}
                step={step}
                value={frame.value}
                onChange={(event) =>
                  updateKeyframe(index, { value: Number(event.target.value) })
                }
              />
            </div>
            <div className="space-y-2">
              <label className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                Easing
              </label>
              <Select
                value={frame.easing || "linear"}
                onChange={(event) =>
                  updateKeyframe(index, {
                    easing: event.target
                      .value as ShortFormCaptionAnimationEasing,
                  })
                }
              >
                {CAPTION_ANIMATION_EASING_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
            </div>
            <div className="flex items-end justify-end">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => removeKeyframe(index)}
                disabled={track.keyframes.length <= 2}
              >
                Remove
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function ShortFormVideoSettingsView({
  activeSection,
  initialSettings,
}: {
  activeSection: ShortFormSettingsRouteSection;
  initialSettings?: SettingsData;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const requestedStyleId = searchParams.get("style");
  const requestedMotionTemplateId = searchParams.get(
    MOTION_TEMPLATE_QUERY_PARAM,
  );
  const requestedAudioKind = parseAudioLibraryKind(
    searchParams.get(AUDIO_KIND_QUERY_PARAM),
  );
  const requestedAudioId = searchParams.get(AUDIO_ID_QUERY_PARAM);
  const requestedAudioSelection = useMemo<AudioLibraryPickerSelection | null>(
    () =>
      activeSection === "generate-sound-design" &&
      requestedAudioKind &&
      requestedAudioId
        ? { kind: requestedAudioKind, id: requestedAudioId }
        : null,
    [activeSection, requestedAudioId, requestedAudioKind],
  );
  const activeSectionRef = useRef(activeSection);
  const requestedMotionTemplateIdRef = useRef(requestedMotionTemplateId);
  const initialAudioSelection = initialSettings
    ? resolveAudioLibrarySelection({
        musicTracks: initialSettings.videoRender.musicTracks,
        soundLibrary: initialSettings.soundDesign.library,
        current: null,
        requested: requestedAudioSelection,
      })
    : null;

  const [definitions, setDefinitions] = useState<PromptDefinition[]>(
    initialSettings?.definitions || [],
  );
  const [prompts, setPrompts] = useState<Partial<Record<PromptKey, string>>>(
    initialSettings?.prompts || {},
  );
  const [initialPrompts, setInitialPrompts] = useState<
    Partial<Record<PromptKey, string>>
  >(initialSettings?.prompts || {});
  const [imageStyles, setImageStyles] = useState<ImageStyleSettings | null>(
    initialSettings?.imageStyles || null,
  );
  const [initialImageStyles, setInitialImageStyles] =
    useState<ImageStyleSettings | null>(initialSettings?.imageStyles || null);
  const [videoRender, setVideoRender] = useState<VideoRenderSettings | null>(
    initialSettings?.videoRender || null,
  );
  const [initialVideoRender, setInitialVideoRender] =
    useState<VideoRenderSettings | null>(initialSettings?.videoRender || null);
  const [textScriptSettings, setTextScriptSettings] =
    useState<TextScriptSettings | null>(initialSettings?.textScript || null);
  const [initialTextScriptSettings, setInitialTextScriptSettings] =
    useState<TextScriptSettings | null>(initialSettings?.textScript || null);
  const [xmlVisualPlanningSettings, setXmlVisualPlanningSettings] =
    useState<XmlVisualPlanningSettings | null>(initialSettings?.xmlVisualPlanning || null);
  const [
    initialXmlVisualPlanningSettings,
    setInitialXmlVisualPlanningSettings,
  ] = useState<XmlVisualPlanningSettings | null>(initialSettings?.xmlVisualPlanning || null);
  const [motionGraphicsSettings, setMotionGraphicsSettings] =
    useState<MotionGraphicsSettings | null>(initialSettings?.motionGraphics || null);
  const [initialMotionGraphicsSettings, setInitialMotionGraphicsSettings] =
    useState<MotionGraphicsSettings | null>(initialSettings?.motionGraphics || null);
  const [supportedMotionGraphicRenderers, setSupportedMotionGraphicRenderers] =
    useState<string[]>(initialSettings?.supportedMotionGraphicRenderers || []);
  const [selectedMotionTemplateId, setSelectedMotionTemplateId] =
    useState<string | null>(() =>
      initialSettings
        ? resolveMotionTemplateSelection({
            templates: initialSettings.motionGraphics.templates,
            currentId: null,
            requestedId:
              activeSection === "generate-visuals-motion-graphics"
                ? requestedMotionTemplateId
                : null,
          })
        : null,
    );
  const pendingMotionTemplateUrlIdRef = useRef<{
    templateId: string | null;
  } | null>(null);
  const selectedMotionTemplateDirtyRef = useRef(false);
  const [motionPreviewArgsJsonDraft, setMotionPreviewArgsJsonDraft] = useState("");
  const [motionFieldsJsonDraft, setMotionFieldsJsonDraft] = useState("");
  const [soundDesignSettings, setSoundDesignSettings] =
    useState<SoundDesignSettings | null>(initialSettings?.soundDesign || null);
  const [initialSoundDesignSettings, setInitialSoundDesignSettings] =
    useState<SoundDesignSettings | null>(initialSettings?.soundDesign || null);
  const [selectedStyleId, setSelectedStyleId] = useState<string | null>(
    initialSettings?.imageStyles.defaultStyleId ||
      initialSettings?.imageStyles.styles[0]?.id ||
      null,
  );
  const [selectedVoiceId, setSelectedVoiceId] = useState<string | null>(
    initialSettings?.videoRender.defaultVoiceId ||
      initialSettings?.videoRender.voices[0]?.id ||
      null,
  );
  const [selectedMusicId, setSelectedMusicId] = useState<string | null>(
    initialAudioSelection?.kind === "music"
      ? initialAudioSelection.id
      : initialSettings?.videoRender.musicTracks[0]?.id || null,
  );
  const [selectedSoundId, setSelectedSoundId] = useState<string | null>(
    initialAudioSelection?.kind === "sfx"
      ? initialAudioSelection.id
      : initialSettings?.soundDesign.library[0]?.id || null,
  );
  const [selectedAudioLibraryKind, setSelectedAudioLibraryKind] =
    useState<AudioLibrarySelectionKind>(initialAudioSelection?.kind || "sfx");
  const pendingAudioSelectionUrlRef =
    useRef<AudioLibraryPickerSelection | null>(null);
  const [audioLibraryPickerOpen, setAudioLibraryPickerOpen] = useState(false);
  const [pendingAudioLibrarySelection, setPendingAudioLibrarySelection] =
    useState<AudioLibraryPickerSelection | null>(null);
  const [audioClipNameDialogOpen, setAudioClipNameDialogOpen] = useState(false);
  const [audioClipNameDraft, setAudioClipNameDraft] = useState("");
  const [audioClipTagsDialogOpen, setAudioClipTagsDialogOpen] = useState(false);
  const [audioClipTagDrafts, setAudioClipTagDrafts] = useState<string[]>([]);
  const [audioClipNewTagDraft, setAudioClipNewTagDraft] = useState("");
  const [audioClipDeleteDialogOpen, setAudioClipDeleteDialogOpen] = useState(false);
  const [audioLibraryTypeFilter, setAudioLibraryTypeFilter] =
    useState<AudioLibraryTypeFilter>("all");
  const [soundLibrarySearchQuery, setSoundLibrarySearchQuery] = useState("");
  const [soundLibraryCategoryFilter, setSoundLibraryCategoryFilter] = useState<
    "all" | "__uncategorized__" | string
  >("all");
  const [soundLibraryFileFilter, setSoundLibraryFileFilter] = useState<
    "all" | "with-audio" | "missing-audio"
  >("all");
  const [audioLibraryAvailabilityFilter, setAudioLibraryAvailabilityFilter] =
    useState<AudioLibraryAvailabilityFilter>("all");
  const [musicMoodFilter, setMusicMoodFilter] = useState("all");
  const [musicEnergyFilter, setMusicEnergyFilter] = useState("all");
  const [selectedCaptionStyleId, setSelectedCaptionStyleId] = useState<
    string | null
  >(
    initialSettings?.videoRender.defaultCaptionStyleId ||
      initialSettings?.videoRender.captionStyles[0]?.id ||
      null,
  );
  const [selectedAnimationPresetId, setSelectedAnimationPresetId] = useState<
    string | null
  >(initialSettings?.videoRender.animationPresets[0]?.id || null);
  const [captionLibraryTab, setCaptionLibraryTab] = useState<
    "styles" | "presets"
  >("styles");
  const [animationPresetJsonDraft, setAnimationPresetJsonDraft] = useState("");
  const [loading, setLoading] = useState(!initialSettings);
  const [error, setError] = useState<string | null>(null);
  const [styleTestsById, setStyleTestsById] = useState<
    Record<string, StyleTestState>
  >({});
  const [motionTemplatePreviewsById, setMotionTemplatePreviewsById] = useState<
    Record<string, MotionGraphicPreviewState>
  >({});
  const motionTemplatePreviewsRef = useRef(motionTemplatePreviewsById);
  const motionTemplatePreviewRequestIdsRef = useRef<Record<string, number>>({});
  const [styleReferenceUploadsById, setStyleReferenceUploadsById] = useState<
    Record<string, StyleReferenceUploadState>
  >({});
  const [voiceReferenceUploadsById, setVoiceReferenceUploadsById] = useState<
    Record<string, VoiceReferenceUploadState>
  >({});
  const [soundUploadsById, setSoundUploadsById] = useState<
    Record<string, SoundUploadState>
  >({});
  const selectedSoundAudioRef = useRef<HTMLAudioElement | null>(null);
  const [selectedSoundAudioTime, setSelectedSoundAudioTime] = useState(0);
  const [sectionFeedback, setSectionFeedback] = useState<
    Record<SettingsSectionId, SectionFeedback>
  >(createEmptySectionFeedback());
  const [promptTemplateFeedback, setPromptTemplateFeedback] = useState<
    Record<PromptTemplateId, SectionFeedback>
  >(createEmptyPromptTemplateFeedback());
  const [focusedPromptTemplateId, setFocusedPromptTemplateId] =
    useState<PromptTemplateId | null>(null);
  const focusedPromptTemplateIdRef = useRef<PromptTemplateId | null>(null);
  const localSettingsDirtyRef = useRef(false);
  const [ttsPreview, setTtsPreview] = useState<TtsPreviewState>({
    isLoading: false,
    error: null,
    audioUrl: null,
    reusedExisting: null,
  });
  const [musicPreview, setMusicPreview] = useState<MusicPreviewState>({
    isLoading: false,
    error: null,
    audioUrl: null,
    reusedExisting: null,
  });

  const updateSelectedMotionTemplateInUrl = useCallback(
    (templateId: string | null) => {
      if (activeSection !== "generate-visuals-motion-graphics") return;
      const params = new URLSearchParams(searchParams.toString());
      if (templateId) {
        params.set(MOTION_TEMPLATE_QUERY_PARAM, templateId);
      } else {
        params.delete(MOTION_TEMPLATE_QUERY_PARAM);
      }
      const query = params.toString();
      const hash = typeof window === "undefined" ? "" : window.location.hash;
      const nextUrl = `${pathname}${query ? `?${query}` : ""}${hash}`;
      const currentUrl =
        typeof window === "undefined"
          ? ""
          : `${window.location.pathname}${window.location.search}${window.location.hash}`;
      if (nextUrl !== currentUrl) {
        pendingMotionTemplateUrlIdRef.current = { templateId };
        router.replace(nextUrl, { scroll: false });
      } else {
        pendingMotionTemplateUrlIdRef.current = null;
      }
    },
    [activeSection, pathname, router, searchParams],
  );

  const selectMotionTemplate = useCallback(
    (
      templateId: string | null,
      options?: { skipDirtyCheck?: boolean },
    ) => {
      if (
        !options?.skipDirtyCheck &&
        activeSectionRef.current === "generate-visuals-motion-graphics" &&
        selectedMotionTemplateDirtyRef.current
      ) {
        const confirmed = window.confirm(
          "You have unsaved changes to this motion graphics template. Discard those changes?",
        );
        if (!confirmed) return false;
      }
      setSelectedMotionTemplateId(templateId);
      updateSelectedMotionTemplateInUrl(templateId);
      return true;
    },
    [updateSelectedMotionTemplateInUrl],
  );

  const updateSelectedAudioSelectionInUrl = useCallback(
    (selection: AudioLibraryPickerSelection | null) => {
      if (activeSection !== "generate-sound-design") return;
      const params = new URLSearchParams(searchParams.toString());
      if (selection) {
        params.set(AUDIO_KIND_QUERY_PARAM, selection.kind);
        params.set(AUDIO_ID_QUERY_PARAM, selection.id);
      } else {
        params.delete(AUDIO_KIND_QUERY_PARAM);
        params.delete(AUDIO_ID_QUERY_PARAM);
      }
      const query = params.toString();
      const hash = typeof window === "undefined" ? "" : window.location.hash;
      const nextUrl = `${pathname}${query ? `?${query}` : ""}${hash}`;
      const currentUrl =
        typeof window === "undefined"
          ? ""
          : `${window.location.pathname}${window.location.search}${window.location.hash}`;
      if (nextUrl !== currentUrl) {
        pendingAudioSelectionUrlRef.current = selection;
        router.replace(nextUrl, { scroll: false });
      } else {
        pendingAudioSelectionUrlRef.current = null;
      }
    },
    [activeSection, pathname, router, searchParams],
  );

  const selectAudioSelection = useCallback(
    (selection: AudioLibraryPickerSelection | null) => {
      if (!selection) {
        setSelectedMusicId(null);
        setSelectedSoundId(null);
        updateSelectedAudioSelectionInUrl(null);
        return;
      }
      if (selection.kind === "music") {
        setSelectedMusicId(selection.id);
      } else {
        setSelectedSoundId(selection.id);
      }
      setSelectedAudioLibraryKind(selection.kind);
      updateSelectedAudioSelectionInUrl(selection);
    },
    [updateSelectedAudioSelectionInUrl],
  );

  usePageScrollRestoration(
    `short-form-video-settings:${activeSection}`,
    !loading,
  );

  useEffect(() => {
    activeSectionRef.current = activeSection;
  }, [activeSection]);

  useEffect(() => {
    requestedMotionTemplateIdRef.current = requestedMotionTemplateId;
  }, [requestedMotionTemplateId]);

  useEffect(() => {
    motionTemplatePreviewsRef.current = motionTemplatePreviewsById;
  }, [motionTemplatePreviewsById]);

  const requestMotionTemplatePreview = useCallback(
    async (
      template: MotionGraphicTemplateConfig,
      options?: { force?: boolean; signal?: AbortSignal },
    ) => {
      const previewKey = buildMotionTemplatePreviewKey(template);
      const requestId = (motionTemplatePreviewRequestIdsRef.current[template.id] || 0) + 1;
      motionTemplatePreviewRequestIdsRef.current[template.id] = requestId;
      setMotionTemplatePreviewsById((current) => ({
        ...current,
        [template.id]: {
          ...(current[template.id] || createEmptyMotionPreviewState(previewKey)),
          isLoading: true,
          error: null,
          previewKey,
          reusedExisting: null,
        },
      }));

      try {
        const data = await parseMotionGraphicPreviewResponse(
          await fetch("/api/short-form-videos/settings/motion-graphics-preview", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ template, force: options?.force }),
            signal: options?.signal,
          }),
        );
        if (motionTemplatePreviewRequestIdsRef.current[template.id] !== requestId) {
          return data;
        }
        setMotionTemplatePreviewsById((current) => ({
          ...current,
          [template.id]: {
            isLoading: false,
            error: null,
            previewKey,
            videoUrl: data.videoUrl,
            posterUrl: data.posterUrl,
            reusedExisting: data.reusedExisting,
          },
        }));
        return data;
      } catch (err) {
        if (motionTemplatePreviewRequestIdsRef.current[template.id] !== requestId) {
          return null;
        }
        if (err instanceof DOMException && err.name === "AbortError") {
          setMotionTemplatePreviewsById((current) => ({
            ...current,
            [template.id]: {
              ...(current[template.id] || createEmptyMotionPreviewState(previewKey)),
              isLoading: false,
              error: null,
              previewKey,
            },
          }));
          return null;
        }
        setMotionTemplatePreviewsById((current) => ({
          ...current,
          [template.id]: {
            ...(current[template.id] || createEmptyMotionPreviewState(previewKey)),
            isLoading: false,
            error:
              err instanceof Error
                ? err.message
                : "Failed to render motion graphics preview",
            previewKey,
          },
        }));
        return null;
      }
    },
    [],
  );

  useEffect(() => {
    if (
      activeSection !== "generate-visuals-motion-graphics" ||
      !motionGraphicsSettings ||
      !selectedMotionTemplateId
    ) {
      return;
    }

    const selectedTemplate = motionGraphicsSettings.templates.find(
      (template) => template.id === selectedMotionTemplateId,
    );
    if (!selectedTemplate) return;

    const controller = new AbortController();
    const timeout = window.setTimeout(() => {
      const previewKey = buildMotionTemplatePreviewKey(selectedTemplate);
      const currentPreview = motionTemplatePreviewsRef.current[selectedTemplate.id];
      if (
        currentPreview?.previewKey === previewKey &&
        (currentPreview.videoUrl || currentPreview.isLoading)
      ) {
        return;
      }
      void requestMotionTemplatePreview(selectedTemplate, {
        signal: controller.signal,
      });
    }, 350);

    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [activeSection, motionGraphicsSettings, requestMotionTemplatePreview, selectedMotionTemplateId]);

  useEffect(() => {
    if (activeSection !== "generate-visuals-motion-graphics" || !motionGraphicsSettings) return;

    const pendingUrlSelection = pendingMotionTemplateUrlIdRef.current;
    if (
      pendingUrlSelection &&
      requestedMotionTemplateId !== pendingUrlSelection.templateId
    ) {
      return;
    }
    if (pendingUrlSelection) {
      pendingMotionTemplateUrlIdRef.current = null;
    }

    const nextSelectedId = resolveMotionTemplateSelection({
      templates: motionGraphicsSettings.templates,
      currentId: selectedMotionTemplateId,
      requestedId: requestedMotionTemplateId,
    });
    if (nextSelectedId !== selectedMotionTemplateId) {
      setSelectedMotionTemplateId(nextSelectedId);
    }
    if (
      requestedMotionTemplateId &&
      requestedMotionTemplateId !== nextSelectedId
    ) {
      updateSelectedMotionTemplateInUrl(nextSelectedId);
    }
  }, [
    activeSection,
    motionGraphicsSettings,
    requestedMotionTemplateId,
    selectedMotionTemplateId,
    updateSelectedMotionTemplateInUrl,
  ]);

  useEffect(() => {
    if (!imageStyles || imageStyles.styles.length === 0) return;
    if (
      requestedStyleId &&
      imageStyles.styles.some((style) => style.id === requestedStyleId)
    ) {
      setSelectedStyleId(requestedStyleId);
      return;
    }
    if (
      !selectedStyleId ||
      !imageStyles.styles.some((style) => style.id === selectedStyleId)
    ) {
      setSelectedStyleId(
        imageStyles.defaultStyleId || imageStyles.styles[0]?.id || null,
      );
    }
  }, [imageStyles, requestedStyleId, selectedStyleId]);

  useEffect(() => {
    if (!videoRender || videoRender.voices.length === 0) return;
    if (
      !selectedVoiceId ||
      !videoRender.voices.some((voice) => voice.id === selectedVoiceId)
    ) {
      setSelectedVoiceId(
        videoRender.defaultVoiceId || videoRender.voices[0]?.id || null,
      );
    }
  }, [selectedVoiceId, videoRender]);

  useEffect(() => {
    if (!videoRender || videoRender.musicTracks.length === 0) return;
    if (
      !selectedMusicId ||
      !videoRender.musicTracks.some((track) => track.id === selectedMusicId)
    ) {
      setSelectedMusicId(videoRender.musicTracks[0]?.id || null);
    }
  }, [selectedMusicId, videoRender]);

  useEffect(() => {
    if (!soundDesignSettings || soundDesignSettings.library.length === 0)
      return;
    if (
      !selectedSoundId ||
      !soundDesignSettings.library.some((sound) => sound.id === selectedSoundId)
    ) {
      setSelectedSoundId(soundDesignSettings.library[0]?.id || null);
    }
  }, [selectedSoundId, soundDesignSettings]);

  useEffect(() => {
    if (
      activeSection !== "generate-sound-design" ||
      !videoRender ||
      !soundDesignSettings
    ) {
      return;
    }

    const pendingUrlSelection = pendingAudioSelectionUrlRef.current;
    if (
      pendingUrlSelection &&
      (!requestedAudioSelection ||
        requestedAudioSelection.kind !== pendingUrlSelection.kind ||
        requestedAudioSelection.id !== pendingUrlSelection.id)
    ) {
      return;
    }
    if (pendingUrlSelection) {
      pendingAudioSelectionUrlRef.current = null;
    }

    const currentSelection =
      selectedAudioLibraryKind === "music" && selectedMusicId
        ? { kind: "music" as const, id: selectedMusicId }
        : selectedAudioLibraryKind === "sfx" && selectedSoundId
          ? { kind: "sfx" as const, id: selectedSoundId }
          : null;
    const nextSelection = resolveAudioLibrarySelection({
      musicTracks: videoRender.musicTracks,
      soundLibrary: soundDesignSettings.library,
      current: currentSelection,
      requested: requestedAudioSelection,
    });

    if (
      nextSelection &&
      (!currentSelection ||
        currentSelection.kind !== nextSelection.kind ||
        currentSelection.id !== nextSelection.id)
    ) {
      if (nextSelection.kind === "music") {
        setSelectedMusicId(nextSelection.id);
      } else {
        setSelectedSoundId(nextSelection.id);
      }
      setSelectedAudioLibraryKind(nextSelection.kind);
    }

    if (
      requestedAudioSelection &&
      (!nextSelection ||
        requestedAudioSelection.kind !== nextSelection.kind ||
        requestedAudioSelection.id !== nextSelection.id)
    ) {
      updateSelectedAudioSelectionInUrl(nextSelection);
    }
  }, [
    activeSection,
    requestedAudioSelection,
    selectedAudioLibraryKind,
    selectedMusicId,
    selectedSoundId,
    soundDesignSettings,
    updateSelectedAudioSelectionInUrl,
    videoRender,
  ]);

  useEffect(() => {
    if (!videoRender || videoRender.captionStyles.length === 0) return;
    if (
      !selectedCaptionStyleId ||
      !videoRender.captionStyles.some(
        (style) => style.id === selectedCaptionStyleId,
      )
    ) {
      setSelectedCaptionStyleId(
        videoRender.defaultCaptionStyleId ||
          videoRender.captionStyles[0]?.id ||
          null,
      );
    }
  }, [selectedCaptionStyleId, videoRender]);

  useEffect(() => {
    if (!videoRender || videoRender.animationPresets.length === 0) return;
    if (
      !selectedAnimationPresetId ||
      !videoRender.animationPresets.some(
        (preset) => preset.id === selectedAnimationPresetId,
      )
    ) {
      setSelectedAnimationPresetId(videoRender.animationPresets[0]?.id || null);
    }
  }, [selectedAnimationPresetId, videoRender]);

  const hasAppliedSettingsRef = useRef(Boolean(initialSettings));
  const applySettings = useCallback(
    (data: SettingsData, options?: { background?: boolean }) => {
      if (
        options?.background &&
        (focusedPromptTemplateIdRef.current || localSettingsDirtyRef.current)
      ) {
        setError(null);
        return;
      }

      setDefinitions(data.definitions);
      setPrompts(data.prompts);
      setInitialPrompts(data.prompts);
      setImageStyles(data.imageStyles);
      setInitialImageStyles(data.imageStyles);
      setVideoRender(data.videoRender);
      setInitialVideoRender(data.videoRender);
      setTextScriptSettings(data.textScript);
      setInitialTextScriptSettings(data.textScript);
      setXmlVisualPlanningSettings(data.xmlVisualPlanning);
      setInitialXmlVisualPlanningSettings(data.xmlVisualPlanning);
      setMotionGraphicsSettings(data.motionGraphics);
      setInitialMotionGraphicsSettings(data.motionGraphics);
      setSupportedMotionGraphicRenderers(data.supportedMotionGraphicRenderers || []);
      setSelectedMotionTemplateId(
        (current) =>
          resolveMotionTemplateSelection({
            templates: data.motionGraphics.templates,
            currentId: current,
            requestedId:
              activeSectionRef.current === "generate-visuals-motion-graphics"
                ? requestedMotionTemplateIdRef.current
                : null,
          }),
      );
      setSoundDesignSettings(data.soundDesign);
      setInitialSoundDesignSettings(data.soundDesign);
      setSelectedStyleId(
        (current) =>
          current ||
          data.imageStyles.defaultStyleId ||
          data.imageStyles.styles[0]?.id ||
          null,
      );
      setSelectedVoiceId(
        (current) =>
          current ||
          data.videoRender.defaultVoiceId ||
          data.videoRender.voices[0]?.id ||
          null,
      );
      setSelectedMusicId(
        (current) =>
          current ||
          data.videoRender.musicTracks[0]?.id ||
          null,
      );
      setSelectedSoundId(
        (current) => current || data.soundDesign.library[0]?.id || null,
      );
      setSelectedCaptionStyleId(
        (current) =>
          current ||
          data.videoRender.defaultCaptionStyleId ||
          data.videoRender.captionStyles[0]?.id ||
          null,
      );
      setSelectedAnimationPresetId(
        (current) =>
          current || data.videoRender.animationPresets[0]?.id || null,
      );
      setStyleTestsById(buildStyleTestsById(data.imageStyles.styles));
      if (!options?.background) {
        setSectionFeedback(createEmptySectionFeedback());
        setPromptTemplateFeedback(createEmptyPromptTemplateFeedback());
      }
      setError(null);
    },
    [],
  );

  const promptDefinitionsByKey = useMemo(
    () =>
      Object.fromEntries(
        definitions.map((definition) => [definition.key, definition]),
      ) as Record<PromptKey, PromptDefinition>,
    [definitions],
  );

  const selectedStyle = useMemo(
    () =>
      imageStyles?.styles.find((style) => style.id === selectedStyleId) || null,
    [imageStyles, selectedStyleId],
  );
  const selectedMotionTemplate = useMemo(
    () =>
      motionGraphicsSettings?.templates.find(
        (template) => template.id === selectedMotionTemplateId,
      ) || null,
    [motionGraphicsSettings, selectedMotionTemplateId],
  );
  const selectedMotionTemplateIndex = useMemo(
    () =>
      motionGraphicsSettings && selectedMotionTemplate
        ? motionGraphicsSettings.templates.findIndex(
            (template) => template.id === selectedMotionTemplate.id,
          )
        : -1,
    [motionGraphicsSettings, selectedMotionTemplate],
  );
  const initialSelectedMotionTemplate =
    selectedMotionTemplateIndex >= 0
      ? initialMotionGraphicsSettings?.templates[selectedMotionTemplateIndex] || null
      : null;
  const selectedMotionTemplateDirty = Boolean(
    selectedMotionTemplate &&
      (!initialSelectedMotionTemplate ||
        serializeForCompare(selectedMotionTemplate) !==
          serializeForCompare(initialSelectedMotionTemplate)),
  );
  const selectedMotionTemplatePreview = selectedMotionTemplate
    ? motionTemplatePreviewsById[selectedMotionTemplate.id] || null
    : null;
  const xmlMotionGraphicTemplatePromptPreviewValues = useMemo(
    () =>
      createMotionGraphicTemplatePromptPreviewValues(
        motionGraphicsSettings,
        selectedMotionTemplateId,
      ),
    [motionGraphicsSettings, selectedMotionTemplateId],
  );
  const xmlVisualPlanningPromptPreviewValues = useMemo(
    () =>
      createXmlVisualPlanningPromptPreviewValues({
        xmlVisualPlanningSettings,
        motionGraphicsSettings,
      }),
    [motionGraphicsSettings, xmlVisualPlanningSettings],
  );
  const soundDesignPromptPreviewValues = useMemo(
    () =>
      createSoundDesignPromptPreviewValues({
        soundDesignSettings,
        videoRender,
      }),
    [soundDesignSettings, videoRender],
  );
  const soundDesignRevisionPromptPreviewValues = useMemo(
    () =>
      mergePromptTemplatePreviewValues(
        SOUND_DESIGN_REVISION_PROMPT_PREVIEW_VALUES,
        {
          revisionNotes:
            SOUND_DESIGN_PROMPT_PREVIEW_VALUES.revisionNotes ||
            SOUND_DESIGN_PROMPT_PREVIEW_VALUES["{{revisionNotes}}"],
        },
      ),
    [],
  );

  useEffect(() => {
    setMotionPreviewArgsJsonDraft(
      selectedMotionTemplate
        ? JSON.stringify(selectedMotionTemplate.previewArgs, null, 2)
        : "",
    );
    setMotionFieldsJsonDraft(
      selectedMotionTemplate
        ? JSON.stringify(selectedMotionTemplate.fields, null, 2)
        : "",
    );
  }, [selectedMotionTemplate]);

  useEffect(() => {
    selectedMotionTemplateDirtyRef.current = selectedMotionTemplateDirty;
  }, [selectedMotionTemplateDirty]);

  useEffect(() => {
    if (
      activeSection !== "generate-visuals-motion-graphics" ||
      !selectedMotionTemplateDirty
    ) {
      return;
    }

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [activeSection, selectedMotionTemplateDirty]);

  useEffect(() => {
    if (
      activeSection !== "generate-visuals-motion-graphics" ||
      !selectedMotionTemplateDirty
    ) {
      return;
    }

    const handleDocumentClick = (event: MouseEvent) => {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      ) {
        return;
      }
      const target = event.target;
      if (!(target instanceof Element)) return;
      const anchor = target.closest("a[href]");
      if (!(anchor instanceof HTMLAnchorElement)) return;
      if (anchor.target && anchor.target !== "_self") return;

      const nextUrl = new URL(anchor.href);
      const currentUrl = new URL(window.location.href);
      if (nextUrl.href === currentUrl.href) return;
      if (
        nextUrl.pathname === currentUrl.pathname &&
        nextUrl.searchParams.get(MOTION_TEMPLATE_QUERY_PARAM) ===
          currentUrl.searchParams.get(MOTION_TEMPLATE_QUERY_PARAM)
      ) {
        return;
      }

      const confirmed = window.confirm(
        "You have unsaved changes to this motion graphics template. Discard those changes?",
      );
      if (!confirmed) {
        event.preventDefault();
        event.stopPropagation();
      }
    };

    document.addEventListener("click", handleDocumentClick, true);
    return () => {
      document.removeEventListener("click", handleDocumentClick, true);
    };
  }, [activeSection, selectedMotionTemplateDirty]);
  const selectedVoice = useMemo(
    () =>
      videoRender?.voices.find((voice) => voice.id === selectedVoiceId) || null,
    [selectedVoiceId, videoRender],
  );
  const selectedMusic = useMemo(
    () =>
      videoRender?.musicTracks.find((track) => track.id === selectedMusicId) ||
      null,
    [selectedMusicId, videoRender],
  );
  const selectedCaptionStyle = useMemo(
    () =>
      videoRender?.captionStyles.find(
        (style) => style.id === selectedCaptionStyleId,
      ) || null,
    [selectedCaptionStyleId, videoRender],
  );
  const selectedAnimationPreset = useMemo(
    () =>
      videoRender?.animationPresets.find(
        (preset) => preset.id === selectedAnimationPresetId,
      ) || null,
    [selectedAnimationPresetId, videoRender],
  );
  const selectedCaptionStyleAnimationPreset = useMemo(
    () =>
      videoRender && selectedCaptionStyle
        ? getCaptionAnimationPresetById(
            videoRender.animationPresets,
            selectedCaptionStyle.animationPresetId,
          )
        : null,
    [selectedCaptionStyle, videoRender],
  );
  const savedVoiceAudioUrl = useMemo(() => {
    if (ttsPreview.audioUrl) return ttsPreview.audioUrl;
    if (!selectedVoice) return null;
    const cacheBust = selectedVoice.referenceGeneratedAt
      ? Date.parse(selectedVoice.referenceGeneratedAt)
      : undefined;
    return buildSavedVoiceAudioUrl(
      selectedVoice,
      typeof cacheBust === "number" && Number.isFinite(cacheBust)
        ? cacheBust
        : undefined,
    );
  }, [selectedVoice, ttsPreview.audioUrl]);
  const savedMusicAudioUrl = useMemo(() => {
    if (musicPreview.audioUrl) return musicPreview.audioUrl;
    if (!selectedMusic) return null;
    const cacheBust = selectedMusic.generatedAt
      ? Date.parse(selectedMusic.generatedAt)
      : undefined;
    return buildSavedMusicAudioUrl(
      selectedMusic,
      typeof cacheBust === "number" && Number.isFinite(cacheBust)
        ? cacheBust
        : undefined,
    );
  }, [musicPreview.audioUrl, selectedMusic]);
  const selectedSound = useMemo(
    () =>
      soundDesignSettings?.library.find(
        (sound) => sound.id === selectedSoundId,
      ) || null,
    [selectedSoundId, soundDesignSettings],
  );
  const initialSelectedSound = useMemo(
    () =>
      initialSoundDesignSettings?.library.find(
        (sound) => sound.id === selectedSoundId,
      ) || null,
    [initialSoundDesignSettings, selectedSoundId],
  );
  const initialSelectedMusic = useMemo(
    () =>
      initialVideoRender?.musicTracks.find(
        (track) => track.id === selectedMusicId,
      ) || null,
    [initialVideoRender, selectedMusicId],
  );
	  const selectedAudioClip = useMemo(() => {
	    if (selectedAudioLibraryKind === "music" && selectedMusic) {
	      return {
	        name: selectedMusic.name,
        kindLabel: "Music",
        status: getMusicTrackReadiness(selectedMusic),
      };
    }
    if (selectedSound) {
      return {
        name: selectedSound.name,
        kindLabel: getSoundLibraryCategoryLabel(selectedSound.category),
        status: getSoundReadiness(selectedSound),
      };
	    }
	    return null;
	  }, [selectedAudioLibraryKind, selectedMusic, selectedSound]);
	  const selectedAudioClipTags = useMemo(() => {
	    if (selectedAudioLibraryKind === "music" && selectedMusic) {
	      return selectedMusic.tags || [];
	    }
	    if (selectedAudioLibraryKind === "sfx" && selectedSound) {
	      return selectedSound.tags || [];
	    }
	    return [];
	  }, [selectedAudioLibraryKind, selectedMusic, selectedSound]);
	  const mixDefaultsDirty =
    serializeForCompare(pickSoundMixDefaults(soundDesignSettings)) !==
    serializeForCompare(pickSoundMixDefaults(initialSoundDesignSettings));
  const selectedSoundDirty =
    selectedAudioLibraryKind === "sfx" && selectedSound
      ? serializeForCompare(selectedSound) !==
        serializeForCompare(initialSelectedSound)
      : false;
  const selectedMusicDirty =
    selectedAudioLibraryKind === "music" && selectedMusic
      ? serializeForCompare({
          track: selectedMusic,
          musicVolume: videoRender?.musicVolume,
        }) !==
        serializeForCompare({
          track: initialSelectedMusic,
          musicVolume: initialVideoRender?.musicVolume,
        })
      : false;
  const selectedAudioClipDirty = selectedSoundDirty || selectedMusicDirty;
  const normalizedSoundLibrarySearchTokens = useMemo(
    () =>
      soundLibrarySearchQuery.trim().toLowerCase().split(/\s+/).filter(Boolean),
    [soundLibrarySearchQuery],
  );
  const soundLibraryBaseMatches = useMemo(() => {
    if (!soundDesignSettings) return [];
    return soundDesignSettings.library.filter(
	      (sound) =>
	        matchesSoundLibraryFileFilter(sound, soundLibraryFileFilter) &&
	        matchesAudioLibraryAvailabilityFilter(
	          sound,
	          audioLibraryAvailabilityFilter,
	        ) &&
	        matchesSoundLibrarySearch(sound, normalizedSoundLibrarySearchTokens),
	    );
	  }, [
	    audioLibraryAvailabilityFilter,
	    normalizedSoundLibrarySearchTokens,
	    soundDesignSettings,
	    soundLibraryFileFilter,
  ]);
  const musicLibraryBaseMatches = useMemo(() => {
    if (!videoRender) return [];
    return videoRender.musicTracks.filter(
	      (track) =>
	        matchesMusicLibraryFileFilter(track, soundLibraryFileFilter) &&
	        matchesAudioLibraryAvailabilityFilter(
	          track,
	          audioLibraryAvailabilityFilter,
	        ) &&
	        (musicMoodFilter === "all" || track.mood === musicMoodFilter) &&
	        (musicEnergyFilter === "all" || track.energy === musicEnergyFilter) &&
	        matchesMusicLibrarySearch(track, normalizedSoundLibrarySearchTokens),
	    );
	  }, [
	    audioLibraryAvailabilityFilter,
	    musicEnergyFilter,
	    musicMoodFilter,
    normalizedSoundLibrarySearchTokens,
    soundLibraryFileFilter,
    videoRender,
  ]);
  const musicMoodOptions = useMemo(
    () =>
      Array.from(
        new Set(
          (videoRender?.musicTracks || [])
            .map((track) => track.mood)
            .filter((value): value is string => Boolean(value)),
        ),
      ).sort((left, right) => left.localeCompare(right)),
    [videoRender],
  );
  const musicEnergyOptions = useMemo(
    () =>
      Array.from(
        new Set(
          (videoRender?.musicTracks || [])
            .map((track) => track.energy)
            .filter((value): value is string => Boolean(value)),
        ),
      ).sort((left, right) => left.localeCompare(right)),
    [videoRender],
  );
  const soundLibraryCategorySummaries = useMemo<
    SoundLibraryCategorySummary[]
  >(() => {
    if (!soundDesignSettings) return [];

    const summaries = new Map<string, SoundLibraryCategorySummary>();
    soundDesignSettings.library.forEach((sound) => {
      const key = getSoundLibraryCategoryKey(sound.category);
      const label = getSoundLibraryCategoryLabel(sound.category);
      const matchesBase =
        matchesSoundLibraryFileFilter(sound, soundLibraryFileFilter) &&
        matchesSoundLibrarySearch(sound, normalizedSoundLibrarySearchTokens);
      const existing = summaries.get(key);
      if (existing) {
        existing.totalCount += 1;
        existing.withAudioCount += sound.audioRelativePath ? 1 : 0;
        existing.missingAudioCount += sound.audioRelativePath ? 0 : 1;
        existing.matchingCount += matchesBase ? 1 : 0;
        if (existing.label === "Uncategorized" && label !== "Uncategorized") {
          existing.label = label;
          existing.value = label;
        }
        return;
      }
      summaries.set(key, {
        key,
        value: key === "__uncategorized__" ? "__uncategorized__" : label,
        label,
        totalCount: 1,
        matchingCount: matchesBase ? 1 : 0,
        withAudioCount: sound.audioRelativePath ? 1 : 0,
        missingAudioCount: sound.audioRelativePath ? 0 : 1,
      });
    });

    if (videoRender?.musicTracks.length) {
      const musicMatchingCount = musicLibraryBaseMatches.length;
      const existingMusicSummary = summaries.get("music");
      summaries.set("music", {
        key: "music",
        value: "Music",
        label: "Music",
        totalCount:
          (existingMusicSummary?.totalCount || 0) +
          videoRender.musicTracks.length,
        matchingCount:
          (existingMusicSummary?.matchingCount || 0) + musicMatchingCount,
        withAudioCount:
          (existingMusicSummary?.withAudioCount || 0) +
          videoRender.musicTracks.filter((track) =>
            Boolean(track.generatedAudioRelativePath),
          ).length,
        missingAudioCount:
          (existingMusicSummary?.missingAudioCount || 0) +
          videoRender.musicTracks.filter(
            (track) => !track.generatedAudioRelativePath,
          ).length,
      });
    }

    return Array.from(summaries.values()).sort((left, right) => {
      const leftHasMatches = left.matchingCount > 0 ? 0 : 1;
      const rightHasMatches = right.matchingCount > 0 ? 0 : 1;
      if (leftHasMatches !== rightHasMatches)
        return leftHasMatches - rightHasMatches;
      if (right.matchingCount !== left.matchingCount)
        return right.matchingCount - left.matchingCount;
      if (
        left.key === "__uncategorized__" ||
        right.key === "__uncategorized__"
      ) {
        return left.key === "__uncategorized__" ? 1 : -1;
      }
      return left.label.localeCompare(right.label);
    });
  }, [
    musicLibraryBaseMatches,
    normalizedSoundLibrarySearchTokens,
    soundDesignSettings,
    soundLibraryFileFilter,
    videoRender,
  ]);
  const filteredSoundLibrary = useMemo(
    () =>
      audioLibraryTypeFilter === "music"
        ? []
        : soundLibraryBaseMatches.filter((sound) =>
            matchesSoundLibraryCategoryFilter(sound, soundLibraryCategoryFilter),
          ),
    [audioLibraryTypeFilter, soundLibraryBaseMatches, soundLibraryCategoryFilter],
  );
  const filteredMusicLibrary = useMemo(
    () =>
      audioLibraryTypeFilter !== "sfx" &&
      matchesMusicLibraryCategoryFilter(soundLibraryCategoryFilter)
        ? musicLibraryBaseMatches
        : [],
    [audioLibraryTypeFilter, musicLibraryBaseMatches, soundLibraryCategoryFilter],
  );
  const filteredSoundLibraryItemCount =
    filteredSoundLibrary.length + filteredMusicLibrary.length;
  const soundLibraryItemCount =
    (soundDesignSettings?.library.length || 0) +
    (videoRender?.musicTracks.length || 0);
	  const audioLibraryHealth = useMemo(() => {
	    const musicTracks = videoRender?.musicTracks || [];
	    const sounds = soundDesignSettings?.library || [];
    const musicMissingAudio = musicTracks.filter(
      (track) => !track.generatedAudioRelativePath,
    ).length;
    const sfxMissingAudio = sounds.filter((sound) => !sound.audioRelativePath).length;
    const musicMissingMetadata = musicTracks.filter(
      (track) => getMusicTrackReadiness(track) === "needs metadata",
    ).length;
    const sfxMissingMetadata = sounds.filter(
      (sound) => getSoundReadiness(sound) === "needs metadata",
    ).length;
    return {
      musicCount: musicTracks.length,
      sfxCount: sounds.length,
      missingAudioCount: musicMissingAudio + sfxMissingAudio,
      missingMetadataCount: musicMissingMetadata + sfxMissingMetadata,
      readyCount:
        musicTracks.filter((track) => isReadyAudioAsset(getMusicTrackReadiness(track))).length +
	        sounds.filter((sound) => isReadyAudioAsset(getSoundReadiness(sound))).length,
	    };
	  }, [soundDesignSettings, videoRender]);
	  const audioClipTagOptions = useMemo(() => {
	    const tagsByKey = new Map<string, string>();
	    const addTags = (tags: string[] | undefined) => {
	      (tags || []).forEach((tag) => {
	        const trimmed = tag.trim();
	        if (!trimmed) return;
	        const key = trimmed.toLowerCase();
	        if (!tagsByKey.has(key)) tagsByKey.set(key, trimmed);
	      });
	    };
	    (soundDesignSettings?.library || []).forEach((sound) => addTags(sound.tags));
	    (videoRender?.musicTracks || []).forEach((track) => addTags(track.tags));
	    audioClipTagDrafts.forEach((tag) => addTags([tag]));
	    return [...tagsByKey.values()].sort((left, right) =>
	      left.localeCompare(right, undefined, { sensitivity: "base" }),
	    );
	  }, [audioClipTagDrafts, soundDesignSettings, videoRender]);
	  const sortedFilteredSoundLibrary = useMemo(
    () =>
      [...filteredSoundLibrary].sort((left, right) =>
        left.name.localeCompare(right.name),
      ),
    [filteredSoundLibrary],
  );
  const soundLibraryTotalWithAudioCount = useMemo(
    () =>
      (soundDesignSettings?.library || []).filter((sound) =>
        Boolean(sound.audioRelativePath),
      ).length +
      (videoRender?.musicTracks || []).filter((track) =>
        Boolean(track.generatedAudioRelativePath),
      ).length,
    [soundDesignSettings, videoRender],
  );
  const savedSoundAudioUrl = useMemo(() => {
    if (!selectedSound) return null;
    if (selectedSound.audioUrl) return selectedSound.audioUrl;
    const cacheBust = selectedSound.uploadedAt
      ? Date.parse(selectedSound.uploadedAt)
      : undefined;
    return buildSavedSoundAudioUrl(
      selectedSound,
      typeof cacheBust === "number" && Number.isFinite(cacheBust)
        ? cacheBust
        : undefined,
    );
  }, [selectedSound]);

  useEffect(() => {
    setSelectedSoundAudioTime(0);
    if (selectedSoundAudioRef.current) {
      selectedSoundAudioRef.current.currentTime = 0;
    }
  }, [savedSoundAudioUrl, selectedSound?.id]);
  const selectedStyleTest = selectedStyle
    ? styleTestsById[selectedStyle.id]
    : undefined;
  const nanoBananaPromptPreviewValues = useMemo(
    () => createNanoBananaPromptPreviewValues(imageStyles, selectedStyle),
    [imageStyles, selectedStyle],
  );
  const selectedStyleUpload = selectedStyle
    ? styleReferenceUploadsById[selectedStyle.id]
    : undefined;
  const selectedVoiceUpload = selectedVoice
    ? voiceReferenceUploadsById[selectedVoice.id]
    : undefined;
  const selectedSoundUpload = selectedSound
    ? soundUploadsById[selectedSound.id]
    : undefined;
  const anyStyleTesting = useMemo(
    () =>
      Object.values(styleTestsById).some((styleTest) => styleTest.isLoading),
    [styleTestsById],
  );
  const anySectionSaving = useMemo(
    () => Object.values(sectionFeedback).some((section) => section.saving),
    [sectionFeedback],
  );
  const anyPromptTemplateSaving = useMemo(
    () =>
      Object.values(promptTemplateFeedback).some(
        (template) => template.saving,
      ),
    [promptTemplateFeedback],
  );

  useEffect(() => {
    if (!selectedAnimationPreset) return;
    setAnimationPresetJsonDraft(
      formatAnimationPresetConfigJson(selectedAnimationPreset.config),
    );
  }, [selectedAnimationPreset]);

  useEffect(() => {
    if (
      soundLibraryCategoryFilter === "all" ||
      soundLibraryCategoryFilter === "__uncategorized__"
    )
      return;
    if (
      !soundLibraryCategorySummaries.some(
        (summary) =>
          summary.key === soundLibraryCategoryFilter.trim().toLowerCase(),
      )
    ) {
      setSoundLibraryCategoryFilter("all");
    }
  }, [soundLibraryCategoryFilter, soundLibraryCategorySummaries]);

  useEffect(() => {
    if (
      !selectedCaptionStyle?.animationPresetId ||
      !videoRender?.animationPresets.some(
        (preset) => preset.id === selectedCaptionStyle.animationPresetId,
      )
    ) {
      return;
    }
    setSelectedAnimationPresetId((current) =>
      current === selectedCaptionStyle.animationPresetId
        ? current
        : selectedCaptionStyle.animationPresetId,
    );
  }, [selectedCaptionStyle?.animationPresetId, videoRender]);

  useEffect(() => {
    setTtsPreview({
      isLoading: false,
      error: null,
      audioUrl: null,
      reusedExisting: null,
    });
  }, [selectedVoiceId]);

  useEffect(() => {
    setMusicPreview({
      isLoading: false,
      error: null,
      audioUrl: null,
      reusedExisting: null,
    });
  }, [selectedMusicId]);

  function seekSelectedSoundAudio(nextTimeSeconds: number) {
    const audio = selectedSoundAudioRef.current;
    if (!audio) return;
    const maxTime =
      Number.isFinite(audio.duration) && audio.duration > 0
        ? audio.duration
        : typeof selectedSound?.durationSeconds === "number" &&
            selectedSound.durationSeconds > 0
          ? selectedSound.durationSeconds
          : nextTimeSeconds;
    const clampedTime = clampNumber(nextTimeSeconds, 0, maxTime);
    audio.currentTime = clampedTime;
    setSelectedSoundAudioTime(clampedTime);
  }

  const dirtyBySection = useMemo<Record<SettingsSectionId, boolean>>(() => {
    const imageTemplateDirty =
      imageStyles && initialImageStyles
        ? serializeForCompare(imageStyles.promptTemplates) !==
          serializeForCompare(initialImageStyles.promptTemplates)
        : false;
    const imageStyleLibraryDirty =
      imageStyles && initialImageStyles
        ? serializeForCompare({
            styles: imageStyles.styles,
            defaultStyleId: imageStyles.defaultStyleId,
            defaultVisualGenerationModelId:
              imageStyles.defaultVisualGenerationModelId,
          }) !==
          serializeForCompare({
            styles: initialImageStyles.styles,
            defaultStyleId: initialImageStyles.defaultStyleId,
            defaultVisualGenerationModelId:
              initialImageStyles.defaultVisualGenerationModelId,
          })
        : false;
    const ttsDirty =
      videoRender && initialVideoRender
        ? serializeForCompare({
            voices: videoRender.voices,
            defaultVoiceId: videoRender.defaultVoiceId,
          }) !==
          serializeForCompare({
            voices: initialVideoRender.voices,
            defaultVoiceId: initialVideoRender.defaultVoiceId,
          })
        : false;
    const musicDirty =
      videoRender && initialVideoRender
        ? serializeForCompare({
            musicTracks: videoRender.musicTracks,
            musicVolume: videoRender.musicVolume,
          }) !==
          serializeForCompare({
            musicTracks: initialVideoRender.musicTracks,
            musicVolume: initialVideoRender.musicVolume,
          })
        : false;
    const soundLibraryDirty =
      soundDesignSettings && initialSoundDesignSettings
        ? serializeForCompare(soundDesignSettings) !==
          serializeForCompare(initialSoundDesignSettings)
        : false;
    const captionStylesDirty =
      videoRender && initialVideoRender
        ? serializeForCompare({
            animationPresets: videoRender.animationPresets,
            captionStyles: videoRender.captionStyles,
            defaultCaptionStyleId: videoRender.defaultCaptionStyleId,
            captionMaxWords: videoRender.captionMaxWords,
          }) !==
          serializeForCompare({
            animationPresets: initialVideoRender.animationPresets,
            captionStyles: initialVideoRender.captionStyles,
            defaultCaptionStyleId: initialVideoRender.defaultCaptionStyleId,
            captionMaxWords: initialVideoRender.captionMaxWords,
          })
        : false;
    const pauseRemovalDirty =
      videoRender && initialVideoRender
        ? serializeForCompare({
            pauseRemoval: videoRender.pauseRemoval,
          }) !==
          serializeForCompare({
            pauseRemoval: initialVideoRender.pauseRemoval,
          })
        : false;
    const textScriptPromptsDirty =
      textScriptSettings && initialTextScriptSettings
        ? serializeForCompare(textScriptSettings) !==
          serializeForCompare(initialTextScriptSettings)
        : false;
    const xmlVisualPlanningDirty =
      xmlVisualPlanningSettings && initialXmlVisualPlanningSettings
        ? serializeForCompare(xmlVisualPlanningSettings) !==
          serializeForCompare(initialXmlVisualPlanningSettings)
        : false;
    const motionGraphicsDirty =
      motionGraphicsSettings && initialMotionGraphicsSettings
        ? serializeForCompare(motionGraphicsSettings) !==
          serializeForCompare(initialMotionGraphicsSettings)
        : false;

    const promptGroupDirty = Object.fromEntries(
      PROMPT_GROUPS.map((group) => [
        group.id,
        serializeForCompare(pickPromptValues(prompts, group.keys)) !==
          serializeForCompare(pickPromptValues(initialPrompts, group.keys)),
      ]),
    ) as Record<"prompt-hooks" | "prompt-research", boolean>;

    return {
      "tts-voice": ttsDirty,
      "pause-removal": pauseRemovalDirty,
      "music-library": musicDirty,
      "sound-library": soundLibraryDirty,
      "caption-styles": captionStylesDirty,
      "image-templates": imageTemplateDirty,
      "image-styles": imageStyleLibraryDirty,
      "motion-graphics": motionGraphicsDirty,
      "prompt-hooks": promptGroupDirty["prompt-hooks"],
      "prompt-research": promptGroupDirty["prompt-research"],
      "text-script-prompts": textScriptPromptsDirty,
      "xml-visual-planning": xmlVisualPlanningDirty,
    };
  }, [
    imageStyles,
    initialImageStyles,
    initialMotionGraphicsSettings,
    initialPrompts,
    initialSoundDesignSettings,
    initialTextScriptSettings,
    initialVideoRender,
    initialXmlVisualPlanningSettings,
    motionGraphicsSettings,
    prompts,
    soundDesignSettings,
    textScriptSettings,
    videoRender,
    xmlVisualPlanningSettings,
  ]);

  useEffect(() => {
    localSettingsDirtyRef.current = Object.values(dirtyBySection).some(Boolean);
  }, [dirtyBySection]);

  const handlePromptTemplateFocus = useCallback(
    (templateId: PromptTemplateId) => {
      focusedPromptTemplateIdRef.current = templateId;
      setFocusedPromptTemplateId(templateId);
    },
    [],
  );

  const handlePromptTemplateBlur = useCallback(
    (templateId: PromptTemplateId) => {
      if (focusedPromptTemplateIdRef.current !== templateId) return;
      focusedPromptTemplateIdRef.current = null;
      setFocusedPromptTemplateId((current) =>
        current === templateId ? null : current,
      );
    },
    [],
  );

  const getPromptTemplateFocusHandlers = useCallback(
    (templateId: PromptTemplateId) => ({
      onFocus: () => handlePromptTemplateFocus(templateId),
      onBlur: () => handlePromptTemplateBlur(templateId),
    }),
    [handlePromptTemplateBlur, handlePromptTemplateFocus],
  );

  const anyDirty = useMemo(
    () => Object.values(dirtyBySection).some(Boolean),
    [dirtyBySection],
  );
  const settingsShellNav = useShortFormSettingsShellNav();
  const autoRefreshPaused =
    anyDirty ||
    anySectionSaving ||
    anyPromptTemplateSaving ||
    anyStyleTesting ||
    Boolean(focusedPromptTemplateId) ||
    ttsPreview.isLoading ||
    musicPreview.isLoading ||
    Boolean(selectedStyleUpload?.isUploading) ||
    Boolean(selectedVoiceUpload?.isUploading) ||
    Boolean(selectedSoundUpload?.isUploading);

  const {
    data: settingsData,
    error: settingsLoadError,
    mutate: mutateSettings,
  } = useSWR<SettingsData>("/api/short-form-videos/settings", apiDataFetcher, {
    ...realtimeSWRConfig,
    fallbackData: initialSettings,
    revalidateOnMount: !initialSettings,
    refreshInterval: autoRefreshPaused ? 0 : 30000,
    revalidateOnFocus: !autoRefreshPaused,
  });

  const loadSettings = useCallback(
    async (options?: { background?: boolean }) => {
      if (!options?.background) {
        setLoading(true);
        setError(null);
      }

      try {
        const data = await mutateSettings();
        if (data) {
          applySettings(data, {
            background: options?.background ?? hasAppliedSettingsRef.current,
          });
          hasAppliedSettingsRef.current = true;
        }
        return data;
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Failed to load short-form workflow settings",
        );
        return undefined;
      } finally {
        if (!options?.background) {
          setLoading(false);
        }
      }
    },
    [applySettings, mutateSettings],
  );

  useEffect(() => {
    if (!settingsData) return;
    applySettings(settingsData, { background: hasAppliedSettingsRef.current });
    hasAppliedSettingsRef.current = true;
    setLoading(false);
  }, [applySettings, settingsData]);

  useEffect(() => {
    if (!settingsLoadError) return;
    setError(
      settingsLoadError instanceof Error
        ? settingsLoadError.message
        : "Failed to load short-form workflow settings",
    );
    setLoading(false);
  }, [settingsLoadError]);

  const dirtySectionIds = useMemo(
    () =>
      Object.entries(dirtyBySection)
        .filter(([, dirty]) => dirty)
        .map(([sectionId]) => sectionId),
    [dirtyBySection],
  );
  const pageMeta = SETTINGS_PAGE_META[activeSection];
  const pageActionSectionId = pageMeta.pageActionSectionId;
  const pageActionSectionIds: SettingsSectionId[] =
    activeSection === "generate-narration-audio"
      ? ["pause-removal", "tts-voice"]
      : pageActionSectionId
        ? [pageActionSectionId]
        : [];
  const pageReloadDisabled =
    loading ||
    anySectionSaving ||
    anyPromptTemplateSaving ||
    anyStyleTesting ||
    ttsPreview.isLoading ||
    musicPreview.isLoading ||
    Boolean(selectedStyleUpload?.isUploading) ||
    Boolean(selectedVoiceUpload?.isUploading) ||
    Boolean(selectedSoundUpload?.isUploading);

  useEffect(() => {
    if (!settingsShellNav) return;

    settingsShellNav.setDirtySectionIds(dirtySectionIds);

    return () => {
      settingsShellNav.setDirtySectionIds([]);
    };
  }, [dirtySectionIds, settingsShellNav]);

  useEffect(() => {
    if (!settingsShellNav) return;

    settingsShellNav.setSummaryOverrides({
      voiceCount: videoRender?.voices.length || 0,
      soundCount: soundDesignSettings?.library.length || 0,
      styleCount: imageStyles?.styles.length || 0,
      captionStyleCount: videoRender?.captionStyles.length || 0,
      musicTrackCount: videoRender?.musicTracks.length || 0,
    });

    return () => {
      settingsShellNav.setSummaryOverrides({});
    };
  }, [
    imageStyles?.styles.length,
    settingsShellNav,
    soundDesignSettings?.library.length,
    videoRender?.captionStyles.length,
    videoRender?.musicTracks.length,
    videoRender?.voices.length,
  ]);

  const promptSections = PROMPT_GROUPS.map((group) => {
    return (
      <section key={group.id} id={group.id} className="scroll-mt-24">
        <div className="space-y-6">
          {group.keys.map((key) => {
            const definition = promptDefinitionsByKey[key];
            const templateId = key as PromptTemplateId;
            const templateFeedback = promptTemplateFeedback[templateId];
            return (
              <PromptTemplateEditorCard
                key={key}
                title={definition?.title || key}
                description={definition?.description}
                value={prompts[key] || ""}
                onChange={(value) => setPromptTemplateValue(templateId, value)}
                {...getPromptTemplateFocusHandlers(templateId)}
                feedback={templateFeedback}
                dirty={isPromptTemplateDirty(templateId)}
                saving={templateFeedback.saving}
                onSave={() => void savePromptTemplate(templateId)}
                onReset={() => resetPromptTemplate(templateId)}
                minHeightClassName="min-h-[220px]"
                previewValues={
                  PROMPT_GROUP_PREVIEW_VALUES[
                    group.id as "prompt-hooks" | "prompt-research"
                  ]
                }
              >
                {definition?.stage ? (
                  <span className="rounded-full border border-border px-2 py-0.5 text-[11px] uppercase tracking-wide text-muted-foreground">
                    {definition.stage}
                  </span>
                ) : null}
              </PromptTemplateEditorCard>
            );
          })}

          <PromptPlaceholderCard
            title="Prompt placeholders"
            rows={
              PROMPT_GROUP_PLACEHOLDER_ROWS[
                group.id as "prompt-hooks" | "prompt-research"
              ]
            }
          />
        </div>
      </section>
    );
  });

  const textScriptPromptSection = (
    <section id="text-script-prompts" className="scroll-mt-24">
      <div className="space-y-6">
        {textScriptSettings ? (
          <div className="space-y-6">
            <Card className="space-y-4 p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="text-sm font-medium text-foreground">
                    Text-script defaults
                  </h3>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Loop limits and post-processing options saved separately
                    from the prompt templates.
                  </p>
                </div>
                <SectionActions
                  dirty={isTextScriptDefaultsDirty()}
                  saving={sectionFeedback["text-script-prompts"].saving}
                  saveLabel="Save defaults"
                  resetLabel="Restore"
                  onSave={() => void saveTextScriptDefaults()}
                  onReset={resetTextScriptDefaults}
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Default max draft iterations
                </label>
                <Input
                  type="number"
                  min={1}
                  max={8}
                  value={textScriptSettings.defaultMaxIterations}
                  onChange={(event) => {
                    updateSectionFeedbackState("text-script-prompts", {
                      error: null,
                      message: null,
                    });
                    setTextScriptSettings({
                      ...textScriptSettings,
                      defaultMaxIterations: Math.max(
                        1,
                        Math.min(8, Number(event.target.value) || 1),
                      ),
                    });
                  }}
                  className="max-w-xs"
                />
                <p className="text-xs text-muted-foreground">
                  New short-form projects can optionally override this per
                  project from the Text Script section, but this is the
                  dashboard-wide default.
                </p>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <label className="flex items-start gap-3 rounded-md border bg-muted/30 p-3 text-sm text-foreground">
                  <input
                    type="checkbox"
                    checked={textScriptSettings.enforceNaturalContractions}
                    onChange={(event) => {
                      updateSectionFeedbackState("text-script-prompts", {
                        error: null,
                        message: null,
                      });
                      setTextScriptSettings({
                        ...textScriptSettings,
                        enforceNaturalContractions: event.target.checked,
                      });
                    }}
                    className="mt-1"
                  />
                  <span>
                    <span className="block font-medium">
                      Contract natural two-word forms
                    </span>
                    <span className="mt-1 block text-xs text-muted-foreground">
                      Applies once after the final Text Script loop draft is
                      selected.
                    </span>
                  </span>
                </label>

                <label className="flex items-start gap-3 rounded-md border bg-muted/30 p-3 text-sm text-foreground">
                  <input
                    type="checkbox"
                    checked={textScriptSettings.formatNumericPercentages}
                    onChange={(event) => {
                      updateSectionFeedbackState("text-script-prompts", {
                        error: null,
                        message: null,
                      });
                      setTextScriptSettings({
                        ...textScriptSettings,
                        formatNumericPercentages: event.target.checked,
                      });
                    }}
                    className="mt-1"
                  />
                  <span>
                    <span className="block font-medium">
                      Convert numeric percent phrases
                    </span>
                    <span className="mt-1 block text-xs text-muted-foreground">
                      Converts values like 87.8 percent or 87.8 per cent to
                      87.8%.
                    </span>
                  </span>
                </label>
              </div>
              <SectionFeedbackNotice
                feedback={sectionFeedback["text-script-prompts"]}
              />
            </Card>

            <PromptTemplateEditorCard
              title="Full generate prompt template"
              value={textScriptSettings.generatePrompt}
              onChange={(value) =>
                setPromptTemplateValue("textScript.generatePrompt", value)
              }
              {...getPromptTemplateFocusHandlers("textScript.generatePrompt")}
              feedback={promptTemplateFeedback["textScript.generatePrompt"]}
              dirty={isPromptTemplateDirty("textScript.generatePrompt")}
              saving={promptTemplateFeedback["textScript.generatePrompt"].saving}
              onSave={() => void savePromptTemplate("textScript.generatePrompt")}
              onReset={() => resetPromptTemplate("textScript.generatePrompt")}
              minHeightClassName="min-h-[280px]"
              previewValues={TEXT_SCRIPT_PROMPT_PREVIEW_VALUES}
            />

            <PromptTemplateEditorCard
              title="Full revise prompt template"
              value={textScriptSettings.revisePrompt}
              onChange={(value) =>
                setPromptTemplateValue("textScript.revisePrompt", value)
              }
              {...getPromptTemplateFocusHandlers("textScript.revisePrompt")}
              feedback={promptTemplateFeedback["textScript.revisePrompt"]}
              dirty={isPromptTemplateDirty("textScript.revisePrompt")}
              saving={promptTemplateFeedback["textScript.revisePrompt"].saving}
              onSave={() => void savePromptTemplate("textScript.revisePrompt")}
              onReset={() => resetPromptTemplate("textScript.revisePrompt")}
              minHeightClassName="min-h-[320px]"
              previewValues={TEXT_SCRIPT_PROMPT_PREVIEW_VALUES}
            />

            <PromptTemplateEditorCard
              title="Full review prompt template"
              value={textScriptSettings.reviewPrompt}
              onChange={(value) =>
                setPromptTemplateValue("textScript.reviewPrompt", value)
              }
              {...getPromptTemplateFocusHandlers("textScript.reviewPrompt")}
              feedback={promptTemplateFeedback["textScript.reviewPrompt"]}
              dirty={isPromptTemplateDirty("textScript.reviewPrompt")}
              saving={promptTemplateFeedback["textScript.reviewPrompt"].saving}
              onSave={() => void savePromptTemplate("textScript.reviewPrompt")}
              onReset={() => resetPromptTemplate("textScript.reviewPrompt")}
              minHeightClassName="min-h-[300px]"
              previewValues={TEXT_SCRIPT_PROMPT_PREVIEW_VALUES}
            />

            <PromptPlaceholderCard
              title="Text Script prompt placeholders"
              rows={TEXT_SCRIPT_PLACEHOLDER_ROWS}
            />
          </div>
        ) : null}
      </div>
    </section>
  );

  const xmlVisualPlanningPromptSection = (
    <section id="xml-visual-planning" className="scroll-mt-24">
      <div className="space-y-6">
        {xmlVisualPlanningSettings ? (
          <div className="space-y-6">
            <PromptTemplateEditorCard
              title="Guidelines for planning visuals template"
              value={xmlVisualPlanningSettings.planningGuidelinesTemplate}
              onChange={(value) =>
                setPromptTemplateValue(
                  "xmlVisualPlanning.planningGuidelinesTemplate",
                  value,
                )
              }
              {...getPromptTemplateFocusHandlers(
                "xmlVisualPlanning.planningGuidelinesTemplate",
              )}
              feedback={
                promptTemplateFeedback[
                  "xmlVisualPlanning.planningGuidelinesTemplate"
                ]
              }
              dirty={isPromptTemplateDirty(
                "xmlVisualPlanning.planningGuidelinesTemplate",
              )}
              saving={
                promptTemplateFeedback[
                  "xmlVisualPlanning.planningGuidelinesTemplate"
                ].saving
              }
              onSave={() =>
                void savePromptTemplate(
                  "xmlVisualPlanning.planningGuidelinesTemplate",
                )
              }
              onReset={() =>
                resetPromptTemplate(
                  "xmlVisualPlanning.planningGuidelinesTemplate",
                )
              }
              minHeightClassName="min-h-[560px]"
              previewValues={xmlVisualPlanningPromptPreviewValues}
            >
                <p>
                  This shared template is rendered first, then injected into
                  the full generate/revise prompts wherever{" "}
                  <code>{"{{planningVisualsGuidelines}}"}</code> appears.
                </p>
                <p>
                  Use this for the common visual-planning context, schema, XML
                  semantics, and other guidance that should stay synchronized
                  between generate and revise runs.
                </p>
            </PromptTemplateEditorCard>

            <PromptTemplateEditorCard
              title="Individual motion graphic template prompt"
              value={xmlVisualPlanningSettings.motionGraphicTemplatePromptTemplate}
              onChange={(value) =>
                setPromptTemplateValue(
                  "xmlVisualPlanning.motionGraphicTemplatePromptTemplate",
                  value,
                )
              }
              {...getPromptTemplateFocusHandlers(
                "xmlVisualPlanning.motionGraphicTemplatePromptTemplate",
              )}
              feedback={
                promptTemplateFeedback[
                  "xmlVisualPlanning.motionGraphicTemplatePromptTemplate"
                ]
              }
              dirty={isPromptTemplateDirty(
                "xmlVisualPlanning.motionGraphicTemplatePromptTemplate",
              )}
              saving={
                promptTemplateFeedback[
                  "xmlVisualPlanning.motionGraphicTemplatePromptTemplate"
                ].saving
              }
              onSave={() =>
                void savePromptTemplate(
                  "xmlVisualPlanning.motionGraphicTemplatePromptTemplate",
                )
              }
              onReset={() =>
                resetPromptTemplate(
                  "xmlVisualPlanning.motionGraphicTemplatePromptTemplate",
                )
              }
              minHeightClassName="min-h-[360px]"
              previewValues={xmlMotionGraphicTemplatePromptPreviewValues}
            >
                <p>
                  This template is rendered once for each enabled motion
                  graphic template, and <code>{"{{motionGraphicTemplates}}"}</code>{" "}
                  is only the newline-joined result of those rendered blocks.
                </p>
                <p>
                  Put labels, formatting, and usage wording here if you want to
                  change how each motion graphic appears in Scribe’s available
                  templates list.
                </p>
            </PromptTemplateEditorCard>

            <PromptTemplateEditorCard
              title="Full generate prompt template"
              value={xmlVisualPlanningSettings.promptTemplate}
              onChange={(value) =>
                setPromptTemplateValue(
                  "xmlVisualPlanning.promptTemplate",
                  value,
                )
              }
              {...getPromptTemplateFocusHandlers(
                "xmlVisualPlanning.promptTemplate",
              )}
              feedback={promptTemplateFeedback["xmlVisualPlanning.promptTemplate"]}
              dirty={isPromptTemplateDirty("xmlVisualPlanning.promptTemplate")}
              saving={
                promptTemplateFeedback["xmlVisualPlanning.promptTemplate"]
                  .saving
              }
              onSave={() =>
                void savePromptTemplate("xmlVisualPlanning.promptTemplate")
              }
              onReset={() =>
                resetPromptTemplate("xmlVisualPlanning.promptTemplate")
              }
              minHeightClassName="min-h-[560px]"
              previewValues={xmlVisualPlanningPromptPreviewValues}
            >
                <p>
                  Runtime placeholders stay in this template because the setting
                  is global, but this field is the real prompt surface used at
                  runtime for Scribe XML visual planning on initial generation.
                  Keep labels like “Selected hook:” inline here when you want
                  them always visible.
                </p>
                <p>
                  Keep this field as the complete top-level prompt. If you
                  change artifact instructions or placeholder names here, the
                  Plan Visuals runtime behavior will change immediately.
                </p>
            </PromptTemplateEditorCard>

            <PromptTemplateEditorCard
              title="Full revise prompt template"
              value={xmlVisualPlanningSettings.revisePromptTemplate}
              onChange={(value) =>
                setPromptTemplateValue(
                  "xmlVisualPlanning.revisePromptTemplate",
                  value,
                )
              }
              {...getPromptTemplateFocusHandlers(
                "xmlVisualPlanning.revisePromptTemplate",
              )}
              feedback={
                promptTemplateFeedback[
                  "xmlVisualPlanning.revisePromptTemplate"
                ]
              }
              dirty={isPromptTemplateDirty(
                "xmlVisualPlanning.revisePromptTemplate",
              )}
              saving={
                promptTemplateFeedback[
                  "xmlVisualPlanning.revisePromptTemplate"
                ].saving
              }
              onSave={() =>
                void savePromptTemplate(
                  "xmlVisualPlanning.revisePromptTemplate",
                )
              }
              onReset={() =>
                resetPromptTemplate(
                  "xmlVisualPlanning.revisePromptTemplate",
                )
              }
              minHeightClassName="min-h-[560px]"
              previewValues={xmlVisualPlanningPromptPreviewValues}
            >
                <p>
                  This is the complete top-level prompt used when Plan Visuals
                  revises an existing XML plan. Put the revision-notes label
                  and <code>{"{{revisionNotes}}"}</code> directly in this
                  template where you want those notes to appear.
                </p>
                <p>
                  The dashboard does not append hidden motion-graphic or schema
                  instructions after this template. Runtime data must appear as
                  placeholders in this field or the generate field above.
                </p>
            </PromptTemplateEditorCard>

            <PromptPlaceholderCard
              title="Generate/revise prompt placeholders"
              rows={XML_VISUAL_PLANNING_PLACEHOLDER_ROWS}
            />

            <PromptPlaceholderCard
              title="Individual motion graphic template placeholders"
              rows={XML_MOTION_GRAPHIC_TEMPLATE_PLACEHOLDER_ROWS}
            />
          </div>
        ) : null}
      </div>
    </section>
  );

  const soundLibrarySection = (
    <section id="sound-library" className="scroll-mt-24">
      <div className="space-y-6">
        {soundDesignSettings ? (
          <div className="space-y-6">
            {activeSection === "plan-sound-design" ? (
            <div className="space-y-6">
              <PromptTemplateEditorCard
                title="Full Plan Sound Design prompt template"
                description="The actual full top-level prompt template the dashboard sends to Scribe when Plan Sound Design runs. Keep labels, file-writing rules, and placeholder usage inline here when you want them enforced every time."
                value={soundDesignSettings.promptTemplate}
                onChange={(value) =>
                  setPromptTemplateValue(
                    "soundDesign.promptTemplate",
                    value,
                  )
                }
                {...getPromptTemplateFocusHandlers("soundDesign.promptTemplate")}
                feedback={promptTemplateFeedback["soundDesign.promptTemplate"]}
                dirty={isPromptTemplateDirty("soundDesign.promptTemplate")}
                saving={
                  promptTemplateFeedback["soundDesign.promptTemplate"].saving
                }
                onSave={() =>
                  void savePromptTemplate("soundDesign.promptTemplate")
                }
                onReset={() =>
                  resetPromptTemplate("soundDesign.promptTemplate")
                }
                minHeightClassName="min-h-[320px]"
                previewValues={soundDesignPromptPreviewValues}
              />
              <PromptTemplateEditorCard
                title="Conditional revision-notes prompt template"
                description="Renders only when rerun revision notes exist. The rendered result becomes {{revisionNotesBlock}} inside the full prompt above."
                value={soundDesignSettings.revisionPromptTemplate}
                onChange={(value) =>
                  setPromptTemplateValue(
                    "soundDesign.revisionPromptTemplate",
                    value,
                  )
                }
                {...getPromptTemplateFocusHandlers(
                  "soundDesign.revisionPromptTemplate",
                )}
                feedback={
                  promptTemplateFeedback[
                    "soundDesign.revisionPromptTemplate"
                  ]
                }
                dirty={isPromptTemplateDirty(
                  "soundDesign.revisionPromptTemplate",
                )}
                saving={
                  promptTemplateFeedback[
                    "soundDesign.revisionPromptTemplate"
                  ].saving
                }
                onSave={() =>
                  void savePromptTemplate(
                    "soundDesign.revisionPromptTemplate",
                  )
                }
                onReset={() =>
                  resetPromptTemplate(
                    "soundDesign.revisionPromptTemplate",
                  )
                }
                minHeightClassName="min-h-[140px]"
                previewValues={soundDesignRevisionPromptPreviewValues}
              />
              <PromptPlaceholderCard
                title="Plan Sound Design prompt placeholders"
                rows={SOUND_DESIGN_PLACEHOLDER_ROWS}
              />
              <PromptPlaceholderCard
                title="Plan Sound Design revision-notes placeholders"
                rows={SOUND_DESIGN_REVISION_PLACEHOLDER_ROWS}
              />
            </div>
            ) : (
	              <Card className="space-y-4 p-4">
	                <div className="flex flex-wrap items-start justify-between gap-3">
	                  <div>
	                    <h3 className="text-sm font-medium text-foreground">
	                      Mix defaults
	                    </h3>
	                  </div>
	                  {mixDefaultsDirty ? (
	                    <SectionActions
	                      dirty={mixDefaultsDirty}
	                      saving={sectionFeedback["sound-library"].saving}
	                      saveLabel="Save mix defaults"
	                      onSave={() => void saveSoundMixDefaults()}
	                      onReset={resetSoundMixDefaults}
	                    />
	                  ) : null}
	                </div>
		                <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-4">
		                  {[
		                    { key: "defaultDuckingDb", label: "Default ducking (dB)", min: -24, max: 0, step: 1 },
		                    { key: "maxConcurrentOneShots", label: "Max concurrent one-shots", min: 1, max: 8, step: 1 },
		                    { key: "musicDuckingDb", label: "Music ducking (dB)", min: -24, max: 0, step: 1 },
		                    { key: "musicEqCutDb", label: "Music mid EQ cut (dB)", min: -18, max: 0, step: 1 },
		                    { key: "musicEqFrequencyHz", label: "Music EQ frequency (Hz)", min: 120, max: 8000, step: 50 },
		                    { key: "musicEqQ", label: "Music EQ Q", min: 0.1, max: 10, step: 0.1 },
		                    { key: "musicLowCutHz", label: "Music low cut (Hz, 0 off)", min: 0, max: 500, step: 5 },
		                    { key: "musicHighCutHz", label: "Music high cut (Hz, 0 off)", min: 0, max: 20000, step: 100 },
		                  ].map((control) => (
		                    <div key={control.key} className="space-y-2">
		                      <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
		                        {control.label}
		                      </label>
		                      <Input
		                        type="number"
		                        min={control.min}
		                        max={control.max}
		                        step={control.step}
		                        value={
		                          soundDesignSettings[
		                            control.key as keyof Pick<
		                              SoundDesignSettings,
		                              | "defaultDuckingDb"
		                              | "maxConcurrentOneShots"
		                              | "musicDuckingDb"
		                              | "musicEqCutDb"
		                              | "musicEqFrequencyHz"
		                              | "musicEqQ"
		                              | "musicLowCutHz"
		                              | "musicHighCutHz"
		                            >
		                          ]
		                        }
		                        onChange={(event) => {
		                          updateSectionFeedbackState("sound-library", {
		                            error: null,
		                            message: null,
		                          });
		                          const value = Number(event.target.value);
		                          setSoundDesignSettings({
		                            ...soundDesignSettings,
		                            [control.key]: Math.max(
		                              control.min,
		                              Math.min(control.max, Number.isFinite(value) ? value : control.min),
		                            ),
		                          });
		                        }}
		                      />
		                    </div>
		                  ))}
		                </div>
	              </Card>
            )}

	            {activeSection === "generate-sound-design" ? (
	              <>
	                <Card className="space-y-5 p-5">
	                  <div className="flex flex-wrap items-center justify-between gap-3">
	                    <h3 className="text-sm font-medium text-foreground">
	                      Selected sound
	                    </h3>
	                    <div className="flex flex-wrap items-center justify-end gap-2">
	                      {audioLibraryHealth.missingAudioCount > 0 ? (
	                        <Badge variant="warning">
	                          {audioLibraryHealth.missingAudioCount} missing audio
	                        </Badge>
	                      ) : null}
	                      {audioLibraryHealth.missingMetadataCount > 0 ? (
	                        <Badge variant="warning">
	                          {audioLibraryHealth.missingMetadataCount} missing metadata
	                        </Badge>
	                      ) : null}
	                      <Button
	                        variant="outline"
	                        onClick={addMusic}
	                        disabled={sectionFeedback["music-library"].saving}
	                      >
	                        Add music
	                      </Button>
	                      <Button
	                        variant="outline"
	                        onClick={addSound}
	                        disabled={sectionFeedback["sound-library"].saving}
	                      >
	                        Add SFX
	                      </Button>
	                    </div>
	                  </div>
	                  <Button
	                    type="button"
	                    variant="outline"
                    className="h-auto w-full justify-between px-3 py-2 text-left"
                    onClick={() => {
                      setPendingAudioLibrarySelection(
                        selectedAudioLibraryKind === "music" && selectedMusic
                          ? { kind: "music", id: selectedMusic.id }
                          : selectedSound
                            ? { kind: "sfx", id: selectedSound.id }
                            : null,
                      );
                      setAudioLibraryPickerOpen(true);
                    }}
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium text-foreground">
                        {selectedAudioClip?.name || "Select an audio clip"}
                      </span>
                      {selectedAudioClip ? (
                        <span className="mt-0.5 block truncate text-xs font-normal text-muted-foreground">
                          {selectedAudioClip.kindLabel}
                          {selectedAudioClip.status !== "ready"
                            ? ` · ${selectedAudioClip.status}`
                            : ""}
                        </span>
                      ) : null}
                    </span>
                    <ChevronDown
                      aria-hidden="true"
                      className="h-4 w-4 shrink-0 text-muted-foreground"
                    />
                  </Button>
                </Card>

                <DialogOverlay
                  open={audioLibraryPickerOpen}
                  onClick={() => setAudioLibraryPickerOpen(false)}
                >
	                  <DialogContent
	                    size="lg"
	                    className="flex h-[88vh] max-h-[88vh] w-[min(96vw,80rem)] max-w-none flex-col overflow-hidden"
	                    onClick={(event) => event.stopPropagation()}
	                  >
	                    <DialogHeader className="mb-4 shrink-0">
	                      <DialogTitle>Select an audio clip</DialogTitle>
	                    </DialogHeader>

	                    <div
	                      className="flex min-h-0 flex-1 flex-col gap-4"
	                      data-audio-library-pane="browser"
	                    >
                      <div className="relative">
                        <Search
                          aria-hidden="true"
                          className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                        />
                    <Input
                      className="h-10 rounded-full pl-10"
                      value={soundLibrarySearchQuery}
                      onChange={(event) =>
                        setSoundLibrarySearchQuery(event.target.value)
                      }
                      placeholder="Search names, tags, metadata, source..."
                    />
                  </div>

		                  <div className="space-y-3">
		                    <div className="flex flex-wrap items-center gap-3">
		                      <TabsList>
		                        {[
		                          { value: "all", label: "All" },
		                          { value: "music", label: "Music" },
		                          { value: "sfx", label: "SFX" },
		                        ].map((filter) => (
		                          <TabsTrigger
		                            key={filter.value}
		                            type="button"
		                            active={audioLibraryTypeFilter === filter.value}
		                            onClick={() =>
		                              setAudioLibraryTypeFilter(
		                                filter.value as AudioLibraryTypeFilter,
		                              )
		                            }
		                          >
		                            {filter.label}
		                          </TabsTrigger>
		                        ))}
		                      </TabsList>
		                      <TabsList>
		                        {[
		                          {
		                            value: "all",
		                            label: `All files (${soundLibraryItemCount})`,
		                          },
		                          {
		                            value: "with-audio",
		                            label: `Audio ready (${soundLibraryTotalWithAudioCount})`,
		                          },
		                          {
		                            value: "missing-audio",
		                            label: `Needs audio (${soundLibraryItemCount - soundLibraryTotalWithAudioCount})`,
		                          },
		                        ].map((filter) => (
		                          <TabsTrigger
		                            key={filter.value}
		                            type="button"
		                            active={soundLibraryFileFilter === filter.value}
		                            onClick={() =>
		                              setSoundLibraryFileFilter(
		                                filter.value as SoundLibraryFileFilter,
		                              )
		                            }
		                          >
		                            {filter.label}
		                          </TabsTrigger>
		                        ))}
		                      </TabsList>
		                      <Button
		                        type="button"
		                        variant="ghost"
		                        size="sm"
		                        className="ml-auto"
		                        onClick={() => {
		                          setSoundLibrarySearchQuery("");
		                          setAudioLibraryTypeFilter("all");
			                          setSoundLibraryCategoryFilter("all");
			                          setSoundLibraryFileFilter("all");
			                          setAudioLibraryAvailabilityFilter("all");
			                          setMusicMoodFilter("all");
			                          setMusicEnergyFilter("all");
			                        }}
		                        disabled={
		                          !soundLibrarySearchQuery &&
			                          audioLibraryTypeFilter === "all" &&
			                          soundLibraryCategoryFilter === "all" &&
			                          soundLibraryFileFilter === "all" &&
			                          audioLibraryAvailabilityFilter === "all" &&
			                          musicMoodFilter === "all" &&
			                          musicEnergyFilter === "all"
			                        }
		                      >
		                        Clear filters
		                      </Button>
		                    </div>
			                    <div className="grid gap-2 md:grid-cols-4">
	                      <div className="space-y-1">
	                        <label className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
	                          Mood
	                        </label>
	                        <Select
	                          value={musicMoodFilter}
	                          onChange={(event) =>
	                            setMusicMoodFilter(event.target.value)
	                          }
	                        >
	                          <option value="all">All music moods</option>
	                          {musicMoodOptions.map((mood) => (
	                            <option key={mood} value={mood}>
	                              {mood}
	                            </option>
	                          ))}
	                        </Select>
	                      </div>
	                      <div className="space-y-1">
	                        <label className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
	                          Energy
	                        </label>
	                        <Select
	                          value={musicEnergyFilter}
	                          onChange={(event) =>
	                            setMusicEnergyFilter(event.target.value)
	                          }
	                        >
	                          <option value="all">All energy levels</option>
	                          {musicEnergyOptions.map((energy) => (
	                            <option key={energy} value={energy}>
	                              {energy}
	                            </option>
	                          ))}
	                        </Select>
	                      </div>
		                      <div className="space-y-1">
		                        <label className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
		                          Category
	                        </label>
	                        <Select
	                          value={soundLibraryCategoryFilter}
	                          onChange={(event) =>
	                            setSoundLibraryCategoryFilter(
	                              event.target.value as SoundLibraryCategoryFilter,
	                            )
	                          }
	                        >
	                          <option value="all">All categories</option>
	                          {soundLibraryCategorySummaries.map((summary) => (
	                            <option key={summary.key} value={summary.value}>
	                              {summary.label}
	                            </option>
	                          ))}
		                        </Select>
		                      </div>
		                      <div className="space-y-1">
		                        <label className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
		                          Availability
		                        </label>
		                        <Select
		                          value={audioLibraryAvailabilityFilter}
		                          onChange={(event) =>
		                            setAudioLibraryAvailabilityFilter(
		                              event.target.value as AudioLibraryAvailabilityFilter,
		                            )
		                          }
		                        >
		                          <option value="all">All availability</option>
		                          <option value="planning">Available for planning</option>
		                          <option value="not-planning">Not available for planning</option>
		                          <option value="generation">Available for generation</option>
		                          <option value="not-generation">Not available for generation</option>
		                        </Select>
		                      </div>
		                    </div>
	                  </div>

	                  <div className="flex min-h-0 flex-1 flex-col gap-2">
	                    <div className="flex items-center justify-between gap-2">
	                      <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
	                        Assets
	                      </label>
	                      <span className="text-[11px] text-muted-foreground">
	                        {filteredSoundLibraryItemCount} shown
	                      </span>
	                    </div>
	                    <div className="min-h-0 flex-1 space-y-2 overflow-y-auto rounded-lg border border-border bg-background/40 p-2">
	                      {sortedFilteredSoundLibrary.map((sound) => {
	                        const selected =
	                          pendingAudioLibrarySelection?.kind === "sfx" &&
	                          pendingAudioLibrarySelection.id === sound.id;
		                        const readiness = getSoundReadiness(sound);
		                        const categoryLabel = getSoundLibraryCategoryLabel(
		                          sound.category,
		                        );
		                        const cacheBust = sound.uploadedAt
		                          ? Date.parse(sound.uploadedAt)
		                          : undefined;
		                        const audioUrl =
		                          sound.audioUrl ||
		                          buildSavedSoundAudioUrl(
		                            sound,
		                            typeof cacheBust === "number" &&
		                              Number.isFinite(cacheBust)
		                              ? cacheBust
		                              : undefined,
		                          );
		                        return (
		                          <button
	                            key={sound.id}
	                            type="button"
	                            data-audio-asset-id={sound.id}
	                            data-audio-asset-kind="sfx"
	                            onClick={() => {
	                              setPendingAudioLibrarySelection({
	                                kind: "sfx",
	                                id: sound.id,
	                              });
	                            }}
	                            className={`w-full cursor-pointer rounded-lg border px-3 py-3 text-left transition active:scale-[0.997] active:bg-primary/15 ${selected ? "border-primary/70 bg-primary/15 shadow-sm" : "border-border/70 bg-background/70 hover:border-primary/50 hover:bg-primary/5 hover:shadow-sm"}`}
	                          >
	                            <div className="flex items-start justify-between gap-3">
	                              <div className="min-w-0">
	                                <div className="truncate text-sm font-medium text-foreground">
	                                  {sound.name}
	                                </div>
	                              </div>
	                              <div className="flex shrink-0 flex-wrap justify-end gap-1.5">
	                                <Badge variant="outline">
	                                  {categoryLabel}
	                                </Badge>
	                                {readiness !== "ready" ? (
	                                  <Badge variant="outline">
	                                    {readiness}
	                                  </Badge>
	                                ) : null}
	                              </div>
	                            </div>
	                            {sound.tags.length > 0 ? (
	                              <div className="mt-2 flex flex-wrap gap-1.5">
	                                {sound.tags.map((tag) => (
	                                  <span
	                                    key={tag}
	                                    className="rounded-full bg-muted/70 px-2 py-0.5 text-[11px] text-muted-foreground"
	                                  >
	                                    {tag}
	                                  </span>
	                                ))}
		                              </div>
		                            ) : null}
		                            {audioUrl ? (
		                              <audio
		                                controls
		                                preload="none"
		                                className="mt-2 w-full"
		                                src={audioUrl}
		                                onClick={(event) =>
		                                  event.stopPropagation()
		                                }
		                              />
		                            ) : null}
		                          </button>
		                        );
	                      })}
	                      {filteredMusicLibrary.length > 0 ? (
	                        <>
	                          {filteredMusicLibrary.map((track) => {
	                            const audioUrl = buildSavedMusicAudioUrl(
	                              track,
                              track.generatedAt
                                ? new Date(track.generatedAt).getTime()
                                : undefined,
                            );
                            const selected =
                              pendingAudioLibrarySelection?.kind === "music" &&
                              pendingAudioLibrarySelection.id === track.id;
                            const lufs =
                              typeof track.integratedLufs === "number"
                                ? `${track.integratedLufs.toFixed(1)} LUFS`
                                : null;
                            const readiness = getMusicTrackReadiness(track);
                            const durationSeconds =
                              track.durationSeconds ||
                              track.generatedDurationSeconds ||
                              undefined;
                            return (
                              <button
                                key={track.id}
                                type="button"
                                data-audio-asset-id={track.id}
                                data-audio-asset-kind="music"
                                onClick={() => {
                                  setPendingAudioLibrarySelection({
                                    kind: "music",
                                    id: track.id,
                                  });
                                }}
                                className={`w-full cursor-pointer rounded-lg border px-3 py-3 text-left transition active:scale-[0.997] active:bg-primary/15 ${selected ? "border-primary/70 bg-primary/15 shadow-sm" : "border-border/70 bg-background/70 hover:border-primary/50 hover:bg-primary/5 hover:shadow-sm"}`}
                              >
                                <div className="flex items-start justify-between gap-3">
                                  <div className="min-w-0">
                                    <div className="truncate text-sm font-medium text-foreground">
                                      {track.name}
                                    </div>
                                    {track.mood ||
                                    track.pacing ||
                                    typeof track.bpm === "number" ? (
                                      <div className="mt-1 text-[11px] text-muted-foreground">
                                        {[
                                          track.mood,
                                          track.pacing,
                                          typeof track.bpm === "number"
                                            ? `${track.bpm} BPM`
                                            : null,
                                        ]
                                          .filter(Boolean)
                                          .join(" · ")}
                                      </div>
                                    ) : null}
                                  </div>
                                  <div className="flex shrink-0 flex-wrap justify-end gap-1.5">
                                    <Badge variant="outline">Music</Badge>
                                    {readiness !== "ready" ? (
                                      <Badge variant="outline">
                                        {readiness}
                                      </Badge>
                                    ) : null}
                                  </div>
                                </div>
                                {audioUrl ? (
                                  <audio
                                    controls
                                    preload="none"
                                    className="mt-2 w-full"
                                    src={audioUrl}
                                    onClick={(event) =>
                                      event.stopPropagation()
                                    }
                                  />
                                ) : null}
                                <div className="mt-2 flex flex-wrap gap-1.5 text-[11px]">
                                  {durationSeconds ? (
                                    <span className="rounded bg-muted/60 px-2 py-0.5 text-muted-foreground">
                                      {formatSecondsLabel(durationSeconds)}
                                    </span>
                                  ) : null}
                                  {track.energy ? (
                                    <span className="rounded bg-muted/60 px-2 py-0.5 text-muted-foreground">
                                      {track.energy}
                                    </span>
                                  ) : null}
                                  {track.key ? (
                                    <span className="rounded bg-muted/60 px-2 py-0.5 text-muted-foreground">
                                      {track.key}
                                    </span>
                                  ) : null}
                                  {track.loopFriendly === true ? (
                                    <span className="rounded bg-muted/60 px-2 py-0.5 text-muted-foreground">
                                      loop-friendly
                                    </span>
                                  ) : null}
                                  {(track.tags || []).slice(0, 3).map((tag) => (
                                    <span
                                      key={tag}
                                      className="rounded bg-muted/60 px-2 py-0.5 text-muted-foreground"
                                    >
                                      {tag}
                                    </span>
                                  ))}
                                </div>
                                <div className="mt-2 line-clamp-2 text-[11px] text-muted-foreground">
                                  {[
                                    track.emotionalArc,
                                    track.intensityCurve,
                                    lufs,
                                    (track.recommendedSections || [])
                                      .slice(0, 3)
                                      .join(", "),
                                  ]
                                    .filter(Boolean)
                                    .join(" · ") || "Saved music track"}
                                </div>
	                              </button>
	                            );
	                          })}
	                        </>
	                      ) : null}
                      {filteredSoundLibraryItemCount === 0 ? (
                        <div className="rounded-lg border border-dashed border-border p-3 text-xs text-muted-foreground">
                          No library entries match the current search/filter
                          yet.
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>
	                    <DialogFooter className="mt-4 shrink-0">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setAudioLibraryPickerOpen(false)}
                      >
                        Cancel
                      </Button>
                      <Button
                        type="button"
                        disabled={!pendingAudioLibrarySelection}
                        onClick={() => {
                          if (!pendingAudioLibrarySelection) return;
                          selectAudioSelection(pendingAudioLibrarySelection);
                          setAudioLibraryPickerOpen(false);
                        }}
                      >
                        Select
                      </Button>
                    </DialogFooter>
	                  </DialogContent>
	                </DialogOverlay>

	                <DialogOverlay
	                  open={audioClipNameDialogOpen}
	                  onClick={() => setAudioClipNameDialogOpen(false)}
	                >
	                  <DialogContent
	                    size="sm"
	                    onClick={(event) => event.stopPropagation()}
	                  >
	                    <DialogHeader>
	                      <DialogTitle>Edit clip name</DialogTitle>
	                    </DialogHeader>
	                    <div className="space-y-2">
	                      <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
	                        Name
	                      </label>
	                      <Input
	                        value={audioClipNameDraft}
	                        onChange={(event) => setAudioClipNameDraft(event.target.value)}
	                        onKeyDown={(event) => {
	                          if (event.key === "Enter") saveSelectedAudioClipName();
	                        }}
	                        autoFocus
	                      />
	                    </div>
	                    <DialogFooter>
	                      <Button
	                        type="button"
	                        variant="outline"
	                        onClick={() => setAudioClipNameDialogOpen(false)}
	                      >
	                        Cancel
	                      </Button>
	                      <Button
	                        type="button"
	                        onClick={saveSelectedAudioClipName}
	                        disabled={!audioClipNameDraft.trim()}
	                      >
	                        Save name
	                      </Button>
	                    </DialogFooter>
	                  </DialogContent>
	                </DialogOverlay>

	                <DialogOverlay
	                  open={audioClipTagsDialogOpen}
	                  onClick={() => setAudioClipTagsDialogOpen(false)}
	                >
	                  <DialogContent
	                    size="md"
	                    className="max-h-[80vh] overflow-hidden"
	                    onClick={(event) => event.stopPropagation()}
	                  >
	                    <DialogHeader>
	                      <DialogTitle>Edit clip tags</DialogTitle>
	                    </DialogHeader>
	                    <div className="space-y-4">
	                      <div className="flex gap-2">
	                        <Input
	                          value={audioClipNewTagDraft}
	                          onChange={(event) => setAudioClipNewTagDraft(event.target.value)}
	                          onKeyDown={(event) => {
	                            if (event.key === "Enter") {
	                              event.preventDefault();
	                              addAudioClipTagDraft();
	                            }
	                          }}
	                          placeholder="Add tag"
	                        />
	                        <Button
	                          type="button"
	                          variant="outline"
	                          onClick={addAudioClipTagDraft}
	                          disabled={!audioClipNewTagDraft.trim()}
	                        >
	                          Add
	                        </Button>
	                      </div>
	                      <div className="max-h-[44vh] space-y-2 overflow-y-auto rounded-md border border-border p-2">
	                        {audioClipTagOptions.length > 0 ? (
	                          audioClipTagOptions.map((tag) => {
	                            const selected = audioClipTagDrafts.some(
	                              (item) => item.toLowerCase() === tag.toLowerCase(),
	                            );
	                            return (
	                              <button
	                                key={tag}
	                                type="button"
	                                className={`flex w-full items-center justify-between rounded-md border px-3 py-2 text-left text-sm transition ${selected ? "border-primary/60 bg-primary/10 text-foreground" : "border-border bg-background hover:bg-accent"}`}
	                                onClick={() => toggleAudioClipTagDraft(tag)}
	                              >
	                                <span>{tag}</span>
	                                {selected ? (
	                                  <Badge variant="secondary">Selected</Badge>
	                                ) : null}
	                              </button>
	                            );
	                          })
	                        ) : (
	                          <p className="px-2 py-4 text-sm text-muted-foreground">
	                            No tags yet. Add one above.
	                          </p>
	                        )}
	                      </div>
	                    </div>
	                    <DialogFooter>
	                      <Button
	                        type="button"
	                        variant="outline"
	                        onClick={() => setAudioClipTagsDialogOpen(false)}
	                      >
	                        Cancel
	                      </Button>
	                      <Button type="button" onClick={saveSelectedAudioClipTags}>
	                        Save tags
	                      </Button>
	                    </DialogFooter>
	                  </DialogContent>
	                </DialogOverlay>

	                <DialogOverlay
	                  open={audioClipDeleteDialogOpen}
	                  onClick={() => setAudioClipDeleteDialogOpen(false)}
	                >
	                  <DialogContent
	                    size="sm"
	                    onClick={(event) => event.stopPropagation()}
	                  >
	                    <DialogHeader>
	                      <DialogTitle>Delete audio clip?</DialogTitle>
	                    </DialogHeader>
	                    <p className="text-sm text-muted-foreground">
	                      This removes{" "}
	                      <span className="font-medium text-foreground">
	                        {selectedAudioClip?.name || "this audio clip"}
	                      </span>{" "}
	                      from the saved audio library metadata. This cannot be undone
	                      from this dialog.
	                    </p>
	                    <DialogFooter>
	                      <Button
	                        type="button"
	                        variant="outline"
	                        onClick={() => setAudioClipDeleteDialogOpen(false)}
	                      >
	                        Cancel
	                      </Button>
	                      <Button
	                        type="button"
	                        variant="destructive"
	                        onClick={confirmDeleteSelectedAudioClip}
	                      >
	                        Delete
	                      </Button>
	                    </DialogFooter>
	                  </DialogContent>
	                </DialogOverlay>

			                {selectedAudioLibraryKind === "sfx" && selectedSound ? (
			                  <Card className="space-y-4 p-5" data-audio-library-pane="detail">
			                    <div className="flex flex-wrap items-start justify-between gap-3">
			                      <div className="min-w-0 space-y-2">
			                        <div className="flex min-w-0 items-center gap-2">
			                          <h3 className="truncate text-base font-semibold text-foreground">
			                            {selectedSound.name}
			                          </h3>
			                          <Button
			                            type="button"
			                            variant="ghost"
			                            size="icon"
			                            className="h-7 w-7 shrink-0"
			                            onClick={openSelectedAudioClipNameDialog}
			                            aria-label="Edit sound name"
			                          >
			                            <Pencil aria-hidden="true" className="h-3.5 w-3.5" />
			                          </Button>
				                        </div>
				                        <div className="flex flex-wrap items-center gap-1.5">
				                          <AudioClipKindBadge
				                            leftLabel="SFX"
				                            rightLabel={getSoundLibraryCategoryLabel(
				                              selectedSound.category,
				                            )}
				                          />
				                          {selectedAudioClipTags.length > 0 ? (
				                            selectedAudioClipTags.map((tag) => (
				                              <Badge key={tag} variant="secondary">
			                                {tag}
			                              </Badge>
			                            ))
			                          ) : (
			                            <span className="text-xs text-muted-foreground">
			                              No tags
			                            </span>
			                          )}
			                          <Button
			                            type="button"
			                            variant="ghost"
			                            size="icon"
			                            className="h-7 w-7"
			                            onClick={openSelectedAudioClipTagsDialog}
			                            aria-label="Edit sound tags"
			                          >
			                            <Pencil aria-hidden="true" className="h-3.5 w-3.5" />
			                          </Button>
			                        </div>
			                      </div>
			                      <div className="flex flex-wrap items-center justify-end gap-2">
			                        {getSoundReadiness(selectedSound) !== "ready" ? (
			                          <Badge variant="warning">
		                            {getSoundReadiness(selectedSound)}
		                          </Badge>
		                        ) : null}
		                        {selectedAudioClipDirty ? (
		                          <SectionActions
		                            dirty={selectedAudioClipDirty}
		                            saving={sectionFeedback["sound-library"].saving}
		                            saveLabel="Save audio clip"
		                            onSave={() => void saveSelectedAudioClip()}
			                            onReset={resetSelectedAudioClip}
			                          />
			                        ) : null}
			                        <DropdownMenu>
			                          <DropdownMenuTrigger asChild>
			                            <Button
			                              type="button"
			                              variant="ghost"
			                              size="icon"
			                              aria-label="Sound actions"
			                            >
			                              <MoreVertical aria-hidden="true" className="h-4 w-4" />
			                            </Button>
			                          </DropdownMenuTrigger>
			                          <DropdownMenuContent align="end" className="min-w-40">
			                            <DropdownMenuItem
			                              className="text-destructive focus:text-destructive"
			                              disabled={soundDesignSettings.library.length <= 1}
			                              onSelect={() => setAudioClipDeleteDialogOpen(true)}
			                            >
			                              <Trash2 aria-hidden="true" className="mr-2 h-4 w-4" />
			                              Delete sound
			                            </DropdownMenuItem>
			                          </DropdownMenuContent>
			                        </DropdownMenu>
			                      </div>
			                    </div>

	                    <div className="space-y-3 rounded-lg border border-border bg-background/60 p-4">
	                      <div className="flex flex-wrap items-start justify-between gap-3">
	                        <div>
	                          <h4 className="text-sm font-medium text-foreground">
	                            Audio
	                          </h4>
	                          <p className="mt-1 text-xs text-muted-foreground">
	                            Upload, preview, and document the saved source file for this SFX asset.
	                          </p>
	                        </div>
	                        <div className="text-xs text-muted-foreground">
	                          {selectedSound.durationSeconds
	                            ? `${selectedSound.durationSeconds}s`
	                            : "Duration unknown"}
	                          {selectedSound.sampleRate
	                            ? ` · ${selectedSound.sampleRate} Hz`
	                            : ""}
	                          {selectedSound.channels
	                            ? ` · ${selectedSound.channels} ch`
	                            : ""}
	                        </div>
	                      </div>
	                      <div className="flex flex-wrap items-center gap-2 text-xs">
	                        <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-border px-3 py-2 text-xs font-medium text-foreground hover:bg-background/80">
	                          <span>
	                            {selectedSoundUpload?.isUploading
	                              ? "Uploading…"
	                              : selectedSound.audioRelativePath
	                                ? "Replace audio file"
	                                : "Upload audio file"}
	                          </span>
	                          <input
	                            type="file"
	                            accept="audio/*,.wav,.mp3,.m4a,.aac,.ogg,.opus,.webm"
	                            className="hidden"
	                            disabled={selectedSoundUpload?.isUploading}
	                            onChange={(event) => {
	                              const file = event.target.files?.[0];
	                              if (file) {
	                                void uploadSoundFile(file);
	                                event.currentTarget.value = "";
	                              }
	                            }}
	                          />
	                        </label>
	                      </div>
	                      <div className="grid gap-4 md:grid-cols-2">
	                        <div className="space-y-2">
	                          <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
	                            Source
	                          </label>
	                          <Input
	                            value={selectedSound.source || ""}
	                            onChange={(event) =>
	                              updateSelectedSound((sound) => ({
	                                ...sound,
	                                source: event.target.value,
	                              }))
	                            }
	                            placeholder="Internal"
	                          />
	                        </div>
	                        <div className="space-y-2">
	                          <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
	                            License
	                          </label>
	                          <Input
	                            value={selectedSound.license || ""}
	                            onChange={(event) =>
	                              updateSelectedSound((sound) => ({
	                                ...sound,
	                                license: event.target.value,
	                              }))
	                            }
	                            placeholder="Internal"
	                          />
	                        </div>
	                      </div>
	                      {selectedSoundUpload?.error ? (
	                        <ValidationNotice
	                          title="Sound upload failed"
	                          message={selectedSoundUpload.error}
	                        />
	                      ) : null}
	                      <div className="space-y-2">
	                        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
	                          <span className="font-medium uppercase tracking-wide text-muted-foreground">
	                            Waveform sync point
	                          </span>
	                          <span className="text-muted-foreground">
	                            {Math.round((selectedSound.anchorRatio || 0) * 100)}
	                            %
	                            {selectedSound.durationSeconds
	                              ? ` · ${(selectedSound.durationSeconds * (selectedSound.anchorRatio || 0)).toFixed(2)}s`
	                              : ""}
	                          </span>
	                        </div>
	                        <WaveformPreview
	                          peaks={selectedSound.waveformPeaks}
	                          anchorRatio={selectedSound.anchorRatio}
	                          durationSeconds={selectedSound.durationSeconds}
	                          timingType={selectedSound.timingType}
	                          currentTimeSeconds={selectedSoundAudioTime}
	                          onSeekAudio={seekSelectedSoundAudio}
	                          onAnchorChange={(ratio) =>
	                            updateSelectedSound((sound) => ({
	                              ...sound,
	                              anchorRatio: Number(ratio.toFixed(3)),
	                            }))
	                          }
	                        />
	                        <p className="text-xs text-muted-foreground">
	                          This source sync point gives the resolver a direct reference
	                          point inside the source sound. Drag the marker to the
	                          real transient or entry, then use the playhead and
	                          fine-trim strip to tighten point-based assets.
	                        </p>
	                      </div>
	                      {savedSoundAudioUrl ? (
	                        <audio
	                          ref={selectedSoundAudioRef}
	                          controls
	                          className="w-full"
	                          src={savedSoundAudioUrl}
	                          onLoadedMetadata={(event) =>
	                            setSelectedSoundAudioTime(
	                              event.currentTarget.currentTime || 0,
	                            )
	                          }
	                          onTimeUpdate={(event) =>
	                            setSelectedSoundAudioTime(
	                              event.currentTarget.currentTime || 0,
	                            )
	                          }
	                          onSeeked={(event) =>
	                            setSelectedSoundAudioTime(
	                              event.currentTarget.currentTime || 0,
	                            )
	                          }
	                        />
	                      ) : (
	                        <div className="rounded-lg border border-dashed border-border p-3 text-xs text-muted-foreground">
	                          No audio file saved yet. Upload one to make this
	                          library entry usable in project Generate Sound Design
	                          resolution.
	                        </div>
	                      )}
	                    </div>

	                    <div className="space-y-3 rounded-lg border border-border bg-background/60 p-4">
	                      <h4 className="text-sm font-medium text-foreground">
	                        Planning hints
	                      </h4>
	                      <div className="grid gap-4 md:grid-cols-2">
	                        <div className="space-y-2">
	                          <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
	                            Category
	                          </label>
	                          <Select
	                            value={selectedSound.category}
	                            onChange={(event) =>
	                              updateSelectedSound((sound) => ({
	                                ...sound,
	                                category: event.target.value,
	                              }))
	                            }
	                          >
	                            {selectedSound.category.trim() &&
	                            !soundLibraryCategorySummaries.some(
	                              (summary) => summary.value === selectedSound.category,
	                            ) ? (
	                              <option value={selectedSound.category}>
	                                {getSoundLibraryCategoryLabel(selectedSound.category)}
	                              </option>
	                            ) : null}
	                            {soundLibraryCategorySummaries
	                              .filter((summary) => summary.key !== "music")
	                              .map((summary) => (
	                                <option key={summary.key} value={summary.value}>
	                                  {summary.label}
	                                </option>
	                              ))}
	                          </Select>
	                        </div>
	                        <div className="space-y-2">
	                          <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
	                            Timing type
	                          </label>
	                          <Select
	                            value={selectedSound.timingType}
	                            onChange={(event) =>
	                              updateSelectedSound((sound) => ({
	                                ...sound,
	                                timingType: event.target
	                                  .value as SoundLibraryEntry["timingType"],
	                              }))
	                            }
	                          >
	                            <option value="point">Point</option>
	                            <option value="bed">Bed</option>
	                            <option value="riser">Riser</option>
	                          </Select>
	                        </div>
	                      </div>
	                      <div className="space-y-2">
	                        <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
	                          Semantic types
	                        </label>
	                        <div className="flex flex-wrap gap-2">
	                          {(
	                            [
	                              "impact",
	                              "riser",
	                              "click",
	                              "whoosh",
	                              "ambience",
	                            ] as const
	                          ).map((type) => {
	                            const active =
	                              selectedSound.semanticTypes.includes(type);
	                            return (
	                              <Button
	                                key={type}
	                                type="button"
	                                variant={active ? "default" : "outline"}
	                                size="sm"
	                                onClick={() => {
	                                  updateSelectedSound((sound) => {
	                                    const nextTypes = active
	                                      ? sound.semanticTypes.filter(
	                                          (item) => item !== type,
	                                        )
	                                      : [...sound.semanticTypes, type];
	                                    return {
	                                      ...sound,
	                                      semanticTypes:
	                                        nextTypes.length > 0 ? nextTypes : [type],
	                                    };
	                                  });
	                                }}
	                              >
	                                {type}
	                              </Button>
	                            );
	                          })}
	                        </div>
	                      </div>
	                      <div className="grid gap-4 md:grid-cols-3">
	                        <div className="space-y-2">
	                          <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
	                            Style palettes
	                          </label>
	                          <Input
	                            value={(selectedSound.stylePalettes || []).join(", ")}
	                            onChange={(event) =>
	                              updateSelectedSound((sound) => ({
	                                ...sound,
	                                stylePalettes: event.target.value
	                                  .split(",")
	                                  .map((item) => item.trim())
	                                  .filter(Boolean),
	                              }))
	                            }
	                            placeholder="clean tech, premium editorial"
	                          />
	                        </div>
	                        <div className="space-y-2">
	                          <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
	                            Frequency band
	                          </label>
	                          <Select
	                            value={selectedSound.frequencyBand || ""}
	                            onChange={(event) =>
	                              updateSelectedSound((sound) => ({
	                                ...sound,
	                                frequencyBand: event.target.value
	                                  ? (event.target.value as SoundLibraryEntry["frequencyBand"])
	                                  : undefined,
	                              }))
	                            }
	                          >
	                            <option value="">Any / untagged</option>
	                            <option value="low">Low weight</option>
	                            <option value="mid">Mid body</option>
	                            <option value="high">High air</option>
	                            <option value="full-range">Full-range</option>
	                          </Select>
	                        </div>
	                        <div className="space-y-2">
	                          <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
	                            Literalness
	                          </label>
	                          <Select
	                            value={selectedSound.literalness || ""}
	                            onChange={(event) =>
	                              updateSelectedSound((sound) => ({
	                                ...sound,
	                                literalness: event.target.value
	                                  ? (event.target.value as SoundLibraryEntry["literalness"])
	                                  : undefined,
	                              }))
	                            }
	                          >
	                            <option value="">Any / untagged</option>
	                            <option value="literal">Literal</option>
	                            <option value="stylized">Stylized</option>
	                            <option value="emotional-metaphor">Emotional metaphor</option>
	                          </Select>
	                        </div>
	                      </div>
	                      <div className="space-y-2">
	                        <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
	                          Layer roles (comma separated)
	                        </label>
	                        <Input
	                          value={(selectedSound.layerRoles || []).join(", ")}
	                          onChange={(event) =>
	                            updateSelectedSound((sound) => ({
	                              ...sound,
	                              layerRoles: event.target.value
	                                .split(",")
	                                .map((item) => item.trim())
	                                .filter(Boolean),
	                            }))
	                          }
	                          placeholder="weight, body, motion, air, tick, sparkle"
	                        />
	                      </div>
	                      <div className="grid gap-4 md:grid-cols-2">
	                        <div className="space-y-2">
	                          <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
	                            Recommended uses
	                          </label>
	                          <Textarea
	                            value={selectedSound.recommendedUses}
	                            onChange={(event) =>
	                              updateSelectedSound((sound) => ({
	                                ...sound,
	                                recommendedUses: event.target.value,
	                              }))
	                            }
	                            className="min-h-[96px] text-xs"
	                            placeholder="Use for opener punctuation, payoff hits, and fast transitions."
	                          />
	                        </div>
	                        <div className="space-y-2">
	                          <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
	                            Avoid uses
	                          </label>
	                          <Textarea
	                            value={selectedSound.avoidUses}
	                            onChange={(event) =>
	                              updateSelectedSound((sound) => ({
	                                ...sound,
	                                avoidUses: event.target.value,
	                              }))
	                            }
	                            className="min-h-[96px] text-xs"
	                            placeholder="Avoid emotional beds, comedy moments, or heavy trailer styling."
	                          />
	                        </div>
	                      </div>
	                      <div className="space-y-2">
	                        <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
	                          Notes
	                        </label>
	                        <Textarea
	                          value={selectedSound.notes}
	                          onChange={(event) =>
	                            updateSelectedSound((sound) => ({
	                              ...sound,
	                              notes: event.target.value,
	                            }))
	                          }
	                          className="min-h-[96px] text-xs"
	                          placeholder="Optional notes about tone, density, or editorial taste."
	                        />
	                      </div>
	                    </div>

	                    <div className="space-y-3 rounded-lg border border-border bg-background/60 p-4">
	                      <h4 className="text-sm font-medium text-foreground">
	                        Generation and mixing defaults
	                      </h4>
	                      <div className="grid gap-3 sm:grid-cols-2">
	                        {[
	                          {
	                            key: "availableForPlanning",
	                            label: "Available for planning",
	                          },
	                          {
	                            key: "preferredForPlanning",
	                            label: "Preferred for planning",
	                          },
	                          {
	                            key: "availableForGeneration",
	                            label: "Available for generation",
	                          },
	                          {
	                            key: "preferredForGeneration",
	                            label: "Preferred for generation",
	                          },
	                        ].map((toggle) => (
	                          <label
	                            key={toggle.key}
	                            className="flex cursor-pointer items-center gap-2 rounded-md border border-border px-3 py-2 text-xs text-foreground"
	                          >
	                            <input
	                              type="checkbox"
	                              checked={Boolean(
	                                selectedSound[
	                                  toggle.key as keyof SoundLibraryEntry
	                                ],
	                              )}
	                              onChange={(event) =>
	                                updateSelectedSound((sound) => ({
	                                  ...sound,
	                                  [toggle.key]: event.target.checked,
	                                }))
	                              }
	                            />
	                            {toggle.label}
	                          </label>
	                        ))}
	                      </div>
	                      <div className="grid gap-4 md:grid-cols-3">
	                        <div className="space-y-2">
	                          <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
	                            Gain (dB)
	                          </label>
	                          <Input
	                            type="number"
	                            min={-36}
	                            max={12}
	                            step={1}
	                            value={selectedSound.defaultGainDb}
	                            onChange={(event) =>
	                              updateSelectedSound((sound) => ({
	                                ...sound,
	                                defaultGainDb: Math.max(
	                                  -36,
	                                  Math.min(12, Number(event.target.value) || 0),
	                                ),
	                              }))
	                            }
	                          />
	                        </div>
	                        <div className="space-y-2">
	                          <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
	                            Fade in (ms)
	                          </label>
	                          <Input
	                            type="number"
	                            min={0}
	                            max={5000}
	                            step={10}
	                            value={selectedSound.defaultFadeInMs}
	                            onChange={(event) =>
	                              updateSelectedSound((sound) => ({
	                                ...sound,
	                                defaultFadeInMs: Math.max(
	                                  0,
	                                  Math.min(5000, Number(event.target.value) || 0),
	                                ),
	                              }))
	                            }
	                          />
	                        </div>
	                        <div className="space-y-2">
	                          <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
	                            Fade out (ms)
	                          </label>
	                          <Input
	                            type="number"
	                            min={0}
	                            max={5000}
	                            step={10}
	                            value={selectedSound.defaultFadeOutMs}
	                            onChange={(event) =>
	                              updateSelectedSound((sound) => ({
	                                ...sound,
	                                defaultFadeOutMs: Math.max(
	                                  0,
	                                  Math.min(5000, Number(event.target.value) || 0),
	                                ),
	                              }))
	                            }
	                          />
	                        </div>
	                      </div>
	                    </div>
                  </Card>
                ) : null}

		                {selectedAudioLibraryKind === "music" && selectedMusic && videoRender ? (
		                  <Card className="space-y-4 p-5" data-audio-library-pane="detail">
		                    <div className="flex flex-wrap items-start justify-between gap-3">
		                      <div className="min-w-0 space-y-2">
		                        <div className="flex min-w-0 items-center gap-2">
		                          <h3 className="truncate text-base font-semibold text-foreground">
		                            {selectedMusic.name}
		                          </h3>
		                          <Button
		                            type="button"
		                            variant="ghost"
		                            size="icon"
		                            className="h-7 w-7 shrink-0"
		                            onClick={openSelectedAudioClipNameDialog}
		                            aria-label="Edit music name"
		                          >
		                            <Pencil aria-hidden="true" className="h-3.5 w-3.5" />
		                          </Button>
			                        </div>
			                        <div className="flex flex-wrap items-center gap-1.5">
			                          <AudioClipKindBadge
			                            leftLabel="Music"
			                            rightLabel={
			                              getMusicSourceType(selectedMusic) === "ai-generated"
			                                ? "AI generated"
			                                : "Imported/manual"
			                            }
			                          />
			                          {selectedAudioClipTags.length > 0 ? (
			                            selectedAudioClipTags.map((tag) => (
			                              <Badge key={tag} variant="secondary">
		                                {tag}
		                              </Badge>
		                            ))
		                          ) : (
		                            <span className="text-xs text-muted-foreground">
		                              No tags
		                            </span>
		                          )}
		                          <Button
		                            type="button"
		                            variant="ghost"
		                            size="icon"
		                            className="h-7 w-7"
		                            onClick={openSelectedAudioClipTagsDialog}
		                            aria-label="Edit music tags"
		                          >
		                            <Pencil aria-hidden="true" className="h-3.5 w-3.5" />
		                          </Button>
		                        </div>
		                      </div>
		                      <div className="flex flex-wrap items-center justify-end gap-2">
		                        {getMusicTrackReadiness(selectedMusic) !== "ready" ? (
		                          <Badge variant="warning">
		                            {getMusicTrackReadiness(selectedMusic)}
		                          </Badge>
		                        ) : null}
		                        {selectedAudioClipDirty ? (
		                          <SectionActions
		                            dirty={selectedAudioClipDirty}
		                            saving={sectionFeedback["music-library"].saving}
		                            saveLabel="Save audio clip"
		                            onSave={() => void saveSelectedAudioClip()}
		                            onReset={resetSelectedAudioClip}
		                          />
		                        ) : null}
		                        <DropdownMenu>
		                          <DropdownMenuTrigger asChild>
		                            <Button
		                              type="button"
		                              variant="ghost"
		                              size="icon"
		                              aria-label="Music actions"
		                            >
		                              <MoreVertical aria-hidden="true" className="h-4 w-4" />
		                            </Button>
		                          </DropdownMenuTrigger>
		                          <DropdownMenuContent align="end" className="min-w-40">
		                            <DropdownMenuItem
		                              className="text-destructive focus:text-destructive"
		                              disabled={videoRender.musicTracks.length <= 1}
		                              onSelect={() => setAudioClipDeleteDialogOpen(true)}
		                            >
		                              <Trash2 aria-hidden="true" className="mr-2 h-4 w-4" />
		                              Delete music
		                            </DropdownMenuItem>
		                          </DropdownMenuContent>
		                        </DropdownMenu>
		                      </div>
		                    </div>
		                    <div className="space-y-3 rounded-lg border border-border bg-background/60 p-4">
	                      <div className="flex flex-wrap items-start justify-between gap-3">
	                        <div>
                          <h4 className="text-sm font-medium text-foreground">
                            Audio
                          </h4>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {getMusicSourceType(selectedMusic) === "ai-generated"
                              ? "Generate and preview the reusable AI soundtrack file for this music prompt."
                              : "Preview uses the stored imported audio file path for this music asset."}
                          </p>
                        </div>
                        {getMusicSourceType(selectedMusic) === "ai-generated" ? (
                          <Button
                            type="button"
                            onClick={() => void generateMusicPreview()}
                            disabled={
                              musicPreview.isLoading ||
                              sectionFeedback["music-library"].saving
                            }
                          >
                            {musicPreview.isLoading
                              ? "Generating..."
                              : hasGeneratedSoundtrack(selectedMusic)
                                ? "Regenerate soundtrack"
                                : "Generate soundtrack"}
	                          </Button>
	                        ) : null}
	                      </div>
	                      {getMusicSourceType(selectedMusic) === "imported" ? (
	                        <div className="grid gap-4 md:grid-cols-3">
	                          <div className="space-y-2 md:col-span-2">
	                            <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
	                              Source
	                            </label>
	                            <Input
	                              value={selectedMusic.source || ""}
	                              onChange={(event) =>
	                                updateSelectedMusic((track) => ({
	                                  ...track,
	                                  source: event.target.value,
	                                }))
	                              }
	                              placeholder="freesound URL, internal, uploaded file"
	                            />
	                          </div>
	                          <div className="space-y-2">
	                            <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
	                              License
	                            </label>
	                            <Input
	                              value={selectedMusic.license || ""}
	                              onChange={(event) =>
	                                updateSelectedMusic((track) => ({
	                                  ...track,
	                                  license: event.target.value,
	                                }))
	                              }
	                            />
	                          </div>
	                        </div>
	                      ) : null}
	                      <div className="grid gap-4 md:grid-cols-[1fr,160px]">
	                        <div className="space-y-2">
	                          <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                            {getMusicSourceType(selectedMusic) === "ai-generated"
                              ? "Generated audio file path"
                              : "Audio file path"}
                          </label>
                          <Input
                            value={selectedMusic.generatedAudioRelativePath || ""}
                            onChange={(event) =>
                              updateSelectedMusic((track) => ({
                                ...track,
                                generatedAudioRelativePath:
                                  event.target.value || undefined,
                              }))
                            }
                            placeholder="relative path under _music-library"
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                            {getMusicSourceType(selectedMusic) === "ai-generated"
                              ? "Preview duration"
                              : "Duration"}
                          </label>
                          <Input
                            type="number"
                            min={getMusicSourceType(selectedMusic) === "ai-generated" ? 6 : 0}
                            max={getMusicSourceType(selectedMusic) === "ai-generated" ? 30 : 1800}
                            step={0.1}
                            value={
                              getMusicSourceType(selectedMusic) === "ai-generated"
                                ? selectedMusic.previewDurationSeconds ||
                                  selectedMusic.generatedDurationSeconds ||
                                  ""
                                : selectedMusic.durationSeconds ||
                                  selectedMusic.generatedDurationSeconds ||
                                  ""
                            }
                            onChange={(event) =>
                              updateSelectedMusic((track) => ({
                                ...track,
                                ...(getMusicSourceType(track) === "ai-generated"
                                  ? {
                                      previewDurationSeconds:
                                        event.target.value === ""
                                          ? undefined
                                          : Math.max(
                                              6,
                                              Math.min(
                                                30,
                                                Number(event.target.value) || 0,
                                              ),
                                            ),
                                    }
                                  : {
                                      durationSeconds:
                                        event.target.value === ""
                                          ? undefined
                                          : Math.max(
                                              0,
                                              Number(event.target.value) || 0,
                                            ),
                                    }),
                              }))
                            }
                          />
                        </div>
                      </div>
                      {musicPreview.error ? (
                        <ValidationNotice
                          title="Saved soundtrack failed"
                          message={musicPreview.error}
                        />
                      ) : null}
                      {savedMusicAudioUrl ? (
                        <audio controls preload="none" className="w-full" src={savedMusicAudioUrl} />
                      ) : (
                        <div className="rounded-lg border border-dashed border-border p-3 text-xs text-muted-foreground">
                          No previewable audio file exists for this music asset
                          yet. {getMusicSourceType(selectedMusic) === "ai-generated"
                            ? "Generate a soundtrack or provide a valid stored relative path."
                            : "Provide a valid stored relative path for the imported file."}
                        </div>
                      )}
                    </div>

                    <div className="space-y-3 rounded-lg border border-border bg-background/60 p-4">
	                      <h4 className="text-sm font-medium text-foreground">
	                        Planning hints
	                      </h4>
	                      <div className="space-y-2">
	                        <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
	                          Description and notes
	                        </label>
	                        <Textarea
	                          value={selectedMusic.notes}
	                          onChange={(event) =>
	                            updateSelectedMusic((track) => ({
	                              ...track,
	                              notes: event.target.value,
	                            }))
	                          }
	                          className="min-h-[90px] text-xs"
	                        />
	                      </div>
	                      <div className="grid gap-4 md:grid-cols-4">
                        <div className="space-y-2">
                          <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                            Mood
                          </label>
                          <Input
                            value={selectedMusic.mood || ""}
                            onChange={(event) =>
                              updateSelectedMusic((track) => ({
                                ...track,
                                mood: event.target.value || undefined,
                              }))
                            }
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                            Energy
                          </label>
                          <Input
                            value={selectedMusic.energy || ""}
                            onChange={(event) =>
                              updateSelectedMusic((track) => ({
                                ...track,
                                energy: event.target.value || undefined,
                              }))
                            }
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                            BPM
                          </label>
                          <Input
                            type="number"
                            min={30}
                            max={220}
                            value={selectedMusic.bpm || ""}
                            onChange={(event) =>
                              updateSelectedMusic((track) => ({
                                ...track,
                                bpm:
                                  event.target.value === ""
                                    ? undefined
                                    : Math.max(30, Math.min(220, Number(event.target.value) || 0)),
                              }))
                            }
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                            Key
                          </label>
                          <Input
                            value={selectedMusic.key || ""}
                            onChange={(event) =>
                              updateSelectedMusic((track) => ({
                                ...track,
                                key: event.target.value || undefined,
                              }))
                            }
                          />
                        </div>
                      </div>
                      <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-2">
                          <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                            Pacing
                          </label>
                          <Input
                            value={selectedMusic.pacing || ""}
                            onChange={(event) =>
                              updateSelectedMusic((track) => ({
                                ...track,
                                pacing: event.target.value || undefined,
                              }))
                            }
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                            Best used for sections
                          </label>
                          <Input
                            value={(selectedMusic.recommendedSections || []).join(", ")}
                            onChange={(event) =>
                              updateSelectedMusic((track) => ({
                                ...track,
                                recommendedSections: event.target.value
                                  .split(",")
                                  .map((item) => item.trim())
                                  .filter(Boolean),
                              }))
                            }
                          />
                        </div>
                      </div>
                      <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-2">
                          <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                            Emotional arc
                          </label>
                          <Input
                            value={selectedMusic.emotionalArc || ""}
                            onChange={(event) =>
                              updateSelectedMusic((track) => ({
                                ...track,
                                emotionalArc: event.target.value || undefined,
                              }))
                            }
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                            Intensity curve
                          </label>
                          <Input
                            value={selectedMusic.intensityCurve || ""}
                            onChange={(event) =>
                              updateSelectedMusic((track) => ({
                                ...track,
                                intensityCurve: event.target.value || undefined,
                              }))
                            }
                          />
                        </div>
                      </div>
                      <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-2">
                          <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                            Best scene types
                          </label>
                          <Textarea
                            value={(selectedMusic.bestSceneTypes || []).join(", ")}
                            onChange={(event) =>
                              updateSelectedMusic((track) => ({
                                ...track,
                                bestSceneTypes: event.target.value
                                  .split(",")
                                  .map((item) => item.trim())
                                  .filter(Boolean),
                              }))
                            }
                            className="min-h-[80px] text-xs"
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                            Comparable references
                          </label>
                          <Textarea
                            value={(selectedMusic.comparableTo || []).join(", ")}
                            onChange={(event) =>
                              updateSelectedMusic((track) => ({
                                ...track,
                                comparableTo: event.target.value
                                  .split(",")
                                  .map((item) => item.trim())
                                  .filter(Boolean),
                              }))
                            }
                            className="min-h-[80px] text-xs"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="space-y-3 rounded-lg border border-border bg-background/60 p-4">
                      <h4 className="text-sm font-medium text-foreground">
                        Generation and mixing defaults
                      </h4>
                      <div className="grid gap-3 sm:grid-cols-2">
                        {[
                          {
                            key: "availableForPlanning",
                            label: "Available for planning",
                          },
                          {
                            key: "preferredForPlanning",
                            label: "Preferred for planning",
                          },
                          {
                            key: "availableForGeneration",
                            label: "Available for generation",
                          },
                          {
                            key: "preferredForBackground",
                            label: "Preferred background music",
                          },
                          { key: "loopFriendly", label: "Loop-friendly" },
                        ].map((toggle) => (
                          <label
                            key={toggle.key}
                            className="flex cursor-pointer items-center gap-2 rounded-md border border-border px-3 py-2 text-xs text-foreground"
                          >
                            <input
                              type="checkbox"
                              checked={Boolean(
                                selectedMusic[
                                  toggle.key as keyof MusicLibraryEntry
                                ],
                              )}
                              onChange={(event) =>
                                updateSelectedMusic((track) => ({
                                  ...track,
                                  [toggle.key]: event.target.checked,
                                }))
                              }
                            />
                            {toggle.label}
                          </label>
                        ))}
                      </div>
                      <div className="grid gap-4 md:grid-cols-3">
                        <div className="space-y-2">
                          <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                            Transition in
                          </label>
                          <Input
                            value={selectedMusic.transitionInPattern || ""}
                            onChange={(event) =>
                              updateSelectedMusic((track) => ({
                                ...track,
                                transitionInPattern: event.target.value || undefined,
                              }))
                            }
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                            Transition out
                          </label>
                          <Input
                            value={selectedMusic.transitionOutPattern || ""}
                            onChange={(event) =>
                              updateSelectedMusic((track) => ({
                                ...track,
                                transitionOutPattern: event.target.value || undefined,
                              }))
                            }
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                            Global mix volume
                          </label>
                          <div className="flex items-center gap-3">
                            <input
                              type="range"
                              min={0}
                              max={1}
                              step={0.01}
                              value={videoRender.musicVolume}
                              onChange={(event) => {
                                updateSectionFeedbackState("music-library", {
                                  error: null,
                                  message: null,
                                });
                                setVideoRender({
                                  ...videoRender,
                                  musicVolume: Number(event.target.value),
                                });
                              }}
                              className="w-full"
                            />
                            <span className="w-12 text-right text-xs text-foreground">
                              {Math.round(videoRender.musicVolume * 100)}%
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {getMusicSourceType(selectedMusic) === "ai-generated" ? (
                      <div className="space-y-3 rounded-lg border border-border bg-background/60 p-4">
                        <h4 className="text-sm font-medium text-foreground">
                          AI generation
                        </h4>
                        <div className="space-y-2">
                          <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                            Music prompt
                          </label>
                          <Textarea
                            value={selectedMusic.prompt}
                            onChange={(event) =>
                              updateSelectedMusic((track) => ({
                                ...track,
                                prompt: event.target.value,
                              }))
                            }
                            className="min-h-[120px] font-mono text-xs"
                          />
                        </div>
                        {selectedMusic.generatedPrompt ? (
                          <div className="space-y-2">
                            <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                              Last generated prompt snapshot
                            </label>
                            <div className="whitespace-pre-wrap rounded-md border border-border bg-background/70 p-3 text-xs text-muted-foreground">
                              {selectedMusic.generatedPrompt}
                            </div>
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                  </Card>
                ) : null}
              </>
            ) : null}
          </div>
        ) : null}

	        {activeSection === "plan-sound-design" ? null : (
	          <>
	            <SectionFeedbackNotice feedback={sectionFeedback["sound-library"]} />
	            {activeSection === "generate-sound-design" ? (
	              <SectionFeedbackNotice feedback={sectionFeedback["music-library"]} />
	            ) : null}
	          </>
	        )}
      </div>
    </section>
  );

  function updateSectionFeedbackState(
    sectionId: SettingsSectionId,
    patch: Partial<SectionFeedback>,
  ) {
    setSectionFeedback((current) => ({
      ...current,
      [sectionId]: {
        ...current[sectionId],
        ...patch,
      },
    }));
  }

  function updatePromptTemplateFeedbackState(
    templateId: PromptTemplateId,
    patch: Partial<SectionFeedback>,
  ) {
    setPromptTemplateFeedback((current) => ({
      ...current,
      [templateId]: {
        ...current[templateId],
        ...patch,
      },
    }));
  }

  function splitPromptTemplateId(templateId: PromptTemplateId) {
    const [scope, key] = templateId.split(".") as [
      "textScript" | "xmlVisualPlanning" | "soundDesign" | "imageStyles",
      string,
    ];
    return { scope, key };
  }

  function getPromptTemplateValue(templateId: PromptTemplateId) {
    if (!templateId.includes(".")) {
      return prompts[templateId as PromptKey] || "";
    }

    const { scope, key } = splitPromptTemplateId(templateId);
    if (scope === "textScript") {
      return (
        textScriptSettings?.[key as TextScriptPromptTemplateKey] || ""
      );
    }
    if (scope === "xmlVisualPlanning") {
      return (
        xmlVisualPlanningSettings?.[
          key as XmlVisualPlanningPromptTemplateKey
        ] || ""
      );
    }
    if (scope === "imageStyles") {
      return imageStyles?.promptTemplates[key as ImagePromptTemplateKey] || "";
    }
    return (
      soundDesignSettings?.[key as SoundDesignPromptTemplateKey] || ""
    );
  }

  function getInitialPromptTemplateValue(templateId: PromptTemplateId) {
    if (!templateId.includes(".")) {
      return initialPrompts[templateId as PromptKey] || "";
    }

    const { scope, key } = splitPromptTemplateId(templateId);
    if (scope === "textScript") {
      return (
        initialTextScriptSettings?.[
          key as TextScriptPromptTemplateKey
        ] || ""
      );
    }
    if (scope === "xmlVisualPlanning") {
      return (
        initialXmlVisualPlanningSettings?.[
          key as XmlVisualPlanningPromptTemplateKey
        ] || ""
      );
    }
    if (scope === "imageStyles") {
      return (
        initialImageStyles?.promptTemplates[key as ImagePromptTemplateKey] || ""
      );
    }
    return (
      initialSoundDesignSettings?.[
        key as SoundDesignPromptTemplateKey
      ] || ""
    );
  }

  function isPromptTemplateDirty(templateId: PromptTemplateId) {
    return (
      getPromptTemplateValue(templateId) !==
      getInitialPromptTemplateValue(templateId)
    );
  }

  function setPromptTemplateValue(
    templateId: PromptTemplateId,
    value: string,
  ) {
    updatePromptTemplateFeedbackState(templateId, {
      error: null,
      message: null,
    });

    if (!templateId.includes(".")) {
      setPrompts((current) => ({
        ...current,
        [templateId as PromptKey]: value,
      }));
      return;
    }

    const { scope, key } = splitPromptTemplateId(templateId);
    if (scope === "textScript") {
      setTextScriptSettings((current) =>
        current
          ? {
              ...current,
              [key as TextScriptPromptTemplateKey]: value,
            }
          : current,
      );
      return;
    }
    if (scope === "xmlVisualPlanning") {
      setXmlVisualPlanningSettings((current) =>
        current
          ? {
              ...current,
              [key as XmlVisualPlanningPromptTemplateKey]: value,
            }
          : current,
      );
      return;
    }
    if (scope === "imageStyles") {
      setImageStyles((current) =>
        current
          ? {
              ...current,
              promptTemplates: {
                ...current.promptTemplates,
                [key as ImagePromptTemplateKey]: value,
              },
            }
          : current,
      );
      return;
    }
    setSoundDesignSettings((current) =>
      current
        ? {
            ...current,
            [key as SoundDesignPromptTemplateKey]: value,
          }
        : current,
    );
  }

  function buildPromptTemplateSavePayload(templateId: PromptTemplateId) {
    const value = getPromptTemplateValue(templateId);
    if (!value.trim()) {
      throw new Error("Prompt template must be a non-empty string");
    }
    if (!templateId.includes(".")) {
      return { prompts: { [templateId]: value } };
    }

    const { scope, key } = splitPromptTemplateId(templateId);
    if (scope === "textScript") {
      return { textScript: { [key]: value } };
    }
    if (scope === "xmlVisualPlanning") {
      return { xmlVisualPlanning: { [key]: value } };
    }
    if (scope === "imageStyles") {
      return { imageStyles: { promptTemplates: { [key]: value } } };
    }
    return { soundDesign: { [key]: value } };
  }

  function mergeSavedPromptTemplate(
    templateId: PromptTemplateId,
    data: SettingsData,
  ) {
    if (!templateId.includes(".")) {
      const key = templateId as PromptKey;
      const value = data.prompts[key] || "";
      setPrompts((current) => ({ ...current, [key]: value }));
      setInitialPrompts((current) => ({ ...current, [key]: value }));
      return;
    }

    const { scope, key } = splitPromptTemplateId(templateId);
    if (scope === "textScript") {
      const textScriptKey = key as TextScriptPromptTemplateKey;
      const value = data.textScript[textScriptKey];
      setTextScriptSettings((current) =>
        current ? { ...current, [textScriptKey]: value } : data.textScript,
      );
      setInitialTextScriptSettings((current) =>
        current ? { ...current, [textScriptKey]: value } : data.textScript,
      );
      return;
    }
    if (scope === "xmlVisualPlanning") {
      const xmlKey = key as XmlVisualPlanningPromptTemplateKey;
      const value = data.xmlVisualPlanning[xmlKey];
      setXmlVisualPlanningSettings((current) =>
        current
          ? { ...current, [xmlKey]: value }
          : data.xmlVisualPlanning,
      );
      setInitialXmlVisualPlanningSettings((current) =>
        current
          ? { ...current, [xmlKey]: value }
          : data.xmlVisualPlanning,
      );
      return;
    }

    if (scope === "imageStyles") {
      const imageKey = key as ImagePromptTemplateKey;
      const value = data.imageStyles.promptTemplates[imageKey];
      setImageStyles((current) =>
        current
          ? {
              ...current,
              promptTemplates: {
                ...current.promptTemplates,
                [imageKey]: value,
              },
            }
          : data.imageStyles,
      );
      setInitialImageStyles((current) =>
        current
          ? {
              ...current,
              promptTemplates: {
                ...current.promptTemplates,
                [imageKey]: value,
              },
            }
          : data.imageStyles,
      );
      return;
    }

    const soundKey = key as SoundDesignPromptTemplateKey;
    const value = data.soundDesign[soundKey];
    setSoundDesignSettings((current) =>
      current ? { ...current, [soundKey]: value } : data.soundDesign,
    );
    setInitialSoundDesignSettings((current) =>
      current ? { ...current, [soundKey]: value } : data.soundDesign,
    );
  }

  async function savePromptTemplate(templateId: PromptTemplateId) {
    updatePromptTemplateFeedbackState(templateId, {
      saving: true,
      error: null,
      message: null,
    });

    try {
      const payload = buildPromptTemplateSavePayload(templateId);
      const data = await parseResponse(
        await fetch("/api/short-form-videos/settings", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }),
      );
      mergeSavedPromptTemplate(templateId, data);
      updatePromptTemplateFeedbackState(templateId, {
        saving: false,
        error: null,
        message:
          "Saved. New workflow runs will use this prompt template immediately.",
      });
      return data;
    } catch (err) {
      updatePromptTemplateFeedbackState(templateId, {
        saving: false,
        error:
          err instanceof Error ? err.message : "Failed to save prompt template",
        message: null,
      });
      throw err;
    }
  }

  function resetPromptTemplate(templateId: PromptTemplateId) {
    if (!isPromptTemplateDirty(templateId)) return;
    const confirmed = window.confirm(
      "Restore this prompt template to its last saved value?",
    );
    if (!confirmed) return;

    setPromptTemplateValue(
      templateId,
      getInitialPromptTemplateValue(templateId),
    );
    updatePromptTemplateFeedbackState(templateId, {
      error: null,
      message: null,
    });
  }

  function clearStyleTest(styleId: string) {
    setStyleTestsById((current) => {
      if (!current[styleId]) return current;
      const next = { ...current };
      delete next[styleId];
      return next;
    });
  }

  function updateSelectedMotionTemplate(
    updater: (template: MotionGraphicTemplateConfig) => MotionGraphicTemplateConfig,
  ) {
    if (!motionGraphicsSettings || !selectedMotionTemplate) return;
    updateSectionFeedbackState("motion-graphics", { error: null, message: null });
    const previousId = selectedMotionTemplate.id;
    let nextSelectedId = previousId;
    setMotionGraphicsSettings({
      ...motionGraphicsSettings,
      templates: motionGraphicsSettings.templates.map((template) => {
        if (template.id !== previousId) return template;
        const nextTemplate = updater(template);
        nextSelectedId = nextTemplate.id || previousId;
        return nextTemplate;
      }),
    });
    if (nextSelectedId !== selectedMotionTemplateId) {
      selectMotionTemplate(nextSelectedId, { skipDirtyCheck: true });
    }
  }

  function updateSelectedMotionTemplatePreviewArg(name: string, value: unknown) {
    updateSelectedMotionTemplate((template) => ({
      ...template,
      previewArgs: {
        ...template.previewArgs,
        [name]: value,
      },
    }));
  }

  async function regenerateSelectedMotionPreview() {
    if (!selectedMotionTemplate) return;
    await requestMotionTemplatePreview(selectedMotionTemplate, { force: true });
  }

  function updateSelectedStyle(updater: (style: ImageStyle) => ImageStyle) {
    if (!imageStyles || !selectedStyle) return;
    updateSectionFeedbackState("image-styles", { error: null, message: null });
    setImageStyles({
      ...imageStyles,
      styles: imageStyles.styles.map((style) =>
        style.id === selectedStyle.id ? updater(style) : style,
      ),
    });
  }

  function updateStyleReference(
    referenceId: string,
    updater: (reference: StyleReferenceImage) => StyleReferenceImage,
  ) {
    updateSelectedStyle((style) => ({
      ...style,
      references: (style.references || []).map((reference) =>
        reference.id === referenceId ? updater(reference) : reference,
      ),
    }));
  }

  function removeStyleReference(referenceId: string) {
    updateSelectedStyle((style) => ({
      ...style,
      references: (style.references || []).filter(
        (reference) => reference.id !== referenceId,
      ),
    }));
  }

  function mergeSavedSection(
    sectionId: SettingsSectionId,
    data: NonNullable<SettingsResponse["data"]>,
  ) {
    setDefinitions(data.definitions);

    if (
      sectionId === "tts-voice" ||
      sectionId === "music-library" ||
      sectionId === "pause-removal" ||
      sectionId === "caption-styles"
    ) {
      setVideoRender(data.videoRender);
      setInitialVideoRender(data.videoRender);
      setSelectedVoiceId((current) => {
        if (
          current &&
          data.videoRender.voices.some((voice) => voice.id === current)
        )
          return current;
        return (
          data.videoRender.defaultVoiceId ||
          data.videoRender.voices[0]?.id ||
          null
        );
      });
      setSelectedMusicId((current) => {
        if (
          current &&
          data.videoRender.musicTracks.some((track) => track.id === current)
        )
          return current;
        return data.videoRender.musicTracks[0]?.id || null;
      });
      setSelectedCaptionStyleId((current) => {
        if (
          current &&
          data.videoRender.captionStyles.some((style) => style.id === current)
        )
          return current;
        return (
          data.videoRender.defaultCaptionStyleId ||
          data.videoRender.captionStyles[0]?.id ||
          null
        );
      });
      return;
    }

    if (sectionId === "sound-library") {
      setSoundDesignSettings(data.soundDesign);
      setInitialSoundDesignSettings(data.soundDesign);
      setSelectedSoundId((current) => {
        if (
          current &&
          data.soundDesign.library.some((sound) => sound.id === current)
        )
          return current;
        return data.soundDesign.library[0]?.id || null;
      });
      return;
    }

    if (sectionId === "text-script-prompts") {
      setTextScriptSettings(data.textScript);
      setInitialTextScriptSettings(data.textScript);
      return;
    }

    if (sectionId === "xml-visual-planning") {
      setXmlVisualPlanningSettings(data.xmlVisualPlanning);
      setInitialXmlVisualPlanningSettings(data.xmlVisualPlanning);
      return;
    }

    if (sectionId === "motion-graphics") {
      setMotionGraphicsSettings(data.motionGraphics);
      setInitialMotionGraphicsSettings(data.motionGraphics);
      setSupportedMotionGraphicRenderers(data.supportedMotionGraphicRenderers || []);
      setSelectedMotionTemplateId((current) =>
        current && data.motionGraphics.templates.some((template) => template.id === current)
          ? current
          : data.motionGraphics.templates[0]?.id || null,
      );
      return;
    }

    if (sectionId === "image-templates") {
      setImageStyles((current) =>
        current
          ? { ...current, promptTemplates: data.imageStyles.promptTemplates }
          : data.imageStyles,
      );
      setInitialImageStyles((current) =>
        current
          ? { ...current, promptTemplates: data.imageStyles.promptTemplates }
          : data.imageStyles,
      );
      return;
    }

    if (sectionId === "image-styles") {
      setImageStyles((current) =>
        current
          ? {
              ...current,
              styles: data.imageStyles.styles,
              defaultStyleId: data.imageStyles.defaultStyleId,
              defaultVisualGenerationModelId:
                data.imageStyles.defaultVisualGenerationModelId,
            }
          : data.imageStyles,
      );
      setInitialImageStyles((current) =>
        current
          ? {
              ...current,
              styles: data.imageStyles.styles,
              defaultStyleId: data.imageStyles.defaultStyleId,
              defaultVisualGenerationModelId:
                data.imageStyles.defaultVisualGenerationModelId,
            }
          : data.imageStyles,
      );
      setStyleTestsById((current) => ({
        ...current,
        ...buildStyleTestsById(data.imageStyles.styles),
      }));
      setSelectedStyleId((current) => {
        const nextStyles = data.imageStyles.styles;
        if (current && nextStyles.some((style) => style.id === current))
          return current;
        return data.imageStyles.defaultStyleId || nextStyles[0]?.id || null;
      });
      return;
    }

    const promptGroup = PROMPT_GROUPS.find((group) => group.id === sectionId);
    if (promptGroup) {
      const nextPrompts = pickPromptValues(data.prompts, promptGroup.keys);
      setPrompts((current) => ({ ...current, ...nextPrompts }));
      setInitialPrompts((current) => ({ ...current, ...nextPrompts }));
    }
  }

  function buildSectionSavePayload(sectionId: SettingsSectionId) {
    switch (sectionId) {
      case "tts-voice":
        return videoRender
          ? {
              videoRender: {
                voices: videoRender.voices,
                defaultVoiceId: videoRender.defaultVoiceId,
              },
            }
          : null;
      case "pause-removal":
        return videoRender
          ? {
              videoRender: {
                pauseRemoval: videoRender.pauseRemoval,
              },
            }
          : null;
      case "music-library":
        return videoRender
          ? {
              videoRender: {
                musicTracks: videoRender.musicTracks,
                musicVolume: videoRender.musicVolume,
              },
            }
          : null;
      case "caption-styles":
        return videoRender
          ? {
              videoRender: {
                animationPresets: videoRender.animationPresets,
                captionStyles: videoRender.captionStyles,
                defaultCaptionStyleId: videoRender.defaultCaptionStyleId,
                captionMaxWords: videoRender.captionMaxWords,
              },
            }
          : null;
      case "sound-library":
        return soundDesignSettings
          ? { soundDesign: soundDesignSettings }
          : null;
      case "text-script-prompts":
        return textScriptSettings ? { textScript: textScriptSettings } : null;
      case "xml-visual-planning":
        return xmlVisualPlanningSettings
          ? { xmlVisualPlanning: xmlVisualPlanningSettings }
          : null;
      case "motion-graphics":
        return motionGraphicsSettings
          ? { motionGraphics: motionGraphicsSettings }
          : null;
      case "image-templates":
        return imageStyles
          ? { imageStyles: { promptTemplates: imageStyles.promptTemplates } }
          : null;
      case "image-styles":
        return imageStyles
          ? {
              imageStyles: {
                styles: imageStyles.styles,
                defaultStyleId: imageStyles.defaultStyleId,
                defaultVisualGenerationModelId:
                  imageStyles.defaultVisualGenerationModelId,
              },
            }
          : null;
      default: {
        const promptGroup = PROMPT_GROUPS.find(
          (group) => group.id === sectionId,
        );
        return promptGroup
          ? { prompts: pickPromptValues(prompts, promptGroup.keys) }
          : null;
      }
    }
  }

  async function saveSection(sectionId: SettingsSectionId) {
    const payload = buildSectionSavePayload(sectionId);
    if (!payload) return null;

    updateSectionFeedbackState(sectionId, {
      saving: true,
      error: null,
      message: null,
    });

    try {
      const data = await parseResponse(
        await fetch("/api/short-form-videos/settings", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }),
      );
      mergeSavedSection(sectionId, data);
      updateSectionFeedbackState(sectionId, {
        saving: false,
        error: null,
        message:
          sectionId === "tts-voice"
            ? "Saved. New XML narration runs will now reuse this voice library, including any saved voice samples."
            : sectionId === "pause-removal"
              ? "Saved. New narration timing runs now use these global pause-removal defaults unless a project override is set."
              : sectionId === "music-library"
                ? "Saved. New sound-design planning and generation runs will now use this music library, including any generated music files."
                : sectionId === "caption-styles"
                  ? "Saved. New final-video runs will use this caption-style library/default immediately."
                    : sectionId === "image-templates" ||
                        sectionId === "image-styles"
                      ? "Saved. New scene-image runs and tests will use this section immediately."
                      : sectionId === "motion-graphics"
                        ? "Saved. New Plan Visuals prompts and Generate Visuals runs will use this deterministic motion graphics registry immediately."
                      : sectionId === "text-script-prompts"
                        ? "Saved. New text-script runs will use these full Scribe prompt templates and the default max-iteration limit immediately."
                        : sectionId === "xml-visual-planning"
                          ? "Saved. New Plan Visuals XML runs will use this full Scribe prompt template immediately."
                          : sectionId === "sound-library"
                            ? "Saved. New Plan Sound Design and Generate Sound Design runs will use this library plus the full top-level Scribe prompt template immediately."
                            : "Saved. New workflow runs will use this prompt section immediately.",
      });
      return data;
    } catch (err) {
      updateSectionFeedbackState(sectionId, {
        saving: false,
        error: err instanceof Error ? err.message : "Failed to save section",
        message: null,
      });
      throw err;
    }
  }

  async function saveSelectedMotionTemplate() {
    if (
      !motionGraphicsSettings ||
      !initialMotionGraphicsSettings ||
      !selectedMotionTemplate ||
      selectedMotionTemplateIndex < 0
    ) {
      return null;
    }

    const templateIndex = selectedMotionTemplateIndex;
    const templateToSave = selectedMotionTemplate;
    const baseTemplates =
      initialMotionGraphicsSettings.templates.length ===
      motionGraphicsSettings.templates.length
        ? initialMotionGraphicsSettings.templates
        : motionGraphicsSettings.templates;
    const nextMotionGraphics: MotionGraphicsSettings = {
      ...initialMotionGraphicsSettings,
      templates: baseTemplates.map((template, index) =>
        index === templateIndex ? templateToSave : template,
      ),
    };

    updateSectionFeedbackState("motion-graphics", {
      saving: true,
      error: null,
      message: null,
    });

    try {
      const data = await parseResponse(
        await fetch("/api/short-form-videos/settings", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ motionGraphics: nextMotionGraphics }),
        }),
      );
      const savedTemplate =
        data.motionGraphics.templates[templateIndex] || templateToSave;
      setInitialMotionGraphicsSettings(data.motionGraphics);
      setMotionGraphicsSettings((current) =>
        current
          ? {
              ...data.motionGraphics,
              templates: data.motionGraphics.templates.map((template, index) =>
                index === templateIndex
                  ? savedTemplate
                  : current.templates[index] || template,
              ),
            }
          : data.motionGraphics,
      );
      setSupportedMotionGraphicRenderers(data.supportedMotionGraphicRenderers || []);
      selectMotionTemplate(savedTemplate.id, { skipDirtyCheck: true });
      updateSectionFeedbackState("motion-graphics", {
        saving: false,
        error: null,
        message:
          "Saved. New Plan Visuals prompts and Generate Visuals runs will use this motion graphics template immediately.",
      });
      return data;
    } catch (err) {
      updateSectionFeedbackState("motion-graphics", {
        saving: false,
        error:
          err instanceof Error
            ? err.message
            : "Failed to save motion graphics template",
        message: null,
      });
      throw err;
    }
  }

  function resetSelectedMotionTemplate() {
    if (
      !selectedMotionTemplateDirty ||
      !initialMotionGraphicsSettings ||
      selectedMotionTemplateIndex < 0
    ) {
      return;
    }
    const confirmed = window.confirm(
      "Discard unsaved changes for this motion graphics template?",
    );
    if (!confirmed) return;

    const savedTemplate =
      initialMotionGraphicsSettings.templates[selectedMotionTemplateIndex];
    if (!savedTemplate) return;

    setMotionGraphicsSettings((current) =>
      current
        ? {
            ...current,
            templates: current.templates.map((template, index) =>
              index === selectedMotionTemplateIndex ? savedTemplate : template,
            ),
          }
        : current,
    );
    selectMotionTemplate(savedTemplate.id, { skipDirtyCheck: true });
    updateSectionFeedbackState("motion-graphics", {
      error: null,
      message: null,
    });
  }

  function isTextScriptDefaultsDirty() {
    if (!textScriptSettings || !initialTextScriptSettings) return false;
    return (
      serializeForCompare({
        defaultMaxIterations: textScriptSettings.defaultMaxIterations,
        enforceNaturalContractions:
          textScriptSettings.enforceNaturalContractions,
        formatNumericPercentages: textScriptSettings.formatNumericPercentages,
      }) !==
      serializeForCompare({
        defaultMaxIterations: initialTextScriptSettings.defaultMaxIterations,
        enforceNaturalContractions:
          initialTextScriptSettings.enforceNaturalContractions,
        formatNumericPercentages:
          initialTextScriptSettings.formatNumericPercentages,
      })
    );
  }

  async function saveTextScriptDefaults() {
    if (!textScriptSettings) return null;
    updateSectionFeedbackState("text-script-prompts", {
      saving: true,
      error: null,
      message: null,
    });

    try {
      const data = await parseResponse(
        await fetch("/api/short-form-videos/settings", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            textScript: {
              defaultMaxIterations: textScriptSettings.defaultMaxIterations,
              enforceNaturalContractions:
                textScriptSettings.enforceNaturalContractions,
              formatNumericPercentages:
                textScriptSettings.formatNumericPercentages,
            },
          }),
        }),
      );
      setTextScriptSettings((current) =>
        current
          ? {
              ...current,
              defaultMaxIterations: data.textScript.defaultMaxIterations,
              enforceNaturalContractions:
                data.textScript.enforceNaturalContractions,
              formatNumericPercentages:
                data.textScript.formatNumericPercentages,
            }
          : data.textScript,
      );
      setInitialTextScriptSettings((current) =>
        current
          ? {
              ...current,
              defaultMaxIterations: data.textScript.defaultMaxIterations,
              enforceNaturalContractions:
                data.textScript.enforceNaturalContractions,
              formatNumericPercentages:
                data.textScript.formatNumericPercentages,
            }
          : data.textScript,
      );
      updateSectionFeedbackState("text-script-prompts", {
        saving: false,
        error: null,
        message:
          "Saved. New text-script runs will use these defaults immediately.",
      });
      return data;
    } catch (err) {
      updateSectionFeedbackState("text-script-prompts", {
        saving: false,
        error:
          err instanceof Error
            ? err.message
            : "Failed to save text-script defaults",
        message: null,
      });
      throw err;
    }
  }

  function resetTextScriptDefaults() {
    if (!isTextScriptDefaultsDirty() || !initialTextScriptSettings) return;
    const confirmed = window.confirm(
      "Restore text-script defaults to their last saved values?",
    );
    if (!confirmed) return;

    setTextScriptSettings((current) =>
      current
        ? {
            ...current,
            defaultMaxIterations: initialTextScriptSettings.defaultMaxIterations,
            enforceNaturalContractions:
              initialTextScriptSettings.enforceNaturalContractions,
            formatNumericPercentages:
              initialTextScriptSettings.formatNumericPercentages,
          }
        : current,
    );
    updateSectionFeedbackState("text-script-prompts", {
      error: null,
      message: null,
    });
  }

  async function saveSoundMixDefaults() {
    if (!soundDesignSettings) return null;
    const nextMixDefaults = pickSoundMixDefaults(soundDesignSettings);
    if (!nextMixDefaults) return null;

    updateSectionFeedbackState("sound-library", {
      saving: true,
      error: null,
      message: null,
    });

    try {
      const data = await parseResponse(
        await fetch("/api/short-form-videos/settings", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ soundDesign: nextMixDefaults }),
        }),
      );
      const savedMixDefaults = pickSoundMixDefaults(data.soundDesign);
      setInitialSoundDesignSettings(data.soundDesign);
      setSoundDesignSettings((current) =>
        current && savedMixDefaults
          ? { ...current, ...savedMixDefaults }
          : data.soundDesign,
      );
      updateSectionFeedbackState("sound-library", {
        saving: false,
        error: null,
        message:
          "Saved. New Generate Sound Design runs will use these mix defaults immediately.",
      });
      return data;
    } catch (err) {
      updateSectionFeedbackState("sound-library", {
        saving: false,
        error:
          err instanceof Error ? err.message : "Failed to save mix defaults",
        message: null,
      });
      throw err;
    }
  }

  function resetSoundMixDefaults() {
    if (!mixDefaultsDirty || !initialSoundDesignSettings) return;
    const confirmed = window.confirm(
      "Restore mix defaults to their last saved values?",
    );
    if (!confirmed) return;

    const savedMixDefaults = pickSoundMixDefaults(initialSoundDesignSettings);
    if (!savedMixDefaults) return;
    setSoundDesignSettings((current) =>
      current ? { ...current, ...savedMixDefaults } : current,
    );
    updateSectionFeedbackState("sound-library", { error: null, message: null });
  }

  async function saveSelectedAudioClip() {
    if (
      selectedAudioLibraryKind === "sfx" &&
      selectedSound &&
      initialSoundDesignSettings
    ) {
      const savedLibraryHasSound = initialSoundDesignSettings.library.some(
        (sound) => sound.id === selectedSound.id,
      );
      const nextLibrary = savedLibraryHasSound
        ? initialSoundDesignSettings.library.map((sound) =>
            sound.id === selectedSound.id ? selectedSound : sound,
          )
        : [...initialSoundDesignSettings.library, selectedSound];

      updateSectionFeedbackState("sound-library", {
        saving: true,
        error: null,
        message: null,
      });

      try {
        const data = await parseResponse(
          await fetch("/api/short-form-videos/settings", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ soundDesign: { library: nextLibrary } }),
          }),
        );
        const savedSound =
          data.soundDesign.library.find(
            (sound) => sound.id === selectedSound.id,
          ) || selectedSound;
        setInitialSoundDesignSettings(data.soundDesign);
        setSoundDesignSettings((current) =>
          current
            ? {
                ...current,
                library: current.library.some(
                  (sound) => sound.id === savedSound.id,
                )
                  ? current.library.map((sound) =>
                      sound.id === savedSound.id ? savedSound : sound,
                    )
                  : [...current.library, savedSound],
              }
            : data.soundDesign,
        );
        selectAudioSelection({ kind: "sfx", id: savedSound.id });
        updateSectionFeedbackState("sound-library", {
          saving: false,
          error: null,
          message:
            "Saved. New Plan Sound Design and Generate Sound Design runs can use this audio clip immediately.",
        });
        return data;
      } catch (err) {
        updateSectionFeedbackState("sound-library", {
          saving: false,
          error:
            err instanceof Error
              ? err.message
              : "Failed to save selected audio clip",
          message: null,
        });
        throw err;
      }
    }

    if (
      selectedAudioLibraryKind === "music" &&
      selectedMusic &&
      videoRender &&
      initialVideoRender
    ) {
      const savedLibraryHasTrack = initialVideoRender.musicTracks.some(
        (track) => track.id === selectedMusic.id,
      );
      const nextMusicTracks = savedLibraryHasTrack
        ? initialVideoRender.musicTracks.map((track) =>
            track.id === selectedMusic.id ? selectedMusic : track,
          )
        : [...initialVideoRender.musicTracks, selectedMusic];
      updateSectionFeedbackState("music-library", {
        saving: true,
        error: null,
        message: null,
      });

      try {
        const data = await parseResponse(
          await fetch("/api/short-form-videos/settings", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              videoRender: {
                musicTracks: nextMusicTracks,
                musicVolume: videoRender.musicVolume,
              },
            }),
          }),
        );
        const savedTrack =
          data.videoRender.musicTracks.find(
            (track) => track.id === selectedMusic.id,
          ) || selectedMusic;
        setInitialVideoRender(data.videoRender);
        setVideoRender((current) =>
          current
            ? {
                ...current,
                musicTracks: current.musicTracks.some(
                  (track) => track.id === savedTrack.id,
                )
                  ? current.musicTracks.map((track) =>
                      track.id === savedTrack.id ? savedTrack : track,
                    )
                  : [...current.musicTracks, savedTrack],
                musicVolume: data.videoRender.musicVolume,
              }
            : data.videoRender,
        );
        selectAudioSelection({ kind: "music", id: savedTrack.id });
        updateSectionFeedbackState("music-library", {
          saving: false,
          error: null,
          message:
            "Saved. New Plan Sound Design and Generate Sound Design runs can use this music clip immediately.",
        });
        return data;
      } catch (err) {
        updateSectionFeedbackState("music-library", {
          saving: false,
          error:
            err instanceof Error
              ? err.message
              : "Failed to save selected audio clip",
          message: null,
        });
        throw err;
      }
    }

    return null;
  }

  function resetSelectedAudioClip() {
    if (!selectedAudioClipDirty) return;
    const confirmed = window.confirm(
      "Restore this audio clip to its last saved values?",
    );
    if (!confirmed) return;

    if (
      selectedAudioLibraryKind === "sfx" &&
      selectedSound &&
      soundDesignSettings
    ) {
      updateSectionFeedbackState("sound-library", { error: null, message: null });
      if (!initialSelectedSound) {
        const nextLibrary = soundDesignSettings.library.filter(
          (sound) => sound.id !== selectedSound.id,
        );
        setSoundDesignSettings({ ...soundDesignSettings, library: nextLibrary });
        selectAudioSelection(
          nextLibrary[0] ? { kind: "sfx", id: nextLibrary[0].id } : null,
        );
        return;
      }
      setSoundDesignSettings({
        ...soundDesignSettings,
        library: soundDesignSettings.library.map((sound) =>
          sound.id === initialSelectedSound.id ? initialSelectedSound : sound,
        ),
      });
      return;
    }

    if (
      selectedAudioLibraryKind === "music" &&
      selectedMusic &&
      videoRender &&
      initialVideoRender
    ) {
      updateSectionFeedbackState("music-library", { error: null, message: null });
      if (!initialSelectedMusic) {
        const nextMusicTracks = videoRender.musicTracks.filter(
          (track) => track.id !== selectedMusic.id,
        );
        setVideoRender({
          ...videoRender,
          musicTracks: nextMusicTracks,
          musicVolume: initialVideoRender.musicVolume,
        });
        selectAudioSelection(
          nextMusicTracks[0]
            ? { kind: "music", id: nextMusicTracks[0].id }
            : null,
        );
        return;
      }
      setVideoRender({
        ...videoRender,
        musicTracks: videoRender.musicTracks.map((track) =>
          track.id === initialSelectedMusic.id ? initialSelectedMusic : track,
        ),
        musicVolume: initialVideoRender.musicVolume,
      });
    }
  }

  function resetSection(sectionId: SettingsSectionId) {
    if (!dirtyBySection[sectionId]) return;
    const confirmed = window.confirm(
      "Discard unsaved changes for this section?",
    );
    if (!confirmed) return;

    updateSectionFeedbackState(sectionId, { error: null, message: null });

    if (
      (sectionId === "tts-voice" ||
        sectionId === "music-library" ||
        sectionId === "pause-removal" ||
        sectionId === "caption-styles") &&
      initialVideoRender &&
      videoRender
    ) {
      if (sectionId === "tts-voice") {
        setVideoRender({
          ...videoRender,
          voices: initialVideoRender.voices,
          defaultVoiceId: initialVideoRender.defaultVoiceId,
        });
        setSelectedVoiceId(
          initialVideoRender.defaultVoiceId ||
            initialVideoRender.voices[0]?.id ||
            null,
        );
        return;
      }

      if (sectionId === "pause-removal") {
        setVideoRender({
          ...videoRender,
          pauseRemoval: initialVideoRender.pauseRemoval,
        });
        return;
      }

      if (sectionId === "caption-styles") {
        setVideoRender({
          ...videoRender,
          animationPresets: initialVideoRender.animationPresets,
          captionStyles: initialVideoRender.captionStyles,
          defaultCaptionStyleId: initialVideoRender.defaultCaptionStyleId,
          captionMaxWords: initialVideoRender.captionMaxWords,
        });
        setSelectedCaptionStyleId(
          initialVideoRender.defaultCaptionStyleId ||
            initialVideoRender.captionStyles[0]?.id ||
            null,
        );
        setSelectedAnimationPresetId(
          initialVideoRender.animationPresets[0]?.id || null,
        );
        return;
      }

      setVideoRender({
        ...videoRender,
        musicTracks: initialVideoRender.musicTracks,
        musicVolume: initialVideoRender.musicVolume,
      });
      selectAudioSelection(
        initialVideoRender.musicTracks[0]
          ? { kind: "music", id: initialVideoRender.musicTracks[0].id }
          : null,
      );
      return;
    }

    if (sectionId === "sound-library" && initialSoundDesignSettings) {
      setSoundDesignSettings(initialSoundDesignSettings);
      const currentSound = selectedSoundId
        ? initialSoundDesignSettings.library.find(
            (sound) => sound.id === selectedSoundId,
          )
        : null;
      const nextSound = currentSound || initialSoundDesignSettings.library[0];
      selectAudioSelection(
        nextSound ? { kind: "sfx", id: nextSound.id } : null,
      );
      return;
    }

    if (sectionId === "text-script-prompts" && initialTextScriptSettings) {
      setTextScriptSettings(initialTextScriptSettings);
      return;
    }

    if (
      sectionId === "xml-visual-planning" &&
      initialXmlVisualPlanningSettings
    ) {
      setXmlVisualPlanningSettings(initialXmlVisualPlanningSettings);
      return;
    }

    if (sectionId === "motion-graphics" && initialMotionGraphicsSettings) {
      setMotionGraphicsSettings(initialMotionGraphicsSettings);
      setSelectedMotionTemplateId((current) =>
        current && initialMotionGraphicsSettings.templates.some((template) => template.id === current)
          ? current
          : initialMotionGraphicsSettings.templates[0]?.id || null,
      );
      return;
    }

    if (sectionId === "image-templates" && imageStyles && initialImageStyles) {
      setImageStyles({
        ...imageStyles,
        promptTemplates: initialImageStyles.promptTemplates,
      });
      return;
    }

    if (sectionId === "image-styles" && imageStyles && initialImageStyles) {
      setImageStyles({
        ...imageStyles,
        styles: initialImageStyles.styles,
        defaultStyleId: initialImageStyles.defaultStyleId,
        defaultVisualGenerationModelId:
          initialImageStyles.defaultVisualGenerationModelId,
      });
      setSelectedStyleId((current) => {
        if (
          current &&
          initialImageStyles.styles.some((style) => style.id === current)
        )
          return current;
        return (
          initialImageStyles.defaultStyleId ||
          initialImageStyles.styles[0]?.id ||
          null
        );
      });
      setStyleTestsById((current) => ({
        ...current,
        ...buildStyleTestsById(initialImageStyles.styles),
      }));
      return;
    }

    const promptGroup = PROMPT_GROUPS.find((group) => group.id === sectionId);
    if (promptGroup) {
      const nextValues = pickPromptValues(initialPrompts, promptGroup.keys);
      setPrompts((current) => ({ ...current, ...nextValues }));
    }
  }

  async function uploadStyleReference(file: File) {
    if (!selectedStyle) return;

    const styleId = selectedStyle.id;
    setStyleReferenceUploadsById((current) => ({
      ...current,
      [styleId]: { isUploading: true, error: null },
    }));
    updateSectionFeedbackState("image-styles", { error: null, message: null });

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("styleId", styleId);
      formData.append("label", file.name);

      const response = await fetch(
        "/api/short-form-videos/settings/style-references/upload",
        {
          method: "POST",
          body: formData,
        },
      );
      const payload = (await response.json().catch(() => ({}))) as {
        success?: boolean;
        data?: {
          imageRelativePath: string;
          imageUrl?: string;
          uploadedAt?: string;
        };
        error?: string;
      };

      if (!response.ok || payload.success === false || !payload.data) {
        throw new Error(payload.error || "Failed to upload reference image");
      }

      updateSelectedStyle((style) => ({
        ...style,
        references: [
          ...(style.references || []),
          {
            id: `ref-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            label: file.name.replace(/\.[^.]+$/, ""),
            usageType: "general",
            usageInstructions:
              "Use this as supporting visual context where relevant.",
            imageRelativePath: payload.data!.imageRelativePath,
            imageUrl: payload.data!.imageUrl,
            uploadedAt: payload.data!.uploadedAt,
          },
        ],
      }));

      setStyleReferenceUploadsById((current) => ({
        ...current,
        [styleId]: { isUploading: false, error: null },
      }));
    } catch (err) {
      setStyleReferenceUploadsById((current) => ({
        ...current,
        [styleId]: {
          isUploading: false,
          error:
            err instanceof Error
              ? err.message
              : "Failed to upload reference image",
        },
      }));
    }
  }

  function addStyle() {
    if (!imageStyles) return;
    updateSectionFeedbackState("image-styles", { error: null, message: null });
    const nextStyle = createStyleDraft(imageStyles.styles.length + 1);
    const dedupedId = `${slugify(nextStyle.name) || "style"}-${Date.now()}`;
    nextStyle.id = dedupedId;
    const next = {
      ...imageStyles,
      defaultStyleId: imageStyles.defaultStyleId || dedupedId,
      styles: [...imageStyles.styles, nextStyle],
    };
    setImageStyles(next);
    setSelectedStyleId(dedupedId);
  }

  function deleteStyle(styleId: string) {
    if (!imageStyles || imageStyles.styles.length <= 1) return;
    updateSectionFeedbackState("image-styles", { error: null, message: null });
    const remaining = imageStyles.styles.filter(
      (style) => style.id !== styleId,
    );
    const nextDefault =
      imageStyles.defaultStyleId === styleId
        ? remaining[0].id
        : imageStyles.defaultStyleId;
    setImageStyles({
      ...imageStyles,
      defaultStyleId: nextDefault,
      styles: remaining,
    });
    setSelectedStyleId(remaining[0]?.id || null);
    clearStyleTest(styleId);
  }

  function updateSelectedVoice(
    updater: (voice: VoiceLibraryEntry) => VoiceLibraryEntry,
  ) {
    if (!videoRender || !selectedVoice) return;
    updateSectionFeedbackState("tts-voice", { error: null, message: null });
    setVideoRender({
      ...videoRender,
      voices: videoRender.voices.map((voice) =>
        voice.id === selectedVoice.id ? updater(voice) : voice,
      ),
    });
  }

  async function uploadReferenceVoice(file: File) {
    if (!selectedVoiceId) return;

    setVoiceReferenceUploadsById((current) => ({
      ...current,
      [selectedVoiceId]: { isUploading: true, error: null },
    }));
    updateSectionFeedbackState("tts-voice", { error: null, message: null });

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("voiceId", selectedVoiceId);

      const response = await fetch(
        "/api/short-form-videos/settings/voice-library/upload",
        {
          method: "POST",
          body: formData,
        },
      );
      const payload = (await response
        .json()
        .catch(() => ({}))) as VoiceReferenceUploadResponse;

      if (
        !response.ok ||
        payload.success === false ||
        !payload.data?.referenceAudioRelativePath
      ) {
        throw new Error(payload.error || "Failed to upload reference voice");
      }

      setVideoRender((current) => {
        if (!current) return current;
        return {
          ...current,
          voices: current.voices.map((voice) => {
            if (voice.id !== selectedVoiceId) return voice;
            const transcript = voice.referenceText || voice.previewText;
            return {
              ...voice,
              sourceType: "uploaded-reference",
              referenceAudioRelativePath:
                payload.data!.referenceAudioRelativePath,
              referenceGeneratedAt: payload.data!.uploadedAt,
              referenceText: transcript,
              previewText: transcript,
              referencePrompt: undefined,
              referenceMode: undefined,
              referenceSpeaker: undefined,
            };
          }),
        };
      });
      setTtsPreview({
        isLoading: false,
        error: null,
        audioUrl: payload.data.audioUrl || null,
        reusedExisting: true,
      });
      setVoiceReferenceUploadsById((current) => ({
        ...current,
        [selectedVoiceId]: { isUploading: false, error: null },
      }));
      updateSectionFeedbackState("tts-voice", {
        saving: false,
        error: null,
        message:
          "Uploaded a reference clip. Update the transcript if needed, then save the voice library so projects can reuse this exact audio.",
      });
    } catch (err) {
      setVoiceReferenceUploadsById((current) => ({
        ...current,
        [selectedVoiceId]: {
          isUploading: false,
          error:
            err instanceof Error
              ? err.message
              : "Failed to upload reference voice",
        },
      }));
    }
  }

  function addVoice() {
    if (!videoRender) return;
    updateSectionFeedbackState("tts-voice", { error: null, message: null });
    const nextVoice = createVoiceDraft(videoRender.voices.length + 1);
    const dedupedId = `${slugify(nextVoice.name) || "voice"}-${Date.now()}`;
    nextVoice.id = dedupedId;
    setVideoRender({
      ...videoRender,
      defaultVoiceId: videoRender.defaultVoiceId || dedupedId,
      voices: [...videoRender.voices, nextVoice],
    });
    setSelectedVoiceId(dedupedId);
  }

  function addUploadedReferenceVoice() {
    if (!videoRender) return;
    updateSectionFeedbackState("tts-voice", { error: null, message: null });
    const nextVoice = createUploadedReferenceVoiceDraft(
      videoRender.voices.length + 1,
    );
    const dedupedId = `${slugify(nextVoice.name) || "uploaded-voice"}-${Date.now()}`;
    nextVoice.id = dedupedId;
    setVideoRender({
      ...videoRender,
      defaultVoiceId: videoRender.defaultVoiceId || dedupedId,
      voices: [...videoRender.voices, nextVoice],
    });
    setSelectedVoiceId(dedupedId);
  }

  function deleteVoice(voiceId: string) {
    if (!videoRender || videoRender.voices.length <= 1) return;
    updateSectionFeedbackState("tts-voice", { error: null, message: null });
    const remaining = videoRender.voices.filter(
      (voice) => voice.id !== voiceId,
    );
    const nextDefault =
      videoRender.defaultVoiceId === voiceId
        ? remaining[0].id
        : videoRender.defaultVoiceId;
    setVideoRender({
      ...videoRender,
      defaultVoiceId: nextDefault,
      voices: remaining,
    });
    setVoiceReferenceUploadsById((current) => {
      if (!(voiceId in current)) return current;
      const next = { ...current };
      delete next[voiceId];
      return next;
    });
    setSelectedVoiceId(remaining[0]?.id || null);
  }

  function updateSelectedMusic(
    updater: (track: MusicLibraryEntry) => MusicLibraryEntry,
  ) {
    if (!videoRender || !selectedMusic) return;
    updateSectionFeedbackState("music-library", { error: null, message: null });
    setVideoRender({
      ...videoRender,
      musicTracks: videoRender.musicTracks.map((track) =>
        track.id === selectedMusic.id ? updater(track) : track,
      ),
    });
  }

	  function updateSelectedSound(
	    updater: (sound: SoundLibraryEntry) => SoundLibraryEntry,
	  ) {
	    if (!soundDesignSettings || !selectedSound) return;
	    updateSectionFeedbackState("sound-library", { error: null, message: null });
    setSoundDesignSettings({
      ...soundDesignSettings,
      library: soundDesignSettings.library.map((sound) =>
        sound.id === selectedSound.id ? updater(sound) : sound,
	      ),
	    });
	  }

	  function openSelectedAudioClipNameDialog() {
	    if (!selectedAudioClip) return;
	    setAudioClipNameDraft(selectedAudioClip.name);
	    setAudioClipNameDialogOpen(true);
	  }

	  function saveSelectedAudioClipName() {
	    const nextName = audioClipNameDraft.trim();
	    if (!nextName) return;
	    if (selectedAudioLibraryKind === "music" && selectedMusic) {
	      updateSelectedMusic((track) => ({
	        ...track,
	        name: nextName,
	      }));
	    } else if (selectedAudioLibraryKind === "sfx" && selectedSound) {
	      updateSelectedSound((sound) => ({
	        ...sound,
	        name: nextName,
	      }));
	    }
	    setAudioClipNameDialogOpen(false);
	  }

	  function openSelectedAudioClipTagsDialog() {
	    setAudioClipTagDrafts(selectedAudioClipTags);
	    setAudioClipNewTagDraft("");
	    setAudioClipTagsDialogOpen(true);
	  }

	  function toggleAudioClipTagDraft(tag: string) {
	    const normalizedTag = tag.trim();
	    if (!normalizedTag) return;
	    setAudioClipTagDrafts((current) => {
	      const existing = current.find(
	        (item) => item.toLowerCase() === normalizedTag.toLowerCase(),
	      );
	      if (existing) {
	        return current.filter((item) => item !== existing);
	      }
	      return [...current, normalizedTag];
	    });
	  }

	  function addAudioClipTagDraft() {
	    const nextTag = audioClipNewTagDraft.trim();
	    if (!nextTag) return;
	    setAudioClipTagDrafts((current) =>
	      current.some((tag) => tag.toLowerCase() === nextTag.toLowerCase())
	        ? current
	        : [...current, nextTag],
	    );
	    setAudioClipNewTagDraft("");
	  }

	  function saveSelectedAudioClipTags() {
	    const nextTags = audioClipTagDrafts
	      .map((tag) => tag.trim())
	      .filter(Boolean)
	      .filter(
	        (tag, index, tags) =>
	          tags.findIndex((item) => item.toLowerCase() === tag.toLowerCase()) ===
	          index,
	      );
	    if (selectedAudioLibraryKind === "music" && selectedMusic) {
	      updateSelectedMusic((track) => ({
	        ...track,
	        tags: nextTags,
	      }));
	    } else if (selectedAudioLibraryKind === "sfx" && selectedSound) {
	      updateSelectedSound((sound) => ({
	        ...sound,
	        tags: nextTags,
	      }));
	    }
	    setAudioClipTagsDialogOpen(false);
	  }

	  function confirmDeleteSelectedAudioClip() {
	    if (selectedAudioLibraryKind === "music" && selectedMusic) {
	      deleteMusic(selectedMusic.id);
	    } else if (selectedAudioLibraryKind === "sfx" && selectedSound) {
	      deleteSound(selectedSound.id);
	    }
	    setAudioClipDeleteDialogOpen(false);
	  }

	  function updateSelectedCaptionStyle(
    updater: (style: CaptionStyleEntry) => CaptionStyleEntry,
  ) {
    if (!videoRender || !selectedCaptionStyle) return;
    updateSectionFeedbackState("caption-styles", {
      error: null,
      message: null,
    });
    setVideoRender({
      ...videoRender,
      captionStyles: videoRender.captionStyles.map((style) =>
        style.id === selectedCaptionStyle.id ? updater(style) : style,
      ),
    });
  }

  function updateSelectedAnimationPreset(
    updater: (preset: AnimationPresetEntry) => AnimationPresetEntry,
  ) {
    if (!videoRender || !selectedAnimationPreset) return;
    updateSectionFeedbackState("caption-styles", {
      error: null,
      message: null,
    });
    setVideoRender({
      ...videoRender,
      animationPresets: videoRender.animationPresets.map((preset) =>
        preset.id === selectedAnimationPreset.id ? updater(preset) : preset,
      ),
    });
  }

  function addAnimationPreset() {
    if (!videoRender) return;
    updateSectionFeedbackState("caption-styles", {
      error: null,
      message: null,
    });
    const nextPreset = createAnimationPresetDraft(
      videoRender.animationPresets.length + 1,
    );
    nextPreset.id = buildUniqueAnimationPresetId(
      videoRender.animationPresets,
      nextPreset.name,
    );
    setVideoRender({
      ...videoRender,
      animationPresets: [...videoRender.animationPresets, nextPreset],
    });
    setCaptionLibraryTab("presets");
    setSelectedAnimationPresetId(nextPreset.id);
  }

  function duplicateAnimationPreset(presetId: string) {
    if (!videoRender) return;
    const source = videoRender.animationPresets.find(
      (preset) => preset.id === presetId,
    );
    if (!source) return;
    updateSectionFeedbackState("caption-styles", {
      error: null,
      message: null,
    });
    const name = buildUniqueAnimationPresetName(
      videoRender.animationPresets,
      source.name,
    );
    const duplicate: AnimationPresetEntry = {
      ...source,
      id: buildUniqueAnimationPresetId(videoRender.animationPresets, name),
      slug: `${slugify(name) || "caption-animation"}-${Date.now()}`,
      name,
      builtIn: false,
      config: cloneCaptionAnimationConfig(source.config),
    };
    const sourceIndex = videoRender.animationPresets.findIndex(
      (preset) => preset.id === presetId,
    );
    const nextPresets = [...videoRender.animationPresets];
    nextPresets.splice(sourceIndex + 1, 0, duplicate);
    setVideoRender({
      ...videoRender,
      animationPresets: nextPresets,
    });
    setCaptionLibraryTab("presets");
    setSelectedAnimationPresetId(duplicate.id);
  }

  function deleteAnimationPreset(presetId: string) {
    if (!videoRender || videoRender.animationPresets.length <= 1) return;
    updateSectionFeedbackState("caption-styles", {
      error: null,
      message: null,
    });
    const remaining = videoRender.animationPresets.filter(
      (preset) => preset.id !== presetId,
    );
    const fallbackPreset = getCaptionAnimationPresetById(
      remaining,
      selectedCaptionStyle?.animationPresetId &&
        selectedCaptionStyle.animationPresetId !== presetId
        ? selectedCaptionStyle.animationPresetId
        : undefined,
      DEFAULT_CAPTION_ANIMATION_PRESET_ID,
    );
    setVideoRender({
      ...videoRender,
      animationPresets: remaining,
      captionStyles: videoRender.captionStyles.map((style) =>
        style.animationPresetId === presetId
          ? {
              ...style,
              animationPresetId: fallbackPreset.id,
              animationPreset: fallbackPreset.slug,
            }
          : style,
      ),
    });
    setCaptionLibraryTab("presets");
    setSelectedAnimationPresetId(fallbackPreset.id);
  }

  function addCaptionStyle() {
    if (!videoRender) return;
    updateSectionFeedbackState("caption-styles", {
      error: null,
      message: null,
    });
    const nextStyle = createCaptionStyleDraft(
      videoRender.captionStyles.length + 1,
    );
    const dedupedId = `${slugify(nextStyle.name) || "caption-style"}-${Date.now()}`;
    nextStyle.id = dedupedId;
    setVideoRender({
      ...videoRender,
      defaultCaptionStyleId: videoRender.defaultCaptionStyleId || dedupedId,
      captionStyles: [...videoRender.captionStyles, nextStyle],
    });
    setCaptionLibraryTab("styles");
    setSelectedCaptionStyleId(dedupedId);
  }

  function duplicateCaptionStyle(styleId: string) {
    if (!videoRender) return;
    const source = videoRender.captionStyles.find(
      (style) => style.id === styleId,
    );
    if (!source) return;
    updateSectionFeedbackState("caption-styles", {
      error: null,
      message: null,
    });
    const name = buildUniqueCaptionStyleName(
      videoRender.captionStyles,
      source.name,
    );
    const duplicated: CaptionStyleEntry = {
      ...source,
      id: buildUniqueCaptionStyleId(videoRender.captionStyles, name),
      name,
    };
    const sourceIndex = videoRender.captionStyles.findIndex(
      (style) => style.id === styleId,
    );
    const nextStyles = [...videoRender.captionStyles];
    nextStyles.splice(sourceIndex + 1, 0, duplicated);
    setVideoRender({
      ...videoRender,
      captionStyles: nextStyles,
    });
    setCaptionLibraryTab("styles");
    setSelectedCaptionStyleId(duplicated.id);
  }

  function deleteCaptionStyle(styleId: string) {
    if (!videoRender || videoRender.captionStyles.length <= 1) return;
    updateSectionFeedbackState("caption-styles", {
      error: null,
      message: null,
    });
    const remaining = videoRender.captionStyles.filter(
      (style) => style.id !== styleId,
    );
    const nextDefault =
      videoRender.defaultCaptionStyleId === styleId
        ? remaining[0].id
        : videoRender.defaultCaptionStyleId;
    setVideoRender({
      ...videoRender,
      defaultCaptionStyleId: nextDefault,
      captionStyles: remaining,
    });
    setCaptionLibraryTab("styles");
    setSelectedCaptionStyleId(remaining[0]?.id || null);
  }

  function handleCaptionStyleSelection(styleId: string) {
    setCaptionLibraryTab("styles");
    setSelectedCaptionStyleId(styleId);
    const nextStyle = videoRender?.captionStyles.find(
      (style) => style.id === styleId,
    );
    if (nextStyle) {
      setSelectedAnimationPresetId(nextStyle.animationPresetId);
    }
  }

  function handleAnimationPresetSelection(presetId: string) {
    setCaptionLibraryTab("presets");
    setSelectedAnimationPresetId(presetId);
  }

  function addMusic() {
    if (!videoRender) return;
    updateSectionFeedbackState("music-library", { error: null, message: null });
    const nextTrack = createMusicDraft(videoRender.musicTracks.length + 1);
    const dedupedId = `${slugify(nextTrack.name) || "music"}-${Date.now()}`;
    nextTrack.id = dedupedId;
    setVideoRender({
      ...videoRender,
      musicTracks: [...videoRender.musicTracks, nextTrack],
    });
    selectAudioSelection({ kind: "music", id: dedupedId });
  }

	  function deleteMusic(trackId: string) {
	    if (!videoRender || videoRender.musicTracks.length <= 1) return;
	    updateSectionFeedbackState("music-library", { error: null, message: null });
	    const remaining = videoRender.musicTracks.filter(
	      (track) => track.id !== trackId,
    );
    setVideoRender({
      ...videoRender,
      musicTracks: remaining,
    });
    selectAudioSelection(
      remaining[0] ? { kind: "music", id: remaining[0].id } : null,
    );
  }

  function addSound() {
    if (!soundDesignSettings) return;
    updateSectionFeedbackState("sound-library", { error: null, message: null });
    const seededCategory =
      soundLibraryCategoryFilter === "__uncategorized__"
        ? ""
        : soundLibraryCategoryFilter !== "all"
          ? soundLibraryCategoryFilter
          : selectedSound?.category || "Impact";
    const nextSound = createSoundDraft(soundDesignSettings.library.length + 1, {
      category: seededCategory,
      semanticTypes: selectedSound?.semanticTypes?.length
        ? [...selectedSound.semanticTypes]
        : undefined,
      timingType: selectedSound?.timingType,
      defaultAnchor: selectedSound?.defaultAnchor,
      defaultGainDb: selectedSound?.defaultGainDb,
      defaultFadeInMs: selectedSound?.defaultFadeInMs,
      defaultFadeOutMs: selectedSound?.defaultFadeOutMs,
      license: selectedSound?.license || "Internal",
      source: selectedSound?.source,
      stylePalettes: selectedSound?.stylePalettes ? [...selectedSound.stylePalettes] : undefined,
      frequencyBand: selectedSound?.frequencyBand,
      layerRoles: selectedSound?.layerRoles ? [...selectedSound.layerRoles] : undefined,
      literalness: selectedSound?.literalness,
    });
    setSoundDesignSettings({
      ...soundDesignSettings,
      library: [...soundDesignSettings.library, nextSound],
    });
    setSoundLibrarySearchQuery("");
    setSoundLibraryFileFilter("all");
    selectAudioSelection({ kind: "sfx", id: nextSound.id });
  }

	  function deleteSound(soundId: string) {
	    if (!soundDesignSettings || soundDesignSettings.library.length <= 1) return;
	    updateSectionFeedbackState("sound-library", { error: null, message: null });
	    const remaining = soundDesignSettings.library.filter(
	      (sound) => sound.id !== soundId,
    );
    setSoundDesignSettings({
      ...soundDesignSettings,
      library: remaining,
    });
    selectAudioSelection(
      remaining[0] ? { kind: "sfx", id: remaining[0].id } : null,
    );
  }

  async function uploadSoundFile(file: File) {
    if (!selectedSound) return;
    setSoundUploadsById((current) => ({
      ...current,
      [selectedSound.id]: { isUploading: true, error: null },
    }));
    updateSectionFeedbackState("sound-library", { error: null, message: null });

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("soundId", selectedSound.id);

      const response = await fetch(
        "/api/short-form-videos/settings/sound-library/upload",
        {
          method: "POST",
          body: formData,
        },
      );
      const payload = (await response.json().catch(() => ({}))) as {
        success?: boolean;
        data?: {
          audioRelativePath: string;
          audioUrl?: string;
          waveformPeaks?: number[];
          durationSeconds?: number;
          sampleRate?: number;
          channels?: number;
          uploadedAt?: string;
          updatedAt?: string;
        };
        error?: string;
      };

      if (!response.ok || payload.success === false || !payload.data) {
        throw new Error(payload.error || "Failed to upload sound file");
      }

      const uploadedAt = payload.data!.uploadedAt || payload.data!.updatedAt;
      updateSelectedSound((sound) => ({
        ...sound,
        audioRelativePath: payload.data!.audioRelativePath,
        audioUrl: payload.data!.audioUrl,
        waveformPeaks: payload.data!.waveformPeaks,
        durationSeconds: payload.data!.durationSeconds,
        sampleRate: payload.data!.sampleRate,
        channels: payload.data!.channels,
        uploadedAt,
        updatedAt: uploadedAt,
      }));
      setSoundUploadsById((current) => ({
        ...current,
        [selectedSound.id]: { isUploading: false, error: null },
      }));
    } catch (err) {
      setSoundUploadsById((current) => ({
        ...current,
        [selectedSound.id]: {
          isUploading: false,
          error:
            err instanceof Error ? err.message : "Failed to upload sound file",
        },
      }));
    }
  }
  async function generateStyleTest() {
    if (!imageStyles || !selectedStyle) return;

    const styleId = selectedStyle.id;
    const styleSnapshot = { ...selectedStyle };
    setStyleTestsById((current) => ({
      ...current,
      [styleId]: {
        isLoading: true,
        error: null,
        cleanImageUrl:
          current[styleId]?.cleanImageUrl ||
          selectedStyle.lastTestImage?.cleanImageUrl ||
          null,
        previewImageUrl:
          current[styleId]?.previewImageUrl ||
          selectedStyle.lastTestImage?.previewImageUrl ||
          null,
      },
    }));

    try {
      const data = await parseStyleTestResponse(
        await fetch("/api/short-form-videos/settings/style-test", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            promptTemplates: imageStyles.promptTemplates,
            visualGenerationModelId:
              imageStyles.defaultVisualGenerationModelId,
            style: styleSnapshot,
          }),
        }),
      );
      setStyleTestsById((current) => ({
        ...current,
        [styleId]: {
          isLoading: false,
          error: null,
          cleanImageUrl: data.cleanImageUrl || null,
          previewImageUrl: data.previewImageUrl || null,
        },
      }));
      const nextLastTestImage: PersistedStyleTestImage = {
        runId: data.runId,
        cleanRelativePath: data.cleanRelativePath,
        previewRelativePath: data.previewRelativePath,
        updatedAt: data.updatedAt,
        cleanImageUrl: data.cleanImageUrl,
        previewImageUrl: data.previewImageUrl,
      };
      setImageStyles((current) => {
        if (!current) return current;
        return {
          ...current,
          styles: current.styles.map((style) =>
            style.id === styleId
              ? {
                  ...style,
                  lastTestImage: nextLastTestImage,
                }
              : style,
          ),
        };
      });
      setInitialImageStyles((current) => {
        if (!current) return current;
        return {
          ...current,
          styles: current.styles.map((style) =>
            style.id === styleId
              ? {
                  ...style,
                  lastTestImage: nextLastTestImage,
                }
              : style,
          ),
        };
      });
    } catch (err) {
      setStyleTestsById((current) => ({
        ...current,
        [styleId]: {
          isLoading: false,
          error:
            err instanceof Error
              ? err.message
              : "Failed to generate style test image",
          cleanImageUrl:
            current[styleId]?.cleanImageUrl ||
            selectedStyle.lastTestImage?.cleanImageUrl ||
            null,
          previewImageUrl:
            current[styleId]?.previewImageUrl ||
            selectedStyle.lastTestImage?.previewImageUrl ||
            null,
        },
      }));
    }
  }

  async function generateTtsPreview() {
    if (!selectedVoice) return;

    setTtsPreview((current) => ({
      ...current,
      isLoading: true,
      error: null,
    }));

    try {
      if (dirtyBySection["tts-voice"]) {
        await saveSection("tts-voice");
      }

      const data = await parseTtsPreviewResponse(
        await fetch("/api/short-form-videos/settings/voice-library/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ voiceId: selectedVoice.id }),
        }),
      );

      setVideoRender(data.videoRender);
      setInitialVideoRender(data.videoRender);
      setSelectedVoiceId(data.voice.id);
      setTtsPreview({
        isLoading: false,
        error: null,
        audioUrl: data.audioUrl,
        reusedExisting: data.reusedExisting,
      });
      updateSectionFeedbackState("tts-voice", {
        saving: false,
        error: null,
        message: data.reusedExisting
          ? "Saved voice sample already existed, so the dashboard will now reuse that same reference clip for future narration runs."
          : "Saved a reusable voice sample. Future XML narration runs will clone from this exact reference clip for more stable long-form output.",
      });
    } catch (err) {
      setTtsPreview((current) => ({
        ...current,
        isLoading: false,
        error:
          err instanceof Error
            ? err.message
            : "Failed to generate saved voice sample",
      }));
    }
  }

  async function generateMusicPreview() {
    if (!selectedMusic) return;
    if (getMusicSourceType(selectedMusic) !== "ai-generated") {
      setMusicPreview((current) => ({
        ...current,
        isLoading: false,
        error: "Only AI-generated music tracks can generate a soundtrack from a prompt.",
      }));
      return;
    }

    setMusicPreview((current) => ({
      ...current,
      isLoading: true,
      error: null,
    }));

    try {
      if (dirtyBySection["music-library"]) {
        await saveSection("music-library");
      }

      const data = await parseMusicPreviewResponse(
        await fetch("/api/short-form-videos/settings/music-library/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ trackId: selectedMusic.id }),
        }),
      );

      setVideoRender(data.videoRender);
      setInitialVideoRender(data.videoRender);
      selectAudioSelection({ kind: "music", id: data.track.id });
      setMusicPreview({
        isLoading: false,
        error: null,
        audioUrl: data.audioUrl,
        reusedExisting: data.reusedExisting,
      });
      updateSectionFeedbackState("music-library", {
        saving: false,
        error: null,
        message: data.reusedExisting
          ? "Saved music file already existed, so sound-design runs can reuse the exact same file."
          : "Saved a reusable music file. Sound-design planning and generation can now reuse this exact audio.",
      });
    } catch (err) {
      setMusicPreview((current) => ({
        ...current,
        isLoading: false,
        error:
          err instanceof Error
            ? err.message
            : "Failed to generate saved soundtrack file",
      }));
    }
  }

  if (loading) {
    return (
      <div className="space-y-6 p-4 sm:p-6 lg:p-8">
        <Skeleton className="h-4 w-48" />
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-48 w-full" />
        <OrbitLoader label="Loading short-form workflow settings" />
      </div>
    );
  }

  return (
    <ShortFormSubpageShell
      eyebrow={pageMeta.eyebrow}
      title={pageMeta.title}
      description={pageMeta.description}
      actions={
        <>
          <RefreshIconButton
            onClick={() => void loadSettings()}
            disabled={pageReloadDisabled}
            refreshing={loading}
            tooltip="Reload page state"
            refreshingTooltip="Reloading page state…"
            label="Reload page state"
          />
          <Badge variant="outline">{pageMeta.summaryLabel}</Badge>
          {pageActionSectionIds.map((sectionId) => (
            <SectionActions
              key={sectionId}
              dirty={dirtyBySection[sectionId]}
              saving={sectionFeedback[sectionId].saving}
              saveLabel={getSettingsSectionSaveLabel(sectionId)}
              onSave={() => void saveSection(sectionId)}
              onReset={() => resetSection(sectionId)}
            />
          ))}
        </>
      }
      preContent={
        error ? (
          <ValidationNotice title="Settings error" message={error} />
        ) : null
      }
    >
      {activeSection === "topic" ? (
        <Card className="space-y-3 p-5">
          <WorkflowSectionHeader
            title="No global Topic settings"
            description="Topic capture is project-specific. The settings sidebar mirrors the workflow exactly, so this page is intentionally present even though there is nothing global to configure here yet."
          />
        </Card>
      ) : null}

      {activeSection === "hook" ? (
        <div className="space-y-6">{promptSections[0]}</div>
      ) : null}

      {activeSection === "research" ? (
        <div className="space-y-6">{promptSections[1]}</div>
      ) : null}

      {activeSection === "text-script" ? (
        <div className="space-y-6">{textScriptPromptSection}</div>
      ) : null}

      {activeSection === "plan-visuals" ? (
        <div className="space-y-6">{xmlVisualPlanningPromptSection}</div>
      ) : null}

      {activeSection === "plan-sound-design" ||
      activeSection === "generate-sound-design"
        ? soundLibrarySection
        : null}

      {activeSection === "generate-narration-audio" ? (
        <div className="space-y-6">
          <section id="pause-removal" className="scroll-mt-24">
            <Card className="space-y-5 p-5">
              <WorkflowSectionHeader
                title="Pause-removal defaults"
                description="Set the global silence-trimming defaults for the narration pipeline. The silence-trimming ffmpeg pass runs after original narration generation and before forced alignment. Individual projects can override these values from their project page."
              />

              {videoRender ? (
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Remove pauses longer than (seconds)
                    </label>
                    <Input
                      type="number"
                      min={0.01}
                      max={2.5}
                      step={0.01}
                      value={videoRender.pauseRemoval.minSilenceDurationSeconds}
                      onChange={(event) => {
                        updateSectionFeedbackState("pause-removal", {
                          error: null,
                          message: null,
                        });
                        setVideoRender({
                          ...videoRender,
                          pauseRemoval: {
                            ...videoRender.pauseRemoval,
                            minSilenceDurationSeconds: Math.min(
                              2.5,
                              Math.max(
                                0.01,
                                Math.round(
                                  (Number(event.target.value) || 0.35) * 100,
                                ) / 100,
                              ),
                            ),
                          },
                        });
                      }}
                      className="max-w-[180px]"
                    />
                    <p className="text-xs text-muted-foreground">
                      Silent spans longer than this are trimmed from the
                      processed narration audio before alignment.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Silence threshold (dB)
                    </label>
                    <Input
                      type="number"
                      min={-80}
                      max={-5}
                      step={0.1}
                      value={videoRender.pauseRemoval.silenceThresholdDb}
                      onChange={(event) => {
                        updateSectionFeedbackState("pause-removal", {
                          error: null,
                          message: null,
                        });
                        setVideoRender({
                          ...videoRender,
                          pauseRemoval: {
                            ...videoRender.pauseRemoval,
                            silenceThresholdDb: Math.min(
                              -5,
                              Math.max(
                                -80,
                                Math.round(
                                  (Number(event.target.value) || -40) * 10,
                                ) / 10,
                              ),
                            ),
                          },
                        });
                      }}
                      className="max-w-[180px]"
                    />
                    <p className="text-xs text-muted-foreground">
                      Anything quieter than this is treated as silence during
                      the trimming pass.
                    </p>
                  </div>
                </div>
              ) : null}

              <div className="rounded-lg border border-border bg-background/50 p-3 text-xs text-muted-foreground">
                These are the dashboard-wide defaults. On a specific short-form
                project, you can override them and then use the dedicated{" "}
                <span className="font-medium text-foreground">
                  Re-run pause removal + alignment
                </span>{" "}
                action without regenerating the original narration.
              </div>

              <SectionFeedbackNotice
                feedback={sectionFeedback["pause-removal"]}
              />
            </Card>
          </section>

          <section id="tts-voice" className="scroll-mt-24">
            <Card className="space-y-5 p-5">
              <WorkflowSectionHeader
                title="Qwen voice library"
                description="Manage the reusable voice library that the dashboard really uses for final-video narration. VoiceDesign entries are the new primary path. Legacy/custom entries remain supported only for migrated speaker-based voices and fallback compatibility."
              />

              {videoRender ? (
                <div className="space-y-5">
                  <div className="rounded-lg border border-border bg-background/60 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <h3 className="text-sm font-medium text-foreground">
                          Saved voices
                        </h3>
                        <p className="mt-1 max-w-3xl text-xs text-muted-foreground">
                          VoiceDesign uses Qwen&apos;s <code>voice-design</code>{" "}
                          mode, which means the design text is the real control.
                          It does not expose a reusable deterministic speaker ID
                          in the current local runner. Legacy/custom entries
                          still use built-in speakers plus instructions and are
                          kept here only for migration and fallback.
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          variant="outline"
                          onClick={addVoice}
                          disabled={sectionFeedback["tts-voice"].saving}
                        >
                          Add generated voice
                        </Button>
                        <Button
                          variant="outline"
                          onClick={addUploadedReferenceVoice}
                          disabled={sectionFeedback["tts-voice"].saving}
                        >
                          Add uploaded reference
                        </Button>
                      </div>
                    </div>

                    <div className="mt-4 grid gap-4 lg:grid-cols-[280px,1fr]">
                      <div className="space-y-2">
                        <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                          Voice library
                        </label>
                        <Select
                          value={selectedVoiceId || ""}
                          onChange={(event) =>
                            setSelectedVoiceId(event.target.value)
                          }
                          disabled={videoRender.voices.length === 0}
                        >
                          {videoRender.voices.map((voice) => (
                            <option key={voice.id} value={voice.id}>
                              {voice.name} [{getVoiceSourceLabel(voice)}]
                              {voice.id === videoRender.defaultVoiceId
                                ? " (default)"
                                : ""}
                            </option>
                          ))}
                        </Select>
                        <div className="rounded-lg border border-border bg-background/50 p-3 text-xs text-muted-foreground">
                          <p>
                            <span className="font-medium text-foreground">
                              Default voice:
                            </span>{" "}
                            {videoRender.voices.find(
                              (voice) =>
                                voice.id === videoRender.defaultVoiceId,
                            )?.name || "Not set"}
                          </p>
                          <p className="mt-2">
                            Projects can override the default voice
                            individually. Older projects with no saved override
                            fall back to whatever is currently marked default.
                          </p>
                        </div>
                      </div>

                      {selectedVoice ? (
                        <div className="space-y-4 rounded-lg border border-border bg-background/50 p-4">
                          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                            <div className="space-y-2">
                              <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                                Voice name
                              </label>
                              <Input
                                value={selectedVoice.name}
                                onChange={(event) => {
                                  updateSelectedVoice((voice) => ({
                                    ...voice,
                                    name: event.target.value,
                                  }));
                                }}
                                placeholder="Calm Authority"
                              />
                            </div>
                            <div className="space-y-2">
                              <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                                Voice source
                              </label>
                              <Select
                                value={selectedVoice.sourceType || "generated"}
                                onChange={(event) => {
                                  const sourceType =
                                    event.target.value === "uploaded-reference"
                                      ? "uploaded-reference"
                                      : "generated";
                                  updateSelectedVoice((voice) => {
                                    const transcript =
                                      voice.referenceText || voice.previewText;
                                    return {
                                      ...voice,
                                      sourceType,
                                      mode:
                                        sourceType === "uploaded-reference"
                                          ? "voice-design"
                                          : voice.mode,
                                      previewText: transcript,
                                      referenceText:
                                        sourceType === "uploaded-reference"
                                          ? transcript
                                          : voice.referenceText,
                                      ...(sourceType === "uploaded-reference"
                                        ? {
                                            referencePrompt: undefined,
                                            referenceMode: undefined,
                                            referenceSpeaker: undefined,
                                          }
                                        : {}),
                                    };
                                  });
                                }}
                              >
                                <option value="generated">
                                  Generated voice library entry
                                </option>
                                <option value="uploaded-reference">
                                  Uploaded reference clip
                                </option>
                              </Select>
                            </div>
                            {(selectedVoice.sourceType || "generated") ===
                            "generated" ? (
                              <div className="space-y-2">
                                <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                                  Mode
                                </label>
                                <Select
                                  value={selectedVoice.mode}
                                  onChange={(event) => {
                                    const mode =
                                      event.target.value === "custom-voice"
                                        ? "custom-voice"
                                        : "voice-design";
                                    updateSelectedVoice((voice) => ({
                                      ...voice,
                                      mode,
                                      ...(mode === "custom-voice"
                                        ? {
                                            speaker: voice.speaker || "Aiden",
                                            legacyInstruct:
                                              voice.legacyInstruct ||
                                              voice.voiceDesignPrompt,
                                          }
                                        : {}),
                                    }));
                                  }}
                                >
                                  <option value="voice-design">
                                    VoiceDesign
                                  </option>
                                  <option value="custom-voice">
                                    Legacy custom voice
                                  </option>
                                </Select>
                              </div>
                            ) : null}
                          </div>

                          <div className="flex flex-wrap items-center gap-2 text-xs">
                            <span className="rounded-full border border-border bg-background px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
                              {getVoiceSourceLabel(selectedVoice)}
                            </span>
                            <Button
                              type="button"
                              variant={
                                selectedVoice.id === videoRender.defaultVoiceId
                                  ? "default"
                                  : "outline"
                              }
                              onClick={() => {
                                updateSectionFeedbackState("tts-voice", {
                                  error: null,
                                  message: null,
                                });
                                setVideoRender({
                                  ...videoRender,
                                  defaultVoiceId: selectedVoice.id,
                                });
                              }}
                            >
                              {selectedVoice.id === videoRender.defaultVoiceId
                                ? "Default voice"
                                : "Set as default"}
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              onClick={() => deleteVoice(selectedVoice.id)}
                              disabled={videoRender.voices.length <= 1}
                            >
                              Delete voice
                            </Button>
                          </div>

                          {(selectedVoice.sourceType || "generated") ===
                          "generated" ? (
                            <>
                              <div className="space-y-2">
                                <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                                  {selectedVoice.mode === "voice-design"
                                    ? "VoiceDesign prompt"
                                    : "Voice description / legacy instruction snapshot"}
                                </label>
                                <Textarea
                                  value={selectedVoice.voiceDesignPrompt}
                                  onChange={(event) => {
                                    updateSelectedVoice((voice) => ({
                                      ...voice,
                                      voiceDesignPrompt: event.target.value,
                                      ...(voice.mode === "custom-voice"
                                        ? { legacyInstruct: event.target.value }
                                        : {}),
                                    }));
                                  }}
                                  className="min-h-[150px] font-mono text-xs"
                                />
                                <p className="text-xs text-muted-foreground">
                                  {selectedVoice.mode === "voice-design"
                                    ? "This prompt shapes the reusable reference clip in Qwen voice-design mode. Qwen still does not expose a locked speaker ID here, so the practical stabilization path is generating and then reusing the saved sample below."
                                    : "This legacy/custom entry still passes speaker + instruction text into Qwen custom-voice mode so older behavior remains runnable."}
                                </p>
                              </div>

                              {selectedVoice.mode === "custom-voice" ? (
                                <div className="space-y-2">
                                  <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                                    Legacy speaker
                                  </label>
                                  <Input
                                    value={selectedVoice.speaker || ""}
                                    onChange={(event) => {
                                      updateSelectedVoice((voice) => ({
                                        ...voice,
                                        speaker: event.target.value,
                                      }));
                                    }}
                                    placeholder="Aiden"
                                  />
                                  <p className="text-xs text-muted-foreground">
                                    Used only for legacy/custom voice entries.
                                    VoiceDesign entries ignore speaker and use
                                    the design prompt alone.
                                  </p>
                                </div>
                              ) : null}
                            </>
                          ) : null}

                          <div className="space-y-2">
                            <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                              Notes
                            </label>
                            <Textarea
                              value={selectedVoice.notes}
                              onChange={(event) => {
                                updateSelectedVoice((voice) => ({
                                  ...voice,
                                  notes: event.target.value,
                                }));
                              }}
                              className="min-h-[90px] text-xs"
                              placeholder="Optional notes about when to use this voice"
                            />
                          </div>

                          <div className="space-y-4 rounded-lg border border-border bg-background/60 p-4">
                            {(selectedVoice.sourceType || "generated") ===
                            "uploaded-reference" ? (
                              <>
                                <div className="flex flex-wrap items-center justify-between gap-3">
                                  <div>
                                    <h3 className="text-sm font-medium text-foreground">
                                      Uploaded reference voice
                                    </h3>
                                    <p className="mt-1 text-xs text-muted-foreground">
                                      Upload a short recording and transcript.
                                      The dashboard converts common audio
                                      uploads to mono WAV, saves the clip in the
                                      voice library, and then XML narration
                                      reuses that exact reference clip in Qwen
                                      voice-clone mode.
                                    </p>
                                  </div>
                                  <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-border px-3 py-2 text-sm hover:bg-accent">
                                    <span>
                                      {selectedVoiceUpload?.isUploading
                                        ? "Uploading…"
                                        : savedVoiceAudioUrl
                                          ? "Replace reference audio"
                                          : "Upload reference audio"}
                                    </span>
                                    <input
                                      type="file"
                                      accept="audio/wav,audio/wave,audio/x-wav,audio/mpeg,audio/mp3,audio/mp4,audio/x-m4a,audio/aac,audio/ogg,audio/opus,audio/webm,video/webm,.wav,.mp3,.m4a,.aac,.mp4,.ogg,.opus,.webm"
                                      className="hidden"
                                      disabled={
                                        selectedVoiceUpload?.isUploading
                                      }
                                      onChange={(event) => {
                                        const file = event.target.files?.[0];
                                        if (file) {
                                          void uploadReferenceVoice(file);
                                        }
                                        event.currentTarget.value = "";
                                      }}
                                    />
                                  </label>
                                </div>

                                {selectedVoiceUpload?.error ? (
                                  <ValidationNotice
                                    title="Reference upload failed"
                                    message={selectedVoiceUpload.error}
                                  />
                                ) : null}

                                <div className="space-y-2">
                                  <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                                    Transcript for the uploaded clip
                                  </label>
                                  <Textarea
                                    value={
                                      selectedVoice.referenceText ||
                                      selectedVoice.previewText
                                    }
                                    onChange={(event) => {
                                      updateSelectedVoice((voice) => ({
                                        ...voice,
                                        referenceText: event.target.value,
                                        previewText: event.target.value,
                                      }));
                                    }}
                                    className="min-h-[110px] font-mono text-xs"
                                  />
                                  <p className="text-xs text-muted-foreground">
                                    Keep this aligned with the uploaded
                                    recording. Qwen uses the saved clip plus
                                    this transcript as the cloning reference
                                    during narration generation.
                                  </p>
                                </div>
                              </>
                            ) : (
                              <>
                                <div className="flex flex-wrap items-center justify-between gap-3">
                                  <div>
                                    <h3 className="text-sm font-medium text-foreground">
                                      Saved voice sample
                                    </h3>
                                    <p className="mt-1 text-xs text-muted-foreground">
                                      Generate one reusable reference clip for
                                      this voice entry. XML narration runs then
                                      switch to voice-clone mode and reuse this
                                      exact sample instead of asking Qwen to
                                      redesign the voice on every narration
                                      chunk. If a project reaches XML narration
                                      before you click this, the worker now
                                      auto-saves the first generated reference
                                      clip back into the voice library too.
                                    </p>
                                  </div>
                                  <Button
                                    onClick={() => void generateTtsPreview()}
                                    disabled={
                                      ttsPreview.isLoading ||
                                      sectionFeedback["tts-voice"].saving
                                    }
                                  >
                                    {ttsPreview.isLoading
                                      ? "Generating…"
                                      : hasSavedVoiceSample(selectedVoice)
                                        ? "Regenerate saved sample"
                                        : "Generate saved sample"}
                                  </Button>
                                </div>

                                <div className="space-y-2">
                                  <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                                    Reference/sample text
                                  </label>
                                  <Textarea
                                    value={selectedVoice.previewText}
                                    onChange={(event) => {
                                      updateSelectedVoice((voice) => ({
                                        ...voice,
                                        previewText: event.target.value,
                                      }));
                                    }}
                                    className="min-h-[110px] font-mono text-xs"
                                  />
                                  <p className="text-xs text-muted-foreground">
                                    This text becomes the saved cloning
                                    reference. Keep it reasonably
                                    representative. The generator will
                                    automatically extend very short text into a
                                    longer one-chunk reference clip so the saved
                                    sample stays more stable across longer
                                    narrations.
                                  </p>
                                </div>

                                {ttsPreview.error ? (
                                  <ValidationNotice
                                    title="Saved voice sample failed"
                                    message={ttsPreview.error}
                                  />
                                ) : null}

                                {ttsPreview.isLoading ? (
                                  <div className="rounded-lg border border-border p-4">
                                    <OrbitLoader label="Generating reusable Qwen voice sample" />
                                  </div>
                                ) : null}
                              </>
                            )}

                            {savedVoiceAudioUrl ? (
                              <div className="space-y-3 rounded-lg border border-border bg-background/70 p-4">
                                <div className="grid gap-3 md:grid-cols-2">
                                  <div>
                                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                                      Saved voice
                                    </p>
                                    <p className="mt-1 text-sm text-foreground">
                                      {selectedVoice.name}
                                    </p>
                                  </div>
                                  <div>
                                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                                      Reference text
                                    </p>
                                    <p className="mt-1 text-sm text-foreground">
                                      {selectedVoice.referenceText ||
                                        selectedVoice.previewText}
                                    </p>
                                  </div>
                                </div>
                                <audio
                                  controls
                                  className="w-full"
                                  src={savedVoiceAudioUrl}
                                />
                                <div className="grid gap-3 md:grid-cols-2">
                                  <div>
                                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                                      Voice source
                                    </p>
                                    <p className="mt-1 text-sm text-foreground">
                                      {(selectedVoice.sourceType ||
                                        "generated") === "uploaded-reference"
                                        ? "Uploaded reference clip"
                                        : "Generated reference sample"}
                                    </p>
                                  </div>
                                  {(selectedVoice.sourceType || "generated") ===
                                  "generated" ? (
                                    <div>
                                      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                                        Mode used
                                      </p>
                                      <p className="mt-1 text-sm text-foreground">
                                        {(selectedVoice.referenceMode ||
                                          selectedVoice.mode) === "custom-voice"
                                          ? "Legacy custom voice"
                                          : "VoiceDesign"}
                                      </p>
                                    </div>
                                  ) : null}
                                  {(selectedVoice.referenceSpeaker ||
                                    selectedVoice.speaker) &&
                                  (selectedVoice.sourceType || "generated") ===
                                    "generated" ? (
                                    <div>
                                      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                                        Speaker used
                                      </p>
                                      <p className="mt-1 text-sm text-foreground">
                                        {selectedVoice.referenceSpeaker ||
                                          selectedVoice.speaker}
                                      </p>
                                    </div>
                                  ) : null}
                                </div>
                                {(selectedVoice.sourceType || "generated") ===
                                "generated" ? (
                                  <div>
                                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                                      Prompt snapshot used
                                    </p>
                                    <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">
                                      {selectedVoice.referencePrompt ||
                                        selectedVoice.voiceDesignPrompt}
                                    </p>
                                  </div>
                                ) : null}
                                {selectedVoice.referenceGeneratedAt ? (
                                  <p className="text-xs text-muted-foreground">
                                    Saved{" "}
                                    {new Date(
                                      selectedVoice.referenceGeneratedAt,
                                    ).toLocaleString()}
                                    .
                                    {(selectedVoice.sourceType ||
                                      "generated") === "generated"
                                      ? ttsPreview.reusedExisting === true
                                        ? " Reused the existing reference clip on the latest request."
                                        : ttsPreview.reusedExisting === false
                                          ? " Regenerated the saved reference clip on the latest request."
                                          : ""
                                      : " Uploaded clips are reused directly during narration generation."}
                                  </p>
                                ) : null}
                              </div>
                            ) : null}
                          </div>
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>
              ) : null}

              <SectionFeedbackNotice feedback={sectionFeedback["tts-voice"]} />
            </Card>
          </section>
        </div>
      ) : null}

      {activeSection === "generate-visuals-motion-graphics" ? (
        <div className="space-y-6">
          <section id="motion-graphics" className="scroll-mt-24">
            <div className="space-y-6">
              {motionGraphicsSettings ? (
                <div className="space-y-5">
                  <Card className="space-y-4 p-5">
                  <div className="flex flex-wrap items-center gap-3">
                    <label className="text-sm font-medium text-foreground">
                        Template
                    </label>
                    <div className="min-w-[18rem] flex-1">
                      <Select
                        value={selectedMotionTemplateId || ""}
                        onChange={(event) =>
                          selectMotionTemplate(event.target.value || null)
                        }
                      >
                        {motionGraphicsSettings.templates.map((template) => (
                          <option key={template.id} value={template.id}>
                            {template.displayName} · {template.rendererId}
                          </option>
                        ))}
                      </Select>
                    </div>
                  </div>
                  </Card>

                  {selectedMotionTemplate ? (
                    <div className="space-y-4">
                      <Card className="space-y-5 p-5">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="min-w-0 space-y-1">
                            <h2 className="text-lg font-semibold text-foreground">
                              {selectedMotionTemplate.displayName || "Untitled template"}
                            </h2>
                            <p className="text-xs text-muted-foreground">
                              {selectedMotionTemplate.id} · {selectedMotionTemplate.rendererId}
                            </p>
                          </div>
                          <div className="flex flex-wrap items-center justify-end gap-3">
                            <label className="flex items-center gap-2 text-sm text-foreground">
                              <input
                                type="checkbox"
                                checked={selectedMotionTemplate.enabled}
                                onChange={(event) =>
                                  updateSelectedMotionTemplate((template) => ({
                                    ...template,
                                    enabled: event.target.checked,
                                  }))
                                }
                              />
                              Enabled
                            </label>
                            {selectedMotionTemplateDirty ? (
                              <SectionActions
                                dirty
                                saving={sectionFeedback["motion-graphics"].saving}
                                saveLabel="Save template"
                                resetLabel="Reset template"
                                onSave={() => void saveSelectedMotionTemplate()}
                                onReset={resetSelectedMotionTemplate}
                              />
                            ) : null}
                          </div>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {selectedMotionTemplate.description}
                        </p>
                        <div className="grid gap-4 md:grid-cols-3">
                          <div className="space-y-2">
                            <label className="text-sm font-medium text-foreground">Template id</label>
                            <Input
                              value={selectedMotionTemplate.id}
                              onChange={(event) =>
                                updateSelectedMotionTemplate((template) => ({
                                  ...template,
                                  id: event.target.value,
                                }))
                              }
                            />
                          </div>
                          <div className="space-y-2">
                            <label className="text-sm font-medium text-foreground">Renderer id</label>
                            <Select
                              value={selectedMotionTemplate.rendererId}
                              onChange={(event) =>
                                updateSelectedMotionTemplate((template) => ({
                                  ...template,
                                  rendererId: event.target.value,
                                }))
                              }
                            >
                              {supportedMotionGraphicRenderers.map((rendererId) => (
                                <option key={rendererId} value={rendererId}>
                                  {rendererId}
                                </option>
                              ))}
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <label className="text-sm font-medium text-foreground">Display name</label>
                            <Input
                              value={selectedMotionTemplate.displayName}
                              onChange={(event) =>
                                updateSelectedMotionTemplate((template) => ({
                                  ...template,
                                  displayName: event.target.value,
                                }))
                              }
                            />
                          </div>
                        </div>
                      </Card>

                      <div className="grid gap-4 lg:grid-cols-[minmax(15rem,0.9fr)_1.4fr]">
                        <Card className="overflow-hidden p-0">
                          <div className="aspect-[9/16] bg-muted">
                            {selectedMotionTemplatePreview?.videoUrl ? (
                              <video
                                key={selectedMotionTemplatePreview.videoUrl}
                                className="h-full w-full object-cover"
                                src={selectedMotionTemplatePreview.videoUrl}
                                poster={selectedMotionTemplatePreview.posterUrl || undefined}
                                controls
                                playsInline
                                loop
                              />
                            ) : selectedMotionTemplatePreview?.isLoading ? (
                              <div className="flex h-full items-center justify-center p-6">
                                <div className="w-full space-y-3">
                                  <Skeleton className="h-72 w-full" />
                                  <Skeleton className="h-4 w-2/3" />
                                  <Skeleton className="h-4 w-1/2" />
                                </div>
                              </div>
                            ) : (
                              <div className="flex h-full items-center justify-center p-6 text-center text-sm text-muted-foreground">
                                No preview rendered yet.
                              </div>
                            )}
                          </div>
                          <div className="space-y-2 p-3">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div>
                                <p className="text-sm font-medium text-foreground">
                                  Rendered preview
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  Uses the editable preview values.
                                </p>
                              </div>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => void regenerateSelectedMotionPreview()}
                                disabled={selectedMotionTemplatePreview?.isLoading}
                              >
                                {selectedMotionTemplatePreview?.isLoading
                                  ? "Rendering…"
                                  : "Regenerate"}
                              </Button>
                            </div>
                            {selectedMotionTemplatePreview?.error ? (
                              <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                                {selectedMotionTemplatePreview.error}
                              </p>
                            ) : selectedMotionTemplatePreview?.reusedExisting ? (
                              <p className="text-xs text-muted-foreground">
                                Cached preview reused for this exact template
                                configuration.
                              </p>
                            ) : null}
                          </div>
                        </Card>

                        <MotionPreviewValuesEditor
                          template={selectedMotionTemplate}
                          onChangeArg={updateSelectedMotionTemplatePreviewArg}
                          onChangePreviewDuration={(value) =>
                            updateSelectedMotionTemplate((template) => ({
                              ...template,
                              previewDurationSeconds: value,
                            }))
                          }
                        />
                      </div>

                      <Card className="space-y-4 p-5">
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-foreground">Description</label>
                        <Textarea
                          value={selectedMotionTemplate.description}
                          onChange={(event) =>
                            updateSelectedMotionTemplate((template) => ({
                              ...template,
                              description: event.target.value,
                            }))
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-foreground">When to use</label>
                        <Textarea
                          value={selectedMotionTemplate.whenToUse}
                          onChange={(event) =>
                            updateSelectedMotionTemplate((template) => ({
                              ...template,
                              whenToUse: event.target.value,
                            }))
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-foreground">
                          Additional usage instructions
                        </label>
                        <Textarea
                          value={selectedMotionTemplate.additionalUsageInstructions || ""}
                          placeholder="Optional. Leave blank when this template does not need extra Scribe-facing guidance."
                          onChange={(event) =>
                            updateSelectedMotionTemplate((template) => ({
                              ...template,
                              additionalUsageInstructions: event.target.value,
                            }))
                          }
                        />
                        <p className="text-xs text-muted-foreground">
                          If filled out, this text is injected into Scribe’s Plan Visuals prompt inside this template’s motion-graphic reference. Blank values are omitted entirely.
                        </p>
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-foreground">Duration guidance</label>
                        <Textarea
                          value={selectedMotionTemplate.durationGuidance}
                          onChange={(event) =>
                            updateSelectedMotionTemplate((template) => ({
                              ...template,
                              durationGuidance: event.target.value,
                            }))
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-foreground">
                          XML instructions
                        </label>
                        <Textarea
                          className="min-h-32 font-mono text-xs"
                          value={selectedMotionTemplate.xmlInstructions || ""}
                          placeholder="Template-specific XML rules, field-shape notes, and edge cases for Scribe."
                          onChange={(event) =>
                            updateSelectedMotionTemplate((template) => ({
                              ...template,
                              xmlInstructions: event.target.value,
                            }))
                          }
                        />
                        <p className="text-xs text-muted-foreground">
                          Injected through <code>{"{{xmlInstructions}}"}</code> in the Individual motion graphic template prompt.
                        </p>
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-foreground">
                          Example XML
                        </label>
                        <Textarea
                          className="min-h-48 font-mono text-xs"
                          value={selectedMotionTemplate.exampleXml || ""}
                          placeholder="<visual ... visualType=&quot;motion_graphic&quot;>...</visual>"
                          onChange={(event) =>
                            updateSelectedMotionTemplate((template) => ({
                              ...template,
                              exampleXml: event.target.value,
                            }))
                          }
                        />
                        <p className="text-xs text-muted-foreground">
                          Injected through <code>{"{{exampleXml}}"}</code> in the Individual motion graphic template prompt.
                        </p>
                      </div>
                      </Card>
                      <MotionConfigurableFieldsSummary
                        template={selectedMotionTemplate}
                      />

                      <Card className="p-5">
                      <details>
                        <summary className="cursor-pointer text-sm font-medium text-foreground">
                          Advanced JSON editors
                        </summary>
                        <div className="mt-4 grid gap-4 md:grid-cols-2">
                          <div className="space-y-2">
                            <label className="text-sm font-medium text-foreground">Preview values JSON</label>
                            <Textarea
                              className="min-h-40 font-mono text-xs"
                              value={motionPreviewArgsJsonDraft}
                              onChange={(event) => {
                                const draft = event.target.value;
                                setMotionPreviewArgsJsonDraft(draft);
                                try {
                                  const nextArgs = JSON.parse(draft) as Record<string, unknown>;
                                  if (!nextArgs || typeof nextArgs !== "object" || Array.isArray(nextArgs)) {
                                    throw new Error("Preview values must be a JSON object.");
                                  }
                                  updateSelectedMotionTemplate((template) => ({ ...template, previewArgs: nextArgs }));
                                } catch {
                                  updateSectionFeedbackState("motion-graphics", { error: "Preview values must be valid JSON before saving." });
                                }
                              }}
                            />
                          </div>
                          <div className="space-y-2">
                            <label className="text-sm font-medium text-foreground">Configurable fields JSON</label>
                            <Textarea
                              className="min-h-40 font-mono text-xs"
                              value={motionFieldsJsonDraft}
                              onChange={(event) => {
                                const draft = event.target.value;
                                setMotionFieldsJsonDraft(draft);
                                try {
                                  const nextFields = JSON.parse(draft) as MotionGraphicTemplateField[];
                                  if (!Array.isArray(nextFields)) {
                                    throw new Error("Configurable fields must be a JSON array.");
                                  }
                                  updateSelectedMotionTemplate((template) => ({ ...template, fields: nextFields }));
                                } catch {
                                  updateSectionFeedbackState("motion-graphics", { error: "Configurable fields must be valid JSON before saving." });
                                }
                              }}
                            />
                          </div>
                        </div>
                      </details>
                      </Card>
                    </div>
                  ) : null}

                </div>
              ) : (
                <Card className="space-y-3 p-5">
                  <Skeleton className="h-10 w-64" />
                  <Skeleton className="h-48 w-full" />
                </Card>
              )}

              <SectionFeedbackNotice feedback={sectionFeedback["motion-graphics"]} />
            </div>
          </section>
        </div>
      ) : null}

      {activeSection === "generate-visuals-image-generation-prompts" ? (
        <div className="space-y-6">
          <section id="image-templates" className="scroll-mt-24">
            {imageStyles ? (
              <div className="space-y-6">
                <PromptTemplateEditorCard
                  title="Image generation template"
                  description="Used for per-image generation and rerenders. Edit shared style, composition, based-on, and extra-reference guidance directly here."
                  value={imageStyles.promptTemplates.imageGenerationTemplate}
                  onChange={(value) =>
                    setPromptTemplateValue("imageStyles.imageGenerationTemplate", value)
                  }
                  {...getPromptTemplateFocusHandlers(
                    "imageStyles.imageGenerationTemplate",
                  )}
                  feedback={promptTemplateFeedback["imageStyles.imageGenerationTemplate"]}
                  dirty={isPromptTemplateDirty("imageStyles.imageGenerationTemplate")}
                  saving={promptTemplateFeedback["imageStyles.imageGenerationTemplate"].saving}
                  onSave={() =>
                    void savePromptTemplate("imageStyles.imageGenerationTemplate")
                  }
                  onReset={() =>
                    resetPromptTemplate("imageStyles.imageGenerationTemplate")
                  }
                  minHeightClassName="min-h-[480px]"
                  previewValues={nanoBananaPromptPreviewValues}
                />

                <PromptTemplateEditorCard
                  title="Based-on reference template"
                  description="Rendered only when an XML v2 asset has basedOn and the parent/base image is attached, then inserted wherever {{basedOnReferenceInstructions}} appears."
                  value={imageStyles.promptTemplates.basedOnReferenceTemplate}
                  onChange={(value) =>
                    setPromptTemplateValue(
                      "imageStyles.basedOnReferenceTemplate",
                      value,
                    )
                  }
                  {...getPromptTemplateFocusHandlers(
                    "imageStyles.basedOnReferenceTemplate",
                  )}
                  feedback={
                    promptTemplateFeedback[
                      "imageStyles.basedOnReferenceTemplate"
                    ]
                  }
                  dirty={isPromptTemplateDirty(
                    "imageStyles.basedOnReferenceTemplate",
                  )}
                  saving={
                    promptTemplateFeedback[
                      "imageStyles.basedOnReferenceTemplate"
                    ].saving
                  }
                  onSave={() =>
                    void savePromptTemplate(
                      "imageStyles.basedOnReferenceTemplate",
                    )
                  }
                  onReset={() =>
                    resetPromptTemplate(
                      "imageStyles.basedOnReferenceTemplate",
                    )
                  }
                  minHeightClassName="min-h-[200px]"
                  previewValues={nanoBananaPromptPreviewValues}
                />

                <PromptTemplateEditorCard
                  title="Extra references template"
                  description="Rendered only when active extra references exist, then inserted into top-level templates with {{extraReferencesInstructions}}. Character references are active only for characterDriven XML images. Use {{individualExtraReferences}} where the per-reference lines should appear."
                  value={imageStyles.promptTemplates.extraReferencesTemplate}
                  onChange={(value) =>
                    setPromptTemplateValue(
                      "imageStyles.extraReferencesTemplate",
                      value,
                    )
                  }
                  {...getPromptTemplateFocusHandlers(
                    "imageStyles.extraReferencesTemplate",
                  )}
                  feedback={
                    promptTemplateFeedback[
                      "imageStyles.extraReferencesTemplate"
                    ]
                  }
                  dirty={isPromptTemplateDirty(
                    "imageStyles.extraReferencesTemplate",
                  )}
                  saving={
                    promptTemplateFeedback[
                      "imageStyles.extraReferencesTemplate"
                    ].saving
                  }
                  onSave={() =>
                    void savePromptTemplate(
                      "imageStyles.extraReferencesTemplate",
                    )
                  }
                  onReset={() =>
                    resetPromptTemplate(
                      "imageStyles.extraReferencesTemplate",
                    )
                  }
                  minHeightClassName="min-h-[240px]"
                  previewValues={nanoBananaPromptPreviewValues}
                />

                <PromptTemplateEditorCard
                  title="Individual extra reference template"
                  description="Rendered once for each active style reference, then inserted into the Extra references template with {{individualExtraReferences}}. Character references are active only for characterDriven XML images."
                  value={imageStyles.promptTemplates.individualExtraReferenceTemplate}
                  onChange={(value) =>
                    setPromptTemplateValue(
                      "imageStyles.individualExtraReferenceTemplate",
                      value,
                    )
                  }
                  {...getPromptTemplateFocusHandlers(
                    "imageStyles.individualExtraReferenceTemplate",
                  )}
                  feedback={
                    promptTemplateFeedback[
                      "imageStyles.individualExtraReferenceTemplate"
                    ]
                  }
                  dirty={isPromptTemplateDirty(
                    "imageStyles.individualExtraReferenceTemplate",
                  )}
                  saving={
                    promptTemplateFeedback[
                      "imageStyles.individualExtraReferenceTemplate"
                    ].saving
                  }
                  onSave={() =>
                    void savePromptTemplate(
                      "imageStyles.individualExtraReferenceTemplate",
                    )
                  }
                  onReset={() =>
                    resetPromptTemplate(
                      "imageStyles.individualExtraReferenceTemplate",
                    )
                  }
                  minHeightClassName="min-h-[200px]"
                  previewValues={nanoBananaPromptPreviewValues}
                />

                <PromptPlaceholderCard
                  title="Useful placeholders"
                  rows={NANO_BANANA_PLACEHOLDER_ROWS}
                />
              </div>
            ) : null}
          </section>
        </div>
      ) : null}

      {activeSection === "generate-visuals-image-styles" ? (
        <div className="space-y-6">
          <section id="image-styles" className="scroll-mt-24">
            <div className="space-y-6">
              {imageStyles ? (
                <div className="grid gap-5 xl:grid-cols-[280px_minmax(0,1fr)]">
                  <Card className="xl:col-span-2 p-5">
                    <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-end">
                      <div className="space-y-1">
                        <h2 className="text-sm font-medium text-foreground">
                          Global image generation provider/model
                        </h2>
                        <p className="text-xs text-muted-foreground">
                          This default applies to style tests and Generate
                          Visuals unless a project overrides it.
                        </p>
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                          Provider/model
                        </label>
                        <Select
                          value={imageStyles.defaultVisualGenerationModelId}
                          onChange={(event) => {
                            updateSectionFeedbackState("image-styles", {
                              error: null,
                              message: null,
                            });
                            setImageStyles({
                              ...imageStyles,
                              defaultVisualGenerationModelId:
                                event.target
                                  .value as ShortFormVisualGenerationModelId,
                            });
                          }}
                          className="cursor-pointer"
                        >
                          {VISUAL_GENERATION_MODEL_OPTIONS.map((option) => (
                            <option key={option.id} value={option.id}>
                              {option.label}
                            </option>
                          ))}
                        </Select>
                      </div>
                    </div>
                    <p className="mt-3 text-xs text-muted-foreground">
                      {
                        VISUAL_GENERATION_MODEL_OPTIONS.find(
                          (option) =>
                            option.id ===
                            imageStyles.defaultVisualGenerationModelId,
                        )?.description
                      }
                    </p>
                  </Card>

                  <Card className="space-y-3 p-5">
                    <div className="flex items-center justify-between gap-2">
                      <h2 className="text-sm font-medium text-foreground">
                        Styles
                      </h2>
                      <Button variant="outline" size="sm" onClick={addStyle}>
                        New style
                      </Button>
                    </div>
                    <div className="space-y-2">
                      {imageStyles.styles.map((style) => {
                        const isActive = style.id === selectedStyleId;
                        const isDefault =
                          imageStyles.defaultStyleId === style.id;
                        return (
                          <button
                            key={style.id}
                            type="button"
                            onClick={() => setSelectedStyleId(style.id)}
                            className={`w-full rounded-lg border px-3 py-2 text-left transition ${
                              isActive
                                ? "border-primary bg-primary/10 text-foreground"
                                : "border-border bg-background/50 text-foreground hover:border-primary/50"
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-sm font-medium">
                                {style.name}
                              </span>
                              {isDefault ? (
                                <span className="rounded-full border border-emerald-500/30 px-2 py-0.5 text-[10px] uppercase tracking-wide text-emerald-200">
                                  Default
                                </span>
                              ) : null}
                            </div>
                            <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                              {style.description || "No description yet."}
                            </p>
                          </button>
                        );
                      })}
                    </div>
                  </Card>

                  {selectedStyle ? (
                    <Card className="space-y-5 p-5">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <h2 className="text-sm font-medium text-foreground">
                            Edit style
                          </h2>
                          <p className="mt-1 text-xs text-muted-foreground">
                            Per-style instructions are injected into the real
                            Nano Banana templates through the editable
                            style-instructions block.
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            variant={
                              imageStyles.defaultStyleId === selectedStyle.id
                                ? "secondary"
                                : "outline"
                            }
                            size="sm"
                            onClick={() => {
                              updateSectionFeedbackState("image-styles", {
                                error: null,
                                message: null,
                              });
                              setImageStyles({
                                ...imageStyles,
                                defaultStyleId: selectedStyle.id,
                              });
                            }}
                          >
                            {imageStyles.defaultStyleId === selectedStyle.id
                              ? "Default style"
                              : "Set as default"}
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => deleteStyle(selectedStyle.id)}
                            disabled={imageStyles.styles.length <= 1}
                          >
                            Delete style
                          </Button>
                        </div>
                      </div>

                      <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-2">
                          <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                            Style name
                          </label>
                          <Input
                            value={selectedStyle.name}
                            onChange={(event) =>
                              updateSelectedStyle((style) => ({
                                ...style,
                                name: event.target.value,
                              }))
                            }
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                            Header-safe area %
                          </label>
                          <Input
                            type="number"
                            min={15}
                            max={45}
                            value={selectedStyle.headerPercent}
                            onChange={(event) =>
                              updateSelectedStyle((style) => ({
                                ...style,
                                headerPercent: Math.max(
                                  15,
                                  Math.min(
                                    45,
                                    Number(event.target.value) || 28,
                                  ),
                                ),
                              }))
                            }
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                          Description
                        </label>
                        <Input
                          value={selectedStyle.description || ""}
                          onChange={(event) =>
                            updateSelectedStyle((style) => ({
                              ...style,
                              description: event.target.value,
                            }))
                          }
                          placeholder="What this style is for"
                        />
                      </div>

                      <div className="space-y-2">
                        <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                          Per-style visual instructions
                        </label>
                        <Textarea
                          value={selectedStyle.stylePrompt}
                          onChange={(event) =>
                            updateSelectedStyle((style) => ({
                              ...style,
                              stylePrompt: event.target.value,
                            }))
                          }
                          className="min-h-[160px] font-mono text-xs"
                        />
                      </div>

                      <div className="space-y-4 rounded-lg border border-border bg-background/60 p-4">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div>
                            <h3 className="text-sm font-medium text-foreground">
                              Style reference images
                            </h3>
                            <p className="mt-1 text-xs text-muted-foreground">
                              Add zero, one, or many reusable references for
                              this style. If one reference is marked{" "}
                              <span className="font-medium text-foreground">
                                Primary character
                              </span>
                              , the generator uses it as the main identity
                              anchor for character-driven XML images.
                            </p>
                          </div>
                          <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-border px-3 py-2 text-sm hover:bg-accent">
                            <span>
                              {selectedStyleUpload?.isUploading
                                ? "Uploading…"
                                : "Upload reference image"}
                            </span>
                            <input
                              type="file"
                              accept="image/png,image/jpeg,image/webp,image/gif"
                              className="hidden"
                              disabled={selectedStyleUpload?.isUploading}
                              onChange={(event) => {
                                const file = event.target.files?.[0];
                                if (file) {
                                  void uploadStyleReference(file);
                                }
                                event.currentTarget.value = "";
                              }}
                            />
                          </label>
                        </div>

                        {selectedStyleUpload?.error ? (
                          <ValidationNotice
                            title="Reference upload failed"
                            message={selectedStyleUpload.error}
                          />
                        ) : null}

                        {(selectedStyle.references || []).length > 0 ? (
                          <div className="space-y-4">
                            {(selectedStyle.references || []).map(
                              (reference, index) => {
                                const characterCount = (
                                  selectedStyle.references || []
                                ).filter(
                                  (item) => item.usageType === "character",
                                ).length;
                                const disableCharacterOption =
                                  reference.usageType !== "character" &&
                                  characterCount >= 1;
                                return (
                                  <div
                                    key={reference.id}
                                    className="rounded-lg border border-border bg-background/70 p-3"
                                  >
                                    <div className="grid gap-4 lg:grid-cols-[160px_minmax(0,1fr)]">
                                      <div className="space-y-2">
                                        {reference.imageUrl ? (
                                          <img
                                            src={reference.imageUrl}
                                            alt={
                                              reference.label ||
                                              `Style reference ${index + 1}`
                                            }
                                            loading="lazy"
                                            decoding="async"
                                            className="aspect-[3/4] w-full rounded-md border border-border bg-muted object-cover"
                                          />
                                        ) : (
                                          <div className="flex aspect-[3/4] items-center justify-center rounded-md border border-dashed border-border bg-muted text-xs text-muted-foreground">
                                            Preview unavailable
                                          </div>
                                        )}
                                        <Button
                                          variant="outline"
                                          size="sm"
                                          onClick={() =>
                                            removeStyleReference(reference.id)
                                          }
                                        >
                                          Remove
                                        </Button>
                                      </div>
                                      <div className="space-y-3">
                                        <div className="grid gap-3 md:grid-cols-2">
                                          <div className="space-y-2">
                                            <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                                              Label
                                            </label>
                                            <Input
                                              value={reference.label || ""}
                                              onChange={(event) =>
                                                updateStyleReference(
                                                  reference.id,
                                                  (current) => ({
                                                    ...current,
                                                    label: event.target.value,
                                                  }),
                                                )
                                              }
                                              placeholder="Optional name"
                                            />
                                          </div>
                                          <div className="space-y-2">
                                            <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                                              Reference role
                                            </label>
                                            <select
                                              value={reference.usageType}
                                              onChange={(event) => {
                                                const nextUsageType = event
                                                  .target
                                                  .value as StyleReferenceUsageType;
                                                if (
                                                  nextUsageType === "character"
                                                ) {
                                                  updateSelectedStyle(
                                                    (style) => ({
                                                      ...style,
                                                      references: (
                                                        style.references || []
                                                      ).map((item) =>
                                                        item.id === reference.id
                                                          ? {
                                                              ...item,
                                                              usageType:
                                                                "character",
                                                            }
                                                          : item.usageType ===
                                                              "character"
                                                            ? {
                                                                ...item,
                                                                usageType:
                                                                  "general",
                                                              }
                                                            : item,
                                                      ),
                                                    }),
                                                  );
                                                  return;
                                                }
                                                updateStyleReference(
                                                  reference.id,
                                                  (current) => ({
                                                    ...current,
                                                    usageType: nextUsageType,
                                                  }),
                                                );
                                              }}
                                              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                                            >
                                              {STYLE_REFERENCE_USAGE_OPTIONS.map(
                                                (option) => (
                                                  <option
                                                    key={option.value}
                                                    value={option.value}
                                                    disabled={
                                                      option.value ===
                                                        "character" &&
                                                      disableCharacterOption
                                                    }
                                                  >
                                                    {option.label}
                                                  </option>
                                                ),
                                              )}
                                            </select>
                                          </div>
                                        </div>

                                        <div className="space-y-2">
                                          <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                                            Usage instructions
                                          </label>
                                          <Textarea
                                            value={reference.usageInstructions}
                                            onChange={(event) =>
                                              updateStyleReference(
                                                reference.id,
                                                (current) => ({
                                                  ...current,
                                                  usageInstructions:
                                                    event.target.value,
                                                }),
                                              )
                                            }
                                            className="min-h-[110px] font-mono text-xs"
                                            placeholder="Explain exactly how the generator should use this reference."
                                          />
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                );
                              },
                            )}
                          </div>
                        ) : (
                          <div className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
                            No style-level references yet. This style will keep
                            using the existing prompt-only flow unless you
                            upload references here.
                          </div>
                        )}
                      </div>

                      <div className="space-y-3 rounded-lg border border-border bg-background/60 p-4">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div>
                            <h3 className="text-sm font-medium text-foreground">
                              Style test
                            </h3>
                            <p className="mt-1 text-xs text-muted-foreground">
                              Lightweight one-scene generation loop using the
                              current editor values, including the real scene-image
                              templates and any uploaded style reference images
                              with their usage instructions.
                            </p>
                          </div>
                          <Button
                            onClick={() => void generateStyleTest()}
                            disabled={
                              selectedStyleTest?.isLoading ||
                              anySectionSaving ||
                              selectedStyleUpload?.isUploading
                            }
                          >
                            {selectedStyleTest?.isLoading
                              ? "Generating…"
                              : "Generate test image"}
                          </Button>
                        </div>

                        <div className="grid gap-4 md:grid-cols-2">
                          <div className="space-y-2">
                            <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                              Test topic
                            </label>
                            <Input
                              value={selectedStyle.testTopic}
                              onChange={(event) =>
                                updateSelectedStyle((style) => ({
                                  ...style,
                                  testTopic: event.target.value,
                                }))
                              }
                            />
                          </div>
                          <div className="space-y-2">
                            <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                              Test caption
                            </label>
                            <Input
                              value={selectedStyle.testCaption}
                              onChange={(event) =>
                                updateSelectedStyle((style) => ({
                                  ...style,
                                  testCaption: event.target.value,
                                }))
                              }
                            />
                          </div>
                        </div>

                        <div className="space-y-2">
                          <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                            Test scene image prompt
                          </label>
                          <Textarea
                            value={selectedStyle.testImagePrompt}
                            onChange={(event) =>
                              updateSelectedStyle((style) => ({
                                ...style,
                                testImagePrompt: event.target.value,
                              }))
                            }
                            className="min-h-[100px] font-mono text-xs"
                          />
                        </div>

                        {selectedStyleTest?.error ? (
                          <ValidationNotice
                            title="Style test failed"
                            message={selectedStyleTest.error}
                          />
                        ) : null}

                        {selectedStyleTest?.isLoading ? (
                          <div className="rounded-lg border border-border p-4">
                            <OrbitLoader label="Generating style test image" />
                          </div>
                        ) : null}

                        {selectedStyleTest?.cleanImageUrl ||
                        selectedStyleTest?.previewImageUrl ? (
                          <div className="grid gap-4 lg:grid-cols-2">
                            {selectedStyleTest.cleanImageUrl ? (
                              <div className="space-y-2">
                                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                                  Clean image
                                </p>
                                <img
                                  src={selectedStyleTest.cleanImageUrl}
                                  alt={`${selectedStyle.name} clean style test`}
                                  loading="lazy"
                                  decoding="async"
                                  className="aspect-[9/16] w-full rounded-lg border border-border bg-muted object-cover"
                                />
                              </div>
                            ) : null}
                            {selectedStyleTest.previewImageUrl ? (
                              <div className="space-y-2">
                                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                                  Captioned preview
                                </p>
                                <img
                                  src={selectedStyleTest.previewImageUrl}
                                  alt={`${selectedStyle.name} preview style test`}
                                  loading="lazy"
                                  decoding="async"
                                  className="aspect-[9/16] w-full rounded-lg border border-border bg-muted object-cover"
                                />
                              </div>
                            ) : null}
                          </div>
                        ) : null}
                      </div>
                    </Card>
                  ) : null}
                </div>
              ) : null}

              <SectionFeedbackNotice
                feedback={sectionFeedback["image-styles"]}
              />
            </div>
          </section>
        </div>
      ) : null}

      {activeSection === "plan-captions" ? (
        <div className="space-y-6">
          <section id="caption-styles" className="scroll-mt-24">
            <div className="space-y-6">
              {videoRender ? (
                <div className="space-y-5">
                  <Card className="p-5">
                    <div className="space-y-2">
                      <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        Caption max words
                      </label>
                      <Input
                        type="number"
                        min={2}
                        max={12}
                        value={videoRender.captionMaxWords}
                        onChange={(event) => {
                          updateSectionFeedbackState("caption-styles", {
                            error: null,
                            message: null,
                          });
                          setVideoRender({
                            ...videoRender,
                            captionMaxWords: Math.max(
                              2,
                              Math.min(12, Number(event.target.value || 6)),
                            ),
                          });
                        }}
                        className="max-w-[140px]"
                      />
                      <p className="text-xs text-muted-foreground">
                        Global default for deterministic caption chunking during
                        the XML Script pipeline. Projects can still override
                        this per video.
                      </p>
                    </div>
                  </Card>

                  <Card className="space-y-4 p-5">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <h3 className="text-sm font-medium text-foreground">
                          Saved caption styles
                        </h3>
                        <p className="mt-1 max-w-3xl text-xs text-muted-foreground">
                          Final-video renders keep the current deterministic
                          caption segmentation and forced-alignment timing
                          pipeline, then burn animated subtitles with word-level
                          highlighting. The active word stays white,
                          already-spoken words shift lighter, and upcoming words
                          stay darker unless a style overrides those colors.
                        </p>
                      </div>
                      <Button
                        variant="outline"
                        onClick={
                          captionLibraryTab === "styles"
                            ? addCaptionStyle
                            : addAnimationPreset
                        }
                        disabled={sectionFeedback["caption-styles"].saving}
                      >
                        {captionLibraryTab === "styles"
                          ? "Add caption style"
                          : "Add animation preset"}
                      </Button>
                    </div>

                    <div className="mt-4 space-y-4">
                      <div className="rounded-lg border border-border bg-background/50 p-3">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                              Library mode
                            </label>
                            <p className="mt-1 text-xs text-muted-foreground">
                              Switch between caption-style editing and
                              animation-preset editing so only one library is
                              expanded at a time.
                            </p>
                          </div>
                          <TabsList className="w-full justify-start sm:w-auto">
                            <TabsTrigger
                              active={captionLibraryTab === "styles"}
                              onClick={() => setCaptionLibraryTab("styles")}
                              type="button"
                            >
                              Caption styles
                            </TabsTrigger>
                            <TabsTrigger
                              active={captionLibraryTab === "presets"}
                              onClick={() => setCaptionLibraryTab("presets")}
                              type="button"
                            >
                              Animation presets
                            </TabsTrigger>
                          </TabsList>
                        </div>

                        {captionLibraryTab === "styles" ? (
                          <div className="mt-4 space-y-2">
                            <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                              Caption style library
                            </label>
                            <Select
                              value={selectedCaptionStyleId || ""}
                              onChange={(event) =>
                                handleCaptionStyleSelection(event.target.value)
                              }
                              disabled={videoRender.captionStyles.length === 0}
                            >
                              {videoRender.captionStyles.map((style) => (
                                <option key={style.id} value={style.id}>
                                  {style.name}
                                  {style.id ===
                                  videoRender.defaultCaptionStyleId
                                    ? " (default)"
                                    : ""}
                                </option>
                              ))}
                            </Select>
                            <div className="text-xs text-muted-foreground">
                              Default caption style:{" "}
                              <span className="font-medium text-foreground">
                                {videoRender.captionStyles.find(
                                  (style) =>
                                    style.id ===
                                    videoRender.defaultCaptionStyleId,
                                )?.name || "Not set"}
                              </span>
                            </div>
                          </div>
                        ) : (
                          <div className="mt-4 space-y-2">
                            <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                              Animation preset library
                            </label>
                            <Select
                              value={selectedAnimationPresetId || ""}
                              onChange={(event) =>
                                handleAnimationPresetSelection(
                                  event.target.value,
                                )
                              }
                              disabled={
                                videoRender.animationPresets.length === 0
                              }
                            >
                              {videoRender.animationPresets.map((preset) => {
                                const usageCount =
                                  videoRender.captionStyles.filter(
                                    (style) =>
                                      style.animationPresetId === preset.id,
                                  ).length;
                                return (
                                  <option key={preset.id} value={preset.id}>
                                    {preset.name}
                                    {preset.builtIn ? " (built-in)" : ""}
                                    {usageCount > 0
                                      ? ` · ${usageCount} style${usageCount === 1 ? "" : "s"}`
                                      : ""}
                                  </option>
                                );
                              })}
                            </Select>
                            {selectedAnimationPreset ? (
                              <div className="rounded-lg border border-border bg-background/40 p-3 text-xs text-muted-foreground">
                                <p className="font-medium text-foreground">
                                  {selectedAnimationPreset.name}
                                </p>
                                <p className="mt-1">
                                  {selectedAnimationPreset.description ||
                                    "No description yet."}
                                </p>
                                <p className="mt-2">
                                  Used by{" "}
                                  {
                                    videoRender.captionStyles.filter(
                                      (style) =>
                                        style.animationPresetId ===
                                        selectedAnimationPreset.id,
                                    ).length
                                  }{" "}
                                  caption style(s).
                                </p>
                              </div>
                            ) : null}
                          </div>
                        )}
                      </div>

                      {captionLibraryTab === "styles" ? (
                        selectedCaptionStyle &&
                        selectedCaptionStyleAnimationPreset ? (
                          <div className="space-y-4 rounded-lg border border-border bg-background/50 p-4">
                            <div className="rounded-lg border border-border bg-background/40 p-4">
                              <div className="grid gap-4 md:grid-cols-2">
                                <div className="space-y-2">
                                  <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                                    Style name
                                  </label>
                                  <Input
                                    value={selectedCaptionStyle.name}
                                    onChange={(event) =>
                                      updateSelectedCaptionStyle((style) => ({
                                        ...style,
                                        name: event.target.value,
                                      }))
                                    }
                                  />
                                </div>
                                <div className="space-y-2">
                                  <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                                    Animation preset reference
                                  </label>
                                  <Select
                                    value={
                                      selectedCaptionStyle.animationPresetId
                                    }
                                    onChange={(event) => {
                                      const preset =
                                        getCaptionAnimationPresetById(
                                          videoRender.animationPresets,
                                          event.target.value,
                                        );
                                      updateSelectedCaptionStyle((style) => ({
                                        ...style,
                                        animationPresetId: preset.id,
                                        animationPreset: preset.slug,
                                      }));
                                      setSelectedAnimationPresetId(preset.id);
                                    }}
                                  >
                                    {videoRender.animationPresets.map(
                                      (preset) => (
                                        <option
                                          key={preset.id}
                                          value={preset.id}
                                        >
                                          {preset.name}
                                        </option>
                                      ),
                                    )}
                                  </Select>
                                  <p className="text-xs text-muted-foreground">
                                    Caption styles now reference a first-class
                                    preset entity by id. Use the Animation
                                    presets tab to edit the linked motion
                                    globally.
                                  </p>
                                </div>
                              </div>

                              <div className="mt-4 grid gap-4 md:grid-cols-2">
                                <div className="space-y-2">
                                  <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                                    Font family
                                  </label>
                                  <Input
                                    value={selectedCaptionStyle.fontFamily}
                                    onChange={(event) =>
                                      updateSelectedCaptionStyle((style) => ({
                                        ...style,
                                        fontFamily: event.target.value,
                                      }))
                                    }
                                  />
                                </div>
                                <div className="space-y-2">
                                  <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                                    Font weight
                                  </label>
                                  <Select
                                    value={String(
                                      selectedCaptionStyle.fontWeight,
                                    )}
                                    onChange={(event) =>
                                      updateSelectedCaptionStyle((style) => ({
                                        ...style,
                                        fontWeight:
                                          Number(event.target.value) || 700,
                                      }))
                                    }
                                  >
                                    {CAPTION_FONT_WEIGHT_OPTIONS.map(
                                      (option) => (
                                        <option
                                          key={option.value}
                                          value={option.value}
                                        >
                                          {option.label}
                                        </option>
                                      ),
                                    )}
                                  </Select>
                                </div>
                              </div>

                              <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                                <CaptionStyleNumberField
                                  label="Font size"
                                  value={selectedCaptionStyle.fontSize}
                                  min={32}
                                  max={120}
                                  onChange={(value) =>
                                    updateSelectedCaptionStyle((style) => ({
                                      ...style,
                                      fontSize: value,
                                    }))
                                  }
                                />
                                <CaptionStyleNumberField
                                  label="Word spacing"
                                  value={selectedCaptionStyle.wordSpacing}
                                  min={-20}
                                  max={32}
                                  step={0.1}
                                  onChange={(value) =>
                                    updateSelectedCaptionStyle((style) => ({
                                      ...style,
                                      wordSpacing: value,
                                    }))
                                  }
                                />
                                <CaptionStyleNumberField
                                  label="Side padding"
                                  value={selectedCaptionStyle.horizontalPadding}
                                  min={0}
                                  max={320}
                                  onChange={(value) =>
                                    updateSelectedCaptionStyle((style) => ({
                                      ...style,
                                      horizontalPadding: value,
                                    }))
                                  }
                                />
                                <CaptionStyleNumberField
                                  label="Bottom margin"
                                  value={selectedCaptionStyle.bottomMargin}
                                  min={0}
                                  max={900}
                                  onChange={(value) =>
                                    updateSelectedCaptionStyle((style) => ({
                                      ...style,
                                      bottomMargin: value,
                                    }))
                                  }
                                />
                                <CaptionStyleNumberField
                                  label="Outline width"
                                  value={selectedCaptionStyle.outlineWidth}
                                  min={0}
                                  max={12}
                                  step={0.1}
                                  onChange={(value) =>
                                    updateSelectedCaptionStyle((style) => ({
                                      ...style,
                                      outlineWidth: value,
                                    }))
                                  }
                                />
                                <CaptionStyleNumberField
                                  label="Shadow strength"
                                  value={selectedCaptionStyle.shadowStrength}
                                  min={0}
                                  max={12}
                                  step={0.1}
                                  onChange={(value) =>
                                    updateSelectedCaptionStyle((style) => ({
                                      ...style,
                                      shadowStrength: value,
                                    }))
                                  }
                                />
                                <CaptionStyleNumberField
                                  label="Shadow blur"
                                  value={selectedCaptionStyle.shadowBlur}
                                  min={0}
                                  max={16}
                                  step={0.1}
                                  onChange={(value) =>
                                    updateSelectedCaptionStyle((style) => ({
                                      ...style,
                                      shadowBlur: value,
                                    }))
                                  }
                                />
                                <CaptionStyleNumberField
                                  label="Shadow X"
                                  value={selectedCaptionStyle.shadowOffsetX}
                                  min={-32}
                                  max={32}
                                  step={0.1}
                                  onChange={(value) =>
                                    updateSelectedCaptionStyle((style) => ({
                                      ...style,
                                      shadowOffsetX: value,
                                    }))
                                  }
                                />
                                <CaptionStyleNumberField
                                  label="Shadow Y"
                                  value={selectedCaptionStyle.shadowOffsetY}
                                  min={-32}
                                  max={32}
                                  step={0.1}
                                  onChange={(value) =>
                                    updateSelectedCaptionStyle((style) => ({
                                      ...style,
                                      shadowOffsetY: value,
                                    }))
                                  }
                                />
                                <CaptionStyleNumberField
                                  label="Background padding"
                                  value={selectedCaptionStyle.backgroundPadding}
                                  min={0}
                                  max={96}
                                  onChange={(value) =>
                                    updateSelectedCaptionStyle((style) => ({
                                      ...style,
                                      backgroundPadding: value,
                                    }))
                                  }
                                />
                                <CaptionStyleNumberField
                                  label="Background radius"
                                  value={selectedCaptionStyle.backgroundRadius}
                                  min={0}
                                  max={96}
                                  onChange={(value) =>
                                    updateSelectedCaptionStyle((style) => ({
                                      ...style,
                                      backgroundRadius: value,
                                    }))
                                  }
                                />
                              </div>

                              <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                                {[
                                  ["Active word", "activeWordColor"],
                                  ["Spoken words", "spokenWordColor"],
                                  ["Upcoming words", "upcomingWordColor"],
                                  ["Outline", "outlineColor"],
                                  ["Shadow", "shadowColor"],
                                  ["Background", "backgroundColor"],
                                ].map(([label, key]) => (
                                  <div
                                    key={key}
                                    className="space-y-2 rounded-lg border border-border bg-background/30 p-3"
                                  >
                                    <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                                      {label} color
                                    </label>
                                    <div className="flex items-center gap-3">
                                      <input
                                        type="color"
                                        value={
                                          selectedCaptionStyle[
                                            key as keyof CaptionStyleEntry
                                          ] as string
                                        }
                                        onChange={(event) =>
                                          updateSelectedCaptionStyle(
                                            (style) => ({
                                              ...style,
                                              [key]:
                                                event.target.value.toUpperCase(),
                                            }),
                                          )
                                        }
                                        className="h-10 w-12 cursor-pointer rounded border border-border bg-transparent p-1"
                                      />
                                      <Input
                                        value={
                                          selectedCaptionStyle[
                                            key as keyof CaptionStyleEntry
                                          ] as string
                                        }
                                        onChange={(event) =>
                                          updateSelectedCaptionStyle(
                                            (style) => ({
                                              ...style,
                                              [key]:
                                                event.target.value.toUpperCase(),
                                            }),
                                          )
                                        }
                                        className="font-mono text-xs"
                                      />
                                    </div>
                                  </div>
                                ))}
                              </div>

                              <div className="mt-4 rounded-lg border border-border bg-background/30 p-4">
                                <div className="flex flex-wrap items-center justify-between gap-3">
                                  <div>
                                    <h4 className="text-sm font-medium text-foreground">
                                      Background box
                                    </h4>
                                    <p className="mt-1 text-xs text-muted-foreground">
                                      Preview and final render both use the
                                      saved background box intent.
                                    </p>
                                  </div>
                                  <label className="inline-flex items-center gap-2 text-sm text-foreground">
                                    <input
                                      type="checkbox"
                                      checked={
                                        selectedCaptionStyle.backgroundEnabled
                                      }
                                      onChange={(event) =>
                                        updateSelectedCaptionStyle((style) => ({
                                          ...style,
                                          backgroundEnabled:
                                            event.target.checked,
                                        }))
                                      }
                                    />
                                    Enable box
                                  </label>
                                </div>
                                <div className="mt-4 grid gap-4 md:grid-cols-2">
                                  <div className="space-y-2">
                                    <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                                      Box opacity
                                    </label>
                                    <div className="flex items-center gap-3">
                                      <input
                                        type="range"
                                        min={0}
                                        max={1}
                                        step={0.01}
                                        value={
                                          selectedCaptionStyle.backgroundOpacity
                                        }
                                        onChange={(event) =>
                                          updateSelectedCaptionStyle(
                                            (style) => ({
                                              ...style,
                                              backgroundOpacity: Number(
                                                event.target.value,
                                              ),
                                            }),
                                          )
                                        }
                                        className="w-full"
                                      />
                                      <div className="w-14 text-right text-sm text-foreground">
                                        {Math.round(
                                          selectedCaptionStyle.backgroundOpacity *
                                            100,
                                        )}
                                        %
                                      </div>
                                    </div>
                                  </div>
                                  <div className="text-xs text-muted-foreground">
                                    Current linked animation preset:{" "}
                                    <span className="font-medium text-foreground">
                                      {selectedCaptionStyleAnimationPreset.name}
                                    </span>
                                    <br />
                                    Layout mode:{" "}
                                    <span className="font-medium text-foreground">
                                      {
                                        selectedCaptionStyleAnimationPreset
                                          .config.layoutMode
                                      }
                                    </span>
                                    <br />
                                    Timing mode:{" "}
                                    <span className="font-medium text-foreground">
                                      {
                                        selectedCaptionStyleAnimationPreset
                                          .config.timing.mode
                                      }
                                    </span>
                                  </div>
                                </div>
                              </div>

                              <div className="mt-4 flex flex-wrap items-center gap-2 text-xs">
                                <Button
                                  type="button"
                                  variant={
                                    selectedCaptionStyle.id ===
                                    videoRender.defaultCaptionStyleId
                                      ? "default"
                                      : "outline"
                                  }
                                  onClick={() => {
                                    updateSectionFeedbackState(
                                      "caption-styles",
                                      { error: null, message: null },
                                    );
                                    setVideoRender({
                                      ...videoRender,
                                      defaultCaptionStyleId:
                                        selectedCaptionStyle.id,
                                    });
                                  }}
                                >
                                  {selectedCaptionStyle.id ===
                                  videoRender.defaultCaptionStyleId
                                    ? "Default caption style"
                                    : "Set as default"}
                                </Button>
                                <Button
                                  type="button"
                                  variant="outline"
                                  onClick={() =>
                                    duplicateCaptionStyle(
                                      selectedCaptionStyle.id,
                                    )
                                  }
                                >
                                  Duplicate caption style
                                </Button>
                                <Button
                                  type="button"
                                  variant="outline"
                                  onClick={() =>
                                    deleteCaptionStyle(selectedCaptionStyle.id)
                                  }
                                  disabled={
                                    videoRender.captionStyles.length <= 1
                                  }
                                >
                                  Delete caption style
                                </Button>
                              </div>
                            </div>

                            <div className="rounded-lg border border-border bg-background/40 p-4">
                              <div>
                                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                                  Animated preview
                                </p>
                                <p className="mt-1 text-xs text-muted-foreground">
                                  Preview now sits below the style controls so
                                  the editor keeps more horizontal room while
                                  still showing the linked preset behavior.
                                </p>
                              </div>
                              <div className="mt-4 mx-auto max-w-sm">
                                <CaptionStylePreview
                                  style={{
                                    ...selectedCaptionStyle,
                                    animationPreset:
                                      selectedCaptionStyleAnimationPreset,
                                  }}
                                />
                              </div>
                              <div className="mt-4 rounded-lg border border-border bg-background/30 p-3 text-xs text-muted-foreground">
                                Editing{" "}
                                <span className="font-medium text-foreground">
                                  {selectedCaptionStyle.name}
                                </span>{" "}
                                currently previews with preset{" "}
                                <span className="font-medium text-foreground">
                                  {selectedCaptionStyleAnimationPreset.name}
                                </span>
                                .
                              </div>
                            </div>
                          </div>
                        ) : null
                      ) : selectedAnimationPreset ? (
                        <div className="rounded-lg border border-border bg-background/50 p-4">
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <div>
                              <h4 className="text-sm font-medium text-foreground">
                                Animation preset editor
                              </h4>
                              <p className="mt-1 text-xs text-muted-foreground">
                                Built-ins are now first-class presets. Edit them
                                directly, or duplicate them into custom
                                variants.
                              </p>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() =>
                                  duplicateAnimationPreset(
                                    selectedAnimationPreset.id,
                                  )
                                }
                              >
                                Duplicate preset
                              </Button>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() =>
                                  deleteAnimationPreset(
                                    selectedAnimationPreset.id,
                                  )
                                }
                                disabled={
                                  videoRender.animationPresets.length <= 1
                                }
                              >
                                Delete preset
                              </Button>
                            </div>
                          </div>

                          <div className="mt-4 grid gap-4 md:grid-cols-2">
                            <div className="space-y-2">
                              <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                                Preset name
                              </label>
                              <Input
                                value={selectedAnimationPreset.name}
                                onChange={(event) =>
                                  updateSelectedAnimationPreset((preset) => ({
                                    ...preset,
                                    name: event.target.value,
                                  }))
                                }
                              />
                            </div>
                            <div className="space-y-2">
                              <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                                Slug
                              </label>
                              <Input
                                value={selectedAnimationPreset.slug}
                                onChange={(event) =>
                                  updateSelectedAnimationPreset((preset) => ({
                                    ...preset,
                                    slug: event.target.value,
                                  }))
                                }
                                className="font-mono text-xs"
                              />
                            </div>
                          </div>

                          <div className="mt-4 space-y-2">
                            <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                              Description
                            </label>
                            <Textarea
                              value={selectedAnimationPreset.description}
                              onChange={(event) =>
                                updateSelectedAnimationPreset((preset) => ({
                                  ...preset,
                                  description: event.target.value,
                                }))
                              }
                              className="min-h-[76px] text-xs"
                            />
                          </div>

                          <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                            <div className="space-y-2">
                              <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                                Layout mode
                              </label>
                              <Select
                                value={
                                  selectedAnimationPreset.config.layoutMode
                                }
                                onChange={(event) =>
                                  updateSelectedAnimationPreset((preset) => ({
                                    ...preset,
                                    config: {
                                      ...preset.config,
                                      layoutMode:
                                        event.target.value === "fluid"
                                          ? "fluid"
                                          : "stable",
                                    },
                                  }))
                                }
                              >
                                <option value="stable">Stable slots</option>
                                <option value="fluid">Fluid reflow</option>
                              </Select>
                            </div>
                            <div className="space-y-2">
                              <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                                Timing mode
                              </label>
                              <Select
                                value={
                                  selectedAnimationPreset.config.timing.mode
                                }
                                onChange={(event) =>
                                  updateSelectedAnimationPreset((preset) => ({
                                    ...preset,
                                    config: {
                                      ...preset.config,
                                      timing: {
                                        ...preset.config.timing,
                                        mode:
                                          event.target.value === "fixed"
                                            ? "fixed"
                                            : "word-relative",
                                      },
                                    },
                                  }))
                                }
                              >
                                <option value="word-relative">
                                  Word-relative
                                </option>
                                <option value="fixed">Fixed duration</option>
                              </Select>
                            </div>
                            <CaptionStyleNumberField
                              label="Timing offset ms"
                              helper="Negative values show captions and active-word animation earlier. Positive values show them later."
                              value={
                                selectedAnimationPreset.config.timing
                                  .timingOffsetMs
                              }
                              min={-2000}
                              max={2000}
                              step={10}
                              onChange={(value) =>
                                updateSelectedAnimationPreset((preset) => ({
                                  ...preset,
                                  config: {
                                    ...preset.config,
                                    timing: {
                                      ...preset.config.timing,
                                      timingOffsetMs: value,
                                    },
                                  },
                                }))
                              }
                            />
                            {selectedAnimationPreset.config.timing.mode ===
                            "word-relative" ? (
                              <>
                                <CaptionStyleNumberField
                                  label="Timing multiplier"
                                  value={
                                    selectedAnimationPreset.config.timing
                                      .multiplier
                                  }
                                  min={0.1}
                                  max={4}
                                  step={0.05}
                                  onChange={(value) =>
                                    updateSelectedAnimationPreset((preset) => ({
                                      ...preset,
                                      config: {
                                        ...preset.config,
                                        timing: {
                                          ...preset.config.timing,
                                          multiplier: value,
                                        },
                                      },
                                    }))
                                  }
                                />
                                <CaptionStyleNumberField
                                  label="Min duration ms"
                                  value={
                                    selectedAnimationPreset.config.timing.minMs
                                  }
                                  min={40}
                                  max={2000}
                                  step={10}
                                  onChange={(value) =>
                                    updateSelectedAnimationPreset((preset) => ({
                                      ...preset,
                                      config: {
                                        ...preset.config,
                                        timing: {
                                          ...preset.config.timing,
                                          minMs: value,
                                        },
                                      },
                                    }))
                                  }
                                />
                                <CaptionStyleNumberField
                                  label="Max duration ms"
                                  value={
                                    selectedAnimationPreset.config.timing.maxMs
                                  }
                                  min={40}
                                  max={2000}
                                  step={10}
                                  onChange={(value) =>
                                    updateSelectedAnimationPreset((preset) => ({
                                      ...preset,
                                      config: {
                                        ...preset.config,
                                        timing: {
                                          ...preset.config.timing,
                                          maxMs: value,
                                        },
                                      },
                                    }))
                                  }
                                />
                              </>
                            ) : (
                              <CaptionStyleNumberField
                                label="Fixed duration ms"
                                value={
                                  selectedAnimationPreset.config.timing.fixedMs
                                }
                                min={40}
                                max={2000}
                                step={10}
                                onChange={(value) =>
                                  updateSelectedAnimationPreset((preset) => ({
                                    ...preset,
                                    config: {
                                      ...preset.config,
                                      timing: {
                                        ...preset.config.timing,
                                        fixedMs: value,
                                      },
                                    },
                                  }))
                                }
                              />
                            )}
                          </div>

                          <div className="mt-4 grid gap-4 md:grid-cols-3">
                            {(
                              [
                                [
                                  "outlineColorMode",
                                  "outlineColor",
                                  "Outline source",
                                ],
                                [
                                  "shadowColorMode",
                                  "shadowColor",
                                  "Shadow source",
                                ],
                                ["glowColorMode", "glowColor", "Glow source"],
                              ] as const
                            ).map(([modeKey, colorKey, label]) => {
                              const modeValue =
                                selectedAnimationPreset.config.colors[modeKey];
                              const customValue =
                                selectedAnimationPreset.config.colors[
                                  colorKey
                                ] || "#FFFFFF";
                              return (
                                <div
                                  key={modeKey}
                                  className="space-y-2 rounded-lg border border-border bg-background/30 p-3"
                                >
                                  <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                                    {label}
                                  </label>
                                  <Select
                                    value={modeValue}
                                    onChange={(event) =>
                                      updateSelectedAnimationPreset(
                                        (preset) => ({
                                          ...preset,
                                          config: {
                                            ...preset.config,
                                            colors: {
                                              ...preset.config.colors,
                                              [modeKey]: event.target
                                                .value as ShortFormCaptionAnimationColorMode,
                                            },
                                          },
                                        }),
                                      )
                                    }
                                  >
                                    {CAPTION_ANIMATION_COLOR_MODE_OPTIONS.map(
                                      (option) => (
                                        <option
                                          key={option.value}
                                          value={option.value}
                                        >
                                          {option.label}
                                        </option>
                                      ),
                                    )}
                                  </Select>
                                  {modeValue === "custom" ? (
                                    <Input
                                      value={customValue}
                                      onChange={(event) =>
                                        updateSelectedAnimationPreset(
                                          (preset) => ({
                                            ...preset,
                                            config: {
                                              ...preset.config,
                                              colors: {
                                                ...preset.config.colors,
                                                [colorKey]:
                                                  event.target.value.toUpperCase(),
                                              },
                                            },
                                          }),
                                        )
                                      }
                                      className="font-mono text-xs"
                                    />
                                  ) : null}
                                </div>
                              );
                            })}
                          </div>

                          <div className="mt-4 space-y-4">
                            <div>
                              <h5 className="text-sm font-medium text-foreground">
                                Motion tracks
                              </h5>
                              <p className="mt-1 text-xs text-muted-foreground">
                                Edit the keyframes that drive scale, lift, blur,
                                glow, outline, and shadow response during the
                                active-word window.
                              </p>
                            </div>
                            <div className="grid gap-4 xl:grid-cols-2">
                              {CAPTION_ANIMATION_TRACK_LABELS.map(
                                (trackDefinition) => {
                                  const track =
                                    selectedAnimationPreset.config.motion[
                                      trackDefinition.key
                                    ];
                                  const trackRange =
                                    trackDefinition.key === "scale"
                                      ? { min: 0.2, max: 4, step: 0.01 }
                                      : trackDefinition.key ===
                                            "translateXEm" ||
                                          trackDefinition.key === "translateYEm"
                                        ? { min: -4, max: 4, step: 0.01 }
                                        : trackDefinition.key ===
                                            "shadowOpacityMultiplier"
                                          ? { min: 0, max: 4, step: 0.01 }
                                          : trackDefinition.key ===
                                              "glowStrength"
                                            ? { min: 0, max: 2.5, step: 0.01 }
                                            : trackDefinition.key ===
                                                "extraBlur"
                                              ? { min: 0, max: 20, step: 0.05 }
                                              : { min: 0, max: 16, step: 0.05 };
                                  return (
                                    <AnimationPresetTrackEditor
                                      key={trackDefinition.key}
                                      label={trackDefinition.label}
                                      helper={trackDefinition.helper}
                                      track={track}
                                      min={trackRange.min}
                                      max={trackRange.max}
                                      step={trackRange.step}
                                      onChange={(nextTrack) =>
                                        updateSelectedAnimationPreset(
                                          (preset) => ({
                                            ...preset,
                                            config: {
                                              ...preset.config,
                                              motion: {
                                                ...preset.config.motion,
                                                [trackDefinition.key]:
                                                  nextTrack,
                                              },
                                            },
                                          }),
                                        )
                                      }
                                    />
                                  );
                                },
                              )}
                            </div>
                          </div>

                          <div className="mt-4 rounded-lg border border-border bg-background/30 p-4">
                            <div className="flex items-center justify-between gap-3">
                              <div>
                                <h5 className="text-sm font-medium text-foreground">
                                  Advanced preset JSON
                                </h5>
                                <p className="mt-1 text-xs text-muted-foreground">
                                  Full control over timing, easing, start/end
                                  values, motion tracks, and future-compatible
                                  fields.
                                </p>
                              </div>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() =>
                                  setAnimationPresetJsonDraft(
                                    formatAnimationPresetConfigJson(
                                      selectedAnimationPreset.config,
                                    ),
                                  )
                                }
                              >
                                Reset editor
                              </Button>
                            </div>
                            <Textarea
                              value={animationPresetJsonDraft}
                              onChange={(event) =>
                                setAnimationPresetJsonDraft(event.target.value)
                              }
                              className="mt-3 min-h-[320px] font-mono text-xs"
                            />
                            <div className="mt-3 flex flex-wrap gap-2">
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  const parsed = parseAnimationPresetConfigJson(
                                    animationPresetJsonDraft,
                                    selectedAnimationPreset.config,
                                  );
                                  if (!parsed) {
                                    updateSectionFeedbackState(
                                      "caption-styles",
                                      {
                                        error:
                                          "Animation preset JSON is invalid.",
                                        message: null,
                                      },
                                    );
                                    return;
                                  }
                                  updateSelectedAnimationPreset((preset) => ({
                                    ...preset,
                                    config: parsed,
                                  }));
                                }}
                              >
                                Apply JSON to preset
                              </Button>
                              <div className="text-xs text-muted-foreground">
                                Structured controls now cover timing, color
                                routing, and per-track keyframes. The JSON
                                editor remains the escape hatch for full config
                                control.
                              </div>
                            </div>
                          </div>
                        </div>
                      ) : null}
                    </div>
                  </Card>
                </div>
              ) : null}

              <SectionFeedbackNotice
                feedback={sectionFeedback["caption-styles"]}
              />
            </div>
          </section>
        </div>
      ) : null}

    </ShortFormSubpageShell>
  );
}
