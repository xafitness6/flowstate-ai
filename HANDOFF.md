# HANDOFF — Coaching build-out complete (client file, trainer assignment, notifications, progress, invites, reminders, plan access)

**Date:** 2026-06-03
**Status:** Feature build-out is complete in the repo. Six DB migrations are NOT yet applied — see §1. No feature work remains from the 2026-06-02 handoff; deploy still happens by pushing `main` to Vercel.

> Supersedes the 2026-05-24 password-reset handoff — that issue is resolved
> (Resend `from` fixed, custom domain `flowstateai.site` live, auth redirect
> fixed). The app deploys from `main`; every push triggers a Vercel build.

---

## 1. ⚠️ ACTION REQUIRED — apply six migrations (Supabase → SQL Editor)

Migrations do NOT auto-apply on this project (no `SUPABASE_ACCESS_TOKEN`); the
live DB lags the repo. The notification bell stays empty, note-sharing won't
persist, trainer reminders won't persist, client/member calendar reminders won't
persist, and Progress tab weight/photos won't persist until these run. Invite
open/accept/login funnel tracking also requires 025. Code is resilient (no
crashes) without them.

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

-- 023 trainer reminders (private per-client to-dos)
create table if not exists public.client_reminders (
  id uuid primary key default gen_random_uuid(),
  trainer_id uuid not null references public.profiles(id) on delete cascade,
  client_id uuid not null references public.profiles(id) on delete cascade,
  body text not null,
  due_date date,
  done boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists idx_client_reminders_client on public.client_reminders(client_id, done, due_date);
alter table public.client_reminders enable row level security;
create policy "client_reminders_select_own" on public.client_reminders for select using (auth.uid() = trainer_id);
create policy "client_reminders_insert_own" on public.client_reminders for insert with check (auth.uid() = trainer_id);
create policy "client_reminders_update_own" on public.client_reminders for update using (auth.uid() = trainer_id);
create policy "client_reminders_delete_own" on public.client_reminders for delete using (auth.uid() = trainer_id);

-- 024 progress tracking (bodyweight + private progress photos)
create table if not exists public.weight_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  logged_at timestamptz not null default now(),
  weight_kg numeric(6,2) not null check (weight_kg > 0 and weight_kg < 1000),
  note text,
  created_at timestamptz not null default now()
);
create index if not exists idx_weight_logs_user_logged_at on public.weight_logs(user_id, logged_at desc);
alter table public.weight_logs enable row level security;
drop policy if exists "weight_logs_select_own" on public.weight_logs;
create policy "weight_logs_select_own" on public.weight_logs for select using (auth.uid() = user_id);
drop policy if exists "weight_logs_select_trainer" on public.weight_logs;
create policy "weight_logs_select_trainer" on public.weight_logs for select using (
  exists (select 1 from public.profiles p where p.id = user_id and p.assigned_trainer_id = auth.uid())
);
drop policy if exists "weight_logs_select_admin" on public.weight_logs;
create policy "weight_logs_select_admin" on public.weight_logs for select using (public.is_admin());
drop policy if exists "weight_logs_insert_authorized" on public.weight_logs;
create policy "weight_logs_insert_authorized" on public.weight_logs for insert with check (
  auth.uid() = user_id or public.is_admin()
  or exists (select 1 from public.profiles p where p.id = user_id and p.assigned_trainer_id = auth.uid())
);
drop policy if exists "weight_logs_update_authorized" on public.weight_logs;
create policy "weight_logs_update_authorized" on public.weight_logs for update using (
  auth.uid() = user_id or public.is_admin()
  or exists (select 1 from public.profiles p where p.id = user_id and p.assigned_trainer_id = auth.uid())
) with check (
  auth.uid() = user_id or public.is_admin()
  or exists (select 1 from public.profiles p where p.id = user_id and p.assigned_trainer_id = auth.uid())
);
drop policy if exists "weight_logs_delete_authorized" on public.weight_logs;
create policy "weight_logs_delete_authorized" on public.weight_logs for delete using (
  auth.uid() = user_id or public.is_admin()
  or exists (select 1 from public.profiles p where p.id = user_id and p.assigned_trainer_id = auth.uid())
);

insert into storage.buckets (id, name, public)
values ('progress-photos', 'progress-photos', false)
on conflict (id) do update set public = false;

create table if not exists public.progress_photos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  bucket_id text not null default 'progress-photos',
  storage_path text not null unique,
  caption text,
  taken_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index if not exists idx_progress_photos_user_taken on public.progress_photos(user_id, taken_at desc);
alter table public.progress_photos enable row level security;
drop policy if exists "progress_photos_select_own" on public.progress_photos;
create policy "progress_photos_select_own" on public.progress_photos for select using (auth.uid() = user_id);
drop policy if exists "progress_photos_select_trainer" on public.progress_photos;
create policy "progress_photos_select_trainer" on public.progress_photos for select using (
  exists (select 1 from public.profiles p where p.id = user_id and p.assigned_trainer_id = auth.uid())
);
drop policy if exists "progress_photos_select_admin" on public.progress_photos;
create policy "progress_photos_select_admin" on public.progress_photos for select using (public.is_admin());
drop policy if exists "progress_photos_insert_authorized" on public.progress_photos;
create policy "progress_photos_insert_authorized" on public.progress_photos for insert with check (
  bucket_id = 'progress-photos'
  and (
    auth.uid() = user_id or public.is_admin()
    or exists (select 1 from public.profiles p where p.id = user_id and p.assigned_trainer_id = auth.uid())
  )
);
drop policy if exists "progress_photos_delete_authorized" on public.progress_photos;
create policy "progress_photos_delete_authorized" on public.progress_photos for delete using (
  auth.uid() = user_id or public.is_admin()
  or exists (select 1 from public.profiles p where p.id = user_id and p.assigned_trainer_id = auth.uid())
);

drop policy if exists "progress_photos_storage_select_authorized" on storage.objects;
create policy "progress_photos_storage_select_authorized" on storage.objects for select using (
  bucket_id = 'progress-photos'
  and (
    auth.uid()::text = (storage.foldername(name))[1] or public.is_admin()
    or exists (
      select 1 from public.profiles p
      where p.id::text = (storage.foldername(name))[1] and p.assigned_trainer_id = auth.uid()
    )
  )
);
drop policy if exists "progress_photos_storage_insert_authorized" on storage.objects;
create policy "progress_photos_storage_insert_authorized" on storage.objects for insert with check (
  bucket_id = 'progress-photos'
  and (
    auth.uid()::text = (storage.foldername(name))[1] or public.is_admin()
    or exists (
      select 1 from public.profiles p
      where p.id::text = (storage.foldername(name))[1] and p.assigned_trainer_id = auth.uid()
    )
  )
);
drop policy if exists "progress_photos_storage_delete_authorized" on storage.objects;
create policy "progress_photos_storage_delete_authorized" on storage.objects for delete using (
  bucket_id = 'progress-photos'
  and (
    auth.uid()::text = (storage.foldername(name))[1] or public.is_admin()
    or exists (
      select 1 from public.profiles p
      where p.id::text = (storage.foldername(name))[1] and p.assigned_trainer_id = auth.uid()
    )
  )
);

-- 025 invite funnel tracking (opened → accepted/logged in)
alter table public.invites
  add column if not exists first_opened_at timestamptz,
  add column if not exists last_opened_at timestamptz,
  add column if not exists open_count integer not null default 0,
  add column if not exists last_opened_user_agent text,
  add column if not exists accepted_count integer not null default 0,
  add column if not exists last_accepted_at timestamptz,
  add column if not exists last_accepted_by_user_id uuid references public.profiles(id) on delete set null,
  add column if not exists last_accepted_email text,
  add column if not exists last_accepted_name text,
  add column if not exists logged_in_at timestamptz,
  add column if not exists last_login_at timestamptz;
create index if not exists idx_invites_last_opened on public.invites(last_opened_at desc);
create index if not exists idx_invites_last_accepted on public.invites(last_accepted_at desc);

create table if not exists public.invite_acceptances (
  id uuid primary key default gen_random_uuid(),
  invite_id uuid not null references public.invites(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  email text not null,
  full_name text,
  accepted_at timestamptz not null default now(),
  last_login_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique(invite_id, user_id)
);
create index if not exists idx_invite_acceptances_invite on public.invite_acceptances(invite_id, accepted_at desc);
create index if not exists idx_invite_acceptances_user on public.invite_acceptances(user_id, last_login_at desc);
alter table public.invite_acceptances enable row level security;
drop policy if exists "invite_acceptances_select_creator" on public.invite_acceptances;
create policy "invite_acceptances_select_creator" on public.invite_acceptances for select using (
  exists (
    select 1 from public.invites i
    where i.id = invite_id
      and (i.invited_by_user_id = auth.uid() or i.assigned_trainer_id = auth.uid())
  )
);
drop policy if exists "invite_acceptances_select_admin" on public.invite_acceptances;
create policy "invite_acceptances_select_admin" on public.invite_acceptances for select using (public.is_admin());
drop policy if exists "invite_acceptances_select_own" on public.invite_acceptances;
create policy "invite_acceptances_select_own" on public.invite_acceptances for select using (auth.uid() = user_id);

-- 026 client/member calendar reminders (visible on the owner's calendar)
create table if not exists public.calendar_reminders (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  created_by_user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null check (length(trim(title)) > 0),
  notes text,
  due_at timestamptz not null,
  done boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_calendar_reminders_owner_due
  on public.calendar_reminders(owner_id, done, due_at);
alter table public.calendar_reminders enable row level security;

drop trigger if exists calendar_reminders_updated_at on public.calendar_reminders;
create trigger calendar_reminders_updated_at
  before update on public.calendar_reminders
  for each row execute function public.set_updated_at();

drop policy if exists "calendar_reminders_select_authorized" on public.calendar_reminders;
create policy "calendar_reminders_select_authorized" on public.calendar_reminders for select
  using (
    auth.uid() = owner_id
    or public.is_admin()
    or exists (
      select 1 from public.profiles p
      where p.id = owner_id and p.assigned_trainer_id = auth.uid()
    )
  );
drop policy if exists "calendar_reminders_insert_authorized" on public.calendar_reminders;
create policy "calendar_reminders_insert_authorized" on public.calendar_reminders for insert
  with check (
    created_by_user_id = auth.uid()
    and (
      auth.uid() = owner_id
      or public.is_admin()
      or exists (
        select 1 from public.profiles p
        where p.id = owner_id and p.assigned_trainer_id = auth.uid()
      )
    )
  );
drop policy if exists "calendar_reminders_update_authorized" on public.calendar_reminders;
create policy "calendar_reminders_update_authorized" on public.calendar_reminders for update
  using (
    auth.uid() = owner_id
    or public.is_admin()
    or exists (
      select 1 from public.profiles p
      where p.id = owner_id and p.assigned_trainer_id = auth.uid()
    )
  )
  with check (
    auth.uid() = owner_id
    or public.is_admin()
    or exists (
      select 1 from public.profiles p
      where p.id = owner_id and p.assigned_trainer_id = auth.uid()
    )
  );
drop policy if exists "calendar_reminders_delete_authorized" on public.calendar_reminders;
create policy "calendar_reminders_delete_authorized" on public.calendar_reminders for delete
  using (
    auth.uid() = owner_id
    or public.is_admin()
    or exists (
      select 1 from public.profiles p
      where p.id = owner_id and p.assigned_trainer_id = auth.uid()
    )
  );
```

Repo copies: `supabase/migrations/021_notifications.sql`, `022_note_sharing.sql`, `023_client_reminders.sql`, `024_progress_tracking.sql`, `025_invite_tracking.sql`, `026_calendar_reminders.sql`.
**Verify:** assign a program to a test client → bell notification + email; open `/clients/[id]` → Progress → add a weight + upload a photo; open `/calendar` → add/toggle/delete a reminder; from `/clients/[id]` Notes → add a client calendar reminder and confirm it appears on that user's `/calendar`; open an invite link → `/admin/invites` shows opened, then accept/login → accepted + logged-in details appear.

---

## 2. Two client-detail pages (important — don't confuse them)

- **`/clients/[id]`** — the rich tabbed "trainer's-eyes" hub (Overview / Program
  / Nutrition / Progress / Notes; Chat is a placeholder). Reached from **My
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

## 3. Shipped this session (repo on `main`; push deploys to prod)

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
- **Trainer reminders**: `client_reminders` (migration 023; trainer-private).
  `GET/POST/PATCH/DELETE /api/clients/[id]/reminders` (scoped to the acting
  trainer). UI in the client hub **Notes tab** → "Reminders · private to you"
  (add with optional due date, check off, delete). Never shown to the client.
- **Client/member calendar reminders**: `calendar_reminders` (migration 026).
  Members/clients can add their own reminders from `/calendar` via
  `GET/POST/PATCH/DELETE /api/calendar/reminders`; admins/trainers can add
  client-visible reminders from `/clients/[id]` Notes via
  `/api/clients/[id]/calendar-reminders`. These reminders appear on the app
  calendar and in the subscribable iCal feed (`/api/calendar/feed/[token]`).
- **Per-tab trainer snapshots**: `GET /api/clients/[id]/activity` mirrors
  `/api/me/activity` for a trainer-authorized client. The client hub now shows
  compact snapshots at the top of **Program**, **Nutrition**, and **Progress**
  (training this week, last activity, 7/30-day context, meal consistency,
  weight/photo recency).
- **Progress tab content**: `weight_logs` + `progress_photos` (migration 024),
  `GET/POST/DELETE /api/clients/[id]/weight`, and
  `GET/POST/DELETE /api/clients/[id]/photos`. Photos are stored in the private
  `progress-photos` bucket and returned with signed URLs only. UI includes a
  bodyweight chart with clickable points/drill-in, add/delete weight logs, and
  upload/delete progress photos.
- **Client/member Progress page**: `/progress` lets the signed-in user add
  bodyweight logs, filter a chart by 30d/90d/6m/1y/all/custom dates, upload
  private progress photos, and view filtered photo history. Self-access was
  added to the weight/photo APIs with `requireClientAccess(id, { allowSelf: true })`.
- **Mobile nav**: `Sidebar.tsx` exports the canonical `NAV_ITEMS`; `BottomNav`
  uses that source for a client-customizable pinned bottom bar
  (`localStorage: flowstate-bottomnav-items`) plus a mobile burger sheet for the
  full navigation. Nutrition/Coach/Calendar pinning respects entitlements and
  locked items route to pricing but cannot be pinned.
- **Invite funnel tracking**: migration 025 adds opened/accepted/login summary
  fields + `invite_acceptances` for reusable open links. Public invite GET
  stamps opens; `acceptInviteForUser()` records the accepted/logged-in user and
  notifies the inviter/assigned trainer in-app. `/admin/invites` now shows
  Opened and Accepted stats, per-invite funnel chips, accepted-by details, last
  login, and a follow-up cue when a link was opened but no account was created.
- **Plan-access alignment**: Foundation is now the basic access tier for
  Nutrition, Calendar, and Coach (`src/lib/entitlements.ts`); paid tiers unlock
  depth such as full history, voice/photo food tools, analytics, unlimited coach,
  deep analytics, and Hybrid Coaching. `PATCH /api/admin/users/[id]` now treats
  manual admin plan edits as temporary comp/access grants: paid tiers set
  `subscription_status='active'`, Foundation sets `inactive` unless explicitly
  overridden. `sync-profile` and invite acceptance no longer silently bump
  clients to Training based only on role. `UserContext` refreshes real profiles
  on focus/pageshow/visibility and every 15s so client-side access catches admin
  tier changes without re-login.
- **Light theme app chrome**: top bar, notification/theme/avatar controls,
  dropdowns, desktop sidebar, and mobile bottom nav/sheet now have explicit
  light-mode styling. The broad light CSS override was tightened so hover-only
  `bg-white/...` classes do not become permanent grey boxes.
- **Real profile stats**: `GET /api/me/activity` (sessions / streak / last-30
  from `workout_logs`); profile shows real numbers (demo accounts keep samples).
- **Fixes**: "client not found" (profiles has NO `assigned_trainer_name` column —
  derive it), canonical `PLAN_LABELS` (Foundation/Training/AI Performance/Hybrid
  Coaching), logout no longer flashes "Luca Ferretti", staff-only "last activity",
  settings cleanup (removed fake notification toggles).

---

## 4. Remaining build-out

No remaining feature work from the 2026-06-02 handoff. The remaining operational
step is applying migrations 021-026 in Supabase SQL Editor, then pushing `main`
if the current working tree has not already been committed/deployed.

---

## 5. Key gotchas / patterns (READ before editing)

- **Migration drift is the #1 footgun.** The live DB still needs migrations
  021-026 applied manually. The live `profiles` table does NOT have
  `assigned_trainer_name` (only `assigned_trainer_id`); `daily_checkins`
  (migration 008), `google_calendar_tokens` (014), and the new
  `calendar_reminders` table (026) may also be missing live. **Never SELECT a column that may not exist** — a bad select
  returns `data: null` which reads as "not found". Prefer: select only known
  columns, **derive** the rest (e.g. look up the trainer's profile for their
  name), and make new-column writes best-effort.
- **Two plan sources**: `FEATURE_MIN_PLAN` in `src/lib/entitlements.ts` governs
  access (via `canAccessFeature` / `useEntitlement`); `PLAN_FEATURES` in
  `src/lib/plans.ts` is a separate flag map. Gate UI with `useEntitlement`.
  Foundation should keep basic Nutrition/Calendar/Coach access; paid tiers
  should gate deeper features. During manual billing, admin plan edits are the
  source of truth and role should not imply a higher plan.
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
