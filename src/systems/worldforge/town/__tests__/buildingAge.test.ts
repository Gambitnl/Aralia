/**
 * These tests prove that construction age forms stable town growth rings.
 *
 * They cover deterministic building-level variation, normalized-map to
 * feet-space parity, and the intended old-center to new-edge ordering. This
 * keeps age useful as architecture evidence rather than a random cosmetic tag.
 */

import { describe, expect, it } from 'vitest';
import type { Pt } from '../../submap/submapEngine';
import {
  BUILDING_AGE_RANK,
  resolveBuildingAgeBand,
} from '../buildingAge';

// ============================================================================
// Fixed Geometry
// ============================================================================
// Small quads at known radii make the growth-ring oracle independent of the
// production town generator.
// ============================================================================

const core: Pt[] = [
  [-100, -100],
  [100, -100],
  [100, 100],
  [-100, 100],
];

function plotAt(x: number, y: number): Pt[] {
  return [
    [x - 2, y - 2],
    [x + 2, y - 2],
    [x + 2, y + 2],
    [x - 2, y + 2],
  ];
}

function ageAt(x: number, buildingKey: string): keyof typeof BUILDING_AGE_RANK {
  return resolveBuildingAgeBand({
    polygon: plotAt(x, 0),
    townCore: core,
    settlementKey: 'burg:17',
    buildingKey,
  });
}

describe('resolveBuildingAgeBand', () => {
  it('is deterministic for one permanent settlement/building identity', () => {
    expect(ageAt(52, 'plot:12')).toBe(ageAt(52, 'plot:12'));
  });

  it('is invariant under uniform scale and translation for 2D/3D parity', () => {
    const transform = ([x, y]: Pt): Pt => [x * 8.5 + 1200, y * 8.5 - 430];
    const input = {
      polygon: plotAt(68, 12),
      townCore: core,
      settlementKey: 'burg:17',
      buildingKey: 'plot:28',
    };

    expect(resolveBuildingAgeBand({
      ...input,
      polygon: input.polygon.map(transform),
      townCore: input.townCore.map(transform),
    })).toBe(resolveBuildingAgeBand(input));
  });

  it('forms an old-center to new-edge sequence despite bounded lot jitter', () => {
    // Sample many building keys so this checks the growth-ring rule rather than
    // relying on one conveniently hashed lot.
    const radii = [8, 34, 58, 88];
    const averageRanks = radii.map((radius) => {
      const ranks = Array.from({ length: 160 }, (_, index) =>
        BUILDING_AGE_RANK[ageAt(radius, `plot:${index}`)]);
      return ranks.reduce((sum, rank) => sum + rank, 0) / ranks.length;
    });

    expect(averageRanks[0]).toBeGreaterThan(averageRanks[1]);
    expect(averageRanks[1]).toBeGreaterThan(averageRanks[2]);
    expect(averageRanks[2]).toBeGreaterThan(averageRanks[3]);
    expect(ageAt(0, 'plot:center')).toBe('ancient');
    expect(ageAt(98, 'plot:edge')).toBe('new');
  });

  it('rejects degenerate geometry instead of inventing a default age', () => {
    expect(() => resolveBuildingAgeBand({
      polygon: [],
      townCore: core,
      settlementKey: 'burg:17',
      buildingKey: 'plot:1',
    })).toThrow(/building polygon is empty/i);
    expect(() => resolveBuildingAgeBand({
      polygon: plotAt(0, 0),
      townCore: [[0, 0], [0, 0], [0, 0]],
      settlementKey: 'burg:17',
      buildingKey: 'plot:1',
    })).toThrow(/no measurable radius/i);
  });
});

