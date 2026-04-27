"use client";

import { useState, useEffect, useCallback } from "react";
import useSWR from "swr";
import Link from "next/link";
import { useRouter } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { StatusBadge } from "@/components/StatusBadge";
import { LineNumberedContent } from "@/components/LineNumberedContent";
import { TopLevelComments } from "@/components/TopLevelComments";
import { DiffViewer, VersionSelector } from "@/components/DiffViewer";
import { FeedbackThread as FeedbackThreadType } from "@/lib/feedback";
import { DiffResult } from "@/lib/versions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { TabsList, TabsTrigger } from "@/components/ui/tabs";
import { OrbitLoader, Skeleton } from "@/components/ui/loading";
import { TabTransition } from "@/components/ui/tab-transition";
import { jsonFetcher, realtimeSWRConfig } from "@/lib/swr-fetcher";
import {
  DialogOverlay,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

interface Deliverable {
  id: string;
  agentId: string;
  agentName: string;
  title: string;
  type: string;
  status: string;
  filePath: string;
  relativePath: string;
  createdAt: string;
  updatedAt: string;
  size: number;
}

interface StatusLogEntry {
  timestamp: string;
  from: string;
  to: string;
  by: string;
  note: string;
}

interface DeliverableDetailPageProps {
  deliverable: Deliverable;
  content: string;
  statusLog: { logs: StatusLogEntry[] };
}

export function DeliverableDetailClient({
  deliverable,
  content,
  statusLog,
}: DeliverableDetailPageProps) {
  const router = useRouter();
  const [threads, setThreads] = useState<FeedbackThreadType[]>([]);
  const [selectedRange, setSelectedRange] = useState<{ startLine: number; endLine: number } | null>(null);
  const [isCreatingThread, setIsCreatingThread] = useState(false);
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const [selectedStatus, setSelectedStatus] = useState(deliverable.status);
  const [showFeedbackWarning, setShowFeedbackWarning] = useState(false);
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [feedbackText, setFeedbackText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(content);
  const [savingEdit, setSavingEdit] = useState(false);

  const [hiddenThreads, setHiddenThreads] = useState<Set<string>>(new Set());
  const [showHiddenThreads, setShowHiddenThreads] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(`hidden-threads-${deliverable.id}`);
      if (stored) setHiddenThreads(new Set(JSON.parse(stored)));
    } catch { /* ignore */ }
  }, [deliverable.id]);

  const saveHiddenThreads = (newHidden: Set<string>) => {
    setHiddenThreads(newHidden);
    try {
      localStorage.setItem(`hidden-threads-${deliverable.id}`, JSON.stringify([...newHidden]));
    } catch { /* ignore */ }
  };

  const handleHideThread = (threadId: string) => {
    const newHidden = new Set(hiddenThreads);
    if (newHidden.has(threadId)) newHidden.delete(threadId);
    else newHidden.add(threadId);
    saveHiddenThreads(newHidden);
  };

  const visibleThreads = threads.filter((t) => !hiddenThreads.has(t.id));
  const visibleHighlightLines = visibleThreads
    .filter((t) => t.status === "open" && t.startLine !== null && t.endLine !== null)
    .map((t) => ({ startLine: t.startLine!, endLine: t.endLine!, color: "bg-amber-500/15" }));
  const hiddenCount = threads.filter((t) => hiddenThreads.has(t.id)).length;

  type ViewMode = "content" | "changes";
  const [viewMode, setViewMode] = useState<ViewMode>("content");
  const [contentDisplayMode, setContentDisplayMode] = useState<"raw" | "rendered">("raw");
  const [versions, setVersions] = useState<Array<{ version: number; timestamp: string; updatedBy: string; comment?: string }>>([]);
  const [currentVersion, setCurrentVersion] = useState(0);
  const [compareVersion, setCompareVersion] = useState<number | undefined>(undefined);
  const {
    data: versionsPayload,
    mutate: fetchVersions,
  } = useSWR<{
    versions?: Array<{ version: number; timestamp: string; updatedBy: string; comment?: string }>;
    currentVersion?: number;
  }>(`/api/deliverables/${deliverable.id}/versions`, jsonFetcher, realtimeSWRConfig);

  useEffect(() => {
    if (!versionsPayload) return;
    setVersions(versionsPayload.versions || []);
    if (versionsPayload.currentVersion) {
      setCurrentVersion(versionsPayload.currentVersion);
      if ((versionsPayload.versions?.length ?? 0) >= 2) setCompareVersion(versionsPayload.currentVersion - 1);
    }
  }, [versionsPayload]);

  const diffKey = viewMode === "changes" && currentVersion && compareVersion
    ? `/api/deliverables/${deliverable.id}/diff?from=${compareVersion}&to=${currentVersion}`
    : null;
  const { data: diffData = null, isLoading: diffLoading } = useSWR<DiffResult>(diffKey, jsonFetcher, realtimeSWRConfig);

  const {
    data: threadsPayload,
    isLoading: loading,
    mutate: fetchThreads,
  } = useSWR<{ threads: FeedbackThreadType[] }>(`/api/deliverables/${deliverable.id}/feedback`, jsonFetcher, {
    ...realtimeSWRConfig,
    refreshInterval: 5000,
  });

  useEffect(() => {
    if (threadsPayload) setThreads(threadsPayload.threads || []);
  }, [threadsPayload]);

  const handleLineRangeSelect = useCallback((startLine: number, endLine: number) => {
    setSelectedRange({ startLine, endLine });
    setIsCreatingThread(false);
  }, []);

  const handleCreateThread = async (startLine: number, endLine: number, content: string) => {
    const res = await fetch(`/api/deliverables/${deliverable.id}/feedback`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ startLine, endLine, content }),
    });
    if (res.ok) { await fetchThreads(); setSelectedRange(null); }
  };

  const handleCreateTopLevelThread = async (content: string) => {
    const res = await fetch(`/api/deliverables/${deliverable.id}/feedback`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content }),
    });
    if (res.ok) await fetchThreads();
  };

  const handleAddComment = async (threadId: string, content: string) => {
    const res = await fetch(`/api/deliverables/${deliverable.id}/feedback/${threadId}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content, author: "user" }),
    });
    if (res.ok) await fetchThreads();
  };

  const handleResolveThread = async (threadId: string) => {
    const res = await fetch(`/api/deliverables/${deliverable.id}/feedback/${threadId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "resolved" }),
    });
    if (res.ok) await fetchThreads();
  };

  const handleReopenThread = async (threadId: string) => {
    const res = await fetch(`/api/deliverables/${deliverable.id}/feedback/${threadId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "open" }),
    });
    if (res.ok) await fetchThreads();
  };

  const handleStatusChange = async (newStatus: string) => {
    if (newStatus === "requested changes") {
      const openThreads = threads.filter((t) => t.status === "open");
      if (openThreads.length === 0) setShowFeedbackWarning(true);
      else setShowFeedbackModal(true);
    } else if (newStatus !== selectedStatus) {
      await submitStatusChange(newStatus, "");
    }
  };

  const submitStatusChange = async (status: string, note: string) => {
    setSubmitting(true);
    try {
      const res = await fetch(`/api/deliverables/${deliverable.id}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, note }),
      });
      if (res.ok) {
        setSelectedStatus(status);
        await fetchThreads();
        await fetchVersions();
      }
    } catch (error) {
      console.error("Failed to update status:", error);
    } finally {
      setSubmitting(false);
      setShowFeedbackModal(false);
      setShowFeedbackWarning(false);
    }
  };

  const openThreadsCount = threads.filter((t) => t.status === "open").length;

  const handleDelete = async () => {
    setDeleting(true);
    try {
      const res = await fetch(`/api/deliverables/${deliverable.id}/status`, { method: "DELETE" });
      if (res.ok) router.push("/deliverables");
    } catch { /* ignore */ }
    setDeleting(false);
  };

  const handleSaveEdit = async () => {
    setSavingEdit(true);
    try {
      const res = await fetch(`/api/deliverables/${deliverable.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: editContent }),
      });
      if (res.ok) { setIsEditing(false); router.refresh(); }
    } catch (error) {
      console.error("Failed to save edit:", error);
    } finally {
      setSavingEdit(false);
    }
  };

  const handleCancelEdit = () => { setIsEditing(false); setEditContent(content); };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Header */}
          <Card className="p-6">
            <div className="flex items-start justify-between mb-4">
              <div className="flex-1 min-w-0">
                <h1 className="text-xl font-bold text-foreground">{deliverable.title}</h1>
                <p className="text-muted-foreground text-sm mt-1">
                  {formatDate(deliverable.createdAt)} {" · "} {deliverable.relativePath}
                </p>
              </div>
              <StatusBadge status={selectedStatus} />
            </div>

            <div className="grid grid-cols-2 gap-4 text-sm mb-4">
              <div>
                <span className="text-muted-foreground">Agent: </span>
                <Link href={`/agents/${deliverable.agentId}`} className="text-foreground hover:text-foreground transition-colors">
                  {deliverable.agentName}
                </Link>
              </div>
              <div>
                <span className="text-muted-foreground">Type: </span>
                <span className="text-foreground capitalize">{deliverable.type}</span>
              </div>
            </div>

            {/* Status Change */}
            <div className="flex items-center gap-3">
              <Label>Status:</Label>
              <Select value={selectedStatus} onChange={(e) => handleStatusChange(e.target.value)} disabled={submitting}>
                <option value="draft">Draft</option>
                <option value="needs review">Needs Review</option>
                <option value="requested changes">Requested Changes</option>
                <option value="approved">Approved</option>
                <option value="published">Published</option>
                <option value="archived">Archived</option>
              </Select>
              <div className="ml-auto flex items-center gap-3">
                {isEditing ? (
                  <>
                    <Button variant="ghost" size="sm" onClick={handleCancelEdit}>Cancel</Button>
                    <Button variant="success" size="sm" onClick={handleSaveEdit} disabled={savingEdit}>
                      {savingEdit ? "Saving..." : "Save"}
                    </Button>
                  </>
                ) : (
                  <>
                    <Button variant="ghost" size="sm" onClick={() => { setEditContent(content); setIsEditing(true); }}>Edit</Button>
                    <Button variant="ghost" size="sm" className="hover:text-red-400" onClick={() => setShowDeleteConfirm(true)}>Delete</Button>
                  </>
                )}
              </div>
            </div>
          </Card>

          {/* Content / Changes Tabs */}
          <Card className="overflow-hidden">
            <TabsList>
              <TabsTrigger active={viewMode === "content"} onClick={() => setViewMode("content")}>Content</TabsTrigger>
              <TabsTrigger active={viewMode === "changes"} onClick={() => setViewMode("changes")}>
                Changes {versions.length >= 2 && `(${versions.length})`}
              </TabsTrigger>

              <div className="flex items-center gap-3 ml-auto">
                {hiddenCount > 0 && (
                  <Button variant="ghost" size="sm" className="h-auto py-0.5 text-xs" onClick={() => setShowHiddenThreads(!showHiddenThreads)}>
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                    {showHiddenThreads ? "Hide" : "Show"} hidden ({hiddenCount})
                  </Button>
                )}
                {viewMode === "content" && (
                  <div className="flex items-center bg-background border border-border rounded-lg p-1">
                    <Button
                      variant={contentDisplayMode === "raw" ? "default" : "ghost"}
                      size="sm"
                      className="h-auto px-3 py-1.5 text-xs rounded-md"
                      onClick={() => setContentDisplayMode("raw")}
                    >
                      Raw
                    </Button>
                    <Button
                      variant={contentDisplayMode === "rendered" ? "default" : "ghost"}
                      size="sm"
                      className="h-auto px-3 py-1.5 text-xs rounded-md"
                      onClick={() => setContentDisplayMode("rendered")}
                    >
                      Rendered
                    </Button>
                  </div>
                )}
                {viewMode === "content" && selectedRange && (
                  <>
                    <span className="text-xs text-muted-foreground">
                      Selected {selectedRange.startLine === selectedRange.endLine ? `line ${selectedRange.startLine}` : `lines ${selectedRange.startLine}-${selectedRange.endLine}`}
                    </span>
                    <Button variant="ghost" size="sm" className="h-auto text-xs" onClick={() => setSelectedRange(null)}>Clear</Button>
                  </>
                )}
              </div>
            </TabsList>

            {viewMode === "content" && (
              <TabTransition transitionKey="deliverable-content" className="p-0">
                {loading ? (
                  <div className="p-6 space-y-4 bg-background">
                    <Skeleton className="h-5 w-36" />
                    {Array.from({ length: 9 }).map((_, idx) => (
                      <Skeleton key={idx} className="h-4 w-full" />
                    ))}
                    <OrbitLoader label="Loading feedback threads" />
                  </div>
                ) : content ? (
                  <div className="bg-background">
                    {isEditing ? (
                      <div className="p-4">
                        <Textarea
                          value={editContent}
                          onChange={(e) => setEditContent(e.target.value)}
                          className="h-[500px] font-mono resize-y"
                          spellCheck={false}
                        />
                        <div className="flex items-center justify-between mt-3 pt-3 border-t border-border">
                          <span className="text-xs text-muted-foreground">Editing directly - click Save to persist changes</span>
                          <div className="flex items-center gap-2">
                            <Button variant="ghost" size="sm" onClick={handleCancelEdit}>Cancel</Button>
                            <Button variant="success" size="sm" onClick={handleSaveEdit} disabled={savingEdit}>
                              {savingEdit ? "Saving..." : "Save Changes"}
                            </Button>
                          </div>
                        </div>
                      </div>
                    ) : contentDisplayMode === "raw" ? (
                      <div className="p-4">
                        <LineNumberedContent
                          content={content}
                          onLineRangeSelect={handleLineRangeSelect}
                          selectedRange={selectedRange}
                          highlightLines={visibleHighlightLines}
                          threads={threads}
                          onAddComment={handleAddComment}
                          onResolveThread={handleResolveThread}
                          onReopenThread={handleReopenThread}
                          onHideThread={handleHideThread}
                          onShowThread={handleHideThread}
                          hiddenThreadIds={hiddenThreads}
                          showHiddenThreads={showHiddenThreads}
                          onCreateThread={handleCreateThread}
                          isCreatingThread={isCreatingThread}
                          setIsCreatingThread={setIsCreatingThread}
                          activeThreadId={activeThreadId}
                          setActiveThreadId={setActiveThreadId}
                        />
                      </div>
                    ) : (
                      <div className="p-8 prose prose-invert prose-zinc max-w-none">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-muted-foreground text-sm p-6">Unable to load deliverable content.</p>
                )}
              </TabTransition>
            )}

            {viewMode === "changes" && (
              <TabTransition transitionKey="deliverable-changes" className="p-4 space-y-4">
                {versions.length === 0 ? (
                  <div className="text-center py-12">
                    <div className="w-12 h-12 bg-muted rounded-full flex items-center justify-center mx-auto mb-3">
                      <svg className="w-6 h-6 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                      </svg>
                    </div>
                    <p className="text-sm text-muted-foreground">No version history yet</p>
                    <p className="text-xs text-muted-foreground mt-1">Versions are created when status changes to &quot;Needs Review&quot;</p>
                  </div>
                ) : versions.length < 2 ? (
                  <div className="text-center py-12">
                    <p className="text-sm text-muted-foreground">Only one version exists</p>
                    <p className="text-xs text-muted-foreground mt-1">A diff will be available after the next revision</p>
                  </div>
                ) : diffLoading ? (
                  <div className="py-8">
                    <OrbitLoader label="Computing revision diff" />
                  </div>
                ) : diffData ? (
                  <DiffViewer diff={diffData} />
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-8">Select versions to compare</p>
                )}
              </TabTransition>
            )}
          </Card>
        </div>

        {/* Right Sidebar */}
        <div className="space-y-6">
          {viewMode === "changes" && versions.length >= 2 && (
            <VersionSelector
              versions={versions}
              currentVersion={currentVersion}
              compareVersion={compareVersion}
              onSelectCurrent={(v) => setCurrentVersion(v)}
              onSelectCompare={(v) => setCompareVersion(v)}
            />
          )}

          <Card className="p-5">
            <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-4">Status History</h2>
            {statusLog?.logs?.length === 0 ? (
              <p className="text-muted-foreground text-sm">No status changes yet.</p>
            ) : (
              <div className="space-y-3">
                {statusLog?.logs?.map((log, index) => (
                  <div key={index} className="text-sm">
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground">{log.by}</span>
                      <span className="text-muted-foreground">&rarr;</span>
                      <StatusBadge status={log.to} />
                    </div>
                    <p className="text-muted-foreground text-xs mt-0.5">{new Date(log.timestamp).toLocaleString()}</p>
                    {log.note && <p className="text-muted-foreground text-xs mt-1 italic">&ldquo;{log.note}&rdquo;</p>}
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card className="p-5">
            <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-4">Details</h2>
            <div className="space-y-3 text-sm">
              <div><span className="text-muted-foreground">Agent: </span><span className="text-foreground">{deliverable.agentName}</span></div>
              <div><span className="text-muted-foreground">Type: </span><span className="text-foreground capitalize">{deliverable.type}</span></div>
              <div><span className="text-muted-foreground">Size: </span><span className="text-foreground">{(deliverable.size / 1024).toFixed(1)} KB</span></div>
              <div><span className="text-muted-foreground">Created: </span><span className="text-foreground">{new Date(deliverable.createdAt).toLocaleString()}</span></div>
              <div><span className="text-muted-foreground">Updated: </span><span className="text-foreground">{new Date(deliverable.updatedAt).toLocaleString()}</span></div>
            </div>
          </Card>

          <TopLevelComments
            threads={threads}
            deliverableId={deliverable.id}
            onAddComment={handleAddComment}
            onResolveThread={handleResolveThread}
            onReopenThread={handleReopenThread}
            onCreateThread={handleCreateTopLevelThread}
            onHideThread={handleHideThread}
            hiddenThreadIds={hiddenThreads}
            showHiddenThreads={showHiddenThreads}
            setShowHiddenThreads={setShowHiddenThreads}
          />
        </div>
      </div>

      {/* Feedback Warning Modal */}
      <DialogOverlay open={showFeedbackWarning}>
        <DialogContent size="md">
          <DialogHeader>
            <DialogTitle>No Feedback Added</DialogTitle>
            <DialogDescription>
              You haven&apos;t added any inline feedback yet. Consider adding comments
              to specific lines before requesting changes for clearer guidance.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowFeedbackWarning(false)}>Add Feedback First</Button>
            <Button variant="warning" onClick={() => { setShowFeedbackWarning(false); setShowFeedbackModal(true); }}>Continue Anyway</Button>
          </DialogFooter>
        </DialogContent>
      </DialogOverlay>

      {/* Feedback Modal */}
      <DialogOverlay open={showFeedbackModal}>
        <DialogContent size="lg">
          <DialogHeader>
            <DialogTitle>Request Changes</DialogTitle>
            <DialogDescription>
              {openThreadsCount > 0
                ? `You have ${openThreadsCount} open feedback thread${openThreadsCount === 1 ? "" : "s"}. Add a general note to accompany the status change.`
                : "Describe what should be improved. The agent will receive this feedback and revise automatically."}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); submitStatusChange("requested changes", feedbackText); }} className="space-y-4">
            <div>
              <Label className="block mb-2">General Note (optional)</Label>
              <Textarea value={feedbackText} onChange={(e) => setFeedbackText(e.target.value)} placeholder="Any additional context..." rows={4} autoFocus className="resize-none" />
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => { setShowFeedbackModal(false); setFeedbackText(""); }}>Cancel</Button>
              <Button type="submit" variant="warning" disabled={submitting}>{submitting ? "Sending..." : "Request Changes"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </DialogOverlay>

      {/* Delete Confirmation Modal */}
      <DialogOverlay open={showDeleteConfirm}>
        <DialogContent size="md">
          <DialogHeader>
            <DialogTitle>Delete Deliverable</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete <span className="text-foreground font-medium">{deliverable.title}</span>?
              This will permanently remove the file and all associated data.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowDeleteConfirm(false)} disabled={deleting}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>{deleting ? "Deleting..." : "Delete"}</Button>
          </DialogFooter>
        </DialogContent>
      </DialogOverlay>
    </div>
  );
}
