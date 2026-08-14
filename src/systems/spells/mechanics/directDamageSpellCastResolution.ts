// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 13/08/2026, 06:17:27
 * Dependents: components/DesignPreview/steps/scenarioControls/spellSlotsUpcastingScenarioControls.ts
 * Imports: 12 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * Resolves one save-based damage spell against the live combat roster.
 *
 * The transaction validates spell ownership, slot level, turn ownership,
 * targeting, sight, range, action economy, and the exact slot before rolling or
 * changing anything. A legal cast then delegates scaling, saving throws,
 * defenses, and downing to the same shared helpers used by combat commands.
 * This gives scenario adapters and other synchronous callers one atomic route
 * without rebuilding actors or inventing browser-only spell results.
 *
 * Called by: Spell Slots & Upcasting scenario controls and focused mechanics tests.
 * Depends on: spellAbilityFactory, TargetResolver, ScalingEngine, action economy,
 * saving throws, resistance handling, dice rolling, and downed-state helpers.
 */

import type { PlayerCharacter } from '../../../types';
import type {
  Ability,
  AbilityCost,
  BattleMapData,
  CombatCharacter,
  CombatState,
  TurnState,
} from '../../../types/combat';
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
import { rollDamage } from '../../../utils/combat/combatUtils';
import { applyDamageAndCheckDowned } from '../../../utils/combat/deathSaveUtils';
import { ResistanceCalculator } from '../../../utils/combat/resistanceUtils';
import type { ActiveSpellZone } from '../effects';
import { TargetResolver } from '../targeting/TargetResolver';
import { ScalingEngine } from './ScalingEngine';

// ============================================================================
// Public Transaction Contract
// ============================================================================
// Rejections return the original roster by identity. Successful receipts carry
// both the paid caster and resolved target so payment and effect cannot drift.
// This primitive intentionally supports immediate damage effects with a saving
// throw; attack-roll and multi-effect spells remain with the command pipeline.
// ============================================================================

export interface DamageSpellCastAction {
  spell: Spell;
  ability: Ability;
  cost: AbilityCost;
  requestedSlotLevel: number;
}

export interface ResolveDamageSpellCastInput {
  characters: CombatCharacter[];
  mapData: BattleMapData | null;
  turnState: TurnState;
  casterId: string;
  targetId: string;
  action: DamageSpellCastAction;
  spellZones?: ActiveSpellZone[];
  damageRng?: () => number;
  saveRng?: () => number;
}

export type DamageSpellCastRejectionReason =
  | 'missing_actor'
  | 'invalid_slot_level'
  | 'below_base_slot'
  | 'cantrip_slot_forbidden'
  | 'spell_not_eligible'
  | 'off_turn'
  | 'unsupported_damage_spell'
  | 'action_unavailable'
  | 'slot_unavailable'
  | `invalid_target:${string}`;

export interface DamageSpellCastResolution {
  status: 'resolved' | 'rejected';
  reason: 'resolved' | DamageSpellCastRejectionReason;
  characters: CombatCharacter[];
  casterBefore?: CombatCharacter;
  casterAfter?: CombatCharacter;
  targetBefore?: CombatCharacter;
  targetAfter?: CombatCharacter;
  targetRejectionMessage?: string;
  baseFormula?: string;
  scaledFormula?: string;
  rolledDamage: number;
  damageAfterSave: number;
  finalDamage: number;
  saveTotal?: number;
  saveDC?: number;
}

/**
 * Converts canonical spell data into a cast request at one exact slot level.
 * The spell factory remains the source of action type and base spell metadata;
 * only the player's selected slot replaces the factory's base slot cost.
 */
export function createDamageSpellCastAction(
  spell: Spell,
  caster: CombatCharacter,
  requestedSlotLevel: number,
): DamageSpellCastAction {
  const ability = createAbilityFromSpell(
    spell,
    caster as unknown as PlayerCharacter,
  );
  const cost = {
    ...ability.cost,
    spellSlotLevel: requestedSlotLevel,
  };

  return {
    spell,
    ability: { ...ability, cost },
    cost,
    requestedSlotLevel,
  };
}

// ============================================================================
// Canonical State Projections
// ============================================================================
// TargetResolver consumes a complete CombatState. The remaining selection
// fields below are inert and never become a second source of combat truth.
// ============================================================================

function createTargetingState(input: ResolveDamageSpellCastInput): CombatState {
  return {
    isActive: true,
    characters: input.characters,
    turnState: input.turnState,
    selectedCharacterId: input.casterId,
    selectedAbilityId: input.action.ability.id,
    actionMode: 'select',
    validTargets: [],
    validMoves: [],
    combatLog: [],
    reactiveTriggers: [],
    activeLightSources: [],
    spellZones: input.spellZones ?? [],
    mapData: input.mapData,
  } as CombatState;
}

function findSaveDamageEffect(spell: Spell): DamageEffect | null {
  const effect = spell.effects.find(isDamageEffect);
  if (
    !effect?.damage.dice ||
    effect.condition.type !== 'save' ||
    !effect.condition.saveType
  ) {
    return null;
  }
  return effect;
}

function hasEligibleSpell(caster: CombatCharacter, spell: Spell): boolean {
  return caster.abilities.some(ability => (
    ability.id === spell.id && ability.spell?.id === spell.id
  ));
}

function replaceResolvedActors(
  characters: CombatCharacter[],
  caster: CombatCharacter,
  target: CombatCharacter,
): CombatCharacter[] {
  return characters.map(character => {
    if (character.id === caster.id) return caster;
    if (character.id === target.id) return target;
    return character;
  });
}

function readRequestedSlot(caster: CombatCharacter, level: number): number {
  if (level === 0) return Number.POSITIVE_INFINITY;
  const key = `level_${level}` as keyof NonNullable<CombatCharacter['spellSlots']>;
  return caster.spellSlots?.[key]?.current ?? 0;
}

// ============================================================================
// Atomic Save-Based Damage Resolution
// ============================================================================
// Validation is deliberately complete before either deterministic random source
// is called. That proves invalid, repeated, off-turn, or empty-slot requests do
// not roll, pay, move actors, change effects, or touch target HP.
// ============================================================================

export function resolveDamageSpellCast(
  input: ResolveDamageSpellCastInput,
): DamageSpellCastResolution {
  const caster = input.characters.find(character => character.id === input.casterId);
  const target = input.characters.find(character => character.id === input.targetId);
  const reject = (
    reason: DamageSpellCastRejectionReason,
    targetRejectionMessage?: string,
  ): DamageSpellCastResolution => ({
    status: 'rejected',
    reason,
    characters: input.characters,
    casterBefore: caster,
    casterAfter: caster,
    targetBefore: target,
    targetAfter: target,
    targetRejectionMessage,
    rolledDamage: 0,
    damageAfterSave: 0,
    finalDamage: 0,
  });

  if (!caster || !target) {
    return reject('missing_actor');
  }

  const { requestedSlotLevel, spell, cost } = input.action;
  if (!Number.isInteger(requestedSlotLevel) || requestedSlotLevel < 0 || requestedSlotLevel > 9) {
    return reject('invalid_slot_level');
  }

  if (spell.level === 0 && requestedSlotLevel !== 0) {
    return reject('cantrip_slot_forbidden');
  }

  if (spell.level > 0 && requestedSlotLevel < spell.level) {
    return reject('below_base_slot');
  }

  if (!hasEligibleSpell(caster, spell)) {
    return reject('spell_not_eligible');
  }

  if (input.turnState.currentCharacterId !== caster.id) {
    return reject('off_turn');
  }

  const effect = findSaveDamageEffect(spell);
  if (!effect) {
    return reject('unsupported_damage_spell');
  }

  const targetRejection = TargetResolver.getTargetRejectionReason(
    spell.targeting,
    caster,
    target,
    createTargetingState(input),
  );
  if (targetRejection) {
    return reject(
      `invalid_target:${targetRejection.code}`,
      targetRejection.message,
    );
  }

  const actionOnlyCost = { ...cost, spellSlotLevel: 0 };
  if (!canAffordActionCost(caster, actionOnlyCost)) {
    return reject('action_unavailable');
  }

  if (readRequestedSlot(caster, requestedSlotLevel) <= 0) {
    return reject('slot_unavailable');
  }

  const scaledFormula = ScalingEngine.scaleEffect(
    effect.damage.dice,
    effect.scaling,
    requestedSlotLevel,
    caster.level,
    spell.level,
  );
  const rolledDamage = rollDamage(scaledFormula, false, 1, input.damageRng);
  const saveDC = calculateSpellDC(caster);
  const save = rollSavingThrow(
    target,
    effect.condition.saveType,
    saveDC,
    undefined,
    { damageType: effect.damage.type, tags: ['magic', 'area'] },
    undefined,
    { rng: input.saveRng },
  );
  const damageAfterSave = calculateSaveDamage(
    rolledDamage,
    save,
    effect.condition.saveEffect ?? 'half',
  );
  const finalDamage = ResistanceCalculator.applyResistances(
    damageAfterSave,
    effect.damage.type,
    target,
    caster,
    true,
    { spellZones: input.spellZones, characters: input.characters },
  );

  // Payment is created only after all validity gates and resolution inputs are
  // known. The returned roster commits that one payment with one HP transition.
  const paidCaster = consumeActionCost(caster, cost);
  const resolvedTarget = applyDamageAndCheckDowned(target, finalDamage);

  return {
    status: 'resolved',
    reason: 'resolved',
    characters: replaceResolvedActors(input.characters, paidCaster, resolvedTarget),
    casterBefore: caster,
    casterAfter: paidCaster,
    targetBefore: target,
    targetAfter: resolvedTarget,
    baseFormula: effect.damage.dice,
    scaledFormula,
    rolledDamage,
    damageAfterSave,
    finalDamage,
    saveTotal: save.total,
    saveDC,
  };
}
