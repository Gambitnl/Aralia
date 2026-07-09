/**
 * @file buildingOccupancy.ts — the living overlay, resolved for the 3D scene.
 *
 * PURE and three-free. Composes the existing pieces into the one thing the 3D
 * town needs per building at a given hour: where each household member stands
 * (in PLAN FEET, the blueprint frame the renderer already maps), and whether
 * the hearth is lit. It is the 3D twin of the 2D blueprint overlay
 * (renderBlueprintSvg's `data-occupancy` group) and resolves stations to feet
 * the SAME way:
 *   - a station with a `furnishingIndex` → that furnishing's (x, y) feet;
 *   - otherwise → the claimed room's `anchor` cell center, `(cx+0.5)*5` feet,
 *     which is GUARANTEED inside the (possibly L-shaped) room.
 *
 * Determinism: the family is resolved through {@link householdForPlot} — the
 * SAME source briefForPlot uses to design the house — so the members who STAND
 * here are exactly the family the building was BUILT for; and computeOccupancy
 * is itself RNG-free. Identical (plot, seedPath, hour) always yields identical
 * output.
 */
import type { SeedPath } from '../seedPath';
import type { Feet } from '../units';
import { blueprintForPlot, type InteriorPlotInput } from '../interior/generateInterior';
import type { BlueprintPlan } from '../interior/blueprintTypes';
import { computeOccupancy, type OccupantStation } from '../interior/occupancy';
import { householdForPlot } from '../town/householdBrief';
import type { Household } from '../town/household';
import type { TownPlotPopulation } from '../town/townEngine';

/** One member standing at their station this hour, in PLAN FEET. */
export interface OccupancyStationPoint {
  /** Index into `household.members`. */
  memberIndex: number;
  /** The member's given name (first token of their full name). */
  name: string;
  activity: 'sleeping' | 'meal' | 'work' | 'hearthside' | 'chores' | 'out';
  /** Plan-feet position (blueprint frame; 0 = min corner). */
  x: Feet;
  y: Feet;
  /** Floor level the member stands on (0 = ground, 1+ = upper, -1 = basement). */
  level: number;
}

export interface PlotOccupancy {
  /** Only members who are HOME this hour (out members are omitted). */
  stations: OccupancyStationPoint[];
  /** True when the hearth is lit at `hour` (someone home in a hearth window). */
  hearthLit: boolean;
  /** True when the WINDOWS should glow: someone is home AND the hour is
   * dusk/night (interior-lighting slice). Drives the emissive window panes that
   * read town-wide from the street. Derived purely from occupancy — no RNG. */
  litWindows: boolean;
  /** The named family, so callers can label bodies / drive nameplates. */
  household: Household;
}

/** One resolved station in PLAN FEET (blueprint frame; 0 = min corner). */
export interface StationFeetPoint {
  xFt: Feet;
  yFt: Feet;
  /** Floor level the member stands on (0 = ground, 1+ = upper, -1 = basement). */
  level: number;
  activity: OccupancyStationPoint['activity'];
}

/** One household member's whole day: their station every hour, or null when out. */
export interface OccupantDaySchedule {
  memberIndex: number;
  /** Given name (first token of the full name). */
  name: string;
  /** Age band ('child' | 'adult' | 'elder'). */
  ageBand: string;
  occupation: 'resident' | 'shopkeeper' | 'artisan';
  /** stationsByHour[h] = the member's station at hour h, or null when OUT. */
  stationsByHour: (StationFeetPoint | null)[];
}

/** The full-day occupancy schedule for one populated plot — the bake-once record
 *  the 3D renderer re-resolves against the live clock. */
export interface PlotOccupancySchedule {
  /** Length 24 — windows glow at hour h. */
  litHours: boolean[];
  /** Length 24 — hearth lit at hour h. */
  hearthHours: boolean[];
  occupants: OccupantDaySchedule[];
  household: Household;
}

/** Dusk/night band the windows glow across (inclusive, 24h clock). Sunset-ish
 * through late evening — the hours a lit interior reads against a dim exterior. */
export const DUSK_START_HOUR = 17;
export const DUSK_END_HOUR = 23;

/**
 * Whether a building's windows should glow at `hour`. Pure, RNG-free: the
 * windows light when anyone is home (a hearth-lit window OR at least one member
 * standing home this hour) AND the hour falls in the dusk/night band. Unoccupied
 * or daytime buildings stay dark glass.
 */
export function windowsLitAt(
  occupied: boolean,
  hour: number,
): boolean {
  const h = ((Math.floor(hour) % 24) + 24) % 24;
  const isDusk = h >= DUSK_START_HOUR && h <= DUSK_END_HOUR;
  return occupied && isDusk;
}

/**
 * The occupancy overlay for one town plot at a given hour, or `undefined` when
 * the plot has no household (unpopulated town, storehouse, civic, temple, keep).
 *
 * @param plotPop   the plot's population record (from the town engine).
 * @param allPlots  every plot in the town (for workplace/proprietor lookups).
 * @param plotInput the geometric plot input (footprint/role/storeys) — the same
 *                  object fed to the interior builder, so the blueprint frame
 *                  the stations land in matches the one the shell is built in.
 * @param seedPath  the town's canonical seed path (blueprintForPlot's frame).
 * @param townSeed  the town seed path householdForPlot / generateHousehold key on.
 * @param hour      0–23 game hour.
 */
/**
 * Resolve one station row entry to plan feet: the furnishing's center when the
 * member stands at a piece, else the claimed room's anchor cell center —
 * guaranteed inside the (possibly L-shaped) room. Mirrors the 2D overlay
 * exactly. Returns null for an OUT station (no station this hour).
 *
 * No-fallback directive: a HOME station must resolve to a real room. A missing
 * room is a schedule/plan mismatch, not a `(0,0)` placement — so we throw.
 */
function stationToFeet(
  st: OccupantStation,
  plan: BlueprintPlan,
): StationFeetPoint | null {
  if (st.where !== 'home' || st.level === undefined) return null;
  const floor = plan.floors.find((f) => f.level === st.level);
  if (!floor) return null;

  let x: Feet;
  let y: Feet;
  const fu = st.furnishingIndex !== undefined ? floor.furnishings[st.furnishingIndex] : undefined;
  if (fu) {
    // Furniture carries its center in feet — the member stands at the piece.
    x = fu.x;
    y = fu.y;
  } else {
    // No piece → the claimed room's anchor cell center (guaranteed in-room),
    // exactly as the 2D overlay resolves an anchored station.
    const room = st.roomId !== undefined ? floor.rooms.find((r) => r.id === st.roomId) : undefined;
    if (!room) {
      throw new Error(
        `stationToFeet: member ${st.memberIndex} home at level ${st.level} room ${st.roomId} ` +
        `but no such room on the floor — occupancy/plan mismatch.`,
      );
    }
    x = (room.anchor.cx + 0.5) * 5;
    y = (room.anchor.cy + 0.5) * 5;
  }
  return { xFt: x, yFt: y, level: st.level, activity: st.activity };
}

/**
 * Map a member's free-text trade onto the closed-body Occupation set the render
 * figures key on. Only heads/spouses carry a trade identity; everyone else is a
 * plain resident.
 */
export function occupationForMember(
  member: Household['members'][number] | undefined,
): 'resident' | 'shopkeeper' | 'artisan' {
  const trade = (member?.occupation ?? '').toLowerCase();
  if (member?.role !== 'head' && member?.role !== 'spouse') return 'resident';
  if (/keep|shop|innkeep|tavern|clerk|official|merchant/.test(trade)) return 'shopkeeper';
  if (/smith|artisan|wright|journey|apprentice|craft|brew|forge/.test(trade)) return 'artisan';
  return 'resident';
}

/**
 * The FULL-DAY occupancy schedule for one town plot: for every hour, which
 * windows glow and whether the hearth is lit, plus each home member's station
 * table (in PLAN FEET) across all 24 hours. Baked once at world-gen; the
 * renderer re-resolves it against the live clock. `undefined` when the plot has
 * no household (unpopulated town, storehouse, civic, temple, keep).
 *
 * @param plotPop   the plot's population record (from the town engine).
 * @param allPlots  every plot in the town (for workplace/proprietor lookups).
 * @param plotInput the geometric plot input (footprint/role/storeys).
 * @param seedPath  the town's canonical seed path (blueprintForPlot's frame).
 * @param townSeed  the town seed path householdForPlot / generateHousehold key on.
 */
export function occupancyScheduleForPlot(
  plotPop: TownPlotPopulation,
  allPlots: readonly TownPlotPopulation[],
  plotInput: InteriorPlotInput,
  seedPath: SeedPath,
  townSeed: SeedPath,
): PlotOccupancySchedule | undefined {
  const resolved = householdForPlot(plotPop, allPlots, townSeed);
  if (!resolved) return undefined;
  const { household, worksAtHome } = resolved;

  // PERF NOTE (2026-07-08): this is 1 of ~3 blueprintForPlot calls per populated
  // plot (the other two are in buildInterior). generateBuilding is memoized, so
  // the repeat calls are cache hits — measured ~17 ms total (1.9%) over a
  // 650-plot capital bake; the real cost is cold generation (~1.3 ms/plot). Left
  // un-threaded on purpose; full verdict in bridge/interiorParts.ts (buildInterior).
  // Bench: .agent/scratch/bench-blueprint-fetch.ts
  const plan = blueprintForPlot(plotInput, seedPath);
  const occ = computeOccupancy(plan, household, { worksAtHome });

  const litHours: boolean[] = [];
  const hearthHours: boolean[] = [];
  // Per-member station table, indexed [memberIndex][hour].
  const byMember = new Map<number, (StationFeetPoint | null)[]>();
  household.members.forEach((_, i) => byMember.set(i, new Array(24).fill(null)));

  for (let h = 0; h < 24; h++) {
    const row = occ.stationsByHour[h] ?? [];
    let anyHome = false;
    for (const st of row) {
      const feet = stationToFeet(st, plan);
      if (feet) {
        anyHome = true;
        byMember.get(st.memberIndex)?.splice(h, 1, feet);
      }
    }
    const hearth = occ.flags.hearthLitHours[h] ?? false;
    hearthHours[h] = hearth;
    // Occupied = the hearth is lit (implies home) OR any member stands home.
    litHours[h] = windowsLitAt(hearth || anyHome, h);
  }

  const occupants: OccupantDaySchedule[] = [];
  household.members.forEach((member, memberIndex) => {
    const stations = byMember.get(memberIndex)!;
    // A member never home all day contributes no figure. This is an empty set,
    // not a fallback.
    if (stations.every((s) => s === null)) return;
    occupants.push({
      memberIndex,
      name: member.name.split(' ')[0] ?? `#${memberIndex}`,
      ageBand: member.ageBand ?? 'adult',
      occupation: occupationForMember(member),
      stationsByHour: stations,
    });
  });

  return { litHours, hearthHours, occupants, household };
}

export function occupancyForPlot(
  plotPop: TownPlotPopulation,
  allPlots: readonly TownPlotPopulation[],
  plotInput: InteriorPlotInput,
  seedPath: SeedPath,
  townSeed: SeedPath,
  hour: number,
): PlotOccupancy | undefined {
  const sched = occupancyScheduleForPlot(plotPop, allPlots, plotInput, seedPath, townSeed);
  if (!sched) return undefined;

  const h = ((Math.floor(hour) % 24) + 24) % 24;
  const stations: OccupancyStationPoint[] = [];
  for (const occ of sched.occupants) {
    const st = occ.stationsByHour[h];
    if (!st) continue;
    stations.push({
      memberIndex: occ.memberIndex,
      name: occ.name,
      activity: st.activity,
      x: st.xFt,
      y: st.yFt,
      level: st.level,
    });
  }
  return {
    stations,
    hearthLit: sched.hearthHours[h],
    litWindows: sched.litHours[h],
    household: sched.household,
  };
}
