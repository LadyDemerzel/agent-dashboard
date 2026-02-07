import Link from "next/link";
import { getResearchFiles } from "@/lib/research";
import { StatusBadge } from "@/components/StatusBadge";

export const dynamic = "force-dynamic";

export default function ResearchPage() {
  const files = getResearchFiles();

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-1">
          <span className="text-2xl">📡</span>
          <h1 className="text-2xl font-bold text-white">Research</h1>
        </div>
        <p className="text-zinc-500 text-sm mt-1">
          Echo&apos;s X research and market analysis
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
        <StatCard label="Total Reports" value={files.length} />
        <StatCard
          label="In Review"
          value={files.filter((f) => f.status === "review").length}
        />
        <StatCard
          label="Approved"
          value={files.filter((f) => f.status === "approved").length}
        />
        <StatCard
          label="Draft"
          value={files.filter((f) => f.status === "draft").length}
        />
      </div>

      {files.length === 0 ? (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-12 text-center">
          <p className="text-zinc-500">No research files found yet.</p>
          <p className="text-zinc-600 text-sm mt-1">
            Echo&apos;s research will appear here when available.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {files.map((file) => (
            <ResearchCard key={file.id} file={file} />
          ))}
        </div>
      )}
    </div>
  );
}

function ResearchCard({
  file,
}: {
  file: ReturnType<typeof getResearchFiles>[0];
}) {
  return (
    <Link href={`/research/${file.id}`}>
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 hover:border-zinc-700 transition-colors">
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1 min-w-0">
            <h3 className="text-white font-medium truncate">{file.title}</h3>
            <p className="text-zinc-500 text-xs mt-1">
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

        <p className="text-zinc-400 text-sm line-clamp-2">{file.preview}</p>
      </div>
    </Link>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
      <p className="text-zinc-500 text-xs font-medium uppercase tracking-wider">
        {label}
      </p>
      <p className="text-2xl font-bold text-white mt-1">{value}</p>
    </div>
  );
}
