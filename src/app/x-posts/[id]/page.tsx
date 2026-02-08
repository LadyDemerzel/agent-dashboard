import { notFound } from "next/navigation";
import { getXPost } from "@/lib/xposts";
import { getXPostStatusLog } from "@/lib/status";
import { XPostDetailClient } from "./XPostDetailClient";

export const dynamic = "force-dynamic";

export default async function XPostDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const post = getXPost(id);

  if (!post) notFound();

  const statusLog = getXPostStatusLog(id);

  return (
    <XPostDetailClient
      post={post}
      statusLog={statusLog}
    />
  );
}
