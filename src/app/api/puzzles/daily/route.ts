import {NextResponse} from 'next/server';
import {getDailyPuzzle, secondsUntilDailyPuzzleRefresh, SupabasePuzzleError} from '@/lib/supabase-puzzles';

export async function GET() {
  try {
    const puzzle = await getDailyPuzzle();

    if (!puzzle) {
      return NextResponse.json({error: 'No daily puzzle was found in the puzzle bank.'}, {status: 404});
    }

    return NextResponse.json(
      {puzzle},
      {
        headers: {
          'Cache-Control': `public, max-age=0, s-maxage=${secondsUntilDailyPuzzleRefresh()}, must-revalidate`
        }
      }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Daily puzzle request failed.';
    const status = error instanceof SupabasePuzzleError ? error.status : 500;
    return NextResponse.json({error: message}, {status});
  }
}
