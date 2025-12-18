import type { CombatCharacter } from '@/types/combat'
import type { TargetConditionFilter } from '@/types/spells'

/**
 * Utility for validating spell targets against constraints.
 * Moved from SpellCommandFactory to decouple Systems from Commands.
 */
export class TargetValidationUtils {
  /**
   * Check if a target matches the filter
   */
  public static matchesFilter(target: CombatCharacter, filter: TargetConditionFilter): boolean {
    if (!filter) return true

    // Creature Type (supports both singular and plural from schema)
    const allowedTypes = filter.creatureTypes || filter.creatureType
    if (allowedTypes && allowedTypes.length > 0) {
      if (!target.creatureTypes || !allowedTypes.some((t: string) => target.creatureTypes!.includes(t))) {
        return false
      }
    }

    if (filter.excludeCreatureTypes && filter.excludeCreatureTypes.length > 0) {
      if (target.creatureTypes && filter.excludeCreatureTypes.some((t: string) => target.creatureTypes!.includes(t))) {
        return false
      }
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

    return true
  }
}
