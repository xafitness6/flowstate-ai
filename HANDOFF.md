# HANDOFF — Coaching build-out (client file, trainer assignment, notifications)

**Date:** 2026-06-02
**Status:** Large feature build-out shipped to production (`main` auto-deploys via Vercel). Two DB migrations are NOT yet applied — see §1. Four features remain — see §4.

> Supersedes the 2026-05-24 password-reset handoff — that issue is resolved
> (Resend `from` fixed, custom domain `flowstateai.site` live, auth redirect
> fixed). The app deploys from `main`; every push triggers a Vercel build.

---

## 1. ⚠️ ACTION REQUIRED — apply two migrations (Supabase → SQL Editor)

Migrations do NOT auto-apply on this project (no `SUPABASE_ACCESS_TOKEN`); the
live DB lags the repo. The notification bell stays empty and note-sharing won't
persist until these run. Code is resilient (no crashes) without them.

```sql
-- 021 notifications
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  type text not null default 'general'
    check (type in ('general','onboarding','program_assigned','program_changed','nutrition_added','workout_added','note')),
  title text not null,
  body text,
  link text,
  actor_name text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists idx_notifications_user_created on public.notifications(user_id, created_at desc);
alter table public.notifications enable row level security;
create policy "notifications_select_own" on public.notifications for select using (auth.uid() = user_id);
create policy "notifications_update_own" on public.notifications for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- 022 note sharing
alter table public.client_notes add column if not exists shared_with_client boolean not null default false;
```

Repo copies: `supabase/migrations/021_notifications.sql`, `022_note_sharing.sql`.
**Verify:** assign a program to a test client → they get a bell notification + email.

---

## 2. Two client-detail pages (important — don't confuse them)

- **`/clients/[id]`** — the rich tabbed "trainer's-eyes" hub (Overview / Program
  / Nutrition / Notes; Progress + Chat are placeholders). Reached from **My
  Clients** and from the **admin dashboard "View details"** for client/member
  roles. File: `src/app/(app)/clients/[id]/page.tsx`.
- **`/profile/[id]`** — snapshot view (identity + assigned coach + active program
  + onboarding). Reached from admin for non-client roles, leaderboard, hover
  cards. File: `src/app/(app)/profile/[id]/page.tsx`.
- **`/profile`** — the signed-in user's OWN profile + settings.
  File: `src/app/(app)/profile/page.tsx`.

All `/api/clients/[id]/*` routes auth via `requireClientAccess(id)`
(`src/lib/admin/requireClientAccess.ts`) — admin = any client, trainer = only
`assigned_trainer_id` matches; returns a service-role `admin` client.

---

## 3. Shipped this session (all on `main`/prod)

- **Client file hub** `/clients/[id]`: tabs + stat tiles. APIs:
  `/api/clients/[id]/{intake,notes,program,nutrition,onboarding/reset,trainer}`.
- **Trainer assignment**: assign/change/remove on `/profile/[id]`, the client
  hub Overview, and `/admin/users`. `GET/PATCH /api/clients/[id]/trainer`
  (PATCH admin-only) + `assigned_trainer_id` in `PATCH /api/admin/users/[id]`.
- **My Clients** shows REAL assigned clients: `GET /api/my-clients`
  (service-role; profiles where `assigned_trainer_id`=caller + active program).
- **Notifications**: bell in `TopBar` (`src/components/layout/NotificationBell.tsx`),
  `GET/PATCH /api/notifications`, `notifyClient()` in
  `src/lib/server/notifications.ts`, `sendNotificationEmail()` in
  `src/lib/server/email.ts`. Triggers: program assigned (in-app + email),
  onboarding sent (in-app), note shared (in-app). Email only for
  program/nutrition/workout types.
- **Note sharing**: `client_notes.shared_with_client`; notes internal by default,
  trainer toggles "Share with client" → notifies them.
- **Plan-access alignment**: dashboard nutrition card gated by entitlement
  (`TodaySnapshot.tsx`); plan re-fetch on tab focus (`UserContext.tsx`) so admin
  upgrades apply without re-login.
- **Real profile stats**: `GET /api/me/activity` (sessions / streak / last-30
  from `workout_logs`); profile shows real numbers (demo accounts keep samples).
- **Fixes**: "client not found" (profiles has NO `assigned_trainer_name` column —
  derive it), canonical `PLAN_LABELS` (Foundation/Training/AI Performance/Hybrid
  Coaching), logout no longer flashes "Luca Ferretti", staff-only "last activity",
  settings cleanup (removed fake notification toggles).

---

## 4. Remaining build-out (in priority order)

1. **Trainer reminders** — internal trainer-only notes/reminders per client
   ("so the trainer stays on track"; NOT visible to client; optional due date).
   Needs a new table `client_reminders (id, trainer_id, client_id, body,
   due_date, done, created_at)` + migration + an API + UI on the client hub
   (a "Reminders" affordance, trainer-only). Keep distinct from `client_notes`.

2. **Per-tab progress snapshots (trainer view only)** — on `/clients/[id]` add a
   short "what's been happening" summary to the **Program**, **Nutrition**, and
   **Progress** tabs (e.g. sessions logged this week, adherence, last activity,
   recent meals trend). Reuse `/api/me/activity`-style aggregation but keyed by
   the client id via a new `/api/clients/[id]/activity` (service-role,
   `requireClientAccess`).

3. **Mobile nav** — (a) client-customizable bottom nav: let the client choose
   which items show in `src/components/layout/BottomNav.tsx` (persist choice;
   localStorage is fine, or a profile column); (b) a burger menu for full nav on
   mobile. Pure front-end. Note Nutrition is gated (`canAccessFeature`), Coach is
   plan-gated — respect entitlements in the chooser.

4. **Progress tab content** — bodyweight chart (new `weight_logs` table:
   `user_id, logged_at, weight_kg, note`) + progress photos (Supabase Storage
   bucket + **signed URLs only** per the security rule). Both need migrations +
   APIs. Clickable chart → drill-in. This fills the Progress placeholder on the
   hub.

---

## 5. Key gotchas / patterns (READ before editing)

- **Migration drift is the #1 footgun.** The live `profiles` table does NOT have
  `assigned_trainer_name` (only `assigned_trainer_id`); `daily_checkins`
  (migration 008), `google_calendar_tokens` (014), calendar reminders (015) are
  also missing live. **Never SELECT a column that may not exist** — a bad select
  returns `data: null` which reads as "not found". Prefer: select only known
  columns, **derive** the rest (e.g. look up the trainer's profile for their
  name), and make new-column writes best-effort.
- **Two plan sources**: `FEATURE_MIN_PLAN` in `src/lib/entitlements.ts` governs
  access (via `canAccessFeature` / `useEntitlement`); `PLAN_FEATURES` in
  `src/lib/plans.ts` is a separate flag map. Gate UI with `useEntitlement`.
- **Demo vs Supabase**: guard real-data paths with the UUID regex +
  `NEXT_PUBLIC_SUPABASE_URL`; demo users have non-UUID ids and keep localStorage
  data. Several pages branch on this (profile, my-clients).
- **Deploy = push to `main`** (Vercel auto-builds; ~50s). Verify with
  `npx tsc --noEmit` (cheap) and only run `npm run build` before a deploy.
- **Owner** = `xavellis4@gmail.com`, always master/admin (`src/lib/auth/owner.ts`).
- Vercel project: `flowstate-ai` (team `xavellis4-1493s-projects`); domains
  `flowstateai.site` / `www.flowstateai.site`.

---

## 6. Memory / map

- `brain-graph.md` (repo root) — the compact map; updated with all of the above.
- `~/.claude/projects/-Users-xavierellis-Projects-flowstate-ai/memory/` —
  `project_client_file_hub.md`, `project_trainer_assignment.md`,
  `ops_migration_drift.md` are the most relevant.
