/**
 * Plans persistent spell registrations without creating IDs or publishing state.
 * The ability adapter still creates each zone, schedule or debuff immediately
 * before its callback. Generators resume only after that callback, so later
 * decisions continue to see the same source objects and ordering as before.
 */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 24/10/2026, 22:14:42
 * Dependents: hooks/ability/execution/spellExecutionFlow.ts, hooks/ability/useAbilityExecution.ts
 * Imports: 7 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import type { CombatCharacter } from '../../types/combat';
import type { Spell } from '../../types/spells';
import type { AoEParams } from '../../utils/combat/aoeCalculations';
import { getZoneAreaFromAoEParams } from '../../utils/spatial/targetingUtils';
import { getDurationRounds, getRecurringMechanics, hasPersistentAreaTrigger, isTerrainEffect } from '../spells/effects/spellEffectRules';
import type { createSpellZoneFromAoEParams, createTerrainSpellZoneFromAoEParams, createScheduledSpellEffect, createMovementDebuff } from '../spells/effects/trigger/zoneLifecycle';
import type { MovementTriggerDebuff } from '../spells/effects/trigger/types';

export interface SpellZoneRegistration {
  areaOfEffect: { shape: string };
  aoeParams: AoEParams;
}

/** Preserve Array.forEach's fixed length and live element reads across yields. */
function* registrationEntries<T>(values: T[]): Generator<T> {
  const count = values.length;
  for (let index = 0; index < count; index += 1) {
    if (index in values) yield values[index];
  }
}

export const getPersistentSpellZoneArea = (
  spell: Spell,
  areaOfEffect: { shape: string },
  aoeParams: AoEParams
): { shape: string; size: number } => {
  const targetingArea = getZoneAreaFromAoEParams(areaOfEffect, aoeParams);
  if (targetingArea.size > 0) {
    return targetingArea;
  }

  // Point-targeted summons can have a secondary threat radius in spatialDetails.
  const hasProximityMechanic = spell.effects.some(effect =>
    getRecurringMechanics(effect).some(mechanic => mechanic.timing === 'on_entity_proximity')
  );
  const proximityForm = spell.targeting.spatialDetails?.forms?.find(form =>
    form.shape.toLowerCase() === 'emanation' &&
    form.sizeUnit === 'feet' &&
    typeof form.size === 'number' &&
    form.size > 0
  );

  return hasProximityMechanic && proximityForm?.size
    ? { shape: 'sphere', size: proximityForm.size }
    : targetingArea;
};

export const planPersistentSpellZone = (
  spell: Spell, caster: CombatCharacter, zone: SpellZoneRegistration,
  currentTurn: number, castSaveDC: number
): Parameters<typeof createSpellZoneFromAoEParams> | undefined => {
  const hasPersistentAreaDefense = spell.effects.some(effect =>
    effect.type === 'DEFENSIVE' && (effect.defenseType === 'resistance' || effect.defenseType === 'immunity')
  );
  if (!(spell.effects.some(hasPersistentAreaTrigger) || hasPersistentAreaDefense)) return undefined;
  return [spell.id, caster.id, zone.aoeParams,
    getPersistentSpellZoneArea(spell, zone.areaOfEffect, zone.aoeParams),
    spell.effects, currentTurn, getDurationRounds(spell), castSaveDC,
    spell.targeting.validTargets, caster.facing];
};

/** Called only after the adapter rechecks its live map reference. */
export const planTerrainSpellZone = (
  spell: Spell, caster: CombatCharacter, zone: SpellZoneRegistration
): Parameters<typeof createTerrainSpellZoneFromAoEParams> | undefined => {
  if (!spell.effects.some(isTerrainEffect)) return undefined;
  return [spell.id, caster.id, zone.aoeParams,
    getZoneAreaFromAoEParams(zone.areaOfEffect, zone.aoeParams),
    spell.effects.filter(isTerrainEffect), 0, getDurationRounds(spell), caster.facing];
};

export const hasRecurringSpellTurnTiming = (spell: Spell): boolean => spell.effects.some(effect =>
  getRecurringMechanics(effect).some(mechanic => mechanic.timing === 'turn_start' || mechanic.timing === 'turn_end')
);

// Read a live round at each original registration point when the adapter supplies it.
const registrationRound = (round: number | (() => number)): number => typeof round === 'function' ? round() : round;

export function* planScheduledSpellEffects(
  spell: Spell, caster: CombatCharacter, targets: CombatCharacter[],
  currentTurn: number | (() => number), castSaveDC: number, zoneRegistration?: SpellZoneRegistration
): Generator<Parameters<typeof createScheduledSpellEffect>> {
  for (const timing of ['turn_start', 'turn_end'] as const) {
    const scheduledEffects = spell.effects.flatMap(effect => {
      const direct = effect.trigger?.type === timing ? [{ effect, recurringMechanic: undefined }] : [];
      const recurring = getRecurringMechanics(effect)
        .filter(mechanic => mechanic.timing === timing)
        .filter(() => !(zoneRegistration && timing === 'turn_end'))
        .map(recurringMechanic => ({ effect, recurringMechanic }));
      return [...direct, ...recurring];
    });
    if (scheduledEffects.length === 0) continue;
    for (const target of registrationEntries(targets)) {
      for (const { effect, recurringMechanic } of registrationEntries(scheduledEffects)) {
        yield [spell.id, caster.id, target.id, timing, [effect], registrationRound(currentTurn),
          getDurationRounds(spell), castSaveDC, recurringMechanic];
      }
    }
  }
}

export function* planUnpublishedMovementDebuffs(
  spell: Spell, caster: CombatCharacter, targets: CombatCharacter[],
  commandDebuffs: MovementTriggerDebuff[], currentTurn: number | (() => number), castSaveDC: number
): Generator<Parameters<typeof createMovementDebuff>> {
  for (const target of registrationEntries(targets)) {
    const alreadyPublishedByCommand = commandDebuffs.some(debuff =>
      debuff.spellId === spell.id && debuff.casterId === caster.id && debuff.targetId === target.id
    );
    if (alreadyPublishedByCommand) continue;
    yield [spell.id, caster.id, target.id, spell.effects, registrationRound(currentTurn),
      getDurationRounds(spell) ?? 1, castSaveDC];
  }
}
