/**
 * Turn-coordinator duration tick-down and cleanup tests.
 *
 * Verifies that round-based activeEffects and conditions correctly decrement on
 * turn start and are removed cleanly when they expire, and that Armor Class is
 * dynamically recalculated on expiration to prevent permanent stat drift.
 */
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useTurnManager } from '../useTurnManager';
import type { CombatCharacter, LightSource } from '@/types/combat';
import type { Class } from '@/types';

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

const makeCharacter = (overrides: Partial<CombatCharacter> = {}): CombatCharacter => ({
  id: 'target',
  name: 'Target',
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
  team: 'enemy',
  currentHP: 20,
  maxHP: 20,
  initiative: 0,
  statusEffects: [],
  actionEconomy: {
    action: { used: false, remaining: 1 },
    bonusAction: { used: false, remaining: 1 },
    reaction: { used: false, remaining: 1 },
    legendary: { used: 0, total: 0 },
    movement: { used: 0, total: 30 },
    freeActions: 0
  },
  ...overrides
});

describe('useTurnManager duration tick-down & AC recalculation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('correctly ticks down round-based activeEffects on turn start', () => {
    const target = makeCharacter({
      activeEffects: [{
        id: 'bless-spell',
        spellId: 'bless',
        casterId: 'some-caster',
        sourceName: 'Bless',
        type: 'buff',
        duration: { type: 'rounds', value: 2 },
        startTime: 0
      }]
    });
    const onCharacterUpdate = vi.fn();

    const { result } = renderHook(() => useTurnManager({
      characters: [target],
      mapData: null,
      onCharacterUpdate,
      onLogEntry: vi.fn()
    }));

    act(() => {
      result.current.initializeCombat([target]);
    });

    const updatedTarget = onCharacterUpdate.mock.calls
      .map(call => call[0] as CombatCharacter)
      .filter(character => character.id === target.id && character.activeEffects && character.activeEffects.length > 0)
      .pop();

    expect(updatedTarget).toBeDefined();
    expect(updatedTarget?.activeEffects?.[0].duration.value).toBe(1);
  });

  it('completely removes round-based activeEffects when duration reaches 0', () => {
    const target = makeCharacter({
      activeEffects: [{
        id: 'shield-spell',
        spellId: 'shield',
        casterId: 'some-caster',
        sourceName: 'Shield',
        type: 'buff',
        duration: { type: 'rounds', value: 1 },
        startTime: 0
      }]
    });
    const onCharacterUpdate = vi.fn();

    const { result } = renderHook(() => useTurnManager({
      characters: [target],
      mapData: null,
      onCharacterUpdate,
      onLogEntry: vi.fn()
    }));

    act(() => {
      result.current.initializeCombat([target]);
    });

    // Check last update call for the target character
    const finalUpdate = onCharacterUpdate.mock.calls
      .map(call => call[0] as CombatCharacter)
      .filter(character => character.id === target.id)
      .pop();

    expect(finalUpdate).toBeDefined();
    expect(finalUpdate?.activeEffects).toEqual([]);
  });

  it('correctly ticks down round-based conditions on turn start', () => {
    const target = makeCharacter({
      conditions: [{
        name: 'restrained',
        duration: { type: 'rounds', value: 3 },
        appliedTurn: 0
      }]
    });
    const onCharacterUpdate = vi.fn();

    const { result } = renderHook(() => useTurnManager({
      characters: [target],
      mapData: null,
      onCharacterUpdate,
      onLogEntry: vi.fn()
    }));

    act(() => {
      result.current.initializeCombat([target]);
    });

    const updatedTarget = onCharacterUpdate.mock.calls
      .map(call => call[0] as CombatCharacter)
      .filter(character => character.id === target.id && character.conditions && character.conditions.length > 0)
      .pop();

    expect(updatedTarget).toBeDefined();
    expect(updatedTarget?.conditions?.[0].duration.value).toBe(2);
  });

  it('completely removes round-based conditions when duration reaches 0', () => {
    const target = makeCharacter({
      conditions: [{
        name: 'blinded',
        duration: { type: 'rounds', value: 1 },
        appliedTurn: 0
      }]
    });
    const onCharacterUpdate = vi.fn();

    const { result } = renderHook(() => useTurnManager({
      characters: [target],
      mapData: null,
      onCharacterUpdate,
      onLogEntry: vi.fn()
    }));

    act(() => {
      result.current.initializeCombat([target]);
    });

    const finalUpdate = onCharacterUpdate.mock.calls
      .map(call => call[0] as CombatCharacter)
      .filter(character => character.id === target.id)
      .pop();

    expect(finalUpdate).toBeDefined();
    expect(finalUpdate?.conditions).toEqual([]);
  });

  it('recalculates character AC dynamically back to base AC when an AC-boosting effect expires', () => {
    const target = makeCharacter({
      baseAC: 12,
      armorClass: 17,
      activeEffects: [{
        id: 'shield-spell',
        spellId: 'shield',
        casterId: 'some-caster',
        sourceName: 'Shield',
        type: 'buff',
        duration: { type: 'rounds', value: 1 },
        startTime: 0,
        mechanics: {
          acBonus: 5
        }
      }]
    });
    const onCharacterUpdate = vi.fn();

    const { result } = renderHook(() => useTurnManager({
      characters: [target],
      mapData: null,
      onCharacterUpdate,
      onLogEntry: vi.fn()
    }));

    act(() => {
      result.current.initializeCombat([target]);
    });

    const finalUpdate = onCharacterUpdate.mock.calls
      .map(call => call[0] as CombatCharacter)
      .filter(character => character.id === target.id)
      .pop();

    expect(finalUpdate).toBeDefined();
    expect(finalUpdate?.activeEffects).toEqual([]);
    expect(finalUpdate?.armorClass).toBe(12); // Restored to base AC!
  });

  it('keeps AC boosted if the AC-boosting effect has remaining duration', () => {
    const target = makeCharacter({
      baseAC: 12,
      armorClass: 17,
      activeEffects: [{
        id: 'shield-spell',
        spellId: 'shield',
        casterId: 'some-caster',
        sourceName: 'Shield',
        type: 'buff',
        duration: { type: 'rounds', value: 2 },
        startTime: 0,
        mechanics: {
          acBonus: 5
        }
      }]
    });
    const onCharacterUpdate = vi.fn();

    const { result } = renderHook(() => useTurnManager({
      characters: [target],
      mapData: null,
      onCharacterUpdate,
      onLogEntry: vi.fn()
    }));

    act(() => {
      result.current.initializeCombat([target]);
    });

    const finalUpdate = onCharacterUpdate.mock.calls
      .map(call => call[0] as CombatCharacter)
      .filter(character => character.id === target.id)
      .pop();

    expect(finalUpdate).toBeDefined();
    expect(finalUpdate?.activeEffects?.length).toBe(1);
    expect(finalUpdate?.activeEffects?.[0].duration.value).toBe(1);
    expect(finalUpdate?.armorClass).toBe(17); // AC remains boosted!
  });

  it('removes expired timed light sources at the next turn boundary', () => {
    const target = makeCharacter();
    const expiredLight: LightSource = {
      id: 'expired-light',
      sourceSpellId: 'dancing-lights',
      casterId: target.id,
      brightRadius: 10,
      dimRadius: 10,
      attachedTo: 'caster',
      attachedToCharacterId: target.id,
      createdTurn: 0,
      expiresAtRound: 0
    };
    const persistentLight: LightSource = {
      id: 'persistent-light',
      sourceSpellId: 'continual-flame',
      casterId: target.id,
      brightRadius: 20,
      dimRadius: 20,
      attachedTo: 'point',
      position: { x: 1, y: 1 },
      createdTurn: 0
    };

    const { result } = renderHook(() => useTurnManager({
      characters: [target],
      mapData: null,
      onCharacterUpdate: vi.fn(),
      onLogEntry: vi.fn()
    }));

    act(() => {
      // The turn manager owns active light sources as map artifacts. Seeding
      // both an expired timed light and an untimed light proves the cleanup
      // removes only the spell artifact whose duration has elapsed.
      result.current.setActiveLightSources([expiredLight, persistentLight]);
    });

    act(() => {
      result.current.initializeCombat([target]);
    });

    expect(result.current.activeLightSources.map(light => light.id)).toEqual(['persistent-light']);
  });

  it('recalculates movement total when a speed debuff expires at the next turn boundary', async () => {
    const lead = makeCharacter({
      id: 'lead',
      name: 'Lead',
      stats: {
        strength: 10,
        dexterity: 18,
        constitution: 12,
        intelligence: 10,
        wisdom: 10,
        charisma: 8,
        baseInitiative: 4,
        speed: 30,
        cr: '1'
      }
    });
    const target = makeCharacter({
      id: 'target',
      name: 'Target',
      stats: {
        strength: 10,
        dexterity: 10,
        constitution: 12,
        intelligence: 10,
        wisdom: 10,
        charisma: 8,
        baseInitiative: 0,
        speed: 30,
        cr: '1'
      },
      statusEffects: [{
        id: 'slasher-slow',
        name: 'Slasher Slow',
        type: 'debuff',
        duration: 1,
        effect: {
          type: 'stat_modifier',
          stat: 'speed',
          value: -10
        }
      }],
      conditions: [{
        name: 'Slasher Slow',
        duration: { type: 'rounds', value: 1 },
        appliedTurn: 0,
        source: 'Slasher Slow'
      }]
    });
    const onCharacterUpdate = vi.fn();
    const onLogEntry = vi.fn();
    const randomSpy = vi.spyOn(Math, 'random')
      .mockReturnValueOnce(0.99)
      .mockReturnValueOnce(0.0);

    const { result } = renderHook(() => useTurnManager({
      characters: [lead, target],
      mapData: null,
      onCharacterUpdate,
      onLogEntry
    }));

    act(() => {
      result.current.initializeCombat([lead, target]);
    });

    const slowedTarget = onCharacterUpdate.mock.calls
      .map(call => call[0] as CombatCharacter)
      .reverse()
      .find(character => character.id === target.id && character.actionEconomy.movement.total === 20);

    expect(slowedTarget).toBeDefined();

    await act(async () => {
      await result.current.endTurn();
    });

    const restoredTarget = onCharacterUpdate.mock.calls
      .map(call => call[0] as CombatCharacter)
      .reverse()
      .find(character => character.id === target.id && character.actionEconomy.movement.total === 30);

    expect(restoredTarget).toBeDefined();
    expect(restoredTarget?.statusEffects).toEqual([]);
    expect(restoredTarget?.conditions).toEqual([]);

    randomSpy.mockRestore();
  });
});
