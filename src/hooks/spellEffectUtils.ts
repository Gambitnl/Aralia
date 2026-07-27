// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 23/07/2026, 19:08:22
 * Dependents: commands/effects/DamageCommand.ts, hooks/useAbilitySystem.ts, systems/spells/effects/triggerHandler.ts
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
  'on_move_in_area'
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

export const hasPersistentAreaTrigger = (effect: SpellEffect): boolean => {
  const triggerType = (effect as { trigger?: { type?: string } }).trigger?.type;
  if (typeof triggerType === 'string' && AREA_ZONE_TRIGGER_TYPES.has(triggerType)) {
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
