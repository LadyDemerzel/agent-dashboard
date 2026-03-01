import Link from "next/link";
import { AGENTS } from "@/lib/agents";
import { Card } from "@/components/ui/card";

export const dynamic = "force-dynamic";

export default function AgentsPage() {
  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-1">
          <span className="text-2xl">🤖</span>
          <h1 className="text-2xl font-bold text-foreground">Agents</h1>
        </div>
        <p className="text-muted-foreground text-sm mt-1">
          Manage agent configurations and view their workspace files
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {AGENTS.map((agent) => (
          <Link
            key={agent.id}
            href={`/agents/${agent.id}`}
            className="block"
          >
            <Card className="p-5 hover:border-border transition-colors">
              <div className="flex items-center gap-3 mb-3">
                <div
                  className="w-10 h-10 rounded-lg flex items-center justify-center text-xl"
                  style={{ backgroundColor: agent.color + "20" }}
                >
                  {agent.icon}
                </div>
                <div>
                  <h3 className="text-foreground font-medium">{agent.name}</h3>
                  <p className="text-muted-foreground text-xs">{agent.domain}</p>
                </div>
              </div>
              <p className="text-muted-foreground text-sm line-clamp-2">
                {agent.description}
              </p>
              <p className="text-muted-foreground text-xs mt-3">
                SOUL.md · AGENTS.md · USER.md · TOOLS.md · BOOTSTRAP.md · HEARTBEAT.md · IDENTITY.md · MEMORY.md
              </p>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
