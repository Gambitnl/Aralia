import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useTurnManager } from '../useTurnManager';
import type { CombatCharacter } from '@/types/combat';
import type { Class } from '@/types';
import { canAffordActionCost } from '../../../utils/combat/actionEconomyUtils';
import { applyDamageAndCheckDowned, applyHealingAndRestore } from '../../../utils/combat/deathSaveUtils';

const mockClass: Class = {
  id: 'fighter',
  name: 'Fighter',
  description: 'A martial combatant.',
  hitDie: 10,
  primaryAbility: ['Strength'],
  savingThrowProficiencies: ['Strength', 'Constitution'],
  skillProficienciesAvailable: [],
  numberOfSkillProficiencies: 2,
  armorProficiencies: [],
  weaponProficiencies: [],
  features: []
};

const makeCharacter = (id: string, overrides: Partial<CombatCharacter> = {}): CombatCharacter => ({
  id,
  name: id === 'player1' ? 'Hero' : 'Goblin',
  level: 3,
  class: mockClass,
  position: { x: 0, y: 0 },
  stats: {
    strength: 10,
    dexterity: 12,
    constitution: 12,
    intelligence: 10,
    wisdom: 10,
    charisma: 8,
    baseInitiative: 0,
    speed: 30,
    cr: '0'
  },
  abilities: [],
  team: id === 'player1' ? 'player' : 'enemy',
  currentHP: 10,
  maxHP: 10,
  initiative: 0,
  statusEffects: [],
  actionEconomy: {
    action: { used: false, remaining: 1 },
    bonusAction: { used: false, remaining: 1 },
    reaction: { used: false, remaining: 1 },
    legendary: { used: 0, total: 0 },
    movement: { used: 0, total: 30 },
    freeActions: 1
  },
  ...overrides
});

describe('Death Saving Throws & Unconsciousness logic', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('initializes downed state when a player drops to 0 HP', () => {
    const player = makeCharacter('player1', { currentHP: 10 });
    const damaged = applyDamageAndCheckDowned(player, 15);

    expect(damaged.currentHP).toBe(0);
    expect(damaged.deathSaves).toEqual({
      successes: 0,
      failures: 0,
      isStable: false
    });
    expect(damaged.statusEffects.some(se => se.name === 'Unconscious')).toBe(true);
    expect(damaged.conditions?.some(c => c.name === 'Unconscious')).toBe(true);
  });

  it('restores consciousness when a downed character is healed', () => {
    const player = makeCharacter('player1', { currentHP: 10 });
    const downed = applyDamageAndCheckDowned(player, 10); // Initialize downed state correctly from >0 HP
    
    expect(downed.currentHP).toBe(0);
    expect(downed.deathSaves).toBeDefined();
    expect(downed.statusEffects.some(se => se.name === 'Unconscious')).toBe(true);

    const healed = applyHealingAndRestore(downed, 5);

    expect(healed.currentHP).toBe(5);
    expect(healed.deathSaves).toBeUndefined();
    expect(healed.statusEffects.some(se => se.name === 'Unconscious')).toBe(false);
  });

  it('applies a death save failure when a downed player takes damage', () => {
    const player = makeCharacter('player1', { currentHP: 10 });
    const downed = applyDamageAndCheckDowned(player, 10); // Initialize downed

    const damaged = applyDamageAndCheckDowned(downed, 5, false); // Standard hit

    expect(damaged.currentHP).toBe(0);
    expect(damaged.deathSaves?.failures).toBe(1);
    expect(damaged.deathSaves?.isStable).toBe(false);
  });

  it('applies two death save failures when a downed player takes a critical hit', () => {
    const player = makeCharacter('player1', { currentHP: 10 });
    const downed = applyDamageAndCheckDowned(player, 10); // Initialize downed

    const damaged = applyDamageAndCheckDowned(downed, 5, true); // Critical hit

    expect(damaged.currentHP).toBe(0);
    expect(damaged.deathSaves?.failures).toBe(2);
  });

  it('restricts actions and movement for unconscious characters', () => {
    const player = makeCharacter('player1', { currentHP: 10 });
    const downed = applyDamageAndCheckDowned(player, 10); // Unconscious downed character

    // Try to take standard action
    const canTakeAction = canAffordActionCost(downed, { type: 'action' });
    expect(canTakeAction).toBe(false);

    // Try to take movement
    const canMove = canAffordActionCost(downed, { type: 'movement-only', movementCost: 5 });
    expect(canMove).toBe(false);
  });

  it('rolls a death saving throw on turn start for a downed player (reviving on 20)', () => {
    const player = makeCharacter('player1', { currentHP: 10 });
    const downed = applyDamageAndCheckDowned(player, 10);

    // Mock Math.random to return 0.99 (which yields a d20 roll of 20)
    const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0.99);

    const onCharacterUpdate = vi.fn();
    const { result } = renderHook(() => useTurnManager({
      characters: [downed],
      mapData: null,
      onCharacterUpdate,
      onLogEntry: vi.fn()
    }));

    act(() => {
      result.current.initializeCombat([downed]);
    });

    // Check if the updated character regained HP and woke up
    const revivedChar = onCharacterUpdate.mock.calls
      .map(call => call[0] as CombatCharacter)
      .reverse() // Get latest update
      .find(c => c.id === 'player1' && c.currentHP > 0);

    expect(revivedChar).toBeDefined();
    expect(revivedChar?.currentHP).toBe(1);
    expect(revivedChar?.deathSaves).toBeUndefined();
    expect(revivedChar?.statusEffects.some(se => se.name === 'Unconscious')).toBe(false);

    randomSpy.mockRestore();
  });

  it('rolls a death saving throw on turn start for a downed player (2 failures on 1)', () => {
    const player = makeCharacter('player1', { currentHP: 10 });
    const downed = applyDamageAndCheckDowned(player, 10);

    // Mock Math.random to return 0.0 (which yields a d20 roll of 1)
    const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0.0);

    const onCharacterUpdate = vi.fn();
    const { result } = renderHook(() => useTurnManager({
      characters: [downed],
      mapData: null,
      onCharacterUpdate,
      onLogEntry: vi.fn()
    }));

    act(() => {
      result.current.initializeCombat([downed]);
    });

    const updatedChar = onCharacterUpdate.mock.calls
      .map(call => call[0] as CombatCharacter)
      .reverse() // Get latest update
      .find(c => c.id === 'player1');

    expect(updatedChar).toBeDefined();
    expect(updatedChar?.deathSaves?.failures).toBe(2);

    randomSpy.mockRestore();
  });

  it('rolls a death saving throw on turn start (success on 10-19)', () => {
    const player = makeCharacter('player1', { currentHP: 10 });
    const downed = applyDamageAndCheckDowned(player, 10);

    // Mock Math.random to return 0.5 (which yields a d20 roll of 11)
    const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0.5);

    const onCharacterUpdate = vi.fn();
    const { result } = renderHook(() => useTurnManager({
      characters: [downed],
      mapData: null,
      onCharacterUpdate,
      onLogEntry: vi.fn()
    }));

    act(() => {
      result.current.initializeCombat([downed]);
    });

    const updatedChar = onCharacterUpdate.mock.calls
      .map(call => call[0] as CombatCharacter)
      .reverse() // Get latest update
      .find(c => c.id === 'player1');

    expect(updatedChar).toBeDefined();
    expect(updatedChar?.deathSaves?.successes).toBe(1);

    randomSpy.mockRestore();
  });

  it('drops concentration and cleans up status effects on other characters when a character is downed', () => {
    const player = makeCharacter('player1', {
      currentHP: 5,
      maxHP: 10,
      team: 'player',
      stats: {
        strength: 10,
        dexterity: 12,
        constitution: 12,
        intelligence: 10,
        wisdom: 10,
        charisma: 8,
        baseInitiative: 10,
        speed: 30,
        cr: '0'
      },
      concentratingOn: {
        spellId: 'bless',
        spellName: 'Bless',
        spellLevel: 1,
        startedTurn: 0,
        effectIds: ['bless-effect-ally'],
        canDropAsFreeAction: true
      }
    });

    const ally = makeCharacter('player2', {
      currentHP: 10,
      maxHP: 10,
      team: 'player',
      statusEffects: [{
        id: 'bless-effect-ally',
        name: 'Bless',
        duration: 10,
        type: 'buff'
      }]
    });

    const onCharacterUpdate = vi.fn();
    const onLogEntry = vi.fn();

    const { result } = renderHook(() => useTurnManager({
      characters: [player, ally],
      mapData: null,
      onCharacterUpdate,
      onLogEntry
    }));

    // Register a scheduled damage effect that will trigger on turn start and deal enough damage to down the player
    const scheduledEffect = {
      id: 'test-scheduled-damage',
      spellId: 'bless',
      casterId: 'player1',
      targetId: 'player1',
      timing: 'turn_start',
      createdAtRound: 1,
      effects: [{
        type: 'damage',
        dice: '3d6', // Average 10.5 damage, guaranteed to drop 5 HP to 0
        damageType: 'radiant',
        trigger: { type: 'turn_start', frequency: 'once' }
      }]
    };

    act(() => {
      result.current.addScheduledSpellEffect(scheduledEffect as any);
    });

    // Mock Math.random for initiative and dice rolling (so dice roll doesn't fail to deal damage)
    // We want the damage to be high, so let's mock Math.random to return 0.9 (high damage rolls)
    const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0.9);

    act(() => {
      // Initialize combat and start turn (which triggers turn_start scheduled effects)
      result.current.initializeCombat([player, ally]);
    });

    // Verify player is updated to 0 HP and has lost concentration
    const updatedPlayer = onCharacterUpdate.mock.calls
      .map(call => call[0] as CombatCharacter)
      .find(c => c.id === 'player1' && c.currentHP === 0);

    expect(updatedPlayer).toBeDefined();
    expect(updatedPlayer?.concentratingOn).toBeUndefined();

    // Verify ally is updated and has lost Bless status effect
    const updatedAlly = onCharacterUpdate.mock.calls
      .map(call => call[0] as CombatCharacter)
      .find(c => c.id === 'player2');

    expect(updatedAlly).toBeDefined();
    expect(updatedAlly?.statusEffects.some(se => se.id === 'bless-effect-ally')).toBe(false);

    // Verify concentration loss is logged
    const logMessages = onLogEntry.mock.calls.map(call => call[0].message);
    expect(logMessages.some(msg => msg.includes('falls unconscious and loses concentration on Bless'))).toBe(true);

    randomSpy.mockRestore();
  });
});

