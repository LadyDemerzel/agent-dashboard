import fs from "fs";
import path from "path";
import { Readable } from "stream";
import { NextRequest, NextResponse } from "next/server";
import { getShortFormMusicLibraryDir } from "@/lib/short-form-video-render-settings";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function resolveSafePath(parts: string[]) {
  const baseDir = path.resolve(getShortFormMusicLibraryDir());
  const resolvedPath = path.resolve(baseDir, ...parts);
  if (resolvedPath !== baseDir && !resolvedPath.startsWith(`${baseDir}${path.sep}`)) {
    throw new Error("Invalid music library path");
  }
  return resolvedPath;
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
  { params }: { params: Promise<{ filePath: string[] }> }
) {
  const { filePath } = await params;

  try {
    const resolvedPath = resolveSafePath(filePath || []);
    if (!fs.existsSync(resolvedPath)) {
      return NextResponse.json({ success: false, error: "Saved soundtrack file not found" }, { status: 404 });
    }

    const stat = await fs.promises.stat(resolvedPath);
    if (!stat.isFile()) {
      return NextResponse.json({ success: false, error: "Saved soundtrack file not found" }, { status: 404 });
    }

    const contentType = resolvedPath.endsWith(".mp3") ? "audio/mpeg" : "audio/wav";
    const baseHeaders = new Headers({
      "Accept-Ranges": "bytes",
      "Cache-Control": "no-store",
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
      const stream = fs.createReadStream(resolvedPath, { start, end });

      return new NextResponse(Readable.toWeb(stream) as unknown as ReadableStream, {
        status: 206,
        headers: new Headers({
          ...Object.fromEntries(baseHeaders.entries()),
          "Content-Length": String(chunkSize),
          "Content-Range": `bytes ${start}-${end}/${stat.size}`,
        }),
      });
    }

    const stream = fs.createReadStream(resolvedPath);
    return new NextResponse(Readable.toWeb(stream) as unknown as ReadableStream, {
      headers: new Headers({
        ...Object.fromEntries(baseHeaders.entries()),
        "Content-Length": String(stat.size),
      }),
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Failed to read saved soundtrack file" },
      { status: 400 }
    );
  }
}
