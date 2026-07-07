create index if not exists slant_daily_results_session_elapsed_idx
  on public.slant_daily_results(session_id, elapsed_seconds, played_on);

create index if not exists slant_puzzle_events_session_created_idx
  on public.slant_puzzle_events(session_id, created_at);

create or replace function public.get_slant_player_records(
  p_session_id text
)
returns table (
  challenges_completed bigint,
  best_time_seconds integer,
  best_day date,
  practice_runs bigint,
  first_played_at timestamptz,
  longest_streak_days integer
)
language sql
security definer
set search_path = public
as $$
  with daily_results as (
    select distinct on (r.played_on)
      r.played_on,
      r.elapsed_seconds,
      r.completed_at
    from public.slant_daily_results r
    where r.session_id = p_session_id
    order by r.played_on, r.completed_at asc
  ),
  best_daily as (
    select
      r.elapsed_seconds,
      r.played_on
    from daily_results r
    order by r.elapsed_seconds asc, r.played_on asc
    limit 1
  ),
  practice_summary as (
    select
      count(*)::bigint as practice_runs,
      min(r.completed_at) as first_practice_at
    from public.slant_practice_results r
    where r.session_id = p_session_id
  ),
  first_event as (
    select min(e.created_at) as first_event_at
    from public.slant_puzzle_events e
    where e.session_id = p_session_id
  ),
  streak_days as (
    select
      r.played_on,
      r.played_on - (row_number() over (order by r.played_on))::integer as streak_group
    from (
      select distinct played_on
      from daily_results
    ) r
  ),
  streak_summary as (
    select coalesce(max(day_count), 0)::integer as longest_streak_days
    from (
      select count(*)::integer as day_count
      from streak_days
      group by streak_group
    ) grouped_days
  )
  select
    (select count(*)::bigint from daily_results) as challenges_completed,
    best_daily.elapsed_seconds as best_time_seconds,
    best_daily.played_on as best_day,
    coalesce(practice_summary.practice_runs, 0) as practice_runs,
    (
      select min(first_at)
      from (
        values
          ((select min(completed_at) from daily_results)),
          (practice_summary.first_practice_at),
          (first_event.first_event_at)
      ) as first_sources(first_at)
      where first_at is not null
    ) as first_played_at,
    streak_summary.longest_streak_days
  from practice_summary
  cross join first_event
  cross join streak_summary
  left join best_daily on true;
$$;

grant execute on function public.get_slant_player_records(text) to anon, authenticated;
