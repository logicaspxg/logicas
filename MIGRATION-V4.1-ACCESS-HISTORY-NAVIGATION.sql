-- Lógicas PXG V4.1 — navegação do histórico por período

create or replace function public.admin_access_history(
  p_start_date date,
  p_end_date date
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  result jsonb;
  safe_end date := least(coalesce(p_end_date, current_date), (timezone('America/Sao_Paulo', now()))::date);
  safe_start date;
begin
  if not (select public.is_admin()) then
    raise exception 'admin access required' using errcode = '42501';
  end if;

  safe_start := greatest(coalesce(p_start_date, safe_end - 14), safe_end - 29);
  if safe_start > safe_end then
    raise exception 'invalid date range';
  end if;

  with calendar as (
    select generate_series(safe_start, safe_end, interval '1 day')::date as day
  ), daily as (
    select c.day,
      count(e.*)::integer as views,
      count(distinct e.visitor_hash)::integer as visitors
    from calendar c
    left join public.access_events e
      on (timezone('America/Sao_Paulo', e.viewed_at))::date = c.day
    group by c.day
    order by c.day
  )
  select coalesce(
    jsonb_agg(jsonb_build_object('day',day,'views',views,'visitors',visitors) order by day),
    '[]'::jsonb
  ) into result from daily;

  return result;
end;
$$;

revoke all on function public.admin_access_history(date,date) from public;
grant execute on function public.admin_access_history(date,date) to authenticated;
