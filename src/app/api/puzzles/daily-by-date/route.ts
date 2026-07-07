import {NextResponse} from 'next/server';
import {getDailyPuzzleByDate, SupabasePuzzleError} from '@/lib/supabase-puzzles';

export async function GET(request: Request) {
  const {searchParams} = new URL(request.url);

  try {
    const puzzle = await getDailyPuzzleByDate(searchParams.get('playedOn'), searchParams.get('sessionId'));

    if (!puzzle) {
      return NextResponse.json({error: 'No daily puzzle was found for this date.'}, {status: 404});
    }

    return NextResponse.json({puzzle});
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Archive puzzle request failed.';
    const status = error instanceof SupabasePuzzleError ? error.status : 500;
    return NextResponse.json({error: message}, {status});
  }
}
