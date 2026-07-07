/**
 * @file civSites.test.ts — Pillar 2, Task 2 (civilization archaeology).
 *
 * Exercises the origin-'civ' sites appended by `enumerateDungeonSites`: war-zone
 * fortress ruins, plague-zone necropolis crypts, and ore-mountain mines. As in
 * the Task-1 suite, assertions are STRUCTURAL invariants over the enumerated
 * sites (the exact zone/marker layout depends on FMG's Math.random world gen,
 * stable only within a process), not hard-coded golden counts.
 */
import { getBridgeAtlas } from '../../../bridge/legacySubmapBridge';
import { enumerateDungeonSites, type DungeonSite } from '../dungeonSites';

const SEEDS = [7, 12345, 99999] as const;
const LAND_H = 20;
const MOUNTAIN_H = 70;
const WAR_ZONE_TYPES = new Set(['Invasion', 'Rebels', 'Crusade']);
const MAX_CIV_SITES_PER_STATE = 3;

interface ZoneLike { i: number; type?: string; name?: string; cells?: number[] }
interface BurgLike { i?: number; cell?: number; removed?: boolean; state?: number }

function atlasFor(seed: number) {
  const atlas = getBridgeAtlas(seed);
  const pack = atlas.pack as any;
  return {
    cells: pack.cells as {
      h: ArrayLike<number>;
      c: ReadonlyArray<ReadonlyArray<number>>;
      state?: ArrayLike<number>;
    },
    zones: (pack.zones ?? []) as ZoneLike[],
    burgs: (pack.burgs ?? []) as BurgLike[],
  };
}

function civSites(seed: number): DungeonSite[] {
  return enumerateDungeonSites(seed).filter((s) => s.origin === 'civ');
}

describe('civilization-archaeology sites — Pillar 2 Task 2', () => {
  it('the test seeds actually contain war and plague zones (non-vacuous)', () => {
    let seedsWithWar = 0;
    let seedsWithPlague = 0;
    for (const seed of SEEDS) {
      const { zones } = atlasFor(seed);
      if (zones.some((z) => WAR_ZONE_TYPES.has(z.type ?? ''))) seedsWithWar++;
      if (zones.some((z) => (z.type ?? '') === 'Disease')) seedsWithPlague++;
    }
    expect(seedsWithWar).toBe(SEEDS.length);
    expect(seedsWithPlague).toBeGreaterThan(0);
  });

  it('at least one seed produces war-zone (fortress) sites — not vacuously green', () => {
    const total = SEEDS.reduce(
      (n, seed) => n + civSites(seed).filter((s) => s.provenance?.kind === 'war-zone').length,
      0,
    );
    expect(total).toBeGreaterThan(0);
  });

  it('prints per-origin site counts for each seed', () => {
    for (const seed of SEEDS) {
      const all = enumerateDungeonSites(seed);
      const byOrigin: Record<string, number> = {};
      for (const s of all) byOrigin[s.origin] = (byOrigin[s.origin] ?? 0) + 1;
      const civByKind: Record<string, number> = {};
      for (const s of all)
        if (s.origin === 'civ')
          civByKind[s.provenance!.kind] = (civByKind[s.provenance!.kind] ?? 0) + 1;
      console.log(
        `seed ${seed}: total=${all.length} byOrigin=${JSON.stringify(byOrigin)} civByKind=${JSON.stringify(civByKind)}`,
      );
      expect(all.length).toBeGreaterThan(0);
    }
  });

  describe.each(SEEDS)('seed %d', (seed) => {
    const { cells, zones, burgs } = atlasFor(seed);
    const all = enumerateDungeonSites(seed);
    const civ = all.filter((s) => s.origin === 'civ');
    const zoneById = new Map(zones.map((z) => [z.i, z]));

    it('every civ site sits on a land cell', () => {
      for (const s of civ) {
        expect(cells.h[s.cellId]).toBeGreaterThanOrEqual(LAND_H);
      }
    });

    it('every civ site carries a provenance of the right shape', () => {
      for (const s of civ) {
        expect(s.provenance).toBeDefined();
        expect(['war-zone', 'plague-zone', 'ore-mountain']).toContain(s.provenance!.kind);
      }
    });

    it('war sites cite a REAL zone whose type is an armed conflict', () => {
      for (const s of civ) {
        if (s.provenance?.kind !== 'war-zone') continue;
        const z = zoneById.get(s.provenance.zoneId!);
        expect(z).toBeDefined();
        expect(WAR_ZONE_TYPES.has(z!.type ?? '')).toBe(true);
        expect(s.provenance.zoneName).toBe(z!.name);
        // The site cell is the zone's commanding cell → it belongs to the zone.
        expect(z!.cells).toContain(s.cellId);
        expect(s.archetype).toBe('fortress');
        expect(s.entranceKind).toBe('ruin-door');
        expect(['frost', 'crypt']).toContain(s.theme);
      }
    });

    it('plague sites cite a REAL Disease zone and anchor to a nearby burg', () => {
      const inZoneOrAdjacent = (cell: number, zoneCells: number[]): boolean => {
        const set = new Set(zoneCells);
        if (set.has(cell)) return true;
        for (const j of cells.c[cell] ?? []) if (set.has(j)) return true;
        return false;
      };
      for (const s of civ) {
        if (s.provenance?.kind !== 'plague-zone') continue;
        const z = zoneById.get(s.provenance.zoneId!);
        expect(z).toBeDefined();
        expect(z!.type).toBe('Disease');
        expect(s.provenance.zoneName).toBe(z!.name);
        // Anchored to a live burg's cell, and that burg touches the zone.
        expect(typeof s.burgId).toBe('number');
        const b = burgs[s.burgId!];
        expect(b).toBeDefined();
        expect(b.i).toBeGreaterThan(0);
        expect(b.removed).not.toBe(true);
        expect(b.cell).toBe(s.cellId);
        expect(inZoneOrAdjacent(s.cellId, z!.cells ?? [])).toBe(true);
        expect(s.archetype).toBe('mausoleum');
        expect(s.theme).toBe('crypt');
      }
    });

    it('mine sites sit on mountain cells (h >= 70) and bind to a burg', () => {
      for (const s of civ) {
        if (s.provenance?.kind !== 'ore-mountain') continue;
        expect(cells.h[s.cellId]).toBeGreaterThanOrEqual(MOUNTAIN_H);
        expect(typeof s.burgId).toBe('number');
        const b = burgs[s.burgId!];
        expect(b).toBeDefined();
        expect(b.i).toBeGreaterThan(0);
        expect(s.archetype).toBe('mine');
        expect(s.entranceKind).toBe('cave-mouth');
        expect(s.theme).toBe('cavern');
      }
    });

    it('mines are world-budgeted: at most ~1 per two states, at most 1 per state', () => {
      const mines = civ.filter((s) => s.provenance?.kind === 'ore-mountain');
      const liveStates = new Set<number>();
      for (const b of burgs) if (b && b.i !== 0 && !b.removed) liveStates.add(b.state ?? -1);
      const budget = Math.floor(liveStates.size / 2);
      expect(mines.length).toBeLessThanOrEqual(budget);
      // ≤ 1 per state.
      const mineStates = mines.map((s) => (cells.state ? cells.state[s.cellId] : -1));
      expect(new Set(mineStates).size).toBe(mineStates.length);
    });

    it('caps total civ sites per state at 3', () => {
      const perState = new Map<number, number>();
      for (const s of civ) {
        const st = cells.state ? cells.state[s.cellId] : -1;
        perState.set(st, (perState.get(st) ?? 0) + 1);
      }
      for (const n of perState.values()) {
        expect(n).toBeLessThanOrEqual(MAX_CIV_SITES_PER_STATE);
      }
    });

    it('no civ site shares a cell with any non-civ site (dedupe by cellId)', () => {
      const nonCivCells = new Set(
        all.filter((s) => s.origin !== 'civ').map((s) => s.cellId),
      );
      for (const s of civ) {
        expect(nonCivCells.has(s.cellId)).toBe(false);
      }
    });

    it('no two CIV sites share a cellId (civ concerns dedupe among themselves)', () => {
      const seen = new Set<number>();
      for (const s of civ) {
        expect(seen.has(s.cellId)).toBe(false);
        seen.add(s.cellId);
      }
    });

    it('is deterministic across repeat calls', () => {
      const a = enumerateDungeonSites(seed);
      const b = enumerateDungeonSites(seed);
      expect(JSON.stringify(a)).toEqual(JSON.stringify(b));
    });
  });

  it('sitePaths are unique across ALL origins for seeds {7, 12345, 99999}', () => {
    for (const seed of SEEDS) {
      const all = enumerateDungeonSites(seed);
      const paths = new Set(all.map((s) => s.sitePath));
      expect(paths.size).toBe(all.length);
    }
  });

  it('civ sitePaths follow the documented grammar', () => {
    for (const seed of SEEDS) {
      for (const s of civSites(seed)) {
        if (s.provenance?.kind === 'ore-mountain') {
          expect(s.sitePath).toBe(`wf:${seed}/cell:${s.cellId}/dungeon:mine`);
        } else {
          expect(s.sitePath).toBe(
            `wf:${seed}/cell:${s.cellId}/dungeon:z${s.provenance!.zoneId}`,
          );
        }
      }
    }
  });
});
