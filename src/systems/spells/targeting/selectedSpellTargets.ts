// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 12/06/2026, 21:54:55
 * Dependents: systems/spells/targeting/index.ts
 * Imports: 1 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import type { BattleMapData, CombatCharacter, Position, SelectedSpellTarget } from '@/types/combat'

/**
 * This file turns a clicked battle-map position into spell target references.
 *
 * The combat UI already knows which tile the player clicked, but object-targeting
 * spells need more detail than a tile coordinate. This helper preserves whether
 * that click selected a creature, a registered map object, or simply a ground
 * point so later action and command layers do not have to guess.
 *
 * Called by: future ability/target-selection hook wiring and current targeting
 * tests.
 * Depends on: BattleMapData.targetableObjects and the shared SelectedSpellTarget
 * envelope from combat types.
 */

// ============================================================================
// Click-To-Target Input
// ============================================================================
// This section describes the small amount of live combat state needed to classify
// a map click. Keeping the helper pure makes it safe to test before wiring it into
// React hooks or rendered battle-map surfaces.
// ============================================================================

export interface SelectedSpellTargetBuildInput {
  position: Position
  characters: CombatCharacter[]
  mapData: BattleMapData | null
  pointPurpose?: string
}

// ============================================================================
// Selected Target Builder
// ============================================================================
// This section applies Aralia's current target priority. Creature tokens win
// because the existing combat loop treats occupied creature tiles as creature
// selections; registered spell objects are next; empty legal tiles become point
// targets for ground/area destination flows.
// ============================================================================

export function buildSelectedSpellTargetsForPosition(input: SelectedSpellTargetBuildInput): SelectedSpellTarget[] {
  const occupyingCreature = input.characters.find(character =>
    character.position.x === input.position.x &&
    character.position.y === input.position.y
  )

  if (occupyingCreature) {
    return [{ kind: 'creature', id: occupyingCreature.id }]
  }

  const objectTargets = (input.mapData?.targetableObjects ?? [])
    .filter(targetObject =>
      targetObject.position.x === input.position.x &&
      targetObject.position.y === input.position.y
    )
    .map((targetObject): SelectedSpellTarget => ({
      kind: 'object',
      id: targetObject.id,
      name: targetObject.name,
      position: targetObject.position,
      object: targetObject
    }))

  if (objectTargets.length > 0) {
    return objectTargets
  }

  return [{
    kind: 'point',
    position: input.position,
    purpose: input.pointPurpose
  }]
}
