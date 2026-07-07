import {NextResponse} from 'next/server';
import {getDailyStats, SupabasePuzzleError} from '@/lib/supabase-puzzles';

const MISSING_RPC_RETRY_MS = 60 * 1000;
let missingRpcRetryAt = 0;

function defaultStats(seed: string | null) {
  return {
    seed: seed ?? '',
    players_today: 0,
    success_rate: 0
  };
}

function isMissingRpc(error: unknown) {
  return (
    error instanceof SupabasePuzzleError &&
    error.status === 404 &&
    (error.message.includes('Could not find the function') || error.message.includes('schema cache'))
  );
}

export async function GET(request: Request) {
  const {searchParams} = new URL(request.url);
  const seed = searchParams.get('seed');

  if (missingRpcRetryAt > Date.now()) {
    return NextResponse.json({stats: defaultStats(seed)});
  }

  try {
    const stats = await getDailyStats(seed);

    if (!stats) {
      return NextResponse.json({stats: defaultStats(seed)});
    }

    return NextResponse.json({stats});
  } catch (error) {
    if (isMissingRpc(error)) {
      missingRpcRetryAt = Date.now() + MISSING_RPC_RETRY_MS;
      return NextResponse.json({stats: defaultStats(seed)});
    }

    const message = error instanceof Error ? error.message : 'Puzzle stats request failed.';
    const status = error instanceof SupabasePuzzleError ? error.status : 500;
    return NextResponse.json({error: message}, {status});
  }
}
