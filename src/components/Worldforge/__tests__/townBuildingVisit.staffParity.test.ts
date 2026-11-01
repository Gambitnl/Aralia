/**
 * GG-542 (2026-11-02): the building visit (inspector) and the live schedule
 * (3D town) must list the same staff and the same patrons at every hour.
 *
 * Both views already read one rule, computeOccupancy. GG-542 was a misread of
 * the live schedule's shape: it lists public-house patrons AFTER the family in
 * the same `occupants` array, with `memberIndex` continuing past
 * `household.members` and `visitor: true`, while the visit keeps patrons in
 * `occupancy.visitorStationsByHour`. A comparison of every live occupant with
 * the visit's family stations therefore "found" members 5 and 6 at work in a
 * five-person inn household; they were two patrons.
 *
 * This test compares staff with staff and patrons with patrons, for an inn and
 * for a tavern that is a separate workplace in the current Sypege layout. It
 * also asserts that the inn has patrons, so the old all-occupants comparison
 * would fail here: that is the GG-542 symptom, kept as a guard.
 *
 * Exercises: townBuildingVisit.ts and bridge/buildingOccupancy.ts
 * (occupancyScheduleForPlot), both through computeOccupancy.
 */
import { describe, expect, it } from 'vitest';
import { townBuildingChoices, townBuildingVisit } from '../townBuildingVisit';
import { getBridgeAtlas } from '../../../systems/worldforge/bridge/legacySubmapBridge';
import { canonicalArtifactTownForSiteFromAtlas, canonicalTownSeedPath } from '../../../systems/worldforge/town/canonicalTown';
import { occupancyScheduleForPlot } from '../../../systems/worldforge/bridge/buildingOccupancy';
import { householdPopulationForPlot, householdPopulationsForPlan } from '../../../systems/worldforge/town/householdBrief';

const seed = 1793146029630;
const burgId = 10;

function bothViews(plotId: number) {
  const visit = townBuildingVisit(seed, burgId, plotId);
  const artifact = canonicalArtifactTownForSiteFromAtlas(getBridgeAtlas(seed), seed, {
    burgId, envelope: { x: 0, y: 0, width: 0, height: 0 }, gates: [],
  }).plan;
  const path = canonicalTownSeedPath(seed, burgId);
  const live = occupancyScheduleForPlot(householdPopulationForPlot(visit.plot)!, householdPopulationsForPlan(artifact),
    { id: visit.plot.id, footprint: visit.plot.footprint, role: visit.plot.role, storeys: visit.plan.floors.length },
    path, path, visit.plan)!;
  return { visit, live };
}

function separateWorkplace(buildingType: 'inn' | 'tavern') {
  // Pick by type, not by a pinned id, so a later re-layout keeps the case.
  const choice = townBuildingChoices(seed, burgId)
    .find(candidate => candidate.buildingType === buildingType && townBuildingVisit(seed, burgId, candidate.id).workplaceOnly);
  if (!choice) throw new Error(`Sypege has no separate ${buildingType} workplace in this layout.`);
  return choice.id;
}

describe('building visit and live schedule list the same people (GG-542)', () => {
  for (const buildingType of ['inn', 'tavern'] as const) {
    it(`agrees on staff and on patrons at every hour for a separate ${buildingType}`, () => {
      const { visit, live } = bothViews(separateWorkplace(buildingType));
      const familySize = visit.household!.members.length;
      let patronHours = 0;
      for (let hour = 0; hour < 24; hour++) {
        const visitStaff = visit.occupancy!.stationsByHour[hour]
          .filter(station => station.where === 'home').map(station => station.memberIndex);
        const liveStaff = live.occupants
          .filter(occupant => !occupant.visitor && occupant.stationsByHour[hour]).map(occupant => occupant.memberIndex);
        expect(liveStaff, `${buildingType} staff at ${hour}:00`).toEqual(visitStaff);

        const visitPatrons = (visit.occupancy!.visitorStationsByHour[hour] ?? [])
          .map((station, index) => (station?.where === 'home' ? index : -1)).filter(index => index >= 0);
        const livePatrons = live.occupants
          .filter(occupant => occupant.visitor && occupant.stationsByHour[hour])
          .map(occupant => occupant.memberIndex - familySize);
        expect(livePatrons, `${buildingType} patrons at ${hour}:00`).toEqual(visitPatrons);
        if (livePatrons.length > 0) patronHours++;
      }
      if (buildingType === 'inn') {
        // The inn has patrons, so counting every live occupant as staff (the
        // GG-542 reading) would disagree with the visit at those hours.
        expect(patronHours).toBeGreaterThan(0);
      }
    }, 120000);
  }
});
