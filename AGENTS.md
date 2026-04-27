# AGENTS.md - Agent Dashboard Web App

This file defines implementation conventions for agents working in the Agent Dashboard web app.

Project root:
`~/tenxsolo/systems/agent-dashboard/`

## Core Product Conventions

### 1) Always make the UI feel responsive
Agents should prioritize immediate visual feedback so the app feels fast and alive.

Rules:
- Use skeleton loading states on page navigation whenever practical.
- Use skeleton loading states during data fetching whenever practical.
- Prefer showing a useful loading placeholder immediately rather than leaving blank space or a spinner-only screen.
- When adding a new route, view, panel, or data-driven section, actively decide what the loading experience should be.
- Loading states should match the eventual layout closely enough that the page feels stable while content loads.

Goal:
- Users should always feel that something is happening immediately.

### 2) Prefer Shadcn UI components with default styling
The design standard for this app is to stay as close as possible to the default Shadcn UI look and feel.

Rules:
- Prefer Shadcn UI components whenever they fit the use case.
- Prefer default Shadcn styling over custom styling.
- Do not introduce unnecessary visual customization when the default Shadcn component already works well.
- Only diverge from default Shadcn styles when there is a clear product or usability reason.
- When customizing, keep the result visually consistent with the default Shadcn aesthetic.

Decision guideline:
- First ask: “Can this be done well with the default Shadcn component?”
- If yes, use it with minimal modification.
- If not, make the smallest reasonable change necessary.

### 3) Standardize data fetching with SWR
The dashboard should feel as realtime as possible without every component reinventing fetch/polling logic.

Rules:
- Always poll and auto-update data when possible so pages, sidebars, status badges, feedback threads, workflow state, and settings stay fresh.
- Use SWR/useSWR for polling and non-polling client-side HTTP GET/data-fetching requests.
- Prefer `refreshInterval`, `revalidateOnFocus`, `keepPreviousData`, and sensible `dedupingInterval` settings instead of custom polling hooks or route-local intervals.
- Preserve stale data during revalidation to avoid flicker.
- Use shared fetch helpers from `src/lib/swr-fetcher.ts` for API JSON/envelope handling.
- For POST/PATCH/DELETE mutations, plain `fetch` is okay, but call the relevant SWR `mutate` after success so the UI refreshes from the canonical cache.
- Keep server components, route handlers, and server-only Node/OpenClaw integrations on normal server-side APIs; SWR is for client-side data fetching.

Decision guideline:
- First ask: “Can this client-side read be a SWR key?”
- If yes, use SWR instead of `useEffect + fetch` or custom polling.

## Reusable Component Policy

Agents must actively look for existing reusable components before creating new ones.

Required decision process:
1. Check whether an existing component already supports the use case.
2. Check whether an existing component could support the use case with a small, sensible modification.
3. Only create a brand new component if reuse or extension would be less clear, less maintainable, or more awkward than a new component.

Important:
- Do not blindly create new components.
- Do not blindly force reuse either.
- Make an explicit judgment call between reusing, modifying, or creating.

Preferred order of operations:
- Reuse an existing component as-is when it is a good fit.
- Modify/extend an existing component when that produces a cleaner system.
- Create a new component when the use case is meaningfully distinct.

When evaluating whether to reuse vs create, consider:
- API clarity
- visual consistency
- code duplication
- maintainability
- whether the abstraction will still make sense after the change

## Implementation Expectations

When making UI changes, agents should:
- inspect the existing component library and app patterns first
- preserve consistency with existing shared components
- favor shared primitives over route-local one-off implementations when appropriate
- keep loading states, empty states, and error states in mind as part of the feature
- avoid introducing unnecessary new design patterns when an existing one already works

## Practical Checklist

Before implementing:
- What is the loading state?
- Can I use a Shadcn component for this?
- Can I stay close to default Shadcn styling?
- Is there an existing reusable component I should reuse?
- If not, is it better to modify an existing component or create a new one?

## Common Commands

Run from this project directory:

```bash
npm run dev
npm run build
npm run lint
npx tsc --noEmit
```

## Default Bias

If uncertain, choose the option that:
- gives users immediate feedback,
- keeps the UI closest to default Shadcn,
- and increases reuse without forcing a bad abstraction.
