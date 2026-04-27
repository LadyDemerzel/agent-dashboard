"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
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
import { usePageScrollRestoration } from "@/components/usePageScrollRestoration";
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

type PromptKey =
  | "hooksGenerate"
  | "hooksMore"
  | "researchGenerate"
  | "researchRevise"
  | "sceneImagesGenerate"
  | "sceneImagesRevise"
  | "videoGenerate"
  | "videoRevise";

type SettingsSectionId =
  | "tts-voice"
  | "pause-removal"
  | "music-library"
  | "sound-library"
  | "caption-styles"
  | "background-videos"
  | "image-templates"
  | "image-styles"
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
  subjectPrompt: string;
  stylePrompt: string;
  headerPercent: number;
  testTopic: string;
  testCaption: string;
  testImagePrompt: string;
  references?: StyleReferenceImage[];
  lastTestImage?: PersistedStyleTestImage;
}

interface NanoBananaPromptTemplates {
  styleInstructionsTemplate: string;
  characterReferenceTemplate: string;
  sceneTemplate: string;
}

interface ImageStyleSettings {
  defaultStyleId: string;
  styles: ImageStyle[];
  promptTemplates: NanoBananaPromptTemplates;
}

const NANO_BANANA_PLACEHOLDER_ROWS = [
  {
    placeholder: "{{topic}}",
    explanation:
      "The project topic from the short-form video metadata. This comes from the XML video topic or dashboard project topic field.",
    example: "Facial posture reset",
  },
  {
    placeholder: "{{script}}",
    explanation:
      "The full spoken script context for the current short-form video, pulled from the XML or generated script.",
    example:
      "Your jawline changes when posture changes, because your neck position affects the tissue under your chin.",
  },
  {
    placeholder: "{{assetId}}",
    explanation:
      'The current XML image asset id being rendered for this scene. It usually comes from <assets><image id="...">.',
    example: "jawline-side-profile",
  },
  {
    placeholder: "{{assetPrompt}}",
    explanation:
      "The current asset prompt text for the scene image. This is the main per-asset visual instruction from the XML asset or legacy scene prompt.",
    example:
      "Single full-frame side-profile portrait showing improved neck alignment and a cleaner jawline silhouette.",
  },
  {
    placeholder: "{{assetDerivedFromId}}",
    explanation:
      "The source asset id when the current XML asset uses basedOn for continuity or variation reuse.",
    example: "character-base-profile",
  },
  {
    placeholder: "{{extraDirection}}",
    explanation:
      "Optional revision notes entered during a rerender or style test. Comes from the dashboard request note field.",
    example: "Make the chin tuck clearer and simplify the shoulder line.",
  },
  {
    placeholder: "{{continuityInstructions}}",
    explanation:
      "Auto-generated continuity guidance when a scene references the previous frame or a derived asset. The generator composes this from scene linkage data.",
    example:
      "Attached reference image 2 shows the actual previous generated scene. Treat that image as the primary continuity anchor for this frame.",
  },
  {
    placeholder: "{{styleInstructionsBlock}}",
    explanation:
      "The fully rendered output of the Style instructions template below. The scene and character templates both inject this full block.",
    example:
      "Keep the same subject identity and overall look: same androgynous high-fashion model across all scenes...",
  },
  {
    placeholder: "{{subjectPrompt}}",
    explanation:
      "The selected image style subject prompt from the style library. This defines the recurring subject identity.",
    example:
      "same androgynous high-fashion model across all scenes, sharp eye area, defined cheekbones, elegant neutral styling",
  },
  {
    placeholder: "{{headerPercent}}",
    explanation:
      "The selected style's caption-safe top-area percentage from the style library.",
    example: "28",
  },
  {
    placeholder: "{{perStyleInstructions}}",
    explanation:
      "The effective per-style art direction text from the selected style. This includes the style prompt plus any reference-driven guidance added by the runtime.",
    example:
      "Clean dramatic high-contrast pencil-and-charcoal illustration, premium modern TikTok aesthetic, restrained vivid red accents only on the key focal area.",
  },
  {
    placeholder: "{{extraReferences}}",
    explanation:
      "A bullet list describing every non-character reference image attached to the selected style, including label, usage type, and usage instructions.",
    example:
      "- Attached reference image 2 (Lighting ref): usage type 'lighting'. Use this reference for soft rim lighting and subtle studio falloff.",
  },
] as const;

const XML_VISUAL_PLANNING_PLACEHOLDER_ROWS = [
  {
    placeholder: "{{xmlScriptPath}}",
    explanation:
      "Absolute path where Scribe must write the final xml-script.md artifact.",
    example:
      "/Users/ittaisvidler/tenxsolo/business/content/deliverables/short-form-videos/abc123/xml-script.md",
  },
  {
    placeholder: "{{topic}}",
    explanation:
      "The short-form project topic, with the same fallback the runtime uses when the topic is empty.",
    example: "Facial posture reset",
  },
  {
    placeholder: "{{selectedHook}}",
    explanation:
      "The approved hook text only. Put any surrounding label text directly in the editable prompt template.",
    example: "Your jawline changed because your posture changed",
  },
  {
    placeholder: "{{revisionNotesBlock}}",
    explanation:
      "The fully rendered conditional revision-notes block. It is injected only when rerun revision notes exist.",
    example:
      "Revision notes: Make the asset reuse more explicit and reduce camera motion.",
  },
  {
    placeholder: "{{textScriptPath}}",
    explanation:
      "Absolute path to the approved plain narration text script for this project.",
    example:
      "/Users/ittaisvidler/tenxsolo/business/content/deliverables/short-form-videos/abc123/script.md",
  },
  {
    placeholder: "{{transcriptPath}}",
    explanation:
      "Absolute path to the exact narration transcript file used for TTS and alignment reuse.",
    example:
      "/Users/ittaisvidler/tenxsolo/business/content/deliverables/short-form-videos/abc123/output/xml-script-work/voice/text-script.txt",
  },
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
    placeholder: "{{projectDir}}",
    explanation: "Absolute project root for the short-form deliverable.",
    example:
      "/Users/ittaisvidler/tenxsolo/business/content/deliverables/short-form-videos/abc123",
  },
] as const;

const XML_VISUAL_PLANNING_REVISION_NOTES_PLACEHOLDER_ROWS = [
  {
    placeholder: "{{revisionNotes}}",
    explanation:
      "The rerun revision notes text only. Put any surrounding label text directly in this conditional template.",
    example: "Make the asset reuse more explicit and reduce camera motion.",
  },
  {
    placeholder: "{{xmlScriptPath}}",
    explanation:
      "Absolute path to the existing xml-script.md artifact for this project, so rerun guidance can tell Scribe exactly which file to read or edit.",
    example:
      "/Users/ittaisvidler/tenxsolo/business/content/deliverables/short-form-videos/abc123/xml-script.md",
  },
] as const;

type VoiceMode = "voice-design" | "custom-voice";
type VoiceSourceType = "generated" | "uploaded-reference";

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
  prompt: string;
  notes: string;
  previewDurationSeconds?: number;
  generatedAudioRelativePath?: string;
  generatedDurationSeconds?: number;
  generatedPrompt?: string;
  generatedAt?: string;
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
  defaultMusicTrackId?: string;
  musicVolume: number;
  chromaKeyEnabledByDefault: boolean;
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

interface BackgroundVideoEntry {
  id: string;
  name: string;
  notes?: string;
  videoRelativePath: string;
  videoUrl?: string;
  uploadedAt?: string;
  updatedAt?: string;
}

interface BackgroundVideoSettings {
  defaultBackgroundVideoId?: string;
  backgrounds: BackgroundVideoEntry[];
}

interface TextScriptSettings {
  defaultMaxIterations: number;
  generatePrompt: string;
  revisePrompt: string;
  reviewPrompt: string;
}

interface XmlVisualPlanningSettings {
  promptTemplate: string;
  revisionNotesPromptTemplate: string;
}

interface SoundLibraryEntry {
  id: string;
  name: string;
  category: string;
  semanticTypes: Array<"impact" | "riser" | "click" | "whoosh" | "ambience">;
  tags: string[];
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
  createdAt?: string;
  updatedAt?: string;
}

interface SoundDesignSettings {
  promptTemplate: string;
  revisionPromptTemplate: string;
  defaultDuckingDb: number;
  maxConcurrentOneShots: number;
  library: SoundLibraryEntry[];
}

type SoundLibraryCategoryFilter = "all" | "__uncategorized__" | string;

type SoundLibraryFileFilter = "all" | "with-audio" | "missing-audio";

interface SoundLibraryCategorySummary {
  key: string;
  value: SoundLibraryCategoryFilter;
  label: string;
  totalCount: number;
  matchingCount: number;
  withAudioCount: number;
  missingAudioCount: number;
}

interface SoundLibraryListGroup {
  key: string;
  label: string;
  sounds: SoundLibraryEntry[];
}

interface SettingsResponse {
  success: boolean;
  data?: {
    prompts: Record<PromptKey, string>;
    definitions: PromptDefinition[];
    imageStyles: ImageStyleSettings;
    videoRender: VideoRenderSettings;
    backgroundVideos: BackgroundVideoSettings;
    textScript: TextScriptSettings;
    xmlVisualPlanning: XmlVisualPlanningSettings;
    soundDesign: SoundDesignSettings;
  };
  error?: string;
}

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

interface StyleTestState {
  isLoading: boolean;
  error: string | null;
  cleanImageUrl: string | null;
  previewImageUrl: string | null;
}

interface StyleReferenceUploadState {
  isUploading: boolean;
  error: string | null;
}

interface SoundUploadState {
  isUploading: boolean;
  error: string | null;
}

interface BackgroundVideoUploadState {
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
  prompts: {
    eyebrow: "Short-form workflow settings",
    title: "Prompts",
    description:
      "Edit the real hook, research, text-script, and XML visual-planning prompts the dashboard sends at runtime.",
    summaryLabel: "4 editable sections",
    sectionIds: [
      "prompt-hooks",
      "prompt-research",
      "text-script-prompts",
      "xml-visual-planning",
    ],
  },
  audio: {
    eyebrow: "Short-form workflow settings",
    title: "Audio",
    description:
      "Tune narration defaults, pause removal, chroma-key behavior, and the reusable Qwen voice library.",
    summaryLabel: "2 editable sections",
    sectionIds: ["pause-removal", "tts-voice"],
  },
  "sound-library": {
    eyebrow: "Short-form workflow settings",
    title: "Sound Library",
    description:
      "Manage the shared Plan Sound Design prompt, Generate Sound Design mix defaults, and reusable SFX library.",
    summaryLabel: "Shared library + prompt settings",
    sectionIds: ["sound-library"],
    pageActionSectionId: "sound-library",
  },
  images: {
    eyebrow: "Short-form workflow settings",
    title: "Images",
    description:
      "Maintain the live Nano Banana prompt templates plus the reusable image-style library that feeds scene generation.",
    summaryLabel: "2 editable sections",
    sectionIds: ["image-templates", "image-styles"],
  },
  captions: {
    eyebrow: "Short-form workflow settings",
    title: "Captions",
    description:
      "Edit reusable caption styles, linked animation presets, and the default deterministic caption chunking rules.",
    summaryLabel: "Shared caption style library",
    sectionIds: ["caption-styles"],
    pageActionSectionId: "caption-styles",
  },
  backgrounds: {
    eyebrow: "Short-form workflow settings",
    title: "Backgrounds",
    description:
      "Upload and manage the looping background videos reused behind green-screen scene plates in previews and final renders.",
    summaryLabel: "Shared background library",
    sectionIds: ["background-videos"],
    pageActionSectionId: "background-videos",
  },
  music: {
    eyebrow: "Short-form workflow settings",
    title: "Music",
    description:
      "Manage saved soundtrack presets, reusable generated files, and the default final-render music mix volume.",
    summaryLabel: "Shared music library",
    sectionIds: ["music-library"],
    pageActionSectionId: "music-library",
  },
};

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
    "background-videos": { saving: false, error: null, message: null },
    "image-templates": { saving: false, error: null, message: null },
    "image-styles": { saving: false, error: null, message: null },
    "prompt-hooks": { saving: false, error: null, message: null },
    "prompt-research": { saving: false, error: null, message: null },
    "text-script-prompts": { saving: false, error: null, message: null },
    "xml-visual-planning": { saving: false, error: null, message: null },
  };
}

function serializeForCompare(value: unknown) {
  return JSON.stringify(value);
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
    subjectPrompt:
      "same androgynous high-fashion model across all scenes, sharp eye area, defined cheekbones, elegant neutral styling",
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

function matchesSoundLibraryFileFilter(
  sound: SoundLibraryEntry,
  filter: SoundLibraryFileFilter,
) {
  if (filter === "with-audio") return Boolean(sound.audioRelativePath);
  if (filter === "missing-audio") return !sound.audioRelativePath;
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

function buildSoundLibrarySearchHaystack(sound: SoundLibraryEntry) {
  return [
    sound.id,
    sound.name,
    sound.category,
    sound.semanticTypes.join(" "),
    sound.tags.join(" "),
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

function buildUniqueSoundName(library: SoundLibraryEntry[], baseName: string) {
  let nextName = `${baseName} copy`;
  let suffix = 2;
  const existing = new Set(
    library.map((sound) => sound.name.trim().toLowerCase()),
  );
  while (existing.has(nextName.trim().toLowerCase())) {
    nextName = `${baseName} copy ${suffix}`;
    suffix += 1;
  }
  return nextName;
}

function buildUniqueSoundId(library: SoundLibraryEntry[], name: string) {
  const base = slugify(name) || "sound";
  let candidate = base;
  let suffix = 2;
  const existing = new Set(library.map((sound) => sound.id));
  while (existing.has(candidate)) {
    candidate = `${base}-${suffix}`;
    suffix += 1;
  }
  return candidate;
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
          : "Drag or click to place the anchor.",
        "h-20",
      )}
      {hasRealWaveform
        ? renderWaveformTrack(
            detailBars,
            "detail",
            detailStartIndex,
            "Fine trim",
            "Zoomed around the current anchor for tighter placement.",
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
                Preview anchor
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
  onSave,
  onReset,
}: {
  dirty: boolean;
  saving: boolean;
  saveLabel: string;
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
        Reset
      </Button>
      <Button size="sm" onClick={onSave} disabled={!dirty || saving}>
        {saving ? "Saving…" : saveLabel}
      </Button>
    </div>
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
}: {
  activeSection: ShortFormSettingsRouteSection;
}) {
  const searchParams = useSearchParams();
  const requestedStyleId = searchParams.get("style");

  const [definitions, setDefinitions] = useState<PromptDefinition[]>([]);
  const [prompts, setPrompts] = useState<Partial<Record<PromptKey, string>>>(
    {},
  );
  const [initialPrompts, setInitialPrompts] = useState<
    Partial<Record<PromptKey, string>>
  >({});
  const [imageStyles, setImageStyles] = useState<ImageStyleSettings | null>(
    null,
  );
  const [initialImageStyles, setInitialImageStyles] =
    useState<ImageStyleSettings | null>(null);
  const [videoRender, setVideoRender] = useState<VideoRenderSettings | null>(
    null,
  );
  const [initialVideoRender, setInitialVideoRender] =
    useState<VideoRenderSettings | null>(null);
  const [backgroundVideos, setBackgroundVideos] =
    useState<BackgroundVideoSettings | null>(null);
  const [initialBackgroundVideos, setInitialBackgroundVideos] =
    useState<BackgroundVideoSettings | null>(null);
  const [textScriptSettings, setTextScriptSettings] =
    useState<TextScriptSettings | null>(null);
  const [initialTextScriptSettings, setInitialTextScriptSettings] =
    useState<TextScriptSettings | null>(null);
  const [xmlVisualPlanningSettings, setXmlVisualPlanningSettings] =
    useState<XmlVisualPlanningSettings | null>(null);
  const [
    initialXmlVisualPlanningSettings,
    setInitialXmlVisualPlanningSettings,
  ] = useState<XmlVisualPlanningSettings | null>(null);
  const [soundDesignSettings, setSoundDesignSettings] =
    useState<SoundDesignSettings | null>(null);
  const [initialSoundDesignSettings, setInitialSoundDesignSettings] =
    useState<SoundDesignSettings | null>(null);
  const [selectedStyleId, setSelectedStyleId] = useState<string | null>(null);
  const [selectedVoiceId, setSelectedVoiceId] = useState<string | null>(null);
  const [selectedMusicId, setSelectedMusicId] = useState<string | null>(null);
  const [selectedSoundId, setSelectedSoundId] = useState<string | null>(null);
  const [soundLibrarySearchQuery, setSoundLibrarySearchQuery] = useState("");
  const [soundLibraryCategoryFilter, setSoundLibraryCategoryFilter] = useState<
    "all" | "__uncategorized__" | string
  >("all");
  const [soundLibraryFileFilter, setSoundLibraryFileFilter] = useState<
    "all" | "with-audio" | "missing-audio"
  >("all");
  const [selectedCaptionStyleId, setSelectedCaptionStyleId] = useState<
    string | null
  >(null);
  const [selectedAnimationPresetId, setSelectedAnimationPresetId] = useState<
    string | null
  >(null);
  const [captionLibraryTab, setCaptionLibraryTab] = useState<
    "styles" | "presets"
  >("styles");
  const [animationPresetJsonDraft, setAnimationPresetJsonDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [styleTestsById, setStyleTestsById] = useState<
    Record<string, StyleTestState>
  >({});
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
  const [backgroundVideoUpload, setBackgroundVideoUpload] =
    useState<BackgroundVideoUploadState>({ isUploading: false, error: null });
  const [sectionFeedback, setSectionFeedback] = useState<
    Record<SettingsSectionId, SectionFeedback>
  >(createEmptySectionFeedback());
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

  usePageScrollRestoration(
    `short-form-video-settings:${activeSection}`,
    !loading,
  );

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
      setSelectedMusicId(
        videoRender.defaultMusicTrackId ||
          videoRender.musicTracks[0]?.id ||
          null,
      );
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

  const loadSettings = useCallback(
    async (options?: { background?: boolean }) => {
      if (!options?.background) {
        setLoading(true);
        setError(null);
      }

      try {
        const data = await parseResponse(
          await fetch("/api/short-form-videos/settings", { cache: "no-store" }),
        );
        setDefinitions(data.definitions);
        setPrompts(data.prompts);
        setInitialPrompts(data.prompts);
        setImageStyles(data.imageStyles);
        setInitialImageStyles(data.imageStyles);
        setVideoRender(data.videoRender);
        setInitialVideoRender(data.videoRender);
        setBackgroundVideos(data.backgroundVideos);
        setInitialBackgroundVideos(data.backgroundVideos);
        setTextScriptSettings(data.textScript);
        setInitialTextScriptSettings(data.textScript);
        setXmlVisualPlanningSettings(data.xmlVisualPlanning);
        setInitialXmlVisualPlanningSettings(data.xmlVisualPlanning);
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
            data.videoRender.defaultMusicTrackId ||
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
        }
        setError(null);
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Failed to load short-form workflow settings",
        );
      } finally {
        if (!options?.background) {
          setLoading(false);
        }
      }
    },
    [],
  );

  useEffect(() => {
    void loadSettings();
  }, [loadSettings]);

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
        matchesSoundLibrarySearch(sound, normalizedSoundLibrarySearchTokens),
    );
  }, [
    normalizedSoundLibrarySearchTokens,
    soundDesignSettings,
    soundLibraryFileFilter,
  ]);
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
    normalizedSoundLibrarySearchTokens,
    soundDesignSettings,
    soundLibraryFileFilter,
  ]);
  const soundLibraryCategorySuggestions = useMemo(
    () =>
      soundLibraryCategorySummaries
        .filter((summary) => summary.key !== "__uncategorized__")
        .map((summary) => summary.label),
    [soundLibraryCategorySummaries],
  );
  const filteredSoundLibrary = useMemo(
    () =>
      soundLibraryBaseMatches.filter((sound) =>
        matchesSoundLibraryCategoryFilter(sound, soundLibraryCategoryFilter),
      ),
    [soundLibraryBaseMatches, soundLibraryCategoryFilter],
  );
  const filteredSoundLibraryGroups = useMemo<SoundLibraryListGroup[]>(() => {
    const grouped = new Map<string, SoundLibraryListGroup>();
    filteredSoundLibrary.forEach((sound) => {
      const key = getSoundLibraryCategoryKey(sound.category);
      const existing = grouped.get(key);
      if (existing) {
        existing.sounds.push(sound);
        return;
      }
      grouped.set(key, {
        key,
        label: getSoundLibraryCategoryLabel(sound.category),
        sounds: [sound],
      });
    });
    return Array.from(grouped.values())
      .map((group) => ({
        ...group,
        sounds: [...group.sounds].sort((left, right) =>
          left.name.localeCompare(right.name),
        ),
      }))
      .sort((left, right) => {
        if (
          left.key === "__uncategorized__" ||
          right.key === "__uncategorized__"
        ) {
          return left.key === "__uncategorized__" ? 1 : -1;
        }
        return left.label.localeCompare(right.label);
      });
  }, [filteredSoundLibrary]);
  const selectedSoundFilteredIndex = useMemo(
    () =>
      selectedSound
        ? filteredSoundLibrary.findIndex(
            (sound) => sound.id === selectedSound.id,
          )
        : -1,
    [filteredSoundLibrary, selectedSound],
  );
  const selectedSoundHiddenByFilter = Boolean(
    selectedSound && selectedSoundFilteredIndex === -1,
  );
  const soundLibraryTotalWithAudioCount = useMemo(
    () =>
      (soundDesignSettings?.library || []).filter((sound) =>
        Boolean(sound.audioRelativePath),
      ).length,
    [soundDesignSettings],
  );
  const filteredSoundLibraryWithAudioCount = useMemo(
    () =>
      filteredSoundLibrary.filter((sound) => Boolean(sound.audioRelativePath))
        .length,
    [filteredSoundLibrary],
  );
  const selectedSoundCategorySummary = useMemo(() => {
    if (!selectedSound) return null;
    const key = getSoundLibraryCategoryKey(selectedSound.category);
    return (
      soundLibraryCategorySummaries.find((summary) => summary.key === key) ||
      null
    );
  }, [selectedSound, soundLibraryCategorySummaries]);
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
          }) !==
          serializeForCompare({
            styles: initialImageStyles.styles,
            defaultStyleId: initialImageStyles.defaultStyleId,
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
            defaultMusicTrackId: videoRender.defaultMusicTrackId,
            musicVolume: videoRender.musicVolume,
          }) !==
          serializeForCompare({
            musicTracks: initialVideoRender.musicTracks,
            defaultMusicTrackId: initialVideoRender.defaultMusicTrackId,
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
            chromaKeyEnabledByDefault: videoRender.chromaKeyEnabledByDefault,
          }) !==
          serializeForCompare({
            pauseRemoval: initialVideoRender.pauseRemoval,
            chromaKeyEnabledByDefault:
              initialVideoRender.chromaKeyEnabledByDefault,
          })
        : false;
    const backgroundVideosDirty =
      backgroundVideos && initialBackgroundVideos
        ? serializeForCompare(backgroundVideos) !==
          serializeForCompare(initialBackgroundVideos)
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
      "background-videos": backgroundVideosDirty,
      "image-templates": imageTemplateDirty,
      "image-styles": imageStyleLibraryDirty,
      "prompt-hooks": promptGroupDirty["prompt-hooks"],
      "prompt-research": promptGroupDirty["prompt-research"],
      "text-script-prompts": textScriptPromptsDirty,
      "xml-visual-planning": xmlVisualPlanningDirty,
    };
  }, [
    backgroundVideos,
    imageStyles,
    initialBackgroundVideos,
    initialImageStyles,
    initialPrompts,
    initialSoundDesignSettings,
    initialTextScriptSettings,
    initialVideoRender,
    initialXmlVisualPlanningSettings,
    prompts,
    soundDesignSettings,
    textScriptSettings,
    videoRender,
    xmlVisualPlanningSettings,
  ]);

  const anyDirty = useMemo(
    () => Object.values(dirtyBySection).some(Boolean),
    [dirtyBySection],
  );
  const settingsShellNav = useShortFormSettingsShellNav();
  const autoRefreshPaused =
    anyDirty ||
    anySectionSaving ||
    anyStyleTesting ||
    ttsPreview.isLoading ||
    musicPreview.isLoading ||
    Boolean(selectedStyleUpload?.isUploading) ||
    Boolean(selectedVoiceUpload?.isUploading) ||
    Boolean(selectedSoundUpload?.isUploading) ||
    backgroundVideoUpload.isUploading;

  const dirtySectionIds = useMemo(
    () =>
      Object.entries(dirtyBySection)
        .filter(([, dirty]) => dirty)
        .map(([sectionId]) => sectionId),
    [dirtyBySection],
  );
  const pageMeta = SETTINGS_PAGE_META[activeSection];
  const pageActionSectionId = pageMeta.pageActionSectionId;
  const pageHasDirtySections = pageMeta.sectionIds.some(
    (sectionId) => dirtyBySection[sectionId],
  );
  const pageHasSectionError = pageMeta.sectionIds.some((sectionId) =>
    Boolean(sectionFeedback[sectionId].error),
  );
  const pageHasSectionSaving = pageMeta.sectionIds.some(
    (sectionId) => sectionFeedback[sectionId].saving,
  );
  const pageHasTransientWork =
    pageHasSectionSaving ||
    (activeSection === "audio" &&
      (ttsPreview.isLoading || Boolean(selectedVoiceUpload?.isUploading))) ||
    (activeSection === "sound-library" &&
      Boolean(selectedSoundUpload?.isUploading)) ||
    (activeSection === "images" &&
      (anyStyleTesting || Boolean(selectedStyleUpload?.isUploading))) ||
    (activeSection === "backgrounds" && backgroundVideoUpload.isUploading) ||
    (activeSection === "music" && musicPreview.isLoading);
  const pageStatus =
    error || pageHasSectionError
      ? "failed"
      : pageHasTransientWork
        ? "working"
        : pageHasDirtySections
          ? "needs review"
          : "approved";
  const pageReloadDisabled =
    loading ||
    anySectionSaving ||
    anyStyleTesting ||
    ttsPreview.isLoading ||
    musicPreview.isLoading ||
    Boolean(selectedStyleUpload?.isUploading) ||
    Boolean(selectedVoiceUpload?.isUploading) ||
    Boolean(selectedSoundUpload?.isUploading) ||
    backgroundVideoUpload.isUploading;

  useEffect(() => {
    if (loading || autoRefreshPaused) return;
    const id = window.setInterval(() => {
      void loadSettings({ background: true });
    }, 5000);
    return () => window.clearInterval(id);
  }, [autoRefreshPaused, loadSettings, loading]);

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
      backgroundCount: backgroundVideos?.backgrounds.length || 0,
      musicTrackCount: videoRender?.musicTracks.length || 0,
    });

    return () => {
      settingsShellNav.setSummaryOverrides({});
    };
  }, [
    backgroundVideos?.backgrounds.length,
    imageStyles?.styles.length,
    settingsShellNav,
    soundDesignSettings?.library.length,
    videoRender?.captionStyles.length,
    videoRender?.musicTracks.length,
    videoRender?.voices.length,
  ]);

  const promptSections = PROMPT_GROUPS.map((group) => {
    const feedback = sectionFeedback[group.id];
    const dirty = dirtyBySection[group.id];
    return (
      <section key={group.id} id={group.id} className="scroll-mt-24">
        <Card className="space-y-5 p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <WorkflowSectionHeader
              title={group.title}
              description={group.description}
              status={dirty ? "needs review" : "approved"}
            />
            <SectionActions
              dirty={dirty}
              saving={feedback.saving}
              saveLabel={`Save ${group.title.toLowerCase()}`}
              onSave={() => void saveSection(group.id)}
              onReset={() => resetSection(group.id)}
            />
          </div>

          <div className="space-y-6">
            {group.keys.map((key) => {
              const definition = promptDefinitionsByKey[key];
              return (
                <div
                  key={key}
                  className="space-y-2 border-t border-border pt-4 first:border-t-0 first:pt-0"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-sm font-medium text-foreground">
                      {definition?.title || key}
                    </h3>
                    {definition?.stage ? (
                      <span className="rounded-full border border-border px-2 py-0.5 text-[11px] uppercase tracking-wide text-muted-foreground">
                        {definition.stage}
                      </span>
                    ) : null}
                  </div>
                  {definition?.description ? (
                    <p className="text-sm text-muted-foreground">
                      {definition.description}
                    </p>
                  ) : null}
                  <Textarea
                    value={prompts[key] || ""}
                    onChange={(event) => {
                      updateSectionFeedbackState(group.id, {
                        error: null,
                        message: null,
                      });
                      setPrompts((current) => ({
                        ...current,
                        [key]: event.target.value,
                      }));
                    }}
                    className="min-h-[220px] font-mono text-xs"
                  />
                </div>
              );
            })}
          </div>

          <SectionFeedbackNotice feedback={feedback} />
        </Card>
      </section>
    );
  });

  const textScriptPromptSection = (
    <section id="text-script-prompts" className="scroll-mt-24">
      <Card className="space-y-5 p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <WorkflowSectionHeader
            title="Text-script Scribe prompts"
            description="These are the actual full top-level prompt templates the dashboard sends to Scribe during the Text Script loop: generate, revise, and review. Runtime placeholders stay in the template because the settings are global, but there is no second hidden wrapper prompt anymore."
            status={
              dirtyBySection["text-script-prompts"]
                ? "needs review"
                : "approved"
            }
          />
          <SectionActions
            dirty={dirtyBySection["text-script-prompts"]}
            saving={sectionFeedback["text-script-prompts"].saving}
            saveLabel="Save text-script prompts"
            onSave={() => void saveSection("text-script-prompts")}
            onReset={() => resetSection("text-script-prompts")}
          />
        </div>

        {textScriptSettings ? (
          <div className="space-y-6">
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
                New short-form projects can optionally override this per project
                from the Text Script section, but this is the dashboard-wide
                default.
              </p>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Full generate prompt template
              </label>
              <Textarea
                value={textScriptSettings.generatePrompt}
                onChange={(event) => {
                  updateSectionFeedbackState("text-script-prompts", {
                    error: null,
                    message: null,
                  });
                  setTextScriptSettings({
                    ...textScriptSettings,
                    generatePrompt: event.target.value,
                  });
                }}
                className="min-h-[280px] font-mono text-xs"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Full revise prompt template
              </label>
              <Textarea
                value={textScriptSettings.revisePrompt}
                onChange={(event) => {
                  updateSectionFeedbackState("text-script-prompts", {
                    error: null,
                    message: null,
                  });
                  setTextScriptSettings({
                    ...textScriptSettings,
                    revisePrompt: event.target.value,
                  });
                }}
                className="min-h-[320px] font-mono text-xs"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Full review prompt template
              </label>
              <Textarea
                value={textScriptSettings.reviewPrompt}
                onChange={(event) => {
                  updateSectionFeedbackState("text-script-prompts", {
                    error: null,
                    message: null,
                  });
                  setTextScriptSettings({
                    ...textScriptSettings,
                    reviewPrompt: event.target.value,
                  });
                }}
                className="min-h-[300px] font-mono text-xs"
              />
              <div className="space-y-1 text-xs text-muted-foreground">
                <p>
                  These templates support runtime placeholders such as{" "}
                  <code>{"{{topic}}"}</code>,{" "}
                  <code>{"{{selectedHookTextOrFallback}}"}</code>,{" "}
                  <code>{"{{approvedResearch}}"}</code>,{" "}
                  <code>{"{{draftPath}}"}</code>,{" "}
                  <code>{"{{reviewPath}}"}</code>,{" "}
                  <code>{"{{runManifestPath}}"}</code>,{" "}
                  <code>{"{{iterationNumber}}"}</code>,{" "}
                  <code>{"{{maxIterations}}"}</code>,{" "}
                  <code>{"{{revisionInstructionLine}}"}</code>,{" "}
                  <code>{"{{priorDraftBlock}}"}</code>,{" "}
                  <code>{"{{priorReviewBlock}}"}</code>,{" "}
                  <code>{"{{retentionSkillPath}}"}</code>,{" "}
                  <code>{"{{retentionPlaybookPath}}"}</code>,{" "}
                  <code>{"{{graderSkillPath}}"}</code>,{" "}
                  <code>{"{{graderRubricPath}}"}</code>,{" "}
                  <code>{"{{passingScore}}"}</code>, and{" "}
                  <code>{"{{draftBody}}"}</code>.
                </p>
                <p>
                  Keep each field as the complete top-level Scribe prompt for
                  that loop step. If you change artifact instructions or
                  placeholder names here, the runtime behavior will change
                  accordingly.
                </p>
              </div>
            </div>
          </div>
        ) : null}

        <SectionFeedbackNotice
          feedback={sectionFeedback["text-script-prompts"]}
        />
      </Card>
    </section>
  );

  const xmlVisualPlanningPromptSection = (
    <section id="xml-visual-planning" className="scroll-mt-24">
      <Card className="space-y-5 p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <WorkflowSectionHeader
            title="Visual-planning Scribe prompt"
            description="This is the actual full top-level prompt template the dashboard sends to Scribe when Plan visuals writes the XML script. The only extra layer is an optional revision-notes block that you place explicitly with {{revisionNotesBlock}}."
            status={
              dirtyBySection["xml-visual-planning"]
                ? "needs review"
                : "approved"
            }
          />
          <SectionActions
            dirty={dirtyBySection["xml-visual-planning"]}
            saving={sectionFeedback["xml-visual-planning"].saving}
            saveLabel="Save visual-planning prompt"
            onSave={() => void saveSection("xml-visual-planning")}
            onReset={() => resetSection("xml-visual-planning")}
          />
        </div>

        {xmlVisualPlanningSettings ? (
          <div className="space-y-6">
            <div className="space-y-2">
              <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Full visual-planning prompt template
              </label>
              <Textarea
                value={xmlVisualPlanningSettings.promptTemplate}
                onChange={(event) => {
                  updateSectionFeedbackState("xml-visual-planning", {
                    error: null,
                    message: null,
                  });
                  setXmlVisualPlanningSettings({
                    ...xmlVisualPlanningSettings,
                    promptTemplate: event.target.value,
                  });
                }}
                className="min-h-[560px] font-mono text-xs"
              />
              <div className="space-y-1 text-xs text-muted-foreground">
                <p>
                  Runtime placeholders stay in this template because the setting
                  is global, but this field is the real prompt surface used at
                  runtime for Scribe XML visual planning. Keep labels like
                  “Selected hook:” inline here when you want them always
                  visible.
                </p>
                <p>
                  Place <code>{"{{revisionNotesBlock}}"}</code> wherever the
                  optional revision-notes instructions should appear. If no
                  revision notes are supplied for a rerun, that block is omitted
                  entirely.
                </p>
                <p>
                  Keep this field as the complete top-level prompt. If you
                  change artifact instructions or placeholder names here, the
                  Plan Visuals runtime behavior will change immediately.
                </p>
              </div>
            </div>

            <div className="rounded-lg border border-border/70 bg-background/40 p-3 text-xs text-muted-foreground">
              <p className="font-medium text-foreground">
                Full prompt placeholders
              </p>
              <div className="mt-2 overflow-x-auto">
                <table className="min-w-full border-collapse text-left text-xs text-muted-foreground">
                  <thead>
                    <tr className="border-b border-border/70 text-[11px] uppercase tracking-wide text-muted-foreground">
                      <th className="px-2 py-2 font-medium">Placeholder</th>
                      <th className="px-2 py-2 font-medium">
                        What it represents
                      </th>
                      <th className="px-2 py-2 font-medium">Example value</th>
                    </tr>
                  </thead>
                  <tbody>
                    {XML_VISUAL_PLANNING_PLACEHOLDER_ROWS.map((row) => (
                      <tr
                        key={row.placeholder}
                        className="border-b border-border/50 align-top last:border-b-0"
                      >
                        <td className="px-2 py-2 font-mono text-[11px] text-foreground">
                          {row.placeholder}
                        </td>
                        <td className="px-2 py-2 leading-5">
                          {row.explanation}
                        </td>
                        <td className="px-2 py-2 leading-5 text-foreground/80">
                          {row.example}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Conditional revision-notes prompt template
              </label>
              <Textarea
                value={xmlVisualPlanningSettings.revisionNotesPromptTemplate}
                onChange={(event) => {
                  updateSectionFeedbackState("xml-visual-planning", {
                    error: null,
                    message: null,
                  });
                  setXmlVisualPlanningSettings({
                    ...xmlVisualPlanningSettings,
                    revisionNotesPromptTemplate: event.target.value,
                  });
                }}
                className="min-h-[120px] font-mono text-xs"
              />
              <div className="space-y-1 text-xs text-muted-foreground">
                <p>
                  This template renders only when rerun revision notes exist.
                  The rendered result becomes{" "}
                  <code>{"{{revisionNotesBlock}}"}</code> inside the full prompt
                  above.
                </p>
                <p>
                  Use this to control the revision-notes label or any extra
                  guidance without leaving an empty line like “Revision notes:”
                  when no notes were provided.
                </p>
                <p>
                  This conditional template supports both{" "}
                  <code>{"{{revisionNotes}}"}</code> and{" "}
                  <code>{"{{xmlScriptPath}}"}</code>.
                </p>
              </div>
            </div>

            <div className="rounded-lg border border-border/70 bg-background/40 p-3 text-xs text-muted-foreground">
              <p className="font-medium text-foreground">
                Revision-notes template placeholders
              </p>
              <div className="mt-2 overflow-x-auto">
                <table className="min-w-full border-collapse text-left text-xs text-muted-foreground">
                  <thead>
                    <tr className="border-b border-border/70 text-[11px] uppercase tracking-wide text-muted-foreground">
                      <th className="px-2 py-2 font-medium">Placeholder</th>
                      <th className="px-2 py-2 font-medium">
                        What it represents
                      </th>
                      <th className="px-2 py-2 font-medium">Example value</th>
                    </tr>
                  </thead>
                  <tbody>
                    {XML_VISUAL_PLANNING_REVISION_NOTES_PLACEHOLDER_ROWS.map(
                      (row) => (
                        <tr
                          key={row.placeholder}
                          className="border-b border-border/50 align-top last:border-b-0"
                        >
                          <td className="px-2 py-2 font-mono text-[11px] text-foreground">
                            {row.placeholder}
                          </td>
                          <td className="px-2 py-2 leading-5">
                            {row.explanation}
                          </td>
                          <td className="px-2 py-2 leading-5 text-foreground/80">
                            {row.example}
                          </td>
                        </tr>
                      ),
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        ) : null}

        <SectionFeedbackNotice
          feedback={sectionFeedback["xml-visual-planning"]}
        />
      </Card>
    </section>
  );

  const soundLibrarySection = (
    <section id="sound-library" className="scroll-mt-24">
      <Card className="space-y-5 p-5">
        {soundDesignSettings ? (
          <div className="space-y-5">
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="space-y-2 rounded-lg border border-border bg-background/50 p-4">
                <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Full Plan Sound Design prompt template
                </label>
                <Textarea
                  value={soundDesignSettings.promptTemplate}
                  onChange={(event) => {
                    updateSectionFeedbackState("sound-library", {
                      error: null,
                      message: null,
                    });
                    setSoundDesignSettings({
                      ...soundDesignSettings,
                      promptTemplate: event.target.value,
                    });
                  }}
                  className="min-h-[320px] font-mono text-xs"
                />
                <div className="space-y-2 text-xs text-muted-foreground">
                  <p>
                    This is the actual full top-level prompt template the
                    dashboard sends to Scribe when Plan Sound Design runs.
                    Keep labels, file-writing rules, and placeholder usage
                    inline here when you want them enforced every time.
                  </p>
                  <p>
                    Runtime placeholders supported here include{" "}
                    <code>{"{{topic}}"}</code>,{" "}
                    <code>{"{{selectedHookTextOrFallback}}"}</code>,{" "}
                    <code>{"{{revisionNotesBlock}}"}</code>,{" "}
                    <code>{"{{xmlScriptPath}}"}</code>,{" "}
                    <code>{"{{captionPlanPath}}"}</code>,{" "}
                    <code>{"{{sceneManifestPath}}"}</code>,{" "}
                    <code>{"{{soundDesignPath}}"}</code>,{" "}
                    <code>{"{{soundLibraryJson}}"}</code>, and{" "}
                    <code>{"{{projectDir}}"}</code>.
                  </p>
                </div>
              </div>
              <div className="space-y-4 rounded-lg border border-border bg-background/50 p-4">
                <div className="space-y-2">
                  <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Conditional revision-notes prompt template
                  </label>
                  <Textarea
                    value={soundDesignSettings.revisionPromptTemplate}
                    onChange={(event) => {
                      updateSectionFeedbackState("sound-library", {
                        error: null,
                        message: null,
                      });
                      setSoundDesignSettings({
                        ...soundDesignSettings,
                        revisionPromptTemplate: event.target.value,
                      });
                    }}
                    className="min-h-[140px] font-mono text-xs"
                  />
                  <p className="text-xs text-muted-foreground">
                    This template renders only when rerun revision notes exist.
                    The rendered result becomes{" "}
                    <code>{"{{revisionNotesBlock}}"}</code> inside the full
                    prompt above, and it supports{" "}
                    <code>{"{{revisionNotes}}"}</code> plus{" "}
                    <code>{"{{soundDesignPath}}"}</code>.
                  </p>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Default ducking (dB)
                    </label>
                    <Input
                      type="number"
                      min={-24}
                      max={0}
                      step={1}
                      value={soundDesignSettings.defaultDuckingDb}
                      onChange={(event) => {
                        updateSectionFeedbackState("sound-library", {
                          error: null,
                          message: null,
                        });
                        setSoundDesignSettings({
                          ...soundDesignSettings,
                          defaultDuckingDb: Math.max(
                            -24,
                            Math.min(0, Number(event.target.value) || 0),
                          ),
                        });
                      }}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Max concurrent one-shots
                    </label>
                    <Input
                      type="number"
                      min={1}
                      max={8}
                      step={1}
                      value={soundDesignSettings.maxConcurrentOneShots}
                      onChange={(event) => {
                        updateSectionFeedbackState("sound-library", {
                          error: null,
                          message: null,
                        });
                        setSoundDesignSettings({
                          ...soundDesignSettings,
                          maxConcurrentOneShots: Math.max(
                            1,
                            Math.min(8, Number(event.target.value) || 1),
                          ),
                        });
                      }}
                    />
                  </div>
                </div>
                <div className="rounded-lg border border-border/70 bg-background/40 p-3 text-xs text-muted-foreground">
                  <p className="font-medium text-foreground">
                    What counts as the current global rule set
                  </p>
                  <ul className="mt-2 list-disc space-y-1 pl-4">
                    <li>The planning prompt and revision prompt above.</li>
                    <li>The ducking and concurrency limits above.</li>
                    <li>
                      Each library entry’s semantic types, anchors, gain, fades,
                      recommended uses, and avoid notes.
                    </li>
                  </ul>
                </div>
              </div>
            </div>

            <div className="rounded-lg border border-border bg-background/60 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="text-sm font-medium text-foreground">
                    Saved sound library
                  </h3>
                  <p className="mt-1 max-w-3xl text-xs text-muted-foreground">
                    Upload reusable WAV or MP3 effects, then tag them by
                    semantics so the project Plan Sound Design stage can resolve
                    timed XML events to real assets.
                  </p>
                </div>
                <Button
                  variant="outline"
                  onClick={addSound}
                  disabled={sectionFeedback["sound-library"].saving}
                >
                  Add sound
                </Button>
              </div>

              <div className="mt-4 grid gap-4 lg:grid-cols-[320px,1fr]">
                <div className="space-y-3">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        Search library
                      </label>
                      <span className="text-[11px] text-muted-foreground">
                        {filteredSoundLibrary.length} shown
                      </span>
                    </div>
                    <Input
                      value={soundLibrarySearchQuery}
                      onChange={(event) =>
                        setSoundLibrarySearchQuery(event.target.value)
                      }
                      placeholder="Search sounds, tags, types, notes..."
                    />
                    <p className="text-[11px] text-muted-foreground">
                      Search matches every typed keyword across names,
                      categories, tags, usage notes, source, and file path.
                    </p>
                  </div>

                  <div className="space-y-2 rounded-lg border border-border bg-background/50 p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        Filter state
                      </label>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setSoundLibrarySearchQuery("");
                          setSoundLibraryCategoryFilter("all");
                          setSoundLibraryFileFilter("all");
                        }}
                        disabled={
                          !soundLibrarySearchQuery &&
                          soundLibraryCategoryFilter === "all" &&
                          soundLibraryFileFilter === "all"
                        }
                      >
                        Clear filters
                      </Button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant={
                          soundLibraryFileFilter === "all"
                            ? "default"
                            : "outline"
                        }
                        onClick={() => setSoundLibraryFileFilter("all")}
                      >
                        All files ({soundDesignSettings.library.length})
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant={
                          soundLibraryFileFilter === "with-audio"
                            ? "default"
                            : "outline"
                        }
                        onClick={() => setSoundLibraryFileFilter("with-audio")}
                      >
                        Audio ready ({soundLibraryTotalWithAudioCount})
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant={
                          soundLibraryFileFilter === "missing-audio"
                            ? "default"
                            : "outline"
                        }
                        onClick={() =>
                          setSoundLibraryFileFilter("missing-audio")
                        }
                      >
                        Needs audio (
                        {soundDesignSettings.library.length -
                          soundLibraryTotalWithAudioCount}
                        )
                      </Button>
                    </div>
                    <div className="grid gap-2 sm:grid-cols-2">
                      <div className="rounded-md border border-border/70 bg-background/70 px-3 py-2 text-[11px] text-muted-foreground">
                        <span className="font-medium text-foreground">
                          Matches
                        </span>{" "}
                        {filteredSoundLibrary.length} /{" "}
                        {soundDesignSettings.library.length}
                      </div>
                      <div className="rounded-md border border-border/70 bg-background/70 px-3 py-2 text-[11px] text-muted-foreground">
                        <span className="font-medium text-foreground">
                          Audio in view
                        </span>{" "}
                        {filteredSoundLibraryWithAudioCount} /{" "}
                        {filteredSoundLibrary.length || 0}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        Browse by category
                      </label>
                      <span className="text-[11px] text-muted-foreground">
                        Case-insensitive grouping
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => setSoundLibraryCategoryFilter("all")}
                        className={`rounded-full border px-3 py-1.5 text-left text-xs transition ${soundLibraryCategoryFilter === "all" ? "border-primary/50 bg-primary/10 text-foreground" : "border-border/70 bg-background/70 text-muted-foreground hover:border-primary/30 hover:text-foreground"}`}
                      >
                        <span className="font-medium">All categories</span>
                        <span className="ml-2 text-[11px] text-muted-foreground">
                          {soundLibraryBaseMatches.length}
                        </span>
                      </button>
                      {soundLibraryCategorySummaries.map((summary) => {
                        const active =
                          summary.key ===
                          (soundLibraryCategoryFilter === "all"
                            ? "all"
                            : soundLibraryCategoryFilter.trim().toLowerCase());
                        return (
                          <button
                            key={summary.key}
                            type="button"
                            onClick={() =>
                              setSoundLibraryCategoryFilter(summary.value)
                            }
                            className={`rounded-full border px-3 py-1.5 text-left text-xs transition ${active ? "border-primary/50 bg-primary/10 text-foreground" : "border-border/70 bg-background/70 text-muted-foreground hover:border-primary/30 hover:text-foreground"} ${summary.matchingCount === 0 && !active ? "opacity-60" : ""}`}
                          >
                            <span className="font-medium">{summary.label}</span>
                            <span className="ml-2 text-[11px] text-muted-foreground">
                              {summary.matchingCount}/{summary.totalCount}
                            </span>
                            {summary.missingAudioCount > 0 ? (
                              <span className="ml-2 text-[11px] text-amber-100">
                                {summary.missingAudioCount} need audio
                              </span>
                            ) : null}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        Sound library
                      </label>
                      <span className="text-[11px] text-muted-foreground">
                        Grouped for faster scanning
                      </span>
                    </div>
                    <div className="max-h-[560px] space-y-3 overflow-y-auto rounded-lg border border-border bg-background/40 p-2">
                      {selectedSoundHiddenByFilter && selectedSound ? (
                        <div className="space-y-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-2">
                          <div className="px-1 text-[11px] font-medium uppercase tracking-wide text-amber-100">
                            Pinned selection outside filters
                          </div>
                          <button
                            type="button"
                            onClick={() => setSelectedSoundId(selectedSound.id)}
                            className="w-full rounded-lg border border-amber-400/40 bg-background/70 px-3 py-3 text-left transition hover:border-amber-300/60"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <div className="text-sm font-medium text-foreground">
                                  {selectedSound.name}
                                </div>
                                <div className="mt-1 text-[11px] text-muted-foreground">
                                  {getSoundLibraryCategoryLabel(
                                    selectedSound.category,
                                  )}{" "}
                                  · {selectedSound.semanticTypes.join(", ")}
                                </div>
                              </div>
                              <Badge
                                variant={
                                  selectedSound.audioRelativePath
                                    ? "secondary"
                                    : "outline"
                                }
                              >
                                {selectedSound.audioRelativePath
                                  ? "Audio ready"
                                  : "Needs audio"}
                              </Badge>
                            </div>
                          </button>
                        </div>
                      ) : null}
                      {filteredSoundLibraryGroups.map((group) => (
                        <div key={group.key} className="space-y-2">
                          {soundLibraryCategoryFilter === "all" ? (
                            <div className="flex items-center justify-between gap-2 px-1 text-[11px] uppercase tracking-wide text-muted-foreground">
                              <span>{group.label}</span>
                              <span className="normal-case tracking-normal">
                                {group.sounds.length} match
                                {group.sounds.length === 1 ? "" : "es"}
                              </span>
                            </div>
                          ) : null}
                          {group.sounds.map((sound) => {
                            const selected = selectedSoundId === sound.id;
                            return (
                              <button
                                key={sound.id}
                                type="button"
                                onClick={() => setSelectedSoundId(sound.id)}
                                className={`w-full rounded-lg border px-3 py-3 text-left transition ${selected ? "border-primary/50 bg-primary/10" : "border-border/70 bg-background/70 hover:border-primary/30 hover:bg-background"}`}
                              >
                                <div className="flex items-start justify-between gap-3">
                                  <div>
                                    <div className="text-sm font-medium text-foreground">
                                      {sound.name}
                                    </div>
                                    <div className="mt-1 text-[11px] text-muted-foreground">
                                      {getSoundLibraryCategoryLabel(
                                        sound.category,
                                      )}{" "}
                                      · {sound.semanticTypes.join(", ")}
                                    </div>
                                  </div>
                                  <Badge
                                    variant={
                                      sound.audioRelativePath
                                        ? "secondary"
                                        : "outline"
                                    }
                                  >
                                    {sound.audioRelativePath
                                      ? "Audio ready"
                                      : "Needs audio"}
                                  </Badge>
                                </div>
                                {sound.tags.length > 0 ? (
                                  <div className="mt-2 line-clamp-2 text-[11px] text-muted-foreground">
                                    Tags: {sound.tags.join(", ")}
                                  </div>
                                ) : null}
                              </button>
                            );
                          })}
                        </div>
                      ))}
                      {filteredSoundLibrary.length === 0 ? (
                        <div className="rounded-lg border border-dashed border-border p-3 text-xs text-muted-foreground">
                          No library entries match the current search/filter
                          yet.
                        </div>
                      ) : null}
                    </div>
                    <div className="rounded-lg border border-border bg-background/50 p-3 text-xs text-muted-foreground">
                      <p>
                        Projects load this library inside Plan Sound Design, then
                        Generate Sound Design can adjust and preview the resolved
                        XML events per project.
                      </p>
                    </div>
                  </div>
                </div>

                {selectedSound ? (
                  <div className="space-y-4 rounded-lg border border-border bg-background/50 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3 rounded-lg border border-border/70 bg-background/60 p-3">
                      <div className="space-y-2">
                        <div className="flex flex-wrap items-center gap-2 text-xs">
                          <Badge
                            variant={
                              selectedSound.audioRelativePath
                                ? "secondary"
                                : "outline"
                            }
                          >
                            {selectedSound.audioRelativePath
                              ? "Audio ready"
                              : "Needs audio"}
                          </Badge>
                          <Badge variant="outline">
                            {getSoundLibraryCategoryLabel(
                              selectedSound.category,
                            )}
                          </Badge>
                          {selectedSoundFilteredIndex >= 0 ? (
                            <span className="text-muted-foreground">
                              Match {selectedSoundFilteredIndex + 1} of{" "}
                              {filteredSoundLibrary.length}
                            </span>
                          ) : (
                            <span className="text-amber-100">
                              Outside current filters
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Duplicate variants without reuploading audio, and step
                          through the filtered queue while tuning metadata and
                          anchors.
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => duplicateSound(selectedSound.id)}
                        >
                          Duplicate sound
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => selectAdjacentSound(-1)}
                          disabled={
                            filteredSoundLibrary.length === 0 ||
                            selectedSoundFilteredIndex <= 0
                          }
                        >
                          Previous match
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => selectAdjacentSound(1)}
                          disabled={
                            filteredSoundLibrary.length === 0 ||
                            selectedSoundFilteredIndex < 0 ||
                            selectedSoundFilteredIndex >=
                              filteredSoundLibrary.length - 1
                          }
                        >
                          Next match
                        </Button>
                      </div>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                          Sound name
                        </label>
                        <Input
                          value={selectedSound.name}
                          onChange={(event) =>
                            updateSelectedSound((sound) => ({
                              ...sound,
                              name: event.target.value,
                            }))
                          }
                          placeholder="Sharp whoosh"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                          Category
                        </label>
                        <>
                          <Input
                            list="sound-library-category-suggestions"
                            value={selectedSound.category}
                            onChange={(event) =>
                              updateSelectedSound((sound) => ({
                                ...sound,
                                category: event.target.value,
                              }))
                            }
                            placeholder="Transition"
                          />
                          <datalist id="sound-library-category-suggestions">
                            {soundLibraryCategorySuggestions.map((category) => (
                              <option key={category} value={category} />
                            ))}
                          </datalist>
                        </>
                        {selectedSoundCategorySummary ? (
                          <p className="text-[11px] text-muted-foreground">
                            {selectedSoundCategorySummary.totalCount} sound
                            {selectedSoundCategorySummary.totalCount === 1
                              ? ""
                              : "s"}{" "}
                            in this category,{" "}
                            {selectedSoundCategorySummary.missingAudioCount}{" "}
                            still missing audio.
                          </p>
                        ) : null}
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => deleteSound(selectedSound.id)}
                        disabled={soundDesignSettings.library.length <= 1}
                      >
                        Delete sound
                      </Button>
                      {selectedSound.category.trim() ? (
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() =>
                            setSoundLibraryCategoryFilter(
                              selectedSound.category,
                            )
                          }
                        >
                          Filter to this category
                        </Button>
                      ) : (
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() =>
                            setSoundLibraryCategoryFilter("__uncategorized__")
                          }
                        >
                          Show uncategorized
                        </Button>
                      )}
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
                      <div className="space-y-2">
                        <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                          Default anchor
                        </label>
                        <Select
                          value={selectedSound.defaultAnchor}
                          onChange={(event) =>
                            updateSelectedSound((sound) => ({
                              ...sound,
                              defaultAnchor: event.target
                                .value as SoundLibraryEntry["defaultAnchor"],
                            }))
                          }
                        >
                          <option value="scene-start">Scene start</option>
                          <option value="scene-end">Scene end</option>
                          <option value="caption-start">Caption start</option>
                          <option value="caption-end">Caption end</option>
                          <option value="global-start">Global start</option>
                          <option value="global-end">Global end</option>
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

                    <div className="space-y-2">
                      <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        Tags (comma separated)
                      </label>
                      <Input
                        value={selectedSound.tags.join(", ")}
                        onChange={(event) =>
                          updateSelectedSound((sound) => ({
                            ...sound,
                            tags: event.target.value
                              .split(",")
                              .map((tag) => tag.trim())
                              .filter(Boolean),
                          }))
                        }
                        placeholder="sharp, clean, short"
                      />
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

                    {selectedSoundUpload?.error ? (
                      <ValidationNotice
                        title="Sound upload failed"
                        message={selectedSoundUpload.error}
                      />
                    ) : null}

                    <div className="space-y-3 rounded-lg border border-border bg-background/60 p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <h3 className="text-sm font-medium text-foreground">
                            Saved sound asset
                          </h3>
                          <p className="mt-1 text-xs text-muted-foreground">
                            Upload once here, save the library, and project
                            Plan Sound Design passes can resolve XML events against
                            this exact stored file.
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
                      <div className="space-y-2">
                        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                          <span className="font-medium uppercase tracking-wide text-muted-foreground">
                            Waveform anchor
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
                          This anchor gives the resolver a direct reference
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
                      ) : null}
                      {!savedSoundAudioUrl ? (
                        <div className="rounded-lg border border-dashed border-border p-3 text-xs text-muted-foreground">
                          No audio file saved yet. Upload one to make this
                          library entry usable in project Generate Sound Design
                          resolution.
                        </div>
                      ) : null}
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        ) : null}

        <SectionFeedbackNotice feedback={sectionFeedback["sound-library"]} />
      </Card>
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

  function clearStyleTest(styleId: string) {
    setStyleTestsById((current) => {
      if (!current[styleId]) return current;
      const next = { ...current };
      delete next[styleId];
      return next;
    });
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
        return (
          data.videoRender.defaultMusicTrackId ||
          data.videoRender.musicTracks[0]?.id ||
          null
        );
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

    if (sectionId === "background-videos") {
      setBackgroundVideos(data.backgroundVideos);
      setInitialBackgroundVideos(data.backgroundVideos);
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
            }
          : data.imageStyles,
      );
      setInitialImageStyles((current) =>
        current
          ? {
              ...current,
              styles: data.imageStyles.styles,
              defaultStyleId: data.imageStyles.defaultStyleId,
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
                chromaKeyEnabledByDefault:
                  videoRender.chromaKeyEnabledByDefault,
              },
            }
          : null;
      case "music-library":
        return videoRender
          ? {
              videoRender: {
                musicTracks: videoRender.musicTracks,
                defaultMusicTrackId: videoRender.defaultMusicTrackId,
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
      case "background-videos":
        return backgroundVideos ? { backgroundVideos } : null;
      case "text-script-prompts":
        return textScriptSettings ? { textScript: textScriptSettings } : null;
      case "xml-visual-planning":
        return xmlVisualPlanningSettings
          ? { xmlVisualPlanning: xmlVisualPlanningSettings }
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
                ? "Saved. New final-video runs will now reuse this soundtrack library, including any generated soundtrack files."
                : sectionId === "caption-styles"
                  ? "Saved. New final-video runs will use this caption-style library/default immediately."
                  : sectionId === "background-videos"
                    ? "Saved. Projects now use this background-video library/default immediately."
                    : sectionId === "image-templates" ||
                        sectionId === "image-styles"
                      ? "Saved. New scene-image runs and tests will use this section immediately."
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
          chromaKeyEnabledByDefault:
            initialVideoRender.chromaKeyEnabledByDefault,
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
        defaultMusicTrackId: initialVideoRender.defaultMusicTrackId,
        musicVolume: initialVideoRender.musicVolume,
      });
      setSelectedMusicId(
        initialVideoRender.defaultMusicTrackId ||
          initialVideoRender.musicTracks[0]?.id ||
          null,
      );
      return;
    }

    if (sectionId === "sound-library" && initialSoundDesignSettings) {
      setSoundDesignSettings(initialSoundDesignSettings);
      setSelectedSoundId((current) => {
        if (
          current &&
          initialSoundDesignSettings.library.some(
            (sound) => sound.id === current,
          )
        )
          return current;
        return initialSoundDesignSettings.library[0]?.id || null;
      });
      return;
    }

    if (sectionId === "background-videos" && initialBackgroundVideos) {
      setBackgroundVideos(initialBackgroundVideos);
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
      defaultMusicTrackId: videoRender.defaultMusicTrackId || dedupedId,
      musicTracks: [...videoRender.musicTracks, nextTrack],
    });
    setSelectedMusicId(dedupedId);
  }

  function deleteMusic(trackId: string) {
    if (!videoRender || videoRender.musicTracks.length <= 1) return;
    updateSectionFeedbackState("music-library", { error: null, message: null });
    const remaining = videoRender.musicTracks.filter(
      (track) => track.id !== trackId,
    );
    const nextDefault =
      videoRender.defaultMusicTrackId === trackId
        ? remaining[0].id
        : videoRender.defaultMusicTrackId;
    setVideoRender({
      ...videoRender,
      defaultMusicTrackId: nextDefault,
      musicTracks: remaining,
    });
    setSelectedMusicId(remaining[0]?.id || null);
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
    });
    setSoundDesignSettings({
      ...soundDesignSettings,
      library: [...soundDesignSettings.library, nextSound],
    });
    setSoundLibrarySearchQuery("");
    setSoundLibraryFileFilter("all");
    setSelectedSoundId(nextSound.id);
  }

  function duplicateSound(soundId: string) {
    if (!soundDesignSettings) return;
    const source = soundDesignSettings.library.find(
      (sound) => sound.id === soundId,
    );
    if (!source) return;
    updateSectionFeedbackState("sound-library", { error: null, message: null });
    const name = buildUniqueSoundName(soundDesignSettings.library, source.name);
    const duplicate: SoundLibraryEntry = {
      ...source,
      id: buildUniqueSoundId(soundDesignSettings.library, name),
      name,
      semanticTypes: [...source.semanticTypes],
      tags: [...source.tags],
      waveformPeaks: source.waveformPeaks
        ? [...source.waveformPeaks]
        : undefined,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const sourceIndex = soundDesignSettings.library.findIndex(
      (sound) => sound.id === soundId,
    );
    const nextLibrary = [...soundDesignSettings.library];
    nextLibrary.splice(sourceIndex + 1, 0, duplicate);
    setSoundDesignSettings({
      ...soundDesignSettings,
      library: nextLibrary,
    });
    setSoundLibrarySearchQuery("");
    setSoundLibraryFileFilter("all");
    setSelectedSoundId(duplicate.id);
  }

  function selectAdjacentSound(direction: -1 | 1) {
    if (!filteredSoundLibrary.length) return;
    const fallbackIndex = direction > 0 ? 0 : filteredSoundLibrary.length - 1;
    const currentIndex =
      selectedSoundFilteredIndex >= 0
        ? selectedSoundFilteredIndex
        : fallbackIndex - direction;
    const nextIndex = clampNumber(
      currentIndex + direction,
      0,
      filteredSoundLibrary.length - 1,
    );
    const nextSound = filteredSoundLibrary[nextIndex];
    if (nextSound) {
      setSelectedSoundId(nextSound.id);
    }
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
    setSelectedSoundId(remaining[0]?.id || null);
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

  async function uploadBackgroundVideo(file: File) {
    setBackgroundVideoUpload({ isUploading: true, error: null });
    updateSectionFeedbackState("background-videos", {
      error: null,
      message: null,
    });

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("label", file.name);

      const response = await fetch(
        "/api/short-form-videos/settings/background-videos/upload",
        {
          method: "POST",
          body: formData,
        },
      );
      const payload = (await response.json().catch(() => ({}))) as {
        success?: boolean;
        data?: {
          videoRelativePath: string;
          videoUrl?: string;
          uploadedAt?: string;
        };
        error?: string;
      };

      if (!response.ok || payload.success === false || !payload.data) {
        throw new Error(payload.error || "Failed to upload background video");
      }

      setBackgroundVideos((current) => {
        const entryId = `${slugify(file.name.replace(/\.[^.]+$/, "")) || "background"}-${Date.now()}`;
        const nextEntry: BackgroundVideoEntry = {
          id: entryId,
          name: file.name.replace(/\.[^.]+$/, "") || "Background video",
          videoRelativePath: payload.data!.videoRelativePath,
          videoUrl: payload.data!.videoUrl,
          uploadedAt: payload.data!.uploadedAt,
          updatedAt: payload.data!.uploadedAt,
        };
        if (!current) {
          return {
            defaultBackgroundVideoId: entryId,
            backgrounds: [nextEntry],
          };
        }
        return {
          ...current,
          defaultBackgroundVideoId: current.defaultBackgroundVideoId || entryId,
          backgrounds: [...current.backgrounds, nextEntry],
        };
      });

      setBackgroundVideoUpload({ isUploading: false, error: null });
    } catch (err) {
      setBackgroundVideoUpload({
        isUploading: false,
        error:
          err instanceof Error
            ? err.message
            : "Failed to upload background video",
      });
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
      setSelectedMusicId(data.track.id);
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
          ? "Saved soundtrack already existed, so final-video runs will reuse the exact same file."
          : "Saved a reusable soundtrack file. Final-video runs will now reuse this exact audio instead of regenerating it.",
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
      status={pageStatus}
      actions={
        <>
          <Badge variant="outline">{pageMeta.summaryLabel}</Badge>
          {pageActionSectionId ? (
            <SectionActions
              dirty={dirtyBySection[pageActionSectionId]}
              saving={sectionFeedback[pageActionSectionId].saving}
              saveLabel={
                pageActionSectionId === "sound-library"
                  ? "Save sound library settings"
                  : pageActionSectionId === "caption-styles"
                    ? "Save caption styles"
                    : pageActionSectionId === "background-videos"
                      ? "Save background library"
                      : "Save music library"
              }
              onSave={() => void saveSection(pageActionSectionId)}
              onReset={() => resetSection(pageActionSectionId)}
            />
          ) : null}
          <Button
            variant="outline"
            onClick={() => void loadSettings()}
            disabled={pageReloadDisabled}
          >
            Reload page state
          </Button>
        </>
      }
      preContent={
        error ? (
          <ValidationNotice title="Settings error" message={error} />
        ) : null
      }
    >
      {activeSection === "prompts" ? (
        <div className="space-y-6">
          {promptSections}
          {textScriptPromptSection}
          {xmlVisualPlanningPromptSection}
        </div>
      ) : null}

      {activeSection === "sound-library" ? soundLibrarySection : null}

      {activeSection === "audio" ? (
        <div className="space-y-6">
          <section id="pause-removal" className="scroll-mt-24">
            <Card className="space-y-5 p-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <WorkflowSectionHeader
                  title="Pause-removal defaults"
                  description="Set the global silence-trimming defaults for the narration pipeline plus the default final-render chroma-key behavior. The silence-trimming ffmpeg pass runs after original narration generation and before forced alignment. Individual projects can override these values from their project page."
                  status={
                    dirtyBySection["pause-removal"]
                      ? "needs review"
                      : "approved"
                  }
                />
                <SectionActions
                  dirty={dirtyBySection["pause-removal"]}
                  saving={sectionFeedback["pause-removal"].saving}
                  saveLabel="Save pause-removal defaults"
                  onSave={() => void saveSection("pause-removal")}
                  onReset={() => resetSection("pause-removal")}
                />
              </div>

              {videoRender ? (
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2 md:col-span-2">
                    <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Default final-video chroma key
                    </label>
                    <Select
                      value={
                        videoRender.chromaKeyEnabledByDefault
                          ? "enabled"
                          : "disabled"
                      }
                      onChange={(event) => {
                        updateSectionFeedbackState("pause-removal", {
                          error: null,
                          message: null,
                        });
                        setVideoRender({
                          ...videoRender,
                          chromaKeyEnabledByDefault:
                            event.target.value === "enabled",
                        });
                      }}
                      className="max-w-[220px]"
                    >
                      <option value="disabled">Disabled</option>
                      <option value="enabled">Enabled</option>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      New projects use this for final-video runs unless a
                      project-level override says otherwise. Default is now off.
                    </p>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Remove pauses longer than (seconds)
                    </label>
                    <Input
                      type="number"
                      min={0.1}
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
                                0.1,
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
              <div className="flex flex-wrap items-start justify-between gap-4">
                <WorkflowSectionHeader
                  title="Qwen voice library"
                  description="Manage the reusable voice library that the dashboard really uses for final-video narration. VoiceDesign entries are the new primary path. Legacy/custom entries remain supported only for migrated speaker-based voices and fallback compatibility."
                  status={
                    dirtyBySection["tts-voice"] ? "needs review" : "approved"
                  }
                />
                <SectionActions
                  dirty={dirtyBySection["tts-voice"]}
                  saving={sectionFeedback["tts-voice"].saving}
                  saveLabel="Save voice library"
                  onSave={() => void saveSection("tts-voice")}
                  onReset={() => resetSection("tts-voice")}
                />
              </div>

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

      {activeSection === "images" ? (
        <div className="space-y-6">
          <section id="image-templates" className="scroll-mt-24">
            <Card className="space-y-5 p-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <WorkflowSectionHeader
                  title="Nano Banana prompt templates"
                  description="These are the real editable templates used by the direct dashboard scene-image path. Shared visual rules and greenscreen requirements now live inside the style-instructions template itself, so what you edit here is what Nano Banana gets."
                  status={
                    dirtyBySection["image-templates"]
                      ? "needs review"
                      : "approved"
                  }
                />
                <SectionActions
                  dirty={dirtyBySection["image-templates"]}
                  saving={sectionFeedback["image-templates"].saving}
                  saveLabel="Save templates"
                  onSave={() => void saveSection("image-templates")}
                  onReset={() => resetSection("image-templates")}
                />
              </div>

              {imageStyles ? (
                <div className="space-y-4">
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-3">
                        <h3 className="text-sm font-medium text-foreground">
                          Scene generation template
                        </h3>
                        <span className="text-[11px] text-muted-foreground">
                          Used as the real per-scene Nano Banana prompt surface
                        </span>
                      </div>
                      <Textarea
                        value={imageStyles.promptTemplates.sceneTemplate}
                        onChange={(event) => {
                          updateSectionFeedbackState("image-templates", {
                            error: null,
                            message: null,
                          });
                          setImageStyles({
                            ...imageStyles,
                            promptTemplates: {
                              ...imageStyles.promptTemplates,
                              sceneTemplate: event.target.value,
                            },
                          });
                        }}
                        className="min-h-[240px] font-mono text-xs"
                      />
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-3">
                        <h3 className="text-sm font-medium text-foreground">
                          Style instructions template
                        </h3>
                        <span className="text-[11px] text-muted-foreground">
                          Rendered first, then injected into the scene and
                          character templates
                        </span>
                      </div>
                      <Textarea
                        value={
                          imageStyles.promptTemplates.styleInstructionsTemplate
                        }
                        onChange={(event) => {
                          updateSectionFeedbackState("image-templates", {
                            error: null,
                            message: null,
                          });
                          setImageStyles({
                            ...imageStyles,
                            promptTemplates: {
                              ...imageStyles.promptTemplates,
                              styleInstructionsTemplate: event.target.value,
                            },
                          });
                        }}
                        className="min-h-[240px] font-mono text-xs"
                      />
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-3">
                        <h3 className="text-sm font-medium text-foreground">
                          Character reference template
                        </h3>
                        <span className="text-[11px] text-muted-foreground">
                          Used only when no primary character reference image is
                          supplied
                        </span>
                      </div>
                      <Textarea
                        value={
                          imageStyles.promptTemplates.characterReferenceTemplate
                        }
                        onChange={(event) => {
                          updateSectionFeedbackState("image-templates", {
                            error: null,
                            message: null,
                          });
                          setImageStyles({
                            ...imageStyles,
                            promptTemplates: {
                              ...imageStyles.promptTemplates,
                              characterReferenceTemplate: event.target.value,
                            },
                          });
                        }}
                        className="min-h-[240px] font-mono text-xs"
                      />
                    </div>
                  </div>

                  <div className="rounded-lg border border-border/70 bg-background/40 p-3 text-xs text-muted-foreground">
                    <p className="font-medium text-foreground">
                      Useful placeholders
                    </p>
                    <div className="mt-2 overflow-x-auto">
                      <table className="min-w-full border-collapse text-left text-xs text-muted-foreground">
                        <thead>
                          <tr className="border-b border-border/70 text-[11px] uppercase tracking-wide text-muted-foreground">
                            <th className="px-2 py-2 font-medium">
                              Placeholder
                            </th>
                            <th className="px-2 py-2 font-medium">
                              What it represents
                            </th>
                            <th className="px-2 py-2 font-medium">
                              Example value
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {NANO_BANANA_PLACEHOLDER_ROWS.map((row) => (
                            <tr
                              key={row.placeholder}
                              className="border-b border-border/50 align-top last:border-b-0"
                            >
                              <td className="px-2 py-2 font-mono text-[11px] text-foreground">
                                {row.placeholder}
                              </td>
                              <td className="px-2 py-2 leading-5">
                                {row.explanation}
                              </td>
                              <td className="px-2 py-2 leading-5 text-foreground/80">
                                {row.example}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              ) : null}

              <SectionFeedbackNotice
                feedback={sectionFeedback["image-templates"]}
              />
            </Card>
          </section>

          <section id="image-styles" className="scroll-mt-24">
            <Card className="space-y-5 p-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <WorkflowSectionHeader
                  title="Image style library"
                  description="Maintain per-style instructions, reusable references, and the built-in one-scene style test. The selected project style feeds directly into live scene-image generation."
                  status={
                    dirtyBySection["image-styles"] ? "needs review" : "approved"
                  }
                />
                <SectionActions
                  dirty={dirtyBySection["image-styles"]}
                  saving={sectionFeedback["image-styles"].saving}
                  saveLabel="Save style library"
                  onSave={() => void saveSection("image-styles")}
                  onReset={() => resetSection("image-styles")}
                />
              </div>

              {imageStyles ? (
                <div className="grid gap-5 xl:grid-cols-[280px_minmax(0,1fr)]">
                  <div className="space-y-3 rounded-lg border border-border bg-background/40 p-3">
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
                  </div>

                  {selectedStyle ? (
                    <div className="space-y-5 rounded-lg border border-border bg-background/40 p-4">
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
                          Subject / character prompt
                        </label>
                        <Textarea
                          value={selectedStyle.subjectPrompt}
                          onChange={(event) =>
                            updateSelectedStyle((style) => ({
                              ...style,
                              subjectPrompt: event.target.value,
                            }))
                          }
                          className="min-h-[90px] font-mono text-xs"
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
                              anchor instead of the built-in generated character
                              reference.
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
                              current editor values, including the real Nano
                              Banana templates and any uploaded style reference
                              images with their usage instructions.
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
                                  className="aspect-[9/16] w-full rounded-lg border border-border bg-muted object-cover"
                                />
                              </div>
                            ) : null}
                          </div>
                        ) : null}
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : null}

              <SectionFeedbackNotice
                feedback={sectionFeedback["image-styles"]}
              />
            </Card>
          </section>
        </div>
      ) : null}

      {activeSection === "captions" ? (
        <div className="space-y-6">
          <section id="caption-styles" className="scroll-mt-24">
            <Card className="space-y-5 p-5">
              {videoRender ? (
                <div className="space-y-5">
                  <div className="rounded-lg border border-border bg-background/60 p-4">
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
                  </div>

                  <div className="rounded-lg border border-border bg-background/60 p-4">
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
                              label="Timing multiplier"
                              value={
                                selectedAnimationPreset.config.timing.multiplier
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
                  </div>
                </div>
              ) : null}

              <SectionFeedbackNotice
                feedback={sectionFeedback["caption-styles"]}
              />
            </Card>
          </section>
        </div>
      ) : null}

      {activeSection === "backgrounds" ? (
        <div className="space-y-6">
          <section id="background-videos" className="scroll-mt-24">
            <Card className="space-y-5 p-5">
              {backgroundVideos ? (
                <div className="space-y-5">
                  <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-background/60 p-4">
                    <div>
                      <h3 className="text-sm font-medium text-foreground">
                        Background library
                      </h3>
                      <p className="mt-1 max-w-3xl text-xs text-muted-foreground">
                        These videos are looped to the full narration duration
                        during final render, then the green-screen character
                        plates are chroma-keyed over them. Scene preview tabs
                        also composite against the selected project background.
                      </p>
                    </div>
                    <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-border px-3 py-2 text-sm hover:bg-accent">
                      <span>
                        {backgroundVideoUpload.isUploading
                          ? "Uploading…"
                          : "Upload background video"}
                      </span>
                      <input
                        type="file"
                        accept="video/mp4,video/quicktime,video/webm,video/x-m4v,.mp4,.mov,.webm,.m4v"
                        className="hidden"
                        disabled={backgroundVideoUpload.isUploading}
                        onChange={(event) => {
                          const file = event.target.files?.[0];
                          if (file) {
                            void uploadBackgroundVideo(file);
                          }
                          event.currentTarget.value = "";
                        }}
                      />
                    </label>
                  </div>

                  {backgroundVideoUpload.error ? (
                    <ValidationNotice
                      title="Background upload failed"
                      message={backgroundVideoUpload.error}
                    />
                  ) : null}

                  {backgroundVideos.backgrounds.length > 0 ? (
                    <div className="grid gap-4 lg:grid-cols-2">
                      {backgroundVideos.backgrounds.map((background) => {
                        const isDefault =
                          backgroundVideos.defaultBackgroundVideoId ===
                          background.id;
                        return (
                          <div
                            key={background.id}
                            className="space-y-3 rounded-lg border border-border bg-background/60 p-4"
                          >
                            <div className="flex flex-wrap items-start justify-between gap-3">
                              <div>
                                <p className="text-sm font-medium text-foreground">
                                  {background.name}
                                </p>
                                <p className="mt-1 text-xs text-muted-foreground">
                                  {background.notes || "No notes yet."}
                                </p>
                              </div>
                              <div className="flex items-center gap-2">
                                <Button
                                  type="button"
                                  size="sm"
                                  variant={isDefault ? "secondary" : "outline"}
                                  onClick={() => {
                                    updateSectionFeedbackState(
                                      "background-videos",
                                      { error: null, message: null },
                                    );
                                    setBackgroundVideos({
                                      ...backgroundVideos,
                                      defaultBackgroundVideoId: background.id,
                                    });
                                  }}
                                >
                                  {isDefault
                                    ? "Default background"
                                    : "Set as default"}
                                </Button>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  onClick={() => {
                                    updateSectionFeedbackState(
                                      "background-videos",
                                      { error: null, message: null },
                                    );
                                    const remaining =
                                      backgroundVideos.backgrounds.filter(
                                        (entry) => entry.id !== background.id,
                                      );
                                    setBackgroundVideos({
                                      defaultBackgroundVideoId:
                                        backgroundVideos.defaultBackgroundVideoId ===
                                        background.id
                                          ? remaining[0]?.id
                                          : backgroundVideos.defaultBackgroundVideoId,
                                      backgrounds: remaining,
                                    });
                                  }}
                                >
                                  Delete
                                </Button>
                              </div>
                            </div>

                            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_220px]">
                              <div className="space-y-3">
                                <div className="space-y-2">
                                  <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                                    Background name
                                  </label>
                                  <Input
                                    value={background.name}
                                    onChange={(event) => {
                                      updateSectionFeedbackState(
                                        "background-videos",
                                        { error: null, message: null },
                                      );
                                      setBackgroundVideos({
                                        ...backgroundVideos,
                                        backgrounds:
                                          backgroundVideos.backgrounds.map(
                                            (entry) =>
                                              entry.id === background.id
                                                ? {
                                                    ...entry,
                                                    name: event.target.value,
                                                  }
                                                : entry,
                                          ),
                                      });
                                    }}
                                  />
                                </div>
                                <div className="space-y-2">
                                  <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                                    Notes
                                  </label>
                                  <Textarea
                                    value={background.notes || ""}
                                    onChange={(event) => {
                                      updateSectionFeedbackState(
                                        "background-videos",
                                        { error: null, message: null },
                                      );
                                      setBackgroundVideos({
                                        ...backgroundVideos,
                                        backgrounds:
                                          backgroundVideos.backgrounds.map(
                                            (entry) =>
                                              entry.id === background.id
                                                ? {
                                                    ...entry,
                                                    notes: event.target.value,
                                                  }
                                                : entry,
                                          ),
                                      });
                                    }}
                                    className="min-h-[100px] text-xs"
                                    placeholder="Optional notes about where this background works best"
                                  />
                                </div>
                              </div>
                              <div className="space-y-2">
                                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                                  Preview
                                </p>
                                {background.videoUrl ? (
                                  <video
                                    src={background.videoUrl}
                                    controls
                                    muted
                                    loop
                                    playsInline
                                    preload="metadata"
                                    className="aspect-[9/16] w-full rounded-lg border border-border bg-black object-cover"
                                  />
                                ) : (
                                  <div className="flex aspect-[9/16] items-center justify-center rounded-lg border border-dashed border-border text-xs text-muted-foreground">
                                    Preview unavailable
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
                      No background videos yet. Upload one or more vertical (or
                      croppable) loops here, then set a default so new projects
                      inherit it automatically.
                    </div>
                  )}
                </div>
              ) : null}

              <SectionFeedbackNotice
                feedback={sectionFeedback["background-videos"]}
              />
            </Card>
          </section>
        </div>
      ) : null}

      {activeSection === "music" ? (
        <div className="space-y-6">
          <section id="music-library" className="scroll-mt-24">
            <Card className="space-y-5 p-5">
              {videoRender ? (
                <div className="space-y-5">
                  <div className="rounded-lg border border-border bg-background/60 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <h3 className="text-sm font-medium text-foreground">
                          Saved soundtrack presets
                        </h3>
                        <p className="mt-1 max-w-3xl text-xs text-muted-foreground">
                          Each preset stores the ACE-Step prompt that describes
                          the instrumental vibe. Generate the soundtrack once
                          here, and final-video renders reuse that saved file
                          instead of asking ACE-Step for a fresh song every
                          time.
                        </p>
                      </div>
                      <Button
                        variant="outline"
                        onClick={addMusic}
                        disabled={sectionFeedback["music-library"].saving}
                      >
                        Add soundtrack
                      </Button>
                    </div>

                    <div className="mt-4 grid gap-4 lg:grid-cols-[280px,1fr]">
                      <div className="space-y-2">
                        <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                          Music library
                        </label>
                        <Select
                          value={selectedMusicId || ""}
                          onChange={(event) =>
                            setSelectedMusicId(event.target.value)
                          }
                          disabled={videoRender.musicTracks.length === 0}
                        >
                          {videoRender.musicTracks.map((track) => (
                            <option key={track.id} value={track.id}>
                              {track.name}
                              {track.id === videoRender.defaultMusicTrackId
                                ? " (default)"
                                : ""}
                            </option>
                          ))}
                        </Select>
                        <div className="rounded-lg border border-border bg-background/50 p-3 text-xs text-muted-foreground">
                          <p>
                            <span className="font-medium text-foreground">
                              Default soundtrack:
                            </span>{" "}
                            {videoRender.musicTracks.find(
                              (track) =>
                                track.id === videoRender.defaultMusicTrackId,
                            )?.name || "Not set"}
                          </p>
                          <p className="mt-2">
                            <span className="font-medium text-foreground">
                              Saved music mix volume:
                            </span>{" "}
                            {Math.round((videoRender.musicVolume || 0) * 100)}%
                          </p>
                          <p className="mt-2">
                            Projects can override the soundtrack preset
                            individually. The saved volume is global and is
                            passed into the real final-video music mix.
                          </p>
                        </div>
                      </div>

                      {selectedMusic ? (
                        <div className="space-y-4 rounded-lg border border-border bg-background/50 p-4">
                          <div className="grid gap-4 md:grid-cols-2">
                            <div className="space-y-2">
                              <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                                Soundtrack name
                              </label>
                              <Input
                                value={selectedMusic.name}
                                onChange={(event) => {
                                  updateSelectedMusic((track) => ({
                                    ...track,
                                    name: event.target.value,
                                  }));
                                }}
                                placeholder="Curiosity underscore"
                              />
                            </div>
                            <div className="space-y-2">
                              <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                                Preview duration (seconds)
                              </label>
                              <Input
                                type="number"
                                min={6}
                                max={30}
                                value={
                                  selectedMusic.previewDurationSeconds || 12
                                }
                                onChange={(event) => {
                                  updateSelectedMusic((track) => ({
                                    ...track,
                                    previewDurationSeconds: Math.min(
                                      30,
                                      Math.max(
                                        6,
                                        Number(event.target.value) || 12,
                                      ),
                                    ),
                                  }));
                                }}
                              />
                            </div>
                          </div>

                          <div className="flex flex-wrap items-center gap-2 text-xs">
                            <Button
                              type="button"
                              variant={
                                selectedMusic.id ===
                                videoRender.defaultMusicTrackId
                                  ? "default"
                                  : "outline"
                              }
                              onClick={() => {
                                updateSectionFeedbackState("music-library", {
                                  error: null,
                                  message: null,
                                });
                                setVideoRender({
                                  ...videoRender,
                                  defaultMusicTrackId: selectedMusic.id,
                                });
                              }}
                            >
                              {selectedMusic.id ===
                              videoRender.defaultMusicTrackId
                                ? "Default soundtrack"
                                : "Set as default"}
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              onClick={() => deleteMusic(selectedMusic.id)}
                              disabled={videoRender.musicTracks.length <= 1}
                            >
                              Delete soundtrack
                            </Button>
                          </div>

                          <div className="space-y-2">
                            <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                              Music prompt
                            </label>
                            <Textarea
                              value={selectedMusic.prompt}
                              onChange={(event) => {
                                updateSelectedMusic((track) => ({
                                  ...track,
                                  prompt: event.target.value,
                                }));
                              }}
                              className="min-h-[150px] font-mono text-xs"
                            />
                            <p className="text-xs text-muted-foreground">
                              This prompt is passed to ACE-Step only when you
                              generate or regenerate the saved soundtrack file
                              here. After that, final-video renders reuse the
                              saved WAV directly.
                            </p>
                          </div>

                          <div className="space-y-2">
                            <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                              Notes
                            </label>
                            <Textarea
                              value={selectedMusic.notes}
                              onChange={(event) => {
                                updateSelectedMusic((track) => ({
                                  ...track,
                                  notes: event.target.value,
                                }));
                              }}
                              className="min-h-[90px] text-xs"
                              placeholder="Optional notes about when to use this soundtrack"
                            />
                          </div>

                          <div className="space-y-2">
                            <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                              Default music volume
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
                              <div className="w-16 text-right text-sm text-foreground">
                                {Math.round(videoRender.musicVolume * 100)}%
                              </div>
                            </div>
                            <p className="text-xs text-muted-foreground">
                              This exact saved volume is passed into the final
                              ffmpeg music mix for every new final-video run.
                            </p>
                          </div>

                          <div className="space-y-4 rounded-lg border border-border bg-background/60 p-4">
                            <div className="flex flex-wrap items-center justify-between gap-3">
                              <div>
                                <h3 className="text-sm font-medium text-foreground">
                                  Saved soundtrack file
                                </h3>
                                <p className="mt-1 text-xs text-muted-foreground">
                                  Generate one reusable ACE-Step instrumental
                                  for this soundtrack entry. Final-video renders
                                  then reuse this exact file with the saved mix
                                  volume until you regenerate it.
                                </p>
                              </div>
                              <Button
                                onClick={() => void generateMusicPreview()}
                                disabled={
                                  musicPreview.isLoading ||
                                  sectionFeedback["music-library"].saving
                                }
                              >
                                {musicPreview.isLoading
                                  ? "Generating…"
                                  : hasGeneratedSoundtrack(selectedMusic)
                                    ? "Regenerate saved soundtrack"
                                    : "Generate saved soundtrack"}
                              </Button>
                            </div>

                            {musicPreview.error ? (
                              <ValidationNotice
                                title="Saved soundtrack failed"
                                message={musicPreview.error}
                              />
                            ) : null}

                            {musicPreview.isLoading ? (
                              <div className="rounded-lg border border-border p-4">
                                <OrbitLoader label="Generating reusable ACE-Step soundtrack" />
                              </div>
                            ) : null}

                            {savedMusicAudioUrl ? (
                              <div className="space-y-3 rounded-lg border border-border bg-background/70 p-4">
                                <div className="grid gap-3 md:grid-cols-3">
                                  <div>
                                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                                      Saved soundtrack
                                    </p>
                                    <p className="mt-1 text-sm text-foreground">
                                      {selectedMusic.name}
                                    </p>
                                  </div>
                                  <div>
                                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                                      Duration
                                    </p>
                                    <p className="mt-1 text-sm text-foreground">
                                      {selectedMusic.generatedDurationSeconds ||
                                        selectedMusic.previewDurationSeconds ||
                                        12}
                                      s
                                    </p>
                                  </div>
                                  <div>
                                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                                      Applied volume
                                    </p>
                                    <p className="mt-1 text-sm text-foreground">
                                      {Math.round(
                                        (videoRender.musicVolume || 0) * 100,
                                      )}
                                      %
                                    </p>
                                  </div>
                                </div>
                                <audio
                                  controls
                                  className="w-full"
                                  src={savedMusicAudioUrl}
                                />
                                <div>
                                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                                    Prompt snapshot used
                                  </p>
                                  <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">
                                    {selectedMusic.generatedPrompt ||
                                      selectedMusic.prompt}
                                  </p>
                                </div>
                                {selectedMusic.generatedAt ? (
                                  <p className="text-xs text-muted-foreground">
                                    Saved{" "}
                                    {new Date(
                                      selectedMusic.generatedAt,
                                    ).toLocaleString()}
                                    .
                                    {musicPreview.reusedExisting === true
                                      ? " Reused the existing soundtrack file on the latest request."
                                      : musicPreview.reusedExisting === false
                                        ? " Regenerated the soundtrack file on the latest request."
                                        : ""}
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

              <SectionFeedbackNotice
                feedback={sectionFeedback["music-library"]}
              />
            </Card>
          </section>
        </div>
      ) : null}
    </ShortFormSubpageShell>
  );
}
