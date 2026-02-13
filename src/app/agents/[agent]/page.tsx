"use client";

import { notFound } from "next/navigation";
import Link from "next/link";
import { use, useEffect, useState } from "react";
import { usePolling } from "@/components/usePolling";
import { AgentFilesEditor } from "@/components/AgentFilesEditor";

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

export default function AgentDetailPage({
  params,
}: {
  params: Promise<{ agent: string }>;
}) {
  const { agent: agentId } = use(params);
  const [initialData, setInitialData] = useState<AgentDetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  // Fetch initial data
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

  // Poll for real-time status updates
  const { data: liveStatus } = usePolling<AgentStatusResponse>("/api/agents/status", 3000);

  if (loading) {
    return (
      <div className="p-4 sm:p-6 lg:p-8 flex items-center justify-center min-h-[50vh]">
        <div className="text-zinc-500">Loading agent details...</div>
      </div>
    );
  }

  if (error || !initialData) {
    notFound();
  }

  const { agent, files } = initialData;

  const status = liveStatus?.[agentId]?.status ?? initialData.sessionStatus?.status ?? agent.status;
  const currentTask = liveStatus?.[agentId]?.currentTask ?? initialData.sessionStatus?.currentTask;
  
  const style = STATUS_STYLES[status] || STATUS_STYLES.idle;

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-5xl">
      <Link
        href="/agents"
        className="text-zinc-500 hover:text-white text-sm mb-6 inline-flex items-center gap-1 transition-colors"
      >
        &larr; Back to Agents
      </Link>

      {/* Agent Header with Live Status */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 mb-6">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl"
              style={{ backgroundColor: agent.color + "20" }}
            >
              {agent.icon}
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">
                {agent.name}
              </h1>
              <p className="text-zinc-500 text-sm">{agent.domain}</p>
            </div>
          </div>
          {/* Live status badge */}
          <span
            className={`inline-flex items-center gap-1.5 rounded-full font-medium px-2.5 py-1 text-xs ${style.bg} ${style.text}`}
          >
            <span
              className={`rounded-full w-1.5 h-1.5 ${style.dot} ${status === "working" ? "animate-pulse" : ""}`}
            />
            {status.replace(/\b\w/g, (c) => c.toUpperCase())}
          </span>
        </div>

        {/* Current Task Display - Updates in real-time */}
        {currentTask && (
          <div className="mt-4 p-3 bg-zinc-800/50 rounded-lg border border-zinc-800">
            <div className="flex items-center gap-2 mb-1">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <p className="text-xs text-zinc-500 uppercase tracking-wider">
                Current Task
              </p>
            </div>
            <p className="text-zinc-300 text-sm">{currentTask}</p>
          </div>
        )}
        
        {/* Live indicator */}
        <div className="mt-4 flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
          <span className="text-xs text-zinc-500">Live updates enabled</span>
        </div>
      </div>

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
