"use client";

import React, { useState, useCallback, useRef, useEffect } from "react";

interface LineNumberedContentProps {
  content: string;
  onLineRangeSelect?: (startLine: number, endLine: number) => void;
  selectedRange: { startLine: number; endLine: number } | null;
  highlightLines?: { startLine: number; endLine: number; color?: string }[];
  onLineClick?: (lineNumber: number) => void;
}

export function LineNumberedContent({
  content,
  onLineRangeSelect,
  selectedRange,
  highlightLines = [],
  onLineClick,
}: LineNumberedContentProps) {
  const lines = content.split("\n");
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState<number | null>(null);
  const [dragEnd, setDragEnd] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Handle mouse down on line number
  const handleLineNumberMouseDown = useCallback(
    (lineNumber: number, event: React.MouseEvent) => {
      event.preventDefault();
      setIsDragging(true);
      setDragStart(lineNumber);
      setDragEnd(lineNumber);
    },
    []
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
      }
    },
    [dragStart, onLineRangeSelect, onLineClick]
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

  return (
    <div
      ref={containerRef}
      className="font-mono text-sm leading-relaxed overflow-x-auto"
      onMouseUp={handleMouseUp}
    >
      <table className="w-full border-collapse">
        <tbody>
          {lines.map((line, index) => {
            const lineNumber = index + 1;
            const inDragSelection = isInDragSelection(lineNumber);
            const inConfirmedSelection = isInConfirmedSelection(lineNumber);
            const highlightColor = getHighlightColor(lineNumber);

            return (
              <tr
                key={lineNumber}
                className={`
                  ${inDragSelection ? "bg-zinc-700/50" : ""}
                  ${inConfirmedSelection ? "bg-zinc-600/40" : ""}
                  ${highlightColor ? highlightColor : ""}
                  transition-colors
                `}
              >
                <td
                  className={`
                    select-none text-right pr-4 pl-2 py-0.5
                    text-zinc-600 text-xs cursor-pointer
                    hover:text-zinc-400 hover:bg-zinc-800/50
                    border-r border-zinc-800
                    w-12 min-w-[3rem]
                  `}
                  onMouseDown={(e) => handleLineNumberMouseDown(lineNumber, e)}
                  onMouseEnter={() => handleLineNumberMouseEnter(lineNumber)}
                  onClick={(e) => handleLineNumberClick(lineNumber, e)}
                >
                  {lineNumber}
                </td>
                <td className="pl-4 py-0.5 whitespace-pre text-zinc-300">
                  {line || "\u00A0"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
