"use client";

import Link from "next/link";
import { AgentStatus } from "./AgentStatus";

interface AgentCardProps {
  id: string;
  name: string;
  domain: string;
  icon: string;
  color: string;
  status: string;
  currentTask?: string;
  deliverableCount: number;
  lastActivity: string;
  description: string;
}

export function AgentCard({
  id,
  name,
  domain,
  icon,
  color,
  status,
  currentTask,
  deliverableCount,
  lastActivity,
  description,
}: AgentCardProps) {
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
          <AgentStatus agentId={id} size="sm" />
        </div>

        <p className="text-zinc-400 text-sm mb-4 line-clamp-2">
          {currentTask || description}
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
