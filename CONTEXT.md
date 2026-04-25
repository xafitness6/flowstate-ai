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
- **Expected behavior:** Click triggers a fresh AI call with a varied seed (timestamp, random nonce, or "regeneration_attempt" counter passed in the prompt) so the LLM produces a meaningfully different workout. The currently displayed workout is replaced.

## Files in scope

### Likely paths (Claude Code: confirm with grep before editing)
- Track / lock-in: `src/app/(app)/accountability/page.tsx` or wherever the lock-in component lives. Search for "Day locked in" or "all required tasks complete" string.
- Nutrition note: search for "Save note" or "NUTRITION NOTES" string. Likely `src/app/(app)/nutrition/` or a sub-component.
- Regenerate: `src/app/(app)/program/generate/page.tsx` and the `/api/ai/workout-parser` or related route.

### Database
- Inspect existing Supabase schema in `supabase/migrations/` to determine if tables already exist for daily check-ins / nutrition notes. If a table exists, use it. If NOT, create a new migration file with sensible schema and RLS policies (user can only read/write their own rows).

### Do NOT touch
- Visual design of these pages (Phase 0 already polished these surfaces — don't redesign while fixing logic)
- Any other features
- Any other broken buttons that are NOT in this list — log them but don't fix

## Verification per bug

### Bug 1
- Click "Day locked in" → check Supabase table editor → row exists for today with correct fields
- Reload page → button shows already-locked state, reflection text re-populates, state pill is highlighted

### Bug 2
- Type a note → click "Save note" → see "Saved" confirmation
- Reload → text is still in textarea
- Check Supabase → row exists

### Bug 3
- Generate a workout → note the exercises
- Click Regenerate → exercises change meaningfully (not just reordered)
- Click Regenerate 3 more times → each result is distinct

## Definition of done
- [ ] All three bugs fixed and Supabase persistence confirmed
- [ ] Any new migrations applied and committed
- [ ] No regressions on Phase 0.1/0.2 work
- [ ] `npm run build` passes
- [ ] Pushed to main

## Out of scope
- Auto-completing Track nutrition checkboxes from logged macros (that's Phase 2.2)
- Drag-and-drop foods (Phase 2.2)
- AI Coach plan rewrites (Phase 4)
- Multi-assign clients (Phase 3.2)
- Anything visual

## Notes for Claude Code
- Before writing, grep for the exact UI strings ("Day locked in", "Save note", "Regenerate") to find the correct files. Do NOT guess.
- If you find that one of these "bugs" is actually working correctly in the code (e.g., it does call Supabase but the page doesn't re-fetch), fix the actual root cause — surface what you found.
- For Bug 3, the regeneration variation needs to be in the LLM prompt input, not just a new request. Add something like a "variation seed" or "previous_exercises_to_avoid" param so the model is incentivized to produce different output.
- Show test evidence in the final summary: file paths edited, schema changes, and one-sentence proof each bug was actually fixed.