import Link from "next/link";
import { AGENTS } from "@/lib/agents";

export const dynamic = "force-dynamic";

export default function GuidelinesPage() {
  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-1">
          <span className="text-2xl">📝</span>
          <h1 className="text-2xl font-bold text-white">Guidelines</h1>
        </div>
        <p className="text-zinc-500 text-sm mt-1">
          Edit agent SOUL.md, AGENTS.md, and view TACIT.md learnings
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {AGENTS.map((agent) => (
          <Link key={agent.id} href={`/guidelines/${agent.id}`}>
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 hover:border-zinc-700 transition-colors">
              <div className="flex items-center gap-3 mb-3">
                <div
                  className="w-10 h-10 rounded-lg flex items-center justify-center text-xl"
                  style={{ backgroundColor: agent.color + "20" }}
                >
                  {agent.icon}
                </div>
                <div>
                  <h3 className="text-white font-medium">{agent.name}</h3>
                  <p className="text-zinc-500 text-xs">{agent.domain}</p>
                </div>
              </div>
              <p className="text-zinc-400 text-sm line-clamp-2">
                {agent.description}
              </p>
              <p className="text-zinc-600 text-xs mt-3">
                SOUL.md · AGENTS.md · TACIT.md
              </p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
