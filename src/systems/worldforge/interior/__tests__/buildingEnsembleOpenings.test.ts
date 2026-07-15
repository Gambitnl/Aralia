/**
 * These tests enforce the building-side half of the party-wall contract.
 *
 * Shared side walls remain present for structure and room boundaries, but no
 * floor may punch a window through them into the neighbouring row building.
 */

import { describe, expect, it } from 'vitest';
import { generateBuilding } from '../generateBuilding';
import { rootSeedPath } from '../../seedPath';

describe('building ensemble openings', () => {
  it('keeps shared side walls while suppressing every party-wall window', () => {
    const blueprint = generateBuilding({
      buildingId: 314,
      type: 'townhouse',
      seedPath: rootSeedPath(314),
      storeys: 3,
      ensemble: {
        blockKey: 'ward:1:edge:3',
        kind: 'row',
        partyWallLeft: true,
        partyWallRight: true,
        eaveStoreys: 3,
        ensembleSignature: 'row-314',
      },
    });

    expect(blueprint.ensemble?.kind).toBe('row');
    for (const floor of blueprint.floors) {
      expect(floor.windows.some((window) =>
        window.axis === 'y' && (window.x === 0 || window.x === blueprint.widthFt)))
        .toBe(false);
      expect(floor.walls.some((wall) =>
        wall.kind === 'outer' && wall.axis === 'y' && wall.x === 0)).toBe(true);
      expect(floor.walls.some((wall) =>
        wall.kind === 'outer' && wall.axis === 'y' && wall.x === blueprint.widthFt)).toBe(true);
    }
  });

  it('includes ensemble constraints in memo identity', () => {
    const common = {
      buildingId: 77,
      type: 'shop' as const,
      seedPath: rootSeedPath(177),
      storeys: 2,
    };
    const detached = generateBuilding(common);
    const row = generateBuilding({
      ...common,
      ensemble: {
        blockKey: 'ward:0:edge:0',
        kind: 'row',
        partyWallLeft: true,
        partyWallRight: true,
        eaveStoreys: 2,
        ensembleSignature: 'row-77',
      },
    });

    expect(detached.ensemble).toBeUndefined();
    expect(row.ensemble?.ensembleSignature).toBe('row-77');
    expect(row).not.toBe(detached);
  });
});
