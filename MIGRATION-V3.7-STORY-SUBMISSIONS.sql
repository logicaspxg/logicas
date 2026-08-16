-- Lógicas PXG V3.7 — sugestões de histórias autenticadas
create table if not exists public.story_submissions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null constraint story_submissions_user_id_fkey references public.profiles(id) on delete cascade,
  subject text not null check (char_length(trim(subject)) between 3 and 120),
  story text not null check (char_length(trim(story)) between 20 and 4000),
  status text not null default 'new' check (status in ('new','read','used','archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid constraint story_submissions_reviewed_by_fkey references public.profiles(id) on delete set null
);

create index if not exists idx_story_submissions_status_created on public.story_submissions(status, created_at desc);
create index if not exists idx_story_submissions_user_created on public.story_submissions(user_id, created_at desc);
create index if not exists idx_story_submissions_reviewed_by on public.story_submissions(reviewed_by) where reviewed_by is not null;

drop trigger if exists story_submissions_set_updated_at on public.story_submissions;
create trigger story_submissions_set_updated_at before update on public.story_submissions for each row execute procedure public.set_updated_at();

alter table public.story_submissions enable row level security;

drop policy if exists "story_submissions_insert_own" on public.story_submissions;
create policy "story_submissions_insert_own" on public.story_submissions
for insert to authenticated
with check ((select auth.uid()) = user_id and status = 'new');

drop policy if exists "story_submissions_read_own_or_admin" on public.story_submissions;
create policy "story_submissions_read_own_or_admin" on public.story_submissions
for select to authenticated
using ((select auth.uid()) = user_id or (select public.is_admin()));

drop policy if exists "story_submissions_admin_update" on public.story_submissions;
create policy "story_submissions_admin_update" on public.story_submissions
for update to authenticated
using ((select public.is_admin()))
with check ((select public.is_admin()));

revoke all on public.story_submissions from anon, authenticated;
grant select, insert on public.story_submissions to authenticated;
grant update (status, reviewed_at, reviewed_by) on public.story_submissions to authenticated;


