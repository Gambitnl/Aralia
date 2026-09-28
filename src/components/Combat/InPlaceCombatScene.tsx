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
 * ability system and passes the live characters + an action-committing callback
 * in. We translate patch-tile positions ↔ world meters through the invisible
 * referee (`inSceneMovement`), so an in-scene click is ruled by the SAME lattice
 * the 2D board uses.
 *
 * Slice 3 (agora-1224) closes the old cut line: ABILITIES AND ATTACKS ARE NOW
 * TARGETED IN-SCENE. The same ground-pick plane serves both modes — with no
 * ability armed a click is a move, and with one armed a click picks the creature
 * standing on the clicked tile. Nothing about the rules is re-implemented here:
 * the palette is gated by `useCombatValidation` (the prerequisite referee the
 * executor itself runs), target legality comes from `useTargetValidator` (the
 * same range / line-of-sight / target-type referee the 2D board asks), and the
 * committed action is built by `buildAbilityCombatAction` — the 2D board's own
 * constructor — then handed to the turn manager unchanged.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import World3DScene from '../World3D/World3DScene';
import InPlaceCombatLayer, { type InPlaceToken } from '../World3D/combat/InPlaceCombatLayer';
import type { CameraFrameRequest } from '../World3D/FreeRoamCameraController';
import type { Ability, CombatCharacter, BattleMapData, CombatAction, Position } from '../../types/combat';
import type { GroundWorld } from '../../systems/worldforge/bridge/groundChunkLoader';
import type { ChunkLoader } from '../../systems/world3d/types';
import { getFightInPlaceHandoff } from '../../systems/combat/fightInPlace/fightInPlaceHandoff';
import {
  patchTileToWorldMeters,
  validateInSceneMove,
  worldMetersToPatchTile,
  type PatchAnchor,
  type PatchTile,
} from '../../systems/combat/fightInPlace/inSceneMovement';
import { worldToScene } from '../../systems/world3d/sceneOrigin';
import { getOccupiedTiles } from '../../utils/combat';
import { canAffordActionCost } from '../../utils/combat/actionEconomyUtils';
import { buildAbilityCombatAction } from '../../hooks/actionUtils';
import { useCombatValidation } from '../../hooks/combat/useCombatValidation';
import { useTargetValidator } from '../../hooks/combat/useTargetValidator';

export interface InPlaceCombatSceneProps {
  /** The live combat roster (CombatView's `characters` state). */
  characters: CombatCharacter[];
  /** The extracted referee patch (CombatView's `mapData`). */
  mapData: BattleMapData | null;
  /** The current actor's id (turnManager.turnState.currentCharacterId). */
  currentCharacterId: string | null;
  /**
   * Commit a validated action for the active actor.
   *
   * CombatView passes `turnManager.executeAction`, so this is the general
   * action channel, not a movement-only one: in-scene moves AND in-scene
   * ability/attack executions both leave through it and are resolved by the
   * same executor the 2D board uses.
   */
  onCommitMove: (action: CombatAction) => void;
  /** Show an on-screen note when a click is rejected (out of range / blocked). */
  onNotify?: (message: string) => void;
}

// ============================================================================
// In-Scene Targeting Referee Helpers
// ============================================================================
// These are pure so the world-position → tile → creature → action pipeline is
// unit-testable without R3F. They deliberately hold no RULES of their own:
// legality is answered by useTargetValidator and useCombatValidation, and the
// action is built by the shared constructor the 2D board uses.
// ============================================================================

/** Targeting kinds an in-scene ground click can express. */
const IN_SCENE_TARGETING_KINDS: ReadonlySet<Ability['targeting']> = new Set([
  'single_enemy',
  'single_ally',
  'single_any',
  'self',
  'area',
]);

/**
 * The actor's abilities that a ground click could aim this turn: a targeting
 * kind a single click can express, and a cost the actor can still pay.
 *
 * Per-ability availability (cooldown, depleted uses, conditions, prerequisites)
 * is NOT decided here — `useCombatValidation.checkAbilityUsable` owns those
 * rules for every surface, and the component asks it for each entry.
 */
export function listInSceneAimableAbilities(actor: CombatCharacter): Ability[] {
  return (actor.abilities ?? []).filter(ability => (
    IN_SCENE_TARGETING_KINDS.has(ability.targeting)
    && canAffordActionCost(actor, ability.cost)
  ));
}

/** What a ground click resolved to while an ability is armed. */
export interface InSceneTargetPick {
  /** The patch tile the click landed on. */
  tile: PatchTile;
  /** The combatant occupying that tile, or null for bare ground. */
  target: CombatCharacter | null;
}

/**
 * Resolve a world-meters click into a patch tile and the creature standing on
 * it. Returns null when the click fell outside the extracted patch, which is
 * the one case no ability can be aimed at.
 */
export function resolveInSceneTargetPick(
  patch: BattleMapData,
  anchor: PatchAnchor,
  characters: CombatCharacter[],
  worldXM: number,
  worldZM: number,
): InSceneTargetPick | null {
  const tile = worldMetersToPatchTile(patch, anchor, worldXM, worldZM);
  if (!tile) return null;

  // Large creatures cover several squares, so the click must be matched against
  // the full footprint rather than the anchor square alone.
  const target = characters.find(character => (
    character.currentHP > 0
    && getOccupiedTiles(character).some(occupied => occupied.x === tile.x && occupied.y === tile.y)
  )) ?? null;

  return { tile, target };
}

/**
 * The world-meters radius ring to draw while an ability is armed. Ability
 * ranges are stored in tiles, and the layer's disc is sized in feet, so the
 * ring shows the ability's reach in the same units the referee measures.
 */
export function getArmedAbilityRangeFeet(ability: Ability): number {
  return Math.max(0, ability.range) * 5;
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
  // The ability a ground click will aim. null = a click is a move.
  const [armedAbilityId, setArmedAbilityId] = useState<string | null>(null);

  const active = characters.find((c) => c.id === currentCharacterId) ?? null;

  // The two shared referees. Both take exactly the roster and patch this scene
  // already holds, so the in-scene surface asks the SAME questions the 2D board
  // asks rather than carrying a second copy of the rules.
  const { checkAbilityUsable } = useCombatValidation(characters, mapData);
  const { getTargetValidation } = useTargetValidator({ characters, mapData });

  // The palette: aimable, affordable, and passing the prerequisite referee.
  const aimableAbilities = useMemo<Ability[]>(() => {
    if (!active || active.team !== 'player') return [];
    return listInSceneAimableAbilities(active)
      .filter(ability => checkAbilityUsable(active, ability).usable);
  }, [active, checkAbilityUsable]);

  const armedAbility = useMemo<Ability | null>(
    () => aimableAbilities.find(ability => ability.id === armedAbilityId) ?? null,
    [aimableAbilities, armedAbilityId],
  );

  // Disarm whenever the armed ability stops being a legal choice — a new turn,
  // a spent action, or a depleted use. Leaving it armed would let the next
  // ground click silently aim something the actor can no longer do.
  useEffect(() => {
    if (armedAbilityId && !armedAbility) setArmedAbilityId(null);
  }, [armedAbilityId, armedAbility]);

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

  // The disc under the active PLAYER token. With an ability armed it shows that
  // ability's reach; otherwise it shows the movement still left this turn.
  const reachable = useMemo(() => {
    if (!scene || !mapData || !active || active.team !== 'player') return null;
    const w = patchTileToWorldMeters(mapData, scene.anchor, active.position.x, active.position.y);
    if (armedAbility) {
      const rangeFeet = getArmedAbilityRangeFeet(armedAbility);
      if (rangeFeet <= 0) return null;
      return { centerXM: w.xM, centerZM: w.zM, movementFeet: rangeFeet };
    }
    const mv = active.actionEconomy?.movement;
    const feet = mv ? mv.total - mv.used : 0;
    if (feet <= 0) return null;
    return { centerXM: w.xM, centerZM: w.zM, movementFeet: feet };
  }, [scene, mapData, active, armedAbility]);

  // A ground click with an ability armed → target referee → commit or reject.
  const handleGroundTarget = useCallback(
    (ability: Ability, worldXM: number, worldZM: number) => {
      if (!scene || !mapData || !active) return;

      const pick = resolveInSceneTargetPick(mapData, scene.anchor, characters, worldXM, worldZM);
      if (!pick) {
        onNotify?.('clicked outside the combat area (off-map)');
        return;
      }

      const targetPosition: Position = { x: pick.tile.x, y: pick.tile.y };
      const verdict = getTargetValidation(ability, active, targetPosition);
      if (!verdict.isValid) {
        onNotify?.(verdict.reason ?? `${ability.name} cannot be aimed there.`);
        return;
      }

      // The 2D board's own constructor. Creature ids come from the clicked
      // token; a ground-point ability (an area template, a point teleport)
      // commits with the position alone, exactly as the board does.
      onCommitMove(buildAbilityCombatAction(
        ability,
        active,
        targetPosition,
        pick.target ? [pick.target.id] : [],
      ));
      setArmedAbilityId(null);
    },
    [scene, mapData, active, characters, getTargetValidation, onCommitMove, onNotify],
  );

  // A ground click with nothing armed → movement referee → commit or reject.
  const handleGroundMove = useCallback(
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

  // The single ground-pick entry point. The armed ability decides which referee
  // rules the click, so one plane serves movement and targeting alike.
  const handleGroundPick = useCallback(
    (worldXM: number, worldZM: number) => {
      if (!active || active.team !== 'player') return;
      if (armedAbility) {
        handleGroundTarget(armedAbility, worldXM, worldZM);
        return;
      }
      handleGroundMove(worldXM, worldZM);
    },
    [active, armedAbility, handleGroundTarget, handleGroundMove],
  );

  // Dev hook (sibling to World3DScene's __wf3dClickNpc): drive an in-scene move
  // or an in-scene ability deterministically from a headless probe — an R3F
  // ground-plane click can't be pixel-simulated reliably. Every entry feeds the
  // SAME referee + commit path a real click would, so verification proves both
  // click-to-move and click-to-target end to end.
  useEffect(() => {
    const w = window as unknown as {
      __fipMoveTo?: (worldXM: number, worldZM: number) => void;
      __fipAnchor?: { xM: number; zM: number } | null;
      __fipAbilities?: () => Array<{ id: string; name: string; range: number; targeting: string }>;
      __fipArmAbility?: (abilityId: string) => boolean;
      __fipArmedAbilityId?: () => string | null;
      __fipCancelAbility?: () => void;
    };
    w.__fipMoveTo = (worldXM, worldZM) => handleGroundPick(worldXM, worldZM);
    w.__fipAnchor = scene ? { xM: scene.anchor.playerXM, zM: scene.anchor.playerZM } : null;
    w.__fipAbilities = () => aimableAbilities.map(ability => ({
      id: ability.id,
      name: ability.name,
      range: ability.range,
      targeting: ability.targeting,
    }));
    w.__fipArmAbility = (abilityId) => {
      const found = aimableAbilities.some(ability => ability.id === abilityId);
      if (found) setArmedAbilityId(abilityId);
      return found;
    };
    w.__fipArmedAbilityId = () => armedAbilityId;
    w.__fipCancelAbility = () => setArmedAbilityId(null);
    return () => {
      delete w.__fipMoveTo;
      delete w.__fipAnchor;
      delete w.__fipAbilities;
      delete w.__fipArmAbility;
      delete w.__fipArmedAbilityId;
      delete w.__fipCancelAbility;
    };
  }, [handleGroundPick, scene, aimableAbilities, armedAbilityId]);

  // Escape disarms, matching every other targeting surface in the game.
  useEffect(() => {
    if (!armedAbilityId) return undefined;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setArmedAbilityId(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [armedAbilityId]);

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
        {armedAbility
          ? `Aiming ${armedAbility.name} · click a target · Esc to cancel`
          : 'Fighting in place · click the ground to move'}
      </div>
      {aimableAbilities.length > 0 && (
        <div
          className="absolute bottom-2 left-1/2 flex max-w-full -translate-x-1/2 flex-wrap items-center justify-center gap-1 rounded bg-black/60 px-2 py-1"
          data-testid="fip-ability-bar"
        >
          {aimableAbilities.map(ability => (
            <button
              key={ability.id}
              type="button"
              data-testid={`fip-ability-${ability.id}`}
              aria-pressed={ability.id === armedAbilityId}
              onClick={() => setArmedAbilityId(
                ability.id === armedAbilityId ? null : ability.id,
              )}
              className={`rounded px-2 py-1 text-xs transition-colors ${
                ability.id === armedAbilityId
                  ? 'bg-amber-500 text-black'
                  : 'bg-gray-800/80 text-gray-200 hover:bg-gray-700'
              }`}
              title={`${ability.name} · range ${getArmedAbilityRangeFeet(ability)} ft`}
            >
              {ability.name}
            </button>
          ))}
          {armedAbility && (
            <button
              type="button"
              data-testid="fip-ability-cancel"
              onClick={() => setArmedAbilityId(null)}
              className="rounded bg-gray-700/80 px-2 py-1 text-xs text-gray-200 hover:bg-gray-600"
            >
              Cancel
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default InPlaceCombatScene;
