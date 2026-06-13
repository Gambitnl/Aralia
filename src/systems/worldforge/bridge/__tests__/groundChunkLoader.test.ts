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
import { makeGroundWorld, sampleGroundChunk } from '../groundChunkLoader';
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
    rivers: [],
    roads: [],
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
        burgId: 7,
        envelope: { x: 50, y: 50, width: 300, height: 300 },
        gates: [
          [50, 200],
          [350, 200],
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
});
