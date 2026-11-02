/**
 * Connects resident travel to the doors that the fitted buildings actually draw.
 * Plot footprints still own the town and roads; a smaller fitted interior may
 * place its real leaf away from the old plot-wall midpoint. This projection
 * keeps those source meshes/identities intact and gives street motion and room
 * arrival gates one derived graph. It grants no door or trespass permission.
 * Called by groundChunkLoader after all buildings in a town have been fitted.
 */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 29/10/2026, 01:49:01
 * Dependents: systems/worldforge/bridge/groundChunkLoader.ts
 * Imports: 6 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import type { GroundWorld } from './groundChunkLoader';
import type { TownPlan } from '../artifacts';
import type { TownRoster } from '../roster/types';
import { buildStreetGraph, type Point } from '../roster/agentPath';
import { commuteArrivalDelayAtHour, registerErrandGroups } from '../roster/townSnapshot';
import { siteOrientationFromQuad, sitePartScenePosition } from './sitePartTransform';

type ResidentBuilding = GroundWorld['buildings'][number];
const FT = 0.3048;

/** Closed source leaf center relative to the building, never its swung pose.
 * If a building has multiple ground entries, retain the one closest to its
 * established street frontage, with a stable source-id tie break. */
export function physicalResidentDoor(building: ResidentBuilding): {x: number; z: number; id: string} | undefined {
  if (building.cornersM.length !== 4) return undefined;
  const orientation = siteOrientationFromQuad(building.cornersM);
  const preferred = {x: building.frontDoorOffsetX ?? 0, z: building.frontDoorOffsetZ ?? 0};
  return (building.parts ?? []).filter(part => part.door?.level === 0)
    .map(part => {
      const point = sitePartScenePosition(part, {groupX: 0, groupZ: 0, surfaceY: 0, ...orientation});
      return {x: point.x, z: point.z, id: part.door!.id};
    })
    .filter(point => Number.isFinite(point.x) && Number.isFinite(point.z))
    .sort((a, b) => Math.hypot(a.x - preferred.x, a.z - preferred.z) - Math.hypot(b.x - preferred.x, b.z - preferred.z)
      || a.id.localeCompare(b.id))[0];
}

/** All source buildings are available before measuring a commute. Construct a
 * fresh graph so cached old midpoint routes cannot leak into new arrival gates.
 * Geometry arrays, town plan, roster and source people remain untouched. */
export function residentDoorRoutes(
  plan: TownPlan,
  burgId: number,
  buildings: ResidentBuilding[],
  roster: TownRoster,
  boundsFeet: {x: number; y: number},
) {
  const prefix = `wf-plot-${burgId}-`;
  const doors = new Map<number, Point>();
  const fitted = buildings.map(building => {
    if (!building.id.startsWith(prefix)) return building;
    const door = physicalResidentDoor(building);
    if (!door) return building;
    const plotId = Number(building.id.slice(prefix.length));
    if (!Number.isInteger(plotId)) return building;
    doors.set(plotId, [(building.xM + door.x) / FT + boundsFeet.x, (building.zM + door.z) / FT + boundsFeet.y]);
    return {...building, frontDoorOffsetX: door.x, frontDoorOffsetZ: door.z};
  });
  const streetGraph = buildStreetGraph(plan, doors);
  // GG-601: the errand slots decide each walk's last step, so they must be
  // set before the arrival delays below read the walk times.
  registerErrandGroups(streetGraph, roster.occupants);
  const members = new Map(roster.occupants.filter(o => o.householdMemberId !== undefined)
    .map(o => [o.householdMemberId!, o]));
  return {
    streetGraph,
    buildings: fitted.map(building => ({...building, occupants: building.occupants?.map(occupant => {
      const person = occupant.burgId === burgId && occupant.householdMemberId
        ? members.get(occupant.householdMemberId) : undefined;
      if (!person || person.name !== occupant.name) return occupant;
      return {...occupant, interiorArrivalDelayByHour: occupant.stationsByHour.map((station, hour) =>
        station ? commuteArrivalDelayAtHour(streetGraph, person, hour) : 0)};
    })})),
  };
}
