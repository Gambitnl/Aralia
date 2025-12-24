import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getDiegeticPlayerActionMessage } from '../actionUtils';
import { Action, NPC, Location, PlayerCharacter } from '../../types';

// Mock dependencies using correct relative paths from the test file to the source modules
vi.mock('../../constants', () => ({
  ITEMS: {
    'sword_iron': { name: 'Iron Sword' },
    'potion_healing': { name: 'Healing Potion' }
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
    'npc1': { id: 'npc1', name: 'Bob the Builder' } as NPC
  };

  const mockLocations: Record<string, Location> = {
    'loc1': { id: 'loc1', name: 'The Tavern' } as Location
  };

  const mockPC: PlayerCharacter = {
    equippedItems: {
      'main_hand': { name: 'Rusty Dagger' }
    }
  } as unknown as PlayerCharacter;

  it('should return a message for cardinal movement', () => {
    const action: Action = { type: 'move', targetId: 'north', label: 'Move North' };
    const result = getDiegeticPlayerActionMessage(action, mockNpcs, mockLocations, mockPC);
    expect(result).toBe('You head north.');
  });

  it('should return a message for location travel', () => {
    const action: Action = { type: 'move', targetId: 'loc1', label: 'Travel to Tavern' };
    const result = getDiegeticPlayerActionMessage(action, mockNpcs, mockLocations, mockPC);
    expect(result).toBe('You decide to travel to The Tavern.');
  });

  it('should return generic move message if target is unknown', () => {
    const action: Action = { type: 'move', targetId: 'unknown', label: 'Move' };
    const result = getDiegeticPlayerActionMessage(action, mockNpcs, mockLocations, mockPC);
    expect(result).toBe('You decide to move.');
  });

  it('should handle look_around action', () => {
    const action: Action = { type: 'look_around', label: 'Look Around' };
    const result = getDiegeticPlayerActionMessage(action, mockNpcs, mockLocations, mockPC);
    expect(result).toBe('You take a moment to survey your surroundings.');
  });

  it('should return message for talking to a known NPC', () => {
    const action: Action = { type: 'talk', targetId: 'npc1', label: 'Talk' };
    const result = getDiegeticPlayerActionMessage(action, mockNpcs, mockLocations, mockPC);
    expect(result).toBe('You approach Bob the Builder to speak.');
  });

  it('should return generic message for talking to unknown NPC', () => {
    const action: Action = { type: 'talk', targetId: 'unknown', label: 'Talk' };
    const result = getDiegeticPlayerActionMessage(action, mockNpcs, mockLocations, mockPC);
    expect(result).toBe('You attempt to speak to someone nearby.');
  });

  it('should return message for taking a known item', () => {
    const action: Action = { type: 'take_item', targetId: 'sword_iron', label: 'Take Sword' };
    const result = getDiegeticPlayerActionMessage(action, mockNpcs, mockLocations, mockPC);
    expect(result).toBe('You attempt to take the Iron Sword.');
  });

  it('should return generic message for taking unknown item', () => {
    const action: Action = { type: 'take_item', targetId: 'unknown_item', label: 'Take Item' };
    const result = getDiegeticPlayerActionMessage(action, mockNpcs, mockLocations, mockPC);
    expect(result).toBe('You try to pick something up.');
  });

  it('should return message for equipping a known item', () => {
    const action: Action = { type: 'EQUIP_ITEM', payload: { itemId: 'sword_iron' }, label: 'Equip' };
    const result = getDiegeticPlayerActionMessage(action, mockNpcs, mockLocations, mockPC);
    expect(result).toBe('You attempt to equip the Iron Sword.');
  });

  it('should return generic message for equipping if itemId is missing or unknown', () => {
    const action: Action = { type: 'EQUIP_ITEM', payload: { itemId: 'unknown_item' }, label: 'Equip' };
    const result = getDiegeticPlayerActionMessage(action, mockNpcs, mockLocations, mockPC);
    expect(result).toBe('You attempt to equip an item.');
  });

  it('should return message for unequipping an item in a valid slot', () => {
    const action: Action = { type: 'UNEQUIP_ITEM', payload: { slot: 'main_hand' }, label: 'Unequip' };
    const result = getDiegeticPlayerActionMessage(action, mockNpcs, mockLocations, mockPC);
    expect(result).toBe('You attempt to unequip the Rusty Dagger.');
  });

  it('should return generic message for unequipping if slot is empty or missing', () => {
    const action: Action = { type: 'UNEQUIP_ITEM', payload: { slot: 'off_hand' }, label: 'Unequip' };
    const result = getDiegeticPlayerActionMessage(action, mockNpcs, mockLocations, mockPC);
    expect(result).toBe('You attempt to unequip an item.');
  });

  it('should return message for using a known item', () => {
      const action: Action = { type: 'use_item', payload: { itemId: 'potion_healing' }, label: 'Use Potion' };
      const result = getDiegeticPlayerActionMessage(action, mockNpcs, mockLocations, mockPC);
      expect(result).toBe('You use the Healing Potion.');
  });

  it('should return generic message for using unknown item', () => {
      const action: Action = { type: 'use_item', payload: { itemId: 'unknown' }, label: 'Use Item' };
      const result = getDiegeticPlayerActionMessage(action, mockNpcs, mockLocations, mockPC);
      expect(result).toBe('You use an item.');
  });

  it('should return message for dropping a known item', () => {
      const action: Action = { type: 'DROP_ITEM', payload: { itemId: 'sword_iron' }, label: 'Drop Sword' };
      const result = getDiegeticPlayerActionMessage(action, mockNpcs, mockLocations, mockPC);
      expect(result).toBe('You drop the Iron Sword.');
  });

  it('should return generic message for dropping unknown item', () => {
      const action: Action = { type: 'DROP_ITEM', payload: { itemId: 'unknown' }, label: 'Drop Item' };
      const result = getDiegeticPlayerActionMessage(action, mockNpcs, mockLocations, mockPC);
      expect(result).toBe('You drop an item.');
  });

  it('should return custom label for custom actions', () => {
    const action: Action = { type: 'gemini_custom_action', label: 'Do a backflip' };
    const result = getDiegeticPlayerActionMessage(action, mockNpcs, mockLocations, mockPC);
    expect(result).toBe('You decide to: Do a backflip.');
  });

  it('should return null for system actions', () => {
    const systemActions = [
      'LONG_REST', 'SHORT_REST', 'save_game', 'CAST_SPELL', 'USE_LIMITED_ABILITY',
      'toggle_map', 'go_to_main_menu'
    ];

    systemActions.forEach(type => {
      const action: Action = { type: type as any, label: 'System Action' };
      const result = getDiegeticPlayerActionMessage(action, mockNpcs, mockLocations, mockPC);
      expect(result).toBeNull();
    });
  });

  it('should fallback to label for unknown action types if present', () => {
    const action: Action = { type: 'UNKNOWN_ACTION' as any, label: 'Do Something Weird' };
    const result = getDiegeticPlayerActionMessage(action, mockNpcs, mockLocations, mockPC);
    expect(result).toBe('> Do Something Weird');
  });

  it('should return null for unknown action types without label', () => {
      const action: Action = { type: 'UNKNOWN_ACTION' as any };
      const result = getDiegeticPlayerActionMessage(action, mockNpcs, mockLocations, mockPC);
      expect(result).toBeNull();
  });
});
