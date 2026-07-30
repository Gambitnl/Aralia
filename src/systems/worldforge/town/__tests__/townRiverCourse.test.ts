import { describe, it, expect } from 'vitest';
import { getBridgeAtlas } from '../../bridge/legacySubmapBridge';
import { townRiverCourseCanon } from '../townRiverCourse';
import { CANON_TOWN_SPAN } from '../canonicalTown';

const SEED = 903674813;
const BURG = 5;

describe('town river course', () => {
  it('puts Epicea river inside the town at true scale', () => {
    const atlas = getBridgeAtlas(SEED);
    const lines = townRiverCourseCanon(atlas, SEED, BURG).lines;
    expect(lines.length).toBeGreaterThan(0);

    // Clipped to the town square, so nothing may sit far outside it.
    const half = CANON_TOWN_SPAN / 2;
    for (const line of lines) {
      for (const [x, y] of line) {
        expect(Math.abs(x)).toBeLessThanOrEqual(half * 1.05);
        expect(Math.abs(y)).toBeLessThanOrEqual(half * 1.05);
      }
    }
  }, 120000);

  it('is deterministic for a given atlas and burg', () => {
    const atlas = getBridgeAtlas(SEED);
    expect(townRiverCourseCanon(atlas, SEED, BURG))
      .toEqual(townRiverCourseCanon(atlas, SEED, BURG));
  }, 120000);

  it('returns nothing for a burg whose cell carries no river', () => {
    const atlas = getBridgeAtlas(SEED);
    const cells = atlas.pack.cells as unknown as { r?: ArrayLike<number> };
    const burgs = atlas.pack.burgs as Array<{ i?: number; cell: number; removed?: boolean }>;
    const dry = burgs.find((b) => b?.i && !b.removed && !cells.r?.[b.cell]);
    expect(dry).toBeDefined();
    // No-fallback: a dry town gets no river rather than an invented one.
    expect(townRiverCourseCanon(atlas, SEED, dry!.i!).lines).toEqual([]);
  }, 120000);

  it('is the SAME line the region tier carves', async () => {
    // The entire point of the pass: the town river and the wilderness river are
    // one river. Both tiers derive the course independently from world data, so
    // the proof is that the town's line lies ON the region's stored centerline.
    const { getWorldforgeLocalForCell } = await import('../../bridge/legacySubmapBridge');
    const atlas = getBridgeAtlas(SEED);
    const burg = (atlas.pack.burgs as Array<{ x: number; y: number; cell: number }>)[BURG];
    const riverId = Number(
      (atlas.pack.cells as unknown as { r: ArrayLike<number> }).r[burg.cell],
    );
    const { region } = getWorldforgeLocalForCell(SEED, burg.cell, {
      centerPx: [burg.x, burg.y],
    });
    const regionRiver = region.rivers.find((r) => r.riverId === riverId);
    expect(regionRiver).toBeDefined();

    // Undo the town's normalization to get back to world feet.
    const site = region.townSites.find((t) => t.burgId === BURG)!;
    const spanFt = site.envelope.width - 400; // envelope = span + 2 x 200 ft apron
    const k = spanFt / CANON_TOWN_SPAN;
    const cx = site.envelope.x + site.envelope.width / 2;
    const cy = site.envelope.y + site.envelope.height / 2;

    const lines = townRiverCourseCanon(atlas, SEED, BURG).lines;
    expect(lines.length).toBeGreaterThan(0);
    for (const line of lines) {
      for (const [nx, ny] of line) {
        const x = nx * k + cx;
        const y = ny * k + cy;
        const nearest = Math.min(
          ...regionRiver!.centerline.map(([rx, ry]) => Math.hypot(rx - x, ry - y)),
        );
        // Within one course segment (200 ft) of the region's own polyline.
        expect(nearest).toBeLessThan(200);
      }
    }
  }, 120000);
});
