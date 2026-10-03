// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * SHARED UTILITY: Multiple systems rely on these exports.
 *
 * Last Sync: 09/08/2026, 22:29:02
 * Dependents: commands/effects/DamageCommand.ts, commands/effects/StatusConditionCommand.ts, commands/factory/SpellCommandFactory.ts, hooks/useAbilitySystem.ts, systems/spells/effects/triggerHandler.ts
 * Imports: 2 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import { SpellEffect, TerrainEffect, MovementEffect, Spell } from '../types/spells';
import type { RecurringMechanic } from '../types/spellEffectTypes';

const AREA_ZONE_TRIGGER_TYPES = new Set([
  'on_enter_area',
  'on_exit_area',
  'on_end_turn_in_area',
  'on_move_in_area',
  'area_entry_or_turn_start',
  'area_entry_or_turn_end',
  'emanation_entry_or_turn_end'
]);

// Composite labels describe more than one event. They need a persistent zone
// for their later entry or turn processing, but some records also need their
// immediate cast command to create a specialized guardian or emanation state.
const COMPOSITE_AREA_TRIGGER_TYPES = new Set([
  'area_entry_or_turn_start',
  'area_entry_or_turn_end',
  'emanation_entry_or_turn_end'
]);

// These source timings mean the effect has a real cast-time consequence as
// well as later area behavior. Keep the initial command and register the zone
// so the same spell can continue to react after it is cast.
const INITIAL_AREA_CAST_TIMINGS = new Set([
  'initial_area_creation',
  'emanation_enters_creature_space'
]);

const RUNTIME_RECURRING_TIMINGS = new Set([
  'turn_start',
  'turn_end',
  'on_damage',
  'on_move_in_area',
  'on_entity_proximity',
  'on_target_cast'
]);

/**
 * Normalize the source-compatible singleton form once at the runtime boundary.
 * Source data may keep one compact recurring record, while area and command
 * consumers need a stable collection. Unknown timing labels remain in the
 * returned records so a later event adapter can still inspect them.
 */
export const getRecurringMechanics = (effect: Pick<SpellEffect, 'recurringMechanics'>): RecurringMechanic[] => {
  const recurring = effect.recurringMechanics as RecurringMechanic[] | RecurringMechanic | undefined;
  if (!recurring) return [];
  return Array.isArray(recurring) ? recurring : [recurring];
};

export const getRuntimeRecurringMechanics = (effect: Pick<SpellEffect, 'recurringMechanics'>): RecurringMechanic[] =>
  getRecurringMechanics(effect).filter(mechanic =>
    typeof mechanic.timing === 'string' && RUNTIME_RECURRING_TIMINGS.has(mechanic.timing)
  );

// Decide whether a delayed area effect should be withheld from the immediate
// spell command. Specialized controlled-entity records and source rows with an
// explicit initial-cast timing must still execute their cast-time setup.
export const isDeferredAreaZoneTrigger = (effect: SpellEffect): boolean => {
  const triggerType = (effect as { trigger?: { type?: string } }).trigger?.type;
  if (typeof triggerType !== 'string' || !AREA_ZONE_TRIGGER_TYPES.has(triggerType)) {
    return false;
  }

  if (!COMPOSITE_AREA_TRIGGER_TYPES.has(triggerType)) {
    return true;
  }

  if ((effect as { controlledEntity?: unknown }).controlledEntity) {
    return false;
  }

  // The source union has areaTiming only on composite trigger variants; the
  // runtime label check above establishes that this is the compatible shape.
  const areaTiming = (effect.trigger as { areaTiming?: string[] } | undefined)?.areaTiming;
  return !(areaTiming ?? []).some(timing => INITIAL_AREA_CAST_TIMINGS.has(timing));
};

export const hasPersistentAreaTrigger = (effect: SpellEffect): boolean => {
  const triggerType = (effect as { trigger?: { type?: string } }).trigger?.type;
  if (typeof triggerType === 'string' && AREA_ZONE_TRIGGER_TYPES.has(triggerType)) {
    // Controlled entities own their own moving guardian or emanation records;
    // duplicating them as generic zones would apply their delayed effects twice.
    if (
      COMPOSITE_AREA_TRIGGER_TYPES.has(triggerType) &&
      (effect as { controlledEntity?: unknown }).controlledEntity
    ) {
      return false;
    }
    return true;
  }

  // Some wall and hazard spells keep their initial save/damage effect as an
  // immediate cast row, then describe later area behavior in recurringMechanics.
  // Those spells still need a durable ActiveSpellZone so future turns and
  // granted actions can find the spell-created area after casting.
  return getRuntimeRecurringMechanics(effect).some(mechanic =>
    mechanic.timing === 'turn_start' ||
    mechanic.timing === 'turn_end' ||
    mechanic.timing === 'on_move_in_area' ||
    mechanic.timing === 'on_entity_proximity'
  );
};

export const isTerrainEffect = (effect: SpellEffect): effect is TerrainEffect => effect.type === 'TERRAIN';

const SCHEDULED_EFFECT_TRIGGER_TYPES = new Set(['turn_start', 'turn_end']);

export const hasScheduledEffectTrigger = (effect: SpellEffect): boolean => {
  const triggerType = (effect as { trigger?: { type?: string } }).trigger?.type;
  return typeof triggerType === 'string' && SCHEDULED_EFFECT_TRIGGER_TYPES.has(triggerType);
};

export const hasTargetMovementTrigger = (effect: SpellEffect): boolean => {
  const triggerType = (effect as { trigger?: { type?: string } }).trigger?.type;
  return triggerType === 'on_target_move';
};

export const isMovementEffect = (effect: SpellEffect): effect is MovementEffect => effect.type === 'MOVEMENT';

export const getDurationRounds = (spell: Spell): number | undefined => {
  const duration = spell.duration;
  if (!duration.value || duration.type === 'instantaneous') return undefined;

  switch (duration.unit) {
    case 'round': return duration.value;
    case 'minute': return duration.value * 10;
    case 'hour': return duration.value * 600;
    case 'day': return duration.value * 14400;
    default: return undefined;
  }
};
