import { notFound } from "next/navigation";
import Link from "next/link";
import { getResearchFiles, getResearchContent } from "@/lib/research";
import { getResearchStatusLog } from "@/lib/status";
import { StatusBadge } from "@/components/StatusBadge";
import { StatusChangeForm } from "@/components/StatusChangeForm";
import { StatusLog } from "@/components/StatusLog";

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
    <div className="p-4 sm:p-6 lg:p-8 max-w-6xl">
      <Link
        href="/research"
        className="text-zinc-500 hover:text-white text-sm mb-6 inline-flex items-center gap-1 transition-colors"
      >
        &larr; Back to Research
      </Link>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Header */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
            <div className="flex items-start justify-between mb-4">
              <div className="flex-1 min-w-0">
                <h1 className="text-xl font-bold text-white">{file.title}</h1>
                <p className="text-zinc-500 text-sm mt-1">
                  {new Date(file.date).toLocaleDateString("en-US", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                  {" · "}
                  {file.filename}
                </p>
              </div>
              <StatusBadge status={file.status} />
            </div>

            <StatusChangeForm
              currentStatus={file.status}
              itemId={id}
              itemType="research"
            />
          </div>

          {/* Content */}
          {content && (
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
              <h2 className="text-sm font-medium text-zinc-500 uppercase tracking-wider mb-4">
                Full Report
              </h2>
              <div className="bg-zinc-950 border border-zinc-800 rounded-lg p-4 overflow-x-auto">
                <pre className="text-zinc-300 text-sm whitespace-pre-wrap leading-relaxed font-sans">
                  {content}
                </pre>
              </div>
            </div>
          )}
        </div>

        {/* Right Sidebar - Status Log */}
        <div className="space-y-6">
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
            <h2 className="text-sm font-medium text-zinc-500 uppercase tracking-wider mb-4">
              Status History
            </h2>
            <StatusLog logs={statusLog.logs} />
          </div>

          {/* File Info */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
            <h2 className="text-sm font-medium text-zinc-500 uppercase tracking-wider mb-4">
              Details
            </h2>
            <div className="space-y-3 text-sm">
              <div>
                <span className="text-zinc-500">Agent: </span>
                <span className="text-zinc-300">Echo</span>
              </div>
              <div>
                <span className="text-zinc-500">File: </span>
                <span className="text-zinc-400 font-mono text-xs break-all">
                  {file.filename}
                </span>
              </div>
              <div>
                <span className="text-zinc-500">Size: </span>
                <span className="text-zinc-300">
                  {(file.size / 1024).toFixed(1)} KB
                </span>
              </div>
              <div>
                <span className="text-zinc-500">Updated: </span>
                <span className="text-zinc-300">
                  {new Date(file.updatedAt).toLocaleString()}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
