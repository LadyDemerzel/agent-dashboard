"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { notFound } from "next/navigation";
import { StatusBadge } from "@/components/StatusBadge";
import { LineNumberedContent } from "@/components/LineNumberedContent";
import { TopLevelComments } from "@/components/TopLevelComments";
import { DiffViewer, VersionSelector } from "@/components/DiffViewer";
import { FeedbackThread as FeedbackThreadType } from "@/lib/feedback";
import { DiffResult } from "@/lib/versions";

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
  const [loading, setLoading] = useState(true);
  const [selectedStatus, setSelectedStatus] = useState(deliverable.status);
  const [showFeedbackWarning, setShowFeedbackWarning] = useState(false);
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [feedbackText, setFeedbackText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Version/Diff state
  type ViewMode = "content" | "changes";
  const [viewMode, setViewMode] = useState<ViewMode>("content");
  const [versions, setVersions] = useState<Array<{ version: number; timestamp: string; updatedBy: string; comment?: string }>>([]);
  const [currentVersion, setCurrentVersion] = useState(0);
  const [compareVersion, setCompareVersion] = useState<number | undefined>(undefined);
  const [diffData, setDiffData] = useState<DiffResult | null>(null);
  const [diffLoading, setDiffLoading] = useState(false);
  const diffAbortRef = useRef<AbortController | null>(null);

  // Fetch versions
  const fetchVersions = useCallback(async () => {
    try {
      const res = await fetch(`/api/deliverables/${deliverable.id}/versions`);
      if (res.ok) {
        const data = await res.json();
        setVersions(data.versions || []);
        if (data.currentVersion) {
          setCurrentVersion(data.currentVersion);
          if (data.versions?.length >= 2) {
            setCompareVersion(data.currentVersion - 1);
          }
        }
      }
    } catch { /* ignore */ }
  }, [deliverable.id]);

  // Load diff when version selection changes
  const loadDiff = useCallback(async (from: number, to: number) => {
    if (diffAbortRef.current) diffAbortRef.current.abort();
    const controller = new AbortController();
    diffAbortRef.current = controller;
    setDiffLoading(true);
    try {
      const res = await fetch(`/api/deliverables/${deliverable.id}/diff?from=${from}&to=${to}`, {
        signal: controller.signal,
      });
      if (res.ok) setDiffData(await res.json());
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") return;
    } finally {
      setDiffLoading(false);
    }
  }, [deliverable.id]);

  useEffect(() => {
    fetchVersions();
  }, [fetchVersions]);

  useEffect(() => {
    if (viewMode === "changes" && currentVersion && compareVersion) {
      loadDiff(compareVersion, currentVersion);
    }
  }, [viewMode, currentVersion, compareVersion, loadDiff]);

  // Fetch feedback threads
  const fetchThreads = useCallback(async () => {
    try {
      const res = await fetch(`/api/deliverables/${deliverable.id}/feedback`);
      if (res.ok) {
        const data = await res.json();
        setThreads(data.threads);
      }
    } catch (error) {
      console.error("Failed to fetch feedback threads:", error);
    } finally {
      setLoading(false);
    }
  }, [deliverable.id]);

  useEffect(() => {
    fetchThreads();
  }, [fetchThreads]);

  // Handle line range selection
  const handleLineRangeSelect = useCallback((startLine: number, endLine: number) => {
    setSelectedRange({ startLine, endLine });
    setIsCreatingThread(false);
  }, []);

  // Create new inline thread (with line numbers)
  const handleCreateThread = async (startLine: number, endLine: number, content: string) => {
    const res = await fetch(`/api/deliverables/${deliverable.id}/feedback`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ startLine, endLine, content }),
    });

    if (res.ok) {
      await fetchThreads();
      setSelectedRange(null);
    }
  };

  // Create new top-level thread (general comment)
  const handleCreateTopLevelThread = async (content: string) => {
    const res = await fetch(`/api/deliverables/${deliverable.id}/feedback`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content }),
    });

    if (res.ok) {
      await fetchThreads();
    }
  };

  // Add comment to thread
  const handleAddComment = async (threadId: string, content: string) => {
    const res = await fetch(`/api/deliverables/${deliverable.id}/feedback/${threadId}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content, author: "user" }),
    });

    if (res.ok) {
      await fetchThreads();
    }
  };

  // Resolve thread
  const handleResolveThread = async (threadId: string) => {
    const res = await fetch(`/api/deliverables/${deliverable.id}/feedback/${threadId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "resolved" }),
    });

    if (res.ok) {
      await fetchThreads();
    }
  };

  // Reopen thread
  const handleReopenThread = async (threadId: string) => {
    const res = await fetch(`/api/deliverables/${deliverable.id}/feedback/${threadId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "open" }),
    });

    if (res.ok) {
      await fetchThreads();
    }
  };

  // Handle status change
  const handleStatusChange = async (newStatus: string) => {
    if (newStatus === "requested changes") {
      const openThreads = threads.filter((t) => t.status === "open");
      if (openThreads.length === 0) {
        setShowFeedbackWarning(true);
      } else {
        setShowFeedbackModal(true);
      }
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

  // Prepare highlight lines from inline threads only
  const highlightLines = threads
    .filter((t) => t.status === "open" && t.startLine !== null && t.endLine !== null)
    .map((t) => ({
      startLine: t.startLine!,
      endLine: t.endLine!,
      color: "bg-amber-500/15",
    }));

  const handleDelete = async () => {
    setDeleting(true);
    try {
      const res = await fetch(`/api/deliverables/${deliverable.id}/status`, { method: "DELETE" });
      if (res.ok) {
        router.push("/deliverables");
      }
    } catch { /* ignore */ }
    setDeleting(false);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl">
      <Link
        href="/deliverables"
        className="text-zinc-500 hover:text-white text-sm mb-6 inline-flex items-center gap-1 transition-colors"
      >
        &larr; Back to Deliverables
      </Link>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Header */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
            <div className="flex items-start justify-between mb-4">
              <div className="flex-1 min-w-0">
                <h1 className="text-xl font-bold text-white">{deliverable.title}</h1>
                <p className="text-zinc-500 text-sm mt-1">
                  {formatDate(deliverable.createdAt)}
                  {" · "}
                  {deliverable.relativePath}
                </p>
              </div>
              <StatusBadge status={selectedStatus} />
            </div>

            <div className="grid grid-cols-2 gap-4 text-sm mb-4">
              <div>
                <span className="text-zinc-500">Agent: </span>
                <Link
                  href={`/agents/${deliverable.agentId}`}
                  className="text-white hover:text-zinc-300 transition-colors"
                >
                  {deliverable.agentName}
                </Link>
              </div>
              <div>
                <span className="text-zinc-500">Type: </span>
                <span className="text-zinc-300 capitalize">
                  {deliverable.type}
                </span>
              </div>
            </div>

            {/* Status Change */}
            <div className="flex items-center gap-3">
              <label className="text-zinc-500 text-sm">Status:</label>
              <select
                value={selectedStatus}
                onChange={(e) => handleStatusChange(e.target.value)}
                disabled={submitting}
                className="bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-1.5 text-sm text-white focus:border-zinc-500 focus:outline-none cursor-pointer"
              >
                <option value="draft">Draft</option>
                <option value="needs review">Needs Review</option>
                <option value="requested changes">Requested Changes</option>
                <option value="approved">Approved</option>
                <option value="published">Published</option>
                <option value="archived">Archived</option>
              </select>
              <div className="ml-auto">
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  className="text-zinc-500 hover:text-red-400 text-sm transition-colors"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>

          {/* Content / Changes Tabs */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
            {/* Tab Bar */}
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
                Changes {versions.length >= 2 && `(${versions.length})`}
              </button>
              {viewMode === "content" && selectedRange && (
                <div className="flex items-center gap-3 ml-auto">
                  <span className="text-xs text-zinc-500">
                    Selected{" "}
                    {selectedRange.startLine === selectedRange.endLine
                      ? `line ${selectedRange.startLine}`
                      : `lines ${selectedRange.startLine}-${selectedRange.endLine}`}
                  </span>
                  <button
                    onClick={() => setSelectedRange(null)}
                    className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
                  >
                    Clear
                  </button>
                </div>
              )}
            </div>

            {/* Content View */}
            {viewMode === "content" && (
              <div className="p-0">
                {content ? (
                  <div className="bg-zinc-950 p-4">
                    <LineNumberedContent
                      content={content}
                      onLineRangeSelect={handleLineRangeSelect}
                      selectedRange={selectedRange}
                      highlightLines={highlightLines}
                      threads={threads}
                      onAddComment={handleAddComment}
                      onResolveThread={handleResolveThread}
                      onReopenThread={handleReopenThread}
                      onCreateThread={handleCreateThread}
                      isCreatingThread={isCreatingThread}
                      setIsCreatingThread={setIsCreatingThread}
                      activeThreadId={activeThreadId}
                      setActiveThreadId={setActiveThreadId}
                    />
                  </div>
                ) : (
                  <p className="text-zinc-500 text-sm p-6">
                    Unable to load deliverable content.
                  </p>
                )}
              </div>
            )}

            {/* Changes View */}
            {viewMode === "changes" && (
              <div className="p-4 space-y-4">
                {versions.length === 0 ? (
                  <div className="text-center py-12">
                    <div className="w-12 h-12 bg-zinc-800 rounded-full flex items-center justify-center mx-auto mb-3">
                      <svg className="w-6 h-6 text-zinc-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                      </svg>
                    </div>
                    <p className="text-sm text-zinc-400">No version history yet</p>
                    <p className="text-xs text-zinc-600 mt-1">
                      Versions are created when status changes to &quot;Needs Review&quot;
                    </p>
                  </div>
                ) : versions.length < 2 ? (
                  <div className="text-center py-12">
                    <p className="text-sm text-zinc-400">Only one version exists</p>
                    <p className="text-xs text-zinc-600 mt-1">
                      A diff will be available after the next revision
                    </p>
                  </div>
                ) : (
                  <>
                    {diffLoading ? (
                      <div className="text-center py-12">
                        <div className="animate-spin w-6 h-6 border-2 border-zinc-600 border-t-zinc-300 rounded-full mx-auto" />
                        <p className="text-sm text-zinc-500 mt-3">Loading diff...</p>
                      </div>
                    ) : diffData ? (
                      <DiffViewer diff={diffData} />
                    ) : (
                      <p className="text-sm text-zinc-500 text-center py-8">
                        Select versions to compare
                      </p>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Right Sidebar */}
        <div className="space-y-6">
          {/* Version Selector (shown when Changes tab is active) */}
          {viewMode === "changes" && versions.length >= 2 && (
            <VersionSelector
              versions={versions}
              currentVersion={currentVersion}
              compareVersion={compareVersion}
              onSelectCurrent={(v) => setCurrentVersion(v)}
              onSelectCompare={(v) => setCompareVersion(v)}
            />
          )}

          {/* Status History */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
            <h2 className="text-sm font-medium text-zinc-500 uppercase tracking-wider mb-4">
              Status History
            </h2>
            {statusLog?.logs?.length === 0 ? (
              <p className="text-zinc-500 text-sm">No status changes yet.</p>
            ) : (
              <div className="space-y-3">
                {statusLog?.logs?.map((log, index) => (
                  <div key={index} className="text-sm">
                    <div className="flex items-center gap-2">
                      <span className="text-zinc-400">{log.by}</span>
                      <span className="text-zinc-600">→</span>
                      <StatusBadge status={log.to} />
                    </div>
                    <p className="text-zinc-500 text-xs mt-0.5">
                      {new Date(log.timestamp).toLocaleString()}
                    </p>
                    {log.note && (
                      <p className="text-zinc-600 text-xs mt-1 italic">
                        &ldquo;{log.note}&rdquo;
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* File Info */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
            <h2 className="text-sm font-medium text-zinc-500 uppercase tracking-wider mb-4">
              Details
            </h2>
            <div className="space-y-3 text-sm">
              <div>
                <span className="text-zinc-500">Agent: </span>
                <span className="text-zinc-300">{deliverable.agentName}</span>
              </div>
              <div>
                <span className="text-zinc-500">Type: </span>
                <span className="text-zinc-300 capitalize">{deliverable.type}</span>
              </div>
              <div>
                <span className="text-zinc-500">Size: </span>
                <span className="text-zinc-300">
                  {(deliverable.size / 1024).toFixed(1)} KB
                </span>
              </div>
              <div>
                <span className="text-zinc-500">Created: </span>
                <span className="text-zinc-300">
                  {new Date(deliverable.createdAt).toLocaleString()}
                </span>
              </div>
              <div>
                <span className="text-zinc-500">Updated: </span>
                <span className="text-zinc-300">
                  {new Date(deliverable.updatedAt).toLocaleString()}
                </span>
              </div>
            </div>
          </div>

          {/* Top-Level Comments */}
          <TopLevelComments
            threads={threads}
            deliverableId={deliverable.id}
            onAddComment={handleAddComment}
            onResolveThread={handleResolveThread}
            onReopenThread={handleReopenThread}
            onCreateThread={handleCreateTopLevelThread}
          />
        </div>
      </div>

      {/* Feedback Warning Modal */}
      {showFeedbackWarning && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 w-full max-w-md mx-4">
            <h3 className="text-white font-semibold text-lg mb-2">
              No Feedback Added
            </h3>
            <p className="text-zinc-400 text-sm mb-4">
              You haven&apos;t added any inline feedback yet. Consider adding comments
              to specific lines before requesting changes for clearer guidance.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowFeedbackWarning(false)}
                className="px-4 py-2 text-sm text-zinc-400 hover:text-white transition-colors"
              >
                Add Feedback First
              </button>
              <button
                onClick={() => {
                  setShowFeedbackWarning(false);
                  setShowFeedbackModal(true);
                }}
                className="px-4 py-2 bg-orange-600 hover:bg-orange-500 text-white font-medium rounded-lg text-sm transition-colors"
              >
                Continue Anyway
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Feedback Modal */}
      {showFeedbackModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 w-full max-w-lg mx-4">
            <h3 className="text-white font-semibold text-lg mb-1">
              Request Changes
            </h3>
            <p className="text-zinc-500 text-sm mb-4">
              {openThreadsCount > 0
                ? `You have ${openThreadsCount} open feedback thread${
                    openThreadsCount === 1 ? "" : "s"
                  }. Add a general note to accompany the status change.`
                : "Describe what should be improved. The agent will receive this feedback and revise automatically."}
            </p>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                submitStatusChange("requested changes", feedbackText);
              }}
              className="space-y-4"
            >
              <div>
                <label className="block text-zinc-400 text-sm mb-2">
                  General Note (optional)
                </label>
                <textarea
                  value={feedbackText}
                  onChange={(e) => setFeedbackText(e.target.value)}
                  placeholder="Any additional context..."
                  rows={4}
                  autoFocus
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-3 text-white text-sm placeholder-zinc-600 focus:border-zinc-600 focus:outline-none resize-none"
                />
              </div>

              <div className="flex gap-3 justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setShowFeedbackModal(false);
                    setFeedbackText("");
                  }}
                  className="px-4 py-2 text-sm text-zinc-400 hover:text-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-orange-600 hover:bg-orange-500 disabled:bg-zinc-800 disabled:text-zinc-500 text-white font-medium rounded-lg text-sm transition-colors"
                >
                  {submitting ? "Sending..." : "Request Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 w-full max-w-md mx-4">
            <h3 className="text-white font-semibold text-lg mb-2">Delete Deliverable</h3>
            <p className="text-zinc-400 text-sm mb-1">
              Are you sure you want to delete <span className="text-white font-medium">{deliverable.title}</span>?
            </p>
            <p className="text-zinc-500 text-xs mb-6">
              This will permanently remove the file and all associated data (version history, status log, feedback).
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                disabled={deleting}
                className="px-4 py-2 text-sm text-zinc-400 hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="px-4 py-2 bg-red-600 hover:bg-red-500 disabled:bg-zinc-800 disabled:text-zinc-500 text-white font-medium rounded-lg text-sm transition-colors"
              >
                {deleting ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
