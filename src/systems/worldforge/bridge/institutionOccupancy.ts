/**
 * Gives an admitted civic worker a real public station while retaining the
 * personal body that already belongs to their household. This projection
 * creates no family, merchant, capability or saved person. Door-route timing
 * is applied afterward by the existing residentDoorRoutes pass.
 */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 29/10/2026, 06:27:07
 * Dependents: systems/worldforge/bridge/groundChunkLoader.ts
 * Imports: 7 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import type { BlueprintPlan } from '../interior/blueprintTypes';
import { blueprintSiteOrigin } from '../interior/blueprintTypes';
import type { OccupantStation } from '../interior/occupancy';
import { placeActivityStations } from '../interior/activityPositions';
import type { StationFeetPoint } from './buildingOccupancy';
import { windowsLitAt } from './buildingOccupancy';
import type { GroundWorld } from './groundChunkLoader';
import type { Occupant, TownRoster } from '../roster/types';
import { occupantLocationAt } from '../roster/occupantSchedule';

type Building = GroundWorld['buildings'][number];

/** Use the public ground-floor nave or the library's real study desk.
 * Shared activity clearance excludes furniture, stairs and door approaches.
 * A private room, an upper floor or a packed room supplies no duty station. */
export function institutionDutyStation(plan: BlueprintPlan,
  role: NonNullable<Occupant['civicWorkplace']>['role'] = 'priest'): StationFeetPoint | undefined {
  const floor = plan.floors.find(candidate => candidate.level === 0);
  if (!floor || !floor.doors.some(door => door.isEntry)) return undefined;
  const rooms = floor.rooms.filter(room => room.purpose === (role === 'librarian' ? 'study' : 'nave'))
    .sort((a, b) => b.area - a.area || a.id - b.id);
  for (const room of rooms) {
    const furnishing = floor.furnishings.findIndex(piece => piece.roomId === room.id
      && piece.kind === (role === 'librarian' ? 'desk' : 'altar'));
    if (role === 'librarian' && furnishing < 0) continue;
    const station: OccupantStation = {memberIndex: 0, hour: 12, where: 'home',
      level: 0, roomId: room.id, activity: 'work',
      ...(furnishing >= 0 ? {furnishingIndex: furnishing} : {})};
    placeActivityStations(plan, [station]);
    if (station.standingPosition && !station.standingIssue) {
      return {...station.standingPosition, level: 0, activity: 'work'};
    }
  }
  return undefined;
}

/** Mount only the same source household packet at the qualified duty site.
 * Household meals, sleep and body recipe remain the originals. The two packet
 * locations are joined into one live actor by the existing stable member key. */
export function institutionOccupancyBuildings(
  burgId: number,
  roster: TownRoster,
  buildings: Building[],
  plans: ReadonlyMap<number, BlueprintPlan>,
): Building[] {
  let result = buildings;
  for (const person of roster.occupants) {
    const duty = person.civicWorkplace;
    if (!duty || !person.householdMemberId) continue;
    // Authored library packets already place their proprietor. Only the saved
    // priest needs this additional institutional body projection; never add a
    // second librarian or replace their original household body and stations.
    if (duty.role !== 'priest') continue;
    const homeId = 'wf-plot-' + burgId + '-' + person.homePlotId;
    const targetId = 'wf-plot-' + burgId + '-' + duty.plotId;
    const home = result.find(building => building.id === homeId);
    const target = result.find(building => building.id === targetId);
    const source = home?.occupants?.find(packet => packet.burgId === burgId
      && packet.householdMemberId === person.householdMemberId
      && packet.id === person.id && packet.name === person.name);
    const plan = plans.get(duty.plotId);
    const station = plan && institutionDutyStation(plan);
    if (!source || !target || target.role !== 'temple' || !station
      || !target.parts.some(part => part.door?.level === 0)
      || ![target.wallWidthM, target.wallDepthM].every(value => Number.isFinite(value) && value > 0)) continue;

    const working = Array.from({length: 24}, (_, hour) => {
      const block = occupantLocationAt(person, hour);
      return block.activity === 'working' && block.plotId === duty.plotId;
    });
    if (!working.some(Boolean)) continue;
    const origin = blueprintSiteOrigin(plan!);
    const dutyPacket = {...source,
      stationsByHour: working.map(active => active ? {...station} : null),
      interiorOwnedByHour: [...working],
      interiorArrivalDelayByHour: Array(24).fill(0)};
    result = result.map(building => {
      if (building.id === homeId) return {...building, occupants: building.occupants!.map(packet =>
        packet === source ? {...packet,
          stationsByHour: packet.stationsByHour.map((point, hour) => working[hour] ? null : point),
          interiorOwnedByHour: packet.stationsByHour.map((point, hour) => !working[hour]
            && (packet.interiorOwnedByHour?.[hour] ?? point !== null)),
        } : packet)};
      if (building.id !== targetId) return building;
      return {...building,
        occupants: [...(building.occupants ?? []).filter(packet =>
          packet.burgId !== burgId || packet.householdMemberId !== person.householdMemberId), dutyPacket],
        interiorWidthFt: building.wallWidthM / .3048,
        interiorDepthFt: building.wallDepthM / .3048,
        interiorOriginXFt: origin.x,
        interiorOriginYFt: origin.y,
        litHours: working.map((active, hour) => Boolean(building.litHours?.[hour])
          || windowsLitAt(active, hour)),
        // A daytime worker does not light an invented domestic hearth.
        hearthHours: building.hearthHours ?? Array(24).fill(false),
      };
    });
  }
  return result;
}
