import { describe, it, expect } from 'vitest';
import { fogAlpha, buildFogAlphaGrid } from '../fogModel';
import type { BattleMapData } from '../../../types/combat';

describe('fogAlpha', () => {
  it('grades darkness from unseen to bright', () => {
    expect(fogAlpha(false, 'bright')).toBe(0.6);
    expect(fogAlpha(true, 'magical_darkness')).toBe(0.5);
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
    expect(grid.alphas[1]).toBe(0.6);  // not visible
  });
});
