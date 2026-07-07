/**
 * @file raidPressure.ts — Pillar 2, Task 8 (living ecology): the RAID-PRESSURE
 * signal a burg feels from the UNCLEARED dungeons around it.
 *
 * A dungeon that still has an apex occupation is a threat to the settlements
 * nearby — something dens in it that raids herds, waylays roads, empties
 * outlying farms. `raidPressureForBurg(worldSeed, burgId, clearedSet)` returns a
 * scalar in [0, 1]: the accumulated menace of every uncleared site within
 * `RAID_RADIUS_FT` of the burg, each contribution decaying with distance.
 *
 * This is the SIGNAL only — full raid behaviour (parties, losses, quests) is a
 * later agent-sim campaign. One consumer lands now: the townsim's daily roll
 * emits an occasional "raid-worry" line for a high-pressure burg (townSim.ts).
 *
 * COST: plan-free. Unlike rumors, raid pressure reads only the SITE list (cell +
 * position), never a generated dungeon plan — so it is cheap enough to evaluate
 * per burg per day. It reuses the same distance shortlist idea as rumors.ts: a
 * site beyond RAID_RADIUS_FT contributes nothing and is skipped.
 *
 * Determinism: no draws, no Math.random. Pure function of (seed, burg, cleared).
 * Zero THREE imports.
 */
import { FEET_PER_FMG_PIXEL } from '../../adapter/atlasArtifact';
import { getBridgeAtlas } from '../../bridge/legacySubmapBridge';
import { enumerateDungeonSites } from './dungeonSites';

/** A dungeon raids out to ~8 miles of countryside. Beyond this a site's menace
 * doesn't reach a burg at all (contribution 0). */
export const RAID_RADIUS_FT = 5280 * 8;
/** Peak per-site contribution at zero distance (a den right on the doorstep). A
 * few nearby uncleared sites saturate pressure toward 1; one distant one barely
 * registers. */
const PER_SITE_PEAK = 0.6;

interface BurgLike {
  i?: number;
  cell?: number;
  removed?: boolean;
}

/** Feet position of a cell center (same convention as site.posFt / describeCell). */
function cellPosFt(
  p: ReadonlyArray<readonly [number, number]>,
  cell: number,
): { x: number; y: number } {
  const pt = p[cell] ?? [0, 0];
  return {
    x: Math.round(pt[0] * FEET_PER_FMG_PIXEL),
    y: Math.round(pt[1] * FEET_PER_FMG_PIXEL),
  };
}

/**
 * Raid pressure a burg feels from the uncleared dungeons around it, in [0, 1].
 *
 * Contributions from every UNCLEARED site within RAID_RADIUS_FT accumulate
 * probabilistically (so more nearby threats push toward 1 without ever exceeding
 * it), each scaled by a linear distance falloff (1 at the burg, 0 at the radius).
 * Cleared sites contribute nothing; a world with no nearby uncleared sites reads
 * exactly 0.
 *
 * No-fallback: a phantom-0 / removed / unknown burg is a caller bug → throw.
 *
 * @param worldSeed  World seed (drives site enumeration).
 * @param burgId     A live burg id.
 * @param clearedSet Frozen site paths the party has cleared (order-free).
 */
export function raidPressureForBurg(
  worldSeed: number,
  burgId: number,
  clearedSet?: Iterable<string>,
): number {
  const atlas = getBridgeAtlas(worldSeed);
  const burgs = (atlas.pack.burgs ?? []) as BurgLike[];
  const b = burgs[burgId];
  if (!b || b.i === 0 || b.removed || typeof b.cell !== 'number') {
    throw new Error(
      `raidPressureForBurg: burg ${burgId} in world ${worldSeed} is unknown, phantom-0, or removed.`,
    );
  }
  const p = atlas.pack.cells.p as ReadonlyArray<readonly [number, number]>;
  const burgPos = cellPosFt(p, b.cell);

  const cleared = clearedSet instanceof Set ? clearedSet : new Set(clearedSet ?? []);
  const radius2 = RAID_RADIUS_FT * RAID_RADIUS_FT;

  // Combine probabilistically: pressure = 1 - Π(1 - contribution). Order-free,
  // monotone in both proximity and count, bounded to [0, 1).
  let survive = 1;
  for (const site of enumerateDungeonSites(worldSeed)) {
    if (cleared.has(site.sitePath)) continue; // cleared sites raid nothing
    const dx = site.posFt.x - burgPos.x;
    const dy = site.posFt.y - burgPos.y;
    const d2 = dx * dx + dy * dy;
    if (d2 > radius2) continue; // beyond raiding reach
    const d = Math.sqrt(d2);
    const falloff = 1 - d / RAID_RADIUS_FT; // 1 at burg → 0 at radius
    survive *= 1 - PER_SITE_PEAK * falloff;
  }
  return 1 - survive;
}
