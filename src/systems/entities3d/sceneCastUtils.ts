// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 30/08/2026, 21:43:15
 * Dependents: components/World3D/SceneCast.tsx, components/World3D/sceneCastUtils.ts
 * Imports: 1 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * @file sceneCastUtils.ts — UI-neutral scene-cast rules for generated entities.
 *
 * This file describes a staged scene member, chooses the entity recipe used to
 * render that member, decides whether the figure can be selected, and arranges
 * the cast into a conversational cluster. The rules live with the entity engine
 * so engine tests and future renderers can use them without importing a React or
 * World3D component. World3D consumes this contract and remains the visual owner.
 */

import type { EntityRecipe } from './types';

// ============================================================================
// Scene-cast contract
// ============================================================================
// A cast member contains only identity and entity-generation facts. Keeping UI
// callbacks and React details out of this shape preserves the engine boundary.
// ============================================================================

export interface SceneCastMember {
  id: string;
  name: string;
  /** The player's own figure, which stands at the near edge of the cluster. */
  isPlayer?: boolean;
  /** The stranger who speaks first; renderers may highlight this member. */
  isSpeaker?: boolean;
  /** Real generated-entity identity when the game already knows it. */
  recipe?: EntityRecipe;
}

// ============================================================================
// Selection and recipe rules
// ============================================================================
// These decisions are shared by renderers and tests: NPC figures may be selected
// when a caller handles selection, and an unspecified person gets one stable,
// unarmed commoner recipe rather than a renderer-specific fallback.
// ============================================================================

/** Whether this figure should accept a click-to-talk interaction. */
export function figureIsInteractive(member: SceneCastMember, hasHandler: boolean): boolean {
  return hasHandler && !member.isPlayer;
}

/** Resolve the stable entity recipe used to draw one cast member. */
export function castMemberRecipe(member: SceneCastMember): EntityRecipe {
  // Preserve authored or game-derived identity whenever the caller supplies it.
  if (member.recipe) return member.recipe;

  // An unknown person becomes an unarmed human commoner. The member id supplies
  // the deterministic seed, so save/reload and every renderer produce the same body.
  return {
    kind: 'humanoid',
    raceId: 'human',
    classId: 'fighter',
    seed: `cast:${member.id}`,
    gearOverride: [],
  };
}

// ============================================================================
// Conversational layout
// ============================================================================
// The player stands near the camera while NPCs form a shallow arc opposite them.
// Returning positions as data keeps this spatial rule usable outside React Three
// Fiber and lets focused tests prove the arrangement without mounting a canvas.
// ============================================================================

/** Lay out a cast as a compact, face-to-face group around the scene origin. */
export function layoutCast(
  cast: SceneCastMember[],
): Array<SceneCastMember & { pos: [number, number, number] }> {
  const player = cast.find((member) => member.isPlayer);
  const npcs = cast.filter((member) => !member.isPlayer);
  const positioned: Array<SceneCastMember & { pos: [number, number, number] }> = [];

  // The player's positive-Z position places them at the near edge of the scene.
  if (player) positioned.push({ ...player, pos: [0, 0, 2.2] });

  // Space NPCs evenly across the far side. Pulling the outer figures slightly
  // farther back makes the line read as a natural arc rather than a rigid row.
  const spreadMetres = 1.4;
  npcs.forEach((npc, index) => {
    const offsetFromCentre = index - (npcs.length - 1) / 2;
    const x = offsetFromCentre * spreadMetres;
    const z = -1 - Math.abs(offsetFromCentre) * 0.25;
    positioned.push({ ...npc, pos: [x, 0, z] });
  });

  return positioned;
}
