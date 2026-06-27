import { describe, it, expect } from 'vitest';
import { generateTownPlan } from '../townEngine';
import { assignWardWealth, isWorkplace, type BuildingType } from '../population';
import { generateHousehold } from '../household';
import { rootSeedPath } from '../../seedPath';

const SQUARE = [[0, 0], [1000, 0], [1000, 1000], [0, 1000]] as [number, number][];

describe('town districts (social class)', () => {
  it('tags wards and their plots with a wealth class', () => {
    const plan = generateTownPlan(SQUARE, rootSeedPath(42), { population: 8000 });
    expect(plan.wards.every((w) => w.wealth === undefined || ['wealthy', 'common', 'poor'].includes(w.wealth))).toBe(true);
    // A real town spans more than one class.
    const classes = new Set(plan.wards.map((w) => w.wealth));
    expect(classes.size).toBeGreaterThan(1);
    // Plots inherit their ward's district.
    for (const w of plan.wards) for (const p of w.plots) expect(p.district).toBe(w.wealth);
  });

  it('wealthy wards skew to townhouses; poor wards carry the tenements', () => {
    const plan = generateTownPlan(SQUARE, rootSeedPath(7), { population: 30_000 });
    const tally = (cls: string, t: BuildingType) =>
      plan.wards.filter((w) => w.wealth === cls).flatMap((w) => w.plots).filter((p) => p.buildingType === t).length;
    const homesOf = (cls: string) =>
      plan.wards.filter((w) => w.wealth === cls).flatMap((w) => w.plots).filter((p) => p.residential).length || 1;
    const wealthyTownhouseRate = tally('wealthy', 'townhouse') / homesOf('wealthy');
    const poorTownhouseRate = tally('poor', 'townhouse') / homesOf('poor');
    // Townhouses concentrate in wealthy quarters relative to poor ones.
    expect(wealthyTownhouseRate).toBeGreaterThan(poorTownhouseRate);
    // Tenements live in the poor/common wards, not the wealthy quarter.
    expect(tally('poor', 'tenement') + tally('common', 'tenement')).toBeGreaterThanOrEqual(tally('wealthy', 'tenement'));
  });

  it('assignWardWealth ranks closer-to-anchor wards richer', () => {
    const centroids = [[10, 10], [500, 500], [990, 990]] as [number, number][];
    const wealth = assignWardWealth(centroids, [[10, 10]], 1000, rootSeedPath(1));
    // The ward sitting ON the anchor should not be poorer than the far corner.
    const rank = { wealthy: 0, common: 1, poor: 2 };
    expect(rank[wealth[0]]).toBeLessThanOrEqual(rank[wealth[2]]);
  });
});

describe('town economy (homes ⇄ workplaces)', () => {
  it('every workplace is run by a proprietor home, and homes have a work role', () => {
    const plan = generateTownPlan(SQUARE, rootSeedPath(42), { population: 8000 });
    const workplaces = plan.plots.filter((p) => isWorkplace(p.buildingType as BuildingType));
    expect(workplaces.length).toBeGreaterThan(0);
    for (const wp of workplaces) {
      expect(typeof wp.proprietorHomeId).toBe('string'); // each workplace has an owner family
      expect(wp.staffCount ?? 0).toBeGreaterThanOrEqual(0);
    }
    // The proprietor home points back at its workplace.
    const byId = new Map(plan.plots.map((p) => [p.homeId, p]));
    for (const wp of workplaces) {
      const home = byId.get(wp.proprietorHomeId!);
      expect(home?.workplaceId).toBe(wp.homeId);
      expect(home?.workRole).toBe('proprietor');
    }
    // Every populated home has a work role (proprietor / staff / labourer).
    for (const h of plan.plots.filter((p) => p.residential && (p.occupants ?? 0) > 0)) {
      expect(['proprietor', 'staff', 'labourer']).toContain(h.workRole);
    }
    expect(plan.demographics!.workplaces).toBe(workplaces.length);
  });

  it('a proprietor household carries the workplace trade + an ancestry', () => {
    const seed = rootSeedPath(42);
    const plan = generateTownPlan(SQUARE, seed, { population: 8000 });
    const byId = new Map(plan.plots.map((p) => [p.homeId, p]));
    const propHome = plan.plots.find((p) => p.workRole === 'proprietor' && (p.occupants ?? 0) > 0)!;
    const wpType = byId.get(propHome.workplaceId!)?.buildingType;
    const hh = generateHousehold(seed, propHome.homeId!, propHome.occupants!, propHome.buildingType, { role: 'proprietor', workplaceType: wpType });
    // Ancestry comes from the shared roster distribution; head has a real trade.
    expect(hh.ancestry.length).toBeGreaterThan(0);
    expect(hh.occupation.length).toBeGreaterThan(0);
    expect(hh.members[0].race).toBe(hh.ancestry);
    // A smithy proprietor reads as a blacksmith, an inn's as an innkeeper, etc.
    const expected: Partial<Record<string, string>> = { smithy: 'blacksmith', inn: 'innkeeper', tavern: 'taverner', shop: 'shopkeeper', workshop: 'master artisan', civic: 'town official' };
    if (wpType && expected[wpType]) expect(hh.occupation).toContain(expected[wpType]!.split(' ')[0]);
  });

  it('is deterministic — same seed yields the same economic graph', () => {
    const a = generateTownPlan(SQUARE, rootSeedPath(99), { population: 5000 }).plots.map((p) => `${p.homeId}:${p.workRole ?? ''}:${p.workplaceId ?? ''}`);
    const b = generateTownPlan(SQUARE, rootSeedPath(99), { population: 5000 }).plots.map((p) => `${p.homeId}:${p.workRole ?? ''}:${p.workplaceId ?? ''}`);
    expect(a).toEqual(b);
  });
});
