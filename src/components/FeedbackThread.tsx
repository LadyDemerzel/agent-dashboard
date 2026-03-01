"use client";

import React, { useState } from "react";
import { FeedbackThread as FeedbackThreadType } from "@/lib/feedback";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

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
    <Card
      className={cn(
        "overflow-hidden",
        isResolved && "opacity-75"
      )}
    >
      {/* Thread Header */}
      <div
        className={cn(
          "flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-zinc-800/50 transition-colors",
          isResolved ? "bg-zinc-800/30" : "bg-zinc-800/50"
        )}
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-3">
          <Badge variant={isResolved ? "success" : "info"}>
            {isResolved ? "Resolved" : "Open"}
          </Badge>
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
            className={cn("w-4 h-4 text-zinc-500 transition-transform", isExpanded && "rotate-180")}
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
                  className={cn(
                    "w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0",
                    comment.author === "user" ? "bg-blue-500/20" : "bg-purple-500/20"
                  )}
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
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                        Original
                      </Badge>
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
                  <Textarea
                    value={replyContent}
                    onChange={(e) => setReplyContent(e.target.value)}
                    placeholder="Add a reply..."
                    className="min-h-[80px] resize-y"
                  />
                  <div className="flex items-center justify-end gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowReplyForm(false)}
                    >
                      Cancel
                    </Button>
                    <Button
                      size="sm"
                      onClick={handleSubmitReply}
                      disabled={!replyContent.trim() || isSubmitting}
                    >
                      {isSubmitting ? "Posting..." : "Reply"}
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  <Separator />
                  <div className="flex items-center gap-2">
                    <Button
                      variant="link"
                      size="sm"
                      onClick={() => setShowReplyForm(true)}
                      className="text-blue-400 hover:text-blue-300 p-0 h-auto"
                    >
                      Reply
                    </Button>
                    <span className="text-zinc-600">{"\u00B7"}</span>
                    <Button
                      variant="link"
                      size="sm"
                      onClick={handleResolve}
                      className="text-green-400 hover:text-green-300 p-0 h-auto"
                    >
                      Resolve
                    </Button>
                  </div>
                </>
              )}
            </>
          ) : (
            onReopenThread && (
              <>
                <Separator />
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleReopen}
                  >
                    Reopen thread
                  </Button>
                </div>
              </>
            )
          )}
        </div>
      )}
    </Card>
  );
}
