// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 02/06/2026, 11:58:45
 * Dependents: hooks/useAbilitySystem.ts
 * Imports: 1 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import { SpellEffect, TerrainEffect, MovementEffect, Spell } from '../types/spells';

const AREA_ZONE_TRIGGER_TYPES = new Set([
  'on_enter_area',
  'on_exit_area',
  'on_end_turn_in_area',
  'on_move_in_area'
]);

export const hasPersistentAreaTrigger = (effect: SpellEffect): boolean => {
  const triggerType = (effect as { trigger?: { type?: string } }).trigger?.type;
  return typeof triggerType === 'string' && AREA_ZONE_TRIGGER_TYPES.has(triggerType);
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
