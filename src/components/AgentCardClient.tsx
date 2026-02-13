"use client";

import Link from "next/link";
import { usePolling } from "./usePolling";

interface AgentStatusData {
  status: "idle" | "working" | "review" | "blocked";
  currentTask?: string;
}

interface AgentStatusResponse {
  [agentId: string]: AgentStatusData;
}

interface AgentCardProps {
  id: string;
  name: string;
  domain: string;
  icon: string;
  color: string;
  initialStatus: string;
  initialTask?: string;
  deliverableCount: number;
  lastActivity: string;
  description: string;
}

const STATUS_STYLES: Record<
  string,
  { bg: string; text: string; dot: string }
> = {
  idle: {
    bg: "bg-zinc-800",
    text: "text-zinc-400",
    dot: "bg-zinc-500",
  },
  working: {
    bg: "bg-emerald-950",
    text: "text-emerald-400",
    dot: "bg-emerald-500",
  },
  review: {
    bg: "bg-amber-950",
    text: "text-amber-400",
    dot: "bg-amber-500",
  },
  blocked: {
    bg: "bg-red-950",
    text: "text-red-400",
    dot: "bg-red-500",
  },
};

export function AgentCardClient({
  id,
  name,
  domain,
  icon,
  color,
  initialStatus,
  initialTask,
  deliverableCount,
  lastActivity,
  description,
}: AgentCardProps) {
  const { data } = usePolling<AgentStatusResponse>("/api/agents/status", 3000);
  
  // Use polled data if available, fall back to initial props
  const statusData = data?.[id];
  const status = statusData?.status || initialStatus;
  const currentTask = statusData?.currentTask || initialTask;
  
  const style = STATUS_STYLES[status] || STATUS_STYLES.idle;
  const timeAgo = getTimeAgo(lastActivity);

  return (
    <Link href={`/agents/${id}`}>
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 hover:border-zinc-600 transition-colors cursor-pointer group">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-lg flex items-center justify-center text-xl"
              style={{ backgroundColor: color + "20" }}
            >
              {icon}
            </div>
            <div>
              <h3 className="text-white font-semibold group-hover:text-zinc-200">
                {name}
              </h3>
              <p className="text-zinc-500 text-sm">{domain}</p>
            </div>
          </div>
          {/* Real-time status badge with pulse animation when working */}
          <span
            className={`inline-flex items-center gap-1.5 rounded-full font-medium px-2 py-0.5 text-xs ${style.bg} ${style.text}`}
          >
            <span
              className={`rounded-full w-1 h-1 ${style.dot} ${status === "working" ? "animate-pulse" : ""}`}
            />
            {status.replace(/\b\w/g, (c) => c.toUpperCase())}
          </span>
        </div>

        {/* Show current task when working, otherwise show description */}
        <p className="text-zinc-400 text-sm mb-4 line-clamp-2">
          {status === "working" && currentTask ? currentTask : (initialTask || description)}
        </p>

        <div className="flex items-center justify-between text-xs text-zinc-500">
          <span>{deliverableCount} deliverables</span>
          <span>{timeAgo}</span>
        </div>
      </div>
    </Link>
  );
}

function getTimeAgo(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);

  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  return `${diffDay}d ago`;
}
