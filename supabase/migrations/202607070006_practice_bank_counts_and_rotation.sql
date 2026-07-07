create or replace function public.get_slant_puzzle_bank_counts()
returns table (
  difficulty public.slant_difficulty,
  total_count bigint,
  active_count bigint,
  verified_active_count bigint,
  bank_active_count bigint
)
language sql
security definer
set search_path = public
as $$
  select
    p.difficulty,
    count(*)::bigint as total_count,
    count(*) filter (where p.active)::bigint as active_count,
    count(*) filter (where p.active and coalesce(p.solution_verified, true))::bigint as verified_active_count,
    count(*) filter (
      where p.active
        and coalesce(p.solution_verified, true)
        and p.seed like ('slant-' || p.difficulty::text || '-bank-%')
    )::bigint as bank_active_count
  from public.slant_puzzles p
  group by p.difficulty
  order by p.difficulty;
$$;

create or replace function public.get_slant_puzzle_by_difficulty(
  p_difficulty public.slant_difficulty,
  p_session_id text default null,
  p_offset integer default 0
)
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
  with candidates as (
    select
      p.id,
      row_number() over (order by p.seed asc) as row_index,
      count(*) over () as total_count
    from public.slant_puzzles p
    where p.difficulty = p_difficulty
      and p.active = true
      and coalesce(p.solution_verified, true) = true
      and p.seed like ('slant-' || p_difficulty::text || '-bank-%')
  )
  select c.id into v_puzzle_id
  from candidates c
  where c.row_index = (greatest(coalesce(p_offset, 0), 0) % c.total_count) + 1
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

create or replace function public.get_slant_print_puzzle_by_difficulty(
  p_difficulty public.slant_difficulty,
  p_session_id text default null,
  p_offset integer default 0
)
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
  with candidates as (
    select
      p.id,
      row_number() over (order by p.seed asc) as row_index,
      count(*) over () as total_count
    from public.slant_puzzles p
    where p.difficulty = p_difficulty
      and p.active = true
      and coalesce(p.solution_verified, true) = true
      and p.seed like ('slant-' || p_difficulty::text || '-bank-%')
  )
  select c.id into v_puzzle_id
  from candidates c
  where c.row_index = (greatest(coalesce(p_offset, 0), 0) % c.total_count) + 1
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

grant execute on function public.get_slant_puzzle_bank_counts() to anon, authenticated;
grant execute on function public.get_slant_puzzle_by_difficulty(public.slant_difficulty, text, integer) to anon, authenticated;
grant execute on function public.get_slant_print_puzzle_by_difficulty(public.slant_difficulty, text, integer) to anon, authenticated;

notify pgrst, 'reload schema';
