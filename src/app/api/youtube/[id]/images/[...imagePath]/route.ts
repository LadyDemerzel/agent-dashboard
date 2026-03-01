import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const HOME_DIR = process.env.HOME || '/Users/ittaisvidler';
const VIDEOS_DIR = path.join(HOME_DIR, 'tenxsolo/business/content/deliverables/youtube-videos');

const CONTENT_TYPES: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
};

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string; imagePath: string[] }> }
) {
  try {
    const { id, imagePath } = await params;

    if (!imagePath || imagePath.length === 0) {
      return NextResponse.json({ success: false, error: 'Missing image path' }, { status: 400 });
    }

    const videoDir = path.join(VIDEOS_DIR, id);
    const imagesDir = path.join(videoDir, 'images');

    if (!fs.existsSync(imagesDir)) {
      return NextResponse.json({ success: false, error: 'Images directory not found' }, { status: 404 });
    }

    const requestedRelative = imagePath.join('/');
    const requestedPath = path.resolve(imagesDir, requestedRelative);
    const basePath = path.resolve(imagesDir);

    // Prevent path traversal
    if (!requestedPath.startsWith(basePath + path.sep) && requestedPath !== basePath) {
      return NextResponse.json({ success: false, error: 'Invalid image path' }, { status: 400 });
    }

    if (!fs.existsSync(requestedPath) || !fs.statSync(requestedPath).isFile()) {
      return NextResponse.json({ success: false, error: 'Image not found' }, { status: 404 });
    }

    const ext = path.extname(requestedPath).toLowerCase();
    const contentType = CONTENT_TYPES[ext];

    if (!contentType) {
      return NextResponse.json({ success: false, error: 'Unsupported image type' }, { status: 400 });
    }

    const fileBuffer = fs.readFileSync(requestedPath);

    return new NextResponse(fileBuffer, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=3600',
      },
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
