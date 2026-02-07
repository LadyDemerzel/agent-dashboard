import { getDeliverables } from "@/lib/files";
import { AGENTS } from "@/lib/agents";
import { Timeline } from "@/components/Timeline";
import { buildTimelineEvents } from "@/lib/timeline";

export const dynamic = "force-dynamic";

export default function TimelinePage() {
  const deliverables = getDeliverables();

  const agentIcons: Record<string, string> = {};
  for (const a of AGENTS) {
    agentIcons[a.id] = a.icon;
  }

  const events = buildTimelineEvents(deliverables, agentIcons);

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-3xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">Activity Timeline</h1>
        <p className="text-zinc-500 text-sm mt-1">
          Chronological log of agent activity and deliverables
        </p>
      </div>

      <Timeline events={events} />
    </div>
  );
}
