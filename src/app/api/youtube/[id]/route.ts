import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const HOME_DIR = process.env.HOME || '/Users/ittaisvidler';
const VIDEOS_DIR = path.join(HOME_DIR, 'tenxsolo/business/content/deliverables/youtube-videos');

interface ImageArtifact {
  name: string;
  path: string;
  url: string;
  category: string;
  description: string;
}

function getVideoData(videoDir: string): Record<string, string> | null {
  const yamlPath = path.join(videoDir, 'video.yaml');
  if (!fs.existsSync(yamlPath)) return null;

  const content = fs.readFileSync(yamlPath, 'utf-8');
  const data: Record<string, string> = {};

  content.split('\n').forEach(line => {
    const match = line.match(/^(\w+):\s*(.*)$/);
    if (match) {
      data[match[1]] = match[2];
    }
  });

  return data;
}

function prettify(text: string): string {
  return text
    .replace(/\.[^.]+$/, '')
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function buildImageDescription(relativePath: string): string {
  const parsed = path.parse(relativePath);
  const parts = parsed.dir.split(path.sep).filter(Boolean);
  const category = parts.length > 0 ? prettify(parts[parts.length - 1]) : 'General';
  const filename = prettify(parsed.name);

  const sourcePrefix = parsed.name.split('-')[0]?.toLowerCase();
  if (sourcePrefix === 'unsplash') {
    return `Unsplash ${category.toLowerCase()} reference (${filename})`;
  }
  if (sourcePrefix === 'pexels') {
    return `Pexels ${category.toLowerCase()} reference (${filename})`;
  }
  if (sourcePrefix === 'loc') {
    return `Locally sourced ${category.toLowerCase()} reference (${filename})`;
  }

  return `${category} visual reference (${filename})`;
}

function collectImages(videoId: string, videoDir: string): ImageArtifact[] {
  const imagesDir = path.join(videoDir, 'images');
  if (!fs.existsSync(imagesDir)) return [];

  const allowed = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif']);
  const artifacts: ImageArtifact[] = [];

  function walk(currentDir: string) {
    const entries = fs.readdirSync(currentDir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
        continue;
      }

      const ext = path.extname(entry.name).toLowerCase();
      if (!allowed.has(ext)) continue;

      const relativePath = path.relative(imagesDir, fullPath);
      const normalizedPath = relativePath.split(path.sep).join('/');
      const category = prettify(path.dirname(relativePath) === '.' ? 'General' : path.dirname(relativePath).split(path.sep).pop() || 'General');

      artifacts.push({
        name: entry.name,
        path: normalizedPath,
        url: `/api/youtube/${videoId}/images/${normalizedPath}`,
        category,
        description: buildImageDescription(relativePath),
      });
    }
  }

  walk(imagesDir);

  artifacts.sort((a, b) => a.path.localeCompare(b.path));
  return artifacts;
}

// GET /api/youtube/[id] - Get video details
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const videoDir = path.join(VIDEOS_DIR, id);

    if (!fs.existsSync(videoDir)) {
      return NextResponse.json({ success: false, error: 'Video not found' }, { status: 404 });
    }

    const data = getVideoData(videoDir);

    // Read files
    const researchPath = path.join(videoDir, 'research.md');
    const scriptPath = path.join(videoDir, 'script.md');

    const images = collectImages(id, videoDir);

    const video: Record<string, unknown> = {
      id,
      title: id,
      topic: '',
      status: 'draft',
      ...data,
      imageCount: images.length,
      images,
      audioCount: 0,
      has_research: fs.existsSync(researchPath),
      has_script: fs.existsSync(scriptPath),
    };

    if (fs.existsSync(researchPath)) {
      video.research_content = fs.readFileSync(researchPath, 'utf-8');
    }

    if (fs.existsSync(scriptPath)) {
      video.script_content = fs.readFileSync(scriptPath, 'utf-8');
    }

    // Check audio artifacts
    const audioDir = path.join(videoDir, 'audio');
    if (fs.existsSync(audioDir)) {
      const audioFiles = fs.readdirSync(audioDir).filter(f =>
        f.endsWith('.mp3') || f.endsWith('.wav') || f.endsWith('.m4a')
      );
      video.has_audio = audioFiles.length > 0;
      video.audioCount = audioFiles.length;
    } else {
      video.has_audio = false;
      video.audioCount = 0;
    }

    return NextResponse.json({ success: true, data: video });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
