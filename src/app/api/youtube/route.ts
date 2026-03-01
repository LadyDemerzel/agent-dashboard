import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';

const VIDEOS_DIR = path.join(process.env.HOME || '/Users/ittaisvidler', 'tenxsolo/business/content/deliverables/youtube-videos');

// Ensure videos directory exists
if (!fs.existsSync(VIDEOS_DIR)) {
  fs.mkdirSync(VIDEOS_DIR, { recursive: true });
}

function slugify(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

function getVideoData(videoDir: string): Record<string, any> | null {
  const yamlPath = path.join(videoDir, 'video.yaml');
  if (!fs.existsSync(yamlPath)) return null;
  
  const content = fs.readFileSync(yamlPath, 'utf-8');
  const data: Record<string, any> = {};
  
  content.split('\n').forEach(line => {
    const match = line.match(/^(\w+):\s*(.*)$/);
    if (match) {
      data[match[1]] = match[2];
    }
  });
  
  return data;
}

function saveVideoData(videoDir: string, data: Record<string, any>) {
  const yamlPath = path.join(videoDir, 'video.yaml');
  let content = '';
  
  for (const [key, value] of Object.entries(data)) {
    if (Array.isArray(value)) {
      content += `${key}: ${value.join(', ')}\n`;
    } else {
      content += `${key}: ${value}\n`;
    }
  }
  
  fs.writeFileSync(yamlPath, content);
}

// GET /api/youtube - List all videos
export async function GET() {
  try {
    const videos: Array<{ id: string; created_at?: string; [key: string]: any }> = [];
    
    if (fs.existsSync(VIDEOS_DIR)) {
      const dirs = fs.readdirSync(VIDEOS_DIR).filter(f => {
        return fs.statSync(path.join(VIDEOS_DIR, f)).isDirectory();
      });
      
      for (const dir of dirs) {
        const data = getVideoData(path.join(VIDEOS_DIR, dir));
        if (data) {
          // Count images
          const imagesDir = path.join(VIDEOS_DIR, dir, 'images');
          let imageCount = 0;
          if (fs.existsSync(imagesDir)) {
            imageCount = fs.readdirSync(imagesDir).filter(f => 
              f.endsWith('.jpg') || f.endsWith('.png') || f.endsWith('.webp')
            ).length;
          }
          
          videos.push({
            id: dir,
            title: dir,
            topic: '',
            status: 'draft',
            created_at: '',
            ...data,
            imageCount,
          });
        }
      }
    }
    
    videos.sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());
    
    return NextResponse.json({ success: true, data: videos });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// POST /api/youtube - Create new video
export async function POST(request: Request) {
  try {
    const { topic, title } = await request.json();
    
    if (!topic) {
      return NextResponse.json({ success: false, error: 'Topic is required' }, { status: 400 });
    }
    
    const slug = slugify(topic);
    const videoDir = path.join(VIDEOS_DIR, slug);
    
    if (fs.existsSync(videoDir)) {
      return NextResponse.json({ success: false, error: 'Video project already exists' }, { status: 400 });
    }
    
    fs.mkdirSync(videoDir, { recursive: true });
    fs.mkdirSync(path.join(videoDir, 'images'), { recursive: true });
    fs.mkdirSync(path.join(videoDir, 'audio'), { recursive: true });
    
    const now = new Date().toISOString();
    const dateStr = now.split('T')[0];
    
    const videoData = {
      title: title || topic,
      topic: topic,
      status: 'draft',
      created_at: now,
      research_deliverable_id: `youtube-research-${slug}-${dateStr}`,
      script_deliverable_id: `youtube-script-${slug}-${dateStr}`,
      images: ''
    };
    
    saveVideoData(videoDir, videoData);
    
    return NextResponse.json({ success: true, data: { id: slug, ...videoData } });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
