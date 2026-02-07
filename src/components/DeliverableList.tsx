import { StatusBadge } from "./StatusBadge";

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
  research: "📊",
  code: "💻",
  content: "📝",
  strategy: "🎯",
  operations: "⚙️",
};

export function DeliverableList({
  deliverables,
}: {
  deliverables: Deliverable[];
}) {
  if (deliverables.length === 0) {
    return (
      <div className="text-center py-12 text-zinc-500">
        <p className="text-4xl mb-3">📭</p>
        <p className="text-sm">No deliverables yet</p>
        <p className="text-xs mt-1">
          Agent deliverables will appear here as they&apos;re created
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {deliverables.map((d) => (
        <div
          key={d.id}
          className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 hover:border-zinc-700 transition-colors"
        >
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <span className="text-lg">{TYPE_ICONS[d.type] || "📄"}</span>
              <div>
                <h4 className="text-white text-sm font-medium">{d.title}</h4>
                <p className="text-zinc-500 text-xs mt-0.5">
                  {d.agentName} &middot; {d.relativePath}
                </p>
              </div>
            </div>
            <StatusBadge status={d.status} />
          </div>
          <div className="mt-2 text-xs text-zinc-600">
            Updated {new Date(d.updatedAt).toLocaleDateString()}
          </div>
        </div>
      ))}
    </div>
  );
}
