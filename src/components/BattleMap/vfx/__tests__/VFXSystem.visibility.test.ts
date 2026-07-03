import { describe, expect, it } from 'vitest';
import type { BattleMapData, LightLevel } from '../../../../types/combat';
import { buildTileVisibilityOverlays } from '../VFXSystem';

/**
 * These tests protect the 3D map's tactical visibility mask decisions.
 *
 * The WebGL renderer turns these plain records into meshes, but the important
 * spell-system behavior is decided here: hidden, dark, and dim tiles should get
 * different masks, while bright visible tiles should stay unmasked.
 */

const createTile = (id: string, x: number, y: number) => ({
  id,
  coordinates: { x, y },
  terrain: 'floor',
  elevation: 0,
  movementCost: 1,
  blocksMovement: false,
  blocksLoS: false,
  decoration: null,
  environmentalEffects: [],
  effects: []
});

describe('buildTileVisibilityOverlays', () => {
  it('builds 3D masks for hidden, magical darkness, darkness, and dim tiles while leaving bright visible tiles clear', () => {
    const mapData: BattleMapData = {
      dimensions: { width: 5, height: 1 },
      tiles: new Map([
        ['0-0', createTile('0-0', 0, 0)],
        ['1-0', createTile('1-0', 1, 0)],
        ['2-0', createTile('2-0', 2, 0)],
        ['3-0', createTile('3-0', 3, 0)],
        ['4-0', createTile('4-0', 4, 0)]
      ]),
      theme: 'dungeon',
      seed: 1
    } as unknown as BattleMapData;
    const lightLevels = new Map<string, LightLevel>([
      ['0-0', 'bright'],
      ['1-0', 'dim'],
      ['2-0', 'darkness'],
      ['3-0', 'bright'],
      ['4-0', 'magical_darkness']
    ]);

    const overlays = buildTileVisibilityOverlays(
      mapData,
      lightLevels,
      new Set(['0-0', '1-0', '2-0', '4-0'])
    );

    // Bright visible tiles stay clear. Dim and darkness get progressively
    // stronger masks, magical darkness remains distinct, and hidden tiles get
    // the strongest fog-of-war mask.
    expect(overlays).toEqual([
      { id: '1-0', position: { x: 1, y: 0 }, color: '#0f172a', opacity: 0.24 },
      { id: '2-0', position: { x: 2, y: 0 }, color: '#020617', opacity: 0.42 },
      { id: '3-0', position: { x: 3, y: 0 }, color: '#020617', opacity: 0.78 },
      { id: '4-0', position: { x: 4, y: 0 }, color: '#020617', opacity: 0.66 }
    ]);
  });
});
