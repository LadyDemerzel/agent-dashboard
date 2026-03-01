You are running a focused Ralph build iteration for a regression fix in agent-dashboard.

Goal: Fix urgent client-side crash on /youtube-videos/[id] introduced during YouTube workflow stage-card refactor.

Repro report:
- Opening /youtube-videos/a-knight-of-seven-kingdoms-tv-season-1-episode-5 can show: "Application error: a client-side exception has occurred while loading mac-mini".

Likely touch points:
- src/app/youtube-videos/[id]/page.tsx
- src/components/youtube/YouTubeWorkflowStageCard.tsx
- src/lib/youtube-workflow.ts
- src/app/api/youtube/[id]/route.ts
- Any shared components used by this page.

Requirements:
1) Reproduce locally and identify exact root cause.
2) Implement minimal safe fix; keep centralized reusable YouTube stage-card component and workflow module.
3) Prefer defensive handling for malformed/missing data from API/filesystem where appropriate.
4) Do not broad-revert refactor.
5) Verify with npm run build and a browser load check for the target page.
6) Summarize root cause, changed files, exact fix, and verification.

When done, print RALPH_DONE.