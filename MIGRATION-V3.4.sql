-- ============================================================
-- LÓGICAS PXG V3.4 — MIGRAÇÃO
-- Rode UMA VEZ no SQL Editor do Supabase se você já usa V3.3.
-- Adiciona: reação Engraçado, username único e gestão de admins.
-- ============================================================

-- 1) Reação Engraçado
alter table public.reactions drop constraint if exists reactions_reaction_check;
alter table public.reactions add constraint reactions_reaction_check check (reaction in ('like','love','funny'));

-- 2) Nome de usuário único, ignorando maiúsculas/minúsculas e espaços nas pontas.
-- Ex.: Gabriel, gabriel e " Gabriel " passam a ser considerados o mesmo nome.
create unique index if not exists profiles_username_unique_ci
  on public.profiles ((lower(trim(username))));

create or replace function public.username_available(candidate text)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select not exists (
    select 1 from public.profiles
    where lower(trim(username)) = lower(trim(candidate))
  );
$$;
revoke all on function public.username_available(text) from public;
grant execute on function public.username_available(text) to anon, authenticated;

-- 3) Admins podem promover/rebaixar OUTROS usuários.
-- Usuário comum nunca pode se autopromover; admin não pode remover o próprio admin pelo site.
create or replace function public.protect_profile_role()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.role is distinct from old.role and auth.uid() is not null then
    if auth.uid() = old.id then
      raise exception 'Sua própria função não pode ser alterada por esta interface.';
    end if;
    if not public.is_admin() then
      raise exception 'Somente administradores podem alterar funções.';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_protect_role on public.profiles;
create trigger profiles_protect_role
before update on public.profiles
for each row execute procedure public.protect_profile_role();

drop policy if exists "profiles_admin_update" on public.profiles;
create policy "profiles_admin_update"
on public.profiles for update to authenticated
using (public.is_admin())
with check (public.is_admin());

grant update (role) on public.profiles to authenticated;

-- Verificação opcional:
select username, role, created_at from public.profiles order by created_at;
