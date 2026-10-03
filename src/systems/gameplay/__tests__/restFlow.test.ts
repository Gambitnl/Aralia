/**
 * This file tests the resting mechanics of the game, covering both Short and Long Rests.
 *
 * In Aralia, resting allows the adventuring party to recover hit points, replenish expended
 * spell slots, recharge special class abilities, and recover from harsh travel conditions like
 * starvation and poisoning. These tests verify the state transitions and resource tracking
 * across both individual character sheets and the shared party state.
 *
 * Called by: Vitest test runner (part of the gameplay test suite)
 * Depends on: characterReducer, worldReducer, handleResourceActions, and core character utilities
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { characterReducer } from '../../../state/reducers/characterReducer';
import { worldReducer } from '../../../state/reducers/worldReducer';
import { handleShortRest, handleLongRest } from '../../../hooks/actions/handleResourceActions';
import {
  GameState,
  Item,
  PlayerCharacter,
  SpellSlots,
  HitPointDicePool,
  RacialRestChoiceData
} from '../../../types';
import { AppAction } from '../../../state/actionTypes';
import {
  createMockGameState,
  createMockPlayerCharacter,
  getGameDay
} from '../../../utils/core';

// ============================================================================
// Test Fixtures and Helpers
// ============================================================================
// This section provides reusable factory functions to build test characters,
// items, and game states with specific health, spell slot, and provision setups.
// ============================================================================

// Helper to create a provision item (food ration or water pouch) for testing overnight meals
const createProvisionItem = (id: string, name: string): Item => ({
  id,
  name,
  description: 'Provisions for survival',
  type: 'food_drink' as const,
  costInGp: 0.5,
  weight: 1
} as Item);

// Helper to construct a wounded wizard character with expended spell slots and limited abilities
function createWoundedWizard(id = 'char-wizard'): PlayerCharacter {
  const base = createMockPlayerCharacter({
    id,
    name: 'Elendor the Wizard',
    hp: 8,
    maxHp: 24,
    conditions: ['poisoned'],
    finalAbilityScores: {
      Strength: 10,
      Dexterity: 14,
      Constitution: 14, // +2 modifier
      Intelligence: 18,
      Wisdom: 12,
      Charisma: 10
    }
  });

  // Configure partially expended hit dice: 3 total d6 dice, only 2 remaining
  const hitPointDice: HitPointDicePool[] = [
    { die: 6, current: 2, max: 3 }
  ];

  // Configure depleted spell slots
  const spellSlots: SpellSlots = {
    level_1: { current: 1, max: 4 },
    level_2: { current: 0, max: 3 },
    level_3: { current: 0, max: 2 },
    level_4: { current: 0, max: 0 },
    level_5: { current: 0, max: 0 },
    level_6: { current: 0, max: 0 },
    level_7: { current: 0, max: 0 },
    level_8: { current: 0, max: 0 },
    level_9: { current: 0, max: 0 }
  };

  // Configure limited-use abilities with different recharge timings
  const limitedUses = {
    arcane_recovery: {
      name: 'Arcane Recovery',
      current: 0,
      max: 1,
      resetOn: 'short_rest' as const
    },
    action_surge: {
      name: 'Second Wind',
      current: 0,
      max: 1,
      resetOn: 'short_rest' as const
    },
    signature_spell: {
      name: 'Overchannel',
      current: 0,
      max: 1,
      resetOn: 'long_rest' as const
    },
    daily_item_power: {
      name: 'Wand Charge',
      current: 1,
      max: 3,
      resetOn: 'daily' as const
    }
  };

  return {
    ...base,
    hitPointDice,
    spellSlots,
    limitedUses
  };
}

// ============================================================================
// Short Rest Suite
// ============================================================================
// Short rests represent one hour of quiet downtime. Characters can spend hit dice
// to heal wounds, and short-rest abilities recharge.
// ============================================================================

describe('Gameplay Flow - Short Rest Cycle', () => {
  it('spends hit dice to heal wounded characters and updates hit dice pool', () => {
    // Set up a wounded character with 8/24 HP and 2 available d6 hit dice
    const wizard = createWoundedWizard();
    const state: GameState = {
      ...createMockGameState(),
      party: [wizard]
    };

    // Simulate spending 1 hit die which restores 8 HP (dice roll + Constitution bonus)
    const updatedHitDice: HitPointDicePool[] = [
      { die: 6, current: 1, max: 3 }
    ];

    const shortRestAction: AppAction = {
      type: 'SHORT_REST',
      payload: {
        healingByCharacterId: { [wizard.id]: 8 },
        hitPointDiceUpdates: { [wizard.id]: updatedHitDice }
      }
    };

    const nextState = characterReducer(state, shortRestAction);
    const updatedChar = nextState.party![0];

    // Verify HP increased from 8 to 16
    expect(updatedChar.hp).toBe(16);
    // Verify hit dice count was reduced from 2 to 1
    expect(updatedChar.hitPointDice?.[0].current).toBe(1);
    expect(updatedChar.hitPointDice?.[0].max).toBe(3);
  });

  it('restores abilities marked resetOn: short_rest while preserving long_rest abilities', () => {
    const wizard = createWoundedWizard();
    const state: GameState = {
      ...createMockGameState(),
      party: [wizard]
    };

    const shortRestAction: AppAction = {
      type: 'SHORT_REST',
      payload: {}
    };

    const nextState = characterReducer(state, shortRestAction);
    const updatedChar = nextState.party![0];

    // Short rest abilities should be fully recharged to their max value
    expect(updatedChar.limitedUses?.arcane_recovery.current).toBe(1);
    expect(updatedChar.limitedUses?.action_surge.current).toBe(1);

    // Long rest and daily abilities should remain uncharged after only a short rest
    expect(updatedChar.limitedUses?.signature_spell.current).toBe(0);
    expect(updatedChar.limitedUses?.daily_item_power.current).toBe(1);
  });

  it('clamps short rest healing so it never exceeds maximum hit points', () => {
    const wizard = createWoundedWizard();
    wizard.hp = 22; // Only 2 HP missing from max 24

    const state: GameState = {
      ...createMockGameState(),
      party: [wizard]
    };

    // Attempt to apply 15 healing
    const shortRestAction: AppAction = {
      type: 'SHORT_REST',
      payload: {
        healingByCharacterId: { [wizard.id]: 15 }
      }
    };

    const nextState = characterReducer(state, shortRestAction);
    expect(nextState.party![0].hp).toBe(24);
  });

  it('tracks daily short rest limits and cooldown times via handleShortRest handler', () => {
    const dispatch = vi.fn();
    const addMessage = vi.fn();
    const wizard = createWoundedWizard();

    const baseTime = new Date('2026-08-26T10:00:00Z');
    const gameState: GameState = {
      ...createMockGameState(),
      gameTime: baseTime,
      party: [wizard],
      shortRestTracker: {
        restsTakenToday: 0,
        lastRestDay: 100,
        lastRestEndedAtMs: null
      }
    };

    // First short rest should succeed and dispatch actions
    handleShortRest({
      gameState,
      dispatch,
      addMessage,
      hitPointDiceSpend: { [wizard.id]: { 6: 1 } }
    });

    expect(dispatch).toHaveBeenCalledWith(expect.objectContaining({
      type: 'SHORT_REST'
    }));
    expect(dispatch).toHaveBeenCalledWith({
      type: 'ADVANCE_TIME',
      payload: { seconds: 3600 }
    });
  });

  it('rejects short rest if party exceeded the daily cap of 3 rests', () => {
    const dispatch = vi.fn();
    const addMessage = vi.fn();
    const wizard = createWoundedWizard();

    const baseTime = new Date('2026-08-26T14:00:00Z');
    // Calculate the game day at rest completion (1 hour after start)
    const restEndMs = baseTime.getTime() + 3600 * 1000;
    const restEndDay = getGameDay(new Date(restEndMs));

    const gameState: GameState = {
      ...createMockGameState(),
      gameTime: baseTime,
      party: [wizard],
      shortRestTracker: {
        restsTakenToday: 3, // Already took 3 rests today
        lastRestDay: restEndDay,
        lastRestEndedAtMs: baseTime.getTime() - (4 * 3600 * 1000)
      }
    };

    handleShortRest({
      gameState,
      dispatch,
      addMessage
    });

    // Should not dispatch any state changes
    expect(dispatch).not.toHaveBeenCalled();
    expect(addMessage).toHaveBeenCalledWith(
      expect.stringContaining('already taken 3 short rests today'),
      'system'
    );
  });

  it('rejects short rest if 2-hour cooldown between short rests has not elapsed', () => {
    const dispatch = vi.fn();
    const addMessage = vi.fn();
    const wizard = createWoundedWizard();

    const baseTime = new Date('2026-08-26T14:00:00Z');
    const restEndDay = getGameDay(new Date(baseTime.getTime() + 3600 * 1000));

    const gameState: GameState = {
      ...createMockGameState(),
      gameTime: baseTime,
      party: [wizard],
      shortRestTracker: {
        restsTakenToday: 1,
        lastRestDay: restEndDay,
        // Only 30 minutes (1800s) since last rest ended, but 2 hours (7200s) required
        lastRestEndedAtMs: baseTime.getTime() - (1800 * 1000)
      }
    };

    handleShortRest({
      gameState,
      dispatch,
      addMessage
    });

    expect(dispatch).not.toHaveBeenCalled();
    expect(addMessage).toHaveBeenCalledWith(
      expect.stringContaining('before taking another short rest'),
      'system'
    );
  });

  it('updates party shortRestTracker inside worldReducer', () => {
    const state = createMockGameState();
    const trackerPayload = {
      restsTakenToday: 2,
      lastRestDay: 15,
      lastRestEndedAtMs: 1700000000000
    };

    const action: AppAction = {
      type: 'SHORT_REST',
      payload: {
        shortRestTracker: trackerPayload
      }
    };

    const nextState = worldReducer(state, action);
    expect(nextState.shortRestTracker).toEqual(trackerPayload);
  });
});

// ============================================================================
// Long Rest Suite
// ============================================================================
// Long rests represent an 8-hour overnight sleep. They fully restore HP, restore
// all spent hit dice, refill all spell slots, reset all abilities, and consume food.
// ============================================================================

describe('Gameplay Flow - Long Rest Cycle', () => {
  it('restores full HP, all hit dice, and all spell slots for resting party members', () => {
    const wizard = createWoundedWizard('wizard-1');
    const state: GameState = {
      ...createMockGameState(),
      party: [wizard],
      inventory: [
        createProvisionItem('rations', 'Rations'),
        createProvisionItem('water-day', 'Water Skin')
      ]
    };

    const longRestAction: AppAction = {
      type: 'LONG_REST',
      payload: {}
    };

    const nextState = characterReducer(state, longRestAction);
    const restedWizard = nextState.party![0];

    // HP is restored to maximum
    expect(restedWizard.hp).toBe(restedWizard.maxHp);

    // Hit dice pools are fully replenished (3/3)
    expect(restedWizard.hitPointDice?.[0].current).toBe(restedWizard.hitPointDice?.[0].max);

    // Spell slots at all levels are fully restored
    expect(restedWizard.spellSlots?.level_1.current).toBe(4);
    expect(restedWizard.spellSlots?.level_2.current).toBe(3);
    expect(restedWizard.spellSlots?.level_3.current).toBe(2);

    // All ability cooldowns are restored
    expect(restedWizard.limitedUses?.arcane_recovery.current).toBe(1);
    expect(restedWizard.limitedUses?.signature_spell.current).toBe(1);
    expect(restedWizard.limitedUses?.daily_item_power.current).toBe(3);

    // Poisoned condition is cured by a good night of rest
    expect(restedWizard.conditions).not.toContain('poisoned');
  });

  it('consumes 1 ration and 1 water per party member and clears starving and fatigued', () => {
    const char1 = createMockPlayerCharacter({
      id: 'p1',
      name: 'Fighter',
      hp: 5,
      maxHp: 20,
      conditions: ['starving', 'fatigued']
    });
    const char2 = createMockPlayerCharacter({
      id: 'p2',
      name: 'Cleric',
      hp: 4,
      maxHp: 18,
      conditions: ['starving', 'poisoned']
    });

    const state: GameState = {
      ...createMockGameState(),
      party: [char1, char2],
      inventory: [
        createProvisionItem('rations', 'Rations'),
        createProvisionItem('rations', 'Rations'),
        createProvisionItem('rations', 'Extra Rations'),
        createProvisionItem('water-day', 'Water Pouch 1'),
        createProvisionItem('water-day', 'Water Pouch 2')
      ]
    };

    const nextState = characterReducer(state, { type: 'LONG_REST', payload: {} } as AppAction);

    // Both party members ate and recovered
    for (const pc of nextState.party!) {
      expect(pc.conditions).not.toContain('starving');
      expect(pc.conditions).not.toContain('fatigued');
      expect(pc.conditions).not.toContain('poisoned');
      expect(pc.hp).toBe(pc.maxHp);
    }

    // 2 rations and 2 water consumed from inventory, 1 ration remaining
    const remainingRations = nextState.inventory!.filter(i => i.id === 'rations');
    const remainingWater = nextState.inventory!.filter(i => i.id === 'water-day');
    expect(remainingRations).toHaveLength(1);
    expect(remainingWater).toHaveLength(0);
  });

  it('prevents HP recovery if party has insufficient provisions to clear starving', () => {
    const starvingRanger = createMockPlayerCharacter({
      id: 'ranger-1',
      name: 'Strider',
      hp: 4,
      maxHp: 22,
      conditions: ['starving']
    });

    const state: GameState = {
      ...createMockGameState(),
      party: [starvingRanger],
      inventory: [] // No food or water
    };

    const nextState = characterReducer(state, { type: 'LONG_REST', payload: {} } as AppAction);
    const restedRanger = nextState.party![0];

    // Without food, the character stays starving and regains 0 HP
    expect(restedRanger.conditions).toContain('starving');
    expect(restedRanger.hp).toBe(4);
  });

  it('withholds rest benefits for characters explicitly listed in deniedCharacterIds', () => {
    const char1 = createMockPlayerCharacter({ id: 'p1', name: 'Resting Member', hp: 5, maxHp: 20 });
    const char2 = createMockPlayerCharacter({ id: 'p2', name: 'Denied Member', hp: 5, maxHp: 20, conditions: ['poisoned'] });

    const state: GameState = {
      ...createMockGameState(),
      party: [char1, char2],
      inventory: [
        createProvisionItem('rations', 'Rations'),
        createProvisionItem('rations', 'Rations'),
        createProvisionItem('water-day', 'Water'),
        createProvisionItem('water-day', 'Water')
      ]
    };

    const nextState = characterReducer(state, {
      type: 'LONG_REST',
      payload: { deniedCharacterIds: ['p2'] }
    } as AppAction);

    // p1 gained benefits
    expect(nextState.party![0].hp).toBe(20);

    // p2 was denied benefits
    expect(nextState.party![1].hp).toBe(5);
    expect(nextState.party![1].conditions).toContain('poisoned');
  });

  it('applies racial rest weapon and tool choices made by the player', () => {
    const elfChar = createMockPlayerCharacter({
      id: 'elf-1',
      name: 'Trance Elf',
      toolProficiencies: ['thieves_tools'],
      weaponProficiencies: ['longsword']
    });

    const state: GameState = {
      ...createMockGameState(),
      party: [elfChar],
      inventory: [
        createProvisionItem('rations', 'Rations'),
        createProvisionItem('water-day', 'Water')
      ]
    };

    const racialRestChoices: Record<string, Record<string, RacialRestChoiceData>> = {
      'elf-1': {
        trance_proficiency: {
          toolIds: ['alchemist_supplies'],
          weaponIds: ['shortbow']
        }
      }
    };

    const nextState = characterReducer(state, {
      type: 'LONG_REST',
      payload: { racialRestChoices }
    } as AppAction);

    const updatedElf = nextState.party![0];
    expect(updatedElf.toolProficiencies).toContain('alchemist_supplies');
    expect(updatedElf.weaponProficiencies).toContain('shortbow');
  });
});
