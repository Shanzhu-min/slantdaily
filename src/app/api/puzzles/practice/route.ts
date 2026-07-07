import {NextResponse} from 'next/server';
import {getPracticePuzzle, SupabasePuzzleError} from '@/lib/supabase-puzzles';
import type {Difficulty} from '@/lib/slant-types';

const difficulties = new Set(['easy', 'medium', 'hard']);

export async function GET(request: Request) {
  const {searchParams} = new URL(request.url);
  const difficulty = searchParams.get('difficulty') ?? 'medium';
  const offset = Number(searchParams.get('offset') ?? 0);

  if (!difficulties.has(difficulty)) {
    return NextResponse.json({error: 'Unsupported puzzle difficulty.'}, {status: 400});
  }

  try {
    const puzzle = await getPracticePuzzle(
      difficulty as Difficulty,
      searchParams.get('sessionId'),
      Number.isFinite(offset) && offset >= 0 ? Math.floor(offset) : 0
    );

    if (!puzzle) {
      return NextResponse.json({error: 'No practice puzzle was found in the puzzle bank.'}, {status: 404});
    }

    return NextResponse.json({puzzle});
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Practice puzzle request failed.';
    const status = error instanceof SupabasePuzzleError ? error.status : 500;
    return NextResponse.json({error: message}, {status});
  }
}
