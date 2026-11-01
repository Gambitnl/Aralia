/** Proves gameplay inspection retains the canonical building and owned goods. */
import { describe, expect, it } from 'vitest';
import { townBuildingChoices, townBuildingVisit } from '../townBuildingVisit';
import { ALL_ITEMS } from '../../../data/items';
import { getBridgeAtlas } from '../../../systems/worldforge/bridge/legacySubmapBridge';
import { canonicalArtifactTownForSiteFromAtlas } from '../../../systems/worldforge/town/canonicalTown';
import { generateTownRoster } from '../../../systems/worldforge/roster/generateTownRoster';
import { canonicalTownSeedPath } from '../../../systems/worldforge/town/canonicalTown';
import { occupantDayRoutine } from '../../../systems/worldforge/roster/occupantSchedule';
import { occupancyScheduleForPlot } from '../../../systems/worldforge/bridge/buildingOccupancy';
import { householdPopulationForPlot, householdPopulationsForPlan } from '../../../systems/worldforge/town/householdBrief';

const seed = 1793146029630;
const burgId = 10;
// GG-552 (2026-11-01): the town-look rules re-lay out every NEW town (Remy's
// ruling q2, layout revision 2). The played Sypege households below keep the
// layout their save was made with, so those tests read layout revision 1.
const SAVED = 1 as const;

describe('town building gameplay inspection', () => {
  it('exposes the fitted lodging use without changing the existing inn, household or goods', () => {
    const before = townBuildingVisit(seed, 675, 35, undefined, undefined, SAVED); // Re-pinned 2026-10-31 after the GG-541 road fix (Remy chose to re-lay out every world).
    const choices = townBuildingChoices(seed, 675, SAVED);
    expect(choices.find(choice => choice.id === 35)?.buildingType).toBe('inn');
    expect(choices.find(choice => choice.id === 71)?.buildingType).toBe('shop');
    for (const choice of choices.filter(choice => choice.buildingType === 'inn' || choice.buildingType === 'tavern')) {
      expect(townBuildingVisit(seed, 675, choice.id, undefined, undefined, SAVED).plan.type).toBe(choice.buildingType);
    }
    const after = townBuildingVisit(seed, 675, 35, undefined, undefined, SAVED);
    expect(after.plan).toBe(before.plan);
    expect(after.household).toEqual(before.household);
    expect(after.manifests).toEqual(before.manifests);
  }, 60000);
  it('uses the same plot identities as the 3D bridge and preserves the family across visits', () => {
    const choices = townBuildingChoices(seed, burgId);
    const bridge = canonicalArtifactTownForSiteFromAtlas(getBridgeAtlas(seed), seed, {
      burgId, envelope: { x: 0, y: 0, width: 0, height: 0 }, gates: [],
    });
    expect(choices.map((choice) => choice.id)).toEqual(bridge.plan.plots.map((plot) => plot.id));
    const home = choices.find((choice) => choice.role === 'house' && townBuildingVisit(seed, burgId, choice.id).manifests.length > 0)!;
    const first = townBuildingVisit(seed, burgId, home.id);
    const again = townBuildingVisit(seed, burgId, home.id);
    expect(first.household?.members.length).toBeGreaterThan(0);
    expect(again.household).toEqual(first.household);
    expect(again.manifests).toEqual(first.manifests);
    expect(again.plan).toBe(first.plan);
    expect(first.occupancy?.stationsByHour).toHaveLength(24);
    expect(first.manifests.length).toBeGreaterThan(0);
    for (const manifest of first.manifests) {
      expect(manifest.ownerHomeId).toBe(first.household?.homeId);
      for (const entry of manifest.entries) expect(ALL_ITEMS[entry.itemId]).toBeDefined();
    }
  }, 60000);

  it('rejects a missing building instead of inventing one', () => {
    expect(() => townBuildingVisit(seed, burgId, -999)).toThrow('This building is unavailable.');
  });

  it('keeps the Blackford family at one home rather than sleeping or doing chores in their separate shop', () => {
    const home = townBuildingVisit(seed, burgId, 2, undefined, undefined, SAVED); // Re-pinned 2026-10-31 after the GG-541 road fix (Remy chose to re-lay out every world): Hartdown's shop became an inn.
    const shop = townBuildingVisit(seed, burgId, 48, undefined, undefined, SAVED); // Re-pinned 2026-10-31 after the GG-541 road fix (Remy chose to re-lay out every world).
    expect(shop.household).toEqual(home.household);
    expect(shop.workplaceOnly).toBe(true);
    expect(shop.occupancy?.claims).toEqual([]);
    for (let hour = 0; hour < 24; hour++) {
      const present = shop.occupancy!.stationsByHour[hour].filter(s => s.where === 'home');
      expect(present.map(s => s.memberIndex)).toEqual(hour >= 8 && hour <= 17 ? [0] : []);
      for (const station of present) {
        expect(home.occupancy!.stationsByHour[hour][station.memberIndex].where).toBe('out');
        expect(station.activity).toBe('work');
      }
    }
    expect(home.occupancy!.stationsByHour[22].every(s => s.activity === 'sleeping')).toBe(true);
    expect(home.occupancy!.stationsByHour[10].filter(s => s.activity === 'chores')).toHaveLength(5);
    const artifact = canonicalArtifactTownForSiteFromAtlas(getBridgeAtlas(seed), seed, {
      burgId, envelope: { x: 0, y: 0, width: 0, height: 0 }, gates: [],
    }, SAVED).plan;
    const path = canonicalTownSeedPath(seed, burgId);
    const live = occupancyScheduleForPlot(householdPopulationForPlot(shop.plot)!, householdPopulationsForPlan(artifact),
      {id:shop.plot.id, footprint:shop.plot.footprint, role:shop.plot.role, storeys:shop.plan.floors.length}, path, path, shop.plan)!;
    for (let hour = 0; hour < 24; hour++) {
      expect(live.occupants.filter(o => o.stationsByHour[hour]).map(o => o.memberIndex))
        .toEqual(shop.occupancy!.stationsByHour[hour].filter(s => s.where === 'home').map(s => s.memberIndex));
    }
  });

  it('keeps retired Lys ownership and identity without pretending the owner is on shift', () => {
    const home = townBuildingVisit(seed, burgId, 19, undefined, undefined, SAVED);
    const smithy = townBuildingVisit(seed, burgId, 18, undefined, undefined, SAVED); // Re-pinned 2026-10-31 after the GG-541 road fix (Remy chose to re-lay out every world).
    expect(smithy.household?.members[0].occupation).toMatch(/^retired/);
    expect(smithy.occupancy!.stationsByHour.flat().every(s => s.where === 'out')).toBe(true);
    expect(home.occupancy!.stationsByHour[10][0]).toMatchObject({where:'home',activity:'chores'});
    const artifact = canonicalArtifactTownForSiteFromAtlas(getBridgeAtlas(seed), seed, {
      burgId, envelope: { x: 0, y: 0, width: 0, height: 0 }, gates: [],
    }, SAVED).plan;
    const owner = generateTownRoster(artifact, canonicalTownSeedPath(seed, burgId), {nameFor:()=> 'Unchanged fallback'})
      .occupants.find(o => o.householdMemberId === 'b19:head')!;
    expect(owner).toMatchObject({name:'Lys Greenford',workPlotId:18,retired:true});
    expect(occupantDayRoutine(owner).every(s => s.activity !== 'working')).toBe(true);
  });
});


describe('known saved layout in building readers', () => {
  const worldSeed=1793432134128,burg=188;
  it('keeps the retained library and all building choices on the selected earlier town', () => {
    const earlier=canonicalArtifactTownForSiteFromAtlas(getBridgeAtlas(worldSeed),worldSeed,{
      burgId:burg,envelope:{x:0,y:0,width:0,height:0},gates:[],
    },1).plan;
    expect(townBuildingChoices(worldSeed,burg,1).map(plot=>plot.id)).toEqual(earlier.plots.map(plot=>plot.id));
    const library=townBuildingVisit(worldSeed,burg,19,undefined,undefined,1);
    expect(library.plan.type).toBe('library');
    expect(library.plot).toEqual(earlier.plots.find(plot=>plot.id===19));
  },60000);
  it('does not let an earlier visit contaminate the current default or its cache', () => {
    const current=townBuildingChoices(worldSeed,burg);
    const earlier=townBuildingChoices(worldSeed,burg,1);
    expect(current.length).toBeGreaterThan(earlier.length);
    expect(townBuildingChoices(worldSeed,burg)).toEqual(current);
    expect(townBuildingChoices(worldSeed,burg,2)).toEqual(current);
  });
  it('refuses an unsupported revision instead of silently inspecting another town', () => {
    expect(()=>townBuildingChoices(worldSeed,burg,3 as never)).toThrow('unsupported layout revision');
    expect(()=>townBuildingVisit(worldSeed,burg,19,undefined,undefined,3 as never)).toThrow('unsupported layout revision');
  });
});
