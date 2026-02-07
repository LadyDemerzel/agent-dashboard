import { getDeliverables } from "@/lib/files";
import { AGENTS } from "@/lib/agents";
import { DeliverableList } from "@/components/DeliverableList";

export const dynamic = "force-dynamic";

export default function DeliverablesPage() {
  const deliverables = getDeliverables();

  const byAgent: Record<string, typeof deliverables> = {};
  for (const d of deliverables) {
    if (!byAgent[d.agentId]) byAgent[d.agentId] = [];
    byAgent[d.agentId].push(d);
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">Deliverables</h1>
        <p className="text-zinc-500 text-sm mt-1">
          All agent deliverables across the team
        </p>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4 mb-8">
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
          <p className="text-zinc-500 text-xs font-medium uppercase tracking-wider">
            Total
          </p>
          <p className="text-2xl font-bold text-white mt-1">
            {deliverables.length}
          </p>
        </div>
        {(["draft", "review", "approved", "published"] as const).map(
          (status) => {
            const count = deliverables.filter(
              (d) => d.status === status
            ).length;
            return (
              <div
                key={status}
                className="bg-zinc-900 border border-zinc-800 rounded-xl p-4"
              >
                <p className="text-zinc-500 text-xs font-medium uppercase tracking-wider">
                  {status}
                </p>
                <p className="text-2xl font-bold text-white mt-1">{count}</p>
              </div>
            );
          }
        )}
      </div>

      {/* By Agent */}
      {AGENTS.map((agent) => {
        const agentDeliverables = byAgent[agent.id] || [];
        return (
          <div key={agent.id} className="mb-8">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-lg">{agent.icon}</span>
              <h2 className="text-lg font-semibold text-white">{agent.name}</h2>
              <span className="text-zinc-500 text-sm">
                ({agentDeliverables.length})
              </span>
            </div>
            <DeliverableList deliverables={agentDeliverables} />
          </div>
        );
      })}
    </div>
  );
}
