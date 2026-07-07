import type {
  Difficulty,
  SlantArchiveMonth,
  SlantDailyStats,
  SlantDailyStatus,
  SlantPlayerRecords,
  SlantPuzzle,
  SlantRecordResult
} from './slant-types';

async function readPuzzleResponse(response: Response) {
  const data = (await response.json()) as {puzzle?: SlantPuzzle; error?: string};

  if (!response.ok || !data.puzzle) {
    throw new Error(data.error ?? 'Puzzle request failed.');
  }

  return data.puzzle;
}

export async function fetchDailyPuzzle(sessionId: string) {
  const response = await fetch(`/api/puzzles/daily?sessionId=${encodeURIComponent(sessionId)}`, {
    cache: 'no-store'
  });
  return readPuzzleResponse(response);
}

export async function fetchPrintableDailyPuzzle(sessionId: string) {
  const response = await fetch(`/api/print/daily?sessionId=${encodeURIComponent(sessionId)}`, {
    cache: 'no-store'
  });
  return readPuzzleResponse(response);
}

export async function fetchPrintablePracticePuzzle(
  difficulty: Difficulty,
  sessionId: string,
  offset = 0
) {
  const params = new URLSearchParams({
    difficulty,
    sessionId,
    offset: String(offset)
  });
  const response = await fetch(`/api/print/practice?${params.toString()}`, {
    cache: 'no-store'
  });
  return readPuzzleResponse(response);
}

export async function fetchDailyPuzzleByDate(playedOn: string, sessionId: string) {
  const params = new URLSearchParams({
    playedOn,
    sessionId
  });
  const response = await fetch(`/api/puzzles/daily-by-date?${params.toString()}`, {
    cache: 'no-store'
  });
  return readPuzzleResponse(response);
}

export async function fetchArchiveMonth(input: {
  sessionId: string;
  year?: number | null;
  month?: number | null;
}) {
  const params = new URLSearchParams({
    sessionId: input.sessionId
  });

  if (input.year && input.month) {
    params.set('year', String(input.year));
    params.set('month', String(input.month));
  }

  const response = await fetch(`/api/archive/month?${params.toString()}`, {
    cache: 'no-store'
  });
  const data = (await response.json()) as {archive?: SlantArchiveMonth; error?: string};

  if (!response.ok || !data.archive) {
    throw new Error(data.error ?? 'Archive request failed.');
  }

  return data.archive;
}

export async function fetchPracticePuzzle(
  difficulty: Difficulty,
  sessionId: string,
  offset = 0
) {
  const params = new URLSearchParams({
    difficulty,
    sessionId,
    offset: String(offset)
  });
  const response = await fetch(`/api/puzzles/practice?${params.toString()}`, {
    cache: 'no-store'
  });
  return readPuzzleResponse(response);
}

export async function fetchDailyStats(seed: string) {
  const response = await fetch(`/api/puzzles/stats?seed=${encodeURIComponent(seed)}`, {
    cache: 'no-store'
  });
  const data = (await response.json()) as {stats?: SlantDailyStats; error?: string};

  if (!response.ok || !data.stats) {
    throw new Error(data.error ?? 'Puzzle stats request failed.');
  }

  return data.stats;
}

export async function fetchDailyStatus(sessionId: string, playedOn: string) {
  const params = new URLSearchParams({
    sessionId,
    playedOn
  });
  const response = await fetch(`/api/daily/status?${params.toString()}`, {
    cache: 'no-store'
  });
  const data = (await response.json()) as {status?: SlantDailyStatus; error?: string};

  if (!response.ok || !data.status) {
    throw new Error(data.error ?? 'Daily status request failed.');
  }

  return data.status;
}

export async function fetchPlayerRecords(sessionId: string) {
  const response = await fetch(`/api/achievements/records?sessionId=${encodeURIComponent(sessionId)}`, {
    cache: 'no-store'
  });
  const data = (await response.json()) as {records?: SlantPlayerRecords; error?: string};

  if (!response.ok || !data.records) {
    throw new Error(data.error ?? 'Player records request failed.');
  }

  return data.records;
}

export async function recordDailyComplete(input: {
  seed: string;
  sessionId: string;
  elapsedSeconds: number;
  moves: number;
  playedOn: string;
  mistakes?: number;
  undoCount?: number;
  resetCount?: number;
  hintCount?: number;
}) {
  const response = await fetch('/api/daily/complete', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify(input),
    cache: 'no-store'
  });
  const data = (await response.json()) as {result?: SlantRecordResult; error?: string};

  if (!response.ok || !data.result) {
    throw new Error(data.error ?? 'Daily completion request failed.');
  }

  return data.result;
}

export async function recordPracticeComplete(input: {
  seed: string;
  sessionId: string;
  difficulty: Difficulty;
  elapsedSeconds: number;
  moves: number;
  mistakes?: number;
  undoCount?: number;
  resetCount?: number;
  hintCount?: number;
}) {
  const response = await fetch('/api/practice/complete', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify(input),
    cache: 'no-store'
  });
  const data = (await response.json()) as {result?: SlantRecordResult; error?: string};

  if (!response.ok || !data.result) {
    throw new Error(data.error ?? 'Practice completion request failed.');
  }

  return data.result;
}
