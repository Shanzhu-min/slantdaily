create or replace function public.get_slant_daily_stats(p_seed text default null)
returns table (
  seed text,
  players_today bigint,
  success_rate numeric
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_puzzle_id uuid;
  v_seed text;
begin
  select p.id, p.seed into v_puzzle_id, v_seed
  from public.slant_puzzles p
  where p.active = true
    and (
      (p_seed is not null and p.seed = p_seed) or
      (p_seed is null and (p.published_on = current_date or p.difficulty = 'easy'))
    )
  order by
    (p.published_on = current_date) desc,
    p.difficulty_score asc,
    p.seed asc
  limit 1;

  if v_puzzle_id is null then
    return;
  end if;

  return query
  with daily_events as (
    select
      e.event_type,
      coalesce(e.session_id, e.id::text) as player_key
    from public.slant_puzzle_events e
    where e.puzzle_id = v_puzzle_id
      and e.created_at >= current_date
      and e.created_at < current_date + interval '1 day'
  ),
  daily_counts as (
    select
      count(distinct player_key) filter (where event_type = 'load') as loads,
      count(distinct player_key) filter (where event_type = 'success') as successes
    from daily_events
  )
  select
    v_seed,
    coalesce(d.loads, 0)::bigint as players_today,
    case
      when coalesce(d.loads, 0) = 0 then 0::numeric
      else round((coalesce(d.successes, 0)::numeric / d.loads::numeric) * 100, 1)
    end as success_rate
  from daily_counts d;
end;
$$;

grant execute on function public.get_slant_daily_stats(text) to anon, authenticated;
