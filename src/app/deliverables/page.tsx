import { getDeliverables } from "@/lib/files";
import { getResearchFiles } from "@/lib/research";
import { AGENTS } from "@/lib/agents";
import { DeliverableList } from "@/components/DeliverableList";
import { ResearchList } from "@/components/ResearchCard";
import { Card } from "@/components/ui/card";

export const dynamic = "force-dynamic";

export default function DeliverablesPage() {
  const deliverables = getDeliverables();
  const researchFiles = getResearchFiles();

  const byAgent: Record<string, typeof deliverables> = {};
  for (const d of deliverables) {
    if (!byAgent[d.agentId]) byAgent[d.agentId] = [];
    byAgent[d.agentId].push(d);
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-foreground">Deliverables</h1>
        <p className="text-muted-foreground text-sm mt-1">
          All agent deliverables across the team
        </p>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4 mb-8">
        <Card className="p-4">
          <p className="text-muted-foreground text-xs font-medium uppercase tracking-wider">
            Total
          </p>
          <p className="text-2xl font-bold text-foreground mt-1">
            {deliverables.length + researchFiles.length}
          </p>
        </Card>
        {(["draft", "review", "approved", "published"] as const).map(
          (status) => {
            const deliverableCount = deliverables.filter(
              (d) => d.status === status
            ).length;
            const researchCount = researchFiles.filter(
              (f) => f.status === status || (status === "review" && f.status === "needs review")
            ).length;
            return (
              <Card key={status} className="p-4">
                <p className="text-muted-foreground text-xs font-medium uppercase tracking-wider">
                  {status}
                </p>
                <p className="text-2xl font-bold text-foreground mt-1">{deliverableCount + researchCount}</p>
              </Card>
            );
          }
        )}
      </div>

      {/* By Agent */}
      <div className="space-y-10">
        {AGENTS.map((agent) => {
          const agentDeliverables = byAgent[agent.id] || [];
          const isEcho = agent.id === "echo";

          return (
            <div key={agent.id}>
              <div className="flex items-center gap-2 mb-4">
                <span className="text-lg">{agent.icon}</span>
                <h2 className="text-lg font-semibold text-foreground">{agent.name}</h2>
                <span className="text-muted-foreground text-sm">
                  ({isEcho ? researchFiles.length : agentDeliverables.length})
                </span>
              </div>

              {isEcho ? (
                <ResearchList
                  files={researchFiles}
                  emptyMessage="No research files found yet."
                  emptySubMessage="Echo's research will appear here when available."
                />
              ) : (
                <div className="space-y-4">
                  <DeliverableList deliverables={agentDeliverables} />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
