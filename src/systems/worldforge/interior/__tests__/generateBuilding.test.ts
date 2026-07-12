/**
 * This file proves that the canonical building generator produces complete,
 * deterministic, and connected plans across every supported building type.
 *
 * It also guards the additive Building Generator v2 layers: household briefs,
 * roof/style dress, and the new settlement/district/building identity may alter
 * visible dress but must never move the permanent rooms, walls, or stairs.
 */
import { describe, it, expect, vi } from 'vitest';
import { rootSeedPath, rngFromPath, streamPath } from '../../seedPath';
import {
  generateBuilding,
  buildingShellHeightM,
  BLUEPRINT_STOREY_FT,
  styleDigest,
} from '../generateBuilding';
import { metersFromFeet } from '../../units';
import { EXTERIOR } from '../blueprintTypes';
import type {
  BlueprintPlan, BuildingType, HouseholdBrief, MemberSlot, StyleContext,
} from '../blueprintTypes';
import { mergeWallRuns } from '../walls';

// Mirrors vocabulary.test.ts's ALL_TYPES. Redeclared locally rather than
// imported — the codebase keeps test fixtures test-local (vocabulary.test.ts
// does not export it), so a cottage-to-keep sweep stays independent per file.
const ALL_TYPES: BuildingType[] = [
  'cottage', 'townhouse', 'tenement', 'farmstead',
  'shop', 'smithy', 'workshop', 'inn', 'tavern', 'storehouse',
  'manor', 'temple', 'keep', 'civic',
];

const gen = (over = {}) => generateBuilding({ buildingId: 1, type: 'manor', seedPath: rootSeedPath(3), storeys: 3, basement: true, ...over });

describe('buildingShellHeightM', () => {
  it('converts the canonical storey height through the exact international foot (10 ft = 3.048 m, no rounding)', () => {
    // A rounded 3 m/storey leaves every building ~1.6% short of the feet-canon
    // wall top the roof solver uses.
    expect(buildingShellHeightM(1)).toBeCloseTo(3.048, 10);
    expect(buildingShellHeightM(2)).toBeCloseTo(6.096, 10);
    expect(buildingShellHeightM(1)).toBeGreaterThan(3); // guards the old magic 3
  });

  it('equals storeys × the exact metric conversion of BLUEPRINT_STOREY_FT', () => {
    for (const s of [1, 2, 3, 4]) {
      expect(buildingShellHeightM(s)).toBe(s * metersFromFeet(BLUEPRINT_STOREY_FT));
    }
  });

  it('clamps to at least one storey (matches the loader guard)', () => {
    expect(buildingShellHeightM(0)).toBe(buildingShellHeightM(1));
  });
});

describe('generateBuilding', () => {
  it('is byte-identical for the same input', () => {
    expect(JSON.stringify(gen())).toBe(JSON.stringify(gen()));
  });

  it('is byte-identical across fresh module states (true determinism, defeats the memo)', async () => {
    // The in-module memo is keyed on (seedPath, type, storeys, basement), so
    // calling generateBuilding twice in one module only proves caching. Reset
    // the module registry between runs so each call regenerates cold.
    const runCold = async (): Promise<string> => {
      vi.resetModules();
      const [{ generateBuilding: genCold }, { rootSeedPath: rootCold }] =
        await Promise.all([import('../generateBuilding'), import('../../seedPath')]);
      return JSON.stringify(genCold({
        buildingId: 1, type: 'manor', seedPath: rootCold(3), storeys: 3, basement: true,
      }));
    };
    const a = await runCold();
    const b = await runCold();
    expect(a).toBe(b);
    // And the cold result matches the memoized in-process result too.
    expect(a).toBe(JSON.stringify(gen()));
  });

  it('has a basement, ground, and upper floors ordered by level', () => {
    const plan = gen();
    const levels = plan.floors.map((f) => f.level);
    expect(levels).toContain(-1);
    expect(levels).toContain(0);
    expect(levels).toContain(2);
    expect([...levels].sort((a, b) => a - b)).toEqual(levels); // already ascending
  });

  it('only the ground floor has a street entry (one exterior door)', () => {
    for (const seed of [3, 7, 11]) {
      const plan = generateBuilding({
        buildingId: 1, type: 'manor', seedPath: rootSeedPath(seed), storeys: 3, basement: true,
      });
      for (const floor of plan.floors) {
        const exterior = floor.doors.filter((d) => d.a === EXTERIOR);
        if (floor.level === 0) {
          expect(exterior).toHaveLength(1);
          expect(exterior[0].isEntry).toBe(true);
        } else {
          expect(exterior).toHaveLength(0);
          expect(floor.doors.some((d) => d.isEntry)).toBe(false);
        }
      }
    }
  });

  it('every floor carries wallRuns that are the merge of its walls (A4)', () => {
    const plan = gen();
    for (const floor of plan.floors) {
      expect(floor.wallRuns.length).toBeGreaterThan(0);
      expect(floor.wallRuns).toEqual(mergeWallRuns(floor.walls));
      // Runs never outnumber edges, and merging actually happened somewhere.
      expect(floor.wallRuns.length).toBeLessThan(floor.walls.length);
    }
  });

  it('plan.frontage is always set and matches the ground entry door (Task 9)', () => {
    for (const seed of [3, 7, 11]) {
      const plan = generateBuilding({
        buildingId: 2, type: 'cottage', seedPath: rootSeedPath(seed),
      });
      const ground = plan.floors.find((f) => f.level === 0)!;
      const entry = ground.doors.find((d) => d.isEntry)!;
      expect(plan.frontage).toEqual({ side: 'minY', entryX: entry.x, entryY: entry.y });
    }
  });

  it('a stair lands inside a room on both floors it joins', () => {
    const plan = gen();
    for (const st of plan.stairs) {
      for (const lvl of [st.fromLevel, st.fromLevel + 1]) {
        const floor = plan.floors.find((f) => f.level === lvl)!;
        const inRoom = floor.rooms.some((r) =>
          r.cells.some((c) => c.cx === Math.floor(st.x / 5) && c.cy === Math.floor(st.y / 5)));
        expect(inRoom).toBe(true);
      }
    }
  });
});

describe('household-driven building', () => {
  const FAMILY: HouseholdBrief = {
    homeId: 'b9', trade: 'blacksmith', worksAtHome: true, wealth: 'common',
    slots: [
      { tag: 'head', role: 'head', ageBand: 'adult' },
      { tag: 'spouse', role: 'spouse', ageBand: 'adult' },
      { tag: 'child:0', role: 'child', ageBand: 'child' },
      { tag: 'child:1', role: 'child', ageBand: 'child' },
      { tag: 'child:2', role: 'child', ageBand: 'child' },
    ],
  };

  it('the family always sleeps: beds-rooms ≥ bedroom assignments, all tagged — 50 seeds', () => {
    for (let seed = 0; seed < 50; seed++) {
      const plan = generateBuilding({
        buildingId: seed, type: 'smithy', seedPath: rootSeedPath(seed),
        storeys: 2, household: FAMILY,
      });
      const tagged = plan.floors.flatMap((f) => f.rooms).filter((r) => r.forSlot);
      const allTags = tagged.flatMap((r) => (r.forSlot as string).split(','));
      // every non-servant slot sleeps somewhere, exactly once
      expect([...allTags].sort()).toEqual(['child:0', 'child:1', 'child:2', 'head', 'spouse']);
      // the trade room exists
      expect(plan.floors[0].rooms.some((r) => r.purpose === 'forge')).toBe(true);
      // the brief is echoed
      expect(plan.household?.homeId).toBe('b9');
    }
  });

  it('a works-at-home smithy has exactly ONE forge on the ground floor — 25 seeds', () => {
    // The smithy HEADLINE is 'forge' (main room) AND the blacksmith brief
    // demands a forge; the headline satisfies it, so no duplicate forge.
    for (let seed = 0; seed < 25; seed++) {
      const plan = generateBuilding({
        buildingId: seed, type: 'smithy', seedPath: rootSeedPath(seed),
        storeys: 2, household: FAMILY,
      });
      const ground = plan.floors.find((f) => f.level === 0)!;
      const forges = ground.rooms.filter((r) => r.purpose === 'forge');
      expect(forges).toHaveLength(1);
    }
  });

  it('memo distinguishes briefs: same seed, different family ⇒ different plan', () => {
    const a = generateBuilding({ buildingId: 1, type: 'cottage', seedPath: rootSeedPath(5), household: FAMILY });
    const solo: HouseholdBrief = { ...FAMILY, slots: [FAMILY.slots[0]], trade: 'labourer', worksAtHome: false };
    const b = generateBuilding({ buildingId: 1, type: 'cottage', seedPath: rootSeedPath(5), household: solo });
    expect(JSON.stringify(a)).not.toEqual(JSON.stringify(b));
  });

  it('briefless call is byte-identical to pre-task output (no accidental re-roll)', () => {
    // Snapshot guard: run once before implementing to capture, then assert equality.
    const plan = generateBuilding({ buildingId: 3, type: 'tavern', seedPath: rootSeedPath(3), storeys: 2, basement: true });
    expect(plan).toMatchSnapshot();
  });

  it('style-less call leaves roof + styleResolved undefined (byte-identical bones)', () => {
    const plan = gen();
    expect(plan.roof).toBeUndefined();
    expect(plan.styleResolved).toBeUndefined();
  });

  it('fuzz: 500 random (type × brief) inputs never throw and always seat the family', () => {
    const types = ALL_TYPES;
    for (let i = 0; i < 500; i++) {
      const rng = rngFromPath(streamPath(rootSeedPath(i), 'fuzz'));
      const type = types[rng.nextInt(0, types.length)];
      const kids = rng.nextInt(0, 6);
      const slots: MemberSlot[] = [{ tag: 'head', role: 'head', ageBand: 'adult' }];
      for (let k = 0; k < kids; k++) {
        slots.push({ tag: `child:${k}`, role: 'child', ageBand: 'child' });
      }
      const plan = generateBuilding({
        buildingId: i, type, seedPath: rootSeedPath(i),
        storeys: 1 + rng.nextInt(0, 3), basement: rng.next() < 0.5,
        household: { homeId: `f${i}`, slots, trade: 'labourer', worksAtHome: false, wealth: 'common' },
      });
      const tags = plan.floors
        .flatMap((f) => f.rooms)
        .flatMap((r) => r.forSlot?.split(',') ?? []);
      // Every family member sleeps exactly once — one bedroom tag per slot, no dupes.
      expect(new Set(tags).size).toBe(slots.length);
      // Total tag count must also match (a duplicate would keep the Set size but grow the array).
      expect(tags.length).toBe(slots.length);
    }
  }, 20000);
});

describe('style-driven building (roof + resolved dress)', () => {
  const COLD_POOR: StyleContext = { cultureType: 'Highland', climate: 'cold', wealth: 'poor', ageBand: 'new' };
  const TEMPERATE_COMMON: StyleContext = { cultureType: 'Generic', climate: 'temperate', wealth: 'common', ageBand: 'aged' };
  const ARID_WEALTHY: StyleContext = { cultureType: 'River', climate: 'arid', wealth: 'wealthy', ageBand: 'old' };

  const bones = (p: BlueprintPlan): string =>
    JSON.stringify({ f: p.floors, fp: p.footprintCells, s: p.stairs });

  it('style in ⇒ roof + styleResolved set; chimneys ≥ 1 when the top floor has a hearth', () => {
    for (const seed of [3, 7, 11]) {
      const plan = generateBuilding({
        buildingId: 1, type: 'manor', seedPath: rootSeedPath(seed),
        storeys: 2, basement: true, style: TEMPERATE_COMMON,
      });
      expect(plan.roof).toBeDefined();
      expect(plan.styleResolved).toBeDefined();
      // resolved dress mirrors the style context's wealth tier
      expect(plan.styleResolved!.finishTier).toBe('common');
      // topmost habitable floor = highest level >= 0
      const topLevel = Math.max(...plan.floors.map((f) => f.level));
      const top = plan.floors.find((f) => f.level === topLevel)!;
      const topHearths = top.furnishings.filter(
        (fn) => fn.kind === 'hearth' || fn.kind === 'forge-hearth',
      );
      if (topHearths.length > 0) {
        expect(plan.roof!.chimneys.length).toBeGreaterThanOrEqual(1);
      }
    }
  });

  it('style never moves walls: same seed under 3 styles ⇒ identical floors/footprint/stairs', () => {
    const styles = [COLD_POOR, TEMPERATE_COMMON, ARID_WEALTHY].map((s) =>
      generateBuilding({ buildingId: 1, type: 'manor', seedPath: rootSeedPath(7), storeys: 2, basement: true, style: s }));
    expect(bones(styles[0])).toBe(bones(styles[1]));
    expect(bones(styles[1])).toBe(bones(styles[2]));
    // ...but the dress DID change (roof form or colors differ across climates).
    expect(JSON.stringify(styles[0].styleResolved)).not.toBe(JSON.stringify(styles[2].styleResolved));
  });

  it('memo distinguishes styles: same seed, different style ⇒ different plan (roof/dress differ)', () => {
    const a = generateBuilding({ buildingId: 1, type: 'manor', seedPath: rootSeedPath(9), storeys: 2, style: COLD_POOR });
    const b = generateBuilding({ buildingId: 1, type: 'manor', seedPath: rootSeedPath(9), storeys: 2, style: ARID_WEALTHY });
    expect(JSON.stringify(a)).not.toBe(JSON.stringify(b));
  });

  it('memo and dress distinguish individual buildings inside one district without moving their bones', () => {
    const districtStyle: StyleContext = {
      ...TEMPERATE_COMMON,
      architecture: {
        settlementKey: 'burg:12',
        districtKey: 'wealth:common',
        buildingKey: 'plot:4',
      },
    };
    const neighboringStyle: StyleContext = {
      ...districtStyle,
      architecture: {
        ...districtStyle.architecture!,
        buildingKey: 'plot:5',
      },
    };

    // The digest is the cache boundary: if these collide, the second building
    // can inherit the first building's facade and roof profile.
    expect(styleDigest(districtStyle)).not.toBe(styleDigest(neighboringStyle));

    const first = generateBuilding({
      buildingId: 1,
      type: 'manor',
      seedPath: rootSeedPath(9),
      storeys: 2,
      style: districtStyle,
    });
    const neighbor = generateBuilding({
      buildingId: 1,
      type: 'manor',
      seedPath: rootSeedPath(9),
      storeys: 2,
      style: neighboringStyle,
    });

    expect(bones(first)).toBe(bones(neighbor));
    expect(first.styleResolved!.districtSignature)
      .toBe(neighbor.styleResolved!.districtSignature);
    expect(first.styleResolved!.buildingVariant)
      .not.toBe(neighbor.styleResolved!.buildingVariant);
  });

  it('district identity changes the local recipe while preserving one town family', () => {
    const styleFor = (districtKey: string): StyleContext => ({
      ...TEMPERATE_COMMON,
      architecture: {
        settlementKey: 'burg:12',
        districtKey,
        buildingKey: 'plot:4',
      },
    });
    const common = generateBuilding({
      buildingId: 2,
      type: 'townhouse',
      seedPath: rootSeedPath(9),
      style: styleFor('wealth:common'),
    });
    const harbor = generateBuilding({
      buildingId: 2,
      type: 'townhouse',
      seedPath: rootSeedPath(9),
      style: styleFor('harbor'),
    });

    expect(common.styleResolved!.familyId).toBe(harbor.styleResolved!.familyId);
    expect(common.styleResolved!.districtSignature)
      .not.toBe(harbor.styleResolved!.districtSignature);
    expect(bones(common)).toBe(bones(harbor));
  });
});
