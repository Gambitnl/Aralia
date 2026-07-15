/**
 * These tests prove block instructions survive into bounded 3D presentation.
 *
 * Ensemble trim is deliberately additive and semantically tagged so tactical
 * systems can exclude it without changing structural building parts.
 */

import { describe, expect, it } from 'vitest';
import { generateBuilding } from '../../interior/generateBuilding';
import type { BuildingEnsemble } from '../../interior/blueprintTypes';
import { rootSeedPath } from '../../seedPath';
import {
  buildBuildingEnsembleParts,
  ENSEMBLE_PART_TAG,
} from '../buildingEnsembleParts';
import { buildBlueprintParts, PERIMETER_WALL_COLORS } from '../interiorParts';

function building(kind: BuildingEnsemble['kind']) {
  return generateBuilding({
    buildingId: 91,
    type: 'shop',
    seedPath: rootSeedPath(8091),
    storeys: 2,
    ensemble: {
      blockKey: 'ward:2:edge:0',
      kind,
      partyWallLeft: kind !== 'detached',
      partyWallRight: kind !== 'detached',
      eaveStoreys: 2,
      ensembleSignature: 'market-row-a',
    },
  });
}

describe('buildBuildingEnsembleParts', () => {
  it('gives rows one shared-height eave cue and no arcade furniture', () => {
    const parts = buildBuildingEnsembleParts(building('row'), 3);
    expect(parts).toHaveLength(1);
    expect(parts[0].tag).toBe(ENSEMBLE_PART_TAG);
    expect(parts[0].ensembleDetailKind).toBe('shared-eave-band');
    expect(parts[0].baseY).toBeCloseTo(2 * 3 - 0.24 * 0.3048, 6);
  });

  it('adds a bounded canopy and supports to market arcades', () => {
    const blueprint = building('market-arcade');
    const first = buildBuildingEnsembleParts(blueprint, 3);
    const replay = buildBuildingEnsembleParts(blueprint, 3);

    expect(replay).toEqual(first);
    expect(first.length).toBeGreaterThan(3);
    expect(first.length).toBeLessThanOrEqual(11);
    expect(first.some((part) => part.ensembleDetailKind === 'arcade-canopy')).toBe(true);
    expect(first.filter((part) => part.ensembleDetailKind === 'arcade-column').length)
      .toBeGreaterThanOrEqual(2);
    expect(first.every((part) => part.tag === ENSEMBLE_PART_TAG
      && Number.isFinite(part.x)
      && Number.isFinite(part.z)
      && part.w > 0
      && part.d > 0
      && part.h > 0)).toBe(true);
  });

  it('reaches the shared bridge and is a no-op for detached or courtyard plans', () => {
    const blueprint = building('market-arcade');
    const output = buildBlueprintParts(blueprint, 3, PERIMETER_WALL_COLORS.market);
    expect(output.parts.filter((part) => part.tag === ENSEMBLE_PART_TAG))
      .toEqual(buildBuildingEnsembleParts(blueprint, 3));
    expect(buildBuildingEnsembleParts(building('detached'), 3)).toEqual([]);
    expect(buildBuildingEnsembleParts(building('courtyard'), 3)).toEqual([]);
  });
});
