# CONTEXT.md — Flowstate AI

## Current session: Phase 1.1 — Persistence bugs

## Status of prior phases
- Phase 0.1 complete: design tokens + primitives shipped, key pages refactored.
- Phase 0.2 complete: Sheet + StickyFooter primitives, AI food modal refactored, viewport CSS vars in place.

## Goal
Fix three broken save / persistence flows. Each one currently shows success UI to the user but does NOT actually write to Supabase, or fails silently. This is the most damaging class of bug pre-launch — users trust completed actions, and silent data loss kills retention.

## Bugs to fix

### Bug 1: Track page "Day locked in" button
- **Location:** `/track` (or `/accountability` — find the page that shows the "Locked in / Focused / Tired but moving / Off today / Rough" state selector + reflection textarea + green "Day locked in — all required tasks complete" button)
- **Current behavior:** Clicking the button shows success styling but does NOT persist the day's state, reflection, and required-task completion to Supabase.
- **Expected behavior:** Click writes a row to the daily-checkin / accountability table containing: date, user_id, state, reflection text, required_tasks_completed (boolean or array). On reload, today's entry should still be present.

### Bug 2: Nutrition Notes "Save note" button
- **Location:** Analytics & Trends section under nutrition (`/nutrition` or `/program/analytics`) — the textarea labeled "NUTRITION NOTES" with a "Save note" link/button bottom-right.
- **Current behavior:** Click does nothing visible; text is lost on reload.
- **Expected behavior:** Click writes the note to a nutrition_notes table (or extends an existing daily summary row) with date, user_id, text. On reload, the note re-populates the textarea. Show a brief "Saved" confirmation state.

### Bug 3: Workout "Regenerate" button
- **Location:** `/program/generate` — after generating a workout, the "Regenerate" button beside "Workout generated · tuned for [filter]".
- **Current behavior:** Clicking Regenerate returns the same / cached workout, not a new one.