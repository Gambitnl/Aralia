/**
 * Focused repeat-save timing coverage for the combat engine.
 *
 * The spell data layer can now preserve repeat-save metadata on runtime status
 * effects. These tests protect the next bridge: the existing combat engine
 * entry points that consume that metadata for damage-triggered and
 * action-triggered repeat saves.
 */
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useCombatEngine } from '../useCombatEngine';
import type { BattleMapData, BattleMapTile, CombatCharacter, CombatLogEntry, Position } from '@/types/combat';
import type { Class } from '@/types';
import * as savingThrowUtils from '@/utils/savingThrowUtils';

vi.mock('@/utils/savingThrowUtils', async importOriginal => {
  const actual = await importOriginal<typeof import('@/utils/savingThrowUtils')>();
  return {
    ...actual,
    rollSavingThrow: vi.fn()
  };
});

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

const renderEngine = (
  character: CombatCharacter,
  onLogEntry: (entry: CombatLogEntry) => void = vi.fn(),
  options: { characters?: CombatCharacter[]; mapData?: BattleMapData | null } = {}
) => renderHook(() => useCombatEngine({
  characters: options.characters ?? [character],
  mapData: options.mapData ?? null,
  onCharacterUpdate: vi.fn(),
  onLogEntry,
  addDamageNumber: vi.fn<(value: number, position: Position, type: 'damage' | 'heal' | 'miss') => void>()
}));

const makeTile = (x: number, y: number, blocksLoS = false): BattleMapTile => ({
  id: `${x}-${y}`,
  coordinates: { x, y },
  terrain: blocksLoS ? 'wall' : 'floor',
  elevation: 0,
  movementCost: blocksLoS ? 0 : 1,
  blocksLoS,
  blocksMovement: blocksLoS,
  decoration: null,
  effects: []
});

const makeMapData = (tiles: BattleMapTile[]): BattleMapData => ({
  dimensions: { width: 3, height: 1 },
  tiles: new Map(tiles.map(tile => [tile.id, tile])),
  theme: 'dungeon',
  seed: 1
});

describe('useCombatEngine repeat-save timings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('runs on_damage repeat saves during damage handling and honors damage advantage', () => {
    vi.mocked(savingThrowUtils.rollSavingThrow)
      .mockReturnValueOnce({ total: 8, success: false, modifiersApplied: [] } as any)
      .mockReturnValueOnce({ total: 17, success: true, modifiersApplied: [] } as any);

    const character = makeCharacter({
      statusEffects: [{
        id: 'burning-restraint',
        name: 'Burning Restraint',
        type: 'debuff',
        duration: 2,
        repeatSave: {
          timing: 'on_damage',
          saveType: 'Wisdom',
          successEnds: true,
          useOriginalDC: true,
          modifiers: { advantageOnDamage: true }
        }
      }]
    });

    const { result } = renderEngine(character);

    const updated = result.current.handleDamage(character, 4, 'test damage', 'fire');

    expect(updated.damagedThisTurn).toBe(true);
    expect(updated.statusEffects).toHaveLength(0);
    expect(savingThrowUtils.rollSavingThrow).toHaveBeenCalledTimes(2);
  });

  it('runs repeat saves when the current lifecycle is listed in additionalTimings', () => {
    vi.mocked(savingThrowUtils.rollSavingThrow).mockReturnValue({
      total: 18,
      success: true,
      modifiersApplied: []
    } as any);

    const character = makeCharacter({
      statusEffects: [{
        id: 'hideous-laughter',
        name: 'Hideous Laughter',
        type: 'debuff',
        duration: 2,
        repeatSave: {
          timing: 'turn_end',
          additionalTimings: ['on_damage'],
          saveType: 'Wisdom',
          successEnds: true,
          useOriginalDC: true,
          modifiers: { advantageOnDamage: true }
        }
      }]
    });

    const { result } = renderEngine(character);

    // Tasha-style effects save at the normal end-of-turn timing and also when
    // damage happens. This assertion captures the missing fan-out before the
    // runtime change, so the later production fix has a precise target.
    const updated = result.current.handleDamage(character, 4, 'test damage', 'psychic');

    expect(updated.statusEffects).toHaveLength(0);
    expect(savingThrowUtils.rollSavingThrow).toHaveBeenCalled();
  });

  it('runs on_action repeat saves only for the requested effect id', () => {
    vi.mocked(savingThrowUtils.rollSavingThrow).mockReturnValue({
      total: 18,
      success: true,
      modifiersApplied: []
    } as any);

    const character = makeCharacter({
      statusEffects: [
        {
          id: 'webbed',
          name: 'Webbed',
          type: 'debuff',
          duration: 2,
          repeatSave: {
            timing: 'on_action',
            saveType: 'Strength',
            successEnds: true,
            useOriginalDC: true
          }
        },
        {
          id: 'frightened',
          name: 'Frightened',
          type: 'debuff',
          duration: 2,
          repeatSave: {
            timing: 'on_action',
            saveType: 'Wisdom',
            successEnds: true,
            useOriginalDC: true
          }
        }
      ]
    });

    const { result } = renderEngine(character);

    const updated = result.current.processRepeatSaves(character, 'on_action', 'webbed');

    expect(updated.statusEffects.map(effect => effect.id)).toEqual(['frightened']);
    expect(savingThrowUtils.rollSavingThrow).toHaveBeenCalledTimes(1);
  });

  it('resolves check-style repeat saves without routing them through saving throws', () => {
    const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0.95);
    const character = makeCharacter({
      stats: {
        strength: 18,
        dexterity: 12,
        constitution: 12,
        intelligence: 10,
        wisdom: 10,
        charisma: 8,
        baseInitiative: 0,
        speed: 30,
        cr: '0'
      },
      statusEffects: [{
        id: 'webbed',
        name: 'Webbed',
        type: 'debuff',
        duration: 2,
        repeatSave: {
          timing: 'on_action',
          saveType: 'strength_check',
          successEnds: true,
          useOriginalDC: true
        }
      }]
    });

    try {
      const { result } = renderEngine(character);
      const updated = result.current.processRepeatSaves(character, 'on_action', 'webbed');

      expect(updated.statusEffects).toHaveLength(0);
      expect(savingThrowUtils.rollSavingThrow).not.toHaveBeenCalled();
    } finally {
      randomSpy.mockRestore();
    }
  });

  it('keeps thresholded repeat-save effects until enough successes are recorded', () => {
    vi.mocked(savingThrowUtils.rollSavingThrow).mockReturnValue({
      total: 18,
      success: true,
      modifiersApplied: []
    } as any);

    const character = makeCharacter({
      statusEffects: [{
        id: 'flesh-to-stone-restraint',
        name: 'Restrained',
        type: 'debuff',
        duration: 3,
        repeatSave: {
          timing: 'turn_end',
          saveType: 'Constitution',
          successEnds: false,
          useOriginalDC: true,
          progression: {
            successThreshold: 3,
            failureThreshold: 3,
            consecutiveRequired: false,
            successOutcome: 'spell_ends',
            failureOutcome: 'apply_petrified_condition'
          }
        }
      }]
    });

    const { result } = renderEngine(character);

    // Flesh to Stone-style saves should not end on the first success. The
    // runtime needs to remember each success until the configured threshold is
    // met, then apply the success outcome to remove or transform the effect.
    let updated = result.current.processRepeatSaves(character, 'turn_end');
    expect(updated.statusEffects).toHaveLength(1);

    updated = result.current.processRepeatSaves(updated, 'turn_end');
    expect(updated.statusEffects).toHaveLength(1);

    updated = result.current.processRepeatSaves(updated, 'turn_end');
    expect(updated.statusEffects).toHaveLength(0);
    expect(savingThrowUtils.rollSavingThrow).toHaveBeenCalledTimes(3);
  });

  it('applies Petrified when a progression reaches the configured failure threshold', () => {
    vi.mocked(savingThrowUtils.rollSavingThrow).mockReturnValue({
      total: 4,
      success: false,
      modifiersApplied: []
    } as any);

    const character = makeCharacter({
      statusEffects: [{
        id: 'flesh-to-stone-restraint',
        name: 'Restrained',
        type: 'debuff',
        duration: 3,
        source: 'Flesh to Stone',
        sourceCasterId: 'caster',
        repeatSave: {
          timing: 'turn_end',
          saveType: 'Constitution',
          successEnds: false,
          useOriginalDC: true,
          progression: {
            successThreshold: 3,
            failureThreshold: 3,
            consecutiveRequired: false,
            successOutcome: 'spell_ends',
            failureOutcome: 'apply_petrified_condition'
          }
        }
      }],
      conditions: [{
        name: 'Restrained',
        duration: { type: 'rounds', value: 3 },
        appliedTurn: 1,
        source: 'Flesh to Stone',
        sourceCasterId: 'caster'
      }]
    });

    const { result } = renderEngine(character);

    // Three failed saves should transform Flesh to Stone from Restrained into
    // Petrified. The status and condition mirrors both need to change because
    // combat logic and UI surfaces still read from both arrays.
    let updated = result.current.processRepeatSaves(character, 'turn_end');
    expect(updated.statusEffects.map(effect => effect.name)).toEqual(['Restrained']);

    updated = result.current.processRepeatSaves(updated, 'turn_end');
    expect(updated.statusEffects.map(effect => effect.name)).toEqual(['Restrained']);

    updated = result.current.processRepeatSaves(updated, 'turn_end');
    expect(updated.statusEffects.map(effect => effect.name)).toEqual(['Petrified']);
    expect(updated.conditions?.map(condition => condition.name)).toEqual(['Petrified']);
    expect(savingThrowUtils.rollSavingThrow).toHaveBeenCalledTimes(3);
  });

  it('locks Contagion-style Poisoned duration after enough progression failures', () => {
    vi.mocked(savingThrowUtils.rollSavingThrow).mockReturnValue({
      total: 4,
      success: false,
      modifiersApplied: []
    } as any);

    const character = makeCharacter({
      statusEffects: [{
        id: 'contagion-poisoned',
        name: 'Poisoned',
        type: 'debuff',
        duration: 3,
        repeatSave: {
          timing: 'turn_end',
          saveType: 'Constitution',
          successEnds: false,
          useOriginalDC: true,
          progression: {
            successThreshold: 3,
            failureThreshold: 3,
            consecutiveRequired: false,
            successOutcome: 'spell_ends_on_target',
            failureOutcome: 'poisoned_duration_lasts_7_days'
          }
        }
      }]
    });

    const { result } = renderEngine(character);

    let updated = result.current.processRepeatSaves(character, 'turn_end');
    updated = result.current.processRepeatSaves(updated, 'turn_end');
    updated = result.current.processRepeatSaves(updated, 'turn_end');

    expect(updated.statusEffects).toHaveLength(1);
    expect(updated.statusEffects[0].name).toBe('Poisoned');
    expect(updated.statusEffects[0].duration).toBe(100800);
    expect(updated.statusEffects[0].repeatSave).toBeUndefined();
    expect(updated.statusEffects[0].repeatSaveProgress).toBeUndefined();
  });

  it('does not grant repeat saves when a line-of-sight prerequisite cannot be evaluated yet', () => {
    const onLogEntry = vi.fn();
    const character = makeCharacter({
      statusEffects: [{
        id: 'fear',
        name: 'Fear',
        type: 'debuff',
        duration: 2,
        repeatSave: {
          timing: 'turn_end',
          saveType: 'Wisdom',
          successEnds: true,
          useOriginalDC: true,
          prerequisites: ['no_line_of_sight_to_caster']
        }
      }]
    });

    const { result } = renderEngine(character, onLogEntry);
    const updated = result.current.processRepeatSaves(character, 'turn_end');

    expect(updated.statusEffects).toHaveLength(1);
    expect(savingThrowUtils.rollSavingThrow).not.toHaveBeenCalled();
    expect(onLogEntry).toHaveBeenCalledWith(expect.objectContaining({
      type: 'status',
      message: expect.stringContaining('line-of-sight context')
    }));
  });

  it('grants prerequisite-gated repeat saves once line of sight to the caster is blocked', () => {
    vi.mocked(savingThrowUtils.rollSavingThrow).mockReturnValue({
      total: 18,
      success: true,
      modifiersApplied: []
    } as any);

    const caster = makeCharacter({ id: 'caster', name: 'Caster', position: { x: 0, y: 0 } });
    const target = makeCharacter({
      id: 'target',
      name: 'Target',
      position: { x: 2, y: 0 },
      statusEffects: [{
        id: 'fear',
        name: 'Fear',
        type: 'debuff',
        duration: 2,
        sourceCasterId: 'caster',
        repeatSave: {
          timing: 'turn_end',
          saveType: 'Wisdom',
          successEnds: true,
          useOriginalDC: true,
          prerequisites: ['no_line_of_sight_to_caster']
        }
      }]
    });
    const mapData = makeMapData([
      makeTile(0, 0),
      makeTile(1, 0, true),
      makeTile(2, 0)
    ]);

    const { result } = renderEngine(target, vi.fn(), { characters: [caster, target], mapData });
    const updated = result.current.processRepeatSaves(target, 'turn_end');

    expect(updated.statusEffects).toHaveLength(0);
    expect(savingThrowUtils.rollSavingThrow).toHaveBeenCalled();
  });
});
