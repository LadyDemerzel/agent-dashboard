"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Badge } from "@/components/ui/badge";
import { DiffViewer } from "@/components/DiffViewer";
import { EditIconButton } from "@/components/EditIconButton";
import { RefreshIconButton } from "@/components/RefreshIconButton";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { OrbitLoader, Skeleton } from "@/components/ui/loading";
import { StatusBadge } from "@/components/StatusBadge";
import useSWR, { useSWRConfig } from "swr";
import { apiEnvelopeFetcher, realtimeSWRConfig } from "@/lib/swr-fetcher";
import {
  PipelinePanel,
  type PipelineStep,
} from "@/components/short-form-video/PipelinePanel";
import { SyntaxHighlightedCode } from "@/components/short-form-video/SyntaxHighlightedCode";
import {
  PendingNotice,
  RevisionRequestNotice,
  StageReviewControls,
  StaleArtifactNotice,
  ShortFormSubpageShell,
  ValidationNotice,
  WorkflowArtifactActionButton,
  WorkflowSectionHeader,
} from "@/components/short-form-video/WorkflowShared";
import {
  normalizeShortFormProject,
  type HookOption,
  type Scene,
  type ShortFormProjectClient as Project,
  type SoundDesignResolvedEventClient,
  type StageDoc,
  type TextScriptRunClient,
} from "@/lib/short-form-video-client";
import { getSoundDesignHandoffState } from "@/lib/short-form-sound-design-handoff";
import { generateClientDiff } from "@/lib/diff-client";
import { usePageScrollRestoration } from "@/components/usePageScrollRestoration";
import {
  buildShortFormDetailHref,
  buildShortFormSettingsHref,
  type ShortFormDetailRouteSection,
} from "@/lib/short-form-video-navigation";
import { getDetailRouteItems } from "@/lib/short-form-secondary-nav";
import { dispatchShortFormProjectOptimisticUpdate } from "@/lib/short-form-project-events";

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
  mode?: "voice-design" | "custom-voice";
  sourceType?: "generated" | "uploaded-reference";
}

interface MusicOption {
  id: string;
  name: string;
}

interface CaptionStyleOption {
  id: string;
  name: string;
  animationPresetId?: string;
  animationPreset?: string;
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
  captions?: Array<{
    id: string;
    index: number;
    text: string;
    start: number;
    end: number;
    wordCount?: number;
  }>;
  pipeline?: {
    status: "running" | "completed" | "failed" | "idle";
    warning?: string;
    steps: Array<
      XmlPipelineStep & { progressPercent?: number; progressLabel?: string }
    >;
  };
}

interface WorkflowSettingsResponse {
  prompts?: Record<string, string>;
  definitions?: Array<{
    key: string;
    title: string;
    description: string;
    stage: string;
  }>;
  imageStyles?: {
    defaultStyleId?: string;
    styles?: ImageStyleOption[];
  };
  videoRender?: {
    defaultVoiceId?: string;
    voices?: VoiceOption[];
    defaultMusicTrackId?: string;
    musicVolume?: number;
    chromaKeyEnabledByDefault?: boolean;
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
  soundDesign?: {
    defaultDuckingDb?: number;
    maxConcurrentOneShots?: number;
    library?: Array<{
      id: string;
      name: string;
      category?: string;
      semanticTypes?: Array<
        "impact" | "riser" | "click" | "whoosh" | "ambience" | "music-riser" | "music-reverb-tail" | "mix-duck" | "mix-eq"
      >;
      audioRelativePath?: string;
      timingType?: "point" | "bed" | "riser";
      anchorRatio?: number;
    }>;
  };
}

interface SoundLibraryOption {
  id: string;
  name: string;
  category?: string;
  semanticTypes?: Array<"impact" | "riser" | "click" | "whoosh" | "ambience" | "music-riser" | "music-reverb-tail" | "mix-duck" | "mix-eq">;
  audioRelativePath?: string;
  timingType?: "point" | "bed" | "riser";
  anchorRatio?: number;
  stylePalettes?: string[];
  frequencyBand?: 'low' | 'mid' | 'high' | 'full-range';
  layerRoles?: string[];
  literalness?: 'literal' | 'stylized' | 'emotional-metaphor';
}

type SoundDesignReviewRenderMode = "without-sfx" | "effects-only";

interface SoundDesignPreviewResponse {
  previewAudioUrl?: string;
  previewMode?: "full" | "without-sfx" | "effects-only";
  previewTrack?: string | null;
}

interface SoundDesignReviewVariant {
  key: "mix" | "narration" | "without-sfx" | "effects-only" | `track:${string}`;
  label: string;
  description: string;
  audioUrl?: string;
  kind: "saved" | "baseline" | "render";
  renderMode?: SoundDesignReviewRenderMode;
  renderTrack?: string;
}

type StageKey =
  | "research"
  | "script"
  | "scene-images"
  | "sound-design"
  | "video";

function shortFormProjectChanged(current: Project | null, next: Project) {
  if (!current) return true;
  return JSON.stringify(current) !== JSON.stringify(next);
}

const DETAIL_PAGE_META: Record<
  ShortFormDetailRouteSection,
  { title: string; description: string }
> = {
  topic: {
    title: "Topic",
    description:
      "Start with the topic. Saving here immediately refreshes the hook queue.",
  },
  hook: {
    title: "Hook",
    description:
      "Scribe generates multiple hook options using the content-hooks skill from the topic. In the default view, only the approved hook stays visible. Use Change hook to open the full editor, compare options, add manual hooks, generate more, and explicitly save the final selection.",
  },
  research: {
    title: "Research",
    description:
      "Oracle researches the topic after a hook is selected. Review, edit, comment, approve, or request changes here.",
  },
  "text-script": {
    title: "Text Script",
    description:
      "Scribe writes the approved plain narration script first. This page stays text-only so XML planning remains a separate review step.",
  },
  "generate-narration-audio": {
    title: "Generate Narration Audio",
    description:
      "Generate the original narration WAV, remove pauses, and force-align the processed narration for downstream timing.",
  },
  "plan-captions": {
    title: "Plan Captions",
    description:
      "Generate deterministic caption JSON from the existing transcript and forced alignment.",
  },
  "plan-visuals": {
    title: "Plan Visuals",
    description:
      "Write the XML asset and timeline plan from approved narration timing and caption artifacts.",
  },
  "generate-visuals": {
    title: "Generate Visuals",
    description:
      "Once the XML script is approved, the dashboard runs the visuals workflow directly to generate or reuse the needed green-screen visual plates from the XML asset/timeline model. Exact asset reuse never regenerates the image unnecessarily; reference-derived new assets remain explicit in the XML and manifest for debugging. Captions are overlaid separately and the selected background video is composited behind each visual in preview and final render.",
  },
  "plan-sound-design": {
    title: "Plan Sound Design",
    description:
      "Generate and review the Plan Sound Design XML artifact before any audio rendering or event overrides happen.",
  },
  "generate-sound-design": {
    title: "Generate Sound Design",
    description:
      "Resolve the Plan Sound Design XML against the shared library, render audio previews, tune event-level overrides, then either approve the mix or skip it explicitly.",
  },
  "final-video": {
    title: "Final Video",
    description:
      "After generated visuals are approved, the dashboard renders the final short-form video directly through the xml-scene-video workflow by reusing the narration and forced-alignment artifacts already produced during Generate Narration Audio, plus background video, optional chroma-key compositing, saved music, subtitle burn-in, and any explicit XML camera motion.",
  },
};

function getShortFormProjectIdentity(project: Project | null) {
  const hookText = project?.hooks?.selectedHookText?.trim();
  if (hookText) return hookText;

  const topicText = project?.topic?.trim();
  if (topicText) return topicText;

  const titleText = project?.title?.trim();
  return titleText || "Untitled short-form video";
}

function approved(status?: string) {
  return status === "approved" || status === "published";
}

function needsReviewStatus(status?: string) {
  const normalized = status?.trim().toLowerCase().replace(/[-_]+/g, " ");
  return normalized === "needs review" || normalized === "review";
}

function soundDesignStageStatus(project: Project) {
  if (project.soundDesign.pending) return "working";

  const handoff = getSoundDesignHandoffState(project);
  if (handoff.canProceedToFinalVideo) return handoff.status;
  if (project.soundDesign.exists)
    return handoff.canApprove ? "ready" : "needs review";
  return approved(project.sceneImages.status)
    ? "ready"
    : project.soundDesign.status || "draft";
}

function extractBody(content: string) {
  const match = content.match(/^---\s*\n[\s\S]*?\n---\s*\n?([\s\S]*)$/);
  return match ? match[1] : content;
}

type TextScriptPhase =
  | "writing"
  | "reviewing"
  | "improving"
  | "completed"
  | "idle";

function getTextScriptPhaseLabel(phase: TextScriptPhase) {
  if (phase === "writing") return "Writing draft";
  if (phase === "reviewing") return "Grading draft";
  if (phase === "improving") return "Improving draft";
  if (phase === "completed") return "Completed";
  return "Idle";
}

function getTextScriptPhaseStatus(
  phase: TextScriptPhase,
  step: "writing" | "reviewing" | "improving",
) {
  if (phase === "writing") return step === "writing" ? "active" : "pending";
  if (phase === "reviewing")
    return step === "writing"
      ? "completed"
      : step === "reviewing"
        ? "active"
        : "pending";
  if (phase === "improving")
    return step === "improving" ? "active" : "completed";
  if (phase === "completed") return "completed";
  return "pending";
}

function getTextScriptRunState(
  run: TextScriptRunClient | undefined,
  fallbackMaxIterations?: number | null,
) {
  const iterations = run?.iterations || [];
  const maxIterations =
    run?.maxIterations ||
    fallbackMaxIterations ||
    Math.max(1, iterations.length || 1);
  const latestIteration = iterations[iterations.length - 1];
  const activeStep = run?.activeStep;
  const activeIterationNumber = run?.activeIterationNumber;

  if (run?.status === "running" && activeStep) {
    const currentIteration =
      activeIterationNumber || latestIteration?.number || 1;
    return {
      phase: activeStep,
      currentIteration,
      maxIterations,
      completedIterations:
        activeStep === "improving" || activeStep === "completed"
          ? Math.max(0, currentIteration - 1)
          : Math.max(0, currentIteration - 1),
      statusText: run.activeStatusText,
    };
  }

  if (!run || run.status === "running") {
    if (!latestIteration) {
      return {
        phase: "writing" as const,
        currentIteration: 1,
        maxIterations,
        completedIterations: 0,
        statusText: run?.activeStatusText,
      };
    }

    if (
      !latestIteration.reviewContent?.trim() &&
      !latestIteration.reviewDecision
    ) {
      return {
        phase: "reviewing" as const,
        currentIteration: latestIteration.number,
        maxIterations,
        completedIterations: Math.max(0, latestIteration.number - 1),
        statusText: run?.activeStatusText,
      };
    }

    if (
      latestIteration.reviewDecision === "needs-improvement" &&
      latestIteration.number < maxIterations
    ) {
      return {
        phase: "improving" as const,
        currentIteration: latestIteration.number + 1,
        maxIterations,
        completedIterations: latestIteration.number,
        statusText: run?.activeStatusText,
      };
    }
  }

  return {
    phase: iterations.length > 0 ? ("completed" as const) : ("idle" as const),
    currentIteration: latestIteration?.number || 0,
    maxIterations,
    completedIterations: iterations.filter(
      (iteration) =>
        iteration.reviewDecision && iteration.reviewDecision !== "manual-edit",
    ).length,
    statusText: run?.activeStatusText,
  };
}

async function parseJsonResponse<T>(
  response: Response,
  fallbackMessage: string,
) {
  const payload = (await response.json().catch(() => ({}))) as ApiResponse<T>;
  if (!response.ok || payload.success === false) {
    throw new Error(payload.error || fallbackMessage);
  }
  return payload;
}

function appendPreviewRefreshParam(url: string, token?: string | null) {
  if (!token) return url;
  return `${url}${url.includes("?") ? "&" : "?"}preview=${encodeURIComponent(token)}`;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function roundToStep(value: number, step: number) {
  if (!Number.isFinite(value)) return 0;
  const decimals = String(step).includes(".")
    ? String(step).split(".")[1]!.length
    : 0;
  const rounded = Math.round(value / step) * step;
  return Number(rounded.toFixed(decimals));
}

function formatSignedNumber(value: number, digits = 1) {
  const normalized = Number.isFinite(value) ? Number(value.toFixed(digits)) : 0;
  return `${normalized > 0 ? "+" : ""}${normalized}`;
}

function formatDb(value: number) {
  return `${formatSignedNumber(value, 1)} dB`;
}

function formatMs(value: number) {
  return `${Math.round(value)} ms`;
}

function formatSeconds(value?: number) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "—";
  return `${value.toFixed(2)}s`;
}

function getSoundDesignEventEffectiveNudgeMs(
  event: SoundDesignResolvedEventClient,
) {
  return typeof event.manualNudgeMs === "number"
    ? clamp(Math.round(event.manualNudgeMs), -1200, 1200)
    : 0;
}

function getSoundDesignEventEffectiveGainDb(
  event: SoundDesignResolvedEventClient,
) {
  return typeof event.manualGainDb === "number"
    ? roundToStep(event.manualGainDb, 0.5)
    : roundToStep(event.resolvedGainDb, 0.5);
}

function getSoundDesignEventEffectiveWindow(
  event: SoundDesignResolvedEventClient,
) {
  const effectiveNudge = getSoundDesignEventEffectiveNudgeMs(event);
  const start = Math.max(0, event.resolvedStartSeconds + effectiveNudge / 1000);
  const end =
    typeof event.resolvedEndSeconds === "number"
      ? Math.max(start, event.resolvedEndSeconds + effectiveNudge / 1000)
      : undefined;

  return {
    start,
    end,
    effectiveNudge,
    effectiveGain: getSoundDesignEventEffectiveGainDb(event),
  };
}

function serializeSoundDesignOverrides(
  events: SoundDesignResolvedEventClient[],
) {
  return JSON.stringify(
    events.map((event) => ({
      id: event.id,
      muted: Boolean(event.muted),
      solo: Boolean(event.solo),
      manualAssetId: event.manualAssetId || null,
      manualGainDb:
        typeof event.manualGainDb === "number"
          ? roundToStep(event.manualGainDb, 0.5)
          : null,
      manualNudgeMs:
        typeof event.manualNudgeMs === "number"
          ? Math.round(event.manualNudgeMs)
          : null,
    })),
  );
}

function MarkdownOrCode({
  content,
  mode,
}: {
  content: string;
  mode: "markdown" | "xml" | "json" | "text";
}) {
  const body = useMemo(() => extractBody(content), [content]);

  if (!body.trim()) {
    return (
      <div className="text-sm text-muted-foreground">Nothing here yet.</div>
    );
  }

  if (mode === "markdown") {
    return (
      <article className="prose prose-sm prose-invert !max-w-none">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{body}</ReactMarkdown>
      </article>
    );
  }

  return (
    <SyntaxHighlightedCode
      content={body}
      language={mode === "xml" ? "xml" : mode === "json" ? "json" : "text"}
    />
  );
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
    if (playAttempt && typeof playAttempt.catch === "function") {
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
          <img
            src={poster}
            alt={label}
            className="h-full w-full object-cover opacity-90 transition-opacity group-hover:opacity-100"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-muted/30 text-xs text-muted-foreground">
            Preview ready
          </div>
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
      description="This shows the actual persisted final-video artifacts, including whether narration/alignment were reused from Generate Narration Audio or regenerated, plus the timing path the renderer actually used."
      status={pipeline.status}
      warning={pipeline.warning}
      steps={pipeline.steps}
      metadata={
        <>
          {pipeline.workDir ? <span>Work dir: {pipeline.workDir}</span> : null}
          {pipeline.transcriptPath ? (
            <span>Transcript: {pipeline.transcriptPath}</span>
          ) : null}
          {pipeline.alignmentInputPath ? (
            <span>Alignment input: {pipeline.alignmentInputPath}</span>
          ) : null}
          {pipeline.alignmentOutputPath ? (
            <span>Alignment output: {pipeline.alignmentOutputPath}</span>
          ) : null}
        </>
      }
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
  const [description, setDescription] = useState("");
  const [manualHookText, setManualHookText] = useState("");
  const [manualHookRationale, setManualHookRationale] = useState("");
  const [editingHookId, setEditingHookId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState("");
  const [editingRationale, setEditingRationale] = useState("");
  const [expanded, setExpanded] = useState(!project.hooks.selectedHookId);
  const [draftSelectedHookId, setDraftSelectedHookId] = useState<string | null>(
    project.hooks.selectedHookId ?? null,
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hooks = project.hooks.generations.flatMap((generation) =>
    generation.options.map((option) => ({
      ...option,
      generationId: generation.id,
      generationDescription: generation.description,
      isManual: generation.id.startsWith("manual-"),
    })),
  );
  const hooksById = useMemo(
    () => new Map(hooks.map((option) => [option.id, option])),
    [hooks],
  );
  const savedSelectedHookId = project.hooks.selectedHookId ?? null;
  const savedSelectedHook = savedSelectedHookId
    ? (hooksById.get(savedSelectedHookId) ?? null)
    : null;
  const editingOriginal = editingHookId
    ? (hooksById.get(editingHookId) ?? null)
    : null;
  const normalizedEditingText = editingText.trim();
  const normalizedEditingRationale = editingRationale.trim();
  const hasDraftEdit = Boolean(
    editingHookId &&
    editingOriginal &&
    (normalizedEditingText !== editingOriginal.text ||
      normalizedEditingRationale !== (editingOriginal.rationale ?? "")),
  );
  const hasInvalidDraftEdit = Boolean(editingHookId && !normalizedEditingText);
  const draftSelectionChanged =
    (draftSelectedHookId ?? null) !== savedSelectedHookId;
  const hasUnsavedChanges = draftSelectionChanged || hasDraftEdit;
  const compactView = Boolean(savedSelectedHook && !expanded);
  const visibleHooks =
    compactView && savedSelectedHook ? [savedSelectedHook] : hooks;
  const hookStatus = project.hooks.pending
    ? "working"
    : hasUnsavedChanges
      ? "needs review"
      : project.hooks.selectedHookText
        ? "approved"
        : hooks.length > 0
          ? "needs review"
          : "draft";
  const manualMutationsBlocked =
    project.hooks.pending || Boolean(project.hooks.validationError);

  useEffect(() => {
    setExpanded(!project.hooks.selectedHookId);
    setDraftSelectedHookId(project.hooks.selectedHookId ?? null);
    setEditingHookId(null);
    setEditingText("");
    setEditingRationale("");
    setError(null);
  }, [project.id, project.hooks.selectedHookId]);

  useEffect(() => {
    if (!expanded && !editingHookId) {
      setDraftSelectedHookId(savedSelectedHookId);
    }
  }, [savedSelectedHookId, expanded, editingHookId]);

  async function trigger(action: "generate" | "more") {
    setSaving(true);
    setError(null);

    try {
      await parseJsonResponse(
        await fetch(`/api/short-form-videos/${project.id}/hooks`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action, description }),
        }),
        "Failed to trigger hook generation",
      );
      setDescription("");
      await refresh();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to trigger hook generation",
      );
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
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "add",
            text: manualHookText,
            rationale: manualHookRationale,
          }),
        }),
        "Failed to add hook",
      );
      setManualHookText("");
      setManualHookRationale("");
      setDraftSelectedHookId(
        payload.data?.hooks?.selectedHookId ??
          payload.data?.selectedHookId ??
          draftSelectedHookId,
      );
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add hook");
    } finally {
      setSaving(false);
    }
  }

  function beginEdit(
    option: HookOption & {
      isManual: boolean;
      generationId: string;
      generationDescription?: string;
    },
  ) {
    setEditingHookId(option.id);
    setEditingText(option.text);
    setEditingRationale(option.rationale || "");
    setError(null);
  }

  function cancelEdit() {
    setEditingHookId(null);
    setEditingText("");
    setEditingRationale("");
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
      setError("Hook text is required");
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
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              action: "edit",
              hookId: editingHookId,
              text: normalizedEditingText,
              rationale: normalizedEditingRationale,
            }),
          }),
          "Failed to save hook changes",
        );
      }

      if (draftSelectedHookId && draftSelectionChanged) {
        await parseJsonResponse(
          await fetch(`/api/short-form-videos/${project.id}/hooks`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              action: "select",
              hookId: draftSelectedHookId,
            }),
          }),
          "Failed to save selected hook",
        );
      }

      cancelEdit();
      setExpanded(false);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save hook");
    } finally {
      setSaving(false);
    }
  }

  async function deleteHook(option: HookOption) {
    if (
      !window.confirm(`Delete this hook?

${option.text}`)
    ) {
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const payload = await parseJsonResponse<Project>(
        await fetch(`/api/short-form-videos/${project.id}/hooks`, {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ hookId: option.id }),
        }),
        "Failed to delete hook",
      );
      if (editingHookId === option.id) {
        cancelEdit();
      }
      setDraftSelectedHookId(
        payload.data?.hooks?.selectedHookId ??
          payload.data?.selectedHookId ??
          null,
      );
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete hook");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      {project.hooks.validationError ? (
        <ValidationNotice
          title="hooks.json is malformed"
          message={`${project.hooks.validationError} Fix the file or regenerate hooks before making manual hook changes.`}
        />
      ) : null}

      {error ? (
        <ValidationNotice title="Hook action failed" message={error} />
      ) : null}

      {hooks.length === 0 ? (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            {project.hooks.pending
              ? "Hook generation is running. New options will appear here when they are ready."
              : "No hooks yet. Generate the first batch once the topic is set, or add one manually below."}
          </p>
          <Button
            onClick={() => void trigger("generate")}
            disabled={project.hooks.pending || saving}
          >
            {project.hooks.pending || saving
              ? "Generating hooks…"
              : "Generate hooks"}
          </Button>
          {project.hooks.pending ? (
            <PendingNotice label="Waiting for Scribe to write hook options" />
          ) : null}
        </div>
      ) : null}

      {hooks.length > 0 ? (
        <>
          {expanded ? (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-background/60 px-4 py-3">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={hasUnsavedChanges ? "secondary" : "outline"}>
                  {hasUnsavedChanges
                    ? "Unsaved changes"
                    : "Editing hook selection"}
                </Badge>
                {savedSelectedHook ? (
                  <Badge variant="outline">Approved hook saved</Badge>
                ) : null}
              </div>
              <div className="flex flex-wrap gap-2">
                {savedSelectedHook ? (
                  <Button
                    variant="outline"
                    onClick={cancelExpandedMode}
                    disabled={saving}
                  >
                    Cancel
                  </Button>
                ) : null}
                <Button
                  onClick={() => void saveHook()}
                  disabled={saving || hasInvalidDraftEdit || !hasUnsavedChanges}
                >
                  {saving ? "Saving…" : "Save hook"}
                </Button>
              </div>
            </div>
          ) : savedSelectedHook ? (
            <div className="flex justify-end">
              <Button
                variant="outline"
                onClick={startChangingHook}
                disabled={saving || project.hooks.pending}
              >
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
                  ? "border-emerald-500 bg-emerald-500/10"
                  : "border-amber-500 bg-amber-500/10"
                : isSavedSelected
                  ? "border-emerald-500/60 bg-emerald-500/5"
                  : "border-border";

              return (
                <div
                  key={option.id}
                  className={`rounded-lg border p-4 transition-colors ${cardClass}`}
                >
                  {editing ? (
                    <div className="space-y-3">
                      <div className="flex flex-wrap items-center gap-2">
                        {isSavedSelected ? (
                          <Badge variant="outline">Saved</Badge>
                        ) : null}
                        {isDraftSelected ? (
                          <Badge variant="secondary">Draft selection</Badge>
                        ) : null}
                        {option.isManual ? (
                          <Badge variant="outline">Manual</Badge>
                        ) : null}
                      </div>
                      <Textarea
                        value={editingText}
                        onChange={(event) => setEditingText(event.target.value)}
                        className="min-h-[90px]"
                        placeholder="Hook text (up to 10 words)"
                      />
                      <Input
                        value={editingRationale}
                        onChange={(event) =>
                          setEditingRationale(event.target.value)
                        }
                        placeholder="Optional rationale"
                      />
                      <div className="flex flex-wrap gap-2">
                        <Button
                          variant="outline"
                          onClick={cancelEdit}
                          disabled={saving}
                        >
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
                        className={`flex-1 text-left ${expanded ? "" : "cursor-default"}`}
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          {isSavedSelected ? (
                            <Badge variant="outline">Saved</Badge>
                          ) : null}
                          {isDraftSelected && expanded ? (
                            <Badge variant="secondary">Draft selection</Badge>
                          ) : null}
                          {option.isManual ? (
                            <Badge variant="outline">Manual</Badge>
                          ) : null}
                        </div>
                        <p className="mt-2 text-sm text-foreground">
                          {option.text}
                        </p>
                        {option.rationale ? (
                          <p className="mt-2 text-xs text-muted-foreground">
                            {option.rationale}
                          </p>
                        ) : null}
                      </button>
                      {expanded ? (
                        <div className="flex shrink-0 flex-wrap gap-2">
                          <EditIconButton
                            onClick={() => beginEdit(option)}
                            disabled={saving || manualMutationsBlocked}
                            tooltip="Edit hook"
                          />
                          <Button
                            variant="outline"
                            onClick={() => void deleteHook(option)}
                            disabled={saving || manualMutationsBlocked}
                          >
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
                  <h3 className="text-sm font-medium text-foreground">
                    Add hook manually
                  </h3>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Manual hooks are saved into this project’s hooks.json
                    alongside generated batches. If nothing is selected yet, the
                    newly added hook becomes the selected hook automatically.
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
                  onChange={(event) =>
                    setManualHookRationale(event.target.value)
                  }
                  placeholder="Optional rationale"
                />
                <Button
                  onClick={() => void addHook()}
                  disabled={
                    saving || manualMutationsBlocked || !manualHookText.trim()
                  }
                >
                  {saving ? "Saving…" : "Add manual hook"}
                </Button>
              </div>

              <div className="space-y-3 border-t border-border pt-4">
                <Textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Optional direction for more hooks (e.g. punchier, more contrarian, more curiosity-driven)"
                  className="min-h-[90px]"
                />
                <Button
                  variant="outline"
                  onClick={() => void trigger("more")}
                  disabled={project.hooks.pending || saving}
                >
                  {project.hooks.pending || saving
                    ? "Generating…"
                    : "Generate more hooks"}
                </Button>
                {project.hooks.pending ? (
                  <PendingNotice label="Generating additional hook options" />
                ) : null}
              </div>
            </>
          ) : null}
        </>
      ) : null}

      {hooks.length === 0 ? (
        <div className="space-y-3 border-t border-border pt-4">
          <div>
            <h3 className="text-sm font-medium text-foreground">
              Add hook manually
            </h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Manual hooks are saved into this project’s hooks.json alongside
              generated batches. If nothing is selected yet, the newly added
              hook becomes the selected hook automatically.
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
          <Button
            onClick={() => void addHook()}
            disabled={
              saving || manualMutationsBlocked || !manualHookText.trim()
            }
          >
            {saving ? "Saving…" : "Add manual hook"}
          </Button>
        </div>
      ) : null}
    </div>
  );
}

function getXmlPipelineSteps(doc: XmlScriptDoc | null, ids: string[]) {
  const steps = doc?.pipeline?.steps || [];
  return ids
    .map((id) => steps.find((step) => step.id === id))
    .filter((step): step is NonNullable<(typeof steps)[number]> =>
      Boolean(step),
    );
}

function getXmlPipelineStep(doc: XmlScriptDoc | null, id: string) {
  return doc?.pipeline?.steps.find((step) => step.id === id) || null;
}

function getXmlPipelineTaskStatus(
  steps: Array<
    XmlPipelineStep & { progressPercent?: number; progressLabel?: string }
  >,
): "running" | "completed" | "failed" | "idle" {
  if (steps.some((step) => step.status === "failed")) return "failed";
  if (steps.some((step) => step.status === "active")) return "running";
  if (steps.length > 0 && steps.every((step) => step.status === "completed"))
    return "completed";
  return "idle";
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
  if (!Number.isFinite(value)) return "0.0s";
  return `${value.toFixed(1)}s`;
}

interface SoundLibraryOption {
  id: string;
  name: string;
  audioRelativePath?: string;
  timingType?: "point" | "bed" | "riser";
}

function getSoundDesignAssetLabel(asset?: SoundLibraryOption) {
  if (!asset) return "Auto match";
  return asset.timingType ? `${asset.name} (${asset.timingType})` : asset.name;
}

function buildSoundDesignAssetOptions(
  event: SoundDesignResolvedEventClient,
  library: SoundLibraryOption[],
) {
  const orderedIds = [
    event.manualAssetId,
    event.assetId,
    ...(event.compatibleAssetIds || []),
    ...library.map((asset) => asset.id),
  ].filter(
    (value): value is string =>
      typeof value === "string" && value.trim().length > 0,
  );
  const assetById = new Map(library.map((asset) => [asset.id, asset]));
  const seen = new Set<string>();
  const options: SoundLibraryOption[] = [];

  orderedIds.forEach((id) => {
    const asset = assetById.get(id);
    if (!asset || !asset.audioRelativePath || seen.has(asset.id)) return;
    seen.add(asset.id);
    options.push(asset);
  });

  return options;
}

function getSelectedSoundDesignAsset(
  event: SoundDesignResolvedEventClient,
  library: SoundLibraryOption[],
) {
  const assetId = event.manualAssetId || event.assetId;
  if (!assetId) return undefined;
  return library.find((asset) => asset.id === assetId);
}

function VisualCaptionTimeline({
  captions,
  scenes,
}: {
  captions: NonNullable<Project["xmlScript"]["captions"]>;
  scenes: Project["sceneImages"]["scenes"];
}) {
  const visualSpans = scenes.filter(
    (scene) =>
      typeof scene.startTime === "number" &&
      typeof scene.endTime === "number" &&
      (scene.endTime || 0) > (scene.startTime || 0),
  );
  const captionSpans = (captions || []).filter(
    (caption) => caption.end > caption.start,
  );
  const maxEnd = Math.max(
    ...visualSpans.map((scene) => scene.endTime || 0),
    ...captionSpans.map((caption) => caption.end),
    0,
  );

  if (maxEnd <= 0 || (visualSpans.length === 0 && captionSpans.length === 0))
    return null;

  return (
    <div className="rounded-lg border border-border bg-background/60 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-medium text-foreground">
            Caption / visual timeline
          </h3>
          <p className="mt-1 max-w-2xl text-xs text-muted-foreground">
            Top lane = deterministic captions JSON. Bottom lane = XML visual
            spans. Width is proportional to actual time so you can see overlaps
            instead of a 1:1 caption-to-image mapping.
          </p>
        </div>
        <Badge variant="outline">{formatTimelineSeconds(maxEnd)} total</Badge>
      </div>
      <div className="mt-4 space-y-4 overflow-x-auto pb-2">
        <div className="min-w-[720px] space-y-3">
          <div>
            <div className="mb-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              Captions
            </div>
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
                  <div className="truncate text-[10px] text-muted-foreground">
                    {formatTimelineSeconds(caption.start)} →{" "}
                    {formatTimelineSeconds(caption.end)}
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div>
            <div className="mb-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              Generated visual spans
            </div>
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
                  <div className="truncate font-medium">
                    V{scene.number} · {scene.caption}
                  </div>
                  <div className="truncate text-[10px] text-muted-foreground">
                    {formatTimelineSeconds(scene.startTime || 0)} →{" "}
                    {formatTimelineSeconds(scene.endTime || 0)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function XMLScriptSection({
  project,
  section,
  onProjectRefresh,
}: {
  project: Project;
  section: "generate-narration-audio" | "plan-captions" | "plan-visuals";
  onProjectRefresh: () => Promise<unknown>;
}) {
  const [doc, setDoc] = useState<XmlScriptDoc | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [voiceOptions, setVoiceOptions] = useState<VoiceOption[]>([]);
  const [defaultVoiceId, setDefaultVoiceId] = useState<string>("");
  const [defaultCaptionMaxWords, setDefaultCaptionMaxWords] = useState<
    number | null
  >(null);
  const [
    defaultPauseRemovalMinSilenceDurationSeconds,
    setDefaultPauseRemovalMinSilenceDurationSeconds,
  ] = useState<number | null>(null);
  const [
    defaultPauseRemovalSilenceThresholdDb,
    setDefaultPauseRemovalSilenceThresholdDb,
  ] = useState<number | null>(null);
  const [projectCaptionMaxWordsOverride, setProjectCaptionMaxWordsOverride] =
    useState<string>(
      project.captionMaxWordsOverride
        ? String(project.captionMaxWordsOverride)
        : "",
    );
  const [
    projectPauseRemovalMinSilenceDurationSecondsOverride,
    setProjectPauseRemovalMinSilenceDurationSecondsOverride,
  ] = useState<string>(
    project.pauseRemovalMinSilenceDurationSecondsOverride
      ? String(project.pauseRemovalMinSilenceDurationSecondsOverride)
      : "",
  );
  const [
    projectPauseRemovalSilenceThresholdDbOverride,
    setProjectPauseRemovalSilenceThresholdDbOverride,
  ] = useState<string>(
    project.pauseRemovalSilenceThresholdDbOverride
      ? String(project.pauseRemovalSilenceThresholdDbOverride)
      : "",
  );
  const [savingVoice, setSavingVoice] = useState(false);
  const [savingCaptionMaxWords, setSavingCaptionMaxWords] = useState(false);
  const [savingPauseRemoval, setSavingPauseRemoval] = useState(false);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [captionMaxWordsError, setCaptionMaxWordsError] = useState<
    string | null
  >(null);
  const [pauseRemovalError, setPauseRemovalError] = useState<string | null>(
    null,
  );
  const shouldPoll = Boolean(
    project.id && (doc?.pending || doc?.pipeline?.status === "running"),
  );
  const {
    data: xmlScriptPayload,
    error: xmlScriptLoadError,
    isLoading,
  } = useSWR<ApiResponse<XmlScriptDoc>>(
    project.id ? `/api/short-form-videos/${project.id}/xml-script` : null,
    apiEnvelopeFetcher,
    {
      ...realtimeSWRConfig,
      refreshInterval: shouldPoll ? 4000 : 0,
    },
  );
  const loading = isLoading && !doc;

  const applyXmlScriptPayload = useCallback((payload: ApiResponse<XmlScriptDoc>) => {
    setDoc(payload.data || null);
    setDraft(payload.data?.content || "");
    setError(null);
  }, []);

  useEffect(() => {
    if (!xmlScriptPayload) return;
    applyXmlScriptPayload(xmlScriptPayload);
  }, [applyXmlScriptPayload, xmlScriptPayload]);

  useEffect(() => {
    if (!xmlScriptLoadError) return;
    setError(
      xmlScriptLoadError instanceof Error
        ? xmlScriptLoadError.message
        : "Failed to load XML script",
    );
  }, [xmlScriptLoadError]);

  useEffect(() => {
    setProjectCaptionMaxWordsOverride(
      project.captionMaxWordsOverride
        ? String(project.captionMaxWordsOverride)
        : "",
    );
  }, [project.captionMaxWordsOverride]);

  useEffect(() => {
    setProjectPauseRemovalMinSilenceDurationSecondsOverride(
      project.pauseRemovalMinSilenceDurationSecondsOverride
        ? String(project.pauseRemovalMinSilenceDurationSecondsOverride)
        : "",
    );
  }, [project.pauseRemovalMinSilenceDurationSecondsOverride]);

  useEffect(() => {
    setProjectPauseRemovalSilenceThresholdDbOverride(
      project.pauseRemovalSilenceThresholdDbOverride
        ? String(project.pauseRemovalSilenceThresholdDbOverride)
        : "",
    );
  }, [project.pauseRemovalSilenceThresholdDbOverride]);

  const { data: workflowSettingsPayload } = useSWR<ApiResponse<WorkflowSettingsResponse>>(
    "/api/short-form-videos/settings",
    apiEnvelopeFetcher,
    realtimeSWRConfig,
  );

  useEffect(() => {
    if (!workflowSettingsPayload) return;
    const nextVoices = Array.isArray(workflowSettingsPayload.data?.videoRender?.voices)
      ? workflowSettingsPayload.data.videoRender.voices.filter(
          (voice): voice is VoiceOption =>
            Boolean(
              voice &&
              typeof voice.id === "string" &&
              typeof voice.name === "string",
            ),
        )
      : [];
    setVoiceOptions(nextVoices);
    setDefaultVoiceId(workflowSettingsPayload.data?.videoRender?.defaultVoiceId || "");
    setDefaultCaptionMaxWords(
      typeof workflowSettingsPayload.data?.videoRender?.captionMaxWords === "number"
        ? workflowSettingsPayload.data.videoRender.captionMaxWords
        : null,
    );
    setDefaultPauseRemovalMinSilenceDurationSeconds(
      typeof workflowSettingsPayload.data?.videoRender?.pauseRemoval
        ?.minSilenceDurationSeconds === "number"
        ? workflowSettingsPayload.data.videoRender.pauseRemoval.minSilenceDurationSeconds
        : null,
    );
    setDefaultPauseRemovalSilenceThresholdDb(
      typeof workflowSettingsPayload.data?.videoRender?.pauseRemoval
        ?.silenceThresholdDb === "number"
        ? workflowSettingsPayload.data.videoRender.pauseRemoval.silenceThresholdDb
        : null,
    );
  }, [workflowSettingsPayload]);

  async function saveManual(status?: string) {
    setSaving(true);
    try {
      const payload = await parseJsonResponse<XmlScriptDoc>(
        await fetch(`/api/short-form-videos/${project.id}/xml-script`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            content: draft,
            ...(status ? { status } : {}),
          }),
        }),
        "Failed to save XML script",
      );
      setDoc(payload.data || null);
      setEditing(false);
      setError(null);
      void onProjectRefresh().catch(() => undefined);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to save XML script",
      );
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
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ selectedVoiceId: voiceId }),
        }),
        "Failed to update XML narration voice",
      );
      await onProjectRefresh();
    } catch (err) {
      setVoiceError(
        err instanceof Error
          ? err.message
          : "Failed to update XML narration voice",
      );
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
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            captionMaxWordsOverride:
              value === null
                ? null
                : Math.max(2, Math.min(12, Number(value) || 6)),
          }),
        }),
        "Failed to update XML caption max words override",
      );
      await onProjectRefresh();
    } catch (err) {
      setCaptionMaxWordsError(
        err instanceof Error
          ? err.message
          : "Failed to update XML caption max words override",
      );
    } finally {
      setSavingCaptionMaxWords(false);
    }
  }

  async function saveProjectPauseRemoval(
    minValue: string | null,
    thresholdValue: string | null,
  ) {
    setSavingPauseRemoval(true);
    setPauseRemovalError(null);
    try {
      await parseJsonResponse(
        await fetch(`/api/short-form-videos/${project.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            pauseRemovalMinSilenceDurationSecondsOverride:
              minValue === null
                ? null
                : Math.min(
                    2.5,
                    Math.max(
                      0.1,
                      Math.round((Number(minValue) || 0.35) * 100) / 100,
                    ),
                  ),
            pauseRemovalSilenceThresholdDbOverride:
              thresholdValue === null
                ? null
                : Math.min(
                    -5,
                    Math.max(
                      -80,
                      Math.round((Number(thresholdValue) || -40) * 10) / 10,
                    ),
                  ),
          }),
        }),
        "Failed to update XML pause-removal override",
      );
      await onProjectRefresh();
    } catch (err) {
      setPauseRemovalError(
        err instanceof Error
          ? err.message
          : "Failed to update XML pause-removal override",
      );
    } finally {
      setSavingPauseRemoval(false);
    }
  }

  const activeVoiceLabel =
    project.selectedVoiceName ||
    voiceOptions.find((voice) => voice.id === defaultVoiceId)?.name ||
    "default voice";
  const effectiveCaptionMaxWords =
    project.captionMaxWordsOverride || defaultCaptionMaxWords;
  const effectivePauseRemovalMinSilenceDurationSeconds =
    project.pauseRemovalMinSilenceDurationSecondsOverride ||
    defaultPauseRemovalMinSilenceDurationSeconds;
  const effectivePauseRemovalSilenceThresholdDb =
    project.pauseRemovalSilenceThresholdDbOverride ||
    defaultPauseRemovalSilenceThresholdDb;
  const narrationStatus = getXmlPipelineTaskStatus(
    getXmlPipelineSteps(doc, ["narration", "silence-removal", "alignment"]),
  );
  const captionsStep = getXmlPipelineStep(doc, "captions");
  const captionsStatus = getXmlPipelineTaskStatus(
    getXmlPipelineSteps(doc, ["captions"]),
  );
  const visualsStep = getXmlPipelineStep(doc, "xml");
  const visualsStatus = getXmlPipelineTaskStatus(
    getXmlPipelineSteps(doc, ["xml"]),
  );
  const captionsJsonDetail =
    captionsStep?.details?.find((detail) => detail.id === "caption-plan") ||
    null;

  async function triggerTask(
    task: "full" | "narration" | "silence" | "captions" | "visuals",
    options?: { notes?: string },
  ) {
    setSaving(true);
    try {
      const payload = await parseJsonResponse<XmlScriptDoc>(
        await fetch(`/api/short-form-videos/${project.id}/xml-script`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            task,
            ...(options?.notes ? { notes: options.notes } : {}),
          }),
        }),
        "Failed to start XML workflow task",
      );
      setDoc(payload.data || null);
      setDraft(payload.data?.content || "");
      setError(null);
      void onProjectRefresh().catch(() => undefined);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to start XML workflow task",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      {error ? (
        <ValidationNotice title="XML workflow issue" message={error} />
      ) : null}
      {section === "generate-narration-audio" ? (
        <div id="generate-narration-audio" className="space-y-4">
        {voiceError ? (
          <ValidationNotice
            title="Narration voice issue"
            message={voiceError}
          />
        ) : null}
        {pauseRemovalError ? (
          <ValidationNotice
            title="Pause-removal settings issue"
            message={pauseRemovalError}
          />
        ) : null}
        <div className="flex flex-wrap gap-2">
          <Button
            onClick={() => void triggerTask("narration")}
            disabled={saving || doc?.pending}
          >
            {saving
              ? "Starting…"
              : doc?.originalAudioUrl
                ? "Regenerate original narration + downstream timing"
                : "Generate narration audio"}
          </Button>
          <Button
            variant="outline"
            onClick={() => void triggerTask("silence")}
            disabled={saving || doc?.pending || !doc?.originalAudioUrl}
          >
            {saving
              ? "Starting…"
              : doc?.audioUrl
                ? "Re-run pause removal + alignment"
                : "Run pause removal + alignment"}
          </Button>
        </div>
        <div className="rounded-lg border border-border bg-background/60 p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="text-sm font-medium text-foreground">
                Voice for narration
              </h3>
              <p className="mt-1 max-w-2xl text-xs text-muted-foreground">
                Choose the narration voice before running Narration Audio.
                Captions and visuals planning can then rerun independently
                against the same narration/alignment artifacts.
              </p>
            </div>
            <Link
              href={buildShortFormSettingsHref("audio", { hash: "tts-voice" })}
              target="_blank"
              rel="noreferrer"
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              Open voice library ↗
            </Link>
          </div>
          <div className="mt-3 flex flex-col gap-3 md:flex-row md:items-center">
            <Select
              value={project.selectedVoiceId || defaultVoiceId || ""}
              onChange={(event) => void saveProjectVoice(event.target.value)}
              disabled={
                savingVoice ||
                voiceOptions.length === 0 ||
                Boolean(doc?.pending)
              }
              className="max-w-sm"
            >
              {voiceOptions.map((voice) => (
                <option key={voice.id} value={voice.id}>
                  {voice.name}
                  {voice.sourceType === "uploaded-reference"
                    ? " [uploaded reference]"
                    : voice.mode === "custom-voice"
                      ? " [legacy custom]"
                      : " [generated]"}
                  {voice.id === defaultVoiceId ? " (default)" : ""}
                </option>
              ))}
            </Select>
            <div className="text-xs text-muted-foreground">
              {savingVoice
                ? "Saving narration voice…"
                : project.selectedVoiceName
                  ? `Current narration voice: ${project.selectedVoiceName}`
                  : defaultVoiceId
                    ? `Using the current default voice: ${activeVoiceLabel}`
                    : "Using the fallback default voice."}
            </div>
          </div>
        </div>
        <div className="rounded-lg border border-border bg-background/60 p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="text-sm font-medium text-foreground">
                Pause removal / silence trimming
              </h3>
              <p className="mt-1 max-w-2xl text-xs text-muted-foreground">
                These project-level overrides control the ffmpeg silence-removal
                pass that runs after original narration generation. Re-running
                this step also re-runs forced alignment so downstream timing
                stays in sync.
              </p>
            </div>
            <Link
              href={buildShortFormSettingsHref("audio", {
                hash: "pause-removal",
              })}
              target="_blank"
              rel="noreferrer"
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              Open global defaults ↗
            </Link>
          </div>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Remove pauses longer than (seconds)
              </label>
              <Input
                type="number"
                min={0.1}
                max={2.5}
                step={0.01}
                value={projectPauseRemovalMinSilenceDurationSecondsOverride}
                onChange={(event) =>
                  setProjectPauseRemovalMinSilenceDurationSecondsOverride(
                    event.target.value,
                  )
                }
                placeholder={
                  defaultPauseRemovalMinSilenceDurationSeconds
                    ? String(defaultPauseRemovalMinSilenceDurationSeconds)
                    : "0.35"
                }
                className="max-w-[160px]"
                disabled={savingPauseRemoval || Boolean(doc?.pending)}
              />
              <p className="text-xs text-muted-foreground">
                Longer silent spans than this are trimmed out of the processed
                narration file.
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
                value={projectPauseRemovalSilenceThresholdDbOverride}
                onChange={(event) =>
                  setProjectPauseRemovalSilenceThresholdDbOverride(
                    event.target.value,
                  )
                }
                placeholder={
                  defaultPauseRemovalSilenceThresholdDb
                    ? String(defaultPauseRemovalSilenceThresholdDb)
                    : "-40"
                }
                className="max-w-[160px]"
                disabled={savingPauseRemoval || Boolean(doc?.pending)}
              />
              <p className="text-xs text-muted-foreground">
                Anything quieter than this is treated as silence during
                trimming.
              </p>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              size="sm"
              onClick={() =>
                void saveProjectPauseRemoval(
                  projectPauseRemovalMinSilenceDurationSecondsOverride || null,
                  projectPauseRemovalSilenceThresholdDbOverride || null,
                )
              }
              disabled={savingPauseRemoval || Boolean(doc?.pending)}
            >
              {savingPauseRemoval ? "Saving…" : "Save pause-removal override"}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => void saveProjectPauseRemoval(null, null)}
              disabled={
                savingPauseRemoval ||
                (!project.pauseRemovalMinSilenceDurationSecondsOverride &&
                  !project.pauseRemovalSilenceThresholdDbOverride) ||
                Boolean(doc?.pending)
              }
            >
              Use global defaults
            </Button>
          </div>
          <div className="mt-3 text-xs text-muted-foreground">
            {savingPauseRemoval
              ? "Saving pause-removal overrides…"
              : project.pauseRemovalMinSilenceDurationSecondsOverride ||
                  project.pauseRemovalSilenceThresholdDbOverride
                ? `Effective pause removal: ${effectivePauseRemovalMinSilenceDurationSeconds?.toFixed(2) || "0.35"}s minimum silence, threshold ${effectivePauseRemovalSilenceThresholdDb?.toFixed(1) || "-40.0"} dB (project override).`
                : `Effective pause removal: ${effectivePauseRemovalMinSilenceDurationSeconds?.toFixed(2) || "0.35"}s minimum silence, threshold ${effectivePauseRemovalSilenceThresholdDb?.toFixed(1) || "-40.0"} dB (global default).`}
          </div>
        </div>
        <XmlTaskPipelinePanel
          doc={doc}
          title="Narration Audio pipeline"
          description="This task now has three steps: generate the original narration audio, remove pauses from it, then run forced alignment on the silence-removed version."
          stepIds={["narration", "silence-removal", "alignment"]}
        />
        {doc?.originalAudioUrl || doc?.audioUrl ? (
          <div className="grid gap-4 xl:grid-cols-2">
            {doc?.originalAudioUrl ? (
              <div className="space-y-2 rounded-lg border border-border bg-background/60 p-4">
                <div>
                  <h3 className="text-sm font-medium text-foreground">
                    Original narration audio
                  </h3>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Untrimmed source narration kept for comparison and
                    reprocessing.
                  </p>
                </div>
                <audio
                  src={doc.originalAudioUrl}
                  controls
                  className="w-full"
                  preload="metadata"
                />
              </div>
            ) : null}
            {doc?.audioUrl ? (
              <div className="space-y-2 rounded-lg border border-border bg-background/60 p-4">
                <div>
                  <h3 className="text-sm font-medium text-foreground">
                    Silence-removed narration audio
                  </h3>
                  <p className="mt-1 text-xs text-muted-foreground">
                    This processed narration audio becomes the downstream source
                    of truth for alignment, captions, visuals timing, and final
                    video.
                  </p>
                </div>
                <audio
                  src={doc.audioUrl}
                  controls
                  className="w-full"
                  preload="metadata"
                />
              </div>
            ) : null}
          </div>
        ) : null}
        </div>
      ) : null}

      {section === "plan-captions" ? (
        <div id="plan-captions" className="space-y-4">
        {captionMaxWordsError ? (
          <ValidationNotice
            title="Caption settings issue"
            message={captionMaxWordsError}
          />
        ) : null}
        <div className="flex flex-wrap gap-2">
          <Button
            onClick={() => void triggerTask("captions")}
            disabled={saving || doc?.pending}
          >
            {saving
              ? "Starting…"
              : (doc?.captions?.length || 0) > 0
                ? "Re-plan captions"
                : "Plan captions"}
          </Button>
        </div>
        <div className="rounded-lg border border-border bg-background/60 p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="text-sm font-medium text-foreground">
                Caption max words
              </h3>
              <p className="mt-1 text-xs text-muted-foreground">
                Optional project override for deterministic caption chunking.
                Leave blank to use the global setting.
              </p>
            </div>
            <Link
              href={buildShortFormSettingsHref("captions", {
                hash: "caption-styles",
              })}
              target="_blank"
              rel="noreferrer"
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              Open global setting ↗
            </Link>
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-[auto_auto_1fr] sm:items-center">
            <Input
              type="number"
              min={2}
              max={12}
              value={projectCaptionMaxWordsOverride}
              onChange={(event) =>
                setProjectCaptionMaxWordsOverride(event.target.value)
              }
              placeholder={
                defaultCaptionMaxWords
                  ? String(defaultCaptionMaxWords)
                  : "Default"
              }
              className="w-24"
              disabled={savingCaptionMaxWords || Boolean(doc?.pending)}
            />
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={() =>
                  void saveProjectCaptionMaxWords(
                    projectCaptionMaxWordsOverride || null,
                  )
                }
                disabled={savingCaptionMaxWords || Boolean(doc?.pending)}
              >
                {savingCaptionMaxWords ? "Saving…" : "Save"}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => void saveProjectCaptionMaxWords(null)}
                disabled={
                  savingCaptionMaxWords ||
                  !project.captionMaxWordsOverride ||
                  Boolean(doc?.pending)
                }
              >
                Reset
              </Button>
            </div>
            <div className="text-xs text-muted-foreground">
              {savingCaptionMaxWords
                ? "Saving caption override…"
                : project.captionMaxWordsOverride
                  ? `Effective max: ${project.captionMaxWordsOverride} words (project override)`
                  : effectiveCaptionMaxWords
                    ? `Effective max: ${effectiveCaptionMaxWords} words (global default)`
                    : "Uses the global default when caption planning starts."}
            </div>
          </div>
        </div>
        {captionsStatus === "running" ? (
          <PendingNotice
            label={captionsStep?.progressLabel || "Planning captions"}
            hint={
              captionsStep?.summary ||
              "Reusing narration + alignment artifacts to rebuild deterministic captions."
            }
          />
        ) : null}
        {captionsJsonDetail ? (
          <details className="rounded-lg border border-border bg-background/60 p-4">
            <summary className="cursor-pointer text-sm font-medium text-foreground">
              View caption JSON
            </summary>
            <div className="mt-3">
              <MarkdownOrCode
                content={captionsJsonDetail.content}
                mode="json"
              />
            </div>
          </details>
        ) : (
          <div className="rounded-lg border border-border bg-background/60 p-4 text-sm text-muted-foreground">
            No caption JSON yet. Run Plan Captions after Narration Audio
            finishes.
          </div>
        )}
        </div>
      ) : null}

      {section === "plan-visuals" ? (
        <div id="plan-visuals" className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <WorkflowArtifactActionButton
            hasArtifact={Boolean(doc?.exists)}
            initialLabel="Plan visuals"
            rerunLabel="Re-plan visuals"
            rerunWithNotesLabel="Re-plan visuals with revision notes"
            loading={saving || Boolean(doc?.pending)}
            loadingLabel="Starting…"
            onInitialRun={() => triggerTask("visuals")}
            onCleanRerun={() => triggerTask("visuals")}
            onRerunWithNotes={(notes) => triggerTask("visuals", { notes })}
          />
          {doc?.exists ? (
            <Button
              variant="secondary"
              onClick={() => void saveManual("approved")}
              disabled={saving}
            >
              Approve XML script
            </Button>
          ) : null}
        </div>
        {visualsStatus === "running" ? (
          <PendingNotice
            label={visualsStep?.progressLabel || "Planning visuals"}
            hint={
              visualsStep?.summary ||
              "Reusing narration, alignment, and caption artifacts to write the XML visuals plan."
            }
          />
        ) : null}
        {loading && !doc ? <OrbitLoader label="Loading XML script" /> : null}
        {editing ? (
          <div className="space-y-3 rounded-lg border border-border bg-background/60 p-4">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-sm font-medium text-foreground">
                Generated XML script
              </h3>
              <EditIconButton
                editing={editing}
                onClick={() => void setEditing((current) => !current)}
                tooltip="Edit XML script"
                editingTooltip="Cancel XML edit"
              />
            </div>
            <Textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              className="min-h-[320px] font-mono text-xs"
            />
            <div className="flex gap-2">
              <Button onClick={() => void saveManual()} disabled={saving}>
                Save XML
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  setEditing(false);
                  setDraft(doc?.content || "");
                }}
              >
                Discard
              </Button>
            </div>
          </div>
        ) : doc?.content ? (
          <div className="rounded-lg border border-border bg-background/60 p-4">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-sm font-medium text-foreground">
                Generated XML script
              </h3>
              <EditIconButton
                editing={editing}
                onClick={() => void setEditing((current) => !current)}
                tooltip="Edit XML script"
                editingTooltip="Cancel XML edit"
              />
            </div>
            <div className="mt-4">
              <MarkdownOrCode content={doc.content} mode="xml" />
            </div>
          </div>
        ) : (
          <div className="text-sm text-muted-foreground">
            No XML script yet. Run Plan Visuals after the text script is
            approved.
          </div>
        )}
        </div>
      ) : null}
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
  triggerPayload,
  triggerDisabled = false,
  triggerDisabledReason,
  collapseDocumentByDefault = false,
  showExtraWhenEmpty = false,
  simplifiedReviewActions = false,
}: {
  projectId: string;
  title: string;
  stage: StageKey;
  description: string;
  doc: StageDoc;
  mode: "markdown" | "xml" | "text";
  emptyText: string;
  triggerLabel: string;
  triggerDescription?: string;
  onRefresh: () => Promise<unknown>;
  extra?: React.ReactNode;
  triggerPayload?: Record<string, unknown>;
  triggerDisabled?: boolean;
  triggerDisabledReason?: React.ReactNode;
  collapseDocumentByDefault?: boolean;
  showExtraWhenEmpty?: boolean;
  simplifiedReviewActions?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(doc.content);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [approving, setApproving] = useState(false);
  const [status, setStatus] = useState(doc.status || "draft");
  const [actionError, setActionError] = useState<string | null>(null);
  const [documentExpanded, setDocumentExpanded] = useState(
    !collapseDocumentByDefault,
  );

  useEffect(() => {
    setDraft(doc.content);
    setStatus(doc.status || "draft");
  }, [doc.content, doc.status]);

  useEffect(() => {
    if (!doc.exists) {
      setDocumentExpanded(!collapseDocumentByDefault);
    }
  }, [doc.exists, collapseDocumentByDefault]);

  async function triggerStageAction(
    action: "generate" | "revise",
    options?: { notes?: string },
  ) {
    setSaving(true);
    setActionError(null);

    try {
      await parseJsonResponse(
        await fetch(`/api/short-form-videos/${projectId}/workflow/${stage}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action,
            ...(options?.notes ? { notes: options.notes } : {}),
            ...(triggerPayload || {}),
          }),
        }),
        `Failed to trigger ${title.toLowerCase()}`,
      );
      await onRefresh();
    } catch (err) {
      setActionError(
        err instanceof Error
          ? err.message
          : `Failed to trigger ${title.toLowerCase()}`,
      );
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
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            content: draft,
            comment: "Edited in dashboard",
            updatedBy: "ittai",
          }),
        }),
        `Failed to save ${title.toLowerCase()}`,
      );
      setEditing(false);
      await onRefresh();
    } catch (err) {
      setActionError(
        err instanceof Error
          ? err.message
          : `Failed to save ${title.toLowerCase()}`,
      );
    } finally {
      setSaving(false);
    }
  }

  async function applyStatus() {
    setSaving(true);
    setActionError(null);

    try {
      await parseJsonResponse(
        await fetch(`/api/short-form-videos/${projectId}/workflow/${stage}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            status,
            comment: note || `Status updated to ${status}`,
            updatedBy: "ittai",
          }),
        }),
        `Failed to update ${title.toLowerCase()} status`,
      );

      setNote("");
      await onRefresh();
    } catch (err) {
      setActionError(
        err instanceof Error
          ? err.message
          : `Failed to update ${title.toLowerCase()} status`,
      );
    } finally {
      setSaving(false);
    }
  }

  async function approveStage() {
    setSaving(true);
    setApproving(true);
    setActionError(null);

    try {
      await parseJsonResponse(
        await fetch(`/api/short-form-videos/${projectId}/workflow/${stage}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            status: "approved",
            comment: `Approved ${title} in dashboard`,
            updatedBy: "ittai",
          }),
        }),
        `Failed to approve ${title.toLowerCase()}`,
      );

      setStatus("approved");
      setNote("");
      await onRefresh();
    } catch (err) {
      setActionError(
        err instanceof Error
          ? err.message
          : `Failed to approve ${title.toLowerCase()}`,
      );
    } finally {
      setApproving(false);
      setSaving(false);
    }
  }

  const revision = doc.revision;
  const showRevisionPending = Boolean(revision?.isPending);
  const showRevisionWarning = Boolean(revision?.isFailed || revision?.warning);
  const showStaleArtifactNotice = Boolean(revision?.isStale);
  const retryLabel =
    revision?.mode === "generate"
      ? `Retry ${title.toLowerCase()} generation`
      : `Retry ${title.toLowerCase()} revision`;
  const canCollapseDocument = collapseDocumentByDefault && doc.exists;
  const showSimplifiedReviewActions = simplifiedReviewActions && doc.exists;
  const showApproveAction =
    showSimplifiedReviewActions && needsReviewStatus(status || doc.status);

  function toggleDocumentEdit() {
    if (canCollapseDocument && !documentExpanded) {
      setDocumentExpanded(true);
    }
    setEditing((value) => !value);
  }

  async function retryLatestRun() {
    setSaving(true);
    setActionError(null);

    try {
      await parseJsonResponse(
        await fetch(`/api/short-form-videos/${projectId}/workflow/${stage}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "retry" }),
        }),
        `Failed to retry ${title.toLowerCase()}`,
      );
      await onRefresh();
    } catch (err) {
      setActionError(
        err instanceof Error
          ? err.message
          : `Failed to retry ${title.toLowerCase()}`,
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5">
      {doc.validationError ? (
        <ValidationNotice
          title={`${title} artifact is malformed`}
          message={`${doc.validationError} Fix the generated JSON or re-run this stage.`}
        />
      ) : null}

      {actionError ? (
        <ValidationNotice
          title={`${title} action failed`}
          message={actionError}
        />
      ) : null}

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
            title={`${title} ${revision?.mode === "generate" ? "generation" : "revision"} needs attention`}
            requestText={revision?.requestText}
            requestedAt={revision?.requestedAt}
            pending={false}
            warning={
              revision?.warning ||
              revision?.agentRun?.errorMessage ||
              "The latest run did not produce a new artifact."
            }
          />
          {revision?.isFailed ? (
            <Button
              variant="outline"
              onClick={() => void retryLatestRun()}
              disabled={saving || doc.pending}
            >
              {saving ? "Retrying…" : retryLabel}
            </Button>
          ) : null}
        </div>
      ) : null}

      {!doc.exists ? (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">{emptyText}</p>
          <WorkflowArtifactActionButton
            hasArtifact={false}
            initialLabel={triggerLabel}
            rerunLabel={`Re-${triggerLabel.toLowerCase()}`}
            rerunWithNotesLabel={`Re-${triggerLabel.toLowerCase()} with revision notes`}
            loading={doc.pending || saving}
            loadingLabel={`${triggerLabel}…`}
            disabled={triggerDisabled}
            onInitialRun={() => triggerStageAction("generate")}
            onCleanRerun={() => triggerStageAction("generate")}
            onRerunWithNotes={(notes) =>
              triggerStageAction("revise", { notes })
            }
          />
          {triggerDescription ? (
            <p className="text-xs text-muted-foreground">
              {triggerDescription}
            </p>
          ) : null}
          {triggerDisabledReason ? (
            <div className="text-xs text-amber-200">
              {triggerDisabledReason}
            </div>
          ) : null}
          {doc.pending ? (
            <PendingNotice label={`Waiting for ${title.toLowerCase()} output`} />
          ) : null}
          {showExtraWhenEmpty ? extra : null}
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <WorkflowArtifactActionButton
              hasArtifact
              initialLabel={triggerLabel}
              rerunLabel={`Re-${triggerLabel.toLowerCase()}`}
              rerunWithNotesLabel={`Re-${triggerLabel.toLowerCase()} with revision notes`}
              loading={saving || doc.pending}
              disabled={triggerDisabled}
              onInitialRun={() => triggerStageAction("generate")}
              onCleanRerun={() => triggerStageAction("generate")}
              onRerunWithNotes={(notes) =>
                triggerStageAction("revise", { notes })
              }
            />
            {showApproveAction ? (
              <Button
                type="button"
                variant="secondary"
                onClick={() => void approveStage()}
                disabled={saving || doc.pending}
              >
                {approving ? "Approving…" : "Approve"}
              </Button>
            ) : null}
            {showSimplifiedReviewActions ? (
              <EditIconButton
                editing={editing}
                onClick={toggleDocumentEdit}
                tooltip="Edit document"
                editingTooltip="Cancel document edit"
              />
            ) : null}
            {triggerDisabledReason ? (
              <div className="text-xs text-amber-200">
                {triggerDisabledReason}
              </div>
            ) : null}
          </div>

          {showSimplifiedReviewActions && doc.pending ? (
            <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-3 py-2 text-sm text-muted-foreground">
              Waiting for the latest workflow run to land.
            </div>
          ) : null}

          {!showSimplifiedReviewActions ? (
            <StageReviewControls
              status={status}
              note={note}
              saving={saving}
              pending={doc.pending}
              editing={editing}
              showEditButton={!canCollapseDocument}
              onStatusChange={setStatus}
              onNoteChange={setNote}
              onApply={() => void applyStatus()}
              onToggleEdit={toggleDocumentEdit}
            />
          ) : null}

          {showStaleArtifactNotice ? (
            <StaleArtifactNotice
              updatedAt={doc.updatedAt}
              label={
                showRevisionPending
                  ? `${title} revision is in progress — this is still the current on-disk version.`
                  : `${title} revision has not landed — this is still the current on-disk version.`
              }
            />
          ) : null}

          {canCollapseDocument ? (
            <div className="space-y-3 rounded-lg border border-border p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h3 className="text-sm font-medium text-foreground">
                    Review document
                  </h3>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {documentExpanded
                      ? "Expanded for review and inline editing."
                      : "Collapsed by default to keep the workflow compact."}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {documentExpanded && !showSimplifiedReviewActions ? (
                    <EditIconButton
                      editing={editing}
                      onClick={toggleDocumentEdit}
                      tooltip="Edit document"
                      editingTooltip="Cancel document edit"
                    />
                  ) : null}
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
                    {documentExpanded ? "Collapse document" : "Expand document"}
                  </Button>
                </div>
              </div>

              {documentExpanded ? (
                editing ? (
                  <div className="space-y-3">
                    <Textarea
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                      className="min-h-[320px] font-mono text-xs"
                    />
                    <div className="flex items-center gap-2">
                      <Button onClick={() => void saveEdit()} disabled={saving}>
                        Save
                      </Button>
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
              <Textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                className="min-h-[320px] font-mono text-xs"
              />
              <div className="flex items-center gap-2">
                <Button onClick={() => void saveEdit()} disabled={saving}>
                  Save
                </Button>
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
    </div>
  );
}

function TextScriptHistoryPanel({
  project,
  onProjectRefresh,
}: {
  project: Project;
  onProjectRefresh: () => Promise<unknown>;
}) {
  const body = useMemo(
    () => extractBody(project.script.content).trim(),
    [project.script.content],
  );
  const sentences = useMemo(
    () => body.split(/(?<=[.!?])\s+/).filter(Boolean),
    [body],
  );
  const firstSentence = sentences[0] || "";
  const firstSentenceWordCount = useMemo(
    () =>
      firstSentence ? firstSentence.split(/\s+/).filter(Boolean).length : 0,
    [firstSentence],
  );
  const runs = useMemo(
    () => project.script.textScriptRuns || [],
    [project.script.textScriptRuns],
  );
  const latestRun = runs[0];
  const [selectedRunId, setSelectedRunId] = useState<string>(
    latestRun?.runId || "",
  );
  const [selectedIterationNumber, setSelectedIterationNumber] =
    useState<number>(0);
  const [compareIterationNumber, setCompareIterationNumber] =
    useState<number>(0);
  const [projectOverride, setProjectOverride] = useState<string>(
    project.script.textScriptMaxIterationsOverride
      ? String(project.script.textScriptMaxIterationsOverride)
      : "",
  );
  const [defaultMaxIterations, setDefaultMaxIterations] = useState<
    number | null
  >(null);
  const [savingOverride, setSavingOverride] = useState(false);
  const [overrideError, setOverrideError] = useState<string | null>(null);

  useEffect(() => {
    setSelectedRunId(latestRun?.runId || "");
    setSelectedIterationNumber(0);
    setCompareIterationNumber(0);
  }, [latestRun?.runId]);

  useEffect(() => {
    setProjectOverride(
      project.script.textScriptMaxIterationsOverride
        ? String(project.script.textScriptMaxIterationsOverride)
        : "",
    );
  }, [project.script.textScriptMaxIterationsOverride]);

  const { data: textScriptSettingsPayload } = useSWR<ApiResponse<WorkflowSettingsResponse>>(
    "/api/short-form-videos/settings",
    apiEnvelopeFetcher,
    realtimeSWRConfig,
  );

  useEffect(() => {
    const value = textScriptSettingsPayload?.data?.textScript?.defaultMaxIterations;
    setDefaultMaxIterations(typeof value === "number" ? value : null);
  }, [textScriptSettingsPayload]);

  const selectedRun = useMemo(
    () => runs.find((run) => run.runId === selectedRunId) || latestRun,
    [latestRun, runs, selectedRunId],
  );

  useEffect(() => {
    if (!selectedRun) {
      setSelectedIterationNumber(0);
      setCompareIterationNumber(0);
      return;
    }
    const finalIteration =
      selectedRun.iterations.find((iteration) => iteration.isFinal) ||
      selectedRun.iterations[selectedRun.iterations.length - 1];
    const nextSelected = finalIteration?.number || 0;
    setSelectedIterationNumber((current) => {
      if (
        current &&
        selectedRun.iterations.some((iteration) => iteration.number === current)
      )
        return current;
      return nextSelected;
    });
    setCompareIterationNumber((current) => {
      if (
        current &&
        selectedRun.iterations.some((iteration) => iteration.number === current)
      )
        return current;
      return nextSelected > 1 ? nextSelected - 1 : 0;
    });
  }, [selectedRun]);

  const selectedIteration =
    selectedRun?.iterations.find(
      (iteration) => iteration.number === selectedIterationNumber,
    ) ||
    selectedRun?.iterations.find((iteration) => iteration.isFinal) ||
    selectedRun?.iterations[selectedRun?.iterations.length - 1];
  const compareIteration = selectedRun?.iterations.find(
    (iteration) => iteration.number === compareIterationNumber,
  );
  const selectedIterationBody = selectedIteration
    ? extractBody(selectedIteration.draftContent).trim()
    : body;
  const compareIterationBody = compareIteration
    ? extractBody(compareIteration.draftContent).trim()
    : "";
  const effectiveMaxIterations =
    project.script.textScriptMaxIterationsOverride ||
    defaultMaxIterations ||
    latestRun?.maxIterations ||
    1;
  const activeRun = latestRun?.status === "running" ? latestRun : undefined;
  const runState = getTextScriptRunState(activeRun, effectiveMaxIterations);
  const showPipelineState = project.script.pending;
  const selectedDraftTitle = selectedIteration
    ? `Iteration ${selectedIteration.number} draft${selectedIteration.isFinal ? " · final" : ""}${selectedIteration.kind === "manual" ? " · manual edit" : ""}`
    : "Approved narration text";
  const selectedDraftDescription = selectedIteration
    ? compareIteration
      ? `Showing the full draft for iteration ${selectedIteration.number}. Diffing against iteration ${compareIteration.number} below.`
      : `Showing the full saved draft for iteration ${selectedIteration.number}. No comparison selected.`
    : "This plain script becomes the narration source of truth. The next workflow pages generate narration audio, plan deterministic captions, then write the visuals-only XML.";

  const diff = useMemo(() => {
    if (
      !selectedIteration ||
      !compareIteration ||
      compareIteration.number === selectedIteration.number
    )
      return null;
    return {
      ...generateClientDiff(
        compareIterationBody,
        selectedIterationBody,
        "script.md",
      ),
      fromVersion: compareIteration.number,
      toVersion: selectedIteration.number,
      fromTimestamp:
        compareIteration.updatedAt || compareIteration.createdAt || "",
      toTimestamp:
        selectedIteration.updatedAt || selectedIteration.createdAt || "",
    };
  }, [
    compareIteration,
    compareIterationBody,
    selectedIteration,
    selectedIterationBody,
  ]);

  async function saveProjectOverride(value: string | null) {
    setSavingOverride(true);
    setOverrideError(null);
    try {
      await parseJsonResponse(
        await fetch(`/api/short-form-videos/${project.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            textScriptMaxIterationsOverride:
              value === null
                ? null
                : Math.max(1, Math.min(8, Number(value) || 1)),
          }),
        }),
        "Failed to save text-script override",
      );
      await onProjectRefresh();
    } catch (err) {
      setOverrideError(
        err instanceof Error
          ? err.message
          : "Failed to save text-script override",
      );
    } finally {
      setSavingOverride(false);
    }
  }

  return (
    <div className="space-y-4">
      {!body && !selectedIterationBody ? (
        <ValidationNotice
          title="Text script missing"
          message="This section should contain only the approved narration text. The following workflow pages generate narration audio, pause removal, forced alignment, deterministic captions JSON, and visuals from it."
        />
      ) : null}

      {firstSentence && firstSentenceWordCount > 10 ? (
        <ValidationNotice
          title="Hook length warning"
          message={`The first sentence currently looks like ${firstSentenceWordCount} words. The hook should stay at 10 words or fewer.`}
        />
      ) : null}

      {overrideError ? (
        <ValidationNotice
          title="Text-script override failed"
          message={overrideError}
        />
      ) : null}

      <div className="space-y-3 rounded-lg border border-border bg-background/60 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-sm font-medium text-foreground">
                Text script status
              </h3>
              {selectedRun ? (
                <Badge variant="secondary">
                  Run {selectedRun.runId.slice(0, 8)}
                </Badge>
              ) : null}
              {selectedRun ? (
                <Badge
                  variant={
                    selectedRun.status === "passed"
                      ? "success"
                      : selectedRun.status === "max-iterations-reached" ||
                          selectedRun.status === "failed"
                        ? "destructive"
                        : "secondary"
                  }
                >
                  {selectedRun.status.replace(/-/g, " ")}
                </Badge>
              ) : null}
              {selectedIteration?.overallGrade !== undefined ? (
                <Badge variant="outline">
                  Grade {selectedIteration.overallGrade}/100
                </Badge>
              ) : null}
              {showPipelineState ? (
                <Badge variant="secondary">
                  Iteration {runState.currentIteration || 1} /{" "}
                  {runState.maxIterations}
                </Badge>
              ) : null}
              {showPipelineState ? (
                <Badge variant="outline">
                  {getTextScriptPhaseLabel(runState.phase)}
                </Badge>
              ) : null}
            </div>
            <p className="text-xs text-muted-foreground">
              Compact iteration controls live here so the script section stays
              useful without getting bulky.
            </p>
          </div>
          <div className="text-xs text-muted-foreground">
            Effective max:{" "}
            {project.script.textScriptMaxIterationsOverride
              ? `${project.script.textScriptMaxIterationsOverride} (project override)`
              : defaultMaxIterations
                ? `${defaultMaxIterations} (global default)`
                : "global default"}
          </div>
        </div>

        <div className="grid gap-2 md:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)_minmax(0,1fr)_auto]">
          <div className="space-y-1">
            <label className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              Run
            </label>
            <Select
              value={selectedRun?.runId || ""}
              onChange={(event) => setSelectedRunId(event.target.value)}
            >
              {runs.length > 0 ? (
                runs.map((run) => (
                  <option key={run.runId} value={run.runId}>
                    {run.runId.slice(0, 8)} · {run.status.replace(/-/g, " ")}
                  </option>
                ))
              ) : (
                <option value="">No runs yet</option>
              )}
            </Select>
          </div>
          <div className="space-y-1">
            <label className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              View draft
            </label>
            <Select
              value={selectedIteration ? String(selectedIteration.number) : ""}
              onChange={(event) =>
                setSelectedIterationNumber(Number(event.target.value))
              }
            >
              {selectedRun?.iterations.length ? (
                selectedRun.iterations.map((iteration) => (
                  <option key={iteration.number} value={iteration.number}>
                    Iteration {iteration.number}
                    {iteration.isFinal ? " · final" : ""}
                    {iteration.kind === "manual" ? " · manual" : ""}
                  </option>
                ))
              ) : (
                <option value="">No iterations yet</option>
              )}
            </Select>
          </div>
          <div className="space-y-1">
            <label className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              Compare
            </label>
            <Select
              value={compareIteration ? String(compareIteration.number) : "0"}
              onChange={(event) =>
                setCompareIterationNumber(Number(event.target.value))
              }
            >
              <option value="0">No comparison</option>
              {selectedRun?.iterations
                .filter(
                  (iteration) =>
                    !selectedIteration ||
                    iteration.number !== selectedIteration.number,
                )
                .map((iteration) => (
                  <option key={iteration.number} value={iteration.number}>
                    Iteration {iteration.number}
                    {iteration.kind === "manual" ? " · manual" : ""}
                  </option>
                ))}
            </Select>
          </div>
          <div className="space-y-1">
            <label className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              Max iters
            </label>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min={1}
                max={8}
                value={projectOverride}
                onChange={(event) => setProjectOverride(event.target.value)}
                placeholder={
                  defaultMaxIterations
                    ? String(defaultMaxIterations)
                    : "Default"
                }
                className="w-20"
              />
              <Button
                size="sm"
                onClick={() =>
                  void saveProjectOverride(projectOverride || null)
                }
                disabled={savingOverride}
              >
                {savingOverride ? "Saving…" : "Save"}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => void saveProjectOverride(null)}
                disabled={
                  savingOverride ||
                  !project.script.textScriptMaxIterationsOverride
                }
              >
                Reset
              </Button>
            </div>
          </div>
        </div>

        {showPipelineState ? (
          <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3">
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span className="font-medium text-foreground">
                Live iterative pipeline
              </span>
              <span>
                Current iteration {runState.currentIteration || 1} of up to{" "}
                {runState.maxIterations}
              </span>
              {runState.completedIterations > 0 ? (
                <span>
                  · {runState.completedIterations} completed cycle
                  {runState.completedIterations === 1 ? "" : "s"}
                </span>
              ) : null}
            </div>
            {runState.statusText ? (
              <p className="mt-2 text-xs text-muted-foreground">
                {runState.statusText}
              </p>
            ) : null}
            <div className="mt-3 grid gap-2 md:grid-cols-3">
              {(
                [
                  ["writing", "Write draft"],
                  ["reviewing", "Grade draft"],
                  ["improving", "Improve draft"],
                ] as const
              ).map(([stepId, label]) => {
                const stepStatus = getTextScriptPhaseStatus(
                  runState.phase,
                  stepId,
                );
                return (
                  <div
                    key={stepId}
                    className={`rounded-md border px-3 py-2 text-sm ${
                      stepStatus === "active"
                        ? "border-emerald-500/40 bg-emerald-500/10 text-foreground"
                        : stepStatus === "completed"
                          ? "border-border bg-background/70 text-muted-foreground"
                          : "border-border/70 bg-background/40 text-muted-foreground/80"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium">{label}</span>
                      <Badge
                        variant={
                          stepStatus === "active"
                            ? "success"
                            : stepStatus === "completed"
                              ? "secondary"
                              : "outline"
                        }
                      >
                        {stepStatus === "active"
                          ? "Active"
                          : stepStatus === "completed"
                            ? "Done"
                            : "Next"}
                      </Badge>
                    </div>
                    <p className="mt-1 text-xs opacity-80">
                      {stepId === "writing"
                        ? `Iteration ${runState.currentIteration || 1}`
                        : stepId === "reviewing"
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
          <h3 className="text-sm font-medium text-foreground">
            {selectedDraftTitle}
          </h3>
          <p className="mt-1 text-xs text-muted-foreground">
            {selectedDraftDescription}
          </p>
        </div>
        <div className="rounded-lg border border-border bg-background/70 p-4 text-sm leading-6 text-foreground whitespace-pre-wrap break-words">
          {selectedIterationBody || body || "Nothing here yet."}
        </div>
      </div>

      {selectedRun?.status === "max-iterations-reached" ? (
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
              <Badge variant="secondary">
                Decision: {selectedIteration.reviewDecision || "n/a"}
              </Badge>
              {selectedIteration.overallGrade !== undefined ? (
                <Badge
                  variant={
                    selectedRun?.passingScore !== undefined &&
                    selectedIteration.overallGrade >= selectedRun.passingScore
                      ? "success"
                      : "outline"
                  }
                >
                  Overall grade: {selectedIteration.overallGrade}/100
                </Badge>
              ) : null}
              {selectedIteration.kind === "manual" ? (
                <Badge variant="outline">Manual edit</Badge>
              ) : null}
            </div>
            {selectedIteration.reviewSummary ? (
              <p>{selectedIteration.reviewSummary}</p>
            ) : null}
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

      {compareIteration && diff ? (
        <DiffViewer diff={diff} showStats maxHeight="420px" />
      ) : null}
    </div>
  );
}

function SceneImagesSection({
  project,
  refresh,
}: {
  project: Project;
  refresh: () => Promise<unknown>;
}) {
  const [requestByScene, setRequestByScene] = useState<Record<string, string>>(
    {},
  );
  const [submittingScene, setSubmittingScene] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [styleOptions, setStyleOptions] = useState<ImageStyleOption[]>([]);
  const [backgroundOptions, setBackgroundOptions] = useState<
    BackgroundVideoOption[]
  >([]);
  const [defaultBackgroundVideoId, setDefaultBackgroundVideoId] =
    useState<string>("");
  const [savingStyle, setSavingStyle] = useState(false);
  const [savingBackground, setSavingBackground] = useState(false);
  const [sceneTabById, setSceneTabById] = useState<
    Record<string, "preview" | "raw">
  >({});

  const { data: imageSettingsPayload } = useSWR<ApiResponse<WorkflowSettingsResponse>>(
    "/api/short-form-videos/settings",
    apiEnvelopeFetcher,
    realtimeSWRConfig,
  );

  useEffect(() => {
    const nextStyles = Array.isArray(imageSettingsPayload?.data?.imageStyles?.styles)
      ? imageSettingsPayload.data.imageStyles.styles.filter(
          (style): style is ImageStyleOption =>
            Boolean(
              style &&
              typeof style.id === "string" &&
              typeof style.name === "string",
            ),
        )
      : [];
    const nextBackgrounds = Array.isArray(
      imageSettingsPayload?.data?.backgroundVideos?.backgrounds,
    )
      ? imageSettingsPayload.data.backgroundVideos.backgrounds.filter(
          (background): background is BackgroundVideoOption =>
            Boolean(
              background &&
              typeof background.id === "string" &&
              typeof background.name === "string",
            ),
        )
      : [];
    setStyleOptions(nextStyles);
    setBackgroundOptions(nextBackgrounds);
    setDefaultBackgroundVideoId(
      imageSettingsPayload?.data?.backgroundVideos?.defaultBackgroundVideoId || "",
    );
  }, [imageSettingsPayload]);

  useEffect(() => {
    setSceneTabById((current) => {
      const next = { ...current };
      for (const scene of project.sceneImages.scenes) {
        if (!next[scene.id]) {
          next[scene.id] = scene.previewVideo ? "preview" : "raw";
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
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ selectedImageStyleId: styleId }),
        }),
        "Failed to update visual style",
      );
      await refresh();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to update visual style",
      );
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
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            selectedBackgroundVideoId: backgroundVideoId,
          }),
        }),
        "Failed to update background video",
      );
      await refresh();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to update background video",
      );
    } finally {
      setSavingBackground(false);
    }
  }

  async function requestSceneChange(scene: Scene) {
    setSubmittingScene(scene.id);
    setError(null);

    try {
      await parseJsonResponse(
        await fetch(
          `/api/short-form-videos/${project.id}/workflow/scene-images`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              action: "request-scene-change",
              sceneId: scene.id,
              notes: requestByScene[scene.id] || "",
            }),
          },
        ),
        "Failed to request scene changes",
      );
      setRequestByScene((prev) => ({ ...prev, [scene.id]: "" }));
      await refresh();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to request scene changes",
      );
    } finally {
      setSubmittingScene(null);
    }
  }

  const sceneProgress = project.sceneImages.sceneProgress;

  return (
    <StageReviewSection
      projectId={project.id}
      title="Generate Visuals"
      stage="scene-images"
      description="Once the XML script is approved, the dashboard runs the visuals workflow directly to generate or reuse the needed green-screen visual plates from the XML asset/timeline model. Exact asset reuse never regenerates the image unnecessarily; reference-derived new assets remain explicit in the XML and manifest for debugging. Captions are overlaid separately and the selected background video is composited behind each visual in preview/final render."
      doc={project.sceneImages}
      mode="markdown"
      emptyText="No generated visuals yet. Generate them after approving the XML script."
      triggerLabel="Generate visuals"
      triggerDescription={`This should create green-screen scene plates using the selected image style${project.selectedImageStyleName ? ` (${project.selectedImageStyleName})` : ""}${project.selectedBackgroundVideoName ? ` and prepare preview compositing against ${project.selectedBackgroundVideoName}` : ""}.`}
      onRefresh={refresh}
      collapseDocumentByDefault
      simplifiedReviewActions
      extra={
        <div className="space-y-4">
          {error ? (
            <ValidationNotice
              title="Visual change request failed"
              message={error}
            />
          ) : null}
          <div className="rounded-lg border border-border bg-background/60 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="text-sm font-medium text-foreground">
                  Visual style for this project
                </h3>
                <p className="mt-1 max-w-2xl text-xs text-muted-foreground">
                  Pick the reusable style that should feed the direct visual
                  generation path. The saved style-instructions template and
                  this style’s own instructions are what drive generation.
                </p>
              </div>
              <Link
                href={buildShortFormSettingsHref("images", {
                  query: `style=${encodeURIComponent(project.selectedImageStyleId || "")}`,
                  hash: "image-styles",
                })}
                target="_blank"
                rel="noreferrer"
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                Open styles editor ↗
              </Link>
            </div>
            <div className="mt-3 flex flex-col gap-3 md:flex-row md:items-center">
              <Select
                value={project.selectedImageStyleId || ""}
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
                  ? "Saving style selection…"
                  : project.selectedImageStyleName
                    ? `Current style: ${project.selectedImageStyleName}`
                    : "Using the current default style."}
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-border bg-background/60 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="text-sm font-medium text-foreground">
                  Looping background video for this visual project
                </h3>
                <p className="mt-1 max-w-2xl text-xs text-muted-foreground">
                  Pick which saved background video should sit behind the
                  green-screen characters for scene previews and final render.
                  New projects default to the library default automatically.
                </p>
              </div>
              <Link
                href={buildShortFormSettingsHref("backgrounds", {
                  hash: "background-videos",
                })}
                target="_blank"
                rel="noreferrer"
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                Manage backgrounds ↗
              </Link>
            </div>
            <div className="mt-3 flex flex-col gap-3 md:flex-row md:items-center">
              <Select
                value={
                  project.selectedBackgroundVideoId ||
                  defaultBackgroundVideoId ||
                  ""
                }
                onChange={(event) =>
                  void saveProjectBackground(event.target.value)
                }
                disabled={savingBackground || backgroundOptions.length === 0}
                className="max-w-sm"
              >
                {backgroundOptions.map((background) => (
                  <option key={background.id} value={background.id}>
                    {background.name}
                    {background.id === defaultBackgroundVideoId
                      ? " (default)"
                      : ""}
                  </option>
                ))}
              </Select>
              <div className="text-xs text-muted-foreground">
                {savingBackground
                  ? "Saving background selection…"
                  : project.selectedBackgroundVideoName
                    ? `Current background: ${project.selectedBackgroundVideoName}`
                    : defaultBackgroundVideoId
                      ? "Using the current default background video."
                      : "No background video configured yet."}
              </div>
            </div>
          </div>
          {sceneProgress ? (
            <div className="rounded-lg border border-border bg-background/60 p-3">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="secondary">
                  {sceneProgress.completed}/{sceneProgress.total} completed
                </Badge>
                {sceneProgress.pending > 0 ? (
                  <div className="inline-flex items-center gap-2">
                    <StatusBadge status="working" compact />
                    <span className="text-xs text-muted-foreground">
                      {sceneProgress.pending} scene
                      {sceneProgress.pending === 1 ? "" : "s"}
                    </span>
                  </div>
                ) : null}
                {sceneProgress.scope === "single" &&
                sceneProgress.targetSceneId ? (
                  <Badge variant="outline">
                    Revising {sceneProgress.targetSceneId}
                  </Badge>
                ) : null}
                {sceneProgress.scope === "chain" &&
                (sceneProgress.targetSceneIds?.length || 0) > 0 ? (
                  <Badge variant="outline">
                    Revising continuity chain:{" "}
                    {sceneProgress.targetSceneIds?.join(", ")}
                  </Badge>
                ) : null}
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                {sceneProgress.pending > 0
                  ? sceneProgress.scope === "single"
                    ? "The targeted scene is shown as a loading placeholder until the revised image lands on disk. Other scenes remain visible."
                    : sceneProgress.scope === "chain"
                      ? "The targeted scene and any downstream continuity-linked scenes are tracked as part of this rerun. Scenes outside that chain remain visible."
                      : "Completed scenes stay visible while the remaining scene slots render as loading placeholders."
                  : "All expected visuals for the latest run are available."}
              </p>
            </div>
          ) : null}
          {(project.xmlScript.captions?.length || 0) > 0 ||
          project.sceneImages.scenes.some(
            (scene) =>
              typeof scene.startTime === "number" &&
              typeof scene.endTime === "number",
          ) ? (
            <VisualCaptionTimeline
              captions={project.xmlScript.captions || []}
              scenes={project.sceneImages.scenes}
            />
          ) : null}
          {project.sceneImages.scenes.length > 0 ? (
            <div className="overflow-x-auto pb-2">
              <div className="flex min-w-max gap-4">
                {project.sceneImages.scenes.map((scene) => {
                  const sceneBusy = scene.status === "in-progress";
                  const activeTab =
                    sceneTabById[scene.id] ||
                    (scene.previewVideo ? "preview" : "raw");
                  const hasPreviewVideo = Boolean(
                    scene.previewVideo && project.selectedBackgroundVideoId,
                  );
                  const hasRawImage = Boolean(scene.image);
                  const hasRenderableMedia =
                    hasPreviewVideo ||
                    hasRawImage ||
                    Boolean(scene.previewImage);

                  return (
                    <div
                      key={scene.id}
                      className="w-[260px] shrink-0 space-y-3 rounded-lg border border-border bg-background/60 p-3"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-xs text-muted-foreground">
                            Visual {scene.number}
                          </p>
                          <p className="mt-1 text-sm font-medium text-foreground">
                            {scene.caption}
                          </p>
                        </div>
                        {sceneBusy ? (
                          <StatusBadge status="in-progress" compact />
                        ) : (
                          <StatusBadge status="completed" compact />
                        )}
                      </div>
                      {!sceneBusy ? (
                        <div className="flex rounded-md border border-border bg-background/70 p-1 text-[11px]">
                          <button
                            type="button"
                            className={`flex-1 rounded px-2 py-1 ${activeTab === "preview" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
                            onClick={() =>
                              setSceneTabById((prev) => ({
                                ...prev,
                                [scene.id]: "preview",
                              }))
                            }
                            disabled={!hasPreviewVideo}
                          >
                            Preview
                          </button>
                          <button
                            type="button"
                            className={`flex-1 rounded px-2 py-1 ${activeTab === "raw" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
                            onClick={() =>
                              setSceneTabById((prev) => ({
                                ...prev,
                                [scene.id]: "raw",
                              }))
                            }
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
                            <OrbitLoader
                              label={`Rendering visual ${scene.number}`}
                            />
                          </div>
                        </div>
                      ) : hasRenderableMedia ? (
                        activeTab === "preview" && hasPreviewVideo ? (
                          <ScenePreviewVideoCard
                            src={scene.previewVideo!}
                            poster={
                              scene.previewImage || scene.image || undefined
                            }
                            label={`${scene.caption} preview video`}
                          />
                        ) : hasRawImage ? (
                          <img
                            src={scene.image}
                            alt={`${scene.caption} raw green screen`}
                            className="aspect-[9/16] w-full rounded-md border border-border bg-muted object-cover"
                          />
                        ) : scene.previewImage ? (
                          <img
                            src={scene.previewImage}
                            alt={scene.caption}
                            className="aspect-[9/16] w-full rounded-md border border-border bg-muted object-cover"
                          />
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
                      {scene.imageId ||
                      scene.basedOnImageId ||
                      scene.reusedExistingAsset ? (
                        <div className="flex flex-wrap gap-2">
                          {scene.imageId ? (
                            <Badge variant="outline">
                              imageId: {scene.imageId}
                            </Badge>
                          ) : null}
                          {scene.reusedExistingAsset ? (
                            <Badge variant="secondary">reused asset</Badge>
                          ) : null}
                          {scene.basedOnImageId ? (
                            <Badge variant="outline">
                              basedOn: {scene.basedOnImageId}
                            </Badge>
                          ) : null}
                          {scene.visualId ? (
                            <Badge variant="outline">{scene.visualId}</Badge>
                          ) : null}
                        </div>
                      ) : null}
                      <div className="space-y-2">
                        <Textarea
                          value={requestByScene[scene.id] || ""}
                          onChange={(e) =>
                            setRequestByScene((prev) => ({
                              ...prev,
                              [scene.id]: e.target.value,
                            }))
                          }
                          placeholder={
                            sceneBusy
                              ? "Wait for the current render to finish before requesting another change"
                              : "Optional notes — leave blank to rerender this scene cleanly"
                          }
                          className="min-h-[88px]"
                          disabled={sceneBusy}
                        />
                        {!sceneBusy ? (
                          <p className="text-xs text-muted-foreground">
                            Leave notes empty to rerender this scene cleanly, or
                            add notes to request a targeted change.
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
                          ? "Sending…"
                          : sceneBusy
                            ? "Visual is rendering…"
                            : (requestByScene[scene.id] || "").trim()
                              ? "Request visual changes"
                              : "Rerender visual"}
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

function SoundDesignSection({
  project,
  refresh,
  mode,
  onSoundDesignPendingChange,
}: {
  project: Project;
  refresh: () => Promise<unknown>;
  mode: "plan" | "generate";
  onSoundDesignPendingChange?: (pending: boolean) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(project.soundDesign.content || "");
  const [saving, setSaving] = useState(false);
  const [savingOverrides, setSavingOverrides] = useState(false);
  const [savingPlanStatus, setSavingPlanStatus] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [overrideError, setOverrideError] = useState<string | null>(null);
  const [decisionError, setDecisionError] = useState<string | null>(null);
  const [planStatusError, setPlanStatusError] = useState<string | null>(null);
  const [savingDecision, setSavingDecision] = useState(false);
  const [skipReason, setSkipReason] = useState(
    project.soundDesignSkipReason || "",
  );
  const [soundLibrary, setSoundLibrary] = useState<SoundLibraryOption[]>([]);
  const [selectedReviewKey, setSelectedReviewKey] = useState<
    "mix" | "narration" | "without-sfx" | "effects-only" | `track:${string}`
  >("mix");
  const [reviewVariantUrls, setReviewVariantUrls] = useState<
    Record<string, string>
  >(project.soundDesign.reviewAudioUrls || {});
  const [renderingReviewKey, setRenderingReviewKey] = useState<string | null>(
    null,
  );
  const [reviewRenderError, setReviewRenderError] = useState<string | null>(
    null,
  );
  const [trackFilter, setTrackFilter] = useState<string>("all");
  const [showChangedOnly, setShowChangedOnly] = useState(false);

  useEffect(() => {
    setDraft(project.soundDesign.content || "");
  }, [project.soundDesign.content]);

  useEffect(() => {
    setSkipReason(project.soundDesignSkipReason || "");
  }, [project.soundDesignSkipReason]);

  const { data: soundSettingsPayload } = useSWR<ApiResponse<WorkflowSettingsResponse>>(
    "/api/short-form-videos/settings",
    apiEnvelopeFetcher,
    realtimeSWRConfig,
  );

  useEffect(() => {
    const nextLibrary = Array.isArray(soundSettingsPayload?.data?.soundDesign?.library)
      ? soundSettingsPayload.data.soundDesign.library.filter(
          (asset): asset is SoundLibraryOption =>
            Boolean(
              asset &&
              typeof asset.id === "string" &&
              typeof asset.name === "string",
            ),
        )
      : [];
    setSoundLibrary(nextLibrary.filter((asset) => Boolean(asset.audioRelativePath)));
  }, [soundSettingsPayload]);

  const previewAudioUrl = project.soundDesign.previewAudioUrl
    ? appendPreviewRefreshParam(
        project.soundDesign.previewAudioUrl,
        project.soundDesign.resolution?.previewUpdatedAt ||
          project.soundDesign.updatedAt ||
          project.updatedAt,
      )
    : undefined;
  const narrationOnlyUrl = project.xmlScript.audioUrl
    ? appendPreviewRefreshParam(
        project.xmlScript.audioUrl,
        project.xmlScript.updatedAt || project.updatedAt,
      )
    : project.xmlScript.originalAudioUrl
      ? appendPreviewRefreshParam(
          project.xmlScript.originalAudioUrl,
          project.xmlScript.updatedAt || project.updatedAt,
        )
      : undefined;
  const resolution = project.soundDesign.resolution;
  const resolvedEvents = useMemo(
    () =>
      [...(resolution?.events || [])].sort(
        (left, right) =>
          left.resolvedStartSeconds - right.resolvedStartSeconds ||
          left.id.localeCompare(right.id),
      ),
    [resolution?.events],
  );
  const baseEventById = useMemo(
    () => new Map(resolvedEvents.map((event) => [event.id, event])),
    [resolvedEvents],
  );
  const [eventDrafts, setEventDrafts] =
    useState<SoundDesignResolvedEventClient[]>(resolvedEvents);

  useEffect(() => {
    setEventDrafts(resolvedEvents);
  }, [resolvedEvents]);

  useEffect(() => {
    setReviewVariantUrls(project.soundDesign.reviewAudioUrls || {});
    setReviewRenderError(null);
    setRenderingReviewKey(null);
  }, [
    project.id,
    project.soundDesign.reviewAudioUrls,
    project.soundDesign.updatedAt,
    resolution?.generatedAt,
    resolution?.previewUpdatedAt,
  ]);

  const busy = saving || savingOverrides || savingDecision || savingPlanStatus;
  const overridesDirty = useMemo(
    () =>
      serializeSoundDesignOverrides(eventDrafts) !==
      serializeSoundDesignOverrides(resolvedEvents),
    [eventDrafts, resolvedEvents],
  );
  const eventStats = {
    total: resolution?.stats.total || resolvedEvents.length,
    resolved:
      resolution?.stats.resolved ||
      resolvedEvents.filter((event) => event.status === "resolved").length,
    unresolved:
      resolution?.stats.unresolved ||
      resolvedEvents.filter((event) => event.status !== "resolved").length,
  };
  const editableEvents = useMemo(
    () => eventDrafts.filter((event) => event.status === "resolved"),
    [eventDrafts],
  );
  const trackOptions = useMemo(
    () =>
      Array.from(
        new Set(editableEvents.map((event) => event.track).filter(Boolean)),
      ).sort((left, right) => left.localeCompare(right)),
    [editableEvents],
  );

  useEffect(() => {
    if (trackFilter !== "all" && !trackOptions.includes(trackFilter)) {
      setTrackFilter("all");
    }
  }, [trackFilter, trackOptions]);

  const filteredEditableEvents = useMemo(
    () =>
      editableEvents.filter((event) => {
        if (trackFilter !== "all" && event.track !== trackFilter) return false;
        if (!showChangedOnly) return true;
        const baseEvent = baseEventById.get(event.id) || event;
        return (
          serializeSoundDesignOverrides([event]) !==
          serializeSoundDesignOverrides([baseEvent])
        );
      }),
    [baseEventById, editableEvents, showChangedOnly, trackFilter],
  );
  const reviewVariants = useMemo(() => {
    const variants: SoundDesignReviewVariant[] = [
      {
        key: "mix",
        label: "Final mix",
        description:
          "The saved preview mix that Final Video inherits after handoff approval.",
        audioUrl: previewAudioUrl,
        kind: "saved" as const,
      },
      {
        key: "narration",
        label: "Narration only",
        description:
          "Dry narration baseline so you can judge whether the mix is helping.",
        audioUrl: narrationOnlyUrl,
        kind: "baseline" as const,
      },
      {
        key: "without-sfx",
        label: "Narration + music",
        description:
          "Review the bed without the planned SFX events layered on top.",
        audioUrl: reviewVariantUrls["without-sfx"],
        kind: "render" as const,
        renderMode: "without-sfx" as const,
        renderTrack: undefined,
      },
      {
        key: "effects-only",
        label: "Sound effects only",
        description:
          "Listen to the designed hits, risers, ambiences, and transitions without narration.",
        audioUrl: reviewVariantUrls["effects-only"],
        kind: "render" as const,
        renderMode: "effects-only" as const,
        renderTrack: undefined,
      },
      ...trackOptions.map((track) => ({
        key: `track:${track}` as const,
        label: `${track} track solo`,
        description: `Temporary solo render that isolates the saved ${track} track only.`,
        audioUrl: reviewVariantUrls[`track:${track}`],
        kind: "render" as const,
        renderMode: "effects-only" as const,
        renderTrack: track,
      })),
    ];

    return variants;
  }, [narrationOnlyUrl, previewAudioUrl, reviewVariantUrls, trackOptions]);
  const selectedReviewVariant =
    reviewVariants.find((variant) => variant.key === selectedReviewKey) ||
    reviewVariants[0];
  const activeReviewUrl = selectedReviewVariant?.audioUrl;
  const selectedReviewVariantCanRender = Boolean(
    selectedReviewVariant && selectedReviewVariant.kind !== "baseline",
  );
  const selectedReviewVariantBusy =
    selectedReviewVariant?.kind === "saved"
      ? saving
      : selectedReviewVariant?.kind === "render"
        ? renderingReviewKey === selectedReviewVariant.key
        : false;
  const handoff = getSoundDesignHandoffState(project);
  const soundDesignDecision = handoff.decision;
  const soundDesignReadyForVideo = handoff.canProceedToFinalVideo;
  const canApproveForVideo = Boolean(handoff.canApprove && !overridesDirty);
  const showApproveSoundDesignAction =
    canApproveForVideo && soundDesignDecision !== "approved";
  const canSkipForVideo = Boolean(
    skipReason.trim() || project.soundDesignSkipReason,
  );
  const soundDesignStatus = project.soundDesign.pending
    ? "working"
    : overridesDirty
      ? "needs review"
      : soundDesignStageStatus(project);
  const planSoundDesignStatus = project.soundDesign.pending
    ? "working"
    : project.soundDesign.exists
      ? project.soundDesign.status || "needs review"
      : approved(project.sceneImages.status)
        ? "ready"
        : "draft";

  function updateEventDraft(
    eventId: string,
    updater: (
      event: SoundDesignResolvedEventClient,
    ) => SoundDesignResolvedEventClient,
  ) {
    setEventDrafts((current) =>
      current.map((event) => (event.id === eventId ? updater(event) : event)),
    );
  }

  function buildResolutionEventsPayload(
    events: SoundDesignResolvedEventClient[],
  ) {
    return events.map((event) => ({
      ...event,
      muted: event.muted === true,
      solo: event.solo === true,
      manualAssetId: event.manualAssetId || undefined,
      manualGainDb:
        typeof event.manualGainDb === "number" &&
        Number.isFinite(event.manualGainDb)
          ? roundToStep(event.manualGainDb, 0.5)
          : undefined,
      manualNudgeMs:
        typeof event.manualNudgeMs === "number" &&
        Number.isFinite(event.manualNudgeMs)
          ? Math.round(event.manualNudgeMs)
          : undefined,
    }));
  }

  async function runAction(
    action: "generate" | "resolve" | "preview",
    options?: { notes?: string },
  ) {
    const shouldMarkPlanPending = action === "generate";
    setSaving(true);
    setActionError(null);
    if (shouldMarkPlanPending) {
      onSoundDesignPendingChange?.(true);
    }

    try {
      if (action === "preview") {
        await parseJsonResponse(
          await fetch(
            `/api/short-form-videos/${project.id}/sound-design/preview`,
            { method: "POST" },
          ),
          "Failed to render audio preview",
        );
      } else {
        await parseJsonResponse(
          await fetch(`/api/short-form-videos/${project.id}/sound-design`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              action,
              ...(options?.notes ? { notes: options.notes } : {}),
              content: editing ? draft : undefined,
            }),
          }),
          action === "generate"
            ? "Failed to plan sound design"
            : "Failed to resolve sound design",
        );
      }
      setEditing(false);
      await refresh();
    } catch (err) {
      if (shouldMarkPlanPending) {
        onSoundDesignPendingChange?.(false);
      }
      setActionError(
        err instanceof Error ? err.message : "Failed to update sound design",
      );
    } finally {
      setSaving(false);
    }
  }

  async function saveDraft() {
    setSaving(true);
    setActionError(null);

    try {
      await parseJsonResponse(
        await fetch(`/api/short-form-videos/${project.id}/sound-design`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content: draft }),
        }),
        "Failed to save Plan Sound Design XML",
      );
      setEditing(false);
      await refresh();
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : "Failed to save Plan Sound Design XML",
      );
    } finally {
      setSaving(false);
    }
  }

  async function approvePlanSoundDesign() {
    setSavingPlanStatus(true);
    setPlanStatusError(null);

    try {
      await parseJsonResponse(
        await fetch(`/api/short-form-videos/${project.id}/workflow/sound-design`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            status: "approved",
            comment: "Approved Plan Sound Design in dashboard",
            updatedBy: "ittai",
          }),
        }),
        "Failed to approve Plan Sound Design",
      );
      dispatchShortFormProjectOptimisticUpdate({
        projectId: project.id,
        soundDesignPending: false,
        soundDesignStatus: "approved",
      });
      await refresh();
    } catch (err) {
      setPlanStatusError(
        err instanceof Error ? err.message : "Failed to approve Plan Sound Design",
      );
    } finally {
      setSavingPlanStatus(false);
    }
  }

  async function saveOverrides(options?: {
    renderPreview?: boolean;
    events?: SoundDesignResolvedEventClient[];
  }) {
    const nextEvents = options?.events || eventDrafts;
    setSavingOverrides(true);
    setOverrideError(null);

    try {
      await parseJsonResponse(
        await fetch(`/api/short-form-videos/${project.id}/sound-design`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            resolutionEvents: buildResolutionEventsPayload(nextEvents),
          }),
        }),
        "Failed to save Generate Sound Design overrides",
      );
      if (options?.renderPreview) {
        await parseJsonResponse(
          await fetch(
            `/api/short-form-videos/${project.id}/sound-design/preview`,
            { method: "POST" },
          ),
          "Failed to render audio preview",
        );
      }
      await refresh();
    } catch (err) {
      setOverrideError(
        err instanceof Error
          ? err.message
          : "Failed to save Generate Sound Design overrides",
      );
    } finally {
      setSavingOverrides(false);
    }
  }

  async function saveSoundDesignDecision(
    decision: "approved" | "skipped" | null,
  ) {
    if (decision === "skipped" && !canSkipForVideo) {
      setDecisionError("Add a brief reason before skipping sound design");
      return;
    }

    setSavingDecision(true);
    setDecisionError(null);

    try {
      await parseJsonResponse(
        await fetch(`/api/short-form-videos/${project.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            soundDesignDecision: decision,
            soundDesignSkipReason:
              decision === "skipped"
                ? skipReason.trim() || project.soundDesignSkipReason || null
                : null,
          }),
        }),
        decision === "approved"
          ? "Failed to mark sound design ready for final render"
          : decision === "skipped"
            ? "Failed to skip sound design"
            : "Failed to clear Generate Sound Design handoff",
      );
      await refresh();
    } catch (err) {
      setDecisionError(
        err instanceof Error
          ? err.message
          : "Failed to update Generate Sound Design handoff",
      );
    } finally {
      setSavingDecision(false);
    }
  }

  async function renderReviewPreview(options: {
    key: string;
    mode: SoundDesignReviewRenderMode;
    track?: string;
    selectAfterRender?: boolean;
  }) {
    setRenderingReviewKey(options.key);
    setReviewRenderError(null);

    try {
      const payload = await parseJsonResponse<SoundDesignPreviewResponse>(
        await fetch(
          `/api/short-form-videos/${project.id}/sound-design/preview`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              mode: options.mode,
              track: options.track,
            }),
          },
        ),
        "Failed to render review preview",
      );
      const nextUrl = payload.data?.previewAudioUrl;
      if (!nextUrl) {
        throw new Error("No review preview audio was returned.");
      }

      const cacheBustedUrl = appendPreviewRefreshParam(
        nextUrl,
        String(Date.now()),
      );
      setReviewVariantUrls((current) => ({
        ...current,
        [options.key]: cacheBustedUrl,
      }));
      if (options.selectAfterRender !== false) {
        setSelectedReviewKey(
          options.key as
            | "mix"
            | "narration"
            | "without-sfx"
            | "effects-only"
            | `track:${string}`,
        );
      }
    } catch (err) {
      setReviewRenderError(
        err instanceof Error ? err.message : "Failed to render review preview",
      );
    } finally {
      setRenderingReviewKey((current) =>
        current === options.key ? null : current,
      );
    }
  }

  useEffect(() => {
    if (reviewVariants.some((variant) => variant.key === selectedReviewKey))
      return;
    setSelectedReviewKey(reviewVariants[0]?.key || "mix");
  }, [reviewVariants, selectedReviewKey]);

  async function renderSelectedReviewVariant() {
    if (!selectedReviewVariant || selectedReviewVariant.kind === "baseline")
      return;

    if (selectedReviewVariant.kind === "saved") {
      await runAction("preview");
      return;
    }

    await renderReviewPreview({
      key: selectedReviewVariant.key,
      mode: selectedReviewVariant.renderMode!,
      track: selectedReviewVariant.renderTrack,
    });
  }

  if (mode === "plan") {
    return (
      <section id="plan-sound-design" className="scroll-mt-24 space-y-5">
        <div className="flex flex-wrap items-start gap-2">
          <div className="flex flex-col items-start gap-2">
            <WorkflowArtifactActionButton
              hasArtifact={project.soundDesign.exists}
              initialLabel="Plan sound design"
              rerunLabel="Re-plan sound design"
              rerunWithNotesLabel="Re-plan sound design with revision notes"
              loading={saving || project.soundDesign.pending}
              disabled={busy || project.soundDesign.pending}
              onInitialRun={() => runAction("generate")}
              onCleanRerun={() => runAction("generate")}
              onRerunWithNotes={(notes) => runAction("generate", { notes })}
            />
            <Link
              href={buildShortFormSettingsHref("sound-library", {
                hash: "sound-library",
              })}
              target="_blank"
              rel="noreferrer"
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              Open Sound Library settings ↗
            </Link>
          </div>
          {project.soundDesign.exists && planSoundDesignStatus === "needs review" ? (
            <Button
              variant="secondary"
              onClick={() => void approvePlanSoundDesign()}
              disabled={busy || project.soundDesign.pending}
            >
              {savingPlanStatus ? "Approving…" : "Approve Plan Sound Design"}
            </Button>
          ) : null}
        </div>

        {actionError ? (
          <ValidationNotice title="Sound design failed" message={actionError} />
        ) : null}

        {planStatusError ? (
          <ValidationNotice title="Plan Sound Design status failed" message={planStatusError} />
        ) : null}

        {editing ? (
          <div className="space-y-3 rounded-lg border border-border bg-background/60 p-4">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-sm font-medium text-foreground">
                Sound Design Plan XML
              </h3>
              <EditIconButton
                editing={editing}
                onClick={() => setEditing((current) => !current)}
                disabled={busy}
                tooltip="Edit sound-design XML"
                editingTooltip="Cancel sound-design XML edit"
              />
            </div>
            <Textarea
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              className="min-h-[320px] font-mono text-xs"
            />
            <div className="flex gap-2">
              <Button onClick={() => void saveDraft()} disabled={busy}>
                Save XML
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  setEditing(false);
                  setDraft(project.soundDesign.content || "");
                }}
              >
                Discard
              </Button>
            </div>
          </div>
        ) : project.soundDesign.content ? (
          <div className="rounded-lg border border-border bg-background/60 p-4">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-sm font-medium text-foreground">
                Sound Design Plan XML
              </h3>
              <EditIconButton
                editing={editing}
                onClick={() => setEditing((current) => !current)}
                disabled={busy}
                tooltip="Edit sound-design XML"
                editingTooltip="Cancel sound-design XML edit"
              />
            </div>
            <div className="mt-4">
              <MarkdownOrCode
                content={project.soundDesign.content}
                mode="xml"
              />
            </div>
          </div>
        ) : (
          <div className="text-sm text-muted-foreground">
            No Plan Sound Design XML yet. Finish Plan Visuals, approve Generate Visuals, then create the planning artifact here.
          </div>
        )}
      </section>
    );
  }

  return (
    <section id="generate-sound-design" className="scroll-mt-24 space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="secondary"
          onClick={() => void runAction("resolve")}
          disabled={busy || project.soundDesign.pending || !project.soundDesign.content}
        >
          Resolve library matches
        </Button>
        <Button
          variant="outline"
          onClick={() => void runAction("preview")}
          disabled={busy || project.soundDesign.pending || !project.soundDesign.content}
        >
          Render preview mix
        </Button>
        {showApproveSoundDesignAction ? (
          <Button
            type="button"
            variant="secondary"
            onClick={() => void saveSoundDesignDecision("approved")}
            disabled={busy || !canApproveForVideo}
          >
            {savingDecision ? "Approving…" : "Approve"}
          </Button>
        ) : null}
        <Link
          href={buildShortFormSettingsHref("sound-library", {
            hash: "sound-library",
          })}
          target="_blank"
          rel="noreferrer"
          className="text-xs text-muted-foreground hover:text-foreground"
        >
          Open Sound Library settings ↗
        </Link>
      </div>

      <div className="rounded-lg border border-border bg-background/60 p-4">
        <div className="grid gap-4 md:grid-cols-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Events
            </p>
            <p className="mt-1 text-sm text-foreground">{eventStats.total}</p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Resolved
            </p>
            <p className="mt-1 text-sm text-foreground">
              {eventStats.resolved}
            </p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Unresolved
            </p>
            <p className="mt-1 text-sm text-foreground">
              {eventStats.unresolved}
            </p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Preview mix
            </p>
            <p className="mt-1 text-sm text-foreground">
              {previewAudioUrl ? "Ready" : "Not rendered yet"}
            </p>
          </div>
        </div>
        <p className="mt-4 text-xs text-muted-foreground">
          Resolve the XML plan, render preview audio, tune event overrides, then approve the selected mix for Final Video.
        </p>
      </div>

      {project.soundDesign.pending ? (
        <PendingNotice label="Planning or rendering sound design" />
      ) : null}

      {actionError ? (
        <ValidationNotice title="Sound design failed" message={actionError} />
      ) : null}
      {overrideError ? (
        <ValidationNotice
          title="Override save failed"
          message={overrideError}
        />
      ) : null}
      {decisionError ? (
        <ValidationNotice
          title="Generate Sound Design approval failed"
          message={decisionError}
        />
      ) : null}

      {!project.soundDesign.content ? (
        <ValidationNotice
          title="Sound Design Plan XML is not ready"
          message="Plan Sound Design first, then return here to resolve assets, render audio, and tune overrides."
        />
      ) : null}

      <div className="rounded-lg border border-border bg-background/60 p-4">
        <div>
          <h3 className="text-sm font-medium text-foreground">Review studio</h3>
          <p className="mt-1 max-w-3xl text-xs text-muted-foreground">
            Pick one audio variant, generate or re-generate it if needed, then
            listen here. Saved track-solo renders also appear in the same
            selector when available.
          </p>
        </div>

        {reviewRenderError ? (
          <ValidationNotice
            title="Review render failed"
            message={reviewRenderError}
          />
        ) : null}

        <div className="mt-4 flex flex-col gap-3 lg:flex-row lg:items-end">
          <div className="flex-1 space-y-2">
            <label className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              Audio variant
            </label>
            <Select
              value={selectedReviewVariant?.key || "mix"}
              onChange={(event) =>
                setSelectedReviewKey(
                  event.target.value as
                    | "mix"
                    | "narration"
                    | "without-sfx"
                    | "effects-only"
                    | `track:${string}`,
                )
              }
            >
              {reviewVariants.map((variant) => (
                <option key={variant.key} value={variant.key}>
                  {variant.label}
                </option>
              ))}
            </Select>
          </div>
          <Button
            variant="outline"
            onClick={() => void renderSelectedReviewVariant()}
            disabled={
              busy ||
              !selectedReviewVariantCanRender ||
              selectedReviewVariantBusy
            }
          >
            {selectedReviewVariant?.kind === "baseline"
              ? narrationOnlyUrl
                ? "Uses existing narration"
                : "Narration not ready"
              : selectedReviewVariantBusy
                ? "Rendering…"
                : activeReviewUrl
                  ? "Re-generate preview"
                  : "Generate preview"}
          </Button>
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(260px,0.9fr)]">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary">
                {selectedReviewVariant?.label || "Review preview"}
              </Badge>
              <Badge variant="outline">
                {selectedReviewVariant?.kind === "saved"
                  ? "Saved preview"
                  : selectedReviewVariant?.kind === "baseline"
                    ? "Baseline reference"
                    : "Generated review render"}
              </Badge>
            </div>
            {activeReviewUrl ? (
              <audio
                key={activeReviewUrl}
                controls
                className="w-full"
                src={activeReviewUrl}
              />
            ) : (
              <div className="rounded-lg border border-dashed border-border p-3 text-xs text-muted-foreground">
                {selectedReviewVariant?.kind === "baseline"
                  ? "Narration audio is not ready yet. Finish XML Script first to use this comparison."
                  : "This audio variant has not been generated yet."}
              </div>
            )}
          </div>
          <div className="rounded-lg border border-border/70 bg-background/40 p-3 text-xs text-muted-foreground">
            <p>
              <span className="font-medium text-foreground">
                Selected source:
              </span>{" "}
              {selectedReviewVariant?.description ||
                "Pick a review source to inspect the current mix."}
            </p>
            <p className="mt-2">
              <span className="font-medium text-foreground">
                Saved vs draft:
              </span>{" "}
              {overridesDirty
                ? "Previews reflect the last saved Generate Sound Design state. Save override edits before using them as approval references."
                : "This variant matches the current saved Generate Sound Design state."}
            </p>
            <p className="mt-2">
              <span className="font-medium text-foreground">
                Track solo renders:
              </span>{" "}
              They are temporary review files only, so you can isolate a lane
              without changing the saved final mix.
            </p>
          </div>
        </div>
      </div>

      {editableEvents.length > 0 ? (
        <div className="rounded-lg border border-border bg-background/60 p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <h3 className="text-sm font-medium text-foreground">
                Event overrides
              </h3>
              <p className="mt-1 max-w-2xl text-xs text-muted-foreground">
                Manually mute, solo, swap assets, nudge timing, and trim gain on
                resolved events. Save the overrides on their own, or save them
                and immediately render a fresh preview.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="secondary"
                onClick={() => void saveOverrides()}
                disabled={!overridesDirty || busy}
              >
                {savingOverrides ? "Saving overrides…" : "Save overrides"}
              </Button>
              <Button
                variant="outline"
                onClick={() => void saveOverrides({ renderPreview: true })}
                disabled={editableEvents.length === 0 || busy}
              >
                {savingOverrides ? "Rendering…" : "Save + render preview"}
              </Button>
              <Button
                variant="ghost"
                onClick={() =>
                  setEventDrafts((current) =>
                    current.map((event) => ({ ...event, solo: false })),
                  )
                }
                disabled={busy || !eventDrafts.some((event) => event.solo)}
              >
                Clear solo flags
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  setEventDrafts(resolvedEvents);
                  setOverrideError(null);
                }}
                disabled={!overridesDirty || busy}
              >
                Discard unsaved changes
              </Button>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2 text-xs">
            <Select
              value={trackFilter}
              onChange={(event) => setTrackFilter(event.target.value)}
              className="max-w-[220px]"
            >
              <option value="all">All tracks</option>
              {trackOptions.map((track) => (
                <option key={track} value={track}>
                  {track}
                </option>
              ))}
            </Select>
            <Button
              size="sm"
              variant={showChangedOnly ? "default" : "outline"}
              onClick={() => setShowChangedOnly((current) => !current)}
            >
              {showChangedOnly ? "Showing changed only" : "Show changed only"}
            </Button>
            <span className="text-muted-foreground">
              {filteredEditableEvents.length} visible of {editableEvents.length}{" "}
              editable events
            </span>
          </div>

          <div className="mt-4 space-y-3">
            {filteredEditableEvents.map((event) => {
              const baseEvent = baseEventById.get(event.id) || event;
              const assetOptions = buildSoundDesignAssetOptions(
                event,
                soundLibrary,
              );
              const selectedAsset = getSelectedSoundDesignAsset(
                event,
                soundLibrary,
              );
              const dirty =
                serializeSoundDesignOverrides([event]) !==
                serializeSoundDesignOverrides([baseEvent]);
              const {
                effectiveNudge,
                effectiveGain,
                start: previewStart,
                end: previewEnd,
              } = getSoundDesignEventEffectiveWindow(event);

              return (
                <div
                  key={event.id}
                  className={`rounded-lg border p-4 ${dirty ? "border-primary/40 bg-primary/5" : "border-border/70 bg-background/70"}`}
                >
                  <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="outline">{event.type}</Badge>
                        <Badge variant="outline">{event.track}</Badge>
                        <Badge variant="outline">{event.anchor}</Badge>
                        <Badge variant="secondary">Resolved</Badge>
                        {event.muted ? (
                          <Badge variant="warning">Muted</Badge>
                        ) : null}
                        {event.solo ? (
                          <Badge variant="default">Solo</Badge>
                        ) : null}
                        {event.manualAssetId ? (
                          <Badge variant="info">Asset override</Badge>
                        ) : null}
                        {typeof event.manualGainDb === "number" ? (
                          <Badge variant="info">Gain override</Badge>
                        ) : null}
                        {typeof event.manualNudgeMs === "number" &&
                        event.manualNudgeMs !== 0 ? (
                          <Badge variant="info">Timing override</Badge>
                        ) : null}
                        {dirty ? <Badge>Unsaved</Badge> : null}
                      </div>
                      <div className="mt-3 text-sm font-medium text-foreground">
                        {selectedAsset?.name ||
                          event.assetName ||
                          event.assetId ||
                          "Resolved event"}
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        {event.id}
                      </div>
                      {event.rationale ? (
                        <p className="mt-2 max-w-3xl text-xs text-muted-foreground">
                          {event.rationale}
                        </p>
                      ) : null}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        variant={event.muted ? "default" : "outline"}
                        size="sm"
                        onClick={() =>
                          updateEventDraft(event.id, (current) => ({
                            ...current,
                            muted: !current.muted,
                          }))
                        }
                        disabled={busy}
                      >
                        {event.muted ? "Unmute" : "Mute"}
                      </Button>
                      <Button
                        variant={event.solo ? "default" : "outline"}
                        size="sm"
                        onClick={() =>
                          updateEventDraft(event.id, (current) => ({
                            ...current,
                            solo: !current.solo,
                          }))
                        }
                        disabled={busy}
                      >
                        {event.solo ? "Unsolo" : "Solo"}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          updateEventDraft(event.id, () => ({ ...baseEvent }))
                        }
                        disabled={busy || !dirty}
                      >
                        Reset event
                      </Button>
                    </div>
                  </div>

                  <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(220px,1fr)_minmax(220px,1fr)]">
                    <div>
                      <label className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                        Asset swap
                      </label>
                      <Select
                        value={event.manualAssetId || ""}
                        onChange={(selectEvent) =>
                          updateEventDraft(event.id, (current) => ({
                            ...current,
                            manualAssetId:
                              selectEvent.target.value || undefined,
                          }))
                        }
                        disabled={busy || soundLibrary.length === 0}
                        className="mt-2"
                      >
                        <option value="">
                          Auto match (
                          {event.assetName || event.assetId || "none"})
                        </option>
                        {assetOptions.map((asset) => (
                          <option key={asset.id} value={asset.id}>
                            {getSoundDesignAssetLabel(asset)}
                          </option>
                        ))}
                      </Select>
                      <p className="mt-2 text-xs text-muted-foreground">
                        {assetOptions.length > 0
                          ? `${Math.min(assetOptions.length, event.compatibleAssetIds?.length || assetOptions.length)} suggested option${Math.min(assetOptions.length, event.compatibleAssetIds?.length || assetOptions.length) === 1 ? "" : "s"} first, then the rest of the uploaded library.`
                          : "Upload Sound Library entries in settings to enable manual asset swaps."}
                      </p>
                    </div>
                    <div>
                      <label className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                        Timing nudge
                      </label>
                      <input
                        type="range"
                        min={-1200}
                        max={1200}
                        step={10}
                        value={effectiveNudge}
                        onChange={(inputEvent) =>
                          updateEventDraft(event.id, (current) => ({
                            ...current,
                            manualNudgeMs: clamp(
                              Number(inputEvent.target.value) || 0,
                              -1200,
                              1200,
                            ),
                          }))
                        }
                        disabled={busy}
                        className="mt-3 w-full"
                      />
                      <div className="mt-2 flex items-center gap-2">
                        <Input
                          type="number"
                          min={-1200}
                          max={1200}
                          step={10}
                          value={String(effectiveNudge)}
                          onChange={(inputEvent) =>
                            updateEventDraft(event.id, (current) => ({
                              ...current,
                              manualNudgeMs: clamp(
                                Number(inputEvent.target.value) || 0,
                                -1200,
                                1200,
                              ),
                            }))
                          }
                          disabled={busy}
                        />
                        <span className="text-xs text-muted-foreground">
                          {formatMs(effectiveNudge)}
                        </span>
                      </div>
                      <p className="mt-2 text-xs text-muted-foreground">
                        Shift this event earlier or later without editing the
                        XML anchor.
                      </p>
                    </div>
                    <div>
                      <label className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                        Gain trim
                      </label>
                      <input
                        type="range"
                        min={-24}
                        max={12}
                        step={0.5}
                        value={effectiveGain}
                        onChange={(inputEvent) =>
                          updateEventDraft(event.id, (current) => ({
                            ...current,
                            manualGainDb: roundToStep(
                              clamp(
                                Number(inputEvent.target.value) || 0,
                                -24,
                                12,
                              ),
                              0.5,
                            ),
                          }))
                        }
                        disabled={busy}
                        className="mt-3 w-full"
                      />
                      <div className="mt-2 flex items-center gap-2">
                        <Input
                          type="number"
                          min={-24}
                          max={12}
                          step={0.5}
                          value={String(effectiveGain)}
                          onChange={(inputEvent) =>
                            updateEventDraft(event.id, (current) => ({
                              ...current,
                              manualGainDb: roundToStep(
                                clamp(
                                  Number(inputEvent.target.value) || 0,
                                  -24,
                                  12,
                                ),
                                0.5,
                              ),
                            }))
                          }
                          disabled={busy}
                        />
                        <span className="text-xs text-muted-foreground">
                          {formatDb(effectiveGain)}
                        </span>
                      </div>
                      <p className="mt-2 text-xs text-muted-foreground">
                        Use a manual trim when this event needs a different
                        level than the auto-resolved default.
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-xs text-muted-foreground">
                    <span>
                      Effective asset after save:{" "}
                      <span className="font-medium text-foreground">
                        {selectedAsset?.name ||
                          event.assetName ||
                          event.assetId ||
                          "Auto match"}
                      </span>
                    </span>
                    <span>
                      Preview timing:{" "}
                      <span className="font-medium text-foreground">
                        {formatSeconds(previewStart)}
                        {typeof previewEnd === "number"
                          ? ` → ${formatSeconds(previewEnd)}`
                          : ""}
                      </span>
                    </span>
                    <span>
                      Effective gain after save:{" "}
                      <span className="font-medium text-foreground">
                        {formatDb(effectiveGain)}
                      </span>
                    </span>
                    <span>
                      Manual nudge:{" "}
                      <span className="font-medium text-foreground">
                        {formatMs(effectiveNudge)}
                      </span>
                    </span>
                  </div>
                </div>
              );
            })}

            {filteredEditableEvents.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
                No resolved events match the current filter.
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </section>
  );
}

function VideoSection({
  project,
  refresh,
}: {
  project: Project;
  refresh: () => Promise<unknown>;
}) {
  const [voiceOptions, setVoiceOptions] = useState<VoiceOption[]>([]);
  const [musicOptions, setMusicOptions] = useState<MusicOption[]>([]);
  const [captionStyleOptions, setCaptionStyleOptions] = useState<
    CaptionStyleOption[]
  >([]);
  const [defaultVoiceId, setDefaultVoiceId] = useState<string>("");
  const [defaultMusicId, setDefaultMusicId] = useState<string>("");
  const [defaultCaptionStyleId, setDefaultCaptionStyleId] =
    useState<string>("");
  const [defaultChromaKeyEnabled, setDefaultChromaKeyEnabled] =
    useState<boolean>(false);
  const [musicVolume, setMusicVolume] = useState<number>(0.38);
  const [savingMusic, setSavingMusic] = useState(false);
  const [savingCaptionStyle, setSavingCaptionStyle] = useState(false);
  const [savingChromaKey, setSavingChromaKey] = useState(false);
  const [musicError, setMusicError] = useState<string | null>(null);
  const [captionStyleError, setCaptionStyleError] = useState<string | null>(
    null,
  );
  const [chromaKeyError, setChromaKeyError] = useState<string | null>(null);

  const { data: videoSettingsPayload } = useSWR<ApiResponse<WorkflowSettingsResponse>>(
    "/api/short-form-videos/settings",
    apiEnvelopeFetcher,
    realtimeSWRConfig,
  );

  useEffect(() => {
    const nextVoices = Array.isArray(videoSettingsPayload?.data?.videoRender?.voices)
      ? videoSettingsPayload.data.videoRender.voices.filter(
          (voice): voice is VoiceOption =>
            Boolean(
              voice &&
              typeof voice.id === "string" &&
              typeof voice.name === "string",
            ),
        )
      : [];
    const nextMusic = Array.isArray(videoSettingsPayload?.data?.videoRender?.musicTracks)
      ? videoSettingsPayload.data.videoRender.musicTracks.filter(
          (track): track is MusicOption =>
            Boolean(
              track &&
              typeof track.id === "string" &&
              typeof track.name === "string",
            ),
        )
      : [];
    const nextCaptionStyles = Array.isArray(
      videoSettingsPayload?.data?.videoRender?.captionStyles,
    )
      ? videoSettingsPayload.data.videoRender.captionStyles.filter(
          (style): style is CaptionStyleOption =>
            Boolean(
              style &&
              typeof style.id === "string" &&
              typeof style.name === "string",
            ),
        )
      : [];
    setVoiceOptions(nextVoices);
    setMusicOptions(nextMusic);
    setCaptionStyleOptions(nextCaptionStyles);
    setDefaultVoiceId(videoSettingsPayload?.data?.videoRender?.defaultVoiceId || "");
    setDefaultMusicId(
      videoSettingsPayload?.data?.videoRender?.defaultMusicTrackId || "",
    );
    setDefaultCaptionStyleId(
      videoSettingsPayload?.data?.videoRender?.defaultCaptionStyleId || "",
    );
    setDefaultChromaKeyEnabled(
      Boolean(videoSettingsPayload?.data?.videoRender?.chromaKeyEnabledByDefault),
    );
    setMusicVolume(
      typeof videoSettingsPayload?.data?.videoRender?.musicVolume === "number"
        ? videoSettingsPayload.data.videoRender.musicVolume
        : 0.38,
    );
  }, [videoSettingsPayload]);

  async function saveProjectMusic(musicId: string) {
    setSavingMusic(true);
    setMusicError(null);
    try {
      await parseJsonResponse(
        await fetch(`/api/short-form-videos/${project.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ selectedMusicId: musicId }),
        }),
        "Failed to update project soundtrack",
      );
      await refresh();
    } catch (err) {
      setMusicError(
        err instanceof Error
          ? err.message
          : "Failed to update project soundtrack",
      );
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
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            selectedCaptionStyleId:
              captionStyleId === null ? null : captionStyleId,
          }),
        }),
        "Failed to update project caption style",
      );
      await refresh();
    } catch (err) {
      setCaptionStyleError(
        err instanceof Error
          ? err.message
          : "Failed to update project caption style",
      );
    } finally {
      setSavingCaptionStyle(false);
    }
  }

  async function saveProjectChromaKey(value: boolean | null) {
    setSavingChromaKey(true);
    setChromaKeyError(null);
    try {
      await parseJsonResponse(
        await fetch(`/api/short-form-videos/${project.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chromaKeyEnabledOverride: value }),
        }),
        "Failed to update project chroma-key setting",
      );
      await refresh();
    } catch (err) {
      setChromaKeyError(
        err instanceof Error
          ? err.message
          : "Failed to update project chroma-key setting",
      );
    } finally {
      setSavingChromaKey(false);
    }
  }

  const activeVoiceLabel =
    project.selectedVoiceName ||
    voiceOptions.find((voice) => voice.id === defaultVoiceId)?.name ||
    "default voice";
  const activeMusicLabel =
    project.selectedMusicName ||
    musicOptions.find((track) => track.id === defaultMusicId)?.name ||
    "default soundtrack";
  const activeCaptionStyleLabel =
    project.selectedCaptionStyleName ||
    captionStyleOptions.find((style) => style.id === defaultCaptionStyleId)
      ?.name ||
    "default caption style";
  const activeChromaKeyLabel = project.chromaKeyEnabled
    ? "enabled"
    : "disabled";
  const activeChromaKeySourceLabel =
    project.chromaKeyEnabledSource === "project"
      ? "project override"
      : "global default";
  const previewVideoRef = useRef<HTMLVideoElement | null>(null);
  const previewRefreshToken = useMemo(() => {
    const finalizeStep = project.video.pipeline?.steps.find(
      (step) => step.id === "finalize-output",
    );
    const captionStep = project.video.pipeline?.steps.find(
      (step) => step.id === "burn-captions",
    );
    return (
      finalizeStep?.updatedAt ||
      captionStep?.updatedAt ||
      project.video.updatedAt ||
      project.updatedAt ||
      null
    );
  }, [
    project.updatedAt,
    project.video.pipeline?.steps,
    project.video.updatedAt,
  ]);
  const previewVideoUrl = useMemo(
    () =>
      project.video.videoUrl
        ? appendPreviewRefreshParam(project.video.videoUrl, previewRefreshToken)
        : undefined,
    [project.video.videoUrl, previewRefreshToken],
  );
  const soundDesignHandoff = getSoundDesignHandoffState(project);
  const soundDesignReadyForVideo = soundDesignHandoff.canProceedToFinalVideo;
  const soundDesignSkippedForVideo =
    soundDesignHandoff.decision === "skipped" && soundDesignReadyForVideo;

  useEffect(() => {
    if (!previewVideoRef.current || !previewVideoUrl) return;
    previewVideoRef.current.load();
  }, [previewVideoUrl]);

  return (
    <StageReviewSection
      projectId={project.id}
      title="Video"
      stage="video"
      description="After generated visuals are approved, the dashboard renders the final short-form video directly through the xml-scene-video workflow by reusing the narration + forced-alignment artifacts already produced during Generate Narration Audio, plus a full-duration looping background video track, optional chroma-key compositing, saved background music, ASS/libass subtitle burn-in, and per-visual XML camera motion that applies only to the image layer when explicitly set in the XML."
      doc={project.video}
      mode="markdown"
      emptyText="No video yet. Generate the final video after approving generated visuals and resolving the Generate Sound Design handoff."
      triggerLabel="Generate final video"
      triggerDescription={`The video should be rendered from the XML <script> and approved scene assets by reusing the saved XML-step narration/alignment artifacts${activeVoiceLabel ? ` (voice source currently shown as ${activeVoiceLabel} in Generate Narration Audio)` : ""}${activeMusicLabel ? `, soundtrack preset ${activeMusicLabel}` : ""}${activeCaptionStyleLabel ? `, caption style ${activeCaptionStyleLabel}` : ""}${project.selectedBackgroundVideoName ? `, the looping background video ${project.selectedBackgroundVideoName}` : ""}, with chroma key currently ${activeChromaKeyLabel} via ${activeChromaKeySourceLabel}, plus the saved music mix volume (${Math.round(musicVolume * 100)}%) and the deterministic ASS/libass caption path unless explicitly overridden.`}
      onRefresh={refresh}
      triggerPayload={{
        chromaKeyEnabledOverride: project.chromaKeyEnabledOverride ?? null,
      }}
      triggerDisabled={!soundDesignReadyForVideo}
      triggerDisabledReason={
        !soundDesignReadyForVideo
          ? soundDesignHandoff.gateReason ||
            "Go to Generate Sound Design first, then mark it ready for Final Video or explicitly skip it with a reason."
          : undefined
      }
      collapseDocumentByDefault
      simplifiedReviewActions
      extra={
        <div className="space-y-4">
          <div
            className={`rounded-lg border p-4 ${soundDesignReadyForVideo ? "border-emerald-500/30 bg-emerald-500/10" : "border-amber-500/30 bg-amber-500/10"}`}
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-sm font-medium text-foreground">
                    Generate Sound Design handoff
                  </h3>
                  {soundDesignHandoff.decision === "approved" &&
                  soundDesignReadyForVideo ? (
                    <StatusBadge status="approved" compact />
                  ) : soundDesignHandoff.decision === "skipped" &&
                    soundDesignReadyForVideo ? (
                    <Badge variant="warning">Skipped</Badge>
                  ) : (
                    <Badge variant="outline">Required before render</Badge>
                  )}
                </div>
                <p className="mt-1 max-w-2xl text-xs text-muted-foreground">
                  Final Video stays gated until Generate Sound Design is either approved
                  after previewing the mix or explicitly skipped with a reason.
                </p>
              </div>
              <Link
                href={buildShortFormDetailHref(project.id, "generate-sound-design")}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                Jump to Generate Sound Design ↑
              </Link>
            </div>
            <div className="mt-3 text-xs text-muted-foreground">
              {soundDesignHandoff.decision === "approved" &&
              soundDesignReadyForVideo
                ? "The current Generate Sound Design preview has been approved for the final render handoff."
                : soundDesignHandoff.decision === "skipped" &&
                    soundDesignReadyForVideo
                  ? `Sound design is intentionally skipped for this final render${project.soundDesignSkipReason ? `: ${project.soundDesignSkipReason}` : "."}`
                  : soundDesignHandoff.gateReason ||
                    "No handoff decision saved yet. The final-render trigger remains disabled until that decision is made in Generate Sound Design."}
            </div>
            {soundDesignSkippedForVideo ? (
              <p className="mt-2 text-xs text-amber-100">
                Skip mode is active, so the final render will proceed without
                requiring the Generate Sound Design mix.
              </p>
            ) : null}
          </div>
          {musicError ? (
            <ValidationNotice
              title="Soundtrack selection failed"
              message={musicError}
            />
          ) : null}
          {captionStyleError ? (
            <ValidationNotice
              title="Caption style selection failed"
              message={captionStyleError}
            />
          ) : null}
          {chromaKeyError ? (
            <ValidationNotice
              title="Chroma-key selection failed"
              message={chromaKeyError}
            />
          ) : null}
          <div className="rounded-lg border border-border bg-background/60 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="text-sm font-medium text-foreground">
                  Narration source
                </h3>
                <p className="mt-1 max-w-2xl text-xs text-muted-foreground">
                  Final Video does not pick or regenerate its own voice anymore.
                  It reuses the processed narration WAV and forced alignment
                  already created in the Generate Narration Audio step.
                </p>
              </div>
              <Link
                href={buildShortFormDetailHref(project.id, "generate-narration-audio")}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                Jump to Generate Narration Audio ↑
              </Link>
            </div>
            <div className="mt-3 text-xs text-muted-foreground">
              {project.selectedVoiceName
                ? `XML narration voice currently selected for this project: ${project.selectedVoiceName}`
                : defaultVoiceId
                  ? `XML narration currently falls back to the default voice: ${activeVoiceLabel}`
                  : "XML narration will use the fallback default voice until a project/default voice is selected."}
            </div>
          </div>
          <div className="rounded-lg border border-border bg-background/60 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="text-sm font-medium text-foreground">
                  Soundtrack for this project
                </h3>
                <p className="mt-1 max-w-2xl text-xs text-muted-foreground">
                  Pick which saved soundtrack entry should be reused for this
                  project. Once a soundtrack has been generated in settings,
                  final-video renders reuse that exact saved WAV file instead of
                  asking ACE-Step for a fresh song each time.
                </p>
              </div>
              <Link
                href={buildShortFormSettingsHref("music", {
                  hash: "music-library",
                })}
                target="_blank"
                rel="noreferrer"
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                Open music library ↗
              </Link>
            </div>
            <div className="mt-3 flex flex-col gap-3 md:flex-row md:items-center">
              <Select
                value={project.selectedMusicId || defaultMusicId || ""}
                onChange={(event) => void saveProjectMusic(event.target.value)}
                disabled={savingMusic || musicOptions.length === 0}
                className="max-w-sm"
              >
                {musicOptions.map((track) => (
                  <option key={track.id} value={track.id}>
                    {track.name}
                    {track.id === defaultMusicId ? " (default)" : ""}
                  </option>
                ))}
              </Select>
              <div className="text-xs text-muted-foreground">
                {savingMusic
                  ? "Saving soundtrack selection…"
                  : project.selectedMusicName
                    ? `Current project soundtrack: ${project.selectedMusicName}`
                    : defaultMusicId
                      ? `Using the current default soundtrack: ${activeMusicLabel}`
                      : "Using the fallback soundtrack preset."}
              </div>
            </div>
            <div className="mt-3 text-xs text-muted-foreground">
              Saved music mix volume for new renders:{" "}
              <span className="font-medium text-foreground">
                {Math.round(musicVolume * 100)}%
              </span>
            </div>
          </div>
          <div className="rounded-lg border border-border bg-background/60 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="text-sm font-medium text-foreground">
                  Caption style for this project
                </h3>
                <p className="mt-1 max-w-2xl text-xs text-muted-foreground">
                  Final-video renders now burn ASS subtitles using the selected
                  caption-style preset. Leave the project on the global default,
                  or override it here for a specific short-form video.
                </p>
              </div>
              <Link
                href={buildShortFormSettingsHref("captions", {
                  hash: "caption-styles",
                })}
                target="_blank"
                rel="noreferrer"
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                Open caption styles ↗
              </Link>
            </div>
            <div className="mt-3 flex flex-col gap-3 md:flex-row md:items-center">
              <Select
                value={project.captionStyleOverrideId || ""}
                onChange={(event) =>
                  void saveProjectCaptionStyle(event.target.value || null)
                }
                disabled={
                  savingCaptionStyle || captionStyleOptions.length === 0
                }
                className="max-w-sm"
              >
                <option value="">Use default caption style</option>
                {captionStyleOptions.map((style) => (
                  <option key={style.id} value={style.id}>
                    {style.name}
                    {style.id === defaultCaptionStyleId ? " (default)" : ""}
                  </option>
                ))}
              </Select>
              <div className="text-xs text-muted-foreground">
                {savingCaptionStyle
                  ? "Saving caption style selection…"
                  : project.captionStyleOverrideId
                    ? `Current project caption style override: ${project.selectedCaptionStyleName || activeCaptionStyleLabel}`
                    : defaultCaptionStyleId
                      ? `Using the current default caption style: ${activeCaptionStyleLabel}`
                      : "Using the fallback caption style."}
              </div>
            </div>
            <div className="mt-3 text-xs text-muted-foreground">
              Effective final-render caption style:{" "}
              <span className="font-medium text-foreground">
                {activeCaptionStyleLabel}
              </span>
            </div>
          </div>
          <div className="rounded-lg border border-border bg-background/60 p-3 text-xs text-muted-foreground">
            <div className="flex flex-wrap items-center gap-3">
              <span>
                <span className="font-medium text-foreground">Background:</span>{" "}
                {project.selectedBackgroundVideoName || "Not selected yet"}
              </span>
              <span className="text-border">•</span>
              <span className="font-medium text-foreground">Chroma key</span>
              <Select
                value={
                  typeof project.chromaKeyEnabledOverride === "boolean"
                    ? project.chromaKeyEnabledOverride
                      ? "enabled"
                      : "disabled"
                    : ""
                }
                onChange={(event) =>
                  void saveProjectChromaKey(
                    event.target.value === ""
                      ? null
                      : event.target.value === "enabled",
                  )
                }
                disabled={savingChromaKey}
                className="h-8 w-[190px] py-1 text-xs"
              >
                <option value="">
                  Use default ({defaultChromaKeyEnabled ? "On" : "Off"})
                </option>
                <option value="disabled">Force off</option>
                <option value="enabled">Force on</option>
              </Select>
              <span>
                {savingChromaKey
                  ? "Saving…"
                  : `Effective: ${activeChromaKeyLabel} (${activeChromaKeySourceLabel})`}
              </span>
              <Link
                href={buildShortFormSettingsHref("audio", {
                  hash: "pause-removal",
                })}
                target="_blank"
                rel="noreferrer"
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                Defaults ↗
              </Link>
            </div>
          </div>
          <VideoPipelinePanel project={project} />
          {previewVideoUrl ? (
            <div className="space-y-3">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h3 className="text-sm font-medium text-foreground">
                    Preview
                  </h3>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Use the button to open or download the final video file
                    directly, especially on mobile.
                  </p>
                </div>
                <a
                  href={previewVideoUrl}
                  download
                  target="_blank"
                  rel="noreferrer"
                  className={buttonVariants({ variant: "default" })}
                >
                  Download final video
                </a>
              </div>
              <video
                ref={previewVideoRef}
                key={previewVideoUrl}
                src={previewVideoUrl}
                controls
                playsInline
                preload="metadata"
                className="max-h-[70vh] w-full rounded-lg border border-border bg-black"
              />
            </div>
          ) : null}
        </div>
      }
    />
  );
}

export function ShortFormVideoDetailView({
  projectId,
  activeSection,
}: {
  projectId: string;
  activeSection: ShortFormDetailRouteSection;
}) {
  const [project, setProject] = useState<Project | null>(null);
  const [topic, setTopic] = useState("");
  const [topicDirty, setTopicDirty] = useState(false);
  const [savingTopic, setSavingTopic] = useState(false);
  const [pageError, setPageError] = useState<string | null>(null);
  const [manualRefreshing, setManualRefreshing] = useState(false);
  const { mutate: mutateCache } = useSWRConfig();

  const shouldPoll = Boolean(
    projectId &&
    (!project ||
      (project?.pendingStages.length ?? 0) > 0 ||
      project?.xmlScript.pending ||
      project?.soundDesign.pending ||
      project?.video.pending ||
      project?.video.pipeline?.status === "running" ||
      savingTopic),
  );
  const projectKey = projectId ? `/api/short-form-videos/${projectId}` : null;
  const {
    data: projectPayload,
    error: pollingError,
    isLoading,
    isValidating,
    mutate: refetchProject,
  } = useSWR<ApiResponse<Project>>(projectKey, apiEnvelopeFetcher, {
    ...realtimeSWRConfig,
    refreshInterval: shouldPoll ? 4000 : 0,
  });
  const loading = isLoading && !project;
  const refreshing = isValidating && Boolean(project);
  const pollingErrorMessage = pollingError instanceof Error ? pollingError.message : null;

  useEffect(() => {
    if (!projectPayload) return;
    if (!projectPayload.success || !projectPayload.data) {
      setPageError(projectPayload.error || "Failed to load short-form workflow");
      return;
    }
    const normalized = normalizeShortFormProject(projectPayload.data);
    setPageError(null);
    setProject((current) =>
      shortFormProjectChanged(current, normalized) ? normalized : current,
    );
  }, [projectPayload]);

  usePageScrollRestoration(
    projectId ? `short-form-video-detail:${projectId}:${activeSection}` : null,
    Boolean(projectId) && !loading,
  );

  useEffect(() => {
    if (!project || topicDirty) return;
    setTopic(project.topic || "");
  }, [project, topicDirty]);

  const refreshProject = useCallback(async () => {
    const payload = await refetchProject();
    if (payload && payload.success && payload.data) {
      const normalized = normalizeShortFormProject(payload.data);
      setPageError(null);
      setProject((current) =>
        shortFormProjectChanged(current, normalized) ? normalized : current,
      );
      return normalized;
    }

    if (payload && !payload.success) {
      setPageError(payload.error || "Failed to refresh short-form workflow");
      throw new Error(payload.error || "Failed to refresh short-form workflow");
    }

    throw new Error("Failed to refresh short-form workflow");
  }, [refetchProject]);

  const isXmlWorkflowSection =
    activeSection === "generate-narration-audio" ||
    activeSection === "plan-captions" ||
    activeSection === "plan-visuals";

  const refreshActivePage = useCallback(async () => {
    setManualRefreshing(true);
    try {
      if (isXmlWorkflowSection && projectId) {
        const results = await Promise.allSettled([
          refreshProject(),
          mutateCache(`/api/short-form-videos/${projectId}/xml-script`),
        ]);
        const rejected = results.find(
          (result): result is PromiseRejectedResult =>
            result.status === "rejected",
        );
        if (rejected) throw rejected.reason;
        return;
      }

      await refreshProject();
    } finally {
      setManualRefreshing(false);
    }
  }, [isXmlWorkflowSection, mutateCache, projectId, refreshProject]);

  async function saveTopicAndGenerateHooks() {
    if (!project) return;
    setSavingTopic(true);
    setPageError(null);

    try {
      await parseJsonResponse(
        await fetch(`/api/short-form-videos/${project.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ topic, title: topic || project.title }),
        }),
        "Failed to save topic",
      );

      await parseJsonResponse(
        await fetch(`/api/short-form-videos/${project.id}/hooks`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "generate" }),
        }),
        "Failed to start hook generation",
      );

      setTopicDirty(false);
      await refreshProject();
    } catch (err) {
      setPageError(
        err instanceof Error
          ? err.message
          : "Failed to save topic and generate hooks",
      );
    } finally {
      setSavingTopic(false);
    }
  }

  const setSoundDesignPending = useCallback((pending: boolean) => {
    dispatchShortFormProjectOptimisticUpdate({
      projectId,
      soundDesignPending: pending,
    });

    setProject((current) => {
      if (!current) return current;
      const pendingStages = pending
        ? Array.from(new Set([...current.pendingStages, "sound-design" as const]))
        : current.pendingStages.filter((stage) => stage !== "sound-design");

      return {
        ...current,
        pendingStages,
        soundDesign: {
          ...current.soundDesign,
          pending,
        },
      };
    });
  }, [projectId]);

  const detailItems = useMemo(
    () => getDetailRouteItems(projectId, project),
    [project, projectId],
  );
  const currentItem =
    detailItems.find((item) => item.id === activeSection) || detailItems[0];
  const fallbackItem =
    [...detailItems].reverse().find((item) => item.available) || detailItems[0];
  const pageMeta = DETAIL_PAGE_META[activeSection];
  const pageIdentity = getShortFormProjectIdentity(project);
  if (!project && !pageError && !pollingErrorMessage) {
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
      <div className="space-y-4 p-4 sm:p-6 lg:p-8">
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            Project not found
          </h1>
          <p className="mt-2 text-muted-foreground">
            This short-form workflow could not be loaded.
          </p>
        </div>
        {pageError || pollingErrorMessage ? (
          <div className="max-w-xl">
            <ValidationNotice
              title="Workflow load failed"
              message={pageError || pollingErrorMessage || "Unknown error"}
            />
          </div>
        ) : null}
      </div>
    );
  }

  const currentProject = project;
  const preContentPendingNotice =
    activeSection === "plan-sound-design" && currentProject.soundDesign.pending ? (
      <PendingNotice label="Planning sound design" />
    ) : null;

  function renderActiveSection() {
    if (!currentItem.available) {
      return (
        <div className="rounded-2xl border border-dashed border-border/70 bg-background/40 p-6">
          <WorkflowSectionHeader
            title={currentItem.label}
            description={
              currentItem.unlockHint ||
              "Finish the previous step to unlock this page."
            }
            status="blocked"
          />
          <div className="mt-4 flex flex-wrap gap-3">
            <Link
              href={fallbackItem.href}
              className={buttonVariants({ variant: "outline" })}
            >
              Go to current working step
            </Link>
          </div>
        </div>
      );
    }

    switch (activeSection) {
      case "topic":
        return (
          <section className="space-y-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-start">
              <Textarea
                value={topic}
                onChange={(e) => {
                  setTopic(e.target.value);
                  setTopicDirty(true);
                }}
                placeholder="Enter the short-form video topic"
                className="min-h-28 flex-1 resize-y"
              />
              <Button
                onClick={() => void saveTopicAndGenerateHooks()}
                disabled={savingTopic || !topic.trim()}
              >
                {savingTopic
                  ? "Saving…"
                  : currentProject.topic
                    ? "Update topic + refresh hooks"
                    : "Save topic"}
              </Button>
            </div>
            {savingTopic ? (
              <PendingNotice label="Saving topic and starting hook generation" />
            ) : null}
          </section>
        );
      case "hook":
        return (
          <HookSection project={currentProject} refresh={refreshProject} />
        );
      case "research":
        return (
          <StageReviewSection
            projectId={currentProject.id}
            title="Research"
            stage="research"
            description="Oracle researches the topic after a hook is selected. Review, edit, comment, approve, or request changes here."
            doc={currentProject.research}
            mode="markdown"
            emptyText="No research yet. Trigger Oracle once the hook is selected."
            triggerLabel="Generate research"
            triggerDescription="This should create a research deliverable tailored to the selected hook."
            onRefresh={refreshProject}
            simplifiedReviewActions
          />
        );
      case "text-script":
        return (
          <StageReviewSection
            projectId={currentProject.id}
            title="Text Script"
            stage="script"
            description="Scribe writes the approved plain narration script first. This page stays text-only so XML planning remains a separate review step."
            doc={currentProject.script}
            mode="text"
            emptyText="No text script yet. Generate it after approving the research."
            triggerLabel="Generate text script"
            triggerDescription="This should create the plain narration script only. The following pages handle narration audio, captions, and visuals planning."
            onRefresh={refreshProject}
            simplifiedReviewActions
            extra={
              <TextScriptHistoryPanel
                project={currentProject}
                onProjectRefresh={refreshProject}
              />
            }
            showExtraWhenEmpty
          />
        );
      case "generate-narration-audio":
      case "plan-captions":
      case "plan-visuals":
        return (
          <XMLScriptSection
            project={currentProject}
            section={activeSection}
            onProjectRefresh={refreshProject}
          />
        );
      case "generate-visuals":
        return (
          <SceneImagesSection
            project={currentProject}
            refresh={refreshProject}
          />
        );
      case "plan-sound-design":
        return (
          <SoundDesignSection
            project={currentProject}
            refresh={refreshProject}
            mode="plan"
            onSoundDesignPendingChange={setSoundDesignPending}
          />
        );
      case "generate-sound-design":
        return (
          <SoundDesignSection
            project={currentProject}
            refresh={refreshProject}
            mode="generate"
            onSoundDesignPendingChange={setSoundDesignPending}
          />
        );
      case "final-video":
        return (
          <VideoSection project={currentProject} refresh={refreshProject} />
        );
      default:
        return null;
    }
  }

  return (
    <ShortFormSubpageShell
      eyebrow={pageIdentity}
      title={pageMeta.title}
      description={pageMeta.description}
      status={currentItem.status}
      actions={
        <RefreshIconButton
          onClick={() => void refreshActivePage()}
          disabled={refreshing || manualRefreshing}
          refreshing={refreshing || manualRefreshing}
          tooltip="Refresh workflow page"
          refreshingTooltip="Refreshing workflow page…"
          label="Refresh workflow page"
        />
      }
      preContent={
        <>
          {preContentPendingNotice}
          {pageError || pollingErrorMessage ? (
            <ValidationNotice
              title="Workflow sync issue"
              message={pageError || pollingErrorMessage || "Unknown error"}
            />
          ) : null}
        </>
      }
    >
      {renderActiveSection()}
    </ShortFormSubpageShell>
  );
}
