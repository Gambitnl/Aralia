import { describe, expect, it } from 'vitest';
import {
  generateContinuousSubmapPathDetails,
  generateRoadPortsForTile,
} from '../submapPathContinuity';

const DIMENSIONS = { rows: 20, cols: 30 };

describe('submapPathContinuity', () => {
  it('generates deterministic ports for the same tile + seed', () => {
    const first = generateRoadPortsForTile({
      worldSeed: 7777,
      tileCoords: { x: 8, y: 5 },
      submapDimensions: DIMENSIONS,
      edgeChancePercent: 65,
    });
    const second = generateRoadPortsForTile({
      worldSeed: 7777,
      tileCoords: { x: 8, y: 5 },
      submapDimensions: DIMENSIONS,
      edgeChancePercent: 65,
    });
    expect(first).toEqual(second);
  });

  it('shares identical border port positions across adjacent north/south tiles', () => {
    const northTile = generateRoadPortsForTile({
      worldSeed: 12345,
      tileCoords: { x: 10, y: 4 },
      submapDimensions: DIMENSIONS,
      edgeChancePercent: 75,
    });
    const southTile = generateRoadPortsForTile({
      worldSeed: 12345,
      tileCoords: { x: 10, y: 5 },
      submapDimensions: DIMENSIONS,
      edgeChancePercent: 75,
    });

    if (northTile.south === null || southTile.north === null) {
      expect(northTile.south).toBeNull();
      expect(southTile.north).toBeNull();
      return;
    }

    expect(northTile.south.x).toBe(southTile.north.x);
    expect(northTile.south.y).toBe(DIMENSIONS.rows - 1);
    expect(southTile.north.y).toBe(0);
  });

  it('builds path details that include edge-linked segments when ports are active', () => {
    const details = generateContinuousSubmapPathDetails({
      worldSeed: 24680,
      tileCoords: { x: 12, y: 9 },
      submapDimensions: DIMENSIONS,
      edgeChancePercent: 100,
    });

    expect(details.mainPathCoords.size).toBeGreaterThan(0);
    const hasNorthEntry = Array.from(details.mainPathCoords).some((coord) => coord.endsWith(',0'));
    const hasSouthEntry = Array.from(details.mainPathCoords).some((coord) => coord.endsWith(`,${DIMENSIONS.rows - 1}`));
    const hasWestEntry = Array.from(details.mainPathCoords).some((coord) => coord.startsWith('0,'));
    const hasEastEntry = Array.from(details.mainPathCoords).some((coord) => coord.startsWith(`${DIMENSIONS.cols - 1},`));

    expect(hasNorthEntry).toBe(true);
    expect(hasSouthEntry).toBe(true);
    expect(hasWestEntry).toBe(true);
    expect(hasEastEntry).toBe(true);
  });

  it('keeps network channels deterministic but independent (road vs river)', () => {
    const road = generateRoadPortsForTile({
      worldSeed: 98765,
      tileCoords: { x: 4, y: 7 },
      submapDimensions: DIMENSIONS,
      edgeChancePercent: 80,
      networkId: 'road',
    });
    const river = generateRoadPortsForTile({
      worldSeed: 98765,
      tileCoords: { x: 4, y: 7 },
      submapDimensions: DIMENSIONS,
      edgeChancePercent: 80,
      networkId: 'river',
    });

    expect(road).not.toEqual(river);
  });

  it('shares identical border port positions across adjacent tiles for cliff networks too', () => {
    const westTile = generateRoadPortsForTile({
      worldSeed: 2026,
      tileCoords: { x: 3, y: 11 },
      submapDimensions: DIMENSIONS,
      edgeChancePercent: 90,
      networkId: 'cliff',
    });
    const eastTile = generateRoadPortsForTile({
      worldSeed: 2026,
      tileCoords: { x: 4, y: 11 },
      submapDimensions: DIMENSIONS,
      edgeChancePercent: 90,
      networkId: 'cliff',
    });

    if (westTile.east === null || eastTile.west === null) {
      expect(westTile.east).toBeNull();
      expect(eastTile.west).toBeNull();
      return;
    }

    expect(westTile.east.y).toBe(eastTile.west.y);
    expect(westTile.east.x).toBe(DIMENSIONS.cols - 1);
    expect(eastTile.west.x).toBe(0);
  });
});
