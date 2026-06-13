// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * SHARED UTILITY: Multiple systems rely on these exports.
 *
 * Last Sync: 12/06/2026, 23:58:58
 * Dependents: commands/factory/AbilityCommandFactory.ts, commands/factory/SpellCommandFactory.ts, systems/spells/targeting/TargetResolver.ts, utils/combat/combatAI.ts
 * Imports: 3 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import type { CombatCharacter } from '@/types/combat'
import type { TargetConditionFilter } from '@/types/spells'
import { CreatureTaxonomy } from '../../creatures/CreatureTaxonomy'

/**
 * Utility for validating spell targets against constraints.
 * Moved from SpellCommandFactory to decouple Systems from Commands.
 */
export class TargetValidationUtils {
  /**
   * Read all creature taxonomy labels from the combat character.
   *
   * Spell targeting is in a migration period: newer callers put taxonomy on
   * `CombatCharacter.creatureTypes`, while older monster adapters still place
   * it under `stats.creatureTypes`. This helper preserves both sources so
   * player targeting, effect filters, and AI planning can agree without
   * deleting either field prematurely.
   */
  public static getCreatureTypes(target: CombatCharacter): string[] {
    return [
      ...(target.creatureTypes ?? []),
      ...(target.stats?.creatureTypes ?? [])
    ]
  }

  /**
   * Check if a target matches the filter
   */
  public static matchesFilter(target: CombatCharacter, filter: TargetConditionFilter): boolean {
    if (!filter) return true

    // Creature Type (supports legacy `creatureType` and canonical `creatureTypes`).
    const targetTypes = TargetValidationUtils.getCreatureTypes(target);

    if (!CreatureTaxonomy.isValidTarget(targetTypes, filter)) {
      return false
    }

    // Size
    if (filter.sizes && filter.sizes.length > 0) {
      if (!target.stats.size || !filter.sizes.includes(target.stats.size)) {
        return false
      }
    }

    // Alignment
    if (filter.alignments && filter.alignments.length > 0) {
      // Alignment logic: check exact match or "includes" for broader categories if needed.
      // Schema says array of strings. We assume exact matches matching data (e.g. "Lawful Good").
      if (!target.alignment || !filter.alignments.includes(target.alignment)) {
        return false
      }
    }

    // Has Condition
    if (filter.hasCondition && filter.hasCondition.length > 0) {
      if (!target.conditions && !target.statusEffects) return false

      const hasReqCondition = filter.hasCondition.every((req: string) => {
        const hasActiveCondition = target.conditions?.some(c => c.name === req)
        const hasStatusEffect = target.statusEffects?.some(s => s.name === req)
        return hasActiveCondition || hasStatusEffect
      })

      if (!hasReqCondition) return false
    }

    // Special Identity Filters
    if (filter.specialIdentity) {
      if (filter.specialIdentity.corpseOrRemains === 'required') {
        // Assume living characters are not corpses (until we have an explicit Dead condition)
        if (target.currentHP > 0) {
          return false
        }
      }

      // Notes: reactionTriggeringCreature requires context from the CombatLog/EventBus which
      // the base CombatCharacter parameter doesn't currently provide. For now, it delegates
      // validation to the caller or assumes valid if reached here.
    }

    return true
  }
}
