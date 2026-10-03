import { describe, it, expect } from 'vitest';
import { blurFogAlphaGrid, fogAlpha, buildFogAlphaGrid } from '../fogModel';
import type { BattleMapData } from '../../../types/combat';

describe('fogAlpha', () => {
  it('grades darkness from unseen to bright', () => {
    expect(fogAlpha(false, 'bright')).toBe(0.55);
    expect(fogAlpha(true, 'magical_darkness')).toBe(0.48);
    expect(fogAlpha(true, 'darkness')).toBe(0.3);
    expect(fogAlpha(true, 'dim')).toBe(0.16);
    expect(fogAlpha(true, 'bright')).toBe(0);
  });
});

describe('buildFogAlphaGrid', () => {
  const tile = (x: number, y: number) => ({
    id: `${x}-${y}`,
    coordinates: { x, y },
  });
  const mapData = {
    dimensions: { width: 2, height: 1 },
    tiles: new Map([
      ['0-0', tile(0, 0)],
      ['1-0', tile(1, 0)],
    ]),
  } as unknown as BattleMapData;

  it('fills row-major alphas from visibility and light', () => {
    const grid = buildFogAlphaGrid(mapData, new Set(['0-0']), (id) => (id === '0-0' ? 'bright' : 'darkness'));
    expect(grid.width).toBe(2);
    expect(grid.height).toBe(1);
    expect(grid.alphas[0]).toBe(0);    // visible + bright
    expect(grid.alphas[1]).toBe(0.55); // not visible
  });
});

describe('blurFogAlphaGrid', () => {
  it('feathers hard boundaries while keeping interiors near-exact', () => {
    // 5x1 strip: hidden | hidden | hidden | visible | visible
    const grid = { width: 5, height: 1, alphas: [0.55, 0.55, 0.55, 0, 0] };
    const blurred = blurFogAlphaGrid(grid, 1);
    // Deep interior barely moves; the boundary pair splits the step.
    expect(blurred.alphas[0]).toBeCloseTo(0.55, 1);
    expect(blurred.alphas[2]).toBeGreaterThan(blurred.alphas[3]);
    expect(blurred.alphas[2]).toBeLessThan(0.55);
    expect(blurred.alphas[3]).toBeGreaterThan(0);
    expect(blurred.alphas[4]).toBeLessThan(0.1);
  });

  it('leaves a uniform grid unchanged', () => {
    const grid = { width: 3, height: 3, alphas: new Array(9).fill(0.3) };
    const blurred = blurFogAlphaGrid(grid, 2);
    for (const a of blurred.alphas) expect(a).toBeCloseTo(0.3, 5);
  });
});

describe('blur honesty bound', () => {
  // The two-pass blur trades a little referee-truth for a smooth penumbra: it
  // pulls fully-hidden cells near a visibility boundary toward their visible
  // neighbours. This measures HOW FAR that lie reaches so the doc comments in
  // fogModel.ts / BattleMapFogCanvas.tsx can state a proven number instead of a
  // hand-wave. A fully-hidden cell's exact alpha is 0.55 (see fogAlpha); we find
  // the greatest tile-distance from any visible cell at which the blurred alpha
  // still deviates from 0.55 by more than 0.05.
  const HIDDEN = 0.55;

  /** Max Chebyshev distance-to-visible at which a hidden cell deviates >0.05. */
  const measureHonestyBound = (
    width: number,
    height: number,
    isVisible: (x: number, y: number) => boolean,
    passes = 2,
  ): number => {
    const alphas = new Array<number>(width * height);
    const visibleCells: Array<[number, number]> = [];
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const vis = isVisible(x, y);
        alphas[y * width + x] = vis ? 0 : HIDDEN;
        if (vis) visibleCells.push([x, y]);
      }
    }
    const blurred = blurFogAlphaGrid({ width, height, alphas }, passes);
    let maxDist = 0;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (isVisible(x, y)) continue;
        const dev = Math.abs(blurred.alphas[y * width + x] - HIDDEN);
        if (dev <= 0.05) continue;
        let dist = Infinity;
        for (const [vx, vy] of visibleCells) {
          dist = Math.min(dist, Math.max(Math.abs(vx - x), Math.abs(vy - y)));
        }
        maxDist = Math.max(maxDist, dist);
      }
    }
    return maxDist;
  };

  const SIZE = 15;
  const MID = 7;

  it('reaches only 1 tile past a straight sight boundary', () => {
    // Vertical split: left lit, right hidden. The classic crest-line boundary.
    expect(measureHonestyBound(SIZE, SIZE, (x) => x < MID)).toBe(1);
  });

  it('reaches at most 2 tiles at a concave boundary corner (worst case)', () => {
    // Visible wraps the hidden quadrant in an L — light on two sides of a cell
    // compounds the pull, the worst geometry the blur can face.
    expect(measureHonestyBound(SIZE, SIZE, (x, y) => x < MID || y < MID)).toBe(2);
  });

  it('never shifts a fully-hidden cell more than 2 tiles from its truth', () => {
    // The bound the doc comments cite: across straight edges, diagonal edges,
    // convex and concave corners, and thin spikes, no fully-hidden cell more
    // than 2 tiles from light deviates from 0.55 by more than 0.05.
    const geometries: Array<(x: number, y: number) => boolean> = [
      (x) => x < MID, // straight vertical
      (x, y) => x + y < MID + 6, // diagonal
      (x, y) => x < MID && y < MID, // convex (visible quarter)
      (x, y) => x < MID || y < MID, // concave (visible L)
      (x, y) => y === MID && x <= MID, // thin visible spike
      (x, y) => x === MID && y === MID, // single visible cell
    ];
    const worst = Math.max(
      ...geometries.map((g) => measureHonestyBound(SIZE, SIZE, g)),
    );
    expect(worst).toBeLessThanOrEqual(2);
  });
});
