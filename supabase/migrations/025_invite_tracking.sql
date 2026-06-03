-- ─── Invite funnel tracking ─────────────────────────────────────────────────
-- Adds created → opened → accepted/logged-in visibility for admin intake.
-- Open invite links can be accepted by multiple people; invite_acceptances
-- records one acceptance per invite/user so repeat logins don't double-count.

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

create index if not exists idx_invites_last_opened
  on public.invites(last_opened_at desc);

create index if not exists idx_invites_last_accepted
  on public.invites(last_accepted_at desc);

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

create index if not exists idx_invite_acceptances_invite
  on public.invite_acceptances(invite_id, accepted_at desc);

create index if not exists idx_invite_acceptances_user
  on public.invite_acceptances(user_id, last_login_at desc);

alter table public.invite_acceptances enable row level security;

drop policy if exists "invite_acceptances_select_creator" on public.invite_acceptances;
create policy "invite_acceptances_select_creator" on public.invite_acceptances for select
  using (
    exists (
      select 1 from public.invites i
      where i.id = invite_id
        and (i.invited_by_user_id = auth.uid() or i.assigned_trainer_id = auth.uid())
    )
  );

drop policy if exists "invite_acceptances_select_admin" on public.invite_acceptances;
create policy "invite_acceptances_select_admin" on public.invite_acceptances for select
  using (public.is_admin());

drop policy if exists "invite_acceptances_select_own" on public.invite_acceptances;
create policy "invite_acceptances_select_own" on public.invite_acceptances for select
  using (auth.uid() = user_id);
