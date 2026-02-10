# Agent Dashboard Update - Requirements

## Job to Be Done
Update the Agent Dashboard web app to:
1. Fix agent workspace paths (old symlinks deleted, need to read from ~/.openclaw/workspace-<agent>/)
2. Add Demerzel as a new agent alongside the existing agents

## Current State
- Dashboard reads agent files from `~/tenxsolo/agents/<agent>/` (symlinks that no longer exist)
- Only 5 agents: echo, ralph, scribe, oracle, clerk
- Files displayed: SOUL.md, AGENTS.md, USER.md, TOOLS.md, BOOTSTRAP.md, HEARTBEAT.md, IDENTITY.md

## Required Changes

### 1. Fix Agent Workspace Paths

Update file reading logic in `src/lib/agent-files.ts`:

| Agent | Old Path | New Path |
|-------|----------|----------|
| Echo | ~/tenxsolo/agents/echo/ | ~/.openclaw/workspace-echo/ |
| Ralph | ~/tenxsolo/agents/ralph/ | ~/.openclaw/workspace-ralph/ |
| Scribe | ~/tenxsolo/agents/scribe/ | ~/.openclaw/workspace-scribe/ |
| Oracle | ~/tenxsolo/agents/oracle/ | ~/.openclaw/workspace-oracle/ |
| Clerk | ~/tenxsolo/agents/clerk/ | ~/.openclaw/workspace-clerk/ |
| Demerzel | N/A | ~/.openclaw/workspace/ |

### 2. Add Demerzel to Dashboard

Update `src/lib/agents.ts`:
- Add Demerzel to AGENTS array with:
  - id: "demerzel"
  - name: "Demerzel"
  - domain: "Coordination"
  - workspace: "coordination" (for deliverable routing)
  - status: "idle"
  - description: "Coordinate the 10X Solo agent team and manage cross-agent workflows."
  - color: "#ec4899" (pink)
  - icon: "🎯"
  - sendsTo: ["oracle", "ralph", "scribe", "clerk", "echo"]
  - receivesFrom: ["oracle", "ralph", "scribe", "clerk", "echo"]

Update `src/lib/agent-files.ts`:
- Add "demerzel" to VALID_AGENTS
- Add MEMORY.md to the file list (Demerzel has MEMORY.md instead of BOOTSTRAP.md)
- Handle Demerzel's different workspace path (no -demerzel suffix)

Update `src/lib/sessions.ts`:
- Add "demerzel" to AGENT_SESSION_MAP
- Add "demerzel" to statusMap

Update `src/lib/files.ts`:
- Add coordination → demerzel mappings for deliverables

Update `src/components/AgentFilesEditor.tsx`:
- Add MEMORY.md tab for all agents

## Files to Modify
1. src/lib/agents.ts - Add Demerzel agent
2. src/lib/agent-files.ts - Update paths and add Demerzel
3. src/lib/sessions.ts - Add Demerzel to session tracking
4. src/lib/files.ts - Add coordination workspace mapping
5. src/components/AgentFilesEditor.tsx - Add MEMORY.md tab

## Acceptance Criteria
- [ ] All 5 existing agents load files from correct ~/.openclaw/workspace-<agent>/ paths
- [ ] Demerzel appears in the agents list
- [ ] Demerzel's files load from ~/.openclaw/workspace/
- [ ] Demerzel's files (SOUL.md, AGENTS.md, USER.md, MEMORY.md, TOOLS.md, etc.) are viewable and editable
- [ ] Demerzel shows status and current task from sessions
- [ ] MEMORY.md tab appears for all agents (empty for most, populated for Demerzel)
