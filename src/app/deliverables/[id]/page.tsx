import { notFound } from "next/navigation";
import { getDeliverables, getDeliverableContent } from "@/lib/files";
import { readStatusLog } from "@/lib/status";
import { DeliverableDetailClient } from "./DeliverableDetailClient";

export const dynamic = "force-dynamic";

export default async function DeliverableDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const deliverables = getDeliverables();
  const deliverable = deliverables.find((d) => d.id === id);

  if (!deliverable) notFound();

  const content = getDeliverableContent(id);
  const statusLog = readStatusLog(deliverable.filePath);

  return (
    <DeliverableDetailClient
      deliverable={deliverable}
      content={content || ""}
      statusLog={statusLog}
    />
  );
}
