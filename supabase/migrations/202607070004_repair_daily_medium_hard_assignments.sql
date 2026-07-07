-- Repair legacy daily assignments that were created before daily puzzles were
-- restricted to medium/hard. Historical days are kept intact; today and future
-- dates are allowed to be reassigned from the medium/hard pool.
update public.slant_puzzles
set published_on = null
where active = true
  and difficulty = 'easy'
  and published_on >= current_date;

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
    and p.difficulty in ('medium', 'hard')
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

  v_target_difficulty := case
    when p_difficulty in ('medium', 'hard') then p_difficulty
    when random() < 0.5 then 'medium'::public.slant_difficulty
    else 'hard'::public.slant_difficulty
  end;

  select p.id into v_puzzle_id
  from public.slant_puzzles p
  where p.active = true
    and p.solution_verified = true
    and p.published_on is null
    and p.difficulty = v_target_difficulty
  order by random()
  limit 1
  for update of p skip locked;

  if v_puzzle_id is null then
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
