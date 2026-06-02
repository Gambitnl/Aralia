import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useCombatEngine } from '../useCombatEngine';
import type { CombatCharacter } from '../../../../types/combat';
import type { ScheduledSpellEffect } from '../../../../systems/spells/effects';
import * as savingThrowUtils from '@/utils/savingThrowUtils';

vi.mock('@/utils/savingThrowUtils', async importOriginal => {
  const actual = await importOriginal<typeof import('@/utils/savingThrowUtils')>();
  return {
    ...actual,
    rollSavingThrow: vi.fn(() => ({ total: 8, success: false, modifiersApplied: [] }))
  };
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
const renderEngine = (characters: CombatCharacter[]) => {
  const props = {
    characters,
    mapData: null,
    onCharacterUpdate: vi.fn(),
    onLogEntry: vi.fn(),
    onMapUpdate: vi.fn(),
    addDamageNumber: vi.fn()
  };

  return { props, ...renderHook(() => useCombatEngine(props)) };
};

describe('useCombatEngine scheduled spell effects', () => {
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
