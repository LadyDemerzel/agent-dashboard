export interface Agent {
  id: string;
  name: string;
  domain: string;
  workspace: string;
  status: "idle" | "working" | "review" | "blocked";
  currentTask?: string;
  lastActivity: string;
  deliverableCount: number;
  description: string;
  color: string;
  icon: string;
  sendsTo: string[];
  receivesFrom: string[];
}

export const AGENTS: Agent[] = [
  {
    id: "echo",
    name: "Echo",
    domain: "Market Research",
    workspace: "market-research",
    status: "idle",
    lastActivity: new Date().toISOString(),
    deliverableCount: 0,
    description:
      "Monitor X for AI agent/solopreneur trends, viral posts, pain points, and opportunities.",
    color: "#6366f1",
    icon: "📡",
    sendsTo: ["oracle", "scribe"],
    receivesFrom: ["oracle"],
  },
  {
    id: "ralph",
    name: "Ralph",
    domain: "Engineering",
    workspace: "engineering",
    status: "idle",
    lastActivity: new Date().toISOString(),
    deliverableCount: 0,
    description:
      "Build paywalled skills, tools, MCP servers, and the 10X Solo platform.",
    color: "#10b981",
    icon: "🔧",
    sendsTo: ["clerk", "oracle"],
    receivesFrom: ["oracle", "clerk"],
  },
  {
    id: "scribe",
    name: "Scribe",
    domain: "Content",
    workspace: "content",
    status: "idle",
    lastActivity: new Date().toISOString(),
    deliverableCount: 0,
    description:
      "Create newsletter, X posts, and articles that attract and retain subscribers.",
    color: "#f59e0b",
    icon: "✍️",
    sendsTo: ["demerzel", "clerk"],
    receivesFrom: ["echo", "oracle"],
  },
  {
    id: "oracle",
    name: "Oracle",
    domain: "Strategy",
    workspace: "strategy",
    status: "idle",
    lastActivity: new Date().toISOString(),
    deliverableCount: 0,
    description:
      "Decide what to build based on research and market opportunities.",
    color: "#8b5cf6",
    icon: "🔮",
    sendsTo: ["ralph", "scribe", "echo"],
    receivesFrom: ["echo", "ralph", "demerzel"],
  },
  {
    id: "clerk",
    name: "Clerk",
    domain: "Operations",
    workspace: "operations",
    status: "idle",
    lastActivity: new Date().toISOString(),
    deliverableCount: 0,
    description:
      "Manage payments, authentication, deployment, analytics, and business operations.",
    color: "#ef4444",
    icon: "📋",
    sendsTo: ["demerzel", "oracle"],
    receivesFrom: ["ralph", "scribe", "demerzel"],
  },
];

export function getAgent(id: string): Agent | undefined {
  return AGENTS.find((a) => a.id === id);
}
