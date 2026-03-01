Task: finalize YouTube workflow UX improvements in this repo.

Required outcomes:
1) On /youtube-videos/[id], Research and Script sections must render markdown (not raw), including GFM formatting.
2) Render YAML front matter at the top in a readable metadata UI.
3) Images section must show thumbnail gallery with a short description under each image.
4) Clicking an image opens a larger popup/lightbox preview.
5) API should provide image URLs + description metadata for video images.
6) Ensure implementation compiles (next build).

Constraints:
- Keep changes scoped to YouTube workflow files and API routes.
- Do not refactor unrelated modules.
- If everything is already correct, do minimal/no edits and confirm validation.
- At the end, run npm run build.

When completely finished, write RALPH_DONE to the done file instructed by the loop.
