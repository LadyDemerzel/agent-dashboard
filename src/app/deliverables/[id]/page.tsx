import { notFound } from "next/navigation";
import Link from "next/link";
import { getDeliverables, getDeliverableContent } from "@/lib/files";
import { StatusBadge } from "@/components/StatusBadge";

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

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-4xl">
      <Link
        href="/deliverables"
        className="text-zinc-500 hover:text-white text-sm mb-6 inline-flex items-center gap-1 transition-colors"
      >
        &larr; Back to Deliverables
      </Link>

      {/* Header */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 mb-6">
        <div className="flex items-start justify-between mb-4">
          <h1 className="text-xl font-bold text-white">{deliverable.title}</h1>
          <StatusBadge status={deliverable.status} />
        </div>

        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-zinc-500">Agent: </span>
            <Link
              href={`/agents/${deliverable.agentId}`}
              className="text-white hover:text-zinc-300 transition-colors"
            >
              {deliverable.agentName}
            </Link>
          </div>
          <div>
            <span className="text-zinc-500">Type: </span>
            <span className="text-zinc-300 capitalize">
              {deliverable.type}
            </span>
          </div>
          <div>
            <span className="text-zinc-500">Created: </span>
            <span className="text-zinc-300">
              {new Date(deliverable.createdAt).toLocaleString()}
            </span>
          </div>
          <div>
            <span className="text-zinc-500">Updated: </span>
            <span className="text-zinc-300">
              {new Date(deliverable.updatedAt).toLocaleString()}
            </span>
          </div>
          <div className="col-span-2">
            <span className="text-zinc-500">Path: </span>
            <span className="text-zinc-400 font-mono text-xs">
              {deliverable.relativePath}
            </span>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
        <h2 className="text-sm font-medium text-zinc-500 uppercase tracking-wider mb-4">
          Content
        </h2>
        {content ? (
          <div className="prose prose-invert prose-sm max-w-none">
            <pre className="whitespace-pre-wrap text-zinc-300 text-sm font-mono leading-relaxed bg-zinc-950 rounded-lg p-4 border border-zinc-800 overflow-x-auto">
              {content}
            </pre>
          </div>
        ) : (
          <p className="text-zinc-500 text-sm">
            Unable to load deliverable content.
          </p>
        )}
      </div>
    </div>
  );
}
