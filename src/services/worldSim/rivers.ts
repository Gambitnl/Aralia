/**
 * @file rivers.ts
 * Flow accumulation + polyline river tracing on a heightmap.
 *
 * Algorithm:
 *  1. For each land cell (height >= SEA_LEVEL), find the steepest-descent neighbor among 8.
 *  2. Sort cells by height descending. Walk in order; for each cell, add `flow[i]` to
 *     `flow[descent[i]]`. After the walk, every cell knows its upstream area.
 *  3. Identify sources (cells with flow >= threshold but no upstream feeder). Trace down
 *     descent[] emitting a polyline until flow drops below threshold or we leave land.
 *
 * Output coords are cell-center grid coords (cellX + 0.5, cellY + 0.5).
 */
import type { River, Vec2 } from './types';

const SEA_LEVEL = 20;
const NEIGHBOR_OFFSETS: Array<[number, number]> = [
  [1, 0], [-1, 0], [0, 1], [0, -1],
  [1, 1], [-1, -1], [1, -1], [-1, 1],
];

export function traceRivers(heights: number[], cols: number, rows: number, minFlow: number): River[] {
  const n = cols * rows;
  const descent = new Int32Array(n).fill(-1);
  const flow = new Float32Array(n);

  // 1. Steepest-descent neighbor per land cell.
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const i = y * cols + x;
      if (heights[i] < SEA_LEVEL) continue;
      let best = -1;
      let bestH = heights[i];
      for (const [dx, dy] of NEIGHBOR_OFFSETS) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) continue;
        const ni = ny * cols + nx;
        if (heights[ni] < bestH) {
          bestH = heights[ni];
          best = ni;
        }
      }
      descent[i] = best;
      flow[i] = 1;
    }
  }

  // 2. Accumulate flow high-to-low.
  const order = Array.from({ length: n }, (_, i) => i)
    .filter((i) => heights[i] >= SEA_LEVEL)
    .sort((a, b) => heights[b] - heights[a]);
  for (const i of order) {
    const d = descent[i];
    if (d >= 0) flow[d] += flow[i];
  }

  // 3. Identify sources and trace polylines downstream.
  const visited = new Uint8Array(n);
  const rivers: River[] = [];
  const sourceCandidates = order
    .filter((i) => flow[i] >= minFlow)
    .filter((i) => {
      const x = i % cols;
      const y = (i / cols) | 0;
      for (const [dx, dy] of NEIGHBOR_OFFSETS) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) continue;
        const ni = ny * cols + nx;
        if (descent[ni] === i) return false; // has an upstream feeder
      }
      return true;
    });

  let riverId = 0;
  for (const src of sourceCandidates) {
    if (visited[src]) continue;
    const points: Vec2[] = [];
    const widthArr: number[] = [];
    const discharge: number[] = [];
    let cur = src;
    let guard = n;
    while (cur >= 0 && guard-- > 0 && !visited[cur] && flow[cur] >= minFlow) {
      visited[cur] = 1;
      points.push({ x: (cur % cols) + 0.5, y: ((cur / cols) | 0) + 0.5 });
      discharge.push(flow[cur]);
      widthArr.push(Math.max(0.4, Math.sqrt(flow[cur]) * 0.3));
      cur = descent[cur];
    }
    if (points.length >= 2) {
      rivers.push({ id: `r${riverId++}`, points, width: widthArr, discharge });
    }
  }

  return rivers;
}
