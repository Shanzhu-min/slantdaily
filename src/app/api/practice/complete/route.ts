import {NextResponse} from 'next/server';
import {recordPracticeComplete, SupabasePuzzleError} from '@/lib/supabase-puzzles';
import type {Difficulty} from '@/lib/slant-types';

const difficulties = new Set(['easy', 'medium', 'hard']);

function toNumber(value: unknown, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? Math.floor(number) : fallback;
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    seed?: string;
    sessionId?: string;
    difficulty?: string;
    elapsedSeconds?: number;
    moves?: number;
    mistakes?: number;
    undoCount?: number;
    resetCount?: number;
    hintCount?: number;
  } | null;

  if (!body?.seed || !body.sessionId) {
    return NextResponse.json({error: 'Puzzle seed and session are required.'}, {status: 400});
  }

  if (!body.difficulty || !difficulties.has(body.difficulty)) {
    return NextResponse.json({error: 'Unsupported puzzle difficulty.'}, {status: 400});
  }

  try {
    const result = await recordPracticeComplete({
      seed: body.seed,
      sessionId: body.sessionId,
      difficulty: body.difficulty as Difficulty,
      elapsedSeconds: toNumber(body.elapsedSeconds),
      moves: toNumber(body.moves),
      mistakes: toNumber(body.mistakes),
      undoCount: toNumber(body.undoCount),
      resetCount: toNumber(body.resetCount),
      hintCount: toNumber(body.hintCount)
    });

    if (!result) {
      return NextResponse.json({error: 'Practice completion could not be recorded.'}, {status: 404});
    }

    return NextResponse.json({result});
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Practice completion request failed.';
    const status = error instanceof SupabasePuzzleError ? error.status : 500;
    return NextResponse.json({error: message}, {status});
  }
}
