import type { ReactNode } from "react";
import { createPageMetadata } from "@/lib/metadata";

export const metadata = createPageMetadata(
  "Agents",
  "Browse agent profiles, live status, and workspace configuration files."
);

export default function AgentsLayout({ children }: { children: ReactNode }) {
  return children;
}
