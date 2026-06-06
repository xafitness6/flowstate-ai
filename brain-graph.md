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
| `/admin/invites` | Admin invite generator + opened/accepted/login funnel tracking |
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
- Migrations: `011_invite_role.sql`, `025_invite_tracking.sql`
- API routes: `POST/GET /api/admin/invites`, `PATCH/DELETE /api/admin/invites/[id]`, public `GET/POST /api/invites/[token]`, `POST /api/invites/accept-current`
- Funnel tracking: public invite GET stamps `first_opened_at`, `last_opened_at`, `open_count`; `acceptInviteForUser()` records accepted/logged-in users in `invite_acceptances` and updates invite summary fields (`accepted_count`, `last_accepted_*`, `logged_in_at`, `last_login_at`). Open links remain reusable and count each distinct accepted user once.
- `/admin/invites` shows Total/Pending/Opened/Accepted, per-link funnel chips, accepted-by details, last login, and an amber follow-up cue when a link was opened but no account was created.
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
- UI: `/calendar/connect` — copyable URL, per-app setup instructions, sync toggles (workouts / rest days / habits), workout & habit times, multi-reminder offsets, color picker, horizon weeks, token rotation
- Migration: `015_calendar_multi_reminders.sql` — replaces single `reminder_minutes` with per-category arrays (`reminders_workout`, `reminders_habit`, `reminders_rest`) so users can stack reminders ("1 hour before AND 15 min before")

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

## Client file (trainer view)

`/clients/[id]` is the trainer/admin "trainer's-eyes" view of one client. Tabbed hub:
- **Overview** (built) — **Client info vitals strip** (age/sex/weight/height/body fat/goal weight, `ClientVitals`, reads top-level intake + `deep`) + onboarding status + "Send through onboarding" (resets `onboarding_state`, also EMAILS the client) + intake readout + AI prefill panel; printable to PDF
- **Program** (built) — trainer snapshot + active program card. **Build / Edit / New** buttons open `/program/builder?clientId=…&client=…[&edit=1]` (builder targets that client, hydrates from their active program when editing, saves via `POST /api/clients/[id]/program`). The admin-only `/api/admin/assign-workout` still exists for cross-user from the generic builder.
- **Notes** (built) — trainer free-text notes (`client_notes` table); inline editable + share-with-client toggle
- **Nutrition** (built) — trainer snapshot + `ClientNutritionManager`: editable **daily targets** (DB-backed, syncs to client app) + **AI meal-plan generator** (prompt and/or meal photos → GPT-4o plan; per-dish cached images; tweak in place; per-client "let client edit foods" toggle). `GET /api/clients/[id]/nutrition` still returns the 14-day summary.
- **Progress** (built) — trainer snapshot + bodyweight chart with clickable points/drill-in (`weight_logs`) + progress photos in private Supabase Storage (`progress-photos`) returned via signed URLs only. APIs: `/api/clients/[id]/weight`, `/api/clients/[id]/photos`.
- **Chat** — placeholder "Coming next" tab
- Header shows stat tiles: Plan · Onboarding status · Program · Notes count

Auth on all `/api/clients/[id]/*` routes goes through `requireClientAccess(id)` in [src/lib/admin/requireClientAccess.ts](src/lib/admin/requireClientAccess.ts) — admin = any client, trainer = only `assigned_trainer_id` matches. Returns a service-role `admin` client.
- API routes: `/api/clients/[id]/intake` (GET/PATCH), `/activity` (GET), `/notes` (GET/POST/PATCH/DELETE), `/reminders` (GET/POST/PATCH/DELETE), `/calendar-reminders` (GET/POST/PATCH/DELETE), `/program` (GET + **POST** build/assign), `/nutrition` (GET), `/nutrition-targets` (GET/PUT), `/nutrition-approach` (GET/PATCH), `/meal-plan` (GET/POST generate/DELETE/**PATCH** food-edit toggle), `/meal-plan/images` (POST generate-one+cache), `/weight` (GET/POST/DELETE), `/photos` (GET/POST/DELETE), `/trainer` (GET/PATCH), `/onboarding/reset` (POST), `/prefill-intake` (POST).
- Client-side self routes (the athlete's own page): `/api/me/nutrition-targets` (GET/PUT), `/api/me/meal-plan` (GET + **PATCH** foods-only edit), `/api/me/meal-plan/images` (GET cached only), `/api/me/nutrition-request` (POST → notifies coach).

**Planned next slices (client file):** shared trainer↔client chat (new conversations table). Later: push coach calendar-reminders to the client's connected Google Calendar (infra exists — see Google Calendar push). DONE: hub shell, program build/edit-from-file, send-through-onboarding (+email), nutrition targets + AI meal plans + per-dish images, client vitals strip, per-tab snapshots, mobile nav, Progress weight/photos.

## Two client-detail pages (important)

- **Admin "View details" routes CLIENTS & MEMBERS → `/clients/[id]` (the hub)**, trainers/admins → `/profile/[id]`. The hub now also has the admin-only "Assigned coach" selector (same `/api/clients/[id]/trainer`). So clicking a client from admin lands on the full tabbed file.
- **`/profile/[id]`** — reached from the **admin dashboard** (for non-client roles) + leaderboard + hover cards. Real-Supabase branch loads via `GET /api/admin/users/[id]` (admin-only). Has identity + **Assigned coach** (admin assign/change/remove) + active program + onboarding snapshot.
- **`/clients/[id]`** — reached from **My Clients**. The tabbed hub (Overview/Program/Nutrition/Progress/Notes). `/my-clients` now loads REAL assigned clients for Supabase users via `GET /api/my-clients` (service-role; profiles where `assigned_trainer_id` = caller + each client's active program name). Demo accounts keep the local store. Delete is hidden for real clients.

## Trainer assignment

- **On `/profile/[id]`** (admin-only) — "Assigned coach" select; `GET/PATCH /api/clients/[id]/trainer` (GET lists trainers+admins; PATCH admin-only, null/"" clears, UUID verified → writes id + name). This is the primary place to assign since admin → /profile/[id] is the path the owner uses.
- **Admin assign/change/remove** — `/admin/users` has a Trainer column (select). `PATCH /api/admin/users/[id]` accepts `assigned_trainer_id` (`null`/`""` clears; a UUID is verified to be a trainer/master, then id + `assigned_trainer_name` are written to the client's profile). Trainers + admins are assignable (owner-as-trainer supported).
- Invite acceptance now reconciles trainer assignment server-side in `acceptInviteForUser()` and `sync-profile` preserves assigned trainer IDs when present.
- **`/my-clients` reads DEMO data** (`getMyClients(role,id)` from `src/lib/data/store.ts`), NOT the real Supabase `getMyClients()` in `src/lib/db/profiles.ts` — so real assigned clients don't appear. Switch to real data for Supabase users (next slice).

## Plan labels (single source of truth)

`PLAN_LABELS` in [src/lib/plans.ts](src/lib/plans.ts) is canonical: `foundation`→"Foundation", `training`→"Training", `performance`→"AI Performance", `coaching`→"Hybrid Coaching". (admin/leaderboard/profile-[id] pages have local label maps that match these.) `PLAN_FEATURES.coaching` enables every feature flag — Hybrid Coaching = full access.

## Cross-device onboarding

Onboarding completion is server-side (`onboarding_state` flags), so a returning user on a new device should NOT replay it. `resolveOnboardingRoute` (db/onboarding.ts) retries the read once and FAILS OPEN (returns null = don't block) on a genuine read error, so a flaky read can't force a completed user back through onboarding. A genuinely-new user has a clean empty read and is still onboarded. AppShell guard reads this for Supabase users.

## In Progress / Planned
- Obsidian vault = this project folder (`/Users/xavierellis/Projects/flowstate-ai`)
- brain-graph.md = this file — read it first, not individual files
- Coach not yet wired to personality/tone settings
- Nutrition, calendar, program builder still on static mock data
- No persistent auth yet — all demo/localStorage

---

## Conversational coach + talk-to-log (2026-06)

The AI coach is ONE persona with an **intensity dial** (1 gentle → 5 militant) +
per-client **strong-language** opt-in (`coach-intensity` / `coach-strong-language`
in localStorage; set on `/coach` and in Profile → Coaching). Old tone/style/
profanity selectors are gone.

`/coach` now routes what you say via `POST /api/ai/coach-intent`
(`validateCoachIntent` in `src/lib/ai/validate.ts`, `CoachIntentOutput` in
`src/lib/ai/types.ts`): `log_meal` (→ parse + review-first `GroupedMealReviewModal`
→ `saveMeal`), `log_workout_complete` / `log_reflection` (→ `saveWorkoutLog` via
`src/lib/coach/actions.ts`, with Undo; reflection saved as `coach_note`), and
`recovery_check` (captures sleep/soreness/energy to `src/lib/coach/readiness.ts`,
fed to `/api/ai/coach` as `recoveryContext`). Low confidence (<0.6) never acts.
`/api/ai/coach` takes `intensity` + `allowStrongLanguage` + `recoveryContext` and
has a recovery-coaching section (probing 1-5 questions → reasoned push-vs-rest).
**Roadmap (not built):** Phase 2 live set-by-set session companion, Phase 3
ElevenLabs voice. Plan: `~/.claude/plans/i-know-we-do-snoopy-bee.md`.

## Nutrition: BMR/energy, editable targets, BMI, activity level (2026-06)

- `calculateEnergy(intake)` in `src/lib/nutrition.ts` — hybrid BMR (Katch-McArdle
  from body-fat %, else Mifflin from age+sex, else bodyweight estimate) → TDEE
  (explicit **activity level**, else training-days) → goal- AND **timeframe**-aware
  target. `EnergyCard` shows BMR→maintenance→target on `/nutrition` + the trainer
  client file.
- Onboarding (7-step `calibration`) now has a **Body stats** step: weight, height,
  body-fat, age, sex, **activity level** → saved to top-level `IntakeData`.
- **Editable targets**: `src/lib/nutrition/targetsOverride.ts` (localStorage) +
  `TargetsEditModal` — "Adjust" above the nutrition cards lets the athlete set
  their own calories/macros (Custom badge + reset).

## Nutrition philosophy rebuild (2026-06)

**BMI card is gone** — out of place on a nutrition surface. The page is reframed
around **balanced eating as the foundation**: hit your calorie + macro targets
for your real numbers, coach adjusts when you stall. On top of that, the user
shapes WHEN and HOW from Xavier's ebook *Conquer Your Carbs*.

- `src/lib/nutrition/approach.ts` — `ApproachState` (goal mode, meal pattern,
  training timing, carb-cycling on/off, first-meal hour); persisted to
  `flowstate-nutrition-approach-<userId>`; `loadApproach` /
  `hasStoredApproach` / `goalModeFromIntake` / `saveApproach`. Math:
  `goalAdjustedMacros(tdee, goalMode, kg)` for cut/maintain/build,
  `buildMealSchedule(pattern, hour)` for clock times,
  `buildCarbAllocation(pattern, trainingTiming)` for the post-workout pyramid
  (35% post-workout, 23% next meal, 11% each remaining meal),
  `buildCarbCycleBreakdown(tdee, kg, goalMode)` for high/low day macros and
  3:1 / 3:2 rotation.
- `src/lib/nutrition/weightLogs.ts` — fetches `weight_logs` (migration 024) via
  `/api/clients/[id]/weight`; `computeWeightTrend(logs, days)` returns deltaKg.
- `src/components/nutrition/EatingApproachCard.tsx` — "Balanced eating" header +
  Cut/Maintain/Build pill + meal-pattern picker (3+snacks / 3 / 2 / IF 16:8 /
  OMAD) + first-meal hour + carb-cycling toggle.
- `MealScheduleCard` — meal times + per-meal carb-percent based on training
  timing (Fasted AM / After 1/2/3 meals).
- `CarbCyclingCard` — only mounted when carb-cycling is on; high & low day
  macros + 5-day rotation label.
- `WeeklyCheckInCard` — combines 7-day calorie avg + 7-day weight delta into
  goal-aware coaching ("Cut stalled — only moved -0.1 kg this week"); inline
  weigh-in form posts to `/api/clients/[id]/weight`.
- `PhilosophyTips` — rotating tips from the ebook (starting out, around
  training, daily habits, cravings).
- `EnergyCard` rewired — flexes target line live based on goal mode (passed
  through from nutrition page, dashboard, and trainer client-file).
- Top action row consolidated: date stepper left, Calendar / 7 days / Adjust
  pills right with matching sizing.
- Approach **persists to Supabase**: migration `030_profiles_nutrition_approach.sql`
  adds `profiles.nutrition_approach` JSONB (applied to live 2026-06-06). Route
  `/api/clients/[id]/nutrition-approach` (GET/PATCH) — self/trainer/admin. Store
  has `fetchApproach()` (optimistic localStorage paint → Supabase hydrate);
  `saveApproach()` write-throughs in background.
- Trainer client file Nutrition tab shows `ApproachSummary` next to EnergyCard.
- **AI coach** (`/api/ai/coach`) fetches `nutrition_approach` and injects a
  "ATHLETE NUTRITION APPROACH" block via `summarizeApproachForCoach()` so the
  coach never recommends a meal pattern or carb-cycling state that
  contradicts the user's picker.
- **Carb-cycle rotation**: when carb cycling is on, today's targets follow
  the high/low day rotation (`dayTypeForDate(goal, isoDate)`); the page
  shows a "Today is a HIGH/LOW-carb day" badge; suggestions adapt
  (post-workout carb push, overshoot warning on low days).

## Workout flow overhaul (2026-06)

`/program/workout/[workoutId]` no longer auto-starts. Phase machine:
**preview** (focus, exercises, sets×reps, warm-up, "AI coach in your ear — Coming
Soon") → **countdown** (5-4-3-2-1) → **active** (control bar: timer + Pause/Resume
+ Finish; timer only ticks while active & unpaused). Freestyle "Paste workout"
(`WorkoutParserModal` → `/api/ai/workout-parser`) already deciphers written notes.

## Learn tab (2026-06)

`/learn` — searchable, category-filtered articles (`src/lib/learn/content.ts`):
Using FlowState + Training + Nutrition, deep-linking into the app + coach. Ebook
"Conquer Your Carbs" served from `public/resources/conquer-your-carbs.pdf` (~40MB,
candidate to move to a CDN). Nav item in `Sidebar` `NAV_ITEMS`.

## Coach-driven nutrition: DB targets + AI meal plans + images (2026-06)

The coach owns nutrition; the client tracks + requests changes. Migrations
**031** (`nutrition_targets`, `meal_plans`), **032** (`meal_images` + private
`meal-images` bucket), **033** (`meal_plans.allow_client_food_edits`) — all
applied to live via the Management API (see [[ops_migration_drift]]; the token
is now set, so migrations can be pushed directly — but DDL that loosens access,
e.g. a public bucket, is blocked by the classifier).

- **Targets moved off localStorage → DB.** `nutrition_targets` (per-user macro/
  calorie/water override). Coach edits via `PUT /api/clients/[id]/nutrition-targets`
  (notifies+emails); client's own page hydrates from `GET /api/me/nutrition-targets`
  (coach edits win) and write-throughs its own edits. Row↔camelCase mapping in
  `src/lib/server/nutritionTargets.ts`.
- **AI meal-plan generator** — `POST /api/clients/[id]/meal-plan` (GPT-4o, prompt
  AND/OR meal photos via vision, optional macro anchor, `basePlan` for tweak-in-
  place). Saves to `meal_plans` (one `active`), pushes daily totals into the
  client's targets, notifies+emails. UI: `ClientNutritionManager` (modal composer,
  set-once/tweak).
- **Per-dish images** — `POST /api/clients/[id]/meal-plan/images` generates ONE
  missing image per call (`gpt-image-1`), uploads to the private bucket, caches in
  `meal_images` keyed by `dishKey()` (order/portion-independent) so a dish is
  generated once and reused across all clients. Served via signed URLs.
- **Client side** — `ClientMealPlanCard` on `/nutrition` (coached clients only):
  view the coach's plan + cached photos, **"Request a change"** (`POST
  /api/me/nutrition-request` → notification on the coach), and — when the coach
  flips the per-plan toggle — edit plan **foods only** (`PATCH /api/me/meal-plan`
  preserves all calorie/macro numbers + targets server-side). Coached clients no
  longer edit targets directly; self-directed members still do.
- **Client `/nutrition` page de-bulked** — the eating-approach / energy / meal-
  schedule / weekly-check-in / carb-cycling cards + `PhilosophyTips` were REMOVED
  from the athlete view (now coach/engine-side). Page = calories/macros/hydration
  + quick log + meal timeline + meal-plan card + dynamic `buildSuggestions` tips.
  (Those card components still exist; just not mounted on the client page.)

## Theming — app is dark-only via globals overrides (READ before adding UI)

There's a `ThemeToggle` (dark / `theme-light`) but **almost nothing uses semantic
tokens** (`bg-card`/`text-foreground` — only ~4 files). Light mode works through
**global attribute-selector overrides in `globals.css`** under `html.theme-light`
that remap a FIXED LIST of dark hexes (`#0A0A0A,#0D0D0D,#0F0F0F,#111111,#121212,
#141414,#161616,#1A1A1A,#1C1C1C,#222`) + `[class*="text-white"]` → light surfaces /
dark text. **Gotcha:** a hex NOT in that list (e.g. `#0E0E0E`) stays dark while its
`text-white*` flips to dark → invisible in light mode. **Rule for new components:
only use hexes from that list** (use `#111111` for cards/modals, `#161616` for
inputs) so they adapt. This bit the new meal-plan modals (fixed 2026-06).

---

*Last updated: 2026-06-05*
