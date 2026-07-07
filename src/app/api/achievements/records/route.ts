import {NextResponse} from 'next/server';
import {getPlayerRecords, SupabasePuzzleError} from '@/lib/supabase-puzzles';

const defaultRecords = {
  total_completed: 0,
  daily_completed: 0,
  challenges_completed: 0,
  practice_completed: 0,
  easy_completed: 0,
  medium_completed: 0,
  hard_completed: 0,
  perfect_runs: 0,
  current_streak_days: 0,
  best_time_seconds: null,
  best_day: null,
  practice_runs: 0,
  first_played_at: null,
  last_completed_at: null,
  longest_streak_days: 0
};
const MISSING_RPC_RETRY_MS = 60 * 1000;
let missingRpcRetryAt = 0;

function isMissingRpc(error: unknown) {
  return (
    error instanceof SupabasePuzzleError &&
    error.status === 404 &&
    (error.message.includes('Could not find the function') || error.message.includes('schema cache'))
  );
}

export async function GET(request: Request) {
  const {searchParams} = new URL(request.url);

  if (missingRpcRetryAt > Date.now()) {
    return NextResponse.json({records: defaultRecords});
  }

  try {
    const records = await getPlayerRecords(searchParams.get('sessionId'));

    if (!records) {
      return NextResponse.json({records: defaultRecords});
    }

    return NextResponse.json({records});
  } catch (error) {
    if (isMissingRpc(error)) {
      missingRpcRetryAt = Date.now() + MISSING_RPC_RETRY_MS;
      return NextResponse.json({records: defaultRecords});
    }

    const message = error instanceof Error ? error.message : 'Player records request failed.';
    const status = error instanceof SupabasePuzzleError ? error.status : 500;
    return NextResponse.json({error: message}, {status});
  }
}
