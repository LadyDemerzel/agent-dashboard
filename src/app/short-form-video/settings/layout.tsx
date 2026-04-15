import type { ReactNode } from "react";
import { createPageMetadata } from "@/lib/metadata";

export const metadata = createPageMetadata(
  "Short-Form Video Settings",
  "Configure prompts, voice, visuals, background videos, and music for the short-form workflow."
);

export default function ShortFormVideoSettingsLayout({
  children,
}: {
  children: ReactNode;
}) {
  return children;
}
