/**
 * @file fmgWorld.test.ts — golden-seed regression tests for the ported FMG
 * world slice 3 (Worldforge build-order item 2c): ice → rankCells →
 * cultures → burgs → states → routes → religions → burg features → state
 * forms → provinces → river/lake names.
 *
 * THE GOLDEN VALUES IN THIS FILE ARE FROZEN PERSISTENCE CONTRACTS
 * (SPEC.md §4, decision #14): seed paths address saved worlds, so a change
 * that breaks these assertions silently regenerates every player's world
 * differently. If a test here fails after a refactor, the refactor is wrong —
 * do not update the constants without an explicit owner-approved world-break
 * decision recorded in docs/projects/worldforge/DECISIONS.md.
 *
 * The goldens were computed by actually running the ported code (vitest,
 * 2026-06-11) and then hard-coded. They double as the upstream-fidelity
 * contract: the port keeps FMG's RNG draw order (Ice.generate's Alea(seed)
 * reseed feeding the whole civilization chain, Provinces' second reseed), so
 * these values must also match what upstream FMG (TS refactor branch at
 * .tmp/azgaar-src) produces for the same seed/options. See ../ATTRIBUTION.md.
 */
import { generateFmgWorld, type FmgWorldResult } from '../generateWorld';
import type { Burg } from '../burgs-generator';
import type { Route } from '../routes-generator';
import {
  FOREST_MIN_CELLS,
  FOREST_POI_MAX_PER_FOREST,
  FOREST_POI_PER_CELLS,
} from '../../forests/forestTunables';
import {
  RANGE_MIN_H,
  RANGE_MIN_CELLS,
  PEAK_MIN_H,
  PEAKS_PER_RANGE_MAX,
  PASS_WORDS,
} from '../../mountains/mountainTunables';

const GOLDEN_SEED = 'aralia-fmg-golden-1';
const GOLDEN_OPTIONS = { width: 320, height: 180, cellsDesired: 1000 };

// the default-options world is expensive (~1s); generate it once and share
let defaultWorldCache: FmgWorldResult | null = null;
function defaultWorld(): FmgWorldResult {
  if (!defaultWorldCache) defaultWorldCache = generateFmgWorld('test-seed-1');
  return defaultWorldCache;
}

describe('fmg world — determinism', () => {
  it('same seed twice produces deep-equal civilization outputs', () => {
    const a = generateFmgWorld('test-seed-1', GOLDEN_OPTIONS);
    const b = generateFmgWorld('test-seed-1', GOLDEN_OPTIONS);

    // strip the per-run sort/odd function fields cultures carry transiently
    const cultures = (r: FmgWorldResult) =>
      r.pack.cultures!.map((c) => ({
        name: c.name,
        base: c.base,
        center: c.center,
        type: c.type,
        expansionism: c.expansionism,
        color: c.color,
        code: c.code,
        shield: c.shield,
      }));
    expect(cultures(a)).toEqual(cultures(b));
    expect(a.pack.states).toEqual(b.pack.states);
    expect(a.pack.burgs).toEqual(b.pack.burgs);
    expect(a.pack.routes).toEqual(b.pack.routes);
    expect(a.pack.religions).toEqual(b.pack.religions);
    expect(a.pack.provinces).toEqual(b.pack.provinces);
    expect(a.pack.ice).toEqual(b.pack.ice);
    expect(a.pack.rivers).toEqual(b.pack.rivers);
    expect(Array.from(a.pack.cells.culture!)).toEqual(
      Array.from(b.pack.cells.culture!),
    );
    expect(Array.from(a.pack.cells.state!)).toEqual(
      Array.from(b.pack.cells.state!),
    );
    expect(Array.from(a.pack.cells.religion!)).toEqual(
      Array.from(b.pack.cells.religion!),
    );
    expect(Array.from(a.pack.cells.province!)).toEqual(
      Array.from(b.pack.cells.province!),
    );
    // forests (Aralia stage 36, own RNG stream) extend the determinism signature
    expect(a.pack.forests).toEqual(b.pack.forests);
    // forest POI markers (Task 8a) append to pack.markers deterministically
    expect(a.markers).toEqual(b.markers);
    // ranges + peaks (Aralia stage 37, own RNG stream) extend it further
    expect(a.pack.ranges).toEqual(b.pack.ranges);
    expect(a.pack.peaks).toEqual(b.pack.peaks);
    // passes (stage 37's rng-free detection over routes × ranges) too
    expect(a.pack.passes).toEqual(b.pack.passes);
  });

  it('restores Math.random after generation', () => {
    const original = Math.random;
    generateFmgWorld('test-seed-1', GOLDEN_OPTIONS);
    expect(Math.random).toBe(original);
  });
});

describe('fmg world — golden snapshot (FROZEN)', () => {
  it('pins the small golden world (continents, 320x180, 1000 cells)', () => {
    const result = generateFmgWorld(GOLDEN_SEED, GOLDEN_OPTIONS);
    const { pack } = result;

    // FROZEN goldens — computed by running this code, do not update casually.

    // rankCells suitability/population
    expect(
      Array.from(pack.cells.s!).reduce((a, b) => a + b, 0),
    ).toBe(6386);
    expect(
      Math.round(Array.from(pack.cells.pop!).reduce((a, b) => a + b, 0)),
    ).toBe(4585);

    // ice (the stage whose Alea(seed) reseed feeds the whole civ chain)
    expect(pack.ice!.length).toBe(1);
    expect(pack.ice![0].type).toBe('glacier');

    // cultures: 12 requested (default) + Wildlands placeholder
    expect(pack.cultures!.length).toBe(13);
    expect(pack.cultures![0].name).toBe('Wildlands');
    expect(
      pack.cultures!.slice(1, 4).map((c) => ({
        name: c.name,
        type: c.type,
        center: c.center,
        expansionism: c.expansionism,
        code: c.code,
      })),
    ).toEqual([
      { name: 'Angshire', type: 'Generic', center: 112, expansionism: 1.2, code: 'An' },
      { name: 'Berberan', type: 'Hunting', center: 433, expansionism: 1.6, code: 'Be' },
      { name: 'Shwazen', type: 'Highland', center: 558, expansionism: 3.6, code: 'Sh' },
    ]);
    expect(
      Array.from(pack.cells.culture!).filter((v) => v > 0).length,
    ).toBe(325);

    // states: 18 (default statesNumber) + Neutrals placeholder
    expect(pack.states!.length).toBe(19);
    expect(pack.states![0].name).toBe('Neutrals');
    expect(
      pack.states!.slice(1, 4).map((s) => ({
        name: s.name,
        fullName: s.fullName,
        formName: s.formName,
        capital: s.capital,
        center: s.center,
        culture: s.culture,
      })),
    ).toEqual([
      { name: 'Throdos', fullName: 'Principality of Throdos', formName: 'Principality', capital: 1, center: 568, culture: 5 },
      { name: 'Trosia', fullName: 'Principality of Trosia', formName: 'Principality', capital: 2, center: 445, culture: 5 },
      { name: 'Korkelyurt', fullName: 'Korkelyurt Horde', formName: 'Horde', capital: 3, center: 700, culture: 12 },
    ]);
    expect(
      Array.from(pack.cells.state!).filter((v) => v > 0).length,
    ).toBe(367);

    // burgs (placeholder + 18 capitals + towns)
    expect(pack.burgs!.length).toBe(326);
    expect(
      pack.burgs!.filter((b) => b.i && !b.removed && b.capital).length,
    ).toBe(18);
    expect(
      pack.burgs!.slice(1, 6).map((b) => ({
        name: b.name,
        cell: b.cell,
        x: b.x,
        y: b.y,
        population: b.population,
        group: b.group,
      })),
    ).toEqual([
      { name: 'Histhos', cell: 568, x: 304.32, y: 109.12, population: 4.808, group: 'capital' },
      { name: 'Trosia', cell: 445, x: 293.83, y: 82.23, population: 13.918, group: 'capital' },
      { name: 'Korkeli', cell: 700, x: 272.75, y: 134.23, population: 35.841, group: 'capital' },
      { name: 'Leivis', cell: 35, x: 86.55, y: 24.7, population: 3.342, group: 'capital' },
      { name: 'Metown', cell: 166, x: 27.88, y: 51.56, population: 3.882, group: 'capital' },
    ]);

    // routes by tier (road-systems Task 5). The pre-split trunk network (12
    // "roads") is now labeled "highways" verbatim; the old 199 "trails" split
    // by burg importance into town "roads" + village "trails", merged
    // per-group (so tiers never blend) — that separate merge yields the +6
    // total (247→253). searoutes unchanged. Task 7 then adds 38 village
    // forest-spur "paths" (253→291); the four earlier groups stay
    // byte-identical because paths generate last among land groups, only ADD
    // connections, and stay out of the cell-link index.
    expect(pack.routes!.length).toBe(291);
    expect({
      highways: pack.routes!.filter((r) => r.group === 'highways').length,
      roads: pack.routes!.filter((r) => r.group === 'roads').length,
      trails: pack.routes!.filter((r) => r.group === 'trails').length,
      paths: pack.routes!.filter((r) => r.group === 'paths').length,
      searoutes: pack.routes!.filter((r) => r.group === 'searoutes').length,
    }).toEqual({ highways: 12, roads: 8, trails: 197, paths: 38, searoutes: 36 });

    // religions: 12 folk (per culture) + 6 organized (default) + placeholder
    expect(pack.religions!.length).toBe(19);
    expect(pack.religions![0].name).toBe('No religion');
    expect(
      pack.religions!.slice(1, 4).map((r) => ({
        name: r.name,
        type: r.type,
        form: r.form,
        deity: r.deity,
        center: r.center,
      })),
    ).toEqual([
      { name: 'Angshire Pantheon', type: 'Folk', form: 'Polytheism', deity: 'Winkneth, The Yellow Rook', center: 112 },
      { name: 'Berberan Spirits', type: 'Folk', form: 'Shamanism', deity: 'Mibiamiz, The Honest Hippogriff', center: 433 },
      { name: 'Shwazen Spirits', type: 'Folk', form: 'Shamanism', deity: 'Schonhan, The Bronze Chief', center: 558 },
    ]);
    expect(
      Array.from(pack.cells.religion!).filter((v) => v > 0).length,
    ).toBe(325);

    // provinces
    expect(pack.provinces!.length).toBe(75);
    expect(
      pack.provinces!.slice(1, 4).map((p) => ({
        name: p.name,
        fullName: p.fullName,
        state: p.state,
      })),
    ).toEqual([
      { name: 'Histhos', fullName: 'Histhos County', state: 1 },
      { name: 'Ugelia', fullName: 'Ugelia Earldom', state: 1 },
      { name: 'Myolisia', fullName: 'Myolisia Earldom', state: 1 },
    ]);
    expect(
      Array.from(pack.cells.province!).filter((v) => v > 0).length,
    ).toBe(367);

    // river naming (Rivers.specify on the post-Provinces stream)
    expect(pack.rivers![0]).toMatchObject({
      name: 'Chaliondos',
      type: 'River',
      basin: 1,
    });
  });

  it('pins the default-options world (continents, 960x540, 10000 cells)', () => {
    const { pack } = defaultWorld();

    // FROZEN goldens — computed by running this code, do not update casually.
    expect(pack.cultures!.length).toBe(13);
    expect(pack.cultures!.slice(1, 4).map((c) => c.name)).toEqual([
      'Elladan',
      'Portuzian',
      'Tallian',
    ]);

    expect(pack.states!.length).toBe(19);
    expect(pack.states!.slice(1, 4).map((s) => s.name)).toEqual([
      'Sitersgia',
      'Rusland',
      'Tombekia',
    ]);

    expect(pack.burgs!.length).toBe(795);
    expect(
      pack.burgs!.filter((b) => b.i && !b.removed && b.capital).length,
    ).toBe(18);
    expect(
      pack.burgs!.slice(1, 6).map((b) => ({
        name: b.name,
        cell: b.cell,
        x: b.x,
        y: b.y,
      })),
    ).toEqual([
      { name: 'Elingen', cell: 5301, x: 179.92, y: 392.04 },
      { name: 'Breit', cell: 5847, x: 380.48, y: 425.85 },
      { name: 'Alasz', cell: 1277, x: 340.24, y: 136.62 },
      { name: 'Malswegen', cell: 4194, x: 180.63, y: 327.9 },
      { name: 'Braun', cell: 4959, x: 378.8, y: 372.78 },
    ]);

    expect({
      highways: pack.routes!.filter((r) => r.group === 'highways').length,
      roads: pack.routes!.filter((r) => r.group === 'roads').length,
      trails: pack.routes!.filter((r) => r.group === 'trails').length,
      paths: pack.routes!.filter((r) => r.group === 'paths').length,
      searoutes: pack.routes!.filter((r) => r.group === 'searoutes').length,
    // Tier split (Task 5): pre-split 11 "roads" trunk → 11 "highways"; old 456
    // "trails" → town "roads" + village "trails" (per-group merge). searoutes:
    // 104→108 (world-break D3 2026-06-26: ensureIslandHarbors default-ON promotes 4 ports).
    // Task 7 adds 159 village forest-spur "paths"; the other groups are unchanged.
    }).toEqual({ highways: 11, roads: 31, trails: 446, paths: 159, searoutes: 108 });

    expect(pack.religions!.length).toBe(19);
    expect(pack.provinces!.length).toBe(209);
    expect(pack.provinces!.slice(1, 4).map((p) => p.fullName)).toEqual([
      'Dotnaunia Shire',
      'Dunbach County',
      'Nieuen Shire',
    ]);
    expect(pack.ice!.length).toBe(691);

    // river + lake names
    expect(
      pack.rivers!.slice(0, 2).map((r) => ({
        name: r.name,
        type: r.type,
        basin: r.basin,
      })),
    ).toEqual([
      { name: 'Phodinion', type: 'River', basin: 1 },
      { name: 'Dicos', type: 'River', basin: 2 },
    ]);
    const lakeNames = pack.features
      .filter((f) => f && f.type === 'lake')
      .map((f) => f.name);
    expect(lakeNames).toEqual([
      'Biyawoporo',
      'Awgwarga',
      'Tzormubah',
      'Zefarad',
      'Geilerken',
      'Bollsberg',
    ]);
  });
});

describe('fmg world — sanity invariants', () => {
  it('produces structurally valid cultures, burgs, states and religions', () => {
    const { pack } = defaultWorld();
    const cellCount = pack.cells.i.length;

    // every burg sits on a valid land cell and back-references match
    const validBurgs = pack.burgs!.filter((b) => b.i && !b.removed);
    expect(validBurgs.length).toBeGreaterThan(0);
    for (const burg of validBurgs) {
      expect(burg.cell).toBeGreaterThanOrEqual(0);
      expect(burg.cell).toBeLessThan(cellCount);
      expect(pack.cells.h[burg.cell]).toBeGreaterThanOrEqual(20); // land
      expect(pack.cells.burg![burg.cell]).toBe(burg.i); // back-reference
      expect(Number.isFinite(burg.x)).toBe(true); // no NaN coordinates
      expect(Number.isFinite(burg.y)).toBe(true);
      expect(burg.population).toBeGreaterThan(0);
      expect(burg.culture).toBeLessThan(pack.cultures!.length);
      expect(burg.state).toBeLessThan(pack.states!.length);
    }

    // capital count == non-neutral state count
    const capitals = validBurgs.filter((b) => b.capital);
    expect(capitals.length).toBe(pack.states!.length - 1);
    // every non-neutral state's capital is a real capital burg of that state
    for (const state of pack.states!.slice(1)) {
      if (state.removed) continue;
      const capital = pack.burgs![state.capital];
      expect(capital.capital).toBe(1);
      expect(capital.state).toBe(state.i);
      expect(Number.isFinite(state.pole![0])).toBe(true);
      expect(Number.isFinite(state.pole![1])).toBe(true);
    }

    // cell layers reference valid collection indices
    const culture = Array.from(pack.cells.culture!);
    expect(culture.every((c) => c >= 0 && c < pack.cultures!.length)).toBe(
      true,
    );
    const state = Array.from(pack.cells.state!);
    expect(state.every((s) => s >= 0 && s < pack.states!.length)).toBe(true);
    const religion = Array.from(pack.cells.religion!);
    expect(
      religion.every((r) => r >= 0 && r < pack.religions!.length),
    ).toBe(true);
    const province = Array.from(pack.cells.province!);
    expect(
      province.every((p) => p >= 0 && p < pack.provinces!.length),
    ).toBe(true);

    // religions reference valid cultures/centers
    for (const r of pack.religions!.slice(1)) {
      if (r.removed) continue;
      expect(r.culture).toBeLessThan(pack.cultures!.length);
      expect(r.center).toBeGreaterThanOrEqual(0);
      expect(r.center).toBeLessThan(cellCount);
    }

    // provinces reference valid states
    for (const p of pack.provinces!.slice(1)) {
      if (!p || p.removed) continue;
      expect(p.state).toBeGreaterThan(0);
      expect(p.state).toBeLessThan(pack.states!.length);
    }
  });

  it('produces routes that reference valid cells and burg links', () => {
    const { pack } = defaultWorld();
    const cellCount = pack.cells.i.length;

    expect(pack.routes!.length).toBeGreaterThan(0);
    for (const route of pack.routes!) {
      expect(['highways', 'roads', 'trails', 'paths', 'searoutes']).toContain(route.group);
      expect(route.points.length).toBeGreaterThanOrEqual(2);
      for (const [x, y, cellId] of route.points) {
        expect(Number.isFinite(x)).toBe(true); // no NaN coordinates
        expect(Number.isFinite(y)).toBe(true);
        expect(cellId).toBeGreaterThanOrEqual(0);
        expect(cellId).toBeLessThan(cellCount);
      }
    }

    // cell-to-cell route links reference existing routes
    const routeIds = new Set(pack.routes!.map((r) => r.i));
    const links = pack.cells.routes!;
    const linkEntries = Object.entries(links);
    expect(linkEntries.length).toBeGreaterThan(0);
    for (const [fromCell, connections] of linkEntries) {
      expect(+fromCell).toBeLessThan(cellCount);
      for (const [toCell, routeId] of Object.entries(connections)) {
        expect(+toCell).toBeLessThan(cellCount);
        expect(routeIds.has(routeId)).toBe(true);
      }
    }

    // highways connect capitals: the trunk network (pre-split "roads") is now
    // labeled "highways" — every capital with a trunk link is reachable
    const highwayCells = new Set(
      pack
        .routes!.filter((r) => r.group === 'highways')
        .flatMap((r) => r.points.map((p) => p[2])),
    );
    expect(highwayCells.size).toBeGreaterThan(0);
  });

  it('honors explicit option overrides', () => {
    const result = generateFmgWorld(GOLDEN_SEED, {
      ...GOLDEN_OPTIONS,
      culturesNumber: 5,
      statesNumber: 7,
      religionsNumber: 3,
    });
    const { pack } = result;
    expect(pack.cultures!.length).toBe(6); // 5 + Wildlands
    expect(pack.states!.length).toBe(8); // 7 + Neutrals
    expect(
      pack.burgs!.filter((b) => b.i && !b.removed && b.capital).length,
    ).toBe(7);
    // 5 folk (per culture) + 3 organized + placeholder
    expect(pack.religions!.length).toBe(9);
  });

  it('runs island-harbor pass by default and can be disabled explicitly', () => {
    // Default (ensureIslandHarbors: true since 2026-06-26 owner approval) — report always present.
    const defaultResult = generateFmgWorld(GOLDEN_SEED, GOLDEN_OPTIONS);
    expect(defaultResult.islandHarborReport).toBeDefined();
    expect(defaultResult.islandHarborReport).toMatchObject({
      promotedBurgIds: [],
      spawnedBurgIds: [],
    });
    expect(defaultResult.islandHarborReport?.skippedComponentCells.length).toBeGreaterThan(0);

    // Explicit opt-out — no report.
    const optOutResult = generateFmgWorld(GOLDEN_SEED, {
      ...GOLDEN_OPTIONS,
      ensureIslandHarbors: false,
    });
    expect(optOutResult.islandHarborReport).toBeUndefined();
  });
});

describe('fmg world — tiered land routes (road-systems Task 5)', () => {
  it('tiers land routes: capitals ride highways, town links are roads, village links trails', () => {
    // Reuse the golden fixture seed/options so this shares determinism with the
    // pinned route-count case above.
    const world = generateFmgWorld(GOLDEN_SEED, GOLDEN_OPTIONS);
    const routes = world.pack.routes!;
    const groups = new Set(routes.map((r) => r.group));
    expect(groups.has('highways')).toBe(true);
    expect(groups.has('trails')).toBe(true);
    expect(groups.has('roads') || groups.has('trails')).toBe(true); // road split may be world-dependent
    // No route keeps the retired bare vocabulary — every group is known.
    for (const r of routes) {
      expect(['highways', 'roads', 'trails', 'paths', 'searoutes']).toContain(r.group);
    }
    // Every capital burg that the trunk graph linked sits on a highway cell.
    // (A capital alone on its landmass has no Urquhart edge, hence no highway —
    // the trunk network still covers every multi-capital feature.)
    const highwayCells = new Set(
      routes.filter((r) => r.group === 'highways').flatMap((r) => r.points.map((p) => p[2])),
    );
    expect(highwayCells.size).toBeGreaterThan(0);
    for (const b of world.pack.burgs!.filter((b) => b?.i && !b.removed && b.capital)) {
      expect(highwayCells.has(b.cell)).toBe(true);
    }
  });

  it('is deterministic: same seed regenerates identical route groups + cells', () => {
    const sig = (rs: Route[]) =>
      rs.map((r) => `${r.group}:${r.points.map((p) => p[2]).join(',')}`).join('|');
    const a = generateFmgWorld(GOLDEN_SEED, GOLDEN_OPTIONS);
    const b = generateFmgWorld(GOLDEN_SEED, GOLDEN_OPTIONS);
    expect(sig(b.pack.routes!)).toBe(sig(a.pack.routes!));
  });
});

describe('fmg world — village forest-spur paths (road-systems Task 7)', () => {
  it('generates village forest-spur paths that start at a burg and end in forest', () => {
    const world = generateFmgWorld(GOLDEN_SEED, GOLDEN_OPTIONS);
    const FOREST_IDS = new Set([5, 6, 7, 8, 9]);
    const routes = world.pack.routes!;
    const paths = routes.filter((r) => r.group === 'paths');
    // World-dependent count, but a default world with villages near forest gets SOME.
    expect(paths.length).toBeGreaterThan(0);
    const burgCells = new Set(
      world.pack.burgs!.filter((b) => b?.i && !b.removed).map((b) => b.cell),
    );
    const biome = world.pack.cells.biome!;
    const cellsOf = (r: Route) => r.points.map((pt) => pt[2]);
    // How many routes touch each cell — split spurs anchor on a shared cell.
    const routeUse = new Map<number, number>();
    for (const r of routes) {
      for (const c of new Set(cellsOf(r))) routeUse.set(c, (routeUse.get(c) ?? 0) + 1);
    }
    for (const p of paths) {
      const cells = cellsOf(p);
      // Every spur reaches into the woods (holds in this pinned world; a
      // forest-side split could shorten a spur before its forest target).
      expect(cells.some((c) => FOREST_IDS.has(biome[c]))).toBe(true);
      // Every spur anchors at its village — directly, or (when getRouteSegments
      // split it where it crossed a corridor an earlier route already claimed)
      // through an endpoint cell shared with that other route.
      const atBurg = burgCells.has(cells[0]) || burgCells.has(cells[cells.length - 1]);
      const sharesEndpoint =
        (routeUse.get(cells[0]) ?? 0) > 1 ||
        (routeUse.get(cells[cells.length - 1]) ?? 0) > 1;
      expect(atBurg || sharesEndpoint).toBe(true);
    }
    // The typical spur starts right at its village: splits are the exception.
    const direct = paths.filter((p) => {
      const cells = cellsOf(p);
      return burgCells.has(cells[0]) || burgCells.has(cells[cells.length - 1]);
    });
    expect(direct.length).toBeGreaterThan(paths.length / 2);
  });
});

describe('fmg world — spurs retarget onto forest POIs (forests campaign Task 9)', () => {
  /**
   * Stage 36's retargetSpursToPois (LAST in generateForests, after POI
   * placement) rewrites each "paths" route to end on the BFS-nearest forest
   * POI cell when one is within the 400-visited land BFS the original spur
   * search used; spurs with no POI in range stay as dead-ends. ZERO draws on
   * any stream — every golden above is untouched, and the same-seed route
   * determinism test stays green (both runs retarget identically; only its
   * unpinned signature VALUE changed vs the roads era, by design).
   * Measured 2026-07-11: golden world 38/38 spurs end on a POI cell;
   * default world 156/159 (3 villages have no POI in BFS range).
   */
  const POI_TYPES = new Set(['hunter-camp', 'forest-shrine', 'hermit-hollow', 'beast-den']);

  const retargetedOf = (pack: FmgWorldResult['pack'], markers: FmgWorldResult['markers']) => {
    const poiCells = new Set(
      markers.filter((m) => POI_TYPES.has(m.type)).map((m) => m.cell),
    );
    const paths = pack.routes!.filter((r) => r.group === 'paths');
    const retargeted = paths.filter((r) =>
      poiCells.has(r.points[r.points.length - 1][2]),
    );
    return { poiCells, paths, retargeted };
  };

  it('retargeted spurs end on POI cells via valid land chains (golden world)', () => {
    const { pack, markers } = generateFmgWorld(GOLDEN_SEED, GOLDEN_OPTIONS);
    const { poiCells, paths, retargeted } = retargetedOf(pack, markers);
    expect(poiCells.size).toBeGreaterThan(0);
    expect(paths.length).toBeGreaterThan(0);
    // At least one spur has a POI within BFS range and now leads to it.
    expect(retargeted.length).toBeGreaterThanOrEqual(1);
    for (const r of retargeted) {
      const cells = r.points.map((p) => p[2]);
      // The rebuilt chain is a real walk: consecutive cells are neighbors,
      // every cell is land (the BFS never crosses water).
      for (let i = 0; i < cells.length - 1; i++) {
        expect(pack.cells.c![cells[i]]).toContain(cells[i + 1]);
      }
      for (const c of cells.slice(1)) {
        expect(pack.cells.h![c]).toBeGreaterThanOrEqual(20);
      }
    }
  });

  it('retargeted spurs exist on the default-options world too', () => {
    const { pack, markers } = defaultWorld();
    const { retargeted } = retargetedOf(pack, markers);
    expect(retargeted.length).toBeGreaterThanOrEqual(1);
  });
});

describe('fmg world — named forests (forests campaign, additive pass)', () => {
  /**
   * Stage 36 (generateForests) runs on its OWN SeededRandom stream after
   * every ported FMG stage has consumed its draws. THE CONTRACT: it only
   * ADDS pack.forests — every frozen golden elsewhere in this file must
   * remain byte-identical. If any pre-existing assertion in this file
   * shifts, the forests pass leaked into the shared Alea stream: fix the
   * pass, never the golden.
   */
  it('populates pack.forests on the golden world with valid, disjoint, in-bounds forests', () => {
    const { pack } = generateFmgWorld(GOLDEN_SEED, GOLDEN_OPTIONS);
    const forests = pack.forests!;
    expect(forests).toBeDefined();
    expect(forests.length).toBeGreaterThan(0);

    const FOREST_BIOMES = new Set([5, 6, 7, 8, 9]);
    const cellCount = pack.cells.i.length;
    const seen = new Set<number>();
    forests.forEach((forest, idx) => {
      expect(forest.i).toBe(idx + 1); // 1-based, contiguous
      expect(forest.name.length).toBeGreaterThan(0);
      expect(['ordinary', 'ancient', 'haunted', 'fey']).toContain(forest.kind);
      expect(forest.cells.length).toBeGreaterThanOrEqual(4); // FOREST_MIN_CELLS
      for (const cell of forest.cells) {
        expect(cell).toBeGreaterThanOrEqual(0);
        expect(cell).toBeLessThan(cellCount);
        expect(FOREST_BIOMES.has(pack.cells.biome![cell])).toBe(true);
        expect(seen.has(cell)).toBe(false); // every cell in exactly one forest
        seen.add(cell);
      }
      // Pole (label anchor) is a finite point inside the map, FMG px space.
      expect(Number.isFinite(forest.pole[0])).toBe(true);
      expect(Number.isFinite(forest.pole[1])).toBe(true);
      expect(forest.pole[0]).toBeGreaterThanOrEqual(0);
      expect(forest.pole[0]).toBeLessThanOrEqual(GOLDEN_OPTIONS.width);
      expect(forest.pole[1]).toBeGreaterThanOrEqual(0);
      expect(forest.pole[1]).toBeLessThanOrEqual(GOLDEN_OPTIONS.height);
    });
  });

  it('names forests on the default-options world too', () => {
    const { pack } = defaultWorld();
    expect(pack.forests!.length).toBeGreaterThan(0);
  });

  it('is deterministic: same seed regenerates an identical forest signature', () => {
    const sig = (world: FmgWorldResult) =>
      world.pack
        .forests!.map(
          (f) => `${f.i}:${f.kind}:${f.name}:${f.cells.join(',')}:${f.pole.join(',')}`,
        )
        .join('|');
    const a = generateFmgWorld(GOLDEN_SEED, GOLDEN_OPTIONS);
    const b = generateFmgWorld(GOLDEN_SEED, GOLDEN_OPTIONS);
    expect(sig(b)).toBe(sig(a));
  });
});

describe('fmg world — maritime reachability integration (default ON)', () => {
  /**
   * Integration proof that ensureIslandHarbors fires as the default in real game
   * worlds. The 960x540/10000-cell world on 'test-seed-1' promotes coastal burgs
   * to ports (see docs/projects/worldforge/DECISIONS.md §D3 for the durable
   * record of the world-break and the promoted-burg evidence).
   *
   * For each promoted burg we assert:
   *   1. The burg's .port field is now truthy.
   *   2. At least one searoutes route exists whose cells include the burg's
   *      water-cell (burg.cell's haven cell), proving the travel graph can
   *      reach the island by sea.
   *
   * No explicit flag is passed — the test relies on the new default (true).
   */
  it('promoted burgs have a port and a linked sea route (default world, no flag)', () => {
    // Use the cached large world — no flag means ensureIslandHarbors: true by default.
    const { pack, islandHarborReport } = defaultWorld();

    // The harbor pass must have fired and promoted some burgs.
    expect(islandHarborReport).toBeDefined();
    const { promotedBurgIds } = islandHarborReport!;
    expect(promotedBurgIds.length).toBeGreaterThan(0);

    const seaRouteSet = new Set(
      pack.routes!
        .filter((r) => r.group === 'searoutes')
        .flatMap((r) => r.cells ?? r.points.map((p) => p[2])),
    );

    for (const burgId of promotedBurgIds) {
      const burg = pack.burgs!.find((b): b is Burg => !!b && b.i === burgId);

      // Promoted burg must exist and have a port assigned.
      expect(burg).toBeDefined();
      expect(burg!.port).toBeTruthy();

      // The burg's haven (water cell adjacent to it) must appear in at least one
      // searoutes route — proving the island is reachable via the travel graph.
      const waterCell = pack.cells.haven![burg!.cell];
      expect(seaRouteSet.has(waterCell)).toBe(true);
    }
  });
});

describe('fmg world — forest POI markers (forests campaign Task 8a, additive append)', () => {
  /**
   * Stage 36's placeForestPois appends forest POI markers to pack.markers.
   * ADDITIVE CONTRACT: every FMG stage-34 marker stays byte-identical and
   * keeps its position/id — the POIs only APPEND after them, drawing from the
   * forests-own SeededRandom stream (zero shared Alea draws, so every other
   * golden in this file is untouched).
   */
  const POI_TYPES = new Set(['hunter-camp', 'forest-shrine', 'hermit-hollow', 'beast-den']);
  const POI_ICONS: Record<string, string> = {
    'hunter-camp': '🏕️',
    'hermit-hollow': '🛖',
    'forest-shrine': '⛩️',
    'beast-den': '🐾',
  };

  it('appends POI markers after the frozen FMG markers on the golden world', () => {
    const { pack, markers } = generateFmgWorld(GOLDEN_SEED, GOLDEN_OPTIONS);

    const firstPoi = markers.findIndex((m) => POI_TYPES.has(m.type));
    expect(firstPoi).toBeGreaterThan(0); // golden world HAS qualifying forests
    const fmgMarkers = markers.slice(0, firstPoi);
    const poiMarkers = markers.slice(firstPoi);

    // Strict append: everything before the first POI is FMG's, everything
    // after it is a POI — the two blocks never interleave.
    expect(fmgMarkers.some((m) => POI_TYPES.has(m.type))).toBe(false);
    expect(poiMarkers.every((m) => POI_TYPES.has(m.type))).toBe(true);

    // FROZEN pre-Task-8a golden: stage 34 placed exactly 31 markers on this
    // world (measured 2026-07-11, before the POI pass existed). The old count
    // holds exactly as the block length and as a floor for the total.
    expect(fmgMarkers.length).toBe(31);
    expect(markers.length).toBeGreaterThanOrEqual(31);

    // Marker ids stay contiguous through the append (FMG's 0..30, POIs on).
    markers.forEach((m, idx) => expect(m.i).toBe(idx));

    // POI count follows the per-forest formula (density + hard cap) over
    // qualifying forests.
    const forests = pack.forests!;
    const expected = forests.reduce(
      (sum, f) =>
        sum +
        (f.cells.length >= FOREST_MIN_CELLS * 2
          ? Math.min(
              FOREST_POI_MAX_PER_FOREST,
              Math.max(1, Math.floor(f.cells.length / FOREST_POI_PER_CELLS)),
            )
          : 0),
      0,
    );
    expect(poiMarkers.length).toBe(expected);
    // Both golden forests qualify (198 -> 4 POIs, 135 -> 3 at the retuned
    // 1-per-40-cells density; the cap of 5 doesn't bind on this world).
    expect(expected).toBe(7);

    // Every POI sits on a cell of a qualifying forest, stamped at that cell's
    // point, with its type's icon.
    for (const m of poiMarkers) {
      const forest = forests.find((f) => f.cells.includes(m.cell));
      expect(forest).toBeDefined();
      expect(forest!.cells.length).toBeGreaterThanOrEqual(FOREST_MIN_CELLS * 2);
      expect(m.x).toBe(pack.cells.p[m.cell][0]);
      expect(m.y).toBe(pack.cells.p[m.cell][1]);
      expect(m.icon).toBe(POI_ICONS[m.type]);
    }
    // Occupied discipline holds ACROSS the whole marker layer: POIs skip
    // cells FMG markers already claimed, so no marker anywhere shares a cell.
    expect(new Set(markers.map((m) => m.cell)).size).toBe(markers.length);
    expect(new Set(poiMarkers.map((m) => m.type)).size).toBeGreaterThanOrEqual(2);
  });
});

describe('fmg world — named ranges + peaks (mountains campaign, additive pass)', () => {
  /**
   * Stage 37 (generateMountains) runs on its OWN SeededRandom stream directly
   * after stage 36. THE CONTRACT: it only ADDS pack.ranges + pack.peaks —
   * every frozen golden elsewhere in this file must remain byte-identical.
   * If any pre-existing assertion in this file shifts, the mountains pass
   * leaked into the shared Alea stream: fix the pass, never the golden.
   */
  it('populates pack.ranges/pack.peaks on the golden world with valid, disjoint highland ranges', () => {
    const { pack } = generateFmgWorld(GOLDEN_SEED, GOLDEN_OPTIONS);

    const ranges = pack.ranges!;
    expect(ranges).toBeDefined();
    expect(ranges.length).toBeGreaterThan(0);
    const seen = new Set<number>();
    ranges.forEach((range, idx) => {
      expect(range.i).toBe(idx + 1); // 1-based, contiguous
      expect(range.name.length).toBeGreaterThan(0);
      expect(['range', 'highlands', 'volcanic']).toContain(range.kind);
      expect(range.cells.length).toBeGreaterThanOrEqual(RANGE_MIN_CELLS);
      for (const cell of range.cells) {
        expect(pack.cells.h[cell]).toBeGreaterThanOrEqual(RANGE_MIN_H);
        expect(seen.has(cell)).toBe(false); // every cell in exactly one range
        seen.add(cell);
      }
      expect(range.coreCells).toEqual(
        range.cells.filter((cell) => pack.cells.h[cell] >= PEAK_MIN_H),
      );
      expect(range.pole[0]).toBeGreaterThanOrEqual(0);
      expect(range.pole[0]).toBeLessThanOrEqual(GOLDEN_OPTIONS.width);
      expect(range.pole[1]).toBeGreaterThanOrEqual(0);
      expect(range.pole[1]).toBeLessThanOrEqual(GOLDEN_OPTIONS.height);
    });
    // Range names are unique after the shared geographic dedup.
    expect(new Set(ranges.map((range) => range.name)).size).toBe(ranges.length);

    const peaks = pack.peaks!;
    expect(peaks.length).toBeGreaterThan(0);
    const perRange = new Map<number, number>();
    peaks.forEach((peak, idx) => {
      expect(peak.i).toBe(idx + 1); // global 1-based, contiguous
      const range = ranges.find((r) => r.i === peak.rangeI);
      expect(range).toBeDefined();
      expect(range!.coreCells).toContain(peak.cellId);
      expect(peak.h).toBe(pack.cells.h[peak.cellId]);
      expect(peak.h).toBeGreaterThanOrEqual(PEAK_MIN_H);
      expect(peak.name.length).toBeGreaterThan(0);
      perRange.set(peak.rangeI, (perRange.get(peak.rangeI) ?? 0) + 1);
    });
    for (const count of perRange.values()) {
      expect(count).toBeLessThanOrEqual(PEAKS_PER_RANGE_MAX);
    }
  });

  it('adopts the volcano legend name for the peak beside it on the golden world', () => {
    const world = generateFmgWorld(GOLDEN_SEED, GOLDEN_OPTIONS);
    const { pack, notes } = world;

    // Measured 2026-07-11: the golden world's ONE adoptable marker is a
    // volcano whose note names it "Trubc Volcano"; the marker cell neighbors
    // a peak cell, and the peak adopts the legend name VERBATIM (the
    // neighbor-radius branch of the adoption contract, live end-to-end).
    const volcano = world.markers.find((m) => m.type === 'volcanoes');
    expect(volcano).toBeDefined();
    const note = notes.find((n) => n.id === `marker${volcano!.i}`);
    expect(note).toBeDefined();

    const adopted = pack.peaks!.find(
      (peak) =>
        peak.cellId === volcano!.cell ||
        (pack.cells.c?.[peak.cellId] ?? []).includes(volcano!.cell),
    );
    expect(adopted).toBeDefined();
    expect(adopted!.name).toBe(note!.name);
  });

  it('is deterministic: same seed regenerates an identical range+peak+pass signature', () => {
    const sig = (world: FmgWorldResult) =>
      [
        world.pack
          .ranges!.map(
            (r) =>
              `${r.i}:${r.kind}:${r.name}:${r.cells.join(',')}:${r.coreCells.join(',')}:${r.pole.join(',')}`,
          )
          .join('|'),
        world.pack
          .peaks!.map((p) => `${p.i}:${p.rangeI}:${p.cellId}:${p.h}:${p.name}`)
          .join('|'),
        world.pack
          .passes!.map((p) => `${p.i}:${p.rangeI}:${p.cellId}:${p.name}:${p.routeIds.join(',')}`)
          .join('|'),
      ].join('||');
    const a = generateFmgWorld(GOLDEN_SEED, GOLDEN_OPTIONS);
    const b = generateFmgWorld(GOLDEN_SEED, GOLDEN_OPTIONS);
    expect(sig(a)).toBe(sig(b));
    expect(sig(a).length).toBeGreaterThan(0);
  });

  it('detects named passes where the default world\'s routes cross its ranges', () => {
    const { pack } = defaultWorld();
    expect(pack.ranges!.length).toBeGreaterThan(0);
    expect(pack.peaks!.length).toBeGreaterThan(0);

    // The default world's highway/road network crosses highland, so at least
    // one pass must exist (mountains Task 4 — passes are the payoff of the
    // climb-cost asymmetry: graded ways over the crest get NAMED).
    const passes = pack.passes!;
    expect(passes).toBeDefined();
    expect(passes.length).toBeGreaterThan(0);

    const rangeById = new Map(pack.ranges!.map((r) => [r.i, r]));
    passes.forEach((pass, idx) => {
      // 1-based ids, ordered by cellId ascending.
      expect(pass.i).toBe(idx + 1);
      if (idx > 0) expect(pass.cellId).toBeGreaterThan(passes[idx - 1].cellId);
      // The crest cell is highland and a member of the pass's OWN named range
      // (rangeIdOf(passCell) != null, and consistent with pass.rangeI).
      expect(pack.cells.h[pass.cellId]).toBeGreaterThanOrEqual(RANGE_MIN_H);
      expect(rangeById.get(pass.rangeI)!.cells).toContain(pass.cellId);
      // Every listed route exists, is a pass-worthy tier, and truly crosses
      // the crest cell (the pass lies ON its routes).
      expect(pass.routeIds.length).toBeGreaterThan(0);
      expect(pass.routeIds).toEqual([...pass.routeIds].sort((x, y) => x - y));
      for (const routeId of pass.routeIds) {
        const route = pack.routes!.find((r) => r.i === routeId);
        expect(route).toBeDefined();
        expect(['highways', 'roads', 'trails']).toContain(route!.group);
        expect(route!.points.some((p) => p[2] === pass.cellId)).toBe(true);
      }
      // Deterministic non-rng word pick: PASS_WORDS[cellId % length].
      expect(
        pass.name.endsWith(` ${PASS_WORDS[pass.cellId % PASS_WORDS.length]}`),
      ).toBe(true);
    });
  });
});
