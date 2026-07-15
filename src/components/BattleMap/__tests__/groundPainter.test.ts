/**
 * This file protects the semantic boundary between mechanical battle-map data
 * and its painted ground layer.
 *
 * Terrain mapping tests keep every referee terrain paintable. Provenance tests
 * ensure real WorldForge locations do not receive unrelated visual-only asset
 * scatter, while the older procedural sandbox keeps its illustrative filler.
 */
import { describe, it, expect } from 'vitest';
import type { BattleMapData } from '../../../types/combat';
import { terrainToGround } from '../groundPainter';
import {
  collectCrossingPaintGroups,
  shouldPaintAmbientScatter,
} from '../groundPainter/paintPipeline';

describe('terrainToGround', () => {
  it('maps every mechanical terrain to a paint ground', () => {
    expect(terrainToGround('grass')).toBe('grass');
    expect(terrainToGround('mud')).toBe('grass');
    expect(terrainToGround('difficult')).toBe('grass');
    expect(terrainToGround('water')).toBe('water');
    expect(terrainToGround('wall')).toBe('stone');
    expect(terrainToGround('rock')).toBe('dirt');
    expect(terrainToGround('stone')).toBe('dirt');
    expect(terrainToGround('floor')).toBe('dirt');
    expect(terrainToGround('sand')).toBe('sand');
  });
  it('defaults unknown terrain to grass', () => {
    expect(terrainToGround('???')).toBe('grass');
  });
});

describe('world-derived asset truth', () => {
  // The minimal map has no provenance, matching legacy arena saves and test
  // fixtures. Those surfaces preserve their existing ambient paint behavior.
  const sandboxMap: BattleMapData = {
    dimensions: { width: 1, height: 1 },
    tiles: new Map(),
    theme: 'forest',
    seed: 42,
  };

  it('keeps ambient scatter on legacy sandbox maps', () => {
    expect(shouldPaintAmbientScatter(sandboxMap)).toBe(true);
  });

  it('does not invent visual-only assets on WorldForge maps', () => {
    const worldMap: BattleMapData = {
      ...sandboxMap,
      provenance: {
        kind: 'worldforge',
        worldSeed: 42,
        anchorCellId: 476,
        scenarioId: 'boreal-woodland',
        locationLabel: 'Boreal Woodland',
        anchorWorldMeters: { x: 100, z: 100 },
        generationPath: ['World', 'Region', 'Local', 'Ground', 'Tactical patch'],
      },
    };

    expect(shouldPaintAmbientScatter(worldMap)).toBe(false);
  });
});

describe('source-backed crossing paint', () => {
  it('groups explicit bridge cells while leaving ordinary water unpainted', () => {
    const tiles = new Map();
    for (let x = 0; x < 3; x += 1) {
      const id = `${x}-0`;
      tiles.set(id, {
        id,
        coordinates: { x, y: 0 },
        terrain: 'water',
        elevation: 0,
        movementCost: x < 2 ? 1 : 0,
        blocksLoS: false,
        blocksMovement: x === 2,
        decoration: null,
        effects: [],
        ...(x < 2 ? {
          crossing: {
            kind: 'bridge' as const,
            source: 'worldforge-crossing' as const,
            sourceCrossingId: 'crossing:3:7:0',
            roadDirection: { x: 1, y: 0 },
            centerWorldMeters: { x: 0, z: 0 },
            spanMeters: 12,
            widthMeters: 4,
          },
        } : {}),
      });
    }
    const mapData: BattleMapData = {
      dimensions: { width: 3, height: 1 },
      tiles,
      theme: 'forest',
      seed: 42,
    };

    const groups = collectCrossingPaintGroups(mapData);
    expect(groups).toHaveLength(1);
    expect(groups[0]).toMatchObject({
      id: 'crossing:3:7:0',
      kind: 'bridge',
    });
    expect(groups[0].cells.map((tile) => tile.id)).toEqual(['0-0', '1-0']);
    expect(groups[0].cells.some((tile) => tile.id === '2-0')).toBe(false);
  });
});
