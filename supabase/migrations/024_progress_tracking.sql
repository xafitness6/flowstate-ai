-- ─── Client progress tracking ────────────────────────────────────────────────
-- Bodyweight logs + private progress-photo metadata. Photos are delivered only
-- through signed URLs from /api/clients/[id]/photos.

create table if not exists public.weight_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  logged_at timestamptz not null default now(),
  weight_kg numeric(6,2) not null check (weight_kg > 0 and weight_kg < 1000),
  note text,
  created_at timestamptz not null default now()
);

create index if not exists idx_weight_logs_user_logged_at
  on public.weight_logs(user_id, logged_at desc);

alter table public.weight_logs enable row level security;

drop policy if exists "weight_logs_select_own" on public.weight_logs;
create policy "weight_logs_select_own" on public.weight_logs for select
  using (auth.uid() = user_id);

drop policy if exists "weight_logs_select_trainer" on public.weight_logs;
create policy "weight_logs_select_trainer" on public.weight_logs for select
  using (
    exists (
      select 1 from public.profiles p
      where p.id = user_id and p.assigned_trainer_id = auth.uid()
    )
  );

drop policy if exists "weight_logs_select_admin" on public.weight_logs;
create policy "weight_logs_select_admin" on public.weight_logs for select
  using (public.is_admin());

drop policy if exists "weight_logs_insert_authorized" on public.weight_logs;
create policy "weight_logs_insert_authorized" on public.weight_logs for insert
  with check (
    auth.uid() = user_id
    or public.is_admin()
    or exists (
      select 1 from public.profiles p
      where p.id = user_id and p.assigned_trainer_id = auth.uid()
    )
  );

drop policy if exists "weight_logs_update_authorized" on public.weight_logs;
create policy "weight_logs_update_authorized" on public.weight_logs for update
  using (
    auth.uid() = user_id
    or public.is_admin()
    or exists (
      select 1 from public.profiles p
      where p.id = user_id and p.assigned_trainer_id = auth.uid()
    )
  )
  with check (
    auth.uid() = user_id
    or public.is_admin()
    or exists (
      select 1 from public.profiles p
      where p.id = user_id and p.assigned_trainer_id = auth.uid()
    )
  );

drop policy if exists "weight_logs_delete_authorized" on public.weight_logs;
create policy "weight_logs_delete_authorized" on public.weight_logs for delete
  using (
    auth.uid() = user_id
    or public.is_admin()
    or exists (
      select 1 from public.profiles p
      where p.id = user_id and p.assigned_trainer_id = auth.uid()
    )
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

create index if not exists idx_progress_photos_user_taken
  on public.progress_photos(user_id, taken_at desc);

alter table public.progress_photos enable row level security;

drop policy if exists "progress_photos_select_own" on public.progress_photos;
create policy "progress_photos_select_own" on public.progress_photos for select
  using (auth.uid() = user_id);

drop policy if exists "progress_photos_select_trainer" on public.progress_photos;
create policy "progress_photos_select_trainer" on public.progress_photos for select
  using (
    exists (
      select 1 from public.profiles p
      where p.id = user_id and p.assigned_trainer_id = auth.uid()
    )
  );

drop policy if exists "progress_photos_select_admin" on public.progress_photos;
create policy "progress_photos_select_admin" on public.progress_photos for select
  using (public.is_admin());

drop policy if exists "progress_photos_insert_authorized" on public.progress_photos;
create policy "progress_photos_insert_authorized" on public.progress_photos for insert
  with check (
    bucket_id = 'progress-photos'
    and (
      auth.uid() = user_id
      or public.is_admin()
      or exists (
        select 1 from public.profiles p
        where p.id = user_id and p.assigned_trainer_id = auth.uid()
      )
    )
  );

drop policy if exists "progress_photos_delete_authorized" on public.progress_photos;
create policy "progress_photos_delete_authorized" on public.progress_photos for delete
  using (
    auth.uid() = user_id
    or public.is_admin()
    or exists (
      select 1 from public.profiles p
      where p.id = user_id and p.assigned_trainer_id = auth.uid()
    )
  );

-- Private bucket policies. Paths are scoped as {client_uuid}/{file}.
drop policy if exists "progress_photos_storage_select_authorized" on storage.objects;
create policy "progress_photos_storage_select_authorized" on storage.objects for select
  using (
    bucket_id = 'progress-photos'
    and (
      auth.uid()::text = (storage.foldername(name))[1]
      or public.is_admin()
      or exists (
        select 1 from public.profiles p
        where p.id::text = (storage.foldername(name))[1]
          and p.assigned_trainer_id = auth.uid()
      )
    )
  );

drop policy if exists "progress_photos_storage_insert_authorized" on storage.objects;
create policy "progress_photos_storage_insert_authorized" on storage.objects for insert
  with check (
    bucket_id = 'progress-photos'
    and (
      auth.uid()::text = (storage.foldername(name))[1]
      or public.is_admin()
      or exists (
        select 1 from public.profiles p
        where p.id::text = (storage.foldername(name))[1]
          and p.assigned_trainer_id = auth.uid()
      )
    )
  );

drop policy if exists "progress_photos_storage_delete_authorized" on storage.objects;
create policy "progress_photos_storage_delete_authorized" on storage.objects for delete
  using (
    bucket_id = 'progress-photos'
    and (
      auth.uid()::text = (storage.foldername(name))[1]
      or public.is_admin()
      or exists (
        select 1 from public.profiles p
        where p.id::text = (storage.foldername(name))[1]
          and p.assigned_trainer_id = auth.uid()
      )
    )
  );
