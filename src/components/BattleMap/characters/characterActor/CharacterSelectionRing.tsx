// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 09/09/2026, 10:10:49
 * Dependents: components/BattleMap/characters/characterActor/CharacterActor.tsx
 * Imports: 2 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * @file characters/characterActor/CharacterSelectionRing.tsx
 * Ground-level selection, facing, active-turn, and targeting indicators for a
 * 3D combat-map actor.
 *
 * Extracted from CharacterActor.tsx (task agora-b70d). Two exports rather than
 * one because the pieces are NOT contiguous in the actor's scene graph: the
 * ground ring cluster renders before the badges and the body, while the red
 * target reticle renders after the body. Scene-graph order is render order for
 * transparent decals, so the split preserves the positions instead of
 * gathering them for tidiness.
 *
 * Dependencies: react, three, ./models (SelectionDecal, TurnIndicator),
 *               ./actorTheme
 * Dependents: characterActor/CharacterActor.tsx
 */

import React from 'react';
import * as THREE from 'three';
import { SelectionDecal, TurnIndicator } from './models';
import type { ActorTeamColors } from './actorTheme';

export interface CharacterSelectionRingProps {
  teamColors: ActorTeamColors;
  /** Player actors get a dimmer ground glow than enemies. */
  isPlayer: boolean;
  /** Dead actors lose the facing wedge — a corpse has no facing. */
  isAlive: boolean;
  isSelected: boolean;
  isTurn: boolean;
  /** Targetable AND in targeting mode: the ring goes red and pulses. */
  showTargetHighlight: boolean;
  /** Y rotation the body faces, in radians. */
  facingRotation: number;
}

export const CharacterSelectionRing: React.FC<CharacterSelectionRingProps> = ({
  teamColors,
  isPlayer,
  isAlive,
  isSelected,
  isTurn,
  showTargetHighlight,
  facingRotation,
}) => (
  <>
    {/* Selection decal — always-on BG3 style ground ring for team identity */}
    <SelectionDecal
      color={showTargetHighlight ? 0xff4444 : teamColors.selection}
      visible={isSelected || isTurn || showTargetHighlight}
      pulse={showTargetHighlight || isTurn}
      baseOpacity={isSelected || isTurn ? 0.90 : 0.50}
    />

    {/* Facing wedge — small ground pointer on the team ring showing which way
        the unit faces (GOAL #9); rotates with the model's facing. */}
    {isAlive && (
      <group rotation={[0, facingRotation, 0]}>
        <mesh position={[0, 0.03, 0.60]} rotation={[-Math.PI / 2, 0, 0]}>
          {/* thetaStart -π/2 puts the triangle's point outward (+Z = forward) */}
          <circleGeometry args={[0.19, 3, -Math.PI / 2]} />
          <meshStandardMaterial
            color={teamColors.selection}
            emissive={teamColors.selection}
            emissiveIntensity={1.5}
            transparent
            opacity={0.9}
            side={THREE.DoubleSide}
            depthWrite={false}
          />
        </mesh>
      </group>
    )}

    {/* Active turn golden ring */}
    <TurnIndicator active={isTurn} />

    {/* Team-colored ground glow — most readable team indicator at tactical distance */}
    <pointLight
      color={teamColors.groundGlow}
      intensity={isPlayer ? 0.7 : 1.0}
      distance={3.2}
      position={[0, 0.05, 0]}
    />
  </>
);

/**
 * Target reticle glow shown while this actor is a legal target.
 *
 * Rendered AFTER the body in the actor's scene graph — see the file header.
 */
export const CharacterTargetReticle: React.FC = () => (
  <pointLight
    color={0xef4444}
    intensity={0.5}
    distance={2}
    position={[0, 0.5, 0]}
  />
);
