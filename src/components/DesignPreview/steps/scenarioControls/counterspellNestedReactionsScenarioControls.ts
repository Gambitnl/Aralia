// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 04/10/2026, 00:42:28
 * Dependents: components/DesignPreview/steps/PreviewCombatScenarios.tsx, components/DesignPreview/steps/scenarioControls/PreviewCombatScenarioControlRegistry.ts
 * Imports: 12 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import { createMockSpellSlots } from '@/utils/core/factories';
/**
 * This file owns the deterministic controls for Counterspell & Nested Reactions.
 *
 * Each action rebuilds one three-mage board, pays Fireball and Counterspell
 * through the shared action-economy helpers, resolves the live 2024
 * Counterspell Constitution save, and applies a resolving Fireball through the
 * shared save, scaling, damage, and HP helpers. The host renders the returned
 * combatants in 2D and 3D, so reactions, slots, HP, and stack order never live
 * only in the teaching log.
 *
 * Called by: the Tactical Sandbox scenario-control registry.
 * Depends on: canonical Counterspell and Fireball data plus shared spell cost,
 * saving throw, slot, scaling, damage, and hit-point helpers.
 */

import counterspellData from '@/data/spells/level-3/counterspell.json';
import fireballData from '@/data/spells/level-3/fireball.json';
import type { PlayerCharacter, SpellSlots } from '../../../../types';
import type { AbilityCost, CombatCharacter } from '../../../../types/combat';
import type { DamageEffect, Spell } from '../../../../types/spells';
import { isDamageEffect } from '../../../../types/spells';
import { createAbilityFromSpell } from '../../../../utils/character/spellAbilityFactory';
import {
  calculateSaveDamage,
  calculateSpellDC,
  rollSavingThrow,
} from '../../../../utils/character/savingThrowUtils';
import {
  canAffordActionCost,
  consumeActionCost,
  resetEconomy,
} from '../../../../utils/combat/actionEconomyUtils';
import { rollDamage } from '../../../../systems/dice/rollers';
import { applyDamageAndCheckDowned } from '../../../../utils/combat/deathSaveUtils';
import { ScalingEngine } from '../../../../systems/spells/mechanics/ScalingEngine';
import {
  getSpellInterruptionDistanceFeet,
  hasSpellInterruptionVisibility,
  isWithinSpellInterruptionRange,
} from '../../../../hooks/useAbilitySystem';
import type {
  PreviewCombatScenarioControlApplication,
  PreviewCombatScenarioControlModule,
  PreviewCombatScenarioControlPatch,
} from './PreviewCombatScenarioControlTypes';

// ============================================================================
// Canonical Spells And Auditable Board Facts
// ============================================================================
// These JSON imports are the same live spell records used by the normal spell
// loader. Counterspell is the 2024 form: it always asks the triggering caster
// for a Constitution save and preserves the interrupted spell slot.
// ============================================================================

const COUNTERSPELL = counterspellData as unknown as Spell;
const FIREBALL = fireballData as unknown as Spell;
const FIREBALL_DAMAGE_EFFECT = FIREBALL.effects.find(isDamageEffect);

export const COUNTERSPELL_NESTED_ORIGINAL_CASTER_ID = 'counterspell_nested_reactions-original-caster';
export const COUNTERSPELL_NESTED_COUNTERSPELLER_ID = 'counterspell_nested_reactions-counterspeller';
export const COUNTERSPELL_NESTED_RESPONDER_ID = 'counterspell_nested_reactions-nested-responder';

export const COUNTERSPELL_NESTED_ORIGINAL_START = { x: 4, y: 5 } as const;
export const COUNTERSPELL_NESTED_COUNTERSPELLER_START = { x: 10, y: 5 } as const;
export const COUNTERSPELL_NESTED_RESPONDER_START = { x: 5, y: 8 } as const;
export const COUNTERSPELL_NESTED_OUT_OF_RANGE_CASTER_START = { x: 2, y: 5 } as const;
export const COUNTERSPELL_NESTED_OUT_OF_RANGE_REACTOR_START = { x: 15, y: 5 } as const;

export const COUNTERSPELL_NESTED_FIREBALL_LEVEL = 4;
export const COUNTERSPELL_NESTED_COUNTERSPELL_LEVEL = COUNTERSPELL.level;
export const COUNTERSPELL_NESTED_TARGET_HP = 60;
export const COUNTERSPELL_NESTED_FIREBALL_FORMULA = '9d6';
export const COUNTERSPELL_NESTED_FIREBALL_DAMAGE = 36;

const FIXED_DAMAGE_FACE = 4;
const FIXED_FIREBALL_SAVE_D20 = 5;
const FIXED_COUNTERSPELL_FAILURE_D20 = 5;
const FIXED_COUNTERSPELL_SUCCESS_D20 = 16;

interface CounterspellNestedActors {
  originalCaster: CombatCharacter;
  counterspeller: CombatCharacter;
  nestedResponder: CombatCharacter;
}

interface FireballResolution {
  originalCaster: CombatCharacter;
  target: CombatCharacter;
  summary: string;
}

// ============================================================================
// Canonical Metadata And Cost Guards
// ============================================================================
// Missing live metadata rejects the proof loudly. No scenario-owned fallback
// spell, dice expression, or action price is allowed to replace canonical data.
// ============================================================================

function requireFireballDamageEffect(): DamageEffect | null {
  if (!FIREBALL_DAMAGE_EFFECT || !FIREBALL_DAMAGE_EFFECT.damage.dice) {
    return null;
  }
  return FIREBALL_DAMAGE_EFFECT;
}

function createSpellCost(
  spell: Spell,
  caster: CombatCharacter,
  castAtLevel: number,
): AbilityCost {
  // Combat characters and sheet characters are two projections of one caster.
  // The shared adapter reads the real casting time, then this selected level
  // tells the slot ledger which inventory row pays for the cast.
  const ability = createAbilityFromSpell(
    spell,
    caster as unknown as PlayerCharacter,
  );
  return {
    ...ability.cost,
    spellSlotLevel: castAtLevel,
  };
}

function createD20RandomSource(face: number): () => number {
  return () => (face - 0.5) / 20;
}

function createD6RandomSource(face: number): () => number {
  return () => (face - 0.5) / 6;
}

// ============================================================================
// Repeatable Three-Actor Setup
// ============================================================================
// Every button starts from the same resources. This makes each stack readable
// in isolation and ensures the existing Reset Board button restores this exact
// authored state without depending on which proof was clicked previously.
// ============================================================================

function requireActors(
  application: PreviewCombatScenarioControlApplication,
): CounterspellNestedActors | null {
  const originalCaster = application.snapshot.characters.find(
    character => character.id === COUNTERSPELL_NESTED_ORIGINAL_CASTER_ID,
  );
  const counterspeller = application.snapshot.characters.find(
    character => character.id === COUNTERSPELL_NESTED_COUNTERSPELLER_ID,
  );
  const nestedResponder = application.snapshot.characters.find(
    character => character.id === COUNTERSPELL_NESTED_RESPONDER_ID,
  );

  return originalCaster && counterspeller && nestedResponder
    ? { originalCaster, counterspeller, nestedResponder }
    : null;
}

function createOriginalCasterSlots(): SpellSlots {
  return createMockSpellSlots({
    level_4: { current: 1, max: 1 },
  });
}

function createCounterspellSlots(): SpellSlots {
  return createMockSpellSlots({
    level_3: { current: 1, max: 1 },
  });
}

function readSlot(character: CombatCharacter, level: number): string {
  const key = `level_${level}` as keyof SpellSlots;
  const slot = character.spellSlots?.[key];
  return slot ? `${slot.current}/${slot.max}` : 'unavailable';
}

function withAuditableOriginalName(character: CombatCharacter): CombatCharacter {
  const actionState = character.actionEconomy.action.used ? 'Action spent' : 'Action ready';
  return {
    ...character,
    name: `Ember Mage · L4 ${readSlot(character, 4)} · ${actionState}`,
  };
}

function withAuditableCounterName(character: CombatCharacter): CombatCharacter {
  const reactionState = character.actionEconomy.reaction.used ? 'Reaction spent' : 'Reaction ready';
  return {
    ...character,
    name: `Aegis Mage · L3 ${readSlot(character, 3)} · ${reactionState}`,
  };
}

function withAuditableResponderName(character: CombatCharacter): CombatCharacter {
  const reactionState = character.actionEconomy.reaction.used ? 'Reaction spent' : 'Reaction ready';
  return {
    ...character,
    name: `Ward Ally · L3 ${readSlot(character, 3)} · ${reactionState}`,
  };
}

function prepareActors(actors: CounterspellNestedActors): CounterspellNestedActors {
  const originalCaster = resetEconomy({
    ...actors.originalCaster,
    position: { ...COUNTERSPELL_NESTED_ORIGINAL_START },
    team: 'enemy',
    level: 7,
    spellcastingAbility: 'intelligence',
    spellSlots: createOriginalCasterSlots(),
    stats: {
      ...actors.originalCaster.stats,
      intelligence: 18,
      constitution: 10,
      saveBonuses: undefined,
    },
    savingThrowProficiencies: [],
    statusEffects: [],
    conditions: [],
    abilities: [],
  });

  const counterspeller = resetEconomy({
    ...actors.counterspeller,
    position: { ...COUNTERSPELL_NESTED_COUNTERSPELLER_START },
    team: 'player',
    level: 5,
    spellcastingAbility: 'intelligence',
    spellSlots: createCounterspellSlots(),
    currentHP: COUNTERSPELL_NESTED_TARGET_HP,
    maxHP: COUNTERSPELL_NESTED_TARGET_HP,
    tempHP: 0,
    stats: {
      ...actors.counterspeller.stats,
      intelligence: 16,
      constitution: 10,
      dexterity: 8,
      saveBonuses: undefined,
    },
    savingThrowProficiencies: [],
    resistances: [],
    immunities: [],
    vulnerabilities: [],
    statusEffects: [],
    conditions: [],
    abilities: [],
  });

  const nestedResponder = resetEconomy({
    ...actors.nestedResponder,
    position: { ...COUNTERSPELL_NESTED_RESPONDER_START },
    team: 'enemy',
    level: 7,
    spellcastingAbility: 'intelligence',
    spellSlots: createCounterspellSlots(),
    stats: {
      ...actors.nestedResponder.stats,
      intelligence: 18,
      constitution: 10,
      saveBonuses: undefined,
    },
    savingThrowProficiencies: [],
    statusEffects: [],
    conditions: [],
    abilities: [],
  });

  return {
    originalCaster: withAuditableOriginalName(originalCaster),
    counterspeller: withAuditableCounterName(counterspeller),
    nestedResponder: withAuditableResponderName(nestedResponder),
  };
}

function replaceActors(
  characters: CombatCharacter[],
  actors: CounterspellNestedActors,
): CombatCharacter[] {
  const replacements = new Map<string, CombatCharacter>([
    [actors.originalCaster.id, actors.originalCaster],
    [actors.counterspeller.id, actors.counterspeller],
    [actors.nestedResponder.id, actors.nestedResponder],
  ]);
  return characters.map(character => replacements.get(character.id) ?? character);
}

// ============================================================================
// Slot Preservation And Original Spell Resolution
// ============================================================================
// The production hook pays a spell before opening the reaction window. When
// 2024 Counterspell interrupts that spell, only its slot is restored; the
// Action or Reaction remains wasted. This local adapter follows that same
// order so the board exposes the real runtime contract without adding a second
// browser-only resource ledger.
// ============================================================================

function restoreInterruptedSpellSlot(
  caster: CombatCharacter,
  level: number,
): CombatCharacter {
  const slotKey = `level_${level}` as keyof SpellSlots;
  const slot = caster.spellSlots?.[slotKey];
  if (!slot || slot.current >= slot.max) {
    return caster;
  }

  return {
    ...caster,
    spellSlots: createMockSpellSlots({
      ...caster.spellSlots,
      [slotKey]: {
        ...slot,
        current: slot.current + 1,
      },
    }),
  };
}

function resolveFireball(
  originalCaster: CombatCharacter,
  target: CombatCharacter,
  effect: DamageEffect,
): FireballResolution {
  // Fireball's real higher-slot rule expands 8d6 to 9d6 at level 4. Fixed die
  // faces make the comparison deterministic while retaining the shared parser.
  const scaledFormula = ScalingEngine.scaleEffect(
    effect.damage.dice,
    effect.scaling,
    COUNTERSPELL_NESTED_FIREBALL_LEVEL,
    originalCaster.level,
    FIREBALL.level,
  );
  const rolledDamage = rollDamage(
    scaledFormula,
    false,
    1,
    createD6RandomSource(FIXED_DAMAGE_FACE),
  );
  const fireballDc = calculateSpellDC(originalCaster);
  const targetSave = rollSavingThrow(
    target,
    effect.condition.saveType ?? 'Dexterity',
    fireballDc,
    undefined,
    { damageType: 'fire', tags: ['magic', 'area'] },
    undefined,
    { rng: createD20RandomSource(FIXED_FIREBALL_SAVE_D20) },
  );
  const finalDamage = calculateSaveDamage(
    rolledDamage,
    targetSave,
    effect.condition.saveEffect ?? 'half',
  );
  const damagedTarget = applyDamageAndCheckDowned(target, finalDamage);

  return {
    originalCaster,
    target: damagedTarget,
    summary: `${effect.damage.dice} → ${scaledFormula}; fixed d6 ${FIXED_DAMAGE_FACE} = ${rolledDamage} Fire. Aegis save d20 ${FIXED_FIREBALL_SAVE_D20} - 1 = ${targetSave.total} vs DC ${fireballDc} fails; HP ${target.currentHP} → ${damagedTarget.currentHP}.`,
  };
}

function payOriginalFireball(
  actors: CounterspellNestedActors,
): CounterspellNestedActors | null {
  const cost = createSpellCost(
    FIREBALL,
    actors.originalCaster,
    COUNTERSPELL_NESTED_FIREBALL_LEVEL,
  );
  if (!canAffordActionCost(actors.originalCaster, cost)) {
    return null;
  }

  return {
    ...actors,
    originalCaster: consumeActionCost(actors.originalCaster, cost),
  };
}

function payCounterspell(
  reactor: CombatCharacter,
): CombatCharacter | null {
  const cost = createSpellCost(
    COUNTERSPELL,
    reactor,
    COUNTERSPELL_NESTED_COUNTERSPELL_LEVEL,
  );
  return canAffordActionCost(reactor, cost)
    ? consumeActionCost(reactor, cost)
    : null;
}

// ============================================================================
// Four Deterministic Stack Outcomes
// ============================================================================
// Each outcome follows last-in, first-out resolution. The logs number declared
// stack entries and then name the order they resolve, making payment and slot
// restoration auditable without asking the player to infer hidden hook state.
// ============================================================================

function resolveSuccessfulCounterspell(
  application: PreviewCombatScenarioControlApplication,
): PreviewCombatScenarioControlPatch {
  const found = requireActors(application);
  const effect = requireFireballDamageEffect();
  if (!found || !effect) {
    return { logMessage: 'Counterspell proof skipped because its actors or canonical spell metadata are unavailable.' };
  }

  const paidOriginal = payOriginalFireball(prepareActors(found));
  if (!paidOriginal) {
    return { logMessage: 'Fireball declaration rejected before the Counterspell window because its Action or level-4 slot is unavailable.' };
  }
  const paidCounterspeller = payCounterspell(paidOriginal.counterspeller);
  if (!paidCounterspeller) {
    return { logMessage: 'Counterspell declaration rejected because its Reaction or level-3 slot is unavailable.' };
  }

  const counterDc = calculateSpellDC(paidCounterspeller);
  const originalSave = rollSavingThrow(
    paidOriginal.originalCaster,
    COUNTERSPELL.interruptionState?.saveType ?? 'Constitution',
    counterDc,
    undefined,
    undefined,
    undefined,
    { rng: createD20RandomSource(FIXED_COUNTERSPELL_FAILURE_D20) },
  );
  const restoredOriginal = restoreInterruptedSpellSlot(
    paidOriginal.originalCaster,
    COUNTERSPELL_NESTED_FIREBALL_LEVEL,
  );
  const actors = {
    ...paidOriginal,
    originalCaster: withAuditableOriginalName(restoredOriginal),
    counterspeller: withAuditableCounterName(paidCounterspeller),
  };

  return {
    characters: replaceActors(application.snapshot.characters, actors),
    logMessage: `Stack 1: Ember Mage declares level-4 Fireball (Action and L4 paid). Stack 2: Aegis Mage declares level-3 Counterspell (Reaction and L3 paid). Resolve 2: Ember Mage CON d20 ${FIXED_COUNTERSPELL_FAILURE_D20} + 0 = ${originalSave.total} vs DC ${counterDc} fails, so Fireball has no effect. Resolve 1 stops: Action remains spent, L4 is restored by Counterspell's 2024 slot policy, Aegis keeps L3 0/1 and Reaction spent, HP stays ${actors.counterspeller.currentHP}/${actors.counterspeller.maxHP}.`,
  };
}

function resolveCounterspellFailure(
  application: PreviewCombatScenarioControlApplication,
): PreviewCombatScenarioControlPatch {
  const found = requireActors(application);
  const effect = requireFireballDamageEffect();
  if (!found || !effect) {
    return { logMessage: 'Counterspell proof skipped because its actors or canonical spell metadata are unavailable.' };
  }

  const paidOriginal = payOriginalFireball(prepareActors(found));
  if (!paidOriginal) {
    return { logMessage: 'Fireball declaration rejected before the Counterspell window because its Action or level-4 slot is unavailable.' };
  }
  const paidCounterspeller = payCounterspell(paidOriginal.counterspeller);
  if (!paidCounterspeller) {
    return { logMessage: 'Counterspell declaration rejected because its Reaction or level-3 slot is unavailable.' };
  }

  const counterDc = calculateSpellDC(paidCounterspeller);
  const originalSave = rollSavingThrow(
    paidOriginal.originalCaster,
    COUNTERSPELL.interruptionState?.saveType ?? 'Constitution',
    counterDc,
    undefined,
    undefined,
    undefined,
    { rng: createD20RandomSource(FIXED_COUNTERSPELL_SUCCESS_D20) },
  );
  const fireball = resolveFireball(
    paidOriginal.originalCaster,
    paidCounterspeller,
    effect,
  );
  const actors = {
    ...paidOriginal,
    originalCaster: withAuditableOriginalName(fireball.originalCaster),
    counterspeller: withAuditableCounterName(fireball.target),
  };

  return {
    characters: replaceActors(application.snapshot.characters, actors),
    logMessage: `Stack 1: level-4 Fireball pays Action and L4. Stack 2: level-3 Counterspell pays Reaction and L3; 2024 Counterspell does not auto-succeed against an equal or lower spell. Resolve 2: Ember Mage CON d20 ${FIXED_COUNTERSPELL_SUCCESS_D20} + 0 = ${originalSave.total} vs DC ${counterDc} succeeds, so Counterspell fails. Resolve 1: Fireball resolves; ${fireball.summary} Final resources: Ember L4 0/1 and Action spent; Aegis L3 0/1 and Reaction spent.`,
  };
}

function resolveNestedCounterspell(
  application: PreviewCombatScenarioControlApplication,
): PreviewCombatScenarioControlPatch {
  const found = requireActors(application);
  const effect = requireFireballDamageEffect();
  if (!found || !effect) {
    return { logMessage: 'Nested Counterspell proof skipped because its actors or canonical spell metadata are unavailable.' };
  }

  const paidOriginal = payOriginalFireball(prepareActors(found));
  if (!paidOriginal) {
    return { logMessage: 'Fireball declaration rejected before the reaction stack because its Action or level-4 slot is unavailable.' };
  }
  const paidCounterspeller = payCounterspell(paidOriginal.counterspeller);
  const paidResponder = payCounterspell(paidOriginal.nestedResponder);
  if (!paidCounterspeller || !paidResponder) {
    return { logMessage: 'Nested stack rejected because one Counterspell caster lacks a Reaction or level-3 slot.' };
  }

  const nestedDc = calculateSpellDC(paidResponder);
  const firstCounterspellSave = rollSavingThrow(
    paidCounterspeller,
    COUNTERSPELL.interruptionState?.saveType ?? 'Constitution',
    nestedDc,
    undefined,
    undefined,
    undefined,
    { rng: createD20RandomSource(FIXED_COUNTERSPELL_FAILURE_D20) },
  );
  const restoredFirstCounterspeller = restoreInterruptedSpellSlot(
    paidCounterspeller,
    COUNTERSPELL_NESTED_COUNTERSPELL_LEVEL,
  );
  const fireball = resolveFireball(
    paidOriginal.originalCaster,
    restoredFirstCounterspeller,
    effect,
  );
  const actors = {
    originalCaster: withAuditableOriginalName(fireball.originalCaster),
    counterspeller: withAuditableCounterName(fireball.target),
    nestedResponder: withAuditableResponderName(paidResponder),
  };

  return {
    characters: replaceActors(application.snapshot.characters, actors),
    logMessage: `Stack 1: Ember Mage declares level-4 Fireball (Action and L4 paid). Stack 2: Aegis Mage declares Counterspell (Reaction and L3 paid). Stack 3: Ward Ally declares Counterspell against that Counterspell (Reaction and L3 paid). Resolve 3: Aegis CON d20 ${FIXED_COUNTERSPELL_FAILURE_D20} + 0 = ${firstCounterspellSave.total} vs DC ${nestedDc} fails; Stack 2 is interrupted, its L3 is restored, but its Reaction remains spent. Resolve 1: the original Fireball now resolves; ${fireball.summary} Final resources: Ember L4 0/1; Aegis L3 1/1 and Reaction spent; Ward L3 0/1 and Reaction spent.`,
  };
}

function resolveUnavailableCounterspell(
  application: PreviewCombatScenarioControlApplication,
): PreviewCombatScenarioControlPatch {
  const found = requireActors(application);
  const effect = requireFireballDamageEffect();
  if (!found || !effect) {
    return { logMessage: 'Unavailable-resource proof skipped because its actors or canonical spell metadata are unavailable.' };
  }

  const prepared = prepareActors(found);
  const unavailableCounterspeller = withAuditableCounterName({
    ...prepared.counterspeller,
    actionEconomy: {
      ...prepared.counterspeller.actionEconomy,
      reaction: {
        ...prepared.counterspeller.actionEconomy.reaction,
        used: true,
      },
    },
    spellSlots: createMockSpellSlots({
      ...prepared.counterspeller.spellSlots,
      level_3: { current: 0, max: 1 },
    }),
  });
  const unavailableActors = {
    ...prepared,
    counterspeller: unavailableCounterspeller,
  };
  const paidOriginal = payOriginalFireball(unavailableActors);
  if (!paidOriginal) {
    return { logMessage: 'Fireball declaration rejected before the unavailable-resource proof could open.' };
  }

  const counterCost = createSpellCost(
    COUNTERSPELL,
    unavailableCounterspeller,
    COUNTERSPELL_NESTED_COUNTERSPELL_LEVEL,
  );
  if (canAffordActionCost(unavailableCounterspeller, counterCost)) {
    return { logMessage: 'Unavailable-resource proof aborted because the canonical cost gate unexpectedly accepted Counterspell.' };
  }

  const fireball = resolveFireball(
    paidOriginal.originalCaster,
    unavailableCounterspeller,
    effect,
  );
  const actors = {
    ...paidOriginal,
    originalCaster: withAuditableOriginalName(fireball.originalCaster),
    counterspeller: withAuditableCounterName(fireball.target),
  };

  return {
    characters: replaceActors(application.snapshot.characters, actors),
    logMessage: `Counterspell offer rejected before payment: Aegis already has Reaction spent and L3 0/1, so no new reaction, slot, save, or interruption effect is invented. The declared level-4 Fireball resolves normally; ${fireball.summary} Ward Ally remains L3 1/1 with Reaction ready.`,
  };
}

// ============================================================================
// Visibility, Range, And Player-Choice Rejections
// ============================================================================
// These branches stop before Counterspell payment. They use the same
// production visibility and feet-range helpers as the live reaction window,
// then resolve the already-paid Fireball exactly once against canonical HP.
// ============================================================================

function resolveSightObstructedCounterspell(
  application: PreviewCombatScenarioControlApplication,
): PreviewCombatScenarioControlPatch {
  const found = requireActors(application);
  const effect = requireFireballDamageEffect();
  if (!found || !effect) {
    return { logMessage: 'Sight-obstructed proof skipped because its actors or canonical spell metadata are unavailable.' };
  }

  // Invisible is live creature state read by the shared Counterspell
  // visibility gate. It blocks the reaction without inventing a wall that
  // would also make the original Fireball target illegal.
  const prepared = prepareActors(found);
  const unseenOriginal = {
    ...prepared.originalCaster,
    name: `${prepared.originalCaster.name} · Invisible`,
    statusEffects: [{
      id: 'invisible',
      name: 'Invisible',
      type: 'buff' as const,
      duration: 1,
      source: 'CS27 sight-obstructed proof',
    }],
  };
  const sightActors = { ...prepared, originalCaster: unseenOriginal };
  const paidOriginal = payOriginalFireball(sightActors);
  if (!paidOriginal) {
    return { logMessage: 'Fireball declaration rejected before the sight-obstructed reaction window could open.' };
  }

  // Counterspell must never be offered while the triggering caster is unseen.
  // The counterspeller therefore retains both Reaction and slot.
  if (hasSpellInterruptionVisibility(
    paidOriginal.counterspeller,
    paidOriginal.originalCaster,
    application.snapshot.mapData,
  )) {
    return { logMessage: 'Sight-obstructed proof aborted because the production visibility gate unexpectedly accepted the unseen caster.' };
  }

  const fireball = resolveFireball(
    paidOriginal.originalCaster,
    paidOriginal.counterspeller,
    effect,
  );
  const actors = {
    ...paidOriginal,
    originalCaster: withAuditableOriginalName(fireball.originalCaster),
    counterspeller: withAuditableCounterName(fireball.target),
  };
  actors.originalCaster = {
    ...actors.originalCaster,
    name: `${actors.originalCaster.name} · Invisible`,
  };

  return {
    characters: replaceActors(application.snapshot.characters, actors),
    logMessage: `Counterspell offer rejected before payment: Ember Mage is Invisible, so the production visibility gate does not offer Aegis a reaction. Aegis keeps Reaction ready and L3 1/1. The already-declared level-4 Fireball resolves exactly once; ${fireball.summary}`,
  };
}

function resolveOutOfRangeCounterspell(
  application: PreviewCombatScenarioControlApplication,
): PreviewCombatScenarioControlPatch {
  const found = requireActors(application);
  const effect = requireFireballDamageEffect();
  if (!found || !effect) {
    return { logMessage: 'Out-of-range proof skipped because its actors or canonical spell metadata are unavailable.' };
  }

  // Both actors stay on the authored board. Their thirteen-cell separation is
  // 65 feet, just beyond Counterspell's live 60-foot reaction boundary.
  const prepared = prepareActors(found);
  const rangedActors = {
    ...prepared,
    originalCaster: {
      ...prepared.originalCaster,
      position: { ...COUNTERSPELL_NESTED_OUT_OF_RANGE_CASTER_START },
    },
    counterspeller: {
      ...prepared.counterspeller,
      position: { ...COUNTERSPELL_NESTED_OUT_OF_RANGE_REACTOR_START },
    },
  };
  const paidOriginal = payOriginalFireball(rangedActors);
  if (!paidOriginal) {
    return { logMessage: 'Fireball declaration rejected before the out-of-range reaction window could open.' };
  }

  const rangeFeet = COUNTERSPELL.interruptionState?.rangeFeet
    ?? COUNTERSPELL.castingTrigger?.maxRangeFeet
    ?? COUNTERSPELL.range.distance
    ?? 0;
  const distanceFeet = getSpellInterruptionDistanceFeet(
    paidOriginal.counterspeller,
    paidOriginal.originalCaster,
  );
  if (isWithinSpellInterruptionRange(
    paidOriginal.counterspeller,
    paidOriginal.originalCaster,
    rangeFeet,
  )) {
    return { logMessage: 'Out-of-range proof aborted because the production range gate unexpectedly accepted the distant caster.' };
  }

  const fireball = resolveFireball(
    paidOriginal.originalCaster,
    paidOriginal.counterspeller,
    effect,
  );
  const actors = {
    ...paidOriginal,
    originalCaster: withAuditableOriginalName(fireball.originalCaster),
    counterspeller: withAuditableCounterName(fireball.target),
  };
  actors.counterspeller = {
    ...actors.counterspeller,
    name: `${actors.counterspeller.name} · ${distanceFeet} ft away`,
  };

  return {
    characters: replaceActors(application.snapshot.characters, actors),
    logMessage: `Counterspell offer rejected before payment: Aegis is ${distanceFeet} feet from Ember, beyond the canonical ${rangeFeet}-foot range. Aegis keeps Reaction ready and L3 1/1. The already-declared level-4 Fireball resolves exactly once; ${fireball.summary}`,
  };
}

function resolveDeclinedCounterspell(
  application: PreviewCombatScenarioControlApplication,
): PreviewCombatScenarioControlPatch {
  const found = requireActors(application);
  const effect = requireFireballDamageEffect();
  if (!found || !effect) {
    return { logMessage: 'Declined-reaction proof skipped because its actors or canonical spell metadata are unavailable.' };
  }

  // A null choice from the live Reaction prompt means the player declined.
  // No Counterspell transaction exists, so only Fireball pays and resolves.
  const paidOriginal = payOriginalFireball(prepareActors(found));
  if (!paidOriginal) {
    return { logMessage: 'Fireball declaration rejected before the voluntary reaction choice could open.' };
  }
  const fireball = resolveFireball(
    paidOriginal.originalCaster,
    paidOriginal.counterspeller,
    effect,
  );
  const actors = {
    ...paidOriginal,
    originalCaster: withAuditableOriginalName(fireball.originalCaster),
    counterspeller: withAuditableCounterName(fireball.target),
  };

  return {
    characters: replaceActors(application.snapshot.characters, actors),
    logMessage: `Counterspell reaction offered, then voluntarily declined. No Counterspell entry, save, Reaction, or slot payment is created; Aegis keeps Reaction ready and L3 1/1. The already-declared level-4 Fireball resolves exactly once; ${fireball.summary}`,
  };
}

// ============================================================================
// Control Routing And Registration
// ============================================================================
// The seven buttons are actions because they each represent a complete isolated
// stack. False default values are inert during board initialization.
// ============================================================================

function applyCounterspellNestedControl(
  application: PreviewCombatScenarioControlApplication,
): PreviewCombatScenarioControlPatch {
  if (application.value === false) {
    return { logMessage: '' };
  }
  if (application.value !== true) {
    return { logMessage: `Counterspell control ${application.controlId} requires an action trigger.` };
  }

  if (application.controlId === 'counterspell-interrupts') {
    return resolveSuccessfulCounterspell(application);
  }
  if (application.controlId === 'counterspell-save-succeeds') {
    return resolveCounterspellFailure(application);
  }
  if (application.controlId === 'nested-counterspell') {
    return resolveNestedCounterspell(application);
  }
  if (application.controlId === 'reject-unavailable-counterspell') {
    return resolveUnavailableCounterspell(application);
  }
  if (application.controlId === 'reject-sight-obstructed-counterspell') {
    return resolveSightObstructedCounterspell(application);
  }
  if (application.controlId === 'reject-out-of-range-counterspell') {
    return resolveOutOfRangeCounterspell(application);
  }
  if (application.controlId === 'decline-counterspell') {
    return resolveDeclinedCounterspell(application);
  }

  return { logMessage: `Unknown Counterspell & Nested Reactions control: ${application.controlId}.` };
}

const counterspellNestedReactionsScenarioControls: PreviewCombatScenarioControlModule = {
  scenarioId: 'counterspell_nested_reactions',
  controls: [
    {
      id: 'counterspell-interrupts',
      label: 'Counterspell interrupts Fireball',
      description: 'Spend Aegis Mage\'s Reaction and level-3 slot, fail Ember Mage\'s Constitution save, and stop Fireball while preserving its level-4 slot.',
      kind: 'action',
      defaultValue: false,
    },
    {
      id: 'counterspell-save-succeeds',
      label: 'Caster beats Counterspell save',
      description: 'Use level-3 Counterspell against level-4 Fireball, succeed on the canonical 2024 Constitution save, and let Fireball resolve.',
      kind: 'action',
      defaultValue: false,
    },
    {
      id: 'nested-counterspell',
      label: 'Counter the Counterspell',
      description: 'Put two Counterspells above Fireball, resolve last-in first-out, preserve the interrupted first Counterspell slot, and let Fireball resolve.',
      kind: 'action',
      defaultValue: false,
    },
    {
      id: 'reject-unavailable-counterspell',
      label: 'Reject unavailable Counterspell',
      description: 'Start with Aegis Mage\'s Reaction spent and level-3 slot empty, reject the response before payment, and resolve only Fireball.',
      kind: 'action',
      defaultValue: false,
    },
    {
      id: 'reject-sight-obstructed-counterspell',
      label: 'Reject unseen-caster Counterspell',
      description: 'Make Ember Mage Invisible, reject Counterspell at the production visibility gate, preserve Aegis resources, and resolve only Fireball.',
      kind: 'action',
      defaultValue: false,
    },
    {
      id: 'reject-out-of-range-counterspell',
      label: 'Reject 65-foot Counterspell',
      description: 'Place Aegis 65 feet from Ember, reject the reaction beyond Counterspell\'s 60-foot range, preserve Aegis resources, and resolve only Fireball.',
      kind: 'action',
      defaultValue: false,
    },
    {
      id: 'decline-counterspell',
      label: 'Decline Counterspell reaction',
      description: 'Voluntarily close the eligible reaction window without payment, then resolve the original Fireball exactly once.',
      kind: 'action',
      defaultValue: false,
    },
  ],
  applyControl: applyCounterspellNestedControl,
};

export default counterspellNestedReactionsScenarioControls;
