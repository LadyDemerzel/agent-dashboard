'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { Button, buttonVariants } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { OrbitLoader, Skeleton } from '@/components/ui/loading';
import { StatusBadge } from '@/components/StatusBadge';
import {
  normalizeShortFormProjectRow,
  type ShortFormProjectRowClient as ProjectRow,
} from '@/lib/short-form-video-client';

function stageLabel(project: ProjectRow) {
  if (project.video.videoUrl) return 'Video';
  if (project.sceneImages.sceneCount > 0) return 'Scene Images';
  if (project.script.status !== 'draft') return 'Script';
  if (project.research.status !== 'draft') return 'Research';
  if (project.hooks.selectedHookText) return 'Hook selected';
  return 'Topic';
}

export default function ShortFormVideoPage() {
  const router = useRouter();
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [topic, setTopic] = useState('');

  useEffect(() => {
    fetchProjects();
  }, []);

  async function fetchProjects() {
    try {
      const res = await fetch('/api/short-form-videos');
      const data = await res.json();
      if (data.success) {
        setProjects(Array.isArray(data.data) ? data.data.map(normalizeShortFormProjectRow) : []);
      }
    } finally {
      setLoading(false);
    }
  }

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
        router.push(`/short-form-video/${data.data.id}`);
      }
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Short-Form Video</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Create and review hook, research, script, scene image, and final video projects.
          </p>
        </div>
        <Link href="/short-form-video/settings" className={buttonVariants({ variant: 'outline' })}>
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

      <Card className="overflow-hidden">
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
              </TableRow>
            </TableHeader>
            <TableBody>
              {projects.map((project) => (
                <TableRow key={project.id}>
                  <TableCell>
                    <Link href={`/short-form-video/${project.id}`} className="block hover:underline">
                      <div className="font-medium text-foreground">{project.title || 'Untitled short-form video'}</div>
                      <div className="text-xs text-muted-foreground mt-1">{project.topic || project.id}</div>
                    </Link>
                  </TableCell>
                  <TableCell>{stageLabel(project)}</TableCell>
                  <TableCell>
                    <StatusBadge status={project.video.videoUrl ? project.video.status : project.sceneImages.sceneCount > 0 ? project.sceneImages.status : project.script.status !== 'draft' ? project.script.status : project.research.status} />
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{new Date(project.updatedAt).toLocaleString()}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  );
}
