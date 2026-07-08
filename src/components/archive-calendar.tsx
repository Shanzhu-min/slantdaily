'use client';

import {useEffect, useMemo, useState} from 'react';
import {
  fetchArchiveMonth,
  fetchDailyPuzzleByDate,
  recordDailyComplete
} from '@/lib/puzzle-api';
import {getOrCreatePlayerSessionId} from '@/lib/client-session';
import {findConnectedComponents, findCycleCells} from '@/lib/slant-graph';
import type {CellValue, SlantArchiveDay, SlantArchiveMonth, SlantPuzzle} from '@/lib/slant-types';
import {validateSlantBoard} from '@/lib/slant-validation';
import {SlantBoard} from './slant-board';

const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const emptyValidation = {
  invalidCells: [],
  clueStates: {},
  cluesSatisfied: false,
  hasErrors: false
};

function createCells(size: number): CellValue[] {
  return Array.from({length: size * size}, () => '');
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

function formatElapsed(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60).toString().padStart(2, '0');
  const seconds = (totalSeconds % 60).toString().padStart(2, '0');
  return `${minutes}:${seconds}`;
}

function formatMonthName(month: number) {
  return new Intl.DateTimeFormat('en', {month: 'long'}).format(new Date(2026, month - 1, 1));
}

function formatDateLabel(dateKey: string) {
  const [year, month, day] = dateKey.split('-').map(Number);
  return new Intl.DateTimeFormat('en', {
    month: 'long',
    day: 'numeric',
    year: 'numeric'
  }).format(new Date(year, month - 1, day));
}

function buildCalendarCells(days: SlantArchiveDay[]) {
  const firstDate = days[0]?.date;
  const leading = firstDate ? new Date(`${firstDate}T00:00:00`).getDay() : 0;
  return [...Array.from({length: leading}, () => null), ...days];
}

export function ArchiveCalendar({initialArchive}: {initialArchive: SlantArchiveMonth | null}) {
  const [sessionId, setSessionId] = useState('');
  const [archive, setArchive] = useState<SlantArchiveMonth | null>(initialArchive);
  const [archiveLoading, setArchiveLoading] = useState(!initialArchive);
  const [archiveError, setArchiveError] = useState('');
  const [selectedDay, setSelectedDay] = useState<SlantArchiveDay | null>(null);
  const [selectedPuzzle, setSelectedPuzzle] = useState<SlantPuzzle | null>(null);
  const [boardLoading, setBoardLoading] = useState(false);
  const [cells, setCells] = useState<CellValue[]>(() => createCells(6));
  const [history, setHistory] = useState<CellValue[][]>([]);
  const [elapsed, setElapsed] = useState(0);
  const [mistakes, setMistakes] = useState(0);
  const [undoCount, setUndoCount] = useState(0);
  const [resetCount, setResetCount] = useState(0);
  const [completed, setCompleted] = useState(false);
  const [hint, setHint] = useState('Select an unfinished or completed date to play.');

  const validation = useMemo(
    () =>
      selectedPuzzle
        ? validateSlantBoard(cells, selectedPuzzle.clue_grid, selectedPuzzle.grid_size)
        : emptyValidation,
    [cells, selectedPuzzle]
  );
  const cycleCells = useMemo(
    () => (selectedPuzzle ? findCycleCells(cells, selectedPuzzle.grid_size) : []),
    [cells, selectedPuzzle]
  );
  const componentColorByCell = useMemo(
    () => (selectedPuzzle ? findConnectedComponents(cells, selectedPuzzle.grid_size) : []),
    [cells, selectedPuzzle]
  );
  const monthCells = useMemo(() => buildCalendarCells(archive?.days ?? []), [archive]);
  const years = useMemo(
    () => Array.from(new Set((archive?.months ?? []).map((item) => item.year))),
    [archive]
  );
  const monthOptions = useMemo(
    () => (archive ? archive.months.filter((item) => item.year === archive.year) : []),
    [archive]
  );

  useEffect(() => {
    setSessionId(getOrCreatePlayerSessionId());
  }, []);

  useEffect(() => {
    if (!sessionId) {
      return;
    }

    if (initialArchive) {
      void loadArchiveMonth(initialArchive.year, initialArchive.month, false);
      return;
    }

    void loadArchiveMonth();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  useEffect(() => {
    if (!selectedPuzzle || completed || boardLoading) {
      return;
    }

    const id = window.setInterval(() => setElapsed((value) => value + 1), 1000);
    return () => window.clearInterval(id);
  }, [boardLoading, completed, selectedPuzzle]);

  async function loadArchiveMonth(year?: number, month?: number, showLoading = true) {
    if (showLoading) {
      setArchiveLoading(true);
    }
    setArchiveError('');

    try {
      const nextArchive = await fetchArchiveMonth({sessionId, year, month});
      setArchive(nextArchive);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Archive failed to load.';
      setArchiveError(message);
    } finally {
      if (showLoading) {
        setArchiveLoading(false);
      }
    }
  }

  async function selectDay(day: SlantArchiveDay) {
    if (day.status === 'no_puzzle') {
      return;
    }

    setSelectedDay(day);
    setSelectedPuzzle(null);
    setCells(createCells(6));
    setHistory([]);
    setElapsed(0);
    setMistakes(0);
    setUndoCount(0);
    setResetCount(0);
    setCompleted(false);
    setBoardLoading(true);
    setHint(`Preparing the ${formatDateLabel(day.date)} puzzle...`);

    try {
      const puzzle = await fetchDailyPuzzleByDate(day.date, sessionId);
      setSelectedPuzzle(puzzle);
      setCells(createCells(puzzle.grid_size));
      setHint(
        day.status === 'completed'
          ? 'This challenge is already completed. You can replay it, but the result will not be recorded.'
          : 'Archive puzzle loaded. Complete it to record this date.'
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Archive puzzle failed to load.';
      setHint(message);
    } finally {
      setBoardLoading(false);
    }
  }

  async function completeArchivePuzzle(puzzle: SlantPuzzle, moves: number) {
    setCompleted(true);

    if (!selectedDay) {
      return;
    }

    if (selectedDay.status === 'completed') {
      setHint('Replay complete. This date was already recorded, so no new result was saved.');
      return;
    }

    setHint('Recording archive result...');

    try {
      await recordDailyComplete({
        seed: puzzle.seed,
        sessionId,
        elapsedSeconds: elapsed,
        moves,
        playedOn: selectedDay.date,
        mistakes,
        undoCount,
        resetCount,
        hintCount: 0
      });
      setHint('Result saved. This archive date is now marked as completed.');
      setSelectedDay({...selectedDay, status: 'completed'});
      setArchive((current) =>
        current
          ? {
              ...current,
              days: current.days.map((day) =>
                day.date === selectedDay.date ? {...day, status: 'completed'} : day
              )
            }
          : current
      );
    } catch {
      setHint('Puzzle complete, but the result could not be saved.');
    }
  }

  function handleCellClick(index: number) {
    if (!selectedPuzzle || completed || boardLoading) {
      return;
    }

    setCells((current) => {
      const next = [...current];
      next[index] = nextCellValue(current[index]);
      setHistory((items) => [...items, current]);

      const nextValidation = validateSlantBoard(next, selectedPuzzle.clue_grid, selectedPuzzle.grid_size);
      const nextCycleCells = findCycleCells(next, selectedPuzzle.grid_size);
      const solved =
        next.every(Boolean) &&
        nextValidation.cluesSatisfied &&
        !nextValidation.hasErrors &&
        nextCycleCells.length === 0;

      if (solved) {
        void completeArchivePuzzle(selectedPuzzle, history.length + 1);
      } else if (nextCycleCells.length) {
        setMistakes((value) => value + 1);
        setHint('This move creates a closed chain. Review the highlighted line.');
      } else if (nextValidation.hasErrors) {
        setMistakes((value) => value + 1);
        setHint('A clue has too many touching lines.');
      } else {
        setHint('Move accepted.');
      }

      return next;
    });
  }

  function resetSelectedPuzzle() {
    if (!selectedPuzzle || !selectedDay) {
      return;
    }

    setCells(createCells(selectedPuzzle.grid_size));
    setHistory([]);
    setElapsed(0);
    setCompleted(false);
    setResetCount((value) => value + 1);
    setHint(
      selectedDay.status === 'completed'
        ? 'Replay reset. This date is already recorded.'
        : 'Puzzle reset. Complete it to record this date.'
    );
  }

  function undoMove() {
    if (!history.length || completed) {
      return;
    }

    setCells(history[history.length - 1]);
    setHistory((items) => items.slice(0, -1));
    setUndoCount((value) => value + 1);
    setHint('Last move undone.');
  }

  function closePuzzleModal() {
    setSelectedDay(null);
    setSelectedPuzzle(null);
    setBoardLoading(false);
    setCells(createCells(6));
    setHistory([]);
    setElapsed(0);
    setMistakes(0);
    setUndoCount(0);
    setResetCount(0);
    setCompleted(false);
    setHint('Select an unfinished or completed date to play.');
  }

  return (
    <>
      <section className="surface calendar-shell" aria-label="Puzzle archive calendar">
        <div className="calendar-toolbar">
          <div>
            <h2>{archive ? `${formatMonthName(archive.month)} ${archive.year}` : 'Archive'}</h2>
            <p>Choose a playable date to replay a previous Daily Slant puzzle.</p>
          </div>
          <div className="select-row">
            <select
              aria-label="Year"
              disabled={!archive || !years.length}
              value={archive?.year ?? ''}
              onChange={(event) => {
                const year = Number(event.target.value);
                const month = archive?.months.find((item) => item.year === year)?.month ?? archive?.month;
                void loadArchiveMonth(year, month);
              }}
            >
              {years.length ? years.map((year) => <option key={year}>{year}</option>) : <option>--</option>}
            </select>
            <select
              aria-label="Month"
              disabled={!archive || !monthOptions.length}
              value={archive?.month ?? ''}
              onChange={(event) => archive && void loadArchiveMonth(archive.year, Number(event.target.value))}
            >
              {monthOptions.length ? (
                monthOptions.map((item) => (
                  <option value={item.month} key={`${item.year}-${item.month}`}>
                    {formatMonthName(item.month)}
                  </option>
                ))
              ) : (
                <option>--</option>
              )}
            </select>
          </div>
        </div>

        {archiveError ? <p className="calendar-message error">{archiveError}</p> : null}
        {archiveLoading ? <p className="calendar-message">Preparing the archive calendar...</p> : null}

        <div className="calendar-grid">
          {weekdays.map((day) => (
            <div className="weekday" key={day}>
              {day}
            </div>
          ))}
          {monthCells.map((day, index) =>
            day ? (
              <button
                className={`calendar-day ${day.status}`}
                disabled={day.status === 'no_puzzle'}
                key={day.date}
                type="button"
                onClick={() => void selectDay(day)}
              >
                <span>{day.day}</span>
              </button>
            ) : (
              <span className="calendar-day no_puzzle empty" aria-hidden="true" key={`empty-${index}`} />
            )
          )}
        </div>
        <div className="calendar-legend" aria-label="Calendar status legend">
          <span><i className="legend-dot no-puzzle" />No puzzle</span>
          <span><i className="legend-dot unfinished" />Unfinished</span>
          <span><i className="legend-dot completed" />Completed</span>
        </div>
      </section>

      {selectedDay ? (
        <div className="archive-modal-backdrop" role="dialog" aria-modal="true" aria-label="Archive daily challenge">
          <section className="surface archive-player archive-player-modal" aria-label="Selected archive puzzle">
            <div className="archive-player-header">
              <div>
                <span>{selectedDay.status === 'completed' ? 'Replay Mode' : 'Archive Challenge'}</span>
                <h2>{formatDateLabel(selectedDay.date)}</h2>
              </div>
              <div className="archive-player-actions">
                <strong>{formatElapsed(elapsed)}</strong>
                <button className="button btn-secondary archive-close-button" type="button" onClick={closePuzzleModal}>
                  Close
                </button>
              </div>
            </div>

            <div className="archive-modal-body">
              <div className={`game-board-stage archive-board-stage ${boardLoading ? 'loading' : ''}`}>
                {selectedPuzzle ? (
                  <SlantBoard
                    gridSize={selectedPuzzle.grid_size}
                    cells={cells}
                    clues={selectedPuzzle.clue_grid}
                    completed={completed}
                    invalidCells={validation.invalidCells}
                    cycleCells={cycleCells}
                    clueStates={validation.clueStates}
                    componentColorByCell={componentColorByCell}
                    onCellClick={handleCellClick}
                  />
                ) : (
                  <div className="archive-empty-board">Preparing archive puzzle.</div>
                )}
                {boardLoading ? (
                  <div className="game-board-loading" role="status" aria-live="polite">
                    <strong>Preparing puzzle...</strong>
                    <span>Please wait. This usually takes 1-3 seconds.</span>
                  </div>
                ) : null}
              </div>

              <aside className="archive-modal-panel">
                <div className="game-side-card">
                  <span>Date</span>
                  <strong>{formatDateLabel(selectedDay.date)}</strong>
                </div>
                <div className="game-side-card">
                  <span>Status</span>
                  <strong>{selectedDay.status === 'completed' ? 'Completed Replay' : 'Unfinished'}</strong>
                </div>
                <div className="game-side-card">
                  <span>Time</span>
                  <strong>{formatElapsed(elapsed)}</strong>
                </div>
                <div className="archive-player-controls">
                  <button className="button btn-secondary" type="button" onClick={undoMove} disabled={!selectedPuzzle || completed}>
                    Undo
                  </button>
                  <button className="button btn-secondary" type="button" onClick={resetSelectedPuzzle} disabled={!selectedPuzzle}>
                    Reset
                  </button>
                  <button className="button btn-primary" type="button" onClick={closePuzzleModal}>
                    Close
                  </button>
                </div>
                <p className="game-hint" aria-live="polite">{hint}</p>
              </aside>
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
}
