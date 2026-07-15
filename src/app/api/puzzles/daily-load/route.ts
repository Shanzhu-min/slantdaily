import {NextResponse} from 'next/server';
import {recordDailyPuzzleLoad, SupabasePuzzleError} from '@/lib/supabase-puzzles';

export async function POST(request: Request) {
  let input: {seed?: unknown; sessionId?: unknown};

  try {
    input = (await request.json()) as {seed?: unknown; sessionId?: unknown};
  } catch {
    return NextResponse.json({error: 'Daily load payload is invalid.'}, {status: 400});
  }

  const seed = typeof input.seed === 'string' ? input.seed : null;
  const sessionId = typeof input.sessionId === 'string' ? input.sessionId : null;

  if (!seed || !sessionId) {
    return NextResponse.json({error: 'Puzzle seed and session are required.'}, {status: 400});
  }

  try {
    await recordDailyPuzzleLoad(seed, sessionId);
    return NextResponse.json({recorded: true});
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Daily load record failed.';
    const status = error instanceof SupabasePuzzleError ? error.status : 500;
    return NextResponse.json({error: message}, {status});
  }
}
