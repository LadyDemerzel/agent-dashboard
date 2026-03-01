'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { StatusBadge } from '@/components/StatusBadge';
import { YouTubeWorkflowStageCard } from '@/components/youtube/YouTubeWorkflowStageCard';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DialogOverlay, DialogContent } from '@/components/ui/dialog';
import {
  YOUTUBE_PHASES,
  getYoutubePhaseStatus,
  type VideoArtifacts,
} from '@/lib/youtube-workflow';

interface ImageItem {
  name: string;
  path: string;
  url: string;
  category: string;
  description: string;
}

interface Video {
  id: string;
  title: string;
  topic: string;
  status: string;
  has_research: boolean;
  has_script: boolean;
  has_audio: boolean;
  research_content?: string;
  script_content?: string;
  imageCount: number;
  images?: ImageItem[];
  audioCount: number;
}

interface ParsedMarkdown {
  frontMatter: Record<string, string | string[]>;
  body: string;
}

type WorkflowContentTab = 'research' | 'script' | 'images' | 'audio';

function toArtifacts(video: Video): VideoArtifacts {
  return {
    has_research: video.has_research,
    has_script: video.has_script,
    imageCount: video.imageCount || 0,
    has_audio: video.has_audio,
    status: video.status || 'draft',
  };
}

function prettifyKey(key: string): string {
  return key
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/^./, c => c.toUpperCase());
}

function parseMarkdownWithFrontMatter(content?: string): ParsedMarkdown | null {
  if (!content) return null;

  const frontMatterMatch = content.match(/^---\s*\n([\s\S]*?)\n---\s*\n?([\s\S]*)$/);
  if (!frontMatterMatch) {
    return { frontMatter: {}, body: content };
  }

  const yaml = frontMatterMatch[1];
  const body = frontMatterMatch[2] ?? '';
  const frontMatter: Record<string, string | string[]> = {};

  const lines = yaml.split('\n');
  let currentArrayKey: string | null = null;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;

    if (line.startsWith('- ') && currentArrayKey) {
      const item = line.slice(2).trim().replace(/^['\"]|['\"]$/g, '');
      const existing = frontMatter[currentArrayKey];
      if (Array.isArray(existing)) {
        frontMatter[currentArrayKey] = [...existing, item];
      } else {
        frontMatter[currentArrayKey] = [item];
      }
      continue;
    }

    const match = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if (!match) continue;

    const [, key, rawValue] = match;
    const value = rawValue.trim();

    if (!value) {
      currentArrayKey = key;
      if (!Array.isArray(frontMatter[key])) frontMatter[key] = [];
      continue;
    }

    currentArrayKey = null;

    // Inline array, e.g. tags: [foo, bar]
    const inlineArray = value.match(/^\[(.*)\]$/);
    if (inlineArray) {
      const items = inlineArray[1]
        .split(',')
        .map(v => v.trim())
        .filter(Boolean)
        .map(v => v.replace(/^['\"]|['\"]$/g, ''));
      frontMatter[key] = items;
      continue;
    }

    frontMatter[key] = value.replace(/^['\"]|['\"]$/g, '');
  }

  return { frontMatter, body };
}

function FrontMatterCard({ frontMatter }: { frontMatter: Record<string, string | string[]> }) {
  const entries = Object.entries(frontMatter);
  if (entries.length === 0) return null;

  return (
    <div className="mb-3 space-y-1.5">
      {entries.map(([key, value]) => (
        <div
          key={key}
          className="flex items-baseline gap-3 border-b border-zinc-800/60 pb-2"
        >
          <span className="min-w-28 text-xs text-zinc-500 shrink-0 whitespace-nowrap">
            {prettifyKey(key)}
          </span>
          {Array.isArray(value) ? (
            value.length === 0 ? (
              <span className="text-sm text-zinc-400">—</span>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {value.map((item, idx) => (
                  <span key={`${key}-${idx}`} className="text-xs px-2 py-1 rounded-full bg-zinc-700 text-zinc-200">
                    {item}
                  </span>
                ))}
              </div>
            )
          ) : (
            <span className="text-sm text-zinc-200 break-words">{value || '—'}</span>
          )}
        </div>
      ))}
    </div>
  );
}

function MarkdownPreview({ content, emptyText }: { content?: string; emptyText: string }) {
  const parsed = useMemo(() => parseMarkdownWithFrontMatter(content), [content]);

  if (!content || !parsed) {
    return <div className="text-zinc-600">{emptyText}</div>;
  }

  const hasFrontMatter = Object.keys(parsed.frontMatter).length > 0;

  return (
    <div>
      {hasFrontMatter && <FrontMatterCard frontMatter={parsed.frontMatter} />}
      {parsed.body.trim() && (
        <div className="rounded-lg border border-zinc-800 bg-zinc-950/40 p-4 max-h-[28rem] overflow-y-auto">
          <article className="prose prose-sm prose-invert prose-zinc !max-w-none w-full">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{parsed.body}</ReactMarkdown>
          </article>
        </div>
      )}
    </div>
  );
}

export default function YouTubeVideoDetailPage() {
  const [id, setId] = useState('');
  const [video, setVideo] = useState<Video | null>(null);
  const [loading, setLoading] = useState(true);
  const [triggering, setTriggering] = useState<string | null>(null);
  const [selectedImage, setSelectedImage] = useState<ImageItem | null>(null);
  const [activeTab, setActiveTab] = useState<WorkflowContentTab>('research');

  useEffect(() => {
    const pathId = window.location.pathname.split('/').filter(Boolean).pop() || '';
    setId(pathId);

    if (pathId) {
      fetchVideo(pathId);
    } else {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setSelectedImage(null);
      }
    };

    window.addEventListener('keydown', onEscape);
    return () => window.removeEventListener('keydown', onEscape);
  }, []);

  useEffect(() => {
    if (!video) return;

    if (!video.has_research) {
      setActiveTab('research');
      return;
    }

    if (!video.has_script) {
      setActiveTab('script');
      return;
    }

    if ((video.imageCount || 0) === 0) {
      setActiveTab('images');
      return;
    }

    if (!video.has_audio) {
      setActiveTab('audio');
    }
  }, [video]);

  async function fetchVideo(videoId: string = id) {
    try {
      const res = await fetch(`/api/youtube/${videoId}`);
      const data = await res.json();
      if (data.success) {
        setVideo(data.data);
      }
    } catch (err) {
      console.error('Failed to fetch video:', err);
    } finally {
      setLoading(false);
    }
  }

  async function triggerPhase(phase: string) {
    setTriggering(phase);
    try {
      const res = await fetch(`/api/youtube/${id}/${phase}`, { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        alert(`${phase} task started!`);
        setTimeout(fetchVideo, 2000);
      } else {
        alert(data.error);
      }
    } catch (err) {
      console.error('Failed to trigger phase:', err);
    } finally {
      setTriggering(null);
    }
  }

  if (loading) {
    return (
      <div className="p-4 sm:p-6 lg:p-8">
        <div className="max-w-6xl mx-auto text-zinc-500">Loading...</div>
      </div>
    );
  }

  if (!video) {
    return (
      <div className="p-4 sm:p-6 lg:p-8">
        <div className="max-w-6xl mx-auto">
          <Link href="/youtube-videos" className="text-zinc-400 hover:text-white">← Back to Videos</Link>
          <div className="mt-8 text-center text-zinc-500">Video not found</div>
        </div>
      </div>
    );
  }

  const artifacts = toArtifacts(video);

  const TABS = [
    { key: 'research' as const, label: '🔍 Research', complete: video.has_research },
    { key: 'script' as const, label: '📜 Script', complete: video.has_script },
    { key: 'images' as const, label: '🖼️ Images', complete: (video.imageCount || 0) > 0 },
    { key: 'audio' as const, label: '🎙️ Audio', complete: video.has_audio },
  ];

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="max-w-6xl mx-auto">
        <Link href="/youtube-videos" className="text-zinc-400 hover:text-white text-sm">← Back to Videos</Link>

        {/* Header */}
        <div className="mt-4 mb-8">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-white">{video.title}</h1>
              <p className="text-zinc-400 mt-1">{video.topic}</p>
            </div>
            <StatusBadge status={video.status} />
          </div>
        </div>

        {/* Workflow Steps */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
          {YOUTUBE_PHASES.map((phase) => (
            <YouTubeWorkflowStageCard
              key={phase.key}
              phase={phase}
              status={getYoutubePhaseStatus(phase.key, artifacts)}
              triggering={triggering === phase.key}
              anyTriggering={triggering !== null}
              onTrigger={() => triggerPhase(phase.key)}
            />
          ))}
        </div>

        {/* Research / Script / Images / Audio Tabs */}
        <div className="mb-6">
          <TabsList className="mb-4">
            {TABS.map((tab) => (
              <TabsTrigger
                key={tab.key}
                active={activeTab === tab.key}
                onClick={() => setActiveTab(tab.key)}
              >
                <span>{tab.label}</span>
                {tab.complete && <span className="ml-2 text-emerald-500">✓</span>}
              </TabsTrigger>
            ))}
          </TabsList>

          {activeTab === 'research' && (
            <Card className="p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-white">🔍 Research</h2>
                {video.has_research && <span className="text-emerald-400 text-sm">✓ Complete</span>}
              </div>
              <MarkdownPreview
                content={video.research_content}
                emptyText="No research yet. Click Start above to begin."
              />
            </Card>
          )}

          {activeTab === 'script' && (
            <Card className="p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-white">📜 Script</h2>
                {video.has_script && <span className="text-emerald-400 text-sm">✓ Complete</span>}
              </div>
              <MarkdownPreview
                content={video.script_content}
                emptyText="Script will appear here after research is approved."
              />
            </Card>
          )}

          {activeTab === 'images' && (
            <Card className="p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-white">🖼️ Images</h2>
                <span className="text-zinc-500 text-sm">{video.imageCount} images</span>
              </div>

              {video.images && video.images.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {video.images.map((image) => (
                    <button
                      type="button"
                      key={image.path}
                      onClick={() => setSelectedImage(image)}
                      className="text-left bg-zinc-950/40 border border-zinc-800 rounded-lg overflow-hidden hover:border-zinc-600 transition-colors"
                    >
                      <img
                        src={image.url}
                        alt={image.description}
                        loading="lazy"
                        className="w-full h-36 object-cover bg-zinc-900"
                      />
                      <div className="p-3">
                        <p className="text-xs text-zinc-500 mb-1">{image.category}</p>
                        <p className="text-sm text-zinc-300 line-clamp-3">{image.description}</p>
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="text-zinc-600">Images will appear here after script is approved.</div>
              )}
            </Card>
          )}

          {activeTab === 'audio' && (
            <Card className="p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-white">🎙️ Audio</h2>
                {video.has_audio && <span className="text-emerald-400 text-sm">✓ Complete</span>}
              </div>
              {video.has_audio ? (
                <div className="text-emerald-400">{video.audioCount} audio file{video.audioCount !== 1 ? 's' : ''} generated</div>
              ) : (
                <div className="text-zinc-600">Audio will appear here after images are collected.</div>
              )}
            </Card>
          )}
        </div>
      </div>

      {/* Image Lightbox */}
      <DialogOverlay open={!!selectedImage}>
        <DialogContent size="lg" className="max-w-6xl bg-transparent border-none shadow-none">
          {selectedImage && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="text-xs uppercase tracking-wide text-zinc-400">{selectedImage.category}</p>
                  <p className="text-sm text-zinc-200">{selectedImage.description}</p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedImage(null)}
                >
                  Close
                </Button>
              </div>
              <img
                src={selectedImage.url}
                alt={selectedImage.description}
                className="w-full max-h-[80vh] object-contain rounded-lg border border-zinc-700 bg-zinc-950"
              />
            </div>
          )}
        </DialogContent>
      </DialogOverlay>
    </div>
  );
}
