import type { ReactNode } from "react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: {
    absolute: "Videos",
  },
  description: "Manage short-form video projects and workflow stages.",
};

export default function ShortFormVideoLayout({ children }: { children: ReactNode }) {
  return children;
}
