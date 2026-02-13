import path from "path";
import fs from "fs";
import { readFeedback } from "./feedback";

const BUSINESS_ROOT = path.join(
  process.env.HOME || "/Users/ittaisvidler",
  "tenxsolo",
  "business",
);

// Map agent IDs to their OpenClaw agent identifiers
const AGENT_ID_MAP: Record<string, string> = {
  echo: "echo",
  ralph: "ralph",
  scribe: "scribe",
  oracle: "oracle",
  clerk: "clerk",
  demerzel: "demerzel",
};

export interface SpawnTask {
  agentId: string;
  deliverableId: string;
  deliverablePath: string;
  feedbackSummary: string;
  requestedBy: string;
}

/**
 * Get the Gateway URL and hooks token from config
 */
function getGatewayConfig(): { url: string; token: string } {
  // Default values
  let url = "http://127.0.0.1:18789";
  let token = "";

  // Read from openclaw.json config
  const configPath = path.join(
    process.env.HOME || "/Users/ittaisvidler",
    ".openclaw",
    "openclaw.json",
  );

  if (fs.existsSync(configPath)) {
    try {
      const config = JSON.parse(fs.readFileSync(configPath, "utf-8"));

      // Get gateway URL
      if (config.gateway?.port) {
        url = `http://127.0.0.1:${config.gateway.port}`;
      }

      // Get hooks token
      if (config.hooks?.token) {
        token = config.hooks.token;
      }
    } catch {
      // ignore parsing errors
    }
  }

  return { url, token };
}

/**
 * Spawn an agent session to handle feedback on a deliverable
 * Uses: POST /hooks/agent with webhook token
 */
export async function spawnAgentForFeedback(
  agentId: string,
  deliverableId: string,
  deliverablePath: string,
  requestedBy: string = "ittai",
): Promise<{ success: boolean; message: string }> {
  const mappedAgentId = AGENT_ID_MAP[agentId.toLowerCase()];

  if (!mappedAgentId) {
    return {
      success: false,
      message: `Unknown agent ID: ${agentId}`,
    };
  }

  // Read feedback to include in the spawn task
  const fullPath = path.join(BUSINESS_ROOT, deliverablePath);
  const feedback = readFeedback(fullPath);
  const openThreads = feedback.threads.filter((t) => t.status === "open");

  // Build feedback summary
  let feedbackSummary = "";
  if (openThreads.length > 0) {
    feedbackSummary = openThreads
      .map((t, i) => {
        const firstComment = t.comments[0]?.content || "No content";
        return `${i + 1}. ${firstComment.substring(0, 150)}${firstComment.length > 150 ? "..." : ""}`;
      })
      .join("\\n");
  }

  // Build the task prompt
  const taskPrompt = buildFeedbackTaskPrompt(
    mappedAgentId,
    deliverableId,
    deliverablePath,
    feedbackSummary,
    requestedBy,
    openThreads.length,
  );

  const { url, token } = getGatewayConfig();

  if (!token) {
    return {
      success: false,
      message:
        "Hooks token not found in config. Please check ~/.openclaw/openclaw.json",
    };
  }

  try {
    // Call the Gateway webhook endpoint
    const endpoint = `${url}/hooks/agent`;

    const payload = {
      message: taskPrompt,
      agentId: mappedAgentId,
      name: `Feedback-${mappedAgentId}`,
      model: "openrouter/moonshotai/kimi-k2.5",
      sessionKey: `hook:feedback:${mappedAgentId}:${deliverableId}`,
      wakeMode: "now",
      deliver: false, // Don't deliver response to channel, just spawn the agent
    };

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Webhook failed: ${response.status} ${errorText}`);
    }

    const result = await response.json();
    console.log("Spawn response:", result);

    return {
      success: true,
      message: `Spawned ${mappedAgentId} to handle feedback on ${deliverableId}`,
    };
  } catch (error) {
    console.error("Failed to spawn agent via webhook:", error);
    return {
      success: false,
      message: `Failed to spawn ${mappedAgentId}: ${error}`,
    };
  }
}

/**
 * Build the task prompt for the agent to handle feedback.
 *
 * The agent-dashboard skill (Section 2) is already loaded in the agent's
 * system prompt with resolved paths and the full 6-step workflow.
 * This prompt provides the specific context and points the agent there.
 */
function buildFeedbackTaskPrompt(
  agentId: string,
  deliverableId: string,
  deliverablePath: string,
  feedbackSummary: string,
  requestedBy: string,
  threadCount: number,
): string {
  const parts: string[] = [
    `[AGENT: ${agentId}] Changes requested on your deliverable by ${requestedBy}.`,
    ``,
    `Deliverable: ${deliverableId}`,
    `File: ${deliverablePath}`,
    `Open feedback threads: ${threadCount}`,
  ];

  if (feedbackSummary) {
    parts.push(``, `Feedback summary:`, feedbackSummary);
  }

  parts.push(
    ``,
    `Follow the agent-dashboard skill, Section 2 (Feedback Workflow), starting at Step 2 — this deliverable has already been flagged. Complete all six steps through Step 6 (document learnings in AGENTS.md).`,
    ``,
    `Reminder: when responding to feedback threads, use the thread_id field from the feedback JSON, not the comment id.`,
  );

  return parts.join("\n");
}

/**
 * Check if an agent should be spawned for a status change
 * Only spawn when status changes TO "requested changes"
 */
export function shouldSpawnAgent(
  oldStatus: string,
  newStatus: string,
): boolean {
  return newStatus === "requested changes" && oldStatus !== "requested changes";
}
