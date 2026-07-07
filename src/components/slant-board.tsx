import type {CSSProperties} from 'react';
import type {CellValue, ClueGrid, ClueState} from '@/lib/slant-types';

type SlantBoardProps = {
  gridSize: number;
  cells: CellValue[];
  clues: ClueGrid;
  completed: boolean;
  invalidCells: number[];
  cycleCells: number[];
  clueStates: Record<string, ClueState>;
  componentColorByCell: Array<number | null>;
  onCellClick: (index: number) => void;
};

function cellLine(index: number, gridSize: number, value: CellValue) {
  if (!value) {
    return null;
  }

  const row = Math.floor(index / gridSize);
  const col = index % gridSize;

  if (value === '/') {
    return {
      x1: col,
      y1: row + 1,
      x2: col + 1,
      y2: row
    };
  }

  return {
    x1: col,
    y1: row,
    x2: col + 1,
    y2: row + 1
  };
}

export function SlantBoard({
  gridSize,
  cells,
  clues,
  completed,
  invalidCells,
  cycleCells,
  clueStates,
  componentColorByCell,
  onCellClick
}: SlantBoardProps) {
  const invalidCellSet = new Set(invalidCells);
  const cycleCellSet = new Set(cycleCells);
  const totalCells = cells.length;
  const lineSegments = cells.flatMap((value, index) => {
    const line = cellLine(index, gridSize, value);

    if (!line) {
      return [];
    }

    return [
      {
        ...line,
        cellIndex: index,
        componentId: componentColorByCell[index],
        cycle: cycleCellSet.has(index)
      }
    ];
  });

  return (
    <div
      className={`slant-board svg-lines size-${gridSize} ${completed ? 'completed' : ''}`}
      style={{'--slant-size': gridSize} as CSSProperties}
      aria-label="Slant puzzle board"
    >
      <div className="slant-cell-layer">
        {cells.map((value, index) => {
          const componentId = componentColorByCell[index];

          return (
            <button
              className={[
                'slant-cell',
                value === '/' ? 'slash-forward' : '',
                value === '\\' ? 'slash-back' : '',
                typeof componentId === 'number' ? `component-${componentId % 6}` : '',
                invalidCellSet.has(index) ? 'invalid-cell' : '',
                cycleCellSet.has(index) ? 'cycle-cell' : ''
              ]
                .filter(Boolean)
                .join(' ')}
              type="button"
              disabled={completed}
              onClick={() => onCellClick(index)}
              key={index}
              style={
                completed
                  ? ({
                      '--flip-delay': `${totalCells <= 1 ? 0 : (index / (totalCells - 1)) * 1400}ms`
                    } as CSSProperties)
                  : undefined
              }
              aria-label={`Cell ${index + 1}`}
            />
          );
        })}
      </div>
      <svg
        className="slant-line-layer"
        viewBox={`0 0 ${gridSize} ${gridSize}`}
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <g className="slant-line-outlines">
          {lineSegments.map((line) => (
            <line
              x1={line.x1}
              y1={line.y1}
              x2={line.x2}
              y2={line.y2}
              key={`outline-${line.cellIndex}`}
            />
          ))}
        </g>
        <g className="slant-line-colors">
          {lineSegments.map((line) => (
            <line
              className={[
                typeof line.componentId === 'number' ? `component-${line.componentId % 6}` : 'component-0',
                line.cycle ? 'cycle-line' : ''
              ]
                .filter(Boolean)
                .join(' ')}
              x1={line.x1}
              y1={line.y1}
              x2={line.x2}
              y2={line.y2}
              key={`color-${line.cellIndex}`}
            />
          ))}
        </g>
      </svg>
      <div className="slant-clue-layer" aria-hidden="true">
        {clues.flatMap((row, rowIndex) =>
          row.map((clue, colIndex) => {
            if (clue === null) {
              return null;
            }

            const state = clueStates[`${rowIndex}-${colIndex}`] ?? 'idle';

            return (
              <span
                className={`slant-clue ${state}`}
                style={{
                  left: `${(colIndex / gridSize) * 100}%`,
                  top: `${(rowIndex / gridSize) * 100}%`
                }}
                key={`${rowIndex}-${colIndex}`}
              >
                {clue}
              </span>
            );
          })
        )}
      </div>
      {completed ? <div className="confetti" aria-hidden="true" /> : null}
    </div>
  );
}
