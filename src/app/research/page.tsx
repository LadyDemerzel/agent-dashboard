import Link from "next/link";
import { getResearchFiles, getResearchContent } from "@/lib/research";
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
  const content = getResearchContent(file.id);

  return (
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

      <p className="text-zinc-400 text-sm line-clamp-2 mb-4">{file.preview}</p>

      {/* Rendered markdown content */}
      {content && (
        <details className="group">
          <summary className="cursor-pointer text-xs text-zinc-500 hover:text-zinc-300 transition-colors flex items-center gap-1">
            <span className="group-open:rotate-90 transition-transform">
              ▶
            </span>
            View full report
          </summary>
          <div className="mt-3 bg-zinc-950 border border-zinc-800 rounded-lg p-4 overflow-x-auto">
            <MarkdownContent content={content} />
          </div>
        </details>
      )}
    </div>
  );
}

function MarkdownContent({ content }: { content: string }) {
  // Simple markdown-to-HTML renderer for server components
  const lines = content.split("\n");
  const elements: React.ReactNode[] = [];
  let inTable = false;
  let tableRows: string[][] = [];
  let inList = false;
  let listItems: string[] = [];

  function flushList() {
    if (inList && listItems.length > 0) {
      elements.push(
        <ul
          key={`list-${elements.length}`}
          className="list-disc list-inside text-zinc-300 text-sm space-y-1 my-2"
        >
          {listItems.map((item, i) => (
            <li key={i}>{item}</li>
          ))}
        </ul>
      );
      listItems = [];
      inList = false;
    }
  }

  function flushTable() {
    if (inTable && tableRows.length > 0) {
      const header = tableRows[0];
      const body = tableRows.slice(1);
      elements.push(
        <div key={`table-${elements.length}`} className="overflow-x-auto my-3">
          <table className="w-full text-sm text-zinc-300 border border-zinc-800">
            <thead>
              <tr className="bg-zinc-800">
                {header.map((cell, i) => (
                  <th
                    key={i}
                    className="px-3 py-2 text-left text-xs font-medium text-zinc-400"
                  >
                    {cell}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {body.map((row, ri) => (
                <tr key={ri} className="border-t border-zinc-800">
                  {row.map((cell, ci) => (
                    <td key={ci} className="px-3 py-2">
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
      tableRows = [];
      inTable = false;
    }
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // Table rows
    if (trimmed.startsWith("|") && trimmed.endsWith("|")) {
      flushList();
      // Skip separator rows
      if (trimmed.match(/^\|[\s-|]+\|$/)) continue;
      const cells = trimmed
        .split("|")
        .slice(1, -1)
        .map((c) => c.trim());
      inTable = true;
      tableRows.push(cells);
      continue;
    } else if (inTable) {
      flushTable();
    }

    // List items
    if (trimmed.match(/^[-*]\s/)) {
      inList = true;
      listItems.push(trimmed.replace(/^[-*]\s/, ""));
      continue;
    } else if (trimmed.match(/^\d+\.\s/)) {
      inList = true;
      listItems.push(trimmed.replace(/^\d+\.\s/, ""));
      continue;
    } else if (inList) {
      flushList();
    }

    // Headers
    if (trimmed.startsWith("### ")) {
      elements.push(
        <h4
          key={`h4-${i}`}
          className="text-white font-medium text-sm mt-4 mb-2"
        >
          {trimmed.slice(4)}
        </h4>
      );
    } else if (trimmed.startsWith("## ")) {
      elements.push(
        <h3
          key={`h3-${i}`}
          className="text-white font-semibold text-base mt-5 mb-2"
        >
          {trimmed.slice(3)}
        </h3>
      );
    } else if (trimmed.startsWith("# ")) {
      elements.push(
        <h2 key={`h2-${i}`} className="text-white font-bold text-lg mb-3">
          {trimmed.slice(2)}
        </h2>
      );
    } else if (trimmed.startsWith("**") && trimmed.endsWith("**")) {
      elements.push(
        <p key={`bold-${i}`} className="text-zinc-300 text-sm font-medium">
          {trimmed.slice(2, -2)}
        </p>
      );
    } else if (trimmed) {
      elements.push(
        <p key={`p-${i}`} className="text-zinc-400 text-sm my-1">
          {trimmed}
        </p>
      );
    }
  }

  flushList();
  flushTable();

  return <div>{elements}</div>;
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
