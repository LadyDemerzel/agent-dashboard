import Link from "next/link";
import { StatusBadge } from "./StatusBadge";
import { Card } from "@/components/ui/card";

export interface ResearchFile {
  id: string;
  title: string;
  filename: string;
  date: string;
  status: "draft" | "needs review" | "requested changes" | "approved" | "published" | "archived";
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
    <Link href={linkHref} className="block w-full min-w-0">
      <Card className="p-5 hover:border-ring/50 transition-colors min-w-0">
        <div className="flex items-start justify-between mb-3 gap-3">
          <div className="flex-1 min-w-0 overflow-hidden">
            <h3 className="text-foreground font-medium truncate">{file.title}</h3>
            <p className="text-muted-foreground text-xs mt-1 truncate">
              {new Date(file.date).toLocaleDateString("en-US", {
                year: "numeric",
                month: "long",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
              {" \u00B7 "}
              <span className="break-all">{file.filename}</span>
            </p>
          </div>
          <div className="flex-shrink-0">
            <StatusBadge status={file.status} />
          </div>
        </div>

        <p className="text-muted-foreground text-sm line-clamp-2 break-words">{file.preview}</p>
      </Card>
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
    <Card className="p-4">
      <p className="text-muted-foreground text-xs font-medium uppercase tracking-wider">
        {label}
      </p>
      <p className="text-2xl font-bold text-foreground mt-1">{value}</p>
    </Card>
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
      <Card className="p-12 text-center">
        <p className="text-muted-foreground">{emptyMessage}</p>
        <p className="text-muted-foreground text-sm mt-1">{emptySubMessage}</p>
      </Card>
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
