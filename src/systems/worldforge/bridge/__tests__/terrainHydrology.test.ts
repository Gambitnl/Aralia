import { describe, it, expect } from 'vitest';
import { deriveHydrology, fillDepressions, flowAccumulation } from '../terrainHydrology';

/** Build a grid from rows of single-digit heights. */
const grid = (art: string[]) => ({
  cols: art[0].length,
  rows: art.length,
  heights: art.flatMap((line) => [...line].map(Number)),
});

describe('fillDepressions', () => {
  it('raises a pit to the lowest point of its rim', () => {
    // A hollow of 1 ringed by 9s except for a 4 on one side: water can only
    // stand as high as the 4 before it spills out that way.
    const g = grid([
      '999',
      '419',
      '999',
    ]);
    const filled = fillDepressions(g);
    expect(filled[4]).toBe(4); // the pit
    expect(filled[3]).toBe(4); // the spill cell keeps its own height
  });

  it('leaves ground that already drains untouched', () => {
    const g = grid([
      '9876',
      '9876',
      '9876',
    ]);
    const filled = fillDepressions(g);
    expect(filled).toEqual([...g.heights]);
  });

  it('fills a basin flat, whatever its floor looks like', () => {
    // The point of filling: one flat surface, not a rule that says "be flat".
    const g = grid([
      '99999',
      '91239',
      '92139',
      '99959',
    ]);
    const filled = fillDepressions(g);
    const floor = [6, 7, 8, 11, 12, 13];
    const levels = new Set(floor.map((i) => filled[i]));
    expect(levels.size).toBe(1);
    expect([...levels][0]).toBe(5); // the low point of the rim
  });
});

describe('flowAccumulation', () => {
  it('grows downstream', () => {
    const g = grid([
      '5555',
      '4444',
      '3333',
      '2222',
    ]);
    const acc = flowAccumulation(g.heights, g.cols, g.rows);
    const rowTotal = (r: number) => acc.slice(r * 4, r * 4 + 4).reduce((a, b) => a + b, 0);
    expect(rowTotal(1)).toBeGreaterThan(rowTotal(0));
    expect(rowTotal(2)).toBeGreaterThan(rowTotal(1));
  });

  it('counts every cell at least once', () => {
    const g = grid(['21', '21']);
    const acc = flowAccumulation(g.heights, g.cols, g.rows);
    expect(acc.every((a) => a >= 1)).toBe(true);
  });

  it('gathers a valley floor more than its slopes', () => {
    // A V-shaped valley running down the middle column.
    const g = grid([
      '939',
      '828',
      '717',
      '606',
    ]);
    const acc = flowAccumulation(g.heights, g.cols, g.rows);
    expect(acc[10]).toBeGreaterThan(acc[9]); // valley floor beats its bank
  });
});

describe('deriveHydrology', () => {
  it('puts standing water in a hollow, at its spill height', () => {
    const g = grid([
      '999',
      '419',
      '999',
    ]);
    const { water, lakeCells } = deriveHydrology({ ...g, riverThreshold: 1e9 });
    expect(lakeCells.has(4)).toBe(true);
    expect(water.get(4)).toBe(4);
  });

  it('never puts water below the ground it covers', () => {
    // The failure that started this: a river pinned to its downstream height
    // and buried under 13 m of hillside.
    const g = grid([
      '9755',
      '8644',
      '7533',
      '6422',
    ]);
    const { water } = deriveHydrology({ ...g, riverThreshold: 2 });
    expect(water.size).toBeGreaterThan(0);
    for (const [idx, level] of water) {
      expect(level).toBeGreaterThanOrEqual(g.heights[idx] - 1e-9);
    }
  });

  it('lets a river descend as the valley does', () => {
    const g = grid([
      '939',
      '828',
      '717',
      '606',
    ]);
    const { water } = deriveHydrology({ ...g, riverThreshold: 2 });
    const mid = [1, 4, 7, 10].filter((i) => water.has(i));
    expect(mid.length).toBeGreaterThanOrEqual(2);
    for (let i = 1; i < mid.length; i++) {
      expect(water.get(mid[i])!).toBeLessThanOrEqual(water.get(mid[i - 1])!);
    }
  });

  it('keeps a lake surface flat across the whole basin', () => {
    const g = grid([
      '99999',
      '91239',
      '92139',
      '99959',
    ]);
    const { water } = deriveHydrology({ ...g, riverThreshold: 1e9 });
    const floor = [6, 7, 8, 11, 12, 13];
    const levels = new Set(floor.map((i) => water.get(i)));
    expect(levels.size).toBe(1);
  });

  it('makes no water on ground that simply drains away', () => {
    const g = grid([
      '9876',
      '9876',
      '9876',
    ]);
    const { water } = deriveHydrology({ ...g, riverThreshold: 1e9 });
    expect(water.size).toBe(0);
  });

  it('makes fewer river cells as the threshold rises', () => {
    const g = grid([
      '939',
      '828',
      '717',
      '606',
    ]);
    const few = deriveHydrology({ ...g, riverThreshold: 6 }).water.size;
    const many = deriveHydrology({ ...g, riverThreshold: 2 }).water.size;
    expect(many).toBeGreaterThanOrEqual(few);
  });

  it('is deterministic', () => {
    const g = grid([
      '939',
      '828',
      '717',
      '606',
    ]);
    const a = deriveHydrology({ ...g, riverThreshold: 2 });
    const b = deriveHydrology({ ...g, riverThreshold: 2 });
    expect([...a.water.entries()]).toEqual([...b.water.entries()]);
    expect(a.filled).toEqual(b.filled);
  });
});
