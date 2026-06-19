/**
 * This file verifies the first WSS-005a feature-source bridge.
 *
 * Azgaar is now the product-decided source of truth for atlas features. This test
 * proves that the WorldData object persisted for 3D keeps a typed Azgaar hint payload
 * beside its generated geometry, so later renderer/gameplay work can follow the same
 * canonical river/site/road source without guessing from regenerated polylines.
 */

import { runWorldSim } from '../index';
import { generateAzgaarDerivedMap } from '../../azgaarDerivedMapService';
import { BIOMES, LOCATIONS } from '@/constants';

// ============================================================================
// Fixed-Seed Acceptance
// ============================================================================
// This section uses the same seed that exposed the old atlas-vs-WorldData river
// split. The new contract does not remove generated geometry yet; it adds the
// canonical Azgaar feature hints that downstream bridge work can consume.
// ============================================================================

it('carries Azgaar feature hints into WorldData as the shared feature truth', () => {
  const rows = 40;
  const cols = 60;
  const worldSeed = 2026;

  const mapData = generateAzgaarDerivedMap(rows, cols, LOCATIONS, BIOMES, worldSeed);
  if (!mapData.azgaarWorld || !mapData.worldData) {
    throw new Error('Expected generateAzgaarDerivedMap to return azgaarWorld + worldData.');
  }

  const azgaarMask = mapData.azgaarWorld.rivers;
  const featureHints = mapData.worldData.featureHints;

  // The atlas and WorldData must keep the same Azgaar river mask. This is the
  // first durable proof that the bridge carries canonical feature truth instead
  // of relying on a separately traced 3D river network.
  expect(azgaarMask).toHaveLength(rows * cols);
  expect(featureHints?.source).toBe('azgaar');
  expect(featureHints?.rivers).toEqual(azgaarMask);
  expect(featureHints?.sites).toEqual([]);
  expect(featureHints?.roads).toEqual([]);

  // Re-run the same terrain pipeline with the same feature hints to prove that
  // the bridge is deterministic for a fixed seed and source payload.
  const fromSourceInput = runWorldSim({
    seed: worldSeed,
    templateId: mapData.azgaarWorld.templateId,
    cols,
    rows,
    heights: mapData.azgaarWorld.heights,
    temperatures: mapData.azgaarWorld.temperatures,
    moisture: mapData.azgaarWorld.moisture,
    biomeIds: mapData.tiles.flat().map((tile) => tile.biomeId),
    featureHints,
  });

  expect(JSON.stringify(fromSourceInput)).toBe(JSON.stringify(mapData.worldData));
});
