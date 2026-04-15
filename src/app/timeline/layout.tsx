import type { ReactNode } from "react";
import { createPageMetadata } from "@/lib/metadata";

export const metadata = createPageMetadata(
  "Activity Timeline",
  "Track recent agent activity and deliverable updates chronologically."
);

export default function TimelineLayout({ children }: { children: ReactNode }) {
  return children;
}
