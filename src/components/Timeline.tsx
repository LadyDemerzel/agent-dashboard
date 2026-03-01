"use client";

import type { TimelineEvent } from "@/lib/timeline";
import { Badge } from "@/components/ui/badge";

export function Timeline({ events }: { events: TimelineEvent[] }) {
  if (events.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <p className="text-4xl mb-3">{"\uD83D\uDCED"}</p>
        <p className="text-sm">No activity yet</p>
        <p className="text-xs mt-1">
          Agent activity will appear here as work is completed
        </p>
      </div>
    );
  }

  return (
    <div className="relative">
      {/* Vertical line */}
      <div className="absolute left-5 top-0 bottom-0 w-px bg-muted" />

      <div className="space-y-1">
        {events.map((event, i) => (
          <div key={event.id} className="relative flex items-start gap-4 py-3">
            {/* Dot on timeline */}
            <div className="relative z-10 flex-shrink-0 w-10 h-10 rounded-lg bg-card border border-border flex items-center justify-center text-lg">
              {event.agentIcon}
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-foreground text-sm font-medium">
                  {event.agentName}
                </span>
                <span className="text-muted-foreground text-sm">{event.action}</span>
              </div>
              <p className="text-muted-foreground text-sm mt-0.5 truncate">
                {event.detail}
              </p>
              <p className="text-muted-foreground text-xs mt-1">
                {formatTimestamp(event.timestamp)}
              </p>
            </div>

            {/* Latest badge */}
            {i === 0 && (
              <Badge variant="success" className="flex-shrink-0">
                Latest
              </Badge>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function formatTimestamp(ts: string): string {
  const date = new Date(ts);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);

  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;

  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}
