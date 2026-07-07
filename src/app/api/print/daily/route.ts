import {NextResponse} from 'next/server';
import {getPrintableDailyPuzzle, SupabasePuzzleError} from '@/lib/supabase-puzzles';

export async function GET(request: Request) {
  const {searchParams} = new URL(request.url);

  try {
    const puzzle = await getPrintableDailyPuzzle(searchParams.get('sessionId'));

    if (!puzzle) {
      return NextResponse.json({error: 'No printable daily puzzle was found.'}, {status: 404});
    }

    return NextResponse.json({puzzle});
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Printable daily puzzle request failed.';
    const status = error instanceof SupabasePuzzleError ? error.status : 500;
    return NextResponse.json({error: message}, {status});
  }
}
