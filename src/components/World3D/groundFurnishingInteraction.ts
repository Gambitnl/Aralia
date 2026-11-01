/** Physical examination uses the moving body's footfall and canonical room,
 * never the camera or a click-to-move destination. No goods are transferred. */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * CRITICAL CORE SYSTEM: Changes here ripple across the entire city.
 *
 * Last Sync: 01/11/2026, 17:09:18
 * Dependents: components/World3D/GroundFurnishingContext.ts, components/World3D/NearbyBuildingDoor.tsx, components/World3D/NearbyFurnishing.tsx, components/World3D/World3DScene.tsx, components/World3D/World3DWrapper.tsx, components/World3D/groundDoorInteraction.ts, components/World3D/groundResidentInteraction.ts, components/World3D/libraryReadingAccess.ts, components/World3D/publicBuildingDiscovery.ts, components/World3D/publicSeatRest.tsx, components/World3D/templeDedication.tsx, components/World3D/workbenchAccess.ts
 * Imports: 5 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import { blueprintSiteOrigin, cellKey, type BlueprintPlan } from '../../systems/worldforge/interior/blueprintTypes';
import { BLUEPRINT_STOREY_FT } from '../../systems/world3d/buildingModels';
import type {DoorBodies} from './doorBodyClearance';
import type { SitePart } from '../../systems/worldforge/bridge/interiorParts';
import type { SiteGroupTransform } from '../../systems/worldforge/bridge/sitePartTransform';

export type AvatarFootfall = { xM: number; zM: number; yM: number };
export type FurnishingPick = { siteId: string; part: SitePart; transform: SiteGroupTransform;
  /** Scene-owned live ledger, read after async source checks. Never saved or
   * interpreted as room consent; an unmounted scene returns null. */
  readDoorBodies?:()=>DoorBodies|null;
};
const FT = 0.3048;

export function furnishingReachError(plan: BlueprintPlan, pick: FurnishingPick, player: AvatarFootfall | null): string | null {
  const identity = pick.part.furnishing;
  const floor = plan.floors.find(f => f.level === identity?.level);
  const furnishing = identity && floor?.furnishings[identity.index];
  if (!identity || !furnishing || furnishing.kind !== identity.kind || furnishing.roomId !== identity.roomId) return 'This furnishing is no longer available.';
  if (!player || ![player.xM, player.zM, player.yM].every(Number.isFinite)) return 'Wait until your character arrives.';
  const t = pick.transform;
  const dx = player.xM - t.groupX, dz = player.zM - t.groupZ;
  const x = dx * Math.cos(t.rotationY) - dz * Math.sin(t.rotationY);
  const z = (dx * Math.sin(t.rotationY) + dz * Math.cos(t.rotationY)) * -t.doorZSign;
  const origin = blueprintSiteOrigin(plan);
  const xFt = x / FT + origin.x, yFt = z / FT + origin.y;
  const room = floor!.rooms.find(r => r.id === identity.roomId);
  const inside = room?.cells.some(c => cellKey(c.cx, c.cy) === cellKey(Math.floor(xFt / 5), Math.floor(yFt / 5)));
  if (!inside || Math.abs(player.yM - (t.surfaceY + identity.level * BLUEPRINT_STOREY_FT * FT)) > 0.75) return 'Enter this room on the same floor to examine it.';
  // Reject a stale mesh receipt even when another piece happens to share its kind.
  if (Math.abs(pick.part.x - (furnishing.x - origin.x) * FT) > 1e-5 || Math.abs(pick.part.z - (furnishing.y - origin.y) * FT) > 1e-5) return 'This furnishing has changed. Try again after the room refreshes.';
  const distance = Math.hypot(Math.max(Math.abs(x - pick.part.x) - pick.part.w / 2, 0), Math.max(Math.abs(z - pick.part.z) - pick.part.d / 2, 0));
  return distance <= 1.5 ? null : 'Move closer to examine this furnishing.';
}
