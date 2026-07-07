'use client';

import Link from 'next/link';
import {useEffect, useMemo, useRef, useState} from 'react';
import {CirclePlay} from 'lucide-react';
import {
  fetchDailyPuzzle,
  fetchDailyStats,
  fetchDailyStatus,
  fetchPracticePuzzle,
  recordDailyComplete,
  recordPracticeComplete
} from '@/lib/puzzle-api';
import {getOrCreatePlayerSessionId} from '@/lib/client-session';
import {findConnectedComponents, findCycleCells} from '@/lib/slant-graph';
import type {CellValue, Difficulty, SlantDailyStats, SlantDailyStatus, SlantPuzzle} from '@/lib/slant-types';
import {validateSlantBoard} from '@/lib/slant-validation';
import {SlantBoard} from './slant-board';

type GameMode = 'pre' | 'daily' | 'practice';
type GameStatus = 'playing' | 'completed';
type PuzzleLoadState = 'idle' | 'loading' | 'ready' | 'error';

const difficulties: Difficulty[] = ['easy', 'medium', 'hard'];
const difficultyGridSizes: Record<Difficulty, number> = {
  easy: 6,
  medium: 8,
  hard: 10
};
const DAILY_PUZZLE_CACHE_PREFIX = 'daily-slant-puzzle';

const hoverHints = {
  undo: 'Undo the last move and review the previous branch.',
  reset: 'Clear the current board and return to the starting state.',
  end: 'End the challenge and return to the daily start screen.',
  newPuzzle: 'Load another practice puzzle at the selected difficulty.',
  daily: 'Switch back to the daily challenge and start the timer.',
  archive: 'Go to the archive to review completed puzzle records.',
  practice: 'Open practice mode and play puzzles across all difficulties.'
};

const emptyValidation = {
  invalidCells: [],
  clueStates: {},
  cluesSatisfied: false,
  hasErrors: false
};

const guideSize = 4;
const guideSolutionCells: CellValue[] = [
  '\\',
  '/',
  '/',
  '/',
  '/',
  '\\',
  '/',
  '/',
  '/',
  '/',
  '/',
  '/',
  '/',
  '/',
  '/',
  '/'
];
const guideClues = [
  [1, 0, 1, 1, 1],
  [0, 4, 1, 2, 1],
  [1, 1, 3, 2, 1],
  [1, 2, 2, 2, 1],
  [1, 1, 1, 1, 0]
];
const guideRuleOneCells: CellValue[] = [
  '\\',
  '/',
  '',
  '',
  '/',
  '\\',
  '',
  '',
  '',
  '',
  '',
  '',
  '',
  '',
  '',
  ''
];
const guideLoopCells: CellValue[] = [
  '',
  '/',
  '\\',
  '',
  '',
  '\\',
  '/',
  '',
  '',
  '',
  '',
  '',
  '',
  '',
  '',
  ''
];
const guideReservedCell = {row: 4, col: 4, index: 15};
const guideAlmostCells = guideSolutionCells.map((cell, index) =>
  index === guideReservedCell.index ? '' : cell
);
const guideSteps = [
  {
    title: 'How To Play',
    body:
      'This is a completed Slant puzzle example. Your goal is to fill every cell with a diagonal line while matching all of the numerical clues.',
    button: 'Step 1',
    cells: guideSolutionCells,
    cycleCells: [],
    completed: false
  },
  {
    title: 'Rule One',
    body:
      "You need to draw a diagonal line in each cell. The number in the circle indicates how many diagonal lines connect to that circle. '0' clues tell you none of the surrounding cells connect to that circle. '4' clues tell you all four surrounding cells connect to that circle.",
    button: 'Step 2',
    cells: guideRuleOneCells,
    cycleCells: [],
    completed: false
  },
  {
    title: 'Rule Two',
    body: 'Diagonal lines cannot form a closed loop.',
    button: 'Step 3',
    cells: guideLoopCells,
    cycleCells: [1, 2, 5, 6],
    completed: false,
    suppressClueStates: true
  },
  {
    title: 'Almost There',
    body: `The game will only finish when every cell has a diagonal line. The cell at row ${guideReservedCell.row}, column ${guideReservedCell.col} has not yet been drawn.`,
    button: 'Finish',
    cells: guideAlmostCells,
    cycleCells: [],
    completed: false
  },
  {
    title: 'Finish',
    body: 'The game is complete when all cells are filled according to the clues. Congratulations!',
    button: 'Again',
    cells: guideSolutionCells,
    cycleCells: [],
    completed: true
  }
] satisfies Array<{
  title: string;
  body: string;
  button: string;
  cells: CellValue[];
  cycleCells: number[];
  completed: boolean;
  suppressClueStates?: boolean;
}>;

function createCells(size: number): CellValue[] {
  return Array.from({length: size * size}, () => '');
}

function formatElapsed(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60)
    .toString()
    .padStart(2, '0');
  const seconds = (totalSeconds % 60).toString().padStart(2, '0');
  return `${minutes}:${seconds}`;
}

function nextCellValue(value: CellValue): CellValue {
  if (value === '') {
    return '/';
  }

  if (value === '/') {
    return '\\';
  }

  return '';
}

function formatDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getDailyPuzzleCacheKey(dateKey: string) {
  return `${DAILY_PUZZLE_CACHE_PREFIX}:${dateKey}`;
}

function isDifficulty(value: unknown): value is Difficulty {
  return value === 'easy' || value === 'medium' || value === 'hard';
}

function isSlantPuzzle(value: unknown): value is SlantPuzzle {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const puzzle = value as Partial<SlantPuzzle>;

  return (
    typeof puzzle.id === 'string' &&
    typeof puzzle.seed === 'string' &&
    isDifficulty(puzzle.difficulty) &&
    typeof puzzle.grid_size === 'number' &&
    typeof puzzle.title === 'string' &&
    Array.isArray(puzzle.clue_grid)
  );
}

function readCachedDailyPuzzle(dateKey: string) {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const value = window.localStorage.getItem(getDailyPuzzleCacheKey(dateKey));
    const parsed = value ? (JSON.parse(value) as unknown) : null;
    return isSlantPuzzle(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function writeCachedDailyPuzzle(dateKey: string, puzzle: SlantPuzzle) {
  try {
    window.localStorage.setItem(getDailyPuzzleCacheKey(dateKey), JSON.stringify(puzzle));
  } catch {
    // Cache writes are optional; the puzzle still came from the database request.
  }
}

export function MockGameFrame() {
  const todayDate = useMemo(() => new Date(), []);
  const today = useMemo(
    () =>
      new Intl.DateTimeFormat('en', {
        month: 'long',
        day: 'numeric',
        year: 'numeric'
      }).format(todayDate),
    [todayDate]
  );
  const todayIso = useMemo(() => formatDateKey(todayDate), [todayDate]);
  const [sessionId, setSessionId] = useState('');
  const [mode, setMode] = useState<GameMode>('pre');
  const [status, setStatus] = useState<GameStatus>('playing');
  const [difficulty, setDifficulty] = useState<Difficulty>('medium');
  const [dailyPuzzle, setDailyPuzzle] = useState<SlantPuzzle | null>(null);
  const [dailyStats, setDailyStats] = useState<SlantDailyStats | null>(null);
  const [dailyStatus, setDailyStatus] = useState<SlantDailyStatus | null>(null);
  const [practicePuzzles, setPracticePuzzles] = useState<Record<Difficulty, SlantPuzzle | null>>({
    easy: null,
    medium: null,
    hard: null
  });
  const [practiceOffsets, setPracticeOffsets] = useState<Record<Difficulty, number>>({
    easy: 0,
    medium: 0,
    hard: 0
  });
  const [activePuzzle, setActivePuzzle] = useState<SlantPuzzle | null>(null);
  const [loadState, setLoadState] = useState<PuzzleLoadState>('idle');
  const [loadError, setLoadError] = useState('');
  const [cells, setCells] = useState<CellValue[]>(() => createCells(6));
  const [history, setHistory] = useState<CellValue[][]>([]);
  const [elapsed, setElapsed] = useState(0);
  const [mistakes, setMistakes] = useState(0);
  const [undoCount, setUndoCount] = useState(0);
  const [resetCount, setResetCount] = useState(0);
  const [hint, setHint] = useState('Puzzle bank is loading.');
  const [boardLoading, setBoardLoading] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  const [guideStep, setGuideStep] = useState(0);
  const practiceLoadId = useRef(0);

  const size = activePuzzle?.grid_size ?? (mode === 'practice' ? difficultyGridSizes[difficulty] : 6);
  const clues = activePuzzle?.clue_grid ?? [];
  const isActive = mode !== 'pre' && status === 'playing' && Boolean(activePuzzle) && !boardLoading;
  const validation = useMemo(
    () => (activePuzzle ? validateSlantBoard(cells, activePuzzle.clue_grid, activePuzzle.grid_size) : emptyValidation),
    [activePuzzle, cells]
  );
  const cycleCells = useMemo(
    () => (activePuzzle ? findCycleCells(cells, activePuzzle.grid_size) : []),
    [activePuzzle, cells]
  );
  const componentColorByCell = useMemo(
    () => (activePuzzle ? findConnectedComponents(cells, activePuzzle.grid_size) : []),
    [activePuzzle, cells]
  );
  const currentGuideStep = guideSteps[guideStep] ?? guideSteps[0];
  const guideValidation = useMemo(
    () => validateSlantBoard(currentGuideStep.cells, guideClues, guideSize),
    [currentGuideStep]
  );
  const guideComponentColorByCell = useMemo(
    () => findConnectedComponents(currentGuideStep.cells, guideSize),
    [currentGuideStep]
  );

  useEffect(() => {
    setSessionId(getOrCreatePlayerSessionId());
  }, []);

  useEffect(() => {
    if (!sessionId) {
      return;
    }

    let cancelled = false;
    const cachedPuzzle = readCachedDailyPuzzle(todayIso);

    setLoadState(cachedPuzzle ? 'ready' : 'loading');
    setLoadError('');
    setHint(cachedPuzzle ? 'Daily puzzle ready.' : 'Puzzle bank is loading.');

    if (cachedPuzzle) {
      setDailyPuzzle(cachedPuzzle);
    }

    fetchDailyPuzzle(sessionId)
      .then((puzzle) => {
        if (cancelled) {
          return;
        }

        setDailyPuzzle(puzzle);
        writeCachedDailyPuzzle(todayIso, puzzle);
        setLoadState('ready');
        setHint('Daily puzzle ready.');
      })
      .catch((error) => {
        if (cancelled) {
          return;
        }

        if (cachedPuzzle) {
          return;
        }

        const message = error instanceof Error ? error.message : 'Daily puzzle failed to load.';
        setLoadState('error');
        setLoadError(message);
        setHint(message);
      });

    return () => {
      cancelled = true;
    };
  }, [sessionId, todayIso]);

  useEffect(() => {
    if (!isActive) {
      return;
    }

    const id = window.setInterval(() => {
      setElapsed((value) => value + 1);
    }, 1000);

    return () => window.clearInterval(id);
  }, [isActive]);

  async function loadDailyStatusInBackground() {
    if (!sessionId) {
      return;
    }

    try {
      const statusResult = await fetchDailyStatus(sessionId, todayIso);
      setDailyStatus(statusResult);
    } catch {
      setDailyStatus(null);
    }
  }

  async function loadDailyStatsInBackground(puzzle: SlantPuzzle) {
    setDailyStats(null);

    try {
      const stats = await fetchDailyStats(puzzle.seed);
      setDailyStats(stats);
    } catch {
      setDailyStats(null);
    }
  }

  async function loadPractice(nextDifficulty: Difficulty, offset = practiceOffsets[nextDifficulty]) {
    if (!sessionId) {
      throw new Error('Session is not ready.');
    }

    const puzzle = await fetchPracticePuzzle(nextDifficulty, sessionId, offset);
    setPracticePuzzles((items) => ({
      ...items,
      [nextDifficulty]: puzzle
    }));
    return puzzle;
  }

  function showPracticeLoading(nextDifficulty: Difficulty, resetBoard = false) {
    setMode('practice');
    setDifficulty(nextDifficulty);
    setStatus('playing');
    setBoardLoading(true);
    setHint(`Loading ${nextDifficulty} practice puzzle...`);

    if (resetBoard || !activePuzzle) {
      setActivePuzzle(null);
      setCells(createCells(difficultyGridSizes[nextDifficulty]));
      setHistory([]);
      setElapsed(0);
    }
  }

  function startPuzzle(nextMode: Exclude<GameMode, 'pre'>, puzzle: SlantPuzzle, nextDifficulty = puzzle.difficulty) {
    const alreadyCompletedToday = nextMode === 'daily' && dailyStatus?.completed;

    if (nextMode === 'daily') {
      practiceLoadId.current += 1;
      void loadDailyStatusInBackground();
      void loadDailyStatsInBackground(puzzle);
    }

    setMode(nextMode);
    setDifficulty(nextDifficulty);
    setActivePuzzle(puzzle);
    setStatus('playing');
    setBoardLoading(false);
    setCells(createCells(puzzle.grid_size));
    setHistory([]);
    setElapsed(0);
    setMistakes(0);
    setUndoCount(0);
    setResetCount(0);
    setHint(
      alreadyCompletedToday
        ? `Puzzle ID: ${puzzle.seed} - Today's first completion has already been recorded.`
        : `Puzzle ID: ${puzzle.seed}`
    );
  }

  async function completePuzzle(completedMode: Exclude<GameMode, 'pre'>, puzzle: SlantPuzzle, moves: number) {
    setStatus('completed');
    setHint(
      completedMode === 'daily'
        ? `Puzzle ID: ${puzzle.seed} - Recording your daily result...`
        : `Puzzle ID: ${puzzle.seed} - Recording your practice result...`
    );

    try {
      if (completedMode === 'daily') {
        const result = await recordDailyComplete({
          seed: puzzle.seed,
          sessionId,
          elapsedSeconds: elapsed,
          moves,
          playedOn: todayIso,
          mistakes,
          undoCount,
          resetCount,
          hintCount: 0
        });

        setDailyStatus({
          completed: true,
          seed: puzzle.seed,
          elapsed_seconds: elapsed,
          completed_at: result.completed_at
        });
        setHint(
          result.already_completed
            ? `Puzzle ID: ${puzzle.seed} - Today's challenge was already recorded.`
            : `Puzzle ID: ${puzzle.seed} - Record saved. Today is now marked as completed.`
        );
        void fetchDailyStats(puzzle.seed)
          .then((stats) => setDailyStats(stats))
          .catch(() => undefined);
        return;
      }

      await recordPracticeComplete({
        seed: puzzle.seed,
        sessionId,
        difficulty: puzzle.difficulty,
        elapsedSeconds: elapsed,
        moves,
        mistakes,
        undoCount,
        resetCount,
        hintCount: 0
      });
      setHint(`Puzzle ID: ${puzzle.seed} - Practice record saved. Try another puzzle or return to the daily challenge.`);
    } catch {
      setHint(`Puzzle ID: ${puzzle.seed} - The puzzle is complete, but the result could not be saved.`);
    }
  }

  function handleCellClick(index: number) {
    const puzzle = activePuzzle;

    if (!isActive || !puzzle) {
      return;
    }

    setCells((current) => {
      const next = [...current];
      next[index] = nextCellValue(current[index]);
      setHistory((items) => [...items, current]);
      const nextMoveCount = history.length + 1;

      const nextValidation = validateSlantBoard(next, puzzle.clue_grid, puzzle.grid_size);
      const nextCycleCells = findCycleCells(next, puzzle.grid_size);
      const solved =
        next.every(Boolean) &&
        nextValidation.cluesSatisfied &&
        !nextValidation.hasErrors &&
        nextCycleCells.length === 0;

      if (solved) {
        void completePuzzle(mode === 'practice' ? 'practice' : 'daily', puzzle, nextMoveCount);
      } else if (nextCycleCells.length) {
        setMistakes((value) => value + 1);
        setHint(`Puzzle ID: ${puzzle.seed} - This move creates a closed chain. Review the highlighted line.`);
      } else if (nextValidation.hasErrors) {
        setMistakes((value) => value + 1);
        setHint(`Puzzle ID: ${puzzle.seed} - A clue has too many touching lines.`);
      } else {
        setHint(`Puzzle ID: ${puzzle.seed} - Move accepted. Continue tracing the chain colors.`);
      }

      return next;
    });
  }

  function undoMove() {
    if (!history.length || status === 'completed') {
      return;
    }

    const previous = history[history.length - 1];
    setCells(previous);
    setHistory((items) => items.slice(0, -1));
    setUndoCount((value) => value + 1);
    setHint(activePuzzle ? `Puzzle ID: ${activePuzzle.seed} - Last move undone.` : 'Last move undone.');
  }

  function resetCurrentPuzzle() {
    if (!activePuzzle) {
      return;
    }

    setCells(createCells(activePuzzle.grid_size));
    setHistory([]);
    setStatus('playing');
    setElapsed(0);
    setResetCount((value) => value + 1);
    setHint(`Puzzle ID: ${activePuzzle.seed} - Puzzle reset to the starting state.`);
  }

  function endChallenge() {
    practiceLoadId.current += 1;
    setMode('pre');
    setStatus('playing');
    setActivePuzzle(null);
    setBoardLoading(false);
    setCells(createCells(6));
    setHistory([]);
    setElapsed(0);
    setMistakes(0);
    setUndoCount(0);
    setResetCount(0);
    setHint(dailyPuzzle ? `Daily puzzle ready. Puzzle ID: ${dailyPuzzle.seed}` : 'Challenge ended. Start again when ready.');
  }

  async function switchPracticeDifficulty(nextDifficulty: Difficulty) {
    const requestId = practiceLoadId.current + 1;
    practiceLoadId.current = requestId;
    showPracticeLoading(nextDifficulty);

    try {
      const puzzle = practicePuzzles[nextDifficulty] ?? (await loadPractice(nextDifficulty));
      if (requestId !== practiceLoadId.current) {
        return;
      }
      startPuzzle('practice', puzzle, nextDifficulty);
    } catch (error) {
      if (requestId !== practiceLoadId.current) {
        return;
      }

      const message = error instanceof Error ? error.message : 'Practice puzzle failed to load.';
      setBoardLoading(false);
      setHint(message);
    }
  }

  async function newPracticePuzzle() {
    const nextOffset = practiceOffsets[difficulty] + 1;
    setPracticeOffsets((items) => ({
      ...items,
      [difficulty]: nextOffset
    }));

    const requestId = practiceLoadId.current + 1;
    practiceLoadId.current = requestId;
    setBoardLoading(true);
    setHint(`Loading another ${difficulty} practice puzzle...`);

    try {
      const puzzle = await loadPractice(difficulty, nextOffset);
      if (requestId !== practiceLoadId.current) {
        return;
      }
      startPuzzle('practice', puzzle, difficulty);
    } catch (error) {
      if (requestId !== practiceLoadId.current) {
        return;
      }

      const message = error instanceof Error ? error.message : 'Practice puzzle failed to load.';
      setBoardLoading(false);
      setHint(message);
    }
  }

  async function startPracticeFromPre() {
    const requestId = practiceLoadId.current + 1;
    practiceLoadId.current = requestId;
    showPracticeLoading('medium', true);

    try {
      const puzzle = practicePuzzles.medium ?? (await loadPractice('medium'));
      if (requestId !== practiceLoadId.current) {
        return;
      }
      startPuzzle('practice', puzzle, 'medium');
    } catch (error) {
      if (requestId !== practiceLoadId.current) {
        return;
      }

      const message = error instanceof Error ? error.message : 'Practice puzzle failed to load.';
      setBoardLoading(false);
      setLoadError(message);
      setHint(message);
    }
  }

  return (
    <section className="surface game-frame" aria-label="Daily Slant game">
      {mode === 'pre' ? (
        <div className="game-layer game-layer-pre">
          <div className="game-ready-panel">
            <div className="ready-visual" aria-hidden="true">
              <span className="ready-visual-title">Daily Slant</span>
              <div className="ready-board-preview">
                {Array.from({length: 16}, (_, index) => (
                  <span
                    className={[
                      'ready-preview-cell',
                      [1, 4, 6, 11, 13].includes(index) ? 'slash-forward' : '',
                      [2, 7, 8, 14].includes(index) ? 'slash-back' : ''
                    ]
                      .filter(Boolean)
                      .join(' ')}
                    key={index}
                  />
                ))}
              </div>
              <span className="ready-medal">Today</span>
            </div>
            <div className="ready-content">
              <span className="ready-kicker">Daily Challenge</span>
              <h2>Play Today</h2>
              <time className="ready-date" dateTime={todayIso}>
                {today}
              </time>
              <button
                className="button btn-primary game-start-button"
                type="button"
                disabled={!dailyPuzzle || loadState === 'loading'}
                onClick={() => dailyPuzzle && startPuzzle('daily', dailyPuzzle, dailyPuzzle.difficulty)}
              >
                Play Today
              </button>
              <button
                className="button btn-secondary ready-practice-button"
                type="button"
                disabled={loadState === 'loading'}
                onClick={() => void startPracticeFromPre()}
              >
                Practice
              </button>
            <button
              className="game-text-cta"
              type="button"
              onClick={() => {
                setGuideStep(0);
                setShowGuide(true);
              }}
            >
              How To Play
              <CirclePlay size={18} strokeWidth={2.4} aria-hidden="true" />
            </button>
            </div>
            {loadState === 'loading' || loadState === 'error' ? (
              <p className={`game-load-state ${loadState === 'error' ? 'error' : ''}`} aria-live="polite">
                {loadState === 'loading' ? 'Loading puzzle bank...' : loadError}
              </p>
            ) : null}
          </div>
        </div>
      ) : (
        <div className="game-layer game-layer-play">
          <div className="game-play-grid">
            <div className={`game-board-stage ${boardLoading ? 'loading' : ''}`}>
              <SlantBoard
                gridSize={size}
                cells={cells}
                clues={clues}
                completed={status === 'completed'}
                invalidCells={validation.invalidCells}
                cycleCells={cycleCells}
                clueStates={validation.clueStates}
                componentColorByCell={componentColorByCell}
                onCellClick={handleCellClick}
              />
              {boardLoading ? (
                <div className="game-board-loading" role="status" aria-live="polite">
                  <strong>Loading puzzle...</strong>
                  <span>Please wait. This usually takes 1-3 seconds.</span>
                </div>
              ) : null}
            </div>

            <aside className="game-side-panel" aria-label="Game status and controls">
              <div className="game-control-panel">
                <div className="game-controls">
                  {status === 'completed' && mode === 'daily' ? (
                    <>
                      <Link
                        className="button btn-primary"
                        href="/archive"
                        onMouseEnter={() => setHint(hoverHints.archive)}
                      >
                        Archive
                      </Link>
                      <button
                        className="button btn-secondary"
                        type="button"
                        onMouseEnter={() => setHint(hoverHints.practice)}
                        onClick={() => void startPracticeFromPre()}
                      >
                        Practice Mode
                      </button>
                    </>
                  ) : status === 'completed' && mode === 'practice' ? (
                    <>
                      <button className="button btn-primary" type="button" onClick={() => void newPracticePuzzle()}>
                        Another Puzzle
                      </button>
                      <button
                        className="button btn-secondary"
                        type="button"
                        onClick={() => dailyPuzzle && startPuzzle('daily', dailyPuzzle, dailyPuzzle.difficulty)}
                      >
                        Daily Challenge
                      </button>
                    </>
                  ) : mode === 'daily' ? (
                    <>
                      <button className="button btn-secondary" type="button" onMouseEnter={() => setHint(hoverHints.undo)} onClick={undoMove}>
                        Undo
                      </button>
                      <button className="button btn-secondary" type="button" onMouseEnter={() => setHint(hoverHints.reset)} onClick={resetCurrentPuzzle}>
                        Reset
                      </button>
                      <button className="button btn-primary" type="button" onMouseEnter={() => setHint(hoverHints.end)} onClick={endChallenge}>
                        End Challenge
                      </button>
                    </>
                  ) : (
                    <>
                      <button className="button btn-secondary" type="button" onMouseEnter={() => setHint(hoverHints.undo)} onClick={undoMove}>
                        Undo
                      </button>
                      <button className="button btn-secondary" type="button" onMouseEnter={() => setHint(hoverHints.reset)} onClick={resetCurrentPuzzle}>
                        Reset
                      </button>
                      <button className="button btn-secondary" type="button" onMouseEnter={() => setHint(hoverHints.newPuzzle)} onClick={() => void newPracticePuzzle()}>
                        New Puzzle
                      </button>
                      <button
                        className="button btn-primary"
                        type="button"
                        onMouseEnter={() => setHint(hoverHints.daily)}
                        onClick={() => dailyPuzzle && startPuzzle('daily', dailyPuzzle, dailyPuzzle.difficulty)}
                      >
                        Daily Challenge
                      </button>
                    </>
                  )}
                </div>
              </div>

              <div className="game-side-stats">
                <div className="game-side-card">
                  <span>Time</span>
                  <strong>{formatElapsed(elapsed)}</strong>
                </div>
                <div className="game-side-card">
                  <span>Date</span>
                  <strong>{today}</strong>
                </div>
                {mode === 'daily' ? (
                  <>
                    <div className="game-side-card">
                      <span>Players Today</span>
                      <strong>{dailyStats ? dailyStats.players_today.toLocaleString('en') : '--'}</strong>
                    </div>
                    <div className="game-side-card">
                      <span>Success Rate</span>
                      <strong>{dailyStats ? `${dailyStats.success_rate}%` : '--'}</strong>
                    </div>
                  </>
                ) : (
                  <div className="game-side-card game-difficulty-card">
                    <span>Difficulty</span>
                    <div className="game-difficulty-tabs" aria-label="Practice difficulty">
                      {difficulties.map((item) => (
                        <button
                          className={`difficulty-pill ${difficulty === item ? 'active' : ''}`}
                          type="button"
                          onClick={() => void switchPracticeDifficulty(item)}
                          key={item}
                        >
                          {item}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              <p className="game-hint" aria-live="polite">
                {hint}
              </p>
            </aside>
          </div>
        </div>
      )}

      {showGuide ? (
        <div className="guide-backdrop" role="dialog" aria-modal="true" aria-label="How to play Slant">
          <div className="guide-modal">
            <div className="guide-slant-demo" aria-hidden="true">
              <SlantBoard
                gridSize={guideSize}
                cells={currentGuideStep.cells}
                clues={guideClues}
                completed={currentGuideStep.completed}
                invalidCells={[]}
                cycleCells={currentGuideStep.cycleCells}
                clueStates={currentGuideStep.suppressClueStates ? {} : guideValidation.clueStates}
                componentColorByCell={guideComponentColorByCell}
                onCellClick={() => undefined}
              />
            </div>
            <div className="guide-copy">
              <h2>{currentGuideStep.title}</h2>
              <p>{currentGuideStep.body}</p>
              <div className="hero-actions">
                <button
                  className="button btn-primary"
                  type="button"
                  onClick={() => setGuideStep((step) => (step >= guideSteps.length - 1 ? 0 : step + 1))}
                >
                  {currentGuideStep.button}
                </button>
                <button className="button btn-secondary" type="button" onClick={() => setShowGuide(false)}>
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
