/** Exterior and opt-in private leaves use canonical geometry and real reach.
 * Shared-side private operation requires current room consent; occupied-side
 * egress survives expired permission. NPC routing and lock mechanics remain open. */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 01/11/2026, 17:09:18
 * Dependents: components/World3D/World3DWrapper.tsx
 * Imports: 5 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import {doorBodyClearance,DOOR_BODY_REACH_M,type DoorBodies} from './doorBodyClearance';
import { blueprintSiteOrigin, type BlueprintPlan } from '@/systems/worldforge/interior/blueprintTypes';
import { privateRoomDoorSpecs } from '@/systems/worldforge/interior/doors';
import { doorPartForState, siteDoorId, worldOffsetToSiteLocal } from '@/systems/worldforge/bridge/sitePartTransform';
import type { AvatarFootfall, FurnishingPick } from './groundFurnishingInteraction';

export function doorInteractionError(plan: BlueprintPlan, pick: FurnishingPick, player: AvatarFootfall | null, open: boolean, privateRoomAccess:ReadonlySet<string>=new Set(),bodies?:DoorBodies|null): string | null {
  const identity = pick.part.door;
  const floor = plan.floors.find(f => f.level === identity?.level);
  const door = identity && floor?.doors[identity.index];
  const privateSpec=identity&&privateRoomDoorSpecs(plan).find(spec=>spec.level===identity.level&&spec.index===identity.index);
  if (!identity || !door || (!door.isEntry&&!privateSpec) || door.axis !== identity.axis) return 'This door is no longer available.';
  const origin = blueprintSiteOrigin(plan), FT = 0.3048;
  const x = (door.x - origin.x) * FT, z = (door.y - origin.y) * FT;
  if (identity.id !== siteDoorId(identity.level, identity.index, door.axis, x, z)
    || Math.abs(pick.part.x - x) > 1e-5 || Math.abs(pick.part.z - z) > 1e-5
    || door.openDir.nx !== identity.swingX || door.openDir.ny !== identity.swingZ) return 'This door has changed. Try again after the building refreshes.';
  if (!player || ![player.xM, player.zM, player.yM].every(Number.isFinite)) return 'Wait until your character arrives.';
  if (Math.abs(player.yM - pick.transform.surfaceY - (pick.part.baseY ?? 0)) > 0.75) return 'Approach this door on the same floor.';
  const local = worldOffsetToSiteLocal(player.xM - pick.transform.groupX, player.zM - pick.transform.groupZ, pick.transform.rotationY);
  const px = local.lx, pz = local.lz * -pick.transform.doorZSign;
  const room = floor!.rooms.find(r => r.cells.some(c => c.cx === Math.floor((px / FT + origin.x) / 5) && c.cy === Math.floor((pz / FT + origin.y) / 5)));
  if(privateSpec){
    if(identity.privateRoomId!==privateSpec.roomId)return 'This door has changed. Try again after the building refreshes.';
    if(!room||room.id!==door.a&&room.id!==door.b)return 'Approach this door from one of its rooms.';
    // Occupied-side egress never depends on a reservation that may have expired.
    // The shared side needs current room consent; opening a door grants no goods.
    if(room.id!==privateSpec.roomId&&!privateRoomAccess.has(identity.level+':'+privateSpec.roomId))
      return 'This bedroom is private. You need permission to operate its door.';
  }else if (room && room.id !== door.b) return 'Approach this door from its entry room or the street.';
  const along = door.axis === 'x' ? px - x : pz - z;
  const halfLength = (door.axis === 'x' ? pick.part.w : pick.part.d) / 2;
  if (!room && (Math.abs(along) > halfLength + 0.45 || (px - x) * identity.swingX + (pz - z) * identity.swingZ > 0)) return 'Approach the doorway to use this door.';
  const leaf = doorPartForState(pick.part, open);
  const distance = Math.hypot(Math.max(0, Math.abs(px - leaf.x) - leaf.w / 2), Math.max(0, Math.abs(pz - leaf.z) - leaf.d / 2));
  if (distance > DOOR_BODY_REACH_M) return 'Move closer to use this door.';
  const next = doorPartForState(pick.part, !open);
  if (Math.abs(px - next.x) < next.w / 2 + 0.3 && Math.abs(pz - next.z) < next.d / 2 + 0.3) return open ? 'Step clear of the doorway before closing it.' : 'Step clear of the door swing before opening it.';
  if(privateSpec){
    const measured=bodies?.get('player');
    if(!measured||Math.hypot(measured.xM-player.xM,measured.yM-player.yM,measured.zM-player.zM)>.1)
      return 'Wait until the doorway is ready before operating this door.';
    const clearance=doorBodyClearance(pick.part,pick.transform,bodies);
    if(!clearance.valid)return 'Wait until the doorway is ready before operating this door.';
    if(clearance.blockers.length)return 'Someone is in the door swing. Wait until the path is clear.';
  }
  return null;
}
