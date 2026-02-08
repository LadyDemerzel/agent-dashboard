"use client";

import React, { useState, useCallback, useRef, useEffect, useMemo } from "react";
import { FeedbackThread as FeedbackThreadType } from "@/lib/feedback";
import { InlineFeedbackThread } from "./InlineFeedbackThread";

interface LineNumberedContentProps {
  content: string;
  onLineRangeSelect?: (startLine: number, endLine: number) => void;
  selectedRange: { startLine: number; endLine: number } | null;
  highlightLines?: { startLine: number; endLine: number; color?: string }[];
  onLineClick?: (lineNumber: number) => void;
  // Inline comment support
  threads?: FeedbackThreadType[];
  onAddComment?: (threadId: string, content: string) => void;
  onResolveThread?: (threadId: string) => void;
  onReopenThread?: (threadId: string) => void;
  onCreateThread?: (startLine: number, endLine: number, content: string) => void;
  isCreatingThread?: boolean;
  setIsCreatingThread?: (value: boolean) => void;
  activeThreadId?: string | null;
  setActiveThreadId?: (id: string | null) => void;
}

export function LineNumberedContent({
  content,
  onLineRangeSelect,
  selectedRange,
  highlightLines = [],
  onLineClick,
  threads = [],
  onAddComment,
  onResolveThread,
  onReopenThread,
  onCreateThread,
  isCreatingThread = false,
  setIsCreatingThread,
  activeThreadId,
  setActiveThreadId,
}: LineNumberedContentProps) {
  const lines = content.split("\n");
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState<number | null>(null);
  const [dragEnd, setDragEnd] = useState<number | null>(null);
  const [newThreadContent, setNewThreadContent] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Calculate gutter width based on number of lines
  const gutterWidth = useMemo(() => {
    const numLines = lines.length;
    const digits = numLines.toString().length;
    // Minimum 2.5rem, add 0.6rem per digit for comfort
    return Math.max(2.5, 1.5 + digits * 0.6);
  }, [lines.length]);

  // Filter inline threads (threads with line numbers)
  const inlineThreads = useMemo(() => {
    return threads.filter(
      (t): t is FeedbackThreadType & { startLine: number; endLine: number } =>
        t.startLine !== null && t.endLine !== null
    );
  }, [threads]);

  // Group threads by the line they should appear after (endLine)
  const threadsByEndLine = useMemo(() => {
    const map = new Map<number, FeedbackThreadType[]>();
    inlineThreads.forEach((thread) => {
      const key = thread.endLine;
      if (!map.has(key)) {
        map.set(key, []);
      }
      map.get(key)!.push(thread);
    });
    return map;
  }, [inlineThreads]);

  // Check if there's a new thread form to show after a line
  const isNewThreadAfterLine = (lineNumber: number): boolean => {
    return (
      isCreatingThread &&
      selectedRange !== null &&
      selectedRange.endLine === lineNumber
    );
  };

  // Handle mouse down on line number
  const handleLineNumberMouseDown = useCallback(
    (lineNumber: number, event: React.MouseEvent) => {
      event.preventDefault();
      setIsDragging(true);
      setDragStart(lineNumber);
      setDragEnd(lineNumber);
      if (setIsCreatingThread) {
        setIsCreatingThread(false);
      }
    },
    [setIsCreatingThread]
  );

  // Handle mouse enter while dragging
  const handleLineNumberMouseEnter = useCallback(
    (lineNumber: number) => {
      if (isDragging && dragStart !== null) {
        setDragEnd(lineNumber);
      }
    },
    [isDragging, dragStart]
  );

  // Handle mouse up to end selection
  const handleMouseUp = useCallback(() => {
    if (isDragging && dragStart !== null && dragEnd !== null) {
      const start = Math.min(dragStart, dragEnd);
      const end = Math.max(dragStart, dragEnd);
      onLineRangeSelect?.(start, end);
    }
    setIsDragging(false);
  }, [isDragging, dragStart, dragEnd, onLineRangeSelect]);

  // Handle shift+click for range selection
  const handleLineNumberClick = useCallback(
    (lineNumber: number, event: React.MouseEvent) => {
      if (event.shiftKey && dragStart !== null) {
        const start = Math.min(dragStart, lineNumber);
        const end = Math.max(dragStart, lineNumber);
        setDragEnd(lineNumber);
        onLineRangeSelect?.(start, end);
      } else {
        setDragStart(lineNumber);
        setDragEnd(lineNumber);
        onLineClick?.(lineNumber);
        if (setActiveThreadId) {
          setActiveThreadId(null);
        }
      }
    },
    [dragStart, onLineRangeSelect, onLineClick, setActiveThreadId]
  );

  // Global mouse up handler
  useEffect(() => {
    const handleGlobalMouseUp = () => {
      if (isDragging) {
        handleMouseUp();
      }
    };

    document.addEventListener("mouseup", handleGlobalMouseUp);
    return () => document.removeEventListener("mouseup", handleGlobalMouseUp);
  }, [isDragging, handleMouseUp]);

  // Handle creating a new thread
  const handleCreateThread = async () => {
    if (!selectedRange || !newThreadContent.trim() || !onCreateThread) return;

    setIsSubmitting(true);
    try {
      await onCreateThread(
        selectedRange.startLine,
        selectedRange.endLine,
        newThreadContent
      );
      setNewThreadContent("");
      if (setIsCreatingThread) {
        setIsCreatingThread(false);
      }
      setSelectedRange?.(null);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Helper for setting selected range (internal use)
  const setSelectedRange = onLineRangeSelect
    ? (range: { startLine: number; endLine: number } | null) => {
        if (range) {
          onLineRangeSelect(range.startLine, range.endLine);
        } else {
          onLineRangeSelect(0, 0); // This won't work, need to handle null differently
        }
      }
    : null;

  // Determine if a line is in the current drag selection
  const isInDragSelection = (lineNumber: number): boolean => {
    if (!isDragging || dragStart === null || dragEnd === null) return false;
    const start = Math.min(dragStart, dragEnd);
    const end = Math.max(dragStart, dragEnd);
    return lineNumber >= start && lineNumber <= end;
  };

  // Determine if a line is in the confirmed selection
  const isInConfirmedSelection = (lineNumber: number): boolean => {
    if (!selectedRange) return false;
    return (
      lineNumber >= selectedRange.startLine &&
      lineNumber <= selectedRange.endLine
    );
  };

  // Determine if a line is highlighted by a feedback thread
  const getHighlightColor = (lineNumber: number): string | null => {
    for (const highlight of highlightLines) {
      if (
        lineNumber >= highlight.startLine &&
        lineNumber <= highlight.endLine
      ) {
        return highlight.color || "bg-blue-500/20";
      }
    }
    return null;
  };

  // Check if there are any threads for a line
  const getThreadsForLine = (lineNumber: number): FeedbackThreadType[] => {
    return threadsByEndLine.get(lineNumber) || [];
  };

  // Check if a line has active/highlighted threads
  const hasActiveThreadsOnLine = (lineNumber: number): boolean => {
    const lineThreads = getThreadsForLine(lineNumber);
    return lineThreads.some((t) => t.status === "open");
  };

  return (
    <div
      ref={containerRef}
      className="font-mono text-sm leading-relaxed"
      onMouseUp={handleMouseUp}
    >
      {lines.map((line, index) => {
        const lineNumber = index + 1;
        const inDragSelection = isInDragSelection(lineNumber);
        const inConfirmedSelection = isInConfirmedSelection(lineNumber);
        const highlightColor = getHighlightColor(lineNumber);
        const lineThreads = getThreadsForLine(lineNumber);
        const showNewThreadForm = isNewThreadAfterLine(lineNumber);
        const hasThreads = lineThreads.length > 0;

        return (
          <React.Fragment key={lineNumber}>
            {/* Line content */}
            <div
              className={`
                flex
                ${inDragSelection ? "bg-zinc-700/50" : ""}
                ${inConfirmedSelection ? "bg-zinc-600/40" : ""}
                ${highlightColor ? highlightColor : ""}
                ${hasActiveThreadsOnLine(lineNumber) ? "border-l-2 border-l-amber-500/50" : ""}
                transition-colors
                group/line
              `}
            >
              {/* Line number gutter */}
              <div
                className={`
                  select-none text-right pr-4 pl-2 py-0.5
                  text-zinc-600 text-xs cursor-pointer
                  hover:text-zinc-400 hover:bg-zinc-800/50
                  border-r border-zinc-800
                  flex-shrink-0
                  sticky left-0
                  bg-zinc-950
                  transition-colors
                  ${inDragSelection ? "bg-zinc-800" : ""}
                  ${inConfirmedSelection ? "bg-zinc-700" : ""}
                  ${highlightColor ? "bg-zinc-900/50" : ""}
                `}
                style={{ width: `${gutterWidth}rem`, minWidth: `${gutterWidth}rem` }}
                onMouseDown={(e) => handleLineNumberMouseDown(lineNumber, e)}
                onMouseEnter={() => handleLineNumberMouseEnter(lineNumber)}
                onClick={(e) => handleLineNumberClick(lineNumber, e)}
              >
                {lineNumber}
              </div>
              
              {/* Line content - with wrapping */}
              <div className="pl-4 py-0.5 text-zinc-300 whitespace-pre-wrap break-all flex-1 min-w-0">
                {line || "\u00A0"}
              </div>
            </div>

            {/* New thread form - appears after selected lines */}
            {showNewThreadForm && (
              <div className="flex">
                <div
                  className="border-r border-zinc-800 flex-shrink-0 bg-zinc-950"
                  style={{ width: `${gutterWidth}rem`, minWidth: `${gutterWidth}rem` }}
                />
                <div className="flex-1 pl-4 py-3 border-l-2 border-l-blue-500 bg-zinc-900/50">
                  <div className="mb-2">
                    <span className="text-xs text-zinc-500">
                      Commenting on{" "}
                      {selectedRange!.startLine === selectedRange!.endLine
                        ? `line ${selectedRange!.startLine}`
                        : `lines ${selectedRange!.startLine}-${selectedRange!.endLine}`}
                    </span>
                  </div>
                  <textarea
                    value={newThreadContent}
                    onChange={(e) => setNewThreadContent(e.target.value)}
                    placeholder="Add your comment..."
                    autoFocus
                    className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 resize-y min-h-[80px] mb-3"
                  />
                  <div className="flex items-center justify-end gap-2">
                    <button
                      onClick={() => {
                        if (setIsCreatingThread) setIsCreatingThread(false);
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
                      {isSubmitting ? "Posting..." : "Start Review"}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Existing threads - appear after the line they reference */}
            {hasThreads && (
              <div className="flex">
                <div
                  className="border-r border-zinc-800 flex-shrink-0 bg-zinc-950"
                  style={{ width: `${gutterWidth}rem`, minWidth: `${gutterWidth}rem` }}
                />
                <div className="flex-1 pl-4 py-2">
                  <div className="space-y-2">
                    {lineThreads.map((thread) => (
                      <InlineFeedbackThread
                        key={thread.id}
                        thread={thread}
                        onAddComment={onAddComment}
                        onResolveThread={onResolveThread}
                        onReopenThread={onReopenThread}
                        isActive={activeThreadId === thread.id}
                        onActivate={() => setActiveThreadId?.(thread.id)}
                      />
                    ))}
                  </div>
                </div>
              </div>
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}
