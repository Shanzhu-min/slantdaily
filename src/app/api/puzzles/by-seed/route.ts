import {NextResponse} from 'next/server';
import {SupabasePuzzleError} from '@/lib/supabase-puzzles';

async function readPuzzleBySeed(seed: string, sessionId: string | null) {
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey =
    process.env.SUPABASE_ANON_KEY ??
    process.env.SUPABASE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new SupabasePuzzleError('Supabase environment variables are not configured.', 503);
  }

  const response = await fetch(`${url.replace(/\/$/, '')}/rest/v1/rpc/get_slant_puzzle_by_seed`, {
    method: 'POST',
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${anonKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      p_seed: seed,
      p_session_id: sessionId
    }),
    cache: 'no-store'
  });
  const data = (await response.json()) as unknown;

  if (!response.ok) {
    throw new SupabasePuzzleError('Puzzle seed request failed.', response.status);
  }

  return Array.isArray(data) ? data[0] : data;
}

export async function GET(request: Request) {
  const {searchParams} = new URL(request.url);
  const seed = searchParams.get('seed');

  if (!seed) {
    return NextResponse.json({error: 'Puzzle seed is required.'}, {status: 400});
  }

  try {
    const puzzle = await readPuzzleBySeed(seed, searchParams.get('sessionId'));

    if (!puzzle) {
      return NextResponse.json({error: 'No puzzle was found for that seed.'}, {status: 404});
    }

    return NextResponse.json({puzzle});
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Puzzle seed request failed.';
    const status = error instanceof SupabasePuzzleError ? error.status : 500;
    return NextResponse.json({error: message}, {status});
  }
}
