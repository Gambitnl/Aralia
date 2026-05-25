import fs from 'fs';
import path from 'path';

import { describe, it, expect, vi } from 'vitest';
import { createPlayerCombatCharacter } from '../combatUtils';
import { createMockGameState, createMockPlayerCharacter } from '../../factories';

/**
 * This file proves that premade character data survives the conversion into
 * combat-ready characters.
 *
 * The combat simulator does not use premade JSON directly. It first converts a
 * player character into the lighter combat shape used by the battle map, so
 * these tests protect armor, weapon range, spell slots, and spell abilities at
 * that conversion boundary.
 *
 * Called by: Vitest focused package checks for premade combat fixtures.
 * Depends on: createPlayerCombatCharacter and the public premade character JSON.
 */

// Mock getAbilityModifierValue locally to avoid dependencies on external utils
vi.mock('../../character/statUtils', () => ({
  getAbilityModifierValue: (score: number) => Math.floor((score - 10) / 2)
}));

// Mock buildHitPointDicePools
vi.mock('../../character/characterUtils', () => ({
  buildHitPointDicePools: () => []
}));

// We only need a partial implementation of weaponUtils for our mock testing
vi.mock('../../character/weaponUtils', () => ({
  isWeaponProficient: () => true
}));

// We also need to mock createAbilityFromSpell
vi.mock('../../character/spellAbilityFactory', () => ({
  createAbilityFromSpell: () => ({ id: 'mock_spell_ability', name: 'Mock Spell' })
}));


describe('combatUtils: createPlayerCombatCharacter premade loadout', () => {
  it('should map armorClass to AC and baseAC', () => {
    const player = createMockPlayerCharacter({
      armorClass: 16
    });

    const combatChar = createPlayerCombatCharacter(player);

    expect(combatChar.armorClass).toBe(16);
    expect(combatChar.baseAC).toBe(16);
  });

  it('should parse ranged weapon range property correctly', () => {
    const player = createMockPlayerCharacter({
      equippedItems: {
        MainHand: {
          id: 'longbow',
          name: 'Longbow',
          type: 'weapon',
          category: 'Martial Ranged Weapon',
          damageDice: '1d8',
          damageType: 'piercing',
          properties: ['ammunition', 'heavy', 'range:150/600', 'two-handed']
        }
      } as any
    });

    const combatChar = createPlayerCombatCharacter(player);

    // Range 150 ft means 150 / 5 = 30 tiles range
    const attackAbility = combatChar.abilities.find(a => a.id === 'attack_main');
    expect(attackAbility).toBeDefined();
    expect(attackAbility?.range).toBe(30);
  });
});




describe('combatUtils: higher level caster fixtures', () => {
  it('should be able to reach a level 2 and level 3 spell slot on the actual dev fixtures', () => {
    // Read the actual fixture file from disk
    const fixturePath = path.join(process.cwd(), 'public', 'premade-characters', 'dev_maelis_quill_lvl5.json');
    const fixtureData = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));

    // The fixture stores spell ids, while combat conversion expects a lookup table
    // similar to the spell registry used by the app.
    const spellContext: Record<string, any> = {};
    const fixtureSpellIds = new Set<string>([
      ...fixtureData.spellbook.cantrips,
      ...fixtureData.spellbook.knownSpells,
      ...fixtureData.spellbook.preparedSpells
    ]);

    // Supplying every known fixture spell keeps the test focused on conversion
    // behavior instead of producing warning noise for spells that exist in the
    // fixture spellbook but are not currently prepared.
    fixtureSpellIds.forEach((spellId: string) => {
      spellContext[spellId] = { id: spellId, name: spellId };
    });

    const combatChar = createPlayerCombatCharacter(fixtureData, spellContext);

    // Validate spell slots mapped correctly
    expect(combatChar.spellSlots?.level_2.max).toBe(3);
    expect(combatChar.spellSlots?.level_3.max).toBe(2);

    // Abilities should include the prepared spells
    const spellAbilities = combatChar.abilities.filter(a => a.id === 'mock_spell_ability');

    // Combat conversion currently creates abilities for every unique spell id in
    // cantrips, known spells, and prepared spells once spell data is available.
    const expectedSpellCount = fixtureSpellIds.size;
    expect(spellAbilities.length).toBe(expectedSpellCount);
  });
});
