"use client";

import React from "react";
import { FeedbackThread as FeedbackThreadType } from "@/lib/feedback";
import { FeedbackThread } from "./FeedbackThread";

interface FeedbackSidebarProps {
  threads: FeedbackThreadType[];
  deliverableId: string;
  onAddComment: (threadId: string, content: string) => void;
  onResolveThread: (threadId: string) => void;
  onReopenThread: (threadId: string) => void;
  onJumpToLine: (lineNumber: number) => void;
  onCreateThread: (startLine: number, endLine: number, content: string) => void;
  selectedRange: { startLine: number; endLine: number } | null;
  isCreatingThread: boolean;
  setIsCreatingThread: (value: boolean) => void;
}

export function FeedbackSidebar({
  threads,
  deliverableId,
  onAddComment,
  onResolveThread,
  onReopenThread,
  onJumpToLine,
  onCreateThread,
  selectedRange,
  isCreatingThread,
  setIsCreatingThread,
}: FeedbackSidebarProps) {
  const [newThreadContent, setNewThreadContent] = React.useState("");
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const openThreads = threads.filter((t) => t.status === "open");
  const resolvedThreads = threads.filter((t) => t.status === "resolved");

  const handleCreateThread = async () => {
    if (!selectedRange || !newThreadContent.trim()) return;

    setIsSubmitting(true);
    try {
      await onCreateThread(
        selectedRange.startLine,
        selectedRange.endLine,
        newThreadContent
      );
      setNewThreadContent("");
      setIsCreatingThread(false);
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
            Feedback
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

      {/* New Thread Form */}
      {isCreatingThread && selectedRange && (
        <div className="p-4 border-b border-zinc-800 bg-zinc-800/30">
          <div className="mb-3">
            <span className="text-xs text-zinc-500">
              Commenting on{" "}
              {selectedRange.startLine === selectedRange.endLine
                ? `line ${selectedRange.startLine}`
                : `lines ${selectedRange.startLine}-${selectedRange.endLine}`}
            </span>
          </div>
          <textarea
            value={newThreadContent}
            onChange={(e) => setNewThreadContent(e.target.value)}
            placeholder="Add your comment..."
            className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 resize-y min-h-[100px] mb-3"
          />
          <div className="flex items-center justify-end gap-2">
            <button
              onClick={() => {
                setIsCreatingThread(false);
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
              {isSubmitting ? "Creating..." : "Start Review"}
            </button>
          </div>
        </div>
      )}

      {/* Selection Prompt */}
      {!isCreatingThread && selectedRange && threads.length === 0 && (
        <div className="p-4 border-b border-zinc-800 bg-zinc-800/20">
          <p className="text-sm text-zinc-400 mb-2">
            Selected{" "}
            {selectedRange.startLine === selectedRange.endLine
              ? `line ${selectedRange.startLine}`
              : `lines ${selectedRange.startLine}-${selectedRange.endLine}`}
          </p>
          <button
            onClick={() => setIsCreatingThread(true)}
            className="text-sm text-blue-400 hover:text-blue-300 transition-colors"
          >
            Add comment →
          </button>
        </div>
      )}

      {/* Threads List */}
      <div className="max-h-[500px] overflow-y-auto">
        {threads.length === 0 ? (
          <div className="p-8 text-center">
            <div className="w-12 h-12 bg-zinc-800 rounded-full flex items-center justify-center mx-auto mb-3">
              <svg
                className="w-6 h-6 text-zinc-500"
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
            <p className="text-sm text-zinc-500 mb-1">No feedback yet</p>
            <p className="text-xs text-zinc-600">
              Select lines in the content to add comments
            </p>
          </div>
        ) : (
          <div className="p-4 space-y-4">
            {openThreads.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-xs font-medium text-zinc-500 uppercase tracking-wider">
                  Open
                </h3>
                {openThreads.map((thread) => (
                  <FeedbackThread
                    key={thread.id}
                    thread={thread}
                    onAddComment={onAddComment}
                    onResolveThread={onResolveThread}
                    deliverableId={deliverableId}
                  />
                ))}
              </div>
            )}

            {resolvedThreads.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-xs font-medium text-zinc-500 uppercase tracking-wider">
                  Resolved
                </h3>
                {resolvedThreads.map((thread) => (
                  <FeedbackThread
                    key={thread.id}
                    thread={thread}
                    onAddComment={onAddComment}
                    onResolveThread={onResolveThread}
                    onReopenThread={onReopenThread}
                    deliverableId={deliverableId}
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
