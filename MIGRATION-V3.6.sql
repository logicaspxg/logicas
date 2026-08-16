-- ============================================================
-- LÓGICAS PXG V3.6 — DENÚNCIAS DE PERFIL
-- Execute uma única vez no SQL Editor do Supabase.
-- ============================================================

create table if not exists public.profile_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null constraint profile_reports_reporter_id_fkey references public.profiles(id) on delete cascade,
  reported_profile_id uuid not null constraint profile_reports_reported_profile_id_fkey references public.profiles(id) on delete cascade,
  source_comment_id bigint constraint profile_reports_source_comment_id_fkey references public.comments(id) on delete set null,
  reason text not null check (reason in ('inappropriate_content','harassment','spam','impersonation','other')),
  details text check (details is null or char_length(trim(details)) between 1 and 500),
  status text not null default 'pending' check (status in ('pending','dismissed','actioned')),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid constraint profile_reports_reviewed_by_fkey references public.profiles(id) on delete set null,
  constraint profile_reports_not_self check (reporter_id <> reported_profile_id)
);

create index if not exists idx_profile_reports_status_created on public.profile_reports(status, created_at desc);
create index if not exists idx_profile_reports_target on public.profile_reports(reported_profile_id, created_at desc);
create index if not exists idx_profile_reports_source_comment on public.profile_reports(source_comment_id) where source_comment_id is not null;
create index if not exists idx_profile_reports_reviewed_by on public.profile_reports(reviewed_by) where reviewed_by is not null;
create unique index if not exists profile_reports_one_pending_per_target
  on public.profile_reports(reporter_id, reported_profile_id)
  where status = 'pending';

alter table public.profile_reports enable row level security;

drop policy if exists "profile_reports_insert_own" on public.profile_reports;
create policy "profile_reports_insert_own"
on public.profile_reports for insert to authenticated
with check ((select auth.uid()) = reporter_id and reporter_id <> reported_profile_id and status = 'pending');

drop policy if exists "profile_reports_read_own_or_admin" on public.profile_reports;
create policy "profile_reports_read_own_or_admin"
on public.profile_reports for select to authenticated
using ((select auth.uid()) = reporter_id or public.is_admin());

drop policy if exists "profile_reports_admin_update" on public.profile_reports;
create policy "profile_reports_admin_update"
on public.profile_reports for update to authenticated
using (public.is_admin())
with check (public.is_admin());

revoke all on public.profile_reports from anon, authenticated;
grant select, insert on public.profile_reports to authenticated;
grant update (status, reviewed_at, reviewed_by) on public.profile_reports to authenticated;

