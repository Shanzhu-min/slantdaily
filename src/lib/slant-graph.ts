import type {CellValue} from './slant-types';

type Edge = {
  cellIndex: number;
  a: number;
  b: number;
};

type AdjacentEdge = {
  to: number;
  cellIndex: number;
};

function vertexId(row: number, col: number, gridSize: number) {
  return row * (gridSize + 1) + col;
}

export function cellToEdge(index: number, gridSize: number, value: CellValue): Edge | null {
  if (!value) {
    return null;
  }

  const row = Math.floor(index / gridSize);
  const col = index % gridSize;

  if (value === '/') {
    return {
      cellIndex: index,
      a: vertexId(row + 1, col, gridSize),
      b: vertexId(row, col + 1, gridSize)
    };
  }

  return {
    cellIndex: index,
    a: vertexId(row, col, gridSize),
    b: vertexId(row + 1, col + 1, gridSize)
  };
}

export function buildSlantEdges(cells: CellValue[], gridSize: number) {
  return cells.flatMap((value, index) => {
    const edge = cellToEdge(index, gridSize, value);
    return edge ? [edge] : [];
  });
}

export function findConnectedComponents(cells: CellValue[], gridSize: number): Array<number | null> {
  const totalVertices = (gridSize + 1) * (gridSize + 1);
  const parent = Array.from({length: totalVertices}, (_, index) => index);
  const rank = Array.from({length: totalVertices}, () => 0);
  const edges = buildSlantEdges(cells, gridSize);

  function find(value: number): number {
    if (parent[value] !== value) {
      parent[value] = find(parent[value]);
    }

    return parent[value];
  }

  function union(a: number, b: number) {
    const rootA = find(a);
    const rootB = find(b);

    if (rootA === rootB) {
      return;
    }

    if (rank[rootA] < rank[rootB]) {
      parent[rootA] = rootB;
    } else if (rank[rootA] > rank[rootB]) {
      parent[rootB] = rootA;
    } else {
      parent[rootB] = rootA;
      rank[rootA] += 1;
    }
  }

  edges.forEach((edge) => union(edge.a, edge.b));

  const componentIds = new Map<number, number>();
  const componentByCell: Array<number | null> = Array.from({length: cells.length}, () => null);

  edges.forEach((edge) => {
    const root = find(edge.a);
    let componentId = componentIds.get(root);

    if (componentId === undefined) {
      componentId = componentIds.size;
      componentIds.set(root, componentId);
    }

    componentByCell[edge.cellIndex] = componentId;
  });

  return componentByCell;
}

function findPathCells(
  adjacency: Map<number, AdjacentEdge[]>,
  start: number,
  end: number
) {
  const queue = [start];
  const visited = new Set([start]);
  const previous = new Map<number, {vertex: number; cellIndex: number}>();

  while (queue.length) {
    const current = queue.shift();

    if (current === undefined) {
      break;
    }

    if (current === end) {
      break;
    }

    for (const edge of adjacency.get(current) ?? []) {
      if (visited.has(edge.to)) {
        continue;
      }

      visited.add(edge.to);
      previous.set(edge.to, {vertex: current, cellIndex: edge.cellIndex});
      queue.push(edge.to);
    }
  }

  if (!visited.has(end)) {
    return [];
  }

  const pathCells: number[] = [];
  let cursor = end;

  while (cursor !== start) {
    const step = previous.get(cursor);

    if (!step) {
      return [];
    }

    pathCells.push(step.cellIndex);
    cursor = step.vertex;
  }

  return pathCells;
}

export function findCycleCells(cells: CellValue[], gridSize: number) {
  const adjacency = new Map<number, AdjacentEdge[]>();
  const cycleCells = new Set<number>();

  function addEdge(edge: Edge) {
    const fromA = adjacency.get(edge.a) ?? [];
    const fromB = adjacency.get(edge.b) ?? [];
    fromA.push({to: edge.b, cellIndex: edge.cellIndex});
    fromB.push({to: edge.a, cellIndex: edge.cellIndex});
    adjacency.set(edge.a, fromA);
    adjacency.set(edge.b, fromB);
  }

  buildSlantEdges(cells, gridSize).forEach((edge) => {
    const pathCells = findPathCells(adjacency, edge.a, edge.b);

    if (pathCells.length) {
      cycleCells.add(edge.cellIndex);
      pathCells.forEach((cellIndex) => cycleCells.add(cellIndex));
    }

    addEdge(edge);
  });

  return Array.from(cycleCells);
}
