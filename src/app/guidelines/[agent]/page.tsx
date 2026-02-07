import { notFound } from "next/navigation";
import Link from "next/link";
import { getGuidelineFiles, isValidAgent } from "@/lib/guidelines";
import { getAgent } from "@/lib/agents";
import { GuidelinesEditor } from "@/components/GuidelinesEditor";

export const dynamic = "force-dynamic";

export default async function GuidelinesAgentPage({
  params,
}: {
  params: Promise<{ agent: string }>;
}) {
  const { agent: agentId } = await params;

  if (!isValidAgent(agentId)) notFound();

  const agent = getAgent(agentId);
  const files = getGuidelineFiles(agentId);

  if (!agent || !files) notFound();

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-5xl">
      <Link
        href="/guidelines"
        className="text-zinc-500 hover:text-white text-sm mb-6 inline-flex items-center gap-1 transition-colors"
      >
        &larr; Back to Guidelines
      </Link>

      {/* Agent Header */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 mb-6">
        <div className="flex items-center gap-4">
          <div
            className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl"
            style={{ backgroundColor: agent.color + "20" }}
          >
            {agent.icon}
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">
              {agent.name} Guidelines
            </h1>
            <p className="text-zinc-500 text-sm">{agent.domain}</p>
          </div>
        </div>
      </div>

      <GuidelinesEditor
        agentId={agentId}
        soul={files.soul}
        agents={files.agents}
        tacit={files.tacit}
      />
    </div>
  );
}
