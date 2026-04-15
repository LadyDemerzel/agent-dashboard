import fs from "fs";
import path from "path";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import { createEntityPageTitle, createPageMetadata } from "@/lib/metadata";

const HOME_DIR = process.env.HOME || "/Users/ittaisvidler";
const YOUTUBE_VIDEOS_DIR = path.join(
  HOME_DIR,
  "tenxsolo",
  "business",
  "content",
  "deliverables",
  "youtube-videos"
);

function readYoutubeVideoTitle(id: string) {
  const videoDir = path.join(YOUTUBE_VIDEOS_DIR, id);
  const yamlPath = path.join(videoDir, "video.yaml");

  if (!fs.existsSync(yamlPath)) {
    return undefined;
  }

  const content = fs.readFileSync(yamlPath, "utf-8");
  const titleMatch = content.match(/^title:\s*(.+)$/m);
  const topicMatch = content.match(/^topic:\s*(.+)$/m);

  return titleMatch?.[1]?.trim() || topicMatch?.[1]?.trim() || id;
}

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const title = readYoutubeVideoTitle(id);

  return createPageMetadata(
    createEntityPageTitle("YouTube Video", title),
    title ? "Long-form YouTube workflow details, assets, and stage progress." : undefined
  );
}

export default function YouTubeVideoDetailLayout({ children }: { children: ReactNode }) {
  return children;
}
