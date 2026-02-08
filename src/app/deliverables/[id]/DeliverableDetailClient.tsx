"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { StatusBadge } from "@/components/StatusBadge";
import { LineNumberedContent } from "@/components/LineNumberedContent";
import { FeedbackSidebar } from "@/components/FeedbackSidebar";
import { FeedbackThread as FeedbackThreadType } from "@/lib/feedback";

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
  const [threads, setThreads] = useState<FeedbackThreadType[]>([]);
  const [selectedRange, setSelectedRange] = useState<{ startLine: number; endLine: number } | null>(null);
  const [isCreatingThread, setIsCreatingThread] = useState(false);
  const [loading, setLoading] = useState(true);
  const [selectedStatus, setSelectedStatus] = useState(deliverable.status);
  const [showFeedbackWarning, setShowFeedbackWarning] = useState(false);
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [feedbackText, setFeedbackText] = useState("");
  const [submitting, setSubmitting] = useState(false);

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

  // Create new thread
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
        window.location.reload();
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

  // Prepare highlight lines from threads
  const highlightLines = threads
    .filter((t) => t.status === "open")
    .map((t) => ({
      startLine: t.startLine,
      endLine: t.endLine,
      color: "bg-amber-500/15",
    }));

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
              </select>
            </div>
          </div>

          {/* Content with Line Numbers */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-zinc-800">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-medium text-zinc-500 uppercase tracking-wider">
                  Content
                </h2>
                {selectedRange && (
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-zinc-500">
                      Selected{" "}
                      {selectedRange.startLine === selectedRange.endLine
                        ? `line ${selectedRange.startLine}`
                        : `lines ${selectedRange.startLine}-${selectedRange.endLine}`}
                    </span>
                    <button
                      onClick={() => setIsCreatingThread(true)}
                      className="text-xs bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 rounded-lg transition-colors"
                    >
                      Add Comment
                    </button>
                    <button
                      onClick={() => setSelectedRange(null)}
                      className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
                    >
                      Clear
                    </button>
                  </div>
                )}
              </div>
            </div>
            <div className="p-0">
              {content ? (
                <div className="bg-zinc-950 p-4">
                  <LineNumberedContent
                    content={content}
                    onLineRangeSelect={handleLineRangeSelect}
                    selectedRange={selectedRange}
                    highlightLines={highlightLines}
                  />
                </div>
              ) : (
                <p className="text-zinc-500 text-sm p-6">
                  Unable to load deliverable content.
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Right Sidebar */}
        <div className="space-y-6">
          {/* Feedback Sidebar */}
          <FeedbackSidebar
            threads={threads}
            deliverableId={deliverable.id}
            onAddComment={handleAddComment}
            onResolveThread={handleResolveThread}
            onReopenThread={handleReopenThread}
            onJumpToLine={(line) => {
              // Could implement smooth scroll to line here
              console.log("Jump to line:", line);
            }}
            onCreateThread={handleCreateThread}
            selectedRange={selectedRange}
            isCreatingThread={isCreatingThread}
            setIsCreatingThread={setIsCreatingThread}
          />

          {/* Status History */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
            <h2 className="text-sm font-medium text-zinc-500 uppercase tracking-wider mb-4">
              Status History
            </h2>
            {statusLog.logs.length === 0 ? (
              <p className="text-zinc-500 text-sm">No status changes yet.</p>
            ) : (
              <div className="space-y-3">
                {statusLog.logs.map((log, index) => (
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
    </div>
  );
}
