import { describe, it, expect, vi } from 'vitest';
import { getDiegeticPlayerActionMessage } from '../actionUtils';
import { Action, NPC, Location, PlayerCharacter } from '../../types';

// Mock dependencies
// We need to mock the resolved modules.
// src/utils/actionUtils.ts imports '../constants' which resolves to src/constants.ts
// src/utils/actionUtils.ts imports '../config/mapConfig' which resolves to src/config/mapConfig.ts
// From this test file (src/utils/__tests__), those are ../../constants and ../../config/mapConfig

vi.mock('../../constants', () => ({
  ITEMS: {
    'sword_iron': {
      name: 'Iron Sword',
      id: 'sword_iron',
      type: 'weapon',
      rarity: 'common',
      weight: 3,
      value: '10 gp',
      description: 'A sword.'
    },
    'potion_healing': {
      name: 'Healing Potion',
      id: 'potion_healing',
      type: 'consumable',
      rarity: 'common',
      weight: 0.5,
      value: '50 gp',
      description: 'Heals.'
    }
  }
}));

vi.mock('../../config/mapConfig', () => ({
  DIRECTION_VECTORS: {
    'north': { x: 0, y: -1 },
    'south': { x: 0, y: 1 }
  }
}));

describe('getDiegeticPlayerActionMessage', () => {
  const mockNpcs: Record<string, NPC> = {
    'blacksmith': { id: 'blacksmith', name: 'Blacksmith', race: 'human', description: 'A sturdy blacksmith.' } as NPC
  };

  const mockLocations: Record<string, Location> = {
    'village_center': { id: 'village_center', name: 'Village Center', description: 'The center of town.' } as Location
  };

  const mockPC = {
    equippedItems: {
      'main_hand': { name: 'Rusty Dagger', id: 'dagger_rusty' }
    }
  } as unknown as PlayerCharacter;

  describe('Movement Actions', () => {
    it('should return direction message for valid cardinal direction', () => {
      const action: Action = { type: 'move', targetId: 'north' };
      const result = getDiegeticPlayerActionMessage(action, {}, {}, undefined);
      expect(result).toBe('You head north.');
    });

    it('should return travel message for valid location target', () => {
      const action: Action = { type: 'move', targetId: 'village_center' };
      const result = getDiegeticPlayerActionMessage(action, {}, mockLocations, undefined);
      expect(result).toBe('You decide to travel to Village Center.');
    });

    it('should return generic move message if target is invalid/unknown', () => {
      const action: Action = { type: 'move', targetId: 'unknown_place' };
      const result = getDiegeticPlayerActionMessage(action, {}, mockLocations, undefined);
      expect(result).toBe('You decide to move.');
    });

    it('should return generic move message if no targetId', () => {
      const action: Action = { type: 'move' };
      const result = getDiegeticPlayerActionMessage(action, {}, {}, undefined);
      expect(result).toBe('You decide to move.');
    });
  });

  describe('Interaction Actions', () => {
    it('should return talk message for known NPC', () => {
      const action: Action = { type: 'talk', targetId: 'blacksmith' };
      const result = getDiegeticPlayerActionMessage(action, mockNpcs, {}, undefined);
      expect(result).toBe('You approach Blacksmith to speak.');
    });

    it('should return generic talk message for unknown NPC', () => {
      const action: Action = { type: 'talk', targetId: 'ghost' };
      const result = getDiegeticPlayerActionMessage(action, mockNpcs, {}, undefined);
      expect(result).toBe('You attempt to speak to someone nearby.');
    });

    it('should return generic talk message if no targetId', () => {
      const action: Action = { type: 'talk' };
      const result = getDiegeticPlayerActionMessage(action, mockNpcs, {}, undefined);
      expect(result).toBe('You attempt to speak to someone nearby.');
    });
  });

  describe('Item Actions', () => {
    it('should return take message for known item', () => {
      const action: Action = { type: 'take_item', targetId: 'sword_iron' };
      const result = getDiegeticPlayerActionMessage(action, {}, {}, undefined);
      expect(result).toBe('You attempt to take the Iron Sword.');
    });

    it('should return generic take message for unknown item', () => {
      const action: Action = { type: 'take_item', targetId: 'mystery_orb' };
      const result = getDiegeticPlayerActionMessage(action, {}, {}, undefined);
      expect(result).toBe('You try to pick something up.');
    });

    it('should return equip message for known item', () => {
      const action: Action = { type: 'EQUIP_ITEM', payload: { itemId: 'sword_iron' } };
      const result = getDiegeticPlayerActionMessage(action, {}, {}, undefined);
      expect(result).toBe('You attempt to equip the Iron Sword.');
    });

    it('should return generic equip message for unknown item', () => {
      const action: Action = { type: 'EQUIP_ITEM', payload: { itemId: 'unknown_sword' } };
      const result = getDiegeticPlayerActionMessage(action, {}, {}, undefined);
      expect(result).toBe('You attempt to equip an item.');
    });

    it('should return unequip message for equipped item', () => {
      const action: Action = { type: 'UNEQUIP_ITEM', payload: { slot: 'main_hand' } };
      const result = getDiegeticPlayerActionMessage(action, {}, {}, mockPC);
      expect(result).toBe('You attempt to unequip the Rusty Dagger.');
    });

    it('should return generic unequip message if slot is empty or invalid', () => {
      const action: Action = { type: 'UNEQUIP_ITEM', payload: { slot: 'off_hand' } };
      const result = getDiegeticPlayerActionMessage(action, {}, {}, mockPC);
      expect(result).toBe('You attempt to unequip an item.');
    });

    it('should return use message for known item', () => {
      const action: Action = { type: 'use_item', payload: { itemId: 'potion_healing' } };
      const result = getDiegeticPlayerActionMessage(action, {}, {}, undefined);
      expect(result).toBe('You use the Healing Potion.');
    });

    it('should return drop message for known item', () => {
        const action: Action = { type: 'DROP_ITEM', payload: { itemId: 'potion_healing' } };
        const result = getDiegeticPlayerActionMessage(action, {}, {}, undefined);
        expect(result).toBe('You drop the Healing Potion.');
    });
  });

  describe('Other Actions', () => {
    it('should return survey message for look_around', () => {
      const action: Action = { type: 'look_around' };
      expect(getDiegeticPlayerActionMessage(action, {}, {}, undefined))
        .toBe('You take a moment to survey your surroundings.');
    });

    it('should return inspect message for inspect_submap_tile', () => {
        const action: Action = { type: 'inspect_submap_tile' };
        expect(getDiegeticPlayerActionMessage(action, {}, {}, undefined))
          .toBe('You carefully examine the terrain nearby.');
    });

    it('should return wait message', () => {
        const action: Action = { type: 'wait' };
        expect(getDiegeticPlayerActionMessage(action, {}, {}, undefined))
          .toBe('You decide to wait for a while.');
    });

    it('should return toggle spell message', () => {
        const action: Action = { type: 'TOGGLE_PREPARED_SPELL' };
        expect(getDiegeticPlayerActionMessage(action, {}, {}, undefined))
          .toBe('You adjust your magical preparations.');
    });

    it('should return custom message for gemini_custom_action with label', () => {
        const action: Action = { type: 'gemini_custom_action', label: 'Dance' };
        expect(getDiegeticPlayerActionMessage(action, {}, {}, undefined))
          .toBe('You decide to: Dance.');
    });

    it('should return generic message for gemini_custom_action without label', () => {
        const action: Action = { type: 'gemini_custom_action' };
        expect(getDiegeticPlayerActionMessage(action, {}, {}, undefined))
          .toBe('You decide to try something specific.');
    });
  });

  describe('System Actions (Returning null)', () => {
    const systemActions = [
      'LONG_REST', 'SHORT_REST', 'save_game', 'go_to_main_menu',
      'toggle_map', 'CAST_SPELL', 'USE_LIMITED_ABILITY'
    ];

    systemActions.forEach(type => {
      it(`should return null for ${type}`, () => {
        const action: Action = { type };
        expect(getDiegeticPlayerActionMessage(action, {}, {}, undefined)).toBeNull();
      });
    });
  });

  describe('Fallbacks', () => {
    it('should use label for generic unknown actions', () => {
        const action: Action = { type: 'CUSTOM_UNKNOWN', label: 'Do a flip' };
        expect(getDiegeticPlayerActionMessage(action, {}, {}, undefined))
          .toBe('> Do a flip');
    });

    it('should return null for SET_ internal actions even with label', () => {
        const action: Action = { type: 'SET_GAME_STATE', label: 'Setting state' };
        expect(getDiegeticPlayerActionMessage(action, {}, {}, undefined)).toBeNull();
    });

    it('should return null for TOGGLE_ internal actions even with label', () => {
        const action: Action = { type: 'TOGGLE_DEBUG', label: 'Toggling' };
        expect(getDiegeticPlayerActionMessage(action, {}, {}, undefined)).toBeNull();
    });

    it('should return null for unknown actions without label', () => {
        const action: Action = { type: 'UNKNOWN_THING' };
        expect(getDiegeticPlayerActionMessage(action, {}, {}, undefined)).toBeNull();
    });
  });
});
