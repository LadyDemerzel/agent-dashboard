"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePolling } from "@/components/usePolling";
import { AGENTS } from "@/lib/agents";
import { AgentCardClient } from "@/components/AgentCardClient";
import { DeliverableList } from "@/components/DeliverableList";
import { Timeline } from "@/components/Timeline";
import { buildTimelineEvents } from "@/lib/timeline";
import { ResearchCard, ResearchStats, ResearchFile } from "@/components/ResearchCard";

interface AgentStatusData {
  status: "idle" | "working" | "review" | "blocked";
  currentTask?: string;
}

interface AgentStatusResponse {
  [agentId: string]: AgentStatusData;
}

interface Deliverable {
  id: string;
  agentId: string;
  agentName: string;
  title: string;
  type: "research" | "code" | "content" | "strategy" | "operations";
  status: "draft" | "needs review" | "requested changes" | "approved" | "published" | "archived";
  filePath: string;
  relativePath: string;
  createdAt: string;
  updatedAt: string;
  size: number;
}

interface DashboardData {
  stats: Record<string, { deliverableCount: number; lastActivity: string }>;
  deliverables: Deliverable[];
  researchFiles: ResearchFile[];
  sessionStatus: AgentStatusResponse;
}

export default function Dashboard() {
  const [initialData, setInitialData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  // Fetch initial data on mount
  useEffect(() => {
    fetch("/api/dashboard", { cache: "no-store" })
      .then((res) => res.json())
      .then((data) => {
        setInitialData(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  // Poll for real-time status updates every 3 seconds
  const { data: liveStatus } = usePolling<AgentStatusResponse>("/api/agents/status", 3000);

  if (loading || !initialData) {
    return (
      <div className="p-4 sm:p-6 lg:p-8 flex items-center justify-center min-h-[50vh]">
        <div className="text-zinc-500">Loading dashboard...</div>
      </div>
    );
  }

  const { stats, deliverables, researchFiles, sessionStatus } = initialData;
  
  const recentResearch = researchFiles.slice(0, 3);
  const recentDeliverables = deliverables.filter(d => d.agentId !== 'echo').slice(0, 5);

  // Merge initial data with live status
  const agents = AGENTS.map((agent) => {
    const liveAgentStatus = liveStatus?.[agent.id];
    return {
      ...agent,
      deliverableCount: stats[agent.id]?.deliverableCount ?? 0,
      lastActivity: stats[agent.id]?.lastActivity ?? agent.lastActivity,
      initialStatus: liveAgentStatus?.status ?? sessionStatus[agent.id]?.status ?? agent.status,
      initialTask: liveAgentStatus?.currentTask ?? sessionStatus[agent.id]?.currentTask,
    };
  });

  const agentIcons: Record<string, string> = {};
  for (const a of AGENTS) {
    agentIcons[a.id] = a.icon;
  }

  const timelineEvents = buildTimelineEvents(
    deliverables.slice(0, 10),
    agentIcons
  );

  // Calculate active count from live data
  const activeCount = agents.filter((a) => {
    const agentLiveStatus = liveStatus?.[a.id]?.status;
    return agentLiveStatus === "working" || (!agentLiveStatus && a.initialStatus === "working");
  }).length;
  
  const totalDeliverables = deliverables.length;

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">Agent Dashboard</h1>
        <p className="text-zinc-500 text-sm mt-1">
          Coordination hub for the agent team
        </p>
        {/* Live indicator */}
        <div className="flex items-center gap-2 mt-2">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
          <span className="text-xs text-zinc-500">Live updates</span>
        </div>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mb-8">
        <StatCard label="Total Agents" value={agents.length} />
        <StatCard
          label="Active Now"
          value={activeCount}
          accent={activeCount > 0}
        />
        <StatCard label="Deliverables" value={totalDeliverables} />
        <StatCard
          label="In Review"
          value={deliverables.filter((d) => d.status === "needs review").length}
        />
      </div>

      {/* Agent Grid with Real-time Updates */}
      <div className="mb-8">
        <h2 className="text-lg font-semibold text-white mb-4">Agents</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {agents.map((agent) => (
            <AgentCardClient 
              key={agent.id} 
              id={agent.id}
              name={agent.name}
              domain={agent.domain}
              icon={agent.icon}
              color={agent.color}
              initialStatus={agent.initialStatus}
              initialTask={agent.initialTask}
              deliverableCount={agent.deliverableCount}
              lastActivity={agent.lastActivity}
              description={agent.description}
            />
          ))}
        </div>
      </div>

      {/* Echo&apos;s Research Section */}
      {researchFiles.length > 0 && (
        <div className="mb-10">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <span className="text-xl">📡</span>
              <h2 className="text-lg font-semibold text-white">
                Echo&apos;s Research
              </h2>
            </div>
            <Link
              href="/research"
              className="text-zinc-500 hover:text-white text-xs transition-colors"
            >
              View all &rarr;
            </Link>
          </div>
          
          {/* Research Stats */}
          <div className="mb-6">
            <ResearchStats files={researchFiles} />
          </div>
          
          {/* Recent Research Cards */}
          <div className="space-y-4">
            {recentResearch.map((file) => (
              <ResearchCard key={file.id} file={file} />
            ))}
          </div>
        </div>
      )}

      {/* Two column: Recent Deliverables + Timeline */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
        <div className="space-y-5">
          <h2 className="text-lg font-semibold text-white mb-4">
            Recent Deliverables
          </h2>
          <div className="space-y-4">
            <DeliverableList deliverables={recentDeliverables} />
          </div>
        </div>

        <div className="space-y-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-white">
              Activity Timeline
            </h2>
            <Link
              href="/timeline"
              className="text-zinc-500 hover:text-white text-xs transition-colors"
            >
              View all &rarr;
            </Link>
          </div>
          <Timeline events={timelineEvents} />
        </div>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  accent = false,
}: {
  label: string;
  value: number;
  accent?: boolean;
}) {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
      <p className="text-zinc-500 text-xs font-medium uppercase tracking-wider">
        {label}
      </p>
      <p
        className={`text-2xl font-bold mt-1 ${accent ? "text-emerald-400" : "text-white"}`}
      >
        {value}
      </p>
    </div>
  );
}
