import {NextResponse} from 'next/server';
import {recordDailyComplete, SupabasePuzzleError} from '@/lib/supabase-puzzles';

function toNumber(value: unknown, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? Math.floor(number) : fallback;
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    seed?: string;
    sessionId?: string;
    elapsedSeconds?: number;
    moves?: number;
    mistakes?: number;
    undoCount?: number;
    resetCount?: number;
    hintCount?: number;
    playedOn?: string;
  } | null;

  if (!body?.seed || !body.sessionId) {
    return NextResponse.json({error: 'Puzzle seed and session are required.'}, {status: 400});
  }

  try {
    const result = await recordDailyComplete({
      seed: body.seed,
      sessionId: body.sessionId,
      elapsedSeconds: toNumber(body.elapsedSeconds),
      moves: toNumber(body.moves),
      mistakes: toNumber(body.mistakes),
      undoCount: toNumber(body.undoCount),
      resetCount: toNumber(body.resetCount),
      hintCount: toNumber(body.hintCount),
      playedOn: body.playedOn ?? null
    });

    if (!result) {
      return NextResponse.json({error: 'Daily completion could not be recorded.'}, {status: 404});
    }

    return NextResponse.json({result});
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Daily completion request failed.';
    const status = error instanceof SupabasePuzzleError ? error.status : 500;
    return NextResponse.json({error: message}, {status});
  }
}
