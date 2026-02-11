import { getDeliverables } from "./files";
import { getXPost } from "./xposts";
import { getResearchFiles } from "./research";
import path from "path";

export type EntityType = "deliverable" | "x-post" | "research";

export interface ResolvedEntity {
  id: string;
  filePath: string;
  agentId: string;
  status: string;
}

const RESEARCH_DIR = path.join(
  process.env.HOME || "/Users/ittaisvidler",
  "tenxsolo",
  "business",
  "market-research",
  "deliverables"
);

const BUSINESS_ROOT = path.join(
  process.env.HOME || "/Users/ittaisvidler",
  "tenxsolo",
  "business"
);

export function resolveEntity(
  type: EntityType,
  id: string
): ResolvedEntity | null {
  switch (type) {
    case "deliverable": {
      const d = getDeliverables().find((d) => d.id === id);
      if (!d) return null;
      return {
        id,
        filePath: path.join(BUSINESS_ROOT, d.relativePath),
        agentId: d.agentId,
        status: d.status,
      };
    }
    case "x-post": {
      const p = getXPost(id);
      if (!p) return null;
      return {
        id,
        filePath: p.filePath,
        agentId: "scribe",
        status: p.status,
      };
    }
    case "research": {
      const files = getResearchFiles();
      const f = files.find((f) => f.id === id);
      if (!f) return null;
      return {
        id,
        filePath: path.join(RESEARCH_DIR, f.filename),
        agentId: "echo",
        status: f.status,
      };
    }
  }
}
