/** Records knowledge of a public room only after the walking body reaches its
 * actual structural floor. Blueprint rooms and saved businesses own identity;
 * the existing discovery log owns persistence. This grants no service or meeting. */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 29/10/2026, 18:54:40
 * Dependents: components/World3D/hooks/useWorld3DDiscovery.ts, components/World3D/publicSeatRest.tsx
 * Imports: 11 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import type { GameState } from '../../types/state';
import { DiscoveryType } from '../../types';
import type { GroundWorld } from '../../systems/worldforge/bridge/groundChunkLoader';
import type { TownBuildingVisit } from '../Worldforge/townBuildingVisit';
import type { AvatarFootfall } from './groundFurnishingInteraction';
import { groundSurfaceYM } from './terrain/groundSurfaceYM';
import { siteOrientationFromQuad, sitePartLocalOffset, worldOffsetToSiteLocal } from '../../systems/worldforge/bridge/sitePartTransform';
import { blueprintSiteOrigin } from '../../systems/worldforge/interior/blueprintTypes';
import { BLUEPRINT_STOREY_FT } from '../../systems/world3d/buildingModels';
import { attendanceForVisit } from '../../systems/economy/businessAttendance';
import { getGameDay } from '../../utils/core';

type VisitState = Pick<GameState, 'worldSeed' | 'playerCell' | 'worldBusinesses' | 'gameTime' | 'townSim'>;
const FT = .3048;

/** Visits and furnishings share one definition of a public room. A private
 * bedroom does not become public because it contains a bench or a business. */
export function publicBuildingRoom(visit: TownBuildingVisit, level: number, roomId: number) {
  const room = visit.plan.floors.find(floor => floor.level === level)?.rooms.find(candidate => candidate.id === roomId);
  if (!room?.isMain) return undefined;
  const eligible = visit.isBusiness
    ? ['common-room', 'shopfront', 'workshop', 'forge'].includes(room.purpose)
    : ['temple', 'shrine', 'library', 'school'].includes(visit.plan.type)
      && ['hall', 'nave', 'sanctuary', 'study'].includes(room.purpose);
  return eligible ? room : undefined;
}

export function publicBuildingDiscovery(ground: GroundWorld, body: AvatarFootfall, state: VisitState,
  readVisit: (burgId: number, plotId: number) => TownBuildingVisit) {
  if (![body.xM, body.zM, body.yM, state.worldSeed, state.playerCell?.cellId].every(Number.isFinite)) return null;
  for (const building of ground.buildings ?? []) {
    const identity = /^wf-plot-(\d+)-(\d+)$/.exec(building.id);
    if (!identity || building.cornersM.length < 4) continue;
    const orientation = siteOrientationFromQuad(building.cornersM);
    const local = worldOffsetToSiteLocal(body.xM - building.xM, body.zM - building.zM, orientation.rotationY);
    const radius = Math.max(...building.cornersM.map(corner => Math.hypot(corner.x - building.xM, corner.z - building.zM)));
    if (Math.hypot(local.lx, local.lz) > radius) continue;
    const padY = groundSurfaceYM(ground, building.xM, building.zM);
    // A floor tag must belong to a visible structural slab directly under the
    // feet. A roof, furnishing, terrain under the house or tactical wall is not
    // evidence of entering. Keep the same transform as rendering and walking.
    const slab = building.parts.find(part => {
      if (part.walkSurface !== 'floor' || part.renderRole === 'tactical-only' || part.furnishing || part.door
        || !(part.w > 0 && part.d > 0 && part.h > 0)) return false;
      const offset = sitePartLocalOffset(part, orientation.doorZSign);
      return Math.abs(local.lx - offset.x) <= part.w / 2
        && Math.abs(local.lz - offset.z) <= part.d / 2
        && Math.abs(body.yM - padY - (part.baseY ?? 0) - part.h) <= .04;
    });
    if (!slab) continue;
    const burgId = Number(identity[1]), plotId = Number(identity[2]);
    let visit: TownBuildingVisit;
    // A stale/unavailable source cannot manufacture knowledge or break walking.
    try { visit = readVisit(burgId, plotId); } catch { continue; }
    if (visit.plot.id !== plotId) continue;
    const origin = blueprintSiteOrigin(visit.plan);
    const cx = Math.floor((local.lx / FT + origin.x) / 5);
    const cy = Math.floor((local.lz * -orientation.doorZSign / FT + origin.y) / 5);
    const level = Math.round(((slab.baseY ?? 0) + slab.h) / (BLUEPRINT_STOREY_FT * FT));
    const room = visit.plan.floors.find(floor => floor.level === level)?.rooms.find(candidate =>
      candidate.cells.some(cell => cell.cx === cx && cell.cy === cy));
    // Main bedrooms, storage and private households remain private. Civic
    // worship/reading rooms use their fitted type; shop names do not imply beds.
    if (!room || !publicBuildingRoom(visit, level, room.id)) continue;
    const matches = Object.values(state.worldBusinesses ?? {}).filter(business => business.burgId === burgId && business.plotId === plotId);
    if (matches.length > 1) continue;
    const business = matches[0];
    const name = business?.name || building.name || `${visit.plan.type} in ${visit.townName}`;
    // Unnamed civic sources already include the town in their fallback label.
    // Keep that identity, but say the destination only once in the account.
    const destination = name.endsWith(` in ${visit.townName}`) ? name : `${name} in ${visit.townName}`;
    const locationId = `world:${state.worldSeed}:cell:${state.playerCell!.cellId}:building:${building.id}`;
    const floorName = level === 0 ? 'ground floor' : level < 0 ? `basement level ${-level}` : `floor ${level}`;
    const attendance = visit.isBusiness
      ? attendanceForVisit(visit, state.gameTime.getUTCHours(), state.townSim?.[burgId], getGameDay(state.gameTime)) : null;
    return {
      gameTime: state.gameTime.toISOString(), type: DiscoveryType.LOCATION_DISCOVERY,
      title: `Place Visited: ${name}`,
      content: `You entered ${destination}. Its public ${room.purpose.replaceAll('-', ' ')} is on the ${floorName}.`
        + (attendance ? ` At this visit: ${(attendance.open
          ? `the keeper is scheduled to serve. Posted hours: ${attendance.hours}`
          : attendance.reason ?? 'the keeper is off duty').replace(/[.!?]+$/, '')}.` : ''),
      source: {type: 'LOCATION' as const, id: locationId, name},
      flags: [{key: 'locationId', value: locationId, label: name},
        {key: 'knowledgeKind', value: 'firsthand-public-visit'},
        {key: 'buildingId', value: building.id}, {key: 'roomId', value: String(room.id)},
        {key: 'floorLevel', value: String(level)},
        ...(business ? [{key: 'businessId', value: business.id}] : [])],
      isQuestRelated: false, associatedLocationId: `cell_${state.playerCell!.cellId}`,
    };
  }
  return null;
}
