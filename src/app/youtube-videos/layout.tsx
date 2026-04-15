import type { ReactNode } from "react";
import { createPageMetadata } from "@/lib/metadata";

export const metadata = createPageMetadata(
  "YouTube Videos",
  "Create and review long-form faceless YouTube video projects."
);

export default function YouTubeVideosLayout({ children }: { children: ReactNode }) {
  return children;
}
