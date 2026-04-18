'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { OrbitLoader, Skeleton } from '@/components/ui/loading';
import { SectionNavigator, useSectionScrollSpy } from '@/components/short-form-video/SectionNavigator';
import { ValidationNotice, WorkflowSectionHeader } from '@/components/short-form-video/WorkflowShared';
import { CaptionStylePreview } from '@/components/short-form-video/CaptionStylePreview';
import { usePageScrollRestoration } from '@/components/usePageScrollRestoration';
import {
  BUILT_IN_CAPTION_ANIMATION_PRESET_IDS,
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
} from '@/lib/short-form-caption-animation';

type PromptKey =
  | 'hooksGenerate'
  | 'hooksMore'
  | 'researchGenerate'
  | 'researchRevise'
  | 'sceneImagesGenerate'
  | 'sceneImagesRevise'
  | 'videoGenerate'
  | 'videoRevise';

type SettingsSectionId =
  | 'tts-voice'
  | 'pause-removal'
  | 'music-library'
  | 'caption-styles'
  | 'background-videos'
  | 'image-templates'
  | 'image-shared-constraints'
  | 'image-styles'
  | 'prompt-hooks'
  | 'prompt-research'
  | 'text-script-prompts';

interface PromptDefinition {
  key: PromptKey;
  title: string;
  description: string;
  stage: 'hooks' | 'research' | 'script' | 'scene-images' | 'video';
}

type StyleReferenceUsageType = 'general' | 'style' | 'character' | 'lighting' | 'composition' | 'palette';

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
  commonConstraints: string;
  defaultStyleId: string;
  styles: ImageStyle[];
  promptTemplates: NanoBananaPromptTemplates;
}

type VoiceMode = 'voice-design' | 'custom-voice';
type VoiceSourceType = 'generated' | 'uploaded-reference';

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

interface SettingsResponse {
  success: boolean;
  data?: {
    prompts: Record<PromptKey, string>;
    definitions: PromptDefinition[];
    imageStyles: ImageStyleSettings;
    videoRender: VideoRenderSettings;
    backgroundVideos: BackgroundVideoSettings;
    textScript: TextScriptSettings;
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

const STYLE_REFERENCE_USAGE_OPTIONS: { value: StyleReferenceUsageType; label: string }[] = [
  { value: 'general', label: 'General' },
  { value: 'style', label: 'Style / aesthetic' },
  { value: 'character', label: 'Primary character' },
  { value: 'lighting', label: 'Lighting' },
  { value: 'composition', label: 'Composition' },
  { value: 'palette', label: 'Palette / color' },
];

const CAPTION_ANIMATION_EASING_OPTIONS: Array<{ value: ShortFormCaptionAnimationEasing; label: string }> = [
  { value: 'linear', label: 'Linear' },
  { value: 'ease-in-quad', label: 'Ease in quad' },
  { value: 'ease-out-quad', label: 'Ease out quad' },
  { value: 'ease-in-out-quad', label: 'Ease in out quad' },
  { value: 'ease-out-cubic', label: 'Ease out cubic' },
  { value: 'ease-in-out-cubic', label: 'Ease in out cubic' },
  { value: 'ease-out-back', label: 'Ease out back' },
];

const CAPTION_ANIMATION_COLOR_MODE_OPTIONS: Array<{ value: ShortFormCaptionAnimationColorMode; label: string }> = [
  { value: 'style-active-word', label: 'Use active word color' },
  { value: 'style-outline', label: 'Use caption outline color' },
  { value: 'style-shadow', label: 'Use caption shadow color' },
  { value: 'custom', label: 'Use custom color' },
];

const CAPTION_ANIMATION_TRACK_LABELS: Array<{ key: keyof ShortFormCaptionAnimationPresetConfig['motion']; label: string; helper: string }> = [
  { key: 'scale', label: 'Scale', helper: 'Multiplicative scale over the active-word lifetime.' },
  { key: 'translateXEm', label: 'Translate X (em)', helper: 'Horizontal motion in em units.' },
  { key: 'translateYEm', label: 'Translate Y (em)', helper: 'Vertical motion in em units. Positive values lift upward in preview/render.' },
  { key: 'extraOutlineWidth', label: 'Extra outline width', helper: 'Adds outline thickness on top of the caption style outline.' },
  { key: 'extraBlur', label: 'Extra blur', helper: 'Adds glow / blur on top of the caption style shadow blur.' },
  { key: 'glowStrength', label: 'Glow strength', helper: 'Controls the intensity of the active-word glow layer.' },
  { key: 'shadowOpacityMultiplier', label: 'Shadow opacity multiplier', helper: 'Scales the shadow alpha during the animation.' },
];

const CAPTION_FONT_WEIGHT_OPTIONS: Array<{ value: number; label: string }> = [
  { value: 300, label: 'Light (300)' },
  { value: 400, label: 'Regular (400)' },
  { value: 500, label: 'Medium (500)' },
  { value: 600, label: 'Semibold (600)' },
  { value: 700, label: 'Bold (700)' },
  { value: 800, label: 'Extra Bold (800)' },
  { value: 900, label: 'Black (900)' },
];

const PROMPT_GROUPS: Array<{
  id: SettingsSectionId;
  title: string;
  description: string;
  keys: PromptKey[];
}> = [
  {
    id: 'prompt-hooks',
    title: 'Hook prompts',
    description: 'Templates still used for hook generation and “more hooks” requests.',
    keys: ['hooksGenerate', 'hooksMore'],
  },
  {
    id: 'prompt-research',
    title: 'Research prompts',
    description: 'Templates still used when Oracle writes or revises research.',
    keys: ['researchGenerate', 'researchRevise'],
  },
];

function buildStyleTestsById(styles: ImageStyle[]): Record<string, StyleTestState> {
  return styles.reduce<Record<string, StyleTestState>>((acc, style) => {
    if (style.lastTestImage?.cleanImageUrl || style.lastTestImage?.previewImageUrl) {
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

function createEmptySectionFeedback(): Record<SettingsSectionId, SectionFeedback> {
  return {
    'tts-voice': { saving: false, error: null, message: null },
    'pause-removal': { saving: false, error: null, message: null },
    'music-library': { saving: false, error: null, message: null },
    'caption-styles': { saving: false, error: null, message: null },
    'background-videos': { saving: false, error: null, message: null },
    'image-templates': { saving: false, error: null, message: null },
    'image-shared-constraints': { saving: false, error: null, message: null },
    'image-styles': { saving: false, error: null, message: null },
    'prompt-hooks': { saving: false, error: null, message: null },
    'prompt-research': { saving: false, error: null, message: null },
    'text-script-prompts': { saving: false, error: null, message: null },
  };
}

function serializeForCompare(value: unknown) {
  return JSON.stringify(value);
}

function pickPromptValues(source: Partial<Record<PromptKey, string>>, keys: PromptKey[]) {
  return keys.reduce<Partial<Record<PromptKey, string>>>((acc, key) => {
    acc[key] = source[key] || '';
    return acc;
  }, {});
}

function createStyleDraft(index: number): ImageStyle {
  return {
    id: `style-${Date.now()}-${index}`,
    name: `New style ${index}`,
    description: '',
    subjectPrompt: 'same androgynous high-fashion model across all scenes, sharp eye area, defined cheekbones, elegant neutral styling',
    stylePrompt:
      'Premium modern social-video aesthetic, cohesive full-frame composition, dramatic but tasteful lighting, minimal clutter.',
    headerPercent: 28,
    testTopic: 'Facial posture reset',
    testCaption: 'Your jawline changes when posture changes',
    testImagePrompt:
      'Single full-frame side-profile portrait in a dark studio, subtle posture cue through neck alignment, natural negative space near the top.',
    references: [],
  };
}

function createVoiceDraft(index: number): VoiceLibraryEntry {
  return {
    id: `voice-${Date.now()}-${index}`,
    name: `New voice ${index}`,
    sourceType: 'generated',
    mode: 'voice-design',
    voiceDesignPrompt:
      'Educated American English narrator with calm authority, polished pacing, natural warmth, and crisp short-form delivery. Speak only English and avoid non-speech sounds.',
    notes: '',
    previewText:
      'Most people think their face shape is fixed, but posture, breathing, and muscular balance change more than you expect. In this lesson, I will walk through the habits that matter most, the mistakes that waste effort, and the small adjustments that create visible changes over time. Keep your shoulders relaxed, your neck long, and your breathing steady as we go step by step.',
  };
}

function createUploadedReferenceVoiceDraft(index: number): VoiceLibraryEntry {
  return {
    id: `voice-upload-${Date.now()}-${index}`,
    name: `Uploaded voice ${index}`,
    sourceType: 'uploaded-reference',
    mode: 'voice-design',
    voiceDesignPrompt: 'Use the uploaded reference clip for voice cloning.',
    notes: '',
    previewText:
      'Most people think their face shape is fixed, but posture, breathing, and muscular balance change more than you expect. In this lesson, I will walk through the habits that matter most, the mistakes that waste effort, and the small adjustments that create visible changes over time. Keep your shoulders relaxed, your neck long, and your breathing steady as we go step by step.',
    referenceText: '',
  };
}

function createMusicDraft(index: number): MusicLibraryEntry {
  return {
    id: `music-${Date.now()}-${index}`,
    name: `New soundtrack ${index}`,
    prompt:
      'instrumental modern short-form social-video underscore, polished and cinematic, no vocals, no spoken voice, no choir',
    notes: '',
    previewDurationSeconds: 12,
  };
}

function createCaptionStyleDraft(index: number): CaptionStyleEntry {
  return {
    id: `caption-style-${Date.now()}-${index}`,
    name: `New caption style ${index}`,
    fontFamily: 'Arial',
    fontWeight: 700,
    fontSize: 72,
    wordSpacing: 0,
    horizontalPadding: 80,
    bottomMargin: 220,
    activeWordColor: '#FFFFFF',
    spokenWordColor: '#D0D0D0',
    upcomingWordColor: '#5E5E5E',
    outlineColor: '#000000',
    outlineWidth: 3.5,
    shadowColor: '#000000',
    shadowStrength: 1.2,
    shadowBlur: 2.2,
    shadowOffsetX: 0,
    shadowOffsetY: 3.4,
    backgroundEnabled: false,
    backgroundColor: '#000000',
    backgroundOpacity: 0.45,
    backgroundPadding: 20,
    backgroundRadius: 24,
    animationPresetId: DEFAULT_CAPTION_ANIMATION_PRESET_ID,
    animationPreset: 'stable-pop',
  };
}

function createAnimationPresetDraft(index: number): AnimationPresetEntry {
  const template = DEFAULT_SHORT_FORM_CAPTION_ANIMATION_PRESETS.find((preset) => preset.id === DEFAULT_CAPTION_ANIMATION_PRESET_ID)
    || DEFAULT_SHORT_FORM_CAPTION_ANIMATION_PRESETS[0];
  return {
    id: `caption-animation-${Date.now()}-${index}`,
    slug: `custom-${Date.now()}-${index}`,
    name: `Custom animation ${index}`,
    description: 'Editable caption animation preset.',
    config: cloneCaptionAnimationConfig(template.config),
  };
}

function buildUniqueAnimationPresetName(presets: AnimationPresetEntry[], baseName: string) {
  let nextName = `${baseName} copy`;
  let suffix = 2;
  const existing = new Set(presets.map((preset) => preset.name.toLowerCase()));
  while (existing.has(nextName.toLowerCase())) {
    nextName = `${baseName} copy ${suffix}`;
    suffix += 1;
  }
  return nextName;
}

function buildUniqueAnimationPresetId(presets: AnimationPresetEntry[], name: string) {
  const base = slugify(name) || 'caption-animation';
  let candidate = base;
  let suffix = 2;
  const existing = new Set(presets.map((preset) => preset.id));
  while (existing.has(candidate)) {
    candidate = `${base}-${suffix}`;
    suffix += 1;
  }
  return candidate;
}

function parseAnimationPresetConfigJson(value: string, fallback: ShortFormCaptionAnimationPresetConfig) {
  try {
    return normalizeCaptionAnimationPresetConfig(JSON.parse(value), fallback);
  } catch {
    return null;
  }
}

function formatAnimationPresetConfigJson(config: ShortFormCaptionAnimationPresetConfig) {
  return JSON.stringify(config, null, 2);
}

function slugify(text: string) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
}

async function parseResponse(response: Response) {
  const payload = (await response.json().catch(() => ({}))) as SettingsResponse;
  if (!response.ok || payload.success === false || !payload.data) {
    throw new Error(payload.error || 'Failed to load short-form workflow settings');
  }
  return payload.data;
}

async function parseStyleTestResponse(response: Response) {
  const payload = (await response.json().catch(() => ({}))) as StyleTestResponse;
  if (!response.ok || payload.success === false || !payload.data) {
    throw new Error(payload.error || 'Failed to generate style test image');
  }
  return payload.data;
}

async function parseTtsPreviewResponse(response: Response) {
  const payload = (await response.json().catch(() => ({}))) as TtsPreviewResponse;
  if (!response.ok || payload.success === false || !payload.data) {
    throw new Error(payload.error || 'Failed to generate saved voice sample');
  }
  return payload.data;
}

function hasSavedVoiceSample(voice: VoiceLibraryEntry | null | undefined) {
  if (!voice?.referenceAudioRelativePath || !voice.referenceText) return false;
  if (voice.sourceType === 'uploaded-reference') return true;
  if (!voice.referencePrompt || !voice.referenceMode) return false;
  if (voice.referencePrompt !== voice.voiceDesignPrompt || voice.referenceMode !== voice.mode) return false;
  if (voice.mode === 'custom-voice' && voice.referenceSpeaker !== voice.speaker) return false;
  return true;
}

function buildSavedVoiceAudioUrl(voice: VoiceLibraryEntry | null | undefined, cacheBust?: number) {
  if (!voice?.referenceAudioRelativePath) return null;
  const encodedPath = voice.referenceAudioRelativePath
    .split('/')
    .filter(Boolean)
    .map((part) => encodeURIComponent(part))
    .join('/');
  const query = cacheBust ? `?v=${cacheBust}` : '';
  return `/api/short-form-videos/settings/voice-library-files/${encodedPath}${query}`;
}

function getVoiceSourceLabel(voice: VoiceLibraryEntry | null | undefined) {
  return voice?.sourceType === 'uploaded-reference' ? 'Uploaded reference' : voice?.mode === 'custom-voice' ? 'Legacy custom voice' : 'Generated VoiceDesign';
}

async function parseMusicPreviewResponse(response: Response) {
  const payload = (await response.json().catch(() => ({}))) as MusicPreviewResponse;
  if (!response.ok || payload.success === false || !payload.data) {
    throw new Error(payload.error || 'Failed to generate saved soundtrack file');
  }
  return payload.data;
}

function hasGeneratedSoundtrack(track: MusicLibraryEntry | null | undefined) {
  if (!track?.generatedAudioRelativePath) return false;
  const expectedDuration = track.previewDurationSeconds || 12;
  return track.generatedPrompt === track.prompt && track.generatedDurationSeconds === expectedDuration;
}

function buildSavedMusicAudioUrl(track: MusicLibraryEntry | null | undefined, cacheBust?: number) {
  if (!track?.generatedAudioRelativePath) return null;
  const encodedPath = track.generatedAudioRelativePath
    .split('/')
    .filter(Boolean)
    .map((part) => encodeURIComponent(part))
    .join('/');
  const query = cacheBust ? `?v=${cacheBust}` : '';
  return `/api/short-form-videos/settings/music-library-files/${encodedPath}${query}`;
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
            ? 'border-amber-500/30 bg-amber-500/10 text-amber-100'
            : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-100'
        }`}
      >
        {dirty ? 'Unsaved changes' : 'Saved'}
      </span>
      <Button variant="outline" size="sm" onClick={onReset} disabled={!dirty || saving}>
        Reset
      </Button>
      <Button size="sm" onClick={onSave} disabled={!dirty || saving}>
        {saving ? 'Saving…' : saveLabel}
      </Button>
    </div>
  );
}

function SectionFeedbackNotice({ feedback }: { feedback: SectionFeedback }) {
  if (feedback.error) {
    return <ValidationNotice title="Section save failed" message={feedback.error} className="mt-4" />;
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
  const decimals = String(step).includes('.') ? String(step).split('.')[1]!.length : 0;
  const rounded = Math.round(value / step) * step;
  return Number(rounded.toFixed(decimals));
}

function formatNumericDraft(value: number, step: number) {
  if (!Number.isFinite(value)) return '';
  const decimals = String(step).includes('.') ? String(step).split('.')[1]!.length : 0;
  if (decimals === 0) return String(Math.round(value));
  return value.toFixed(decimals).replace(/\.0+$/, '').replace(/(\.\d*?)0+$/, '$1');
}

function buildUniqueCaptionStyleName(styles: CaptionStyleEntry[], sourceName: string) {
  const normalized = new Set(styles.map((style) => style.name.trim().toLowerCase()));
  const base = `${sourceName.trim() || 'Caption style'} copy`;
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
  const base = slugify(name) || 'caption-style';
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
    if (!nextRaw || nextRaw === '-' || nextRaw === '.' || nextRaw === '-.') {
      setDraft(formatNumericDraft(value, step));
      return;
    }
    const parsed = Number(nextRaw.replace(',', '.'));
    if (!Number.isFinite(parsed)) {
      setDraft(formatNumericDraft(value, step));
      return;
    }
    const nextValue = Math.max(min, Math.min(max, roundToStep(parsed, step)));
    onChange(nextValue);
    setDraft(formatNumericDraft(nextValue, step));
  };

  const nudge = (direction: -1 | 1) => {
    const nextValue = Math.max(min, Math.min(max, roundToStep(value + (direction * step), step)));
    onChange(nextValue);
    setDraft(formatNumericDraft(nextValue, step));
  };

  return (
    <div className="space-y-2 rounded-lg border border-border bg-background/40 p-3">
      <div className="flex items-center justify-between gap-3">
        <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</label>
        <span className="text-xs font-medium text-foreground">{formatNumericDraft(value, step)}</span>
      </div>
      <div className="flex items-center gap-2">
        <Button type="button" variant="outline" className="h-12 w-12 shrink-0 px-0 text-lg" onClick={() => nudge(-1)}>
          −
        </Button>
        <Input
          type="text"
          inputMode={step < 1 || min < 0 ? 'decimal' : 'numeric'}
          enterKeyHint="done"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={(event) => commit(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              commit(draft);
            }
          }}
          className="h-12 text-center text-base"
          aria-label={label}
        />
        <Button type="button" variant="outline" className="h-12 w-12 shrink-0 px-0 text-lg" onClick={() => nudge(1)}>
          +
        </Button>
      </div>
      {helper ? <p className="text-xs text-muted-foreground">{helper}</p> : null}
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
  const updateKeyframe = (index: number, patch: Partial<ShortFormCaptionAnimationTrack['keyframes'][number]>) => {
    onChange({
      keyframes: track.keyframes.map((frame, frameIndex) => (frameIndex === index ? { ...frame, ...patch } : frame)),
    });
  };

  const removeKeyframe = (index: number) => {
    if (track.keyframes.length <= 2) return;
    onChange({
      keyframes: track.keyframes.filter((_, frameIndex) => frameIndex !== index),
    });
  };

  const addKeyframe = () => {
    const lastFrame = track.keyframes[track.keyframes.length - 1] || { time: 1, value: 0, easing: 'linear' as const };
    onChange({
      keyframes: [...track.keyframes, { ...lastFrame, time: 1, easing: lastFrame.easing || 'linear' }],
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
          <div key={`${label}-${index}-${frame.time}-${frame.value}`} className="grid gap-3 rounded-lg border border-border/70 bg-background/70 p-3 md:grid-cols-[repeat(3,minmax(0,1fr))_auto]">
            <div className="space-y-2">
              <label className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Time</label>
              <Input
                type="number"
                min={0}
                max={1}
                step={0.01}
                value={frame.time}
                onChange={(event) => updateKeyframe(index, { time: Number(event.target.value) })}
              />
            </div>
            <div className="space-y-2">
              <label className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Value</label>
              <Input
                type="number"
                min={min}
                max={max}
                step={step}
                value={frame.value}
                onChange={(event) => updateKeyframe(index, { value: Number(event.target.value) })}
              />
            </div>
            <div className="space-y-2">
              <label className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Easing</label>
              <Select
                value={frame.easing || 'linear'}
                onChange={(event) => updateKeyframe(index, { easing: event.target.value as ShortFormCaptionAnimationEasing })}
              >
                {CAPTION_ANIMATION_EASING_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </Select>
            </div>
            <div className="flex items-end justify-end">
              <Button type="button" variant="outline" size="sm" onClick={() => removeKeyframe(index)} disabled={track.keyframes.length <= 2}>
                Remove
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function ShortFormVideoSettingsPage() {
  const searchParams = useSearchParams();
  const requestedStyleId = searchParams.get('style');

  const [definitions, setDefinitions] = useState<PromptDefinition[]>([]);
  const [prompts, setPrompts] = useState<Partial<Record<PromptKey, string>>>({});
  const [initialPrompts, setInitialPrompts] = useState<Partial<Record<PromptKey, string>>>({});
  const [imageStyles, setImageStyles] = useState<ImageStyleSettings | null>(null);
  const [initialImageStyles, setInitialImageStyles] = useState<ImageStyleSettings | null>(null);
  const [videoRender, setVideoRender] = useState<VideoRenderSettings | null>(null);
  const [initialVideoRender, setInitialVideoRender] = useState<VideoRenderSettings | null>(null);
  const [backgroundVideos, setBackgroundVideos] = useState<BackgroundVideoSettings | null>(null);
  const [initialBackgroundVideos, setInitialBackgroundVideos] = useState<BackgroundVideoSettings | null>(null);
  const [textScriptSettings, setTextScriptSettings] = useState<TextScriptSettings | null>(null);
  const [initialTextScriptSettings, setInitialTextScriptSettings] = useState<TextScriptSettings | null>(null);
  const [selectedStyleId, setSelectedStyleId] = useState<string | null>(null);
  const [selectedVoiceId, setSelectedVoiceId] = useState<string | null>(null);
  const [selectedMusicId, setSelectedMusicId] = useState<string | null>(null);
  const [selectedCaptionStyleId, setSelectedCaptionStyleId] = useState<string | null>(null);
  const [selectedAnimationPresetId, setSelectedAnimationPresetId] = useState<string | null>(null);
  const [animationPresetJsonDraft, setAnimationPresetJsonDraft] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [styleTestsById, setStyleTestsById] = useState<Record<string, StyleTestState>>({});
  const [styleReferenceUploadsById, setStyleReferenceUploadsById] = useState<Record<string, StyleReferenceUploadState>>({});
  const [voiceReferenceUploadsById, setVoiceReferenceUploadsById] = useState<Record<string, VoiceReferenceUploadState>>({});
  const [backgroundVideoUpload, setBackgroundVideoUpload] = useState<BackgroundVideoUploadState>({ isUploading: false, error: null });
  const [sectionFeedback, setSectionFeedback] = useState<Record<SettingsSectionId, SectionFeedback>>(createEmptySectionFeedback());
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

  usePageScrollRestoration('short-form-video-settings', !loading);

  useEffect(() => {
    void loadSettings();
  }, []);

  useEffect(() => {
    if (!imageStyles || imageStyles.styles.length === 0) return;
    if (requestedStyleId && imageStyles.styles.some((style) => style.id === requestedStyleId)) {
      setSelectedStyleId(requestedStyleId);
      return;
    }
    if (!selectedStyleId || !imageStyles.styles.some((style) => style.id === selectedStyleId)) {
      setSelectedStyleId(imageStyles.defaultStyleId || imageStyles.styles[0]?.id || null);
    }
  }, [imageStyles, requestedStyleId, selectedStyleId]);

  useEffect(() => {
    if (!videoRender || videoRender.voices.length === 0) return;
    if (!selectedVoiceId || !videoRender.voices.some((voice) => voice.id === selectedVoiceId)) {
      setSelectedVoiceId(videoRender.defaultVoiceId || videoRender.voices[0]?.id || null);
    }
  }, [selectedVoiceId, videoRender]);

  useEffect(() => {
    if (!videoRender || videoRender.musicTracks.length === 0) return;
    if (!selectedMusicId || !videoRender.musicTracks.some((track) => track.id === selectedMusicId)) {
      setSelectedMusicId(videoRender.defaultMusicTrackId || videoRender.musicTracks[0]?.id || null);
    }
  }, [selectedMusicId, videoRender]);

  useEffect(() => {
    if (!videoRender || videoRender.captionStyles.length === 0) return;
    if (!selectedCaptionStyleId || !videoRender.captionStyles.some((style) => style.id === selectedCaptionStyleId)) {
      setSelectedCaptionStyleId(videoRender.defaultCaptionStyleId || videoRender.captionStyles[0]?.id || null);
    }
  }, [selectedCaptionStyleId, videoRender]);

  useEffect(() => {
    if (!videoRender || videoRender.animationPresets.length === 0) return;
    if (!selectedAnimationPresetId || !videoRender.animationPresets.some((preset) => preset.id === selectedAnimationPresetId)) {
      setSelectedAnimationPresetId(videoRender.animationPresets[0]?.id || null);
    }
  }, [selectedAnimationPresetId, videoRender]);

  async function loadSettings() {
    setLoading(true);
    setError(null);

    try {
      const data = await parseResponse(await fetch('/api/short-form-videos/settings'));
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
      setSelectedStyleId((current) => current || data.imageStyles.defaultStyleId || data.imageStyles.styles[0]?.id || null);
      setSelectedVoiceId((current) => current || data.videoRender.defaultVoiceId || data.videoRender.voices[0]?.id || null);
      setSelectedMusicId((current) => current || data.videoRender.defaultMusicTrackId || data.videoRender.musicTracks[0]?.id || null);
      setSelectedCaptionStyleId((current) => current || data.videoRender.defaultCaptionStyleId || data.videoRender.captionStyles[0]?.id || null);
      setSelectedAnimationPresetId((current) => current || data.videoRender.animationPresets[0]?.id || null);
      setStyleTestsById(buildStyleTestsById(data.imageStyles.styles));
      setSectionFeedback(createEmptySectionFeedback());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load short-form workflow settings');
    } finally {
      setLoading(false);
    }
  }

  const promptDefinitionsByKey = useMemo(
    () => Object.fromEntries(definitions.map((definition) => [definition.key, definition])) as Record<PromptKey, PromptDefinition>,
    [definitions]
  );

  const selectedStyle = useMemo(
    () => imageStyles?.styles.find((style) => style.id === selectedStyleId) || null,
    [imageStyles, selectedStyleId]
  );
  const selectedVoice = useMemo(
    () => videoRender?.voices.find((voice) => voice.id === selectedVoiceId) || null,
    [selectedVoiceId, videoRender]
  );
  const selectedMusic = useMemo(
    () => videoRender?.musicTracks.find((track) => track.id === selectedMusicId) || null,
    [selectedMusicId, videoRender]
  );
  const selectedCaptionStyle = useMemo(
    () => videoRender?.captionStyles.find((style) => style.id === selectedCaptionStyleId) || null,
    [selectedCaptionStyleId, videoRender]
  );
  const selectedAnimationPreset = useMemo(
    () => videoRender?.animationPresets.find((preset) => preset.id === selectedAnimationPresetId) || null,
    [selectedAnimationPresetId, videoRender]
  );
  const selectedCaptionStyleAnimationPreset = useMemo(
    () => videoRender && selectedCaptionStyle
      ? getCaptionAnimationPresetById(videoRender.animationPresets, selectedCaptionStyle.animationPresetId)
      : null,
    [selectedCaptionStyle, videoRender]
  );
  const savedVoiceAudioUrl = useMemo(() => {
    if (ttsPreview.audioUrl) return ttsPreview.audioUrl;
    if (!selectedVoice) return null;
    const cacheBust = selectedVoice.referenceGeneratedAt ? Date.parse(selectedVoice.referenceGeneratedAt) : undefined;
    return buildSavedVoiceAudioUrl(selectedVoice, typeof cacheBust === 'number' && Number.isFinite(cacheBust) ? cacheBust : undefined);
  }, [selectedVoice, ttsPreview.audioUrl]);
  const savedMusicAudioUrl = useMemo(() => {
    if (musicPreview.audioUrl) return musicPreview.audioUrl;
    if (!selectedMusic) return null;
    const cacheBust = selectedMusic.generatedAt ? Date.parse(selectedMusic.generatedAt) : undefined;
    return buildSavedMusicAudioUrl(selectedMusic, typeof cacheBust === 'number' && Number.isFinite(cacheBust) ? cacheBust : undefined);
  }, [musicPreview.audioUrl, selectedMusic]);
  const selectedStyleTest = selectedStyle ? styleTestsById[selectedStyle.id] : undefined;
  const selectedStyleUpload = selectedStyle ? styleReferenceUploadsById[selectedStyle.id] : undefined;
  const selectedVoiceUpload = selectedVoice ? voiceReferenceUploadsById[selectedVoice.id] : undefined;
  const anyStyleTesting = useMemo(
    () => Object.values(styleTestsById).some((styleTest) => styleTest.isLoading),
    [styleTestsById]
  );
  const anySectionSaving = useMemo(
    () => Object.values(sectionFeedback).some((section) => section.saving),
    [sectionFeedback]
  );

  useEffect(() => {
    if (!selectedAnimationPreset) return;
    setAnimationPresetJsonDraft(formatAnimationPresetConfigJson(selectedAnimationPreset.config));
  }, [selectedAnimationPreset]);

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

  const dirtyBySection = useMemo<Record<SettingsSectionId, boolean>>(() => {
    const imageTemplateDirty = imageStyles && initialImageStyles
      ? serializeForCompare(imageStyles.promptTemplates) !== serializeForCompare(initialImageStyles.promptTemplates)
      : false;
    const imageSharedDirty = imageStyles && initialImageStyles
      ? (imageStyles.commonConstraints || '') !== (initialImageStyles.commonConstraints || '')
      : false;
    const imageStyleLibraryDirty = imageStyles && initialImageStyles
      ? serializeForCompare({ styles: imageStyles.styles, defaultStyleId: imageStyles.defaultStyleId }) !==
        serializeForCompare({ styles: initialImageStyles.styles, defaultStyleId: initialImageStyles.defaultStyleId })
      : false;
    const ttsDirty = videoRender && initialVideoRender
      ? serializeForCompare({ voices: videoRender.voices, defaultVoiceId: videoRender.defaultVoiceId }) !==
        serializeForCompare({ voices: initialVideoRender.voices, defaultVoiceId: initialVideoRender.defaultVoiceId })
      : false;
    const musicDirty = videoRender && initialVideoRender
      ? serializeForCompare({
          musicTracks: videoRender.musicTracks,
          defaultMusicTrackId: videoRender.defaultMusicTrackId,
          musicVolume: videoRender.musicVolume,
          captionMaxWords: videoRender.captionMaxWords,
        }) !== serializeForCompare({
          musicTracks: initialVideoRender.musicTracks,
          defaultMusicTrackId: initialVideoRender.defaultMusicTrackId,
          musicVolume: initialVideoRender.musicVolume,
          captionMaxWords: initialVideoRender.captionMaxWords,
        })
      : false;
    const captionStylesDirty = videoRender && initialVideoRender
      ? serializeForCompare({
          animationPresets: videoRender.animationPresets,
          captionStyles: videoRender.captionStyles,
          defaultCaptionStyleId: videoRender.defaultCaptionStyleId,
        }) !== serializeForCompare({
          animationPresets: initialVideoRender.animationPresets,
          captionStyles: initialVideoRender.captionStyles,
          defaultCaptionStyleId: initialVideoRender.defaultCaptionStyleId,
        })
      : false;
    const pauseRemovalDirty = videoRender && initialVideoRender
      ? serializeForCompare(videoRender.pauseRemoval) !== serializeForCompare(initialVideoRender.pauseRemoval)
      : false;
    const backgroundVideosDirty = backgroundVideos && initialBackgroundVideos
      ? serializeForCompare(backgroundVideos) !== serializeForCompare(initialBackgroundVideos)
      : false;
    const textScriptPromptsDirty = textScriptSettings && initialTextScriptSettings
      ? serializeForCompare(textScriptSettings) !== serializeForCompare(initialTextScriptSettings)
      : false;

    const promptGroupDirty = Object.fromEntries(
      PROMPT_GROUPS.map((group) => [
        group.id,
        serializeForCompare(pickPromptValues(prompts, group.keys)) !== serializeForCompare(pickPromptValues(initialPrompts, group.keys)),
      ])
    ) as Record<'prompt-hooks' | 'prompt-research', boolean>;

    return {
      'tts-voice': ttsDirty,
      'pause-removal': pauseRemovalDirty,
      'music-library': musicDirty,
      'caption-styles': captionStylesDirty,
      'background-videos': backgroundVideosDirty,
      'image-templates': imageTemplateDirty,
      'image-shared-constraints': imageSharedDirty,
      'image-styles': imageStyleLibraryDirty,
      'prompt-hooks': promptGroupDirty['prompt-hooks'],
      'prompt-research': promptGroupDirty['prompt-research'],
      'text-script-prompts': textScriptPromptsDirty,
    };
  }, [backgroundVideos, imageStyles, initialBackgroundVideos, initialImageStyles, initialPrompts, initialTextScriptSettings, initialVideoRender, prompts, textScriptSettings, videoRender]);

  const sections = useMemo(
    () => [
      { id: 'prompt-hooks' as const, label: 'Hook prompts', dirty: dirtyBySection['prompt-hooks'] },
      { id: 'prompt-research' as const, label: 'Research prompts', dirty: dirtyBySection['prompt-research'] },
      { id: 'text-script-prompts' as const, label: 'Text-script prompts', dirty: dirtyBySection['text-script-prompts'] },
      { id: 'tts-voice' as const, label: 'Voice library', dirty: dirtyBySection['tts-voice'] },
      { id: 'pause-removal' as const, label: 'Pause removal', dirty: dirtyBySection['pause-removal'] },
      { id: 'caption-styles' as const, label: 'Caption styles', dirty: dirtyBySection['caption-styles'] },
      { id: 'image-templates' as const, label: 'Nano Banana templates', dirty: dirtyBySection['image-templates'] },
      { id: 'image-shared-constraints' as const, label: 'Shared image constraints', dirty: dirtyBySection['image-shared-constraints'] },
      { id: 'image-styles' as const, label: 'Image style library', dirty: dirtyBySection['image-styles'] },
      { id: 'background-videos' as const, label: 'Background videos', dirty: dirtyBySection['background-videos'] },
      { id: 'music-library' as const, label: 'Music library', dirty: dirtyBySection['music-library'] },
    ],
    [dirtyBySection]
  );
  const activeSection = useSectionScrollSpy(sections);

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
              status={dirty ? 'needs review' : 'approved'}
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
                <div key={key} className="space-y-2 border-t border-border pt-4 first:border-t-0 first:pt-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-sm font-medium text-foreground">{definition?.title || key}</h3>
                    {definition?.stage ? (
                      <span className="rounded-full border border-border px-2 py-0.5 text-[11px] uppercase tracking-wide text-muted-foreground">
                        {definition.stage}
                      </span>
                    ) : null}
                  </div>
                  {definition?.description ? <p className="text-sm text-muted-foreground">{definition.description}</p> : null}
                  <Textarea
                    value={prompts[key] || ''}
                    onChange={(event) => {
                      updateSectionFeedbackState(group.id, { error: null, message: null });
                      setPrompts((current) => ({ ...current, [key]: event.target.value }));
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
            status={dirtyBySection['text-script-prompts'] ? 'needs review' : 'approved'}
          />
          <SectionActions
            dirty={dirtyBySection['text-script-prompts']}
            saving={sectionFeedback['text-script-prompts'].saving}
            saveLabel="Save text-script prompts"
            onSave={() => void saveSection('text-script-prompts')}
            onReset={() => resetSection('text-script-prompts')}
          />
        </div>

        {textScriptSettings ? (
          <div className="space-y-6">
            <div className="space-y-2">
              <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Default max draft iterations</label>
              <Input
                type="number"
                min={1}
                max={8}
                value={textScriptSettings.defaultMaxIterations}
                onChange={(event) => {
                  updateSectionFeedbackState('text-script-prompts', { error: null, message: null });
                  setTextScriptSettings({
                    ...textScriptSettings,
                    defaultMaxIterations: Math.max(1, Math.min(8, Number(event.target.value) || 1)),
                  });
                }}
                className="max-w-xs"
              />
              <p className="text-xs text-muted-foreground">
                New short-form projects can optionally override this per project from the Text Script section, but this is the dashboard-wide default.
              </p>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Full generate prompt template</label>
              <Textarea
                value={textScriptSettings.generatePrompt}
                onChange={(event) => {
                  updateSectionFeedbackState('text-script-prompts', { error: null, message: null });
                  setTextScriptSettings({ ...textScriptSettings, generatePrompt: event.target.value });
                }}
                className="min-h-[280px] font-mono text-xs"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Full revise prompt template</label>
              <Textarea
                value={textScriptSettings.revisePrompt}
                onChange={(event) => {
                  updateSectionFeedbackState('text-script-prompts', { error: null, message: null });
                  setTextScriptSettings({ ...textScriptSettings, revisePrompt: event.target.value });
                }}
                className="min-h-[320px] font-mono text-xs"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Full review prompt template</label>
              <Textarea
                value={textScriptSettings.reviewPrompt}
                onChange={(event) => {
                  updateSectionFeedbackState('text-script-prompts', { error: null, message: null });
                  setTextScriptSettings({ ...textScriptSettings, reviewPrompt: event.target.value });
                }}
                className="min-h-[300px] font-mono text-xs"
              />
              <div className="space-y-1 text-xs text-muted-foreground">
                <p>
                  These templates support runtime placeholders such as{' '}
                  <code>{'{{topic}}'}</code>, <code>{'{{selectedHookTextOrFallback}}'}</code>, <code>{'{{approvedResearch}}'}</code>,{' '}
                  <code>{'{{draftPath}}'}</code>, <code>{'{{reviewPath}}'}</code>, <code>{'{{runManifestPath}}'}</code>,{' '}
                  <code>{'{{iterationNumber}}'}</code>, <code>{'{{maxIterations}}'}</code>,{' '}
                  <code>{'{{revisionInstructionLine}}'}</code>, <code>{'{{priorDraftBlock}}'}</code>,{' '}
                  <code>{'{{priorReviewBlock}}'}</code>, <code>{'{{retentionSkillPath}}'}</code>,{' '}
                  <code>{'{{retentionPlaybookPath}}'}</code>, <code>{'{{graderSkillPath}}'}</code>,{' '}
                  <code>{'{{graderRubricPath}}'}</code>, <code>{'{{passingScore}}'}</code>, and{' '}
                  <code>{'{{draftBody}}'}</code>.
                </p>
                <p>Keep each field as the complete top-level Scribe prompt for that loop step. If you change artifact instructions or placeholder names here, the runtime behavior will change accordingly.</p>
              </div>
            </div>
          </div>
        ) : null}

        <SectionFeedbackNotice feedback={sectionFeedback['text-script-prompts']} />
      </Card>
    </section>
  );

  function updateSectionFeedbackState(sectionId: SettingsSectionId, patch: Partial<SectionFeedback>) {
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
    updateSectionFeedbackState('image-styles', { error: null, message: null });
    setImageStyles({
      ...imageStyles,
      styles: imageStyles.styles.map((style) => (style.id === selectedStyle.id ? updater(style) : style)),
    });
  }

  function updateStyleReference(referenceId: string, updater: (reference: StyleReferenceImage) => StyleReferenceImage) {
    updateSelectedStyle((style) => ({
      ...style,
      references: (style.references || []).map((reference) =>
        reference.id === referenceId ? updater(reference) : reference
      ),
    }));
  }

  function removeStyleReference(referenceId: string) {
    updateSelectedStyle((style) => ({
      ...style,
      references: (style.references || []).filter((reference) => reference.id !== referenceId),
    }));
  }

  function mergeSavedSection(sectionId: SettingsSectionId, data: NonNullable<SettingsResponse['data']>) {
    setDefinitions(data.definitions);

    if (sectionId === 'tts-voice' || sectionId === 'music-library' || sectionId === 'pause-removal' || sectionId === 'caption-styles') {
      setVideoRender(data.videoRender);
      setInitialVideoRender(data.videoRender);
      setSelectedVoiceId((current) => {
        if (current && data.videoRender.voices.some((voice) => voice.id === current)) return current;
        return data.videoRender.defaultVoiceId || data.videoRender.voices[0]?.id || null;
      });
      setSelectedMusicId((current) => {
        if (current && data.videoRender.musicTracks.some((track) => track.id === current)) return current;
        return data.videoRender.defaultMusicTrackId || data.videoRender.musicTracks[0]?.id || null;
      });
      setSelectedCaptionStyleId((current) => {
        if (current && data.videoRender.captionStyles.some((style) => style.id === current)) return current;
        return data.videoRender.defaultCaptionStyleId || data.videoRender.captionStyles[0]?.id || null;
      });
      return;
    }

    if (sectionId === 'background-videos') {
      setBackgroundVideos(data.backgroundVideos);
      setInitialBackgroundVideos(data.backgroundVideos);
      return;
    }

    if (sectionId === 'text-script-prompts') {
      setTextScriptSettings(data.textScript);
      setInitialTextScriptSettings(data.textScript);
      return;
    }

    if (sectionId === 'image-templates') {
      setImageStyles((current) =>
        current ? { ...current, promptTemplates: data.imageStyles.promptTemplates } : data.imageStyles
      );
      setInitialImageStyles((current) =>
        current ? { ...current, promptTemplates: data.imageStyles.promptTemplates } : data.imageStyles
      );
      return;
    }

    if (sectionId === 'image-shared-constraints') {
      setImageStyles((current) =>
        current ? { ...current, commonConstraints: data.imageStyles.commonConstraints } : data.imageStyles
      );
      setInitialImageStyles((current) =>
        current ? { ...current, commonConstraints: data.imageStyles.commonConstraints } : data.imageStyles
      );
      return;
    }

    if (sectionId === 'image-styles') {
      setImageStyles((current) =>
        current
          ? { ...current, styles: data.imageStyles.styles, defaultStyleId: data.imageStyles.defaultStyleId }
          : data.imageStyles
      );
      setInitialImageStyles((current) =>
        current
          ? { ...current, styles: data.imageStyles.styles, defaultStyleId: data.imageStyles.defaultStyleId }
          : data.imageStyles
      );
      setStyleTestsById((current) => ({ ...current, ...buildStyleTestsById(data.imageStyles.styles) }));
      setSelectedStyleId((current) => {
        const nextStyles = data.imageStyles.styles;
        if (current && nextStyles.some((style) => style.id === current)) return current;
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
      case 'tts-voice':
        return videoRender
          ? {
              videoRender: {
                voices: videoRender.voices,
                defaultVoiceId: videoRender.defaultVoiceId,
              },
            }
          : null;
      case 'pause-removal':
        return videoRender
          ? {
              videoRender: {
                pauseRemoval: videoRender.pauseRemoval,
              },
            }
          : null;
      case 'music-library':
        return videoRender
          ? {
              videoRender: {
                musicTracks: videoRender.musicTracks,
                defaultMusicTrackId: videoRender.defaultMusicTrackId,
                musicVolume: videoRender.musicVolume,
                captionMaxWords: videoRender.captionMaxWords,
              },
            }
          : null;
      case 'caption-styles':
        return videoRender
          ? {
              videoRender: {
                animationPresets: videoRender.animationPresets,
                captionStyles: videoRender.captionStyles,
                defaultCaptionStyleId: videoRender.defaultCaptionStyleId,
              },
            }
          : null;
      case 'background-videos':
        return backgroundVideos ? { backgroundVideos } : null;
      case 'text-script-prompts':
        return textScriptSettings ? { textScript: textScriptSettings } : null;
      case 'image-templates':
        return imageStyles ? { imageStyles: { promptTemplates: imageStyles.promptTemplates } } : null;
      case 'image-shared-constraints':
        return imageStyles ? { imageStyles: { commonConstraints: imageStyles.commonConstraints } } : null;
      case 'image-styles':
        return imageStyles ? { imageStyles: { styles: imageStyles.styles, defaultStyleId: imageStyles.defaultStyleId } } : null;
      default: {
        const promptGroup = PROMPT_GROUPS.find((group) => group.id === sectionId);
        return promptGroup ? { prompts: pickPromptValues(prompts, promptGroup.keys) } : null;
      }
    }
  }

  async function saveSection(sectionId: SettingsSectionId) {
    const payload = buildSectionSavePayload(sectionId);
    if (!payload) return null;

    updateSectionFeedbackState(sectionId, { saving: true, error: null, message: null });

    try {
      const data = await parseResponse(
        await fetch('/api/short-form-videos/settings', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
      );
      mergeSavedSection(sectionId, data);
      updateSectionFeedbackState(sectionId, {
        saving: false,
        error: null,
        message:
          sectionId === 'tts-voice'
            ? 'Saved. New XML narration runs will now reuse this voice library, including any saved voice samples.'
            : sectionId === 'pause-removal'
              ? 'Saved. New narration timing runs now use these global pause-removal defaults unless a project override is set.'
              : sectionId === 'music-library'
                ? 'Saved. New final-video runs will now reuse this soundtrack library, including any generated soundtrack files.'
                : sectionId === 'caption-styles'
                  ? 'Saved. New final-video runs will use this caption-style library/default immediately.'
                  : sectionId === 'background-videos'
                    ? 'Saved. Projects now use this background-video library/default immediately.'
                    : sectionId === 'image-templates' || sectionId === 'image-shared-constraints' || sectionId === 'image-styles'
                      ? 'Saved. New scene-image runs and tests will use this section immediately.'
                      : sectionId === 'text-script-prompts'
                        ? 'Saved. New text-script runs will use these full Scribe prompt templates and the default max-iteration limit immediately.'
                        : 'Saved. New workflow runs will use this prompt section immediately.',
      });
      return data;
    } catch (err) {
      updateSectionFeedbackState(sectionId, {
        saving: false,
        error: err instanceof Error ? err.message : 'Failed to save section',
        message: null,
      });
      throw err;
    }
  }

  function resetSection(sectionId: SettingsSectionId) {
    if (!dirtyBySection[sectionId]) return;
    const confirmed = window.confirm('Discard unsaved changes for this section?');
    if (!confirmed) return;

    updateSectionFeedbackState(sectionId, { error: null, message: null });

    if ((sectionId === 'tts-voice' || sectionId === 'music-library' || sectionId === 'pause-removal' || sectionId === 'caption-styles') && initialVideoRender && videoRender) {
      if (sectionId === 'tts-voice') {
        setVideoRender({
          ...videoRender,
          voices: initialVideoRender.voices,
          defaultVoiceId: initialVideoRender.defaultVoiceId,
        });
        setSelectedVoiceId(initialVideoRender.defaultVoiceId || initialVideoRender.voices[0]?.id || null);
        return;
      }

      if (sectionId === 'pause-removal') {
        setVideoRender({
          ...videoRender,
          pauseRemoval: initialVideoRender.pauseRemoval,
        });
        return;
      }

      if (sectionId === 'caption-styles') {
        setVideoRender({
          ...videoRender,
          animationPresets: initialVideoRender.animationPresets,
          captionStyles: initialVideoRender.captionStyles,
          defaultCaptionStyleId: initialVideoRender.defaultCaptionStyleId,
        });
        setSelectedCaptionStyleId(initialVideoRender.defaultCaptionStyleId || initialVideoRender.captionStyles[0]?.id || null);
        setSelectedAnimationPresetId(initialVideoRender.animationPresets[0]?.id || null);
        return;
      }

      setVideoRender({
        ...videoRender,
        musicTracks: initialVideoRender.musicTracks,
        defaultMusicTrackId: initialVideoRender.defaultMusicTrackId,
        musicVolume: initialVideoRender.musicVolume,
        captionMaxWords: initialVideoRender.captionMaxWords,
      });
      setSelectedMusicId(initialVideoRender.defaultMusicTrackId || initialVideoRender.musicTracks[0]?.id || null);
      return;
    }

    if (sectionId === 'background-videos' && initialBackgroundVideos) {
      setBackgroundVideos(initialBackgroundVideos);
      return;
    }

    if (sectionId === 'text-script-prompts' && initialTextScriptSettings) {
      setTextScriptSettings(initialTextScriptSettings);
      return;
    }

    if (sectionId === 'image-templates' && imageStyles && initialImageStyles) {
      setImageStyles({ ...imageStyles, promptTemplates: initialImageStyles.promptTemplates });
      return;
    }

    if (sectionId === 'image-shared-constraints' && imageStyles && initialImageStyles) {
      setImageStyles({ ...imageStyles, commonConstraints: initialImageStyles.commonConstraints });
      return;
    }

    if (sectionId === 'image-styles' && imageStyles && initialImageStyles) {
      setImageStyles({
        ...imageStyles,
        styles: initialImageStyles.styles,
        defaultStyleId: initialImageStyles.defaultStyleId,
      });
      setSelectedStyleId((current) => {
        if (current && initialImageStyles.styles.some((style) => style.id === current)) return current;
        return initialImageStyles.defaultStyleId || initialImageStyles.styles[0]?.id || null;
      });
      setStyleTestsById((current) => ({ ...current, ...buildStyleTestsById(initialImageStyles.styles) }));
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
    updateSectionFeedbackState('image-styles', { error: null, message: null });

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('styleId', styleId);
      formData.append('label', file.name);

      const response = await fetch('/api/short-form-videos/settings/style-references/upload', {
        method: 'POST',
        body: formData,
      });
      const payload = (await response.json().catch(() => ({}))) as {
        success?: boolean;
        data?: { imageRelativePath: string; imageUrl?: string; uploadedAt?: string };
        error?: string;
      };

      if (!response.ok || payload.success === false || !payload.data) {
        throw new Error(payload.error || 'Failed to upload reference image');
      }

      updateSelectedStyle((style) => ({
        ...style,
        references: [
          ...(style.references || []),
          {
            id: `ref-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            label: file.name.replace(/\.[^.]+$/, ''),
            usageType: 'general',
            usageInstructions: 'Use this as supporting visual context where relevant.',
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
          error: err instanceof Error ? err.message : 'Failed to upload reference image',
        },
      }));
    }
  }

  function addStyle() {
    if (!imageStyles) return;
    updateSectionFeedbackState('image-styles', { error: null, message: null });
    const nextStyle = createStyleDraft(imageStyles.styles.length + 1);
    const dedupedId = `${slugify(nextStyle.name) || 'style'}-${Date.now()}`;
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
    updateSectionFeedbackState('image-styles', { error: null, message: null });
    const remaining = imageStyles.styles.filter((style) => style.id !== styleId);
    const nextDefault = imageStyles.defaultStyleId === styleId ? remaining[0].id : imageStyles.defaultStyleId;
    setImageStyles({
      ...imageStyles,
      defaultStyleId: nextDefault,
      styles: remaining,
    });
    setSelectedStyleId(remaining[0]?.id || null);
    clearStyleTest(styleId);
  }

  function updateSelectedVoice(updater: (voice: VoiceLibraryEntry) => VoiceLibraryEntry) {
    if (!videoRender || !selectedVoice) return;
    updateSectionFeedbackState('tts-voice', { error: null, message: null });
    setVideoRender({
      ...videoRender,
      voices: videoRender.voices.map((voice) => (voice.id === selectedVoice.id ? updater(voice) : voice)),
    });
  }

  async function uploadReferenceVoice(file: File) {
    if (!selectedVoiceId) return;

    setVoiceReferenceUploadsById((current) => ({
      ...current,
      [selectedVoiceId]: { isUploading: true, error: null },
    }));
    updateSectionFeedbackState('tts-voice', { error: null, message: null });

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('voiceId', selectedVoiceId);

      const response = await fetch('/api/short-form-videos/settings/voice-library/upload', {
        method: 'POST',
        body: formData,
      });
      const payload = (await response.json().catch(() => ({}))) as VoiceReferenceUploadResponse;

      if (!response.ok || payload.success === false || !payload.data?.referenceAudioRelativePath) {
        throw new Error(payload.error || 'Failed to upload reference voice');
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
              sourceType: 'uploaded-reference',
              referenceAudioRelativePath: payload.data!.referenceAudioRelativePath,
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
      updateSectionFeedbackState('tts-voice', {
        saving: false,
        error: null,
        message: 'Uploaded a reference clip. Update the transcript if needed, then save the voice library so projects can reuse this exact audio.',
      });
    } catch (err) {
      setVoiceReferenceUploadsById((current) => ({
        ...current,
        [selectedVoiceId]: {
          isUploading: false,
          error: err instanceof Error ? err.message : 'Failed to upload reference voice',
        },
      }));
    }
  }

  function addVoice() {
    if (!videoRender) return;
    updateSectionFeedbackState('tts-voice', { error: null, message: null });
    const nextVoice = createVoiceDraft(videoRender.voices.length + 1);
    const dedupedId = `${slugify(nextVoice.name) || 'voice'}-${Date.now()}`;
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
    updateSectionFeedbackState('tts-voice', { error: null, message: null });
    const nextVoice = createUploadedReferenceVoiceDraft(videoRender.voices.length + 1);
    const dedupedId = `${slugify(nextVoice.name) || 'uploaded-voice'}-${Date.now()}`;
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
    updateSectionFeedbackState('tts-voice', { error: null, message: null });
    const remaining = videoRender.voices.filter((voice) => voice.id !== voiceId);
    const nextDefault = videoRender.defaultVoiceId === voiceId ? remaining[0].id : videoRender.defaultVoiceId;
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

  function updateSelectedMusic(updater: (track: MusicLibraryEntry) => MusicLibraryEntry) {
    if (!videoRender || !selectedMusic) return;
    updateSectionFeedbackState('music-library', { error: null, message: null });
    setVideoRender({
      ...videoRender,
      musicTracks: videoRender.musicTracks.map((track) => (track.id === selectedMusic.id ? updater(track) : track)),
    });
  }

  function updateSelectedCaptionStyle(updater: (style: CaptionStyleEntry) => CaptionStyleEntry) {
    if (!videoRender || !selectedCaptionStyle) return;
    updateSectionFeedbackState('caption-styles', { error: null, message: null });
    setVideoRender({
      ...videoRender,
      captionStyles: videoRender.captionStyles.map((style) => (style.id === selectedCaptionStyle.id ? updater(style) : style)),
    });
  }

  function updateSelectedAnimationPreset(updater: (preset: AnimationPresetEntry) => AnimationPresetEntry) {
    if (!videoRender || !selectedAnimationPreset) return;
    updateSectionFeedbackState('caption-styles', { error: null, message: null });
    setVideoRender({
      ...videoRender,
      animationPresets: videoRender.animationPresets.map((preset) => (preset.id === selectedAnimationPreset.id ? updater(preset) : preset)),
    });
  }

  function addAnimationPreset() {
    if (!videoRender) return;
    updateSectionFeedbackState('caption-styles', { error: null, message: null });
    const nextPreset = createAnimationPresetDraft(videoRender.animationPresets.length + 1);
    nextPreset.id = buildUniqueAnimationPresetId(videoRender.animationPresets, nextPreset.name);
    setVideoRender({
      ...videoRender,
      animationPresets: [...videoRender.animationPresets, nextPreset],
    });
    setSelectedAnimationPresetId(nextPreset.id);
  }

  function duplicateAnimationPreset(presetId: string) {
    if (!videoRender) return;
    const source = videoRender.animationPresets.find((preset) => preset.id === presetId);
    if (!source) return;
    updateSectionFeedbackState('caption-styles', { error: null, message: null });
    const name = buildUniqueAnimationPresetName(videoRender.animationPresets, source.name);
    const duplicate: AnimationPresetEntry = {
      ...source,
      id: buildUniqueAnimationPresetId(videoRender.animationPresets, name),
      slug: `${slugify(name) || 'caption-animation'}-${Date.now()}`,
      name,
      builtIn: false,
      config: cloneCaptionAnimationConfig(source.config),
    };
    const sourceIndex = videoRender.animationPresets.findIndex((preset) => preset.id === presetId);
    const nextPresets = [...videoRender.animationPresets];
    nextPresets.splice(sourceIndex + 1, 0, duplicate);
    setVideoRender({
      ...videoRender,
      animationPresets: nextPresets,
    });
    setSelectedAnimationPresetId(duplicate.id);
  }

  function deleteAnimationPreset(presetId: string) {
    if (!videoRender || videoRender.animationPresets.length <= 1) return;
    updateSectionFeedbackState('caption-styles', { error: null, message: null });
    const remaining = videoRender.animationPresets.filter((preset) => preset.id !== presetId);
    const fallbackPreset = getCaptionAnimationPresetById(
      remaining,
      selectedCaptionStyle?.animationPresetId && selectedCaptionStyle.animationPresetId !== presetId ? selectedCaptionStyle.animationPresetId : undefined,
      DEFAULT_CAPTION_ANIMATION_PRESET_ID,
    );
    setVideoRender({
      ...videoRender,
      animationPresets: remaining,
      captionStyles: videoRender.captionStyles.map((style) => style.animationPresetId === presetId
        ? { ...style, animationPresetId: fallbackPreset.id, animationPreset: fallbackPreset.slug }
        : style),
    });
    setSelectedAnimationPresetId(fallbackPreset.id);
  }

  function addCaptionStyle() {
    if (!videoRender) return;
    updateSectionFeedbackState('caption-styles', { error: null, message: null });
    const nextStyle = createCaptionStyleDraft(videoRender.captionStyles.length + 1);
    const dedupedId = `${slugify(nextStyle.name) || 'caption-style'}-${Date.now()}`;
    nextStyle.id = dedupedId;
    setVideoRender({
      ...videoRender,
      defaultCaptionStyleId: videoRender.defaultCaptionStyleId || dedupedId,
      captionStyles: [...videoRender.captionStyles, nextStyle],
    });
    setSelectedCaptionStyleId(dedupedId);
  }

  function duplicateCaptionStyle(styleId: string) {
    if (!videoRender) return;
    const source = videoRender.captionStyles.find((style) => style.id === styleId);
    if (!source) return;
    updateSectionFeedbackState('caption-styles', { error: null, message: null });
    const name = buildUniqueCaptionStyleName(videoRender.captionStyles, source.name);
    const duplicated: CaptionStyleEntry = {
      ...source,
      id: buildUniqueCaptionStyleId(videoRender.captionStyles, name),
      name,
    };
    const sourceIndex = videoRender.captionStyles.findIndex((style) => style.id === styleId);
    const nextStyles = [...videoRender.captionStyles];
    nextStyles.splice(sourceIndex + 1, 0, duplicated);
    setVideoRender({
      ...videoRender,
      captionStyles: nextStyles,
    });
    setSelectedCaptionStyleId(duplicated.id);
  }

  function deleteCaptionStyle(styleId: string) {
    if (!videoRender || videoRender.captionStyles.length <= 1) return;
    updateSectionFeedbackState('caption-styles', { error: null, message: null });
    const remaining = videoRender.captionStyles.filter((style) => style.id !== styleId);
    const nextDefault = videoRender.defaultCaptionStyleId === styleId ? remaining[0].id : videoRender.defaultCaptionStyleId;
    setVideoRender({
      ...videoRender,
      defaultCaptionStyleId: nextDefault,
      captionStyles: remaining,
    });
    setSelectedCaptionStyleId(remaining[0]?.id || null);
  }

  function addMusic() {
    if (!videoRender) return;
    updateSectionFeedbackState('music-library', { error: null, message: null });
    const nextTrack = createMusicDraft(videoRender.musicTracks.length + 1);
    const dedupedId = `${slugify(nextTrack.name) || 'music'}-${Date.now()}`;
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
    updateSectionFeedbackState('music-library', { error: null, message: null });
    const remaining = videoRender.musicTracks.filter((track) => track.id !== trackId);
    const nextDefault = videoRender.defaultMusicTrackId === trackId ? remaining[0].id : videoRender.defaultMusicTrackId;
    setVideoRender({
      ...videoRender,
      defaultMusicTrackId: nextDefault,
      musicTracks: remaining,
    });
    setSelectedMusicId(remaining[0]?.id || null);
  }

  async function uploadBackgroundVideo(file: File) {
    setBackgroundVideoUpload({ isUploading: true, error: null });
    updateSectionFeedbackState('background-videos', { error: null, message: null });

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('label', file.name);

      const response = await fetch('/api/short-form-videos/settings/background-videos/upload', {
        method: 'POST',
        body: formData,
      });
      const payload = (await response.json().catch(() => ({}))) as {
        success?: boolean;
        data?: { videoRelativePath: string; videoUrl?: string; uploadedAt?: string };
        error?: string;
      };

      if (!response.ok || payload.success === false || !payload.data) {
        throw new Error(payload.error || 'Failed to upload background video');
      }

      setBackgroundVideos((current) => {
        const entryId = `${slugify(file.name.replace(/\.[^.]+$/, '')) || 'background'}-${Date.now()}`;
        const nextEntry: BackgroundVideoEntry = {
          id: entryId,
          name: file.name.replace(/\.[^.]+$/, '') || 'Background video',
          videoRelativePath: payload.data!.videoRelativePath,
          videoUrl: payload.data!.videoUrl,
          uploadedAt: payload.data!.uploadedAt,
          updatedAt: payload.data!.uploadedAt,
        };
        if (!current) {
          return { defaultBackgroundVideoId: entryId, backgrounds: [nextEntry] };
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
        error: err instanceof Error ? err.message : 'Failed to upload background video',
      });
    }
  }

  async function generateStyleTest() {
    if (!imageStyles || !selectedStyle) return;

    const styleId = selectedStyle.id;
    const styleSnapshot = { ...selectedStyle };
    const commonConstraints = imageStyles.commonConstraints;

    setStyleTestsById((current) => ({
      ...current,
      [styleId]: {
        isLoading: true,
        error: null,
        cleanImageUrl: current[styleId]?.cleanImageUrl || selectedStyle.lastTestImage?.cleanImageUrl || null,
        previewImageUrl: current[styleId]?.previewImageUrl || selectedStyle.lastTestImage?.previewImageUrl || null,
      },
    }));

    try {
      const data = await parseStyleTestResponse(
        await fetch('/api/short-form-videos/settings/style-test', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            commonConstraints,
            promptTemplates: imageStyles.promptTemplates,
            style: styleSnapshot,
          }),
        })
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
              : style
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
              : style
          ),
        };
      });
    } catch (err) {
      setStyleTestsById((current) => ({
        ...current,
        [styleId]: {
          isLoading: false,
          error: err instanceof Error ? err.message : 'Failed to generate style test image',
          cleanImageUrl: current[styleId]?.cleanImageUrl || selectedStyle.lastTestImage?.cleanImageUrl || null,
          previewImageUrl: current[styleId]?.previewImageUrl || selectedStyle.lastTestImage?.previewImageUrl || null,
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
      if (dirtyBySection['tts-voice']) {
        await saveSection('tts-voice');
      }

      const data = await parseTtsPreviewResponse(
        await fetch('/api/short-form-videos/settings/voice-library/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ voiceId: selectedVoice.id }),
        })
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
      updateSectionFeedbackState('tts-voice', {
        saving: false,
        error: null,
        message: data.reusedExisting
          ? 'Saved voice sample already existed, so the dashboard will now reuse that same reference clip for future narration runs.'
          : 'Saved a reusable voice sample. Future XML narration runs will clone from this exact reference clip for more stable long-form output.',
      });
    } catch (err) {
      setTtsPreview((current) => ({
        ...current,
        isLoading: false,
        error: err instanceof Error ? err.message : 'Failed to generate saved voice sample',
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
      if (dirtyBySection['music-library']) {
        await saveSection('music-library');
      }

      const data = await parseMusicPreviewResponse(
        await fetch('/api/short-form-videos/settings/music-library/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ trackId: selectedMusic.id }),
        })
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
      updateSectionFeedbackState('music-library', {
        saving: false,
        error: null,
        message: data.reusedExisting
          ? 'Saved soundtrack already existed, so final-video runs will reuse the exact same file.'
          : 'Saved a reusable soundtrack file. Final-video runs will now reuse this exact audio instead of regenerating it.',
      });
    } catch (err) {
      setMusicPreview((current) => ({
        ...current,
        isLoading: false,
        error: err instanceof Error ? err.message : 'Failed to generate saved soundtrack file',
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
    <div className="space-y-6 p-4 pb-24 sm:p-6 sm:pb-28 lg:p-8 xl:pr-72">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link href="/short-form-video" className="text-sm text-muted-foreground hover:text-foreground">
            ← Back to short-form videos
          </Link>
          <h1 className="mt-3 text-2xl font-bold text-foreground">Short-form workflow settings</h1>
          <p className="mt-1 max-w-4xl text-sm text-muted-foreground">
            Edit the real settings the dashboard actually uses: Qwen narration voice controls for final-video generation,
            pause-removal defaults for the narration timing pass, reusable looping background videos, Nano Banana scene-image templates and style rules,
            and the remaining hooks / research / script prompt templates. For text scripts, these settings feed the dashboard-owned workflow wrappers
            that then call Scribe. Each section now saves independently so you can iterate without committing unrelated draft changes.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => void loadSettings()} disabled={loading || anySectionSaving || anyStyleTesting || ttsPreview.isLoading || selectedStyleUpload?.isUploading || selectedVoiceUpload?.isUploading || backgroundVideoUpload.isUploading}>
            Reload page state
          </Button>
        </div>
      </div>

      {error ? <ValidationNotice title="Settings error" message={error} /> : null}

      <SectionNavigator sections={sections} activeSection={activeSection} />

      {promptSections}

      {textScriptPromptSection}

      <section id="pause-removal" className="scroll-mt-24">
        <Card className="space-y-5 p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <WorkflowSectionHeader
              title="Pause-removal defaults"
              description="Set the global silence-trimming defaults for the narration pipeline. This ffmpeg pass runs after original narration generation and before forced alignment. Individual projects can override these values from their Narration Audio section."
              status={dirtyBySection['pause-removal'] ? 'needs review' : 'approved'}
            />
            <SectionActions
              dirty={dirtyBySection['pause-removal']}
              saving={sectionFeedback['pause-removal'].saving}
              saveLabel="Save pause-removal defaults"
              onSave={() => void saveSection('pause-removal')}
              onReset={() => resetSection('pause-removal')}
            />
          </div>

          {videoRender ? (
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Remove pauses longer than (seconds)</label>
                <Input
                  type="number"
                  min={0.1}
                  max={2.5}
                  step={0.01}
                  value={videoRender.pauseRemoval.minSilenceDurationSeconds}
                  onChange={(event) => {
                    updateSectionFeedbackState('pause-removal', { error: null, message: null });
                    setVideoRender({
                      ...videoRender,
                      pauseRemoval: {
                        ...videoRender.pauseRemoval,
                        minSilenceDurationSeconds: Math.min(2.5, Math.max(0.1, Math.round((Number(event.target.value) || 0.35) * 100) / 100)),
                      },
                    });
                  }}
                  className="max-w-[180px]"
                />
                <p className="text-xs text-muted-foreground">Silent spans longer than this are trimmed from the processed narration audio before alignment.</p>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Silence threshold (dB)</label>
                <Input
                  type="number"
                  min={-80}
                  max={-5}
                  step={0.1}
                  value={videoRender.pauseRemoval.silenceThresholdDb}
                  onChange={(event) => {
                    updateSectionFeedbackState('pause-removal', { error: null, message: null });
                    setVideoRender({
                      ...videoRender,
                      pauseRemoval: {
                        ...videoRender.pauseRemoval,
                        silenceThresholdDb: Math.min(-5, Math.max(-80, Math.round((Number(event.target.value) || -40) * 10) / 10)),
                      },
                    });
                  }}
                  className="max-w-[180px]"
                />
                <p className="text-xs text-muted-foreground">Anything quieter than this is treated as silence during the trimming pass.</p>
              </div>
            </div>
          ) : null}

          <div className="rounded-lg border border-border bg-background/50 p-3 text-xs text-muted-foreground">
            These are the dashboard-wide defaults. On a specific short-form project, you can override them and then use the dedicated <span className="font-medium text-foreground">Re-run pause removal + alignment</span> action without regenerating the original narration.
          </div>

          <SectionFeedbackNotice feedback={sectionFeedback['pause-removal']} />
        </Card>
      </section>


      <section id="tts-voice" className="scroll-mt-24">
        <Card className="space-y-5 p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <WorkflowSectionHeader
              title="Qwen voice library"
              description="Manage the reusable voice library that the dashboard really uses for final-video narration. VoiceDesign entries are the new primary path. Legacy/custom entries remain supported only for migrated speaker-based voices and fallback compatibility."
              status={dirtyBySection['tts-voice'] ? 'needs review' : 'approved'}
            />
            <SectionActions
              dirty={dirtyBySection['tts-voice']}
              saving={sectionFeedback['tts-voice'].saving}
              saveLabel="Save voice library"
              onSave={() => void saveSection('tts-voice')}
              onReset={() => resetSection('tts-voice')}
            />
          </div>

          {videoRender ? (
            <div className="space-y-5">
              <div className="rounded-lg border border-border bg-background/60 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-medium text-foreground">Saved voices</h3>
                    <p className="mt-1 max-w-3xl text-xs text-muted-foreground">
                      VoiceDesign uses Qwen&apos;s <code>voice-design</code> mode, which means the design text is the real control. It does not expose a reusable deterministic speaker ID in the current local runner. Legacy/custom entries still use built-in speakers plus instructions and are kept here only for migration and fallback.
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button variant="outline" onClick={addVoice} disabled={sectionFeedback['tts-voice'].saving}>
                      Add generated voice
                    </Button>
                    <Button variant="outline" onClick={addUploadedReferenceVoice} disabled={sectionFeedback['tts-voice'].saving}>
                      Add uploaded reference
                    </Button>
                  </div>
                </div>

                <div className="mt-4 grid gap-4 lg:grid-cols-[280px,1fr]">
                  <div className="space-y-2">
                    <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Voice library</label>
                    <Select
                      value={selectedVoiceId || ''}
                      onChange={(event) => setSelectedVoiceId(event.target.value)}
                      disabled={videoRender.voices.length === 0}
                    >
                      {videoRender.voices.map((voice) => (
                        <option key={voice.id} value={voice.id}>
                          {voice.name} [{getVoiceSourceLabel(voice)}]{voice.id === videoRender.defaultVoiceId ? ' (default)' : ''}
                        </option>
                      ))}
                    </Select>
                    <div className="rounded-lg border border-border bg-background/50 p-3 text-xs text-muted-foreground">
                      <p>
                        <span className="font-medium text-foreground">Default voice:</span>{' '}
                        {videoRender.voices.find((voice) => voice.id === videoRender.defaultVoiceId)?.name || 'Not set'}
                      </p>
                      <p className="mt-2">Projects can override the default voice individually. Older projects with no saved override fall back to whatever is currently marked default.</p>
                    </div>
                  </div>

                  {selectedVoice ? (
                    <div className="space-y-4 rounded-lg border border-border bg-background/50 p-4">
                      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                        <div className="space-y-2">
                          <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Voice name</label>
                          <Input
                            value={selectedVoice.name}
                            onChange={(event) => {
                              updateSelectedVoice((voice) => ({ ...voice, name: event.target.value }));
                            }}
                            placeholder="Calm Authority"
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Voice source</label>
                          <Select
                            value={selectedVoice.sourceType || 'generated'}
                            onChange={(event) => {
                              const sourceType = event.target.value === 'uploaded-reference' ? 'uploaded-reference' : 'generated';
                              updateSelectedVoice((voice) => {
                                const transcript = voice.referenceText || voice.previewText;
                                return {
                                  ...voice,
                                  sourceType,
                                  mode: sourceType === 'uploaded-reference' ? 'voice-design' : voice.mode,
                                  previewText: transcript,
                                  referenceText: sourceType === 'uploaded-reference' ? transcript : voice.referenceText,
                                  ...(sourceType === 'uploaded-reference'
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
                            <option value="generated">Generated voice library entry</option>
                            <option value="uploaded-reference">Uploaded reference clip</option>
                          </Select>
                        </div>
                        {(selectedVoice.sourceType || 'generated') === 'generated' ? (
                          <div className="space-y-2">
                            <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Mode</label>
                            <Select
                              value={selectedVoice.mode}
                              onChange={(event) => {
                                const mode = event.target.value === 'custom-voice' ? 'custom-voice' : 'voice-design';
                                updateSelectedVoice((voice) => ({
                                  ...voice,
                                  mode,
                                  ...(mode === 'custom-voice'
                                    ? {
                                        speaker: voice.speaker || 'Aiden',
                                        legacyInstruct: voice.legacyInstruct || voice.voiceDesignPrompt,
                                      }
                                    : {}),
                                }));
                              }}
                            >
                              <option value="voice-design">VoiceDesign</option>
                              <option value="custom-voice">Legacy custom voice</option>
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
                          variant={selectedVoice.id === videoRender.defaultVoiceId ? 'default' : 'outline'}
                          onClick={() => {
                            updateSectionFeedbackState('tts-voice', { error: null, message: null });
                            setVideoRender({ ...videoRender, defaultVoiceId: selectedVoice.id });
                          }}
                        >
                          {selectedVoice.id === videoRender.defaultVoiceId ? 'Default voice' : 'Set as default'}
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

                      {(selectedVoice.sourceType || 'generated') === 'generated' ? (
                        <>
                          <div className="space-y-2">
                            <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                              {selectedVoice.mode === 'voice-design' ? 'VoiceDesign prompt' : 'Voice description / legacy instruction snapshot'}
                            </label>
                            <Textarea
                              value={selectedVoice.voiceDesignPrompt}
                              onChange={(event) => {
                                updateSelectedVoice((voice) => ({
                                  ...voice,
                                  voiceDesignPrompt: event.target.value,
                                  ...(voice.mode === 'custom-voice' ? { legacyInstruct: event.target.value } : {}),
                                }));
                              }}
                              className="min-h-[150px] font-mono text-xs"
                            />
                            <p className="text-xs text-muted-foreground">
                              {selectedVoice.mode === 'voice-design'
                                ? 'This prompt shapes the reusable reference clip in Qwen voice-design mode. Qwen still does not expose a locked speaker ID here, so the practical stabilization path is generating and then reusing the saved sample below.'
                                : 'This legacy/custom entry still passes speaker + instruction text into Qwen custom-voice mode so older behavior remains runnable.'}
                            </p>
                          </div>

                          {selectedVoice.mode === 'custom-voice' ? (
                            <div className="space-y-2">
                              <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Legacy speaker</label>
                              <Input
                                value={selectedVoice.speaker || ''}
                                onChange={(event) => {
                                  updateSelectedVoice((voice) => ({ ...voice, speaker: event.target.value }));
                                }}
                                placeholder="Aiden"
                              />
                              <p className="text-xs text-muted-foreground">
                                Used only for legacy/custom voice entries. VoiceDesign entries ignore speaker and use the design prompt alone.
                              </p>
                            </div>
                          ) : null}
                        </>
                      ) : null}

                      <div className="space-y-2">
                        <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Notes</label>
                        <Textarea
                          value={selectedVoice.notes}
                          onChange={(event) => {
                            updateSelectedVoice((voice) => ({ ...voice, notes: event.target.value }));
                          }}
                          className="min-h-[90px] text-xs"
                          placeholder="Optional notes about when to use this voice"
                        />
                      </div>

                      <div className="space-y-4 rounded-lg border border-border bg-background/60 p-4">
                        {(selectedVoice.sourceType || 'generated') === 'uploaded-reference' ? (
                          <>
                            <div className="flex flex-wrap items-center justify-between gap-3">
                              <div>
                                <h3 className="text-sm font-medium text-foreground">Uploaded reference voice</h3>
                                <p className="mt-1 text-xs text-muted-foreground">
                                  Upload a short recording and transcript. The dashboard converts common audio uploads to mono WAV, saves the clip in the voice library, and then XML narration reuses that exact reference clip in Qwen voice-clone mode.
                                </p>
                              </div>
                              <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-border px-3 py-2 text-sm hover:bg-accent">
                                <span>{selectedVoiceUpload?.isUploading ? 'Uploading…' : savedVoiceAudioUrl ? 'Replace reference audio' : 'Upload reference audio'}</span>
                                <input
                                  type="file"
                                  accept="audio/wav,audio/wave,audio/x-wav,audio/mpeg,audio/mp3,audio/mp4,audio/x-m4a,audio/aac,audio/ogg,audio/opus,audio/webm,video/webm,.wav,.mp3,.m4a,.aac,.mp4,.ogg,.opus,.webm"
                                  className="hidden"
                                  disabled={selectedVoiceUpload?.isUploading}
                                  onChange={(event) => {
                                    const file = event.target.files?.[0];
                                    if (file) {
                                      void uploadReferenceVoice(file);
                                    }
                                    event.currentTarget.value = '';
                                  }}
                                />
                              </label>
                            </div>

                            {selectedVoiceUpload?.error ? <ValidationNotice title="Reference upload failed" message={selectedVoiceUpload.error} /> : null}

                            <div className="space-y-2">
                              <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Transcript for the uploaded clip</label>
                              <Textarea
                                value={selectedVoice.referenceText || selectedVoice.previewText}
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
                                Keep this aligned with the uploaded recording. Qwen uses the saved clip plus this transcript as the cloning reference during narration generation.
                              </p>
                            </div>
                          </>
                        ) : (
                          <>
                            <div className="flex flex-wrap items-center justify-between gap-3">
                              <div>
                                <h3 className="text-sm font-medium text-foreground">Saved voice sample</h3>
                                <p className="mt-1 text-xs text-muted-foreground">
                                  Generate one reusable reference clip for this voice entry. XML narration runs then switch to voice-clone mode and reuse this exact sample instead of asking Qwen to redesign the voice on every narration chunk. If a project reaches XML narration before you click this, the worker now auto-saves the first generated reference clip back into the voice library too.
                                </p>
                              </div>
                              <Button onClick={() => void generateTtsPreview()} disabled={ttsPreview.isLoading || sectionFeedback['tts-voice'].saving}>
                                {ttsPreview.isLoading ? 'Generating…' : hasSavedVoiceSample(selectedVoice) ? 'Regenerate saved sample' : 'Generate saved sample'}
                              </Button>
                            </div>

                            <div className="space-y-2">
                              <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Reference/sample text</label>
                              <Textarea
                                value={selectedVoice.previewText}
                                onChange={(event) => {
                                  updateSelectedVoice((voice) => ({ ...voice, previewText: event.target.value }));
                                }}
                                className="min-h-[110px] font-mono text-xs"
                              />
                              <p className="text-xs text-muted-foreground">
                                This text becomes the saved cloning reference. Keep it reasonably representative. The generator will automatically extend very short text into a longer one-chunk reference clip so the saved sample stays more stable across longer narrations.
                              </p>
                            </div>

                            {ttsPreview.error ? <ValidationNotice title="Saved voice sample failed" message={ttsPreview.error} /> : null}

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
                                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Saved voice</p>
                                <p className="mt-1 text-sm text-foreground">{selectedVoice.name}</p>
                              </div>
                              <div>
                                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Reference text</p>
                                <p className="mt-1 text-sm text-foreground">{selectedVoice.referenceText || selectedVoice.previewText}</p>
                              </div>
                            </div>
                            <audio controls className="w-full" src={savedVoiceAudioUrl} />
                            <div className="grid gap-3 md:grid-cols-2">
                              <div>
                                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Voice source</p>
                                <p className="mt-1 text-sm text-foreground">{(selectedVoice.sourceType || 'generated') === 'uploaded-reference' ? 'Uploaded reference clip' : 'Generated reference sample'}</p>
                              </div>
                              {(selectedVoice.sourceType || 'generated') === 'generated' ? (
                                <div>
                                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Mode used</p>
                                  <p className="mt-1 text-sm text-foreground">{(selectedVoice.referenceMode || selectedVoice.mode) === 'custom-voice' ? 'Legacy custom voice' : 'VoiceDesign'}</p>
                                </div>
                              ) : null}
                              {(selectedVoice.referenceSpeaker || selectedVoice.speaker) && (selectedVoice.sourceType || 'generated') === 'generated' ? (
                                <div>
                                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Speaker used</p>
                                  <p className="mt-1 text-sm text-foreground">{selectedVoice.referenceSpeaker || selectedVoice.speaker}</p>
                                </div>
                              ) : null}
                            </div>
                            {(selectedVoice.sourceType || 'generated') === 'generated' ? (
                              <div>
                                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Prompt snapshot used</p>
                                <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">{selectedVoice.referencePrompt || selectedVoice.voiceDesignPrompt}</p>
                              </div>
                            ) : null}
                            {selectedVoice.referenceGeneratedAt ? (
                              <p className="text-xs text-muted-foreground">
                                Saved {new Date(selectedVoice.referenceGeneratedAt).toLocaleString()}.
                                {(selectedVoice.sourceType || 'generated') === 'generated'
                                  ? ttsPreview.reusedExisting === true
                                    ? ' Reused the existing reference clip on the latest request.'
                                    : ttsPreview.reusedExisting === false
                                      ? ' Regenerated the saved reference clip on the latest request.'
                                      : ''
                                  : ' Uploaded clips are reused directly during narration generation.'}
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

          <SectionFeedbackNotice feedback={sectionFeedback['tts-voice']} />
        </Card>
      </section>

      <section id="image-templates" className="scroll-mt-24">
        <Card className="space-y-5 p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <WorkflowSectionHeader
              title="Nano Banana prompt templates"
              description="These are the real editable templates used by the direct dashboard scene-image path. The runtime now hard-enforces a green-screen foreground-plate workflow so final backgrounds come from the selected looping background video rather than the generated scene art."
              status={dirtyBySection['image-templates'] ? 'needs review' : 'approved'}
            />
            <SectionActions
              dirty={dirtyBySection['image-templates']}
              saving={sectionFeedback['image-templates'].saving}
              saveLabel="Save templates"
              onSave={() => void saveSection('image-templates')}
              onReset={() => resetSection('image-templates')}
            />
          </div>

          {imageStyles ? (
            <div className="space-y-4">
              <div className="grid gap-4 xl:grid-cols-3">
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="text-sm font-medium text-foreground">Style instructions block template</h3>
                    <span className="text-[11px] text-muted-foreground">Injected into both character-ref and scene prompts</span>
                  </div>
                  <Textarea
                    value={imageStyles.promptTemplates.styleInstructionsTemplate}
                    onChange={(event) => {
                      updateSectionFeedbackState('image-templates', { error: null, message: null });
                      setImageStyles({
                        ...imageStyles,
                        promptTemplates: { ...imageStyles.promptTemplates, styleInstructionsTemplate: event.target.value },
                      });
                    }}
                    className="min-h-[240px] font-mono text-xs"
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="text-sm font-medium text-foreground">Character reference template</h3>
                    <span className="text-[11px] text-muted-foreground">Used only when no primary character reference image is supplied</span>
                  </div>
                  <Textarea
                    value={imageStyles.promptTemplates.characterReferenceTemplate}
                    onChange={(event) => {
                      updateSectionFeedbackState('image-templates', { error: null, message: null });
                      setImageStyles({
                        ...imageStyles,
                        promptTemplates: { ...imageStyles.promptTemplates, characterReferenceTemplate: event.target.value },
                      });
                    }}
                    className="min-h-[240px] font-mono text-xs"
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="text-sm font-medium text-foreground">Scene generation template</h3>
                    <span className="text-[11px] text-muted-foreground">The real per-scene Nano Banana prompt wrapper</span>
                  </div>
                  <Textarea
                    value={imageStyles.promptTemplates.sceneTemplate}
                    onChange={(event) => {
                      updateSectionFeedbackState('image-templates', { error: null, message: null });
                      setImageStyles({
                        ...imageStyles,
                        promptTemplates: { ...imageStyles.promptTemplates, sceneTemplate: event.target.value },
                      });
                    }}
                    className="min-h-[240px] font-mono text-xs"
                  />
                </div>
              </div>

              <div className="rounded-lg border border-border/70 bg-background/40 p-3 text-xs text-muted-foreground">
                <p className="font-medium text-foreground">Useful placeholders</p>
                <ul className="mt-2 grid gap-1 md:grid-cols-2 xl:grid-cols-3">
                  <li><code>{'{{styleInstructionsBlock}}'}</code> → rendered shared constraints + per-style instructions block</li>
                  <li><code>{'{{subjectPrompt}}'}</code>, <code>{'{{headerPercent}}'}</code></li>
                  <li><code>{'{{sharedConstraintsBlock}}'}</code>, <code>{'{{perStyleInstructionsBlock}}'}</code>, <code>{'{{extraReferencesBlock}}'}</code></li>
                  <li><code>{'{{sceneNumber}}'}</code>, <code>{'{{sceneText}}'}</code>, <code>{'{{sceneImagePrompt}}'}</code></li>
                  <li><code>{'{{topicLine}}'}</code>, <code>{'{{scriptLine}}'}</code></li>
                  <li><code>{'{{extraDirectionLine}}'}</code>, <code>{'{{continuityInstructionsLine}}'}</code></li>
                </ul>
              </div>
            </div>
          ) : null}

          <SectionFeedbackNotice feedback={sectionFeedback['image-templates']} />
        </Card>
      </section>

      <section id="image-shared-constraints" className="scroll-mt-24">
        <Card className="space-y-5 p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <WorkflowSectionHeader
              title="Shared image constraints"
              description="Reusable visual rules applied across styles via the real Nano Banana style-instructions block."
              status={dirtyBySection['image-shared-constraints'] ? 'needs review' : 'approved'}
            />
            <SectionActions
              dirty={dirtyBySection['image-shared-constraints']}
              saving={sectionFeedback['image-shared-constraints'].saving}
              saveLabel="Save constraints"
              onSave={() => void saveSection('image-shared-constraints')}
              onReset={() => resetSection('image-shared-constraints')}
            />
          </div>

          {imageStyles ? (
            <div className="space-y-2">
              <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Shared/common constraints</label>
              <Textarea
                value={imageStyles.commonConstraints}
                onChange={(event) => {
                  updateSectionFeedbackState('image-shared-constraints', { error: null, message: null });
                  setImageStyles({
                    ...imageStyles,
                    commonConstraints: event.target.value,
                  });
                }}
                className="min-h-[180px] font-mono text-xs"
              />
            </div>
          ) : null}

          <SectionFeedbackNotice feedback={sectionFeedback['image-shared-constraints']} />
        </Card>
      </section>

      <section id="image-styles" className="scroll-mt-24">
        <Card className="space-y-5 p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <WorkflowSectionHeader
              title="Image style library"
              description="Maintain per-style instructions, reusable references, and the built-in one-scene style test. The selected project style feeds directly into live scene-image generation."
              status={dirtyBySection['image-styles'] ? 'needs review' : 'approved'}
            />
            <SectionActions
              dirty={dirtyBySection['image-styles']}
              saving={sectionFeedback['image-styles'].saving}
              saveLabel="Save style library"
              onSave={() => void saveSection('image-styles')}
              onReset={() => resetSection('image-styles')}
            />
          </div>

          {imageStyles ? (
            <div className="grid gap-5 xl:grid-cols-[280px_minmax(0,1fr)]">
              <div className="space-y-3 rounded-lg border border-border bg-background/40 p-3">
                <div className="flex items-center justify-between gap-2">
                  <h2 className="text-sm font-medium text-foreground">Styles</h2>
                  <Button variant="outline" size="sm" onClick={addStyle}>
                    New style
                  </Button>
                </div>
                <div className="space-y-2">
                  {imageStyles.styles.map((style) => {
                    const isActive = style.id === selectedStyleId;
                    const isDefault = imageStyles.defaultStyleId === style.id;
                    return (
                      <button
                        key={style.id}
                        type="button"
                        onClick={() => setSelectedStyleId(style.id)}
                        className={`w-full rounded-lg border px-3 py-2 text-left transition ${
                          isActive
                            ? 'border-primary bg-primary/10 text-foreground'
                            : 'border-border bg-background/50 text-foreground hover:border-primary/50'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm font-medium">{style.name}</span>
                          {isDefault ? (
                            <span className="rounded-full border border-emerald-500/30 px-2 py-0.5 text-[10px] uppercase tracking-wide text-emerald-200">
                              Default
                            </span>
                          ) : null}
                        </div>
                        <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{style.description || 'No description yet.'}</p>
                      </button>
                    );
                  })}
                </div>
              </div>

              {selectedStyle ? (
                <div className="space-y-5 rounded-lg border border-border bg-background/40 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h2 className="text-sm font-medium text-foreground">Edit style</h2>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Per-style instructions are injected into the real Nano Banana templates through the shared style-instructions block.
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant={imageStyles.defaultStyleId === selectedStyle.id ? 'secondary' : 'outline'}
                        size="sm"
                        onClick={() => {
                          updateSectionFeedbackState('image-styles', { error: null, message: null });
                          setImageStyles({ ...imageStyles, defaultStyleId: selectedStyle.id });
                        }}
                      >
                        {imageStyles.defaultStyleId === selectedStyle.id ? 'Default style' : 'Set as default'}
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
                      <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Style name</label>
                      <Input
                        value={selectedStyle.name}
                        onChange={(event) => updateSelectedStyle((style) => ({ ...style, name: event.target.value }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Header-safe area %</label>
                      <Input
                        type="number"
                        min={15}
                        max={45}
                        value={selectedStyle.headerPercent}
                        onChange={(event) =>
                          updateSelectedStyle((style) => ({
                            ...style,
                            headerPercent: Math.max(15, Math.min(45, Number(event.target.value) || 28)),
                          }))
                        }
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Description</label>
                    <Input
                      value={selectedStyle.description || ''}
                      onChange={(event) => updateSelectedStyle((style) => ({ ...style, description: event.target.value }))}
                      placeholder="What this style is for"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Subject / character prompt</label>
                    <Textarea
                      value={selectedStyle.subjectPrompt}
                      onChange={(event) => updateSelectedStyle((style) => ({ ...style, subjectPrompt: event.target.value }))}
                      className="min-h-[90px] font-mono text-xs"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Per-style visual instructions</label>
                    <Textarea
                      value={selectedStyle.stylePrompt}
                      onChange={(event) => updateSelectedStyle((style) => ({ ...style, stylePrompt: event.target.value }))}
                      className="min-h-[160px] font-mono text-xs"
                    />
                  </div>

                  <div className="space-y-4 rounded-lg border border-border bg-background/60 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <h3 className="text-sm font-medium text-foreground">Style reference images</h3>
                        <p className="mt-1 text-xs text-muted-foreground">
                          Add zero, one, or many reusable references for this style. If one reference is marked <span className="font-medium text-foreground">Primary character</span>, the generator uses it as the main identity anchor instead of the built-in generated character reference.
                        </p>
                      </div>
                      <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-border px-3 py-2 text-sm hover:bg-accent">
                        <span>{selectedStyleUpload?.isUploading ? 'Uploading…' : 'Upload reference image'}</span>
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
                            event.currentTarget.value = '';
                          }}
                        />
                      </label>
                    </div>

                    {selectedStyleUpload?.error ? <ValidationNotice title="Reference upload failed" message={selectedStyleUpload.error} /> : null}

                    {(selectedStyle.references || []).length > 0 ? (
                      <div className="space-y-4">
                        {(selectedStyle.references || []).map((reference, index) => {
                          const characterCount = (selectedStyle.references || []).filter((item) => item.usageType === 'character').length;
                          const disableCharacterOption = reference.usageType !== 'character' && characterCount >= 1;
                          return (
                            <div key={reference.id} className="rounded-lg border border-border bg-background/70 p-3">
                              <div className="grid gap-4 lg:grid-cols-[160px_minmax(0,1fr)]">
                                <div className="space-y-2">
                                  {reference.imageUrl ? (
                                    <img
                                      src={reference.imageUrl}
                                      alt={reference.label || `Style reference ${index + 1}`}
                                      className="aspect-[3/4] w-full rounded-md border border-border bg-muted object-cover"
                                    />
                                  ) : (
                                    <div className="flex aspect-[3/4] items-center justify-center rounded-md border border-dashed border-border bg-muted text-xs text-muted-foreground">
                                      Preview unavailable
                                    </div>
                                  )}
                                  <Button variant="outline" size="sm" onClick={() => removeStyleReference(reference.id)}>
                                    Remove
                                  </Button>
                                </div>
                                <div className="space-y-3">
                                  <div className="grid gap-3 md:grid-cols-2">
                                    <div className="space-y-2">
                                      <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Label</label>
                                      <Input
                                        value={reference.label || ''}
                                        onChange={(event) =>
                                          updateStyleReference(reference.id, (current) => ({ ...current, label: event.target.value }))
                                        }
                                        placeholder="Optional name"
                                      />
                                    </div>
                                    <div className="space-y-2">
                                      <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Reference role</label>
                                      <select
                                        value={reference.usageType}
                                        onChange={(event) => {
                                          const nextUsageType = event.target.value as StyleReferenceUsageType;
                                          if (nextUsageType === 'character') {
                                            updateSelectedStyle((style) => ({
                                              ...style,
                                              references: (style.references || []).map((item) =>
                                                item.id === reference.id
                                                  ? { ...item, usageType: 'character' }
                                                  : item.usageType === 'character'
                                                    ? { ...item, usageType: 'general' }
                                                    : item
                                              ),
                                            }));
                                            return;
                                          }
                                          updateStyleReference(reference.id, (current) => ({ ...current, usageType: nextUsageType }));
                                        }}
                                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                                      >
                                        {STYLE_REFERENCE_USAGE_OPTIONS.map((option) => (
                                          <option
                                            key={option.value}
                                            value={option.value}
                                            disabled={option.value === 'character' && disableCharacterOption}
                                          >
                                            {option.label}
                                          </option>
                                        ))}
                                      </select>
                                    </div>
                                  </div>

                                  <div className="space-y-2">
                                    <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Usage instructions</label>
                                    <Textarea
                                      value={reference.usageInstructions}
                                      onChange={(event) =>
                                        updateStyleReference(reference.id, (current) => ({
                                          ...current,
                                          usageInstructions: event.target.value,
                                        }))
                                      }
                                      className="min-h-[110px] font-mono text-xs"
                                      placeholder="Explain exactly how the generator should use this reference."
                                    />
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
                        No style-level references yet. This style will keep using the existing prompt-only flow unless you upload references here.
                      </div>
                    )}
                  </div>

                  <div className="space-y-3 rounded-lg border border-border bg-background/60 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <h3 className="text-sm font-medium text-foreground">Style test</h3>
                        <p className="mt-1 text-xs text-muted-foreground">
                          Lightweight one-scene generation loop using the current editor values, including the real Nano Banana templates,
                          shared constraints, and any uploaded style reference images with their usage instructions.
                        </p>
                      </div>
                      <Button onClick={() => void generateStyleTest()} disabled={selectedStyleTest?.isLoading || anySectionSaving || selectedStyleUpload?.isUploading}>
                        {selectedStyleTest?.isLoading ? 'Generating…' : 'Generate test image'}
                      </Button>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Test topic</label>
                        <Input
                          value={selectedStyle.testTopic}
                          onChange={(event) => updateSelectedStyle((style) => ({ ...style, testTopic: event.target.value }))}
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Test caption</label>
                        <Input
                          value={selectedStyle.testCaption}
                          onChange={(event) => updateSelectedStyle((style) => ({ ...style, testCaption: event.target.value }))}
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Test scene image prompt</label>
                      <Textarea
                        value={selectedStyle.testImagePrompt}
                        onChange={(event) => updateSelectedStyle((style) => ({ ...style, testImagePrompt: event.target.value }))}
                        className="min-h-[100px] font-mono text-xs"
                      />
                    </div>

                    {selectedStyleTest?.error ? <ValidationNotice title="Style test failed" message={selectedStyleTest.error} /> : null}

                    {selectedStyleTest?.isLoading ? (
                      <div className="rounded-lg border border-border p-4">
                        <OrbitLoader label="Generating style test image" />
                      </div>
                    ) : null}

                    {selectedStyleTest?.cleanImageUrl || selectedStyleTest?.previewImageUrl ? (
                      <div className="grid gap-4 lg:grid-cols-2">
                        {selectedStyleTest.cleanImageUrl ? (
                          <div className="space-y-2">
                            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Clean image</p>
                            <img
                              src={selectedStyleTest.cleanImageUrl}
                              alt={`${selectedStyle.name} clean style test`}
                              className="aspect-[9/16] w-full rounded-lg border border-border bg-muted object-cover"
                            />
                          </div>
                        ) : null}
                        {selectedStyleTest.previewImageUrl ? (
                          <div className="space-y-2">
                            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Captioned preview</p>
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

          <SectionFeedbackNotice feedback={sectionFeedback['image-styles']} />
        </Card>
      </section>

      <section id="caption-styles" className="scroll-mt-24">
        <Card className="space-y-5 p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <WorkflowSectionHeader
              title="Caption style library"
              description="Manage reusable animated subtitle styles for short-form final renders. Each project can inherit the global default or override it with a specific saved style."
              status={dirtyBySection['caption-styles'] ? 'needs review' : 'approved'}
            />
            <SectionActions
              dirty={dirtyBySection['caption-styles']}
              saving={sectionFeedback['caption-styles'].saving}
              saveLabel="Save caption styles"
              onSave={() => void saveSection('caption-styles')}
              onReset={() => resetSection('caption-styles')}
            />
          </div>

          {videoRender ? (
            <div className="space-y-5">
              <div className="rounded-lg border border-border bg-background/60 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-medium text-foreground">Saved caption styles</h3>
                    <p className="mt-1 max-w-3xl text-xs text-muted-foreground">
                      Final-video renders keep the current deterministic caption segmentation and forced-alignment timing pipeline, then burn animated subtitles with word-level highlighting. The active word stays white, already-spoken words shift lighter, and upcoming words stay darker unless a style overrides those colors.
                    </p>
                  </div>
                  <Button variant="outline" onClick={addCaptionStyle} disabled={sectionFeedback['caption-styles'].saving}>
                    Add caption style
                  </Button>
                </div>

                <div className="mt-4 grid gap-4 lg:grid-cols-[320px,1fr]">
                  <div className="space-y-4">
                    <div className="space-y-2 rounded-lg border border-border bg-background/50 p-3">
                      <div className="flex items-center justify-between gap-3">
                        <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Caption style library</label>
                        <Button variant="outline" size="sm" onClick={addCaptionStyle} disabled={sectionFeedback['caption-styles'].saving}>
                          Add
                        </Button>
                      </div>
                      <Select
                        value={selectedCaptionStyleId || ''}
                        onChange={(event) => setSelectedCaptionStyleId(event.target.value)}
                        disabled={videoRender.captionStyles.length === 0}
                      >
                        {videoRender.captionStyles.map((style) => (
                          <option key={style.id} value={style.id}>
                            {style.name}{style.id === videoRender.defaultCaptionStyleId ? ' (default)' : ''}
                          </option>
                        ))}
                      </Select>
                      <div className="text-xs text-muted-foreground">
                        Default caption style:{' '}
                        <span className="font-medium text-foreground">
                          {videoRender.captionStyles.find((style) => style.id === videoRender.defaultCaptionStyleId)?.name || 'Not set'}
                        </span>
                      </div>
                    </div>

                    <div className="space-y-2 rounded-lg border border-border bg-background/50 p-3">
                      <div className="flex items-center justify-between gap-3">
                        <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Animation preset library</label>
                        <Button variant="outline" size="sm" onClick={addAnimationPreset} disabled={sectionFeedback['caption-styles'].saving}>
                          Add
                        </Button>
                      </div>
                      <Select
                        value={selectedAnimationPresetId || ''}
                        onChange={(event) => setSelectedAnimationPresetId(event.target.value)}
                        disabled={videoRender.animationPresets.length === 0}
                      >
                        {videoRender.animationPresets.map((preset) => {
                          const usageCount = videoRender.captionStyles.filter((style) => style.animationPresetId === preset.id).length;
                          return (
                            <option key={preset.id} value={preset.id}>
                              {preset.name}{preset.builtIn ? ' (built-in)' : ''}{usageCount > 0 ? ` · ${usageCount} style${usageCount === 1 ? '' : 's'}` : ''}
                            </option>
                          );
                        })}
                      </Select>
                      {selectedAnimationPreset ? (
                        <div className="rounded-lg border border-border bg-background/40 p-3 text-xs text-muted-foreground">
                          <p className="font-medium text-foreground">{selectedAnimationPreset.name}</p>
                          <p className="mt-1">{selectedAnimationPreset.description || 'No description yet.'}</p>
                          <p className="mt-2">Used by {videoRender.captionStyles.filter((style) => style.animationPresetId === selectedAnimationPreset.id).length} caption style(s).</p>
                        </div>
                      ) : null}
                    </div>
                  </div>

                  {selectedCaptionStyle && selectedCaptionStyleAnimationPreset && selectedAnimationPreset ? (
                    <div className="space-y-4 rounded-lg border border-border bg-background/50 p-4">
                      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(320px,0.85fr)]">
                        <div className="space-y-4">
                          <div className="rounded-lg border border-border bg-background/40 p-4">
                            <div className="grid gap-4 md:grid-cols-2">
                              <div className="space-y-2">
                                <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Style name</label>
                                <Input value={selectedCaptionStyle.name} onChange={(event) => updateSelectedCaptionStyle((style) => ({ ...style, name: event.target.value }))} />
                              </div>
                              <div className="space-y-2">
                                <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Animation preset reference</label>
                                <Select
                                  value={selectedCaptionStyle.animationPresetId}
                                  onChange={(event) => updateSelectedCaptionStyle((style) => {
                                    const preset = getCaptionAnimationPresetById(videoRender.animationPresets, event.target.value);
                                    return { ...style, animationPresetId: preset.id, animationPreset: preset.slug };
                                  })}
                                >
                                  {videoRender.animationPresets.map((preset) => (
                                    <option key={preset.id} value={preset.id}>{preset.name}</option>
                                  ))}
                                </Select>
                                <p className="text-xs text-muted-foreground">Caption styles now reference a first-class preset entity by id. Edit the preset library below to change motion globally for any linked styles.</p>
                              </div>
                            </div>

                            <div className="mt-4 grid gap-4 md:grid-cols-2">
                              <div className="space-y-2">
                                <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Font family</label>
                                <Input value={selectedCaptionStyle.fontFamily} onChange={(event) => updateSelectedCaptionStyle((style) => ({ ...style, fontFamily: event.target.value }))} />
                              </div>
                              <div className="space-y-2">
                                <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Font weight</label>
                                <Select value={String(selectedCaptionStyle.fontWeight)} onChange={(event) => updateSelectedCaptionStyle((style) => ({ ...style, fontWeight: Number(event.target.value) || 700 }))}>
                                  {CAPTION_FONT_WEIGHT_OPTIONS.map((option) => (
                                    <option key={option.value} value={option.value}>{option.label}</option>
                                  ))}
                                </Select>
                              </div>
                            </div>

                            <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                              <CaptionStyleNumberField label="Font size" value={selectedCaptionStyle.fontSize} min={32} max={120} onChange={(value) => updateSelectedCaptionStyle((style) => ({ ...style, fontSize: value }))} />
                              <CaptionStyleNumberField label="Word spacing" value={selectedCaptionStyle.wordSpacing} min={-20} max={32} step={0.1} onChange={(value) => updateSelectedCaptionStyle((style) => ({ ...style, wordSpacing: value }))} />
                              <CaptionStyleNumberField label="Side padding" value={selectedCaptionStyle.horizontalPadding} min={0} max={320} onChange={(value) => updateSelectedCaptionStyle((style) => ({ ...style, horizontalPadding: value }))} />
                              <CaptionStyleNumberField label="Bottom margin" value={selectedCaptionStyle.bottomMargin} min={0} max={900} onChange={(value) => updateSelectedCaptionStyle((style) => ({ ...style, bottomMargin: value }))} />
                              <CaptionStyleNumberField label="Outline width" value={selectedCaptionStyle.outlineWidth} min={0} max={12} step={0.1} onChange={(value) => updateSelectedCaptionStyle((style) => ({ ...style, outlineWidth: value }))} />
                              <CaptionStyleNumberField label="Shadow strength" value={selectedCaptionStyle.shadowStrength} min={0} max={12} step={0.1} onChange={(value) => updateSelectedCaptionStyle((style) => ({ ...style, shadowStrength: value }))} />
                              <CaptionStyleNumberField label="Shadow blur" value={selectedCaptionStyle.shadowBlur} min={0} max={16} step={0.1} onChange={(value) => updateSelectedCaptionStyle((style) => ({ ...style, shadowBlur: value }))} />
                              <CaptionStyleNumberField label="Shadow X" value={selectedCaptionStyle.shadowOffsetX} min={-32} max={32} step={0.1} onChange={(value) => updateSelectedCaptionStyle((style) => ({ ...style, shadowOffsetX: value }))} />
                              <CaptionStyleNumberField label="Shadow Y" value={selectedCaptionStyle.shadowOffsetY} min={-32} max={32} step={0.1} onChange={(value) => updateSelectedCaptionStyle((style) => ({ ...style, shadowOffsetY: value }))} />
                              <CaptionStyleNumberField label="Background padding" value={selectedCaptionStyle.backgroundPadding} min={0} max={96} onChange={(value) => updateSelectedCaptionStyle((style) => ({ ...style, backgroundPadding: value }))} />
                              <CaptionStyleNumberField label="Background radius" value={selectedCaptionStyle.backgroundRadius} min={0} max={96} onChange={(value) => updateSelectedCaptionStyle((style) => ({ ...style, backgroundRadius: value }))} />
                            </div>

                            <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                              {[
                                ['Active word', 'activeWordColor'],
                                ['Spoken words', 'spokenWordColor'],
                                ['Upcoming words', 'upcomingWordColor'],
                                ['Outline', 'outlineColor'],
                                ['Shadow', 'shadowColor'],
                                ['Background', 'backgroundColor'],
                              ].map(([label, key]) => (
                                <div key={key} className="space-y-2 rounded-lg border border-border bg-background/30 p-3">
                                  <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label} color</label>
                                  <div className="flex items-center gap-3">
                                    <input
                                      type="color"
                                      value={selectedCaptionStyle[key as keyof CaptionStyleEntry] as string}
                                      onChange={(event) => updateSelectedCaptionStyle((style) => ({ ...style, [key]: event.target.value.toUpperCase() }))}
                                      className="h-10 w-12 cursor-pointer rounded border border-border bg-transparent p-1"
                                    />
                                    <Input
                                      value={selectedCaptionStyle[key as keyof CaptionStyleEntry] as string}
                                      onChange={(event) => updateSelectedCaptionStyle((style) => ({ ...style, [key]: event.target.value.toUpperCase() }))}
                                      className="font-mono text-xs"
                                    />
                                  </div>
                                </div>
                              ))}
                            </div>

                            <div className="mt-4 rounded-lg border border-border bg-background/30 p-4">
                              <div className="flex flex-wrap items-center justify-between gap-3">
                                <div>
                                  <h4 className="text-sm font-medium text-foreground">Background box</h4>
                                  <p className="mt-1 text-xs text-muted-foreground">Preview and final render both use the saved background box intent.</p>
                                </div>
                                <label className="inline-flex items-center gap-2 text-sm text-foreground">
                                  <input type="checkbox" checked={selectedCaptionStyle.backgroundEnabled} onChange={(event) => updateSelectedCaptionStyle((style) => ({ ...style, backgroundEnabled: event.target.checked }))} />
                                  Enable box
                                </label>
                              </div>
                              <div className="mt-4 grid gap-4 md:grid-cols-2">
                                <div className="space-y-2">
                                  <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Box opacity</label>
                                  <div className="flex items-center gap-3">
                                    <input type="range" min={0} max={1} step={0.01} value={selectedCaptionStyle.backgroundOpacity} onChange={(event) => updateSelectedCaptionStyle((style) => ({ ...style, backgroundOpacity: Number(event.target.value) }))} className="w-full" />
                                    <div className="w-14 text-right text-sm text-foreground">{Math.round(selectedCaptionStyle.backgroundOpacity * 100)}%</div>
                                  </div>
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  Current linked animation preset: <span className="font-medium text-foreground">{selectedCaptionStyleAnimationPreset.name}</span><br />
                                  Layout mode: <span className="font-medium text-foreground">{selectedCaptionStyleAnimationPreset.config.layoutMode}</span><br />
                                  Timing mode: <span className="font-medium text-foreground">{selectedCaptionStyleAnimationPreset.config.timing.mode}</span>
                                </div>
                              </div>
                            </div>

                            <div className="mt-4 flex flex-wrap items-center gap-2 text-xs">
                              <Button type="button" variant={selectedCaptionStyle.id === videoRender.defaultCaptionStyleId ? 'default' : 'outline'} onClick={() => {
                                updateSectionFeedbackState('caption-styles', { error: null, message: null });
                                setVideoRender({ ...videoRender, defaultCaptionStyleId: selectedCaptionStyle.id });
                              }}>
                                {selectedCaptionStyle.id === videoRender.defaultCaptionStyleId ? 'Default caption style' : 'Set as default'}
                              </Button>
                              <Button type="button" variant="outline" onClick={() => duplicateCaptionStyle(selectedCaptionStyle.id)}>Duplicate caption style</Button>
                              <Button type="button" variant="outline" onClick={() => deleteCaptionStyle(selectedCaptionStyle.id)} disabled={videoRender.captionStyles.length <= 1}>Delete caption style</Button>
                            </div>
                          </div>

                          <div className="rounded-lg border border-border bg-background/40 p-4">
                            <div className="flex flex-wrap items-center justify-between gap-3">
                              <div>
                                <h4 className="text-sm font-medium text-foreground">Animation preset editor</h4>
                                <p className="mt-1 text-xs text-muted-foreground">Built-ins are now first-class presets. Edit them directly, or duplicate them into custom variants.</p>
                              </div>
                              <div className="flex flex-wrap gap-2">
                                <Button type="button" variant="outline" size="sm" onClick={() => duplicateAnimationPreset(selectedAnimationPreset.id)}>Duplicate preset</Button>
                                <Button type="button" variant="outline" size="sm" onClick={() => deleteAnimationPreset(selectedAnimationPreset.id)} disabled={videoRender.animationPresets.length <= 1}>Delete preset</Button>
                              </div>
                            </div>

                            <div className="mt-4 grid gap-4 md:grid-cols-2">
                              <div className="space-y-2">
                                <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Preset name</label>
                                <Input value={selectedAnimationPreset.name} onChange={(event) => updateSelectedAnimationPreset((preset) => ({ ...preset, name: event.target.value }))} />
                              </div>
                              <div className="space-y-2">
                                <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Slug</label>
                                <Input value={selectedAnimationPreset.slug} onChange={(event) => updateSelectedAnimationPreset((preset) => ({ ...preset, slug: event.target.value }))} className="font-mono text-xs" />
                              </div>
                            </div>

                            <div className="mt-4 space-y-2">
                              <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Description</label>
                              <Textarea value={selectedAnimationPreset.description} onChange={(event) => updateSelectedAnimationPreset((preset) => ({ ...preset, description: event.target.value }))} className="min-h-[76px] text-xs" />
                            </div>

                            <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                              <div className="space-y-2">
                                <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Layout mode</label>
                                <Select value={selectedAnimationPreset.config.layoutMode} onChange={(event) => updateSelectedAnimationPreset((preset) => ({ ...preset, config: { ...preset.config, layoutMode: event.target.value === 'fluid' ? 'fluid' : 'stable' } }))}>
                                  <option value="stable">Stable slots</option>
                                  <option value="fluid">Fluid reflow</option>
                                </Select>
                              </div>
                              <div className="space-y-2">
                                <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Timing mode</label>
                                <Select value={selectedAnimationPreset.config.timing.mode} onChange={(event) => updateSelectedAnimationPreset((preset) => ({ ...preset, config: { ...preset.config, timing: { ...preset.config.timing, mode: event.target.value === 'fixed' ? 'fixed' : 'word-relative' } } }))}>
                                  <option value="word-relative">Word-relative</option>
                                  <option value="fixed">Fixed duration</option>
                                </Select>
                              </div>
                              <CaptionStyleNumberField label="Timing multiplier" value={selectedAnimationPreset.config.timing.multiplier} min={0.1} max={4} step={0.05} onChange={(value) => updateSelectedAnimationPreset((preset) => ({ ...preset, config: { ...preset.config, timing: { ...preset.config.timing, multiplier: value } } }))} />
                              <CaptionStyleNumberField label="Fixed duration ms" value={selectedAnimationPreset.config.timing.fixedMs} min={40} max={2000} step={10} onChange={(value) => updateSelectedAnimationPreset((preset) => ({ ...preset, config: { ...preset.config, timing: { ...preset.config.timing, fixedMs: value } } }))} />
                              <CaptionStyleNumberField label="Min duration ms" value={selectedAnimationPreset.config.timing.minMs} min={40} max={2000} step={10} onChange={(value) => updateSelectedAnimationPreset((preset) => ({ ...preset, config: { ...preset.config, timing: { ...preset.config.timing, minMs: value } } }))} />
                              <CaptionStyleNumberField label="Max duration ms" value={selectedAnimationPreset.config.timing.maxMs} min={40} max={2000} step={10} onChange={(value) => updateSelectedAnimationPreset((preset) => ({ ...preset, config: { ...preset.config, timing: { ...preset.config.timing, maxMs: value } } }))} />
                            </div>

                            <div className="mt-4 grid gap-4 md:grid-cols-3">
                              {([
                                ['outlineColorMode', 'outlineColor', 'Outline source'],
                                ['shadowColorMode', 'shadowColor', 'Shadow source'],
                                ['glowColorMode', 'glowColor', 'Glow source'],
                              ] as const).map(([modeKey, colorKey, label]) => {
                                const modeValue = selectedAnimationPreset.config.colors[modeKey];
                                const customValue = selectedAnimationPreset.config.colors[colorKey] || '#FFFFFF';
                                return (
                                  <div key={modeKey} className="space-y-2 rounded-lg border border-border bg-background/30 p-3">
                                    <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</label>
                                    <Select value={modeValue} onChange={(event) => updateSelectedAnimationPreset((preset) => ({
                                      ...preset,
                                      config: {
                                        ...preset.config,
                                        colors: {
                                          ...preset.config.colors,
                                          [modeKey]: event.target.value as ShortFormCaptionAnimationColorMode,
                                        },
                                      },
                                    }))}>
                                      {CAPTION_ANIMATION_COLOR_MODE_OPTIONS.map((option) => (
                                        <option key={option.value} value={option.value}>{option.label}</option>
                                      ))}
                                    </Select>
                                    {modeValue === 'custom' ? (
                                      <Input value={customValue} onChange={(event) => updateSelectedAnimationPreset((preset) => ({
                                        ...preset,
                                        config: {
                                          ...preset.config,
                                          colors: {
                                            ...preset.config.colors,
                                            [colorKey]: event.target.value.toUpperCase(),
                                          },
                                        },
                                      }))} className="font-mono text-xs" />
                                    ) : null}
                                  </div>
                                );
                              })}
                            </div>

                            <div className="mt-4 space-y-4">
                              <div>
                                <h5 className="text-sm font-medium text-foreground">Motion tracks</h5>
                                <p className="mt-1 text-xs text-muted-foreground">Edit the keyframes that drive scale, lift, blur, glow, outline, and shadow response during the active-word window.</p>
                              </div>
                              <div className="grid gap-4 xl:grid-cols-2">
                                {CAPTION_ANIMATION_TRACK_LABELS.map((trackDefinition) => {
                                  const track = selectedAnimationPreset.config.motion[trackDefinition.key];
                                  const trackRange = trackDefinition.key === 'scale'
                                    ? { min: 0.2, max: 4, step: 0.01 }
                                    : trackDefinition.key === 'translateXEm' || trackDefinition.key === 'translateYEm'
                                      ? { min: -4, max: 4, step: 0.01 }
                                      : trackDefinition.key === 'shadowOpacityMultiplier'
                                        ? { min: 0, max: 4, step: 0.01 }
                                        : trackDefinition.key === 'glowStrength'
                                          ? { min: 0, max: 2.5, step: 0.01 }
                                          : trackDefinition.key === 'extraBlur'
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
                                      onChange={(nextTrack) => updateSelectedAnimationPreset((preset) => ({
                                        ...preset,
                                        config: {
                                          ...preset.config,
                                          motion: {
                                            ...preset.config.motion,
                                            [trackDefinition.key]: nextTrack,
                                          },
                                        },
                                      }))}
                                    />
                                  );
                                })}
                              </div>
                            </div>

                            <div className="mt-4 rounded-lg border border-border bg-background/30 p-4">
                              <div className="flex items-center justify-between gap-3">
                                <div>
                                  <h5 className="text-sm font-medium text-foreground">Advanced preset JSON</h5>
                                  <p className="mt-1 text-xs text-muted-foreground">Full control over timing, easing, start/end values, motion tracks, and future-compatible fields.</p>
                                </div>
                                <Button type="button" variant="outline" size="sm" onClick={() => setAnimationPresetJsonDraft(formatAnimationPresetConfigJson(selectedAnimationPreset.config))}>Reset editor</Button>
                              </div>
                              <Textarea value={animationPresetJsonDraft} onChange={(event) => setAnimationPresetJsonDraft(event.target.value)} className="mt-3 min-h-[320px] font-mono text-xs" />
                              <div className="mt-3 flex flex-wrap gap-2">
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  onClick={() => {
                                    const parsed = parseAnimationPresetConfigJson(animationPresetJsonDraft, selectedAnimationPreset.config);
                                    if (!parsed) {
                                      updateSectionFeedbackState('caption-styles', { error: 'Animation preset JSON is invalid.', message: null });
                                      return;
                                    }
                                    updateSelectedAnimationPreset((preset) => ({ ...preset, config: parsed }));
                                  }}
                                >
                                  Apply JSON to preset
                                </Button>
                                <div className="text-xs text-muted-foreground">Structured controls now cover timing, color routing, and per-track keyframes. The JSON editor remains the escape hatch for full config control.</div>
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="space-y-3">
                          <div>
                            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Animated preview</p>
                            <p className="mt-1 text-xs text-muted-foreground">Preview now uses the linked preset config directly, including stable vs fluid layout, timing, color-source selection, and keyframed motion/glow/outline behavior.</p>
                          </div>
                          <CaptionStylePreview style={{ ...selectedCaptionStyle, animationPreset: selectedCaptionStyleAnimationPreset }} />
                          <div className="rounded-lg border border-border bg-background/40 p-3 text-xs text-muted-foreground">
                            Editing <span className="font-medium text-foreground">{selectedCaptionStyle.name}</span> currently previews with preset <span className="font-medium text-foreground">{selectedCaptionStyleAnimationPreset.name}</span>.
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          ) : null}

          <SectionFeedbackNotice feedback={sectionFeedback['caption-styles']} />
        </Card>
      </section>

      <section id="background-videos" className="scroll-mt-24">
        <Card className="space-y-5 p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <WorkflowSectionHeader
              title="Looping background video library"
              description="Upload and manage the reusable background videos used behind green-screen scene plates. Each project can override the default selection, and dashboard scene previews / final renders use the selected background."
              status={dirtyBySection['background-videos'] ? 'needs review' : 'approved'}
            />
            <SectionActions
              dirty={dirtyBySection['background-videos']}
              saving={sectionFeedback['background-videos'].saving}
              saveLabel="Save background library"
              onSave={() => void saveSection('background-videos')}
              onReset={() => resetSection('background-videos')}
            />
          </div>

          {backgroundVideos ? (
            <div className="space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-background/60 p-4">
                <div>
                  <h3 className="text-sm font-medium text-foreground">Background library</h3>
                  <p className="mt-1 max-w-3xl text-xs text-muted-foreground">
                    These videos are looped to the full narration duration during final render, then the green-screen character plates are chroma-keyed over them. Scene preview tabs also composite against the selected project background.
                  </p>
                </div>
                <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-border px-3 py-2 text-sm hover:bg-accent">
                  <span>{backgroundVideoUpload.isUploading ? 'Uploading…' : 'Upload background video'}</span>
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
                      event.currentTarget.value = '';
                    }}
                  />
                </label>
              </div>

              {backgroundVideoUpload.error ? <ValidationNotice title="Background upload failed" message={backgroundVideoUpload.error} /> : null}

              {backgroundVideos.backgrounds.length > 0 ? (
                <div className="grid gap-4 lg:grid-cols-2">
                  {backgroundVideos.backgrounds.map((background) => {
                    const isDefault = backgroundVideos.defaultBackgroundVideoId === background.id;
                    return (
                      <div key={background.id} className="space-y-3 rounded-lg border border-border bg-background/60 p-4">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-medium text-foreground">{background.name}</p>
                            <p className="mt-1 text-xs text-muted-foreground">{background.notes || 'No notes yet.'}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              type="button"
                              size="sm"
                              variant={isDefault ? 'secondary' : 'outline'}
                              onClick={() => {
                                updateSectionFeedbackState('background-videos', { error: null, message: null });
                                setBackgroundVideos({ ...backgroundVideos, defaultBackgroundVideoId: background.id });
                              }}
                            >
                              {isDefault ? 'Default background' : 'Set as default'}
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                updateSectionFeedbackState('background-videos', { error: null, message: null });
                                const remaining = backgroundVideos.backgrounds.filter((entry) => entry.id !== background.id);
                                setBackgroundVideos({
                                  defaultBackgroundVideoId: backgroundVideos.defaultBackgroundVideoId === background.id ? remaining[0]?.id : backgroundVideos.defaultBackgroundVideoId,
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
                              <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Background name</label>
                              <Input
                                value={background.name}
                                onChange={(event) => {
                                  updateSectionFeedbackState('background-videos', { error: null, message: null });
                                  setBackgroundVideos({
                                    ...backgroundVideos,
                                    backgrounds: backgroundVideos.backgrounds.map((entry) =>
                                      entry.id === background.id ? { ...entry, name: event.target.value } : entry
                                    ),
                                  });
                                }}
                              />
                            </div>
                            <div className="space-y-2">
                              <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Notes</label>
                              <Textarea
                                value={background.notes || ''}
                                onChange={(event) => {
                                  updateSectionFeedbackState('background-videos', { error: null, message: null });
                                  setBackgroundVideos({
                                    ...backgroundVideos,
                                    backgrounds: backgroundVideos.backgrounds.map((entry) =>
                                      entry.id === background.id ? { ...entry, notes: event.target.value } : entry
                                    ),
                                  });
                                }}
                                className="min-h-[100px] text-xs"
                                placeholder="Optional notes about where this background works best"
                              />
                            </div>
                          </div>
                          <div className="space-y-2">
                            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Preview</p>
                            {background.videoUrl ? (
                              <video src={background.videoUrl} controls muted loop playsInline preload="metadata" className="aspect-[9/16] w-full rounded-lg border border-border bg-black object-cover" />
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
                  No background videos yet. Upload one or more vertical (or croppable) loops here, then set a default so new projects inherit it automatically.
                </div>
              )}
            </div>
          ) : null}

          <SectionFeedbackNotice feedback={sectionFeedback['background-videos']} />
        </Card>
      </section>

      <section id="music-library" className="scroll-mt-24">
        <Card className="space-y-5 p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <WorkflowSectionHeader
              title="Music soundtrack library"
              description="Manage reusable ACE-Step soundtrack presets and their saved generated files. Each preset stores the prompt design, and once you generate its soundtrack here, final-video renders reuse that exact WAV until you regenerate it."
              status={dirtyBySection['music-library'] ? 'needs review' : 'approved'}
            />
            <SectionActions
              dirty={dirtyBySection['music-library']}
              saving={sectionFeedback['music-library'].saving}
              saveLabel="Save music library"
              onSave={() => void saveSection('music-library')}
              onReset={() => resetSection('music-library')}
            />
          </div>

          {videoRender ? (
            <div className="space-y-5">
              <div className="rounded-lg border border-border bg-background/60 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-medium text-foreground">Saved soundtrack presets</h3>
                    <p className="mt-1 max-w-3xl text-xs text-muted-foreground">
                      Each preset stores the ACE-Step prompt that describes the instrumental vibe. Generate the soundtrack once here, and final-video renders reuse that saved file instead of asking ACE-Step for a fresh song every time.
                    </p>
                  </div>
                  <Button variant="outline" onClick={addMusic} disabled={sectionFeedback['music-library'].saving}>
                    Add soundtrack
                  </Button>
                </div>

                <div className="mt-4 grid gap-4 lg:grid-cols-[280px,1fr]">
                  <div className="space-y-2">
                    <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Music library</label>
                    <Select
                      value={selectedMusicId || ''}
                      onChange={(event) => setSelectedMusicId(event.target.value)}
                      disabled={videoRender.musicTracks.length === 0}
                    >
                      {videoRender.musicTracks.map((track) => (
                        <option key={track.id} value={track.id}>
                          {track.name}{track.id === videoRender.defaultMusicTrackId ? ' (default)' : ''}
                        </option>
                      ))}
                    </Select>
                    <div className="rounded-lg border border-border bg-background/50 p-3 text-xs text-muted-foreground">
                      <p>
                        <span className="font-medium text-foreground">Default soundtrack:</span>{' '}
                        {videoRender.musicTracks.find((track) => track.id === videoRender.defaultMusicTrackId)?.name || 'Not set'}
                      </p>
                      <p className="mt-2">
                        <span className="font-medium text-foreground">Saved music mix volume:</span> {Math.round((videoRender.musicVolume || 0) * 100)}%
                      </p>
                      <p className="mt-2">Projects can override the soundtrack preset individually. The saved volume is global and is passed into the real final-video music mix.</p>
                    </div>
                  </div>

                  {selectedMusic ? (
                    <div className="space-y-4 rounded-lg border border-border bg-background/50 p-4">
                      <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-2">
                          <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Soundtrack name</label>
                          <Input
                            value={selectedMusic.name}
                            onChange={(event) => {
                              updateSelectedMusic((track) => ({ ...track, name: event.target.value }));
                            }}
                            placeholder="Curiosity underscore"
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Preview duration (seconds)</label>
                          <Input
                            type="number"
                            min={6}
                            max={30}
                            value={selectedMusic.previewDurationSeconds || 12}
                            onChange={(event) => {
                              updateSelectedMusic((track) => ({
                                ...track,
                                previewDurationSeconds: Math.min(30, Math.max(6, Number(event.target.value) || 12)),
                              }));
                            }}
                          />
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        <Button
                          type="button"
                          variant={selectedMusic.id === videoRender.defaultMusicTrackId ? 'default' : 'outline'}
                          onClick={() => {
                            updateSectionFeedbackState('music-library', { error: null, message: null });
                            setVideoRender({ ...videoRender, defaultMusicTrackId: selectedMusic.id });
                          }}
                        >
                          {selectedMusic.id === videoRender.defaultMusicTrackId ? 'Default soundtrack' : 'Set as default'}
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
                        <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Music prompt</label>
                        <Textarea
                          value={selectedMusic.prompt}
                          onChange={(event) => {
                            updateSelectedMusic((track) => ({ ...track, prompt: event.target.value }));
                          }}
                          className="min-h-[150px] font-mono text-xs"
                        />
                        <p className="text-xs text-muted-foreground">
                          This prompt is passed to ACE-Step only when you generate or regenerate the saved soundtrack file here. After that, final-video renders reuse the saved WAV directly.
                        </p>
                      </div>

                      <div className="space-y-2">
                        <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Notes</label>
                        <Textarea
                          value={selectedMusic.notes}
                          onChange={(event) => {
                            updateSelectedMusic((track) => ({ ...track, notes: event.target.value }));
                          }}
                          className="min-h-[90px] text-xs"
                          placeholder="Optional notes about when to use this soundtrack"
                        />
                      </div>

                      <div className="space-y-2">
                        <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Default music volume</label>
                        <div className="flex items-center gap-3">
                          <input
                            type="range"
                            min={0}
                            max={1}
                            step={0.01}
                            value={videoRender.musicVolume}
                            onChange={(event) => {
                              updateSectionFeedbackState('music-library', { error: null, message: null });
                              setVideoRender({ ...videoRender, musicVolume: Number(event.target.value) });
                            }}
                            className="w-full"
                          />
                          <div className="w-16 text-right text-sm text-foreground">{Math.round(videoRender.musicVolume * 100)}%</div>
                        </div>
                        <p className="text-xs text-muted-foreground">This exact saved volume is passed into the final ffmpeg music mix for every new final-video run.</p>
                      </div>

                      <div className="space-y-2">
                        <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Caption max words</label>
                        <Input
                          type="number"
                          min={2}
                          max={12}
                          value={videoRender.captionMaxWords}
                          onChange={(event) => {
                            updateSectionFeedbackState('music-library', { error: null, message: null });
                            setVideoRender({ ...videoRender, captionMaxWords: Math.max(2, Math.min(12, Number(event.target.value || 6))) });
                          }}
                          className="max-w-[140px]"
                        />
                        <p className="text-xs text-muted-foreground">Used by the deterministic caption generator that runs after forced alignment during the XML Script pipeline.</p>
                      </div>

                      <div className="space-y-4 rounded-lg border border-border bg-background/60 p-4">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div>
                            <h3 className="text-sm font-medium text-foreground">Saved soundtrack file</h3>
                            <p className="mt-1 text-xs text-muted-foreground">
                              Generate one reusable ACE-Step instrumental for this soundtrack entry. Final-video renders then reuse this exact file with the saved mix volume until you regenerate it.
                            </p>
                          </div>
                          <Button onClick={() => void generateMusicPreview()} disabled={musicPreview.isLoading || sectionFeedback['music-library'].saving}>
                            {musicPreview.isLoading ? 'Generating…' : hasGeneratedSoundtrack(selectedMusic) ? 'Regenerate saved soundtrack' : 'Generate saved soundtrack'}
                          </Button>
                        </div>

                        {musicPreview.error ? <ValidationNotice title="Saved soundtrack failed" message={musicPreview.error} /> : null}

                        {musicPreview.isLoading ? (
                          <div className="rounded-lg border border-border p-4">
                            <OrbitLoader label="Generating reusable ACE-Step soundtrack" />
                          </div>
                        ) : null}

                        {savedMusicAudioUrl ? (
                          <div className="space-y-3 rounded-lg border border-border bg-background/70 p-4">
                            <div className="grid gap-3 md:grid-cols-3">
                              <div>
                                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Saved soundtrack</p>
                                <p className="mt-1 text-sm text-foreground">{selectedMusic.name}</p>
                              </div>
                              <div>
                                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Duration</p>
                                <p className="mt-1 text-sm text-foreground">{selectedMusic.generatedDurationSeconds || selectedMusic.previewDurationSeconds || 12}s</p>
                              </div>
                              <div>
                                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Applied volume</p>
                                <p className="mt-1 text-sm text-foreground">{Math.round((videoRender.musicVolume || 0) * 100)}%</p>
                              </div>
                            </div>
                            <audio controls className="w-full" src={savedMusicAudioUrl} />
                            <div>
                              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Prompt snapshot used</p>
                              <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">{selectedMusic.generatedPrompt || selectedMusic.prompt}</p>
                            </div>
                            {selectedMusic.generatedAt ? (
                              <p className="text-xs text-muted-foreground">
                                Saved {new Date(selectedMusic.generatedAt).toLocaleString()}.
                                {musicPreview.reusedExisting === true ? ' Reused the existing soundtrack file on the latest request.' : musicPreview.reusedExisting === false ? ' Regenerated the soundtrack file on the latest request.' : ''}
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

          <SectionFeedbackNotice feedback={sectionFeedback['music-library']} />
        </Card>
      </section>


    </div>
  );
}
