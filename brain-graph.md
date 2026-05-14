# Flowstate AI — Brain Graph
> Compact knowledge map. Read this first — fetch individual files only when you need implementation details.
> Auto-maintained: update this file whenever a doc changes or a new one is added.

---

## Project Identity

**Flowstate AI** — fitness coaching platform. Dual-mode: demo (localStorage) OR real Supabase.
Stack: Next.js 16 App Router · TypeScript 5 · React 19 · Supabase · OpenAI gpt-4o · Stripe · Tailwind v4 · shadcn/ui

---

## Role Hierarchy
```
master > trainer > client > member
```
- `member` — self-directed, own data only
- `client` — assigned to a trainer, read-only on their program
- `trainer` — manages assigned clients only
- `master` — full platform access, billing, admin

Use `hasAccess()` from `src/lib/roles.ts`. Role stored in Supabase `profiles`, injected into JWT via custom claim hook.

## Plan Tiers
```
foundation < training < performance < coaching
```
Use `planHasAccess()` from `src/lib/plans.ts`.

---

## Critical Rules (never break these)
- Post-login routing → always through `resolvePostLoginRoute()` in `src/lib/routing.ts`
- UUID guard → `UUID_RE.test(userId) && process.env.NEXT_PUBLIC_SUPABASE_URL` before any Supabase call
- Service role key → server-side only, never client-side
- All DB writes → validated with Zod first
- Progress photos → signed URLs only, never public URLs
- Gamification push notifications → zero. Hard rule.

---

## Knowledge Map

### [[docs/security-and-roles.md]]
Role hierarchy, RLS policies for all tables (`profiles`, `programs`, `workout_logs`), JWT custom claims, auth strategy, file upload rules (progress photos), rate limiting, audit log, MVP security checklist.
**Key patterns:** `is_master()` Postgres function, `coach_chat_visible` flag, `photos_visible` flag, signed URL delivery, Upstash rate limiting.

### [[docs/gamification-spec.md]]
5 dimensions: Streaks · Milestones · Momentum · Phase Completion · Execution Consistency. 12-badge MVP set (Grounded, Ironside, Calibrated, Phase One, Stacked, Recovered, Zero Drift). Badge tiers: Marked (silver) / Forged (amber). Record tab in Profile shows earned badges + phase history + consistency grid + milestones.
**Key rules:** No push notifications. No retroactive streaks. No points/leaderboards. Quiet, earned-feel UI.

### [[docs/decision-engine-rules.md]]
AI adjustment logic. Step increase tiers (+500 to +2,500 max). Weight-flat assessment (5+ flat days triggers full signal read). Decision branches A–E based on adherence + hunger. Training difficulty slider (1–10, 2x/month change limit for users). Workout intensity levers: weight → reps → sets → rest reduction.
**Key rules:** Max +10kg single adjustment. Min rest 30s compound / 15s isolation. No auto-decrease — holds flat, flags only.

### [[docs/profile-settings-spec.md]]
Role display → read-only badge (no selector grid). Training difficulty slider spec (amber fill, snap to integer, label per band). Profile sections order: header → your coach → coaching → display → notifications → account → danger zone.
**Key data:** `pushLevel` (1–10, default 6), `coachOverridePushLevel`, `coachingTone` (Direct/Supportive/Analytical), `units` (Metric/Imperial), `dashboardDefault`.

### [[TESTING.md]]
Full local E2E checklist. Dev Panel (bottom-left) for role switching, data seeding, first-run simulation. All routes inventory with status. localStorage keys reference. Known gaps (coach not wired to personality, nutrition static, calendar static, no persistent auth).

### [[CLAUDE.md]]
Claude-specific instructions. Memory-first navigation. Dual-mode guard. Role/plan access helpers. Post-login routing rule.

### [[README.md]]
Minimal — just the project name.

---

## All Routes
| Route | Description |
|-------|-------------|
| `/` | Dashboard (DnD cards, first-run redirect) |
| `/onboarding` | Welcome → calibration |
| `/onboarding/calibration` | 7-step wizard |
| `/program` | Active program — Today/This Week/Recent (4-section card layout) |
| `/program/builder` | Drag-and-drop workout builder, persists to Supabase |
| `/program/library` | List of user's programs — set active, duplicate, delete (SSR) |
| `/program/assign` | Trainer client assignment (mock UI — superseded by builder "Send to user" for admins) |
| `/admin/invites` | Admin invite generator (member + client, optional trainer pre-assignment) |
| `/admin/feedback` | Inbox for bug reports / feature requests submitted via the floating bug button |
| `/calendar` | Monthly schedule view (legacy mock data) |
| `/calendar/connect` | Calendar sync setup — iCal feed URL + customization |
| `/nutrition` | Macro & meal tracking |
| `/calendar` | Monthly view |
| `/coach` | AI chat |
| `/coach/intro` | Coach onboarding flow |
| `/accountability` | Habits + journal + trajectory |
| `/profile` | Own profile + settings |
| `/profile/[id]` | Role-gated user view |
| `/master` | Admin dashboard (master only) |
| `/pricing` | Pricing + plan toggle |
| `/showcase` | Component dev showcase |

---

## localStorage Keys
| Key | Purpose |
|-----|---------|
| `flowstate-onboarded` | Onboarding complete flag |
| `flowstate-active-role` | Current demo role |
| `accountability-habits-v2` | Habit definitions |
| `accountability-logs` | Daily logs (keyed YYYY-MM-DD) |
| `accountability-journal` | Journal history |
| `workout-logs` | Completed sessions |
| `dashboard-card-order` | Card layout |
| `dashboard-locked` | Layout lock boolean |
| `dashboard-default` | Preferred start screen |

---

## Key Source Files (fetch only when needed)
| File | What's there |
|------|-------------|
| `src/lib/roles.ts` | `hasAccess()`, `ROLE_COLOR`, `ROLE_LABELS` |
| `src/lib/plans.ts` | `planHasAccess()`, plan tier definitions |
| `src/lib/routing.ts` | `resolvePostLoginRoute()` — all post-login routing |
| `src/types/index.ts` | `MockUser`, `Role`, `UserStatus`, all core types |
| `src/context/UserContext.tsx` | Auth context, demo user switching |

---

## Exercise library

Read-only catalog at `public.exercises` populated from the [Free Exercise DB](https://github.com/yuhonas/free-exercise-db) (MIT, ~800 exercises with GIFs). Import:
```
npm run exercises:dry      # parse + preview without writing
npm run exercises:import   # upsert into Supabase
```
Source columns + coaching metadata (`joint_load`, `injury_friendly_for`, `contraindications`) tagged in `scripts/import-exercises.mjs`. Query via `searchExercises()` in `src/lib/db/exercises.ts`. Migration: `010_exercises_library.sql`.

## Program v2 shape & flow

Programs are stored as a **`ProgramSplitV2`** JSON blob in `programs.weekly_split`:
- `phase` — name, weeks (3–6 typical), progression rule (linear / double / RPE / manual)
- `baseWeek` — the template that repeats unless overridden
- `weekOverrides` — `{ [weekNumber]: WeekTemplate }` — replaces baseWeek for any specific week (true periodization)

Each `WeekTemplate.days[]` has `dayOfWeek`, `name`, `focus`, `estimatedMinutes`, and `exercises[]`. `WeekTemplate.intent` and `progressionThisWeek` drive the "this week" brief shown above the Today card on `/program`. Resolution is `resolveWeek(split, weekNumber)` in [src/lib/program/types.ts](src/lib/program/types.ts). Legacy array-shaped programs still load via the legacy path in `workout.ts`.

**Builder** (`/program/builder`) — full multi-week phase editor: phase metadata → progression rule → week tabs (1..N) → day selector → per-day exercise list (DnD) → exercise picker drawer (searches `public.exercises` with injury/joint filters). Saves the entire v2 split.

**AI generator** (`/program/generate` → `POST /api/ai/program-generator`) — GPT-4o produces a full phase as strict JSON (response_format json_schema). Respects equipment + injury constraints. Returns a `BuilderProgramPayload` for the front-end to preview, edit, and save through the same pipelines.

**Onboarding** — finishing `/onboarding/deep-calibration` now calls the AI program generator with the deep-cal answers and persists the result as the user's active program before redirecting to `/program`.

**Admin assign** — `/api/admin/assign-workout` accepts the full v2 `BuilderProgramPayload`, validates with `isProgramSplitV2`, and writes via service-role into the target user's `programs` row. Cross-user insert is blocked by RLS otherwise (`programs_insert_own` requires `auth.uid() = user_id`).

## Admin MRR

`/admin` counts `tier.billing = users with plan=X AND status="active"` for MRR. `tier.count` (all users in plan) is shown separately with a `(N paid)` hint when they differ. Use `/admin/users` to flip a user's `subscription_status` to `inactive` so they stop counting toward revenue without losing plan entitlements.

## SSR pattern for client-heavy pages

`/program`, `/program/library`, and `/nutrition` use a **server-fetch + client-interactivity** split:

- `page.tsx` is an async Server Component (`export const dynamic = "force-dynamic"`). It uses `createClient` from `src/lib/supabase/server.ts` + `auth.getUser()` to fetch the page's data on the server (in parallel via `Promise.all`).
- The client component (e.g. `NutritionClient.tsx`, `LibraryClient.tsx`, `ProgramClient.tsx`) accepts an `initial` prop with the SSR payload. When `initial !== null`, it seeds state and **skips the first refetch useEffect**, so the page paints with data already in place.
- `initial === null` means SSR couldn't fetch (unauthenticated / demo user). The client component falls back to its old `useEffect` + localStorage path.

**Helpers exposed for SSR consumption:** `v2ToActiveProgram` (workout.ts), `rowToMeal` (nutrition/store.ts), `dbLogToLocal` (db/workoutLogs.ts), `calculateNutritionTargets` (nutrition.ts).

## Invites system

Admins generate signup links from `/admin/invites`. Each invite has `invite_role: "member" | "client"` and optional `assigned_trainer_id` — the new account gets that role + trainer assignment via `raw_user_meta_data` on `supabase.auth.signUp` in `/invite/[token]/page.tsx`.
- Migration: `011_invite_role.sql`
- API routes: `POST/GET /api/admin/invites`, `PATCH/DELETE /api/admin/invites/[id]`
- Trainers can still create per-client invites via `/my-clients` (existing flow); admin invites are a superset.

## Feedback / bug reports

Floating bug button (bottom-right of every app page) opens a modal. Submissions go to `POST /api/feedback`, which captures user metadata server-side and runs **GPT-4o-mini triage** for bug reports (suggested root cause + fix in `ai_diagnosis` column). Admins triage in `/admin/feedback`.
- Migration: `012_feedback_reports.sql`
- Component: `src/components/feedback/BugReportButton.tsx` (wired in `AppShell`)
- Admin inbox: `/admin/feedback`

## Calendar sync (iCal feed)

Users connect any calendar app (Google / Apple / Outlook) by subscribing to a unique iCal feed URL: `/api/calendar/feed/{token}`. The feed is generated on-demand from the user's active program + habits.
- Migration: `013_calendar_preferences.sql` — one row per user; `feed_token` is the user's only credential
- API: `GET /api/calendar/feed/[token]` (public, no auth — token is the credential), `GET/PATCH/POST /api/calendar/preferences` (user-owned, RLS-gated)
- Generator: [src/lib/calendar/ics.ts](src/lib/calendar/ics.ts) — pure functions, RFC 5545 compliant
- UI: `/calendar/connect` — copyable URL, per-app setup instructions, sync toggles (workouts / rest days / habits), workout & habit times, reminder offset, color picker, horizon weeks, token rotation

**No OAuth required for iCal.** Apple Calendar / Outlook have no usable push API; the iCal feed approach covers them with one feature.

## Google Calendar real-time push (OAuth)

Optional upgrade on top of the iCal feed: connect Google directly via OAuth so workouts/habits push instantly (vs. the iCal app's ~15min – 3hr poll interval).
- Migration: `014_google_calendar.sql` — `google_calendar_tokens` table with `event_map` ({ flowstate_uid → google_event_id }) so syncs PATCH existing events instead of duplicating
- OAuth flow: `GET /api/google/oauth/start` → Google consent → `GET /api/google/oauth/callback` → upsert tokens via service role
- Push helper: [src/lib/google/push.ts](src/lib/google/push.ts) `syncToGoogleCalendar()` — refreshes access token if expired, diffs desired events against `event_map`, creates / patches / deletes accordingly
- Manual sync: `POST /api/google/sync` (used by the "Sync now" button)
- Status: `GET /api/google/status` (presence + last sync info), `DELETE /api/google/status` (revoke + delete)
- Required env vars on Vercel: `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET`. Whitelist `https://<deployment>/api/google/oauth/callback` in Google Cloud Console.

**Scope used:** `calendar.events` + `calendar.readonly` — minimum needed to insert/update on the user's primary calendar. Two-way sync (changes from Google → Flowstate) is not yet wired; that would require Google watch API + webhook reconciliation.

## In Progress / Planned
- Obsidian vault = this project folder (`/Users/xavierellis/Projects/flowstate-ai`)
- brain-graph.md = this file — read it first, not individual files
- Coach not yet wired to personality/tone settings
- Nutrition, calendar, program builder still on static mock data
- No persistent auth yet — all demo/localStorage

---

*Last updated: 2026-04-15*
