// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 01/06/2026, 18:57:21
 * Dependents: hooks/useAbilitySystem.ts
 * Imports: 2 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import { Ability, Position } from '../types/combat';
import { Spell } from '../types/spells';

export const hasTeleportMovementEffect = (ability: Ability): boolean => (
  ability.effects.some(effect => effect.type === 'teleport') ||
  (ability.spell?.effects ?? []).some(effect => effect.type === 'MOVEMENT' && effect.movementType === 'teleport')
);

export const addTeleportDestinationToSpell = (spell: Spell, destination: Position): Spell => ({
  ...spell,
  effects: spell.effects.map(effect => (
    effect.type === 'MOVEMENT' && effect.movementType === 'teleport'
      ? { ...effect, destination }
      : effect
  ))
});

export const addTeleportDestinationsToSpell = (spell: Spell, destinationsByTargetId: Record<string, Position>): Spell => ({
  ...spell,
  effects: spell.effects.map(effect => (
    effect.type === 'MOVEMENT' && effect.movementType === 'teleport'
      ? { ...effect, destinationsByTargetId }
      : effect
  ))
});

export const requiresUnassignedTeleportDestination = (ability: Ability): boolean => {
  if (!ability.spell || ability.targeting === 'self') return false;

  return ability.spell.effects.some(effect => (
    effect.type === 'MOVEMENT' &&
    effect.movementType === 'teleport' &&
    !effect.destination &&
    !effect.targetPosition &&
    !effect.destinationsByTargetId &&
    effect.forcedMovement?.direction === 'caster_choice'
  ));
};
