// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 09/09/2026, 10:09:35
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
 * @file characters/characterActor/CharacterBody.tsx
 * The actor's generated 3D body: the scaled, facing-rotated group that hosts
 * the procedural EntityModel.
 *
 * Extracted from CharacterActor.tsx (task agora-b70d). The group's ref is
 * FORWARDED rather than owned here: `useFresnelRim` (G9 silhouette rim, G10
 * defeat/status tint) patches the shader through that exact ref from the
 * container, and moving the hook down here would split one shader patch across
 * two files. The ref stays the seam.
 *
 * Dependencies: react, three, ./EntityModel, ./models (AnimationState),
 *               ./actorTheme
 * Dependents: characterActor/CharacterActor.tsx
 */

import React from 'react';
import * as THREE from 'three';
import { EntityModel } from './EntityModel';
import type { AnimationState } from './models';
import { MODEL_SCALE } from './actorTheme';

export interface CharacterBodyProps {
  /** Generated entity blueprint — race/class for PCs, creature type × size otherwise. */
  blueprint: Parameters<typeof EntityModel>[0]['blueprint'];
  animState: AnimationState;
  animTimeRef: React.MutableRefObject<number>;
  controlPose: Parameters<typeof EntityModel>[0]['controlPose'];
  /** Y rotation the body faces, in radians. */
  facingRotation: number;
}

/**
 * A generated entity at true world proportions (Remy 2026-07-01: "characters
 * shouldn't be almost as big as a tree"). At 1 tile = 5 ft, MODEL_SCALE puts a
 * human at ~1.4 units ≈ 7 ft; size categories are already in the blueprint's
 * frame, so a Huge dragon towers without a separate multiplier. Readability is
 * carried by the team rings, ink outlines, and indicators.
 */
export const CharacterBody = React.forwardRef<THREE.Group, CharacterBodyProps>(
  ({ blueprint, animState, animTimeRef, controlPose, facingRotation }, ref) => (
    <group ref={ref} scale={MODEL_SCALE} rotation={[0, facingRotation, 0]}>
      <EntityModel
        blueprint={blueprint}
        animState={animState}
        animTimeRef={animTimeRef}
        controlPose={controlPose}
      />
    </group>
  )
);

CharacterBody.displayName = 'CharacterBody';
