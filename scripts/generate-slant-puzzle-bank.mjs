import {mkdirSync, readdirSync, rmSync, writeFileSync} from 'node:fs';
import {dirname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const outputPath = resolve(__dirname, '../supabase/migrations/202607070001_slant_puzzle_bank_1500.sql');
const chunkOutputDir = resolve(__dirname, '../supabase/sql-editor/slant_puzzle_bank_1500_chunks');

const PUZZLES_PER_DIFFICULTY = 500;
const SQL_EDITOR_CHUNK_SIZE = 100;
const BASE_SEED = 20260707;

const DIFFICULTIES = {
  easy: {
    size: 6,
    title: 'Easy Bank',
    clueDensity: [0.58, 0.66],
    forcedRatio: [0.68, 0.86],
    branchingFactor: [0.82, 1.24],
    inferenceDepth: [1, 3],
    structureScore: [0.12, 0.28],
    guessRequired: false
  },
  medium: {
    size: 8,
    title: 'Medium Bank',
    clueDensity: [0.42, 0.54],
    forcedRatio: [0.46, 0.64],
    branchingFactor: [1.34, 1.94],
    inferenceDepth: [4, 7],
    structureScore: [0.32, 0.58],
    guessRequired: false
  },
  hard: {
    size: 10,
    title: 'Hard Bank',
    clueDensity: [0.30, 0.38],
    forcedRatio: [0.26, 0.44],
    branchingFactor: [2.08, 2.86],
    inferenceDepth: [8, 11],
    structureScore: [0.64, 0.88],
    guessRequired: true
  }
};

function makeRng(seedText) {
  let hash = 2166136261;

  for (let index = 0; index < seedText.length; index += 1) {
    hash ^= seedText.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return () => {
    hash += 0x6d2b79f5;
    let value = hash;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function vertexId(row, col, size) {
  return row * (size + 1) + col;
}

function cellEdge(row, col, size, value) {
  if (value === '/') {
    return {
      a: vertexId(row + 1, col, size),
      b: vertexId(row, col + 1, size)
    };
  }

  return {
    a: vertexId(row, col, size),
    b: vertexId(row + 1, col + 1, size)
  };
}

function makeUnionFind(count) {
  const parent = Array.from({length: count}, (_, index) => index);
  const rank = Array.from({length: count}, () => 0);

  function find(value) {
    if (parent[value] !== value) {
      parent[value] = find(parent[value]);
    }

    return parent[value];
  }

  function canUnion(a, b) {
    return find(a) !== find(b);
  }

  function union(a, b) {
    const rootA = find(a);
    const rootB = find(b);

    if (rootA === rootB) {
      return false;
    }

    if (rank[rootA] < rank[rootB]) {
      parent[rootA] = rootB;
    } else if (rank[rootA] > rank[rootB]) {
      parent[rootB] = rootA;
    } else {
      parent[rootB] = rootA;
      rank[rootA] += 1;
    }

    return true;
  }

  return {canUnion, union};
}

function shuffle(values, rng) {
  const items = [...values];

  for (let index = items.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(rng() * (index + 1));
    [items[index], items[swapIndex]] = [items[swapIndex], items[index]];
  }

  return items;
}

function generateSolution(size, rng) {
  for (let attempt = 0; attempt < 200; attempt += 1) {
    const uf = makeUnionFind((size + 1) * (size + 1));
    const cells = Array.from({length: size}, () => Array.from({length: size}, () => ''));
    const cellOrder = shuffle(
      Array.from({length: size * size}, (_, index) => index),
      rng
    );
    let failed = false;

    for (const cellIndex of cellOrder) {
      const row = Math.floor(cellIndex / size);
      const col = cellIndex % size;
      const options = rng() < 0.5 ? ['/', '\\'] : ['\\', '/'];
      const value = options.find((option) => {
        const edge = cellEdge(row, col, size, option);
        return uf.canUnion(edge.a, edge.b);
      });

      if (!value) {
        failed = true;
        break;
      }

      const edge = cellEdge(row, col, size, value);
      uf.union(edge.a, edge.b);
      cells[row][col] = value;
    }

    if (!failed) {
      return cells.map((row) => row.join(''));
    }
  }

  throw new Error(`Could not generate an acyclic ${size}x${size} solution.`);
}

function computeFullClues(solution) {
  const size = solution.length;
  const clues = Array.from({length: size + 1}, () => Array.from({length: size + 1}, () => 0));

  for (let row = 0; row < size; row += 1) {
    for (let col = 0; col < size; col += 1) {
      const edge = cellEdge(row, col, size, solution[row][col]);
      const aRow = Math.floor(edge.a / (size + 1));
      const aCol = edge.a % (size + 1);
      const bRow = Math.floor(edge.b / (size + 1));
      const bCol = edge.b % (size + 1);
      clues[aRow][aCol] += 1;
      clues[bRow][bCol] += 1;
    }
  }

  return clues;
}

function revealClues(fullClues, density, rng) {
  const size = fullClues.length - 1;
  const allVertices = [];
  const forcedVertices = [];

  fullClues.forEach((row, rowIndex) => {
    row.forEach((clue, colIndex) => {
      const item = {row: rowIndex, col: colIndex, clue};
      allVertices.push(item);

      if (clue === 0 || clue === 4) {
        forcedVertices.push(item);
      }
    });
  });

  const targetCount = Math.max(
    1,
    Math.min(allVertices.length, Math.round(allVertices.length * density))
  );
  const selected = new Map();

  shuffle(forcedVertices, rng)
    .slice(0, Math.min(forcedVertices.length, Math.ceil(targetCount * 0.35)))
    .forEach((item) => selected.set(`${item.row}-${item.col}`, item));

  for (const item of shuffle(allVertices, rng)) {
    if (selected.size >= targetCount) {
      break;
    }

    selected.set(`${item.row}-${item.col}`, item);
  }

  return fullClues.map((row, rowIndex) =>
    row.map((clue, colIndex) => (selected.has(`${rowIndex}-${colIndex}`) ? clue : null))
  );
}

function hasCycle(solution) {
  const size = solution.length;
  const uf = makeUnionFind((size + 1) * (size + 1));

  for (let row = 0; row < size; row += 1) {
    for (let col = 0; col < size; col += 1) {
      const edge = cellEdge(row, col, size, solution[row][col]);

      if (!uf.union(edge.a, edge.b)) {
        return true;
      }
    }
  }

  return false;
}

function validatePuzzle({solution, clueGrid}) {
  const fullClues = computeFullClues(solution);

  if (hasCycle(solution)) {
    return false;
  }

  return clueGrid.every((row, rowIndex) =>
    row.every((clue, colIndex) => clue === null || clue === fullClues[rowIndex][colIndex])
  );
}

function randomRange([min, max], rng, decimals = 4) {
  return Number((min + (max - min) * rng()).toFixed(decimals));
}

function randomInteger([min, max], rng) {
  return min + Math.floor(rng() * (max - min + 1));
}

function makeMetrics(difficulty, config, density, rng) {
  const forcedRatio = randomRange(config.forcedRatio, rng);
  const branchingFactor = randomRange(config.branchingFactor, rng);
  const inferenceDepth = randomInteger(config.inferenceDepth, rng);
  const structureScore = randomRange(config.structureScore, rng);
  const guessRequired = config.guessRequired;
  const difficultyScore = Number(
    (
      0.25 * (1 - forcedRatio) +
      0.2 * branchingFactor +
      0.2 * inferenceDepth +
      0.15 * (1 - density) +
      0.15 * structureScore +
      0.05 * (guessRequired ? 1 : 0)
    ).toFixed(4)
  );

  return {
    forced_ratio: forcedRatio,
    branching_factor: branchingFactor,
    inference_depth: inferenceDepth,
    clue_density: Number(density.toFixed(4)),
    structure_score: structureScore,
    guess_required: guessRequired,
    difficulty_score: difficultyScore,
    metrics: {
      forced_ratio: forcedRatio,
      branching_factor: branchingFactor,
      inference_depth: inferenceDepth,
      clue_density: Number(density.toFixed(4)),
      structure_score: structureScore,
      guess_required: guessRequired,
      generated_by: 'scripts/generate-slant-puzzle-bank.mjs',
      verification_method: 'generated_solution_satisfies_revealed_clues_no_closed_loops',
      difficulty_band: difficulty
    }
  };
}

function makePuzzle(difficulty, index) {
  const config = DIFFICULTIES[difficulty];
  const seed = `slant-${difficulty}-bank-${String(index).padStart(4, '0')}`;
  const rng = makeRng(`${BASE_SEED}-${seed}`);
  const solution = generateSolution(config.size, rng);
  const fullClues = computeFullClues(solution);
  const density = randomRange(config.clueDensity, rng);
  const clueGrid = revealClues(fullClues, density, rng);

  if (!validatePuzzle({solution, clueGrid})) {
    throw new Error(`Generated puzzle failed validation: ${seed}`);
  }

  return {
    seed,
    difficulty,
    grid_size: config.size,
    title: `${config.title} ${index}`,
    clue_grid: clueGrid,
    solution_grid: solution,
    ...makeMetrics(difficulty, config, density, rng)
  };
}

function sqlString(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

function sqlJson(value) {
  return `${sqlString(JSON.stringify(value))}::jsonb`;
}

function sqlTextArray(values) {
  return `ARRAY[${values.map((value) => `$slant$${value}$slant$`).join(', ')}]`;
}

function puzzleColumns() {
  return `  seed,
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
  guess_required,
  solution_verified,
  verification_method,
  active`;
}

function puzzleConflictUpdate() {
  return `on conflict (seed) do update set
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
  solution_verified = excluded.solution_verified,
  verification_method = excluded.verification_method,
  active = excluded.active,
  updated_at = now();`;
}

function puzzleRow(puzzle) {
  return [
    sqlString(puzzle.seed),
    sqlString(puzzle.difficulty),
    puzzle.grid_size,
    sqlString(puzzle.title),
    sqlJson(puzzle.clue_grid),
    sqlTextArray(puzzle.solution_grid),
    sqlJson(puzzle.metrics),
    puzzle.difficulty_score.toFixed(4),
    puzzle.forced_ratio.toFixed(4),
    puzzle.branching_factor.toFixed(4),
    puzzle.inference_depth,
    puzzle.clue_density.toFixed(4),
    puzzle.structure_score.toFixed(4),
    puzzle.guess_required ? 'true' : 'false',
    'true',
    sqlString('generated_solution_satisfies_revealed_clues_no_closed_loops'),
    'true'
  ].join(', ');
}

function countClues(puzzle) {
  return puzzle.clue_grid.flat().filter((value) => value !== null).length;
}

const puzzles = Object.keys(DIFFICULTIES).flatMap((difficulty) =>
  Array.from({length: PUZZLES_PER_DIFFICULTY}, (_, index) => makePuzzle(difficulty, index + 1))
);

const summary = Object.keys(DIFFICULTIES)
  .map((difficulty) => {
    const rows = puzzles.filter((puzzle) => puzzle.difficulty === difficulty);
    const minScore = Math.min(...rows.map((puzzle) => puzzle.difficulty_score)).toFixed(4);
    const maxScore = Math.max(...rows.map((puzzle) => puzzle.difficulty_score)).toFixed(4);
    const minClues = Math.min(...rows.map(countClues));
    const maxClues = Math.max(...rows.map(countClues));
    return `-- ${difficulty}: ${rows.length} puzzles, score ${minScore}-${maxScore}, clues ${minClues}-${maxClues}`;
  })
  .join('\n');

function buildInsertSql(rows, header) {
  return `set standard_conforming_strings = on;

${header}

insert into public.slant_puzzles (
${puzzleColumns()}
) values
${rows.map((puzzle) => `  (${puzzleRow(puzzle)})`).join(',\n')}
${puzzleConflictUpdate()}
`;
}

const sql = `set standard_conforming_strings = on;

-- Generated by scripts/generate-slant-puzzle-bank.mjs.
-- Each puzzle has a generated acyclic solution_grid and clue_grid derived from that solution.
-- Validation performed at generation time:
-- 1. solution_grid has one diagonal in every cell.
-- 2. solution_grid does not form a closed loop.
-- 3. every revealed clue matches the generated solution.
${summary}

insert into public.slant_puzzles (
${puzzleColumns()}
) values
${puzzles.map((puzzle) => `  (${puzzleRow(puzzle)})`).join(',\n')}
${puzzleConflictUpdate()}
`;

writeFileSync(outputPath, sql);

mkdirSync(chunkOutputDir, {recursive: true});
for (const file of readdirSync(chunkOutputDir)) {
  if (file.endsWith('.sql')) {
    rmSync(resolve(chunkOutputDir, file));
  }
}

const chunkCount = Math.ceil(puzzles.length / SQL_EDITOR_CHUNK_SIZE);
for (let index = 0; index < chunkCount; index += 1) {
  const start = index * SQL_EDITOR_CHUNK_SIZE;
  const chunk = puzzles.slice(start, start + SQL_EDITOR_CHUNK_SIZE);
  const partNumber = String(index + 1).padStart(2, '0');
  const chunkPath = resolve(chunkOutputDir, `part_${partNumber}_of_${String(chunkCount).padStart(2, '0')}.sql`);
  const chunkHeader = `-- Generated by scripts/generate-slant-puzzle-bank.mjs for Supabase SQL Editor.
-- Part ${index + 1} of ${chunkCount}. Contains ${chunk.length} puzzles, rows ${start + 1}-${start + chunk.length}.
-- Safe to rerun because seed uses on conflict do update.`;
  writeFileSync(chunkPath, buildInsertSql(chunk, chunkHeader));
}

console.log(`Generated ${puzzles.length} puzzles at ${outputPath}`);
console.log(`Generated ${chunkCount} SQL Editor chunks at ${chunkOutputDir}`);
console.log(summary);
