/**
 * This file tests the combat turn sequence, initiative progression, and status effect tick-downs.
 *
 * In Aralia's tactical combat engine, combatants act in order of initiative. Each combatant gets
 * a fresh action economy (Action, Bonus Action, Reaction, Movement) when their turn begins.
 * Round transitions advance the combat clock by 6 seconds per round, decrement active effect
 * and spell durations, and prompt death saving throws for downed combatants.
 *
 * Called by: Vitest test runner (part of the gameplay test suite)
 * Depends on: useTurnManager, initiativeUtils, groupTurnUtils, deathSaveUtils, statusConditionUtils
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useTurnManager, advanceTurnEndConditionExpiry } from '../../../hooks/combat/useTurnManager';
import {
  buildInitiativeOrder,
  rollInitiativeTotal,
  compareInitiativeTieFacts
} from '../../../utils/combat/initiativeUtils';
import { buildCombatTurnGroups } from '../../../utils/combat/groupTurnUtils';
import {
  resolveDeathSavingThrow,
  applyTemporaryHitPoints,
  isIncapacitated
} from '../../../utils/combat/deathSaveUtils';
import { resetEconomy } from '../../../utils/combat/actionEconomyUtils';
import { CombatCharacter, ActiveEffect, StatusEffect } from '../../../types/combat';
import { Class } from '../../../types';

// ============================================================================
// Test Fixtures and Helpers
// ============================================================================
// This section provides factory functions to create combat characters with
// customized stats, teams, action economies, and active spell effects.
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

/**
 * Helper to construct a combat character with full defaults.
 */
function createCombatant(overrides: Partial<CombatCharacter> = {}): CombatCharacter {
  return {
    id: 'combatant-1',
    name: 'Valeros',
    level: 3,
    class: mockFighterClass,
    position: { x: 5, y: 5 },
    stats: {
      strength: 16,
      dexterity: 14, // +2 modifier
      constitution: 14,
      intelligence: 10,
      wisdom: 12,
      charisma: 10,
      baseInitiative: 0,
      speed: 30,
      cr: '0'
    },
    abilities: [],
    team: 'player',
    currentHP: 28,
    maxHP: 28,
    initiative: 15,
    statusEffects: [],
    conditions: [],
    actionEconomy: {
      action: { used: false, remaining: 1 },
      bonusAction: { used: false, remaining: 1 },
      reaction: { used: false, remaining: 1 },
      legendary: { used: 0, total: 0 },
      movement: { used: 0, total: 30 },
      freeActions: 0
    },
    ...overrides
  };
}

// ============================================================================
// Initiative Ordering and Arbitration Suite
// ============================================================================
// Proves that initiative rolls properly calculate modifiers and sort participants
// descending by roll, with deterministic tie-breaking.
// ============================================================================

describe('Gameplay Flow - Combat Initiative & Turn Order', () => {
  it('calculates initiative total from d20 roll plus Dexterity modifier and base bonus', () => {
    const rogue = createCombatant({
      stats: {
        strength: 10,
        dexterity: 18, // +4 modifier
        constitution: 12,
        intelligence: 14,
        wisdom: 10,
        charisma: 12,
        baseInitiative: 2, // e.g. Alert or class feature bonus
        speed: 30,
        cr: '0'
      }
    });

    // Mock RNG source to return 0.745 -> (0.745 * 20) + 1 = 15 on d20
    const mockRng = () => 0.745;
    const total = rollInitiativeTotal(rogue, mockRng);

    // 15 (d20) + 4 (Dex mod) + 2 (baseInitiative) = 21
    expect(total).toBe(21);
  });

  it('sorts combatants strictly descending by initiative and breaks ties by Dexterity', () => {
    const highInit = createCombatant({ id: 'c1', name: 'High', initiative: 22 });
    const tiedLowDex = createCombatant({
      id: 'c2',
      name: 'Tied Low Dex',
      initiative: 14,
      stats: { ...createCombatant().stats, dexterity: 10 }
    });
    const tiedHighDex = createCombatant({
      id: 'c3',
      name: 'Tied High Dex',
      initiative: 14,
      stats: { ...createCombatant().stats, dexterity: 16 }
    });
    const lowInit = createCombatant({ id: 'c4', name: 'Low', initiative: 8 });

    const sorted = buildInitiativeOrder([lowInit, tiedLowDex, highInit, tiedHighDex]);

    // Expected order: High (22) -> Tied High Dex (14, Dex 16) -> Tied Low Dex (14, Dex 10) -> Low (8)
    expect(sorted.map(c => c.id)).toEqual(['c1', 'c3', 'c2', 'c4']);
  });

  it('constructs turn groups that keep summons directly linked with their caster', () => {
    const wizard = createCombatant({ id: 'wizard', name: 'Wizard', team: 'player', initiative: 18 });
    const familiar = createCombatant({
      id: 'familiar',
      name: 'Raven Familiar',
      team: 'player',
      initiative: 18,
      isSummon: true,
      summonMetadata: {
        casterId: 'wizard',
        spellId: 'test-shared-summon',
        initiativePolicy: 'shared'
      }
    });
    const goblin = createCombatant({ id: 'goblin', name: 'Goblin Archer', team: 'enemy', initiative: 12 });

    const groups = buildCombatTurnGroups([wizard, familiar, goblin]);

    expect(groups.length).toBeGreaterThan(0);
    // Wizard and familiar should be in the same turn group
    const wizardGroup = groups.find(g => g.memberIds.includes('wizard'));
    expect(wizardGroup?.memberIds).toContain('familiar');
  });
});

// Disable the background combat AI timer so turns advance only via explicit test actions.
vi.mock('../../../hooks/combat/useCombatAI', () => ({
  useCombatAI: () => ({ aiState: 'idle' }),
}));

// ============================================================================
// Turn Arbitration & Action Economy Reset Suite
// ============================================================================
// Verifies turn advancement through useTurnManager, action economy refreshes,
// and round counter progression.
// ============================================================================

describe('Gameplay Flow - Combat Turn & Round Cycles', () => {
  it('refreshes action economy when a combatant begins their turn', () => {
    // Start with expended actions
    const spentCombatant = createCombatant({
      actionEconomy: {
        action: { used: true, remaining: 0 },
        bonusAction: { used: true, remaining: 0 },
        reaction: { used: true, remaining: 0 },
        legendary: { used: 0, total: 0 },
        movement: { used: 30, total: 30 },
        freeActions: 0
      }
    });

    const refreshedCharacter = resetEconomy(spentCombatant);
    const refreshedEconomy = refreshedCharacter.actionEconomy;

    expect(refreshedEconomy.action.remaining).toBe(1);
    expect(refreshedEconomy.action.used).toBe(false);
    expect(refreshedEconomy.bonusAction.remaining).toBe(1);
    expect(refreshedEconomy.reaction.remaining).toBe(1);
    expect(refreshedEconomy.movement.used).toBe(0);
    expect(refreshedEconomy.movement.total).toBe(30);
  });

  it('cycles active combatant on endTurn and triggers round completion callback after full rotation', () => {
    const hero = createCombatant({ id: 'hero', name: 'Hero', team: 'player', initiative: 20 });
    const villain = createCombatant({ id: 'villain', name: 'Villain', team: 'enemy', initiative: 10 });

    const onCharacterUpdate = vi.fn();
    const onLogEntry = vi.fn();
    const onRoundElapsed = vi.fn();

    const { result } = renderHook(() =>
      useTurnManager({
        characters: [hero, villain],
        mapData: null,
        onCharacterUpdate,
        onLogEntry,
        onRoundElapsed,
        initiativeRoller: (character) => character.initiative
      })
    );

    // Initialize combat sequence
    act(() => {
      result.current.initializeCombat([hero, villain]);
    });

    // First turn belongs to Hero (highest initiative: 20, Round 1)
    expect(result.current.turnState.currentCharacterId).toBe('hero');
    expect(result.current.turnState.currentTurn).toBe(1);
    expect(onRoundElapsed).not.toHaveBeenCalled();

    // End Hero's turn -> should transition to Villain (still Round 1)
    act(() => {
      result.current.endTurn();
    });

    expect(result.current.turnState.currentCharacterId).toBe('villain');
    expect(result.current.turnState.currentTurn).toBe(1);
    expect(onRoundElapsed).not.toHaveBeenCalled();

    // End Villain's turn -> full round completed! Starts Round 2 with Hero
    act(() => {
      result.current.endTurn();
    });

    expect(result.current.turnState.currentCharacterId).toBe('hero');
    expect(result.current.turnState.currentTurn).toBe(2);
    // 6 seconds elapsed in the combat simulation for completing round 1
    expect(onRoundElapsed).toHaveBeenCalledTimes(1);
    expect(onRoundElapsed).toHaveBeenCalledWith(6);
  });
});

// ============================================================================
// Status Duration Tick-Down & Death Saves Suite
// ============================================================================
// Tests that buffs/debuffs tick down at turn boundaries and downed combatants
// resolve death saving throws cleanly.
// ============================================================================

describe('Gameplay Flow - Status Durations & Death Saves', () => {
  it('decrements round-based active effects on turn start and removes expired ones', () => {
    const buffedHero = createCombatant({
      id: 'buffed-hero',
      name: 'Buffed Hero',
      initiative: 20,
      activeEffects: [
        {
          id: 'bless-buff',
          spellId: 'bless',
          casterId: 'buffed-hero',
          sourceName: 'Bless',
          type: 'buff',
          duration: { type: 'rounds', value: 2 }, // 2 rounds -> ticks down to 1
          startTime: 0
        },
        {
          id: 'shield-of-faith',
          spellId: 'shield_of_faith',
          casterId: 'buffed-hero',
          sourceName: 'Shield of Faith',
          type: 'buff',
          duration: { type: 'rounds', value: 1 }, // 1 round -> expires and removed
          startTime: 0
        }
      ]
    });

    const onCharacterUpdate = vi.fn();

    const { result } = renderHook(() =>
      useTurnManager({
        characters: [buffedHero],
        mapData: null,
        onCharacterUpdate,
        onLogEntry: vi.fn()
      })
    );

    // Initialize combat
    act(() => {
      result.current.initializeCombat([buffedHero]);
    });

    // First turn start ticks down active effects
    const lastUpdate = onCharacterUpdate.mock.calls
      .map(call => call[0] as CombatCharacter)
      .filter(c => c.id === 'buffed-hero')
      .pop();

    expect(lastUpdate).toBeDefined();
    // Bless should have ticked down from 2 to 1 round
    const blessEffect = lastUpdate?.activeEffects?.find(e => e.id === 'bless-buff');
    expect(blessEffect).toBeDefined();
    expect(blessEffect?.duration.value).toBe(1);

    // Shield of Faith was 1 round so it expired and was removed
    const expiredShield = lastUpdate?.activeEffects?.find(e => e.id === 'shield-of-faith');
    expect(expiredShield).toBeUndefined();
  });

  it('resolves death saving throws on turn start for player characters at 0 HP', () => {
    const downedHero = createCombatant({
      id: 'downed-hero',
      name: 'Downed Hero',
      currentHP: 0,
      deathSaves: { successes: 1, failures: 1, isStable: false }
    });

    // Test a roll of 15 (Standard Success)
    const successResult = resolveDeathSavingThrow(downedHero, 15);
    expect(successResult.outcome).toBe('success');
    expect(successResult.character.deathSaves?.successes).toBe(2);
    expect(successResult.character.deathSaves?.failures).toBe(1);

    // Test a roll of 4 (Standard Failure)
    const failureResult = resolveDeathSavingThrow(downedHero, 4);
    expect(failureResult.outcome).toBe('failure');
    expect(failureResult.character.deathSaves?.failures).toBe(2);

    // Test a roll of 1 (Critical Failure -> 2 failures)
    const critFailHero = createCombatant({
      ...downedHero,
      deathSaves: { successes: 0, failures: 1, isStable: false }
    });
    const critFailResult = resolveDeathSavingThrow(critFailHero, 1);
    expect(critFailResult.character.deathSaves?.failures).toBe(3);
    expect(critFailResult.outcome).toBe('dead');

    // Test a roll of 20 (Natural 20 -> Restores 1 HP and consciousness)
    const nat20Result = resolveDeathSavingThrow(downedHero, 20);
    expect(nat20Result.outcome).toBe('revived');
    expect(nat20Result.character.currentHP).toBe(1);
  });

  it('correctly identifies incapacitated status conditions preventing combat actions', () => {
    const activeHero = createCombatant({ currentHP: 20 });
    const unconsciousHero = createCombatant({
      currentHP: 0,
      statusEffects: [{ id: 'se-1', name: 'Unconscious', type: 'debuff', duration: 10, source: 'injury' }]
    });
    const paralyzedHero = createCombatant({
      conditions: [{ name: 'Paralyzed', duration: { type: 'rounds', value: 2 }, appliedTurn: 0 }]
    });

    expect(isIncapacitated(activeHero)).toBe(false);
    expect(isIncapacitated(unconsciousHero)).toBe(true);
    expect(isIncapacitated(paralyzedHero)).toBe(true);
  });
});
