-- Split daily puzzle reads from load tracking so the public daily puzzle
-- response can be cached for the whole UTC day.

create or replace function public.get_slant_daily_puzzle_content()
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

create or replace function public.record_slant_daily_load(
  p_seed text,
  p_session_id text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_puzzle_id uuid;
begin
  if p_seed is null or p_session_id is null then
    return;
  end if;

  select p.id into v_puzzle_id
  from public.slant_puzzles p
  where p.active = true
    and p.seed = p_seed
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
end;
$$;

grant execute on function public.get_slant_daily_puzzle_content() to anon, authenticated;
grant execute on function public.record_slant_daily_load(text, text) to anon, authenticated;
