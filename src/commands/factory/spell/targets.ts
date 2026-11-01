/**
 * @file targets.ts
 * Keeps creature filtering aligned with the richer object and point target envelope.
 *
 * Extracted from SpellCommandFactory without changing rule bodies or random
 * draws. The public factory still controls cast preparation and command order.
 * New spell behavior belongs with its family; broad rules changes remain separate.
 */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 24/10/2026, 21:02:48
 * Dependents: commands/factory/SpellCommandFactory.ts, commands/factory/spell/effectRouting.ts
 * Imports: 1 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import { CombatCharacter, SelectedSpellTarget } from '@/types/combat'

/**
 * Build the rich target envelope for the current creature-only command path.
 *
 * Object and point refs enter through the optional factory argument, but most
 * existing callers still pass only CombatCharacter targets. This adapter keeps
 * those callers visible to future command code without changing their behavior.
 */
export function createCreatureTargetRefs(targets: CombatCharacter[]): SelectedSpellTarget[] {
  return targets.map(target => ({ kind: 'creature', id: target.id }))
}



/**
 * Keep selected creature refs aligned with filtered command targets.
 *
 * Filters such as "Undead only" apply to creature targets. Non-creature refs
 * are preserved because object and point eligibility belongs to the object
 * targeting resolver, not creature taxonomy filters.
 */
export function filterSelectedTargetsForCreatures(
  selectedSpellTargets: SelectedSpellTarget[] | undefined,
  filteredTargets: CombatCharacter[]
): SelectedSpellTarget[] | undefined {
  if (!selectedSpellTargets) {
    return undefined
  }

  const filteredCreatureIds = new Set(filteredTargets.map(target => target.id))

  return selectedSpellTargets.filter(selectedTarget =>
    selectedTarget.kind !== 'creature' || filteredCreatureIds.has(selectedTarget.id)
  )
}
