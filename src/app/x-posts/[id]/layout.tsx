import type { Metadata } from "next";
import type { ReactNode } from "react";
import { getXPost } from "@/lib/xposts";
import { createEntityPageTitle, createPageMetadata } from "@/lib/metadata";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const post = getXPost(id);
  const postTitle = post ? `#${post.postNumber} ${post.title}` : undefined;

  return createPageMetadata(
    createEntityPageTitle("X Post", postTitle),
    post ? "Detailed X post draft view with status history and feedback." : undefined
  );
}

export default function XPostDetailLayout({ children }: { children: ReactNode }) {
  return children;
}
