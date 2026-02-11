"use client";

import React, { useState } from "react";
import { FeedbackThread as FeedbackThreadType } from "@/lib/feedback";

interface InlineFeedbackThreadProps {
  thread: FeedbackThreadType;
  onAddComment?: (threadId: string, content: string) => void;
  onResolveThread?: (threadId: string) => void;
  onReopenThread?: (threadId: string) => void;
  isActive?: boolean;
  onActivate?: () => void;
}

export function InlineFeedbackThread({
  thread,
  onAddComment,
  onResolveThread,
  onReopenThread,
  isActive = false,
  onActivate,
}: InlineFeedbackThreadProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [replyContent, setReplyContent] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showReplyForm, setShowReplyForm] = useState(false);

  const handleSubmitReply = async () => {
    if (!replyContent.trim() || !onAddComment) return;

    setIsSubmitting(true);
    try {
      await onAddComment(thread.id, replyContent);
      setReplyContent("");
      setShowReplyForm(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResolve = async () => {
    if (onResolveThread) {
      await onResolveThread(thread.id);
    }
  };

  const handleReopen = async () => {
    if (onReopenThread) {
      await onReopenThread(thread.id);
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

  const isResolved = thread.status === "resolved";
  const lineRangeText =
    thread.startLine === thread.endLine
      ? `Line ${thread.startLine}`
      : `Lines ${thread.startLine}-${thread.endLine}`;

  return (
    <div
      className={`
        border rounded-lg overflow-hidden
        ${isResolved ? "border-zinc-700/50 bg-zinc-900/30" : "border-zinc-700 bg-zinc-900"}
        ${isActive ? "ring-1 ring-amber-500/30" : ""}
        transition-all
      `}
      onClick={onActivate}
    >
      {/* Outdated Badge */}
      {thread.outdated && !isResolved && (
        <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-950/50 border-b border-amber-600/30">
          <span className="text-xs font-mono text-amber-400">OUTDATED</span>
          <span className="text-xs text-amber-500/70">Content has changed since this comment</span>
        </div>
      )}

      {/* Thread Header */}
      <div
        className={`
          flex items-center justify-between px-3 py-2 cursor-pointer
          hover:bg-zinc-800/50 transition-colors
          ${isResolved ? "bg-zinc-800/20" : "bg-zinc-800/30"}
          border-l-2
          ${isResolved ? "border-l-green-500/50" : thread.outdated ? "border-l-amber-400/50" : "border-l-amber-500/50"}
        `}
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-2">
          <span
            className={`
              text-xs font-medium px-1.5 py-0.5 rounded
              ${isResolved ? "bg-green-500/20 text-green-400" : "bg-amber-500/20 text-amber-400"}
            `}
          >
            {isResolved ? "Resolved" : "Open"}
          </span>
          <span className="text-xs text-zinc-500 font-mono">
            {lineRangeText}
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
                    w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0
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
                <div className="mt-3 space-y-2">
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
                <div className="flex items-center gap-2 pt-2 border-t border-zinc-800">
                  <button
                    onClick={() => setShowReplyForm(true)}
                    className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
                  >
                    Reply
                  </button>
                  <span className="text-zinc-600">·</span>
                  <button
                    onClick={handleResolve}
                    className="text-xs text-green-400 hover:text-green-300 transition-colors"
                  >
                    Resolve
                  </button>
                </div>
              )}
            </>
          ) : (
            onReopenThread && (
              <div className="flex items-center gap-2 pt-2 border-t border-zinc-800">
                <button
                  onClick={handleReopen}
                  className="text-xs text-zinc-400 hover:text-zinc-200 transition-colors"
                >
                  Reopen thread
                </button>
              </div>
            )
          )}
        </div>
      )}
    </div>
  );
}
