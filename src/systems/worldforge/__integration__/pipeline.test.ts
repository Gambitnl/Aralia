/**
 * @file pipeline.test.ts - cross-layer Worldforge integration checks.
 *
 * Unit tests pin each layer in isolation. This suite pins the chain across
 * world creation, FMG, region, local, and store regeneration so drift at one
 * boundary is caught where the player-facing pipeline actually crosses it.
 */
import { describe, expect, it } from 'vitest';
import { DEFAULT_WORLD_GEN_OPTIONS, type WorldGenOptions } from '../adapter/worldGenOptions';
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
import { generateLocal } from '../local/generateLocal';
import { generateRegion } from '../region/generateRegion';
import { rootSeedPath } from '../seedPath';
import { boundsCenter } from '../units';
import { createWorld } from '../world/createWorld';
import { WorldStore } from '../world/worldStore';
import type { LocalArtifact, RegionArtifact } from '../artifacts';

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
      atlasCellCount: 6005,
      regionHeightfieldHash: 875885905,
      localMaterialHash: 1206025414,
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
  });

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
  });
});
