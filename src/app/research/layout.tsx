import type { ReactNode } from "react";
import { createPageMetadata } from "@/lib/metadata";

export const metadata = createPageMetadata(
  "Research",
  "Browse Echo's research deliverables and supporting analysis."
);

export default function ResearchLayout({ children }: { children: ReactNode }) {
  return children;
}
