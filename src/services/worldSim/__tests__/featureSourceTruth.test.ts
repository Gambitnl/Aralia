/**
 * This file verifies that the world-sim artifact used by 3D is generated from shared
 * terrain/baseline inputs, not from the 2D Azgaar river mask on disk.
 *
 * It exists as a safety contract for WSS-005: before we decide whether 2D and 3D
 * should share one feature source, we need a focused proof that those feature feeds are
 * currently separate.
 */

import { runWorldSim } from '../index';
import { generateAzgaarDerivedMap } from '../../azgaarDerivedMapService';
import { BIOMES, LOCATIONS } from '@/constants';

function rasterizeWorldRiverCells(rivers: Array<{ points: { x: number; y: number }[] }>, cols: number, rows: number): boolean[] {
  const cells = new Array(rows * cols).fill(false);
  for (const river of rivers) {
    for (const { x, y } of river.points) {
      const nx = Math.floor(x);
      const ny = Math.floor(y);
      if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) {
        continue;
      }
      cells[ny * cols + nx] = true;
    }
  }
  return cells;
}

it('proves WSS-005 at source: Azgaar river mask is not the 3D worldSim input', () => {
  const rows = 40;
  const cols = 60;
  const worldSeed = 2026;

  const mapData = generateAzgaarDerivedMap(rows, cols, LOCATIONS, BIOMES, worldSeed);
  if (!mapData.azgaarWorld || !mapData.worldData) {
    throw new Error('Expected generateAzgaarDerivedMap to return azgaarWorld + worldData.');
  }

  const azgaarMask = mapData.azgaarWorld.rivers;
  const worldMask = rasterizeWorldRiverCells(mapData.worldData.rivers, cols, rows);

  expect(azgaarMask).toHaveLength(rows * cols);
  expect(worldMask).toHaveLength(rows * cols);
  const mismatchCount = azgaarMask.reduce((count, hasRiver, index) => count + (hasRiver === worldMask[index] ? 0 : 1), 0);
  expect(mismatchCount).toBeGreaterThan(0);

  // Re-run the same terrain pipeline as the Azgaar-derived world producer to show
  // that 3D world artifacts are a deterministic function of this terrain and are not
  // altered by the Azgaar boolean-river input channel.
  const fromSourceInput = runWorldSim({
    seed: worldSeed,
    templateId: mapData.azgaarWorld.templateId,
    cols,
    rows,
    heights: mapData.azgaarWorld.heights,
    temperatures: mapData.azgaarWorld.temperatures,
    moisture: mapData.azgaarWorld.moisture,
    biomeIds: mapData.tiles.flat().map((tile) => tile.biomeId),
  });

  expect(fromSourceInput).toBeDefined();
  expect(JSON.stringify(fromSourceInput)).toBe(JSON.stringify(mapData.worldData));
});
