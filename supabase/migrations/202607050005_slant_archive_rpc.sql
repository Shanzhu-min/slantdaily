update public.slant_puzzles
set published_on = date '2026-07-05'
where seed = 'slant-easy-20260705-01'
  and published_on is null;

update public.slant_puzzles
set published_on = date '2026-07-06'
where seed = 'slant-easy-20260705-02'
  and published_on is null;

update public.slant_puzzles
set published_on = date '2026-07-07'
where seed = 'slant-easy-20260705-03'
  and published_on is null;

create index if not exists slant_puzzles_published_on_idx
  on public.slant_puzzles(published_on)
  where active and published_on is not null;

create or replace function public.get_slant_archive_months()
returns table (
  year integer,
  month integer
)
language sql
security definer
set search_path = public
as $$
  select distinct
    extract(year from p.published_on)::integer as year,
    extract(month from p.published_on)::integer as month
  from public.slant_puzzles p
  where p.active = true
    and p.published_on is not null
  order by year desc, month desc;
$$;

create or replace function public.get_slant_archive_month(
  p_session_id text,
  p_year integer default null,
  p_month integer default null
)
returns table (
  year integer,
  month integer,
  puzzle_date date,
  day integer,
  seed text,
  difficulty public.slant_difficulty,
  status text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_month_start date;
begin
  if p_year is not null and p_month is not null then
    v_month_start := make_date(p_year, p_month, 1);
  else
    select date_trunc('month', max(p.published_on))::date into v_month_start
    from public.slant_puzzles p
    where p.active = true
      and p.published_on is not null;

    v_month_start := coalesce(v_month_start, date_trunc('month', current_date)::date);
  end if;

  return query
  with days as (
    select generate_series(
      v_month_start,
      (v_month_start + interval '1 month - 1 day')::date,
      interval '1 day'
    )::date as puzzle_date
  ),
  daily_puzzles as (
    select distinct on (p.published_on)
      p.published_on,
      p.seed,
      p.difficulty
    from public.slant_puzzles p
    where p.active = true
      and p.published_on >= v_month_start
      and p.published_on < v_month_start + interval '1 month'
    order by p.published_on, p.difficulty_score asc, p.seed asc
  )
  select
    extract(year from v_month_start)::integer,
    extract(month from v_month_start)::integer,
    d.puzzle_date,
    extract(day from d.puzzle_date)::integer,
    p.seed,
    p.difficulty,
    case
      when p.seed is null then 'no_puzzle'
      when exists (
        select 1
        from public.slant_daily_results r
        join public.slant_puzzles rp on rp.id = r.puzzle_id
        where r.session_id = p_session_id
          and r.played_on = d.puzzle_date
      ) then 'completed'
      else 'unfinished'
    end
  from days d
  left join daily_puzzles p on p.published_on = d.puzzle_date
  order by d.puzzle_date asc;
end;
$$;

create or replace function public.get_slant_daily_puzzle_by_date(
  p_played_on date,
  p_session_id text default null
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
  select p.id into v_puzzle_id
  from public.slant_puzzles p
  where p.active = true
    and p.published_on = p_played_on
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

grant execute on function public.get_slant_archive_months() to anon, authenticated;
grant execute on function public.get_slant_archive_month(text, integer, integer) to anon, authenticated;
grant execute on function public.get_slant_daily_puzzle_by_date(date, text) to anon, authenticated;
