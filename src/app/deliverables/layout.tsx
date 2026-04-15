import type { ReactNode } from "react";
import { createPageMetadata } from "@/lib/metadata";

export const metadata = createPageMetadata(
  "Deliverables",
  "Review deliverables across the full agent team."
);

export default function DeliverablesLayout({ children }: { children: ReactNode }) {
  return children;
}
