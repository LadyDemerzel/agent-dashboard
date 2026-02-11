---
title: GitHub-Style PR Review System for Agent Deliverables
type: feat
date: 2026-02-10
---

# GitHub-Style PR Review System for Agent Deliverables

## Enhancement Summary

**Deepened on:** 2026-02-10
**Research agents used:** Architecture Strategist, TypeScript Reviewer, Performance Oracle, Frontend Race Condition Specialist, Code Simplicity Reviewer, Best Practices Researcher, Security Sentinel, Pattern Recognition Specialist, Frontend Design Skill

### Key Improvements from Research
1. **Added Phase 0: Extract shared utilities** to avoid tripling code duplication (every reviewer flagged this)
2. **Simplified Phase 3** — start with "outdated badge" instead of complex line remapping algorithm (simplicity reviewer)
3. **Replaced `window.location.reload()`** with targeted data refetching (performance + race condition reviewers)
4. **Added version limits and input validation** (security + performance reviewers)
5. **Added double-click guard** for status changes (race condition reviewer)

### New Considerations Discovered
- Versions must be **immutable snapshots** — never modify after creation (race condition reviewer)
- Store `lineContent` alongside `startLine/endLine` in feedback threads for smarter outdated detection (best practices researcher — this is how GitHub does it)
- Use `AbortController` for in-flight diff requests to prevent stale data (race condition reviewer)
- Path traversal risk in base64url ID decoding — add validation (security reviewer)

---

## Overview

Build a GitHub PR-style review system into the Agent Dashboard so that when agents update deliverables, users can see version histories with line-by-line diffs, leave inline comments that track across revisions, and treat each deliverable as a single evolving unit rather than seeing duplicate entries per revision.

## Problem Statement

Three issues exist today:

1. **No version tracking in practice.** The version infrastructure (`versions.ts`, `DiffViewer.tsx`, `/api/deliverables/[id]/versions`, `/api/deliverables/[id]/diff`) was built by a previous agent but is **completely dormant** — no `-versions.json` files exist on disk because nothing ever calls `addVersion()`. The UI never renders `DiffViewer` or `VersionSelector`.

2. **Duplicate deliverables in list views.** Research deliverables use timestamp-based filenames (`x-research-2026-02-10-0800.md`, `x-research-2026-02-10-1600.md`), so each research run creates a new file that shows as a separate entry. There's no grouping concept. X-posts are edited in-place so they don't duplicate, but generic deliverables could if agents create new files for revisions instead of editing.

3. **Feedback comments drift after edits.** Inline feedback threads store absolute `startLine`/`endLine` numbers. When an agent revises the content, those line numbers no longer correspond to the right text. There's no mechanism to remap comment positions after content changes.

## Proposed Solution

A phased approach that activates and extends the existing infrastructure:

### Phase 0: Extract Shared Entity Utilities (NEW — prerequisite)

Extract shared logic for version/diff/status operations to eliminate code triplication across the 3 entity types.

### Phase 1: Activate Version Tracking (Backend)

Wire up automatic version snapshots so every meaningful content change is recorded.

### Phase 2: Integrate Diff Viewer into Detail Pages (Frontend)

Add a "Changes" tab to each deliverable detail page showing version history and diffs using the existing `DiffViewer` and `VersionSelector` components.

### Phase 3: Outdated Thread Detection

Mark inline feedback threads as "outdated" when the content they reference changes between versions.

### Phase 4: Research Deliverable Grouping (DEFERRED)

Deferred — research files are separate daily outputs, not revisions. Version tracking from Phases 1-3 handles the actual revision case (x-posts and generic deliverables edited in-place).

## Technical Approach

### Phase 0: Extract Shared Entity Utilities

**Goal:** Create shared utilities so version/diff/status operations are defined once, not 3x.

> **Research Insight (Pattern Recognition, Architecture, Simplicity — unanimous):** The three entity types (deliverables, x-posts, research) have ~90% identical code in their detail pages (~460 lines each) and API routes. Adding version/diff routes without extracting shared logic would create 4 more near-identical files and triple every future bug fix. Extract first, then build.

#### 0a. Create `src/lib/entity-resolver.ts`

A single function that maps any entity type + ID to a file path:

```typescript
// src/lib/entity-resolver.ts
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
  "tenxsolo", "business", "market-research", "deliverables"
);

const BUSINESS_ROOT = path.join(
  process.env.HOME || "/Users/ittaisvidler",
  "tenxsolo", "business"
);

export function resolveEntity(type: EntityType, id: string): ResolvedEntity | null {
  switch (type) {
    case "deliverable": {
      const d = getDeliverables().find((d) => d.id === id);
      if (!d) return null;
      return { id, filePath: path.join(BUSINESS_ROOT, d.relativePath), agentId: d.agentId, status: d.status };
    }
    case "x-post": {
      const p = getXPost(id);
      if (!p) return null;
      return { id, filePath: p.filePath, agentId: "scribe", status: p.status };
    }
    case "research": {
      const files = getResearchFiles();
      const f = files.find((f) => f.id === id);
      if (!f) return null;
      return { id, filePath: path.join(RESEARCH_DIR, f.filename), agentId: "echo", status: f.status };
    }
  }
}
```

#### 0b. Create `src/lib/version-ops.ts`

Shared version snapshot logic called from all 3 status routes:

```typescript
// src/lib/version-ops.ts
import fs from "fs";
import { hasVersions, initializeVersionHistory, addVersion, readVersionHistory } from "./versions";

const MAX_VERSIONS_PER_FILE = 50;

export function snapshotVersionOnStatusChange(
  filePath: string,
  oldStatus: string,
  newStatus: string,
  updatedBy: string,
  note?: string
): void {
  // Only snapshot when agent submits updated work
  if (newStatus !== "needs review") return;

  const currentContent = fs.readFileSync(filePath, "utf-8");

  // Initialize version history if first time
  if (!hasVersions(filePath)) {
    initializeVersionHistory(filePath, currentContent, updatedBy);
    return; // First version is just the initial snapshot
  }

  // Add new version
  addVersion(
    filePath,
    currentContent,
    updatedBy,
    note || "Revised based on feedback"
  );

  // Enforce version limit
  const history = readVersionHistory(filePath);
  if (history.versions.length > MAX_VERSIONS_PER_FILE) {
    history.versions = history.versions.slice(-MAX_VERSIONS_PER_FILE);
    // writeVersionHistory is called by addVersion, so this needs
    // a separate trim step or we adjust addVersion
  }
}
```

> **Research Insight (Performance Oracle):** Full-content storage is fine for this use case. X-posts are ~1KB, research ~7-24KB. Even 50 versions of a 24KB file = 1.2MB — well within reason. Add a MAX_VERSIONS_PER_FILE cap (50) to prevent unbounded growth. Only switch to delta storage if files exceed 500KB.

> **Research Insight (Security Sentinel):** Add size validation — reject version content larger than 5MB to prevent DoS via large payloads.

**Files to create:**
- `src/lib/entity-resolver.ts`
- `src/lib/version-ops.ts`

### Phase 1: Activate Version Tracking

**Goal:** Every time a deliverable transitions to "needs review", automatically snapshot the current file content as a version.

#### 1a. Wire auto-snapshot into status routes

Each status route calls the shared `snapshotVersionOnStatusChange()`:

**`src/app/api/deliverables/[id]/status/route.ts`:**
```typescript
import { snapshotVersionOnStatusChange } from "@/lib/version-ops";

// After appendStatusLog():
snapshotVersionOnStatusChange(filePath, oldStatus, newStatus, updatedBy || "ittai", note);
```

**`src/app/api/x-posts/[id]/feedback/route.ts`:**
```typescript
import { snapshotVersionOnStatusChange } from "@/lib/version-ops";

// In the status change branch, after appendStatusLog():
snapshotVersionOnStatusChange(post.filePath, oldStatus, newStatus, updatedBy || "ittai", feedbackContent);
```

**`src/app/api/research/[id]/feedback/route.ts`:**
```typescript
import { snapshotVersionOnStatusChange } from "@/lib/version-ops";

// After appendStatusLog():
snapshotVersionOnStatusChange(filePath, oldStatus, newStatus, updatedBy || "ittai", feedbackContent);
```

> **Research Insight (Architecture Strategist):** Auto-snapshot on "needs review" is the right trigger — this is when the agent submits updated work. Direct file edits outside the dashboard are out of scope for now. The existing `POST /api/deliverables/[id]/versions` endpoint lets agents explicitly snapshot if needed.

#### 1b. Verify `diff` package is installed

```bash
grep '"diff"' package.json
```

**Files to modify:** 3 status/feedback route files (add ~3 lines each)

### Phase 2: Diff Viewer in Detail Pages

**Goal:** Add a "Content / Changes" tab toggle on each detail page.

#### 2a. Create version/diff API routes for x-posts and research

Since we have `entity-resolver.ts`, these routes are thin wrappers:

**`src/app/api/x-posts/[id]/versions/route.ts`:**
```typescript
import { NextRequest, NextResponse } from "next/server";
import { getXPost } from "@/lib/xposts";
import { getVersionHistoryList, readVersionHistory, addVersion, initializeVersionHistory } from "@/lib/versions";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const post = getXPost(id);
  if (!post) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const versions = getVersionHistoryList(post.filePath);
  const history = readVersionHistory(post.filePath);
  return NextResponse.json({ versions, currentVersion: history.currentVersion });
}

// POST and PUT mirror deliverables pattern
```

**`src/app/api/x-posts/[id]/diff/route.ts`:**
```typescript
import { NextRequest, NextResponse } from "next/server";
import { getXPost } from "@/lib/xposts";
import { generateDiff } from "@/lib/versions";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { searchParams } = new URL(request.url);
  const from = parseInt(searchParams.get("from") || "", 10);
  const to = parseInt(searchParams.get("to") || "", 10);

  const post = getXPost(id);
  if (!post) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (isNaN(from) || isNaN(to)) return NextResponse.json({ error: "Invalid version params" }, { status: 400 });

  const diff = generateDiff(post.filePath, from, to);
  if (!diff) return NextResponse.json({ error: "Versions not found" }, { status: 404 });
  return NextResponse.json(diff);
}
```

Research routes follow the same pattern with `getResearchFiles()`.

**Files to create:**
- `src/app/api/x-posts/[id]/versions/route.ts`
- `src/app/api/x-posts/[id]/diff/route.ts`
- `src/app/api/research/[id]/versions/route.ts`
- `src/app/api/research/[id]/diff/route.ts`

#### 2b. Add "Content / Changes" tab to detail pages

Add to all 3 detail page client components (`DeliverableDetailClient.tsx`, `XPostDetailClient.tsx`, `ResearchDetailClient.tsx`):

**New state:**
```typescript
type ViewMode = "content" | "changes";

interface VersionRange {
  from: number;
  to: number;
}

const [viewMode, setViewMode] = useState<ViewMode>("content");
const [versions, setVersions] = useState<VersionMeta[]>([]);
const [selectedRange, setSelectedRange] = useState<VersionRange | null>(null);
const [diffData, setDiffData] = useState<DiffResult | null>(null);
const [diffLoading, setDiffLoading] = useState(false);
const diffAbortRef = useRef<AbortController | null>(null);
```

> **Research Insight (TypeScript Reviewer):** Use named types (`ViewMode`, `VersionRange`) instead of inline type literals. Group related state — `selectedRange` and `diffData` are tightly coupled.

> **Research Insight (Race Condition Specialist):** Use `AbortController` ref for diff requests — cancel in-flight requests when the user selects different versions:
```typescript
const loadDiff = useCallback(async (from: number, to: number) => {
  if (diffAbortRef.current) diffAbortRef.current.abort();
  const controller = new AbortController();
  diffAbortRef.current = controller;
  setDiffLoading(true);
  try {
    const res = await fetch(`/api/${entityType}/${id}/diff?from=${from}&to=${to}`, {
      signal: controller.signal
    });
    if (res.ok) setDiffData(await res.json());
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") return;
  } finally {
    setDiffLoading(false);
  }
}, [entityType, id]);
```

**Tab bar UI:**

> **Research Insight (Frontend Design Skill):** Use monospace font for tab labels to reinforce the "code review" context. Add a sliding indicator with green accent:

```tsx
<div className="flex items-center gap-1 border-b border-zinc-800 px-6">
  <button
    onClick={() => setViewMode("content")}
    className={`px-4 py-3 text-sm font-mono transition-colors border-b-2 ${
      viewMode === "content"
        ? "text-white border-emerald-500"
        : "text-zinc-500 border-transparent hover:text-zinc-300"
    }`}
  >
    Content
  </button>
  <button
    onClick={() => setViewMode("changes")}
    className={`px-4 py-3 text-sm font-mono transition-colors border-b-2 ${
      viewMode === "changes"
        ? "text-white border-emerald-500"
        : "text-zinc-500 border-transparent hover:text-zinc-300"
    }`}
  >
    Changes {versions.length > 0 && `(${versions.length})`}
  </button>
</div>
```

When "Changes" is selected:
- Render `VersionSelector` in the right sidebar (above status history)
- Render `DiffViewer` in the main content area
- Fetch versions on mount: `GET /api/{type}/{id}/versions`
- Fetch diff on version selection: `GET /api/{type}/{id}/diff?from=X&to=Y`

**Replace `window.location.reload()`:**

> **Research Insight (Performance Oracle + Race Condition Specialist — unanimous):** Replace every `window.location.reload()` with targeted data refetching. This prevents scroll position loss, aborted in-flight requests, and full-page flash:

```typescript
const submitStatusChange = async (status: string, note: string) => {
  if (submitting) return; // Prevent double-clicks
  setSubmitting(true);
  try {
    const res = await fetch(`/api/${entityType}/${id}/status`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status, note }),
    });
    if (res.ok) {
      setSelectedStatus(status);
      await fetchThreads(); // Targeted refetch
      await fetchVersions(); // Refresh version list
    }
  } catch (error) {
    console.error("Failed to update status:", error);
  } finally {
    setSubmitting(false);
    setShowFeedbackModal(false);
    setFeedbackText("");
  }
};
```

**Files to modify:**
- `src/app/deliverables/[id]/DeliverableDetailClient.tsx`
- `src/app/x-posts/[id]/XPostDetailClient.tsx`
- `src/app/research/[id]/ResearchDetailClient.tsx`

### Phase 3: Outdated Thread Detection

**Goal:** When content changes between versions, mark inline feedback threads that reference changed lines as "outdated."

> **Research Insight (Code Simplicity Reviewer):** The original plan proposed a complex `buildLineMap()` using LCS/diff to remap every thread's line numbers. This is over-engineered for the MVP. Start with a simpler approach: **store the referenced line content alongside line numbers**, and mark threads as "outdated" when the content at those lines changes. This is how GitHub handles it — comments are tied to line content, not just line numbers.
>
> Add precise line remapping later ONLY if users request "this comment was on line 50, now it's on line 53" precision.

#### 3a. Update `FeedbackThread` interface

Add optional fields to `src/lib/feedback.ts`:

```typescript
export interface FeedbackThread {
  id: string;
  deliverableId: string;
  agentId: string;
  startLine: number | null;
  endLine: number | null;
  lineContent?: string;          // NEW: content of referenced lines when thread was created
  contentVersion?: number;       // NEW: version number when thread was created
  outdated?: boolean;            // NEW: true if content at those lines has changed
  createdAt: string;
  status: "open" | "resolved";
  comments: FeedbackComment[];
}
```

#### 3b. Store line content when creating threads

When `createThread()` is called with startLine/endLine, also store the content of those lines:

```typescript
export function createThread(
  deliverableFilePath: string,
  deliverableId: string,
  agentId: string,
  startLine: number | null,
  endLine: number | null,
  content: string,
  author: "user" | "agent" = "user"
): FeedbackThread {
  const feedback = readFeedback(deliverableFilePath);

  // Capture referenced line content for outdated detection
  let lineContent: string | undefined;
  if (startLine !== null && endLine !== null) {
    try {
      const fileContent = fs.readFileSync(deliverableFilePath, "utf-8");
      const lines = fileContent.split("\n");
      lineContent = lines.slice(startLine - 1, endLine).join("\n");
    } catch { /* ignore */ }
  }

  // Capture current version number
  const history = readVersionHistory(deliverableFilePath);
  const contentVersion = history.currentVersion || undefined;

  const newThread: FeedbackThread = {
    // ...existing fields...
    lineContent,
    contentVersion,
    outdated: false,
  };

  // ...rest of existing logic...
}
```

#### 3c. Mark threads outdated on version snapshot

Add `markOutdatedThreads()` to `src/lib/feedback.ts`:

```typescript
export function markOutdatedThreads(deliverableFilePath: string): void {
  const feedback = readFeedback(deliverableFilePath);
  if (feedback.threads.length === 0) return;

  let fileContent: string;
  try {
    fileContent = fs.readFileSync(deliverableFilePath, "utf-8");
  } catch {
    return;
  }
  const lines = fileContent.split("\n");
  let changed = false;

  for (const thread of feedback.threads) {
    if (thread.startLine === null || thread.endLine === null) continue;
    if (thread.status === "resolved") continue;
    if (!thread.lineContent) continue; // Legacy threads without stored content

    const currentContent = lines.slice(thread.startLine - 1, thread.endLine).join("\n");
    if (currentContent !== thread.lineContent) {
      thread.outdated = true;
      changed = true;
    }
  }

  if (changed) {
    writeFeedback(deliverableFilePath, feedback);
  }
}
```

Call this from `version-ops.ts` after `snapshotVersionOnStatusChange()`:

```typescript
import { markOutdatedThreads } from "./feedback";

export function snapshotVersionOnStatusChange(...) {
  // ...existing snapshot logic...
  markOutdatedThreads(filePath);
}
```

#### 3d. UI indication for outdated threads

> **Research Insight (Frontend Design Skill):** Use amber/orange for the outdated indicator — not quite an error (red) but requires attention. Add a "OUTDATED" badge:

In `InlineFeedbackThread.tsx`, if a thread has `outdated: true`:

```tsx
{thread.outdated && (
  <div className="flex items-center gap-2 px-3 py-1.5 mb-2 rounded bg-amber-950/50 border border-amber-600/30">
    <span className="text-xs font-mono text-amber-400">OUTDATED</span>
    <span className="text-xs text-amber-500/70">Content has changed since this comment</span>
  </div>
)}
```

In `TopLevelComments.tsx`, show outdated threads with a subtle indicator in their card.

**Files to modify:**
- `src/lib/feedback.ts` — update interface, modify `createThread()`, add `markOutdatedThreads()`
- `src/lib/version-ops.ts` — call `markOutdatedThreads()` after snapshot
- `src/components/InlineFeedbackThread.tsx` — outdated badge
- `src/components/TopLevelComments.tsx` — outdated indicator in thread cards

### Phase 4: Research Deliverable Grouping (DEFERRED)

Deferred — research files are separate daily outputs (each `x-research-YYYY-MM-DD-HHMM.md` is a new research run), not revisions of the same document. The version system from Phases 1-3 handles the actual revision case: x-posts and generic deliverables are edited in-place, and the `-versions.json` captures their change history.

## Acceptance Criteria

### Functional Requirements

- [ ] When a deliverable transitions to "needs review", a version snapshot is automatically created
- [ ] Each deliverable detail page has a "Changes" tab showing version history
- [ ] Selecting two versions in the VersionSelector shows a diff via DiffViewer
- [ ] Version history displays: version number, timestamp, author, optional comment
- [ ] Inline feedback threads store their referenced line content
- [ ] Threads are marked "outdated" when their referenced content changes
- [ ] Outdated threads display an amber "OUTDATED" badge
- [ ] X-posts and research deliverables have the same version/diff capabilities as generic deliverables
- [ ] Status changes use targeted refetching instead of `window.location.reload()`
- [ ] Double-clicking status change is prevented (submitting guard)
- [ ] `npx next build` passes with zero errors

### Non-Functional Requirements

- [ ] No new npm dependencies (the `diff` package is already used by `versions.ts`)
- [ ] Max 50 versions per deliverable (older versions pruned)
- [ ] Version content rejected if > 5MB
- [ ] Diff generation completes in <200ms for typical deliverables (<50KB)

## File Change Summary

### New Files (6)
```
src/lib/entity-resolver.ts                        — shared entity ID → file path resolution
src/lib/version-ops.ts                             — shared version snapshot logic
src/app/api/x-posts/[id]/versions/route.ts         — x-post version history API
src/app/api/x-posts/[id]/diff/route.ts             — x-post diff API
src/app/api/research/[id]/versions/route.ts        — research version history API
src/app/api/research/[id]/diff/route.ts            — research diff API
```

### Modified Files (9)
```
src/app/api/deliverables/[id]/status/route.ts      — call snapshotVersionOnStatusChange()
src/app/api/x-posts/[id]/feedback/route.ts          — call snapshotVersionOnStatusChange()
src/app/api/research/[id]/feedback/route.ts          — call snapshotVersionOnStatusChange()
src/app/deliverables/[id]/DeliverableDetailClient.tsx — add Changes tab, remove reload()
src/app/x-posts/[id]/XPostDetailClient.tsx           — add Changes tab, remove reload()
src/app/research/[id]/ResearchDetailClient.tsx        — add Changes tab, remove reload()
src/lib/feedback.ts                                   — update interface, add markOutdatedThreads()
src/components/InlineFeedbackThread.tsx               — outdated badge
src/components/TopLevelComments.tsx                    — outdated indicator
```

### Unchanged (leveraged as-is)
```
src/lib/versions.ts              — already complete
src/components/DiffViewer.tsx     — already complete
src/app/api/deliverables/[id]/versions/route.ts — already complete
src/app/api/deliverables/[id]/diff/route.ts     — already complete
```

## Implementation Order

1. **Phase 0** — Create `entity-resolver.ts` and `version-ops.ts` (2 new files, ~80 lines)
2. **Phase 1** — Wire `snapshotVersionOnStatusChange()` into 3 status routes (~3 lines each)
3. **Phase 2a** — Create version/diff API routes for x-posts and research (4 new files, ~50 lines each)
4. **Phase 2b** — Add tab UI + remove `reload()` in 3 detail pages (~80 lines each)
5. **Phase 3a** — Update `FeedbackThread` interface + `createThread()` + `markOutdatedThreads()` (~40 lines)
6. **Phase 3b** — Outdated thread UI indicators (~15 lines each in 2 components)

Total: ~600 lines of new/modified code across 15 files.

## References

### Internal References
- Version infrastructure: `src/lib/versions.ts` (fully built, 317 lines)
- Diff UI components: `src/components/DiffViewer.tsx` (fully built, 314 lines)
- Feedback system: `src/lib/feedback.ts:64` (`createThread`)
- Deliverable discovery: `src/lib/files.ts:93` (`getDeliverables`)
- X-post discovery: `src/lib/xposts.ts:87` (`getXPosts`)
- Research discovery: `src/lib/research.ts:172` (`getResearchFiles`)
- Existing version API: `src/app/api/deliverables/[id]/versions/route.ts`
- Existing diff API: `src/app/api/deliverables/[id]/diff/route.ts`

### External References (from Best Practices Research)
- [jsdiff (diff npm package)](https://github.com/kpdecker/jsdiff) — adequate for this use case
- [GitHub's outdated comment handling](https://github.com/orgs/community/discussions/3478) — comments attached to commit + line content
- [react-diff-viewer-continued](https://npm-compare.com/react-diff-view,react-diff-viewer,react-diff-viewer-continued) — 168K weekly downloads, alternative to custom DiffViewer
- [MongoDB Document Versioning Pattern](https://www.mongodb.com/company/blog/building-with-patterns-the-document-versioning-pattern) — full snapshot approach validated for small documents
