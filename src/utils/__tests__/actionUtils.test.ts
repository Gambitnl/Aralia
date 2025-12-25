
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getDiegeticPlayerActionMessage } from '../actionUtils';
import { PlayerCharacter } from '../../types/character';
import { Item, ItemType } from '../../types/items';

// Define MOCK_ITEMS using vi.hoisted to ensure it's available before mocks
const { MOCK_ITEMS, MOCK_DIRECTION_VECTORS } = vi.hoisted(() => {
    return {
        MOCK_ITEMS: {
            'sword_iron': {
                id: 'sword_iron',
                name: 'Iron Sword',
                description: 'A rusty sword.',
                type: 'weapon', // Using string directly as ItemType enum might not be available in hoisted scope
                icon: 'sword.png'
            },
            'potion_health': {
                id: 'potion_health',
                name: 'Health Potion',
                description: 'Heals wounds.',
                type: 'potion',
                icon: 'potion.png'
            },
            'helm_iron': {
                id: 'helm_iron',
                name: 'Iron Helm',
                description: 'Protects the head.',
                type: 'armor',
                icon: 'helm.png'
            }
        },
        MOCK_DIRECTION_VECTORS: {
            North: { dx: 0, dy: -1, opposite: 'South' },
            South: { dx: 0, dy: 1, opposite: 'North' },
            East: { dx: 1, dy: 0, opposite: 'West' },
            West: { dx: -1, dy: 0, opposite: 'East' }
        }
    };
});


// Mock modules - adjusting paths to be relative to the test file
vi.mock('../../constants', () => ({
  ITEMS: MOCK_ITEMS
}));

vi.mock('../../config/mapConfig', () => ({
  DIRECTION_VECTORS: MOCK_DIRECTION_VECTORS
}));

describe('getDiegeticPlayerActionMessage', () => {
  const mockNpcs = {
    'blacksmith': { id: 'blacksmith', name: 'Blacksmith', description: 'Smiths items.', factionId: 'town', locationId: 'forge', stats: { hp: 10, maxHp: 10, ac: 10 } }
  };
  const mockLocations = {
    'town_square': { id: 'town_square', name: 'Town Square', description: 'Center of town.', coordinates: { x: 0, y: 0 } }
  };
  const mockPlayer: PlayerCharacter = {
    name: 'Hero',
    race: { id: 'human', name: 'Human', description: 'Versatile', traits: [] },
    class: {
      id: 'fighter',
      name: 'Fighter',
      description: 'Fights',
      hitDie: 10,
      primaryAbility: ['strength'],
      savingThrowProficiencies: ['strength', 'constitution'],
      skillProficienciesAvailable: ['athletics'],
      numberOfSkillProficiencies: 2,
      armorProficiencies: ['light', 'medium', 'heavy', 'shields'],
      weaponProficiencies: ['simple', 'martial'],
      features: []
    },
    abilityScores: { strength: 10, dexterity: 10, constitution: 10, intelligence: 10, wisdom: 10, charisma: 10 },
    finalAbilityScores: { strength: 10, dexterity: 10, constitution: 10, intelligence: 10, wisdom: 10, charisma: 10 },
    skills: [],
    hp: 10,
    maxHp: 10,
    armorClass: 10,
    speed: 30,
    darkvisionRange: 0,
    transportMode: 'foot',
    equippedItems: {
      'MainHand': MOCK_ITEMS['sword_iron'] as any, // Cast to avoid TS issues with string type vs Enum in mock
      'Head': MOCK_ITEMS['helm_iron'] as any
    },
    statusEffects: []
  };

  it('should handle "move" with cardinal direction', () => {
    const action = { type: 'move', targetId: 'North' };
    expect(getDiegeticPlayerActionMessage(action, mockNpcs, mockLocations, mockPlayer)).toBe('You head North.');
  });

  it('should handle "move" to specific location', () => {
    const action = { type: 'move', targetId: 'town_square' };
    expect(getDiegeticPlayerActionMessage(action, mockNpcs, mockLocations, mockPlayer)).toBe('You decide to travel to Town Square.');
  });

  it('should fallback generic "move" if target invalid', () => {
    const action = { type: 'move', targetId: 'invalid_loc' };
    expect(getDiegeticPlayerActionMessage(action, mockNpcs, mockLocations, mockPlayer)).toBe('You decide to move.');
  });

  it('should handle "look_around"', () => {
    const action = { type: 'look_around' };
    expect(getDiegeticPlayerActionMessage(action, mockNpcs, mockLocations, mockPlayer)).toBe('You take a moment to survey your surroundings.');
  });

  it('should handle "talk" with valid NPC', () => {
    const action = { type: 'talk', targetId: 'blacksmith' };
    expect(getDiegeticPlayerActionMessage(action, mockNpcs, mockLocations, mockPlayer)).toBe('You approach Blacksmith to speak.');
  });

  it('should fallback generic "talk" if NPC not found', () => {
    const action = { type: 'talk', targetId: 'unknown_npc' };
    expect(getDiegeticPlayerActionMessage(action, mockNpcs, mockLocations, mockPlayer)).toBe('You attempt to speak to someone nearby.');
  });

  it('should handle "take_item" with valid item', () => {
    const action = { type: 'take_item', targetId: 'sword_iron' };
    expect(getDiegeticPlayerActionMessage(action, mockNpcs, mockLocations, mockPlayer)).toBe('You attempt to take the Iron Sword.');
  });

  it('should fallback generic "take_item" if item invalid', () => {
    const action = { type: 'take_item', targetId: 'unknown_item' };
    expect(getDiegeticPlayerActionMessage(action, mockNpcs, mockLocations, mockPlayer)).toBe('You try to pick something up.');
  });

  it('should handle "EQUIP_ITEM" with valid item', () => {
    const action = { type: 'EQUIP_ITEM', payload: { itemId: 'sword_iron' } };
    expect(getDiegeticPlayerActionMessage(action, mockNpcs, mockLocations, mockPlayer)).toBe('You attempt to equip the Iron Sword.');
  });

  it('should fallback generic "EQUIP_ITEM" if item not found', () => {
    const action = { type: 'EQUIP_ITEM', payload: { itemId: 'unknown_item' } };
    expect(getDiegeticPlayerActionMessage(action, mockNpcs, mockLocations, mockPlayer)).toBe('You attempt to equip an item.');
  });

  it('should handle "UNEQUIP_ITEM" with valid slot', () => {
    const action = { type: 'UNEQUIP_ITEM', payload: { slot: 'MainHand' } };
    expect(getDiegeticPlayerActionMessage(action, mockNpcs, mockLocations, mockPlayer)).toBe('You attempt to unequip the Iron Sword.');
  });

  it('should fallback generic "UNEQUIP_ITEM" if slot empty or invalid', () => {
    const action = { type: 'UNEQUIP_ITEM', payload: { slot: 'Ring' } };
    expect(getDiegeticPlayerActionMessage(action, mockNpcs, mockLocations, mockPlayer)).toBe('You attempt to unequip an item.');
  });

  it('should handle "use_item" with valid item', () => {
    const action = { type: 'use_item', payload: { itemId: 'potion_health' } };
    expect(getDiegeticPlayerActionMessage(action, mockNpcs, mockLocations, mockPlayer)).toBe('You use the Health Potion.');
  });

  it('should fallback generic "use_item" if item invalid', () => {
    const action = { type: 'use_item', payload: { itemId: 'unknown_potion' } };
    expect(getDiegeticPlayerActionMessage(action, mockNpcs, mockLocations, mockPlayer)).toBe('You use an item.');
  });

  it('should handle "DROP_ITEM" with valid item', () => {
    const action = { type: 'DROP_ITEM', payload: { itemId: 'sword_iron' } };
    expect(getDiegeticPlayerActionMessage(action, mockNpcs, mockLocations, mockPlayer)).toBe('You drop the Iron Sword.');
  });

  it('should fallback generic "DROP_ITEM" if item invalid', () => {
    const action = { type: 'DROP_ITEM', payload: { itemId: 'unknown' } };
    expect(getDiegeticPlayerActionMessage(action, mockNpcs, mockLocations, mockPlayer)).toBe('You drop an item.');
  });

  it('should return null for system actions like "save_game"', () => {
    const action = { type: 'save_game' };
    expect(getDiegeticPlayerActionMessage(action, mockNpcs, mockLocations, mockPlayer)).toBeNull();
  });

  it('should return generic label message for custom actions', () => {
    const action = { type: 'custom_thing', label: 'Dance' };
    expect(getDiegeticPlayerActionMessage(action, mockNpcs, mockLocations, mockPlayer)).toBe('> Dance');
  });

  it('should return null for unknown actions without label', () => {
    const action = { type: 'unknown_weird_action' };
    expect(getDiegeticPlayerActionMessage(action, mockNpcs, mockLocations, mockPlayer)).toBeNull();
  });

  it('should handle gemini_custom_action with label', () => {
      const action = { type: 'gemini_custom_action', label: 'Do a flip' };
      expect(getDiegeticPlayerActionMessage(action, mockNpcs, mockLocations, mockPlayer)).toBe('You decide to: Do a flip.');
  });

  it('should handle gemini_custom_action without label', () => {
      const action = { type: 'gemini_custom_action' };
      expect(getDiegeticPlayerActionMessage(action, mockNpcs, mockLocations, mockPlayer)).toBe('You decide to try something specific.');
  });
});
