/** GG-427: the spill level of every cell (water at rest fills a basin to its
 * lowest exit), the rule behind the seven-falls course's filled-basin start. */
import { describe, expect, it } from 'vitest';
import { spillLevels } from '../riverLive';

describe('spill levels by priority flood', () => {
  it('fills a basin to its lowest lip and leaves a slope and a fall face dry', () => {
    // One row, east is the outflow. A pool (bed 2) behind a lip (bed 5), a
    // fall face down to a plunge pool (bed 0) behind a second lip (bed 1),
    // then a steady slope to the edge.
    const bed = [9, 2, 2, 2, 5, 4, 0, 0, 1, 0.8, 0.6, 0.4];
    const level = spillLevels(bed, bed.length, 1);
    // The upper pool stands at the first lip; the plunge pool at the second.
    expect([...level.slice(1, 4)]).toEqual([5, 5, 5]);
    expect([...level.slice(6, 8)]).toEqual([1, 1]);
    // Lips, the fall face and the slope hold no water at rest.
    for (const c of [4, 5, 8, 9, 10, 11]) expect(level[c]).toBe(bed[c]);
    // The upstream wall is higher than its lip: it is dry too.
    expect(level[0]).toBe(9);
  });
  it('finds the lowest way round a ridge in two dimensions', () => {
    // A 5 x 3 grid: a basin in the middle row, closed east by a ridge of 6
    // except one gap of 3 in the bottom row.
    const nx = 5, nz = 3, bed: number[] = [];
    for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) bed.push(i === 3 ? (j === 2 ? 3 : 6) : i === 4 ? 0 : 1);
    const level = spillLevels(bed, nx, nz);
    for (let j = 0; j < nz; j++) for (let i = 0; i < 3; i++) expect(level[j * nx + i]).toBe(3);
    expect(level[1 * nx + 3]).toBe(6);
  });
  it('treats a non-finite bed as a wall and an enclosed cell as no exit', () => {
    const bed = [1, NaN, 0];
    const level = spillLevels(bed, 3, 1);
    expect(level[0]).toBe(Infinity);
    expect(level[2]).toBe(0);
  });
});
