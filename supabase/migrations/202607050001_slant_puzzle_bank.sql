set standard_conforming_strings = on;

create extension if not exists pgcrypto;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'slant_difficulty') then
    create type public.slant_difficulty as enum ('easy', 'medium', 'hard');
  end if;
end $$;

create table if not exists public.slant_puzzles (
  id uuid primary key default gen_random_uuid(),
  seed text not null unique,
  difficulty public.slant_difficulty not null,
  grid_size smallint not null,
  title text not null,
  clue_grid jsonb not null,
  solution_grid text[] not null,
  metrics jsonb not null default '{}'::jsonb,
  difficulty_score numeric(8, 4) not null,
  forced_ratio numeric(6, 4) not null,
  branching_factor numeric(8, 4) not null,
  inference_depth smallint not null,
  clue_density numeric(6, 4) not null,
  structure_score numeric(6, 4) not null,
  guess_required boolean not null default false,
  solution_verified boolean not null default true,
  verification_method text not null default 'generated_solution_satisfies_clues',
  active boolean not null default true,
  published_on date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint slant_puzzles_grid_size_matches_difficulty check (
    (difficulty = 'easy' and grid_size = 6) or
    (difficulty = 'medium' and grid_size = 8) or
    (difficulty = 'hard' and grid_size = 10)
  ),
  constraint slant_puzzles_metric_ranges check (
    forced_ratio between 0 and 1 and
    branching_factor >= 0 and
    inference_depth >= 0 and
    clue_density between 0 and 1 and
    structure_score between 0 and 1 and
    difficulty_score >= 0
  ),
  constraint slant_puzzles_clue_grid_is_array check (jsonb_typeof(clue_grid) = 'array'),
  constraint slant_puzzles_solution_rows_match_size check (array_length(solution_grid, 1) = grid_size)
);

create table if not exists public.slant_puzzle_stats (
  puzzle_id uuid primary key references public.slant_puzzles(id) on delete cascade,
  load_count bigint not null default 0,
  success_count bigint not null default 0,
  fail_count bigint not null default 0,
  last_loaded_at timestamptz,
  last_solved_at timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists public.slant_puzzle_events (
  id bigint generated always as identity primary key,
  puzzle_id uuid not null references public.slant_puzzles(id) on delete cascade,
  event_type text not null check (event_type in ('load', 'success', 'fail')),
  session_id text,
  user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists slant_puzzles_seed_active_idx
  on public.slant_puzzles(seed)
  where active;

create index if not exists slant_puzzles_difficulty_score_idx
  on public.slant_puzzles(difficulty, difficulty_score)
  where active;

create index if not exists slant_puzzle_events_puzzle_created_idx
  on public.slant_puzzle_events(puzzle_id, created_at desc);

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists touch_slant_puzzles_updated_at on public.slant_puzzles;
create trigger touch_slant_puzzles_updated_at
before update on public.slant_puzzles
for each row execute function public.touch_updated_at();

drop trigger if exists touch_slant_puzzle_stats_updated_at on public.slant_puzzle_stats;
create trigger touch_slant_puzzle_stats_updated_at
before update on public.slant_puzzle_stats
for each row execute function public.touch_updated_at();

create or replace function public.ensure_slant_puzzle_stats()
returns trigger
language plpgsql
as $$
begin
  insert into public.slant_puzzle_stats (puzzle_id)
  values (new.id)
  on conflict (puzzle_id) do nothing;
  return new;
end;
$$;

drop trigger if exists ensure_slant_puzzle_stats_after_insert on public.slant_puzzles;
create trigger ensure_slant_puzzle_stats_after_insert
after insert on public.slant_puzzles
for each row execute function public.ensure_slant_puzzle_stats();

create or replace function public.get_slant_puzzle_by_seed(p_seed text, p_session_id text default null)
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
  where p.seed = p_seed and p.active = true;

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

create or replace function public.record_slant_puzzle_result(
  p_seed text,
  p_success boolean,
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
  select p.id into v_puzzle_id
  from public.slant_puzzles p
  where p.seed = p_seed and p.active = true;

  if v_puzzle_id is null then
    return;
  end if;

  insert into public.slant_puzzle_stats (puzzle_id, success_count, fail_count, last_solved_at)
  values (
    v_puzzle_id,
    case when p_success then 1 else 0 end,
    case when p_success then 0 else 1 end,
    case when p_success then now() else null end
  )
  on conflict (puzzle_id) do update
  set success_count = public.slant_puzzle_stats.success_count + case when p_success then 1 else 0 end,
      fail_count = public.slant_puzzle_stats.fail_count + case when p_success then 0 else 1 end,
      last_solved_at = case when p_success then now() else public.slant_puzzle_stats.last_solved_at end,
      updated_at = now();

  insert into public.slant_puzzle_events (puzzle_id, event_type, session_id)
  values (v_puzzle_id, case when p_success then 'success' else 'fail' end, p_session_id);
end;
$$;

alter table public.slant_puzzles enable row level security;
alter table public.slant_puzzle_stats enable row level security;
alter table public.slant_puzzle_events enable row level security;

revoke all on table public.slant_puzzles from anon, authenticated;
revoke all on table public.slant_puzzle_stats from anon, authenticated;
revoke all on table public.slant_puzzle_events from anon, authenticated;
grant execute on function public.get_slant_puzzle_by_seed(text, text) to anon, authenticated;
grant execute on function public.record_slant_puzzle_result(text, boolean, text) to anon, authenticated;

insert into public.slant_puzzles (
  seed,
  difficulty,
  grid_size,
  title,
  clue_grid,
  solution_grid,
  metrics,
  difficulty_score,
  forced_ratio,
  branching_factor,
  inference_depth,
  clue_density,
  structure_score,
  guess_required
) values
  ('slant-easy-20260705-01', 'easy', 6, 'Easy Prototype 1', '[[null,null,1,2,null,1,0],[null,1,3,null,2,1,null],[0,3,null,3,null,2,1],[null,null,null,null,2,3,1],[null,1,3,1,2,2,null],[null,null,1,3,2,null,1],[null,null,1,1,1,2,0]]'::jsonb, ARRAY['///\\\','\/\\\/','///\\/','//////','\/\///','\\\\\/'], '{"forced_ratio":0.72,"branching_factor":1.05,"inference_depth":2,"clue_density":0.62,"structure_score":0.22,"guess_required":false}'::jsonb, 0.7700, 0.72, 1.05, 2, 0.62, 0.22, false),
  ('slant-easy-20260705-02', 'easy', 6, 'Easy Prototype 2', '[[1,null,1,2,null,0,null],[null,null,3,1,null,null,1],[0,null,null,2,null,null,1],[1,null,null,2,3,null,0],[1,2,1,2,2,2,null],[2,2,1,3,2,2,null],[null,1,2,0,null,null,1]]'::jsonb, ARRAY['\//\\/','\/\\//','//\\//','//\\\\','//////','\\/\\\'], '{"forced_ratio":0.78,"branching_factor":1.12,"inference_depth":2,"clue_density":0.62,"structure_score":0.18,"guess_required":false}'::jsonb, 0.7630, 0.78, 1.12, 2, 0.62, 0.18, false),
  ('slant-easy-20260705-03', 'easy', 6, 'Easy Prototype 3', '[[null,1,null,1,1,1,0],[2,2,null,null,1,null,1],[null,3,2,2,2,1,null],[null,null,2,null,4,1,1],[1,2,null,2,1,null,1],[1,3,1,null,null,3,null],[null,0,null,null,1,null,1]]'::jsonb, ARRAY['//\\\\','\\\\/\','/\\\//','////\/','//////','/\///\'], '{"forced_ratio":0.69,"branching_factor":1.22,"inference_depth":3,"clue_density":0.62,"structure_score":0.27,"guess_required":false}'::jsonb, 1.0190, 0.69, 1.22, 3, 0.62, 0.27, false),
  ('slant-medium-20260705-01', 'medium', 8, 'Medium Prototype 1', '[[null,null,2,0,null,null,null,null,1],[null,null,null,2,null,3,null,null,0],[null,1,3,null,2,null,2,2,null],[null,3,1,1,3,null,2,2,2],[1,1,2,4,null,3,null,null,null],[null,3,null,1,null,null,3,null,null],[null,1,null,1,2,2,2,null,null],[null,2,null,null,null,null,1,2,1],[0,null,null,2,null,null,1,null,0]]'::jsonb, ARRAY['\/\///\/','\\\//\\\','\/\\\\\\','\\\/\///','\//\\\\\','//////\\','\/\///\/','\/\//\\/'], '{"forced_ratio":0.55,"branching_factor":1.55,"inference_depth":5,"clue_density":0.48,"structure_score":0.44,"guess_required":false}'::jsonb, 1.5665, 0.55, 1.55, 5, 0.48, 0.44, false),
  ('slant-medium-20260705-02', 'medium', 8, 'Medium Prototype 2', '[[null,null,0,null,0,null,1,1,1],[1,null,3,null,null,null,2,1,1],[null,null,null,null,2,null,null,3,0],[null,2,2,null,null,1,2,2,null],[2,null,null,null,2,3,2,2,null],[0,null,2,2,3,1,2,null,null],[1,null,null,1,2,2,null,null,null],[null,2,null,null,null,1,2,null,null],[null,1,null,null,0,null,null,null,1]]'::jsonb, ARRAY['/\/\////','/////\\/','/////\\\','///\////','\\\\/\\\','///////\','//\///\\','//\/\/\\'], '{"forced_ratio":0.49,"branching_factor":1.82,"inference_depth":6,"clue_density":0.48,"structure_score":0.53,"guess_required":false}'::jsonb, 1.8490, 0.49, 1.82, 6, 0.48, 0.53, false),
  ('slant-medium-20260705-03', 'medium', 8, 'Medium Prototype 3', '[[null,null,null,0,1,null,null,null,null],[null,null,null,3,2,null,null,null,2],[2,1,1,3,2,2,null,2,null],[null,3,2,2,null,null,null,2,1],[null,null,2,null,2,2,null,null,null],[0,4,2,null,null,1,1,null,2],[null,1,2,null,2,null,2,null,1],[null,2,2,null,null,null,null,null,0],[1,null,null,0,1,2,1,null,null]]'::jsonb, ARRAY['/\\//\\\','//\\\\\/','\//\\\\/','///\\\\/','\/////\\','/\\/\///','\\\/\\\/','///\\//\'], '{"forced_ratio":0.61,"branching_factor":1.38,"inference_depth":4,"clue_density":0.48,"structure_score":0.34,"guess_required":false}'::jsonb, 1.3025, 0.61, 1.38, 4, 0.48, 0.34, false),
  ('slant-hard-20260705-01', 'hard', 10, 'Hard Prototype 1', '[[1,0,2,null,2,0,null,null,1,0,null],[null,3,1,null,null,null,2,null,null,4,null],[null,null,2,null,null,2,null,3,null,null,null],[1,null,null,null,3,null,null,null,null,null,null],[null,3,2,null,null,null,2,null,null,null,1],[null,null,null,null,null,3,null,2,2,null,1],[null,null,3,null,4,null,null,null,null,null,1],[null,null,null,null,null,null,null,null,null,3,null],[null,null,null,null,2,null,null,3,2,1,null],[2,null,null,null,1,null,2,2,null,null,0],[0,null,1,1,null,null,null,1,null,null,null]]'::jsonb, ARRAY['\/\/\/\\\/','\\\///\//\','\\\\////\\','\\\//\\\\/','/\\\\\\\\/','/\/\/\\\\/','////\\////','//\/\/\//\','//\/\/////','\///////\\'], '{"forced_ratio":0.38,"branching_factor":2.35,"inference_depth":8,"clue_density":0.34,"structure_score":0.72,"guess_required":true}'::jsonb, 2.4820, 0.38, 2.35, 8, 0.34, 0.72, true),
  ('slant-hard-20260705-02', 'hard', 10, 'Hard Prototype 2', '[[null,null,1,0,1,null,null,null,null,null,null],[null,null,2,null,null,1,null,null,1,null,2],[2,1,1,4,null,null,null,2,1,3,null],[null,1,null,null,3,null,null,null,3,null,1],[null,3,null,2,2,null,null,null,null,null,null],[1,null,null,null,2,null,null,null,null,null,null],[null,null,1,null,null,null,null,2,null,null,null],[null,2,3,null,null,2,1,null,null,null,1],[1,2,null,null,null,null,null,null,1,2,null],[1,2,null,null,null,2,null,3,null,null,1],[null,1,null,null,null,null,null,null,2,null,null]]'::jsonb, ARRAY['\\\///\/\\','/\\/\/////','\\/\\/\\/\','\///\\\//\','////\/\\\\','//\/\/\\//','\\\/\/\\/\','//\/\//\\\','//\\\/\\//','//\\\//\//'], '{"forced_ratio":0.34,"branching_factor":2.68,"inference_depth":9,"clue_density":0.34,"structure_score":0.81,"guess_required":true}'::jsonb, 2.7715, 0.34, 2.68, 9, 0.34, 0.81, true),
  ('slant-hard-20260705-03', 'hard', 10, 'Hard Prototype 3', '[[null,1,null,null,null,null,1,null,1,null,null],[null,2,null,null,1,1,2,4,null,null,null],[0,2,null,2,null,null,null,1,null,1,null],[null,null,3,1,null,4,null,null,null,1,null],[null,null,null,null,null,null,1,null,null,3,null],[null,4,null,1,null,null,null,null,null,null,null],[null,null,null,null,2,null,null,null,2,null,null],[null,null,2,2,null,3,null,1,null,null,null],[0,null,1,2,null,1,null,null,null,3,null],[2,null,2,null,null,null,1,null,null,null,null],[null,null,null,1,0,1,null,2,0,1,null]]'::jsonb, ARRAY['\\\/\\\///','\\\\\//\/\','////\///\\','//\//\\\\/','\/\\\\////','/\\/\/\\//','////\//\//','\///\\////','/\//\/\//\','\\//\\\/\\'], '{"forced_ratio":0.42,"branching_factor":2.12,"inference_depth":8,"clue_density":0.34,"structure_score":0.65,"guess_required":true}'::jsonb, 2.4155, 0.42, 2.12, 8, 0.34, 0.65, true)
on conflict (seed) do update set
  difficulty = excluded.difficulty,
  grid_size = excluded.grid_size,
  title = excluded.title,
  clue_grid = excluded.clue_grid,
  solution_grid = excluded.solution_grid,
  metrics = excluded.metrics,
  difficulty_score = excluded.difficulty_score,
  forced_ratio = excluded.forced_ratio,
  branching_factor = excluded.branching_factor,
  inference_depth = excluded.inference_depth,
  clue_density = excluded.clue_density,
  structure_score = excluded.structure_score,
  guess_required = excluded.guess_required,
  solution_verified = true,
  active = true,
  updated_at = now();
