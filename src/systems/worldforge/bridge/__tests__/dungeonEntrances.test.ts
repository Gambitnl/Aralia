/**
 * @file dungeonEntrances.test.ts — Pillar 2, Task 6: world surfacing.
 *
 * Verifies the GroundWorld dungeon-entrance assembly:
 *  - entrances appear for dungeon sites whose mouth falls in the window;
 *  - the seam fix: dungeon-flavored FMG markers no longer produce SURFACE
 *    hostiles (they surface as entrances instead) — no double spawn;
 *  - determinism + no double-registration (stable ids, idempotent);
 *  - the discovered name is the dungeon's REAL derived name.
 */
import { describe, expect, it } from 'vitest';
import { getWorldforgeLocalForCell } from '../legacySubmapBridge';
import { enumerateDungeonSites } from '../../dungeon/world/dungeonSites';
import {
  dungeonEntrancesForWindow,
  dungeonNameForEntrance,
} from '../dungeonEntrances';
import {
  generateGroundHostiles,
  DUNGEON_ENTRANCE_MARKER_TYPES,
} from '../groundHostiles';
import { makeGroundWorld } from '../groundChunkLoader';
import type { RegionMarker } from '../../artifacts';

const SEED = 42;

/** A dungeon-marker site + the ground window centered on its cell. */
function windowForFirstMarkerSite() {
  const sites = enumerateDungeonSites(SEED);
  const site = sites.find((s) => s.origin === 'marker') ?? sites[0];
  const { local, region } = getWorldforgeLocalForCell(SEED, site.cellId);
  return { site, local, region };
}

describe('dungeonEntrancesForWindow', () => {
  it('surfaces the dungeon site whose mouth falls in the window', () => {
    const { site, local } = windowForFirstMarkerSite();
    const entrances = dungeonEntrancesForWindow(SEED, local);
    const mine = entrances.find((e) => e.sitePath === site.sitePath);
    expect(mine).toBeDefined();
    // Anchored to the SITE's cell (recon trap 2), not any player cell.
    expect(mine!.cellId).toBe(site.cellId);
    expect(mine!.entranceKind).toBe(site.entranceKind);
    // Rebased into window-local meters, inside the window (with margin).
    const extentXM = local.bounds.width * 0.3048;
    const extentZM = local.bounds.height * 0.3048;
    expect(mine!.xM).toBeGreaterThanOrEqual(-50);
    expect(mine!.xM).toBeLessThanOrEqual(extentXM + 50);
    expect(mine!.zM).toBeGreaterThanOrEqual(-50);
    expect(mine!.zM).toBeLessThanOrEqual(extentZM + 50);
    expect(mine!.discoveryRadiusM).toBeCloseTo(250 * 0.3048, 3);
  });

  it('is deterministic and free of duplicate ids (consume-once safe)', () => {
    const { local } = windowForFirstMarkerSite();
    const a = dungeonEntrancesForWindow(SEED, local);
    const b = dungeonEntrancesForWindow(SEED, local);
    expect(b).toEqual(a);
    const ids = a.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('names a discovered entrance with the dungeon\'s real derived name', () => {
    const { local } = windowForFirstMarkerSite();
    const [entrance] = dungeonEntrancesForWindow(SEED, local);
    expect(entrance).toBeDefined();
    const name = dungeonNameForEntrance(SEED, entrance.sitePath);
    expect(typeof name).toBe('string');
    expect(name!.length).toBeGreaterThan(0);
    // Cached: a second read is the same string.
    expect(dungeonNameForEntrance(SEED, entrance.sitePath)).toBe(name);
  });
});

describe('the hostile/entrance seam (no double spawn)', () => {
  it('dungeon-flavored marker types are NOT in the surface hostile set', () => {
    // The four types Pillar 2 claims as entrances.
    expect([...DUNGEON_ENTRANCE_MARKER_TYPES].sort()).toEqual(
      ['caves', 'disturbed-burials', 'dungeons', 'necropolises'].sort(),
    );
  });

  it('a dungeon-marker cell produces an entrance but NO surface hostiles for that marker', () => {
    // A synthetic window with exactly one dungeon marker at its center.
    const bounds = { x: 0, y: 0, width: 3000, height: 3000 };
    const markers: RegionMarker[] = [
      { type: 'dungeons', icon: 'd', x: 1500, y: 1500 },
    ];
    const hostiles = generateGroundHostiles(
      markers,
      undefined,
      SEED,
      bounds.x,
      bounds.y,
      bounds.width,
      bounds.height,
    );
    // The dungeon marker spawns nothing on the surface anymore — it's an entrance.
    expect(hostiles).toHaveLength(0);
  });

  it('non-dungeon hostile markers still spawn surface hostiles (unchanged)', () => {
    const bounds = { x: 0, y: 0, width: 3000, height: 3000 };
    const markers: RegionMarker[] = [
      { type: 'brigands', icon: 'b', x: 1500, y: 1500 },
    ];
    const hostiles = generateGroundHostiles(
      markers,
      undefined,
      SEED,
      bounds.x,
      bounds.y,
      bounds.width,
      bounds.height,
    );
    expect(hostiles.length).toBeGreaterThan(0);
  });
});

describe('makeGroundWorld integration', () => {
  it('carries dungeonEntrances and no surface hostiles from dungeon markers', () => {
    const { local, region } = windowForFirstMarkerSite();
    const world = makeGroundWorld(local, SEED, region);
    // At least the marker site itself surfaces as an entrance.
    expect(world.dungeonEntrances.length).toBeGreaterThan(0);
    // No surface hostile carries a dungeon-entrance marker type in its id.
    for (const h of world.hostiles) {
      for (const t of DUNGEON_ENTRANCE_MARKER_TYPES) {
        expect(h.id).not.toContain(`-${t}-`);
      }
    }
  });
});
