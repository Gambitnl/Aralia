/**
 * This file proves the Counterspell & Nested Reactions controls use canonical
 * combat state instead of a teaching-only stack ledger.
 *
 * The fixture mirrors the rendered three-mage board. Assertions cover Action,
 * Reaction, and slot payment; 2024 Counterspell Constitution saves; interrupted
 * slot preservation; last-in-first-out nesting; Fireball scaling and HP; and
 * rejection before an unavailable response can invent any payment or effect.
 */

import { describe, expect, it } from 'vitest';
import type { CombatCharacter } from '../../../../../types/combat';
import { createMockCombatCharacter } from '../../../../../utils/core';
import counterspellNestedReactionsScenarioControls, {
  COUNTERSPELL_NESTED_COUNTERSPELLER_ID,
  COUNTERSPELL_NESTED_COUNTERSPELLER_START,
  COUNTERSPELL_NESTED_FIREBALL_DAMAGE,
  COUNTERSPELL_NESTED_FIREBALL_FORMULA,
  COUNTERSPELL_NESTED_ORIGINAL_CASTER_ID,
  COUNTERSPELL_NESTED_ORIGINAL_START,
  COUNTERSPELL_NESTED_OUT_OF_RANGE_CASTER_START,
  COUNTERSPELL_NESTED_OUT_OF_RANGE_REACTOR_START,
  COUNTERSPELL_NESTED_RESPONDER_ID,
  COUNTERSPELL_NESTED_RESPONDER_START,
  COUNTERSPELL_NESTED_TARGET_HP,
} from '../counterspellNestedReactionsScenarioControls';
import type { PreviewCombatScenarioControlSnapshot } from '../PreviewCombatScenarioControlTypes';

// ============================================================================
// Authored Three-Mage Snapshot
// ============================================================================
// The original caster owns one level-4 Fireball slot. Each responder owns one
// level-3 Counterspell slot and a ready Reaction. An unrelated actor protects
// the patch boundary from accidentally replacing the whole combat roster.
// ============================================================================

function createSnapshot(): PreviewCombatScenarioControlSnapshot {
  const originalCaster = createMockCombatCharacter({
    id: COUNTERSPELL_NESTED_ORIGINAL_CASTER_ID,
    name: 'Ember Mage',
    position: { ...COUNTERSPELL_NESTED_ORIGINAL_START },
    level: 7,
    spellcastingAbility: 'intelligence',
    spellSlots: {
      level_4: { current: 1, max: 1 },
    },
  });
  const counterspeller = createMockCombatCharacter({
    id: COUNTERSPELL_NESTED_COUNTERSPELLER_ID,
    name: 'Aegis Mage',
    position: { ...COUNTERSPELL_NESTED_COUNTERSPELLER_START },
    currentHP: COUNTERSPELL_NESTED_TARGET_HP,
    maxHP: COUNTERSPELL_NESTED_TARGET_HP,
    spellcastingAbility: 'intelligence',
    spellSlots: {
      level_3: { current: 1, max: 1 },
    },
  });
  const nestedResponder = createMockCombatCharacter({
    id: COUNTERSPELL_NESTED_RESPONDER_ID,
    name: 'Ward Ally',
    position: { ...COUNTERSPELL_NESTED_RESPONDER_START },
    level: 7,
    spellcastingAbility: 'intelligence',
    spellSlots: {
      level_3: { current: 1, max: 1 },
    },
  });

  return {
    mapData: null,
    characters: [
      originalCaster,
      counterspeller,
      nestedResponder,
      createMockCombatCharacter({ id: 'counterspell-bystander', name: 'Unrelated Bystander' }),
    ],
    activeLightSources: [],
    reactiveTriggers: [],
  };
}

function runAction(controlId: string, snapshot = createSnapshot()) {
  return counterspellNestedReactionsScenarioControls.applyControl({
    controlId,
    value: true,
    snapshot,
  });
}

function findCharacter(characters: CombatCharacter[], id: string): CombatCharacter {
  const character = characters.find(candidate => candidate.id === id);
  if (!character) throw new Error(`Missing Counterspell & Nested Reactions actor ${id}.`);
  return character;
}

// ============================================================================
// Direct, Failed, Nested, And Rejected Stack Outcomes
// ============================================================================
// Each assertion checks returned combat state and the reasoned visible log so
// narration cannot drift from the slot inventory, reaction state, or HP truth.
// ============================================================================

describe('counterspellNestedReactionsScenarioControls', () => {
  it('registers seven inert action controls for the scenario', () => {
    expect(counterspellNestedReactionsScenarioControls.scenarioId)
      .toBe('counterspell_nested_reactions');
    expect(counterspellNestedReactionsScenarioControls.controls).toHaveLength(7);
    expect(counterspellNestedReactionsScenarioControls.controls.every(control => (
      control.kind === 'action' && control.defaultValue === false
    ))).toBe(true);
  });

  it('spends the Counterspell Reaction and slot while interrupting Fireball without damage', () => {
    const result = runAction('counterspell-interrupts');
    const characters = result.characters ?? [];
    const originalCaster = findCharacter(characters, COUNTERSPELL_NESTED_ORIGINAL_CASTER_ID);
    const counterspeller = findCharacter(characters, COUNTERSPELL_NESTED_COUNTERSPELLER_ID);

    expect(originalCaster.actionEconomy.action.used).toBe(true);
    expect(originalCaster.spellSlots?.level_4).toEqual({ current: 1, max: 1 });
    expect(counterspeller.actionEconomy.reaction.used).toBe(true);
    expect(counterspeller.spellSlots?.level_3).toEqual({ current: 0, max: 1 });
    expect(counterspeller.currentHP).toBe(COUNTERSPELL_NESTED_TARGET_HP);
    expect(result.logMessage).toContain('CON d20 5 + 0 = 5 vs DC 14 fails');
    expect(result.logMessage).toContain('Action remains spent, L4 is restored');
  });

  it('lets level-4 Fireball resolve when the caster succeeds on the 2024 Counterspell save', () => {
    const result = runAction('counterspell-save-succeeds');
    const characters = result.characters ?? [];
    const originalCaster = findCharacter(characters, COUNTERSPELL_NESTED_ORIGINAL_CASTER_ID);
    const counterspeller = findCharacter(characters, COUNTERSPELL_NESTED_COUNTERSPELLER_ID);

    expect(originalCaster.spellSlots?.level_4).toEqual({ current: 0, max: 1 });
    expect(counterspeller.spellSlots?.level_3).toEqual({ current: 0, max: 1 });
    expect(counterspeller.actionEconomy.reaction.used).toBe(true);
    expect(counterspeller.currentHP)
      .toBe(COUNTERSPELL_NESTED_TARGET_HP - COUNTERSPELL_NESTED_FIREBALL_DAMAGE);
    expect(result.logMessage).toContain('CON d20 16 + 0 = 16 vs DC 14 succeeds');
    expect(result.logMessage).toContain(`8d6 → ${COUNTERSPELL_NESTED_FIREBALL_FORMULA}`);
    expect(result.logMessage).toContain('2024 Counterspell does not auto-succeed');
  });

  it('resolves the nested Counterspell first and then lets the original Fireball resolve', () => {
    const result = runAction('nested-counterspell');
    const characters = result.characters ?? [];
    const originalCaster = findCharacter(characters, COUNTERSPELL_NESTED_ORIGINAL_CASTER_ID);
    const counterspeller = findCharacter(characters, COUNTERSPELL_NESTED_COUNTERSPELLER_ID);
    const nestedResponder = findCharacter(characters, COUNTERSPELL_NESTED_RESPONDER_ID);

    expect(originalCaster.actionEconomy.action.used).toBe(true);
    expect(originalCaster.spellSlots?.level_4).toEqual({ current: 0, max: 1 });
    expect(counterspeller.actionEconomy.reaction.used).toBe(true);
    expect(counterspeller.spellSlots?.level_3).toEqual({ current: 1, max: 1 });
    expect(nestedResponder.actionEconomy.reaction.used).toBe(true);
    expect(nestedResponder.spellSlots?.level_3).toEqual({ current: 0, max: 1 });
    expect(counterspeller.currentHP)
      .toBe(COUNTERSPELL_NESTED_TARGET_HP - COUNTERSPELL_NESTED_FIREBALL_DAMAGE);
    expect(result.logMessage).toContain('Stack 3: Ward Ally declares Counterspell');
    expect(result.logMessage).toContain('Stack 2 is interrupted, its L3 is restored');
    expect(result.logMessage).toContain('Resolve 1: the original Fireball now resolves');
  });

  it('rejects an unavailable Counterspell before adding payment or an interruption effect', () => {
    const result = runAction('reject-unavailable-counterspell');
    const characters = result.characters ?? [];
    const originalCaster = findCharacter(characters, COUNTERSPELL_NESTED_ORIGINAL_CASTER_ID);
    const counterspeller = findCharacter(characters, COUNTERSPELL_NESTED_COUNTERSPELLER_ID);
    const nestedResponder = findCharacter(characters, COUNTERSPELL_NESTED_RESPONDER_ID);

    expect(originalCaster.spellSlots?.level_4).toEqual({ current: 0, max: 1 });
    expect(counterspeller.actionEconomy.reaction.used).toBe(true);
    expect(counterspeller.spellSlots?.level_3).toEqual({ current: 0, max: 1 });
    expect(counterspeller.currentHP)
      .toBe(COUNTERSPELL_NESTED_TARGET_HP - COUNTERSPELL_NESTED_FIREBALL_DAMAGE);
    expect(nestedResponder.actionEconomy.reaction.used).toBe(false);
    expect(nestedResponder.spellSlots?.level_3).toEqual({ current: 1, max: 1 });
    expect(result.logMessage).toContain('rejected before payment');
    expect(result.logMessage).toContain('no new reaction, slot, save, or interruption effect is invented');
  });

  it('rejects Counterspell against an unseen caster without spending the ready response', () => {
    const result = runAction('reject-sight-obstructed-counterspell');
    const characters = result.characters ?? [];
    const originalCaster = findCharacter(characters, COUNTERSPELL_NESTED_ORIGINAL_CASTER_ID);
    const counterspeller = findCharacter(characters, COUNTERSPELL_NESTED_COUNTERSPELLER_ID);

    // Invisible is canonical caster state consumed by the production
    // visibility helper. Only the original Fireball transaction may pay.
    expect(originalCaster.statusEffects.map(effect => effect.id)).toContain('invisible');
    expect(originalCaster.actionEconomy.action.used).toBe(true);
    expect(originalCaster.spellSlots?.level_4).toEqual({ current: 0, max: 1 });
    expect(counterspeller.actionEconomy.reaction.used).toBe(false);
    expect(counterspeller.spellSlots?.level_3).toEqual({ current: 1, max: 1 });
    expect(counterspeller.currentHP)
      .toBe(COUNTERSPELL_NESTED_TARGET_HP - COUNTERSPELL_NESTED_FIREBALL_DAMAGE);
    expect(result.logMessage).toContain('production visibility gate');
    expect(result.logMessage).toContain('resolves exactly once');
  });

  it('rejects Counterspell at 65 feet while preserving the ready response', () => {
    const result = runAction('reject-out-of-range-counterspell');
    const characters = result.characters ?? [];
    const originalCaster = findCharacter(characters, COUNTERSPELL_NESTED_ORIGINAL_CASTER_ID);
    const counterspeller = findCharacter(characters, COUNTERSPELL_NESTED_COUNTERSPELLER_ID);

    // Thirteen grid cells are 65 feet. This is the first five-foot step past
    // Counterspell's 60-foot boundary and remains visible on the 16-cell board.
    expect(originalCaster.position).toEqual(COUNTERSPELL_NESTED_OUT_OF_RANGE_CASTER_START);
    expect(counterspeller.position).toEqual(COUNTERSPELL_NESTED_OUT_OF_RANGE_REACTOR_START);
    expect(originalCaster.actionEconomy.action.used).toBe(true);
    expect(originalCaster.spellSlots?.level_4).toEqual({ current: 0, max: 1 });
    expect(counterspeller.actionEconomy.reaction.used).toBe(false);
    expect(counterspeller.spellSlots?.level_3).toEqual({ current: 1, max: 1 });
    expect(counterspeller.currentHP)
      .toBe(COUNTERSPELL_NESTED_TARGET_HP - COUNTERSPELL_NESTED_FIREBALL_DAMAGE);
    expect(result.logMessage).toContain('65 feet from Ember');
    expect(result.logMessage).toContain('canonical 60-foot range');
  });

  it('lets the player decline Counterspell without creating a response transaction', () => {
    const result = runAction('decline-counterspell');
    const characters = result.characters ?? [];
    const originalCaster = findCharacter(characters, COUNTERSPELL_NESTED_ORIGINAL_CASTER_ID);
    const counterspeller = findCharacter(characters, COUNTERSPELL_NESTED_COUNTERSPELLER_ID);

    // A null reaction choice creates no stack entry and spends no response
    // resource. The already-declared Fireball still resolves once.
    expect(originalCaster.actionEconomy.action.used).toBe(true);
    expect(originalCaster.spellSlots?.level_4).toEqual({ current: 0, max: 1 });
    expect(counterspeller.actionEconomy.reaction.used).toBe(false);
    expect(counterspeller.spellSlots?.level_3).toEqual({ current: 1, max: 1 });
    expect(counterspeller.currentHP)
      .toBe(COUNTERSPELL_NESTED_TARGET_HP - COUNTERSPELL_NESTED_FIREBALL_DAMAGE);
    expect(result.logMessage).toContain('voluntarily declined');
    expect(result.logMessage).toContain('No Counterspell entry, save, Reaction, or slot payment');
  });

  it('fails closed when the authored spell source or response target is missing', () => {
    const snapshot = createSnapshot();
    const withoutSource = runAction('decline-counterspell', {
      ...snapshot,
      characters: snapshot.characters.filter(character => (
        character.id !== COUNTERSPELL_NESTED_ORIGINAL_CASTER_ID
      )),
    });
    const withoutTarget = runAction('decline-counterspell', {
      ...snapshot,
      characters: snapshot.characters.filter(character => (
        character.id !== COUNTERSPELL_NESTED_COUNTERSPELLER_ID
      )),
    });

    // Missing actors never produce a partial roster patch, resource payment,
    // or damage effect. The adapter reports why the proof could not start.
    expect(withoutSource.characters).toBeUndefined();
    expect(withoutTarget.characters).toBeUndefined();
    expect(withoutSource.logMessage).toContain('actors or canonical spell metadata are unavailable');
    expect(withoutTarget.logMessage).toContain('actors or canonical spell metadata are unavailable');
  });

  it('replaying the same control rebuilds baseline state instead of applying Fireball twice', () => {
    const snapshot = createSnapshot();
    const first = runAction('decline-counterspell', snapshot);
    const replay = runAction('decline-counterspell', {
      ...snapshot,
      characters: first.characters ?? snapshot.characters,
    });
    const firstTarget = findCharacter(first.characters ?? [], COUNTERSPELL_NESTED_COUNTERSPELLER_ID);
    const replayTarget = findCharacter(replay.characters ?? [], COUNTERSPELL_NESTED_COUNTERSPELLER_ID);

    // CS27 actions are deterministic transactions rather than production event
    // receipts. Repeating one therefore reconstructs 60 HP before resolving,
    // which keeps the visible result at 24 instead of accumulating to 0.
    expect(firstTarget.currentHP).toBe(24);
    expect(replayTarget.currentHP).toBe(24);
    expect(replayTarget.actionEconomy.reaction.used).toBe(false);
    expect(replayTarget.spellSlots?.level_3).toEqual({ current: 1, max: 1 });
  });

  it('keeps false defaults inert and preserves unrelated actors after an action', () => {
    const snapshot = createSnapshot();
    const inert = counterspellNestedReactionsScenarioControls.applyControl({
      controlId: 'nested-counterspell',
      value: false,
      snapshot,
    });
    const resolved = runAction('nested-counterspell', snapshot);

    expect(inert).toEqual({ logMessage: '' });
    expect(resolved.characters?.find(character => character.id === 'counterspell-bystander')?.name)
      .toBe('Unrelated Bystander');
  });
});
