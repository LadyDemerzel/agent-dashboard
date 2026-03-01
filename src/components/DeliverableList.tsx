import Link from "next/link";
import { StatusBadge } from "./StatusBadge";
import { Card } from "@/components/ui/card";

interface Deliverable {
  id: string;
  agentId: string;
  agentName: string;
  title: string;
  type: string;
  status: string;
  relativePath: string;
  createdAt: string;
  updatedAt: string;
}

const TYPE_ICONS: Record<string, string> = {
  research: "\uD83D\uDCCA",
  code: "\uD83D\uDCBB",
  content: "\uD83D\uDCDD",
  strategy: "\uD83C\uDFAF",
  operations: "\u2699\uFE0F",
};

export function DeliverableList({
  deliverables,
}: {
  deliverables: Deliverable[];
}) {
  if (deliverables.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <p className="text-4xl mb-3">{"\uD83D\uDCED"}</p>
        <p className="text-sm">No deliverables yet</p>
        <p className="text-xs mt-1">
          Agent deliverables will appear here as they&apos;re created
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {deliverables.map((d) => (
        <Link key={d.id} href={`/deliverables/${d.id}`} className="block w-full min-w-0">
          <Card className="p-4 hover:border-border transition-colors cursor-pointer min-w-0">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0 flex-1 overflow-hidden">
                <span className="text-lg flex-shrink-0">
                  {TYPE_ICONS[d.type] || "\uD83D\uDCC4"}
                </span>
                <div className="min-w-0 overflow-hidden">
                  <h4 className="text-foreground text-sm font-medium truncate">
                    {d.title}
                  </h4>
                  <p className="text-muted-foreground text-xs mt-0.5 truncate">
                    {d.agentName} &middot; <span className="break-all">{d.relativePath}</span>
                  </p>
                </div>
              </div>
              <div className="flex-shrink-0">
                <StatusBadge status={d.status} />
              </div>
            </div>
            <div className="mt-2 text-xs text-muted-foreground">
              Updated {new Date(d.updatedAt).toLocaleDateString()}
            </div>
          </Card>
        </Link>
      ))}
    </div>
  );
}
