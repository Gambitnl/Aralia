/**
 * @file groundWorldAdapter.test.ts — data-level invariants for the
 * LocalArtifact → WorldData adapter (slice 3a of Azgaar → submap → 3D).
 * The streamer-scale parametrization (slice 3b) is tracked separately; these
 * tests pin the unit contract the adapter documents.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { generateFmgAtlas } from '../../fmg/generateAtlas';
import { generateRegion } from '../../region/generateRegion';
import { generateLocal } from '../../local/generateLocal';
import { rootSeedPath } from '../../seedPath';
import { boundsCenter } from '../../units';
import { localArtifactToWorldData, GROUND_METERS_PER_CELL } from '../groundWorldAdapter';
import { sampleChunk } from '../../../world3d/chunkSampler';
import type { LocalArtifact } from '../../artifacts';

let local: LocalArtifact;

describe('groundWorldAdapter (LocalArtifact → WorldData)', () => {
  beforeAll(() => {
    const atlas = generateFmgAtlas('world-42', {
      width: 960, height: 540, cellsDesired: 10000, template: 'continents',
    });
    let anchor = -1;
    for (let i = 0; i < atlas.pack.cells.h.length; i++) {
      if (atlas.pack.cells.h[i] >= 25) { anchor = i; break; }
    }
    const region = generateRegion(atlas, anchor, rootSeedPath(42), {
      feetPerPixel: 9842.51968503937,
    });
    local = generateLocal(region, boundsCenter(region.bounds), region.seedPath, { biomeId: 6 });
  }, 120_000);

  it('unit contract: 5 ft per cell, heights in the 0..100/150 m domain, min at 0', () => {
    expect(GROUND_METERS_PER_CELL).toBeCloseTo(1.524, 6);
    const wd = localArtifactToWorldData(local, 42);
    expect(wd.gridSize).toEqual({ rows: 600, cols: 600 });

    // Aggregate in plain JS — 360k per-element expect() calls time out
    let min = Infinity, max = -Infinity, outOfDomain = 0;
    for (const h of wd.heights) {
      if (h < 0 || h > 100) outOfDomain++;
      if (h < min) min = h;
      if (h > max) max = h;
    }
    expect(outOfDomain).toBe(0);
    expect(min).toBe(0); // artifact's lowest point anchors y = 0
    // Encoding pre-divides the 12× continent exaggeration, so 1 height unit
    // = 18 m of REAL ground; modest local relief lands well under 10 units.
    expect(max).toBeLessThan(10);
    expect(max).toBeGreaterThan(0); // non-flat
  });

  it('biome mapping covers every material with a palette id', () => {
    const wd = localArtifactToWorldData(local, 42);
    const KNOWN = new Set(['plains', 'mountain', 'desert', 'wetland', 'water', 'forest']);
    for (const id of new Set(wd.biomeIds)) {
      expect(KNOWN.has(id)).toBe(true);
    }
    expect(wd.biomeIds.length).toBe(wd.heights.length);
  });

  it('the real world3d sampleChunk accepts the adapted world (pipeline compat)', () => {
    const wd = localArtifactToWorldData(local, 42);
    const chunk = sampleChunk(wd, 0, 0, 16);
    expect(chunk.resolution).toBe(16);
    expect(chunk.heights.length).toBe(256);
    for (const h of chunk.heights) expect(Number.isFinite(h)).toBe(true);
  });

  it('deterministic: same artifact → identical WorldData', () => {
    const a = localArtifactToWorldData(local, 42);
    const b = localArtifactToWorldData(local, 42);
    expect(b.heights).toEqual(a.heights);
    expect(b.biomeIds).toEqual(a.biomeIds);
    expect(b.templateId).toBe(a.templateId);
  });
});
