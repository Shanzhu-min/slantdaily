import type {CellValue, ClueGrid, ClueState} from './slant-types';
import {cellToEdge} from './slant-graph';

type ValidationResult = {
  invalidCells: number[];
  clueStates: Record<string, ClueState>;
  cluesSatisfied: boolean;
  hasErrors: boolean;
};

function vertexId(row: number, col: number, gridSize: number) {
  return row * (gridSize + 1) + col;
}

function adjacentCells(row: number, col: number, gridSize: number) {
  return [
    [row - 1, col - 1],
    [row - 1, col],
    [row, col - 1],
    [row, col]
  ]
    .filter(([cellRow, cellCol]) => cellRow >= 0 && cellCol >= 0 && cellRow < gridSize && cellCol < gridSize)
    .map(([cellRow, cellCol]) => cellRow * gridSize + cellCol);
}

function lineTouchesVertex(index: number, gridSize: number, value: CellValue, targetVertex: number) {
  const edge = cellToEdge(index, gridSize, value);
  return Boolean(edge && (edge.a === targetVertex || edge.b === targetVertex));
}

export function validateSlantBoard(
  cells: CellValue[],
  clues: ClueGrid,
  gridSize: number
): ValidationResult {
  const invalidCells = new Set<number>();
  const clueStates: Record<string, ClueState> = {};
  let visibleClues = 0;
  let satisfiedClues = 0;
  let hasErrors = false;

  clues.forEach((row, rowIndex) => {
    row.forEach((clue, colIndex) => {
      if (clue === null) {
        return;
      }

      visibleClues += 1;

      const targetVertex = vertexId(rowIndex, colIndex, gridSize);
      const adjacent = adjacentCells(rowIndex, colIndex, gridSize);
      const touchingCells = adjacent.filter((index) =>
        lineTouchesVertex(index, gridSize, cells[index], targetVertex)
      );
      const currentCount = touchingCells.length;
      const clueKey = `${rowIndex}-${colIndex}`;
      const overshot = currentCount > clue;

      if (overshot) {
        hasErrors = true;
        clueStates[clueKey] = 'error';
        touchingCells.forEach((index) => invalidCells.add(index));
        return;
      }

      if (currentCount === clue) {
        satisfiedClues += 1;
        clueStates[clueKey] = 'satisfied';
        return;
      }

      clueStates[clueKey] = 'idle';
    });
  });

  return {
    invalidCells: Array.from(invalidCells),
    clueStates,
    cluesSatisfied: visibleClues > 0 && satisfiedClues === visibleClues,
    hasErrors
  };
}
