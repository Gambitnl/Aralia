// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 12/08/2026, 05:47:47
 * Dependents: components/DesignPreview/steps/scenarioControls/reactiveDamageRetaliationScenarioControls.ts
 * Imports: 11 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * This file resolves one damage event followed by a Hellish Rebuke response.
 *
 * Hellish Rebuke already has complete spell data, but the combat event buses do
 * not yet turn a resolved damage event into a reaction-spell opportunity. This
 * narrow production helper supplies that missing rules transaction: it applies
 * the triggering damage first, checks event identity, range, sight, condition,
 * Reaction, and spell slot, then uses the shared save, damage, defense, and HP
 * systems for the retaliation. A later event-bus integration can call this
 * helper without moving any of those rules into UI code.
 *
 * Called by: the Tactical Sandbox Reactive Damage & Retaliation adapter.
 * Depends on: canonical Hellish Rebuke JSON and shared combat-rule utilities.
 */

import hellishRebukeData from '@/data/spells/level-1/hellish-rebuke.json';
import type { PlayerCharacter } from '../../../types';
import type { BattleMapData, CombatCharacter } from '../../../types/combat';
import type { DamageEffect, Spell } from '../../../types/spells';
import { isDamageEffect } from '../../../types/spells';
import { createAbilityFromSpell } from '../../../utils/character/spellAbilityFactory';
import {
  calculateSaveDamage,
  calculateSpellDC,
  rollSavingThrow,
} from '../../../utils/character/savingThrowUtils';
import {
  canAffordActionCost,
  consumeActionCost,
} from '../../../utils/combat/actionEconomyUtils';
import {
  calculateDamage,
  getCharacterDistance,
  rollDamage,
} from '../../../utils/combat/combatUtils';
import {
  applyDamageAndCheckDowned,
  isIncapacitated,
} from '../../../utils/combat/deathSaveUtils';
import { hasLineOfSight } from '../../../utils/spatial/lineOfSight';
import { ScalingEngine } from './ScalingEngine';

// ============================================================================
// Canonical Spell Facts
// ============================================================================
// Every spell-owned fact comes from the live JSON record. Missing or malformed
// data rejects the transaction instead of falling back to a scenario rule.
// ============================================================================

const HELLISH_REBUKE = hellishRebukeData as unknown as Spell;
const HELLISH_REBUKE_DAMAGE_EFFECT = HELLISH_REBUKE.effects.find(
  (effect): effect is DamageEffect => isDamageEffect(effect),
);

export const HELLISH_REBUKE_RANGE_FEET = HELLISH_REBUKE.range.distance;
export const HELLISH_REBUKE_BASE_LEVEL = HELLISH_REBUKE.level;

// ============================================================================
// Public Event And Receipt Contract
// ============================================================================
// The caller supplies the resolved hit/damage fact and an event id. The result
// carries both changed actors and a readable ordering receipt so UI, tests, and
// future event-bus wiring can inspect the same decision without parsing logs.
// ============================================================================

export interface ReactiveDamageEvent {
  id: string;
  isHit: boolean;
  damage: number;
  damageType: string;
}

export type ReactiveDamageRetaliationReason =
  | 'resolved'
  | 'duplicate_event'
  | 'attack_missed'
  | 'no_triggering_damage'
  | 'retaliator_downed'
  | 'retaliator_incapacitated'
  | 'attacker_out_of_range'
  | 'attacker_not_visible'
  | 'invalid_cast_level'
  | 'reaction_or_slot_unavailable'
  | 'missing_canonical_spell_data'
  | 'missing_map_tile';

export type ReactiveDamageDefense = 'none' | 'resistance' | 'immunity' | 'vulnerability';

export interface ReactiveDamageRetaliationReceipt {
  outcome: 'resolved' | 'rejected';
  reason: ReactiveDamageRetaliationReason;
  attacker: CombatCharacter;
  retaliator: CombatCharacter;
  resolvedEventIds: string[];
  distanceFeet: number;
  lineOfSight: boolean;
  triggeringDamage: {
    raw: number;
    final: number;
    hpBefore: number;
    hpAfter: number;
  };
  retaliation?: {
    spellId: string;
    dice: string;
    rolledDamage: number;
    saveDC: number;
    saveTotal: number;
    saveSucceeded: boolean;
    damageAfterSave: number;
    finalDamage: number;
    defense: ReactiveDamageDefense;
    hpBefore: number;
    hpAfter: number;
    attackerDowned: boolean;
  };
  order: string[];
}

export interface ResolveReactiveDamageRetaliationInput {
  attacker: CombatCharacter;
  retaliator: CombatCharacter;
  mapData: BattleMapData;
  event: ReactiveDamageEvent;
  castAtLevel?: number;
  resolvedEventIds?: readonly string[];
  /** Deterministic tests and previews can inject dice; normal play can omit it. */
  damageRng?: () => number;
  /** Deterministic tests and previews can inject the save d20; normal play can omit it. */
  saveRng?: () => number;
}

// ============================================================================
// Map, Cost, And Defense Helpers
// ============================================================================
// These helpers adapt the existing shared systems into the one transaction. No
// helper owns a second damage, sight, spell-slot, or incapacitation rule.
// ============================================================================

function getLineOfSight(
  mapData: BattleMapData,
  retaliator: CombatCharacter,
  attacker: CombatCharacter,
): boolean | null {
  const retaliatorTile = mapData.tiles.get(`${retaliator.position.x}-${retaliator.position.y}`);
  const attackerTile = mapData.tiles.get(`${attacker.position.x}-${attacker.position.y}`);
  if (!retaliatorTile || !attackerTile) {
    return null;
  }

  return hasLineOfSight(retaliatorTile, attackerTile, mapData);
}

function createHellishRebukeCost(
  retaliator: CombatCharacter,
  castAtLevel: number,
) {
  // The shared spell adapter reads the live casting-time resource. Adding the
  // chosen slot level tells the canonical ledger which inventory row to spend.
  const ability = createAbilityFromSpell(
    HELLISH_REBUKE,
    retaliator as unknown as PlayerCharacter,
  );
  return {
    ...ability.cost,
    spellSlotLevel: castAtLevel,
  };
}

function describeDefense(
  damageAfterSave: number,
  finalDamage: number,
): ReactiveDamageDefense {
  if (damageAfterSave > 0 && finalDamage === 0) {
    return 'immunity';
  }
  if (finalDamage < damageAfterSave) {
    return 'resistance';
  }
  if (finalDamage > damageAfterSave) {
    return 'vulnerability';
  }
  return 'none';
}

function appendEventId(
  resolvedEventIds: readonly string[],
  eventId: string,
): string[] {
  return [...resolvedEventIds, eventId];
}

// ============================================================================
// Ordered Damage-To-Reaction Resolution
// ============================================================================
// The triggering hit is committed before the reaction eligibility check. That
// order matters: a hit that downs or incapacitates the retaliator prevents the
// reaction, while a legal response can subsequently down the attacker.
// ============================================================================

export function resolveReactiveDamageRetaliation(
  input: ResolveReactiveDamageRetaliationInput,
): ReactiveDamageRetaliationReceipt {
  const resolvedEventIds = input.resolvedEventIds ?? [];
  const distanceFeet = getCharacterDistance(input.retaliator, input.attacker) * 5;

  // An event id is a once-only boundary for both the triggering damage and the
  // response. Replaying the same event cannot double either side of the trade.
  if (resolvedEventIds.includes(input.event.id)) {
    return {
      outcome: 'rejected',
      reason: 'duplicate_event',
      attacker: input.attacker,
      retaliator: input.retaliator,
      resolvedEventIds: [...resolvedEventIds],
      distanceFeet,
      lineOfSight: false,
      triggeringDamage: {
        raw: 0,
        final: 0,
        hpBefore: input.retaliator.currentHP,
        hpAfter: input.retaliator.currentHP,
      },
      order: ['Duplicate event rejected before triggering damage or retaliation.'],
    };
  }

  const nextEventIds = appendEventId(resolvedEventIds, input.event.id);

  // A miss never deals the authored triggering damage and therefore cannot
  // open Hellish Rebuke's "damages you" reaction window.
  if (!input.event.isHit) {
    return {
      outcome: 'rejected',
      reason: 'attack_missed',
      attacker: input.attacker,
      retaliator: input.retaliator,
      resolvedEventIds: nextEventIds,
      distanceFeet,
      lineOfSight: true,
      triggeringDamage: {
        raw: 0,
        final: 0,
        hpBefore: input.retaliator.currentHP,
        hpAfter: input.retaliator.currentHP,
      },
      order: ['1. Attack misses; no triggering damage is applied.'],
    };
  }

  // The triggering attack uses the normal defense pipeline before HP changes.
  // Hellish Rebuke requires actual damage, so a zero final result is not enough.
  const triggeringDamage = calculateDamage(
    input.event.damage,
    input.attacker,
    input.retaliator,
    input.event.damageType,
  );
  const damagedRetaliator = applyDamageAndCheckDowned(
    input.retaliator,
    triggeringDamage,
  );
  const triggeringReceipt = {
    raw: input.event.damage,
    final: triggeringDamage,
    hpBefore: input.retaliator.currentHP,
    hpAfter: damagedRetaliator.currentHP,
  };
  const order = [
    `1. Triggering hit deals ${triggeringDamage} ${input.event.damageType} damage; retaliator HP ${input.retaliator.currentHP} -> ${damagedRetaliator.currentHP}.`,
  ];

  if (triggeringDamage <= 0) {
    return {
      outcome: 'rejected',
      reason: 'no_triggering_damage',
      attacker: input.attacker,
      retaliator: damagedRetaliator,
      resolvedEventIds: nextEventIds,
      distanceFeet,
      lineOfSight: true,
      triggeringDamage: triggeringReceipt,
      order: [...order, '2. No damage was taken, so no reaction window opens.'],
    };
  }

  // The hit has already landed. A creature at zero HP cannot answer it, even
  // if its Reaction and spell slot were ready before the damage was applied.
  if (damagedRetaliator.currentHP <= 0) {
    return {
      outcome: 'rejected',
      reason: 'retaliator_downed',
      attacker: input.attacker,
      retaliator: damagedRetaliator,
      resolvedEventIds: nextEventIds,
      distanceFeet,
      lineOfSight: true,
      triggeringDamage: triggeringReceipt,
      order: [...order, '2. Retaliator is down after the hit and cannot take a Reaction.'],
    };
  }

  if (isIncapacitated(damagedRetaliator)) {
    return {
      outcome: 'rejected',
      reason: 'retaliator_incapacitated',
      attacker: input.attacker,
      retaliator: damagedRetaliator,
      resolvedEventIds: nextEventIds,
      distanceFeet,
      lineOfSight: true,
      triggeringDamage: triggeringReceipt,
      order: [...order, '2. Retaliator is incapacitated and cannot take a Reaction.'],
    };
  }

  if (distanceFeet > HELLISH_REBUKE_RANGE_FEET) {
    return {
      outcome: 'rejected',
      reason: 'attacker_out_of_range',
      attacker: input.attacker,
      retaliator: damagedRetaliator,
      resolvedEventIds: nextEventIds,
      distanceFeet,
      lineOfSight: true,
      triggeringDamage: triggeringReceipt,
      order: [...order, `2. Attacker is ${distanceFeet} feet away, beyond the ${HELLISH_REBUKE_RANGE_FEET}-foot reaction range.`],
    };
  }

  const lineOfSight = getLineOfSight(input.mapData, damagedRetaliator, input.attacker);
  if (lineOfSight === null) {
    return {
      outcome: 'rejected',
      reason: 'missing_map_tile',
      attacker: input.attacker,
      retaliator: damagedRetaliator,
      resolvedEventIds: nextEventIds,
      distanceFeet,
      lineOfSight: false,
      triggeringDamage: triggeringReceipt,
      order: [...order, '2. Reaction rejected because an actor map tile is unavailable.'],
    };
  }
  if (!lineOfSight) {
    return {
      outcome: 'rejected',
      reason: 'attacker_not_visible',
      attacker: input.attacker,
      retaliator: damagedRetaliator,
      resolvedEventIds: nextEventIds,
      distanceFeet,
      lineOfSight,
      triggeringDamage: triggeringReceipt,
      order: [...order, '2. Total Cover blocks sight, so Hellish Rebuke cannot target the attacker.'],
    };
  }

  const damageEffect = HELLISH_REBUKE_DAMAGE_EFFECT;
  const castAtLevel = input.castAtLevel ?? HELLISH_REBUKE_BASE_LEVEL;
  if (
    !damageEffect?.damage.dice
    || !damageEffect.condition.saveType
    || HELLISH_REBUKE.castingTime.unit !== 'reaction'
  ) {
    return {
      outcome: 'rejected',
      reason: 'missing_canonical_spell_data',
      attacker: input.attacker,
      retaliator: damagedRetaliator,
      resolvedEventIds: nextEventIds,
      distanceFeet,
      lineOfSight,
      triggeringDamage: triggeringReceipt,
      order: [...order, '2. Canonical Hellish Rebuke damage, save, or Reaction metadata is unavailable.'],
    };
  }

  // Spell slots exist only at whole-numbered levels from the spell's canonical
  // base level through level 9. Rejecting malformed levels here preserves the
  // triggering hit and event receipt, but prevents an invalid cost from
  // bypassing inventory checks or reaching the retaliation scaling pipeline.
  if (
    !Number.isInteger(castAtLevel)
    || castAtLevel < HELLISH_REBUKE_BASE_LEVEL
    || castAtLevel > 9
  ) {
    return {
      outcome: 'rejected',
      reason: 'invalid_cast_level',
      attacker: input.attacker,
      retaliator: damagedRetaliator,
      resolvedEventIds: nextEventIds,
      distanceFeet,
      lineOfSight,
      triggeringDamage: triggeringReceipt,
      order: [...order, '2. Reaction rejected because the chosen spell level is invalid.'],
    };
  }

  const cost = createHellishRebukeCost(damagedRetaliator, castAtLevel);
  if (!canAffordActionCost(damagedRetaliator, cost)) {
    return {
      outcome: 'rejected',
      reason: 'reaction_or_slot_unavailable',
      attacker: input.attacker,
      retaliator: damagedRetaliator,
      resolvedEventIds: nextEventIds,
      distanceFeet,
      lineOfSight,
      triggeringDamage: triggeringReceipt,
      order: [...order, '2. Reaction or chosen spell slot is unavailable; no response cost or damage is applied.'],
    };
  }

  // Payment happens only after every trigger and targeting guard passes. The
  // save and damage then resolve through the same helpers used by normal spells.
  const paidRetaliator = consumeActionCost(damagedRetaliator, cost);
  const saveDC = calculateSpellDC(paidRetaliator);
  const save = rollSavingThrow(
    input.attacker,
    damageEffect.condition.saveType,
    saveDC,
    undefined,
    { damageType: damageEffect.damage.type, tags: HELLISH_REBUKE.tags },
    undefined,
    { rng: input.saveRng },
  );
  const scaledDice = ScalingEngine.scaleEffect(
    damageEffect.damage.dice,
    damageEffect.scaling,
    castAtLevel,
    paidRetaliator.level,
    HELLISH_REBUKE_BASE_LEVEL,
  );
  const rolledDamage = rollDamage(scaledDice, false, 1, input.damageRng);
  const damageAfterSave = calculateSaveDamage(
    rolledDamage,
    save,
    damageEffect.condition.saveEffect ?? 'half',
  );
  const finalDamage = calculateDamage(
    damageAfterSave,
    paidRetaliator,
    input.attacker,
    damageEffect.damage.type,
  );
  const damagedAttacker = applyDamageAndCheckDowned(input.attacker, finalDamage);
  const defense = describeDefense(damageAfterSave, finalDamage);

  return {
    outcome: 'resolved',
    reason: 'resolved',
    attacker: damagedAttacker,
    retaliator: paidRetaliator,
    resolvedEventIds: nextEventIds,
    distanceFeet,
    lineOfSight,
    triggeringDamage: triggeringReceipt,
    retaliation: {
      spellId: HELLISH_REBUKE.id,
      dice: scaledDice,
      rolledDamage,
      saveDC,
      saveTotal: save.total,
      saveSucceeded: save.success,
      damageAfterSave,
      finalDamage,
      defense,
      hpBefore: input.attacker.currentHP,
      hpAfter: damagedAttacker.currentHP,
      attackerDowned: damagedAttacker.currentHP <= 0,
    },
    order: [
      ...order,
      `2. Hellish Rebuke spends Reaction and level-${castAtLevel} slot.`,
      `3. Attacker Dexterity save ${save.total} vs DC ${saveDC} ${save.success ? 'succeeds' : 'fails'}; ${rolledDamage} becomes ${damageAfterSave}.`,
      `4. ${defense === 'none' ? 'No matching defense' : defense} changes retaliation to ${finalDamage}; attacker HP ${input.attacker.currentHP} -> ${damagedAttacker.currentHP}.`,
    ],
  };
}
