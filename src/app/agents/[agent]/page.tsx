import { notFound } from "next/navigation";
import Link from "next/link";
import { getAgentFiles, isValidAgent } from "@/lib/agent-files";
import { getAgent } from "@/lib/agents";
import { getAgentStatusWithSessions } from "@/lib/sessions";
import { AgentFilesEditor } from "@/components/AgentFilesEditor";
import { AgentStatusStatic } from "@/components/AgentStatus";

export const dynamic = "force-dynamic";

export default async function AgentDetailPage({
  params,
}: {
  params: Promise<{ agent: string }>;
}) {
  const { agent: agentId } = await params;

  if (!isValidAgent(agentId)) notFound();

  const agent = getAgent(agentId);
  const files = getAgentFiles(agentId);
  const sessionStatus = getAgentStatusWithSessions();

  if (!agent || !files) notFound();

  const status = sessionStatus[agentId]?.status ?? agent.status;
  const currentTask = sessionStatus[agentId]?.currentTask;

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-5xl">
      <Link
        href="/agents"
        className="text-zinc-500 hover:text-white text-sm mb-6 inline-flex items-center gap-1 transition-colors"
      >
        &larr; Back to Agents
      </Link>

      {/* Agent Header with Status */}
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
          <AgentStatusStatic
            status={status}
            currentTask={currentTask}
            showTask={false}
            size="md"
          />
        </div>

        {/* Current Task Display */}
        {currentTask && (
          <div className="mt-4 p-3 bg-zinc-800/50 rounded-lg border border-zinc-800">
            <p className="text-xs text-zinc-500 uppercase tracking-wider mb-1">
              Current Task
            </p>
            <p className="text-zinc-300 text-sm">{currentTask}</p>
          </div>
        )}
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
