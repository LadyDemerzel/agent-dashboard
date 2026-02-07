import { AGENTS } from "@/lib/agents";
import { getAgentStats, getDeliverables } from "@/lib/files";
import { AgentCard } from "@/components/AgentCard";
import { DeliverableList } from "@/components/DeliverableList";

export const dynamic = "force-dynamic";

export default function Dashboard() {
  const stats = getAgentStats();
  const deliverables = getDeliverables();
  const recentDeliverables = deliverables.slice(0, 5);

  const agents = AGENTS.map((agent) => ({
    ...agent,
    deliverableCount: stats[agent.id]?.deliverableCount ?? 0,
    lastActivity: stats[agent.id]?.lastActivity ?? agent.lastActivity,
  }));

  const activeCount = agents.filter((a) => a.status === "working").length;
  const totalDeliverables = deliverables.length;

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">Agent Dashboard</h1>
        <p className="text-zinc-500 text-sm mt-1">
          Coordination hub for the 10X Solo agent team
        </p>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        <StatCard label="Total Agents" value={agents.length} />
        <StatCard
          label="Active Now"
          value={activeCount}
          accent={activeCount > 0}
        />
        <StatCard label="Deliverables" value={totalDeliverables} />
        <StatCard
          label="In Review"
          value={deliverables.filter((d) => d.status === "review").length}
        />
      </div>

      {/* Agent Grid */}
      <div className="mb-8">
        <h2 className="text-lg font-semibold text-white mb-4">Agents</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {agents.map((agent) => (
            <AgentCard key={agent.id} {...agent} />
          ))}
        </div>
      </div>

      {/* Recent Deliverables */}
      <div>
        <h2 className="text-lg font-semibold text-white mb-4">
          Recent Deliverables
        </h2>
        <DeliverableList deliverables={recentDeliverables} />
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
