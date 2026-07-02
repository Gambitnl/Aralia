/**
 * @file groundChunkLoader.test.ts
 * Verifies the walking-scale bridge data that feeds World3D chunks.
 *
 * These tests stay at the bridge layer rather than rendering React/Three.
 * The bridge owns which Worldforge people become chunk sites, while the
 * renderer only consumes the resulting ChunkData records.
 */
import { describe, expect, it } from 'vitest';
import { WORLD3D_CONFIG } from '../../../world3d/config';
import {
  WORLD_DELTA_OPERATION_VERSION,
  WORLD_DELTA_SCHEMA_VERSION,
  type WorldDelta,
} from '../../delta/types';
import type { LocalArtifact, RegionArtifact } from '../../artifacts';
import { rootSeedPath } from '../../seedPath';
import type { GroundWorld } from '../groundChunkLoader';
import { makeGroundWorld, sampleGroundChunk, extractLocalTerrainPatch, groundSurfaceY, canonicalArtifactTownForSite } from '../groundChunkLoader';
import { groundTownAgentsAt } from '../groundAgentMotion';
import { GROUND_METERS_PER_CELL, localArtifactToWorldData } from '../groundWorldAdapter';

// ============================================================================
// Fixed Bridge Fixtures
// ============================================================================
// This section builds the smallest valid GroundWorld for chunk sampling. It
// avoids the expensive atlas/region/local generators while preserving the same
// meter-space data shape that makeGroundWorld normally returns.
// ============================================================================

function makeGroundWorldFixture(overrides: Partial<GroundWorld> = {}): GroundWorld {
  const cols = 4;
  const rows = 4;

  return {
    cols,
    rows,
    heights: new Array(cols * rows).fill(0),
    biomeIds: new Array(cols * rows).fill('plains'),
    extentMetersX: cols,
    extentMetersZ: rows,
    features: [],
    hostiles: [],
    hiddenSites: [],
    rivers: [],
    roads: [],
    walls: [],
    waterBodies: [],
    decks: [],
    gatehouses: [],
    towns: [],
    buildings: [],
    rosters: [],
    occupants: [],
    ...overrides,
  };
}

const SEED_PATH = rootSeedPath(42);

function makeLocalArtifact(): LocalArtifact {
  // The generated-town tests need real cells under generated plots. A
  // deterministic slope makes buried-wall regressions visible while staying
  // cheap enough for repeated makeGroundWorld calls.
  const widthCells = 500;
  const heightCells = 500;
  const elevationFt = new Float32Array(widthCells * heightCells);
  for (let y = 0; y < heightCells; y++) {
    for (let x = 0; x < widthCells; x++) {
      elevationFt[y * widthCells + x] = x * 0.2 + y * 0.35;
    }
  }

  return {
    layer: 'local',
    schemaVersion: 1,
    seedPath: SEED_PATH,
    bounds: { x: 0, y: 0, width: 500, height: 500 },
    terrain: {
      widthCells,
      heightCells,
      elevationFt,
      materialIndex: new Uint8Array(widthCells * heightCells),
      materials: ['grass'],
    },
    features: [],
  };
}

function makeRegionArtifact(): RegionArtifact {
  // A compact town envelope with two gates reliably generates a few plots and
  // rostered workers without invoking the heavier atlas pipeline.
  return {
    layer: 'region',
    schemaVersion: 1,
    seedPath: SEED_PATH,
    bounds: { x: 0, y: 0, width: 500, height: 500 },
    heightfield: {
      width: 1,
      height: 1,
      resolutionFt: 1,
      samples: new Float32Array([0]),
    },
    rivers: [],
    roads: [],
    townSites: [
      {
        // Sized to reliably yield houses + markets + rostered WORKERS (the
        // work/home + keeper assertions need a real mixed-use town). A tiny
        // envelope generates an all-workshop/no-house plan → an empty roster,
        // so this fills most of the 500×500 artifact window while staying inside it.
        burgId: 7,
        envelope: { x: 25, y: 25, width: 450, height: 450 },
        gates: [
          [25, 250],
          [475, 250],
        ],
      },
    ],
  };
}

function makeMarketDelta(plotId: number): WorldDelta {
  // This mirrors the saved delta envelope used by ground mode. The delta turns
  // one generated house plot into a market so roster generation creates a
  // worker with a distinct work plot for the time-of-day assertion.
  return {
    id: `market-${plotId}`,
    schemaVersion: WORLD_DELTA_SCHEMA_VERSION,
    opVersion: WORLD_DELTA_OPERATION_VERSION,
    artifactSeedPath: SEED_PATH,
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

function pointInsideConvexQuad(point: { x: number; z: number }, corners: Array<{ x: number; z: number }>): boolean {
  // Generated plot footprints are convex quads, so every edge should turn the
  // same way around a point that belongs to the plot interior.
  let sign = 0;
  for (let i = 0; i < corners.length; i++) {
    const a = corners[i];
    const b = corners[(i + 1) % corners.length];
    const cross = (b.x - a.x) * (point.z - a.z) - (b.z - a.z) * (point.x - a.x);
    if (Math.abs(cross) < 1e-9) continue;
    const nextSign = Math.sign(cross);
    if (sign !== 0 && nextSign !== sign) return false;
    sign = nextSign;
  }
  return true;
}

function footprintCellIndexes(ground: GroundWorld, corners: Array<{ x: number; z: number }>): number[] {
  // Cell centers are what the pad contract promises to flatten. Restricting to
  // the plot bounds keeps the assertion focused even on larger terrain grids.
  const minCol = Math.max(0, Math.floor(Math.min(...corners.map((c) => c.x)) / GROUND_METERS_PER_CELL) - 1);
  const maxCol = Math.min(ground.cols - 1, Math.ceil(Math.max(...corners.map((c) => c.x)) / GROUND_METERS_PER_CELL) + 1);
  const minRow = Math.max(0, Math.floor(Math.min(...corners.map((c) => c.z)) / GROUND_METERS_PER_CELL) - 1);
  const maxRow = Math.min(ground.rows - 1, Math.ceil(Math.max(...corners.map((c) => c.z)) / GROUND_METERS_PER_CELL) + 1);
  const indexes: number[] = [];

  for (let row = minRow; row <= maxRow; row++) {
    for (let col = minCol; col <= maxCol; col++) {
      const center = {
        x: (col + 0.5) * GROUND_METERS_PER_CELL,
        z: (row + 0.5) * GROUND_METERS_PER_CELL,
      };
      if (pointInsideConvexQuad(center, corners)) indexes.push(row * ground.cols + col);
    }
  }

  return indexes;
}

function bilinearHeightAtCellSpace(
  heights: number[],
  cols: number,
  rows: number,
  xM: number,
  zM: number,
): number {
  // The production sampler reads encoded heights with bilinear interpolation.
  // Using the same rule here proves the pad keeps the pre-flatten centroid
  // height rather than inventing a new construction elevation.
  const clampX = (v: number) => Math.max(0, Math.min(cols - 1, v));
  const clampY = (v: number) => Math.max(0, Math.min(rows - 1, v));
  const gx = clampX(xM / GROUND_METERS_PER_CELL);
  const gy = clampY(zM / GROUND_METERS_PER_CELL);
  const x0 = Math.floor(gx);
  const y0 = Math.floor(gy);
  const x1 = clampX(x0 + 1);
  const y1 = clampY(y0 + 1);
  const fx = gx - x0;
  const fy = gy - y0;
  const h = (xx: number, yy: number) => heights[yy * cols + xx] ?? 0;
  const top = h(x0, y0) * (1 - fx) + h(x1, y0) * fx;
  const bottom = h(x0, y1) * (1 - fx) + h(x1, y1) * fx;
  return top * (1 - fy) + bottom * fy;
}

// ============================================================================
// Occupant Site Emission
// ============================================================================
// This section pins the data contract used by nameplates: each resolved roster
// occupant becomes a marker-only site in only the chunk containing their plot.
// ============================================================================

describe('sampleGroundChunk occupant sites', () => {
  it('emits named marker-only occupant sites in the resolved plot chunk', () => {
    const inChunkX = WORLD3D_CONFIG.CHUNK_WORLD_SIZE + 10;
    const inChunkZ = 20;
    const outsideChunkX = 10;

    const chunk = sampleGroundChunk(
      makeGroundWorldFixture({
        occupants: [
          {
            burgId: 7,
            occupantId: 3,
            name: 'Mara Fen',
            xM: inChunkX,
            zM: inChunkZ,
          },
          {
            burgId: 7,
            occupantId: 4,
            name: 'Noro Bel',
            xM: outsideChunkX,
            zM: inChunkZ,
          },
        ],
      }),
      1,
      0,
      2,
    );

    expect(chunk.sites).toContainEqual(
      expect.objectContaining({
        id: 'wf-occ-7-3',
        kind: 'landmark',
        markerOnly: true,
        name: 'Mara Fen',
        labelRangeM: 12,
      }),
    );
    expect(chunk.sites.some((site) => site.id === 'wf-occ-7-4')).toBe(false);
  });

  it('appends the schedule activity to the occupant nameplate when present', () => {
    const inChunkX = WORLD3D_CONFIG.CHUNK_WORLD_SIZE + 10;
    const inChunkZ = 20;
    const chunk = sampleGroundChunk(
      makeGroundWorldFixture({
        occupants: [
          { burgId: 7, occupantId: 3, name: 'Mara Fen', xM: inChunkX, zM: inChunkZ, activity: 'sleeping' },
          { burgId: 7, occupantId: 5, name: 'Tomas', xM: inChunkX, zM: inChunkZ }, // no activity → clean name
        ],
      }),
      1,
      0,
      2,
    );
    expect(chunk.sites).toContainEqual(
      expect.objectContaining({ id: 'wf-occ-7-3', name: 'Mara Fen · asleep' }),
    );
    expect(chunk.sites).toContainEqual(
      expect.objectContaining({ id: 'wf-occ-7-5', name: 'Tomas' }),
    );
  });

  it('uses the generated roster placement map for work hours and home hours', () => {
    const local = makeLocalArtifact();
    const region = makeRegionArtifact();
    const deltas = [makeMarketDelta(1)];

    const noonGround = makeGroundWorld(local, 42, region, { hour: 12, deltas });
    const eveningGround = makeGroundWorld(local, 42, region, { hour: 20, deltas });
    const worker = noonGround.rosters[0].occupants.find(
      (occupant) => occupant.workPlotId !== undefined,
    );

    expect(worker).toBeDefined();
    const noonOccupant = noonGround.occupants.find(
      (occupant) => occupant.occupantId === worker!.id,
    );
    const eveningOccupant = eveningGround.occupants.find(
      (occupant) => occupant.occupantId === worker!.id,
    );
    const workBuilding = noonGround.buildings.find(
      (building) => building.id === `wf-plot-7-${worker!.workPlotId}`,
    );
    const homeBuilding = eveningGround.buildings.find(
      (building) => building.id === `wf-plot-7-${worker!.homePlotId}`,
    );

    // Nameplates resolve from the same plot assignment that feeds interior
    // figure placement: work during business hours, home afterward.
    expect(noonOccupant).toMatchObject({
      name: worker!.name,
      xM: workBuilding?.xM,
      zM: workBuilding?.zM,
    });
    expect(eveningOccupant).toMatchObject({
      name: worker!.name,
      xM: homeBuilding?.xM,
      zM: homeBuilding?.zM,
    });
  });
});

// ============================================================================
// Building Plot Terrain Pads
// ============================================================================
// This section protects Remy's live visual finding: generated buildings must
// sit on a level pad, with the terrain data itself flattened before chunks,
// building sites, interiors, and occupant labels read from it.
// ============================================================================

describe('makeGroundWorld building terrain pads', () => {
  it('levels every in-footprint cell to the pre-flatten centroid height', () => {
    const local = makeLocalArtifact();
    const region = makeRegionArtifact();
    const baseline = localArtifactToWorldData(local, 42);
    const ground = makeGroundWorld(local, 42, region);

    let unevenFootprintCells = 0;
    let wrongPadHeightBuildings = 0;
    let buildingsWithCoveredCells = 0;

    for (const building of ground.buildings) {
      const indexes = footprintCellIndexes(ground, building.cornersM);
      if (indexes.length === 0) continue;
      buildingsWithCoveredCells++;

      const centroid = {
        x: building.cornersM.reduce((sum, corner) => sum + corner.x, 0) / building.cornersM.length,
        z: building.cornersM.reduce((sum, corner) => sum + corner.z, 0) / building.cornersM.length,
      };
      const expectedPadHeight = bilinearHeightAtCellSpace(
        baseline.heights,
        baseline.gridSize.cols,
        baseline.gridSize.rows,
        centroid.x,
        centroid.z,
      );

      for (const index of indexes) {
        if (Math.abs(ground.heights[index] - ground.heights[indexes[0]]) > 1e-9) {
          unevenFootprintCells++;
        }
      }

      if (Math.abs(ground.heights[indexes[0]] - expectedPadHeight) > 1e-9) {
        wrongPadHeightBuildings++;
      }
    }

    expect(ground.buildings.length).toBeGreaterThan(0);
    expect(buildingsWithCoveredCells).toBe(ground.buildings.length);
    expect(unevenFootprintCells).toBe(0);
    expect(wrongPadHeightBuildings).toBe(0);
  });

  it('keeps padded terrain deterministic across repeated construction', () => {
    const local = makeLocalArtifact();
    const region = makeRegionArtifact();
    const first = makeGroundWorld(local, 42, region);
    const second = makeGroundWorld(local, 42, region);

    // Pad construction must be pure and deterministic: no random jitter, and
    // no shared artifact mutation leaking between makeGroundWorld calls.
    expect(second.heights).toEqual(first.heights);
  });

  it('exposes townPlans + boundsFeet that drive ground-meters agent motion', () => {
    const local = makeLocalArtifact();
    const region = makeRegionArtifact();
    const ground = makeGroundWorld(local, 42, region, { hour: 12 });

    // The agent-motion inputs are now surfaced on the ground world.
    expect(ground.boundsFeet).toEqual({ x: local.bounds.x, y: local.bounds.y });
    expect(ground.townPlans && ground.townPlans.length).toBeGreaterThan(0);
    // Plans pair with rosters by burgId.
    expect(ground.townPlans!.length).toBe(ground.rosters.length);

    // Feed the exposed inputs into the motion primitive → positioned agents.
    const { burgId, plan } = ground.townPlans![0];
    const roster = ground.rosters.find((r) => r.burgId === burgId)!;
    const agents = groundTownAgentsAt(burgId, plan, roster, ground.boundsFeet!, 12.25);
    expect(agents.length).toBe(roster.occupants.length);
    for (const a of agents) {
      expect(Number.isFinite(a.xM)).toBe(true);
      expect(Number.isFinite(a.zM)).toBe(true);
    }
  });

  it('opens the wall ring at road gatehouses (not only water gates)', () => {
    const local = makeLocalArtifact();
    const region = makeRegionArtifact();
    const ground = makeGroundWorld(local, 42, region);

    // The canonical fixture town is walled with street-entry gatehouses; each
    // becomes a placement record carrying its styled form + wall tint.
    expect(ground.gatehouses.length).toBeGreaterThan(0);
    for (const g of ground.gatehouses) {
      expect(Number.isFinite(g.xM)).toBe(true);
      expect(Number.isFinite(g.zM)).toBe(true);
      expect(Number.isFinite(g.angleRad)).toBe(true);
      expect(g.gapHalfM).toBeGreaterThan(0);
      expect(['twinTowers', 'tunnelBlock', 'singleTower']).toContain(g.form);
      expect(g.colorHex).toMatch(/^#/);
      expect(g.burgId).toBe(7);
    }

    // The ring is split into multiple open runs (not one closed loop), and no
    // wall point survives inside any gate's cleared gap. Other towns' walls
    // are far from the gate, so the global sweep stays safe.
    expect(ground.walls.length).toBeGreaterThan(1);
    for (const g of ground.gatehouses) {
      for (const run of ground.walls) {
        for (const p of run.points) {
          expect(Math.hypot(p.x - g.xM, p.z - g.zM)).toBeGreaterThan(g.gapHalfM * 0.99);
        }
      }
    }

    // Every wall run carries the style family's rampart tint.
    for (const run of ground.walls) {
      expect(run.colorHex).toMatch(/^#/);
    }
  });

  it('places SP4 hidden sites in-bounds, deterministically (proximity discovery)', () => {
    const local = makeLocalArtifact();
    const region = makeRegionArtifact();
    const a = makeGroundWorld(local, 42, region);
    const b = makeGroundWorld(local, 42, region);
    expect(a.hiddenSites.length).toBeGreaterThan(0);
    for (const hs of a.hiddenSites) {
      expect(hs.xM).toBeGreaterThanOrEqual(-1e-6);
      expect(hs.xM).toBeLessThanOrEqual(a.extentMetersX + 1e-6);
      expect(hs.zM).toBeGreaterThanOrEqual(-1e-6);
      expect(hs.zM).toBeLessThanOrEqual(a.extentMetersZ + 1e-6);
      expect(hs.discoveryRadiusM).toBeGreaterThan(0);
    }
    expect(b.hiddenSites).toEqual(a.hiddenSites); // deterministic per seed + window
  });

  it('correctly maps worldBusinesses and NPC owner names to buildings and keepers', () => {
    const local = makeLocalArtifact();
    const region = makeRegionArtifact();
    const deltas = [makeMarketDelta(1)]; // makes plot 1 a market

    const burgId = 7;
    const plotId = 1;
    const bizId = `biz_burg_${burgId}_plot_${plotId}`;
    const npcId = `npc_burg_${burgId}_plot_${plotId}`;

    const mockNpc: any = {
      id: npcId,
      name: 'Olaf the Keeper',
      role: 'merchant',
      biography: { level: 3, age: 34, backgroundId: 'merchant', classId: 'merchant', family: [] },
      stats: { hp: 10, maxHp: 10, armorClass: 10, speed: 30, initiativeBonus: 0, passivePerception: 10, proficiencyBonus: 2 },
    };

    const mockBusiness: any = {
      id: bizId,
      name: 'The Rusty Anvil',
      locationId: 'coord_0_0',
      ownerId: npcId,
      ownerType: 'npc',
      burgId,
      plotId,
      businessType: 'smithy',
      metrics: { customerSatisfaction: 80, reputation: 80, competitorPressure: 10, supplyChainHealth: 80, staffEfficiency: 80 },
    };

    const ground = makeGroundWorld(local, 42, region, {
      hour: 12,
      deltas,
      worldBusinesses: { [bizId]: mockBusiness },
      generatedNpcs: { [npcId]: mockNpc },
    });

    // Verify building for plot 1 got the business name
    const building = ground.buildings.find((b) => b.id === `wf-plot-${burgId}-${plotId}`);
    expect(building).toBeDefined();
    expect(building?.name).toBe('The Rusty Anvil');
    expect(building?.unlabeled).toBe(false);

    // Find the worker assigned to plot 1 and check that name matches NPC owner
    const worker = ground.rosters[0].occupants.find((o) => o.workPlotId === plotId);
    expect(worker).toBeDefined();
    expect(worker?.name).toBe('Olaf the Keeper');

    // Check that the ground occupant site got Olaf's name
    const occupant = ground.occupants.find((o) => o.occupantId === worker!.id);
    expect(occupant).toBeDefined();
    expect(occupant?.name).toBe('Olaf the Keeper');
  });

  it('binds businesses registered against canonicalArtifactTownForSite plot IDs (no rect-generator drift)', () => {
    // World3DWrapper pre-registers a business per market/workshop plot, keyed by
    // `biz_burg_<id>_plot_<plotId>`, and the renderer (makeGroundWorld) looks
    // businesses up by the SAME key. Both must derive plots from ONE generator —
    // the earlier bug registered against the retired rect generator while the
    // renderer used the canonical one, so the IDs never matched and shops stayed
    // unbound. This pins that both sides share `canonicalArtifactTownForSite`.
    const local = makeLocalArtifact();
    const region = makeRegionArtifact();
    const site = region.townSites[0];
    const burgId = site.burgId;

    // Registration source: the SHARED helper World3DWrapper now calls.
    const { plan } = canonicalArtifactTownForSite(42, site);
    const shopPlots = plan.plots.filter((p) => p.role === 'market' || p.role === 'workshop');
    expect(shopPlots.length).toBeGreaterThan(0);

    const worldBusinesses: Record<string, any> = {};
    for (const p of shopPlots) {
      const bizId = `biz_burg_${burgId}_plot_${p.id}`;
      worldBusinesses[bizId] = { id: bizId, name: `Shop ${p.id}`, ownerId: `npc_${p.id}` };
    }

    // Render source: makeGroundWorld derives its plots from the same helper and
    // looks each business up by plot id.
    const ground = makeGroundWorld(local, 42, region, { hour: 12, worldBusinesses });

    // Every shop building that the renderer kept must carry its registered name —
    // i.e. the registration IDs and the rendered plot IDs are the same space.
    let bound = 0;
    for (const p of shopPlots) {
      const building = ground.buildings.find((b) => b.id === `wf-plot-${burgId}-${p.id}`);
      if (!building) continue; // culled (covers no ground tile) — not a binding failure
      expect(building.name).toBe(`Shop ${p.id}`);
      bound++;
    }
    expect(bound).toBeGreaterThan(0);
  });
});

// ============================================================================
// Terrain Patch Extraction
// ============================================================================
// This section verifies that extractLocalTerrainPatch extracts a 40x30 local
// patch matching the spot's ground heights, biomes, features, and buildings.
// ============================================================================
describe('extractLocalTerrainPatch', () => {
  it('extracts a 40x30 terrain patch matching the heights, biomes, and buildings of the ground world', () => {
    // 1. Create a fixture ground world with custom height, biome, feature, and building
    const cols = 100;
    const rows = 100;
    
    // Create a terrain height map that rises linearly
    const heights = new Array(cols * rows).fill(0).map((_, idx) => {
      const col = idx % cols;
      const row = Math.floor(idx / cols);
      return (col + row) * 0.5; // encoded height
    });
    
    // Create a biome map (desert in top-left, plains elsewhere)
    const biomeIds = new Array(cols * rows).fill(0).map((_, idx) => {
      const col = idx % cols;
      const row = Math.floor(idx / cols);
      return (col < 20 && row < 20) ? 'desert' : 'plains';
    });

    const buildingId = 'wf-plot-test-building';
    const buildings = [
      {
        id: buildingId,
        xM: 50,
        zM: 50,
        cornersM: [
          { x: 45, z: 45 },
          { x: 55, z: 45 },
          { x: 55, z: 55 },
          { x: 45, z: 55 },
        ],
        heightM: 6,
        role: 'house',
        wallWidthM: 8,
        wallDepthM: 8,
        parts: [
          { x: 0, z: 0, w: 8, d: 8, h: 0.12, colorHex: '#9a8a72' }, // floor
          { x: 0, z: 4, w: 8, d: 0.3, h: 3, colorHex: '#cfc7b8' }, // wall
        ],
      },
    ];

    const features = [
      { id: 99, kind: 'tree', xM: 40, zM: 40 },
    ];

    const ground = makeGroundWorldFixture({
      cols,
      rows,
      heights,
      biomeIds,
      extentMetersX: cols * GROUND_METERS_PER_CELL,
      extentMetersZ: rows * GROUND_METERS_PER_CELL,
      buildings,
      features,
    });

    // 2. Perform the extraction centered near player position
    // Player is at (40, 40)
    const playerX = 40;
    const playerZ = 40;
    const patch = extractLocalTerrainPatch(ground, playerX, playerZ, 'forest', 42);

    expect(patch.dimensions).toEqual({ width: 40, height: 30 });
    expect(patch.tiles.size).toBe(40 * 30);

    // 3. Verify player center tile at (20, 15) maps to the player's position
    const centerTile = patch.tiles.get('20-15');
    expect(centerTile).toBeDefined();
    expect(centerTile?.coordinates).toEqual({ x: 20, y: 15 });
    
    // Verify elevation maps correctly: realHeightM / 0.3
    const expectedHeightM = groundSurfaceY(ground, playerX, playerZ);
    expect(centerTile?.elevation).toBeCloseTo(expectedHeightM / 0.3, 4);

    // 4. Verify feature mapping (tree feature is at (40, 40) which matches center tile (20, 15))
    expect(centerTile?.decoration).toBe('tree');
    expect(centerTile?.blocksMovement).toBe(true);
    expect(centerTile?.blocksLoS).toBe(true);

    // 5. Verify building and part mapping
    // Building center is at (50, 50).
    // dx = 50 - 40 = 10 meters, dz = 50 - 40 = 10 meters.
    // Tile offset: tx = 20 + 10 / 1.524 = 26.56 -> tile 27.
    // ty = 15 + 10 / 1.524 = 21.56 -> tile 22.
    // Let's test a tile inside the building (e.g. tile 27, 22)
    const buildingTile = patch.tiles.get('27-22');
    expect(buildingTile).toBeDefined();
    // It should be mapped to floor or wall
    expect(['floor', 'wall']).toContain(buildingTile?.terrain);
  });
});
