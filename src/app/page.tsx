import Link from "next/link";
import { AGENTS } from "@/lib/agents";
import { getAgentStats, getDeliverables } from "@/lib/files";
import { getResearchFiles } from "@/lib/research";
import { AgentCard } from "@/components/AgentCard";
import { DeliverableList } from "@/components/DeliverableList";
import { Timeline } from "@/components/Timeline";
import { buildTimelineEvents } from "@/lib/timeline";
import { ResearchCard, ResearchStats } from "@/components/ResearchCard";

export const dynamic = "force-dynamic";

export default function Dashboard() {
  const stats = getAgentStats();
  const deliverables = getDeliverables();
  const researchFiles = getResearchFiles();
  const recentResearch = researchFiles.slice(0, 3);
  const recentDeliverables = deliverables.filter(d => d.agentId !== 'echo').slice(0, 5);

  const agents = AGENTS.map((agent) => ({
    ...agent,
    deliverableCount: stats[agent.id]?.deliverableCount ?? 0,
    lastActivity: stats[agent.id]?.lastActivity ?? agent.lastActivity,
  }));

  const agentIcons: Record<string, string> = {};
  for (const a of AGENTS) {
    agentIcons[a.id] = a.icon;
  }

  const timelineEvents = buildTimelineEvents(
    deliverables.slice(0, 10),
    agentIcons
  );

  const activeCount = agents.filter((a) => a.status === "working").length;
  const totalDeliverables = deliverables.length;

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">Agent Dashboard</h1>
        <p className="text-zinc-500 text-sm mt-1">
          Coordination hub for the 10X Solo agent team
        </p>
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

      {/* Agent Grid */}
      <div className="mb-8">
        <h2 className="text-lg font-semibold text-white mb-4">Agents</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {agents.map((agent) => (
            <AgentCard key={agent.id} {...agent} />
          ))}
        </div>
      </div>

      {/* Echo's Research Section */}
      {researchFiles.length > 0 && (
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
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
          <div className="mb-4">
            <ResearchStats files={researchFiles} />
          </div>
          
          {/* Recent Research Cards */}
          <div className="space-y-3">
            {recentResearch.map((file) => (
              <ResearchCard key={file.id} file={file} />
            ))}
          </div>
        </div>
      )}

      {/* Two column: Recent Deliverables + Timeline */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div>
          <h2 className="text-lg font-semibold text-white mb-4">
            Recent Deliverables
          </h2>
          <DeliverableList deliverables={recentDeliverables} />
        </div>

        <div>
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
