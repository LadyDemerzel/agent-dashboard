"use client";

import Link from "next/link";
import { AgentStatus } from "./AgentStatus";
import { Card } from "@/components/ui/card";

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
      <Card className="p-5 group cursor-pointer transition-all duration-200 hover:border-ring/70 hover:bg-muted/80">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-lg flex items-center justify-center text-xl"
              style={{ backgroundColor: color + "20" }}
            >
              {icon}
            </div>
            <div>
              <h3 className="text-foreground font-semibold group-hover:text-foreground">
                {name}
              </h3>
              <p className="text-muted-foreground text-sm">{domain}</p>
            </div>
          </div>
          <AgentStatus agentId={id} size="sm" />
        </div>

        <p className="text-muted-foreground text-sm mb-4 line-clamp-2">
          {currentTask || description}
        </p>

        <div className="flex items-center justify-between text-xs text-muted-foreground">
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
