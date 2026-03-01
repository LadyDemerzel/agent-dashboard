'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { StatusBadge } from '@/components/StatusBadge';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

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
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white">🎬 YouTube Videos</h1>
          <p className="text-zinc-400 mt-2">Create and manage faceless YouTube video projects</p>
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
          <div className="text-center py-12 text-zinc-500">Loading...</div>
        ) : videos.length === 0 ? (
          <Card className="p-12 text-center">
            <p className="text-zinc-500">No YouTube videos yet</p>
            <p className="text-zinc-600 text-sm mt-1">Create your first video to get started</p>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {videos.map((video) => (
              <Link
                key={video.id}
                href={`/youtube-videos/${video.id}`}
                className="block"
              >
                <Card className="p-5 hover:border-zinc-700 transition-colors">
                  <div className="flex items-start justify-between mb-3 gap-3">
                    <h3 className="text-white font-medium truncate">{video.title}</h3>
                    <StatusBadge status={video.status} />
                  </div>
                  <p className="text-zinc-500 text-xs truncate">{video.topic}</p>
                  <div className="flex items-center gap-3 mt-3 text-xs text-zinc-600">
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
