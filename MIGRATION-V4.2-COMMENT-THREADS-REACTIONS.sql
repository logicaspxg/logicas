-- Lógicas PXG V4.2 — respostas e reações nos comentários

alter table public.comments
  add column if not exists parent_id bigint references public.comments(id) on delete cascade;

create index if not exists idx_comments_parent_id
  on public.comments(parent_id, created_at)
  where parent_id is not null;

create or replace function public.validate_comment_parent()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  parent_comment record;
begin
  if new.parent_id is null then return new; end if;

  select post_id, parent_id into parent_comment
  from public.comments where id = new.parent_id;

  if not found then raise exception 'parent comment not found'; end if;
  if parent_comment.post_id <> new.post_id then raise exception 'reply must belong to the same post'; end if;
  if parent_comment.parent_id is not null then raise exception 'only one reply level is allowed'; end if;
  return new;
end;
$$;

revoke all on function public.validate_comment_parent() from public, anon, authenticated;
drop trigger if exists comments_validate_parent on public.comments;
create trigger comments_validate_parent
before insert or update of parent_id, post_id on public.comments
for each row execute function public.validate_comment_parent();

create table if not exists public.comment_reactions (
  comment_id bigint not null references public.comments(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  reaction text not null check (reaction in ('like','dislike')),
  created_at timestamptz not null default now(),
  primary key (comment_id, user_id)
);

create index if not exists idx_comment_reactions_user_id on public.comment_reactions(user_id);
alter table public.comment_reactions enable row level security;

drop policy if exists "comment_reactions_public_read" on public.comment_reactions;
create policy "comment_reactions_public_read" on public.comment_reactions
for select to anon, authenticated using (true);

drop policy if exists "comment_reactions_insert_own" on public.comment_reactions;
create policy "comment_reactions_insert_own" on public.comment_reactions
for insert to authenticated with check ((select auth.uid()) = user_id);

drop policy if exists "comment_reactions_update_own" on public.comment_reactions;
create policy "comment_reactions_update_own" on public.comment_reactions
for update to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "comment_reactions_delete_own" on public.comment_reactions;
create policy "comment_reactions_delete_own" on public.comment_reactions
for delete to authenticated using ((select auth.uid()) = user_id);

grant select on public.comment_reactions to anon, authenticated;
grant insert, update, delete on public.comment_reactions to authenticated;
