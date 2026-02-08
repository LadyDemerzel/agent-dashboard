import { notFound } from "next/navigation";
import Link from "next/link";
import { getAgent, AGENTS } from "@/lib/agents";
import { getDeliverables, getAgentStats } from "@/lib/files";
import { getAgentStatusWithSessions } from "@/lib/sessions";
import { AgentStatus, AgentStatusStatic } from "@/components/AgentStatus";
import { DeliverableList } from "@/components/DeliverableList";

export const dynamic = "force-dynamic";

export function generateStaticParams() {
  return AGENTS.map((agent) => ({ id: agent.id }));
}

export default async function AgentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const agent = getAgent(id);
  if (!agent) notFound();

  const stats = getAgentStats();
  const deliverables = getDeliverables(id);
  const sessionStatus = getAgentStatusWithSessions();

  const agentWithStats = {
    ...agent,
    deliverableCount: stats[id]?.deliverableCount ?? 0,
    lastActivity: stats[id]?.lastActivity ?? agent.lastActivity,
    status: sessionStatus[id]?.status ?? agent.status,
    currentTask: sessionStatus[id]?.currentTask,
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <Link
        href="/"
        className="text-zinc-500 hover:text-white text-sm mb-6 inline-flex items-center gap-1 transition-colors"
      >
        &larr; Back to Dashboard
      </Link>

      {/* Agent Header */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 mb-8">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div
              className="w-14 h-14 rounded-xl flex items-center justify-center text-2xl"
              style={{ backgroundColor: agentWithStats.color + "20" }}
            >
              {agentWithStats.icon}
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">
                {agentWithStats.name}
              </h1>
              <p className="text-zinc-500">{agentWithStats.domain}</p>
            </div>
          </div>
          <AgentStatus
            agentId={agentWithStats.id}
            size="lg"
            showTask={false}
          />
        </div>

        <p className="text-zinc-400 mt-4">{agentWithStats.description}</p>

        {agentWithStats.currentTask && (
          <div className="mt-4 p-3 bg-zinc-800 rounded-lg">
            <p className="text-xs text-zinc-500 uppercase tracking-wider mb-1">
              Current Task
            </p>
            <p className="text-white text-sm">{agentWithStats.currentTask}</p>
          </div>
        )}

        {/* Coordination */}
        <div className="mt-4 grid grid-cols-2 gap-4">
          <div>
            <p className="text-xs text-zinc-500 uppercase tracking-wider mb-2">
              Sends To
            </p>
            <div className="flex flex-wrap gap-1.5">
              {agentWithStats.sendsTo.map((name) => (
                <span
                  key={name}
                  className="px-2 py-0.5 bg-zinc-800 rounded text-xs text-zinc-400"
                >
                  {name}
                </span>
              ))}
            </div>
          </div>
          <div>
            <p className="text-xs text-zinc-500 uppercase tracking-wider mb-2">
              Receives From
            </p>
            <div className="flex flex-wrap gap-1.5">
              {agentWithStats.receivesFrom.map((name) => (
                <span
                  key={name}
                  className="px-2 py-0.5 bg-zinc-800 rounded text-xs text-zinc-400"
                >
                  {name}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="mt-4 flex gap-6 text-sm">
          <div>
            <span className="text-zinc-500">Deliverables: </span>
            <span className="text-white">
              {agentWithStats.deliverableCount}
            </span>
          </div>
          <div>
            <span className="text-zinc-500">Workspace: </span>
            <span className="text-zinc-400 font-mono text-xs">
              ~/tenxsolo/business/{agent.workspace}/
            </span>
          </div>
        </div>
      </div>

      {/* Deliverables */}
      <div>
        <h2 className="text-lg font-semibold text-white mb-4">Deliverables</h2>
        <DeliverableList deliverables={deliverables} />
      </div>
    </div>
  );
}
