'use client';

import {useEffect, useMemo, useState} from 'react';
import {Download} from 'lucide-react';
import {fetchPrintableDailyPuzzle, fetchPrintablePracticePuzzle} from '@/lib/puzzle-api';
import {getOrCreatePlayerSessionId} from '@/lib/client-session';
import {findConnectedComponents} from '@/lib/slant-graph';
import type {CellValue, Difficulty, SlantPuzzle} from '@/lib/slant-types';
import {SlantBoard} from './slant-board';

type PrintMode = 'today' | Difficulty;
type PaperSize = 'letter' | 'a4';

type PrintableSlantBuilderProps = {
  title: string;
  subtitle: string;
  previewTitle: string;
  initialPuzzle: SlantPuzzle | null;
};

const rules = [
  'Fill every cell with one diagonal line.',
  'Clues show how many lines touch that point.',
  'Diagonals cannot form closed loops.'
];

const printModes: Array<{label: string; value: PrintMode}> = [
  {label: 'Today', value: 'today'},
  {label: 'Easy', value: 'easy'},
  {label: 'Medium', value: 'medium'},
  {label: 'Hard', value: 'hard'}
];

function createCells(size: number): CellValue[] {
  return Array.from({length: size * size}, () => '');
}

function solutionRowsToCells(rows: string[] | undefined, size: number): CellValue[] {
  if (!rows?.length) {
    return createCells(size);
  }

  const cells = rows.flatMap((row) =>
    Array.from(row).map((value) => (value === '/' || value === '\\' ? value : '') as CellValue)
  );

  return [...cells, ...Array.from({length: size * size}, () => '' as CellValue)].slice(0, size * size);
}

function formatToday() {
  return new Intl.DateTimeFormat('en', {
    month: 'long',
    day: 'numeric',
    year: 'numeric'
  }).format(new Date());
}

function modeLabel(mode: PrintMode) {
  return mode === 'today' ? formatToday() : mode.charAt(0).toUpperCase() + mode.slice(1);
}

export function PrintableSlantBuilder({title, subtitle, previewTitle, initialPuzzle}: PrintableSlantBuilderProps) {
  const [sessionId, setSessionId] = useState('');
  const [mode, setMode] = useState<PrintMode>('today');
  const [paperSize, setPaperSize] = useState<PaperSize>('letter');
  const [includeSolutions, setIncludeSolutions] = useState(false);
  const [puzzle, setPuzzle] = useState<SlantPuzzle | null>(initialPuzzle);
  const [loading, setLoading] = useState(!initialPuzzle);
  const [error, setError] = useState('');

  const today = useMemo(() => formatToday(), []);
  const puzzleCells = useMemo(() => createCells(puzzle?.grid_size ?? 6), [puzzle]);
  const solutionCells = useMemo(
    () => solutionRowsToCells(puzzle?.solution_grid, puzzle?.grid_size ?? 6),
    [puzzle]
  );
  const solutionComponents = useMemo(
    () => (puzzle ? findConnectedComponents(solutionCells, puzzle.grid_size) : []),
    [puzzle, solutionCells]
  );

  useEffect(() => {
    setSessionId(getOrCreatePlayerSessionId());
  }, []);

  useEffect(() => {
    if (!sessionId) {
      return;
    }

    if (mode === 'today' && initialPuzzle) {
      setPuzzle(initialPuzzle);
      setLoading(false);
      setError('');
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError('');

    const request =
      mode === 'today'
        ? fetchPrintableDailyPuzzle(sessionId)
        : fetchPrintablePracticePuzzle(mode, sessionId);

    request
      .then((nextPuzzle) => {
        if (!cancelled) {
          setPuzzle(nextPuzzle);
        }
      })
      .catch((requestError) => {
        if (!cancelled) {
          const message = requestError instanceof Error ? requestError.message : 'Printable puzzle failed to load.';
          setError(message);
          setPuzzle(null);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [initialPuzzle, mode, sessionId]);

  function printPuzzle() {
    window.print();
  }

  return (
    <section className="print-layout" aria-label="Printable puzzle builder">
      <div className={`surface print-preview paper-${paperSize}`}>
        <div className="print-document">
          <PrintablePage
            dateLabel={today}
            label={previewTitle}
            loading={loading}
            puzzle={puzzle}
            cells={puzzleCells}
            rulesTitle="Rules"
          />
        </div>
      </div>

      <div className="print-settings-copy">
        <div className="print-settings-heading">
          <h1>{title}</h1>
          <p>{subtitle}</p>
          {error ? <p className="print-error">{error}</p> : null}
        </div>

        <div className="print-control-row">
          <label className="print-field">
            <span>Paper</span>
            <select
              className="print-select"
              value={paperSize}
              onChange={(event) => setPaperSize(event.target.value as PaperSize)}
            >
              <option value="letter">US Letter</option>
              <option value="a4">A4</option>
            </select>
          </label>
          <label className="solution-check">
            <input
              type="checkbox"
              checked={includeSolutions}
              onChange={(event) => setIncludeSolutions(event.target.checked)}
              aria-label="Include solution page"
            />
            <span>Solutions</span>
          </label>
        </div>

        <div className="difficulty-row" aria-label="Printable puzzle type">
          {printModes.map((item) => (
            <button
              className={`difficulty-pill ${mode === item.value ? 'active' : ''}`}
              type="button"
              onClick={() => setMode(item.value)}
              key={item.value}
            >
              {item.label}
            </button>
          ))}
        </div>

        <div className="print-action-row">
          <button className="button btn-primary print-main-button" type="button" onClick={printPuzzle} disabled={!puzzle || loading}>
            <Download size={18} aria-hidden="true" />
            Print Slant for {modeLabel(mode)}
          </button>
        </div>
      </div>

      <div className={`print-output paper-${paperSize}`} aria-hidden="true">
        <PrintablePage
          dateLabel={today}
          label={previewTitle}
          loading={false}
          puzzle={puzzle}
          cells={puzzleCells}
          rulesTitle="Rules"
        />
        {includeSolutions ? (
          <PrintablePage
            dateLabel={today}
            label={`${previewTitle} Solution`}
            loading={false}
            puzzle={puzzle}
            cells={solutionCells}
            componentColorByCell={solutionComponents}
            rulesTitle="Rules"
          />
        ) : null}
      </div>
    </section>
  );
}

function PrintablePage({
  dateLabel,
  label,
  loading,
  puzzle,
  cells,
  componentColorByCell,
  rulesTitle
}: {
  dateLabel: string;
  label: string;
  loading: boolean;
  puzzle: SlantPuzzle | null;
  cells: CellValue[];
  componentColorByCell?: Array<number | null>;
  rulesTitle: string;
}) {
  return (
    <div className="print-page">
      <div className="print-title">
        <span>{label}</span>
        <span>{dateLabel}</span>
      </div>
      <div className="print-board-wrap">
        {loading ? (
          <div className="print-loading">Preparing printable puzzle...</div>
        ) : puzzle ? (
          <SlantBoard
            gridSize={puzzle.grid_size}
            cells={cells}
            clues={puzzle.clue_grid}
            completed={false}
            invalidCells={[]}
            cycleCells={[]}
            clueStates={{}}
            componentColorByCell={componentColorByCell ?? []}
            onCellClick={() => undefined}
          />
        ) : (
          <div className="print-loading">No puzzle loaded.</div>
        )}
      </div>
      <div className="tips-box print-rules">
        <strong>{rulesTitle}</strong>
        <ul>
          {rules.map((rule) => (
            <li key={rule}>{rule}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}
