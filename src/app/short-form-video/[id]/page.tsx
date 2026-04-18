'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Badge } from '@/components/ui/badge';
import { DiffViewer } from '@/components/DiffViewer';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { OrbitLoader, Skeleton } from '@/components/ui/loading';
import { StatusBadge } from '@/components/StatusBadge';
import { usePolling } from '@/components/usePolling';
import { PipelinePanel, type PipelineStep } from '@/components/short-form-video/PipelinePanel';
import { SectionNavigator, useSectionScrollSpy } from '@/components/short-form-video/SectionNavigator';
import { SyntaxHighlightedCode } from '@/components/short-form-video/SyntaxHighlightedCode';
import {
  AutoRefreshBanner,
  PendingNotice,
  RevisionRequestNotice,
  StageReviewControls,
  StaleArtifactNotice,
  ValidationNotice,
  WorkflowSectionHeader,
} from '@/components/short-form-video/WorkflowShared';
import {
  normalizeShortFormProject,
  type HookOption,
  type Scene,
  type ShortFormProjectClient as Project,
  type StageDoc,
  type TextScriptRunClient,
} from '@/lib/short-form-video-client';
import { generateClientDiff } from '@/lib/diff-client';
import { usePageScrollRestoration } from '@/components/usePageScrollRestoration';

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

interface ImageStyleOption {
  id: string;
  name: string;
  description?: string;
}

interface VoiceOption {
  id: string;
  name: string;
  mode?: 'voice-design' | 'custom-voice';
  sourceType?: 'generated' | 'uploaded-reference';
}

interface MusicOption {
  id: string;
  name: string;
}

interface CaptionStyleOption {
  id: string;
  name: string;
  animationPreset?: 'none' | 'stable-pop' | 'fluid-pop' | 'pulse' | 'glow';
}

interface BackgroundVideoOption {
  id: string;
  name: string;
  notes?: string;
  videoUrl?: string;
}


type XmlPipelineStep = PipelineStep;

interface XmlScriptDoc {
  exists: boolean;
  status: string;
  content: string;
  updatedAt?: string;
  pending?: boolean;
  audioUrl?: string;
  audioPath?: string;
  originalAudioUrl?: string;
  originalAudioPath?: string;
  captions?: Array<{ id: string; index: number; text: string; start: number; end: number; wordCount?: number }>;
  pipeline?: {
    status: 'running' | 'completed' | 'failed' | 'idle';
    warning?: string;
    steps: Array<XmlPipelineStep & { progressPercent?: number; progressLabel?: string }>;
  };
}

interface WorkflowSettingsResponse {
  prompts?: Record<string, string>;
  definitions?: Array<{ key: string; title: string; description: string; stage: string }>;
  imageStyles?: {
    commonConstraints?: string;
    defaultStyleId?: string;
    styles?: ImageStyleOption[];
  };
  videoRender?: {
    defaultVoiceId?: string;
    voices?: VoiceOption[];
    defaultMusicTrackId?: string;
    musicVolume?: number;
    musicTracks?: MusicOption[];
    defaultCaptionStyleId?: string;
    captionStyles?: CaptionStyleOption[];
    captionMaxWords?: number;
    pauseRemoval?: {
      minSilenceDurationSeconds?: number;
      silenceThresholdDb?: number;
    };
  };
  backgroundVideos?: {
    defaultBackgroundVideoId?: string;
    backgrounds?: BackgroundVideoOption[];
  };
  textScript?: {
    defaultMaxIterations?: number;
    reviewPrompt?: string;
  };
}

type StageKey = 'research' | 'script' | 'scene-images' | 'video';

function stageLabel(stage: StageKey | 'hooks') {
  if (stage === 'scene-images') return 'Visuals';
  if (stage === 'hooks') return 'Hooks';
  return stage.charAt(0).toUpperCase() + stage.slice(1);
}

function approved(status?: string) {
  return status === 'approved' || status === 'published';
}

function extractBody(content: string) {
  const match = content.match(/^---\s*\n[\s\S]*?\n---\s*\n?([\s\S]*)$/);
  return match ? match[1] : content;
}

type TextScriptPhase = 'writing' | 'reviewing' | 'improving' | 'completed' | 'idle';

function getTextScriptPhaseLabel(phase: TextScriptPhase) {
  if (phase === 'writing') return 'Writing draft';
  if (phase === 'reviewing') return 'Grading draft';
  if (phase === 'improving') return 'Improving draft';
  if (phase === 'completed') return 'Completed';
  return 'Idle';
}

function getTextScriptPhaseStatus(phase: TextScriptPhase, step: 'writing' | 'reviewing' | 'improving') {
  if (phase === 'writing') return step === 'writing' ? 'active' : 'pending';
  if (phase === 'reviewing') return step === 'writing' ? 'completed' : step === 'reviewing' ? 'active' : 'pending';
  if (phase === 'improving') return step === 'improving' ? 'active' : 'completed';
  if (phase === 'completed') return 'completed';
  return 'pending';
}

function getTextScriptRunState(
  run: TextScriptRunClient | undefined,
  fallbackMaxIterations?: number | null
) {
  const iterations = run?.iterations || [];
  const maxIterations = run?.maxIterations || fallbackMaxIterations || Math.max(1, iterations.length || 1);
  const latestIteration = iterations[iterations.length - 1];
  const activeStep = run?.activeStep;
  const activeIterationNumber = run?.activeIterationNumber;

  if (run?.status === 'running' && activeStep) {
    const currentIteration = activeIterationNumber || latestIteration?.number || 1;
    return {
      phase: activeStep,
      currentIteration,
      maxIterations,
      completedIterations:
        activeStep === 'improving' || activeStep === 'completed'
          ? Math.max(0, currentIteration - 1)
          : Math.max(0, currentIteration - 1),
      statusText: run.activeStatusText,
    };
  }

  if (!run || run.status === 'running') {
    if (!latestIteration) {
      return {
        phase: 'writing' as const,
        currentIteration: 1,
        maxIterations,
        completedIterations: 0,
        statusText: run?.activeStatusText,
      };
    }

    if (!latestIteration.reviewContent?.trim() && !latestIteration.reviewDecision) {
      return {
        phase: 'reviewing' as const,
        currentIteration: latestIteration.number,
        maxIterations,
        completedIterations: Math.max(0, latestIteration.number - 1),
        statusText: run?.activeStatusText,
      };
    }

    if (latestIteration.reviewDecision === 'needs-improvement' && latestIteration.number < maxIterations) {
      return {
        phase: 'improving' as const,
        currentIteration: latestIteration.number + 1,
        maxIterations,
        completedIterations: latestIteration.number,
        statusText: run?.activeStatusText,
      };
    }
  }

  return {
    phase: iterations.length > 0 ? 'completed' as const : 'idle' as const,
    currentIteration: latestIteration?.number || 0,
    maxIterations,
    completedIterations: iterations.filter((iteration) => iteration.reviewDecision && iteration.reviewDecision !== 'manual-edit').length,
    statusText: run?.activeStatusText,
  };
}

async function parseJsonResponse<T>(response: Response, fallbackMessage: string) {
  const payload = (await response.json().catch(() => ({}))) as ApiResponse<T>;
  if (!response.ok || payload.success === false) {
    throw new Error(payload.error || fallbackMessage);
  }
  return payload;
}

function appendPreviewRefreshParam(url: string, token?: string | null) {
  if (!token) return url;
  return `${url}${url.includes('?') ? '&' : '?'}preview=${encodeURIComponent(token)}`;
}

function MarkdownOrCode({ content, mode }: { content: string; mode: 'markdown' | 'xml' | 'json' | 'text' }) {
  const body = useMemo(() => extractBody(content), [content]);

  if (!body.trim()) {
    return <div className="text-sm text-muted-foreground">Nothing here yet.</div>;
  }

  if (mode === 'markdown') {
    return (
      <article className="prose prose-sm prose-invert !max-w-none">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{body}</ReactMarkdown>
      </article>
    );
  }

  return <SyntaxHighlightedCode content={body} language={mode === 'xml' ? 'xml' : mode === 'json' ? 'json' : 'text'} />;
}

function ScenePreviewVideoCard({
  src,
  poster,
  label,
}: {
  src: string;
  poster?: string;
  label: string;
}) {
  const [activated, setActivated] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    if (!activated || !videoRef.current) return;
    const playAttempt = videoRef.current.play();
    if (playAttempt && typeof playAttempt.catch === 'function') {
      playAttempt.catch(() => {
        // Ignore autoplay failures. The controls remain available.
      });
    }
  }, [activated, src]);

  if (!activated) {
    return (
      <button
        type="button"
        onClick={() => setActivated(true)}
        className="group relative block aspect-[9/16] w-full overflow-hidden rounded-md border border-border bg-black text-left"
      >
        {poster ? (
          <img src={poster} alt={label} className="h-full w-full object-cover opacity-90 transition-opacity group-hover:opacity-100" />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-muted/30 text-xs text-muted-foreground">Preview ready</div>
        )}
        <div className="absolute inset-0 bg-black/35 transition-colors group-hover:bg-black/20" />
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="rounded-full border border-white/35 bg-black/70 px-3 py-1.5 text-xs font-medium text-white shadow-lg">
            Load preview video
          </span>
        </div>
      </button>
    );
  }

  return (
    <video
      ref={videoRef}
      src={src}
      poster={poster}
      muted
      loop
      playsInline
      controls
      preload="metadata"
      className="aspect-[9/16] w-full rounded-md border border-border bg-black object-cover"
    />
  );
}

function VideoPipelinePanel({ project }: { project: Project }) {
  const pipeline = project.video.pipeline;

  if (!pipeline || pipeline.steps.length === 0) return null;

  return (
    <PipelinePanel
      title="Final-video pipeline"
      description="This shows the actual persisted final-video artifacts, including whether narration/alignment were reused from XML Script or regenerated, plus the timing path the renderer actually used."
      status={pipeline.status}
      warning={pipeline.warning}
      steps={pipeline.steps}
      metadata={(
        <>
          {pipeline.workDir ? <span>Work dir: {pipeline.workDir}</span> : null}
          {pipeline.transcriptPath ? <span>Transcript: {pipeline.transcriptPath}</span> : null}
          {pipeline.alignmentInputPath ? <span>Alignment input: {pipeline.alignmentInputPath}</span> : null}
          {pipeline.alignmentOutputPath ? <span>Alignment output: {pipeline.alignmentOutputPath}</span> : null}
        </>
      )}
    />
  );
}

function HookSection({
  project,
  refresh,
}: {
  project: Project;
  refresh: () => Promise<unknown>;
}) {
  const [description, setDescription] = useState('');
  const [manualHookText, setManualHookText] = useState('');
  const [manualHookRationale, setManualHookRationale] = useState('');
  const [editingHookId, setEditingHookId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState('');
  const [editingRationale, setEditingRationale] = useState('');
  const [expanded, setExpanded] = useState(!project.hooks.selectedHookId);
  const [draftSelectedHookId, setDraftSelectedHookId] = useState<string | null>(project.hooks.selectedHookId ?? null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hooks = project.hooks.generations.flatMap((generation) =>
    generation.options.map((option) => ({
      ...option,
      generationId: generation.id,
      generationDescription: generation.description,
      isManual: generation.id.startsWith('manual-'),
    }))
  );
  const hooksById = useMemo(() => new Map(hooks.map((option) => [option.id, option])), [hooks]);
  const savedSelectedHookId = project.hooks.selectedHookId ?? null;
  const savedSelectedHook = savedSelectedHookId ? hooksById.get(savedSelectedHookId) ?? null : null;
  const editingOriginal = editingHookId ? hooksById.get(editingHookId) ?? null : null;
  const normalizedEditingText = editingText.trim();
  const normalizedEditingRationale = editingRationale.trim();
  const hasDraftEdit = Boolean(
    editingHookId &&
      editingOriginal &&
      (normalizedEditingText !== editingOriginal.text || normalizedEditingRationale !== (editingOriginal.rationale ?? ''))
  );
  const hasInvalidDraftEdit = Boolean(editingHookId && !normalizedEditingText);
  const draftSelectionChanged = (draftSelectedHookId ?? null) !== savedSelectedHookId;
  const hasUnsavedChanges = draftSelectionChanged || hasDraftEdit;
  const compactView = Boolean(savedSelectedHook && !expanded);
  const visibleHooks = compactView && savedSelectedHook ? [savedSelectedHook] : hooks;
  const hookStatus = project.hooks.pending
    ? 'working'
    : hasUnsavedChanges
      ? 'needs review'
      : project.hooks.selectedHookText
        ? 'approved'
        : hooks.length > 0
          ? 'needs review'
          : 'draft';
  const manualMutationsBlocked = project.hooks.pending || Boolean(project.hooks.validationError);

  useEffect(() => {
    setExpanded(!project.hooks.selectedHookId);
    setDraftSelectedHookId(project.hooks.selectedHookId ?? null);
    setEditingHookId(null);
    setEditingText('');
    setEditingRationale('');
    setError(null);
  }, [project.id, project.hooks.selectedHookId]);

  useEffect(() => {
    if (!expanded && !editingHookId) {
      setDraftSelectedHookId(savedSelectedHookId);
    }
  }, [savedSelectedHookId, expanded, editingHookId]);

  async function trigger(action: 'generate' | 'more') {
    setSaving(true);
    setError(null);

    try {
      await parseJsonResponse(
        await fetch(`/api/short-form-videos/${project.id}/hooks`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action, description }),
        }),
        'Failed to trigger hook generation'
      );
      setDescription('');
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to trigger hook generation');
    } finally {
      setSaving(false);
    }
  }

  function selectHook(option: HookOption) {
    setDraftSelectedHookId(option.id);
    setError(null);
  }

  async function addHook() {
    setSaving(true);
    setError(null);

    try {
      const payload = await parseJsonResponse<Project>(
        await fetch(`/api/short-form-videos/${project.id}/hooks`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'add',
            text: manualHookText,
            rationale: manualHookRationale,
          }),
        }),
        'Failed to add hook'
      );
      setManualHookText('');
      setManualHookRationale('');
      setDraftSelectedHookId(payload.data?.hooks?.selectedHookId ?? payload.data?.selectedHookId ?? draftSelectedHookId);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add hook');
    } finally {
      setSaving(false);
    }
  }

  function beginEdit(option: (HookOption & { isManual: boolean; generationId: string; generationDescription?: string })) {
    setEditingHookId(option.id);
    setEditingText(option.text);
    setEditingRationale(option.rationale || '');
    setError(null);
  }

  function cancelEdit() {
    setEditingHookId(null);
    setEditingText('');
    setEditingRationale('');
  }

  function startChangingHook() {
    setExpanded(true);
    setDraftSelectedHookId(savedSelectedHookId);
    cancelEdit();
    setError(null);
  }

  function cancelExpandedMode() {
    setExpanded(false);
    setDraftSelectedHookId(savedSelectedHookId);
    cancelEdit();
    setError(null);
  }

  async function saveHook() {
    if (hasInvalidDraftEdit) {
      setError('Hook text is required');
      return;
    }

    if (!hasUnsavedChanges) {
      setExpanded(false);
      return;
    }

    setSaving(true);
    setError(null);

    try {
      if (hasDraftEdit && editingHookId) {
        await parseJsonResponse(
          await fetch(`/api/short-form-videos/${project.id}/hooks`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'edit',
              hookId: editingHookId,
              text: normalizedEditingText,
              rationale: normalizedEditingRationale,
            }),
          }),
          'Failed to save hook changes'
        );
      }

      if (draftSelectedHookId && draftSelectionChanged) {
        await parseJsonResponse(
          await fetch(`/api/short-form-videos/${project.id}/hooks`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'select', hookId: draftSelectedHookId }),
          }),
          'Failed to save selected hook'
        );
      }

      cancelEdit();
      setExpanded(false);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save hook');
    } finally {
      setSaving(false);
    }
  }

  async function deleteHook(option: HookOption) {
    if (!window.confirm(`Delete this hook?

${option.text}`)) {
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const payload = await parseJsonResponse<Project>(
        await fetch(`/api/short-form-videos/${project.id}/hooks`, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ hookId: option.id }),
        }),
        'Failed to delete hook'
      );
      if (editingHookId === option.id) {
        cancelEdit();
      }
      setDraftSelectedHookId(payload.data?.hooks?.selectedHookId ?? payload.data?.selectedHookId ?? null);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete hook');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="space-y-4 p-5">
      <WorkflowSectionHeader
        title="Hook"
        description="Scribe generates multiple hook options using the content-hooks skill from the topic. In the default view, only the approved hook stays visible. Use Change hook to open the full editor, compare options, add manual hooks, generate more, and explicitly save the final selection."
        status={hookStatus}
      />

      {project.hooks.validationError ? (
        <ValidationNotice
          title="hooks.json is malformed"
          message={`${project.hooks.validationError} Fix the file or regenerate hooks before making manual hook changes.`}
        />
      ) : null}

      {error ? <ValidationNotice title="Hook action failed" message={error} /> : null}

      {hooks.length === 0 ? (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            {project.hooks.pending
              ? 'Hook generation is running. The dashboard will refresh automatically when new options are written.'
              : 'No hooks yet. Generate the first batch once the topic is set, or add one manually below.'}
          </p>
          <Button onClick={() => void trigger('generate')} disabled={project.hooks.pending || saving}>
            {project.hooks.pending || saving ? 'Generating hooks…' : 'Generate hooks'}
          </Button>
          {project.hooks.pending ? (
            <PendingNotice
              label="Waiting for Scribe to write hook options"
              hint="This section polls automatically, so new hooks should appear here without a manual refresh."
            />
          ) : null}
        </div>
      ) : null}

      {hooks.length > 0 ? (
        <>
          {expanded ? (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-background/60 px-4 py-3">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={hasUnsavedChanges ? 'secondary' : 'outline'}>
                  {hasUnsavedChanges ? 'Unsaved changes' : 'Editing hook selection'}
                </Badge>
                {savedSelectedHook ? <Badge variant="outline">Approved hook saved</Badge> : null}
              </div>
              <div className="flex flex-wrap gap-2">
                {savedSelectedHook ? (
                  <Button variant="outline" onClick={cancelExpandedMode} disabled={saving}>
                    Cancel
                  </Button>
                ) : null}
                <Button onClick={() => void saveHook()} disabled={saving || hasInvalidDraftEdit || !hasUnsavedChanges}>
                  {saving ? 'Saving…' : 'Save hook'}
                </Button>
              </div>
            </div>
          ) : savedSelectedHook ? (
            <div className="flex justify-end">
              <Button variant="outline" onClick={startChangingHook} disabled={saving || project.hooks.pending}>
                Change hook
              </Button>
            </div>
          ) : null}

          <div className="grid gap-3">
            {visibleHooks.map((option) => {
              const isSavedSelected = option.id === savedSelectedHookId;
              const isDraftSelected = option.id === draftSelectedHookId;
              const editing = expanded && editingHookId === option.id;
              const cardClass = isDraftSelected
                ? isSavedSelected
                  ? 'border-emerald-500 bg-emerald-500/10'
                  : 'border-amber-500 bg-amber-500/10'
                : isSavedSelected
                  ? 'border-emerald-500/60 bg-emerald-500/5'
                  : 'border-border';

              return (
                <div key={option.id} className={`rounded-lg border p-4 transition-colors ${cardClass}`}>
                  {editing ? (
                    <div className="space-y-3">
                      <div className="flex flex-wrap items-center gap-2">
                        {isSavedSelected ? <Badge variant="outline">Saved</Badge> : null}
                        {isDraftSelected ? <Badge variant="secondary">Draft selection</Badge> : null}
                        {option.isManual ? <Badge variant="outline">Manual</Badge> : null}
                      </div>
                      <Textarea
                        value={editingText}
                        onChange={(event) => setEditingText(event.target.value)}
                        className="min-h-[90px]"
                        placeholder="Hook text (up to 10 words)"
                      />
                      <Input
                        value={editingRationale}
                        onChange={(event) => setEditingRationale(event.target.value)}
                        placeholder="Optional rationale"
                      />
                      <div className="flex flex-wrap gap-2">
                        <Button variant="outline" onClick={cancelEdit} disabled={saving}>
                          Done editing
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <button
                        type="button"
                        onClick={() => selectHook(option)}
                        disabled={saving || !expanded}
                        className={`flex-1 text-left ${expanded ? '' : 'cursor-default'}`}
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          {isSavedSelected ? <Badge variant="outline">Saved</Badge> : null}
                          {isDraftSelected && expanded ? <Badge variant="secondary">Draft selection</Badge> : null}
                          {option.isManual ? <Badge variant="outline">Manual</Badge> : null}
                        </div>
                        <p className="mt-2 text-sm text-foreground">{option.text}</p>
                        {option.rationale ? <p className="mt-2 text-xs text-muted-foreground">{option.rationale}</p> : null}
                      </button>
                      {expanded ? (
                        <div className="flex shrink-0 flex-wrap gap-2">
                          <Button variant="outline" onClick={() => beginEdit(option)} disabled={saving || manualMutationsBlocked}>
                            Edit
                          </Button>
                          <Button variant="outline" onClick={() => void deleteHook(option)} disabled={saving || manualMutationsBlocked}>
                            Delete
                          </Button>
                        </div>
                      ) : null}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {expanded ? (
            <>
              <div className="space-y-3 border-t border-border pt-4">
                <div>
                  <h3 className="text-sm font-medium text-foreground">Add hook manually</h3>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Manual hooks are saved into this project’s hooks.json alongside generated batches. If nothing is selected yet, the newly added hook becomes the selected hook automatically.
                  </p>
                </div>
                <Textarea
                  value={manualHookText}
                  onChange={(event) => setManualHookText(event.target.value)}
                  placeholder="Manual hook text (up to 10 words)"
                  className="min-h-[90px]"
                />
                <Input
                  value={manualHookRationale}
                  onChange={(event) => setManualHookRationale(event.target.value)}
                  placeholder="Optional rationale"
                />
                <Button onClick={() => void addHook()} disabled={saving || manualMutationsBlocked || !manualHookText.trim()}>
                  {saving ? 'Saving…' : 'Add manual hook'}
                </Button>
              </div>

              <div className="space-y-3 border-t border-border pt-4">
                <Textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Optional direction for more hooks (e.g. punchier, more contrarian, more curiosity-driven)"
                  className="min-h-[90px]"
                />
                <Button variant="outline" onClick={() => void trigger('more')} disabled={project.hooks.pending || saving}>
                  {project.hooks.pending || saving ? 'Generating…' : 'Generate more hooks'}
                </Button>
                {project.hooks.pending ? (
                  <PendingNotice
                    label="Generating additional hook options"
                    hint="You can keep this page open — it will refresh automatically while the new batch is being written."
                  />
                ) : null}
              </div>
            </>
          ) : null}
        </>
      ) : null}

      {hooks.length === 0 ? (
        <div className="space-y-3 border-t border-border pt-4">
          <div>
            <h3 className="text-sm font-medium text-foreground">Add hook manually</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Manual hooks are saved into this project’s hooks.json alongside generated batches. If nothing is selected yet, the newly added hook becomes the selected hook automatically.
            </p>
          </div>
          <Textarea
            value={manualHookText}
            onChange={(event) => setManualHookText(event.target.value)}
            placeholder="Manual hook text (up to 10 words)"
            className="min-h-[90px]"
          />
          <Input
            value={manualHookRationale}
            onChange={(event) => setManualHookRationale(event.target.value)}
            placeholder="Optional rationale"
          />
          <Button onClick={() => void addHook()} disabled={saving || manualMutationsBlocked || !manualHookText.trim()}>
            {saving ? 'Saving…' : 'Add manual hook'}
          </Button>
        </div>
      ) : null}
    </Card>
  );
}

function getXmlPipelineSteps(doc: XmlScriptDoc | null, ids: string[]) {
  const steps = doc?.pipeline?.steps || [];
  return ids.map((id) => steps.find((step) => step.id === id)).filter((step): step is NonNullable<typeof steps[number]> => Boolean(step));
}

function getXmlPipelineStep(doc: XmlScriptDoc | null, id: string) {
  return doc?.pipeline?.steps.find((step) => step.id === id) || null;
}

function getXmlPipelineTaskStatus(steps: Array<XmlPipelineStep & { progressPercent?: number; progressLabel?: string }>): 'running' | 'completed' | 'failed' | 'idle' {
  if (steps.some((step) => step.status === 'failed')) return 'failed';
  if (steps.some((step) => step.status === 'active')) return 'running';
  if (steps.length > 0 && steps.every((step) => step.status === 'completed')) return 'completed';
  return 'idle';
}

function XmlTaskPipelinePanel({
  doc,
  title,
  description,
  stepIds,
}: {
  doc: XmlScriptDoc | null;
  title: string;
  description: string;
  stepIds: string[];
}) {
  const steps = getXmlPipelineSteps(doc, stepIds);
  if (steps.length === 0) return null;

  return (
    <PipelinePanel
      title={title}
      description={description}
      status={getXmlPipelineTaskStatus(steps)}
      warning={doc?.pipeline?.warning}
      steps={steps}
    />
  );
}

function formatTimelineSeconds(value: number) {
  if (!Number.isFinite(value)) return '0.0s';
  return `${value.toFixed(1)}s`;
}

function VisualCaptionTimeline({ captions, scenes }: { captions: NonNullable<Project['xmlScript']['captions']>; scenes: Project['sceneImages']['scenes'] }) {
  const visualSpans = scenes.filter((scene) => typeof scene.startTime === 'number' && typeof scene.endTime === 'number' && (scene.endTime || 0) > (scene.startTime || 0));
  const captionSpans = (captions || []).filter((caption) => caption.end > caption.start);
  const maxEnd = Math.max(
    ...visualSpans.map((scene) => scene.endTime || 0),
    ...captionSpans.map((caption) => caption.end),
    0,
  );

  if (maxEnd <= 0 || (visualSpans.length === 0 && captionSpans.length === 0)) return null;

  return (
    <div className="rounded-lg border border-border bg-background/60 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-medium text-foreground">Caption / visual timeline</h3>
          <p className="mt-1 max-w-2xl text-xs text-muted-foreground">
            Top lane = deterministic captions JSON. Bottom lane = XML visual spans. Width is proportional to actual time so you can see overlaps instead of a 1:1 caption-to-image mapping.
          </p>
        </div>
        <Badge variant="outline">{formatTimelineSeconds(maxEnd)} total</Badge>
      </div>
      <div className="mt-4 space-y-4 overflow-x-auto pb-2">
        <div className="min-w-[720px] space-y-3">
          <div>
            <div className="mb-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Captions</div>
            <div className="relative h-16 rounded-md border border-border bg-background/70">
              {captionSpans.map((caption) => (
                <div
                  key={caption.id}
                  className="absolute top-2 h-12 overflow-hidden rounded bg-primary/15 px-2 py-1 text-[11px] text-foreground ring-1 ring-primary/30"
                  style={{
                    left: `${(caption.start / maxEnd) * 100}%`,
                    width: `${Math.max(3, ((caption.end - caption.start) / maxEnd) * 100)}%`,
                  }}
                  title={`${caption.text} (${formatTimelineSeconds(caption.start)} → ${formatTimelineSeconds(caption.end)})`}
                >
                  <div className="truncate font-medium">{caption.text}</div>
                  <div className="truncate text-[10px] text-muted-foreground">{formatTimelineSeconds(caption.start)} → {formatTimelineSeconds(caption.end)}</div>
                </div>
              ))}
            </div>
          </div>
          <div>
            <div className="mb-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Visuals</div>
            <div className="relative h-16 rounded-md border border-border bg-background/70">
              {visualSpans.map((scene) => (
                <div
                  key={scene.id}
                  className="absolute top-2 h-12 overflow-hidden rounded bg-emerald-500/15 px-2 py-1 text-[11px] text-foreground ring-1 ring-emerald-500/30"
                  style={{
                    left: `${((scene.startTime || 0) / maxEnd) * 100}%`,
                    width: `${Math.max(3, (((scene.endTime || 0) - (scene.startTime || 0)) / maxEnd) * 100)}%`,
                  }}
                  title={`${scene.caption} (${formatTimelineSeconds(scene.startTime || 0)} → ${formatTimelineSeconds(scene.endTime || 0)})`}
                >
                  <div className="truncate font-medium">V{scene.number} · {scene.caption}</div>
                  <div className="truncate text-[10px] text-muted-foreground">{formatTimelineSeconds(scene.startTime || 0)} → {formatTimelineSeconds(scene.endTime || 0)}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function XMLScriptSection({ project, onProjectRefresh }: { project: Project; onProjectRefresh: () => Promise<unknown> }) {
  const [doc, setDoc] = useState<XmlScriptDoc | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [requestNotes, setRequestNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [voiceOptions, setVoiceOptions] = useState<VoiceOption[]>([]);
  const [defaultVoiceId, setDefaultVoiceId] = useState<string>('');
  const [defaultCaptionMaxWords, setDefaultCaptionMaxWords] = useState<number | null>(null);
  const [defaultPauseRemovalMinSilenceDurationSeconds, setDefaultPauseRemovalMinSilenceDurationSeconds] = useState<number | null>(null);
  const [defaultPauseRemovalSilenceThresholdDb, setDefaultPauseRemovalSilenceThresholdDb] = useState<number | null>(null);
  const [projectCaptionMaxWordsOverride, setProjectCaptionMaxWordsOverride] = useState<string>(project.captionMaxWordsOverride ? String(project.captionMaxWordsOverride) : '');
  const [projectPauseRemovalMinSilenceDurationSecondsOverride, setProjectPauseRemovalMinSilenceDurationSecondsOverride] = useState<string>(
    project.pauseRemovalMinSilenceDurationSecondsOverride ? String(project.pauseRemovalMinSilenceDurationSecondsOverride) : ''
  );
  const [projectPauseRemovalSilenceThresholdDbOverride, setProjectPauseRemovalSilenceThresholdDbOverride] = useState<string>(
    project.pauseRemovalSilenceThresholdDbOverride ? String(project.pauseRemovalSilenceThresholdDbOverride) : ''
  );
  const [savingVoice, setSavingVoice] = useState(false);
  const [savingCaptionMaxWords, setSavingCaptionMaxWords] = useState(false);
  const [savingPauseRemoval, setSavingPauseRemoval] = useState(false);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [captionMaxWordsError, setCaptionMaxWordsError] = useState<string | null>(null);
  const [pauseRemovalError, setPauseRemovalError] = useState<string | null>(null);
  const shouldPoll = Boolean(project.id && (loading || doc?.pending || doc?.pipeline?.status === 'running'));

  const load = useCallback(async () => {
    try {
      setRefreshing(true);
      const payload = await parseJsonResponse<XmlScriptDoc>(await fetch(`/api/short-form-videos/${project.id}/xml-script`, { cache: 'no-store' }), 'Failed to load XML script');
      setDoc(payload.data || null);
      setDraft(payload.data?.content || '');
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load XML script');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [project.id]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    if (!shouldPoll) return;
    const timer = window.setInterval(() => { void load(); }, 4000);
    return () => window.clearInterval(timer);
  }, [load, shouldPoll]);

  useEffect(() => {
    setProjectCaptionMaxWordsOverride(project.captionMaxWordsOverride ? String(project.captionMaxWordsOverride) : '');
  }, [project.captionMaxWordsOverride]);

  useEffect(() => {
    setProjectPauseRemovalMinSilenceDurationSecondsOverride(
      project.pauseRemovalMinSilenceDurationSecondsOverride ? String(project.pauseRemovalMinSilenceDurationSecondsOverride) : ''
    );
  }, [project.pauseRemovalMinSilenceDurationSecondsOverride]);

  useEffect(() => {
    setProjectPauseRemovalSilenceThresholdDbOverride(
      project.pauseRemovalSilenceThresholdDbOverride ? String(project.pauseRemovalSilenceThresholdDbOverride) : ''
    );
  }, [project.pauseRemovalSilenceThresholdDbOverride]);

  useEffect(() => {
    let cancelled = false;

    async function loadVoiceOptions() {
      try {
        const payload = await parseJsonResponse<WorkflowSettingsResponse>(
          await fetch('/api/short-form-videos/settings', { cache: 'no-store' }),
          'Failed to load voice settings'
        );
        const nextVoices = Array.isArray(payload.data?.videoRender?.voices)
          ? payload.data.videoRender.voices.filter(
              (voice): voice is VoiceOption => Boolean(voice && typeof voice.id === 'string' && typeof voice.name === 'string')
            )
          : [];
        if (!cancelled) {
          setVoiceOptions(nextVoices);
          setDefaultVoiceId(payload.data?.videoRender?.defaultVoiceId || '');
          setDefaultCaptionMaxWords(typeof payload.data?.videoRender?.captionMaxWords === 'number' ? payload.data.videoRender.captionMaxWords : null);
          setDefaultPauseRemovalMinSilenceDurationSeconds(
            typeof payload.data?.videoRender?.pauseRemoval?.minSilenceDurationSeconds === 'number'
              ? payload.data.videoRender.pauseRemoval.minSilenceDurationSeconds
              : null
          );
          setDefaultPauseRemovalSilenceThresholdDb(
            typeof payload.data?.videoRender?.pauseRemoval?.silenceThresholdDb === 'number'
              ? payload.data.videoRender.pauseRemoval.silenceThresholdDb
              : null
          );
        }
      } catch {
        if (!cancelled) {
          setVoiceOptions([]);
          setDefaultVoiceId('');
          setDefaultCaptionMaxWords(null);
          setDefaultPauseRemovalMinSilenceDurationSeconds(null);
          setDefaultPauseRemovalSilenceThresholdDb(null);
        }
      }
    }

    void loadVoiceOptions();
    return () => {
      cancelled = true;
    };
  }, []);

  async function saveManual(status?: string) {
    setSaving(true);
    try {
      const payload = await parseJsonResponse<XmlScriptDoc>(await fetch(`/api/short-form-videos/${project.id}/xml-script`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: draft, ...(status ? { status } : {}) }),
      }), 'Failed to save XML script');
      setDoc(payload.data || null);
      setEditing(false);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save XML script');
    } finally {
      setSaving(false);
    }
  }

  async function saveProjectVoice(voiceId: string) {
    setSavingVoice(true);
    setVoiceError(null);
    try {
      await parseJsonResponse(
        await fetch(`/api/short-form-videos/${project.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ selectedVoiceId: voiceId }),
        }),
        'Failed to update XML narration voice'
      );
      await onProjectRefresh();
    } catch (err) {
      setVoiceError(err instanceof Error ? err.message : 'Failed to update XML narration voice');
    } finally {
      setSavingVoice(false);
    }
  }

  async function saveProjectCaptionMaxWords(value: string | null) {
    setSavingCaptionMaxWords(true);
    setCaptionMaxWordsError(null);
    try {
      await parseJsonResponse(
        await fetch(`/api/short-form-videos/${project.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ captionMaxWordsOverride: value === null ? null : Math.max(2, Math.min(12, Number(value) || 6)) }),
        }),
        'Failed to update XML caption max words override'
      );
      await onProjectRefresh();
    } catch (err) {
      setCaptionMaxWordsError(err instanceof Error ? err.message : 'Failed to update XML caption max words override');
    } finally {
      setSavingCaptionMaxWords(false);
    }
  }

  async function saveProjectPauseRemoval(minValue: string | null, thresholdValue: string | null) {
    setSavingPauseRemoval(true);
    setPauseRemovalError(null);
    try {
      await parseJsonResponse(
        await fetch(`/api/short-form-videos/${project.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            pauseRemovalMinSilenceDurationSecondsOverride:
              minValue === null ? null : Math.min(2.5, Math.max(0.1, Math.round((Number(minValue) || 0.35) * 100) / 100)),
            pauseRemovalSilenceThresholdDbOverride:
              thresholdValue === null ? null : Math.min(-5, Math.max(-80, Math.round((Number(thresholdValue) || -40) * 10) / 10)),
          }),
        }),
        'Failed to update XML pause-removal override'
      );
      await onProjectRefresh();
    } catch (err) {
      setPauseRemovalError(err instanceof Error ? err.message : 'Failed to update XML pause-removal override');
    } finally {
      setSavingPauseRemoval(false);
    }
  }

  const activeVoiceLabel = project.selectedVoiceName || voiceOptions.find((voice) => voice.id === defaultVoiceId)?.name || 'default voice';
  const effectiveCaptionMaxWords = project.captionMaxWordsOverride || defaultCaptionMaxWords;
  const effectivePauseRemovalMinSilenceDurationSeconds = project.pauseRemovalMinSilenceDurationSecondsOverride || defaultPauseRemovalMinSilenceDurationSeconds;
  const effectivePauseRemovalSilenceThresholdDb = project.pauseRemovalSilenceThresholdDbOverride || defaultPauseRemovalSilenceThresholdDb;
  const narrationStatus = getXmlPipelineTaskStatus(getXmlPipelineSteps(doc, ['narration', 'silence-removal', 'alignment']));
  const captionsStep = getXmlPipelineStep(doc, 'captions');
  const captionsStatus = getXmlPipelineTaskStatus(getXmlPipelineSteps(doc, ['captions']));
  const visualsStep = getXmlPipelineStep(doc, 'xml');
  const visualsStatus = getXmlPipelineTaskStatus(getXmlPipelineSteps(doc, ['xml']));
  const captionsJsonDetail = captionsStep?.details?.find((detail) => detail.id === 'caption-plan') || null;

  async function triggerTask(task: 'full' | 'narration' | 'silence' | 'captions' | 'visuals') {
    setSaving(true);
    try {
      const payload = await parseJsonResponse<XmlScriptDoc>(await fetch(`/api/short-form-videos/${project.id}/xml-script`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ task, notes: requestNotes }),
      }), 'Failed to start XML workflow task');
      if (task === 'visuals' || task === 'full') {
        setRequestNotes('');
      }
      setDoc(payload.data || null);
      setDraft(payload.data?.content || '');
      setError(null);
      void onProjectRefresh().catch(() => undefined);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start XML workflow task');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <Card id="narration-audio" className="space-y-4 p-5">
        <WorkflowSectionHeader
          title="Narration Audio"
          description="Generate the original narration WAV, remove pauses from it, then force-align the silence-removed version. Final Video reuses those exact downstream artifacts instead of regenerating them."
          status={narrationStatus === 'running' ? 'working' : narrationStatus === 'completed' ? 'approved' : narrationStatus === 'failed' ? 'failed' : 'draft'}
        />
        {error ? <ValidationNotice title="XML workflow issue" message={error} /> : null}
        {voiceError ? <ValidationNotice title="Narration voice issue" message={voiceError} /> : null}
        {pauseRemovalError ? <ValidationNotice title="Pause-removal settings issue" message={pauseRemovalError} /> : null}
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => void triggerTask('narration')} disabled={saving || doc?.pending}>
            {saving ? 'Starting…' : doc?.originalAudioUrl ? 'Regenerate original narration + downstream timing' : 'Generate narration audio'}
          </Button>
          <Button
            variant="outline"
            onClick={() => void triggerTask('silence')}
            disabled={saving || doc?.pending || !doc?.originalAudioUrl}
          >
            {saving ? 'Starting…' : doc?.audioUrl ? 'Re-run pause removal + alignment' : 'Run pause removal + alignment'}
          </Button>
          <Button variant="outline" onClick={() => void load()} disabled={refreshing}>
            {refreshing ? 'Refreshing…' : 'Refresh'}
          </Button>
        </div>
        <div className="rounded-lg border border-border bg-background/60 p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="text-sm font-medium text-foreground">Voice for narration</h3>
              <p className="mt-1 max-w-2xl text-xs text-muted-foreground">
                Choose the narration voice before running Narration Audio. Captions and visuals planning can then rerun independently against the same narration/alignment artifacts.
              </p>
            </div>
            <Link href="/short-form-video/settings#tts-voice" target="_blank" rel="noreferrer" className="text-xs text-muted-foreground hover:text-foreground">
              Open voice library ↗
            </Link>
          </div>
          <div className="mt-3 flex flex-col gap-3 md:flex-row md:items-center">
            <Select
              value={project.selectedVoiceId || defaultVoiceId || ''}
              onChange={(event) => void saveProjectVoice(event.target.value)}
              disabled={savingVoice || voiceOptions.length === 0 || Boolean(doc?.pending)}
              className="max-w-sm"
            >
              {voiceOptions.map((voice) => (
                <option key={voice.id} value={voice.id}>
                  {voice.name}{voice.sourceType === 'uploaded-reference' ? ' [uploaded reference]' : voice.mode === 'custom-voice' ? ' [legacy custom]' : ' [generated]'}{voice.id === defaultVoiceId ? ' (default)' : ''}
                </option>
              ))}
            </Select>
            <div className="text-xs text-muted-foreground">
              {savingVoice
                ? 'Saving narration voice…'
                : project.selectedVoiceName
                  ? `Current narration voice: ${project.selectedVoiceName}`
                  : defaultVoiceId
                    ? `Using the current default voice: ${activeVoiceLabel}`
                    : 'Using the fallback default voice.'}
            </div>
          </div>
        </div>
        <div className="rounded-lg border border-border bg-background/60 p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="text-sm font-medium text-foreground">Pause removal / silence trimming</h3>
              <p className="mt-1 max-w-2xl text-xs text-muted-foreground">
                These project-level overrides control the ffmpeg silence-removal pass that runs after original narration generation. Re-running this step also re-runs forced alignment so downstream timing stays in sync.
              </p>
            </div>
            <Link href="/short-form-video/settings#pause-removal" target="_blank" rel="noreferrer" className="text-xs text-muted-foreground hover:text-foreground">
              Open global defaults ↗
            </Link>
          </div>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Remove pauses longer than (seconds)</label>
              <Input
                type="number"
                min={0.1}
                max={2.5}
                step={0.01}
                value={projectPauseRemovalMinSilenceDurationSecondsOverride}
                onChange={(event) => setProjectPauseRemovalMinSilenceDurationSecondsOverride(event.target.value)}
                placeholder={defaultPauseRemovalMinSilenceDurationSeconds ? String(defaultPauseRemovalMinSilenceDurationSeconds) : '0.35'}
                className="max-w-[160px]"
                disabled={savingPauseRemoval || Boolean(doc?.pending)}
              />
              <p className="text-xs text-muted-foreground">Longer silent spans than this are trimmed out of the processed narration file.</p>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Silence threshold (dB)</label>
              <Input
                type="number"
                min={-80}
                max={-5}
                step={0.1}
                value={projectPauseRemovalSilenceThresholdDbOverride}
                onChange={(event) => setProjectPauseRemovalSilenceThresholdDbOverride(event.target.value)}
                placeholder={defaultPauseRemovalSilenceThresholdDb ? String(defaultPauseRemovalSilenceThresholdDb) : '-40'}
                className="max-w-[160px]"
                disabled={savingPauseRemoval || Boolean(doc?.pending)}
              />
              <p className="text-xs text-muted-foreground">Anything quieter than this is treated as silence during trimming.</p>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              size="sm"
              onClick={() => void saveProjectPauseRemoval(
                projectPauseRemovalMinSilenceDurationSecondsOverride || null,
                projectPauseRemovalSilenceThresholdDbOverride || null
              )}
              disabled={savingPauseRemoval || Boolean(doc?.pending)}
            >
              {savingPauseRemoval ? 'Saving…' : 'Save pause-removal override'}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => void saveProjectPauseRemoval(null, null)}
              disabled={savingPauseRemoval || (!project.pauseRemovalMinSilenceDurationSecondsOverride && !project.pauseRemovalSilenceThresholdDbOverride) || Boolean(doc?.pending)}
            >
              Use global defaults
            </Button>
          </div>
          <div className="mt-3 text-xs text-muted-foreground">
            {savingPauseRemoval
              ? 'Saving pause-removal overrides…'
              : project.pauseRemovalMinSilenceDurationSecondsOverride || project.pauseRemovalSilenceThresholdDbOverride
                ? `Effective pause removal: ${effectivePauseRemovalMinSilenceDurationSeconds?.toFixed(2) || '0.35'}s minimum silence, threshold ${effectivePauseRemovalSilenceThresholdDb?.toFixed(1) || '-40.0'} dB (project override).`
                : `Effective pause removal: ${effectivePauseRemovalMinSilenceDurationSeconds?.toFixed(2) || '0.35'}s minimum silence, threshold ${effectivePauseRemovalSilenceThresholdDb?.toFixed(1) || '-40.0'} dB (global default).`}
          </div>
        </div>
        <XmlTaskPipelinePanel
          doc={doc}
          title="Narration Audio pipeline"
          description="This task now has three steps: generate the original narration audio, remove pauses from it, then run forced alignment on the silence-removed version."
          stepIds={['narration', 'silence-removal', 'alignment']}
        />
        {(doc?.originalAudioUrl || doc?.audioUrl) ? (
          <div className="grid gap-4 xl:grid-cols-2">
            {doc?.originalAudioUrl ? (
              <div className="space-y-2 rounded-lg border border-border bg-background/60 p-4">
                <div>
                  <h3 className="text-sm font-medium text-foreground">Original narration audio</h3>
                  <p className="mt-1 text-xs text-muted-foreground">Untrimmed source narration kept for comparison and reprocessing.</p>
                </div>
                <audio src={doc.originalAudioUrl} controls className="w-full" preload="metadata" />
              </div>
            ) : null}
            {doc?.audioUrl ? (
              <div className="space-y-2 rounded-lg border border-border bg-background/60 p-4">
                <div>
                  <h3 className="text-sm font-medium text-foreground">Silence-removed narration audio</h3>
                  <p className="mt-1 text-xs text-muted-foreground">This processed narration audio becomes the downstream source of truth for alignment, captions, visuals timing, and final video.</p>
                </div>
                <audio src={doc.audioUrl} controls className="w-full" preload="metadata" />
              </div>
            ) : null}
          </div>
        ) : null}
      </Card>

      <Card id="plan-captions" className="space-y-4 p-5">
        <WorkflowSectionHeader
          title="Plan Captions"
          description="Generate the deterministic caption JSON from the existing transcript + forced alignment. This reruns independently without regenerating narration audio."
          status={captionsStatus === 'running' ? 'working' : captionsStatus === 'completed' ? 'approved' : captionsStatus === 'failed' ? 'failed' : 'draft'}
        />
        {captionMaxWordsError ? <ValidationNotice title="Caption settings issue" message={captionMaxWordsError} /> : null}
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => void triggerTask('captions')} disabled={saving || doc?.pending}>
            {saving ? 'Starting…' : (doc?.captions?.length || 0) > 0 ? 'Re-plan captions' : 'Plan captions'}
          </Button>
          <Button variant="outline" onClick={() => void load()} disabled={refreshing}>
            {refreshing ? 'Refreshing…' : 'Refresh'}
          </Button>
        </div>
        <div className="rounded-lg border border-border bg-background/60 p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="text-sm font-medium text-foreground">Caption max words</h3>
              <p className="mt-1 text-xs text-muted-foreground">Optional project override for deterministic caption chunking. Leave blank to use the global setting.</p>
            </div>
            <Link href="/short-form-video/settings#music-library" target="_blank" rel="noreferrer" className="text-xs text-muted-foreground hover:text-foreground">
              Open global setting ↗
            </Link>
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-[auto_auto_1fr] sm:items-center">
            <Input
              type="number"
              min={2}
              max={12}
              value={projectCaptionMaxWordsOverride}
              onChange={(event) => setProjectCaptionMaxWordsOverride(event.target.value)}
              placeholder={defaultCaptionMaxWords ? String(defaultCaptionMaxWords) : 'Default'}
              className="w-24"
              disabled={savingCaptionMaxWords || Boolean(doc?.pending)}
            />
            <div className="flex gap-2">
              <Button size="sm" onClick={() => void saveProjectCaptionMaxWords(projectCaptionMaxWordsOverride || null)} disabled={savingCaptionMaxWords || Boolean(doc?.pending)}>
                {savingCaptionMaxWords ? 'Saving…' : 'Save'}
              </Button>
              <Button size="sm" variant="outline" onClick={() => void saveProjectCaptionMaxWords(null)} disabled={savingCaptionMaxWords || !project.captionMaxWordsOverride || Boolean(doc?.pending)}>
                Reset
              </Button>
            </div>
            <div className="text-xs text-muted-foreground">
              {savingCaptionMaxWords
                ? 'Saving caption override…'
                : project.captionMaxWordsOverride
                  ? `Effective max: ${project.captionMaxWordsOverride} words (project override)`
                  : effectiveCaptionMaxWords
                    ? `Effective max: ${effectiveCaptionMaxWords} words (global default)`
                    : 'Uses the global default when caption planning starts.'}
            </div>
          </div>
        </div>
        {captionsStatus === 'running' ? (
          <PendingNotice
            label={captionsStep?.progressLabel || 'Planning captions'}
            hint={captionsStep?.summary || 'Reusing narration + alignment artifacts to rebuild deterministic captions.'}
          />
        ) : null}
        <div className="rounded-lg border border-border bg-background/60 p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="text-sm font-medium text-foreground">Deterministic captions JSON</h3>
              <p className="mt-1 text-xs text-muted-foreground">
                {captionsStep?.summary || 'Caption planning output appears here after the deterministic caption pass completes.'}
              </p>
            </div>
            <StatusBadge
              status={captionsStatus === 'running' ? 'working' : captionsStatus === 'completed' ? 'completed' : captionsStatus === 'failed' ? 'failed' : 'draft'}
              compact
            />
          </div>
          {captionsJsonDetail ? (
            <details className="mt-4 rounded-md border border-border bg-background/70 p-3">
              <summary className="cursor-pointer text-sm font-medium text-foreground">View caption JSON</summary>
              <div className="mt-3">
                <MarkdownOrCode content={captionsJsonDetail.content} mode="json" />
              </div>
            </details>
          ) : (
            <div className="mt-4 text-sm text-muted-foreground">No caption JSON yet. Run Plan Captions after Narration Audio finishes.</div>
          )}
        </div>
      </Card>

      <Card id="plan-visuals" className="space-y-4 p-5">
        <WorkflowSectionHeader
          title="Plan Visuals"
          description="Write the visuals-only XML artifact from the approved script plus the existing narration/alignment/caption artifacts."
          status={visualsStatus === 'running' ? 'working' : doc?.status || 'draft'}
        />
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => void triggerTask('visuals')} disabled={saving || doc?.pending}>
            {saving ? 'Starting…' : doc?.exists ? 'Re-plan visuals' : 'Plan visuals'}
          </Button>
          {doc?.exists ? (
            <Button variant="secondary" onClick={() => void saveManual('approved')} disabled={saving}>
              Approve XML script
            </Button>
          ) : null}
          <Button variant="outline" onClick={() => void setEditing((current) => !current)}>{editing ? 'Cancel edit' : 'Edit XML'}</Button>
          <Button variant="outline" onClick={() => void load()} disabled={refreshing}>
            {refreshing ? 'Refreshing…' : 'Refresh'}
          </Button>
        </div>
        <div className="rounded-lg border border-border bg-background/60 p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="text-sm font-medium text-foreground">Visual planning notes</h3>
              <p className="mt-1 text-xs text-muted-foreground">Preferred XML schema: <code>&lt;assets&gt;</code> defines reusable green-screen image assets, and <code>&lt;timeline&gt;</code> defines timed visual entries only. Captions live in a separate deterministic JSON artifact.</p>
            </div>
            <StatusBadge
              status={visualsStatus === 'running' ? 'working' : doc?.status || 'draft'}
              compact
            />
          </div>
          <Textarea value={requestNotes} onChange={(e) => setRequestNotes(e.target.value)} className="mt-4 min-h-[84px]" placeholder="Optional notes for the visuals planning pass — for example new visual direction or debugging notes." />
        </div>
        {visualsStatus === 'running' ? (
          <PendingNotice
            label={visualsStep?.progressLabel || 'Planning visuals'}
            hint={visualsStep?.summary || 'Reusing narration, alignment, and caption artifacts to write the XML visuals plan.'}
          />
        ) : null}
        {loading && !doc ? <OrbitLoader label="Loading XML script" /> : null}
        {editing ? (
          <div className="space-y-3 rounded-lg border border-border bg-background/60 p-4">
            <Textarea value={draft} onChange={(e) => setDraft(e.target.value)} className="min-h-[320px] font-mono text-xs" />
            <div className="flex gap-2">
              <Button onClick={() => void saveManual()} disabled={saving}>Save XML</Button>
              <Button variant="ghost" onClick={() => { setEditing(false); setDraft(doc?.content || ''); }}>Discard</Button>
            </div>
          </div>
        ) : doc?.content ? (
          <details className="rounded-lg border border-border bg-background/60 p-4">
            <summary className="cursor-pointer text-sm font-medium text-foreground">Generated XML script</summary>
            <p className="mt-2 text-xs text-muted-foreground">Collapsed by default to keep the planning section focused. Expand when you want to inspect the XML.</p>
            <div className="mt-4">
              <MarkdownOrCode content={doc.content} mode="xml" />
            </div>
          </details>
        ) : <div className="text-sm text-muted-foreground">No XML script yet. Run Plan Visuals after the text script is approved.</div>}
      </Card>
    </div>
  );
}

function StageReviewSection({
  projectId,
  title,
  stage,
  description,
  doc,
  mode,
  emptyText,
  triggerLabel,
  triggerDescription,
  onRefresh,
  extra,
  collapseDocumentByDefault = false,
  showExtraWhenEmpty = false,
}: {
  projectId: string;
  title: string;
  stage: StageKey;
  description: string;
  doc: StageDoc;
  mode: 'markdown' | 'xml' | 'text';
  emptyText: string;
  triggerLabel: string;
  triggerDescription?: string;
  onRefresh: () => Promise<unknown>;
  extra?: React.ReactNode;
  collapseDocumentByDefault?: boolean;
  showExtraWhenEmpty?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(doc.content);
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState(doc.status || 'draft');
  const [actionError, setActionError] = useState<string | null>(null);
  const [documentExpanded, setDocumentExpanded] = useState(!collapseDocumentByDefault);

  useEffect(() => {
    setDraft(doc.content);
    setStatus(doc.status || 'draft');
  }, [doc.content, doc.status]);

  useEffect(() => {
    if (!doc.exists) {
      setDocumentExpanded(!collapseDocumentByDefault);
    }
  }, [doc.exists, collapseDocumentByDefault]);

  async function triggerGenerate() {
    setSaving(true);
    setActionError(null);

    try {
      await parseJsonResponse(
        await fetch(`/api/short-form-videos/${projectId}/workflow/${stage}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'generate' }),
        }),
        `Failed to trigger ${title.toLowerCase()}`
      );
      await onRefresh();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : `Failed to trigger ${title.toLowerCase()}`);
    } finally {
      setSaving(false);
    }
  }

  async function saveEdit() {
    setSaving(true);
    setActionError(null);

    try {
      await parseJsonResponse(
        await fetch(`/api/short-form-videos/${projectId}/workflow/${stage}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content: draft, comment: 'Edited in dashboard', updatedBy: 'ittai' }),
        }),
        `Failed to save ${title.toLowerCase()}`
      );
      setEditing(false);
      await onRefresh();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : `Failed to save ${title.toLowerCase()}`);
    } finally {
      setSaving(false);
    }
  }

  async function applyStatus() {
    setSaving(true);
    setActionError(null);

    try {
      if (status === 'requested changes') {
        await parseJsonResponse(
          await fetch(`/api/short-form-videos/${projectId}/workflow/${stage}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'revise', notes: note }),
          }),
          `Failed to request ${title.toLowerCase()} changes`
        );
      } else {
        await parseJsonResponse(
          await fetch(`/api/short-form-videos/${projectId}/workflow/${stage}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status, comment: note || `Status updated to ${status}`, updatedBy: 'ittai' }),
          }),
          `Failed to update ${title.toLowerCase()} status`
        );
      }

      setNote('');
      await onRefresh();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : `Failed to update ${title.toLowerCase()} status`);
    } finally {
      setSaving(false);
    }
  }

  const revision = doc.revision;
  const showRevisionPending = Boolean(revision?.isPending);
  const showRevisionWarning = Boolean(revision?.isFailed || revision?.warning);
  const showStaleArtifactNotice = Boolean(revision?.isStale);
  const retryLabel = revision?.mode === 'generate'
    ? `Retry ${title.toLowerCase()} generation`
    : `Retry ${title.toLowerCase()} revision`;
  const canCollapseDocument = collapseDocumentByDefault && doc.exists;

  async function retryLatestRun() {
    setSaving(true);
    setActionError(null);

    try {
      await parseJsonResponse(
        await fetch(`/api/short-form-videos/${projectId}/workflow/${stage}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'retry' }),
        }),
        `Failed to retry ${title.toLowerCase()}`
      );
      await onRefresh();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : `Failed to retry ${title.toLowerCase()}`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="space-y-5 p-5">
      <WorkflowSectionHeader
        title={title}
        description={description}
        status={doc.pending ? 'working' : revision?.isFailed ? 'failed' : status}
      />

      {doc.validationError ? (
        <ValidationNotice
          title={`${title} artifact is malformed`}
          message={`${doc.validationError} Fix the generated JSON or re-run this stage.`}
        />
      ) : null}

      {actionError ? <ValidationNotice title={`${title} action failed`} message={actionError} /> : null}

      {showRevisionPending ? (
        <RevisionRequestNotice
          title={`Revising ${title.toLowerCase()}…`}
          requestText={revision?.requestText}
          requestedAt={revision?.requestedAt}
          pending
        />
      ) : null}

      {showRevisionWarning ? (
        <div className="space-y-3">
          <RevisionRequestNotice
            title={`${title} ${revision?.mode === 'generate' ? 'generation' : 'revision'} needs attention`}
            requestText={revision?.requestText}
            requestedAt={revision?.requestedAt}
            pending={false}
            warning={revision?.warning || revision?.agentRun?.errorMessage || 'The latest run did not produce a new artifact.'}
          />
          {revision?.isFailed ? (
            <Button variant="outline" onClick={() => void retryLatestRun()} disabled={saving || doc.pending}>
              {saving ? 'Retrying…' : retryLabel}
            </Button>
          ) : null}
        </div>
      ) : null}

      {!doc.exists ? (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">{emptyText}</p>
          <Button onClick={() => void triggerGenerate()} disabled={saving || doc.pending}>
            {doc.pending || saving ? `${triggerLabel}…` : triggerLabel}
          </Button>
          {triggerDescription ? <p className="text-xs text-muted-foreground">{triggerDescription}</p> : null}
          {doc.pending ? (
            <PendingNotice
              label={`Waiting for ${title.toLowerCase()} output`}
              hint="This page keeps polling while the background job runs."
            />
          ) : null}
          {showExtraWhenEmpty ? extra : null}
        </div>
      ) : (
        <>
          <StageReviewControls
            status={status}
            note={note}
            saving={saving}
            pending={doc.pending}
            editing={editing}
            subjectLabel={title}
            showEditButton={!canCollapseDocument || documentExpanded}
            onStatusChange={setStatus}
            onNoteChange={setNote}
            onApply={() => void applyStatus()}
            onToggleEdit={() => setEditing((value) => !value)}
          />

          {showStaleArtifactNotice ? (
            <StaleArtifactNotice
              updatedAt={doc.updatedAt}
              label={showRevisionPending
                ? `${title} revision is in progress — this is still the current on-disk version.`
                : `${title} revision has not landed — this is still the current on-disk version.`}
            />
          ) : null}

          {canCollapseDocument ? (
            <div className="space-y-3 rounded-lg border border-border p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h3 className="text-sm font-medium text-foreground">Review document</h3>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {documentExpanded
                      ? 'Expanded for review and inline editing.'
                      : 'Collapsed by default to keep the workflow compact.'}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    if (documentExpanded && editing) {
                      setEditing(false);
                      setDraft(doc.content);
                    }
                    setDocumentExpanded((value) => !value);
                  }}
                >
                  {documentExpanded ? 'Collapse document' : 'Expand document'}
                </Button>
              </div>

              {documentExpanded ? (
                editing ? (
                  <div className="space-y-3">
                    <Textarea value={draft} onChange={(e) => setDraft(e.target.value)} className="min-h-[320px] font-mono text-xs" />
                    <div className="flex items-center gap-2">
                      <Button onClick={() => void saveEdit()} disabled={saving}>Save</Button>
                      <Button
                        variant="ghost"
                        onClick={() => {
                          setEditing(false);
                          setDraft(doc.content);
                        }}
                      >
                        Discard
                      </Button>
                    </div>
                  </div>
                ) : (
                  <MarkdownOrCode content={doc.content} mode={mode} />
                )
              ) : null}
            </div>
          ) : editing ? (
            <div className="space-y-3">
              <Textarea value={draft} onChange={(e) => setDraft(e.target.value)} className="min-h-[320px] font-mono text-xs" />
              <div className="flex items-center gap-2">
                <Button onClick={() => void saveEdit()} disabled={saving}>Save</Button>
                <Button
                  variant="ghost"
                  onClick={() => {
                    setEditing(false);
                    setDraft(doc.content);
                  }}
                >
                  Discard
                </Button>
              </div>
            </div>
          ) : (
            <MarkdownOrCode content={doc.content} mode={mode} />
          )}

          {extra}
        </>
      )}
    </Card>
  );
}

function TextScriptHistoryPanel({
  project,
  onProjectRefresh,
}: {
  project: Project;
  onProjectRefresh: () => Promise<unknown>;
}) {
  const body = useMemo(() => extractBody(project.script.content).trim(), [project.script.content]);
  const sentences = useMemo(() => body.split(/(?<=[.!?])\s+/).filter(Boolean), [body]);
  const firstSentence = sentences[0] || '';
  const firstSentenceWordCount = useMemo(() => firstSentence ? firstSentence.split(/\s+/).filter(Boolean).length : 0, [firstSentence]);
  const runs = useMemo(() => project.script.textScriptRuns || [], [project.script.textScriptRuns]);
  const latestRun = runs[0];
  const [selectedRunId, setSelectedRunId] = useState<string>(latestRun?.runId || '');
  const [selectedIterationNumber, setSelectedIterationNumber] = useState<number>(0);
  const [compareIterationNumber, setCompareIterationNumber] = useState<number>(0);
  const [projectOverride, setProjectOverride] = useState<string>(project.script.textScriptMaxIterationsOverride ? String(project.script.textScriptMaxIterationsOverride) : '');
  const [defaultMaxIterations, setDefaultMaxIterations] = useState<number | null>(null);
  const [savingOverride, setSavingOverride] = useState(false);
  const [overrideError, setOverrideError] = useState<string | null>(null);

  useEffect(() => {
    setSelectedRunId(latestRun?.runId || '');
    setSelectedIterationNumber(0);
    setCompareIterationNumber(0);
  }, [latestRun?.runId]);

  useEffect(() => {
    setProjectOverride(project.script.textScriptMaxIterationsOverride ? String(project.script.textScriptMaxIterationsOverride) : '');
  }, [project.script.textScriptMaxIterationsOverride]);

  useEffect(() => {
    let cancelled = false;
    async function loadDefaults() {
      try {
        const payload = await parseJsonResponse<WorkflowSettingsResponse>(
          await fetch('/api/short-form-videos/settings'),
          'Failed to load text-script settings'
        );
        const value = payload.data?.textScript?.defaultMaxIterations;
        if (!cancelled && typeof value === 'number') {
          setDefaultMaxIterations(value);
        }
      } catch {
        if (!cancelled) setDefaultMaxIterations(null);
      }
    }
    void loadDefaults();
    return () => {
      cancelled = true;
    };
  }, []);

  const selectedRun = useMemo(
    () => runs.find((run) => run.runId === selectedRunId) || latestRun,
    [latestRun, runs, selectedRunId]
  );

  useEffect(() => {
    if (!selectedRun) {
      setSelectedIterationNumber(0);
      setCompareIterationNumber(0);
      return;
    }
    const finalIteration = selectedRun.iterations.find((iteration) => iteration.isFinal)
      || selectedRun.iterations[selectedRun.iterations.length - 1];
    const nextSelected = finalIteration?.number || 0;
    setSelectedIterationNumber((current) => {
      if (current && selectedRun.iterations.some((iteration) => iteration.number === current)) return current;
      return nextSelected;
    });
    setCompareIterationNumber((current) => {
      if (current && selectedRun.iterations.some((iteration) => iteration.number === current)) return current;
      return nextSelected > 1 ? nextSelected - 1 : 0;
    });
  }, [selectedRun]);

  const selectedIteration = selectedRun?.iterations.find((iteration) => iteration.number === selectedIterationNumber)
    || selectedRun?.iterations.find((iteration) => iteration.isFinal)
    || selectedRun?.iterations[selectedRun?.iterations.length - 1];
  const compareIteration = selectedRun?.iterations.find((iteration) => iteration.number === compareIterationNumber);
  const selectedIterationBody = selectedIteration ? extractBody(selectedIteration.draftContent).trim() : body;
  const compareIterationBody = compareIteration ? extractBody(compareIteration.draftContent).trim() : '';
  const effectiveMaxIterations = project.script.textScriptMaxIterationsOverride || defaultMaxIterations || latestRun?.maxIterations || 1;
  const activeRun = latestRun?.status === 'running' ? latestRun : undefined;
  const runState = getTextScriptRunState(activeRun, effectiveMaxIterations);
  const showPipelineState = project.script.pending;
  const selectedDraftTitle = selectedIteration
    ? `Iteration ${selectedIteration.number} draft${selectedIteration.isFinal ? ' · final' : ''}${selectedIteration.kind === 'manual' ? ' · manual edit' : ''}`
    : 'Approved narration text';
  const selectedDraftDescription = selectedIteration
    ? compareIteration
      ? `Showing the full draft for iteration ${selectedIteration.number}. Diffing against iteration ${compareIteration.number} below.`
      : `Showing the full saved draft for iteration ${selectedIteration.number}. No comparison selected.`
    : 'This plain script becomes the narration source of truth. The XML Script step below will generate the original AI audio, remove pauses from it, run forced alignment on the processed narration, then generate deterministic captions JSON and the visuals-only XML.';

  const diff = useMemo(() => {
    if (!selectedIteration || !compareIteration || compareIteration.number === selectedIteration.number) return null;
    return {
      ...generateClientDiff(compareIterationBody, selectedIterationBody, 'script.md'),
      fromVersion: compareIteration.number,
      toVersion: selectedIteration.number,
      fromTimestamp: compareIteration.updatedAt || compareIteration.createdAt || '',
      toTimestamp: selectedIteration.updatedAt || selectedIteration.createdAt || '',
    };
  }, [compareIteration, compareIterationBody, selectedIteration, selectedIterationBody]);

  async function saveProjectOverride(value: string | null) {
    setSavingOverride(true);
    setOverrideError(null);
    try {
      await parseJsonResponse(
        await fetch(`/api/short-form-videos/${project.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ textScriptMaxIterationsOverride: value === null ? null : Math.max(1, Math.min(8, Number(value) || 1)) }),
        }),
        'Failed to save text-script override'
      );
      await onProjectRefresh();
    } catch (err) {
      setOverrideError(err instanceof Error ? err.message : 'Failed to save text-script override');
    } finally {
      setSavingOverride(false);
    }
  }

  return (
    <div className="space-y-4">
      {!body && !selectedIterationBody ? (
        <ValidationNotice
          title="Text script missing"
          message="This section should contain only the approved narration text. The XML Script step will generate original narration audio, pause removal, forced alignment, deterministic captions JSON, and visuals from it."
        />
      ) : null}

      {firstSentence && firstSentenceWordCount > 10 ? (
        <ValidationNotice
          title="Hook length warning"
          message={`The first sentence currently looks like ${firstSentenceWordCount} words. The hook should stay at 10 words or fewer.`}
        />
      ) : null}

      {overrideError ? <ValidationNotice title="Text-script override failed" message={overrideError} /> : null}

      <div className="space-y-3 rounded-lg border border-border bg-background/60 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-sm font-medium text-foreground">Text script status</h3>
              {selectedRun ? <Badge variant="secondary">Run {selectedRun.runId.slice(0, 8)}</Badge> : null}
              {selectedRun ? (
                <Badge variant={selectedRun.status === 'passed' ? 'success' : selectedRun.status === 'max-iterations-reached' || selectedRun.status === 'failed' ? 'destructive' : 'secondary'}>
                  {selectedRun.status.replace(/-/g, ' ')}
                </Badge>
              ) : null}
              {selectedIteration?.overallGrade !== undefined ? <Badge variant="outline">Grade {selectedIteration.overallGrade}/100</Badge> : null}
              {showPipelineState ? (
                <Badge variant="secondary">
                  Iteration {runState.currentIteration || 1} / {runState.maxIterations}
                </Badge>
              ) : null}
              {showPipelineState ? <Badge variant="outline">{getTextScriptPhaseLabel(runState.phase)}</Badge> : null}
            </div>
            <p className="text-xs text-muted-foreground">
              Compact iteration controls live here so the script section stays useful without getting bulky.
            </p>
          </div>
          <div className="text-xs text-muted-foreground">
            Effective max: {project.script.textScriptMaxIterationsOverride ? `${project.script.textScriptMaxIterationsOverride} (project override)` : defaultMaxIterations ? `${defaultMaxIterations} (global default)` : 'global default'}
          </div>
        </div>

        <div className="grid gap-2 md:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)_minmax(0,1fr)_auto]">
          <div className="space-y-1">
            <label className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Run</label>
            <Select value={selectedRun?.runId || ''} onChange={(event) => setSelectedRunId(event.target.value)}>
              {runs.length > 0 ? runs.map((run) => (
                <option key={run.runId} value={run.runId}>
                  {run.runId.slice(0, 8)} · {run.status.replace(/-/g, ' ')}
                </option>
              )) : <option value="">No runs yet</option>}
            </Select>
          </div>
          <div className="space-y-1">
            <label className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">View draft</label>
            <Select value={selectedIteration ? String(selectedIteration.number) : ''} onChange={(event) => setSelectedIterationNumber(Number(event.target.value))}>
              {selectedRun?.iterations.length ? selectedRun.iterations.map((iteration) => (
                <option key={iteration.number} value={iteration.number}>
                  Iteration {iteration.number}{iteration.isFinal ? ' · final' : ''}{iteration.kind === 'manual' ? ' · manual' : ''}
                </option>
              )) : <option value="">No iterations yet</option>}
            </Select>
          </div>
          <div className="space-y-1">
            <label className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Compare</label>
            <Select value={compareIteration ? String(compareIteration.number) : '0'} onChange={(event) => setCompareIterationNumber(Number(event.target.value))}>
              <option value="0">No comparison</option>
              {selectedRun?.iterations
                .filter((iteration) => !selectedIteration || iteration.number !== selectedIteration.number)
                .map((iteration) => (
                  <option key={iteration.number} value={iteration.number}>
                    Iteration {iteration.number}{iteration.kind === 'manual' ? ' · manual' : ''}
                  </option>
                ))}
            </Select>
          </div>
          <div className="space-y-1">
            <label className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Max iters</label>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min={1}
                max={8}
                value={projectOverride}
                onChange={(event) => setProjectOverride(event.target.value)}
                placeholder={defaultMaxIterations ? String(defaultMaxIterations) : 'Default'}
                className="w-20"
              />
              <Button size="sm" onClick={() => void saveProjectOverride(projectOverride || null)} disabled={savingOverride}>
                {savingOverride ? 'Saving…' : 'Save'}
              </Button>
              <Button size="sm" variant="outline" onClick={() => void saveProjectOverride(null)} disabled={savingOverride || !project.script.textScriptMaxIterationsOverride}>
                Reset
              </Button>
            </div>
          </div>
        </div>

        {showPipelineState ? (
          <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3">
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span className="font-medium text-foreground">Live iterative pipeline</span>
              <span>Current iteration {runState.currentIteration || 1} of up to {runState.maxIterations}</span>
              {runState.completedIterations > 0 ? <span>· {runState.completedIterations} completed cycle{runState.completedIterations === 1 ? '' : 's'}</span> : null}
            </div>
            {runState.statusText ? (
              <p className="mt-2 text-xs text-muted-foreground">{runState.statusText}</p>
            ) : null}
            <div className="mt-3 grid gap-2 md:grid-cols-3">
              {([
                ['writing', 'Write draft'],
                ['reviewing', 'Grade draft'],
                ['improving', 'Improve draft'],
              ] as const).map(([stepId, label]) => {
                const stepStatus = getTextScriptPhaseStatus(runState.phase, stepId);
                return (
                  <div
                    key={stepId}
                    className={`rounded-md border px-3 py-2 text-sm ${
                      stepStatus === 'active'
                        ? 'border-emerald-500/40 bg-emerald-500/10 text-foreground'
                        : stepStatus === 'completed'
                          ? 'border-border bg-background/70 text-muted-foreground'
                          : 'border-border/70 bg-background/40 text-muted-foreground/80'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium">{label}</span>
                      <Badge variant={stepStatus === 'active' ? 'success' : stepStatus === 'completed' ? 'secondary' : 'outline'}>
                        {stepStatus === 'active' ? 'Active' : stepStatus === 'completed' ? 'Done' : 'Next'}
                      </Badge>
                    </div>
                    <p className="mt-1 text-xs opacity-80">
                      {stepId === 'writing'
                        ? `Iteration ${runState.currentIteration || 1}`
                        : stepId === 'reviewing'
                          ? `Draft ${runState.currentIteration || 1}`
                          : `Prepare draft ${runState.currentIteration || 1}`}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        ) : null}
      </div>

      <div className="space-y-3 rounded-lg border border-border p-4">
        <div>
          <h3 className="text-sm font-medium text-foreground">{selectedDraftTitle}</h3>
          <p className="mt-1 text-xs text-muted-foreground">{selectedDraftDescription}</p>
        </div>
        <div className="rounded-lg border border-border bg-background/70 p-4 text-sm leading-6 text-foreground whitespace-pre-wrap break-words">
          {selectedIterationBody || body || 'Nothing here yet.'}
        </div>
      </div>

      {selectedRun?.status === 'max-iterations-reached' ? (
        <ValidationNotice
          title="Max iterations reached"
          message="This run hit the configured max-iteration limit before the review step passed. The latest draft was still published to the Text Script stage so you can inspect/edit it, but the final review explains what still needs work."
        />
      ) : null}

      {selectedIteration ? (
        <details className="rounded-lg border border-border bg-background/60 p-4">
          <summary className="cursor-pointer text-sm font-medium text-foreground">
            Review feedback for iteration {selectedIteration.number}
          </summary>
          <div className="mt-3 space-y-2 text-sm text-foreground">
            <div className="flex flex-wrap gap-2 text-xs">
              <Badge variant="secondary">Decision: {selectedIteration.reviewDecision || 'n/a'}</Badge>
              {selectedIteration.overallGrade !== undefined ? (
                <Badge variant={selectedRun?.passingScore !== undefined && selectedIteration.overallGrade >= selectedRun.passingScore ? 'success' : 'outline'}>
                  Overall grade: {selectedIteration.overallGrade}/100
                </Badge>
              ) : null}
              {selectedIteration.kind === 'manual' ? <Badge variant="outline">Manual edit</Badge> : null}
            </div>
            {selectedIteration.reviewSummary ? <p>{selectedIteration.reviewSummary}</p> : null}
            {selectedIteration.reviewFeedback ? (
              <div className="rounded-md border border-border bg-background/70 p-3 whitespace-pre-wrap break-words">
                {selectedIteration.reviewFeedback}
              </div>
            ) : null}
            {selectedIteration.reviewContent ? (
              <div className="rounded-md border border-border bg-background/70 p-3 whitespace-pre-wrap break-words text-xs text-muted-foreground">
                {selectedIteration.reviewContent}
              </div>
            ) : null}
          </div>
        </details>
      ) : null}

      {compareIteration && diff ? <DiffViewer diff={diff} showStats maxHeight="420px" /> : null}
    </div>
  );
}

function SceneImagesSection({ project, refresh }: { project: Project; refresh: () => Promise<unknown> }) {
  const [requestByScene, setRequestByScene] = useState<Record<string, string>>({});
  const [submittingScene, setSubmittingScene] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [styleOptions, setStyleOptions] = useState<ImageStyleOption[]>([]);
  const [backgroundOptions, setBackgroundOptions] = useState<BackgroundVideoOption[]>([]);
  const [defaultBackgroundVideoId, setDefaultBackgroundVideoId] = useState<string>('');
  const [savingStyle, setSavingStyle] = useState(false);
  const [savingBackground, setSavingBackground] = useState(false);
  const [sceneTabById, setSceneTabById] = useState<Record<string, 'preview' | 'raw'>>({});

  useEffect(() => {
    let cancelled = false;

    async function loadStyleOptions() {
      try {
        const payload = await parseJsonResponse<WorkflowSettingsResponse>(
          await fetch('/api/short-form-videos/settings'),
          'Failed to load image style settings'
        );
        const nextStyles = Array.isArray(payload.data?.imageStyles?.styles)
          ? payload.data?.imageStyles?.styles.filter(
              (style): style is ImageStyleOption => Boolean(style && typeof style.id === 'string' && typeof style.name === 'string')
            )
          : [];
        const nextBackgrounds = Array.isArray(payload.data?.backgroundVideos?.backgrounds)
          ? payload.data.backgroundVideos.backgrounds.filter(
              (background): background is BackgroundVideoOption => Boolean(background && typeof background.id === 'string' && typeof background.name === 'string')
            )
          : [];
        if (!cancelled) {
          setStyleOptions(nextStyles);
          setBackgroundOptions(nextBackgrounds);
          setDefaultBackgroundVideoId(payload.data?.backgroundVideos?.defaultBackgroundVideoId || '');
        }
      } catch {
        if (!cancelled) {
          setStyleOptions([]);
          setBackgroundOptions([]);
          setDefaultBackgroundVideoId('');
        }
      }
    }

    void loadStyleOptions();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    setSceneTabById((current) => {
      const next = { ...current };
      for (const scene of project.sceneImages.scenes) {
        if (!next[scene.id]) {
          next[scene.id] = scene.previewVideo ? 'preview' : 'raw';
        }
      }
      return next;
    });
  }, [project.sceneImages.scenes]);

  async function saveProjectStyle(styleId: string) {
    setSavingStyle(true);
    setError(null);
    try {
      await parseJsonResponse(
        await fetch(`/api/short-form-videos/${project.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ selectedImageStyleId: styleId }),
        }),
        'Failed to update visual style'
      );
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update visual style');
    } finally {
      setSavingStyle(false);
    }
  }

  async function saveProjectBackground(backgroundVideoId: string) {
    setSavingBackground(true);
    setError(null);
    try {
      await parseJsonResponse(
        await fetch(`/api/short-form-videos/${project.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ selectedBackgroundVideoId: backgroundVideoId }),
        }),
        'Failed to update background video'
      );
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update background video');
    } finally {
      setSavingBackground(false);
    }
  }

  async function requestSceneChange(scene: Scene) {
    setSubmittingScene(scene.id);
    setError(null);

    try {
      await parseJsonResponse(
        await fetch(`/api/short-form-videos/${project.id}/workflow/scene-images`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'request-scene-change',
            sceneId: scene.id,
            notes: requestByScene[scene.id] || '',
          }),
        }),
        'Failed to request scene changes'
      );
      setRequestByScene((prev) => ({ ...prev, [scene.id]: '' }));
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to request scene changes');
    } finally {
      setSubmittingScene(null);
    }
  }

  const sceneProgress = project.sceneImages.sceneProgress;

  return (
    <StageReviewSection
      projectId={project.id}
      title="Visuals"
      stage="scene-images"
      description="Once the XML script is approved, the dashboard runs the visuals workflow directly to generate or reuse the needed green-screen visual plates from the XML asset/timeline model. Exact asset reuse never regenerates the image unnecessarily; reference-derived new assets remain explicit in the XML and manifest for debugging. Captions are overlaid separately and the selected background video is composited behind each visual in preview/final render."
      doc={project.sceneImages}
      mode="markdown"
      emptyText="No visuals yet. Generate them after approving the XML script."
      triggerLabel="Generate visuals"
      triggerDescription={`This should create green-screen scene plates using the selected image style${project.selectedImageStyleName ? ` (${project.selectedImageStyleName})` : ''}${project.selectedBackgroundVideoName ? ` and prepare preview compositing against ${project.selectedBackgroundVideoName}` : ''}.`}
      onRefresh={refresh}
      collapseDocumentByDefault
      extra={
        <div className="space-y-4">
          {error ? <ValidationNotice title="Visual change request failed" message={error} /> : null}
          <div className="rounded-lg border border-border bg-background/60 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="text-sm font-medium text-foreground">Visual style for this project</h3>
                <p className="mt-1 max-w-2xl text-xs text-muted-foreground">
                  Pick the reusable style that should feed the direct visual generation path. Shared/common constraints from settings still apply regardless of which style you choose.
                </p>
              </div>
              <Link
                href={`/short-form-video/settings?style=${encodeURIComponent(project.selectedImageStyleId || '')}`}
                target="_blank"
                rel="noreferrer"
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                Open styles editor ↗
              </Link>
            </div>
            <div className="mt-3 flex flex-col gap-3 md:flex-row md:items-center">
              <Select
                value={project.selectedImageStyleId || ''}
                onChange={(event) => void saveProjectStyle(event.target.value)}
                disabled={savingStyle || styleOptions.length === 0}
                className="max-w-sm"
              >
                {styleOptions.map((style) => (
                  <option key={style.id} value={style.id}>
                    {style.name}
                  </option>
                ))}
              </Select>
              <div className="text-xs text-muted-foreground">
                {savingStyle
                  ? 'Saving style selection…'
                  : project.selectedImageStyleName
                    ? `Current style: ${project.selectedImageStyleName}`
                    : 'Using the current default style.'}
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-border bg-background/60 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="text-sm font-medium text-foreground">Looping background video for this visual project</h3>
                <p className="mt-1 max-w-2xl text-xs text-muted-foreground">
                  Pick which saved background video should sit behind the green-screen characters for scene previews and final render. New projects default to the library default automatically.
                </p>
              </div>
              <Link
                href="/short-form-video/settings#background-videos"
                target="_blank"
                rel="noreferrer"
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                Manage backgrounds ↗
              </Link>
            </div>
            <div className="mt-3 flex flex-col gap-3 md:flex-row md:items-center">
              <Select
                value={project.selectedBackgroundVideoId || defaultBackgroundVideoId || ''}
                onChange={(event) => void saveProjectBackground(event.target.value)}
                disabled={savingBackground || backgroundOptions.length === 0}
                className="max-w-sm"
              >
                {backgroundOptions.map((background) => (
                  <option key={background.id} value={background.id}>
                    {background.name}{background.id === defaultBackgroundVideoId ? ' (default)' : ''}
                  </option>
                ))}
              </Select>
              <div className="text-xs text-muted-foreground">
                {savingBackground
                  ? 'Saving background selection…'
                  : project.selectedBackgroundVideoName
                    ? `Current background: ${project.selectedBackgroundVideoName}`
                    : defaultBackgroundVideoId
                      ? 'Using the current default background video.'
                      : 'No background video configured yet.'}
              </div>
            </div>
          </div>
          {sceneProgress ? (
            <div className="rounded-lg border border-border bg-background/60 p-3">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="secondary">{sceneProgress.completed}/{sceneProgress.total} completed</Badge>
                {sceneProgress.pending > 0 ? (
                  <div className="inline-flex items-center gap-2">
                    <StatusBadge status="working" compact />
                    <span className="text-xs text-muted-foreground">{sceneProgress.pending} scene{sceneProgress.pending === 1 ? '' : 's'}</span>
                  </div>
                ) : null}
                {sceneProgress.scope === 'single' && sceneProgress.targetSceneId ? (
                  <Badge variant="outline">Revising {sceneProgress.targetSceneId}</Badge>
                ) : null}
                {sceneProgress.scope === 'chain' && (sceneProgress.targetSceneIds?.length || 0) > 0 ? (
                  <Badge variant="outline">Revising continuity chain: {sceneProgress.targetSceneIds?.join(', ')}</Badge>
                ) : null}
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                {sceneProgress.pending > 0
                  ? sceneProgress.scope === 'single'
                    ? 'The targeted scene is shown as a loading placeholder until the revised image lands on disk. Other scenes remain visible.'
                    : sceneProgress.scope === 'chain'
                      ? 'The targeted scene and any downstream continuity-linked scenes are tracked as part of this rerun. Scenes outside that chain remain visible.'
                      : 'Completed scenes stay visible while the remaining scene slots render as loading placeholders.'
                  : 'All expected visuals for the latest run are available.'}
              </p>
            </div>
          ) : null}
          {((project.xmlScript.captions?.length || 0) > 0 || project.sceneImages.scenes.some((scene) => typeof scene.startTime === 'number' && typeof scene.endTime === 'number')) ? (
            <VisualCaptionTimeline captions={project.xmlScript.captions || []} scenes={project.sceneImages.scenes} />
          ) : null}
          {project.sceneImages.scenes.length > 0 ? (
            <div className="overflow-x-auto pb-2">
              <div className="flex min-w-max gap-4">
                {project.sceneImages.scenes.map((scene) => {
                  const sceneBusy = scene.status === 'in-progress';
                  const activeTab = sceneTabById[scene.id] || (scene.previewVideo ? 'preview' : 'raw');
                  const hasPreviewVideo = Boolean(scene.previewVideo && project.selectedBackgroundVideoId);
                  const hasRawImage = Boolean(scene.image);
                  const hasRenderableMedia = hasPreviewVideo || hasRawImage || Boolean(scene.previewImage);

                  return (
                    <div key={scene.id} className="w-[260px] shrink-0 space-y-3 rounded-lg border border-border bg-background/60 p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-xs text-muted-foreground">Visual {scene.number}</p>
                          <p className="mt-1 text-sm font-medium text-foreground">{scene.caption}</p>
                        </div>
                        {sceneBusy ? <StatusBadge status="in-progress" compact /> : <StatusBadge status="completed" compact />}
                      </div>
                      {!sceneBusy ? (
                        <div className="flex rounded-md border border-border bg-background/70 p-1 text-[11px]">
                          <button
                            type="button"
                            className={`flex-1 rounded px-2 py-1 ${activeTab === 'preview' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'}`}
                            onClick={() => setSceneTabById((prev) => ({ ...prev, [scene.id]: 'preview' }))}
                            disabled={!hasPreviewVideo}
                          >
                            Preview
                          </button>
                          <button
                            type="button"
                            className={`flex-1 rounded px-2 py-1 ${activeTab === 'raw' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'}`}
                            onClick={() => setSceneTabById((prev) => ({ ...prev, [scene.id]: 'raw' }))}
                            disabled={!hasRawImage}
                          >
                            Green screen
                          </button>
                        </div>
                      ) : null}
                      {sceneBusy ? (
                        <div className="relative aspect-[9/16] w-full overflow-hidden rounded-md border border-dashed border-border bg-muted/40">
                          <Skeleton className="h-full w-full rounded-none" />
                          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-4 text-center">
                            <OrbitLoader label={`Rendering visual ${scene.number}`} />
                            <p className="text-xs text-muted-foreground">This slot updates automatically when the new image lands.</p>
                          </div>
                        </div>
                      ) : hasRenderableMedia ? (
                        activeTab === 'preview' && hasPreviewVideo ? (
                          <ScenePreviewVideoCard
                            src={scene.previewVideo!}
                            poster={scene.previewImage || scene.image || undefined}
                            label={`${scene.caption} preview video`}
                          />
                        ) : hasRawImage ? (
                          <img src={scene.image} alt={`${scene.caption} raw green screen`} className="aspect-[9/16] w-full rounded-md border border-border bg-muted object-cover" />
                        ) : scene.previewImage ? (
                          <img src={scene.previewImage} alt={scene.caption} className="aspect-[9/16] w-full rounded-md border border-border bg-muted object-cover" />
                        ) : (
                          <div className="flex aspect-[9/16] w-full items-center justify-center rounded-md border border-dashed border-border text-xs text-muted-foreground">
                            No preview available
                          </div>
                        )
                      ) : (
                        <div className="flex aspect-[9/16] w-full items-center justify-center rounded-md border border-dashed border-border text-xs text-muted-foreground">
                          No image yet
                        </div>
                      )}
                      {(scene.imageId || scene.basedOnImageId || scene.reusedExistingAsset) ? (
                        <div className="flex flex-wrap gap-2">
                          {scene.imageId ? <Badge variant="outline">imageId: {scene.imageId}</Badge> : null}
                          {scene.reusedExistingAsset ? <Badge variant="secondary">reused asset</Badge> : null}
                          {scene.basedOnImageId ? <Badge variant="outline">basedOn: {scene.basedOnImageId}</Badge> : null}
                          {scene.visualId ? <Badge variant="outline">{scene.visualId}</Badge> : null}
                        </div>
                      ) : null}
                      <div className="space-y-2">
                        <Textarea
                          value={requestByScene[scene.id] || ''}
                          onChange={(e) => setRequestByScene((prev) => ({ ...prev, [scene.id]: e.target.value }))}
                          placeholder={sceneBusy ? 'Wait for the current render to finish before requesting another change' : 'Optional notes — leave blank to rerender this scene cleanly'}
                          className="min-h-[88px]"
                          disabled={sceneBusy}
                        />
                        {!sceneBusy ? (
                          <p className="text-xs text-muted-foreground">
                            Leave notes empty to rerender this scene cleanly, or add notes to request a targeted change.
                          </p>
                        ) : null}
                      </div>
                      <Button
                        variant="outline"
                        className="w-full"
                        onClick={() => void requestSceneChange(scene)}
                        disabled={sceneBusy || submittingScene === scene.id}
                      >
                        {submittingScene === scene.id
                          ? 'Sending…'
                          : sceneBusy
                            ? 'Visual is rendering…'
                            : (requestByScene[scene.id] || '').trim()
                              ? 'Request visual changes'
                              : 'Rerender visual'}
                      </Button>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : null}
        </div>
      }
    />
  );
}

function VideoSection({ project, refresh }: { project: Project; refresh: () => Promise<unknown> }) {
  const [voiceOptions, setVoiceOptions] = useState<VoiceOption[]>([]);
  const [musicOptions, setMusicOptions] = useState<MusicOption[]>([]);
  const [captionStyleOptions, setCaptionStyleOptions] = useState<CaptionStyleOption[]>([]);
  const [defaultVoiceId, setDefaultVoiceId] = useState<string>('');
  const [defaultMusicId, setDefaultMusicId] = useState<string>('');
  const [defaultCaptionStyleId, setDefaultCaptionStyleId] = useState<string>('');
  const [musicVolume, setMusicVolume] = useState<number>(0.38);
  const [savingMusic, setSavingMusic] = useState(false);
  const [savingCaptionStyle, setSavingCaptionStyle] = useState(false);
  const [musicError, setMusicError] = useState<string | null>(null);
  const [captionStyleError, setCaptionStyleError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadOptions() {
      try {
        const payload = await parseJsonResponse<WorkflowSettingsResponse>(
          await fetch('/api/short-form-videos/settings'),
          'Failed to load workflow settings'
        );
        const nextVoices = Array.isArray(payload.data?.videoRender?.voices)
          ? payload.data.videoRender.voices.filter(
              (voice): voice is VoiceOption => Boolean(voice && typeof voice.id === 'string' && typeof voice.name === 'string')
            )
          : [];
        const nextMusic = Array.isArray(payload.data?.videoRender?.musicTracks)
          ? payload.data.videoRender.musicTracks.filter(
              (track): track is MusicOption => Boolean(track && typeof track.id === 'string' && typeof track.name === 'string')
            )
          : [];
        const nextCaptionStyles = Array.isArray(payload.data?.videoRender?.captionStyles)
          ? payload.data.videoRender.captionStyles.filter(
              (style): style is CaptionStyleOption => Boolean(style && typeof style.id === 'string' && typeof style.name === 'string')
            )
          : [];
        if (!cancelled) {
          setVoiceOptions(nextVoices);
          setMusicOptions(nextMusic);
          setCaptionStyleOptions(nextCaptionStyles);
          setDefaultVoiceId(payload.data?.videoRender?.defaultVoiceId || '');
          setDefaultMusicId(payload.data?.videoRender?.defaultMusicTrackId || '');
          setDefaultCaptionStyleId(payload.data?.videoRender?.defaultCaptionStyleId || '');
          setMusicVolume(typeof payload.data?.videoRender?.musicVolume === 'number' ? payload.data.videoRender.musicVolume : 0.38);
        }
      } catch {
        if (!cancelled) {
          setVoiceOptions([]);
          setMusicOptions([]);
          setCaptionStyleOptions([]);
          setDefaultVoiceId('');
          setDefaultMusicId('');
          setDefaultCaptionStyleId('');
          setMusicVolume(0.38);
        }
      }
    }

    void loadOptions();
    return () => {
      cancelled = true;
    };
  }, []);

  async function saveProjectMusic(musicId: string) {
    setSavingMusic(true);
    setMusicError(null);
    try {
      await parseJsonResponse(
        await fetch(`/api/short-form-videos/${project.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ selectedMusicId: musicId }),
        }),
        'Failed to update project soundtrack'
      );
      await refresh();
    } catch (err) {
      setMusicError(err instanceof Error ? err.message : 'Failed to update project soundtrack');
    } finally {
      setSavingMusic(false);
    }
  }

  async function saveProjectCaptionStyle(captionStyleId: string | null) {
    setSavingCaptionStyle(true);
    setCaptionStyleError(null);
    try {
      await parseJsonResponse(
        await fetch(`/api/short-form-videos/${project.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ selectedCaptionStyleId: captionStyleId === null ? null : captionStyleId }),
        }),
        'Failed to update project caption style'
      );
      await refresh();
    } catch (err) {
      setCaptionStyleError(err instanceof Error ? err.message : 'Failed to update project caption style');
    } finally {
      setSavingCaptionStyle(false);
    }
  }

  const activeVoiceLabel = project.selectedVoiceName || voiceOptions.find((voice) => voice.id === defaultVoiceId)?.name || 'default voice';
  const activeMusicLabel = project.selectedMusicName || musicOptions.find((track) => track.id === defaultMusicId)?.name || 'default soundtrack';
  const activeCaptionStyleLabel = project.selectedCaptionStyleName || captionStyleOptions.find((style) => style.id === defaultCaptionStyleId)?.name || 'default caption style';
  const previewVideoRef = useRef<HTMLVideoElement | null>(null);
  const previewRefreshToken = useMemo(() => {
    const finalizeStep = project.video.pipeline?.steps.find((step) => step.id === 'finalize-output');
    const captionStep = project.video.pipeline?.steps.find((step) => step.id === 'burn-captions');
    return finalizeStep?.updatedAt || captionStep?.updatedAt || project.video.updatedAt || project.updatedAt || null;
  }, [project.updatedAt, project.video.pipeline?.steps, project.video.updatedAt]);
  const previewVideoUrl = useMemo(
    () => (project.video.videoUrl ? appendPreviewRefreshParam(project.video.videoUrl, previewRefreshToken) : undefined),
    [project.video.videoUrl, previewRefreshToken]
  );

  useEffect(() => {
    if (!previewVideoRef.current || !previewVideoUrl) return;
    previewVideoRef.current.load();
  }, [previewVideoUrl]);

  return (
    <StageReviewSection
      projectId={project.id}
      title="Video"
      stage="video"
      description="After visuals are approved, the dashboard renders the final short-form video directly through the xml-scene-video workflow by reusing the narration + forced-alignment artifacts already produced during the XML Script step, plus a full-duration looping background video track, green-screen chroma key compositing, saved background music, ASS/libass subtitle burn-in, and per-visual XML camera motion that applies only to the image layer when explicitly set in the XML."
      doc={project.video}
      mode="markdown"
      emptyText="No video yet. Generate the final video after approving the visuals."
      triggerLabel="Generate final video"
      triggerDescription={`The video should be rendered from the XML <script> and approved scene assets by reusing the saved XML-step narration/alignment artifacts${activeVoiceLabel ? ` (voice source currently shown as ${activeVoiceLabel} in XML Script)` : ''}${activeMusicLabel ? `, soundtrack preset ${activeMusicLabel}` : ''}${activeCaptionStyleLabel ? `, caption style ${activeCaptionStyleLabel}` : ''}${project.selectedBackgroundVideoName ? `, the looping background video ${project.selectedBackgroundVideoName}` : ''}, plus the saved music mix volume (${Math.round(musicVolume * 100)}%) and the deterministic ASS/libass caption path unless explicitly overridden.`}
      onRefresh={refresh}
      collapseDocumentByDefault
      extra={
        <div className="space-y-4">
          {musicError ? <ValidationNotice title="Soundtrack selection failed" message={musicError} /> : null}
          {captionStyleError ? <ValidationNotice title="Caption style selection failed" message={captionStyleError} /> : null}
          <div className="rounded-lg border border-border bg-background/60 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="text-sm font-medium text-foreground">Narration source</h3>
                <p className="mt-1 max-w-2xl text-xs text-muted-foreground">
                  Final Video does not pick or regenerate its own voice anymore. It reuses the processed narration WAV and forced alignment already created in the XML Script step.
                </p>
              </div>
              <Link
                href="#xml-script"
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                Jump to XML Script ↑
              </Link>
            </div>
            <div className="mt-3 text-xs text-muted-foreground">
              {project.selectedVoiceName
                ? `XML narration voice currently selected for this project: ${project.selectedVoiceName}`
                : defaultVoiceId
                  ? `XML narration currently falls back to the default voice: ${activeVoiceLabel}`
                  : 'XML narration will use the fallback default voice until a project/default voice is selected.'}
            </div>
          </div>
          <div className="rounded-lg border border-border bg-background/60 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="text-sm font-medium text-foreground">Soundtrack for this project</h3>
                <p className="mt-1 max-w-2xl text-xs text-muted-foreground">
                  Pick which saved soundtrack entry should be reused for this project. Once a soundtrack has been generated in settings, final-video renders reuse that exact saved WAV file instead of asking ACE-Step for a fresh song each time.
                </p>
              </div>
              <Link
                href="/short-form-video/settings#music-library"
                target="_blank"
                rel="noreferrer"
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                Open music library ↗
              </Link>
            </div>
            <div className="mt-3 flex flex-col gap-3 md:flex-row md:items-center">
              <Select
                value={project.selectedMusicId || defaultMusicId || ''}
                onChange={(event) => void saveProjectMusic(event.target.value)}
                disabled={savingMusic || musicOptions.length === 0}
                className="max-w-sm"
              >
                {musicOptions.map((track) => (
                  <option key={track.id} value={track.id}>
                    {track.name}{track.id === defaultMusicId ? ' (default)' : ''}
                  </option>
                ))}
              </Select>
              <div className="text-xs text-muted-foreground">
                {savingMusic
                  ? 'Saving soundtrack selection…'
                  : project.selectedMusicName
                    ? `Current project soundtrack: ${project.selectedMusicName}`
                    : defaultMusicId
                      ? `Using the current default soundtrack: ${activeMusicLabel}`
                      : 'Using the fallback soundtrack preset.'}
              </div>
            </div>
            <div className="mt-3 text-xs text-muted-foreground">
              Saved music mix volume for new renders: <span className="font-medium text-foreground">{Math.round(musicVolume * 100)}%</span>
            </div>
          </div>
          <div className="rounded-lg border border-border bg-background/60 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="text-sm font-medium text-foreground">Caption style for this project</h3>
                <p className="mt-1 max-w-2xl text-xs text-muted-foreground">
                  Final-video renders now burn ASS subtitles using the selected caption-style preset. Leave the project on the global default, or override it here for a specific short-form video.
                </p>
              </div>
              <Link
                href="/short-form-video/settings#caption-styles"
                target="_blank"
                rel="noreferrer"
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                Open caption styles ↗
              </Link>
            </div>
            <div className="mt-3 flex flex-col gap-3 md:flex-row md:items-center">
              <Select
                value={project.captionStyleOverrideId || ''}
                onChange={(event) => void saveProjectCaptionStyle(event.target.value || null)}
                disabled={savingCaptionStyle || captionStyleOptions.length === 0}
                className="max-w-sm"
              >
                <option value="">Use default caption style</option>
                {captionStyleOptions.map((style) => (
                  <option key={style.id} value={style.id}>
                    {style.name}{style.id === defaultCaptionStyleId ? ' (default)' : ''}
                  </option>
                ))}
              </Select>
              <div className="text-xs text-muted-foreground">
                {savingCaptionStyle
                  ? 'Saving caption style selection…'
                  : project.captionStyleOverrideId
                    ? `Current project caption style override: ${project.selectedCaptionStyleName || activeCaptionStyleLabel}`
                    : defaultCaptionStyleId
                      ? `Using the current default caption style: ${activeCaptionStyleLabel}`
                      : 'Using the fallback caption style.'}
              </div>
            </div>
            <div className="mt-3 text-xs text-muted-foreground">
              Effective final-render caption style: <span className="font-medium text-foreground">{activeCaptionStyleLabel}</span>
            </div>
          </div>
          <div className="rounded-lg border border-border bg-background/60 p-4 text-xs text-muted-foreground">
            <span className="font-medium text-foreground">Looping background video:</span>{' '}
            {project.selectedBackgroundVideoName || 'Not selected yet. Choose one in the Visual Images section before rendering the final video.'}
          </div>
          <VideoPipelinePanel project={project} />
          {previewVideoUrl ? (
            <div className="space-y-3">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h3 className="text-sm font-medium text-foreground">Preview</h3>
                  <p className="mt-1 text-xs text-muted-foreground">Use the button to open or download the final video file directly, especially on mobile.</p>
                </div>
                <a
                  href={previewVideoUrl}
                  download
                  target="_blank"
                  rel="noreferrer"
                  className={buttonVariants({ variant: 'default' })}
                >
                  Download final video
                </a>
              </div>
              <video ref={previewVideoRef} key={previewVideoUrl} src={previewVideoUrl} controls playsInline preload="metadata" className="max-h-[70vh] w-full rounded-lg border border-border bg-black" />
            </div>
          ) : null}
        </div>
      }
    />
  );
}

type DetailSectionId = 'topic' | 'hook' | 'research' | 'script' | 'narration-audio' | 'plan-captions' | 'plan-visuals' | 'scene-images' | 'video';

interface DetailSectionNavItem {
  id: DetailSectionId;
  label: string;
  available: boolean;
  unavailableLabel?: string;
  status: string;
}

function getSectionStatus(project: Project | null, sectionId: DetailSectionId) {
  if (!project) return 'draft';

  switch (sectionId) {
    case 'topic':
      return project.topic ? 'approved' : 'draft';
    case 'hook':
      return project.hooks.pending ? 'working' : project.selectedHookText ? 'approved' : 'draft';
    case 'research':
      return project.research.pending ? 'working' : project.research.status || 'draft';
    case 'script':
      return project.script.pending ? 'working' : project.script.status || 'draft';
    case 'narration-audio': {
      const narrationSteps = project.xmlScript.pipeline?.steps.filter(
        (step) => step.id === 'narration' || step.id === 'silence-removal' || step.id === 'alignment'
      ) || [];
      if (narrationSteps.some((step) => step.status === 'failed')) return 'failed';
      if (narrationSteps.some((step) => step.status === 'active')) return 'working';
      if (narrationSteps.length > 0 && narrationSteps.every((step) => step.status === 'completed')) return 'approved';
      return approved(project.script.status) ? 'ready' : 'draft';
    }
    case 'plan-captions': {
      const captionsStep = project.xmlScript.pipeline?.steps.find((step) => step.id === 'captions');
      if (captionsStep?.status === 'failed') return 'failed';
      if (captionsStep?.status === 'active') return 'working';
      if (captionsStep?.status === 'completed') return 'approved';
      return approved(project.script.status) ? 'ready' : 'draft';
    }
    case 'plan-visuals':
      return project.xmlScript.pending ? 'working' : project.xmlScript.status || (approved(project.script.status) ? 'ready' : 'draft');
    case 'scene-images':
      return project.sceneImages.pending ? 'working' : project.sceneImages.status || 'draft';
    case 'video':
      if (project.video.pipeline?.status === 'failed' || project.video.revision?.isFailed) return 'failed';
      if (project.video.pending || project.video.pipeline?.status === 'running') return 'working';
      if (project.video.pipeline?.status === 'completed') return 'completed';
      return project.video.status || 'draft';
    default:
      return 'draft';
  }
}

export default function ShortFormVideoDetailPage() {
  const params = useParams<{ id: string }>();
  const projectId = typeof params?.id === 'string' ? params.id : '';

  const [project, setProject] = useState<Project | null>(null);
  const [topic, setTopic] = useState('');
  const [topicDirty, setTopicDirty] = useState(false);
  const [savingTopic, setSavingTopic] = useState(false);
  const [pageError, setPageError] = useState<string | null>(null);

  const shouldPoll = Boolean(
    projectId
    && (
      !project
      || (project?.pendingStages.length ?? 0) > 0
      || project?.xmlScript.pending
      || project?.video.pending
      || project?.video.pipeline?.status === 'running'
      || savingTopic
    )
  );
  const {
    loading,
    refreshing,
    error: pollingError,
    refetch,
  } = usePolling<ApiResponse<Project>>(projectId ? `/api/short-form-videos/${projectId}` : null, {
    intervalMs: 4000,
    enabled: shouldPoll,
    onData: (payload) => {
      if (!payload.success || !payload.data) {
        setPageError(payload.error || 'Failed to load short-form workflow');
        return;
      }
      setPageError(null);
      setProject(normalizeShortFormProject(payload.data));
    },
  });

  usePageScrollRestoration(projectId ? `short-form-video-detail:${projectId}` : null, Boolean(projectId) && !loading);

  useEffect(() => {
    if (!project || topicDirty) return;
    setTopic(project.topic || '');
  }, [project, topicDirty]);

  const refreshProject = useCallback(async () => {
    const payload = await refetch();
    if (payload && payload.success && payload.data) {
      const normalized = normalizeShortFormProject(payload.data);
      setPageError(null);
      setProject(normalized);
      return normalized;
    }

    if (payload && !payload.success) {
      setPageError(payload.error || 'Failed to refresh short-form workflow');
      throw new Error(payload.error || 'Failed to refresh short-form workflow');
    }

    throw new Error('Failed to refresh short-form workflow');
  }, [refetch]);

  async function saveTopicAndGenerateHooks() {
    if (!project) return;
    setSavingTopic(true);
    setPageError(null);

    try {
      await parseJsonResponse(
        await fetch(`/api/short-form-videos/${project.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ topic, title: topic || project.title }),
        }),
        'Failed to save topic'
      );

      await parseJsonResponse(
        await fetch(`/api/short-form-videos/${project.id}/hooks`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'generate' }),
        }),
        'Failed to start hook generation'
      );

      setTopicDirty(false);
      await refreshProject();
    } catch (err) {
      setPageError(err instanceof Error ? err.message : 'Failed to save topic and generate hooks');
    } finally {
      setSavingTopic(false);
    }
  }

  const showHook = project ? project.topic.trim().length > 0 : false;
  const showResearch = project ? Boolean(project.selectedHookText) : false;
  const showScript = project ? approved(project.research.status) : false;
  const showSceneImages = project ? approved(project.xmlScript.status) : false;
  const showVideo = project ? approved(project.sceneImages.status) : false;
  const activeStages = project ? project.pendingStages.map(stageLabel) : [];
  const sections = useMemo<DetailSectionNavItem[]>(
    () => [
      { id: 'topic', label: 'Topic', available: true, status: getSectionStatus(project, 'topic') },
      { id: 'hook', label: 'Hook', available: showHook, unavailableLabel: 'Locked', status: getSectionStatus(project, 'hook') },
      { id: 'research', label: 'Research', available: showResearch, unavailableLabel: 'Locked', status: getSectionStatus(project, 'research') },
      { id: 'script', label: 'Text Script', available: showScript, unavailableLabel: 'Locked', status: getSectionStatus(project, 'script') },
      { id: 'narration-audio', label: 'Narration Audio', available: showScript, unavailableLabel: 'Locked', status: getSectionStatus(project, 'narration-audio') },
      { id: 'plan-captions', label: 'Plan Captions', available: showScript, unavailableLabel: 'Locked', status: getSectionStatus(project, 'plan-captions') },
      { id: 'plan-visuals', label: 'Plan Visuals', available: showScript, unavailableLabel: 'Locked', status: getSectionStatus(project, 'plan-visuals') },
      { id: 'scene-images', label: 'Visuals', available: showSceneImages, unavailableLabel: 'Locked', status: getSectionStatus(project, 'scene-images') },
      { id: 'video', label: 'Final Video', available: showVideo, unavailableLabel: 'Locked', status: getSectionStatus(project, 'video') },
    ],
    [project, showHook, showResearch, showScript, showSceneImages, showVideo]
  );
  const activeSection = useSectionScrollSpy(sections);

  if (loading && !project) {
    return (
      <div className="space-y-6 p-4 sm:p-6 lg:p-8">
        <Skeleton className="h-4 w-36" />
        <Skeleton className="h-10 w-1/2" />
        <Skeleton className="h-48 w-full" />
        <OrbitLoader label="Loading short-form workflow" />
      </div>
    );
  }

  if (!project) {
    return (
      <div className="p-4 sm:p-6 lg:p-8">
        <Link href="/short-form-video" className="text-sm text-muted-foreground hover:text-foreground">
          ← Back to short-form videos
        </Link>
        <div className="mt-8 text-muted-foreground">Project not found.</div>
        {pageError || pollingError ? (
          <div className="mt-4 max-w-xl">
            <ValidationNotice title="Workflow load failed" message={pageError || pollingError || 'Unknown error'} />
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 pb-24 sm:p-6 sm:pb-28 lg:p-8 xl:pr-72">
      <div className="flex items-center justify-between gap-4">
        <div>
          <Link href="/short-form-video" className="text-sm text-muted-foreground hover:text-foreground">
            ← Back to short-form videos
          </Link>
          <h1 className="mt-3 text-2xl font-bold text-foreground">{project.title || 'Untitled short-form video'}</h1>
          <p className="mt-1 text-sm text-muted-foreground">Created {new Date(project.createdAt).toLocaleString()}</p>
        </div>
        <Button variant="outline" onClick={() => void refreshProject()} disabled={refreshing}>
          {refreshing ? 'Refreshing…' : 'Refresh'}
        </Button>
      </div>

      <AutoRefreshBanner activeStages={activeStages} refreshing={refreshing} />

      {pageError || pollingError ? (
        <ValidationNotice title="Workflow sync issue" message={pageError || pollingError || 'Unknown error'} />
      ) : null}

      <SectionNavigator sections={sections} activeSection={activeSection} />

      <section id="topic" className="scroll-mt-24">
        <Card className="space-y-4 p-5">
        <WorkflowSectionHeader
          title="Topic"
          description="Start with the topic. Submitting it automatically kicks off hook generation below."
          status={project.topic ? 'approved' : 'draft'}
        />
        <div className="flex flex-col gap-3 md:flex-row">
          <Input
            value={topic}
            onChange={(e) => {
              setTopic(e.target.value);
              setTopicDirty(true);
            }}
            placeholder="Enter the short-form video topic"
            className="flex-1"
          />
          <Button onClick={() => void saveTopicAndGenerateHooks()} disabled={savingTopic || !topic.trim()}>
            {savingTopic ? 'Saving…' : project.topic ? 'Update topic + refresh hooks' : 'Save topic'}
          </Button>
        </div>
        {savingTopic ? (
          <PendingNotice
            label="Saving topic and starting hook generation"
            hint="The page will keep polling while the next background step starts."
          />
        ) : null}
        </Card>
      </section>

      {showHook ? (
        <section id="hook" className="scroll-mt-24">
          <HookSection project={project} refresh={refreshProject} />
        </section>
      ) : null}

      {showResearch ? (
        <section id="research" className="scroll-mt-24">
          <StageReviewSection
          projectId={project.id}
          title="Research"
          stage="research"
          description="Oracle researches the topic after a hook is selected. Review, edit, comment, approve, or request changes here."
          doc={project.research}
          mode="markdown"
          emptyText="No research yet. Trigger Oracle once the hook is selected."
          triggerLabel="Generate research"
          triggerDescription="This should create a research deliverable tailored to the selected hook."
          onRefresh={refreshProject}
          collapseDocumentByDefault
        />
        </section>
      ) : null}

      {showScript ? (
        <section id="script" className="scroll-mt-24">
          <StageReviewSection
          projectId={project.id}
          title="Text Script"
          stage="script"
          description="Scribe writes the approved plain narration script first. This section is text only: no XML, no caption chunks, and no image directions. The first sentence is still the hook."
          doc={project.script}
          mode="text"
          emptyText="No text script yet. Generate it after approving the research."
          triggerLabel="Generate text script"
          triggerDescription="This should create the plain narration script only. The XML Script step below will later generate original narration audio, pause removal, forced alignment, deterministic captions JSON, and visuals XML from this approved text."
          onRefresh={refreshProject}
          extra={<TextScriptHistoryPanel project={project} onProjectRefresh={refreshProject} />}
          showExtraWhenEmpty
        />
        </section>
      ) : null}

      {showScript ? (
        <div className="space-y-6">
          <section className="scroll-mt-24">
            <XMLScriptSection project={project} onProjectRefresh={refreshProject} />
          </section>
        </div>
      ) : null}

      {showSceneImages ? (
        <section id="scene-images" className="scroll-mt-24">
          <SceneImagesSection project={project} refresh={refreshProject} />
        </section>
      ) : null}

      {showVideo ? (
        <section id="video" className="scroll-mt-24">
          <VideoSection project={project} refresh={refreshProject} />
        </section>
      ) : null}
    </div>
  );
}
