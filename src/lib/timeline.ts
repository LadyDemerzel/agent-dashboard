export interface TimelineEvent {
  id: string;
  agentId: string;
  agentName: string;
  agentIcon: string;
  action: string;
  detail: string;
  timestamp: string;
}

export function buildTimelineEvents(
  deliverables: Array<{
    id: string;
    agentId: string;
    agentName: string;
    title: string;
    status: string;
    updatedAt: string;
  }>,
  agentIcons: Record<string, string>
): TimelineEvent[] {
  return deliverables.map((d) => ({
    id: d.id,
    agentId: d.agentId,
    agentName: d.agentName,
    agentIcon: agentIcons[d.agentId] || "📄",
    action: statusToAction(d.status),
    detail: d.title,
    timestamp: d.updatedAt,
  }));
}

function statusToAction(status: string): string {
  switch (status) {
    case "draft":
      return "created a draft";
    case "review":
      return "submitted for review";
    case "approved":
      return "got approval for";
    case "published":
      return "published";
    default:
      return "updated";
  }
}
