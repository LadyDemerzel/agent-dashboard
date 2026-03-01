"use client";

import Link from "next/link";
import { usePolling } from "./usePolling";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

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

const STATUS_VARIANT: Record<string, "default" | "success" | "warning" | "destructive"> = {
  idle: "default",
  working: "success",
  review: "warning",
  blocked: "destructive",
};

const STATUS_DOT: Record<string, string> = {
  idle: "bg-zinc-500",
  working: "bg-emerald-500",
  review: "bg-amber-500",
  blocked: "bg-red-500",
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

  const variant = STATUS_VARIANT[status] || STATUS_VARIANT.idle;
  const dotColor = STATUS_DOT[status] || STATUS_DOT.idle;
  const timeAgo = getTimeAgo(lastActivity);

  return (
    <Link href={`/agents/${id}`}>
      <Card className="p-5 hover:border-zinc-600 transition-colors cursor-pointer group">
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
          <Badge variant={variant}>
            <span
              className={cn(
                "rounded-full w-1 h-1",
                dotColor,
                status === "working" && "animate-pulse"
              )}
            />
            {status.replace(/\b\w/g, (c) => c.toUpperCase())}
          </Badge>
        </div>

        <p className="text-zinc-400 text-sm mb-4 line-clamp-2">
          {status === "working" && currentTask ? currentTask : (initialTask || description)}
        </p>

        <div className="flex items-center justify-between text-xs text-zinc-500">
          <span>{deliverableCount} deliverables</span>
          <span>{timeAgo}</span>
        </div>
      </Card>
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
