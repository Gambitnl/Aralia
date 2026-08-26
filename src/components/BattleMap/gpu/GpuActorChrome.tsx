/**
 * @file components/BattleMap/gpu/GpuActorChrome.tsx
 * The WebGL CharacterActor's chrome, rebuilt for the WebGPU battle scene.
 *
 * Task agora-a2b8. `BattleMap3DGpuScene` got real generated bodies earlier;
 * what stayed behind was the rig's CHROME — the nameplate, the HP pip, the
 * defeat and temporary-HP markers, and the defense/condition chips. This file
 * closes that gap, and it does so WITHOUT a second copy of the markup:
 *
 *   - the `<Html>` pieces (defeat marker, temp-HP badge, nameplate) are the
 *     SAME components the WebGL actor mounts, from
 *     `characters/characterActor/actorChromeHtml`. A drei `<Html>` is a DOM
 *     overlay positioned by projecting a world point, so it is backend-neutral
 *     — the scene header's old claim that drei helpers are WebGL-shader-bound
 *     is true of `<Sky>`, not of `<Html>`.
 *   - `DefenseBadgeRow` and `ConditionBadgeRow` are likewise mounted unchanged;
 *     both are pure `<Html>` with no material of their own.
 *   - ONLY the HP pip is rebuilt. Its WebGL twin is lit by
 *     `<meshStandardMaterial>`, and this scene carries no lights on purpose
 *     (the node-path `LightsNode` never sees R3F-added lights, three #30044),
 *     so a lit pip would draw BLACK. Here it is an unlit
 *     `MeshBasicNodeMaterial` pushed above the bloom threshold, which is what
 *     the WebGL pip's `emissive` + `emissiveIntensity` buys on that path.
 *
 * Geometries and materials are built imperatively and handed to `<mesh>` by
 * prop — the pattern the rest of this scene uses — so no node-material JSX
 * intrinsic has to be registered for this file.
 *
 * Dependencies: react, three/webgpu, three/tsl, types/combat,
 *               characters/characterActor/{actorChromeHtml,actorTheme,
 *               defenseBadges,conditionBadges}
 * Dependents: components/BattleMap/BattleMap3DGpuScene.tsx
 */

import React, { useEffect, useMemo } from 'react';
import * as THREE from 'three/webgpu';
import { vec3 } from 'three/tsl';
import type { CombatCharacter } from '../../../types/combat';
import type { ActorTeamColors } from '../characters/characterActor/actorTheme';
import {
  ActorDefeatedMarker,
  ActorNameplate,
  ActorTempHpBadge,
} from '../characters/characterActor/actorChromeHtml';
import { DefenseBadgeRow } from '../characters/characterActor/defenseBadges';
import { ConditionBadgeRow } from '../characters/characterActor/conditionBadges';

/**
 * How far the unlit pip is pushed past its plain color.
 *
 * The WebGL pip carries `color` AND `emissive` at `emissiveIntensity` 1, so a
 * lit render lands near twice the base color and clears the scene's bloom
 * threshold (0.85, see PostFx). An unlit node material has no second term, so
 * the same brightness is applied here as one multiply. Retune with the bloom
 * threshold, not independently.
 */
const PIP_GLOW = 1.6;

/** Unlit, self-bright material for one chrome piece. */
function chromeMaterial(color: THREE.Color, glow: number, opacity: number): THREE.MeshBasicNodeMaterial {
  const m = new THREE.MeshBasicNodeMaterial();
  m.colorNode = vec3(color.r * glow, color.g * glow, color.b * glow);
  m.transparent = true;
  m.opacity = opacity;
  m.side = THREE.DoubleSide;
  return m;
}

export interface GpuActorChromeProps {
  character: CombatCharacter;
  teamColors: ActorTeamColors;
  /** World-space Y of the pip stack — above the generated body's real head. */
  pipY: number;
  isAlive: boolean;
  isSelected: boolean;
  isTurn: boolean;
  hovered: boolean;
  /** 0..1 current/max HP. */
  hpPercent: number;
  hpColor: string;
  /** Feet to the active player character while hovered, or null. */
  distanceToActive: number | null;
}

/**
 * The full chrome stack for one WebGPU actor, in the WebGL actor's order:
 * defense chips, condition chips, HP pip, defeat marker, temp HP, nameplate.
 * Scene order is draw order for these transparent layers, so it is behavior.
 */
export const GpuActorChrome: React.FC<GpuActorChromeProps> = ({
  character,
  teamColors,
  pipY,
  isAlive,
  isSelected,
  isTurn,
  hovered,
  hpPercent,
  hpColor,
  distanceToActive,
}) => {
  const pipGeometry = useMemo(() => new THREE.SphereGeometry(0.14, 10, 8), []);
  const ringGeometry = useMemo(() => {
    const g = new THREE.RingGeometry(0.16, 0.29, 20);
    g.rotateX(-Math.PI / 2);
    return g;
  }, []);

  // Rebuilt only when the color band changes (three values), not per HP point.
  const pipMaterial = useMemo(
    () => chromeMaterial(new THREE.Color(hpColor), PIP_GLOW, 0.95),
    [hpColor],
  );
  const ringMaterial = useMemo(() => {
    const m = chromeMaterial(new THREE.Color(teamColors.selection), PIP_GLOW, 0.95);
    m.depthWrite = false;
    return m;
  }, [teamColors.selection]);

  useEffect(
    () => () => {
      pipGeometry.dispose();
      ringGeometry.dispose();
      pipMaterial.dispose();
      ringMaterial.dispose();
    },
    [pipGeometry, ringGeometry, pipMaterial, ringMaterial],
  );

  return (
    <>
      {/* Resistance / vulnerability / immunity strip — same facts as the 2D token. */}
      <DefenseBadgeRow character={character} />
      {/* Active condition chips (GOAL #19), below the HP pip. */}
      <ConditionBadgeRow character={character} />

      {/* Always-visible HP pip: health-colored sphere over a team ring. */}
      <group position={[0, pipY, 0]}>
        <mesh geometry={pipGeometry} material={pipMaterial} />
        <mesh geometry={ringGeometry} material={ringMaterial} position={[0, -0.03, 0]} />
      </group>

      {!isAlive && <ActorDefeatedMarker character={character} pipY={pipY} />}
      {(character.tempHP ?? 0) > 0 && <ActorTempHpBadge character={character} pipY={pipY} />}
      {(isSelected || isTurn || hovered) && (
        <ActorNameplate
          character={character}
          teamColors={teamColors}
          pipY={pipY}
          hpPercent={hpPercent}
          hpColor={hpColor}
          distanceToActive={distanceToActive}
        />
      )}
    </>
  );
};

export default GpuActorChrome;
