/**
 * This file tests the complete end-to-end gameplay loop integrating exploration,
 * encounter initiation, combat turn arbitration, quest completion, and rest cycles.
 *
 * In this comprehensive gameplay scenario:
 * 1. The party accepts a quest in town to explore and clear an ancient dungeon site.
 * 2. They travel across the wilderness, rolling for travel encounters and advancing the clock.
 * 3. Upon reaching the destination, they discover the hidden site and engage hostile creatures in combat.
 * 4. Combat resolves through the tactical initiative turn sequence where spells are cast, HP is lost, and enemies fall.
 * 5. With the foe defeated, the quest objective completes, awarding gold, XP, and inventory loot.
 * 6. The party rests: first a Short Rest in the field spending hit dice, followed by travel home and a full Long Rest.
 *
 * Called by: Vitest test runner (part of the gameplay test suite)
 * Depends on: questReducer, worldReducer, characterReducer, travelEncounter, useTurnManager, and core utilities
 */

import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { questReducer } from '../../../state/reducers/questReducer';
import { worldReducer } from '../../../state/reducers/worldReducer';
import { characterReducer } from '../../../state/reducers/characterReducer';
import { rollTravelEncounter } from '../../../systems/travel/travelEncounter';
import { rootSeedPath } from '../../../systems/worldforge/seedPath';
import { RoutePlan } from '../../../systems/travel/routePlanning';
import { useTurnManager } from '../../../hooks/combat/useTurnManager';
import {
  GameState,
  Quest,
  QuestStatus,
  PlayerCharacter,
  SpellSlots,
  HitPointDicePool,
  Item
} from '../../../types';
import { CombatCharacter, Class } from '../../../types/combat';
import { AppAction } from '../../../state/actionTypes';
import {
  createMockGameState,
  createMockPlayerCharacter,
  createMockCombatCharacter
} from '../../../utils/core';

// Disable the background combat AI timer so turns advance strictly when commanded
vi.mock('../../../hooks/combat/useCombatAI', () => ({
  useCombatAI: () => ({ aiState: 'idle' }),
}));

// ============================================================================
// Test Fixtures and Helpers
// ============================================================================
// Sets up a full 2-character adventuring party (Fighter & Wizard) with
// spell slots, hit dice, limited-use abilities, inventory, and starter gold.
// ============================================================================

const mockFighterClass: Class = {
  id: 'fighter',
  name: 'Fighter',
  description: 'Martial specialist',
  hitDie: 10,
  primaryAbility: ['Strength'],
  savingThrowProficiencies: ['Strength', 'Constitution'],
  skillProficienciesAvailable: [],
  numberOfSkillProficiencies: 2,
  armorProficiencies: [],
  weaponProficiencies: [],
  features: []
};

const createProvisionItem = (id: string, name: string): Item => ({
  id,
  name,
  description: 'Survival provision',
  type: 'food_drink' as const,
  costInGp: 0.5,
  weight: 1
} as Item);

function buildStartingParty(): [PlayerCharacter, PlayerCharacter] {
  const fighter = createMockPlayerCharacter({
    id: 'pc-fighter',
    name: 'Gareth Ironbreaker',
    level: 3,
    classLevels: { fighter: 3 },
    hp: 28,
    maxHp: 28,
    xp: 500,
    hitPointDice: [{ die: 10, current: 3, max: 3 }],
    limitedUses: {
      action_surge: { name: 'Action Surge', current: 1, max: 1, resetOn: 'short_rest' }
    }
  });

  const wizard = createMockPlayerCharacter({
    id: 'pc-wizard',
    name: 'Lyra Shadowborn',
    level: 3,
    classLevels: { wizard: 3 },
    hp: 18,
    maxHp: 18,
    xp: 500,
    hitPointDice: [{ die: 6, current: 3, max: 3 }],
    spellSlots: {
      level_1: { current: 4, max: 4 },
      level_2: { current: 2, max: 2 },
      level_3: { current: 0, max: 0 },
      level_4: { current: 0, max: 0 },
      level_5: { current: 0, max: 0 },
      level_6: { current: 0, max: 0 },
      level_7: { current: 0, max: 0 },
      level_8: { current: 0, max: 0 },
      level_9: { current: 0, max: 0 }
    },
    limitedUses: {
      arcane_recovery: { name: 'Arcane Recovery', current: 1, max: 1, resetOn: 'short_rest' }
    }
  });

  return [fighter, wizard];
}

// ============================================================================
// Complete Gameplay Flow Integration Test
// ============================================================================
// Orchestrates the entire lifecycle: quest intake -> overland travel -> site discovery
// -> combat encounter -> quest completion & reward distribution -> short rest -> long rest.
// ============================================================================

describe('Gameplay Flow - Full Integration Lifecycle', () => {
  it('executes a complete end-to-end journey through exploration, combat, questing, and resting', () => {
    // ------------------------------------------------------------------------
    // Step 1: Initial Game Setup & Quest Intake
    // ------------------------------------------------------------------------
    const [fighter, wizard] = buildStartingParty();
    let state: GameState = {
      ...createMockGameState(),
      party: [fighter, wizard],
      gold: 50,
      inventory: [
        createProvisionItem('rations', 'Rations'),
        createProvisionItem('rations', 'Rations'),
        createProvisionItem('water-day', 'Water Skin'),
        createProvisionItem('water-day', 'Water Skin')
      ],
      questLog: [],
      adventureLog: [],
      notifications: [],
      gameTime: new Date('2026-08-26T08:00:00Z')
    };

    const dungeonBountyQuest: Quest = {
      id: 'quest_goblin_warlord',
      title: 'Hunt the Goblin Warlord',
      description: 'Clear the goblin warlord from the Sunken Crypt.',
      status: QuestStatus.Active,
      questType: 'Side',
      giverId: 'npc_mayor',
      location: 'Sunken Crypt',
      dateStarted: state.gameTime.getTime(),
      objectives: [
        { id: 'obj_reach_crypt', description: 'Reach the Sunken Crypt', isCompleted: false },
        { id: 'obj_slay_warlord', description: 'Slay the Goblin Warlord', isCompleted: false }
      ],
      rewards: {
        gold: 300,
        xp: 600,
        items: ['torch']
      }
    };

    // Accept the quest
    const acceptAction: AppAction = { type: 'ACCEPT_QUEST', payload: dungeonBountyQuest };
    state = { ...state, ...questReducer(state, acceptAction) };

    expect(state.questLog).toHaveLength(1);
    expect(state.questLog[0].status).toBe(QuestStatus.Active);

    // ------------------------------------------------------------------------
    // Step 2: Wilderness Exploration & Travel
    // ------------------------------------------------------------------------
    const overlandRoute: RoutePlan = {
      cells: [100, 101, 102, 103],
      points: [[0, 0], [10, 10], [20, 20], [30, 30]],
      miles: 15,
      minutes: 180, // 3 hours of travel
      danger: 0.3
    };

    const seed = rootSeedPath(777);
    const encounterRoll = rollTravelEncounter(overlandRoute, seed);
    expect(encounterRoll.chance).toBeGreaterThan(0);

    // Advance in-game time for the 3-hour hike
    const travelTimeAction: AppAction = { type: 'ADVANCE_TIME', payload: { seconds: 3 * 3600 } };
    state = { ...state, ...worldReducer(state, travelTimeAction) };
    expect(state.gameTime.getUTCHours()).toBe(11);

    // Discover the hidden Sunken Crypt site upon arrival
    const revealSiteAction: AppAction = {
      type: 'REVEAL_HIDDEN_SITE',
      payload: { id: 'site_sunken_crypt', cellId: 103, name: 'Sunken Crypt' }
    };
    state = { ...state, ...worldReducer(state, revealSiteAction) };
    expect(state.discoveredHiddenSites?.some(s => s.id === 'site_sunken_crypt')).toBe(true);

    // Update the first quest objective: Reach the Sunken Crypt
    const obj1Action: AppAction = {
      type: 'UPDATE_QUEST_OBJECTIVE',
      payload: { questId: 'quest_goblin_warlord', objectiveId: 'obj_reach_crypt', isCompleted: true }
    };
    state = { ...state, ...questReducer(state, obj1Action) };
    expect(state.questLog[0].objectives[0].isCompleted).toBe(true);
    expect(state.questLog[0].status).toBe(QuestStatus.Active);

    // ------------------------------------------------------------------------
    // Step 3: Combat Encounter & Tactical Turn Resolution
    // ------------------------------------------------------------------------
    const combatFighter: CombatCharacter = createMockCombatCharacter({
      id: 'pc-fighter',
      name: 'Gareth Ironbreaker',
      team: 'player',
      currentHP: 28,
      maxHP: 28,
      initiative: 18,
      class: mockFighterClass
    });

    const combatBoss: CombatCharacter = createMockCombatCharacter({
      id: 'enemy-boss',
      name: 'Goblin Warlord Krax',
      team: 'enemy',
      currentHP: 35,
      maxHP: 35,
      initiative: 12
    });

    const onCharacterUpdate = vi.fn();
    const onRoundElapsed = vi.fn();

    const { result } = renderHook(() =>
      useTurnManager({
        characters: [combatFighter, combatBoss],
        mapData: null,
        onCharacterUpdate,
        onLogEntry: vi.fn(),
        onRoundElapsed,
        initiativeRoller: c => c.initiative
      })
    );

    // Initialize combat turn sequence
    act(() => {
      result.current.initializeCombat([combatFighter, combatBoss]);
    });

    // Turn 1: Fighter attacks first
    expect(result.current.turnState.currentCharacterId).toBe('pc-fighter');

    // End Fighter turn -> transitions to Boss
    act(() => {
      result.current.endTurn();
    });
    expect(result.current.turnState.currentCharacterId).toBe('enemy-boss');

    // End Boss turn -> completes round 1 and wraps to Fighter (Round 2)
    act(() => {
      result.current.endTurn();
    });
    expect(result.current.turnState.currentCharacterId).toBe('pc-fighter');
    expect(onRoundElapsed).toHaveBeenCalledWith(6);

    // Simulate outcome of battle: Fighter took 16 damage (12 HP remaining), Boss defeated
    // Wizard cast two 1st-level spells and one 2nd-level spell during the dungeon
    const postCombatParty: PlayerCharacter[] = [
      {
        ...state.party[0],
        hp: 12, // Wounded down to 12 / 28
        limitedUses: {
          action_surge: { name: 'Action Surge', current: 0, max: 1, resetOn: 'short_rest' }
        }
      },
      {
        ...state.party[1],
        spellSlots: {
          ...state.party[1].spellSlots!,
          level_1: { current: 2, max: 4 }, // Spent two level 1 slots
          level_2: { current: 1, max: 2 }  // Spent one level 2 slot
        }
      }
    ];
    state = { ...state, party: postCombatParty };

    // ------------------------------------------------------------------------
    // Step 4: Quest Objective Completion & Reward Payouts
    // ------------------------------------------------------------------------
    const obj2Action: AppAction = {
      type: 'UPDATE_QUEST_OBJECTIVE',
      payload: { questId: 'quest_goblin_warlord', objectiveId: 'obj_slay_warlord', isCompleted: true }
    };
    state = { ...state, ...questReducer(state, obj2Action) };

    // Quest is now fully completed!
    expect(state.questLog[0].status).toBe(QuestStatus.Completed);
    // Gold awarded (50 starting + 300 reward = 350 gold)
    expect(state.gold).toBe(350);
    // XP awarded to both party members (500 starting + 600 reward = 1100 XP)
    expect(state.party[0].xp).toBe(1100);
    expect(state.party[1].xp).toBe(1100);
    // Torch reward added to inventory
    expect(state.inventory.some(i => i.name === 'Torch')).toBe(true);

    // ------------------------------------------------------------------------
    // Step 5: Short Rest Healing in the Field
    // ------------------------------------------------------------------------
    // Fighter spends 2 d10 hit dice to recover 14 HP (12 + 14 = 26 HP)
    const shortRestAction: AppAction = {
      type: 'SHORT_REST',
      payload: {
        healingByCharacterId: { 'pc-fighter': 14 },
        hitPointDiceUpdates: {
          'pc-fighter': [{ die: 10, current: 1, max: 3 }] // 2 dice spent, 1 left
        }
      }
    };
    state = { ...state, ...characterReducer(state, shortRestAction) };

    // Fighter healed to 26 HP
    expect(state.party[0].hp).toBe(26);
    expect(state.party[0].hitPointDice?.[0].current).toBe(1);
    // Fighter Action Surge recharged from short rest
    expect(state.party[0].limitedUses?.action_surge.current).toBe(1);

    // ------------------------------------------------------------------------
    // Step 6: Return Travel and Overnight Long Rest Recovery
    // ------------------------------------------------------------------------
    // Party returns to the town tavern and settles in for a Long Rest
    const longRestAction: AppAction = {
      type: 'LONG_REST',
      payload: {}
    };
    state = { ...state, ...characterReducer(state, longRestAction) };

    // Provisions consumed: 2 rations and 2 water consumed from inventory
    const remainingRations = state.inventory.filter(i => i.id === 'rations');
    const remainingWater = state.inventory.filter(i => i.id === 'water-day');
    expect(remainingRations).toHaveLength(0);
    expect(remainingWater).toHaveLength(0);

    // Full HP restored to maximum (28/28)
    expect(state.party[0].hp).toBe(28);
    expect(state.party[1].hp).toBe(18);

    // Hit dice pools fully restored to maximum (3/3)
    expect(state.party[0].hitPointDice?.[0].current).toBe(3);
    expect(state.party[1].hitPointDice?.[0].current).toBe(3);

    // All spell slots fully replenished
    expect(state.party[1].spellSlots?.level_1.current).toBe(4);
    expect(state.party[1].spellSlots?.level_2.current).toBe(2);

    // All abilities recharged
    expect(state.party[0].limitedUses?.action_surge.current).toBe(1);
    expect(state.party[1].limitedUses?.arcane_recovery.current).toBe(1);
  });
});
