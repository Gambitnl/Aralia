import { Ability, AbilityEffect } from '@/types/combat';
import { SpellEffect, DamageType, ConditionName, EffectCondition, SavingThrowAbility } from '@/types/spells';
import { ConditionType } from '@/types/conditions';

/**
 * This file translates battle-map ability effects into the shared spell-effect
 * command format.
 *
 * Monster actions, class features, and weapon abilities use a compact `Ability`
 * and `AbilityEffect` structure, whereas the combat execution engine runs on
 * `SpellEffect` commands (`DamageCommand`, `HealingCommand`, `StatusConditionCommand`,
 * `MovementCommand`). Converting ability payloads here lets both abilities and
 * spells share one damage, saving-throw, healing, status, and movement pipeline.
 *
 * Called by: `AbilityCommandFactory.ts` (when building attack and utility commands)
 * Depends on: combat and spell effect type definitions
 */

// ============================================================================
// Magnitude And Distance Extraction
// ============================================================================
// Monster attacks and simple combat actions often store a flat `value`, while
// the command layer expects a dice formula string or an explicit distance in
// feet. These helpers normalize those values before command construction.
// ============================================================================

// Convert a flat numeric value or dice string into the dice formula string
// that DamageCommand and HealingCommand roll.
const getEffectMagnitudeFormula = (abilityEffect: AbilityEffect): string => {
  if (abilityEffect.dice) return abilityEffect.dice;

  if (typeof abilityEffect.value === 'number' && Number.isFinite(abilityEffect.value)) {
    return String(Math.max(0, abilityEffect.value));
  }

  // Zero remains the explicit fallback for effects that are placeholders or
  // whose magnitude is supplied by a later mechanic. This keeps old scaffolding
  // mappable without pretending missing damage data is valid damage.
  return '0';
};

// Movement and teleport abilities carry their reach in feet on the same flat
// `value` field that damage uses. MovementCommand reads `distance` off the
// mapped SpellEffect, so dropping it here turns every translated push, pull,
// or blink into a zero-foot move that resolves without anyone leaving a tile.
const getEffectDistanceFeet = (abilityEffect: AbilityEffect): number | undefined => {
  if (typeof abilityEffect.value === 'number' && Number.isFinite(abilityEffect.value) && abilityEffect.value > 0) {
    return abilityEffect.value;
  }

  // An absent or non-positive value is left undefined rather than coerced to 0,
  // so the command layer can tell "no authored distance" from "moves nowhere".
  return undefined;
};

// ============================================================================
// Condition And Saving Throw Normalization
// ============================================================================
// These helpers validate status condition names and saving-throw ability names
// against the canonical unions expected by the command layer.
// ============================================================================

const KNOWN_CONDITION_NAMES: ReadonlySet<ConditionName> = new Set([
  ...Object.values(ConditionType),
  'Slowed',
  'Slasher Slow',
  // Beneficial buff applied by Bardic Inspiration; the attack resolver grants an
  // Inspired creature advantage on its next attack (approximating the die).
  'Inspired' as ConditionName,
]);

// Return the condition name only if it belongs to the known runtime set.
const normalizeConditionName = (name: string): ConditionName | undefined => {
  return KNOWN_CONDITION_NAMES.has(name as ConditionName) ? (name as ConditionName) : undefined;
};

const SAVING_THROW_ABILITIES: readonly SavingThrowAbility[] = [
  'Strength',
  'Dexterity',
  'Constitution',
  'Intelligence',
  'Wisdom',
  'Charisma',
];

// Match an ability's saveAbility string (case-insensitively) to the canonical
// SavingThrowAbility union used by DamageCommand.
const normalizeSaveAbility = (saveAbility?: string): SavingThrowAbility | undefined => {
  if (!saveAbility) return undefined;
  return SAVING_THROW_ABILITIES.find(
    candidate => candidate.toLowerCase() === saveAbility.toLowerCase()
  );
};

// Build the effect condition for a damage payload. When the owning ability
// declares both a save DC and a valid save ability, emit a saving-throw
// condition that halves damage on a successful save; otherwise default to 'always'.
const buildDamageCondition = (
  ability?: Pick<Ability, 'saveDC' | 'saveAbility'>
): EffectCondition => {
  const saveType = normalizeSaveAbility(ability?.saveAbility);
  if (
    typeof ability?.saveDC === 'number' &&
    Number.isFinite(ability.saveDC) &&
    saveType
  ) {
    return {
      type: 'saving_throw',
      saveType,
      saveDC: ability.saveDC,
      saveEffect: 'half',
    };
  }

  return { type: 'always' };
};

// ============================================================================
// Ability-To-SpellEffect Mapper
// ============================================================================
// Converts a single AbilityEffect (plus optional parent Ability metadata such
// as saveDC and saveAbility) into a SpellEffect that the command factory can
// wrap in a concrete SpellCommand.
// ============================================================================

export class AbilityEffectMapper {
  static mapToSpellEffect(
    abilityEffect: AbilityEffect,
    ability?: Pick<Ability, 'saveDC' | 'saveAbility'>
  ): SpellEffect | null {
    switch (abilityEffect.type) {
      case 'damage':
        // Map damage effects with a saving_throw condition when the parent
        // ability specifies saveDC and saveAbility; otherwise keep 'always'
        // (weapon attack rolls are handled by WeaponAttackCommand).
        return {
          type: 'DAMAGE',
          trigger: { type: 'immediate' },
          condition: buildDamageCondition(ability),
          damage: {
            dice: getEffectMagnitudeFormula(abilityEffect),
            type: abilityEffect.damageType || DamageType.Bludgeoning,
          },
        };
      case 'heal':
        // Healing abilities always apply directly to their targets without a save.
        return {
          type: 'HEALING',
          trigger: { type: 'immediate' },
          condition: { type: 'always' },
          healing: {
            dice: getEffectMagnitudeFormula(abilityEffect),
          },
        };
      case 'status': {
        // Ignore malformed status entries or unknown condition names so they do
        // not corrupt character condition lists.
        if (!abilityEffect.statusEffect) return null;

        const statusConditionName = normalizeConditionName(abilityEffect.statusEffect.name);
        if (!statusConditionName) return null;

        return {
          type: 'STATUS_CONDITION',
          trigger: { type: 'immediate' },
          condition: { type: 'always' },
          statusCondition: {
            name: statusConditionName,
            duration: { type: 'rounds', value: abilityEffect.statusEffect.duration },
          },
        };
      }
      case 'movement':
      case 'teleport': {
        // Translate push/teleport distance in feet onto the MovementCommand payload.
        const distance = getEffectDistanceFeet(abilityEffect);

        return {
          type: 'MOVEMENT',
          trigger: { type: 'immediate' },
          condition: { type: 'always' },
          movementType: abilityEffect.type === 'teleport' ? 'teleport' : 'push', // AbilityEffect has no push/pull discriminator yet
          ...(distance === undefined ? {} : { distance }),
          duration: { type: 'special' },
        };
      }
      default:
        console.warn(`Ability effect type ${abilityEffect.type} not directly mappable to SpellEffect`);
        return null;
    }
  }
}
