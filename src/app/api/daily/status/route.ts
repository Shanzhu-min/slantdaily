import {NextResponse} from 'next/server';
import {getDailyStatus, SupabasePuzzleError} from '@/lib/supabase-puzzles';

const defaultStatus = {
  completed: false,
  seed: null,
  elapsed_seconds: null,
  completed_at: null
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
    return NextResponse.json({status: defaultStatus});
  }

  try {
    const status = await getDailyStatus(searchParams.get('sessionId'), searchParams.get('playedOn'));

    if (!status) {
      return NextResponse.json({status: defaultStatus});
    }

    return NextResponse.json({status});
  } catch (error) {
    if (isMissingRpc(error)) {
      missingRpcRetryAt = Date.now() + MISSING_RPC_RETRY_MS;
      return NextResponse.json({status: defaultStatus});
    }

    const message = error instanceof Error ? error.message : 'Daily status request failed.';
    const status = error instanceof SupabasePuzzleError ? error.status : 500;
    return NextResponse.json({error: message}, {status});
  }
}
