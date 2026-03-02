"use client";

import { notFound } from "next/navigation";
import Link from "next/link";
import { use, useEffect, useState } from "react";
import { usePolling } from "@/components/usePolling";
import { AgentFilesEditor } from "@/components/AgentFilesEditor";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { OrbitLoader, Skeleton } from "@/components/ui/loading";

interface Agent {
  id: string;
  name: string;
  domain: string;
  icon: string;
  color: string;
  status: "idle" | "working" | "review" | "blocked";
  description: string;
}

interface AgentFiles {
  soul: string;
  agents: string;
  user: string;
  tools: string;
  heartbeat: string;
  identity: string;
  memory: string;
}

interface AgentStatusData {
  status: "idle" | "working" | "review" | "blocked";
  currentTask?: string;
}

interface AgentStatusResponse {
  [agentId: string]: AgentStatusData;
}

interface AgentDetailData {
  agent: Agent;
  files: AgentFiles;
  sessionStatus: AgentStatusData;
}

const STATUS_BADGE_VARIANT: Record<string, "default" | "success" | "warning" | "destructive"> = {
  idle: "default",
  working: "success",
  review: "warning",
  blocked: "destructive",
};

const STATUS_DOT_COLOR: Record<string, string> = {
  idle: "bg-zinc-500",
  working: "bg-emerald-500",
  review: "bg-amber-500",
  blocked: "bg-red-500",
};

export default function AgentDetailPage({
  params,
}: {
  params: Promise<{ agent: string }>;
}) {
  const { agent: agentId } = use(params);
  const [initialData, setInitialData] = useState<AgentDetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetch(`/api/agents/${agentId}`, { cache: "no-store" })
      .then((res) => {
        if (!res.ok) throw new Error("Not found");
        return res.json();
      })
      .then((data) => {
        setInitialData(data);
        setLoading(false);
      })
      .catch(() => {
        setError(true);
        setLoading(false);
      });
  }, [agentId]);

  const { data: liveStatus } = usePolling<AgentStatusResponse>("/api/agents/status", 3000);

  if (loading) {
    return (
      <div className="p-4 sm:p-6 lg:p-8 space-y-6">
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-48" />
        <Skeleton className="h-12 w-80 max-w-full" />
        <Skeleton className="h-[32rem]" />
        <OrbitLoader label="Loading agent workspace" />
      </div>
    );
  }

  if (error || !initialData) {
    notFound();
  }

  const { agent, files } = initialData;

  const status = liveStatus?.[agentId]?.status ?? initialData.sessionStatus?.status ?? agent.status;
  const currentTask = liveStatus?.[agentId]?.currentTask ?? initialData.sessionStatus?.currentTask;

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <Link
        href="/agents"
        className="text-muted-foreground hover:text-foreground text-sm mb-6 inline-flex items-center gap-1 transition-colors"
      >
        &larr; Back to Agents
      </Link>

      {/* Agent Header with Live Status */}
      <Card className="p-6 mb-6">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div
              className="w-12 h-12 rounded-lg flex items-center justify-center text-2xl"
              style={{ backgroundColor: agent.color + "20" }}
            >
              {agent.icon}
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground">
                {agent.name}
              </h1>
              <p className="text-muted-foreground text-sm">{agent.domain}</p>
            </div>
          </div>
          {/* Live status badge */}
          <Badge variant={STATUS_BADGE_VARIANT[status] || "default"}>
            <span
              className={`rounded-full w-1.5 h-1.5 ${STATUS_DOT_COLOR[status] || "bg-zinc-500"} ${status === "working" ? "animate-pulse" : ""}`}
            />
            {status.replace(/\b\w/g, (c) => c.toUpperCase())}
          </Badge>
        </div>

        {/* Current Task Display - Updates in real-time */}
        {currentTask && (
          <div className="mt-4 p-3 bg-muted rounded-md border border-border">
            <div className="flex items-center gap-2 mb-1">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <p className="text-xs text-muted-foreground uppercase tracking-wider">
                Current Task
              </p>
            </div>
            <p className="text-foreground text-sm">{currentTask}</p>
          </div>
        )}

        {/* Live indicator */}
        <div className="mt-4 flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
          <span className="text-xs text-muted-foreground">Live updates enabled</span>
        </div>
      </Card>

      <AgentFilesEditor
        agentId={agentId}
        soul={files.soul}
        agents={files.agents}
        user={files.user}
        tools={files.tools}
        heartbeat={files.heartbeat}
        identity={files.identity}
        memory={files.memory}
      />
    </div>
  );
}
