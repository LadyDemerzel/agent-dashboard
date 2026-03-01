"use client";

import { useState } from "react";
import { DiffResult, DiffHunk, DiffLine } from "@/lib/versions";

interface DiffViewerProps {
  diff: DiffResult;
  showStats?: boolean;
  maxHeight?: string;
}

function DiffLineComponent({ line }: { line: DiffLine }) {
  const bgColor =
    line.type === "added"
      ? "bg-green-500/10"
      : line.type === "removed"
      ? "bg-red-500/10"
      : "bg-transparent";
  
  const borderColor =
    line.type === "added"
      ? "border-l-green-500"
      : line.type === "removed"
      ? "border-l-red-500"
      : "border-l-transparent";
  
  const textColor =
    line.type === "added"
      ? "text-green-200"
      : line.type === "removed"
      ? "text-red-200"
      : "text-muted-foreground";

  const prefix =
    line.type === "added" ? "+" : line.type === "removed" ? "-" : " ";

  return (
    <div
      className={`flex ${bgColor} border-l-2 ${borderColor} font-mono text-sm hover:bg-muted/50 transition-colors`}
    >
      {/* Line numbers */}
      <div className="flex select-none">
        <div className="w-12 text-right pr-2 text-muted-foreground text-xs py-0.5">
          {line.oldLineNumber || ""}
        </div>
        <div className="w-12 text-right pr-2 text-muted-foreground text-xs py-0.5 border-r border-border">
          {line.newLineNumber || ""}
        </div>
      </div>
      
      {/* Content */}
      <div className={`flex-1 pl-3 py-0.5 whitespace-pre ${textColor}`}>
        <span className="select-none opacity-50 mr-1">{prefix}</span>
        {line.content || " "}
      </div>
    </div>
  );
}

function DiffHunkComponent({ hunk }: { hunk: DiffHunk }) {
  return (
    <div className="mb-2">
      {/* Hunk header */}
      <div className="bg-muted/50 text-muted-foreground text-xs px-4 py-1 font-mono select-none">
        @@ -{hunk.oldStart},{hunk.oldCount} +{hunk.newStart},{hunk.newCount} @@
      </div>
      
      {/* Hunk lines */}
      <div>
        {hunk.lines.map((line, idx) => (
          <DiffLineComponent key={idx} line={line} />
        ))}
      </div>
    </div>
  );
}

export function DiffViewer({ diff, showStats = true, maxHeight = "600px" }: DiffViewerProps) {
  const [expanded, setExpanded] = useState(true);

  const formatDate = (timestamp: string) => {
    if (!timestamp) return "Unknown";
    return new Date(timestamp).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="bg-background border border-border rounded-lg overflow-hidden">
      {/* Header */}
      <div className="bg-card border-b border-border px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setExpanded(!expanded)}
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              {expanded ? (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              ) : (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              )}
            </button>
            <span className="text-sm font-medium text-foreground">
              Changes: v{diff.fromVersion} → v{diff.toVersion}
            </span>
          </div>
          
          {showStats && (
            <div className="flex items-center gap-4 text-sm">
              <div className="flex items-center gap-1.5">
                <span className="text-green-400 font-mono">+{diff.stats.additions}</span>
                <span className="text-muted-foreground">additions</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-red-400 font-mono">-{diff.stats.deletions}</span>
                <span className="text-muted-foreground">deletions</span>
              </div>
            </div>
          )}
        </div>
        
        {/* Timestamps */}
        <div className="flex items-center gap-6 mt-2 text-xs text-muted-foreground pl-7">
          <div>
            From: <span className="text-muted-foreground">{formatDate(diff.fromTimestamp)}</span>
          </div>
          <div>
            To: <span className="text-muted-foreground">{formatDate(diff.toTimestamp)}</span>
          </div>
        </div>
      </div>

      {/* Diff content */}
      {expanded && (
        <div 
          className="overflow-auto"
          style={{ maxHeight }}
        >
          {diff.hunks.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              <p className="text-sm">No changes detected</p>
            </div>
          ) : (
            <div className="py-2">
              {diff.hunks.map((hunk, idx) => (
                <DiffHunkComponent key={idx} hunk={hunk} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Compact diff view for inline display
interface CompactDiffViewProps {
  diff: DiffResult;
}

export function CompactDiffView({ diff }: CompactDiffViewProps) {
  return (
    <div className="bg-background border border-border rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm text-muted-foreground">
          v{diff.fromVersion} → v{diff.toVersion}
        </span>
        <div className="flex items-center gap-3 text-sm">
          <span className="text-green-400">+{diff.stats.additions}</span>
          <span className="text-red-400">-{diff.stats.deletions}</span>
        </div>
      </div>
      
      {diff.hunks.slice(0, 3).map((hunk, hunkIdx) => (
        <div key={hunkIdx} className="mb-2 text-xs font-mono">
          {hunk.lines.slice(0, 10).map((line, lineIdx) => {
            const bgColor =
              line.type === "added"
                ? "bg-green-500/10"
                : line.type === "removed"
                ? "bg-red-500/10"
                : "";
            const textColor =
              line.type === "added"
                ? "text-green-300"
                : line.type === "removed"
                ? "text-red-300"
                : "text-muted-foreground";
            const prefix =
              line.type === "added" ? "+" : line.type === "removed" ? "-" : " ";
            
            return (
              <div key={lineIdx} className={`${bgColor} ${textColor} px-2 py-0.5 truncate`}>
                {prefix} {line.content}
              </div>
            );
          })}
          {hunk.lines.length > 10 && (
            <div className="text-muted-foreground px-2 py-0.5">
              ... and {hunk.lines.length - 10} more lines
            </div>
          )}
        </div>
      ))}
      
      {diff.hunks.length > 3 && (
        <div className="text-muted-foreground text-xs text-center py-2">
          + {diff.hunks.length - 3} more hunks
        </div>
      )}
    </div>
  );
}

// Version selector component
interface VersionSelectorProps {
  versions: Array<{ version: number; timestamp: string; updatedBy: string; comment?: string }>;
  currentVersion: number;
  compareVersion?: number;
  onSelectCurrent: (version: number) => void;
  onSelectCompare: (version: number) => void;
}

export function VersionSelector({
  versions,
  currentVersion,
  compareVersion,
  onSelectCurrent,
  onSelectCompare,
}: VersionSelectorProps) {
  const formatDate = (timestamp: string) => {
    return new Date(timestamp).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
  };

  return (
    <div className="bg-card border border-border rounded-lg p-4">
      <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-3">
        Version History
      </h3>
      
      <div className="space-y-2 max-h-64 overflow-auto">
        {versions.map((version) => (
          <div
            key={version.version}
            className={`p-3 rounded-lg border transition-colors ${
              currentVersion === version.version
                ? "bg-muted border-border"
                : compareVersion === version.version
                ? "bg-muted/50 border-border"
                : "bg-transparent border-border hover:border-border"
            }`}
          >
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <input
                  type="radio"
                  name="currentVersion"
                  checked={currentVersion === version.version}
                  onChange={() => onSelectCurrent(version.version)}
                  className="accent-zinc-500"
                />
                <input
                  type="radio"
                  name="compareVersion"
                  checked={compareVersion === version.version}
                  onChange={() => onSelectCompare(version.version)}
                  className="accent-zinc-500"
                />
                <span className="text-sm font-medium text-foreground">
                  v{version.version}
                </span>
              </div>
              <span className="text-xs text-muted-foreground">
                {formatDate(version.timestamp)}
              </span>
            </div>
            <div className="pl-10 text-xs text-muted-foreground">
              by {version.updatedBy}
              {version.comment && (
                <span className="block mt-0.5 text-muted-foreground italic">
                  “{version.comment}”
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
      
      <div className="mt-3 pt-3 border-t border-border text-xs text-muted-foreground">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full bg-zinc-600" />
            <span>Current</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full bg-zinc-700 border border-border" />
            <span>Compare with</span>
          </div>
        </div>
      </div>
    </div>
  );
}