import { describe, it, expect } from 'vitest';
import { computeDangerField, dangerCellsAbove } from '../dangerField';

// Minimal atlas: 4 land cells in a row, 0—1—2—3 adjacency. Cell 0 hosts a war.
const atlas = {
  pack: {
    cells: {
      h: [50, 50, 50, 50],
      biome: [4, 4, 4, 4], // Grassland (calm) everywhere, so danger is zone-driven
      c: [[1], [0, 2], [1, 3], [2]],
    },
    zones: [{ type: 'Invasion', cells: [0] }],
  },
} as any;

describe('computeDangerField', () => {
  it('peaks at the zone source and decays with distance (threat bleeds outward)', () => {
    const f = computeDangerField(atlas, { spreadRings: 2, falloff: 0.5 });
    // Strictly decreasing away from the war at cell 0.
    expect(f[0]).toBeGreaterThan(f[1]);
    expect(f[1]).toBeGreaterThan(f[2]);
    expect(f[0]).toBeGreaterThan(0.8);   // Invasion weight is high at source
    expect(f[3]).toBeLessThan(f[2]);     // furthest cell is calmest
  });

  it('is deterministic (pure function of the pack)', () => {
    const a = computeDangerField(atlas);
    const b = computeDangerField(atlas);
    expect(Array.from(a)).toEqual(Array.from(b));
  });

  it('with no zones, danger reflects only terrain hostility', () => {
    const calm = { pack: { cells: { h: [50], biome: [4], c: [[]] }, zones: [] } } as any;
    const hostile = { pack: { cells: { h: [50], biome: [11], c: [[]] }, zones: [] } } as any; // Glacier
    expect(computeDangerField(calm)[0]).toBeLessThan(computeDangerField(hostile)[0]);
  });

  it('dangerCellsAbove filters by the safe threshold', () => {
    const f = computeDangerField(atlas);
    const flagged = dangerCellsAbove(f, 0.18).map((d) => d.i);
    expect(flagged).toContain(0);          // the war cell is flagged
    expect(flagged.length).toBeLessThan(4); // not every cell is "dangerous"
  });
});

// ── Pillar 2, Task 8: dungeon-site danger term ──────────────────────────────
describe('computeDangerField — dungeon sites (Task 8)', () => {
  // Four calm grassland cells, no zones — so any danger is purely the site term.
  const calm = {
    pack: {
      cells: {
        h: [50, 50, 50, 50],
        biome: [4, 4, 4, 4],
        c: [[1], [0, 2], [1, 3], [2]],
      },
      zones: [],
    },
  } as any;

  it('an UNCLEARED site adds a local bump that decays with distance', () => {
    const base = computeDangerField(calm);
    const withSite = computeDangerField(calm, {
      dungeonSites: [{ cellId: 0, cleared: false }],
    });
    // Bump present at the site cell and its neighbour, decaying outward.
    expect(withSite[0]).toBeGreaterThan(base[0]);
    expect(withSite[0]).toBeGreaterThan(withSite[1]);
    expect(withSite[1]).toBeGreaterThan(withSite[2]);
  });

  it('a CLEARED site contributes nothing (field equals the no-site field)', () => {
    const base = computeDangerField(calm);
    const cleared = computeDangerField(calm, {
      dungeonSites: [{ cellId: 0, cleared: true }],
    });
    expect(Array.from(cleared)).toEqual(Array.from(base));
  });

  it('OMITTING dungeonSites is byte-identical to the pre-Task-8 output', () => {
    const a = computeDangerField(atlas);
    const b = computeDangerField(atlas, {}); // no dungeonSites key
    expect(Array.from(a)).toEqual(Array.from(b));
    // And on the calm atlas too, an empty site list must equal no term at all.
    const c = computeDangerField(calm);
    const d = computeDangerField(calm, { dungeonSites: [] });
    expect(Array.from(c)).toEqual(Array.from(d));
  });

  it('is deterministic and pure with sites (same input → same output, input untouched)', () => {
    const sites = [{ cellId: 0, cleared: false }];
    const snap = JSON.stringify(sites);
    const a = computeDangerField(calm, { dungeonSites: sites });
    const b = computeDangerField(calm, { dungeonSites: sites });
    expect(Array.from(a)).toEqual(Array.from(b));
    expect(JSON.stringify(sites)).toBe(snap); // opts input not mutated
  });

  it('strength override raises the site-cell danger', () => {
    const weak = computeDangerField(calm, { dungeonSites: [{ cellId: 0, cleared: false, strength: 0.2 }] });
    const strong = computeDangerField(calm, { dungeonSites: [{ cellId: 0, cleared: false, strength: 0.9 }] });
    expect(strong[0]).toBeGreaterThan(weak[0]);
  });
});
