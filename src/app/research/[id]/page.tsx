import { notFound } from "next/navigation";
import { getResearchFiles, getResearchContent } from "@/lib/research";
import { getResearchStatusLog } from "@/lib/status";
import { ResearchDetailClient } from "./ResearchDetailClient";

export const dynamic = "force-dynamic";

export default async function ResearchDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const files = getResearchFiles();
  const file = files.find((f) => f.id === id);

  if (!file) notFound();

  const content = getResearchContent(id);
  const statusLog = getResearchStatusLog(id);

  return (
    <ResearchDetailClient
      file={file}
      content={content || ""}
      statusLog={statusLog}
    />
  );
}
