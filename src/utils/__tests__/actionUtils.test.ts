import { describe, it, expect, vi } from 'vitest';
import { getDiegeticPlayerActionMessage } from '../actionUtils';
import { Action, PlayerCharacter, NPC, Location } from '../../types';

// Mock dependencies
// We mock ../../constants because getDiegeticPlayerActionMessage imports from ../constants
vi.mock('../../constants', () => ({
  ITEMS: {
    'sword_iron': { name: 'Iron Sword' },
    'potion_health': { name: 'Health Potion' }
  }
}));

// We mock ../../config/mapConfig because getDiegeticPlayerActionMessage imports from ../config/mapConfig
vi.mock('../../config/mapConfig', () => ({
  DIRECTION_VECTORS: {
    'North': { dx: 0, dy: -1 },
    'South': { dx: 0, dy: 1 },
    'East': { dx: 1, dy: 0 },
    'West': { dx: -1, dy: 0 }
  }
}));

describe('actionUtils', () => {
  describe('getDiegeticPlayerActionMessage', () => {
    // Shared mock data
    const mockNpcs: Record<string, NPC> = {
      'npc_1': { name: 'Village Elder', id: 'npc_1' } as NPC,
      'npc_2': { name: 'Merchant', id: 'npc_2' } as NPC
    };

    const mockLocations: Record<string, Location> = {
      'loc_1': { name: 'Ancient Ruins', id: 'loc_1' } as Location
    };

    const mockPlayerCharacter = {
      equippedItems: {
        'mainHand': { name: 'Old Dagger', id: 'dagger_old' }
      }
    } as unknown as PlayerCharacter;

    it('should handle movement directions', () => {
      const action: Action = { type: 'move', targetId: 'North' };
      const result = getDiegeticPlayerActionMessage(action, mockNpcs, mockLocations, mockPlayerCharacter);
      expect(result).toBe('You head North.');
    });

    it('should handle movement to specific locations', () => {
      const action: Action = { type: 'move', targetId: 'loc_1' };
      const result = getDiegeticPlayerActionMessage(action, mockNpcs, mockLocations, mockPlayerCharacter);
      expect(result).toBe('You decide to travel to Ancient Ruins.');
    });

    it('should handle generic movement fallback', () => {
      const action: Action = { type: 'move' }; // Missing targetId
      const result = getDiegeticPlayerActionMessage(action, mockNpcs, mockLocations, mockPlayerCharacter);
      expect(result).toBe('You decide to move.');
    });

    it('should handle look_around', () => {
      const action: Action = { type: 'look_around' };
      const result = getDiegeticPlayerActionMessage(action, mockNpcs, mockLocations, mockPlayerCharacter);
      expect(result).toBe('You take a moment to survey your surroundings.');
    });

    it('should handle talking to a known NPC', () => {
      const action: Action = { type: 'talk', targetId: 'npc_1' };
      const result = getDiegeticPlayerActionMessage(action, mockNpcs, mockLocations, mockPlayerCharacter);
      expect(result).toBe('You approach Village Elder to speak.');
    });

    it('should handle talking to an unknown NPC', () => {
      const action: Action = { type: 'talk', targetId: 'unknown_npc' };
      const result = getDiegeticPlayerActionMessage(action, mockNpcs, mockLocations, mockPlayerCharacter);
      expect(result).toBe('You attempt to speak to someone nearby.');
    });

    it('should handle taking a known item', () => {
      const action: Action = { type: 'take_item', targetId: 'sword_iron' };
      const result = getDiegeticPlayerActionMessage(action, mockNpcs, mockLocations, mockPlayerCharacter);
      expect(result).toBe('You attempt to take the Iron Sword.');
    });

    it('should handle taking an unknown item', () => {
      const action: Action = { type: 'take_item', targetId: 'unknown_item' };
      const result = getDiegeticPlayerActionMessage(action, mockNpcs, mockLocations, mockPlayerCharacter);
      expect(result).toBe('You try to pick something up.');
    });

    it('should handle inspect_submap_tile', () => {
      const action: Action = { type: 'inspect_submap_tile' };
      const result = getDiegeticPlayerActionMessage(action, mockNpcs, mockLocations, mockPlayerCharacter);
      expect(result).toBe('You carefully examine the terrain nearby.');
    });

    it('should handle gemini_custom_action with label', () => {
      const action: Action = { type: 'gemini_custom_action', label: 'Dance a jig' };
      const result = getDiegeticPlayerActionMessage(action, mockNpcs, mockLocations, mockPlayerCharacter);
      expect(result).toBe('You decide to: Dance a jig.');
    });

    it('should handle gemini_custom_action without label', () => {
      const action: Action = { type: 'gemini_custom_action' };
      const result = getDiegeticPlayerActionMessage(action, mockNpcs, mockLocations, mockPlayerCharacter);
      expect(result).toBe('You decide to try something specific.');
    });

    it('should handle EQUIP_ITEM with valid item', () => {
      const action: Action = { type: 'EQUIP_ITEM', payload: { itemId: 'sword_iron' } };
      const result = getDiegeticPlayerActionMessage(action, mockNpcs, mockLocations, mockPlayerCharacter);
      expect(result).toBe('You attempt to equip the Iron Sword.');
    });

    it('should handle EQUIP_ITEM with invalid item', () => {
      const action: Action = { type: 'EQUIP_ITEM', payload: { itemId: 'unknown' } };
      const result = getDiegeticPlayerActionMessage(action, mockNpcs, mockLocations, mockPlayerCharacter);
      expect(result).toBe('You attempt to equip an item.');
    });

    it('should handle UNEQUIP_ITEM with valid slot', () => {
      const action: Action = { type: 'UNEQUIP_ITEM', payload: { slot: 'mainHand' } };
      const result = getDiegeticPlayerActionMessage(action, mockNpcs, mockLocations, mockPlayerCharacter);
      expect(result).toBe('You attempt to unequip the Old Dagger.');
    });

    it('should handle UNEQUIP_ITEM with empty slot', () => {
      const action: Action = { type: 'UNEQUIP_ITEM', payload: { slot: 'offHand' } }; // offHand is empty in mock
      const result = getDiegeticPlayerActionMessage(action, mockNpcs, mockLocations, mockPlayerCharacter);
      expect(result).toBe('You attempt to unequip an item.');
    });

    it('should handle use_item', () => {
      const action: Action = { type: 'use_item', payload: { itemId: 'potion_health' } };
      const result = getDiegeticPlayerActionMessage(action, mockNpcs, mockLocations, mockPlayerCharacter);
      expect(result).toBe('You use the Health Potion.');
    });

    it('should handle DROP_ITEM', () => {
      const action: Action = { type: 'DROP_ITEM', payload: { itemId: 'sword_iron' } };
      const result = getDiegeticPlayerActionMessage(action, mockNpcs, mockLocations, mockPlayerCharacter);
      expect(result).toBe('You drop the Iron Sword.');
    });

    it('should handle TOGGLE_PREPARED_SPELL', () => {
        const action: Action = { type: 'TOGGLE_PREPARED_SPELL' };
        const result = getDiegeticPlayerActionMessage(action, mockNpcs, mockLocations, mockPlayerCharacter);
        expect(result).toBe('You adjust your magical preparations.');
    });

    it('should handle wait', () => {
        const action: Action = { type: 'wait' };
        const result = getDiegeticPlayerActionMessage(action, mockNpcs, mockLocations, mockPlayerCharacter);
        expect(result).toBe('You decide to wait for a while.');
    });

    it('should return null for system actions', () => {
      const systemActions: Action['type'][] = [
        'LONG_REST',
        'SHORT_REST',
        'ask_oracle',
        'save_game',
        'CAST_SPELL'
      ];

      systemActions.forEach(type => {
        const action: Action = { type };
        const result = getDiegeticPlayerActionMessage(action, mockNpcs, mockLocations, mockPlayerCharacter);
        expect(result).toBeNull();
      });
    });

    it('should return generic labeled action for default fallback', () => {
      const action: Action = { type: 'custom_thing', label: 'Do a flip' };
      const result = getDiegeticPlayerActionMessage(action, mockNpcs, mockLocations, mockPlayerCharacter);
      expect(result).toBe('> Do a flip');
    });

    it('should return null for internal SET/TOGGLE actions even with labels', () => {
      const action: Action = { type: 'SET_SOMETHING', label: 'Setting X' };
      const result = getDiegeticPlayerActionMessage(action, mockNpcs, mockLocations, mockPlayerCharacter);
      expect(result).toBeNull();
    });
  });
});
