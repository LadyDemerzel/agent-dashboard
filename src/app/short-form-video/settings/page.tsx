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

type PromptKey =
  | 'hooksGenerate'
  | 'hooksMore'
  | 'researchGenerate'
  | 'researchRevise'
  | 'scriptGenerate'
  | 'scriptRevise'
  | 'sceneImagesGenerate'
  | 'sceneImagesRevise'
  | 'videoGenerate'
  | 'videoRevise';

type SettingsSectionId =
  | 'tts-voice'
  | 'image-templates'
  | 'image-shared-constraints'
  | 'image-styles'
  | 'prompt-hooks'
  | 'prompt-research'
  | 'prompt-script';

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

interface VoiceLibraryEntry {
  id: string;
  name: string;
  mode: VoiceMode;
  voiceDesignPrompt: string;
  notes: string;
  previewText: string;
  speaker?: string;
  legacyInstruct?: string;
}

interface VideoRenderSettings {
  defaultVoiceId: string;
  voices: VoiceLibraryEntry[];
}

interface SettingsResponse {
  success: boolean;
  data?: {
    prompts: Record<PromptKey, string>;
    definitions: PromptDefinition[];
    imageStyles: ImageStyleSettings;
    videoRender: VideoRenderSettings;
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
    runId: string;
    sampleText: string;
    audioRelativePath: string;
    audioUrl: string;
    voice: {
      name: string;
      mode: VoiceMode;
      voiceDesignPrompt: string;
      speaker?: string;
    };
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

interface TtsPreviewState {
  isLoading: boolean;
  error: string | null;
  audioUrl: string | null;
  sampleText: string | null;
  voiceName: string | null;
  mode: VoiceMode | null;
  speaker: string | null;
  voiceDesignPrompt: string | null;
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
  {
    id: 'prompt-script',
    title: 'Script prompts',
    description: 'Templates still used when Scribe writes or revises the XML script.',
    keys: ['scriptGenerate', 'scriptRevise'],
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
    'image-templates': { saving: false, error: null, message: null },
    'image-shared-constraints': { saving: false, error: null, message: null },
    'image-styles': { saving: false, error: null, message: null },
    'prompt-hooks': { saving: false, error: null, message: null },
    'prompt-research': { saving: false, error: null, message: null },
    'prompt-script': { saving: false, error: null, message: null },
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
    mode: 'voice-design',
    voiceDesignPrompt:
      'Educated American English narrator with calm authority, polished pacing, natural warmth, and crisp short-form delivery. Speak only English and avoid non-speech sounds.',
    notes: '',
    previewText: 'Your jawline changes when your posture changes first.',
  };
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
    throw new Error(payload.error || 'Failed to generate TTS preview');
  }
  return payload.data;
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
  const [selectedStyleId, setSelectedStyleId] = useState<string | null>(null);
  const [selectedVoiceId, setSelectedVoiceId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [styleTestsById, setStyleTestsById] = useState<Record<string, StyleTestState>>({});
  const [styleReferenceUploadsById, setStyleReferenceUploadsById] = useState<Record<string, StyleReferenceUploadState>>({});
  const [sectionFeedback, setSectionFeedback] = useState<Record<SettingsSectionId, SectionFeedback>>(createEmptySectionFeedback());
  const [ttsPreview, setTtsPreview] = useState<TtsPreviewState>({
    isLoading: false,
    error: null,
    audioUrl: null,
    sampleText: null,
    voiceName: null,
    mode: null,
    speaker: null,
    voiceDesignPrompt: null,
  });

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
      setSelectedStyleId((current) => current || data.imageStyles.defaultStyleId || data.imageStyles.styles[0]?.id || null);
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
  const selectedStyleTest = selectedStyle ? styleTestsById[selectedStyle.id] : undefined;
  const selectedStyleUpload = selectedStyle ? styleReferenceUploadsById[selectedStyle.id] : undefined;
  const anyStyleTesting = useMemo(
    () => Object.values(styleTestsById).some((styleTest) => styleTest.isLoading),
    [styleTestsById]
  );
  const anySectionSaving = useMemo(
    () => Object.values(sectionFeedback).some((section) => section.saving),
    [sectionFeedback]
  );

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
      ? serializeForCompare(videoRender) !== serializeForCompare(initialVideoRender)
      : false;

    const promptGroupDirty = Object.fromEntries(
      PROMPT_GROUPS.map((group) => [
        group.id,
        serializeForCompare(pickPromptValues(prompts, group.keys)) !== serializeForCompare(pickPromptValues(initialPrompts, group.keys)),
      ])
    ) as Record<'prompt-hooks' | 'prompt-research' | 'prompt-script', boolean>;

    return {
      'tts-voice': ttsDirty,
      'image-templates': imageTemplateDirty,
      'image-shared-constraints': imageSharedDirty,
      'image-styles': imageStyleLibraryDirty,
      'prompt-hooks': promptGroupDirty['prompt-hooks'],
      'prompt-research': promptGroupDirty['prompt-research'],
      'prompt-script': promptGroupDirty['prompt-script'],
    };
  }, [imageStyles, initialImageStyles, initialPrompts, initialVideoRender, prompts, videoRender]);

  const sections = useMemo(
    () => [
      { id: 'tts-voice' as const, label: 'Voice library', dirty: dirtyBySection['tts-voice'] },
      { id: 'image-templates' as const, label: 'Nano Banana templates', dirty: dirtyBySection['image-templates'] },
      { id: 'image-shared-constraints' as const, label: 'Shared image constraints', dirty: dirtyBySection['image-shared-constraints'] },
      { id: 'image-styles' as const, label: 'Image style library', dirty: dirtyBySection['image-styles'] },
      { id: 'prompt-hooks' as const, label: 'Hook prompts', dirty: dirtyBySection['prompt-hooks'] },
      { id: 'prompt-research' as const, label: 'Research prompts', dirty: dirtyBySection['prompt-research'] },
      { id: 'prompt-script' as const, label: 'Script prompts', dirty: dirtyBySection['prompt-script'] },
    ],
    [dirtyBySection]
  );
  const activeSection = useSectionScrollSpy(sections);

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

    if (sectionId === 'tts-voice') {
      setVideoRender(data.videoRender);
      setInitialVideoRender(data.videoRender);
      setSelectedVoiceId((current) => {
        if (current && data.videoRender.voices.some((voice) => voice.id === current)) return current;
        return data.videoRender.defaultVoiceId || data.videoRender.voices[0]?.id || null;
      });
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
        return videoRender ? { videoRender } : null;
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
    if (!payload) return;

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
            ? 'Saved. New final-video runs will use this voice library and default voice immediately.'
            : sectionId === 'image-templates' || sectionId === 'image-shared-constraints' || sectionId === 'image-styles'
              ? 'Saved. New scene-image runs and tests will use this section immediately.'
              : 'Saved. New workflow runs will use this prompt section immediately.',
      });
    } catch (err) {
      updateSectionFeedbackState(sectionId, {
        saving: false,
        error: err instanceof Error ? err.message : 'Failed to save section',
        message: null,
      });
    }
  }

  function resetSection(sectionId: SettingsSectionId) {
    if (!dirtyBySection[sectionId]) return;
    const confirmed = window.confirm('Discard unsaved changes for this section?');
    if (!confirmed) return;

    updateSectionFeedbackState(sectionId, { error: null, message: null });

    if (sectionId === 'tts-voice' && initialVideoRender) {
      setVideoRender(initialVideoRender);
      setSelectedVoiceId(initialVideoRender.defaultVoiceId || initialVideoRender.voices[0]?.id || null);
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
    setSelectedVoiceId(remaining[0]?.id || null);
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
      const data = await parseTtsPreviewResponse(
        await fetch('/api/short-form-videos/settings/tts-preview', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            voice: {
              id: selectedVoice.id,
              name: selectedVoice.name,
              mode: selectedVoice.mode,
              voiceDesignPrompt: selectedVoice.voiceDesignPrompt,
              speaker: selectedVoice.speaker,
            },
            sampleText: selectedVoice.previewText,
          }),
        })
      );

      setTtsPreview({
        isLoading: false,
        error: null,
        audioUrl: data.audioUrl,
        sampleText: data.sampleText,
        voiceName: data.voice.name,
        mode: data.voice.mode,
        speaker: data.voice.speaker || null,
        voiceDesignPrompt: data.voice.voiceDesignPrompt,
      });
    } catch (err) {
      setTtsPreview((current) => ({
        ...current,
        isLoading: false,
        error: err instanceof Error ? err.message : 'Failed to generate TTS preview',
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
            Nano Banana scene-image templates and style rules, and the remaining hooks / research / script prompt templates.
            Each section now saves independently so you can iterate without committing unrelated draft changes.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => void loadSettings()} disabled={loading || anySectionSaving || anyStyleTesting || ttsPreview.isLoading || selectedStyleUpload?.isUploading}>
            Reload page state
          </Button>
        </div>
      </div>

      {error ? <ValidationNotice title="Settings error" message={error} /> : null}

      <SectionNavigator sections={sections} activeSection={activeSection} />

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
                  <Button variant="outline" onClick={addVoice} disabled={sectionFeedback['tts-voice'].saving}>
                    Add voice
                  </Button>
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
                          {voice.name}{voice.id === videoRender.defaultVoiceId ? ' (default)' : ''}
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
                      <div className="grid gap-4 md:grid-cols-2">
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
                      </div>

                      <div className="flex flex-wrap items-center gap-2 text-xs">
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
                            ? 'This prompt is passed directly to Qwen in voice-design mode. That means it shapes the generated voice, but the exact result is still model-generated rather than a locked reusable speaker ID.'
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
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div>
                            <h3 className="text-sm font-medium text-foreground">Voice preview loop</h3>
                            <p className="mt-1 text-xs text-muted-foreground">
                              Generates a lightweight preview for the currently selected voice entry — saved or unsaved — so you can test VoiceDesign prompts without running a full final video.
                            </p>
                          </div>
                          <Button onClick={() => void generateTtsPreview()} disabled={ttsPreview.isLoading || sectionFeedback['tts-voice'].saving}>
                            {ttsPreview.isLoading ? 'Generating…' : 'Preview voice'}
                          </Button>
                        </div>

                        <div className="space-y-2">
                          <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Preview sample text</label>
                          <Textarea
                            value={selectedVoice.previewText}
                            onChange={(event) => {
                              updateSelectedVoice((voice) => ({ ...voice, previewText: event.target.value }));
                            }}
                            className="min-h-[110px] font-mono text-xs"
                          />
                          <p className="text-xs text-muted-foreground">
                            Used only for testing this voice. Final-video generation still reads the real narration from the XML <code>&lt;script&gt;</code>.
                          </p>
                        </div>

                        {ttsPreview.error ? <ValidationNotice title="Voice preview failed" message={ttsPreview.error} /> : null}

                        {ttsPreview.isLoading ? (
                          <div className="rounded-lg border border-border p-4">
                            <OrbitLoader label="Generating Qwen voice preview" />
                          </div>
                        ) : null}

                        {ttsPreview.audioUrl ? (
                          <div className="space-y-3 rounded-lg border border-border bg-background/70 p-4">
                            <div className="grid gap-3 md:grid-cols-2">
                              <div>
                                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Previewing voice</p>
                                <p className="mt-1 text-sm text-foreground">{ttsPreview.voiceName}</p>
                              </div>
                              <div>
                                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Preview sample</p>
                                <p className="mt-1 text-sm text-foreground">{ttsPreview.sampleText}</p>
                              </div>
                            </div>
                            <audio controls className="w-full" src={ttsPreview.audioUrl} />
                            <div className="grid gap-3 md:grid-cols-2">
                              <div>
                                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Mode used</p>
                                <p className="mt-1 text-sm text-foreground">{ttsPreview.mode === 'custom-voice' ? 'Legacy custom voice' : 'VoiceDesign'}</p>
                              </div>
                              {ttsPreview.speaker ? (
                                <div>
                                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Speaker used</p>
                                  <p className="mt-1 text-sm text-foreground">{ttsPreview.speaker}</p>
                                </div>
                              ) : null}
                            </div>
                            <div>
                              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Prompt snapshot used</p>
                              <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">{ttsPreview.voiceDesignPrompt}</p>
                            </div>
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
              description="These are the real editable templates used by the direct dashboard scene-image path. The old generic scene-image prompt editors were removed because they were no longer consumed."
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

      {PROMPT_GROUPS.map((group) => {
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
      })}
    </div>
  );
}
