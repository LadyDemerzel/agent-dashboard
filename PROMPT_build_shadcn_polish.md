# PROMPT_build_shadcn_polish.md

You are working on the Agent Dashboard Next.js app.

## Goal
Do a top-to-bottom visual redesign while preserving ALL current behavior and functionality.

The product must look like polished professional software, not a toy.

## Hard constraints
- DO NOT change business logic, API contracts, routes, data flow, or feature behavior.
- Keep all existing functionality exactly intact.
- Focus only on aesthetic/design implementation and component-level presentation.
- Use shadcn components with default shadcn styling everywhere possible.

## Design direction
- Prioritize default shadcn look and feel (clean, refined, product-grade).
- Remove ad-hoc bespoke styling where possible and rely on reusable UI primitives.
- Ensure typography, spacing scale, borders, radii, and hierarchy are consistent.
- Improve visual polish across all pages: dashboard, agents, deliverables, research, x-posts, youtube, timeline, details and forms.
- Keep left-nav icons vector and clean (no emoji).

## Required technical tasks
1. Normalize global design tokens to canonical shadcn-style semantics (`background`, `foreground`, `card`, `muted`, `border`, etc.) and ensure components consume these tokens.
2. Expand `src/components/ui/*` where needed and migrate feature components/pages to use UI primitives consistently.
3. Reduce one-off utility class noise and enforce consistent layout shells and card patterns.
4. Ensure all tabs, buttons, badges, inputs, textareas, dialogs, and list/table-like blocks use coherent shadcn conventions.
5. Keep dark mode as the default aesthetic.

## Validation (required)
- `npm run lint`
- `npm run build`

Fix any build errors. Warnings are okay unless they block functionality.

## Completion criteria
Only output `RALPH_DONE` when:
- visual redesign is complete across the app,
- functionality is preserved,
- lint/build executed successfully,
- changes are committed on current branch with clear message(s).
