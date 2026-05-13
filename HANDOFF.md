# Flowstate AI — Session Handoff

**Purpose:** Drop this into a fresh Claude Code chat so the next session has full context, no relearning required. The current session worked toward a same-day client launch; this doc captures what shipped, what's still on fire, and what to tackle next.

---

## Project facts (do not relearn)

- Next.js 16 App Router · TypeScript 5 · React 19 · Supabase · OpenAI gpt-4o · Stripe · Tailwind v4
- Production: `https://flowstate-ai-pi.vercel.app`
- Repo: `https://github.com/xafitness6/flowstate-ai`
- Admin email (hardcoded everywhere): `xavellis4@gmail.com`
- Dev server: launch is **deployment-only** — no localhost workflow. Commit → push → Vercel auto-deploys.
- Working dir: `/Users/xavierellis/Projects/flowstate-ai`
- Read [brain-graph.md](brain-graph.md) before touching anything

## Top priorities for next session (in order)

### 1. PROGRAM PAGE — verify it actually loads on production
The user has reported the `/program` page stuck on a spinner across multiple sessions. Three fix passes have shipped:
- `347bed4` — Wait for auth, finally block, swallow errors
- `a1809f3` — 4s failsafe timer
- `b3559dc` — **Default `loaded=true`; empty state renders instantly**

The latest fix in `b3559dc` makes an infinite spinner architecturally impossible — `loaded` starts true, only ever gets set true again, and the spinner branch was deleted. **First task: have the user pull up `/program` on the latest deploy and confirm.** If still broken, check:
- Vercel deployment status (latest commit may not be live yet — confirm `b3559dc` shows READY)
- Browser cache (hard refresh, `Cmd+Shift+R`)
- AppShell guard might be showing its own spinner — that one is in [src/components/layout/AppShell.tsx](src/components/layout/AppShell.tsx) and has a 5s timeout
- UserContext might be hanging — has a 5s timeout in [src/context/UserContext.tsx](src/context/UserContext.tsx)

If still broken, ask the user to open browser DevTools console and copy any errors.

### 2. ONBOARDING — Phase 2 deep calibration is scaffolded; wire it through

A new route `/onboarding/deep-calibration` was shipped in `b3559dc`. **Five chunked steps** (~10 min total):

| Chunk | Captures |
|-------|----------|
| **A — Body & history** | height_cm, weight_kg, goal_weight_kg, goal_timeframe, body_fat_pct, training_years, longest_streak, best_lift, injuries[], injury_details |
| **B — Goal elaboration** | goal_why (open), success_in_90_days (open), tried_not_worked (open), motivation_style |
| **C — Lifestyle** | preferred_time, available_days[], travel_frequency, bed_time, wake_time, stress_level (1-10) |
| **D — Nutrition specifics** | cooking_ability, foods_hate, foods_anchor, eating_start, eating_end, cheat_style, supplements, hydration_l |
| **E — Coach calibration** | coach_tone, profanity, push_level (1-10) |

**Persistence:** Auto-saves a draft to `localStorage` (`flowstate-deepcal-draft-${userId}`) on every change so a refresh doesn't lose progress. On finish, merges into `onboarding_state.intakeData.deep` and flips `hasCompletedDeepCal=true`.

**What's still missing for Phase 2:**
1. **Regenerate the program after deep cal completes.** Currently the new answers just save — the active Supabase `programs` row isn't refreshed. Need to call `syncGeneratedProgram()` with a better plan derived from the richer data (real body composition → real macros, injuries → exercise substitutions, available_days → real schedule).
2. **AI-powered re-generation.** The starter plan generator (`generateStarterPlan`) is rule-based. With deep cal data we can feed everything to GPT-4o and get a properly personalized plan. Add `/api/ai/program-generator` endpoint.
3. **Trigger.** The `DeepCalPrompt` shows on the dashboard when `hasCompletedQuickStart && !hasCompletedDeepCal`. Verify this fires for real Supabase users — `loadOnboardingState()` reads from localStorage only and might miss the Supabase flag.
4. **Server-side persistence.** Right now deep cal answers save via `saveOnboardingState` which goes to both localStorage and `onboarding_state.raw_answers`. The `raw_answers` column already exists, so no migration needed — but verify the merge works (existing `intakeData` shouldn't get nuked).
5. **Validation.** No required fields — every chunk is skippable. May want to enforce at least height + weight in Chunk A for macros.

**Phase 1 (the 6-question calibration that runs at first signup):** already wired correctly in `27d2652` — creates a real Supabase `programs` row via `syncGeneratedProgram`. No changes needed.

### 3. Manual Supabase work (still pending)
Run this SQL in the Supabase SQL Editor for the production project — it adds the archived_at column the admin bulk archive/unarchive needs:

```sql
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS profiles_archived_at_idx
  ON public.profiles (archived_at)
  WHERE archived_at IS NOT NULL;
```

Also confirm in Supabase Dashboard → Authentication → URL Configuration:
- **Site URL:** `https://flowstate-ai-pi.vercel.app`
- **Redirect URLs:** `https://flowstate-ai-pi.vercel.app/**`

And Authentication → Sessions → JWT expiry → `2592000` (30 days).

---

## What's working solidly (don't touch)

- **Admin dashboard** ([src/app/(app)/admin/page.tsx](src/app/(app)/admin/page.tsx)) — real Supabase data, 10s polling, all 6 KPI cards clickable, plan filter, leads view (renamed to Members), inline plan picker per row (upgrade/downgrade), bulk archive/unarchive/delete with checkboxes, clickable tier rows + alerts that filter the table
- **Member detail page** ([src/app/(app)/profile/[id]/page.tsx](src/app/(app)/profile/[id]/page.tsx)) — for UUIDs, fetches `{ profile, onboarding, activeProgram }` from a new `GET /api/admin/users/[id]` endpoint
- **Auth flow** — Google OAuth, magic link, password, biometric all wired. Login redirects archived users out. Sign out is centralized via `signOutEverywhere()` in [src/lib/auth/signOut.ts](src/lib/auth/signOut.ts) — clears all `flowstate-*` keys + Supabase session + biometric
- **Sidebar** — `fixed` positioned, persistently floats while content scrolls
- **Welcome page** — eliminated; unauthenticated users go straight to `/login`
- **Phase 1 calibration → Supabase program** — `/onboarding/calibration` now creates a real `programs` row via `starterPlanToProgram()` + `syncGeneratedProgram()`
- **Coach page** — hardcoded "Week 3 of 8" context replaced with live `loadActiveProgramForUser` data
- **Today's Snapshot** — new dashboard card for clients/members shows today's workout + today's meals + today's habits with big plain-English copy and tap targets
- **Leaderboard** — fake user list emptied; renders "No rankings yet" empty state
- **Calendar** — fake EVENTS / DAY_SYNOPSES wiped; renders empty until real workout_logs queries are wired

## What's still mock (deferred)

| Surface | What's mock | Effort to fix |
|---------|-------------|--------------|
| Admin Trainer Performance | SEED `getTrainerMetrics` | High — need real analytics rollup |
| Calendar daily synopses | Empty after cleanup | Medium — wire workout_logs + nutrition_logs queries by date |
| Leaderboard rankings | Empty after cleanup | Medium — needs analytics rollup |
| /form (form analyzer) | Fake submit button | High — needs video upload + AI scoring backend |
| /library "Add Video" | Stub button | Medium — needs upload + Supabase storage |
| /profile/[id] for demo accounts (u1-u12) | Static USER_DIRECTORY | Low — replace when demo accounts are retired |
| KPI "AI explanation" feature | Not built | Medium — would need `/api/admin/insights` calling GPT-4o |

## Recent commits (most recent first)

```
b3559dc Phase 2 deep calibration + program spinner final fix
a1809f3 Today's Snapshot + program spinner failsafe + KPI/adherence resize
6fb135a Launch prep batch 2: real profile-by-id, inline plan picker, kill mock data
27d2652 Launch prep: fixed sidebar, clickable KPIs, calibration → real program
347bed4 Fix infinite spinner on program pages
8748954 Wire real data + invite lookup; remove fake seeds; build fixes
```

## Coding rules (from CLAUDE.md and project memory)

- All post-login routing goes through `resolvePostLoginRoute()` in [src/lib/routing.ts](src/lib/routing.ts)
- UUID guard before any Supabase call: `UUID_RE.test(userId) && process.env.NEXT_PUBLIC_SUPABASE_URL`
- Service role key is server-only — `createAdminClient()` in [src/lib/supabase/server.ts](src/lib/supabase/server.ts)
- Sign-out goes through `signOutEverywhere()` — do NOT add new logout call sites
- TypeScript checking is the quality gate: `npx tsc --noEmit` (no test runner configured)
- Build verification: `npm run build`
- No gamification push notifications — hard rule
- Don't create CLAUDE.md/docs/README files unless explicitly asked
- Default to NO comments; only when WHY is non-obvious
- Don't add backwards-compat shims for unused code — delete it

## Useful file paths

| What | Where |
|------|-------|
| Admin dashboard | [src/app/(app)/admin/page.tsx](src/app/(app)/admin/page.tsx) |
| Profile by ID | [src/app/(app)/profile/[id]/page.tsx](src/app/(app)/profile/[id]/page.tsx) |
| Program page | [src/app/(app)/program/page.tsx](src/app/(app)/program/page.tsx) |
| Workout player | [src/app/(app)/program/workout/[workoutId]/page.tsx](src/app/(app)/program/workout/[workoutId]/page.tsx) |
| Dashboard | [src/app/(app)/dashboard/page.tsx](src/app/(app)/dashboard/page.tsx) |
| Today's Snapshot | [src/components/dashboard/TodaySnapshot.tsx](src/components/dashboard/TodaySnapshot.tsx) |
| Phase 1 calibration | [src/app/onboarding/calibration/page.tsx](src/app/onboarding/calibration/page.tsx) |
| Phase 2 deep cal | [src/app/onboarding/deep-calibration/page.tsx](src/app/onboarding/deep-calibration/page.tsx) |
| Onboarding state | [src/lib/onboarding.ts](src/lib/onboarding.ts) |
| Starter plan + program mapper | [src/lib/starterPlan.ts](src/lib/starterPlan.ts) |
| Login | [src/app/login/page.tsx](src/app/login/page.tsx) |
| Auth callback | [src/app/auth/callback/route.ts](src/app/auth/callback/route.ts) |
| AppShell guard | [src/components/layout/AppShell.tsx](src/components/layout/AppShell.tsx) |
| Sidebar | [src/components/layout/Sidebar.tsx](src/components/layout/Sidebar.tsx) |
| User context | [src/context/UserContext.tsx](src/context/UserContext.tsx) |
| Sign out helper | [src/lib/auth/signOut.ts](src/lib/auth/signOut.ts) |
| Profile mapper | [src/lib/admin/profileMapper.ts](src/lib/admin/profileMapper.ts) |
| /api/admin/users | [src/app/api/admin/users/route.ts](src/app/api/admin/users/route.ts) |
| /api/admin/users/[id] (GET+PATCH) | [src/app/api/admin/users/[id]/route.ts](src/app/api/admin/users/[id]/route.ts) |
| /api/admin/users/bulk | [src/app/api/admin/users/bulk/route.ts](src/app/api/admin/users/bulk/route.ts) |
| Setup admin script | [scripts/setup-admin.mjs](scripts/setup-admin.mjs) |

---

## Suggested first message for the next chat

> "Here's the handoff doc. Top priority: confirm `/program` actually loads now (commit `b3559dc` made it impossible to hang on a spinner). Second priority: wire the Phase 2 deep calibration (`/onboarding/deep-calibration`) so finishing it regenerates the active Supabase program with the richer data — likely via a new `/api/ai/program-generator` endpoint calling GPT-4o with the full intake + deep answers. Don't touch anything in the 'working solidly' list."

Attach this file (`HANDOFF.md`) and the next session has everything it needs.
