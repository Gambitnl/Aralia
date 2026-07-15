/**
 * @file groundChunkLoader.test.ts
 * Verifies the walking-scale bridge data that feeds World3D chunks.
 *
 * These tests stay at the bridge layer rather than rendering React/Three.
 * The bridge owns which Worldforge people become chunk sites, while the
 * renderer only consumes the resulting ChunkData records.
 */
import { describe, expect, it } from 'vitest';
import { WORLD3D_CONFIG, heightToMeters } from '../../../world3d/config';
import { buildPlaceholderHeightfield } from '../../../world3d/chunkGeometry';
import type { ChunkData } from '../../../world3d/types';
import {
  WORLD_DELTA_OPERATION_VERSION,
  WORLD_DELTA_SCHEMA_VERSION,
  type WorldDelta,
} from '../../delta/types';
import type { LocalArtifact, RegionArtifact } from '../../artifacts';
import { rootSeedPath } from '../../seedPath';
import type { GroundWorld } from '../groundChunkLoader';
import { makeGroundWorld, sampleGroundChunk, groundSlope01, extractLocalTerrainPatch, groundSurfaceY, canonicalArtifactTownForSite, regionPolylinesToGround } from '../groundChunkLoader';
import { getBridgeAtlas } from '../legacySubmapBridge';
import {
  resolveSnowLine,
  latitudeAtGraphY,
  SNOW_LINE_H,
  SNOW_LINE_POLAR,
  SNOW_LINE_TROPICAL,
  SNOW_RGB,
} from '../../mountains/mountainTunables';
import { groundTownAgentsAt } from '../groundAgentMotion';
import { GROUND_METERS_PER_CELL, localArtifactToWorldData } from '../groundWorldAdapter';
import {
  FACADE_PART_TAG,
  HISTORY_PART_TAG,
  MATERIAL_PART_TAG,
  MOTIF_PART_TAG,
} from '../interiorParts';
import { TERRACE_STEP_ENCODED } from '../terrainTerraces';

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
    props: [],
    hostiles: [],
    hiddenSites: [],
    dungeonEntrances: [],
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
// Region Route Clipping
// ============================================================================
// Atlas route vertices can sit thousands of feet apart. A local window may be
// crossed by the segment even when neither endpoint falls inside it, so the
// coarse retention pass must test segments rather than endpoint membership.
// ============================================================================

describe('regionPolylinesToGround', () => {
  it('retains a source route whose segment crosses the local window with both endpoints outside', () => {
    const local = makeLocalArtifact();
    const roads = regionPolylinesToGround([{
      centerline: [[-500, 250], [1_000, 250]],
      widthFt: 20,
      kind: 'trail',
    }], local, 'region-road');

    expect(roads).toHaveLength(1);
    expect(roads[0].sourceKind).toBe('region-road');
    expect(roads[0].points[0].x).toBeLessThan(0);
    expect(roads[0].points[1].x).toBeGreaterThan(local.bounds.width * 0.3048);
  });

  it('projects one Region bridge receipt into both Ground crossing and 3D deck facts', () => {
    const local = makeLocalArtifact();
    const region: RegionArtifact = {
      ...makeRegionArtifact(),
      townSites: [],
      roads: [{
        routeId: 3,
        centerline: [[0, 250], [500, 250]],
        widthFt: 44,
        kind: 'highway',
      }],
      rivers: [{
        riverId: 7,
        centerline: [[250, 0], [250, 500]],
        widthFt: 80,
      }],
      crossings: [{
        id: 'crossing:3:7:0',
        kind: 'bridge',
        roadRouteId: 3,
        riverId: 7,
        point: [250, 250],
        roadDirection: [1, 0],
        riverDirection: [0, 1],
        spanFt: 112,
        widthFt: 44,
      }],
    };

    // makeGroundWorld is the shared seam used by production World3D and the
    // tactical extractor, so this assertion guards against either view drifting
    // onto independently inferred bridge geometry later.
    const ground = makeGroundWorld(local, 42, region, { skipProps: true });
    expect(ground.crossings).toEqual([
      expect.objectContaining({
        id: 'crossing:3:7:0',
        kind: 'bridge',
        roadRouteId: 3,
        riverId: 7,
        roadSourceIndex: 0,
        riverSourceIndex: 0,
      }),
    ]);

    const bridgeDeck = ground.decks.find(
      (deck) => deck.sourceCrossingId === 'crossing:3:7:0',
    );
    expect(bridgeDeck).toMatchObject({
      kind: 'bridge',
      sourceCrossingId: 'crossing:3:7:0',
      detail: expect.objectContaining({ railing: true }),
    });
    expect(bridgeDeck?.cornersM).toHaveLength(4);
    expect(Number.isFinite(bridgeDeck?.topY)).toBe(true);
  });
});

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
  it('levels every footprint to its centroid or negotiated row terrace', () => {
    const local = makeLocalArtifact();
    const region = makeRegionArtifact();
    const baseline = localArtifactToWorldData(local, 42);
    const ground = makeGroundWorld(local, 42, region);

    let unevenFootprintCells = 0;
    let wrongPadHeightBuildings = 0;
    let buildingsWithCoveredCells = 0;
    let terracedBuildings = 0;
    const terracesByBlock = new Map<string, typeof ground.buildings>();

    for (const building of ground.buildings) {
      const indexes = footprintCellIndexes(ground, building.cornersM);
      if (indexes.length === 0) continue;
      buildingsWithCoveredCells++;

      const centroid = {
        x: building.cornersM.reduce((sum, corner) => sum + corner.x, 0) / building.cornersM.length,
        z: building.cornersM.reduce((sum, corner) => sum + corner.z, 0) / building.cornersM.length,
      };
      const rawPadHeight = bilinearHeightAtCellSpace(
        baseline.heights,
        baseline.gridSize.cols,
        baseline.gridSize.rows,
        centroid.x,
        centroid.z,
      );
      const expectedPadHeight = building.terrainTerrace?.padHeightEncoded
        ?? rawPadHeight;
      if (building.terrainTerrace) {
        terracedBuildings++;
        expect(building.ensemble?.kind === 'row'
          || building.ensemble?.kind === 'market-arcade').toBe(true);
        expect(building.terrainTerrace.blockKey).toBe(building.ensemble?.blockKey);
        const group = terracesByBlock.get(building.terrainTerrace.blockKey) ?? [];
        group.push(building);
        terracesByBlock.set(building.terrainTerrace.blockKey, group);
      }

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
    expect(terracedBuildings).toBeGreaterThan(0);
    for (const group of terracesByBlock.values()) {
      for (let index = 1; index < group.length; index++) {
        const previous = group[index - 1].terrainTerrace!;
        const current = group[index].terrainTerrace!;
        const stepDelta = current.stepIndex - previous.stepIndex;
        expect(Math.abs(stepDelta)).toBeLessThanOrEqual(1);
        expect(current.padHeightEncoded - previous.padHeightEncoded)
          .toBeCloseTo(stepDelta * TERRACE_STEP_ENCODED, 9);
      }
    }
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

  it('surfaces forest POI markers as marker-derived hidden sites (forests T8b)', () => {
    const local = makeLocalArtifact();
    const region: RegionArtifact = {
      ...makeRegionArtifact(),
      markers: [
        { type: 'hunter-camp', icon: '🏕️', x: 120, y: 80 },
        { type: 'hermit-hollow', icon: '🛖', x: 200, y: 150 },
        { type: 'forest-shrine', icon: '⛩️', x: 300, y: 220 },
        { type: 'beast-den', icon: '🐾', x: 400, y: 320 },
      ],
    };
    const ground = makeGroundWorld(local, 42, region);

    // The required proof: a hunter-camp RegionMarker becomes a GroundHiddenSite
    // of kind 'camp' at the marker's feet→meters spot, revealed by the existing
    // proximity bridge — no new discovery machinery.
    const FEET_TO_METERS = 0.3048;
    const camp = ground.hiddenSites.find((s) => s.id.includes('hunter-camp'));
    expect(camp).toBeDefined();
    expect(camp?.kind).toBe('camp');
    expect(camp?.name).toBe('Camp');
    expect(camp?.xM).toBeCloseTo(120 * FEET_TO_METERS, 6);
    expect(camp?.zM).toBeCloseTo(80 * FEET_TO_METERS, 6);

    // The other three forest POI types map onto existing kinds the same way.
    expect(ground.hiddenSites.find((s) => s.id.includes('hermit-hollow'))?.kind).toBe('camp');
    expect(ground.hiddenSites.find((s) => s.id.includes('forest-shrine'))?.kind).toBe('shrine');
    expect(ground.hiddenSites.find((s) => s.id.includes('beast-den'))?.kind).toBe('cave');

    // Task 11 guard: with no atlas-cell anchor provided, the canopy stays null
    // — non-forest / anchor-less builds keep exactly the pre-canopy behavior.
    expect(ground.canopy ?? null).toBeNull();
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

  it('carries spatial district identity into visible production building parts', () => {
    const local = makeLocalArtifact();
    const region = makeRegionArtifact();
    const site = region.townSites[0];
    const { plan } = canonicalArtifactTownForSite(42, site);
    const stamped = plan.plots.filter((plot) => plot.architecture);

    expect(stamped.length).toBeGreaterThan(0);
    expect(new Set(stamped.map((plot) => plot.architecture!.districtKey)).size)
      .toBeGreaterThan(1);
    expect(new Set(stamped.map((plot) => plot.architecture!.buildingKey)).size)
      .toBe(stamped.length);

    const ground = makeGroundWorld(local, 42, region, { hour: 12 });
    const artifactById = new Map(stamped.map((plot) => [plot.id, plot]));
    let visibleStamped = 0;
    let visibleFacade = 0;
    let visibleMotifs = 0;
    let visibleHistory = 0;
    let visibleMaterials = 0;
    for (const building of ground.buildings) {
      const plotId = Number(building.id.split('-').at(-1));
      const artifact = artifactById.get(plotId);
      if (!artifact?.architecture) continue;
      visibleStamped++;

      // The artifact material reaches the real structural wall parts, while a
      // non-plain district grammar reaches separately tagged facade dressing.
      expect(building.wallColorHex).toBe(artifact.wallColorHex);
      expect(building.parts.some((part) => part.colorHex === artifact.wallColorHex))
        .toBe(true);
      if (artifact.architecture.facadePattern !== 'plain') {
        expect(building.parts.some((part) => part.tag === FACADE_PART_TAG)).toBe(true);
        visibleFacade++;
      }
      const materialParts = building.parts.filter((part) =>
        part.tag === MATERIAL_PART_TAG);
      expect(materialParts.length).toBeGreaterThan(0);
      expect(materialParts.every((part) => part.materialDetailKind)).toBe(true);
      visibleMaterials++;
      const motifParts = building.parts.filter((part) => part.tag === MOTIF_PART_TAG);
      if (motifParts.length > 0) {
        // Every production motif box carries its exact semantic cue, which lets
        // render proofs distinguish a sign from a vent without color guessing.
        expect(motifParts.every((part) => part.motifKind)).toBe(true);
        visibleMotifs++;
      }
      const historyParts = building.parts.filter((part) =>
        part.tag === HISTORY_PART_TAG);
      if (artifact.architecture.ageBand !== 'new') {
        expect(historyParts.every((part) => part.historyKind)).toBe(true);
        if (historyParts.length > 0) visibleHistory++;
      }
    }

    expect(visibleStamped).toBeGreaterThan(0);
    expect(visibleFacade).toBeGreaterThan(0);
    expect(visibleMotifs).toBeGreaterThan(0);
    expect(visibleHistory).toBeGreaterThan(0);
    expect(visibleMaterials).toBe(visibleStamped);
  });
});

// ============================================================================
// Terrain Patch Extraction
// ============================================================================
// This section verifies that extractLocalTerrainPatch extracts a 40x30 local
// patch matching the spot's ground heights, biomes, features, and buildings.
// ============================================================================
describe('extractLocalTerrainPatch', () => {
  it('projects a WorldForge road into clear, source-addressable referee cells', () => {
    const cols = 100;
    const rows = 100;
    const ground = makeGroundWorldFixture({
      cols,
      rows,
      heights: new Array(cols * rows).fill(0),
      biomeIds: new Array(cols * rows).fill('plains'),
      extentMetersX: cols * GROUND_METERS_PER_CELL,
      extentMetersZ: rows * GROUND_METERS_PER_CELL,
      roads: [{
        points: [{ x: 20, z: 50 }, { x: 80, z: 50 }],
        widthM: 3,
        sourceKind: 'region-road',
      }],
      // The road footprint deliberately crosses a tree. Source route clearance
      // wins, so the tactical road is continuous instead of becoming blocked by
      // a stale vegetation placement from another source layer.
      features: [{ id: 1, kind: 'tree', xM: 50, zM: 50 }],
    });

    const patch = extractLocalTerrainPatch(
      ground,
      50,
      50,
      'forest',
      42,
      { width: 9, height: 9 },
    );
    const roadTile = patch.tiles.get('4-4');
    const offRoadTile = patch.tiles.get('4-0');

    expect(roadTile?.surface).toEqual({
      kind: 'road',
      source: 'worldforge-road',
      sourceRole: 'regional-route',
      sourceIndex: 0,
      widthMeters: 3,
    });
    expect(roadTile?.movementCost).toBe(1);
    expect(roadTile?.blocksMovement).toBe(false);
    expect(roadTile?.blocksLoS).toBe(false);
    expect(roadTile?.decoration).toBeNull();
    expect(offRoadTile?.surface).toBeUndefined();
  });

  it('does not invent a passable road crossing where source water has no ford or bridge', () => {
    const cols = 40;
    const rows = 40;
    const ground = makeGroundWorldFixture({
      cols,
      rows,
      heights: new Array(cols * rows).fill(0),
      biomeIds: new Array(cols * rows).fill('water'),
      extentMetersX: cols * GROUND_METERS_PER_CELL,
      extentMetersZ: rows * GROUND_METERS_PER_CELL,
      roads: [{
        points: [{ x: 10, z: 30 }, { x: 50, z: 30 }],
        widthM: 4,
      }],
    });

    const patch = extractLocalTerrainPatch(
      ground,
      30,
      30,
      'forest',
      42,
      { width: 3, height: 3 },
    );
    const centerTile = patch.tiles.get('1-1');

    expect(centerTile?.terrain).toBe('water');
    expect(centerTile?.surface).toBeUndefined();
    expect(centerTile?.crossing).toBeUndefined();
    expect(centerTile?.blocksMovement).toBe(true);
  });

  it('projects source bridges and fords over water without changing the base terrain fact', () => {
    const cols = 50;
    const rows = 50;
    const bridgeGround = makeGroundWorldFixture({
      cols,
      rows,
      heights: new Array(cols * rows).fill(0),
      biomeIds: new Array(cols * rows).fill('water'),
      extentMetersX: cols * GROUND_METERS_PER_CELL,
      extentMetersZ: rows * GROUND_METERS_PER_CELL,
      roads: [{
        points: [{ x: 10, z: 35 }, { x: 60, z: 35 }],
        widthM: 4,
        sourceKind: 'region-road',
        sourceId: 5,
      }],
      crossings: [{
        id: 'crossing:5:9:0',
        kind: 'bridge',
        xM: 35,
        zM: 35,
        roadDirection: { x: 1, z: 0 },
        spanM: 20,
        widthM: 4,
        roadRouteId: 5,
        riverId: 9,
        roadSourceIndex: 0,
        riverSourceIndex: 0,
      }],
    });
    const bridgePatch = extractLocalTerrainPatch(
      bridgeGround,
      35,
      35,
      'forest',
      42,
      { width: 21, height: 9 },
    );
    const bridgeTile = bridgePatch.tiles.get('10-4');
    const waterBeyondSpan = bridgePatch.tiles.get('20-4');

    expect(bridgeTile?.terrain).toBe('water');
    expect(bridgeTile?.surface?.kind).toBe('road');
    expect(bridgeTile?.crossing).toMatchObject({
      kind: 'bridge',
      source: 'worldforge-crossing',
      sourceCrossingId: 'crossing:5:9:0',
      roadSourceIndex: 0,
      riverSourceIndex: 0,
    });
    expect(bridgeTile?.movementCost).toBe(1);
    expect(bridgeTile?.blocksMovement).toBe(false);
    expect(waterBeyondSpan?.terrain).toBe('water');
    expect(waterBeyondSpan?.crossing).toBeUndefined();
    expect(waterBeyondSpan?.blocksMovement).toBe(true);

    const fordGround = makeGroundWorldFixture({
      ...bridgeGround,
      crossings: [{ ...bridgeGround.crossings![0], kind: 'ford' }],
    });
    const fordPatch = extractLocalTerrainPatch(
      fordGround,
      35,
      35,
      'forest',
      42,
      { width: 3, height: 3 },
    );
    expect(fordPatch.tiles.get('1-1')).toMatchObject({
      terrain: 'water',
      movementCost: 2,
      blocksMovement: false,
      crossing: { kind: 'ford' },
    });
  });

  it('keeps material detail, motifs, and history out of tactical collision and line of sight', () => {
    // These oversized dressing parts deliberately cover the player's tile.
    // Without the tag guard they would behave like solid walls; with the guard
    // the underlying floor remains a valid combat square.
    const ground = makeGroundWorldFixture({
      cols: 100,
      rows: 100,
      heights: new Array(100 * 100).fill(0),
      biomeIds: new Array(100 * 100).fill('plains'),
      extentMetersX: 100 * GROUND_METERS_PER_CELL,
      extentMetersZ: 100 * GROUND_METERS_PER_CELL,
      buildings: [{
        id: 'wf-plot-motif-collision-proof',
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
          { x: 0, z: 0, w: 8, d: 8, h: 0.12, colorHex: '#9a8a72' },
          {
            x: 0,
            z: 0,
            w: 4,
            d: 4,
            h: 3,
            colorHex: '#cfc7b8',
            tag: MOTIF_PART_TAG,
            motifKind: 'corner-turrets',
          },
          {
            x: 0,
            z: 0,
            w: 4,
            d: 4,
            h: 3,
            colorHex: '#8d6f58',
            tag: HISTORY_PART_TAG,
            historyKind: 'later-phase',
          },
          {
            x: 0,
            z: 0,
            w: 4,
            d: 4,
            h: 3,
            colorHex: '#8eabb2',
            tag: MATERIAL_PART_TAG,
            materialDetailKind: 'shutter-panel',
          },
        ],
      }],
    });
    const patch = extractLocalTerrainPatch(
      ground,
      50,
      50,
      'forest',
      42,
      { width: 3, height: 3 },
    );
    const centerTile = patch.tiles.get('1-1')!;

    expect(centerTile.blocksMovement).toBe(false);
    expect(centerTile.blocksLoS).toBe(false);
  });

  it('keeps a render-hidden party wall authoritative for tactical collision', () => {
    const ground = makeGroundWorldFixture({
      cols: 100,
      rows: 100,
      heights: new Array(100 * 100).fill(0),
      biomeIds: new Array(100 * 100).fill('plains'),
      extentMetersX: 100 * GROUND_METERS_PER_CELL,
      extentMetersZ: 100 * GROUND_METERS_PER_CELL,
      buildings: [{
        id: 'wf-party-wall-tactical-proof',
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
          { x: 0, z: 0, w: 8, d: 8, h: 0.12, colorHex: '#9a8a72' },
          {
            x: 0,
            z: 0,
            w: 4,
            d: 4,
            h: 3,
            colorHex: '#cfc7b8',
            renderRole: 'tactical-only',
          },
        ],
      }],
    });
    const patch = extractLocalTerrainPatch(
      ground,
      50,
      50,
      'forest',
      42,
      { width: 3, height: 3 },
    );
    const centerTile = patch.tiles.get('1-1')!;

    expect(centerTile.blocksMovement).toBe(true);
    expect(centerTile.blocksLoS).toBe(true);
  });

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

  // ==========================================================================
  // Fight-in-place slice 1: the world-derived referee grid must carry the props
  // the 3D scene draws AS COVER. A prop placed at the player's spot imprints its
  // catalog referee data (cover / blocks-sight / blocks-move) onto the tile —
  // this is the invisible 5-ft referee reading the SAME world the player sees.
  // ==========================================================================
  it('imprints a placed cover prop (barrel) onto the referee tile at the player position', () => {
    const cols = 100;
    const rows = 100;
    const ground = makeGroundWorldFixture({
      cols,
      rows,
      heights: new Array(cols * rows).fill(0),
      biomeIds: new Array(cols * rows).fill('plains'),
      extentMetersX: cols * GROUND_METERS_PER_CELL,
      extentMetersZ: rows * GROUND_METERS_PER_CELL,
      // A barrel from the catalog: cover 'half', blocksLoS + blocksMovement.
      // Place it exactly on the player's spot so it lands on the center tile.
      props: [{ defId: 'barrel', xM: 40, zM: 40, rotationRad: 0, variation: { scale: 1, variant: 0 } }],
    });

    const patch = extractLocalTerrainPatch(ground, 40, 40, 'forest', 42);
    const centerTile = patch.tiles.get('20-15');
    expect(centerTile).toBeDefined();
    // The prop is born combat-legible: the referee tile now grants cover and
    // blocks sight + movement, exactly as the catalog barrel def declares.
    expect(centerTile?.providesCover).toBe(true);
    expect(centerTile?.blocksLoS).toBe(true);
    expect(centerTile?.blocksMovement).toBe(true);

    // A tile far from the barrel stays open — the imprint is footprint-bounded,
    // not global. (5 tiles east ≈ 7.6 m, well outside the barrel footprint.)
    const openTile = patch.tiles.get('25-15');
    expect(openTile?.providesCover).toBeFalsy();
    expect(openTile?.blocksMovement).toBe(false);
  });

  // ==========================================================================
  // Fight-in-place slice 1: context-sized patch (fip--referee-patch-sizing).
  // An open/ranged encounter extracts a larger referee patch; the player stays
  // centered and the referee data stays a plain Map at any size.
  // ==========================================================================
  it('extracts a context-sized (larger) patch with the player still centered', () => {
    const cols = 200;
    const rows = 200;
    const ground = makeGroundWorldFixture({
      cols,
      rows,
      heights: new Array(cols * rows).fill(0),
      biomeIds: new Array(cols * rows).fill('plains'),
      extentMetersX: cols * GROUND_METERS_PER_CELL,
      extentMetersZ: rows * GROUND_METERS_PER_CELL,
      features: [{ id: 7, kind: 'tree', xM: 120, zM: 120 }],
    });

    const patch = extractLocalTerrainPatch(ground, 120, 120, 'forest', 42, { width: 120, height: 120 });
    expect(patch.dimensions).toEqual({ width: 120, height: 120 });
    expect(patch.tiles.size).toBe(120 * 120);

    // Player sits at the geometric center (60, 60); the tree at the player's
    // meters lands on that center tile.
    const centerTile = patch.tiles.get('60-60');
    expect(centerTile).toBeDefined();
    expect(centerTile?.decoration).toBe('tree');
    expect(centerTile?.blocksMovement).toBe(true);
  });

  // ==========================================================================
  // WF-INTERIORS plan-to-mesh integrity (finding #3 follow-up): the walkability
  // grid must block the SAME cells the renderer draws a part on. The renderer
  // places a part's inward axis at local z = p.z * -doorZSign (sitePartTransform
  // / interiorPlacement / siteGeometry all agree). An off-center wall part must
  // therefore block the drawn side of the building, not its mirror through the
  // building origin.
  // ==========================================================================
  it('blocks the cells the renderer draws an off-center wall on, not their mirror', () => {
    const cols = 100;
    const rows = 100;
    // Axis-aligned quad in the fixture winding [SW, SE, NE, NW]. This yields
    // rotationY = 0 and doorZSign = -1 (siteOrientationFromQuad convention:
    // e1 = c1-c0 frontage edge, e2 = c3-c0, cross >= 0 -> doorZSign -1).
    const bXM = 50;
    const bZM = 50;
    const cornersM = [
      { x: 45, z: 45 },
      { x: 55, z: 45 },
      { x: 55, z: 55 },
      { x: 45, z: 55 },
    ];
    const doorZSign = -1;
    // An off-center interior wall: p.z = +2. The renderer draws it at local
    // z = 2 * -doorZSign = +2, i.e. world z = 52. The buggy mirror would land it
    // at world z = 48.
    const wall = { x: 0, z: 2, w: 8, d: 2, h: 3, colorHex: '#cfc7b8' };
    const drawnWorld = { x: bXM + wall.x, z: bZM + wall.z * -doorZSign }; // (50, 52)
    const mirrorWorld = { x: bXM + wall.x, z: bZM + wall.z * doorZSign }; // (50, 48)

    const ground = makeGroundWorldFixture({
      cols,
      rows,
      heights: new Array(cols * rows).fill(0),
      biomeIds: new Array(cols * rows).fill('plains'),
      extentMetersX: cols * GROUND_METERS_PER_CELL,
      extentMetersZ: rows * GROUND_METERS_PER_CELL,
      buildings: [
        {
          id: 'wf-plot-drift-test',
          xM: bXM,
          zM: bZM,
          cornersM,
          heightM: 6,
          role: 'house',
          wallWidthM: 10,
          wallDepthM: 10,
          parts: [
            { x: 0, z: 0, w: 10, d: 10, h: 0.12, colorHex: '#9a8a72' }, // floor
            wall,
          ],
        },
      ],
    });

    const playerX = 40;
    const playerZ = 40;
    const patch = extractLocalTerrainPatch(ground, playerX, playerZ, 'forest', 42);

    // Nearest tile center to a world point, for the default 40x30 patch.
    const tileIdForWorld = (wx: number, wz: number): string => {
      const tx = Math.round(20 + (wx - playerX) / GROUND_METERS_PER_CELL);
      const ty = Math.round(15 + (wz - playerZ) / GROUND_METERS_PER_CELL);
      return `${tx}-${ty}`;
    };

    const drawnTile = patch.tiles.get(tileIdForWorld(drawnWorld.x, drawnWorld.z));
    const mirrorTile = patch.tiles.get(tileIdForWorld(mirrorWorld.x, mirrorWorld.z));

    expect(drawnTile).toBeDefined();
    expect(mirrorTile).toBeDefined();
    // The wall blocks where the renderer draws it...
    expect(drawnTile?.terrain).toBe('wall');
    expect(drawnTile?.blocksMovement).toBe(true);
    // ...and the mirror cell stays open floor.
    expect(mirrorTile?.terrain).toBe('floor');
    expect(mirrorTile?.blocksMovement).toBe(false);
  });
});

// ============================================================================
// Task 10 (MOUNTAINS) — 3D high-country vertex colors: the relief-shading
// unit-bug fix, the re-enabled slope→rock blend, and snow caps at altitude.
// A flat 100×100 world keeps a chunk fully inside the artifact (extent 152 m >
// the 128 m chunk), so no edge-haze contaminates the tint under test.
// ============================================================================

function flatColorWorld(height: number, biome = 'grassland', extra: Partial<GroundWorld> = {}): GroundWorld {
  const cols = 100;
  const rows = 100;
  return makeGroundWorldFixture({
    cols,
    rows,
    heights: new Array(cols * rows).fill(height),
    biomeIds: new Array(cols * rows).fill(biome),
    extentMetersX: cols * GROUND_METERS_PER_CELL,
    extentMetersZ: rows * GROUND_METERS_PER_CELL,
    ...extra,
  });
}

describe('sampleGroundChunk relief shading (unit-bug fix)', () => {
  it('high ground reads distinctly brighter than low ground (dead ~2% today → live)', () => {
    // Same biome, same (flat → zero slope, sub-snow-line) everything: only the
    // encoded height differs. Pre-fix the height/100 call collapsed the shade
    // swing to ~2%; the raw-height call restores the intended relief contrast.
    const low = sampleGroundChunk(flatColorWorld(5), 0, 0, 2);
    const high = sampleGroundChunk(flatColorWorld(30), 0, 0, 2);
    const lo = low.biomeColors![0];
    const hi = high.biomeColors![0];
    expect((hi - lo) / lo).toBeGreaterThan(0.1);
  });
});

describe('groundSlope01 ↔ chunkGeometry normal convention (calibration)', () => {
  it('agrees with the mesh normal-derived (1 − ny) slope on a linear ramp', () => {
    const res = 5;
    const S = WORLD3D_CONFIG.CHUNK_WORLD_SIZE;
    const spacingM = S / (res - 1);
    const mPerH = heightToMeters(1) - heightToMeters(0);

    // Build a linear ramp whose world-space rise/run G is a chosen tan(theta).
    const ramp = (targetG: number): Float32Array => {
      const dhPerVertex = (targetG * spacingM) / mPerH; // encoded-height step per vertex in +x
      const heights = new Float32Array(res * res);
      for (let j = 0; j < res; j++)
        for (let i = 0; i < res; i++) heights[j * res + i] = i * dhPerVertex;
      return heights;
    };

    // Geometry convention: the up-component of the flat-shaded vertex normal.
    const geomSlope01 = (heights: Float32Array, i: number, j: number): number => {
      const geo = buildPlaceholderHeightfield(
        { resolution: res, heights } as unknown as ChunkData,
        { skirtDepth: 0 },
      );
      const ny = geo.normals[(j * res + i) * 3 + 1];
      return 1 - ny;
    };

    // Three angles across the useful blend band (~30°, 45°, 60°) all agree
    // within the ±0.1 tolerance the brief specifies.
    for (const G of [Math.tan(Math.PI / 6), 1, Math.tan(Math.PI / 3)]) {
      const heights = ramp(G);
      const ground = groundSlope01(heights, 2, 2, res);
      const geom = geomSlope01(heights, 2, 2);
      expect(Math.abs(ground - geom)).toBeLessThanOrEqual(0.1);
    }

    // And the calibration is not degenerate — a 45° ramp reads as real steepness.
    expect(groundSlope01(ramp(1), 2, 2, res)).toBeGreaterThan(0.2);
    // Flat ground is flat.
    expect(groundSlope01(new Float32Array(res * res), 2, 2, res)).toBe(0);
  });
});

describe('sampleGroundChunk snow caps (Task 10)', () => {
  it('blends toward SNOW_RGB above the snow line, full white past the band, and leaves geometry alone', () => {
    // snowLineH defaults to the temperate baseline (SNOW_LINE_H = 55), band 12.
    const below = sampleGroundChunk(flatColorWorld(50), 0, 0, 2);
    const mid = sampleGroundChunk(flatColorWorld(61), 0, 0, 2); // t ≈ 0.5
    const full = sampleGroundChunk(flatColorWorld(67), 0, 0, 2); // t = 1 → SNOW_RGB

    // Below the line: ordinary biome tint (blue channel well under snow's 0.95).
    expect(below.biomeColors![2]).toBeLessThan(0.8);

    // Past the band: essentially pure snow.
    expect(full.biomeColors![0]).toBeCloseTo(SNOW_RGB[0], 2);
    expect(full.biomeColors![1]).toBeCloseTo(SNOW_RGB[1], 2);
    expect(full.biomeColors![2]).toBeCloseTo(SNOW_RGB[2], 2);

    // Mid-band sits strictly between the two.
    expect(mid.biomeColors![0]).toBeGreaterThan(below.biomeColors![0]);
    expect(mid.biomeColors![0]).toBeLessThan(full.biomeColors![0]);

    // Snow is a COLOR effect only — the sampled height (mesh geometry) is untouched.
    expect(full.heights[0]).toBeCloseTo(67, 5);
  });

  it('honors a per-world snowLineH (polar caps snow lower)', () => {
    // At height 45 a temperate window (line 55) has no snow, but a polar window
    // (line 35, band 12 → t = min(1,(45-35)/12) ≈ 0.83) is nearly white.
    const temperate = sampleGroundChunk(flatColorWorld(45, 'grassland'), 0, 0, 2);
    const polar = sampleGroundChunk(flatColorWorld(45, 'grassland', { snowLineH: SNOW_LINE_POLAR }), 0, 0, 2);
    expect(temperate.biomeColors![2]).toBeLessThan(0.8);
    expect(polar.biomeColors![2]).toBeGreaterThan(temperate.biomeColors![2]);
    expect(polar.biomeColors![0]).toBeGreaterThan(temperate.biomeColors![0]);
  });
});

describe('snow-line latitude band (pure helpers)', () => {
  it('resolveSnowLine: polar low, temperate baseline, tropical high, null → temperate fallback', () => {
    expect(resolveSnowLine(75)).toBe(SNOW_LINE_POLAR); // |lat| > 60 polar
    expect(resolveSnowLine(-75)).toBe(SNOW_LINE_POLAR); // southern hemisphere
    expect(resolveSnowLine(45)).toBe(SNOW_LINE_H); // 25..60 temperate
    expect(resolveSnowLine(10)).toBe(SNOW_LINE_TROPICAL); // < 25 tropical
    expect(resolveSnowLine(60)).toBe(SNOW_LINE_H); // boundary: 60 is not > 60
    expect(resolveSnowLine(25)).toBe(SNOW_LINE_H); // boundary: 25 is temperate
    expect(resolveSnowLine(null)).toBe(SNOW_LINE_H); // no mapCoordinates → baseline
  });

  it('latitudeAtGraphY: north edge = latN, south edge = latS, linear between (climate convention)', () => {
    const coords = { latN: 60, latS: 20 };
    expect(latitudeAtGraphY(0, 100, coords)).toBeCloseTo(60, 6);
    expect(latitudeAtGraphY(100, 100, coords)).toBeCloseTo(20, 6);
    expect(latitudeAtGraphY(50, 100, coords)).toBeCloseTo(40, 6);
    expect(latitudeAtGraphY(50, 100, null)).toBeNull(); // atlas-only / crafted
    expect(latitudeAtGraphY(50, 0, coords)).toBeNull(); // degenerate graph
  });
});

describe('makeGroundWorld snow-line threading (anchor seam, mirrors canopy)', () => {
  it('falls back to the temperate baseline without an anchor cell', () => {
    const local = makeLocalArtifact();
    const region = makeRegionArtifact();
    const ground = makeGroundWorld(local, 42, region);
    expect(ground.snowLineH ?? SNOW_LINE_H).toBe(SNOW_LINE_H);
  });

  it('resolves snowLineH from the anchor cell latitude, reading the same atlas the canopy seam does', () => {
    const local = makeLocalArtifact();
    const region = makeRegionArtifact();
    const anchorCellId = 110;
    const atlas = getBridgeAtlas(42); // same per-seed cache makeGroundWorld uses
    const [, cellY] = atlas.pack.cells.p[anchorCellId];
    const expected = resolveSnowLine(
      latitudeAtGraphY(cellY, atlas.graphHeight, atlas.mapCoordinates),
    );

    const ground = makeGroundWorld(local, 42, region, { anchorCellId });
    expect(ground.snowLineH).toBe(expected);
    expect([SNOW_LINE_POLAR, SNOW_LINE_H, SNOW_LINE_TROPICAL]).toContain(ground.snowLineH);
  });
});
