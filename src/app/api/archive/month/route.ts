import {NextResponse} from 'next/server';
import {getArchiveMonth, SupabasePuzzleError} from '@/lib/supabase-puzzles';

function toNumber(value: string | null) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.floor(number) : null;
}

export async function GET(request: Request) {
  const {searchParams} = new URL(request.url);

  try {
    const archive = await getArchiveMonth({
      sessionId: searchParams.get('sessionId'),
      year: toNumber(searchParams.get('year')),
      month: toNumber(searchParams.get('month'))
    });

    return NextResponse.json({archive});
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Archive request failed.';
    const status = error instanceof SupabasePuzzleError ? error.status : 500;
    return NextResponse.json({error: message}, {status});
  }
}
