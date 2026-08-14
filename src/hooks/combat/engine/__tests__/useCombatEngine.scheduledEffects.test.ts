import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useCombatEngine } from '../useCombatEngine';
import type { CombatCharacter, CombatLogEntry } from '../../../../types/combat';
import type { ActiveSpellZone, ScheduledSpellEffect } from '../../../../systems/spells/effects';
import * as savingThrowUtils from '@/utils/character';

vi.mock('@/utils/character/savingThrowUtils', async importOriginal => {
  const actual = await importOriginal<typeof import('@/utils/character')>();
  return {
    ...actual,
    rollSavingThrow: vi.fn(() => ({ total: 8, success: false, modifiersApplied: [] }))
  };
});

beforeEach(() => {
  // Each case owns its saving-throw transaction. Clearing call history keeps
  // once-only assertions independent while preserving the shared failure stub.
  vi.clearAllMocks();
  vi.mocked(savingThrowUtils.rollSavingThrow).mockReturnValue({
    total: 8,
    success: false,
    modifiersApplied: [],
  });
});

/**
 * These tests prove that delayed turn-start / turn-end spell effects use the
 * same durable runtime bridges as immediate spell effects.
 *
 * Scheduled effects are registered when a spell is cast, then resolved later by
 * the combat engine. That delay is where metadata and movement behavior can get
 * lost, so this file keeps direct coverage on the two gap slices tracked by the
 * Structured Spell Execution project.
 */

// ----------------------------------------------------------------------------
// Test Character Setup
// ----------------------------------------------------------------------------
// The engine only needs a compact combatant shape for these scheduled-effect
// tests. Keeping this builder local makes each test show which positions and
// immunity flags matter for the behavior under inspection.
// ----------------------------------------------------------------------------
const createCharacter = (overrides: Partial<CombatCharacter> = {}): CombatCharacter => ({
  id: 'target',
  name: 'Target',
  team: 'enemy',
  level: 1 as any,
  class: { id: 'fighter', name: 'Fighter', description: '', hitDie: 10, primaryAbility: ['Strength'], savingThrowProficiencies: [], skillProficienciesAvailable: [], numberOfSkillProficiencies: 0, armorProficiencies: [], weaponProficiencies: [], features: [] } as any,
  currentHP: 20,
  maxHP: 20,
  position: { x: 1, y: 0 },
  statusEffects: [],
  conditions: [],
  damagedThisTurn: false,
  initiative: 0,
  abilities: [],
  actionEconomy: {
    action: { used: false, remaining: 1 },
    bonusAction: { used: false, remaining: 1 },
    reaction: { used: false, remaining: 1 },
    movement: { used: 0, total: 30 },
    freeActions: 1
  },
  stats: {
    strength: 10,
    dexterity: 10,
    constitution: 10,
    intelligence: 10,
    wisdom: 10,
    charisma: 10,
    baseInitiative: 0,
    speed: 30,
    cr: '0'
  },
  ...overrides
} as CombatCharacter);

// ----------------------------------------------------------------------------
// Hook Setup
// ----------------------------------------------------------------------------
// Each test gets fresh callbacks so logs and updates from one scheduled effect
// cannot accidentally satisfy assertions in the next scheduled effect.
// ----------------------------------------------------------------------------
const renderEngine = (
  characters: CombatCharacter[],
  overrides: Partial<Parameters<typeof useCombatEngine>[0]> = {},
) => {
  const onLogEntry = vi.fn<(entry: CombatLogEntry) => void>();
  const onCharacterUpdate = vi.fn<(character: CombatCharacter) => void>();
  const props = {
    characters,
    mapData: null,
    onMapUpdate: vi.fn(),
    addDamageNumber: vi.fn(),
    ...overrides,
    // Tests inspect this exact producer. Keep it after optional mechanical
    // overrides so its Vitest call ledger never widens to a plain callback.
    onCharacterUpdate,
    onLogEntry,
  };

  return { props, ...renderHook(() => useCombatEngine(props)) };
};

// ----------------------------------------------------------------------------
// Canonical Recurring Damage Fixture
// ----------------------------------------------------------------------------
// Searing Smite stores future Fire damage and its Constitution save on one
// recurring status payload. This fixture includes both owned condition mirrors
// plus an unrelated ward so cleanup selectivity is directly observable.
// ----------------------------------------------------------------------------

const createSearingSchedule = (overrides: Partial<ScheduledSpellEffect> = {}): ScheduledSpellEffect => ({
  id: 'scheduled-searing-smite',
  spellId: 'searing-smite',
  casterId: 'caster',
  targetId: 'target',
  timing: 'turn_start',
  createdAtRound: 1,
  expiresAtRound: 11,
  saveDC: 15,
  effects: [{
    type: 'STATUS_CONDITION',
    condition: { type: 'always' },
    statusCondition: { name: 'Ignited' },
  } as any],
  recurringMechanic: {
    timing: 'turn_start',
    frequency: 'every_time',
    damage: { dice: '1d6', type: 'Fire' },
    saveType: 'Constitution',
    saveEffect: 'negates_condition',
    successOutcome: 'spell_ends',
    failureOutcome: 'spell_continues',
  },
  ...overrides,
});

const createIgnitedTarget = (overrides: Partial<CombatCharacter> = {}): CombatCharacter => createCharacter({
  id: 'target',
  team: 'player',
  statusEffects: [
    {
      id: 'owned-ignited',
      name: 'Ignited',
      type: 'debuff',
      duration: 10,
      source: 'Searing Smite',
      sourceSpellId: 'searing-smite',
      sourceCasterId: 'caster',
    },
    {
      id: 'unrelated-ward',
      name: 'Blessed',
      type: 'buff',
      duration: 10,
      source: 'bless',
      sourceSpellId: 'bless',
      sourceCasterId: 'other-caster',
    },
  ],
  conditions: [
    {
      name: 'Ignited',
      duration: { type: 'minutes', value: 1 },
      appliedTurn: 1,
      source: 'searing-smite',
      sourceCasterId: 'caster',
    },
    {
      name: 'Blessed',
      duration: { type: 'rounds', value: 10 },
      appliedTurn: 1,
      source: 'bless',
      sourceCasterId: 'other-caster',
    },
  ],
  activeEffects: [
    {
      id: 'owned-searing-link',
      spellId: 'searing-smite',
      casterId: 'caster',
      sourceName: 'Searing Smite',
      type: 'debuff',
      duration: { type: 'minutes', value: 1 },
      startTime: 1,
    },
    {
      id: 'unrelated-bless-link',
      spellId: 'bless',
      casterId: 'other-caster',
      sourceName: 'Bless',
      type: 'buff',
      duration: { type: 'rounds', value: 10 },
      startTime: 1,
    },
  ],
  ...overrides,
});

// ----------------------------------------------------------------------------
// CS13 Turn-Phase Hazard Fixture
// ----------------------------------------------------------------------------
// This zone uses deterministic one-point damage so tests can isolate save,
// resistance, temporary-HP, and downing ownership without mocking the damage
// transaction itself. The source DC is captured on the real zone record.
// ----------------------------------------------------------------------------

const createTurnPhaseZone = (
  timing: 'turn_start' | 'on_end_turn_in_area',
  requiresSave = false,
): ActiveSpellZone => ({
  id: `cs13-${timing}`,
  spellId: 'sandbox-burning-ground',
  casterId: 'caster',
  position: { x: 1, y: 0 },
  areaOfEffect: { shape: 'cube', size: 5 },
  saveDC: 15,
  effects: [{
    type: 'DAMAGE',
    damage: { dice: '1d1', type: 'Radiant' },
    trigger: { type: timing, frequency: 'first_per_turn' },
    condition: requiresSave
      ? { type: 'save', saveType: 'Dexterity', saveEffect: 'half' }
      : { type: 'always' },
  }],
  triggeredThisTurn: new Set(),
  triggeredEver: new Set(),
});

describe('useCombatEngine scheduled spell effects', () => {
  it('executes a source-backed recurring damage payload through the scheduled engine', () => {
    const caster = createCharacter({ id: 'caster', name: 'Caster', team: 'player', position: { x: 0, y: 0 } });
    const target = createCharacter();
    const scheduledEffect: ScheduledSpellEffect = {
      id: 'scheduled-recurring-damage',
      spellId: 'conjure-elemental',
      casterId: caster.id,
      targetId: target.id,
      timing: 'turn_start',
      createdAtRound: 1,
      effects: [{
        type: 'DAMAGE',
        condition: { type: 'always' }
      } as any],
      recurringMechanic: {
        timing: 'turn_start',
        frequency: 'every_time',
        damage: { dice: '1', type: 'Fire' }
      }
    };
    const { props, result } = renderEngine([caster, target]);

    act(() => {
      result.current.addScheduledSpellEffect(scheduledEffect);
    });

    let updatedTarget = target;
    act(() => {
      updatedTarget = result.current.processScheduledSpellEffects(target, 'turn_start', 2);
    });

    expect(updatedTarget.currentHP).toBe(19);
    expect(props.onLogEntry).toHaveBeenCalledWith(expect.objectContaining({
      message: expect.stringContaining('conjure-elemental'),
      data: expect.objectContaining({ trigger: 'turn_start', damageType: 'Fire' })
    }));
  });

  it('executes a source-backed recurring area turn-start payload', () => {
    const caster = createCharacter({ id: 'caster', name: 'Caster', team: 'player', position: { x: 0, y: 0 } });
    const target = createCharacter();
    const zone = {
      id: 'area-recurring-start',
      spellId: 'wall-of-light',
      casterId: caster.id,
      position: { x: 1, y: 0 },
      areaOfEffect: { shape: 'sphere', size: 10 },
      effects: [{
        type: 'DAMAGE',
        trigger: { type: 'immediate' },
        condition: { type: 'always' },
        recurringMechanics: {
          timing: 'turn_start',
          frequency: 'first_per_turn',
          damage: { dice: '1', type: 'Radiant' }
        }
      }],
      triggeredThisTurn: new Set<string>(),
      triggeredEver: new Set<string>()
    } as any;
    const { props, result } = renderEngine([caster, target]);

    act(() => {
      result.current.addSpellZone(zone);
    });

    let updatedTarget = target;
    act(() => {
      updatedTarget = result.current.processStartOfTurnEffects(target, 2);
    });

    expect(updatedTarget.currentHP).toBe(19);
    expect(props.onLogEntry).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ trigger: 'on_start_turn_in_area', damageType: 'Radiant' })
    }));
  });

  it('resolves a turn-start zone save before the canonical damage transaction', () => {
    const caster = createCharacter({ id: 'caster', team: 'player', position: { x: 0, y: 0 } });
    const target = createCharacter({ currentHP: 1 });
    const { props, result } = renderEngine([caster, target]);
    vi.mocked(savingThrowUtils.rollSavingThrow).mockReturnValue({
      total: 20,
      success: true,
      modifiersApplied: [],
    });

    act(() => result.current.addSpellZone(createTurnPhaseZone('turn_start', true)));

    let updatedTarget = target;
    act(() => {
      updatedTarget = result.current.processStartOfTurnEffects(target, 2);
    });

    expect(updatedTarget.currentHP).toBe(1);
    expect(savingThrowUtils.rollSavingThrow).toHaveBeenCalledWith(target, 'Dexterity', 15);
    expect(props.onLogEntry).toHaveBeenCalledWith(expect.objectContaining({
      type: 'status',
      data: expect.objectContaining({ trigger: 'on_start_turn_in_area', saveResult: true }),
    }));
    expect(props.onLogEntry).toHaveBeenCalledWith(expect.objectContaining({
      type: 'damage',
      data: expect.objectContaining({ damageDealt: 0, trigger: 'on_start_turn_in_area' }),
    }));
  });

  it('routes end-turn zone damage through resistance and temporary HP', () => {
    const caster = createCharacter({ id: 'caster', team: 'player', position: { x: 0, y: 0 } });
    const resistantTarget = createCharacter({ currentHP: 1, resistances: ['Radiant'] });
    const resistantEngine = renderEngine([caster, resistantTarget]);

    act(() => resistantEngine.result.current.addSpellZone(createTurnPhaseZone('on_end_turn_in_area')));

    let afterResistance = resistantTarget;
    act(() => {
      afterResistance = resistantEngine.result.current.processEndOfTurnEffects(resistantTarget, 2);
    });
    expect(afterResistance.currentHP).toBe(1);
    expect(resistantEngine.props.onLogEntry).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ damageDealt: 0, trigger: 'on_end_turn_in_area' }),
    }));

    const wardedTarget = createCharacter({ currentHP: 1, tempHP: 1 });
    const wardedEngine = renderEngine([caster, wardedTarget]);
    act(() => wardedEngine.result.current.addSpellZone(createTurnPhaseZone('on_end_turn_in_area')));

    let afterWard = wardedTarget;
    act(() => {
      afterWard = wardedEngine.result.current.processEndOfTurnEffects(wardedTarget, 2);
    });
    expect(afterWard).toMatchObject({ currentHP: 1, tempHP: 0 });
  });

  it('uses canonical downing mirrors for lethal end-turn zone damage', () => {
    const caster = createCharacter({ id: 'caster', team: 'player', position: { x: 0, y: 0 } });
    const target = createCharacter({ currentHP: 1, team: 'player' });
    const { props, result } = renderEngine([caster, target]);

    act(() => result.current.addSpellZone(createTurnPhaseZone('on_end_turn_in_area')));

    let downedTarget = target;
    act(() => {
      downedTarget = result.current.processEndOfTurnEffects(target, 2);
    });

    expect(downedTarget.currentHP).toBe(0);
    expect(downedTarget.statusEffects.some(effect => effect.name === 'Unconscious')).toBe(true);
    expect(downedTarget.conditions?.some(condition => condition.name === 'Unconscious')).toBe(true);
    expect(props.onLogEntry).toHaveBeenCalledWith(expect.objectContaining({
      message: expect.stringContaining('is defeated'),
      data: expect.objectContaining({ isDeath: true, trigger: 'on_end_turn_in_area' }),
    }));
  });

  it('preserves status metadata when a scheduled condition applies', () => {
    const caster = createCharacter({ id: 'caster', name: 'Caster', team: 'player', position: { x: 0, y: 0 } });
    const target = createCharacter();
    const repeatSave = { timing: 'turn_end', saveType: 'Wisdom', dc: 14, successEnds: true };
    const escapeCheck = { actionType: 'action', ability: 'Strength', dc: 14 };
    const breakTriggers = [{ type: 'on_damage' }];
    const scheduledEffect: ScheduledSpellEffect = {
      id: 'scheduled-status',
      spellId: 'delayed-fear',
      casterId: caster.id,
      targetId: target.id,
      timing: 'turn_end',
      createdAtRound: 1,
      effects: [{
        type: 'STATUS_CONDITION',
        statusCondition: { name: 'Frightened', repeatSave, escapeCheck, breakTriggers },
        duration: { type: 'rounds', value: 1 },
        trigger: { type: 'turn_end', frequency: 'once', consumption: 'unlimited', movementType: 'any' }
      } as any]
    };
    const { result } = renderEngine([caster, target]);

    act(() => {
      result.current.addScheduledSpellEffect(scheduledEffect);
    });

    let updatedTarget = target;
    act(() => {
      updatedTarget = result.current.processScheduledSpellEffects(target, 'turn_end', 2);
    });

    // Scheduled status effects must preserve ongoing-resolution metadata in
    // both runtime condition mirrors, otherwise repeat-save and escape systems
    // cannot pick the condition back up on later turns.
    expect(updatedTarget.statusEffects[0]).toMatchObject({
      name: 'Frightened',
      source: 'delayed-fear',
      sourceCasterId: caster.id,
      repeatSave,
      escapeCheck,
      breakTriggers
    });
    expect(updatedTarget.conditions?.[0]).toMatchObject({
      name: 'Frightened',
      source: 'delayed-fear',
      sourceCasterId: caster.id,
      repeatSave,
      escapeCheck,
      breakTriggers
    });
  });

  it('refreshes scheduled status conditions by name instead of stacking duplicates', () => {
    const caster = createCharacter({ id: 'caster', name: 'Caster', team: 'player', position: { x: 0, y: 0 } });
    const target = createCharacter({
      statusEffects: [{
        id: 'existing-frightened',
        name: 'Frightened',
        type: 'debuff',
        duration: 1,
        source: 'old-fear'
      }],
      conditions: [{
        name: 'Frightened',
        duration: { type: 'rounds', value: 1 },
        appliedTurn: 1,
        source: 'old-fear'
      }]
    });
    const scheduledEffect: ScheduledSpellEffect = {
      id: 'scheduled-status-refresh',
      spellId: 'delayed-fear',
      casterId: caster.id,
      targetId: target.id,
      timing: 'turn_end',
      createdAtRound: 1,
      effects: [{
        type: 'STATUS_CONDITION',
        statusCondition: { name: 'Frightened' },
        duration: { type: 'rounds', value: 1 },
        trigger: { type: 'turn_end', frequency: 'once', consumption: 'unlimited', movementType: 'any' }
      } as any]
    };
    const { result } = renderEngine([caster, target]);

    act(() => {
      result.current.addScheduledSpellEffect(scheduledEffect);
    });

    let updatedTarget = target;
    act(() => {
      updatedTarget = result.current.processScheduledSpellEffects(target, 'turn_end', 2);
    });

    expect(updatedTarget.statusEffects.filter(effect => effect.name === 'Frightened')).toHaveLength(1);
    expect(updatedTarget.statusEffects[0]).toMatchObject({
      id: 'existing-frightened',
      source: 'delayed-fear',
      sourceCasterId: caster.id
    });
    expect(updatedTarget.conditions?.filter(condition => condition.name === 'Frightened')).toHaveLength(1);
    expect(updatedTarget.conditions?.[0]).toMatchObject({
      appliedTurn: 2,
      source: 'delayed-fear',
      sourceCasterId: caster.id
    });
  });

  it('executes scheduled movement effects through the movement command bridge', () => {
    const caster = createCharacter({ id: 'caster', name: 'Caster', team: 'player', position: { x: 0, y: 0 } });
    const target = createCharacter({ id: 'target', name: 'Target', position: { x: 1, y: 0 } });
    const scheduledEffect: ScheduledSpellEffect = {
      id: 'scheduled-push',
      spellId: 'delayed-push',
      casterId: caster.id,
      targetId: target.id,
      timing: 'turn_start',
      createdAtRound: 1,
      effects: [{
        type: 'MOVEMENT',
        movementType: 'push',
        distance: 10,
        duration: { type: 'instantaneous' },
        trigger: { type: 'turn_start', frequency: 'once', consumption: 'unlimited', movementType: 'any' }
      } as any]
    };
    const { props, result } = renderEngine([caster, target]);

    act(() => {
      result.current.addScheduledSpellEffect(scheduledEffect);
    });

    let updatedTarget = target;
    act(() => {
      updatedTarget = result.current.processScheduledSpellEffects(target, 'turn_start', 2);
    });

    // A 10-foot push from a caster at x=0 to a target at x=1 should end two
    // tiles farther away. This assertion proves the scheduled path reaches the
    // same movement-command logic used by immediate movement spells.
    expect(updatedTarget.position).toEqual({ x: 3, y: 0 });
    expect(props.onLogEntry).toHaveBeenCalledWith(expect.objectContaining({
      message: expect.stringContaining('pushed 10 feet'),
      characterId: target.id
    }));
  });

  it('runs after_forced_movement repeat saves after scheduled movement resolves', () => {
    vi.mocked(savingThrowUtils.rollSavingThrow).mockReturnValue({
      total: 18,
      success: true,
      modifiersApplied: []
    } as any);

    const caster = createCharacter({ id: 'caster', name: 'Caster', team: 'player', position: { x: 0, y: 0 } });
    const target = createCharacter({
      id: 'target',
      name: 'Target',
      position: { x: 1, y: 0 },
      statusEffects: [{
        id: 'compelled',
        name: 'Charmed',
        type: 'debuff',
        duration: 2,
        repeatSave: {
          timing: 'after_forced_movement',
          saveType: 'Wisdom',
          successEnds: true,
          useOriginalDC: true
        }
      }]
    });
    const scheduledEffect: ScheduledSpellEffect = {
      id: 'scheduled-compulsion-move',
      spellId: 'compulsion',
      casterId: caster.id,
      targetId: target.id,
      timing: 'turn_start',
      createdAtRound: 1,
      effects: [{
        type: 'MOVEMENT',
        movementType: 'push',
        distance: 10,
        duration: { type: 'instantaneous' },
        trigger: { type: 'turn_start', frequency: 'once', consumption: 'unlimited', movementType: 'forced' }
      } as any]
    };
    const { result } = renderEngine([caster, target]);

    act(() => {
      result.current.addScheduledSpellEffect(scheduledEffect);
    });

    let updatedTarget = target;
    act(() => {
      updatedTarget = result.current.processScheduledSpellEffects(target, 'turn_start', 2);
    });

    // Compulsion-style movement grants the target a save after the forced move.
    // This test protects the missing bridge between delayed MovementCommand
    // resolution and repeat-save cleanup.
    expect(updatedTarget.position).toEqual({ x: 3, y: 0 });
    expect(updatedTarget.statusEffects).toHaveLength(0);
    expect(savingThrowUtils.rollSavingThrow).toHaveBeenCalled();
  });
});

// ----------------------------------------------------------------------------
// Scheduled Teleport Coverage
// ----------------------------------------------------------------------------
// Teleport has an extra failure mode compared with push/pull: a delayed spell
// can remember a destination that later becomes blocked. These tests lock down
// the shared fallback behavior added for the Structured Spell Execution gap.
// ----------------------------------------------------------------------------
describe('useCombatEngine scheduled teleport effects', () => {
  it('falls back to the nearest valid map tile when the scheduled destination is blocked', () => {
    const caster = createCharacter({ id: 'caster', name: 'Caster', team: 'player', position: { x: -1, y: 0 } });
    const target = createCharacter({ id: 'target', name: 'Target', position: { x: 0, y: 0 } });
    const tiles = new Map([
      ['0-0', { id: '0-0', coordinates: { x: 0, y: 0 }, terrain: 'floor', elevation: 0, movementCost: 1, blocksMovement: false, blocksLoS: false, decoration: null, effects: [] }],
      ['1-0', { id: '1-0', coordinates: { x: 1, y: 0 }, terrain: 'floor', elevation: 0, movementCost: 1, blocksMovement: false, blocksLoS: false, decoration: null, effects: [] }],
      ['2-0', { id: '2-0', coordinates: { x: 2, y: 0 }, terrain: 'wall', elevation: 0, movementCost: 1, blocksMovement: true, blocksLoS: true, decoration: null, effects: [] }]
    ]);
    const mapData = {
      id: 'teleport-map',
      name: 'Teleport Map',
      dimensions: { width: 3, height: 1 },
      tiles
    } as any;
    const scheduledEffect: ScheduledSpellEffect = {
      id: 'scheduled-teleport',
      spellId: 'delayed-teleport',
      casterId: caster.id,
      targetId: target.id,
      timing: 'turn_start',
      createdAtRound: 1,
      effects: [{
        type: 'MOVEMENT',
        movementType: 'teleport',
        distance: 10,
        destination: { x: 2, y: 0 },
        duration: { type: 'instantaneous' },
        trigger: { type: 'turn_start', frequency: 'once', consumption: 'unlimited', movementType: 'any' }
      } as any]
    };
    const props = {
      characters: [caster, target],
      mapData,
      onCharacterUpdate: vi.fn(),
      onLogEntry: vi.fn(),
      onMapUpdate: vi.fn(),
      addDamageNumber: vi.fn()
    };
    const { result } = renderHook(() => useCombatEngine(props));

    act(() => {
      result.current.addScheduledSpellEffect(scheduledEffect);
    });

    let updatedTarget = target;
    act(() => {
      updatedTarget = result.current.processScheduledSpellEffects(target, 'turn_start', 2);
    });

    // The remembered destination at x=2 is blocked. The scheduled bridge should
    // provide map candidates so MovementCommand can choose x=1 instead of doing
    // no useful teleport or ignoring terrain.
    expect(updatedTarget.position).toEqual({ x: 1, y: 0 });
    expect(props.onLogEntry).toHaveBeenCalledWith(expect.objectContaining({
      message: expect.stringContaining('teleports from (0, 0) to (1, 0)'),
      characterId: target.id
    }));
  });
});

describe('useCombatEngine environmental tile status effects', () => {
  it('refreshes tile-applied status conditions in both runtime mirrors', () => {
    const target = createCharacter({
      statusEffects: [{
        id: 'existing-slowed',
        name: 'Slowed',
        type: 'debuff',
        duration: 3,
        source: 'old-mud'
      }],
      conditions: [{
        name: 'Slowed',
        duration: { type: 'rounds', value: 3 },
        appliedTurn: 4,
        source: 'old-mud'
      }]
    });
    const mapData = {
      id: 'hazard-map',
      name: 'Hazard Map',
      dimensions: { width: 1, height: 1 },
      theme: 'swamp',
      seed: 1,
      tiles: new Map([[
        '1-0',
        {
          id: '1-0',
          coordinates: { x: 1, y: 0 },
          terrain: 'mud',
          elevation: 0,
          movementCost: 1,
          blocksMovement: false,
          blocksLoS: false,
          decoration: null,
          effects: [],
          environmentalEffect: {
            type: 'mud',
            effect: {
              name: 'Slowed',
              type: 'debuff',
              effect: { type: 'condition' }
            }
          }
        }
      ]])
    } as any;
    const props = {
      characters: [target],
      mapData,
      onCharacterUpdate: vi.fn(),
      onLogEntry: vi.fn(),
      onMapUpdate: vi.fn(),
      addDamageNumber: vi.fn()
    };
    const { result } = renderHook(() => useCombatEngine(props));

    const updatedTarget = result.current.processTileEffects(target, target.position);

    expect(updatedTarget.statusEffects.filter(effect => effect.name === 'Slowed')).toHaveLength(1);
    expect(updatedTarget.statusEffects[0]).toMatchObject({
      id: 'existing-slowed',
      duration: 1,
      source: 'Slowed'
    });
    expect(updatedTarget.conditions?.filter(condition => condition.name === 'Slowed')).toHaveLength(1);
    expect(updatedTarget.conditions?.[0]).toMatchObject({
      source: 'Slowed',
      duration: { type: 'rounds', value: 1 }
    });
  });
});

// ----------------------------------------------------------------------------
// Scheduled Save DC Snapshot Coverage
// ----------------------------------------------------------------------------
// Scheduled status effects can resolve after the caster changes. This keeps the
// saved cast-time DC visible in the combat log assertion so delayed saves do not
// silently fall back to live caster or target DC calculations.
// ----------------------------------------------------------------------------
describe('useCombatEngine scheduled save DC snapshots', () => {
  it('uses stored saveDC when a scheduled status effect calls for a save', () => {
    const caster = createCharacter({ id: 'caster', name: 'Caster', team: 'player', position: { x: 0, y: 0 } });
    const target = createCharacter({ id: 'target', name: 'Target', position: { x: 1, y: 0 } });
    const scheduledEffect: ScheduledSpellEffect = {
      id: 'scheduled-status-save',
      spellId: 'delayed-paralysis',
      casterId: caster.id,
      targetId: target.id,
      timing: 'turn_end',
      createdAtRound: 1,
      saveDC: 23,
      effects: [{
        type: 'STATUS_CONDITION',
        statusCondition: { name: 'Paralyzed' },
        condition: { type: 'save', saveType: 'Wisdom' },
        duration: { type: 'rounds', value: 1 },
        trigger: { type: 'turn_end', frequency: 'once', consumption: 'unlimited', movementType: 'any' }
      } as any]
    };
    const { props, result } = renderEngine([caster, target]);

    act(() => {
      result.current.addScheduledSpellEffect(scheduledEffect);
    });

    act(() => {
      result.current.processScheduledSpellEffects(target, 'turn_end', 2);
    });

    expect(props.onLogEntry).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ dc: 23, spellId: 'delayed-paralysis' })
    }));
  });
});

// ----------------------------------------------------------------------------
// GG-54 Scheduled Damage Transaction And Lifecycle
// ----------------------------------------------------------------------------
// These cases protect the complete delayed packet: defenses and temporary HP
// resolve before downing, damage precedes the recurring save, success cleans
// only owned links, expiry is exclusive, and repeated phase requests are inert.
// ----------------------------------------------------------------------------

describe('useCombatEngine canonical scheduled damage transaction', () => {
  it('routes resistance and temporary HP through one damage transaction', () => {
    const caster = createCharacter({ id: 'caster', team: 'player' });
    const target = createIgnitedTarget({
      currentHP: 20,
      maxHP: 20,
      tempHP: 2,
      temporaryHitPointSource: {
        spellId: 'proof-ward',
        spellName: 'Proof Ward',
        casterId: caster.id,
      },
      resistances: ['Fire'],
    });
    const { props, result } = renderEngine([caster, target], {
      scheduledEffectDiceRoller: () => 4,
      scheduledEffectSaveRng: () => (5 - 0.5) / 20,
    });

    act(() => result.current.addScheduledSpellEffect(createSearingSchedule()));
    let resolved = target;
    act(() => {
      resolved = result.current.processScheduledSpellEffects(target, 'turn_start', 1);
    });

    expect(resolved).toMatchObject({ currentHP: 20, tempHP: 0 });
    expect(resolved.temporaryHitPointSource).toBeUndefined();
    expect(props.onLogEntry).toHaveBeenCalledWith(expect.objectContaining({
      type: 'damage',
      data: expect.objectContaining({ damage: 4, damageDealt: 2, trigger: 'turn_start' }),
    }));
  });

  it('honors immunity without spending temporary HP, then still resolves the recurring save', () => {
    vi.mocked(savingThrowUtils.rollSavingThrow).mockReturnValue({
      total: 5,
      success: false,
      modifiersApplied: [],
    } as any);
    const caster = createCharacter({ id: 'caster', team: 'player' });
    const target = createIgnitedTarget({
      currentHP: 20,
      maxHP: 20,
      tempHP: 3,
      immunities: ['Fire'],
    });
    const { props, result } = renderEngine([caster, target], {
      scheduledEffectDiceRoller: () => 4,
    });

    act(() => result.current.addScheduledSpellEffect(createSearingSchedule()));
    let resolved = target;
    act(() => {
      resolved = result.current.processScheduledSpellEffects(target, 'turn_start', 1);
    });

    expect(resolved).toMatchObject({ currentHP: 20, tempHP: 3 });
    expect(savingThrowUtils.rollSavingThrow).toHaveBeenCalled();
    expect(props.onLogEntry).toHaveBeenCalledWith(expect.objectContaining({
      type: 'damage',
      data: expect.objectContaining({ damageDealt: 0 }),
    }));
    expect(props.onLogEntry).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ saveSucceeded: false }),
    }));
  });

  it('applies lethal scheduled damage through the player downing path before the save', () => {
    vi.mocked(savingThrowUtils.rollSavingThrow).mockReturnValue({
      total: 5,
      success: false,
      modifiersApplied: [],
    } as any);
    const caster = createCharacter({ id: 'caster', team: 'player' });
    const target = createIgnitedTarget({ currentHP: 3, maxHP: 20 });
    const { props, result } = renderEngine([caster, target], {
      scheduledEffectDiceRoller: () => 4,
    });

    act(() => result.current.addScheduledSpellEffect(createSearingSchedule()));
    let resolved = target;
    act(() => {
      resolved = result.current.processScheduledSpellEffects(target, 'turn_start', 1);
    });

    expect(resolved.currentHP).toBe(0);
    expect(resolved.deathSaves).toMatchObject({ successes: 0, failures: 0 });
    expect(resolved.statusEffects.map(status => status.name)).toContain('Unconscious');
    const logTypes = props.onLogEntry.mock.calls.map(([entry]) => entry.type);
    expect(logTypes.indexOf('damage')).toBeLessThan(logTypes.lastIndexOf('status'));
  });

  it('deals damage first, then a successful save removes only owned source links and schedule', () => {
    vi.mocked(savingThrowUtils.rollSavingThrow).mockReturnValue({
      total: 18,
      success: true,
      modifiersApplied: [],
    } as any);
    const caster = createCharacter({ id: 'caster', team: 'player' });
    const target = createIgnitedTarget();
    const { props, result } = renderEngine([caster, target], {
      scheduledEffectDiceRoller: () => 4,
    });

    act(() => result.current.addScheduledSpellEffect(createSearingSchedule()));
    let resolved = target;
    act(() => {
      resolved = result.current.processScheduledSpellEffects(target, 'turn_start', 1);
    });

    expect(resolved.currentHP).toBe(16);
    expect(resolved.statusEffects.map(status => status.id)).toEqual(['unrelated-ward']);
    expect(resolved.conditions?.map(condition => condition.name)).toEqual(['Blessed']);
    expect(resolved.activeEffects?.map(effect => effect.id)).toEqual(['unrelated-bless-link']);
    expect(result.current.scheduledSpellEffects).toEqual([]);
    const entries = props.onLogEntry.mock.calls.map(([entry]) => entry);
    const damageIndex = entries.findIndex(entry => entry.type === 'damage');
    const saveIndex = entries.findIndex(entry => entry.data?.saveSucceeded === true);
    expect(damageIndex).toBeGreaterThanOrEqual(0);
    expect(saveIndex).toBeGreaterThan(damageIndex);
  });

  it('preserves the schedule and owned links on failure, while a repeated phase is a no-op', () => {
    vi.mocked(savingThrowUtils.rollSavingThrow).mockReturnValue({
      total: 5,
      success: false,
      modifiersApplied: [],
    } as any);
    const caster = createCharacter({ id: 'caster', team: 'player' });
    const target = createIgnitedTarget();
    const { props, result } = renderEngine([caster, target], {
      scheduledEffectDiceRoller: () => 4,
    });

    act(() => result.current.addScheduledSpellEffect(createSearingSchedule()));
    let first = target;
    act(() => {
      first = result.current.processScheduledSpellEffects(target, 'turn_start', 1);
    });
    act(() => {
      // A duplicate live-record publication must preserve the round claim;
      // otherwise hydration could reopen this exact target-start phase.
      result.current.addScheduledSpellEffect(createSearingSchedule());
    });
    let repeated = first;
    act(() => {
      repeated = result.current.processScheduledSpellEffects(first, 'turn_start', 1);
    });

    expect(first.currentHP).toBe(16);
    expect(repeated.currentHP).toBe(16);
    expect(first.statusEffects.map(status => status.id)).toContain('owned-ignited');
    expect(result.current.scheduledSpellEffects.map(effect => effect.id))
      .toEqual(['scheduled-searing-smite']);
    expect(props.onLogEntry.mock.calls.filter(([entry]) => entry.type === 'damage')).toHaveLength(1);
    expect(savingThrowUtils.rollSavingThrow).toHaveBeenCalledTimes(1);
  });

  it('uses an exclusive ten-round expiry and removes links before a round-11 tick', () => {
    vi.mocked(savingThrowUtils.rollSavingThrow).mockReturnValue({
      total: 5,
      success: false,
      modifiersApplied: [],
    } as any);
    const caster = createCharacter({ id: 'caster', team: 'player' });
    const target = createIgnitedTarget();
    const { props, result } = renderEngine([caster, target], {
      scheduledEffectDiceRoller: () => 4,
    });

    act(() => result.current.addScheduledSpellEffect(createSearingSchedule()));
    let roundTen = target;
    act(() => {
      roundTen = result.current.processScheduledSpellEffects(target, 'turn_start', 10);
    });
    let roundEleven = roundTen;
    act(() => {
      roundEleven = result.current.processScheduledSpellEffects(roundTen, 'turn_start', 11);
    });

    expect(roundTen.currentHP).toBe(16);
    expect(roundEleven.currentHP).toBe(16);
    expect(roundEleven.statusEffects.map(status => status.id)).toEqual(['unrelated-ward']);
    expect(result.current.scheduledSpellEffects).toEqual([]);
    expect(props.onLogEntry.mock.calls.filter(([entry]) => entry.type === 'damage')).toHaveLength(1);
    expect(props.onLogEntry).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ cleanup: 'scheduled_effect_expiry' }),
    }));
  });

  it('keeps just-resolved HP when round-boundary cleanup crosses the React roster seam', () => {
    const caster = createCharacter({ id: 'caster', team: 'player' });
    const staleTarget = createIgnitedTarget({ currentHP: 20 });
    const processedTarget = { ...staleTarget, currentHP: 15 };
    const { props, result } = renderEngine([caster, staleTarget]);

    act(() => result.current.addScheduledSpellEffect(createSearingSchedule({
      expiresAtRound: 2,
    })));
    act(() => result.current.updateRoundBasedEffects(1, [processedTarget]));

    expect(props.onCharacterUpdate).toHaveBeenCalledWith(expect.objectContaining({
      id: 'target',
      currentHP: 15,
      statusEffects: [expect.objectContaining({ id: 'unrelated-ward' })],
    }));
    expect(result.current.scheduledSpellEffects).toEqual([]);
  });

  it('preserves captured schedules after source removal and prunes them after target removal', async () => {
    const caster = createCharacter({ id: 'caster', team: 'player' });
    const target = createIgnitedTarget();
    const hook = renderHook(
      ({ characters }: { characters: CombatCharacter[] }) => useCombatEngine({
        characters,
        mapData: null,
        onCharacterUpdate: vi.fn(),
        onLogEntry: vi.fn(),
        onMapUpdate: vi.fn(),
        addDamageNumber: vi.fn(),
        scheduledEffectDiceRoller: () => 4,
      }),
      { initialProps: { characters: [caster, target] } },
    );

    act(() => hook.result.current.addScheduledSpellEffect(createSearingSchedule()));
    hook.rerender({ characters: [target] });
    await waitFor(() => {
      expect(hook.result.current.scheduledSpellEffects.map(effect => effect.id))
        .toEqual(['scheduled-searing-smite']);
    });

    hook.rerender({ characters: [] });
    await waitFor(() => {
      expect(hook.result.current.scheduledSpellEffects).toEqual([]);
    });
  });

  it('preserves authored order when one record is refreshed and resolves each record once', () => {
    const caster = createCharacter({ id: 'caster', team: 'player' });
    const target = createCharacter();
    const first = createSearingSchedule({
      id: 'ordered-first',
      recurringMechanic: {
        timing: 'turn_start',
        frequency: 'once',
        damage: { dice: '1', type: 'Fire' },
      },
    });
    const second = createSearingSchedule({
      id: 'ordered-second',
      spellId: 'second-schedule',
      recurringMechanic: {
        timing: 'turn_start',
        frequency: 'once',
        damage: { dice: '1', type: 'Cold' },
      },
    });
    const { props, result } = renderEngine([caster, target], {
      scheduledEffectDiceRoller: () => 1,
    });

    act(() => {
      result.current.addScheduledSpellEffect(first);
      result.current.addScheduledSpellEffect(second);
      result.current.addScheduledSpellEffect({ ...first });
    });
    expect(result.current.scheduledSpellEffects.map(effect => effect.id))
      .toEqual(['ordered-first', 'ordered-second']);

    let resolved = target;
    act(() => {
      resolved = result.current.processScheduledSpellEffects(target, 'turn_start', 1);
    });
    act(() => {
      resolved = result.current.processScheduledSpellEffects(resolved, 'turn_start', 1);
    });

    expect(resolved.currentHP).toBe(18);
    expect(props.onLogEntry.mock.calls
      .filter(([entry]) => entry.type === 'damage')
      .map(([entry]) => entry.data?.source))
      .toEqual(['searing-smite', 'second-schedule']);
    expect(result.current.scheduledSpellEffects).toEqual([]);
  });
});
