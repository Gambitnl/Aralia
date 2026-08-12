/**
 * This file proves the production Dispel Magic resolver pays real resources,
 * resolves 2024 level checks, and cleans only owner-linked ongoing spell state.
 *
 * The tests use canonical spell JSON plus live CombatCharacter effect records.
 * They cover automatic cleanup, higher-level success and failure, unrelated
 * effect preservation, and the instantaneous/no-effect rejection boundary.
 */

import { describe, expect, it } from 'vitest';
import blessData from '@/data/spells/level-1/bless.json';
import mageArmorData from '@/data/spells/level-1/mage-armor.json';
import dispelMagicData from '@/data/spells/level-3/dispel-magic.json';
import fireballData from '@/data/spells/level-3/fireball.json';
import greaterInvisibilityData from '@/data/spells/level-4/greater-invisibility.json';
import type { Spell } from '../../../../types/spells';
import { createMockCombatCharacter } from '../../../../utils/core';
import { resolveDispelMagic } from '../dispelMagicResolution';

// ============================================================================
// Canonical Spells And Live Effect Fixture
// ============================================================================
// The ongoing record uses every owner field consumed by real concentration
// cleanup. Mage Armor shares the target but has a different spell id and must
// therefore survive a successful Dispel Magic.
// ============================================================================

const BLESS = blessData as unknown as Spell;
const MAGE_ARMOR = mageArmorData as unknown as Spell;
const DISPEL_MAGIC = dispelMagicData as unknown as Spell;
const FIREBALL = fireballData as unknown as Spell;
const GREATER_INVISIBILITY = greaterInvisibilityData as unknown as Spell;

const DISPELLER_ID = 'dispel-test-dispeller';
const TARGET_ID = 'dispel-test-target';
const STATUS_ID = 'dispel-test-status';

function d20(face: number): () => number {
  return () => (face - 0.5) / 20;
}

function createFixture(targetSpell: Spell) {
  const dispeller = createMockCombatCharacter({
    id: DISPELLER_ID,
    level: 7,
    spellcastingAbility: 'intelligence',
    spellSlots: { level_3: { current: 1, max: 1 } },
    stats: {
      strength: 10,
      dexterity: 10,
      constitution: 10,
      intelligence: 18,
      wisdom: 10,
      charisma: 10,
      baseInitiative: 0,
      speed: 30,
      cr: '7',
    },
    modifiers: { advantage: [], disadvantage: [], bonuses: [] },
  });
  const target = createMockCombatCharacter({
    id: TARGET_ID,
    spellcastingAbility: 'intelligence',
    statusEffects: [{
      id: STATUS_ID,
      name: targetSpell.name,
      type: 'buff',
      duration: 10,
      source: targetSpell.name,
      sourceSpellId: targetSpell.id,
      sourceCasterId: TARGET_ID,
      modifiers: { savingThrowBonusDice: '1d4' },
      visualEffect: targetSpell.id,
    }],
    conditions: [{
      name: targetSpell.name,
      duration: { type: 'minutes', value: 1 },
      appliedTurn: 0,
      source: targetSpell.id,
      sourceCasterId: TARGET_ID,
    }],
    activeEffects: [{
      id: 'unrelated-mage-armor',
      spellId: MAGE_ARMOR.id,
      casterId: TARGET_ID,
      sourceName: MAGE_ARMOR.name,
      type: 'buff',
      duration: { type: 'hours', value: 8 },
      startTime: 0,
      mechanics: { baseAC: 13, baseACFormula: '13 + dex_mod' },
    }],
    concentratingOn: {
      spellId: targetSpell.id,
      spellName: targetSpell.name,
      spellLevel: targetSpell.level,
      startedTurn: 0,
      effectIds: [STATUS_ID],
      canDropAsFreeAction: true,
    },
  });

  return { dispeller, target };
}

function resolve(targetSpell: Spell, face?: number) {
  const fixture = createFixture(targetSpell);
  return resolveDispelMagic({
    characters: [fixture.dispeller, fixture.target],
    activeLightSources: [],
    dispellerId: DISPELLER_ID,
    targetCharacterId: TARGET_ID,
    sourceCasterId: TARGET_ID,
    dispelMagicSpell: DISPEL_MAGIC,
    targetSpell,
    castAtLevel: 3,
    rng: face ? d20(face) : undefined,
  });
}

// ============================================================================
// Cost, Check, Cleanup, And Invalid Boundaries
// ============================================================================
// State assertions accompany each result reason so narration cannot pass while
// the effect owner, slot ledger, or visual status remains incorrect.
// ============================================================================

describe('resolveDispelMagic', () => {
  it('automatically ends a lower-level spell after paying Action and slot', () => {
    const result = resolve(BLESS);
    const dispeller = result.characters.find(character => character.id === DISPELLER_ID);
    const target = result.characters.find(character => character.id === TARGET_ID);

    expect(result.status).toBe('dispelled');
    expect(result.reason).toBe('automatic_end');
    expect(dispeller?.actionEconomy.action.used).toBe(true);
    expect(dispeller?.spellSlots?.level_3.current).toBe(0);
    expect(target?.statusEffects).toHaveLength(0);
    expect(target?.conditions).toHaveLength(0);
    expect(target?.concentratingOn).toBeUndefined();
    expect(target?.activeEffects?.map(effect => effect.spellId)).toEqual([MAGE_ARMOR.id]);
    expect(result.cleanup).toMatchObject({
      statusEffects: 1,
      conditions: 1,
      activeEffects: 0,
      concentrationLinks: 1,
    });
  });

  it('ends a higher-level spell when the canonical ability check succeeds', () => {
    const result = resolve(GREATER_INVISIBILITY, 16);
    const target = result.characters.find(character => character.id === TARGET_ID);

    expect(result.reason).toBe('ability_check_succeeded');
    expect(result.check).toMatchObject({ roll: 16, total: 20 });
    expect(result.checkDc).toBe(14);
    expect(target?.statusEffects).toHaveLength(0);
    expect(target?.conditions).toHaveLength(0);
    expect(target?.activeEffects?.[0]?.spellId).toBe(MAGE_ARMOR.id);
  });

  it('keeps a higher-level spell on a failed check while retaining payment', () => {
    const result = resolve(GREATER_INVISIBILITY, 5);
    const dispeller = result.characters.find(character => character.id === DISPELLER_ID);
    const target = result.characters.find(character => character.id === TARGET_ID);

    expect(result.status).toBe('failed');
    expect(result.reason).toBe('ability_check_failed');
    expect(result.check).toMatchObject({ roll: 5, total: 9 });
    expect(dispeller?.actionEconomy.action.used).toBe(true);
    expect(dispeller?.spellSlots?.level_3.current).toBe(0);
    expect(target?.statusEffects).toHaveLength(1);
    expect(target?.conditions).toHaveLength(1);
    expect(target?.concentratingOn?.spellId).toBe(GREATER_INVISIBILITY.id);
    expect(result.cleanup).toEqual({
      statusEffects: 0,
      conditions: 0,
      activeEffects: 0,
      lightSources: 0,
      concentrationLinks: 0,
    });
  });

  it('rejects instantaneous spell aftermath before paying any resource', () => {
    const fixture = createFixture(BLESS);
    const result = resolveDispelMagic({
      characters: [fixture.dispeller, fixture.target],
      activeLightSources: [],
      dispellerId: DISPELLER_ID,
      targetCharacterId: TARGET_ID,
      sourceCasterId: TARGET_ID,
      dispelMagicSpell: DISPEL_MAGIC,
      targetSpell: FIREBALL,
      castAtLevel: 3,
    });
    const dispeller = result.characters.find(character => character.id === DISPELLER_ID);

    expect(result).toMatchObject({ status: 'rejected', reason: 'instantaneous_spell' });
    expect(dispeller?.actionEconomy.action.used).toBe(false);
    expect(dispeller?.spellSlots?.level_3.current).toBe(1);
  });
});

