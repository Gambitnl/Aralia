/**
 * @file seamProbe.test.ts — open-region seam-first slice (2026-07-01).
 *
 * The probe builds the smallest honest region→region boundary: two ADJACENT
 * atlas cells, each generating its OWN region (own IDW membership, own window),
 * with one locale per region flanking the shared boundary line, stitched into
 * a single ground-ready LocalArtifact. These tests pin the recipe:
 *  - the picked pair is a real east-west land adjacency,
 *  - the stitched artifact is double-width and centered on the seam,
 *  - the region handoff residual at the boundary (sampled from BOTH region
 *    heightfields at identical world points) stays under the same 0.01
 *    normalized (= 20 ft) budget the seam-continuity fix froze.
 */
import { describe, expect, it, beforeAll } from 'vitest';
import { generateFmgAtlas, type FmgAtlasResult } from '../../fmg/generateAtlas';
import { pickSeamCellPair, buildSeamStitchedLocal } from '../seamProbe';

const SEED = 'world-42';
const WORLD_SEED = 42;
const FEET_PER_PIXEL = 1000; // test-ish scale: region windows overlap (offline proof used this)

describe('seamProbe', () => {
  let atlas: FmgAtlasResult;

  beforeAll(() => {
    atlas = generateFmgAtlas(SEED, {
      width: 960,
      height: 540,
      cellsDesired: 10000,
      template: 'continents',
    });
  });

  it('picks an east-west adjacent land cell pair', () => {
    const { cellA, cellB } = pickSeamCellPair(atlas, FEET_PER_PIXEL);
    const { cells } = atlas.pack;
    expect(cells.h[cellA]).toBeGreaterThanOrEqual(20);
    expect(cells.h[cellB]).toBeGreaterThanOrEqual(20);
    expect(cells.c[cellA]).toContain(cellB);
    expect(cells.p[cellB][0]).toBeGreaterThan(cells.p[cellA][0]);
  });

  it('stitches one locale per region across the shared boundary', () => {
    const { cellA, cellB } = pickSeamCellPair(atlas, FEET_PER_PIXEL);
    const result = buildSeamStitchedLocal(atlas, WORLD_SEED, {
      feetPerPixel: FEET_PER_PIXEL,
      cellA,
      cellB,
    });

    // 600×600 5-ft cells per locale → 1200×600 stitched.
    expect(result.stitched.terrain.widthCells).toBe(1200);
    expect(result.stitched.terrain.heightCells).toBe(600);
    // The seam is the artifact's vertical centerline.
    expect(result.seamWorldXFt).toBeCloseTo(
      result.stitched.bounds.x + result.stitched.bounds.width / 2,
      6,
    );
    // No NaN leaked into the stitched heights.
    const e = result.stitched.terrain.elevationFt;
    for (let i = 0; i < e.length; i += 1013) expect(Number.isNaN(e[i])).toBe(false);
  });

  it('keeps the region handoff residual far below the pre-fix noise cliff', () => {
    const { cellA, cellB } = pickSeamCellPair(atlas, FEET_PER_PIXEL);
    const result = buildSeamStitchedLocal(atlas, WORLD_SEED, {
      feetPerPixel: FEET_PER_PIXEL,
      cellA,
      cellB,
    });
    // Empirical state of the handoff (this atlas):
    //  - pre-noise-fix: relief noise disagreed by ~0.177 normalized = ~354 ft
    //  - post-noise-fix (2026-07-01), hilliest pair: ~37 ft — IDW membership
    //    residual (each window averaged a different BFS member-cell set).
    //  - post-IDW-fix (2026-07-02): the IDW base is a pure function of world
    //    position (per-sample fixed-radius neighborhood), so two regions agree
    //    EXACTLY at shared world points. Budget: <1 ft.
    expect(result.maxJoinDeltaFt).toBeLessThan(1);
  });
});
