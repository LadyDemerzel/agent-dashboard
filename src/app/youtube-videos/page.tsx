'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { StatusBadge } from '@/components/StatusBadge';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { OrbitLoader, Skeleton } from '@/components/ui/loading';

interface Video {
  id: string;
  title: string;
  topic: string;
  status: string;
  created_at: string;
  imageCount: number;
}

export default function YouTubeVideosPage() {
  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);
  const [newTopic, setNewTopic] = useState('');
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    fetchVideos();
  }, []);

  async function fetchVideos() {
    try {
      const res = await fetch('/api/youtube');
      const data = await res.json();
      if (data.success) {
        setVideos(data.data);
      }
    } catch (err) {
      console.error('Failed to fetch videos:', err);
    } finally {
      setLoading(false);
    }
  }

  async function createVideo(e: React.FormEvent) {
    e.preventDefault();
    if (!newTopic.trim()) return;

    setCreating(true);
    try {
      const res = await fetch('/api/youtube', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic: newTopic })
      });
      const data = await res.json();
      if (data.success) {
        setNewTopic('');
        fetchVideos();
      } else {
        alert(data.error);
      }
    } catch (err) {
      console.error('Failed to create video:', err);
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div>
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-foreground">YouTube Videos</h1>
          <p className="text-muted-foreground text-sm mt-1">Create and manage faceless YouTube video projects</p>
        </div>

        {/* Create Form */}
        <form onSubmit={createVideo} className="mb-8">
          <div className="flex gap-3">
            <Input
              type="text"
              value={newTopic}
              onChange={(e) => setNewTopic(e.target.value)}
              placeholder="Enter video topic (e.g., 'The History of Rome')"
              className="flex-1 px-4 py-3"
            />
            <Button
              type="submit"
              disabled={creating || !newTopic.trim()}
              className="whitespace-nowrap"
            >
              {creating ? 'Creating...' : '+ New Video'}
            </Button>
          </div>
        </form>

        {/* Video Grid */}
        {loading ? (
          <div className="space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {Array.from({ length: 6 }).map((_, idx) => (
                <Card key={idx} className="p-5 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <Skeleton className="h-4 w-3/5" />
                    <Skeleton className="h-5 w-16 rounded-full" />
                  </div>
                  <Skeleton className="h-3 w-4/5" />
                  <div className="flex items-center gap-2 pt-1">
                    <Skeleton className="h-3 w-16" />
                    <Skeleton className="h-3 w-3" />
                    <Skeleton className="h-3 w-20" />
                  </div>
                </Card>
              ))}
            </div>
            <OrbitLoader label="Syncing video projects" />
          </div>
        ) : videos.length === 0 ? (
          <Card className="p-12 text-center">
            <p className="text-muted-foreground">No YouTube videos yet</p>
            <p className="text-muted-foreground text-sm mt-1">Create your first video to get started</p>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {videos.map((video) => (
              <Link
                key={video.id}
                href={`/youtube-videos/${video.id}`}
                className="block"
              >
                <Card className="p-5 cursor-pointer transition-all duration-200 hover:border-ring/70 hover:bg-muted/80">
                  <div className="flex items-start justify-between mb-3 gap-3">
                    <h3 className="text-foreground font-medium truncate">{video.title}</h3>
                    <StatusBadge status={video.status} />
                  </div>
                  <p className="text-muted-foreground text-xs truncate">{video.topic}</p>
                  <div className="flex items-center gap-3 mt-3 text-xs text-muted-foreground">
                    <span>{video.imageCount} images</span>
                    <span>•</span>
                    <span>{new Date(video.created_at).toLocaleDateString()}</span>
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
