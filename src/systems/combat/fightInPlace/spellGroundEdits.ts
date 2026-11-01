/**
 * @file spellGroundEdits.ts - what a spell cast in combat does to the world's
 * one ground (agora-257c, 2026-10-29, GG-533 step 3).
 *
 * WHY. Remy, 2026-10-29: spells change the earth, and the water must react to
 * the land. Before this file a spell that moved earth changed only the 2D
 * referee's tiles (`TerrainCommand`) or the 3D arena's voxels (`BattleMap3D`).
 * The world's ground (`groundRecord.ts`) never heard of it, so a pit dug in a
 * street fight was gone when the fight ended, and the river never saw it.
 *
 * WHAT IT DOES. It turns facts the combat machinery already decided into exact
 * ground shapes in world (ground) meters. It decides nothing new about which
 * spell moves earth or by how much:
 *  - A TERRAIN manipulation (`TerrainCommand`'s log entry): excavate digs a
 *    hole `volume.depth` ft deep, fill raises a level mound `volume.size` ft
 *    high (5 ft each when the data gives none, the referee's own defaults),
 *    over the tiles the referee changed. The record's grid point spacing is
 *    one 5 ft tile, and a patch tile is not aligned to it, so the shape holds
 *    its full depth over the circle through the changed square's corners:
 *    every grid point inside the square goes the full depth, and the edge
 *    eases outside it. Mold Earth's excavate is the one spell that uses this
 *    today.
 *  - An explosion's crater (`groundImpactOfAbility`, which rides the spell's
 *    animation): the same sphere cut the 3D arena digs, scaled from tiles (one
 *    arena unit) to meters, so one blast digs one hole in the arena and in the
 *    world.
 * A patch with no `worldGround` (a placeless arena, a dungeon floor, a test
 * board) shows no world ground, and nothing comes back.
 *
 * Pure: no React and no world. `useSpellGroundEdits` cuts and saves the shapes.
 */
import type { BattleMapData, CombatLogEntry, Position } from '@/types/combat';
import type { GroundImpact } from '../groundImpact';
import { GROUND_SHAPE_FULL_FRACTION, type GroundShape } from '@/systems/worldforge/terrain/groundShapeProfile';
import { GROUND_METERS_PER_CELL_FIP } from './inSceneMovement';

const FT = 0.3048;

/**
 * Ground meters of a patch tile: the point `extractLocalTerrainPatch` sampled
 * the tile's ground at. Null when the patch shows no world ground.
 */
export function patchTileGroundPoint(map: BattleMapData, tile: Position): { x: number; z: number } | null {
  const g = map.worldGround;
  if (!g) return null;
  return {
    x: g.anchorWorldMeters.x + (tile.x - Math.floor(map.dimensions.width / 2)) * GROUND_METERS_PER_CELL_FIP,
    z: g.anchorWorldMeters.z + (tile.y - Math.floor(map.dimensions.height / 2)) * GROUND_METERS_PER_CELL_FIP,
  };
}

/** The part of a TerrainCommand log entry this module reads. */
interface TerrainLogData {
  manipulation?: { type?: string; volume?: { size?: number; depth?: number } };
  affectedPositions?: Position[];
}

/**
 * The ground shapes one combat log entry stands for: a TerrainCommand
 * excavate or fill on a patch that shows a world ground. Empty for every
 * other entry.
 */
export function groundShapesOfTerrainLog(entry: CombatLogEntry, map: BattleMapData | null): GroundShape[] {
  if (!map?.worldGround) return [];
  const data = entry.data as TerrainLogData | undefined;
  const manipulation = data?.manipulation;
  const kind = manipulation?.type;
  if (kind !== 'excavate' && kind !== 'fill') return [];
  const points = (data?.affectedPositions ?? [])
    .map((t) => patchTileGroundPoint(map, t))
    .filter((p): p is { x: number; z: number } => p !== null);
  if (points.length === 0) return [];
  // The referee's own amounts (TerrainCommand.applyTerrainChange).
  const feet = kind === 'excavate' ? (manipulation?.volume?.depth ?? 5) : (manipulation?.volume?.size ?? 5);
  if (!(feet > 0)) return [];
  // One shape over the changed tiles: centered on them, its full-depth circle
  // through the farthest corner of the square they cover.
  const x = points.reduce((sum, p) => sum + p.x, 0) / points.length;
  const z = points.reduce((sum, p) => sum + p.z, 0) / points.length;
  let halfSide = 0;
  for (const p of points) halfSide = Math.max(halfSide, Math.abs(p.x - x), Math.abs(p.z - z));
  halfSide += GROUND_METERS_PER_CELL_FIP / 2;
  const radius = (halfSide * Math.SQRT2) / GROUND_SHAPE_FULL_FRACTION;
  const depth = feet * FT;
  return kind === 'excavate'
    ? [{ shape: 'hole', x, z, radius, depth }]
    : [{ shape: 'wall', x, z, x2: x, z2: z, radius, depth }];
}

/**
 * The crater an explosion digs at a patch tile, as a world ground shape, or
 * null when the patch shows no world ground. `impact` is in arena units, one
 * tile each (`groundImpact.ts`); the arena digs at the tile's middle, and the
 * world at the tile's ground point, which is the same place.
 */
export function groundShapeOfImpact(impact: GroundImpact, tile: Position, map: BattleMapData | null): GroundShape | null {
  if (!map) return null;
  const at = patchTileGroundPoint(map, tile);
  if (!at) return null;
  return {
    shape: 'crater',
    x: at.x,
    z: at.z,
    radius: impact.radiusM * GROUND_METERS_PER_CELL_FIP,
    depth: impact.depthM * GROUND_METERS_PER_CELL_FIP,
  };
}
