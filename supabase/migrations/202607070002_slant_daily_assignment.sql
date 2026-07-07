create unique index if not exists slant_puzzles_active_published_on_unique_idx
  on public.slant_puzzles(published_on)
  where active and published_on is not null;

create or replace function public.assign_slant_daily_puzzle(
  p_played_on date default current_date,
  p_difficulty public.slant_difficulty default null
)
returns table (
  played_on date,
  seed text,
  difficulty public.slant_difficulty,
  assigned boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_existing_id uuid;
  v_puzzle_id uuid;
  v_target_difficulty public.slant_difficulty;
begin
  perform pg_advisory_xact_lock(
    hashtext('slant_daily_assignment:' || coalesce(p_played_on, current_date)::text)
  );

  select p.id into v_existing_id
  from public.slant_puzzles p
  where p.active = true
    and p.published_on = coalesce(p_played_on, current_date)
  order by p.difficulty_score asc, p.seed asc
  limit 1;

  if v_existing_id is not null then
    return query
    select
      p.published_on,
      p.seed,
      p.difficulty,
      false
    from public.slant_puzzles p
    where p.id = v_existing_id;
    return;
  end if;

  v_target_difficulty := coalesce(
    p_difficulty,
    case
      when random() < 0.5 then 'medium'::public.slant_difficulty
      else 'hard'::public.slant_difficulty
    end
  );

  select p.id into v_puzzle_id
  from public.slant_puzzles p
  where p.active = true
    and p.solution_verified = true
    and p.published_on is null
    and p.difficulty = v_target_difficulty
  order by random()
  limit 1
  for update of p skip locked;

  if v_puzzle_id is null and p_difficulty is null then
    select p.id into v_puzzle_id
    from public.slant_puzzles p
    where p.active = true
      and p.solution_verified = true
      and p.published_on is null
      and p.difficulty in ('medium', 'hard')
    order by random()
    limit 1
    for update of p skip locked;
  end if;

  if v_puzzle_id is null then
    return;
  end if;

  update public.slant_puzzles p
  set published_on = coalesce(p_played_on, current_date)
  where p.id = v_puzzle_id
    and p.published_on is null;

  return query
  select
    p.published_on,
    p.seed,
    p.difficulty,
    true
  from public.slant_puzzles p
  where p.id = v_puzzle_id;
end;
$$;

create or replace function public.get_slant_daily_puzzle(p_session_id text default null)
returns table (
  id uuid,
  seed text,
  difficulty public.slant_difficulty,
  grid_size smallint,
  title text,
  clue_grid jsonb,
  metrics jsonb,
  difficulty_score numeric
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_puzzle_id uuid;
begin
  perform 1
  from public.assign_slant_daily_puzzle(current_date)
  limit 1;

  select p.id into v_puzzle_id
  from public.slant_puzzles p
  where p.active = true
    and p.published_on = current_date
  order by p.difficulty_score asc, p.seed asc
  limit 1;

  if v_puzzle_id is null then
    return;
  end if;

  insert into public.slant_puzzle_stats (puzzle_id, load_count, last_loaded_at)
  values (v_puzzle_id, 1, now())
  on conflict (puzzle_id) do update
  set load_count = public.slant_puzzle_stats.load_count + 1,
      last_loaded_at = now(),
      updated_at = now();

  insert into public.slant_puzzle_events (puzzle_id, event_type, session_id)
  values (v_puzzle_id, 'load', p_session_id);

  return query
  select
    p.id,
    p.seed,
    p.difficulty,
    p.grid_size,
    p.title,
    p.clue_grid,
    p.metrics,
    p.difficulty_score
  from public.slant_puzzles p
  where p.id = v_puzzle_id;
end;
$$;

create or replace function public.get_slant_print_daily_puzzle(p_session_id text default null)
returns table (
  id uuid,
  seed text,
  difficulty public.slant_difficulty,
  grid_size smallint,
  title text,
  clue_grid jsonb,
  solution_grid text[],
  metrics jsonb,
  difficulty_score numeric
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_puzzle_id uuid;
begin
  perform 1
  from public.assign_slant_daily_puzzle(current_date)
  limit 1;

  select p.id into v_puzzle_id
  from public.slant_puzzles p
  where p.active = true
    and p.published_on = current_date
  order by p.difficulty_score asc, p.seed asc
  limit 1;

  if v_puzzle_id is null then
    return;
  end if;

  insert into public.slant_puzzle_stats (puzzle_id, load_count, last_loaded_at)
  values (v_puzzle_id, 1, now())
  on conflict (puzzle_id) do update
  set load_count = public.slant_puzzle_stats.load_count + 1,
      last_loaded_at = now(),
      updated_at = now();

  insert into public.slant_puzzle_events (puzzle_id, event_type, session_id)
  values (v_puzzle_id, 'load', p_session_id);

  return query
  select
    p.id,
    p.seed,
    p.difficulty,
    p.grid_size,
    p.title,
    p.clue_grid,
    p.solution_grid,
    p.metrics,
    p.difficulty_score
  from public.slant_puzzles p
  where p.id = v_puzzle_id;
end;
$$;

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
  if p_seed is null then
    perform 1
    from public.assign_slant_daily_puzzle(current_date)
    limit 1;
  end if;

  select p.id, p.seed into v_puzzle_id, v_seed
  from public.slant_puzzles p
  where p.active = true
    and (
      (p_seed is not null and p.seed = p_seed) or
      (p_seed is null and p.published_on = current_date)
    )
  order by p.difficulty_score asc, p.seed asc
  limit 1;

  if v_puzzle_id is null then
    return;
  end if;

  return query
  with daily_loads as (
    select distinct e.session_id
    from public.slant_puzzle_events e
    where e.puzzle_id = v_puzzle_id
      and e.event_type = 'load'
      and e.created_at >= current_date
      and e.created_at < current_date + interval '1 day'
      and e.session_id is not null
  ),
  daily_successes as (
    select distinct r.session_id
    from public.slant_daily_results r
    where r.puzzle_id = v_puzzle_id
      and r.played_on = current_date
      and r.session_id is not null
  )
  select
    v_seed,
    count(distinct l.session_id)::bigint as players_today,
    case
      when count(distinct l.session_id) = 0 then 0::numeric
      else round((count(distinct s.session_id)::numeric / count(distinct l.session_id)::numeric) * 100, 1)
    end as success_rate
  from daily_loads l
  full join daily_successes s on s.session_id = l.session_id;
end;
$$;

do $$
begin
  execute 'create extension if not exists pg_cron with schema extensions';
exception
  when others then
    raise notice 'pg_cron is not available in this database. Daily assignment will still run lazily when the daily puzzle RPC is called.';
end;
$$;

do $daily_cron_block$
begin
  if exists (select 1 from pg_namespace where nspname = 'cron') then
    begin
      execute $$select cron.unschedule('assign-daily-slant-puzzle')$$;
    exception
      when others then
        null;
    end;

    execute $cron$
      select cron.schedule(
        'assign-daily-slant-puzzle',
        '5 0 * * *',
        $$select public.assign_slant_daily_puzzle((now() at time zone 'UTC')::date);$$
      )
    $cron$;
  end if;
end;
$daily_cron_block$;

grant execute on function public.get_slant_daily_puzzle(text) to anon, authenticated;
grant execute on function public.get_slant_print_daily_puzzle(text) to anon, authenticated;
grant execute on function public.get_slant_daily_stats(text) to anon, authenticated;
