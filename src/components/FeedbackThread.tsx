"use client";

import React, { useState } from "react";
import { FeedbackThread as FeedbackThreadType } from "@/lib/feedback";

interface FeedbackThreadProps {
  thread: FeedbackThreadType;
  onAddComment: (threadId: string, content: string) => void;
  onResolveThread: (threadId: string) => void;
  onReopenThread?: (threadId: string) => void;
  deliverableId: string;
}

export function FeedbackThread({
  thread,
  onAddComment,
  onResolveThread,
  onReopenThread,
  deliverableId,
}: FeedbackThreadProps) {
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

  const handleResolve = async () => {
    await onResolveThread(thread.id);
  };

  const handleReopen = async () => {
    if (onReopenThread) {
      await onReopenThread(thread.id);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
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
        ${isResolved ? "border-zinc-700 bg-zinc-900/50" : "border-zinc-700 bg-zinc-900"}
      `}
    >
      {/* Thread Header */}
      <div
        className={`
          flex items-center justify-between px-4 py-3 cursor-pointer
          hover:bg-zinc-800/50 transition-colors
          ${isResolved ? "bg-zinc-800/30" : "bg-zinc-800/50"}
        `}
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-3">
          <span
            className={`
              text-xs font-medium px-2 py-0.5 rounded-full
              ${isResolved ? "bg-green-500/20 text-green-400" : "bg-blue-500/20 text-blue-400"}
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
        <div className="p-4 space-y-4">
          {/* Comments */}
          <div className="space-y-3">
            {thread.comments.map((comment, index) => (
              <div key={comment.id} className="flex gap-3">
                {/* Avatar */}
                <div
                  className={`
                    w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0
                    ${comment.author === "user" ? "bg-blue-500/20" : "bg-purple-500/20"}
                  `}
                >
                  <span className="text-xs font-medium">
                    {comment.author === "user" ? "I" : "A"}
                  </span>
                </div>

                {/* Comment Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
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
                <div className="mt-4 space-y-3">
                  <textarea
                    value={replyContent}
                    onChange={(e) => setReplyContent(e.target.value)}
                    placeholder="Add a reply..."
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 resize-y min-h-[80px]"
                  />
                  <div className="flex items-center justify-end gap-2">
                    <button
                      onClick={() => setShowReplyForm(false)}
                      className="px-3 py-1.5 text-sm text-zinc-400 hover:text-zinc-200 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSubmitReply}
                      disabled={!replyContent.trim() || isSubmitting}
                      className="px-3 py-1.5 text-sm bg-blue-600 hover:bg-blue-500 disabled:bg-zinc-700 disabled:text-zinc-500 text-white rounded-lg transition-colors"
                    >
                      {isSubmitting ? "Posting..." : "Reply"}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2 pt-2 border-t border-zinc-800">
                  <button
                    onClick={() => setShowReplyForm(true)}
                    className="text-sm text-blue-400 hover:text-blue-300 transition-colors"
                  >
                    Reply
                  </button>
                  <span className="text-zinc-600">·</span>
                  <button
                    onClick={handleResolve}
                    className="text-sm text-green-400 hover:text-green-300 transition-colors"
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
                  className="text-sm text-zinc-400 hover:text-zinc-200 transition-colors"
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
