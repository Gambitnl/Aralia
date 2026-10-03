// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 09/09/2026, 10:11:57
 * Dependents: components/BattleMap/characters/characterActor/CharacterActor.tsx
 * Imports: 3 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * @file characters/characterActor/CharacterStatusBadges.tsx
 * Above-the-head readouts for a 3D combat-map actor: the always-visible HP pip,
 * the defeat marker, the temporary-HP badge, and the hover/selection nameplate.
 *
 * Extracted from CharacterActor.tsx (task agora-b70d). These four render
 * consecutively at the top of the actor's scene graph, so they move together
 * without changing draw order. Defense and condition chips are NOT here — they
 * already had their own modules (`./defenseBadges`, `./conditionBadges`) and
 * render lower down, below the pip.
 *
 * WEBGL-ONLY PART (task agora-a2b8, 2026-09-21): only the HP pip below is
 * WebGL-bound — it is lit by `<meshStandardMaterial>`, which renders BLACK in
 * the lightless WebGPU scene. The other three moved to `./actorChromeHtml` as
 * pure `<Html>` overlays and are mounted from here AND from the WebGPU scene's
 * `gpu/GpuActorChrome`, so the two paths cannot drift apart.
 *
 * Dependencies: react, three, types/combat, ./actorTheme, ./actorChromeHtml
 * Dependents: characterActor/CharacterActor.tsx
 */

import React from 'react';
import * as THREE from 'three';
import type { CombatCharacter } from '../../../../types/combat';
import type { ActorTeamColors } from './actorTheme';
import { ActorDefeatedMarker, ActorNameplate, ActorTempHpBadge } from './actorChromeHtml';

export interface CharacterStatusBadgesProps {
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

export const CharacterStatusBadges: React.FC<CharacterStatusBadgesProps> = ({
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
}) => (
  <>
    {/* Always-visible HP pip — sphere + team ring, riding above the real head.
        The one lit piece of the chrome, hence the one piece the WebGPU scene
        rebuilds instead of reusing. */}
    <group position={[0, pipY, 0]}>
      {/* HP color sphere — glows team-appropriate health color (sized down
          for the generated bodies; readability still carried by the glow) */}
      <mesh>
        <sphereGeometry args={[0.14, 10, 8]} />
        <meshStandardMaterial
          color={hpColor}
          emissive={hpColor}
          emissiveIntensity={1.0}
          transparent
          opacity={0.95}
        />
      </mesh>
      {/* Team ring — larger for visibility at 20+ unit distance */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.03, 0]}>
        <ringGeometry args={[0.16, 0.29, 20]} />
        <meshStandardMaterial
          color={teamColors.selection}
          emissive={teamColors.selection}
          emissiveIntensity={1.2}
          transparent
          opacity={0.95}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>
    </group>

    {/* G10 defeat marker. */}
    {!isAlive && <ActorDefeatedMarker character={character} pipY={pipY} />}

    {/* Temporary HP, beside the pip. */}
    {(character.tempHP ?? 0) > 0 && <ActorTempHpBadge character={character} pipY={pipY} />}

    {/* Detailed nameplate on hover, selection, or active turn. */}
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
