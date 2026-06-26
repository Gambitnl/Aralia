import { describe, it, expect } from 'vitest';
import { generateTownPlan } from '../townEngine';
import {
  assignTownPopulation, classifyBuilding, isResidential, hashPoint,
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

