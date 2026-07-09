/**
 * @file pipeline.test.ts - cross-layer Worldforge integration checks.
 *
 * Unit tests pin each layer in isolation. This suite pins the chain across
 * world creation, FMG, region, local, and store regeneration so drift at one
 * boundary is caught where the player-facing pipeline actually crosses it.
 */
import { describe, expect, it } from 'vitest';
import { DEFAULT_WORLD_GEN_OPTIONS, type WorldGenOptions } from '../adapter/worldGenOptions';
import { applyDeltas } from '../delta/applyDeltas';
import {
  WORLD_DELTA_OPERATION_VERSION,
  WORLD_DELTA_SCHEMA_VERSION,
  type WorldDelta,
} from '../delta/types';
import {
  generateFmgWorld,
  type FmgWorldOptions,
  type FmgWorldResult,
} from '../fmg/generateWorld';
import { generateInterior } from '../interior/generateInterior';
import { blueprintForPlot } from '../interior/generateInterior';
import { briefForPlot } from '../town/householdBrief';
import { EXTERIOR } from '../interior/types';
import { generateLocal } from '../local/generateLocal';
import { generateRegion } from '../region/generateRegion';
import { rootSeedPath } from '../seedPath';
import { generateTownPlan as generateEngineTown } from '../town/townEngine';
import { toArtifactPlan } from '../town/townPlanAdapter';
import { boundsCenter } from '../units';
import { createWorld } from '../world/createWorld';
import { WorldStore } from '../world/worldStore';
import { makeGroundWorld } from '../bridge/groundChunkLoader';
import type { LocalArtifact, RegionArtifact, RegionTownSite, TownPlan } from '../artifacts';

// The artifact town plan for a region town site, via the owned Voronoi-ward
// generator (`townEngine`) + `toArtifactPlan` — the same path the live 2D/3D
// town pipeline uses (it replaced the retired rect `generateTownPlan.ts`). The
// burg's envelope becomes the generation footprint; population is fixed so the
// probe stays deterministic.
function townPlanForSite(site: RegionTownSite, seedPath: string): TownPlan {
  const e = site.envelope;
  const footprint: Array<[number, number]> = [
    [e.x, e.y],
    [e.x + e.width, e.y],
    [e.x + e.width, e.y + e.height],
    [e.x, e.y + e.height],
  ];
  return toArtifactPlan(generateEngineTown(footprint, seedPath, { population: 4000 }), site.burgId).plan;
}

// ---------------------------------------------------------------------------
// Fixed integration identity
// ---------------------------------------------------------------------------
// These values match the existing region/local test conventions. The chain
// golden freezes across all layers, so a legitimate layer change must update
// this suite intentionally.
// ---------------------------------------------------------------------------

const SEED_STR = 'world-42';
const WORLD_SEED = 42;
const ANCHOR_CELL = 110;
const ROAD_PROBE_ANCHOR_CELL = 476;
const FEET_PER_PIXEL = 1000;
const OPTIONS: WorldGenOptions = {
  ...DEFAULT_WORLD_GEN_OPTIONS,
  template: 'continents',
  cellsDesired: 10000,
  width: 960,
  height: 540,
};

interface Pipeline {
  created: ReturnType<typeof createWorld>;
  world: FmgWorldResult;
  region: RegionArtifact;
  local: LocalArtifact;
}

let cachedPipeline: Pipeline | null = null;

function buildPrimaryPipeline(): Pipeline {
  if (cachedPipeline) return cachedPipeline;

  const created = createWorld(SEED_STR, WORLD_SEED, OPTIONS);
  const world = generateFmgWorld(SEED_STR, toFmgOptions(OPTIONS));
  const region = generateRegion(world, ANCHOR_CELL, rootSeedPath(WORLD_SEED), {
    feetPerPixel: FEET_PER_PIXEL,
    world,
  });
  const local = generateLocal(region, boundsCenter(region.bounds), region.seedPath, {
    biomeId: world.pack.cells.biome![ANCHOR_CELL],
  });

  cachedPipeline = { created, world, region, local };
  return cachedPipeline;
}

function buildRoadProbePipeline(): Pipeline {
  const created = createWorld(SEED_STR, WORLD_SEED, OPTIONS);
  const world = generateFmgWorld(SEED_STR, toFmgOptions(OPTIONS));
  const region = generateRegion(
    world,
    ROAD_PROBE_ANCHOR_CELL,
    rootSeedPath(WORLD_SEED),
    {
      feetPerPixel: FEET_PER_PIXEL,
      world,
    },
  );
  const local = generateLocal(region, boundsCenter(region.bounds), region.seedPath, {
    biomeId: world.pack.cells.biome![ROAD_PROBE_ANCHOR_CELL],
  });

  return { created, world, region, local };
}

function buildTownProbePipeline(): Pipeline {
  const created = createWorld(SEED_STR, WORLD_SEED, OPTIONS);
  const world = generateFmgWorld(SEED_STR, toFmgOptions(OPTIONS));
  let anchor = -1;

  for (let cellId = 0; cellId < world.pack.cells.h.length; cellId++) {
    if (
      world.pack.cells.burg &&
      world.pack.cells.burg[cellId] > 0 &&
      world.pack.cells.h[cellId] >= 20
    ) {
      anchor = cellId;
      break;
    }
  }

  expect(anchor).toBeGreaterThanOrEqual(0);

  // Center the window on the burg point, exactly like production settlement
  // entry (getWorldforgeLocalForCell passes centerPx → windowCenterPx). This
  // also activates generateRegion's settlement dry-land floor (2026-07-04
  // coastal blue-flood fix): without it, this low coastal burg (h exactly 20,
  // the waterline) interpolates below the waterline everywhere under the new
  // water discipline, the whole window becomes `water`, and feature placement
  // rejects every sample (townFeatureCount 0) — the flooded-town artifact the
  // fix exists to prevent. Fixed 2026-07-06.
  const burgId = world.pack.cells.burg![anchor];
  const burg = (world.pack as unknown as { burgs: Array<{ x: number; y: number }> })
    .burgs[burgId];
  const region = generateRegion(
    world,
    anchor,
    rootSeedPath(WORLD_SEED),
    {
      feetPerPixel: FEET_PER_PIXEL,
      world,
      windowCenterPx: [burg.x, burg.y],
    },
  );
  const local = generateLocal(region, boundsCenter(region.bounds), region.seedPath, {
    biomeId: world.pack.cells.biome![anchor],
  });

  return { created, world, region, local };
}

// Living-interiors live clock: bake the walking-scale ground world from the
// same populated town probe (population 4000). makeGroundWorld runs the plot
// loop that stamps litHours / hearthHours / occupants onto each populated
// building record — the bake Tasks 3 + 7 add and this suite pins.
let cachedPopulatedGroundWorld: ReturnType<typeof makeGroundWorld> | null = null;
function buildPopulatedGroundWorld(): ReturnType<typeof makeGroundWorld> {
  if (cachedPopulatedGroundWorld) return cachedPopulatedGroundWorld;
  const probe = buildTownProbePipeline();
  cachedPopulatedGroundWorld = makeGroundWorld(probe.local, WORLD_SEED, probe.region, {
    hour: 12,
  });
  return cachedPopulatedGroundWorld;
}

// ---------------------------------------------------------------------------
// Hash helpers
// ---------------------------------------------------------------------------
// The region hash samples a stable stride from a large Float32Array. The local
// material hash consumes the full material index because it is byte-sized and
// is the fastest signal for local terrain-material drift.
// ---------------------------------------------------------------------------

function hashFloatSamples(samples: Float32Array): number {
  let hash = 0x811c9dc5;
  const stride = Math.max(1, Math.floor(samples.length / 1000));

  for (let i = 0; i < samples.length; i += stride) {
    const value = Math.round(samples[i] * 10000);
    hash ^= value & 0xff;
    hash = Math.imul(hash, 0x01000193);
    hash ^= (value >> 8) & 0xff;
    hash = Math.imul(hash, 0x01000193);
  }

  return hash >>> 0;
}

function hashBytes(bytes: Uint8Array): number {
  let hash = 0x811c9dc5;

  for (const byte of bytes) {
    hash ^= byte;
    hash = Math.imul(hash, 0x01000193);
  }

  return hash >>> 0;
}

function localMaterialAt(
  local: LocalArtifact,
  x: number,
  y: number,
): string | undefined {
  const cellX = Math.floor((x - local.bounds.x) / 5);
  const cellY = Math.floor((y - local.bounds.y) / 5);

  if (
    cellX < 0 ||
    cellY < 0 ||
    cellX >= local.terrain.widthCells ||
    cellY >= local.terrain.heightCells
  ) {
    return undefined;
  }

  const index = local.terrain.materialIndex[
    cellY * local.terrain.widthCells + cellX
  ];
  return local.terrain.materials[index];
}

function regionHeightAt(
  region: RegionArtifact,
  x: number,
  y: number,
): number | undefined {
  const col = Math.round((x - region.bounds.x) / region.heightfield.resolutionFt);
  const row = Math.round((y - region.bounds.y) / region.heightfield.resolutionFt);

  if (
    col < 0 ||
    row < 0 ||
    col >= region.heightfield.width ||
    row >= region.heightfield.height
  ) {
    return undefined;
  }

  return region.heightfield.samples[row * region.heightfield.width + col];
}

function makeChainDelta(): WorldDelta {
  return {
    id: 'chain-smoke-delta',
    schemaVersion: WORLD_DELTA_SCHEMA_VERSION,
    opVersion: WORLD_DELTA_OPERATION_VERSION,
    artifactSeedPath: rootSeedPath(WORLD_SEED),
    entityKey: 'feature:1',
    sequence: 1,
    operation: {
      kind: 'remove-feature',
      featureId: 1,
    },
  };
}

function makeTownPlotDelta(local: LocalArtifact, plotId: number): WorldDelta {
  return {
    id: 'town-plot-contract-delta',
    schemaVersion: WORLD_DELTA_SCHEMA_VERSION,
    opVersion: WORLD_DELTA_OPERATION_VERSION,
    artifactSeedPath: local.seedPath,
    entityKey: `plot:${plotId}`,
    sequence: 1,
    operation: {
      kind: 'modify-plot',
      plotId,
      role: 'inn',
      storeys: 3,
    },
  };
}

// Change an existing house into a market because L4 maps market plots to a
// shopfloor entry room. This proves plot role deltas reach interior generation.
function makeInteriorRoleDelta(local: LocalArtifact, plotId: number): WorldDelta {
  return {
    id: 'town-interior-role-delta',
    schemaVersion: WORLD_DELTA_SCHEMA_VERSION,
    opVersion: WORLD_DELTA_OPERATION_VERSION,
    artifactSeedPath: local.seedPath,
    entityKey: `plot:${plotId}`,
    sequence: 1,
    operation: {
      kind: 'modify-plot',
      plotId,
      role: 'market',
      storeys: 2,
    },
  };
}

// Add a new building as a real plot with a shifted copy of generated geometry.
// The shifted footprint stays deterministic while avoiding collision with the
// source plot in the replayed TownPlan.
function makeInteriorBuildingDelta(local: LocalArtifact, plotId: number): WorldDelta {
  const sourcePlot = local.townPlan?.plots[0];

  expect(sourcePlot).toBeDefined();

  return {
    id: 'town-add-building-interior-delta',
    schemaVersion: WORLD_DELTA_SCHEMA_VERSION,
    opVersion: WORLD_DELTA_OPERATION_VERSION,
    artifactSeedPath: local.seedPath,
    entityKey: `plot:${plotId}`,
    sequence: 2,
    operation: {
      kind: 'add-building',
      plotId,
      buildingId: 50_001,
      role: 'market',
      storeys: 2,
      footprint: sourcePlot!.footprint.map(([x, y]) => [x + 120, y + 120]),
      featureData: { sign: 'new-market' },
    },
  };
}

// Remove one generated plot so the integration test can prove replay leaves no
// orphan plot for L4 to generate later.
function makeRemovePlotDelta(local: LocalArtifact, plotId: number): WorldDelta {
  return {
    id: 'town-remove-plot-interior-delta',
    schemaVersion: WORLD_DELTA_SCHEMA_VERSION,
    opVersion: WORLD_DELTA_OPERATION_VERSION,
    artifactSeedPath: local.seedPath,
    entityKey: `plot:${plotId}`,
    sequence: 3,
    operation: {
      kind: 'remove-plot',
      plotId,
    },
  };
}

// Interior role assertions follow the actual street door rather than assuming
// room 0 is always the entry room.
function entryRoomRole(plan: ReturnType<typeof generateInterior>): string | undefined {
  const entryDoor = plan.doorways.find((doorway) => doorway.a === EXTERIOR);

  return plan.rooms.find((room) => room.id === entryDoor?.b)?.role;
}

function toFmgOptions(options: WorldGenOptions): FmgWorldOptions {
  return {
    ...options,
    mapSize: options.mapSize ?? undefined,
    latitude: options.latitude ?? undefined,
    longitude: options.longitude ?? undefined,
  };
}

// ---------------------------------------------------------------------------
// Chain golden
// ---------------------------------------------------------------------------
// This freezes the whole chain at one compact checkpoint. If any layer changes
// its deterministic output, this test fails even if the layer's own unit tests
// miss the cross-boundary effect.
// ---------------------------------------------------------------------------

describe('worldforge pipeline integration', () => {
  it('runs createWorld -> generateRegion -> generateLocal and pins chain goldens', () => {
    const { created, region, local } = buildPrimaryPipeline();

    expect({
      atlasCellCount: created.artifact.cells.length,
      regionHeightfieldHash: hashFloatSamples(region.heightfield.samples),
      localMaterialHash: hashBytes(local.terrain.materialIndex),
    }).toEqual({
      // Chain goldens re-frozen 2026-06-11 (WF-G4): region bounds became a
      // fixed anchor-centered 25,000 ft window, shifting the heightfield and
      // the local window derived from its center. Pre-release world break,
      // recorded in the Worldforge tracker.
      // Re-frozen 2026-06-11 ~13:55 (relief calibration: ridged macro octave,
      // 8,000 ft landforms + smoothstep lattice weights — Remy quality pass).
      // Re-frozen 2026-06-12 (WF-G5): L1 river carving now follows the same
      // smoothed river band as the renderer, shifting the region heightfield
      // and the downstream local material classification along tight bends.
      // Re-frozen 2026-06-30 (Stage 5 S5.2): the L2 fine-detail octaves now come
      // from a GLOBAL world-feet lattice (makeWorldFeetNoise) instead of a
      // per-Local lattice, so terrain is continuous across cell boundaries (no
      // seam). Only localMaterialHash shifts (a few cells reclassify near slope
      // thresholds); the atlas + region heightfield are byte-identical (this
      // touches L2 detail only). Determinism + smoothness invariants still green.
      // Re-frozen 2026-07-01 (open-region seam): the L1 region RELIEF noise now
      // also comes from the world-feet lattice (world seed + octave) instead of
      // per-region grid noise, so two adjacent regions meet with no ~350ft cliff
      // at their shared border (see generateRegion cross-region seam test +
      // .agent/scratch/seam-proof). Both the region heightfield AND the local
      // material (downstream of it) shift. Smoothness + determinism still green.
      // Re-frozen 2026-07-02 (open-region seam, IDW purity): the L1 IDW base is
      // now a pure function of world position (per-sample fixed-radius cell
      // neighborhood instead of per-region BFS membership), river carving
      // smooths the FULL centerline before windowing, and the region window
      // origin snaps to the 100 ft sample lattice — adjacent regions now agree
      // EXACTLY at shared world points (seamProbe budget tightened <50 → <1 ft).
      // Region heightfield + downstream local material shift.
      // Re-frozen 2026-07-06 (coastal blue-flood fix, landed 2026-07-04): water
      // discipline now keys off the INTERPOLATED surface height instead of the
      // single nearest cell, so thin land spits near ocean cells are no longer
      // force-clamped underwater. Only the region heightfield shifts here; the
      // primary window's material classification is unchanged (localMaterialHash
      // identical). The generateRegion unit golden was re-frozen in the same
      // change; this chain golden was missed.
      atlasCellCount: 6005,
      regionHeightfieldHash: 2801916318,
      localMaterialHash: 423127639,
    });
  }, 60_000); // world gen now includes Military/Markers/Zones (stages 33-35)

  it('preserves atlas water through region height and local water material when sampled in-bounds', () => {
    const { world, region } = buildPrimaryPipeline();

    let checkedWaterCell = false;

    for (let cellId = 0; cellId < world.pack.cells.h.length; cellId++) {
      if (world.pack.cells.h[cellId] >= 20) continue;

      const [px, py] = world.pack.cells.p[cellId];
      const x = px * FEET_PER_PIXEL;
      const y = py * FEET_PER_PIXEL;
      const regionHeight = regionHeightAt(region, x, y);
      if (regionHeight === undefined || regionHeight >= 0.2) continue;

      const local = generateLocal(region, { x, y }, region.seedPath, {
        biomeId: world.pack.cells.biome![ANCHOR_CELL],
      });
      const material = localMaterialAt(local, x, y);

      expect(regionHeight).toBeLessThan(0.2);
      expect(material).toBe('water');
      checkedWaterCell = true;
      break;
    }

    expect(checkedWaterCell).toBe(true);
  });

  it('turns a region road crossing local bounds into local paved or dirt cells', () => {
    // WF-G4 (2026-06-11): region bounds are now a fixed anchor-centered
    // 25,000 ft window, so the old approach — local at the region CENTER and
    // hoping a road happens to cross it — no longer holds for this probe
    // anchor. Probe the contract directly instead: center the local window
    // ON a road centerline point and require the road to stamp there.
    const { world, region } = buildRoadProbePipeline();

    expect(region.roads.length).toBeGreaterThan(0);

    const road = region.roads[0];
    const probe = road.centerline[Math.floor(road.centerline.length / 2)];
    const local = generateLocal(region, { x: probe[0], y: probe[1] }, region.seedPath, {
      biomeId: world.pack.cells.biome![ROAD_PROBE_ANCHOR_CELL],
    });

    const material = localMaterialAt(local, probe[0], probe[1]);
    expect(['paved', 'dirt']).toContain(material);
  }, 30_000); // full world+region+local chain; 5s default flakes under parallel load

  it('round-trips the world store and regenerates byte-equal region and local outputs', () => {
    const store = new WorldStore(SEED_STR, WORLD_SEED, OPTIONS);
    store.appendDelta(makeChainDelta());
    const serialized = store.serialize();
    const restored = WorldStore.deserialize(serialized);

    expect(restored.view()).toEqual(store.view());

    const restoredPayload = JSON.parse(serialized) as {
      seedStr: string;
      worldSeed: number;
      options: WorldGenOptions;
    };
    const original = buildPrimaryPipeline();
    const restoredWorld = generateFmgWorld(
      restoredPayload.seedStr,
      toFmgOptions(restoredPayload.options),
    );
    const restoredRegion = generateRegion(
      restoredWorld,
      ANCHOR_CELL,
      rootSeedPath(restoredPayload.worldSeed),
      {
        feetPerPixel: FEET_PER_PIXEL,
        world: restoredWorld,
      },
    );
    const restoredLocal = generateLocal(
      restoredRegion,
      boundsCenter(restoredRegion.bounds),
      restoredRegion.seedPath,
      {
        biomeId: restoredWorld.pack.cells.biome![ANCHOR_CELL],
      },
    );

    expect(Array.from(restoredRegion.heightfield.samples)).toEqual(
      Array.from(original.region.heightfield.samples),
    );
    expect(Array.from(restoredLocal.terrain.materialIndex)).toEqual(
      Array.from(original.local.terrain.materialIndex),
    );
  }, 30_000); // regenerates the full chain twice; 5s default flakes under parallel load

  it('persists and replays a generated TownPlan plot delta through the world store', () => {
    const townProbe = buildTownProbePipeline();
    const site = townProbe.region.townSites[0];

    expect(site).toBeDefined();

    const townPlan = townPlanForSite(site, townProbe.region.seedPath);
    const localWithTownPlan: LocalArtifact = {
      ...townProbe.local,
      townPlan,
    };
    const targetPlotId = townPlan.plots[0].id;
    const townDelta = makeTownPlotDelta(localWithTownPlan, targetPlotId);

    const store = new WorldStore(SEED_STR, WORLD_SEED, OPTIONS);
    store.appendDelta(townDelta);
    const restored = WorldStore.deserialize(store.serialize());
    const restoredPayload = JSON.parse(restored.serialize()) as {
      deltas: WorldDelta[];
    };

    const originalReplay = applyDeltas(localWithTownPlan, [townDelta]);
    const restoredReplay = applyDeltas(localWithTownPlan, restoredPayload.deltas);

    // The byte-for-byte persistence contract: a serialized+restored replay equals
    // the in-memory replay. This is generator-independent and is the real point.
    expect(restoredReplay).toEqual(originalReplay);
    // A coarse golden over stable shape. Exact footprint floats are deliberately
    // NOT pinned here — they're brittle and the round-trip above already proves
    // the geometry survives. Plot 0's role/storeys come from the modify-plot
    // delta (inn / 3), not the generator.
    expect({
      burgId: restoredReplay.artifact.townPlan?.burgId,
      plotCount: restoredReplay.artifact.townPlan?.plots.length,
      firstPlotId: restoredReplay.artifact.townPlan?.plots[0]?.id,
      firstPlotRole: restoredReplay.artifact.townPlan?.plots[0]?.role,
      firstPlotStoreys: restoredReplay.artifact.townPlan?.plots[0]?.storeys,
      firstPlotCorners: restoredReplay.artifact.townPlan?.plots[0]?.footprint.length,
      townFeatureCount: restoredReplay.artifact.features.length,
    }).toEqual({
      burgId: 264,
      // 2026-06-27: re-pointed to the canonical Voronoi-ward generator
      // (`townEngine` + `toArtifactPlan`) after the rect `generateTownPlan.ts`
      // was retired. The probe burg now yields 216 plots.
      plotCount: 216,
      firstPlotId: 0,
      firstPlotRole: 'inn',
      firstPlotStoreys: 3,
      firstPlotCorners: 4,
      townFeatureCount: 1395,
    });
  }, 60_000);

  it('keeps plot deltas coherent with generated interiors', () => {
    const townProbe = buildTownProbePipeline();
    const site = townProbe.region.townSites[0];

    expect(site).toBeDefined();

    const townPlan = townPlanForSite(site, townProbe.region.seedPath);
    const localWithTownPlan: LocalArtifact = {
      ...townProbe.local,
      townPlan,
    };
    const housePlot = townPlan.plots.find((plot) => plot.role === 'house');
    const plotToRemove = townPlan.plots.find((plot) => plot.id !== housePlot?.id);

    expect(housePlot).toBeDefined();
    expect(plotToRemove).toBeDefined();

    const newPlotId = Math.max(...townPlan.plots.map((plot) => plot.id)) + 100;
    const replay = applyDeltas(localWithTownPlan, [
      makeInteriorRoleDelta(localWithTownPlan, housePlot!.id),
      makeInteriorBuildingDelta(localWithTownPlan, newPlotId),
      makeRemovePlotDelta(localWithTownPlan, plotToRemove!.id),
    ]);

    expect(replay.warnings).toEqual([]);

    const originalInterior = generateInterior(housePlot!, localWithTownPlan.seedPath);
    const modifiedPlot = replay.artifact.townPlan?.plots.find(
      (plot) => plot.id === housePlot!.id,
    );
    const addedPlot = replay.artifact.townPlan?.plots.find(
      (plot) => plot.id === newPlotId,
    );
    const removedPlot = replay.artifact.townPlan?.plots.find(
      (plot) => plot.id === plotToRemove!.id,
    );

    expect(modifiedPlot).toBeDefined();
    expect(addedPlot).toBeDefined();
    expect(removedPlot).toBeUndefined();

    const modifiedInterior = generateInterior(modifiedPlot!, replay.artifact.seedPath);
    const addedInterior = generateInterior(addedPlot!, replay.artifact.seedPath);
    const addedExteriorDoor = addedInterior.doorways.find(
      (doorway) => doorway.a === EXTERIOR,
    );

    expect(entryRoomRole(originalInterior)).toBe('hall');
    expect(entryRoomRole(modifiedInterior)).toBe('shopfloor');
    expect(addedInterior.rooms.length).toBeGreaterThan(0);
    expect(addedExteriorDoor).toBeDefined();
    expect({
      modifiedPlotRole: modifiedPlot?.role,
      modifiedInteriorEntryRole: entryRoomRole(modifiedInterior),
      addedPlotRole: addedPlot?.role,
      addedInteriorRoomCount: addedInterior.rooms.length,
      hasAddedExteriorDoor: Boolean(addedExteriorDoor),
      removedPlotPresent: Boolean(removedPlot),
    }).toEqual({
      modifiedPlotRole: 'market',
      modifiedInteriorEntryRole: 'shopfloor',
      addedPlotRole: 'market',
      // 2026-06-14: the workshop role shifts the plot-id counter, so
      // newPlotId (= max plot id + 100) changed, reseeding the added
      // building's room-packing → 9 rooms.
      // 2026-06-25: re-frozen for the 2026-06-24 typology + civic-anatomy town-gen
      // pass. More plots (15) shift max-plot-id, so newPlotId changes again,
      // reseeding the added building's room-packing → 7 rooms.
      // 2026-06-27: re-pointed to the canonical townEngine generator (rect
      // generateTownPlan.ts retired). 216 plots → max-plot-id +100 reseeds the
      // added building again → 1 room. Role/delta logic unchanged (market →
      // shopfloor); only the geometry seed moved.
      // 2026-07-06 (Task 10): generateInterior is now an adapter over the
      // blueprint generator (generateBuilding) — interiors re-rolled once
      // (approved plan consequence). The added market building packs 2 rooms.
      addedInteriorRoomCount: 2,
      hasAddedExteriorDoor: true,
      removedPlotPresent: false,
    });
  }, 60_000);

  // BGv2 Task 11: the population pass tags plots with a concrete building type
  // and a founding household; toArtifactPlan must carry that `pop` through so
  // the 3D bake can rebuild the brief and design each interior for its family.
  it('carries the population pass into the artifact plan and threads the brief into interiors', () => {
    const townProbe = buildTownProbePipeline();
    const site = townProbe.region.townSites[0];
    expect(site).toBeDefined();

    const seedPath = townProbe.region.seedPath;
    const townPlan = townPlanForSite(site, seedPath);

    // A populated town (population: 4000) tags residential plots with a
    // buildingType, homeId, occupants — carried on the artifact plot as `pop`.
    const pops = townPlan.plots
      .map((plot) => plot.pop)
      .filter((pop): pop is NonNullable<typeof pop> => pop !== undefined);
    expect(pops.length).toBeGreaterThan(0);

    const homePlot = townPlan.plots.find(
      (plot) => plot.pop?.residential && plot.pop.homeId && (plot.pop.occupants ?? 0) > 0,
    );
    expect(homePlot).toBeDefined();

    // briefForPlot resolves the SAME seed the tooltip households key on (the
    // town's seed path), so the family the house is built for is the tooltip
    // family. A residential, occupied plot yields a brief with that homeId.
    const brief = briefForPlot(homePlot!.pop!, pops, seedPath);
    expect(brief).toBeDefined();
    expect(brief!.homeId).toBe(homePlot!.pop!.homeId);

    // Threading the brief + concrete type into blueprintForPlot designs the
    // interior for that family: the type override wins and the plan echoes the
    // household. The briefless plan (no pop) stays byte-identical to before.
    const briefed = blueprintForPlot(
      {
        id: homePlot!.id,
        footprint: homePlot!.footprint,
        role: homePlot!.role,
        storeys: homePlot!.storeys,
        buildingType: homePlot!.pop!.buildingType,
        household: brief,
      },
      seedPath,
    );
    expect(briefed.type).toBe(homePlot!.pop!.buildingType);
    expect(briefed.household?.homeId).toBe(brief!.homeId);

    const briefless = blueprintForPlot(
      { id: homePlot!.id, footprint: homePlot!.footprint, role: homePlot!.role, storeys: homePlot!.storeys },
      seedPath,
    );
    expect(briefless.household).toBeUndefined();
  }, 60_000);

  // Living-interiors live clock (Task 3): the 3D bake stamps a full 24-hour
  // window/hearth lighting schedule onto every populated building, so the
  // renderer can light windows at dusk and darken them by day against the live
  // clock — no re-enter, no re-mesh.
  it('bakes a 24-hour lighting schedule onto populated buildings', () => {
    const world = buildPopulatedGroundWorld();
    const lit = world.buildings.filter((b) => b.litHours);
    expect(lit.length).toBeGreaterThan(0);
    for (const b of lit) {
      expect(b.litHours).toHaveLength(24);
      expect(b.hearthHours).toHaveLength(24);
      // A populated house is dark-windowed at noon (windows only glow at dusk).
      expect(b.litHours![12]).toBe(false);
    }
  }, 60_000);

  // Living-interiors live clock (Task 7): the bake carries each family member as
  // an occupant render packet (24-hour station table + body) instead of freezing
  // occupant boxes into the static parts — the renderer moves them live.
  it('bakes an occupant render schedule and NO occupant boxes in parts', () => {
    const world = buildPopulatedGroundWorld();
    const b = world.buildings.find((x) => x.occupants && x.occupants.length > 0);
    expect(b).toBeDefined();
    expect(b!.occupants![0].stationsByHour).toHaveLength(24);
    expect(b!.occupants![0].body).toBeDefined();
    // Interior frame (plan feet) rides along so the renderer can place stations.
    expect(b!.interiorWidthFt).toBeGreaterThan(0);
    expect(b!.interiorDepthFt).toBeGreaterThan(0);
    // Occupant geometry is no longer baked into the static parts of a populated
    // building (its family renders live from `occupants`) — the bake passes an
    // empty occFigures roster, so no occupant boxes land in parts.
    const occupantBoxes = (b!.parts ?? []).filter((p) => p.tag === 'occupant');
    expect(occupantBoxes.length).toBe(0);
  }, 60_000);
});
