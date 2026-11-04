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
 *
 * A public house (a plan with a `common-room`) also emits evening PATRON rows.
 * They share the OccupantDaySchedule shape so nothing downstream needs a
 * visitor branch, but their `memberIndex` continues past the household so they
 * can never be mistaken for a named family member or joined to the roster.
 */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * SHARED UTILITY: Multiple systems rely on these exports.
 *
 * Last Sync: 01/11/2026, 18:13:13
 * Dependents: components/World3D/residentInteriorMotion.ts, systems/world3d/buildingSceneModel.ts, systems/world3d/types.ts, systems/worldforge/bridge/groundChunkLoader.ts, systems/worldforge/bridge/institutionOccupancy.ts
 * Imports: 12 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import type { SeedPath } from '../seedPath';
import { stationPose, type StationPoseInfo } from '../interior/stationPose';
import type { Feet } from '../units';
import { blueprintForPlot, type InteriorPlotInput } from '../interior/generateInterior';
import type { BlueprintPlan } from '../interior/blueprintTypes';
import { computeOccupancy, type OccupantStation, type RoomClaim } from '../interior/occupancy';
import { readObservedBuildingSource, buildingPlanSignature } from '../interior/buildingSource';
import {privateRoomDoorSpecs,PRIVATE_PURPOSES} from '../interior/doors';
import {blueprintSiteOrigin} from '../interior/blueprintTypes';
import {siteDoorId} from './sitePartTransform';
import { householdForPlot, householdMemberIdentity } from '../town/householdBrief';
import type { Household } from '../town/household';
import type { TownPlotPopulation } from '../town/townEngine';
import {publicHouseWorkRoleForOwner} from '../roster/workHours';

/** One member standing at their station this hour, in PLAN FEET. */
export interface OccupancyStationPoint {
  /** Index into `household.members`. */
  memberIndex: number;
  /** The member's given name (first token of their full name). */
  name: string;
  activity: 'sleeping' | 'meal' | 'work' | 'hearthside' | 'chores' | 'out' | 'visiting';
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
  /** Source room identity is carried only by the opt-in private-leaf profile. */
  roomId?:number;
  /** GG-598: what the body does here (sit, sleep, work-at, stand), the piece it
   * uses and the point it faces, from the station's activity and furniture. */
  pose?: StationPoseInfo;
}

/** Resident-only permission over an actual sleeping-room claim. This is not
 * a player grant; transient use still requires a live body at the opening. */
export interface ResidentPrivateDoorAccess {
  profile:'private-room-leaves-v1';memberId:string;
  doors:Array<{id:string;level:number;roomId:number;approachCells:Array<{cx:number;cy:number}>}>;
  /** Source-only resident circulation. Missing older candidate packets refuse
   * physical route following; they never infer access from an open door. */
  routeRooms?:Array<{level:number;roomId:number;cells:Array<{cx:number;cy:number}>}>;
  routeStairs?:Array<{fromLevel:number;cells:Array<{cx:number;cy:number}>}>;
}

/** Match the slot identity, never a display name or a borrowed bed index.
 * Visitor rows never call this helper; absent profiles preserve legacy packets. */
export function residentPrivateDoorAccess(plan:BlueprintPlan,household:Household,claims:readonly RoomClaim[],memberIndex:number):ResidentPrivateDoorAccess|undefined{
  if(plan.doorLeafProfile===undefined)return;
  const specs=privateRoomDoorSpecs(plan),memberId=householdMemberIdentity(household,memberIndex);
  const tag=memberId.slice(household.homeId.length+1),owned=claims.filter(claim=>claim.slotTag===tag);
  if(owned.length>1)throw new Error('A resident private door needs one original room claim.');
  const origin=blueprintSiteOrigin(plan);
  const doors=specs.filter(spec=>owned.some(claim=>claim.level===spec.level&&claim.roomId===spec.roomId)).map(spec=>({
    id:siteDoorId(spec.level,spec.index,spec.door.axis,(spec.door.x-origin.x)*.3048,(spec.door.y-origin.y)*.3048),level:spec.level,roomId:spec.roomId,
    // Full source rooms allow a hinge-side stance; a two-cell portal guess can
    // exclude the only place a measured body can stand clear of a wide leaf.
    approachCells:plan.floors.find(floor=>floor.level===spec.level)!.rooms.filter(room=>room.id===spec.door.a||room.id===spec.door.b)
      .flatMap(room=>room.cells.map(cell=>({...cell})))}));
  // Shared household rooms plus this exact sleeping claim are the admitted
  // region. Other bedrooms/guest rooms stay private even when a leaf is open.
  const routeRooms=plan.floors.flatMap(floor=>floor.rooms.filter(room=>!PRIVATE_PURPOSES.includes(room.purpose)
    ||owned.some(claim=>claim.level===floor.level&&claim.roomId===room.id))
    .map(room=>({level:floor.level,roomId:room.id,cells:room.cells.map(cell=>({...cell}))})));
  const routeStairs=plan.stairs.map(stair=>({fromLevel:stair.fromLevel,cells:[...stair.layout?.shaftCells??[],...stair.layout?.landingCells??[]].map(cell=>({...cell}))}));
  return {profile:'private-room-leaves-v1',memberId,doors,routeRooms,routeStairs};
}

/** One household member's whole day: their station every hour, or null when out. */
export interface OccupantDaySchedule {
  /**
   * Index into `household.members` for a resident. Visitor rows continue PAST
   * the member list (`household.members.length + visitorIndex`) so every body
   * baked for one plot still has a unique, stable render index; consumers that
   * look the index up in `members` correctly find `undefined` for a patron.
   */
  memberIndex: number;
  /** Given name (first token of the full name). */
  name: string;
  /** Age band ('child' | 'adult' | 'elder'). */
  ageBand: string;
  occupation: 'resident' | 'shopkeeper' | 'artisan';
  /** True on a public-house patron row — a body with no household identity. */
  visitor?: boolean;
  /** stationsByHour[h] = the member's station at hour h, or null when OUT. */
  stationsByHour: (StationFeetPoint | null)[];
  privateDoorAccess?:ResidentPrivateDoorAccess;
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
  const roomIdentity=plan.doorLeafProfile&&st.roomId!==undefined?{roomId:st.roomId}:{};
  const poseInfo = stationPose(plan, st);
  const pose = poseInfo ? { pose: poseInfo } : {};
  if (st.standingPosition) return {...st.standingPosition, level: st.level, activity: st.activity,...roomIdentity,...pose};

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
  return { xFt: x, yFt: y, level: st.level, activity: st.activity,...roomIdentity,...pose };
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
 * @param precomputedBlueprint the exact plan already resolved by the building
 *                  load packet. Supplying it prevents this schedule pass from
 *                  rebuilding generateBuilding's digest key for the same plot.
 */
export function occupancyScheduleForPlot(
  plotPop: TownPlotPopulation,
  allPlots: readonly TownPlotPopulation[],
  plotInput: InteriorPlotInput,
  seedPath: SeedPath,
  townSeed: SeedPath,
  precomputedBlueprint?: BlueprintPlan,
): PlotOccupancySchedule | undefined {
  const retained = plotInput.retainedSource ? readObservedBuildingSource(plotInput.retainedSource, plotInput.id,
    plotInput.eventLog as import('../interior/blueprintTypes').BuildingEventHistory | undefined, seedPath) : undefined;
  const resolved = retained ? (retained.household ? {household: retained.household,
    worksAtHome: retained.plan.household?.worksAtHome ?? false} : undefined)
    : householdForPlot(plotPop, allPlots, townSeed);
  if (!resolved) return undefined;
  const { household, worksAtHome } = resolved;

  // Production now resolves the canonical plan once before its schedule and 3D
  // projections fan out. Standalone callers still resolve here, preserving the
  // public helper's old convenience without making the world-load path rebuild
  // household/style/history digests for a plan it already owns.
  const plan = precomputedBlueprint ?? retained?.plan ?? blueprintForPlot(plotInput, seedPath);
  if (retained && buildingPlanSignature(plan) !== buildingPlanSignature(retained.plan)) {
    throw new Error('Occupancy and retained belongings must use the same building source.');
  }
  // Both the real home and the separate counter read the same owner/workplace
  // join. A room called an inn cannot manufacture a night worker or family.
  const workplace = plotPop.residential
    ? allPlots.find(plot => plot.homeId === plotPop.workplaceId) : plotPop;
  const publicHouseWorkRole = publicHouseWorkRoleForOwner(workplace, household.homeId);
  const occ = computeOccupancy(plan, household, {
    worksAtHome,
    workplaceOnly: retained?.workplaceOnly ?? !plotPop.residential,
    publicHouseWorkRole,
  });

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
    // Patrons count as occupancy for the WINDOW schedule only. An inn whose
    // family is still out at 17:00 but whose taproom is full should not read as
    // a dark building from the street. The hearth schedule is untouched: it
    // remains the household's fire, per the WF-INTERIORS #7 decision below.
    const anyVisitor = (occ.visitorStationsByHour[h] ?? []).some(
      (st) => st.where === 'home',
    );
    const hearth = occ.flags.hearthLitHours[h] ?? false;
    hearthHours[h] = hearth;
    // Occupied = the hearth is lit (implies home) OR any member stands home.
    // NOTE: window glow and hearth glow are intentionally SEPARATE schedules
    // (hearth 06–08/17–22, window/dusk 17–23) — Remy resolved WF-INTERIORS #7 on
    // 2026-07-21 to keep them separate, so the dusk band is the sole window driver.
    litHours[h] = windowsLitAt(hearth || anyHome || anyVisitor, h);
  }

  const occupants: OccupantDaySchedule[] = [];
  household.members.forEach((member, memberIndex) => {
    const stations = byMember.get(memberIndex)!;
    // A member never home all day contributes no figure. This is an empty set,
    // not a fallback.
    if (stations.every((s) => s === null)) return;
    const privateDoorAccess=residentPrivateDoorAccess(plan,household,occ.claims,memberIndex);
    occupants.push({
      memberIndex,
      name: member.name.split(' ')[0] ?? `#${memberIndex}`,
      ageBand: member.ageBand ?? 'adult',
      occupation: occupationForMember(member),
      stationsByHour: stations,
      ...(privateDoorAccess?{privateDoorAccess}:{}),
    });
  });

  // Public-house patrons ride the same day-schedule shape so the 3D bake, the
  // 2D overlay and the live-clock renderer need no visitor-specific branch.
  // Their indices continue past the family, keeping the render id derived from
  // (plot, index) unique without disturbing any existing member's id.
  occ.visitors.forEach((visitor) => {
    const stations: (StationFeetPoint | null)[] = new Array(24).fill(null);
    for (let h = 0; h < 24; h++) {
      const st = occ.visitorStationsByHour[h]?.[visitor.visitorIndex];
      if (st) stations[h] = stationToFeet(st, plan);
    }
    if (stations.every((s) => s === null)) return;
    occupants.push({
      memberIndex: household.members.length + visitor.visitorIndex,
      name: visitor.name,
      ageBand: visitor.ageBand,
      // A patron carries no household trade; they are drawn as a plain body.
      occupation: 'resident',
      visitor: true,
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
