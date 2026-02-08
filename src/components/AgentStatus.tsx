"use client";

import { usePolling } from "./usePolling";

interface AgentStatusData {
  status: "idle" | "working" | "review" | "blocked";
  currentTask?: string;
}

interface AgentStatusResponse {
  [agentId: string]: AgentStatusData;
}

interface AgentStatusProps {
  agentId: string;
  showTask?: boolean;
  size?: "sm" | "md" | "lg";
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

const SIZE_STYLES = {
  sm: {
    container: "px-2 py-0.5 text-xs",
    dot: "w-1 h-1",
  },
  md: {
    container: "px-2.5 py-1 text-xs",
    dot: "w-1.5 h-1.5",
  },
  lg: {
    container: "px-3 py-1.5 text-sm",
    dot: "w-2 h-2",
  },
};

export function AgentStatus({
  agentId,
  showTask = false,
  size = "md",
}: AgentStatusProps) {
  const { data } = usePolling<AgentStatusResponse>("/api/agents/status", 5000);

  const statusData = data?.[agentId] || { status: "idle" as const };
  const style = STATUS_STYLES[statusData.status] || STATUS_STYLES.idle;
  const sizeStyle = SIZE_STYLES[size];

  return (
    <div className="flex flex-col gap-1.5">
      <span
        className={`inline-flex items-center gap-1.5 rounded-full font-medium ${sizeStyle.container} ${style.bg} ${style.text}`}
      >
        <span
          className={`rounded-full ${sizeStyle.dot} ${style.dot} ${statusData.status === "working" ? "animate-pulse" : ""}`}
        />
        {statusData.status.replace(/\b\w/g, (c) => c.toUpperCase())}
      </span>
      {showTask && statusData.currentTask && (
        <p className="text-xs text-zinc-400 truncate max-w-[200px]">
          {statusData.currentTask}
        </p>
      )}
    </div>
  );
}

// Non-polling version for SSR/initial load
export function AgentStatusStatic({
  status,
  currentTask,
  showTask = false,
  size = "md",
}: {
  status: "idle" | "working" | "review" | "blocked";
  currentTask?: string;
  showTask?: boolean;
  size?: "sm" | "md" | "lg";
}) {
  const style = STATUS_STYLES[status] || STATUS_STYLES.idle;
  const sizeStyle = SIZE_STYLES[size];

  return (
    <div className="flex flex-col gap-1.5">
      <span
        className={`inline-flex items-center gap-1.5 rounded-full font-medium ${sizeStyle.container} ${style.bg} ${style.text}`}
      >
        <span
          className={`rounded-full ${sizeStyle.dot} ${style.dot} ${status === "working" ? "animate-pulse" : ""}`}
        />
        {status.replace(/\b\w/g, (c) => c.toUpperCase())}
      </span>
      {showTask && currentTask && (
        <p className="text-xs text-zinc-400 truncate max-w-[200px]">
          {currentTask}
        </p>
      )}
    </div>
  );
}
