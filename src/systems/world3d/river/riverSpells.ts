/**
 * SPELLS THAT RESHAPE THE RIVER'S GROUND (2026-10-25).
 *
 * Each spell becomes exact terrain-brush shapes (RiverTerrainBrush 'shape'),
 * which reach the live river like any brush edit: the solver keeps the
 * water's volume through the edit (RiverFlowSolver.updateBed keepVolume), and
 * the water then does what the new ground makes it do by its own physics:
 * a hole fills, a channel carries water, a dam ponds water until it spills,
 * a breach releases the pond as a flood wave.
 *
 * Sizes come from the D&D 5e spell text (1 ft = 0.3048 m):
 *  - Mold Earth: excavate one 5 ft cube of loose earth.
 *  - Move Earth: reshape a 40 ft square area, changing its height by up to 20 ft.
 *  - Wall of Stone: ten 10 ft by 10 ft panels, 6 in thick (here a wall one
 *    grid cell thick and more: the river grid is 0.5 m, so a 6 in wall would
 *    fall between cells and hold no water).
 *  - Disintegrate: destroys a 10 ft cube of a wall or a created object.
 * The game's spell system calls these with a target point (and an end point
 * for the line spells); this module knows nothing about turns or slots.
 */

import type { RiverTerrainBrushCommand } from './riverTerrainBrush';

const FT = 0.3048;
export type RiverSpellId = 'mold-earth' | 'move-earth' | 'wall-of-stone' | 'disintegrate';
export interface RiverSpellCast {
  spell: RiverSpellId;
  /** Target point (the hole, the wall's or channel's first end), world m. */
  x: number; z: number;
  /** The line spells' second end, world m. A longer line is cut to the spell's reach. */
  x2?: number; z2?: number;
}

/** The spell's reach and its shape sizes, m. */
export const RIVER_SPELLS: Record<RiverSpellId, { label: string; maxLengthM: number; halfWidthM: number; depthM: number; shape: 'hole' | 'trench' | 'wall' }> = {
  'mold-earth': { label: 'Mold Earth: dig a hole', maxLengthM: 0, halfWidthM: 5 * FT / 2 + 0.25, depthM: 5 * FT, shape: 'hole' },
  'move-earth': { label: 'Move Earth: cut a channel', maxLengthM: 40 * FT, halfWidthM: 1.5, depthM: 2, shape: 'trench' },
  'wall-of-stone': { label: 'Wall of Stone: raise a dam', maxLengthM: 10 * 10 * FT, halfWidthM: 0.75, depthM: 10 * FT, shape: 'wall' },
  'disintegrate': { label: 'Disintegrate: break a wall', maxLengthM: 0, halfWidthM: 10 * FT / 2, depthM: 10 * FT + 0.5, shape: 'hole' },
};

/**
 * The brush commands of one cast: the shape, then 'finish' so one undo takes
 * the whole spell back. `stroke` must be new for each cast.
 */
export function riverSpellCommands(cast: RiverSpellCast, stroke: number): RiverTerrainBrushCommand[] {
  const s = RIVER_SPELLS[cast.spell];
  if (!s) throw Error(`Unknown river spell ${cast.spell}`);
  if (s.shape === 'hole') return [{ kind: 'shape', stroke, shape: 'hole', x: cast.x, z: cast.z, radius: s.halfWidthM, depth: s.depthM }, { kind: 'finish' }];
  let x2 = cast.x2 ?? cast.x, z2 = cast.z2 ?? cast.z;
  const len = Math.hypot(x2 - cast.x, z2 - cast.z);
  if (len > s.maxLengthM) { const k = s.maxLengthM / len; x2 = cast.x + (x2 - cast.x) * k; z2 = cast.z + (z2 - cast.z) * k; }
  return [{ kind: 'shape', stroke, shape: s.shape, x: cast.x, z: cast.z, x2, z2, radius: s.halfWidthM, depth: s.depthM }, { kind: 'finish' }];
}
