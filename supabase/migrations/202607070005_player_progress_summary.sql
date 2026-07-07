-- Store completion details as immutable facts, and keep a per-player summary row
-- so achievement pages can load from one cheap lookup instead of aggregating all
-- historical results on every visit.

alter table public.slant_daily_results
  add column if not exists mistakes integer not null default 0 check (mistakes >= 0),
  add column if not exists undo_count integer not null default 0 check (undo_count >= 0),
  add column if not exists reset_count integer not null default 0 check (reset_count >= 0),
  add column if not exists hint_count integer not null default 0 check (hint_count >= 0),
  add column if not exists perfect boolean not null default false;

alter table public.slant_practice_results
  add column if not exists mistakes integer not null default 0 check (mistakes >= 0),
  add column if not exists undo_count integer not null default 0 check (undo_count >= 0),
  add column if not exists reset_count integer not null default 0 check (reset_count >= 0),
  add column if not exists hint_count integer not null default 0 check (hint_count >= 0),
  add column if not exists perfect boolean not null default false;

create table if not exists public.slant_player_progress (
  session_id text primary key,
  user_id uuid references auth.users(id) on delete set null,
  total_completed integer not null default 0 check (total_completed >= 0),
  daily_completed integer not null default 0 check (daily_completed >= 0),
  practice_completed integer not null default 0 check (practice_completed >= 0),
  easy_completed integer not null default 0 check (easy_completed >= 0),
  medium_completed integer not null default 0 check (medium_completed >= 0),
  hard_completed integer not null default 0 check (hard_completed >= 0),
  perfect_runs integer not null default 0 check (perfect_runs >= 0),
  current_streak_days integer not null default 0 check (current_streak_days >= 0),
  longest_streak_days integer not null default 0 check (longest_streak_days >= 0),
  last_daily_played_on date,
  best_time_seconds integer check (best_time_seconds is null or best_time_seconds >= 0),
  best_day date,
  first_played_at timestamptz,
  last_completed_at timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.slant_player_progress enable row level security;
revoke all on table public.slant_player_progress from anon, authenticated;

create index if not exists slant_player_progress_updated_idx
  on public.slant_player_progress(updated_at desc);

drop function if exists public.get_slant_player_records(text);
drop function if exists public.record_slant_daily_complete(text, text, integer, integer, date);
drop function if exists public.record_slant_practice_complete(text, text, public.slant_difficulty, integer, integer);

create or replace function public.rebuild_slant_player_progress(p_session_id text)
returns public.slant_player_progress
language plpgsql
security definer
set search_path = public
as $$
declare
  v_progress public.slant_player_progress;
begin
  if p_session_id is null or length(trim(p_session_id)) = 0 then
    return null;
  end if;

  with daily_results as (
    select distinct on (r.played_on)
      r.played_on,
      r.elapsed_seconds,
      r.completed_at,
      r.perfect,
      p.difficulty
    from public.slant_daily_results r
    join public.slant_puzzles p on p.id = r.puzzle_id
    where r.session_id = p_session_id
    order by r.played_on, r.completed_at asc
  ),
  all_results as (
    select
      d.completed_at,
      d.played_on,
      d.elapsed_seconds,
      d.perfect,
      d.difficulty,
      'daily'::text as mode
    from daily_results d
    union all
    select
      r.completed_at,
      null::date as played_on,
      r.elapsed_seconds,
      r.perfect,
      r.difficulty,
      'practice'::text as mode
    from public.slant_practice_results r
    where r.session_id = p_session_id
  ),
  best_daily as (
    select d.elapsed_seconds, d.played_on
    from daily_results d
    order by d.elapsed_seconds asc, d.played_on asc
    limit 1
  ),
  streak_days as (
    select
      d.played_on,
      d.played_on - (row_number() over (order by d.played_on))::integer as streak_group
    from daily_results d
  ),
  streak_summary as (
    select coalesce(max(day_count), 0)::integer as longest_streak_days
    from (
      select count(*)::integer as day_count
      from streak_days
      group by streak_group
    ) grouped_days
  ),
  current_streak as (
    select count(*)::integer as current_streak_days
    from (
      select
        d.played_on,
        max(d.played_on) over () as last_day
      from daily_results d
    ) d
    where d.played_on >= d.last_day - ((select coalesce(max(day_count), 0)::integer from (
      select count(*)::integer as day_count
      from streak_days
      group by streak_group
      having max(played_on) = (select max(played_on) from daily_results)
    ) current_group) - 1)
  ),
  summary as (
    select
      count(*)::integer as total_completed,
      count(*) filter (where mode = 'daily')::integer as daily_completed,
      count(*) filter (where mode = 'practice')::integer as practice_completed,
      count(*) filter (where difficulty = 'easy')::integer as easy_completed,
      count(*) filter (where difficulty = 'medium')::integer as medium_completed,
      count(*) filter (where difficulty = 'hard')::integer as hard_completed,
      count(*) filter (where perfect)::integer as perfect_runs,
      min(completed_at) as first_played_at,
      max(completed_at) as last_completed_at
    from all_results
  )
  insert into public.slant_player_progress (
    session_id,
    total_completed,
    daily_completed,
    practice_completed,
    easy_completed,
    medium_completed,
    hard_completed,
    perfect_runs,
    current_streak_days,
    longest_streak_days,
    last_daily_played_on,
    best_time_seconds,
    best_day,
    first_played_at,
    last_completed_at,
    updated_at
  )
  select
    p_session_id,
    coalesce(summary.total_completed, 0),
    coalesce(summary.daily_completed, 0),
    coalesce(summary.practice_completed, 0),
    coalesce(summary.easy_completed, 0),
    coalesce(summary.medium_completed, 0),
    coalesce(summary.hard_completed, 0),
    coalesce(summary.perfect_runs, 0),
    coalesce(current_streak.current_streak_days, 0),
    coalesce(streak_summary.longest_streak_days, 0),
    (select max(played_on) from daily_results),
    best_daily.elapsed_seconds,
    best_daily.played_on,
    summary.first_played_at,
    summary.last_completed_at,
    now()
  from summary
  cross join streak_summary
  cross join current_streak
  left join best_daily on true
  on conflict (session_id) do update
  set
    total_completed = excluded.total_completed,
    daily_completed = excluded.daily_completed,
    practice_completed = excluded.practice_completed,
    easy_completed = excluded.easy_completed,
    medium_completed = excluded.medium_completed,
    hard_completed = excluded.hard_completed,
    perfect_runs = excluded.perfect_runs,
    current_streak_days = excluded.current_streak_days,
    longest_streak_days = excluded.longest_streak_days,
    last_daily_played_on = excluded.last_daily_played_on,
    best_time_seconds = excluded.best_time_seconds,
    best_day = excluded.best_day,
    first_played_at = excluded.first_played_at,
    last_completed_at = excluded.last_completed_at,
    updated_at = now()
  returning * into v_progress;

  return v_progress;
end;
$$;

create or replace function public.record_slant_daily_complete(
  p_seed text,
  p_session_id text,
  p_elapsed_seconds integer,
  p_moves integer default 0,
  p_played_on date default current_date,
  p_mistakes integer default 0,
  p_undo_count integer default 0,
  p_reset_count integer default 0,
  p_hint_count integer default 0
)
returns table (
  recorded boolean,
  already_completed boolean,
  completed_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_puzzle_id uuid;
  v_completed_at timestamptz;
  v_perfect boolean;
begin
  select p.id into v_puzzle_id
  from public.slant_puzzles p
  where p.seed = p_seed and p.active = true;

  if v_puzzle_id is null then
    return query select false, false, null::timestamptz;
    return;
  end if;

  select r.completed_at into v_completed_at
  from public.slant_daily_results r
  where r.session_id = p_session_id
    and r.played_on = coalesce(p_played_on, current_date)
  order by r.completed_at asc
  limit 1;

  if v_completed_at is not null then
    return query select false, true, v_completed_at;
    return;
  end if;

  v_perfect :=
    greatest(coalesce(p_mistakes, 0), 0) = 0
    and greatest(coalesce(p_undo_count, 0), 0) = 0
    and greatest(coalesce(p_reset_count, 0), 0) = 0
    and greatest(coalesce(p_hint_count, 0), 0) = 0;

  insert into public.slant_daily_results (
    puzzle_id,
    session_id,
    played_on,
    elapsed_seconds,
    moves,
    mistakes,
    undo_count,
    reset_count,
    hint_count,
    perfect
  )
  values (
    v_puzzle_id,
    p_session_id,
    coalesce(p_played_on, current_date),
    greatest(coalesce(p_elapsed_seconds, 0), 0),
    greatest(coalesce(p_moves, 0), 0),
    greatest(coalesce(p_mistakes, 0), 0),
    greatest(coalesce(p_undo_count, 0), 0),
    greatest(coalesce(p_reset_count, 0), 0),
    greatest(coalesce(p_hint_count, 0), 0),
    v_perfect
  )
  on conflict (session_id, played_on) do nothing
  returning slant_daily_results.completed_at into v_completed_at;

  if v_completed_at is null then
    select r.completed_at into v_completed_at
    from public.slant_daily_results r
    where r.session_id = p_session_id
      and r.played_on = coalesce(p_played_on, current_date)
    order by r.completed_at asc
    limit 1;

    return query select false, true, v_completed_at;
    return;
  end if;

  insert into public.slant_puzzle_stats (puzzle_id, success_count, last_solved_at)
  values (v_puzzle_id, 1, now())
  on conflict (puzzle_id) do update
  set success_count = public.slant_puzzle_stats.success_count + 1,
      last_solved_at = now(),
      updated_at = now();

  insert into public.slant_puzzle_events (puzzle_id, event_type, session_id)
  values (v_puzzle_id, 'success', p_session_id);

  perform public.rebuild_slant_player_progress(p_session_id);

  return query select true, false, v_completed_at;
end;
$$;

create or replace function public.record_slant_practice_complete(
  p_seed text,
  p_session_id text,
  p_difficulty public.slant_difficulty,
  p_elapsed_seconds integer,
  p_moves integer default 0,
  p_mistakes integer default 0,
  p_undo_count integer default 0,
  p_reset_count integer default 0,
  p_hint_count integer default 0
)
returns table (
  recorded boolean,
  already_completed boolean,
  completed_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_puzzle_id uuid;
  v_completed_at timestamptz;
  v_perfect boolean;
begin
  select p.id into v_puzzle_id
  from public.slant_puzzles p
  where p.seed = p_seed
    and p.difficulty = p_difficulty
    and p.active = true;

  if v_puzzle_id is null then
    return query select false, false, null::timestamptz;
    return;
  end if;

  v_perfect :=
    greatest(coalesce(p_mistakes, 0), 0) = 0
    and greatest(coalesce(p_undo_count, 0), 0) = 0
    and greatest(coalesce(p_reset_count, 0), 0) = 0
    and greatest(coalesce(p_hint_count, 0), 0) = 0;

  insert into public.slant_practice_results (
    puzzle_id,
    session_id,
    difficulty,
    elapsed_seconds,
    moves,
    mistakes,
    undo_count,
    reset_count,
    hint_count,
    perfect
  )
  values (
    v_puzzle_id,
    p_session_id,
    p_difficulty,
    greatest(coalesce(p_elapsed_seconds, 0), 0),
    greatest(coalesce(p_moves, 0), 0),
    greatest(coalesce(p_mistakes, 0), 0),
    greatest(coalesce(p_undo_count, 0), 0),
    greatest(coalesce(p_reset_count, 0), 0),
    greatest(coalesce(p_hint_count, 0), 0),
    v_perfect
  )
  returning slant_practice_results.completed_at into v_completed_at;

  insert into public.slant_puzzle_stats (puzzle_id, success_count, last_solved_at)
  values (v_puzzle_id, 1, now())
  on conflict (puzzle_id) do update
  set success_count = public.slant_puzzle_stats.success_count + 1,
      last_solved_at = now(),
      updated_at = now();

  insert into public.slant_puzzle_events (puzzle_id, event_type, session_id)
  values (v_puzzle_id, 'success', p_session_id);

  perform public.rebuild_slant_player_progress(p_session_id);

  return query select true, false, v_completed_at;
end;
$$;

create or replace function public.get_slant_player_records(
  p_session_id text
)
returns table (
  total_completed integer,
  daily_completed integer,
  challenges_completed integer,
  practice_completed integer,
  practice_runs integer,
  easy_completed integer,
  medium_completed integer,
  hard_completed integer,
  perfect_runs integer,
  current_streak_days integer,
  longest_streak_days integer,
  best_time_seconds integer,
  best_day date,
  first_played_at timestamptz,
  last_completed_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_progress public.slant_player_progress;
begin
  if p_session_id is null or length(trim(p_session_id)) = 0 then
    return query
    select 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, null::integer, null::date, null::timestamptz, null::timestamptz;
    return;
  end if;

  select * into v_progress
  from public.slant_player_progress p
  where p.session_id = p_session_id;

  if v_progress.session_id is null then
    v_progress := public.rebuild_slant_player_progress(p_session_id);
  end if;

  if v_progress.session_id is null then
    return query
    select 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, null::integer, null::date, null::timestamptz, null::timestamptz;
    return;
  end if;

  return query
  select
    v_progress.total_completed,
    v_progress.daily_completed,
    v_progress.daily_completed,
    v_progress.practice_completed,
    v_progress.practice_completed,
    v_progress.easy_completed,
    v_progress.medium_completed,
    v_progress.hard_completed,
    v_progress.perfect_runs,
    v_progress.current_streak_days,
    v_progress.longest_streak_days,
    v_progress.best_time_seconds,
    v_progress.best_day,
    v_progress.first_played_at,
    v_progress.last_completed_at;
end;
$$;

grant execute on function public.rebuild_slant_player_progress(text) to anon, authenticated;
grant execute on function public.get_slant_player_records(text) to anon, authenticated;
grant execute on function public.record_slant_daily_complete(text, text, integer, integer, date, integer, integer, integer, integer) to anon, authenticated;
grant execute on function public.record_slant_practice_complete(text, text, public.slant_difficulty, integer, integer, integer, integer, integer, integer) to anon, authenticated;
