// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 10/08/2026, 13:44:44
 * Dependents: commands/effects/AttackRollModifierCommand.ts, commands/effects/DamageCommand.ts, commands/effects/StatusConditionCommand.ts
 * Imports: 3 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * This file turns structured spell save-modifier data into roll instructions.
 *
 * Spell records can grant Advantage or Disadvantage for facts the combat model
 * already knows, such as creature type, creature size, an active condition, or
 * whether the caster's side is fighting the target. Effect commands call this
 * resolver immediately before the saving throw, then pass its result to the
 * shared dice roller. Unknown source labels remain inert instead of being
 * guessed from prose.
 *
 * Called by: damage, status-condition, and attack-roll-modifier spell commands.
 * Depends on: the spell effect save-modifier shape and live combat characters.
 */
import type { CombatCharacter } from '@/types/combat';
import type { SaveModifier, TargetConditionFilter } from '@/types/spells';
import type { SaveAdvantageModifier } from '@/utils/character/savingThrowUtils';

// ============================================================================
// Source Condition Vocabulary
// ============================================================================
// These are the only fighting predicates currently authored as executable data.
// Both map to the combat runtime's existing team boundary, which is also used by
// Fast Friends when it resolves its fighting-target repeat save.
// ============================================================================

const FIGHTING_TARGET_CONDITIONS = new Set([
  'caster_fighting_target',
  'caster_or_allies_fighting_target',
  'caster_or_companions_fighting_target'
]);

/** Return every creature family stored on either live character surface. */
const getCreatureTypes = (target: CombatCharacter): string[] => (
  target.creatureTypes ?? target.stats.creatureTypes ?? []
).map(type => type.toLowerCase());

/** Return every named condition currently applied to the target. */
const getConditionNames = (target: CombatCharacter): string[] => [
  ...(target.conditions ?? []).map(condition => condition.name),
  ...(target.statusEffects ?? []).map(status => status.name)
].map(name => name.toLowerCase());

// ============================================================================
// Structured Target Matching
// ============================================================================
// Save modifiers use the same compact target facts as spell targeting. This
// matcher deliberately handles only facts represented by CombatCharacter; a
// future source field cannot silently become executable through text parsing.
// ============================================================================

const matchesTargetFilter = (
  filter: TargetConditionFilter | undefined,
  target: CombatCharacter
): boolean => {
  if (!filter) return true;

  const creatureTypes = getCreatureTypes(target);
  const includedTypes = filter.creatureTypes ?? filter.creatureType ?? [];
  const excludedTypes = filter.excludeCreatureTypes ?? [];

  if (
    includedTypes.length > 0 &&
    !includedTypes.some(type => creatureTypes.includes(type.toLowerCase()))
  ) {
    return false;
  }

  if (excludedTypes.some(type => creatureTypes.includes(type.toLowerCase()))) {
    return false;
  }

  const sizes = filter.sizes ?? filter.size ?? [];
  if (
    sizes.length > 0 &&
    (!target.stats.size || !sizes.some(size => size.toLowerCase() === target.stats.size?.toLowerCase()))
  ) {
    return false;
  }

  const requiredConditions = filter.hasCondition ?? [];
  const activeConditions = getConditionNames(target);
  if (
    requiredConditions.length > 0 &&
    !requiredConditions.every(condition => activeConditions.includes(condition.toLowerCase()))
  ) {
    return false;
  }

  return true;
};

/**
 * Confirm a source condition from live combat state.
 *
 * A missing condition means the modifier depends only on its structured target
 * filter. Known fighting predicates use the same team comparison as the proven
 * Fast Friends runtime. Every unknown token remains deferred to its own owner.
 */
const matchesSourceCondition = (
  condition: string | undefined,
  caster: CombatCharacter,
  target: CombatCharacter
): boolean => {
  if (!condition) return true;
  if (!FIGHTING_TARGET_CONDITIONS.has(condition)) return false;

  return caster.team !== target.team;
};

// ============================================================================
// Runtime Projection
// ============================================================================
// Effect commands consume SaveAdvantageModifier rather than source prose. This
// projection keeps the source reason for diagnostics while exposing only the
// two roll modes the shared saving-throw engine can execute safely.
// ============================================================================

export const resolveSourceSaveAdvantageModifiers = (
  modifiers: SaveModifier[] | undefined,
  caster: CombatCharacter,
  target: CombatCharacter
): SaveAdvantageModifier[] => {
  if (!modifiers?.length) return [];

  return modifiers.flatMap(modifier => {
    const type = modifier.type ?? modifier.modifier;
    if (type !== 'advantage' && type !== 'disadvantage') return [];

    const targetFilter = typeof modifier.appliesTo === 'object'
      ? modifier.appliesTo
      : undefined;
    if (!matchesTargetFilter(targetFilter, target)) return [];
    if (!matchesSourceCondition(modifier.condition, caster, target)) return [];

    return [{
      type,
      context: 'saving_throw' as const,
      source: modifier.reason ?? modifier.condition ?? 'Spell save modifier'
    }];
  });
};
