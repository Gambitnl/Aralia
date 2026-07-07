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
import { computeOccupancy } from '../interior/occupancy';
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
export function occupancyForPlot(
  plotPop: TownPlotPopulation,
  allPlots: readonly TownPlotPopulation[],
  plotInput: InteriorPlotInput,
  seedPath: SeedPath,
  townSeed: SeedPath,
  hour: number,
): PlotOccupancy | undefined {
  const resolved = householdForPlot(plotPop, allPlots, townSeed);
  if (!resolved) return undefined;
  const { household, worksAtHome } = resolved;

  const plan = blueprintForPlot(plotInput, seedPath);
  const occ = computeOccupancy(plan, household, { worksAtHome });

  const h = ((Math.floor(hour) % 24) + 24) % 24;
  const row = occ.stationsByHour[h] ?? [];

  const stations: OccupancyStationPoint[] = [];
  for (const st of row) {
    if (st.where !== 'home' || st.level === undefined) continue;
    const floor = plan.floors.find((f) => f.level === st.level);
    if (!floor) continue;

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
      const anchor = room?.anchor ?? { cx: 0, cy: 0 };
      x = (anchor.cx + 0.5) * 5;
      y = (anchor.cy + 0.5) * 5;
    }

    stations.push({
      memberIndex: st.memberIndex,
      name: household.members[st.memberIndex]?.name.split(' ')[0] ?? `#${st.memberIndex}`,
      activity: st.activity,
      x,
      y,
      level: st.level,
    });
  }

  const hearthLit = occ.flags.hearthLitHours[h] ?? false;
  // Occupied = someone is home this hour (a lit hearth already implies that, but
  // a family home without a hearth still lights lamps). Windows glow when
  // occupied AND the hour is dusk/night.
  const occupied = hearthLit || stations.length > 0;
  return {
    stations,
    hearthLit,
    litWindows: windowsLitAt(occupied, h),
    household,
  };
}
