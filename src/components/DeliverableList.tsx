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
  research: "RS",
  code: "CD",
  content: "CT",
  strategy: "ST",
  operations: "OP",
};

export function DeliverableList({
  deliverables,
}: {
  deliverables: Deliverable[];
}) {
  if (deliverables.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <p className="text-2xl mb-3 font-semibold">DL</p>
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
          <Card className="p-4 min-w-0 cursor-pointer transition-all duration-200 hover:border-ring/70 hover:bg-muted/80">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0 flex-1 overflow-hidden">
                <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-md border border-border bg-muted px-1 text-[10px] font-semibold leading-none tracking-wide flex-shrink-0">
                  {TYPE_ICONS[d.type] || "FL"}
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
