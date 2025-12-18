import { CombatCharacter } from '@/types/combat'
import { TargetConditionFilter } from '@/types/spells'

/**
 * Validates if a target character matches the specified conditions.
 * Used for spell effect targeting and immunity checks.
 */
export class ConditionValidator {
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
      // Schema says array of strings. We assume exact matches matching data (e.g. "Lawful Good").
      if (!target.alignment || !filter.alignments.includes(target.alignment)) {
        return false
      }
    }

    // Has Condition
    if (filter.hasCondition && filter.hasCondition.length > 0) {
      // If target has no condition/status arrays but filter requires one, fail
      if ((!target.conditions || target.conditions.length === 0) &&
          (!target.statusEffects || target.statusEffects.length === 0)) {
        return false
      }

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
