# PROMPT_build_youtube_stage_refactor.md

Task: Refactor YouTube workflow stage cards to centralize status logic and ensure artifact-first precedence.

## Requirements
1) Centralize stage/status computation in a reusable component or shared module used by all YouTube workflow stage cards.
2) Artifact-first precedence for relevant stages (research, script, images, audio), so stale backend `status` does not incorrectly show "In Progress" when artifacts already exist.
3) Keep existing UI behavior and styling unchanged except correctness/consistency.
4) Run verification (build/lint/tests if available) and report results.

## Project path
Work in this repo: `~/tenxsolo/systems/agent-dashboard`

## Implementation guidance
- Current page is `src/app/youtube-videos/[id]/page.tsx`.
- Create a shared module (e.g., `src/lib/youtube-workflow.ts`) with:
  - phase definitions
  - centralized `getYoutubePhaseStatus(...)` logic
  - artifact detection helpers
- Create a reusable stage-card component (e.g., `src/components/youtube/YouTubeWorkflowStageCard.tsx`) that renders one card and button states/text.
- Ensure every stage card uses centralized status data.
- Audio stage should be artifact-first too (detect saved audio artifact, not only backend status).

## Data considerations
- API currently returns `has_research`, `has_script`, `imageCount`, and `status`.
- Extend API if needed to return audio artifact info (e.g., `has_audio`, `audioCount`) by checking expected files in video folder.

## Validation
Run available checks:
- `npm run lint`
- `npm run build`
- tests if available in package scripts

If done, summarize:
- path used
- files changed
- logic summary
- checks and outcomes
