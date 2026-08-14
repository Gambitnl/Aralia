// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 13/08/2026, 09:59:41
 * Dependents: components/DesignPreview/steps/scenarioControls/reactiveDamageRetaliationScenarioControls.ts, systems/combat/reactions/postDamageReactionQueue.ts
 * Imports: 11 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * This file resolves Hellish Rebuke after the normal damage command commits HP.
 *
 * DamageCommand is the sole owner of the triggering hit. It publishes a stable
 * post-HP event containing the already-resolved HP receipt. This module checks
 * that event, applies the explicit accept or decline decision, pays the exact
 * Reaction and spell slot, then uses shared save, defense, and downing helpers
 * for the retaliation. It never reapplies the triggering damage.
 *
 * Called by: the production post-damage reaction queue and Tactical Sandbox.
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
// Canonical Spell Facts And Ownership
// ============================================================================
// Range, cost, save, dice, and scaling all come from the live spell record.
// Character ownership still comes from the actor's authored ability list.
// ============================================================================

const HELLISH_REBUKE = hellishRebukeData as unknown as Spell;
const HELLISH_REBUKE_DAMAGE_EFFECT = HELLISH_REBUKE.effects.find(
  (effect): effect is DamageEffect => isDamageEffect(effect),
);

export const HELLISH_REBUKE_RANGE_FEET = HELLISH_REBUKE.range.distance;
export const HELLISH_REBUKE_BASE_LEVEL = HELLISH_REBUKE.level;

export function getOwnedHellishRebukeSpells(retaliator: CombatCharacter): Spell[] {
  // Return the character-owned spell objects so the reaction prompt presents
  // the same labels and IDs as the rest of the ability system. The resolver
  // below still reads rules from canonical JSON, preventing sheet drift from
  // changing range, damage, or payment.
  return (retaliator.abilities ?? [])
    .map(ability => ability.spell)
    .filter((spell): spell is Spell => (
      spell?.id === HELLISH_REBUKE.id
      && String(spell.castingTime?.unit ?? '').toLowerCase() === 'reaction'
    ));
}

// ============================================================================
// Public Post-HP Event And Receipt Contract
// ============================================================================
// The event records damage that has already happened. Its stable ID owns both
// the prompt and the response, so a replay is a no-op across UI invocations.
// ============================================================================

export interface ReactiveDamageEvent {
  id: string;
  boundary: 'post_hp';
  sourceCharacterId: string;
  targetCharacterId: string;
  isHit: boolean;
  rawDamage: number;
  finalDamage: number;
  damageType: string;
  hpBefore: number;
  hpAfter: number;
  tempHPBefore?: number;
  tempHPAfter?: number;
  targetDownedAfter?: boolean;
  targetIncapacitatedAfter?: boolean;
}

export type ReactiveDamageRetaliationChoice = 'accept' | 'decline';

export type ReactiveDamageRetaliationReason =
  | 'resolved'
  | 'declined'
  | 'duplicate_event'
  | 'invalid_event_ownership'
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

export interface ReactiveDamageRetaliationEligibility {
  eligible: boolean;
  reason: ReactiveDamageRetaliationReason;
  distanceFeet: number;
  lineOfSight: boolean;
}

export interface ReactiveDamageRetaliationReceipt {
  outcome: 'resolved' | 'declined' | 'rejected';
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
  mapData: BattleMapData | null;
  event: ReactiveDamageEvent;
  choice: ReactiveDamageRetaliationChoice;
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
// Mapless encounters retain the existing theater-of-the-mind visibility rule.
// A populated but incomplete map rejects rather than inventing line of sight.
// ============================================================================

function getLineOfSight(
  mapData: BattleMapData | null,
  retaliator: CombatCharacter,
  attacker: CombatCharacter,
): boolean | null {
  if (!mapData) return true;

  const retaliatorTile = mapData.tiles.get(`${retaliator.position.x}-${retaliator.position.y}`);
  const attackerTile = mapData.tiles.get(`${attacker.position.x}-${attacker.position.y}`);
  if (!retaliatorTile || !attackerTile) return null;

  return hasLineOfSight(retaliatorTile, attackerTile, mapData);
}

function createHellishRebukeCost(retaliator: CombatCharacter, castAtLevel: number) {
  const ability = createAbilityFromSpell(
    HELLISH_REBUKE,
    retaliator as unknown as PlayerCharacter,
  );
  return { ...ability.cost, spellSlotLevel: castAtLevel };
}

function describeDefense(
  damageAfterSave: number,
  finalDamage: number,
): ReactiveDamageDefense {
  if (damageAfterSave > 0 && finalDamage === 0) return 'immunity';
  if (finalDamage < damageAfterSave) return 'resistance';
  if (finalDamage > damageAfterSave) return 'vulnerability';
  return 'none';
}

function triggeringReceipt(event: ReactiveDamageEvent) {
  return {
    raw: event.rawDamage,
    final: event.finalDamage,
    hpBefore: event.hpBefore,
    hpAfter: event.hpAfter,
  };
}

// ============================================================================
// Eligibility Before Player Choice
// ============================================================================
// The queue calls this before opening a prompt. Invalid triggers therefore do
// not spend resources and do not ask the player to choose an impossible spell.
// ============================================================================

export function getReactiveDamageRetaliationEligibility(
  input: Omit<ResolveReactiveDamageRetaliationInput, 'choice' | 'damageRng' | 'saveRng'>,
): ReactiveDamageRetaliationEligibility {
  const distanceFeet = getCharacterDistance(input.retaliator, input.attacker) * 5;
  const rejected = (
    reason: ReactiveDamageRetaliationReason,
    lineOfSight = true,
  ): ReactiveDamageRetaliationEligibility => ({ eligible: false, reason, distanceFeet, lineOfSight });

  if ((input.resolvedEventIds ?? []).includes(input.event.id)) return rejected('duplicate_event', false);
  if (
    input.event.boundary !== 'post_hp'
    || input.event.sourceCharacterId !== input.attacker.id
    || input.event.targetCharacterId !== input.retaliator.id
  ) return rejected('invalid_event_ownership', false);
  if (!input.event.isHit) return rejected('attack_missed');
  if (input.event.finalDamage <= 0) return rejected('no_triggering_damage');
  if (input.event.targetDownedAfter || input.event.hpAfter <= 0) return rejected('retaliator_downed');
  if (input.event.targetIncapacitatedAfter || isIncapacitated(input.retaliator)) return rejected('retaliator_incapacitated');
  if (distanceFeet > HELLISH_REBUKE_RANGE_FEET) return rejected('attacker_out_of_range');

  const lineOfSight = getLineOfSight(input.mapData, input.retaliator, input.attacker);
  if (lineOfSight === null) return rejected('missing_map_tile', false);
  if (!lineOfSight) return rejected('attacker_not_visible', false);

  const damageEffect = HELLISH_REBUKE_DAMAGE_EFFECT;
  if (
    !damageEffect?.damage.dice
    || !damageEffect.condition.saveType
    || HELLISH_REBUKE.castingTime.unit !== 'reaction'
  ) return rejected('missing_canonical_spell_data', lineOfSight);

  const castAtLevel = input.castAtLevel ?? HELLISH_REBUKE_BASE_LEVEL;
  if (!Number.isInteger(castAtLevel) || castAtLevel < HELLISH_REBUKE_BASE_LEVEL || castAtLevel > 9) {
    return rejected('invalid_cast_level', lineOfSight);
  }

  if (!canAffordActionCost(input.retaliator, createHellishRebukeCost(input.retaliator, castAtLevel))) {
    return rejected('reaction_or_slot_unavailable', lineOfSight);
  }

  return { eligible: true, reason: 'resolved', distanceFeet, lineOfSight };
}

// ============================================================================
// Explicit Choice And Retaliation Resolution
// ============================================================================
// Every non-duplicate event is claimed exactly once, including decline and
// rejection. The triggering receipt is reported but never applied here.
// ============================================================================

export function resolveReactiveDamageRetaliation(
  input: ResolveReactiveDamageRetaliationInput,
): ReactiveDamageRetaliationReceipt {
  const resolvedEventIds = input.resolvedEventIds ?? [];
  const eligibility = getReactiveDamageRetaliationEligibility(input);
  const eventIds = eligibility.reason === 'duplicate_event'
    ? [...resolvedEventIds]
    : [...resolvedEventIds, input.event.id];
  const trigger = triggeringReceipt(input.event);
  const committedOrder = [
    `1. Post-HP event ${input.event.id} records ${input.event.finalDamage} ${input.event.damageType} damage; retaliator HP ${input.event.hpBefore} -> ${input.event.hpAfter}.`,
  ];

  if (!eligibility.eligible) {
    return {
      outcome: 'rejected',
      reason: eligibility.reason,
      attacker: input.attacker,
      retaliator: input.retaliator,
      resolvedEventIds: eventIds,
      distanceFeet: eligibility.distanceFeet,
      lineOfSight: eligibility.lineOfSight,
      triggeringDamage: trigger,
      order: eligibility.reason === 'duplicate_event'
        ? ['Duplicate post-HP event rejected before prompt, payment, or retaliation.']
        : [...committedOrder, `2. Reaction rejected: ${eligibility.reason}.`],
    };
  }

  if (input.choice === 'decline') {
    return {
      outcome: 'declined',
      reason: 'declined',
      attacker: input.attacker,
      retaliator: input.retaliator,
      resolvedEventIds: eventIds,
      distanceFeet: eligibility.distanceFeet,
      lineOfSight: eligibility.lineOfSight,
      triggeringDamage: trigger,
      order: [...committedOrder, '2. Hellish Rebuke is declined; Reaction and spell slot remain ready.'],
    };
  }

  const damageEffect = HELLISH_REBUKE_DAMAGE_EFFECT!;
  const castAtLevel = input.castAtLevel ?? HELLISH_REBUKE_BASE_LEVEL;
  const paidRetaliator = consumeActionCost(
    input.retaliator,
    createHellishRebukeCost(input.retaliator, castAtLevel),
  );
  const saveDC = calculateSpellDC(paidRetaliator);
  const save = rollSavingThrow(
    input.attacker,
    damageEffect.condition.saveType!,
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
    resolvedEventIds: eventIds,
    distanceFeet: eligibility.distanceFeet,
    lineOfSight: eligibility.lineOfSight,
    triggeringDamage: trigger,
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
      ...committedOrder,
      `2. Hellish Rebuke accepted; retaliator spends Reaction and level-${castAtLevel} slot.`,
      `3. Attacker Dexterity save ${save.total} vs DC ${saveDC} ${save.success ? 'succeeds' : 'fails'}; ${rolledDamage} becomes ${damageAfterSave}.`,
      `4. ${defense === 'none' ? 'No matching defense' : defense} changes retaliation to ${finalDamage}; attacker HP ${input.attacker.currentHP} -> ${damagedAttacker.currentHP}.`,
    ],
  };
}
