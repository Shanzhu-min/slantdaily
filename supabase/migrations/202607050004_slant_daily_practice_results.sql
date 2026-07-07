create table if not exists public.slant_daily_results (
  id uuid primary key default gen_random_uuid(),
  puzzle_id uuid not null references public.slant_puzzles(id) on delete cascade,
  session_id text not null,
  user_id uuid references auth.users(id) on delete set null,
  played_on date not null default current_date,
  elapsed_seconds integer not null check (elapsed_seconds >= 0),
  moves integer not null default 0 check (moves >= 0),
  completed_at timestamptz not null default now(),
  unique (session_id, played_on)
);

create table if not exists public.slant_practice_results (
  id uuid primary key default gen_random_uuid(),
  puzzle_id uuid not null references public.slant_puzzles(id) on delete cascade,
  session_id text not null,
  user_id uuid references auth.users(id) on delete set null,
  difficulty public.slant_difficulty not null,
  elapsed_seconds integer not null check (elapsed_seconds >= 0),
  moves integer not null default 0 check (moves >= 0),
  completed_at timestamptz not null default now()
);

create index if not exists slant_daily_results_played_on_idx
  on public.slant_daily_results(played_on, completed_at desc);

create index if not exists slant_daily_results_session_idx
  on public.slant_daily_results(session_id, played_on);

create index if not exists slant_practice_results_session_idx
  on public.slant_practice_results(session_id, completed_at desc);

create or replace function public.get_slant_daily_stats(p_seed text)
returns table (
  seed text,
  players_today bigint,
  success_rate numeric
)
language sql
security definer
set search_path = public
as $$
  with target_puzzle as (
    select id, seed
    from public.slant_puzzles
    where seed = p_seed and active = true
    limit 1
  ),
  daily_loads as (
    select distinct e.session_id
    from public.slant_puzzle_events e
    join target_puzzle p on p.id = e.puzzle_id
    where e.event_type = 'load'
      and e.created_at >= current_date
      and e.created_at < current_date + interval '1 day'
      and e.session_id is not null
  ),
  daily_successes as (
    select distinct r.session_id
    from public.slant_daily_results r
    join target_puzzle p on p.id = r.puzzle_id
    where r.played_on = current_date
      and r.session_id is not null
  )
  select
    p.seed,
    count(distinct l.session_id)::bigint as players_today,
    case
      when count(distinct l.session_id) = 0 then 0
      else round((count(distinct s.session_id)::numeric / count(distinct l.session_id)::numeric) * 100, 1)
    end as success_rate
  from target_puzzle p
  left join daily_loads l on true
  left join daily_successes s on true
  group by p.seed;
$$;

create or replace function public.get_slant_daily_status(
  p_session_id text,
  p_played_on date default current_date
)
returns table (
  completed boolean,
  seed text,
  elapsed_seconds integer,
  completed_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  select
    true,
    p.seed,
    r.elapsed_seconds,
    r.completed_at
  from public.slant_daily_results r
  join public.slant_puzzles p on p.id = r.puzzle_id
  where r.session_id = p_session_id
    and r.played_on = coalesce(p_played_on, current_date)
  order by r.completed_at asc
  limit 1;

  if not found then
    return query select false, null::text, null::integer, null::timestamptz;
  end if;
end;
$$;

create or replace function public.record_slant_daily_complete(
  p_seed text,
  p_session_id text,
  p_elapsed_seconds integer,
  p_moves integer default 0,
  p_played_on date default current_date
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

  insert into public.slant_daily_results (
    puzzle_id,
    session_id,
    played_on,
    elapsed_seconds,
    moves
  )
  values (
    v_puzzle_id,
    p_session_id,
    coalesce(p_played_on, current_date),
    greatest(coalesce(p_elapsed_seconds, 0), 0),
    greatest(coalesce(p_moves, 0), 0)
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

  return query select true, false, v_completed_at;
end;
$$;

create or replace function public.record_slant_practice_complete(
  p_seed text,
  p_session_id text,
  p_difficulty public.slant_difficulty,
  p_elapsed_seconds integer,
  p_moves integer default 0
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

  insert into public.slant_practice_results (
    puzzle_id,
    session_id,
    difficulty,
    elapsed_seconds,
    moves
  )
  values (
    v_puzzle_id,
    p_session_id,
    p_difficulty,
    greatest(coalesce(p_elapsed_seconds, 0), 0),
    greatest(coalesce(p_moves, 0), 0)
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

  return query select true, false, v_completed_at;
end;
$$;

alter table public.slant_daily_results enable row level security;
alter table public.slant_practice_results enable row level security;

revoke all on table public.slant_daily_results from anon, authenticated;
revoke all on table public.slant_practice_results from anon, authenticated;

grant execute on function public.get_slant_daily_stats(text) to anon, authenticated;
grant execute on function public.get_slant_daily_status(text, date) to anon, authenticated;
grant execute on function public.record_slant_daily_complete(text, text, integer, integer, date) to anon, authenticated;
grant execute on function public.record_slant_practice_complete(text, text, public.slant_difficulty, integer, integer) to anon, authenticated;
