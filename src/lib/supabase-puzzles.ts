import type {
  Difficulty,
  SlantArchiveDay,
  SlantArchiveMonth,
  SlantArchiveMonthOption,
  SlantArchiveDayStatus,
  SlantDailyStats,
  SlantDailyStatus,
  SlantPlayerRecords,
  SlantPuzzle,
  SlantRecordResult
} from './slant-types';

export class SupabasePuzzleError extends Error {
  status: number;

  constructor(message: string, status = 500) {
    super(message);
    this.status = status;
  }
}

const fallbackSeeds: Record<Difficulty, string[]> = {
  easy: ['slant-easy-20260705-01', 'slant-easy-20260705-02', 'slant-easy-20260705-03'],
  medium: ['slant-medium-20260705-01', 'slant-medium-20260705-02', 'slant-medium-20260705-03'],
  hard: ['slant-hard-20260705-01', 'slant-hard-20260705-02', 'slant-hard-20260705-03']
};
const dailyFallbackSeeds = [...fallbackSeeds.medium, ...fallbackSeeds.hard];

const DAILY_PUZZLE_CACHE_TTL_MS = 5 * 60 * 1000;
let dailyPuzzleCache: {cacheDate: string; expiresAt: number; puzzle: SlantPuzzle} | null = null;
let dailyPuzzleInflight: Promise<SlantPuzzle | null> | null = null;

function currentUtcDateKey() {
  return new Date().toISOString().slice(0, 10);
}

function supabaseConfig() {
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey =
    process.env.SUPABASE_ANON_KEY ??
    process.env.SUPABASE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new SupabasePuzzleError('Supabase environment variables are not configured.', 503);
  }

  return {
    url: url.replace(/\/$/, ''),
    anonKey
  };
}

async function callRpc<T>(functionName: string, payload: Record<string, unknown>) {
  const {url, anonKey} = supabaseConfig();
  const response = await fetch(`${url}/rest/v1/rpc/${functionName}`, {
    method: 'POST',
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${anonKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload),
    cache: 'no-store'
  });
  const text = await response.text();
  const json = text ? (JSON.parse(text) as unknown) : null;

  if (!response.ok) {
    const errorMessage =
      typeof json === 'object' && json && 'message' in json && typeof json.message === 'string'
        ? json.message
        : text || 'Supabase puzzle request failed.';
    throw new SupabasePuzzleError(errorMessage, response.status);
  }

  return json as T;
}

function normalizePuzzle(data: unknown): SlantPuzzle | null {
  const row = Array.isArray(data) ? data[0] : data;

  if (!row || typeof row !== 'object') {
    return null;
  }

  const puzzle = row as SlantPuzzle;

  if (!puzzle.id || !puzzle.seed || !Array.isArray(puzzle.clue_grid)) {
    return null;
  }

  return puzzle;
}

function normalizeStats(data: unknown): SlantDailyStats | null {
  const row = Array.isArray(data) ? data[0] : data;

  if (!row || typeof row !== 'object') {
    return null;
  }

  const stats = row as SlantDailyStats;

  if (!stats.seed) {
    return null;
  }

  return {
    seed: stats.seed,
    players_today: Number(stats.players_today ?? 0),
    success_rate: Number(stats.success_rate ?? 0)
  };
}

function normalizeDailyStatus(data: unknown): SlantDailyStatus | null {
  const row = Array.isArray(data) ? data[0] : data;

  if (!row || typeof row !== 'object') {
    return null;
  }

  const status = row as Partial<SlantDailyStatus>;

  return {
    completed: Boolean(status.completed),
    seed: typeof status.seed === 'string' ? status.seed : null,
    elapsed_seconds:
      status.elapsed_seconds === null || status.elapsed_seconds === undefined
        ? null
        : Number(status.elapsed_seconds),
    completed_at: typeof status.completed_at === 'string' ? status.completed_at : null
  };
}

function normalizeRecordResult(data: unknown): SlantRecordResult | null {
  const row = Array.isArray(data) ? data[0] : data;

  if (!row || typeof row !== 'object') {
    return null;
  }

  const result = row as Partial<SlantRecordResult>;

  return {
    recorded: Boolean(result.recorded),
    already_completed: Boolean(result.already_completed),
    completed_at: typeof result.completed_at === 'string' ? result.completed_at : null
  };
}

function normalizePlayerRecords(data: unknown): SlantPlayerRecords | null {
  const row = Array.isArray(data) ? data[0] : data;

  if (!row || typeof row !== 'object') {
    return null;
  }

  const records = row as Partial<SlantPlayerRecords>;

  return {
    total_completed: Number(records.total_completed ?? records.challenges_completed ?? 0),
    daily_completed: Number(records.daily_completed ?? records.challenges_completed ?? 0),
    challenges_completed: Number(records.challenges_completed ?? records.daily_completed ?? 0),
    practice_completed: Number(records.practice_completed ?? records.practice_runs ?? 0),
    easy_completed: Number(records.easy_completed ?? 0),
    medium_completed: Number(records.medium_completed ?? 0),
    hard_completed: Number(records.hard_completed ?? 0),
    perfect_runs: Number(records.perfect_runs ?? 0),
    current_streak_days: Number(records.current_streak_days ?? 0),
    best_time_seconds:
      records.best_time_seconds === null || records.best_time_seconds === undefined
        ? null
        : Number(records.best_time_seconds),
    best_day: typeof records.best_day === 'string' ? records.best_day : null,
    practice_runs: Number(records.practice_runs ?? records.practice_completed ?? 0),
    first_played_at: typeof records.first_played_at === 'string' ? records.first_played_at : null,
    last_completed_at: typeof records.last_completed_at === 'string' ? records.last_completed_at : null,
    longest_streak_days: Number(records.longest_streak_days ?? 0)
  };
}

function isDifficulty(value: unknown): value is Difficulty {
  return value === 'easy' || value === 'medium' || value === 'hard';
}

function isArchiveStatus(value: unknown): value is SlantArchiveDayStatus {
  return value === 'no_puzzle' || value === 'unfinished' || value === 'completed';
}

function isMissingRpcSignature(error: unknown) {
  return (
    error instanceof SupabasePuzzleError &&
    error.status === 404 &&
    (error.message.includes('Could not find the function') || error.message.includes('schema cache'))
  );
}

function normalizeArchiveMonths(data: unknown): SlantArchiveMonthOption[] {
  const rows = Array.isArray(data) ? data : [];

  return rows
    .map((row) => {
      if (!row || typeof row !== 'object') {
        return null;
      }

      const item = row as Partial<SlantArchiveMonthOption>;
      const year = Number(item.year);
      const month = Number(item.month);

      return Number.isFinite(year) && Number.isFinite(month)
        ? {year, month}
        : null;
    })
    .filter((row): row is SlantArchiveMonthOption => Boolean(row));
}

function normalizeArchiveDays(data: unknown): {year: number; month: number; days: SlantArchiveDay[]} | null {
  const rows = Array.isArray(data) ? data : [];

  if (!rows.length) {
    return null;
  }

  const first = rows[0] as {year?: unknown; month?: unknown};
  const year = Number(first.year);
  const month = Number(first.month);

  if (!Number.isFinite(year) || !Number.isFinite(month)) {
    return null;
  }

  return {
    year,
    month,
    days: rows
      .map((row) => {
        if (!row || typeof row !== 'object') {
          return null;
        }

        const item = row as {
          puzzle_date?: unknown;
          day?: unknown;
          seed?: unknown;
          difficulty?: unknown;
          status?: unknown;
        };
        const day = Number(item.day);
        const status = isArchiveStatus(item.status) ? item.status : 'no_puzzle';

        if (typeof item.puzzle_date !== 'string' || !Number.isFinite(day)) {
          return null;
        }

        return {
          date: item.puzzle_date,
          day,
          seed: typeof item.seed === 'string' ? item.seed : null,
          difficulty: isDifficulty(item.difficulty) ? item.difficulty : null,
          status
        };
      })
      .filter((row): row is SlantArchiveDay => Boolean(row))
  };
}

function buildEmptyArchiveMonth(year: number, month: number, months: SlantArchiveMonthOption[] = []): SlantArchiveMonth {
  const daysInMonth = new Date(year, month, 0).getDate();
  const days: SlantArchiveDay[] = Array.from({length: daysInMonth}, (_, index) => {
    const day = index + 1;
    return {
      date: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
      day,
      seed: null,
      difficulty: null,
      status: 'no_puzzle'
    };
  });

  return {year, month, months, days};
}

async function getPuzzleBySeed(seed: string, sessionId: string | null) {
  const data = await callRpc<unknown>('get_slant_puzzle_by_seed', {
    p_seed: seed,
    p_session_id: sessionId
  });
  return normalizePuzzle(data);
}

function recordCachedDailyLoad(puzzle: SlantPuzzle, sessionId: string | null) {
  if (!sessionId) {
    return;
  }

  void getPuzzleBySeed(puzzle.seed, sessionId).catch(() => undefined);
}

async function readDailyPuzzleFromDatabase(sessionId: string | null) {
  try {
    const data = await callRpc<unknown>('get_slant_daily_puzzle', {
      p_session_id: sessionId
    });
    const puzzle = normalizePuzzle(data);

    if (puzzle) {
      return puzzle;
    }
  } catch (error) {
    if (error instanceof SupabasePuzzleError && error.status === 503) {
      throw error;
    }

    if (!isMissingRpcSignature(error)) {
      throw error;
    }
  }

  const index = new Date().getUTCDate() % dailyFallbackSeeds.length;
  return getPuzzleBySeed(dailyFallbackSeeds[index], sessionId);
}

export async function getDailyPuzzle(sessionId: string | null) {
  const now = Date.now();
  const cacheDate = currentUtcDateKey();

  if (dailyPuzzleCache && dailyPuzzleCache.cacheDate === cacheDate && dailyPuzzleCache.expiresAt > now) {
    recordCachedDailyLoad(dailyPuzzleCache.puzzle, sessionId);
    return dailyPuzzleCache.puzzle;
  }

  if (dailyPuzzleInflight) {
    const puzzle = await dailyPuzzleInflight;

    if (puzzle) {
      recordCachedDailyLoad(puzzle, sessionId);
    }

    return puzzle;
  }

  dailyPuzzleInflight = readDailyPuzzleFromDatabase(sessionId)
    .then((puzzle) => {
      if (puzzle) {
        dailyPuzzleCache = {
          cacheDate,
          expiresAt: Date.now() + DAILY_PUZZLE_CACHE_TTL_MS,
          puzzle
        };
      }

      return puzzle;
    })
    .finally(() => {
      dailyPuzzleInflight = null;
    });

  return dailyPuzzleInflight;
}

export async function getPrintableDailyPuzzle(sessionId: string | null) {
  try {
    const data = await callRpc<unknown>('get_slant_print_daily_puzzle', {
      p_session_id: sessionId
    });
    const puzzle = normalizePuzzle(data);

    if (puzzle) {
      return puzzle;
    }
  } catch (error) {
    if (error instanceof SupabasePuzzleError && error.status === 503) {
      throw error;
    }

    if (!isMissingRpcSignature(error)) {
      throw error;
    }
  }

  return getDailyPuzzle(sessionId);
}

export async function getPracticePuzzle(
  difficulty: Difficulty,
  sessionId: string | null,
  offset: number
) {
  try {
    const data = await callRpc<unknown>('get_slant_puzzle_by_difficulty', {
      p_difficulty: difficulty,
      p_session_id: sessionId,
      p_offset: offset
    });
    const puzzle = normalizePuzzle(data);

    if (puzzle) {
      return puzzle;
    }
  } catch (error) {
    if (error instanceof SupabasePuzzleError && error.status === 503) {
      throw error;
    }
  }

  const seeds = fallbackSeeds[difficulty];
  return getPuzzleBySeed(seeds[offset % seeds.length], sessionId);
}

export async function getPrintablePracticePuzzle(
  difficulty: Difficulty,
  sessionId: string | null,
  offset: number
) {
  try {
    const data = await callRpc<unknown>('get_slant_print_puzzle_by_difficulty', {
      p_difficulty: difficulty,
      p_session_id: sessionId,
      p_offset: offset
    });
    const puzzle = normalizePuzzle(data);

    if (puzzle) {
      return puzzle;
    }
  } catch (error) {
    if (error instanceof SupabasePuzzleError && error.status === 503) {
      throw error;
    }
  }

  return getPracticePuzzle(difficulty, sessionId, offset);
}

export async function getDailyStats(seed: string | null) {
  const data = await callRpc<unknown>('get_slant_daily_stats', {
    p_seed: seed
  });
  return normalizeStats(data);
}

export async function getArchiveMonth(input: {
  sessionId: string | null;
  year: number | null;
  month: number | null;
}) {
  let months: SlantArchiveMonthOption[] = [];

  try {
    months = normalizeArchiveMonths(await callRpc<unknown>('get_slant_archive_months', {}));
    const selected = input.year && input.month ? {year: input.year, month: input.month} : months[0] ?? null;
    const data = await callRpc<unknown>('get_slant_archive_month', {
      p_session_id: input.sessionId,
      p_year: selected?.year ?? null,
      p_month: selected?.month ?? null
    });
    const archive = normalizeArchiveDays(data);

    if (archive) {
      return {...archive, months};
    }
  } catch (error) {
    if (error instanceof SupabasePuzzleError && error.status === 503) {
      throw error;
    }
  }

  const now = new Date();
  return buildEmptyArchiveMonth(input.year ?? now.getFullYear(), input.month ?? now.getMonth() + 1, months);
}

export async function getDailyPuzzleByDate(playedOn: string | null, sessionId: string | null) {
  if (!playedOn) {
    throw new SupabasePuzzleError('Archive puzzle date is required.', 400);
  }

  const data = await callRpc<unknown>('get_slant_daily_puzzle_by_date', {
    p_played_on: playedOn,
    p_session_id: sessionId
  });
  return normalizePuzzle(data);
}

export async function getDailyStatus(sessionId: string | null, playedOn: string | null) {
  if (!sessionId) {
    throw new SupabasePuzzleError('Session is required for daily status.', 400);
  }

  const data = await callRpc<unknown>('get_slant_daily_status', {
    p_session_id: sessionId,
    p_played_on: playedOn
  });
  return normalizeDailyStatus(data);
}

export async function recordDailyComplete(input: {
  seed: string;
  sessionId: string | null;
  elapsedSeconds: number;
  moves: number;
  playedOn: string | null;
  mistakes?: number;
  undoCount?: number;
  resetCount?: number;
  hintCount?: number;
}) {
  if (!input.sessionId) {
    throw new SupabasePuzzleError('Session is required for daily completion.', 400);
  }

  const payload = {
    p_seed: input.seed,
    p_session_id: input.sessionId,
    p_elapsed_seconds: input.elapsedSeconds,
    p_moves: input.moves,
    p_played_on: input.playedOn
  };
  let data: unknown;

  try {
    data = await callRpc<unknown>('record_slant_daily_complete', {
      ...payload,
      p_mistakes: input.mistakes ?? 0,
      p_undo_count: input.undoCount ?? 0,
      p_reset_count: input.resetCount ?? 0,
      p_hint_count: input.hintCount ?? 0
    });
  } catch (error) {
    if (!isMissingRpcSignature(error)) {
      throw error;
    }

    data = await callRpc<unknown>('record_slant_daily_complete', payload);
  }

  return normalizeRecordResult(data);
}

export async function recordPracticeComplete(input: {
  seed: string;
  sessionId: string | null;
  difficulty: Difficulty;
  elapsedSeconds: number;
  moves: number;
  mistakes?: number;
  undoCount?: number;
  resetCount?: number;
  hintCount?: number;
}) {
  if (!input.sessionId) {
    throw new SupabasePuzzleError('Session is required for practice completion.', 400);
  }

  const payload = {
    p_seed: input.seed,
    p_session_id: input.sessionId,
    p_difficulty: input.difficulty,
    p_elapsed_seconds: input.elapsedSeconds,
    p_moves: input.moves
  };
  let data: unknown;

  try {
    data = await callRpc<unknown>('record_slant_practice_complete', {
      ...payload,
      p_mistakes: input.mistakes ?? 0,
      p_undo_count: input.undoCount ?? 0,
      p_reset_count: input.resetCount ?? 0,
      p_hint_count: input.hintCount ?? 0
    });
  } catch (error) {
    if (!isMissingRpcSignature(error)) {
      throw error;
    }

    data = await callRpc<unknown>('record_slant_practice_complete', payload);
  }

  return normalizeRecordResult(data);
}

export async function getPlayerRecords(sessionId: string | null) {
  if (!sessionId) {
    throw new SupabasePuzzleError('Session is required for player records.', 400);
  }

  const data = await callRpc<unknown>('get_slant_player_records', {
    p_session_id: sessionId
  });
  return normalizePlayerRecords(data);
}
