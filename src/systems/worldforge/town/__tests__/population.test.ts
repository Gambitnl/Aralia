import { describe, it, expect } from 'vitest';
import { generateTownPlan, typologyForPopulation } from '../townEngine';
import {
  assignTownPopulation, classifyBuilding, isResidential, hashPoint,
  isLandmark, LANDMARK_TYPES, landmarkCapFor, createLandmarkLedger,
  type BuildingType,
} from '../population';
import { generateHousehold } from '../household';
import { rootSeedPath } from '../../seedPath';

/** A simple square footprint big enough to host a real town. */
const SQUARE = [[0, 0], [1000, 0], [1000, 1000], [0, 1000]] as [number, number][];

describe('population - building classification', () => {
  it('marks the four dwelling types residential and the rest not', () => {
    const res: BuildingType[] = ['cottage', 'townhouse', 'tenement', 'farmstead'];
    const non: BuildingType[] = ['inn', 'tavern', 'shop', 'smithy', 'workshop', 'storehouse', 'civic'];
    for (const t of res) expect(isResidential(t)).toBe(true);
    for (const t of non) expect(isResidential(t)).toBe(false);
  });

  it('classifies ward-interior plots as outbuildings (never inns/shops)', () => {
    const plot = { polygon: [[10, 10], [20, 10], [20, 20], [10, 20]] as [number, number][], frontageEdge: -1, kind: 'interior' as const };
    const t = classifyBuilding(plot, [500, 500], 1000, 'city', hashPoint);
    expect(['cottage', 'workshop', 'storehouse']).toContain(t);
  });

  it('is deterministic for the same plot/center', () => {
    const plot = { polygon: [[100, 100], [120, 100], [120, 120], [100, 120]] as [number, number][], frontageEdge: 0, kind: 'frontage' as const };
    const a = classifyBuilding(plot, [500, 500], 1000, 'city', hashPoint);
    const b = classifyBuilding(plot, [500, 500], 1000, 'city', hashPoint);
    expect(a).toBe(b);
  });
});

describe('population - distribution across a generated town', () => {
  const seed = rootSeedPath(42);

  it('accounts for the whole population (everyone housed; urban + rural = total)', () => {
    const plan = generateTownPlan(SQUARE, seed, { population: 4200 });
    expect(plan.demographics).toBeDefined();
    const d = plan.demographics!;
    // Every soul is placed across the true dwelling count — exact, no rounding drift.
    expect(d.accounted).toBe(4200);
    expect(d.urban + d.rural).toBe(d.accounted);
  });

  it('splits population between the urban core and rural farmsteads', () => {
    const plan = generateTownPlan(SQUARE, seed, { population: 4200 });
    const d = plan.demographics!;
    expect(d.urban).toBeGreaterThan(0);
    expect(d.rural).toBeGreaterThan(0);
    expect(plan.farmsteads.length).toBeGreaterThan(0);
    // Rural minority for a village/town.
    expect(d.rural).toBeLessThan(d.urban);
  });

  it('rendered homes have realistic households (not pop-crammed)', () => {
    // Every rendered home holds a believable family; a 120k capital does NOT cram
    // ~150 people into each drawn cottage — that population lives across the much
    // larger TRUE dwelling count, of which the map shows a sample.
    const plan = generateTownPlan(SQUARE, seed, { population: 120_000 });
    const homes = plan.wards.flatMap((w) => w.plots).filter((p) => p.residential);
    for (const p of homes) {
      expect(p.occupants!).toBeGreaterThanOrEqual(1);
      expect(p.occupants!).toBeLessThanOrEqual(25); // tenement upper bound, not 150
    }
    // Non-residential buildings house nobody.
    for (const p of plan.wards.flatMap((w) => w.plots)) {
      if (!p.residential) expect(p.occupants ?? 0).toBe(0);
    }
    const d = plan.demographics!;
    // The true dwelling count dwarfs the rendered sample for a capital.
    expect(d.homes).toBeGreaterThan(d.renderedHomes);
    expect(d.renderedHomes).toBe(homes.length + plan.farmsteads.length);
  });

  it('density (avg household) rises from village to capital, staying realistic', () => {
    const village = generateTownPlan(SQUARE, seed, { population: 900 }).demographics!;
    const capital = generateTownPlan(SQUARE, seed, { population: 120_000 }).demographics!;
    expect(capital.avgHousehold).toBeGreaterThan(village.avgHousehold);
    expect(capital.avgHousehold).toBeLessThan(12); // realistic, not absurd block-counts
    // Capitals grow tenements; villages have none.
    expect(capital.byType.tenement ?? 0).toBeGreaterThan(0);
    expect(village.byType.tenement ?? 0).toBe(0);
  });

  it('omits demographics when no population is supplied', () => {
    const plan = generateTownPlan(SQUARE, seed, {});
    expect(plan.demographics).toBeUndefined();
    expect(plan.farmsteads).toEqual([]);
  });

  it('is deterministic - same seed/pop yields identical accounting', () => {
    const a = generateTownPlan(SQUARE, seed, { population: 4200 }).demographics!;
    const b = generateTownPlan(SQUARE, seed, { population: 4200 }).demographics!;
    expect(a).toEqual(b);
  });
});

describe('population - assignTownPopulation directly', () => {
  it('distributes exactly across explicit homes (no farm parcels)', () => {
    const mk = (x: number) =>
      ({ polygon: [[x, 0], [x + 10, 0], [x + 10, 10], [x, 10]] as [number, number][], frontageEdge: 0, kind: 'frontage' as const });
    const plots = [mk(0), mk(100), mk(200), mk(300)];
    const out = assignTownPopulation({
      plots,
      farmParcels: [],
      population: 100,
      profile: { typology: 'capital', population: 100, wardCount: 4, hasWalls: true, hasPlaza: true, hasTemple: true, hasKeep: true, hasCitadel: true },
      townCenter: [150, 5],
      townSpan: 300,
      seedPath: rootSeedPath(7),
    });
    // capital ruralFrac 0.08 but no farm parcels -> all urban.
    expect(out.demographics.rural).toBe(0);
    expect(out.demographics.urban).toBe(out.demographics.accounted);
  });
});

describe('population - homeId uniqueness → no colliding households', () => {
  // generateHousehold keys a family off (townSeed, homeId), so two plots sharing a
  // homeId would silently render the IDENTICAL family in two different buildings.
  // assignTownPopulation must therefore give every plot a distinct homeId. This is
  // the contract the household generator relies on but nothing else asserts.
  it('assigns a unique homeId to every plot across a range of town sizes', () => {
    for (const population of [120, 1500, 12000, 80000]) {
      const plan = generateTownPlan(SQUARE, rootSeedPath(population), { population });
      const ids = plan.plots.map((p) => p.homeId);
      expect(ids.every((id) => typeof id === 'string' && id.length > 0), `pop ${population}: every plot has a homeId`).toBe(true);
      expect(new Set(ids).size, `pop ${population}: homeIds are unique`).toBe(ids.length);
    }
  });

  it('each home draws an independent household keyed on its homeId, regenerating identically', () => {
    const townSeed = rootSeedPath(2026);
    const plan = generateTownPlan(SQUARE, townSeed, { population: 6000 });
    const homes = plan.plots.filter((p) => p.residential && p.occupants && p.occupants > 0);
    expect(homes.length).toBeGreaterThan(5);

    for (const home of homes) {
      const a = generateHousehold(townSeed, home.homeId!, home.occupants!, home.buildingType ?? 'cottage');
      const b = generateHousehold(townSeed, home.homeId!, home.occupants!, home.buildingType ?? 'cottage');
      // Fills exactly its building's occupancy, and is deterministic per homeId
      // (same key → byte-identical household, so inspecting a building is stable).
      expect(a.members.length).toBe(home.occupants);
      expect(b).toEqual(a);
      expect(a.surname.length).toBeGreaterThan(0);
    }
    // (Two distinct homeIds may coincidentally share a surname from the finite
    // name pool — that's fine; what matters is each building keys its OWN draw,
    // guaranteed by the homeId-uniqueness invariant above.)
  });
});

describe('population - named landmarks are capped per town', () => {
  /** Population → the typology townEngine derives from it (typologyForPopulation). */
  const SIZES = [
    { population: 60, typology: 'hamlet' },
    { population: 3200, typology: 'walled town' },
    { population: 40000, typology: 'capital' },
  ] as const;

  const landmarkCounts = (plots: Array<{ buildingType?: BuildingType }>) => {
    const counts = new Map<BuildingType, number>();
    for (const p of plots) {
      const t = p.buildingType;
      if (t && isLandmark(t)) counts.set(t, (counts.get(t) ?? 0) + 1);
    }
    return counts;
  };

  it('never exceeds a type cap at hamlet, walled town or capital size', () => {
    for (const { population, typology } of SIZES) {
      expect(typologyForPopulation(population), `pop ${population}`).toBe(typology);
      for (const seed of [1, 7, 42, 2026]) {
        const plan = generateTownPlan(SQUARE, rootSeedPath(seed), { population });
        for (const [type, n] of landmarkCounts(plan.plots)) {
          expect(n, `${typology} seed ${seed}: ${type} count`)
            .toBeLessThanOrEqual(landmarkCapFor(typology, type));
        }
      }
    }
  });

  it('a hamlet only holds the landmarks its tier allows', () => {
    const plan = generateTownPlan(SQUARE, rootSeedPath(9), { population: 60 });
    for (const type of landmarkCounts(plan.plots).keys()) {
      expect(landmarkCapFor('hamlet', type), `hamlet may hold a ${type}`).toBeGreaterThan(0);
    }
    // The learned/civic landmarks are a bigger-town vocabulary.
    for (const type of ['library', 'guildhall', 'school', 'barracks'] as BuildingType[]) {
      expect(landmarkCapFor('hamlet', type)).toBe(0);
    }
  });

  it('a large town actually gets landmarks (the caps are not a mute button)', () => {
    const plan = generateTownPlan(SQUARE, rootSeedPath(3), { population: 40000 });
    const total = [...landmarkCounts(plan.plots).values()].reduce((s, n) => s + n, 0);
    expect(total, 'a capital holds at least a few landmarks').toBeGreaterThan(0);
  });

  it('is deterministic per seed path (same seed → same landmark census)', () => {
    const census = (seed: number) => {
      const plan = generateTownPlan(SQUARE, rootSeedPath(seed), { population: 3200 });
      return [...landmarkCounts(plan.plots)].sort((a, b) => (a[0] < b[0] ? -1 : 1));
    };
    expect(census(77)).toEqual(census(77));
  });

  it('classifyBuilding emits no landmark without a ledger (a cap is mandatory)', () => {
    // The legacy 6-argument call form: a landmark can only come from a town-wide
    // ledger, so a caller that has none must never receive one.
    for (let x = 0; x < 1000; x += 37) {
      for (let y = 0; y < 1000; y += 41) {
        const plot = {
          polygon: [[x, y], [x + 12, y], [x + 12, y + 12], [x, y + 12]] as [number, number][],
          frontageEdge: 0,
          kind: 'frontage' as const,
        };
        expect(isLandmark(classifyBuilding(plot, [500, 500], 1000, 'city', hashPoint))).toBe(false);
      }
    }
  });

  it('a ledger hands out exactly its cap and no more', () => {
    const ledger = createLandmarkLedger('capital');
    for (const type of LANDMARK_TYPES) {
      expect(ledger.remaining.get(type) ?? 0, `capital cap for ${type}`)
        .toBe(landmarkCapFor('capital', type));
    }
    // A hamlet ledger simply omits the types it may not hold.
    const hamlet = createLandmarkLedger('hamlet');
    expect(hamlet.remaining.has('library')).toBe(false);
    expect(hamlet.remaining.get('shrine')).toBe(1);
  });

  it('the rim band is reachable: mills and the granary are not dead types', () => {
    // `dist` is measured over the CORE SPAN, so it tops out near 0.57, not 1.0.
    // A rim threshold set on a 0..1 assumption would silently make the windmill,
    // the lumber mill and the granary unreachable; this pins the band open.
    const seen = new Set<BuildingType>();
    for (const seed of [1, 7, 42, 77, 2026]) {
      const plan = generateTownPlan(SQUARE, rootSeedPath(seed), { population: 12000 });
      for (const p of plan.plots) if (p.buildingType) seen.add(p.buildingType);
    }
    for (const type of ['windmill', 'lumbermill', 'granary'] as BuildingType[]) {
      expect(seen.has(type), ['a rim landmark (', type, ') appears across seeds'].join('')).toBe(true);
    }
  });

  it('every landmark is non-residential (they hold no household)', () => {
    for (const type of LANDMARK_TYPES) expect(isResidential(type)).toBe(false);
  });
});
