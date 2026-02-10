# PROMPT_build.md - Agent Dashboard Path Update & Demerzel Addition

## Task Context
You are updating the Agent Dashboard Next.js app to fix agent workspace paths and add Demerzel as a new agent.

## Current File Structure
All files are in ~/tenxsolo/systems/agent-dashboard/src/

## IMPLEMENTATION PLAN

### Task 1: Update src/lib/agents.ts
Add Demerzel to the AGENTS array:
```typescript
{
  id: "demerzel",
  name: "Demerzel",
  domain: "Coordination",
  workspace: "coordination",
  status: "idle",
  lastActivity: new Date().toISOString(),
  deliverableCount: 0,
  description: "Coordinate the 10X Solo agent team and manage cross-agent workflows.",
  color: "#ec4899",
  icon: "🎯",
  sendsTo: ["oracle", "ralph", "scribe", "clerk", "echo"],
  receivesFrom: ["oracle", "ralph", "scribe", "clerk", "echo"],
}
```

### Task 2: Update src/lib/agent-files.ts
1. Change from single AGENTS_ROOT to per-agent paths:
   - echo: ~/.openclaw/workspace-echo/
   - ralph: ~/.openclaw/workspace-ralph/
   - scribe: ~/.openclaw/workspace-scribe/
   - oracle: ~/.openclaw/workspace-oracle/
   - clerk: ~/.openclaw/workspace-clerk/
   - demerzel: ~/.openclaw/workspace/

2. Add "demerzel" to VALID_AGENTS

3. Add MEMORY.md to AgentFiles interface and file reading logic

4. Update getAgentFiles() to use per-agent paths

5. Update saveAgentFile() to use per-agent paths

### Task 3: Update src/lib/sessions.ts
Add "demerzel" to AGENT_SESSION_MAP and statusMap

### Task 4: Update src/lib/files.ts
Add coordination → demerzel mappings:
- AGENT_TYPE_MAP: "coordination": "strategy"
- AGENT_NAME_MAP: "coordination": "Demerzel"  
- AGENT_ID_MAP: "coordination": "demerzel"

### Task 5: Update src/components/AgentFilesEditor.tsx
Add MEMORY.md tab:
```typescript
{ id: "memory", label: "MEMORY.md", description: "Working memory and context" }
```

Update AgentFilesEditorProps and TABS array, add memory to contents state.

## Critical Rules
- Use process.env.HOME for home directory path
- Handle missing files gracefully (return empty string)
- Preserve existing functionality for all other agents
- TypeScript types must be updated consistently across files

## Validation
After each change, verify:
1. TypeScript compiles without errors
2. The file structure is correct
3. No existing functionality is broken
