/**
 * This file proves marker #894: Dispel Magic can end an arcane glyph without
 * anybody rolling Arcana, and the ward ends in the same state a hand disarm
 * leaves it in.
 *
 * It uses the canonical Dispel Magic record and a live CombatCharacter so the
 * Action and slot payment is the real one, not a stub. Coverage: automatic end
 * at or above the ward's level, the DC 10 + level check both ways above it,
 * mechanical traps rejected, and the failure path leaving the glyph armed and
 * untriggered.
 */

import { describe, expect, it } from 'vitest';
import dispelMagicData from '@/data/spells/level-3/dispel-magic.json';
import type { Spell } from '../../../types/spells';
import { createMockCombatCharacter } from '../../../utils/core';
import { dispelGlyph, getGlyphSpellLevel } from '../arcaneGlyphSystem';
import type { Trap } from '../types';

const DISPEL_MAGIC = dispelMagicData as unknown as Spell;

/** Forces a specific d20 face through the shared check helper's rng hook. */
function d20(face: number): () => number {
  return () => (face - 0.5) / 20;
}

function createGlyph(overrides: Partial<Trap> = {}): Trap {
  return {
    id: 'glyph-of-warding',
    name: 'Glyph of Warding',
    type: 'magical',
    detectionDC: 15,
    disarmDC: 15,
    triggerCondition: 'glyph',
    effect: { damage: { count: 5, sides: 8, bonus: 0 }, damageType: 'fire' },
    resetable: false,
    isDisarmed: false,
    isTriggered: false,
    ...overrides,
  };
}

/**
 * SpellSlots requires every level, so the fixture fills all nine and the tests
 * only ever read the third-level entry the dispel actually spends.
 */
function fullSlots() {
  const slots = {} as NonNullable<ReturnType<typeof createMockCombatCharacter>['spellSlots']>;
  for (let level = 1; level <= 9; level += 1) {
    slots[`level_${level}` as keyof typeof slots] = { current: 1, max: 1 };
  }
  return slots;
}

function createDispeller() {
  return createMockCombatCharacter({
    id: 'glyph-dispeller',
    level: 7,
    spellcastingAbility: 'intelligence',
    spellSlots: fullSlots(),
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
}

describe('arcaneGlyphSystem dispelGlyph (#894 Spell System wiring)', () => {
  it('derives a ward level from the disarm DC when none is authored', () => {
    expect(getGlyphSpellLevel(createGlyph({ disarmDC: 13 }))).toBe(2);
    expect(getGlyphSpellLevel(createGlyph({ disarmDC: 15 }))).toBe(3);
    expect(getGlyphSpellLevel(createGlyph({ disarmDC: 17 }))).toBe(4);
  });

  it('ends a ward automatically when the slot matches its level', () => {
    const glyph = createGlyph({ spellLevel: 3 });

    const resolution = dispelGlyph({
      dispeller: createDispeller(),
      dispelMagicSpell: DISPEL_MAGIC,
      glyph,
      castAtLevel: 3,
    });

    expect(resolution.status).toBe('dispelled');
    expect(resolution.reason).toBe('automatic_end');
    expect(resolution.glyph.isDisarmed).toBe(true);
    // The input record is never mutated; callers get a new trap back.
    expect(glyph.isDisarmed).toBe(false);
  });

  it('rolls DC 10 + ward level for a ward above the slot, and can succeed', () => {
    const resolution = dispelGlyph({
      dispeller: createDispeller(),
      dispelMagicSpell: DISPEL_MAGIC,
      glyph: createGlyph({ spellLevel: 5 }),
      castAtLevel: 3,
      rng: d20(20),
    });

    expect(resolution.checkDc).toBe(15);
    expect(resolution.status).toBe('dispelled');
    expect(resolution.reason).toBe('ability_check_succeeded');
    expect(resolution.glyph.isDisarmed).toBe(true);
  });

  it('leaves a ward armed and untriggered when the check fails', () => {
    const resolution = dispelGlyph({
      dispeller: createDispeller(),
      dispelMagicSpell: DISPEL_MAGIC,
      glyph: createGlyph({ spellLevel: 5 }),
      castAtLevel: 3,
      rng: d20(1),
    });

    expect(resolution.status).toBe('failed');
    expect(resolution.reason).toBe('ability_check_failed');
    expect(resolution.glyph.isDisarmed).toBe(false);
    // Unlike a botched Arcana disarm, a missed dispel never sets the ward off.
    expect(resolution.glyph.isTriggered).toBe(false);
  });

  it('spends the Action and the spell slot on the attempt', () => {
    const dispeller = createDispeller();
    const before = dispeller.spellSlots?.level_3?.current;

    const resolution = dispelGlyph({
      dispeller,
      dispelMagicSpell: DISPEL_MAGIC,
      glyph: createGlyph({ spellLevel: 5 }),
      castAtLevel: 3,
      rng: d20(1),
    });

    expect(before).toBe(1);
    expect(resolution.dispeller.spellSlots?.level_3?.current).toBe(0);
    expect(resolution.dispeller.actionEconomy.action.used).toBe(true);
  });

  it('refuses mechanical traps and already-disarmed wards without paying', () => {
    const mechanical = dispelGlyph({
      dispeller: createDispeller(),
      dispelMagicSpell: DISPEL_MAGIC,
      glyph: createGlyph({ type: 'mechanical' }),
      castAtLevel: 3,
    });
    expect(mechanical.status).toBe('rejected');
    expect(mechanical.reason).toBe('not_magical');
    expect(mechanical.dispeller.actionEconomy.action.used).toBe(false);

    const spent = dispelGlyph({
      dispeller: createDispeller(),
      dispelMagicSpell: DISPEL_MAGIC,
      glyph: createGlyph({ isDisarmed: true }),
      castAtLevel: 3,
    });
    expect(spent.reason).toBe('already_disarmed');
  });

  it('refuses a slot below the spell own level', () => {
    const resolution = dispelGlyph({
      dispeller: createDispeller(),
      dispelMagicSpell: DISPEL_MAGIC,
      glyph: createGlyph(),
      castAtLevel: 1,
    });

    expect(resolution.status).toBe('rejected');
    expect(resolution.reason).toBe('invalid_slot_level');
  });
});
