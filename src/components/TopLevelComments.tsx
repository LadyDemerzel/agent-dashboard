"use client";

import React, { useState } from "react";
import { FeedbackThread as FeedbackThreadType } from "@/lib/feedback";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

interface TopLevelCommentsProps {
  threads: FeedbackThreadType[];
  deliverableId: string;
  onAddComment: (threadId: string, content: string) => void;
  onResolveThread: (threadId: string) => void;
  onReopenThread: (threadId: string) => void;
  onCreateThread: (content: string) => void;
  onHideThread?: (threadId: string) => void;
  hiddenThreadIds?: Set<string>;
  showHiddenThreads?: boolean;
  setShowHiddenThreads?: (show: boolean) => void;
}

export function TopLevelComments({
  threads,
  deliverableId,
  onAddComment,
  onResolveThread,
  onReopenThread,
  onCreateThread,
  onHideThread,
  hiddenThreadIds = new Set(),
  showHiddenThreads = false,
  setShowHiddenThreads,
}: TopLevelCommentsProps) {
  const [showNewThreadForm, setShowNewThreadForm] = useState(false);
  const [newThreadContent, setNewThreadContent] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleHideThread = (threadId: string) => {
    onHideThread?.(threadId);
  };

  const topLevelThreads = threads.filter(
    (t) => t.startLine === null || t.endLine === null
  );

  const visibleThreads = topLevelThreads.filter((t) => !hiddenThreadIds.has(t.id));
  const hiddenCount = topLevelThreads.filter((t) => hiddenThreadIds.has(t.id)).length;

  const openThreads = visibleThreads.filter((t) => t.status === "open");
  const resolvedThreads = visibleThreads.filter((t) => t.status === "resolved");

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
    <Card className="overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-zinc-800">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium text-zinc-500 uppercase tracking-wider">
            Discussion
          </h2>
          <div className="flex items-center gap-2">
            {hiddenCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowHiddenThreads?.(!showHiddenThreads)}
                className="h-auto py-0.5 px-1.5 text-xs"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
                {showHiddenThreads ? "Hide" : "Show"} hidden ({hiddenCount})
              </Button>
            )}
            {openThreads.length > 0 && (
              <Badge variant="info">{openThreads.length} open</Badge>
            )}
            {resolvedThreads.length > 0 && (
              <Badge variant="success">{resolvedThreads.length} resolved</Badge>
            )}
          </div>
        </div>
      </div>

      {/* New Thread Button or Form */}
      <div className="p-4 border-b border-zinc-800">
        {showNewThreadForm ? (
          <div className="space-y-3">
            <Textarea
              value={newThreadContent}
              onChange={(e) => setNewThreadContent(e.target.value)}
              placeholder="Start a general discussion..."
              autoFocus
              className="min-h-[100px] resize-y"
            />
            <div className="flex items-center justify-end gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setShowNewThreadForm(false);
                  setNewThreadContent("");
                }}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleCreateThread}
                disabled={!newThreadContent.trim() || isSubmitting}
              >
                {isSubmitting ? "Posting..." : "Post Comment"}
              </Button>
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
              <svg className="w-5 h-5 text-zinc-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            </div>
            <p className="text-sm text-zinc-500">No general comments yet</p>
            <p className="text-xs text-zinc-600 mt-1">Start a discussion about this deliverable</p>
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
                    onHideThread={handleHideThread}
                  />
                ))}
              </div>
            )}

            {resolvedThreads.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center gap-2 pt-2">
                  <Separator className="flex-1" />
                  <h3 className="text-xs font-medium text-zinc-600 uppercase tracking-wider">
                    Resolved ({resolvedThreads.length})
                  </h3>
                  <Separator className="flex-1" />
                </div>
                {resolvedThreads.map((thread) => (
                  <TopLevelThreadCard
                    key={thread.id}
                    thread={thread}
                    onAddComment={onAddComment}
                    onResolveThread={onResolveThread}
                    onReopenThread={onReopenThread}
                    onHideThread={handleHideThread}
                    isResolved
                  />
                ))}
              </div>
            )}

            {showHiddenThreads && hiddenCount > 0 && (
              <div className="space-y-3 pt-4">
                <div className="flex items-center gap-2 pt-2">
                  <Separator className="flex-1" />
                  <h3 className="text-xs font-medium text-zinc-500 uppercase tracking-wider">
                    Hidden ({hiddenCount})
                  </h3>
                  <Separator className="flex-1" />
                </div>
                {topLevelThreads
                  .filter((t) => hiddenThreadIds.has(t.id))
                  .map((thread) => (
                    <div
                      key={thread.id}
                      className="flex items-center justify-between px-3 py-2 bg-zinc-800/30 border border-zinc-700/50 rounded-lg"
                    >
                      <span className="text-xs text-zinc-500">
                        {thread.comments[0]?.content.substring(0, 50)}
                        {thread.comments[0]?.content.length > 50 ? "..." : ""}
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-auto py-0.5 px-1.5 text-xs"
                        onClick={() => handleHideThread(thread.id)}
                      >
                        Show
                      </Button>
                    </div>
                  ))}
              </div>
            )}
          </div>
        )}
      </div>
    </Card>
  );
}

interface TopLevelThreadCardProps {
  thread: FeedbackThreadType;
  onAddComment: (threadId: string, content: string) => void;
  onResolveThread: (threadId: string) => void;
  onReopenThread: (threadId: string) => void;
  onHideThread: (threadId: string) => void;
  isResolved?: boolean;
}

function TopLevelThreadCard({
  thread,
  onAddComment,
  onResolveThread,
  onReopenThread,
  onHideThread,
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
      return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    }
  };

  return (
    <div className={`border rounded-lg overflow-hidden ${isResolved ? "border-zinc-700/50 bg-zinc-900/30" : "border-zinc-700 bg-zinc-900"}`}>
      {thread.outdated && !isResolved && (
        <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-950/50 border-b border-amber-600/30">
          <Badge variant="warning" className="rounded text-[10px] px-1.5 py-0">OUTDATED</Badge>
          <span className="text-xs text-amber-500/70">Content has changed since this comment</span>
        </div>
      )}

      <div
        className={`flex items-center justify-between px-3 py-2 cursor-pointer hover:bg-zinc-800/50 transition-colors ${isResolved ? "bg-zinc-800/20" : "bg-zinc-800/30"}`}
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-2">
          <Badge variant={isResolved ? "success" : thread.outdated ? "warning" : "info"}>
            {isResolved ? "Resolved" : thread.outdated ? "Outdated" : "Open"}
          </Badge>
          <span className="text-xs text-zinc-600">
            {thread.comments.length} {thread.comments.length === 1 ? "comment" : "comments"}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-zinc-500 text-xs">{formatDate(thread.createdAt)}</span>
          <svg className={`w-4 h-4 text-zinc-500 transition-transform ${isExpanded ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </div>

      {isExpanded && (
        <div className="p-3 space-y-3">
          <div className="space-y-3">
            {thread.comments.map((comment, index) => (
              <div key={comment.id} className="flex gap-2">
                <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${comment.author === "user" ? "bg-blue-500/20" : "bg-purple-500/20"}`}>
                  <span className="text-xs font-medium">{comment.author === "user" ? "I" : "A"}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="font-medium text-sm text-zinc-200">{comment.author === "user" ? "Ittai" : "Agent"}</span>
                    <span className="text-xs text-zinc-500">{formatDate(comment.createdAt)}</span>
                    {index === 0 && <Badge variant="default" className="text-[10px] px-1.5 py-0">Original</Badge>}
                  </div>
                  <div className="text-sm text-zinc-300 whitespace-pre-wrap">{comment.content}</div>
                </div>
              </div>
            ))}
          </div>

          {!isResolved ? (
            showReplyForm ? (
              <div className="mt-3 space-y-2 pl-9">
                <Textarea value={replyContent} onChange={(e) => setReplyContent(e.target.value)} placeholder="Add a reply..." autoFocus className="min-h-[60px] resize-y" />
                <div className="flex items-center justify-end gap-2">
                  <Button variant="ghost" size="sm" onClick={() => { setShowReplyForm(false); setReplyContent(""); }}>Cancel</Button>
                  <Button size="sm" onClick={handleSubmitReply} disabled={!replyContent.trim() || isSubmitting}>{isSubmitting ? "Posting..." : "Reply"}</Button>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2 pt-2 border-t border-zinc-800 pl-9">
                <Button variant="link" size="sm" className="h-auto p-0 text-xs text-blue-400" onClick={() => setShowReplyForm(true)}>Reply</Button>
                <span className="text-zinc-600">·</span>
                <Button variant="link" size="sm" className="h-auto p-0 text-xs text-green-400" onClick={() => onResolveThread(thread.id)}>Resolve</Button>
                <span className="text-zinc-600">·</span>
                <Button variant="link" size="sm" className="h-auto p-0 text-xs text-zinc-500" onClick={() => onHideThread(thread.id)}>Hide</Button>
              </div>
            )
          ) : (
            <div className="flex items-center gap-2 pt-2 border-t border-zinc-800 pl-9">
              <Button variant="link" size="sm" className="h-auto p-0 text-xs text-zinc-400" onClick={() => onReopenThread(thread.id)}>Reopen thread</Button>
              <span className="text-zinc-600">·</span>
              <Button variant="link" size="sm" className="h-auto p-0 text-xs text-zinc-500" onClick={() => onHideThread(thread.id)}>Hide</Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
