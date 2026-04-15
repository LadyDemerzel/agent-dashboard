import { createTwoFilesPatch } from 'diff';
import type { DiffHunk, DiffLine, DiffResult } from '@/lib/versions';

function parseDiffPatch(patch: string): DiffHunk[] {
  const hunks: DiffHunk[] = [];
  const lines = patch.split('\n');
  let currentHunk: DiffHunk | null = null;
  let oldLineNum = 0;
  let newLineNum = 0;

  for (const line of lines) {
    const hunkMatch = line.match(/^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
    if (hunkMatch) {
      if (currentHunk) hunks.push(currentHunk);
      const oldStart = parseInt(hunkMatch[1], 10);
      const newStart = parseInt(hunkMatch[2], 10);
      oldLineNum = oldStart;
      newLineNum = newStart;
      currentHunk = { oldStart, oldCount: 0, newStart, newCount: 0, lines: [] };
      continue;
    }

    if (!currentHunk) continue;

    if (line.startsWith('+')) {
      currentHunk.lines.push({ type: 'added', lineNumber: newLineNum, content: line.slice(1), newLineNumber: newLineNum } satisfies DiffLine);
      newLineNum += 1;
      currentHunk.newCount += 1;
    } else if (line.startsWith('-')) {
      currentHunk.lines.push({ type: 'removed', lineNumber: oldLineNum, content: line.slice(1), oldLineNumber: oldLineNum } satisfies DiffLine);
      oldLineNum += 1;
      currentHunk.oldCount += 1;
    } else if (line.startsWith(' ')) {
      currentHunk.lines.push({
        type: 'context',
        lineNumber: oldLineNum,
        content: line.slice(1),
        oldLineNumber: oldLineNum,
        newLineNumber: newLineNum,
      } satisfies DiffLine);
      oldLineNum += 1;
      newLineNum += 1;
      currentHunk.oldCount += 1;
      currentHunk.newCount += 1;
    }
  }

  if (currentHunk) hunks.push(currentHunk);
  return hunks;
}

export function generateClientDiff(oldContent: string, newContent: string, fileName = 'file.md'): DiffResult {
  const patch = createTwoFilesPatch(fileName, fileName, oldContent, newContent, 'previous', 'current');
  const hunks = parseDiffPatch(patch);
  let additions = 0;
  let deletions = 0;

  for (const hunk of hunks) {
    for (const line of hunk.lines) {
      if (line.type === 'added') additions += 1;
      if (line.type === 'removed') deletions += 1;
    }
  }

  return {
    fromVersion: 0,
    toVersion: 0,
    fromTimestamp: '',
    toTimestamp: new Date().toISOString(),
    hunks,
    stats: {
      additions,
      deletions,
      changes: additions + deletions,
    },
  };
}
