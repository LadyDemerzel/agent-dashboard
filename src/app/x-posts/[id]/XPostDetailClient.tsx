"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { StatusBadge } from "@/components/StatusBadge";
import { LineNumberedContent } from "@/components/LineNumberedContent";
import { TopLevelComments } from "@/components/TopLevelComments";
import { FeedbackThread as FeedbackThreadType } from "@/lib/feedback";

interface XPost {
  id: string;
  title: string;
  date: string;
  postNumber: number;
  status: "draft" | "needs review" | "requested changes" | "approved" | "published";
  content: string;
  suggestedTime: string;
  category: string;
  engagementStrategy: string;
  hashtags: string;
  filePath: string;
  agent: string;
}

interface StatusLogEntry {
  timestamp: string;
  from: string;
  to: string;
  by: string;
  note: string;
}

interface XPostDetailClientProps {
  post: XPost;
  statusLog: { logs: StatusLogEntry[] };
}

export function XPostDetailClient({
  post,
  statusLog,
}: XPostDetailClientProps) {
  const [threads, setThreads] = useState<FeedbackThreadType[]>([]);
  const [selectedRange, setSelectedRange] = useState<{ startLine: number; endLine: number } | null>(null);
  const [isCreatingThread, setIsCreatingThread] = useState(false);
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedStatus, setSelectedStatus] = useState(post.status);
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [feedbackText, setFeedbackText] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Prepare full content with metadata
  const fullContent = `---
title: ${post.title}
date: ${post.date}
status: ${post.status}
category: ${post.category || "—"}
suggestedTime: ${post.suggestedTime || "—"}
---

# ${post.title}

**Post #${post.postNumber}** · ${post.date}

## Content
${post.content}

## Engagement Strategy
${post.engagementStrategy || "No engagement strategy provided."}

## Hashtags
${post.hashtags || "None"}`;

  // Fetch feedback threads
  const fetchThreads = useCallback(async () => {
    try {
      const res = await fetch(`/api/x-posts/${post.id}/feedback/threads`);
      if (res.ok) {
        const data = await res.json();
        setThreads(data.threads);
      }
    } catch (error) {
      console.error("Failed to fetch feedback threads:", error);
    } finally {
      setLoading(false);
    }
  }, [post.id]);

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
    const res = await fetch(`/api/x-posts/${post.id}/feedback/threads`, {
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
    const res = await fetch(`/api/x-posts/${post.id}/feedback/threads`, {
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
    const res = await fetch(`/api/x-posts/${post.id}/feedback/threads/${threadId}/comments`, {
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
    const res = await fetch(`/api/x-posts/${post.id}/feedback/threads/${threadId}`, {
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
    const res = await fetch(`/api/x-posts/${post.id}/feedback/threads/${threadId}`, {
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
      setShowFeedbackModal(true);
    } else if (newStatus !== selectedStatus) {
      await submitStatusChange(newStatus, "");
    }
  };

  const submitStatusChange = async (status: string, note: string) => {
    setSubmitting(true);
    try {
      const res = await fetch(`/api/x-posts/${post.id}/feedback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, note: note || feedbackText }),
      });

      if (res.ok) {
        setSelectedStatus(status as XPost["status"]);
        // Update the status in the content display
        post.status = status as XPost["status"];
      }
    } catch (error) {
      console.error("Failed to update status:", error);
    } finally {
      setSubmitting(false);
      setShowFeedbackModal(false);
      setFeedbackText("");
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
        href="/x-posts"
        className="text-zinc-500 hover:text-white text-sm mb-6 inline-flex items-center gap-1 transition-colors"
      >
        &larr; Back to X Posts
      </Link>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Header */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
            <div className="flex items-start justify-between mb-4">
              <div className="flex-1 min-w-0">
                <h1 className="text-xl font-bold text-white">{post.title}</h1>
                <p className="text-zinc-500 text-sm mt-1">
                  Post #{post.postNumber} · {post.date}
                </p>
              </div>
              <StatusBadge status={selectedStatus} />
            </div>

            {/* Metadata Grid */}
            <div className="grid grid-cols-2 gap-4 text-sm mb-4">
              <div>
                <span className="text-zinc-500">Category: </span>
                <span className="text-zinc-300">{post.category || "—"}</span>
              </div>
              <div>
                <span className="text-zinc-500">Suggested Time: </span>
                <span className="text-zinc-300">{post.suggestedTime || "—"}</span>
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

          {/* Content with Line Numbers and Inline Comments */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-zinc-800">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-medium text-zinc-500 uppercase tracking-wider">
                  Post Content
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
              {loading ? (
                <p className="text-zinc-500 text-sm p-6">Loading...</p>
              ) : (
                <div className="bg-zinc-950 p-4">
                  <LineNumberedContent
                    content={fullContent}
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
              )}
            </div>
          </div>
        </div>

        {/* Right Sidebar */}
        <div className="space-y-6">
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

          {/* Post Info */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
            <h2 className="text-sm font-medium text-zinc-500 uppercase tracking-wider mb-4">
              Details
            </h2>
            <div className="space-y-3 text-sm">
              <div>
                <span className="text-zinc-500">Agent: </span>
                <span className="text-zinc-300">{post.agent || "Scribe"}</span>
              </div>
              <div>
                <span className="text-zinc-500">Post #: </span>
                <span className="text-zinc-300">{post.postNumber}</span>
              </div>
              <div>
                <span className="text-zinc-500">Date: </span>
                <span className="text-zinc-300">{post.date}</span>
              </div>
              <div>
                <span className="text-zinc-500">File: </span>
                <span className="text-zinc-400 font-mono text-xs break-all">
                  post-{post.postNumber}.md
                </span>
              </div>
            </div>
          </div>

          {/* Top-Level Comments */}
          <TopLevelComments
            threads={threads}
            deliverableId={post.id}
            onAddComment={handleAddComment}
            onResolveThread={handleResolveThread}
            onReopenThread={handleReopenThread}
            onCreateThread={handleCreateTopLevelThread}
          />
        </div>
      </div>

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
