'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import useSWR from 'swr';
import Link from 'next/link';
import { MoreVertical } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button, buttonVariants } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { OrbitLoader, Skeleton } from '@/components/ui/loading';
import { StatusBadge } from '@/components/StatusBadge';
import {
  normalizeShortFormProjectRow,
  type ShortFormProjectRowClient as ProjectRow,
} from '@/lib/short-form-video-client';
import { apiEnvelopeFetcher, realtimeSWRConfig } from '@/lib/swr-fetcher';

const CURRENT_STAGE_LABELS: Record<string, string> = {
  topic: 'Topic',
  hook: 'Hook selected',
  research: 'Research',
  script: 'Script',
  'scene-images': 'Generate Visuals',
  'sound-design': 'Plan Sound Design',
  video: 'Final Video',
};

function xmlWorkflowStageLabel(project: ProjectRow) {
  const pipelineSteps = project.xmlScript.pipeline?.steps || [];
  const visualsStep = pipelineSteps.find((step) => step.id === 'xml');
  const visualsStarted =
    Boolean(visualsStep && visualsStep.status !== 'pending') ||
    Boolean(project.xmlScript.status && project.xmlScript.status !== 'draft');
  const narrationSteps = pipelineSteps.filter(
    (step) => step.id === 'narration' || step.id === 'silence-removal' || step.id === 'alignment',
  );
  const narrationComplete =
    Boolean(project.xmlScript.audioUrl) ||
    (narrationSteps.length > 0 && narrationSteps.every((step) => step.status === 'completed'));
  const captionsStep = pipelineSteps.find((step) => step.id === 'captions');
  const captionsComplete =
    (project.xmlScript.captionsCount || 0) > 0 ||
    captionsStep?.status === 'completed';

  if (visualsStarted) return 'Plan Visuals';
  if (!narrationComplete) return 'Generate Narration Audio';
  if (!captionsComplete) return 'Plan Captions';
  return 'Plan Visuals';
}

function stageLabel(project: ProjectRow) {
  if (project.video.pending) return 'Final Video';
  if (project.soundDesign.pending) {
    return project.soundDesign.eventCount > 0 ? 'Generate Sound Design' : 'Plan Sound Design';
  }
  if (project.currentStage === 'sound-design') {
    return project.soundDesign.eventCount > 0 ? 'Generate Sound Design' : 'Plan Sound Design';
  }
  if (project.currentStage === 'xml-script') return xmlWorkflowStageLabel(project);
  return CURRENT_STAGE_LABELS[project.currentStage] || 'Topic';
}

function primaryProjectText(project: ProjectRow) {
  return project.hooks.selectedHookText || project.topic || project.title || 'Untitled short-form video';
}

function secondaryProjectText(project: ProjectRow) {
  return project.hooks.selectedHookText ? project.topic || undefined : undefined;
}

function tableStatus(project: ProjectRow) {
  if (project.video.pending) return 'working';
  if (project.soundDesign.pending) return 'working';
  if (project.sceneImages.pending) return 'working';
  if (project.xmlScript.pending) return 'working';
  if (project.script.pending) return 'working';
  if (project.research.pending) return 'working';
  if (project.hooks.pending) return 'working';

  switch (project.currentStage) {
    case 'video':
      return project.video.status;
    case 'sound-design':
      return project.soundDesign.status;
    case 'scene-images':
      return project.sceneImages.status;
    case 'xml-script':
      return project.xmlScript.status;
    case 'script':
      return project.script.status;
    case 'research':
      return project.research.status;
    case 'hook':
      return project.hooks.selectedHookText ? 'approved' : 'draft';
    default:
      return 'draft';
  }
}

function ProjectActionsMenu({
  project,
  isDuplicating,
  onDuplicate,
}: {
  project: ProjectRow;
  isDuplicating: boolean;
  onDuplicate: (project: ProjectRow) => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label={isDuplicating ? `Duplicating ${primaryProjectText(project)}` : `Open actions for ${primaryProjectText(project)}`}
          aria-busy={isDuplicating}
          disabled={isDuplicating}
          className="h-8 w-8 rounded-full bg-transparent p-0 shadow-none hover:border hover:border-border hover:bg-accent focus-visible:ring-1"
        >
          <MoreVertical aria-hidden="true" className={`h-4 w-4 ${isDuplicating ? 'animate-pulse' : ''}`} />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-44">
        <DropdownMenuItem
          disabled={isDuplicating}
          onSelect={() => onDuplicate(project)}
        >
          Duplicate video
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export default function ShortFormVideoPage() {
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [duplicatingProjectId, setDuplicatingProjectId] = useState<string | null>(null);
  const [duplicateError, setDuplicateError] = useState<string | null>(null);
  const [topic, setTopic] = useState('');
  const {
    data: projectsPayload,
    isLoading: loading,
    mutate: refreshProjects,
  } = useSWR('/api/short-form-videos', apiEnvelopeFetcher<ProjectRow[]>, {
    ...realtimeSWRConfig,
    refreshInterval: 5000,
  });
  const projects = Array.isArray(projectsPayload?.data)
    ? projectsPayload.data.map(normalizeShortFormProjectRow)
    : [];

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    try {
      const res = await fetch('/api/short-form-videos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic }),
      });
      const data = await res.json();
      if (data.success && data.data?.id) {
        await refreshProjects();
        router.push(`/short-form-video/${data.data.id}/topic`);
      }
    } finally {
      setCreating(false);
    }
  }

  async function handleDuplicate(project: ProjectRow) {
    setDuplicatingProjectId(project.id);
    setDuplicateError(null);
    try {
      const res = await fetch(`/api/short-form-videos/${project.id}/duplicate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: `${project.title || project.topic || 'Untitled short-form video'} copy`,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success || !data.data?.id) {
        throw new Error(data.error || 'Failed to duplicate video');
      }

      await refreshProjects();
      router.push(`/short-form-video/${data.data.id}/topic`);
    } catch (error) {
      setDuplicateError(error instanceof Error ? error.message : 'Failed to duplicate video');
    } finally {
      setDuplicatingProjectId(null);
    }
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Short-Form Video</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Create and review hook, research, script, narration audio, captions, visuals, sound design, and final video projects.
          </p>
        </div>
        <Link href="/short-form-video/settings/prompts" className={buttonVariants({ variant: 'outline' })}>
          Settings
        </Link>
      </div>

      <Card className="p-5">
        <form onSubmit={handleCreate} className="flex flex-col gap-3 md:flex-row">
          <Input
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="Optional topic for the new short-form video project"
            className="flex-1"
          />
          <Button type="submit" disabled={creating}>
            {creating ? 'Creating…' : 'New short-form video'}
          </Button>
        </form>
      </Card>

      <Card className="overflow-visible">
        {duplicateError ? (
          <div className="border-b border-border bg-destructive/10 px-5 py-3 text-sm text-destructive">
            {duplicateError}
          </div>
        ) : null}
        {loading ? (
          <div className="p-5 space-y-4">
            {Array.from({ length: 5 }).map((_, idx) => (
              <Skeleton key={idx} className="h-12 w-full" />
            ))}
            <OrbitLoader label="Loading short-form video projects" />
          </div>
        ) : projects.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-muted-foreground">No short-form video projects yet.</p>
            <p className="text-sm text-muted-foreground mt-1">Create one to start the end-to-end workflow.</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Project</TableHead>
                <TableHead>Current stage</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Updated</TableHead>
                <TableHead className="w-12 text-right">
                  <span className="sr-only">Actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {projects.map((project) => (
                <TableRow key={project.id}>
                  <TableCell>
                    <Link href={`/short-form-video/${project.id}/topic`} className="block hover:underline">
                      <div className="font-medium text-foreground">{primaryProjectText(project)}</div>
                      {secondaryProjectText(project) ? (
                        <div className="mt-1 text-xs text-muted-foreground">{secondaryProjectText(project)}</div>
                      ) : null}
                    </Link>
                  </TableCell>
                  <TableCell>{stageLabel(project)}</TableCell>
                  <TableCell>
                    <StatusBadge status={tableStatus(project)} />
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{new Date(project.updatedAt).toLocaleString()}</TableCell>
                  <TableCell className="text-right align-middle">
                    <ProjectActionsMenu
                      project={project}
                      isDuplicating={duplicatingProjectId === project.id}
                      onDuplicate={(projectToDuplicate) => void handleDuplicate(projectToDuplicate)}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  );
}
