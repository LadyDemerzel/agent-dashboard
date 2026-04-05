'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { OrbitLoader, Skeleton } from '@/components/ui/loading';
import { TopLevelComments } from '@/components/TopLevelComments';
import { usePolling } from '@/components/usePolling';
import { SectionNavigator, useSectionScrollSpy } from '@/components/short-form-video/SectionNavigator';
import {
  AutoRefreshBanner,
  PendingNotice,
  RevisionRequestNotice,
  StageReviewControls,
  StaleArtifactNotice,
  ValidationNotice,
  WorkflowSectionHeader,
} from '@/components/short-form-video/WorkflowShared';
import type { FeedbackThread } from '@/lib/feedback';
import {
  normalizeShortFormProject,
  type HookOption,
  type Scene,
  type ShortFormProjectClient as Project,
  type StageDoc,
} from '@/lib/short-form-video-client';

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
  };
}

type StageKey = 'research' | 'script' | 'scene-images' | 'video';

function stageLabel(stage: StageKey | 'hooks') {
  if (stage === 'scene-images') return 'Scene images';
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

function extractXmlTagContent(xml: string, tagName: string) {
  const match = xml.match(new RegExp(`<${tagName}>([\\s\\S]*?)<\\/${tagName}>`, 'i'));
  return match?.[1]?.replace(/\s+/g, ' ').trim() || '';
}

function extractXmlTagContents(xml: string, tagName: string) {
  return Array.from(xml.matchAll(new RegExp(`<${tagName}>([\\s\\S]*?)<\\/${tagName}>`, 'gi')))
    .map((match) => match[1]?.replace(/\s+/g, ' ').trim() || '')
    .filter(Boolean);
}

function normalizeCaptionCoverageText(text: string) {
  return text
    .toLowerCase()
    .replace(/[‘’]/g, "'")
    .replace(/&amp;/g, 'and')
    .replace(/[^a-z0-9\s',]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function getCaptionCoverageWarning(fullScript: string, sceneTexts: string[]) {
  const normalizedScript = normalizeCaptionCoverageText(fullScript);
  const normalizedCaptions = normalizeCaptionCoverageText(sceneTexts.join(' '));

  if (!normalizedScript || !normalizedCaptions) {
    return null;
  }

  if (normalizedScript === normalizedCaptions) {
    return null;
  }

  return 'Scene captions do not currently form a lossless chunking of the full <script>. They should preserve every script word in order, keep each caption inside a single sentence boundary, and preserve apostrophes for contractions plus any commas that fall inside the chunk.';
}

async function parseJsonResponse<T>(response: Response, fallbackMessage: string) {
  const payload = (await response.json().catch(() => ({}))) as ApiResponse<T>;
  if (!response.ok || payload.success === false) {
    throw new Error(payload.error || fallbackMessage);
  }
  return payload;
}

function MarkdownOrCode({ content, mode }: { content: string; mode: 'markdown' | 'xml' | 'text' }) {
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

  return (
    <pre className="overflow-auto whitespace-pre-wrap rounded-lg border border-border bg-background/70 p-4 text-xs text-foreground">
      <code>{body}</code>
    </pre>
  );
}

function pipelineStepBadge(stepStatus: 'completed' | 'active' | 'pending' | 'failed') {
  if (stepStatus === 'completed') return { label: 'Completed', variant: 'success' as const };
  if (stepStatus === 'active') return { label: 'In progress', variant: 'info' as const };
  if (stepStatus === 'failed') return { label: 'Needs attention', variant: 'destructive' as const };
  return { label: 'Pending', variant: 'secondary' as const };
}

function DebugContent({ content, format }: { content: string; format: 'text' | 'json' }) {
  if (!content.trim()) {
    return <p className="text-xs text-muted-foreground">No data captured.</p>;
  }

  return (
    <pre className="overflow-auto whitespace-pre-wrap rounded-lg border border-border bg-background/70 p-3 text-[11px] leading-5 text-foreground">
      <code>{content}</code>
    </pre>
  );
}

function VideoPipelinePanel({ project }: { project: Project }) {
  const pipeline = project.video.pipeline;
  const [expandedSteps, setExpandedSteps] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!pipeline) return;
    setExpandedSteps((prev) => {
      const next: Record<string, boolean> = {};
      for (const step of pipeline.steps) {
        next[step.id] = prev[step.id] ?? Boolean(project.video.pending && (step.status === 'active' || step.status === 'failed'));
      }
      return next;
    });
  }, [pipeline, project.video.pending]);

  if (!pipeline || pipeline.steps.length === 0) return null;

  return (
    <div className="space-y-4 rounded-lg border border-border p-4">
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-sm font-medium text-foreground">Final-video pipeline</h3>
          <Badge variant={pipeline.status === 'completed' ? 'success' : pipeline.status === 'failed' ? 'destructive' : pipeline.status === 'running' ? 'info' : 'secondary'}>
            {pipeline.status === 'completed' ? 'Completed' : pipeline.status === 'failed' ? 'Failed' : pipeline.status === 'running' ? 'Running' : 'Idle'}
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground">
          This shows the actual persisted pipeline artifacts so you can inspect what Qwen and the aligner used, even after the run finishes.
        </p>
        <div className="flex flex-wrap gap-2 text-[11px] text-muted-foreground">
          {pipeline.workDir ? <span>Work dir: {pipeline.workDir}</span> : null}
          {pipeline.transcriptPath ? <span>Transcript: {pipeline.transcriptPath}</span> : null}
          {pipeline.alignmentInputPath ? <span>Alignment input: {pipeline.alignmentInputPath}</span> : null}
          {pipeline.alignmentOutputPath ? <span>Alignment output: {pipeline.alignmentOutputPath}</span> : null}
        </div>
        {pipeline.warning ? <ValidationNotice title="Timing/alignment warning" message={pipeline.warning} className="mt-3" /> : null}
      </div>

      <div className="space-y-3">
        {pipeline.steps.map((step, index) => {
          const badge = pipelineStepBadge(step.status);
          const isExpanded = expandedSteps[step.id] ?? false;
          return (
            <div key={step.id} className="rounded-lg border border-border bg-background/40 p-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Step {index + 1}</span>
                    <h4 className="text-sm font-medium text-foreground">{step.label}</h4>
                    <Badge variant={badge.variant}>{badge.label}</Badge>
                  </div>
                  {step.summary ? <p className="text-sm text-muted-foreground">{step.summary}</p> : null}
                  {step.updatedAt ? <p className="text-xs text-muted-foreground">Updated {new Date(step.updatedAt).toLocaleString()}</p> : null}
                </div>
                {step.details && step.details.length > 0 ? (
                  <Button type="button" variant="outline" size="sm" onClick={() => setExpandedSteps((prev) => ({ ...prev, [step.id]: !isExpanded }))}>
                    {isExpanded ? 'Collapse details' : 'Expand details'}
                  </Button>
                ) : null}
              </div>

              {isExpanded && step.details && step.details.length > 0 ? (
                <div className="mt-4 space-y-3">
                  {step.details.map((detail) => (
                    <div key={detail.id} className="space-y-2 rounded-lg border border-border/80 p-3">
                      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{detail.label}</p>
                      <DebugContent content={detail.content} format={detail.format} />
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
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
  const hookStatus = project.hooks.pending
    ? 'working'
    : project.hooks.selectedHookText
      ? 'approved'
      : hooks.length > 0
        ? 'needs review'
        : 'draft';
  const manualMutationsBlocked = project.hooks.pending || Boolean(project.hooks.validationError);

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

  async function selectHook(option: HookOption) {
    setSaving(true);
    setError(null);

    try {
      await parseJsonResponse(
        await fetch(`/api/short-form-videos/${project.id}/hooks`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'select', hookId: option.id, hookText: option.text }),
        }),
        'Failed to select hook'
      );
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to select hook');
    } finally {
      setSaving(false);
    }
  }

  async function addHook() {
    setSaving(true);
    setError(null);

    try {
      await parseJsonResponse(
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

  async function saveHookEdit() {
    if (!editingHookId) return;

    setSaving(true);
    setError(null);

    try {
      await parseJsonResponse(
        await fetch(`/api/short-form-videos/${project.id}/hooks`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'edit',
            hookId: editingHookId,
            text: editingText,
            rationale: editingRationale,
          }),
        }),
        'Failed to save hook changes'
      );
      cancelEdit();
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save hook changes');
    } finally {
      setSaving(false);
    }
  }

  async function deleteHook(option: HookOption) {
    if (!window.confirm(`Delete this hook?\n\n${option.text}`)) {
      return;
    }

    setSaving(true);
    setError(null);

    try {
      await parseJsonResponse(
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
        description="Scribe generates multiple hook options using the content-hooks skill from the topic. You can also add, edit, or delete hooks manually here; selection stays single-select and downstream stages keep using the currently selected hook."
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
      ) : (
        <>
          <div className="grid gap-3">
            {hooks.map((option) => {
              const selected = option.id === project.hooks.selectedHookId;
              const editing = editingHookId === option.id;
              return (
                <div
                  key={option.id}
                  className={`rounded-lg border p-4 transition-colors ${selected ? 'border-emerald-500 bg-emerald-500/10' : 'border-border'}`}
                >
                  {editing ? (
                    <div className="space-y-3">
                      <div className="flex flex-wrap items-center gap-2">
                        {selected ? <Badge variant="outline">Selected</Badge> : null}
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
                        <Button onClick={() => void saveHookEdit()} disabled={saving || !editingText.trim()}>
                          {saving ? 'Saving…' : 'Save hook'}
                        </Button>
                        <Button variant="outline" onClick={cancelEdit} disabled={saving}>
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <button
                        type="button"
                        onClick={() => void selectHook(option)}
                        disabled={saving}
                        className="flex-1 text-left"
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          {selected ? <Badge variant="outline">Selected</Badge> : null}
                          {option.isManual ? <Badge variant="outline">Manual</Badge> : null}
                        </div>
                        <p className="mt-2 text-sm text-foreground">{option.text}</p>
                        {option.rationale ? <p className="mt-2 text-xs text-muted-foreground">{option.rationale}</p> : null}
                      </button>
                      <div className="flex shrink-0 flex-wrap gap-2">
                        <Button variant="outline" onClick={() => beginEdit(option)} disabled={saving || manualMutationsBlocked}>
                          Edit
                        </Button>
                        <Button variant="outline" onClick={() => void deleteHook(option)} disabled={saving || manualMutationsBlocked}>
                          Delete
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

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
      )}

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
}) {
  const [threads, setThreads] = useState<FeedbackThread[]>([]);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(doc.content);
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState(doc.status || 'draft');
  const [actionError, setActionError] = useState<string | null>(null);
  const [threadsLoading, setThreadsLoading] = useState(false);
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

  const fetchThreads = useCallback(async () => {
    setThreadsLoading(true);
    try {
      const payload = await parseJsonResponse<{ threads?: FeedbackThread[] }>(
        await fetch(`/api/short-form-videos/${projectId}/workflow/${stage}/feedback`),
        `Failed to load ${title.toLowerCase()} feedback`
      );
      setActionError(null);
      setThreads(payload.data?.threads || []);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : `Failed to load ${title.toLowerCase()} feedback`);
    } finally {
      setThreadsLoading(false);
    }
  }, [projectId, stage, title]);

  useEffect(() => {
    void fetchThreads();
  }, [fetchThreads]);

  useEffect(() => {
    if (!doc.pending) return;
    const id = window.setInterval(() => {
      void fetchThreads();
    }, 5000);
    return () => window.clearInterval(id);
  }, [doc.pending, fetchThreads]);

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
      await fetchThreads();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : `Failed to update ${title.toLowerCase()} status`);
    } finally {
      setSaving(false);
    }
  }

  async function addComment(content: string) {
    setActionError(null);
    try {
      await parseJsonResponse(
        await fetch(`/api/short-form-videos/${projectId}/workflow/${stage}/feedback`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content }),
        }),
        `Failed to add ${title.toLowerCase()} comment`
      );
      await fetchThreads();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : `Failed to add ${title.toLowerCase()} comment`);
    }
  }

  async function addReply(threadId: string, content: string) {
    setActionError(null);
    try {
      await parseJsonResponse(
        await fetch(`/api/short-form-videos/${projectId}/workflow/${stage}/feedback/${threadId}/comments`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content, author: 'user' }),
        }),
        `Failed to reply on ${title.toLowerCase()}`
      );
      await fetchThreads();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : `Failed to reply on ${title.toLowerCase()}`);
    }
  }

  async function updateThread(threadId: string, nextStatus: 'open' | 'resolved') {
    setActionError(null);
    try {
      await parseJsonResponse(
        await fetch(`/api/short-form-videos/${projectId}/workflow/${stage}/feedback/${threadId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: nextStatus }),
        }),
        `Failed to update ${title.toLowerCase()} feedback thread`
      );
      await fetchThreads();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : `Failed to update ${title.toLowerCase()} feedback thread`);
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
      <WorkflowSectionHeader title={title} description={description} status={doc.pending ? 'working' : status} />

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

          {threadsLoading && threads.length === 0 ? (
            <div className="rounded-lg border border-border p-4">
              <OrbitLoader label={`Loading ${title.toLowerCase()} feedback`} />
            </div>
          ) : null}

          <TopLevelComments
            threads={threads}
            deliverableId={`${projectId}:${stage}`}
            onCreateThread={addComment}
            onAddComment={addReply}
            onResolveThread={(threadId) => updateThread(threadId, 'resolved')}
            onReopenThread={(threadId) => updateThread(threadId, 'open')}
          />
        </>
      )}
    </Card>
  );
}

function ScriptSummaryPanel({ content }: { content: string }) {
  const body = useMemo(() => extractBody(content), [content]);
  const fullScript = useMemo(() => extractXmlTagContent(body, 'script'), [body]);
  const sceneTexts = useMemo(() => extractXmlTagContents(body, 'text'), [body]);
  const captionCoverageWarning = useMemo(() => getCaptionCoverageWarning(fullScript, sceneTexts), [fullScript, sceneTexts]);

  if (!fullScript) {
    return (
      <ValidationNotice
        title="Full spoken script missing"
        message="This XML should include a top-level <script> block. That full script is what Qwen TTS and forced alignment now use."
      />
    );
  }

  return (
    <div className="space-y-3">
      {captionCoverageWarning ? (
        <ValidationNotice
          title="Scene caption coverage warning"
          message={captionCoverageWarning}
        />
      ) : null}
      <div className="space-y-3 rounded-lg border border-border p-4">
        <div>
          <h3 className="text-sm font-medium text-foreground">Full spoken script</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            This is the narration source of truth. Scene captions should be a lossless chunking of it: 10 or fewer words per scene, no dropped or paraphrased words, apostrophes for contractions preserved, commas preserved when they fall inside the chunk, and no single caption may cross a sentence boundary.
          </p>
        </div>
        <div className="rounded-lg border border-border bg-background/70 p-4 text-sm leading-6 text-foreground">
          {fullScript}
        </div>
      </div>
    </div>
  );
}

function SceneImagesSection({ project, refresh }: { project: Project; refresh: () => Promise<unknown> }) {
  const [requestByScene, setRequestByScene] = useState<Record<string, string>>({});
  const [submittingScene, setSubmittingScene] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [styleOptions, setStyleOptions] = useState<ImageStyleOption[]>([]);
  const [savingStyle, setSavingStyle] = useState(false);

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
        if (!cancelled) {
          setStyleOptions(nextStyles);
        }
      } catch {
        if (!cancelled) {
          setStyleOptions([]);
        }
      }
    }

    void loadStyleOptions();
    return () => {
      cancelled = true;
    };
  }, []);

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
        'Failed to update image style'
      );
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update image style');
    } finally {
      setSavingStyle(false);
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
      title="Scene Images"
      stage="scene-images"
      description="Once the XML script is approved, the dashboard runs the xml-scene-images workflow directly to generate storyboard scene images and captioned previews. The generated artwork itself should contain no baked-in text; captions are overlaid separately. If a scene sets referencePreviousSceneImage='true', the generator also chains in the previous actual generated scene image for continuity. The currently selected reusable image style is applied on top of the shared/common constraints for this project’s scene generation run."
      doc={project.sceneImages}
      mode="markdown"
      emptyText="No scene images yet. Generate the storyboard after approving the XML script."
      triggerLabel="Generate scene images"
      triggerDescription={`This should create a scene manifest plus clean and captioned preview images using the selected image style${project.selectedImageStyleName ? ` (${project.selectedImageStyleName})` : ''}.`}
      onRefresh={refresh}
      collapseDocumentByDefault
      extra={
        <div className="space-y-4">
          {error ? <ValidationNotice title="Scene image change request failed" message={error} /> : null}
          <div className="rounded-lg border border-border bg-background/60 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="text-sm font-medium text-foreground">Image style for this project</h3>
                <p className="mt-1 max-w-2xl text-xs text-muted-foreground">
                  Pick the reusable style that should feed the direct scene-image generation path. Shared/common constraints from settings still apply regardless of which style you choose.
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
          {sceneProgress ? (
            <div className="rounded-lg border border-border bg-background/60 p-3">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="secondary">{sceneProgress.completed}/{sceneProgress.total} completed</Badge>
                {sceneProgress.pending > 0 ? <Badge variant="outline">{sceneProgress.pending} in progress</Badge> : null}
                {sceneProgress.scope === 'single' && sceneProgress.targetSceneId ? (
                  <Badge variant="outline">Revising {sceneProgress.targetSceneId}</Badge>
                ) : null}
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                {sceneProgress.pending > 0
                  ? sceneProgress.scope === 'single'
                    ? 'The targeted scene is shown as a loading placeholder until the revised image lands on disk. Other scenes remain visible.'
                    : 'Completed scenes stay visible while the remaining scene slots render as loading placeholders.'
                  : 'All expected scene images for the latest run are available.'}
              </p>
            </div>
          ) : null}
          {project.sceneImages.scenes.length > 0 ? (
            <div className="overflow-x-auto pb-2">
              <div className="flex min-w-max gap-4">
                {project.sceneImages.scenes.map((scene) => {
                  const sceneBusy = scene.status === 'in-progress';
                  const hasImage = Boolean(scene.previewImage || scene.image);

                  return (
                    <div key={scene.id} className="w-[260px] shrink-0 space-y-3 rounded-lg border border-border bg-background/60 p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-xs text-muted-foreground">Scene {scene.number}</p>
                          <p className="mt-1 text-sm font-medium text-foreground">{scene.caption}</p>
                        </div>
                        <Badge variant={sceneBusy ? 'secondary' : 'success'}>
                          {sceneBusy ? 'In progress' : 'Done'}
                        </Badge>
                      </div>
                      {sceneBusy ? (
                        <div className="relative aspect-[9/16] w-full overflow-hidden rounded-md border border-dashed border-border bg-muted/40">
                          <Skeleton className="h-full w-full rounded-none" />
                          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-4 text-center">
                            <OrbitLoader label={`Rendering scene ${scene.number}`} />
                            <p className="text-xs text-muted-foreground">This slot updates automatically when the new image lands.</p>
                          </div>
                        </div>
                      ) : hasImage ? (
                        <img src={scene.previewImage || scene.image} alt={scene.caption} className="aspect-[9/16] w-full rounded-md border border-border bg-muted object-cover" />
                      ) : (
                        <div className="flex aspect-[9/16] w-full items-center justify-center rounded-md border border-dashed border-border text-xs text-muted-foreground">
                          No image yet
                        </div>
                      )}
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
                            ? 'Scene is rendering…'
                            : (requestByScene[scene.id] || '').trim()
                              ? 'Request scene changes'
                              : 'Rerender scene'}
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
  const [defaultVoiceId, setDefaultVoiceId] = useState<string>('');
  const [savingVoice, setSavingVoice] = useState(false);
  const [voiceError, setVoiceError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadVoiceOptions() {
      try {
        const payload = await parseJsonResponse<WorkflowSettingsResponse>(
          await fetch('/api/short-form-videos/settings'),
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
        }
      } catch {
        if (!cancelled) {
          setVoiceOptions([]);
          setDefaultVoiceId('');
        }
      }
    }

    void loadVoiceOptions();
    return () => {
      cancelled = true;
    };
  }, []);

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
        'Failed to update project voice'
      );
      await refresh();
    } catch (err) {
      setVoiceError(err instanceof Error ? err.message : 'Failed to update project voice');
    } finally {
      setSavingVoice(false);
    }
  }

  const activeVoiceLabel = project.selectedVoiceName || voiceOptions.find((voice) => voice.id === defaultVoiceId)?.name || 'default voice';

  return (
    <StageReviewSection
      projectId={project.id}
      title="Video"
      stage="video"
      description="After scene images are approved, the dashboard renders the final short-form video directly through the xml-scene-video workflow using the selected reusable Qwen voice, transcript-driven forced alignment, ACE-Step instrumental background music, and per-scene XML camera motion that applies only to the image layer when explicitly set in the XML."
      doc={project.video}
      mode="markdown"
      emptyText="No video yet. Generate the final video after approving the scene images."
      triggerLabel="Generate final video"
      triggerDescription={`The video should be rendered from the XML <script> and approved scene assets using the selected voice${activeVoiceLabel ? ` (${activeVoiceLabel})` : ''} plus the default forced-alignment + ACE-Step final-video path unless explicitly overridden. Any scene-level cameraPanX/cameraPanY/cameraZoom/cameraShake values should affect image motion only, not the caption overlay, and omitted camera attributes should apply no motion for that effect.`}
      onRefresh={refresh}
      collapseDocumentByDefault
      extra={
        <div className="space-y-4">
          {voiceError ? <ValidationNotice title="Voice selection failed" message={voiceError} /> : null}
          <div className="rounded-lg border border-border bg-background/60 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="text-sm font-medium text-foreground">Voice for this project</h3>
                <p className="mt-1 max-w-2xl text-xs text-muted-foreground">
                  Pick which saved voice library entry should drive real final-video narration for this project. If you do not override it, the current global default voice is used.
                </p>
              </div>
              <Link
                href="/short-form-video/settings#tts-voice"
                target="_blank"
                rel="noreferrer"
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                Open voice library ↗
              </Link>
            </div>
            <div className="mt-3 flex flex-col gap-3 md:flex-row md:items-center">
              <Select
                value={project.selectedVoiceId || defaultVoiceId || ''}
                onChange={(event) => void saveProjectVoice(event.target.value)}
                disabled={savingVoice || voiceOptions.length === 0}
                className="max-w-sm"
              >
                {voiceOptions.map((voice) => (
                  <option key={voice.id} value={voice.id}>
                    {voice.name}{voice.id === defaultVoiceId ? ' (default)' : ''}
                  </option>
                ))}
              </Select>
              <div className="text-xs text-muted-foreground">
                {savingVoice
                  ? 'Saving voice selection…'
                  : project.selectedVoiceName
                    ? `Current project voice: ${project.selectedVoiceName}`
                    : defaultVoiceId
                      ? `Using the current default voice: ${activeVoiceLabel}`
                      : 'Using the fallback default voice.'}
              </div>
            </div>
          </div>
          <VideoPipelinePanel project={project} />
          {project.video.videoUrl ? (
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-foreground">Preview</h3>
              <video src={project.video.videoUrl} controls playsInline preload="metadata" className="max-h-[70vh] w-full rounded-lg border border-border bg-black" />
            </div>
          ) : null}
        </div>
      }
    />
  );
}

type DetailSectionId = 'topic' | 'hook' | 'research' | 'script' | 'scene-images' | 'video';

interface DetailSectionNavItem {
  id: DetailSectionId;
  label: string;
  available: boolean;
  unavailableLabel?: string;
}

export default function ShortFormVideoDetailPage() {
  const params = useParams<{ id: string }>();
  const projectId = typeof params?.id === 'string' ? params.id : '';

  const [project, setProject] = useState<Project | null>(null);
  const [topic, setTopic] = useState('');
  const [topicDirty, setTopicDirty] = useState(false);
  const [savingTopic, setSavingTopic] = useState(false);
  const [pageError, setPageError] = useState<string | null>(null);

  const shouldPoll = Boolean(projectId && (!project || project.pendingStages.length > 0 || savingTopic));
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
  const showSceneImages = project ? approved(project.script.status) : false;
  const showVideo = project ? approved(project.sceneImages.status) : false;
  const activeStages = project ? project.pendingStages.map(stageLabel) : [];
  const sections = useMemo<DetailSectionNavItem[]>(
    () => [
      { id: 'topic', label: 'Topic', available: true },
      { id: 'hook', label: 'Hook', available: showHook, unavailableLabel: 'Locked' },
      { id: 'research', label: 'Research', available: showResearch, unavailableLabel: 'Locked' },
      { id: 'script', label: 'Script', available: showScript, unavailableLabel: 'Locked' },
      { id: 'scene-images', label: 'Scene Images', available: showSceneImages, unavailableLabel: 'Locked' },
      { id: 'video', label: 'Video', available: showVideo, unavailableLabel: 'Locked' },
    ],
    [showHook, showResearch, showScript, showSceneImages, showVideo]
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
          title="Script"
          stage="script"
          description="Scribe generates the XML short-form script from the selected hook and approved research, starting with a full spoken <script> that prefers natural contractions and then deriving scene captions as a lossless 10-words-or-fewer chunking of that same text, with apostrophes and in-chunk commas preserved and each caption staying inside a single sentence boundary. Scene tags can also optionally declare previous-image continuity and intentionally sparse per-scene camera motion."
          doc={project.script}
          mode="xml"
          emptyText="No script yet. Generate it after approving the research."
          triggerLabel="Generate XML script"
          triggerDescription="The script should follow the updated XML pattern: a top-level <script> full narration block that prefers natural contractions, plus scene captions that preserve every script word in order, preserve apostrophes and in-chunk commas, stay within 10-or-fewer-word lines, and never cross a sentence boundary. Scenes may also use referencePreviousSceneImage plus cameraPanX/cameraPanY/cameraZoom/cameraShake when genuinely helpful, but most scenes should omit camera motion entirely and any motion that is used should usually stay subtle."
          onRefresh={refreshProject}
          extra={<ScriptSummaryPanel content={project.script.content} />}
        />
        </section>
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
