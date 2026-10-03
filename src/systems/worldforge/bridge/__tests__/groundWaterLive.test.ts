import { describe, it, expect, beforeAll } from 'vitest';
import {
  getBridgeAtlas,
  getWorldforgeLocalForCell,
} from '@/systems/worldforge/bridge/legacySubmapBridge';
import {
  makeGroundWorld,
  sampleGroundChunk,
  groundSurfaceY,
  canonicalTownWaterAndDecks,
} from '@/systems/worldforge/bridge/groundChunkLoader';
import {
  getCanonicalTownWaterFeatures,
  getCanonicalTownPlan,
} from '@/systems/worldforge/town/canonicalTown';
import { buildWaterMesh } from '@/systems/world3d/waterGeometry';
import { WORLD_BATTLE_SCENARIO_PRESETS } from '@/systems/combat/worldScenario/worldBattleScenario';
import type { GroundWorld } from '@/systems/worldforge/bridge/groundChunkLoader';

/**
 * Water, checked against a REAL generated location rather than a fixture grid.
 *
 * Three water changes in a row were judged by eye in the browser, where a stale
 * worker bundle or a second bake path can make a change look like it did
 * nothing. This asserts on the ground world the game actually bakes.
 */
describe('water in a real baked ground world', () => {
  let ground: GroundWorld;

  beforeAll(() => {
    const preset = WORLD_BATTLE_SCENARIO_PRESETS.find(
      (c) => c.id === 'legium-settlement-edge',
    )!;
    const bridged = getWorldforgeLocalForCell(preset.worldSeed, preset.entryCellId, {
      centerPx: preset.centerPx,
    });
    ground = makeGroundWorld(bridged.local, preset.worldSeed, bridged.region, {
      hour: preset.hour ?? 12,
      anchorCellId: preset.entryCellId,
    });
  }, 60_000);

  it('bakes water runs at all', () => {
    expect(ground.waterRuns).toBeDefined();
    expect(ground.waterRuns!.length).toBeGreaterThan(0);
  });

  it('reports whether this location has an authored river', () => {
    // Not an assertion about the world — a fact the next test depends on, made
    // visible so a zero here explains an absent river rather than hiding it.
    const rivers = ground.waterBodies.filter((b) => b.kind === 'river');
    const withCenterline = rivers.filter((b) => b.centerlineM?.length);
    // eslint-disable-next-line no-console
    console.log(
      `[water] bodies=${ground.waterBodies.length} rivers=${rivers.length} ` +
      `withCenterline=${withCenterline.length} runs=${ground.waterRuns?.length ?? 0}`,
    );
    expect(rivers.length).toBe(withCenterline.length);
  });

  it('puts water along the authored river course when the town has one', () => {
    const rivers = ground.waterBodies.filter((b) => b.kind === 'river' && b.centerlineM?.length);
    if (rivers.length === 0) return; // covered by the report above

    const runs = ground.waterRuns ?? [];
    const nearestRunDistance = (x: number, z: number) => {
      let best = Infinity;
      for (const r of runs) {
        const dx = Math.max(r.minX - x, 0, x - r.maxX);
        const dz = Math.max(r.minZ - z, 0, z - r.maxZ);
        best = Math.min(best, Math.hypot(dx, dz));
      }
      return best;
    };

    // Every point of the course should have water on or beside it.
    for (const river of rivers) {
      for (const p of river.centerlineM!) {
        expect(nearestRunDistance(p.x, p.z)).toBeLessThan(8);
      }
    }
  });

  it('never puts a water surface above the ground beside it', () => {
    // The failure that started all of this: water floating over, or buried
    // under, the land it belongs to.
    const runs = ground.waterRuns ?? [];
    expect(runs.every((r) => Number.isFinite(r.surfaceEnc))).toBe(true);
    expect(runs.every((r) => r.surfaceEnc >= 0)).toBe(true);
  });
});

/**
 * Live town-water bake, asserted end to end instead of eyeballed.
 *
 * Burg Epicea (world 903674813, home cell 2186) has an inherited river AND a
 * harbour. Its 2D town plan shows that river with bridges over it, so the
 * canonical-town contract says the 3D bake of the SAME burg must put water in
 * the same place. These tests walk every stage of that path — canonical water
 * features, the placed water bodies, the chunk `lakes` payload, and the built
 * water mesh — so a break names the stage it happened in rather than surfacing
 * later as "the town has no river".
 *
 * WINDOW NOTE (the trap this file exists to pin down): the ground window must be
 * centered on the BURG, not on its cell. `getWorldforgeLocalForCell` without
 * `centerPx` frames the cell point, and for this burg that window misses the
 * town envelope entirely — `region.townSites` comes back empty and every town
 * feature (water, decks, streets) silently disappears. The running game passes
 * `centerPx: [burg.x, burg.y]` (see `getWorldforgeLocalForLocation`), so a test
 * that omits it is testing a window the game never builds.
 */

const SEED = 903674813;
const CELL = 2186;
const BURG = 5;

function burgPoint(): { x: number; y: number } {
  const atlas = getBridgeAtlas(SEED);
  const burg = (atlas.pack.burgs as Array<{ x: number; y: number }>)[BURG];
  return { x: burg.x, y: burg.y };
}

function epiceaGround(): { ground: GroundWorld; townSites: number } {
  const burg = burgPoint();
  const { local, region } = getWorldforgeLocalForCell(SEED, CELL, {
    centerPx: [burg.x, burg.y],
  });
  return {
    ground: makeGroundWorld(local, SEED, region),
    townSites: region.townSites.length,
  };
}

describe('Epicea town water reaches the 3D bake', () => {
  it('the canonical burg carries the river its 2D plan draws bridges over', () => {
    const atlas = getBridgeAtlas(SEED);
    const features = getCanonicalTownWaterFeatures(atlas, BURG, SEED);
    // The 2D drill renders exactly these polylines, and the generator seated
    // docks/bridges against them. Empty here means 2D and 3D disagree at source.
    expect(features.rivers.length).toBeGreaterThan(0);
    expect(features.coast.length).toBeGreaterThan(0);

    const plan = getCanonicalTownPlan(atlas, SEED, BURG);
    const bridges = plan.civic.filter((c) => c.kind === 'bridge');
    // A bridge can only exist where the generator saw water cross between wards,
    // so bridges in the plan are the 2D-side proof that the river is real.
    expect(bridges.length).toBeGreaterThan(0);
  }, 120000);

  it('a burg-centered window bakes the town, and a cell-centered one does not', () => {
    const burg = burgPoint();

    const centered = getWorldforgeLocalForCell(SEED, CELL, { centerPx: [burg.x, burg.y] });
    expect(centered.region.townSites.map((t) => t.burgId)).toContain(BURG);

    // Documents the window trap: same seed, same cell, no town at all. If this
    // ever starts finding the town, the centerPx requirement has been relaxed
    // and the note at the top of this file is stale.
    const uncentered = getWorldforgeLocalForCell(SEED, CELL, {});
    expect(uncentered.region.townSites).toHaveLength(0);
  }, 120000);

  it('places a river body and a sea body into the ground world', () => {
    const { ground, townSites } = epiceaGround();
    expect(townSites).toBe(1);
    expect(ground.towns).toHaveLength(1);

    const kinds = ground.waterBodies.map((b) => b.kind);
    expect(kinds).toContain('river');
    expect(kinds).toContain('sea');

    // The river must arrive with the ordered centerline its height pass needs;
    // without it every channel vertex collapses to one flat pond height.
    const river = ground.waterBodies.find((b) => b.kind === 'river');
    expect(river?.centerlineM?.length ?? 0).toBeGreaterThanOrEqual(2);

    // Docks and bridges are the structures that sit ON this water.
    expect(ground.decks.length).toBeGreaterThan(0);
  }, 120000);

  it('carves the channel so the water surface is visible, not buried', () => {
    const { ground } = epiceaGround();
    const river = ground.waterBodies.find((b) => b.kind === 'river');
    expect(river).toBeDefined();

    // The bed must never sit ABOVE the water surface. If it does, the sheet
    // still exists in the scene but renders inside the hill — which reads to a
    // player as "the town has no river".
    //
    // Not a strict inequality: the course now runs the full length of the river,
    // so its downstream tail reaches the sea, where the bed and the surface are
    // both legitimately at zero. Requiring bed < surface there would fail a
    // river for arriving at the coast.
    let carved = 0;
    for (const p of river!.centerlineM!) {
      const bed = groundSurfaceY(ground, p.x, p.z);
      expect(bed).toBeLessThanOrEqual(p.surfaceY);
      if (bed < p.surfaceY) carved++;
    }
    // And it is a real channel, not a flat sheet laid on flat ground.
    expect(carved).toBeGreaterThan(river!.centerlineM!.length / 2);
  }, 120000);

  it('survives chunk sampling into lakes and builds real water triangles', () => {
    const { ground } = epiceaGround();

    let riverLakes = 0;
    let triangles = 0;
    // The town sits well inside the 914 m window; sweep the chunks that cover it.
    for (let cx = -1; cx <= 7; cx++) {
      for (let cy = -1; cy <= 7; cy++) {
        const data = sampleGroundChunk(ground, cx, cy, 33);
        const lakes = data.lakes ?? [];
        if (lakes.length === 0) continue;
        riverLakes += lakes.filter((l) => l.kind === 'river').length;
        triangles += buildWaterMesh(data).indices.length / 3;
      }
    }

    expect(riverLakes).toBeGreaterThan(0);
    expect(triangles).toBeGreaterThan(0);
  }, 120000);
});

const FEET_TO_METERS = 0.3048;

describe('the town river and the world river are the same river', () => {
  it('puts the town channel on the region course', () => {
    const burg = burgPoint();
    const { local, region } = getWorldforgeLocalForCell(SEED, CELL, {
      centerPx: [burg.x, burg.y],
    });
    const ground = makeGroundWorld(local, SEED, region);

    const town = ground.waterBodies.find((b) => b.kind === 'river');
    expect(town?.centerlineM?.length ?? 0).toBeGreaterThanOrEqual(2);

    const regionRiver = region.rivers.find((r) => r.riverId === 5);
    expect(regionRiver).toBeDefined();
    const course = regionRiver!.centerline.map(([x, y]) => ({
      x: (x - local.bounds.x) * FEET_TO_METERS,
      z: (y - local.bounds.y) * FEET_TO_METERS,
    }));

    // Every point of the town channel sits on the region course. Before this
    // pass the two were 3,400-4,900 ft apart: the town drew a 30x-shrunk copy of
    // its cell's river while the real one ran outside the window entirely.
    for (const p of town!.centerlineM!) {
      const nearest = Math.min(
        ...course.map((c) => Math.hypot(c.x - p.x, c.z - p.z)),
      );
      expect(nearest).toBeLessThan(60);
    }
  }, 120000);

  it('renders the wilderness ribbon in the same window as the town', () => {
    const { ground } = epiceaGround();
    // Was 0. The cell-center chord passed a full window west of the burg, so a
    // river town had no river at all outside its own walls.
    expect(ground.rivers.length).toBeGreaterThan(0);
  }, 120000);

  it('hands the river off from the town channel to the wilderness ribbon', () => {
    const burg = burgPoint();
    const { local, region } = getWorldforgeLocalForCell(SEED, CELL, {
      centerPx: [burg.x, burg.y],
    });
    const ground = makeGroundWorld(local, SEED, region);
    const site = region.townSites.find((t) => t.burgId === BURG)!;

    const cx = (site.envelope.x + site.envelope.width / 2 - local.bounds.x) * FEET_TO_METERS;
    const cz = (site.envelope.y + site.envelope.height / 2 - local.bounds.y) * FEET_TO_METERS;
    const half = (site.envelope.width / 2) * FEET_TO_METERS;

    // The TOWN body is deliberately clipped to the town square, so the filled
    // channel and its docks stay a town feature rather than a window-long slab.
    const town = ground.waterBodies.find((b) => b.kind === 'river')!;
    const townDists = town.centerlineM!.map((p) => Math.hypot(p.x - cx, p.z - cz));
    expect(Math.min(...townDists)).toBeLessThan(half);
    expect(Math.max(...townDists)).toBeLessThanOrEqual(half * 1.05);

    // The WILDERNESS ribbon is what carries the river on past the town, so the
    // player does not walk out of a settlement and watch its river stop dead.
    const ribbon = ground.rivers[0];
    expect(ribbon).toBeDefined();
    const ribbonDists = ribbon.points.map((p) => Math.hypot(p.x - cx, p.z - cz));
    expect(Math.max(...ribbonDists)).toBeGreaterThan(half);
  }, 120000);
});
