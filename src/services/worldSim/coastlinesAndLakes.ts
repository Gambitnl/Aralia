/**
 * @file coastlinesAndLakes.ts
 * Polygon extraction for coastlines (boundary of land) and lakes (interior water).
 *
 * Coastlines: marching squares at the sea-level threshold over the heightmap.
 * Lakes: water cells (height < SEA_LEVEL) NOT connected to the map border via
 * 4-neighbor flood-fill. The ocean is classified first; everything else that
 * is water becomes a lake.
 */
import type { Polygon } from './types';
import { extractPolygons } from './marchingSquares';
import { SEA_LEVEL } from './constants';

export function extractCoastlines(heights: number[], cols: number, rows: number): Polygon[] {
  const at = (x: number, y: number) => heights[y * cols + x] ?? 0;
  return extractPolygons(at, cols, rows, SEA_LEVEL);
}

export function extractLakes(heights: number[], cols: number, rows: number): Polygon[] {
  const isWater = (x: number, y: number) => (heights[y * cols + x] ?? 0) < SEA_LEVEL;
  const ocean = new Uint8Array(cols * rows);
  const queue: number[] = [];
  const push = (x: number, y: number) => {
    if (x < 0 || y < 0 || x >= cols || y >= rows) return;
    const i = y * cols + x;
    if (ocean[i] || !isWater(x, y)) return;
    ocean[i] = 1;
    queue.push(i);
  };

  // Seed ocean from every border cell that is water.
  for (let x = 0; x < cols; x++) {
    push(x, 0);
    push(x, rows - 1);
  }
  for (let y = 0; y < rows; y++) {
    push(0, y);
    push(cols - 1, y);
  }

  // 4-neighbor flood-fill from those seeds.
  let head = 0;
  while (head < queue.length) {
    const i = queue[head++];
    const x = i % cols;
    const y = (i / cols) | 0;
    push(x + 1, y);
    push(x - 1, y);
    push(x, y + 1);
    push(x, y - 1);
  }

  const isLake = (x: number, y: number) => (isWater(x, y) && !ocean[y * cols + x] ? 1 : 0);
  return extractPolygons(isLake, cols, rows, 0.5);
}
