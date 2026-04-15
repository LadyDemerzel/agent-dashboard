import type { ReactNode } from "react";
import { createPageMetadata } from "@/lib/metadata";

export const metadata = createPageMetadata(
  "X Posts",
  "Review Scribe's X post drafts, status, and linked research."
);

export default function XPostsLayout({ children }: { children: ReactNode }) {
  return children;
}
