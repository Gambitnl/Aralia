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

    // routes by type
    expect(pack.routes!.length).toBe(247);
    expect({
      roads: pack.routes!.filter((r) => r.group === 'roads').length,
      trails: pack.routes!.filter((r) => r.group === 'trails').length,
      searoutes: pack.routes!.filter((r) => r.group === 'searoutes').length,
    }).toEqual({ roads: 12, trails: 199, searoutes: 36 });

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
      roads: pack.routes!.filter((r) => r.group === 'roads').length,
      trails: pack.routes!.filter((r) => r.group === 'trails').length,
      searoutes: pack.routes!.filter((r) => r.group === 'searoutes').length,
    }).toEqual({ roads: 11, trails: 456, searoutes: 104 });

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
      expect(['roads', 'trails', 'searoutes']).toContain(route.group);
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

    // roads connect capitals: every capital with a road link is reachable
    const roadCells = new Set(
      pack
        .routes!.filter((r) => r.group === 'roads')
        .flatMap((r) => r.points.map((p) => p[2])),
    );
    expect(roadCells.size).toBeGreaterThan(0);
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
});
