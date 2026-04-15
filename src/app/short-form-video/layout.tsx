import type { ReactNode } from "react";
import { createPageMetadata } from "@/lib/metadata";

export const metadata = createPageMetadata(
  "Short-Form Videos",
  "Manage short-form video projects and workflow stages."
);

export default function ShortFormVideoLayout({ children }: { children: ReactNode }) {
  return children;
}
