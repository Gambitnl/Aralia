/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 18/07/2026, 19:29:53
 * Dependents: systems/world3d/buildingSceneModel.ts, systems/world3d/types.ts, systems/worldforge/bridge/groundChunkLoader.ts
 * Imports: 8 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
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
import { type InteriorPlotInput } from '../interior/generateInterior';
import type { BlueprintPlan } from '../interior/blueprintTypes';
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
export declare const DUSK_START_HOUR = 17;
export declare const DUSK_END_HOUR = 23;
/**
 * Whether a building's windows should glow at `hour`. Pure, RNG-free: the
 * windows light when anyone is home (a hearth-lit window OR at least one member
 * standing home this hour) AND the hour falls in the dusk/night band. Unoccupied
 * or daytime buildings stay dark glass.
 */
export declare function windowsLitAt(occupied: boolean, hour: number): boolean;
/**
 * Map a member's free-text trade onto the closed-body Occupation set the render
 * figures key on. Only heads/spouses carry a trade identity; everyone else is a
 * plain resident.
 */
export declare function occupationForMember(member: Household['members'][number] | undefined): 'resident' | 'shopkeeper' | 'artisan';
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
 * @param precomputedBlueprint the exact plan already resolved by the building
 *                  load packet. Supplying it prevents this schedule pass from
 *                  rebuilding generateBuilding's digest key for the same plot.
 */
export declare function occupancyScheduleForPlot(plotPop: TownPlotPopulation, allPlots: readonly TownPlotPopulation[], plotInput: InteriorPlotInput, seedPath: SeedPath, townSeed: SeedPath, precomputedBlueprint?: BlueprintPlan): PlotOccupancySchedule | undefined;
export declare function occupancyForPlot(plotPop: TownPlotPopulation, allPlots: readonly TownPlotPopulation[], plotInput: InteriorPlotInput, seedPath: SeedPath, townSeed: SeedPath, hour: number): PlotOccupancy | undefined;
