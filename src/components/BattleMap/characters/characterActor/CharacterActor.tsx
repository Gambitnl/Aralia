// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 09/09/2026, 10:01:40
 * Dependents: components/BattleMap/characters/CharacterActor.tsx
 * Imports: 17 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * @file characters/characterActor/CharacterActor.tsx
 * The CharacterActor component — CONTAINER: state, hooks, and scene-graph
 * mounting for one 3D combat-map actor.
 *
 * SPLIT (task agora-b70d, 2026-09-09): the rendering body moved into three
 * sibling components; this file keeps the derived state and the mount order.
 *
 * - `./CharacterBody`           the scaled, facing-rotated EntityModel group
 * - `./CharacterSelectionRing`  ground ring, facing wedge, turn ring, glows
 * - `./CharacterStatusBadges`   HP pip, defeat marker, temp-HP, nameplate
 * - `./actorTheme`              TEAM_COLORS + scale/tile constants (leaf)
 *
 * Pre-existing siblings that were already split and are unchanged:
 * `./defenseBadges`, `./conditionBadges`, `./models`, `./EntityModel`.
 *
 * Child order in the returned <group> is the pre-split order exactly. Scene
 * order is draw order for the transparent ground decals and the Html layers,
 * so it is behavior, not formatting — which is why the target reticle is still
 * mounted after the body rather than folded into the ring cluster.
 */
import React, { useMemo, useRef, useState, useEffect } from 'react';
import { useFrame, ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
import { CombatCharacter } from '../../../../types/combat';
import { getDistance } from '../../../../utils/combat/combatUtils';
import { DefenseBadgeRow } from './defenseBadges';
import { ConditionBadgeRow } from './conditionBadges';
import { type AnimationState } from './models';
// G9/G10 (agora-8aa9): silhouette rim + defeat/status body tint. Both ride on
// one shader patch applied to `modelGroupRef` — the ref already existed for
// exactly this and had no consumer until now.
import { useFresnelRim } from '../useFresnelRim';
import { resolveActorBodyShading } from '../actorStatusShading';
import { registerAllParts } from '@/systems/entities3d/parts';
import { generateEntityBlueprint } from '@/systems/entities3d/generateEntityBlueprint';
import { recipeFromCombatant } from '@/systems/entities3d/recipeFromCombatant';
import { heightM } from '@/systems/entities3d/types';
import { resolveControlPose } from '../../controlOptionPose';
import { elevationUnitsToFeet } from '../../elevationPresentation';
import { ELEVATION_SCALE, MODEL_SCALE, TEAM_COLORS, TILE_SIZE } from './actorTheme';
import { CharacterBody } from './CharacterBody';
import { CharacterSelectionRing, CharacterTargetReticle } from './CharacterSelectionRing';
import { CharacterStatusBadges } from './CharacterStatusBadges';

registerAllParts();

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CharacterActorProps {
  character: CombatCharacter;
  allCharacters: CombatCharacter[];
  tileElevation: number;
  /** Sampled terrain surface height at the actor's tile center — the same
   * formula the terrain mesh is built from. Falls back to tile elevation. */
  groundY?: number;
  isSelected: boolean;
  isTurn: boolean;
  isTargetable: boolean;
  targetingMode: boolean;
  onClick: (character: CombatCharacter) => void;
  activeCharacterId?: string | null;
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

const CharacterActor: React.FC<CharacterActorProps> = ({
  character,
  allCharacters,
  tileElevation,
  groundY,
  isSelected,
  isTurn,
  isTargetable,
  targetingMode,
  onClick,
  activeCharacterId
}) => {
  const groupRef = useRef<THREE.Group>(null);
  const modelGroupRef = useRef<THREE.Group>(null);
  const [animState, setAnimState] = useState<AnimationState>('idle');
  const [hovered, setHovered] = useState(false);
  const animTimeRef = useRef(0);
  const prevHPRef = useRef(character.currentHP);

  const { x, y } = character.position;
  const isPlayer = character.team === 'player';
  const isAlive = character.currentHP > 0;
  const teamKey = isPlayer ? 'player' : character.team === 'enemy' ? 'enemy' : 'neutral';
  const teamColors = TEAM_COLORS[teamKey];
  // The generated body: race/class for PCs and humanoid monsters, creature
  // type × size for the rest. Size lives in the blueprint's frame, so no
  // separate size-category scale — a Huge dragon's frame IS huge.
  const blueprint = useMemo(
    () => generateEntityBlueprint(recipeFromCombatant(character)),
    // identity fields only — HP/position changes must not rebuild the body
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [character.id, character.name, character.class?.id, character.creatureTypes, character.stats?.size],
  );
  /** Body height in map units — pips and nameplates ride above the real head. */
  const heightUnits = heightM(blueprint.frame) * MODEL_SCALE;
  const pipY = Math.max(1.85, heightUnits + 0.45);
  // G7 shared pose contract — the SAME resolver the 2D token uses. Cached per
  // statusEffects array; null = base look; expiry restores via easeActorPose.
  const controlPose = resolveControlPose(character.statusEffects);

  // G9 (silhouette pop) + G10 (defeat/status readability). One pure lookup
  // drives one shader patch; see characters/actorStatusShading.ts for the
  // palette and characters/useFresnelRim.ts for the injection. Recomputed only
  // when life state or status names change — the hook writes uniforms, so this
  // never triggers a shader recompile.
  const bodyShading = useMemo(
    () => resolveActorBodyShading(character),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [character.currentHP, character.conditions, character.statusEffects],
  );
  useFresnelRim(modelGroupRef, [blueprint], bodyShading);

  const activeCharacter = useMemo(() => {
    if (!activeCharacterId) return undefined;
    return allCharacters.find(c => c.id === activeCharacterId);
  }, [allCharacters, activeCharacterId]);

  const distanceToActive = useMemo(() => {
    if (
      hovered &&
      activeCharacter &&
      activeCharacter.team === 'player' &&
      character.team === 'enemy' &&
      activeCharacter.id !== character.id
    ) {
      return getDistance(character.position, activeCharacter.position) * 5; // 5 ft per tile
    }
    return null;
  }, [activeCharacter, character.position, character.team, character.id, hovered]);

  // Compute facing direction — face toward nearest enemy (or seeded random fallback)
  const facingRotation = useMemo(() => {
    const enemies = allCharacters.filter(c =>
      c.team !== character.team && c.currentHP > 0
    );
    if (enemies.length === 0) {
      // Seeded pseudo-random from character ID
      let hash = 0;
      for (let i = 0; i < character.id.length; i++) {
        hash = ((hash << 5) - hash) + character.id.charCodeAt(i);
        hash |= 0;
      }
      return (Math.abs(hash) % 628) / 100; // 0 to ~6.28 (2π)
    }
    // Find nearest enemy
    let nearest = enemies[0];
    let minDist = Infinity;
    for (const e of enemies) {
      const dx = e.position.x - x;
      const dy = e.position.y - y;
      const dist = dx * dx + dy * dy;
      if (dist < minDist) { minDist = dist; nearest = e; }
    }
    // atan2 to face nearest enemy — R3F Z+ is "forward"
    const dx = nearest.position.x - x;
    const dy = nearest.position.y - y;
    return Math.atan2(dx, dy);
  }, [character.id, character.team, x, y, allCharacters]);

  // Detect HP changes to trigger hit_react animation
  useEffect(() => {
    if (character.currentHP < prevHPRef.current && character.currentHP > 0) {
      setAnimState('hit_react');
      animTimeRef.current = 0;
    } else if (character.currentHP <= 0) {
      setAnimState('death');
      animTimeRef.current = 0;
    }
    prevHPRef.current = character.currentHP;
  }, [character.currentHP]);

  // Animation tick
  useFrame((_, delta) => {
    animTimeRef.current += delta;

    // Auto-return to idle after timed animations
    if (animState === 'hit_react' && animTimeRef.current > 0.5) {
      setAnimState('idle');
      animTimeRef.current = 0;
    }
    if (animState === 'attack_melee' && animTimeRef.current > 0.8) {
      setAnimState('idle');
      animTimeRef.current = 0;
    }
    if (animState === 'cast_spell' && animTimeRef.current > 1.0) {
      setAnimState('idle');
      animTimeRef.current = 0;
    }
  });

  // Target highlight color
  const showTargetHighlight = isTargetable && targetingMode;

  // Ground height still comes from the rendered terrain surface. A flying
  // creature then rises by only the clearance between its absolute altitude
  // and this tile's ground height. This keeps a 20-foot flyer ten feet above a
  // ten-foot ridge instead of adding the full altitude twice.
  const groundElevation = groundY ?? tileElevation * ELEVATION_SCALE;
  const groundAltitudeFeet = Math.round(elevationUnitsToFeet(tileElevation));
  const aerialClearanceWorld = character.aerialMovement?.isFlying
    ? Math.max(0, character.aerialMovement.altitudeFeet - groundAltitudeFeet) * 0.3048
    : 0;
  const elevation = groundElevation + aerialClearanceWorld;

  // HP percentage for health bar
  const hpPercent = Math.max(0, character.currentHP / character.maxHP);
  const hpColor = hpPercent > 0.5 ? '#22c55e' : hpPercent > 0.25 ? '#eab308' : '#ef4444';

  return (
    <group
      ref={groupRef}
      position={[
        x * TILE_SIZE + TILE_SIZE / 2,
        elevation,
        y * TILE_SIZE + TILE_SIZE / 2,
      ]}
      onClick={(e: ThreeEvent<MouseEvent>) => {
        e.stopPropagation();
        onClick(character);
      }}
      onPointerEnter={(e: ThreeEvent<PointerEvent>) => {
        e.stopPropagation();
        setHovered(true);
      }}
      onPointerLeave={() => setHovered(false)}
    >
      {/* Ground ring, facing wedge, turn ring, team glow */}
      <CharacterSelectionRing
        teamColors={teamColors}
        isPlayer={isPlayer}
        isAlive={isAlive}
        isSelected={isSelected}
        isTurn={isTurn}
        showTargetHighlight={showTargetHighlight}
        facingRotation={facingRotation}
      />

      {/* Defense badges stay on the actor itself so the 3D map exposes the
          same resistance / vulnerability / immunity facts as the 2D token. */}
      <DefenseBadgeRow character={character} />

      {/* Active condition chips (GOAL #19) — the buff/debuff half of the
          status story, below the HP pip. */}
      <ConditionBadgeRow character={character} />

      {/* Character body. The ref is forwarded so useFresnelRim above can patch
          this exact group's materials. */}
      <CharacterBody
        ref={modelGroupRef}
        blueprint={blueprint}
        animState={isAlive ? animState : 'death'}
        animTimeRef={animTimeRef}
        controlPose={controlPose}
        facingRotation={facingRotation}
      />

      {/* Target reticle glow when targetable */}
      {showTargetHighlight && <CharacterTargetReticle />}

      {/* HP pip, defeat marker, temporary HP, and the hover nameplate */}
      <CharacterStatusBadges
        character={character}
        teamColors={teamColors}
        pipY={pipY}
        isAlive={isAlive}
        isSelected={isSelected}
        isTurn={isTurn}
        hovered={hovered}
        hpPercent={hpPercent}
        hpColor={hpColor}
        distanceToActive={distanceToActive}
      />
    </group>
  );
};

export default CharacterActor;
