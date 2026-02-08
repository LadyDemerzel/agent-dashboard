"use client";

import React, { useState } from "react";
import { FeedbackThread as FeedbackThreadType } from "@/lib/feedback";

interface TopLevelCommentsProps {
  threads: FeedbackThreadType[];
  deliverableId: string;
  onAddComment: (threadId: string, content: string) => void;
  onResolveThread: (threadId: string) => void;
  onReopenThread: (threadId: string) => void;
  onCreateThread: (content: string) => void;
}

export function TopLevelComments({
  threads,
  deliverableId,
  onAddComment,
  onResolveThread,
  onReopenThread,
  onCreateThread,
}: TopLevelCommentsProps) {
  const [showNewThreadForm, setShowNewThreadForm] = useState(false);
  const [newThreadContent, setNewThreadContent] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Filter only top-level threads (no line numbers)
  const topLevelThreads = threads.filter(
    (t) => t.startLine === null || t.endLine === null
  );

  const openThreads = topLevelThreads.filter((t) => t.status === "open");
  const resolvedThreads = topLevelThreads.filter((t) => t.status === "resolved");

  const handleCreateThread = async () => {
    if (!newThreadContent.trim()) return;

    setIsSubmitting(true);
    try {
      await onCreateThread(newThreadContent);
      setNewThreadContent("");
      setShowNewThreadForm(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-zinc-800">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium text-zinc-500 uppercase tracking-wider">
            Discussion
          </h2>
          <div className="flex items-center gap-2">
            {openThreads.length > 0 && (
              <span className="text-xs bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded-full">
                {openThreads.length} open
              </span>
            )}
            {resolvedThreads.length > 0 && (
              <span className="text-xs bg-green-500/20 text-green-400 px-2 py-0.5 rounded-full">
                {resolvedThreads.length} resolved
              </span>
            )}
          </div>
        </div>
      </div>

      {/* New Thread Button or Form */}
      <div className="p-4 border-b border-zinc-800">
        {showNewThreadForm ? (
          <div className="space-y-3">
            <textarea
              value={newThreadContent}
              onChange={(e) => setNewThreadContent(e.target.value)}
              placeholder="Start a general discussion..."
              autoFocus
              className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 resize-y min-h-[100px]"
            />
            <div className="flex items-center justify-end gap-2">
              <button
                onClick={() => {
                  setShowNewThreadForm(false);
                  setNewThreadContent("");
                }}
                className="px-3 py-1.5 text-sm text-zinc-400 hover:text-zinc-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateThread}
                disabled={!newThreadContent.trim() || isSubmitting}
                className="px-3 py-1.5 text-sm bg-blue-600 hover:bg-blue-500 disabled:bg-zinc-700 disabled:text-zinc-500 text-white rounded-lg transition-colors"
              >
                {isSubmitting ? "Posting..." : "Post Comment"}
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setShowNewThreadForm(true)}
            className="w-full py-3 border-2 border-dashed border-zinc-700 rounded-lg text-zinc-500 hover:text-zinc-300 hover:border-zinc-600 transition-colors text-sm"
          >
            + Add a general comment
          </button>
        )}
      </div>

      {/* Threads List */}
      <div className="max-h-[500px] overflow-y-auto p-4">
        {topLevelThreads.length === 0 ? (
          <div className="text-center py-8">
            <div className="w-10 h-10 bg-zinc-800 rounded-full flex items-center justify-center mx-auto mb-3">
              <svg
                className="w-5 h-5 text-zinc-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                />
              </svg>
            </div>
            <p className="text-sm text-zinc-500">No general comments yet</p>
            <p className="text-xs text-zinc-600 mt-1">
              Start a discussion about this deliverable
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {openThreads.length > 0 && (
              <div className="space-y-3">
                {openThreads.map((thread) => (
                  <TopLevelThreadCard
                    key={thread.id}
                    thread={thread}
                    onAddComment={onAddComment}
                    onResolveThread={onResolveThread}
                    onReopenThread={onReopenThread}
                  />
                ))}
              </div>
            )}

            {resolvedThreads.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center gap-2 pt-2 border-t border-zinc-800">
                  <h3 className="text-xs font-medium text-zinc-600 uppercase tracking-wider">
                    Resolved
                  </h3>
                  <span className="text-xs text-zinc-600">({resolvedThreads.length})</span>
                </div>
                {resolvedThreads.map((thread) => (
                  <TopLevelThreadCard
                    key={thread.id}
                    thread={thread}
                    onAddComment={onAddComment}
                    onResolveThread={onResolveThread}
                    onReopenThread={onReopenThread}
                    isResolved
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

interface TopLevelThreadCardProps {
  thread: FeedbackThreadType;
  onAddComment: (threadId: string, content: string) => void;
  onResolveThread: (threadId: string) => void;
  onReopenThread: (threadId: string) => void;
  isResolved?: boolean;
}

function TopLevelThreadCard({
  thread,
  onAddComment,
  onResolveThread,
  onReopenThread,
  isResolved = false,
}: TopLevelThreadCardProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [replyContent, setReplyContent] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showReplyForm, setShowReplyForm] = useState(false);

  const handleSubmitReply = async () => {
    if (!replyContent.trim()) return;

    setIsSubmitting(true);
    try {
      await onAddComment(thread.id, replyContent);
      setReplyContent("");
      setShowReplyForm(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);

    if (diffInHours < 1) {
      const mins = Math.floor(diffInHours * 60);
      return mins < 1 ? "just now" : `${mins}m ago`;
    } else if (diffInHours < 24) {
      return `${Math.floor(diffInHours)}h ago`;
    } else if (diffInHours < 48) {
      return "yesterday";
    } else {
      return date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      });
    }
  };

  return (
    <div
      className={`
        border rounded-lg overflow-hidden
        ${isResolved ? "border-zinc-700/50 bg-zinc-900/30" : "border-zinc-700 bg-zinc-900"}
      `}
    >
      {/* Thread Header */}
      <div
        className={`
          flex items-center justify-between px-3 py-2 cursor-pointer
          hover:bg-zinc-800/50 transition-colors
          ${isResolved ? "bg-zinc-800/20" : "bg-zinc-800/30"}
        `}
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-2">
          <span
            className={`
              text-xs font-medium px-1.5 py-0.5 rounded
              ${isResolved ? "bg-green-500/20 text-green-400" : "bg-blue-500/20 text-blue-400"}
            `}
          >
            {isResolved ? "Resolved" : "Open"}
          </span>
          <span className="text-xs text-zinc-600">
            {thread.comments.length} {thread.comments.length === 1 ? "comment" : "comments"}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-zinc-500 text-xs">
            {formatDate(thread.createdAt)}
          </span>
          <svg
            className={`w-4 h-4 text-zinc-500 transition-transform ${isExpanded ? "rotate-180" : ""}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </div>

      {/* Thread Content */}
      {isExpanded && (
        <div className="p-3 space-y-3">
          {/* Comments */}
          <div className="space-y-3">
            {thread.comments.map((comment, index) => (
              <div key={comment.id} className="flex gap-2">
                {/* Avatar */}
                <div
                  className={`
                    w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0
                    ${comment.author === "user" ? "bg-blue-500/20" : "bg-purple-500/20"}
                  `}
                >
                  <span className="text-xs font-medium">
                    {comment.author === "user" ? "I" : "A"}
                  </span>
                </div>

                {/* Comment Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="font-medium text-sm text-zinc-200">
                      {comment.author === "user" ? "Ittai" : "Agent"}
                    </span>
                    <span className="text-xs text-zinc-500">
                      {formatDate(comment.createdAt)}
                    </span>
                    {index === 0 && (
                      <span className="text-xs text-zinc-600 bg-zinc-800 px-1.5 py-0.5 rounded">
                        Original
                      </span>
                    )}
                  </div>
                  <div className="text-sm text-zinc-300 whitespace-pre-wrap">
                    {comment.content}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Reply Form or Actions */}
          {!isResolved ? (
            <>
              {showReplyForm ? (
                <div className="mt-3 space-y-2 pl-9">
                  <textarea
                    value={replyContent}
                    onChange={(e) => setReplyContent(e.target.value)}
                    placeholder="Add a reply..."
                    autoFocus
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 resize-y min-h-[60px]"
                  />
                  <div className="flex items-center justify-end gap-2">
                    <button
                      onClick={() => {
                        setShowReplyForm(false);
                        setReplyContent("");
                      }}
                      className="px-3 py-1 text-xs text-zinc-400 hover:text-zinc-200 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSubmitReply}
                      disabled={!replyContent.trim() || isSubmitting}
                      className="px-3 py-1 text-xs bg-blue-600 hover:bg-blue-500 disabled:bg-zinc-700 disabled:text-zinc-500 text-white rounded-lg transition-colors"
                    >
                      {isSubmitting ? "Posting..." : "Reply"}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2 pt-2 border-t border-zinc-800 pl-9">
                  <button
                    onClick={() => setShowReplyForm(true)}
                    className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
                  >
                    Reply
                  </button>
                  <span className="text-zinc-600">·</span>
                  <button
                    onClick={() => onResolveThread(thread.id)}
                    className="text-xs text-green-400 hover:text-green-300 transition-colors"
                  >
                    Resolve
                  </button>
                </div>
              )}
            </>
          ) : (
            <div className="flex items-center gap-2 pt-2 border-t border-zinc-800 pl-9">
              <button
                onClick={() => onReopenThread(thread.id)}
                className="text-xs text-zinc-400 hover:text-zinc-200 transition-colors"
              >
                Reopen thread
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
