Task: Fix two regressions on /youtube-videos/[id].

Issues to fix:
1) Rendered markdown for research/scripts does not fill the full width of the scroll container. Make rendered markdown content fill full available width.
2) Images section shows fallback text even when images exist on disk for some videos. Ensure thumbnails + descriptions display whenever images are collected.

Hints/constraints:
- Keep changes scoped to YouTube detail page and related YouTube API route(s).
- Check for any data-shape overwrite issues from video.yaml fields (e.g. `images:` key) clobbering computed image arrays.
- Ensure API returns image list reliably.
- Validate by running:
  - npm run build
  - an API sanity check for a known video with images (e.g. /api/youtube/the-history-of-artificial-intelligence) showing images array length > 0

When completely finished, write RALPH_DONE to the done file instructed by the loop.
