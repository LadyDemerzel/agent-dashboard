import Link from "next/link";
import { StatusBadge } from "./StatusBadge";

export interface ResearchFile {
  id: string;
  title: string;
  filename: string;
  date: string;
  status: "draft" | "needs review" | "requested changes" | "approved" | "published";
  preview: string;
  size: number;
  updatedAt: string;
  agent: string;
  tags: string[];
}

interface ResearchCardProps {
  file: ResearchFile;
  href?: string;
}

export function ResearchCard({ file, href }: ResearchCardProps) {
  const linkHref = href || `/research/${file.id}`;
  
  return (
    <Link href={linkHref}>
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

interface ResearchStatsProps {
  files: ResearchFile[];
}

export function ResearchStats({ files }: ResearchStatsProps) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
      <StatCard label="Total Reports" value={files.length} />
      <StatCard
        label="In Review"
        value={files.filter((f) => f.status === "needs review").length}
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

interface ResearchListProps {
  files: ResearchFile[];
  emptyMessage?: string;
  emptySubMessage?: string;
}

export function ResearchList({ 
  files, 
  emptyMessage = "No research files found yet.",
  emptySubMessage = "Echo's research will appear here when available."
}: ResearchListProps) {
  if (files.length === 0) {
    return (
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-12 text-center">
        <p className="text-zinc-500">{emptyMessage}</p>
        <p className="text-zinc-600 text-sm mt-1">{emptySubMessage}</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {files.map((file) => (
        <ResearchCard key={file.id} file={file} />
      ))}
    </div>
  );
}
