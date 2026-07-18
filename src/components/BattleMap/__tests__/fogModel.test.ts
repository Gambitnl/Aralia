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
