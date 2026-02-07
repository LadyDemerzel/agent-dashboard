import { StatusLogEntry } from "@/lib/status";

function formatTime(timestamp: string): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const STATUS_COLORS: Record<string, string> = {
  "needs review": "bg-amber-500",
  "requested changes": "bg-orange-500",
  approved: "bg-emerald-500",
  published: "bg-blue-500",
  draft: "bg-zinc-500",
  review: "bg-amber-500",
};

export function StatusLog({ logs }: { logs: StatusLogEntry[] }) {
  if (logs.length === 0) {
    return (
      <div className="text-zinc-600 text-sm py-4">
        No status changes recorded yet.
      </div>
    );
  }

  return (
    <div className="space-y-0">
      {[...logs].reverse().map((entry, i) => (
        <div key={i} className="flex gap-3 pb-4 last:pb-0">
          {/* Timeline line + dot */}
          <div className="flex flex-col items-center">
            <div
              className={`w-2.5 h-2.5 rounded-full mt-1.5 flex-shrink-0 ${STATUS_COLORS[entry.to] || "bg-zinc-500"}`}
            />
            {i < logs.length - 1 && (
              <div className="w-px flex-1 bg-zinc-800 mt-1" />
            )}
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0 pb-2">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-zinc-300 text-sm font-medium capitalize">
                {entry.to}
              </span>
              <span className="text-zinc-600 text-xs">
                by {entry.by}
              </span>
            </div>
            {entry.note && (
              <p className="text-zinc-500 text-xs mt-0.5 line-clamp-2">
                {entry.note}
              </p>
            )}
            <p className="text-zinc-700 text-xs mt-0.5">
              {formatTime(entry.timestamp)}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}
