import { gridToWorld, gridPointToLocal } from '../coords';
import { WORLD3D_CONFIG } from '../config';

const M = WORLD3D_CONFIG.METERS_PER_CELL;
const S = WORLD3D_CONFIG.CHUNK_WORLD_SIZE;

it('gridToWorld scales grid cells to world meters', () => {
  expect(gridToWorld(0, 0)).toEqual({ x: 0, z: 0 });
  expect(gridToWorld(1, 2)).toEqual({ x: M, z: 2 * M });
});

it('gridPointToLocal subtracts the chunk origin', () => {
  expect(gridPointToLocal(0, 0, 0, 0)).toEqual({ x: 0, z: 0 });
  const p = gridPointToLocal(S / M, 0, 1, 0);
  expect(p.x).toBeCloseTo(0);
  expect(p.z).toBeCloseTo(0);
});
