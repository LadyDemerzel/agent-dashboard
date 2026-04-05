import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { Readable } from "stream";
import { getProjectDir } from "@/lib/short-form-videos";

export const dynamic = "force-dynamic";

const CONTENT_TYPES: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".mp4": "video/mp4",
  ".mov": "video/quicktime",
  ".webm": "video/webm",
};

function isSafeProjectPath(projectDir: string, absolutePath: string) {
  return absolutePath === projectDir || absolutePath.startsWith(`${projectDir}${path.sep}`);
}

function parseRangeHeader(rangeHeader: string, fileSize: number) {
  const match = /^bytes=(\d*)-(\d*)$/i.exec(rangeHeader.trim());
  if (!match) return null;

  const [, startText, endText] = match;

  if (!startText && !endText) return null;

  let start: number;
  let end: number;

  if (!startText) {
    const suffixLength = Number.parseInt(endText, 10);
    if (!Number.isFinite(suffixLength) || suffixLength <= 0) return null;
    start = Math.max(fileSize - suffixLength, 0);
    end = fileSize - 1;
  } else {
    start = Number.parseInt(startText, 10);
    if (!Number.isFinite(start) || start < 0) return null;
    end = endText ? Number.parseInt(endText, 10) : fileSize - 1;
    if (!Number.isFinite(end)) return null;
  }

  if (start >= fileSize) {
    return { unsatisfiable: true as const };
  }

  end = Math.min(end, fileSize - 1);

  if (end < start) {
    return { unsatisfiable: true as const };
  }

  return { start, end, unsatisfiable: false as const };
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; filePath: string[] }> }
) {
  const { id, filePath } = await params;
  const relativePath = filePath.join("/");
  const projectDir = path.resolve(getProjectDir(id));
  const absolutePath = path.resolve(projectDir, relativePath);

  if (!isSafeProjectPath(projectDir, absolutePath)) {
    return NextResponse.json({ error: "Invalid path" }, { status: 400 });
  }

  if (!fs.existsSync(absolutePath)) {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }

  const stat = await fs.promises.stat(absolutePath);
  if (!stat.isFile()) {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }

  const ext = path.extname(absolutePath).toLowerCase();
  const contentType = CONTENT_TYPES[ext] || "application/octet-stream";
  const baseHeaders = new Headers({
    "Accept-Ranges": "bytes",
    "Cache-Control": "no-cache",
    "Content-Type": contentType,
  });

  const rangeHeader = request.headers.get("range");
  if (rangeHeader) {
    const parsedRange = parseRangeHeader(rangeHeader, stat.size);

    if (!parsedRange || parsedRange.unsatisfiable) {
      return new NextResponse(null, {
        status: 416,
        headers: new Headers({
          ...Object.fromEntries(baseHeaders.entries()),
          "Content-Range": `bytes */${stat.size}`,
        }),
      });
    }

    const { start, end } = parsedRange;
    const chunkSize = end - start + 1;
    const stream = fs.createReadStream(absolutePath, { start, end });

    return new NextResponse(Readable.toWeb(stream) as unknown as ReadableStream, {
      status: 206,
      headers: new Headers({
        ...Object.fromEntries(baseHeaders.entries()),
        "Content-Length": String(chunkSize),
        "Content-Range": `bytes ${start}-${end}/${stat.size}`,
      }),
    });
  }

  const stream = fs.createReadStream(absolutePath);

  return new NextResponse(Readable.toWeb(stream) as unknown as ReadableStream, {
    headers: new Headers({
      ...Object.fromEntries(baseHeaders.entries()),
      "Content-Length": String(stat.size),
    }),
  });
}
