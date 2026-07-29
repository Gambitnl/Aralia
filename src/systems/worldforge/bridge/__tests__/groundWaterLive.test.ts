import { describe, it, expect } from 'vitest';
import { getBridgeAtlas, getWorldforgeLocalForCell } from '../legacySubmapBridge';
import {
  makeGroundWorld,
  sampleGroundChunk,
  groundSurfaceY,
  canonicalTownWaterAndDecks,
} from '../groundChunkLoader';
import { getCanonicalTownWaterFeatures, getCanonicalTownPlan } from '../../town/canonicalTown';
import { buildWaterMesh } from '../../../world3d/waterGeometry';
import type { GroundWorld } from '../groundChunkLoader';

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

describe('town water is placed by the same transform as the town', () => {
  it('keeps the river inside the town envelope it was scaled into', () => {
    const burg = burgPoint();
    const { local, region } = getWorldforgeLocalForCell(SEED, CELL, {
      centerPx: [burg.x, burg.y],
    });
    const site = region.townSites.find((t) => t.burgId === BURG)!;
    const { waterBodies } = canonicalTownWaterAndDecks(SEED, site, local.bounds);

    const river = waterBodies.find((b) => b.kind === 'river')!;
    const FEET_TO_METERS = 0.3048;
    // The envelope, expressed in the same window-local meters as the body.
    const minX = (site.envelope.x - local.bounds.x) * FEET_TO_METERS;
    const minZ = (site.envelope.y - local.bounds.y) * FEET_TO_METERS;
    const maxX = minX + site.envelope.width * FEET_TO_METERS;
    const maxZ = minZ + site.envelope.height * FEET_TO_METERS;

    // The channel is buffered outward from the centerline, so allow its
    // half-width of overhang; the point is that it tracks THIS town's envelope.
    const slack = site.envelope.width * 0.05 * FEET_TO_METERS;
    for (const p of river.centerlineM!) {
      expect(p.x).toBeGreaterThanOrEqual(minX - slack);
      expect(p.x).toBeLessThanOrEqual(maxX + slack);
      expect(p.z).toBeGreaterThanOrEqual(minZ - slack);
      expect(p.z).toBeLessThanOrEqual(maxZ + slack);
    }
  }, 120000);
});
