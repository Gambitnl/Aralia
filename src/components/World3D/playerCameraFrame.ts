/** A camera-only return to accepted footing; no movement, discovery or time writes. */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 28/10/2026, 17:04:05
 * Dependents: components/World3D/World3DScene.tsx
 * Imports: 6 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import type {GroundWorld} from '@/systems/worldforge/bridge/groundChunkLoader';
import type {SceneOrigin} from '@/systems/world3d/sceneOrigin';
import {worldToScene} from '@/systems/world3d/sceneOrigin';
import {resolveBuildingMotion} from './groundBuildingMotion';
import {groundSurfaceYM} from './terrain/groundSurfaceYM';
import type {CameraFrameRequest} from './FreeRoamCameraController';
import type {PlayerCameraSightline} from './playerCameraVisibility';

export interface PlayerCameraRoom {siteId: string; level: number; roomId: number}
export interface PlayerCameraPartyRoomCandidate {id: string; position: {xM: number; zM: number; yM: number}; room: PlayerCameraRoom | null}

/** Keep only companions whose current source-qualified room matches the player. */
export function sameRoomCameraCompanions(playerRoom: PlayerCameraRoom | null,
  companions: readonly PlayerCameraPartyRoomCandidate[] = []): PlayerCameraPartyRoomCandidate[] {
  if (!playerRoom) return [];
  return companions.filter(member => member.room !== null && member.room.siteId === playerRoom.siteId
    && member.room.level === playerRoom.level && member.room.roomId === playerRoom.roomId
    && [member.position.xM, member.position.zM, member.position.yM].every(Number.isFinite));
}

export function playerCameraFrame(
  ground: GroundWorld | null | undefined,
  foot: {xM: number; zM: number; yM: number} | null,
  origin: SceneOrigin,
  nonce: number,
  sightline?: PlayerCameraSightline,
  partyRoom?: {player: PlayerCameraRoom | null; companions: readonly PlayerCameraPartyRoomCandidate[]},
): CameraFrameRequest | null {
  if (!ground || !foot || ![foot.xM, foot.zM, foot.yM].every(Number.isFinite)) return null;
  const party = sameRoomCameraCompanions(partyRoom?.player ?? null, partyRoom?.companions);
  const farthest = party.reduce((max, member) => Math.max(max,
    Math.hypot(member.position.xM - foot.xM, member.position.zM - foot.zM)), 0);
  // Keep room framing bounded; a large or stale separation falls back to the
  // ordinary player frame instead of turning a camera command into remote follow.
  const includeParty = !!sightline && party.length > 0 && farthest <= 12;
  const findFrame = (frameParty: boolean): CameraFrameRequest | null => {
    const focus = frameParty ? {xM: (foot.xM + party.reduce((sum, member) => sum + member.position.xM, 0)) / (party.length + 1),
      zM: (foot.zM + party.reduce((sum, member) => sum + member.position.zM, 0)) / (party.length + 1),
      yM: (foot.yM + party.reduce((sum, member) => sum + member.position.yM, 0)) / (party.length + 1)} : foot;
    const target = worldToScene(focus.xM, focus.zM, origin), targetY = focus.yM + 1.15;
    // Try nearby directions and indoor eye heights before shortening the arm.
    // Start wide, then try shorter arms inside cramped rooms. The played inn
    // had no clear wide arm but did admit a two-meter view of both people.
    // Retain room and body clearance, and keep a separation-based lower bound
    // so a distant companion cannot be squeezed behind a close camera.
    const partyRadius = frameParty ? Math.min(10, Math.max(6, farthest * .5 + 4)) : null;
    const radii = frameParty ? [partyRadius!, 4, 3, 2, 1.5].filter(radius => radius >= Math.max(1.5, farthest * .5 + 1))
      : sightline ? [6, 4, 3, 2, 1.5, 1, 0.65] : [6, 4, 2, 1.5];
    for (const radius of radii) for (const eyeHeight of (sightline ? [2.6, 1.85] : [2.6])) for (let i = 0; i < 8; i++) {
      const angle = Math.PI / 4 + i * Math.PI / 4;
      const candidate = {xM: focus.xM + Math.cos(angle) * radius, zM: focus.zM + Math.sin(angle) * radius};
      if (!sightline && resolveBuildingMotion(ground, foot, candidate, foot.yM).blocked) continue;
      const eyeY = Math.max(focus.yM + eyeHeight, groundSurfaceYM(ground, candidate.xM, candidate.zM) + 1.5);
      const steps = Math.ceil(radius / 0.5);
      let terrainBlocks = false;
      for (let step = 1; step <= steps; step++) {
        const t = step / steps;
        const height = groundSurfaceYM(ground, focus.xM + (candidate.xM - focus.xM) * t, focus.zM + (candidate.zM - focus.zM) * t);
        if (height + 0.2 >= targetY + (eyeY - targetY) * t) { terrainBlocks = true; break; }
      }
      if (terrainBlocks) continue;
      const position = worldToScene(candidate.xM, candidate.zM, origin), eye: [number,number,number] = [position.x,eyeY,position.z];
      if (sightline?.([target.x,targetY,target.z],eye) != null) continue;
      // A clear midpoint and player do not prove the companion is readable.
      // Sample each matched body only during this explicit frame request; if
      // any qualified companion is hidden, try another bounded arm direction.
      if (frameParty && party.some(member => {
        const at = worldToScene(member.position.xM,member.position.zM,origin);
        return sightline!([at.x,member.position.yM+1.15,at.z],eye,member.id) != null;
      })) continue;
      // Keep this explicit party arm out of the controller's lead-only live
      // wall-follow pass; that pass cannot preserve the companion check above.
      return {kind:frameParty ? 'party' : 'player',nonce,target:[target.x,targetY,target.z],position:eye,height:eyeY-targetY};
    }
    return null;
  };
  return (includeParty ? findFrame(true) : null) ?? findFrame(false);
}
