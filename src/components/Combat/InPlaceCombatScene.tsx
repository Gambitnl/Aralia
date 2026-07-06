/**
 * @file InPlaceCombatScene.tsx — renders combat INSIDE the streamed world.
 *
 * Fight-in-place slice 2 ("kill the teleport"): when a fight started from the
 * live ground world, CombatView renders THIS instead of the separate BattleMap /
 * BattleMap3D diorama. The camera never leaves the town: we re-mount the same
 * `World3DScene` (same terrain, buildings, townsfolk) using the ground world
 * handed across the phase change (`fightInPlaceHandoff`), and overlay the combat
 * surface (`InPlaceCombatLayer`) on it — tokens on the real ground, a soft
 * reachable disc, and a ground-pick plane for click-to-move.
 *
 * The combat MACHINERY is unchanged: CombatView owns the turn manager and
 * ability system and passes the live characters + a move-committing callback in.
 * We translate patch-tile positions ↔ world meters through the invisible referee
 * (`inSceneMovement`), so an in-scene click is ruled by the SAME lattice the 2D
 * board uses. Abilities/attacks still resolve on the existing machinery; for this
 * slice their full in-scene TARGETING is deferred to the 2D-board toggle (the
 * honest cut line documented in the spec), while movement + turn flow are live
 * in-scene.
 */
import React, { useCallback, useMemo, useState } from 'react';
import World3DScene from '../World3D/World3DScene';
import InPlaceCombatLayer, { type InPlaceToken } from '../World3D/combat/InPlaceCombatLayer';
import type { CameraFrameRequest } from '../World3D/FreeRoamCameraController';
import type { CombatCharacter, BattleMapData, CombatAction } from '../../types/combat';
import type { GroundWorld } from '../../systems/worldforge/bridge/groundChunkLoader';
import type { ChunkLoader } from '../../systems/world3d/types';
import { getFightInPlaceHandoff } from '../../systems/combat/fightInPlace/fightInPlaceHandoff';
import {
  patchTileToWorldMeters,
  validateInSceneMove,
  type PatchAnchor,
} from '../../systems/combat/fightInPlace/inSceneMovement';
import { worldToScene } from '../../systems/world3d/sceneOrigin';

export interface InPlaceCombatSceneProps {
  /** The live combat roster (CombatView's `characters` state). */
  characters: CombatCharacter[];
  /** The extracted referee patch (CombatView's `mapData`). */
  mapData: BattleMapData | null;
  /** The current actor's id (turnManager.turnState.currentCharacterId). */
  currentCharacterId: string | null;
  /** Commit a validated move for the active actor (routes turnManager.executeAction). */
  onCommitMove: (action: CombatAction) => void;
  /** Show an on-screen note when a click is rejected (out of range / blocked). */
  onNotify?: (message: string) => void;
}

/**
 * A no-op chunk loader: World3DScene streams terrain around the scene origin.
 * We reuse the handed-off ground world for heights/props but still need the
 * loader to draw terrain chunks. Rather than rebuild the worker pipeline in the
 * combat phase, we render with the ground world's own chunk loader if present;
 * absent that, terrain simply isn't re-streamed (tokens still plant on the
 * handed-off heightfield). For the slice we accept the handed-off ground and a
 * lightweight loader so the scene is populated.
 */
function useHandoffScene() {
  return useMemo(() => {
    const handoff = getFightInPlaceHandoff();
    if (!handoff) return null;
    const ground = handoff.ground as GroundWorld;
    return {
      ground,
      loader: handoff.loader as ChunkLoader,
      sceneOrigin: handoff.sceneOrigin,
      anchor: handoff.anchor as PatchAnchor,
      surfaceY: handoff.surfaceY,
      worldSeed: handoff.worldSeed,
    };
  }, []);
}

const InPlaceCombatScene: React.FC<InPlaceCombatSceneProps> = ({
  characters,
  mapData,
  currentCharacterId,
  onCommitMove,
  onNotify,
}) => {
  const scene = useHandoffScene();
  // One-shot camera framing on mount (frame the fight). Bumped once.
  const [frameNonce] = useState(1);

  const active = characters.find((c) => c.id === currentCharacterId) ?? null;

  // Map each combatant's patch tile → world meters → token.
  const tokens = useMemo<InPlaceToken[]>(() => {
    if (!scene || !mapData) return [];
    return characters
      .filter((c) => c.currentHP > 0)
      .map((c) => {
        const w = patchTileToWorldMeters(mapData, scene.anchor, c.position.x, c.position.y);
        const team: InPlaceToken['team'] =
          c.team === 'player' ? 'player' : c.team === 'enemy' ? 'enemy' : 'neutral';
        return {
          id: c.id,
          name: c.name,
          xM: w.xM,
          zM: w.zM,
          team,
          isActive: c.id === currentCharacterId,
        };
      });
  }, [scene, mapData, characters, currentCharacterId]);

  // Reachable disc under the active PLAYER token (enemies move on AI turns).
  const reachable = useMemo(() => {
    if (!scene || !mapData || !active || active.team !== 'player') return null;
    const w = patchTileToWorldMeters(mapData, scene.anchor, active.position.x, active.position.y);
    const mv = active.actionEconomy?.movement;
    const feet = mv ? mv.total - mv.used : 0;
    if (feet <= 0) return null;
    return { centerXM: w.xM, centerZM: w.zM, movementFeet: feet };
  }, [scene, mapData, active]);

  // A ground click → referee → commit or reject.
  const handleGroundPick = useCallback(
    (worldXM: number, worldZM: number) => {
      if (!scene || !mapData || !active || active.team !== 'player') return;
      const mv = active.actionEconomy?.movement;
      const feet = mv ? mv.total - mv.used : 0;
      const verdict = validateInSceneMove({
        patch: mapData,
        anchor: scene.anchor,
        startTile: { x: active.position.x, y: active.position.y },
        movementFeet: feet,
        worldXM,
        worldZM,
      });
      if (!verdict.legal || !verdict.tile) {
        onNotify?.(verdict.reason ?? 'illegal move');
        return;
      }
      // Cost the same feet the 2D board would deduct for this destination.
      onCommitMove({
        id: `fip-move-${Date.now()}`,
        characterId: active.id,
        type: 'move',
        targetPosition: { x: verdict.tile.x, y: verdict.tile.y },
        cost: { type: 'movement-only', movementCost: verdict.costFeet ?? 0 },
        timestamp: Date.now(),
      });
    },
    [scene, mapData, active, onCommitMove, onNotify],
  );

  // Dev hook (sibling to World3DScene's __wf3dClickNpc): drive an in-scene move
  // deterministically from a headless probe — an R3F ground-plane click can't be
  // pixel-simulated reliably. Feeds the SAME referee + commit path a real click
  // would, so verification proves click-to-move end to end.
  React.useEffect(() => {
    const w = window as unknown as {
      __fipMoveTo?: (worldXM: number, worldZM: number) => void;
      __fipAnchor?: { xM: number; zM: number } | null;
    };
    w.__fipMoveTo = (worldXM, worldZM) => handleGroundPick(worldXM, worldZM);
    w.__fipAnchor = scene ? { xM: scene.anchor.playerXM, zM: scene.anchor.playerZM } : null;
    return () => { delete w.__fipMoveTo; delete w.__fipAnchor; };
  }, [handleGroundPick, scene]);

  // Camera frame request — center on the active actor (or the anchor) on mount.
  const cameraFrameRequest = useMemo<CameraFrameRequest | null>(() => {
    if (!scene) return null;
    const focusXM = active
      ? patchTileToWorldMeters(mapData!, scene.anchor, active.position.x, active.position.y).xM
      : scene.anchor.playerXM;
    const focusZM = active
      ? patchTileToWorldMeters(mapData!, scene.anchor, active.position.x, active.position.y).zM
      : scene.anchor.playerZM;
    const s = worldToScene(focusXM, focusZM, scene.sceneOrigin);
    return { nonce: frameNonce, target: [s.x, scene.surfaceY, s.z], height: 45 };
    // Only frame once on mount — nonce is fixed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scene, frameNonce]);

  if (!scene || !mapData) {
    return (
      <div className="flex h-full w-full items-center justify-center text-gray-400 text-sm italic">
        In-place combat needs a live world handoff — use the 2D board toggle.
      </div>
    );
  }

  // World3DScene re-streams the SAME terrain via the handed-off ground loader
  // (a closure over the built world — see fightInPlaceHandoff), so the camera
  // stays on the town the player was walking.
  const start: readonly [number, number, number] = [
    scene.anchor.playerXM,
    scene.surfaceY,
    scene.anchor.playerZM,
  ];

  return (
    <div className="relative h-full w-full" data-testid="fip-in-place-scene">
      <World3DScene
        loader={scene.loader}
        start={start}
        startSurfaceY={scene.surfaceY}
        viewProfile="ground"
        groundWorld={scene.ground}
        cameraFrameRequest={cameraFrameRequest}
        combatLayer={
          <InPlaceCombatLayer
            ground={scene.ground}
            sceneOrigin={scene.sceneOrigin}
            tokens={tokens}
            reachable={reachable}
            patchDims={mapData.dimensions}
            anchorXM={scene.anchor.playerXM}
            anchorZM={scene.anchor.playerZM}
            onGroundPick={handleGroundPick}
          />
        }
      />
      <div className="pointer-events-none absolute left-2 top-2 rounded bg-black/50 px-2 py-1 text-xs text-sky-200">
        Fighting in place · click the ground to move
      </div>
    </div>
  );
};

export default InPlaceCombatScene;
