import { TargetConditionFilter } from '@/types/spells';

/**
 * Standard targeting filters for common D&D spell constraints.
 * Use these to populate the `targeting.filter` field in spell JSONs.
 */
export const TARGET_FILTERS = {
  /**
   * For most healing spells (Cure Wounds, Healing Word, etc.)
   * which explicitly do not affect Undead or Constructs.
   */
  HEALING_STANDARD: {
    creatureTypes: [],
    excludeCreatureTypes: ['Undead', 'Construct'],
    sizes: [],
    alignments: [],
    hasCondition: [],
    isNativeToPlane: false,
  } as const,

  /**
   * For spells that only affect Humanoids (Charm Person, Hold Person).
   */
  HUMANOID_ONLY: {
    creatureTypes: ['Humanoid'],
    excludeCreatureTypes: [],
    sizes: [],
    alignments: [],
    hasCondition: [],
    isNativeToPlane: false,
  } as const,

  /**
   * For spells that only affect Beasts (Animal Friendship).
   */
  BEAST_ONLY: {
    creatureTypes: ['Beast'],
    excludeCreatureTypes: [],
    sizes: [],
    alignments: [],
    hasCondition: [],
    isNativeToPlane: false,
  } as const,

  /**
   * For spells that do not affect Undead (Sleep, etc.).
   */
  NO_UNDEAD: {
    creatureTypes: [],
    excludeCreatureTypes: ['Undead'],
    sizes: [],
    alignments: [],
    hasCondition: [],
    isNativeToPlane: false,
  } as const,
} as const;

/**
 * Helper to check if a spell JSON matches a known preset pattern.
 * Useful for validation scripts.
 */
// TODO(Auditor): Apply these presets to the Level 1 spell JSON files identified in docs/audits/level-1-targeting-audit.md

export function matchTargetFilter(description: string): TargetConditionFilter | null {
  const lowerDesc = description.toLowerCase();

  if (lowerDesc.includes('no effect on undead or constructs')) {
    return TARGET_FILTERS.HEALING_STANDARD as unknown as TargetConditionFilter;
  }

  // Weak heuristic: Spells targeting "humanoids" usually mention the word explicitly.
  if (lowerDesc.includes('humanoid')) {
    return TARGET_FILTERS.HUMANOID_ONLY as unknown as TargetConditionFilter;
  }

  // Weak heuristic: Spells targeting "beasts" usually mention the word explicitly.
  if (lowerDesc.includes('beast') && !lowerDesc.includes('beast shape')) {
    return TARGET_FILTERS.BEAST_ONLY as unknown as TargetConditionFilter;
  }

  // Common phrasing for spells like Sleep
  if (lowerDesc.includes('undead') && lowerDesc.includes('aren\'t affected')) {
    return TARGET_FILTERS.NO_UNDEAD as unknown as TargetConditionFilter;
  }

  return null;
}
