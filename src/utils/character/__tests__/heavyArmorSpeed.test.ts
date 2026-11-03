/**
 * This file tests how heavy armor affects a character's walking speed.
 *
 * Normally, wearing heavy armor without meeting its Strength requirement reduces
 * a character's walking speed by 10 feet. Dwarven subraces (Hill, Mountain, and
 * Runeward Dwarf) carry the structured `ignoresHeavyArmorSpeedPenalty` flag so
 * `calculateCharacterSpeed` preserves their full 30-foot walking speed without
 * parsing free-text trait strings.
 *
 * Called by: Vitest character stat test suite
 * Depends on: `calculateCharacterSpeed` in `stats.ts`, dwarf race data, and `characterReducer.ts`
 */

import { describe, expect, it } from 'vitest';
import { calculateCharacterSpeed } from '../stats';
import { createMockPlayerCharacter } from '../../core';
import { HILL_DWARF_DATA } from '../../../data/races/hill_dwarf';
import { MOUNTAIN_DWARF_DATA } from '../../../data/races/mountain_dwarf';
import { MARK_OF_WARDING_DWARF_DATA } from '../../../data/races/runeward_dwarf';
import { ALL_ITEMS } from '../../../data/items';
import { characterReducer } from '../../../state/reducers/characterReducer';
import type { GameState, PlayerCharacter, Race } from '../../../types';

// ============================================================================
// Test Fixtures
// ============================================================================
// Builds a mock character wearing Chain Mail (Strength 13 requirement) with a
// configurable race and Strength score so each test isolates the race flag.
// ============================================================================

const human: Race = { id: 'human', name: 'Human', description: '', traits: ['Speed: 30 feet'] };

const equipped = (race: Race = MOUNTAIN_DWARF_DATA, strength = 12): PlayerCharacter => createMockPlayerCharacter({
  id: 'armor-fit-review',
  race,
  feats: [],
  speed: 30,
  finalAbilityScores: { Strength: strength, Dexterity: 13, Constitution: 10, Intelligence: 10, Wisdom: 10, Charisma: 10 },
  equippedItems: { Torso: { ...ALL_ITEMS.chain_mail } },
});

// ============================================================================
// Heavy Armor Speed Exemption Tests (GG-168)
// ============================================================================
// Verifies that all three dwarf races keep 30 ft in heavy armor with low
// Strength, while humans and unflagged races drop by 10 ft to 20 ft.
// ============================================================================

describe('authored heavy-armor speed exceptions', () => {
  it('keeps Hill, Mountain, and Runeward Dwarf speed at 30 ft with Strength below Chain Mail requirement', () => {
    expect(HILL_DWARF_DATA.ignoresHeavyArmorSpeedPenalty).toBe(true);
    expect(MOUNTAIN_DWARF_DATA.ignoresHeavyArmorSpeedPenalty).toBe(true);
    expect(MARK_OF_WARDING_DWARF_DATA.ignoresHeavyArmorSpeedPenalty).toBe(true);

    expect(calculateCharacterSpeed(equipped(HILL_DWARF_DATA, 10))).toBe(30);
    expect(calculateCharacterSpeed(equipped(MOUNTAIN_DWARF_DATA, 12))).toBe(30);
    expect(calculateCharacterSpeed(equipped(MARK_OF_WARDING_DWARF_DATA, 10))).toBe(30);
  });

  it('reduces a human in the same heavy armor by 10 ft when Strength is below the requirement', () => {
    expect(calculateCharacterSpeed(equipped(human, 10))).toBe(20);
  });

  it('does not infer an exception from a race name or free-text trait without the structured flag', () => {
    const namedDwarf: Race = {
      ...human,
      id: 'unverified-dwarf',
      name: 'Mountain Dwarf',
      traits: ['Speed: 30 feet. Your speed is not reduced by wearing heavy armor.'],
    };
    expect(calculateCharacterSpeed(equipped(namedDwarf))).toBe(20);
  });

  it('preserves full movement when the ordinary Strength requirement is met', () => {
    expect(calculateCharacterSpeed(equipped(human, 13))).toBe(30);
  });

  it('keeps the exception through the ordinary equipment reducer, without changing the owned armor', () => {
    const armor = { ...ALL_ITEMS.chain_mail, quantity: 1, acquiredAt: 1234, sourceId: 'earned:smithy' };
    const member = equipped();
    member.equippedItems = {};
    const state = { party: [member], inventory: [armor], gold: 7.75, characterSheetModal: { isOpen: false, character: null } } as GameState;
    const patch = characterReducer(state, { type: 'EQUIP_ITEM', payload: { characterId: member.id, itemId: armor.id, inventoryIndex: 0, inventoryItem: armor } });
    expect(patch.party?.[0].speed).toBe(30);
    expect(patch.party?.[0].equippedItems.Torso).toBe(armor);
    expect(patch.inventory).toEqual([]);
    expect(patch.gold).toBeUndefined();
    expect(state.inventory).toEqual([armor]);
  });
});
