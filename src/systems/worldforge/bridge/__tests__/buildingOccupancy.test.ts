import { describe, it, expect, test } from 'vitest';
import { rootSeedPath, type SeedPath } from '../../seedPath';
import { blueprintForPlot, type InteriorPlotInput } from '../../interior/generateInterior';
import { computeOccupancy } from '../../interior/occupancy';
import { householdForPlot } from '../../town/householdBrief';
import type { TownPlotPopulation } from '../../town/townEngine';
import {
  occupancyForPlot,
  occupancyScheduleForPlot,
  windowsLitAt,
  DUSK_START_HOUR,
  DUSK_END_HOUR,
} from '../buildingOccupancy';

/** A generous rectangular lot (feet), corners 0-1 = street frontage. */
const footprint: InteriorPlotInput['footprint'] = [
  [0, 0], [40, 0], [40, 55], [0, 55],
];

/** A populated residential plot: a townhouse family working a workplace elsewhere. */
function populatedPlot(seed: number): {
  plotPop: TownPlotPopulation;
  allPlots: TownPlotPopulation[];
  plotInput: InteriorPlotInput;
} {
  const plotPop: TownPlotPopulation = {
    buildingType: 'townhouse',
    residential: true,
    occupants: 3 + (seed % 4), // 3..6
    homeId: `b${seed}`,
    district: 'common',
  };
  const plotInput: InteriorPlotInput = {
    id: seed + 1,
    footprint,
    role: 'house',
    storeys: 2,
    buildingType: 'townhouse',
  };
  return { plotPop, allPlots: [plotPop], plotInput };
}

/**
 * The exact populated-house fixture the one-hour `occupancyForPlot` tests use,
 * bundled with its seeds so the full-day resolver can be checked hour by hour
 * against the single-hour resolver. Reuses {@link populatedPlot} — no new data.
 */
function makePopulatedHousePlotFixture(seed = 3): {
  plotPop: TownPlotPopulation;
  allPlots: TownPlotPopulation[];
  plotInput: InteriorPlotInput;
  seedPath: SeedPath;
  townSeed: SeedPath;
} {
  const { plotPop, allPlots, plotInput } = populatedPlot(seed);
  return { plotPop, allPlots, plotInput, seedPath: rootSeedPath(7), townSeed: rootSeedPath(7) };
}

/** Cell membership set for a plan floor: every room cell as "cx,cy". */
function roomCellSet(plan: ReturnType<typeof blueprintForPlot>, level: number): Set<string> {
  const floor = plan.floors.find((f) => f.level === level)!;
  const set = new Set<string>();
  for (const r of floor.rooms) for (const c of r.cells) set.add(`${c.cx},${c.cy}`);
  return set;
}

describe('occupancyForPlot', () => {
  const town = rootSeedPath(7);
  const seedPath = rootSeedPath(7);

  it('every station falls inside a real room cell, across 10 seeds and every hour', () => {
    for (let seed = 0; seed < 10; seed++) {
      const { plotPop, allPlots, plotInput } = populatedPlot(seed);
      const plan = blueprintForPlot(plotInput, seedPath);

      for (let hour = 0; hour < 24; hour++) {
        const occ = occupancyForPlot(plotPop, allPlots, plotInput, seedPath, town, hour);
        expect(occ).toBeDefined();
        for (const st of occ!.stations) {
          const cells = roomCellSet(plan, st.level);
          // feet → cell index; the station must land in one of the level's rooms.
          const cx = Math.floor(st.x / 5);
          const cy = Math.floor(st.y / 5);
          expect(cells.has(`${cx},${cy}`)).toBe(true);
          expect(st.name.length).toBeGreaterThan(0);
        }
      }
    }
  });

  it('hearthLit exactly mirrors computeOccupancy.hearthLitHours[hour]', () => {
    const { plotPop, allPlots, plotInput } = populatedPlot(3);
    const resolved = householdForPlot(plotPop, allPlots, town)!;
    const plan = blueprintForPlot(plotInput, seedPath);
    const raw = computeOccupancy(plan, resolved.household, { worksAtHome: resolved.worksAtHome });
    for (let hour = 0; hour < 24; hour++) {
      const occ = occupancyForPlot(plotPop, allPlots, plotInput, seedPath, town, hour)!;
      expect(occ.hearthLit).toBe(raw.flags.hearthLitHours[hour]);
    }
  });

  it('stations name the resolved household members (given name)', () => {
    const { plotPop, allPlots, plotInput } = populatedPlot(2);
    const resolved = householdForPlot(plotPop, allPlots, town)!;
    const given = new Set(resolved.household.members.map((m) => m.name.split(' ')[0]));
    const occ = occupancyForPlot(plotPop, allPlots, plotInput, seedPath, town, 2)!; // 02:00 all home asleep
    expect(occ.stations.length).toBe(resolved.household.members.length);
    for (const st of occ.stations) expect(given.has(st.name)).toBe(true);
  });

  it('an unpopulated plot (no household) yields undefined', () => {
    const civic: TownPlotPopulation = { residential: false, buildingType: 'civic' };
    const plotInput: InteriorPlotInput = { id: 99, footprint, role: 'civic', storeys: 1 };
    expect(occupancyForPlot(civic, [civic], plotInput, seedPath, town, 12)).toBeUndefined();
  });

  it('is deterministic for identical inputs', () => {
    const { plotPop, allPlots, plotInput } = populatedPlot(5);
    const a = occupancyForPlot(plotPop, allPlots, plotInput, seedPath, town, 18);
    const b = occupancyForPlot(plotPop, allPlots, plotInput, seedPath, town, 18);
    expect(a).toEqual(b);
  });

  it('litWindows: lit at dusk/night when someone is home, dark by day', () => {
    const { plotPop, allPlots, plotInput } = populatedPlot(3);
    // 19:00 — evening, family home → windows glow.
    const dusk = occupancyForPlot(plotPop, allPlots, plotInput, seedPath, town, 19)!;
    expect(dusk.stations.length).toBeGreaterThan(0);
    expect(dusk.litWindows).toBe(true);
    // 12:00 — midday, breadwinners out; even if someone is home it is not dusk.
    const noon = occupancyForPlot(plotPop, allPlots, plotInput, seedPath, town, 12)!;
    expect(noon.litWindows).toBe(false);
    // 02:00 — deep night, everyone abed at home, but past the dusk band.
    const night = occupancyForPlot(plotPop, allPlots, plotInput, seedPath, town, 2)!;
    expect(night.litWindows).toBe(false);
  });

  it('litWindows implies occupancy AND the dusk band, across every hour', () => {
    const { plotPop, allPlots, plotInput } = populatedPlot(6);
    for (let hour = 0; hour < 24; hour++) {
      const occ = occupancyForPlot(plotPop, allPlots, plotInput, seedPath, town, hour)!;
      const occupied = occ.hearthLit || occ.stations.length > 0;
      const inBand = hour >= DUSK_START_HOUR && hour <= DUSK_END_HOUR;
      expect(occ.litWindows).toBe(occupied && inBand);
    }
  });
});

describe('occupancyScheduleForPlot', () => {
  test('returns a full 24-hour schedule that agrees with the one-hour resolver', () => {
    const f = makePopulatedHousePlotFixture();
    const sched = occupancyScheduleForPlot(f.plotPop, f.allPlots, f.plotInput, f.seedPath, f.townSeed);
    expect(sched).toBeDefined();
    expect(sched!.litHours).toHaveLength(24);
    expect(sched!.hearthHours).toHaveLength(24);

    // Windows are dark at noon, lit at 20:00 for an occupied house.
    expect(sched!.litHours[12]).toBe(false);
    expect(sched!.litHours[20]).toBe(true);

    // Every occupant has a 24-slot station table; night stations are non-null
    // (asleep at home), midday work stations may be null (out).
    for (const occ of sched!.occupants) {
      expect(occ.stationsByHour).toHaveLength(24);
      expect(occ.stationsByHour[2]).not.toBeNull(); // 02:00 asleep at home
    }
  });

  test('matches occupancyForPlot hour by hour', () => {
    const f = makePopulatedHousePlotFixture();
    const sched = occupancyScheduleForPlot(f.plotPop, f.allPlots, f.plotInput, f.seedPath, f.townSeed)!;
    for (let h = 0; h < 24; h++) {
      const single = occupancyForPlot(f.plotPop, f.allPlots, f.plotInput, f.seedPath, f.townSeed, h)!;
      expect(sched.litHours[h]).toBe(single.litWindows);
      expect(sched.hearthHours[h]).toBe(single.hearthLit);
      // Home members this hour line up with the single-hour stations.
      const homeThisHour = sched.occupants
        .filter((o) => o.stationsByHour[h] !== null)
        .map((o) => o.memberIndex)
        .sort((a, b) => a - b);
      expect(single.stations.map((s) => s.memberIndex).sort((a, b) => a - b)).toEqual(homeThisHour);
    }
  });

  test('an unpopulated plot (no household) yields undefined', () => {
    const civic: TownPlotPopulation = { residential: false, buildingType: 'civic' };
    const plotInput: InteriorPlotInput = { id: 99, footprint, role: 'civic', storeys: 1 };
    expect(occupancyScheduleForPlot(civic, [civic], plotInput, rootSeedPath(7), rootSeedPath(7))).toBeUndefined();
  });
});

describe('windowsLitAt (pure decision)', () => {
  it('needs BOTH occupancy and the dusk/night band', () => {
    expect(windowsLitAt(true, 19)).toBe(true);
    expect(windowsLitAt(true, DUSK_START_HOUR)).toBe(true);
    expect(windowsLitAt(true, DUSK_END_HOUR)).toBe(true);
    expect(windowsLitAt(false, 19)).toBe(false); // empty building stays dark
    expect(windowsLitAt(true, 12)).toBe(false); // occupied but broad daylight
    expect(windowsLitAt(true, 2)).toBe(false); // occupied but past the band
    expect(windowsLitAt(true, DUSK_START_HOUR - 1)).toBe(false);
    expect(windowsLitAt(true, DUSK_END_HOUR + 1)).toBe(false);
  });

  it('normalizes fractional / out-of-range hours', () => {
    expect(windowsLitAt(true, 19.9)).toBe(true); // floors to 19, in band
    expect(windowsLitAt(true, 19 + 24)).toBe(true); // wraps to 19
    expect(windowsLitAt(true, -5)).toBe(true); // -5 → 19, in band
    expect(windowsLitAt(true, 12 + 24)).toBe(false); // wraps to 12, daylight
  });
});
