/**
 * Focused coverage for applying spell status conditions through the command
 * layer. These tests protect both the structured condition mirror and the
 * legacy statusEffects bridge that current combat runtime systems still read.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { StatusConditionCommand } from '../StatusConditionCommand';
import { BattleMapData, CombatState } from '@/types/combat';
import { StatusConditionEffect, SpellEffect } from '@/types/spells';
import { createMockCombatCharacter, createMockCombatState } from '@/utils/factories';
import { CommandContext } from '../../base/SpellCommand';
import * as savingThrowUtils from '@/utils/savingThrowUtils';
import { generateId } from '@/utils/combatUtils';
import { BreakConcentrationCommand } from '../ConcentrationCommands';
import { DamageCommand } from '../DamageCommand';
import friends from '../../../../public/data/spells/level-0/friends.json';
import type { ActiveSpellZone } from '@/systems/spells/effects';

// We mock saving throws so we don't have to deal with RNG in tests
vi.mock('@/utils/savingThrowUtils', () => ({
  calculateSpellDC: vi.fn(() => 13),
  rollSavingThrow: vi.fn()
}));

// Mock unique ID generation for predictable tests
vi.mock('@/utils/combatUtils', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/utils/combatUtils')>();
  return {
    ...actual,
    generateId: vi.fn(() => 'test-id')
  };
});

describe('StatusConditionCommand', () => {
  let state: CombatState;
  let context: CommandContext;

  beforeEach(() => {
    vi.clearAllMocks();

    const caster = createMockCombatCharacter({ id: 'caster', name: 'Caster' });
    const target = createMockCombatCharacter({
      id: 'target',
      name: 'Target',
      conditions: [],
      statusEffects: []
    });

    state = createMockCombatState({
      characters: [caster, target],
      turnState: { currentTurn: 1, currentCharacterId: 'caster', turnOrder: ['caster', 'target'], phase: 'planning', actionsThisTurn: [] }
    });

    context = {
      caster,
      castAtLevel: 1,
      targets: [target],
      spellId: 'test-spell',
      spellName: 'Test Spell',
      gameState: createMockCombatState()
    } as any;
  });

  it('applies a direct status condition (e.g. Ray of Sickness Poisoned)', async () => {
    const effect: StatusConditionEffect = {
      type: 'STATUS_CONDITION',
      statusCondition: {
        name: 'Poisoned',
        duration: { type: 'rounds', value: 1 },
        level: 0
      },
      condition: { type: 'hit' } as any,
      trigger: { type: 'immediate' } as any
    };

    const command = new StatusConditionCommand(effect, context);
    const newState = await command.execute(state);

    const updatedTarget = newState.characters.find(c => c.id === 'target')!;

    // Check new structured conditions
    expect(updatedTarget.conditions).toHaveLength(1);
    expect(updatedTarget.conditions![0].name).toBe('Poisoned');

    // Check legacy statusEffects
    expect(updatedTarget.statusEffects).toHaveLength(1);
    expect(updatedTarget.statusEffects[0].name).toBe('Poisoned');
  });

  it('preserves repeat-save metadata when mirroring spell conditions to runtime status state', async () => {
    const repeatSave = {
      timing: 'turn_end',
      saveType: 'Wisdom',
      successEnds: true,
      useOriginalDC: true
    } as const;

    const escapeCheck = {
      ability: 'Strength',
      dc: 'spell_save_dc',
      actionCost: 'action'
    } as const;

    const effect: StatusConditionEffect = {
      type: 'STATUS_CONDITION',
      statusCondition: {
        name: 'Restrained',
        duration: { type: 'rounds', value: 2 },
        repeatSave,
        escapeCheck,
        breakTriggers: ['target_takes_damage']
      },
      condition: { type: 'always' } as any,
      trigger: { type: 'immediate' } as any
    };

    const command = new StatusConditionCommand(effect, context);
    const newState = await command.execute(state);

    const updatedTarget = newState.characters.find(c => c.id === 'target')!;

    // The status mirror and the structured condition must both remember which
    // spell created the condition. Blinding Smite depends on that source label
    // for human-readable proof and future cleanup logic even though the weapon
    // hit delivered the condition.
    expect(updatedTarget.statusEffects[0].source).toBe('Test Spell');
    expect(updatedTarget.statusEffects[0].sourceCasterId).toBe('caster');
    expect(updatedTarget.conditions![0].source).toBe('Test Spell');
    expect(updatedTarget.conditions![0].sourceCasterId).toBe('caster');
    expect(updatedTarget.statusEffects[0].repeatSave).toEqual({
      ...repeatSave,
      dc: 13
    });
    expect(updatedTarget.statusEffects[0].escapeCheck).toEqual(escapeCheck);
    expect(updatedTarget.statusEffects[0].breakTriggers).toEqual(['target_takes_damage']);
    expect(updatedTarget.conditions![0].repeatSave).toEqual({
      ...repeatSave,
      dc: 13
    });
    expect(updatedTarget.conditions![0].escapeCheck).toEqual(escapeCheck);
    expect(updatedTarget.conditions![0].breakTriggers).toEqual(['target_takes_damage']);
  });

  it('respects saving throw successes to avoid applying condition', async () => {
    // Simulate a successful save
    vi.mocked(savingThrowUtils.rollSavingThrow).mockReturnValue({
      total: 15,
      success: true,
      modifiersApplied: []
    } as any);

    const effect: StatusConditionEffect = {
      type: 'STATUS_CONDITION',
      statusCondition: {
        name: 'Prone',
        duration: { type: 'rounds', value: 1 }
      },
      condition: {
        type: 'save',
        saveType: 'Wisdom',
        saveEffect: 'negates_condition'
      } as any,
      trigger: { type: 'immediate' } as any
    };

    const command = new StatusConditionCommand(effect, context);
    const newState = await command.execute(state);

    const updatedTarget = newState.characters.find(c => c.id === 'target')!;
    expect(updatedTarget.conditions).toHaveLength(0);
    expect(updatedTarget.conditions).toHaveLength(0);
    expect(updatedTarget.statusEffects).toHaveLength(0);

    const logs = newState.combatLog.filter(l => l.type === 'status');
    expect(logs.some(l => l.message.includes('resists the Prone condition'))).toBe(true);
  });

  it('removes conditions if conditionRemoval is specified (e.g. Lesser Restoration)', async () => {
    // Setup target with Poisoned and Blinded
    const targetWithConditions = createMockCombatCharacter({
      id: 'target',
      name: 'Target',
      conditions: [
        { name: 'Poisoned', duration: { type: 'rounds', value: 1 }, appliedTurn: 1, source: 'something' },
        { name: 'Blinded', duration: { type: 'rounds', value: 1 }, appliedTurn: 1, source: 'something' }
      ],
      statusEffects: [
        { id: '1', name: 'Poisoned', type: 'debuff', duration: 1 },
        { id: '2', name: 'Blinded', type: 'debuff', duration: 1 }
      ]
    });

    state = {
      ...state,
      characters: [state.characters[0], targetWithConditions]
    };

    const effect: SpellEffect = {
      type: 'STATUS_CONDITION',
      // Dummy condition, removal logic runs first
      statusCondition: { name: 'Prone', duration: { type: 'rounds', value: 0 } },
      conditionRemoval: ['Poisoned', 'Deafened'], // Blinded should remain
      condition: { type: 'always' } as any,
      trigger: { type: 'immediate' } as any
    };

    const command = new StatusConditionCommand(effect, context);
    const newState = await command.execute(state);

    const updatedTarget = newState.characters.find(c => c.id === 'target')!;

    // Poisoned should be removed, Blinded should remain
    expect(updatedTarget.conditions).toHaveLength(1);
    expect(updatedTarget.conditions![0].name).toBe('Blinded');

    expect(updatedTarget.statusEffects).toHaveLength(1);
    expect(updatedTarget.statusEffects[0].name).toBe('Blinded');
  });

  describe('Elemental state transitions', () => {
    it('applies Burning state when Ignited condition is applied', async () => {
      const effect: StatusConditionEffect = {
        type: 'STATUS_CONDITION',
        statusCondition: {
          name: 'Ignited',
          duration: { type: 'rounds', value: 1 },
          level: 0
        },
        condition: { type: 'always' } as any,
        trigger: { type: 'immediate' } as any
      };

      const command = new StatusConditionCommand(effect, context);
      const newState = await command.execute(state);

      const updatedTarget = newState.characters.find(c => c.id === 'target')!;
      
      // Target should have 'burning' state tag
      expect(updatedTarget.stateTags).toContain('burning');
    });

    it('interacts with existing state tags', async () => {
      // Setup target who is already Wet
      const targetWithWet = createMockCombatCharacter({
        id: 'target',
        name: 'Target',
        conditions: [],
        statusEffects: [],
        stateTags: ['wet']
      });

      state = {
        ...state,
        characters: [state.characters[0], targetWithWet]
      };

      const effect: StatusConditionEffect = {
        type: 'STATUS_CONDITION',
        statusCondition: {
          name: 'Chilled',
          duration: { type: 'rounds', value: 1 },
          level: 0
        },
        condition: { type: 'always' } as any,
        trigger: { type: 'immediate' } as any
      };

      const command = new StatusConditionCommand(effect, context);
      const newState = await command.execute(state);

      const updatedTarget = newState.characters.find(c => c.id === 'target')!;
      
      // Wet + Chilled (Cold) = Frozen state tag
      expect(updatedTarget.stateTags).toContain('frozen');
      expect(updatedTarget.stateTags).not.toContain('wet');
      expect(updatedTarget.stateTags).not.toContain('cold');
      
      // Should also have interaction log
      const logs = newState.combatLog.filter(l => l.type === 'status');
      expect(logs.some(l => l.message.includes('elemental states reacted') && l.message.toLowerCase().includes('frozen'))).toBe(true);
    });
  });

  describe('Friends lifecycle', () => {
    const friendsEffect = (friends as { effects: StatusConditionEffect[] }).effects[0];

    function buildFriendsContext(caster = state.characters[0], target = state.characters[1]): CommandContext {
      return {
        ...context,
        caster,
        targets: [target],
        spellId: 'friends',
        spellName: 'Friends'
      };
    }

    it('applies Friends on a failed Wisdom save and records recast and awareness metadata', async () => {
      vi.mocked(savingThrowUtils.rollSavingThrow).mockReturnValue({
        total: 7,
        success: false,
        modifiersApplied: []
      } as any);
      const humanoidTarget = createMockCombatCharacter({
        id: 'target',
        name: 'Target',
        team: 'player',
        creatureTypes: ['Humanoid'],
        conditions: [],
        statusEffects: []
      });
      state = { ...state, characters: [state.characters[0], humanoidTarget] };

      const command = new StatusConditionCommand(friendsEffect, buildFriendsContext(state.characters[0], humanoidTarget));
      const result = await command.execute(state);
      const updatedTarget = result.characters.find(character => character.id === humanoidTarget.id)!;

      expect(updatedTarget.statusEffects[0]).toMatchObject({
        name: 'Charmed',
        source: 'Friends',
        sourceCasterId: 'caster',
        socialLifecycle: {
          kind: 'friends_charm',
          targetKnowsOnEnd: true,
          recastMemoryDurationRounds: 14400
        }
      });
      expect(updatedTarget.spellMemory?.[0]).toMatchObject({
        spellId: 'friends',
        spellName: 'Friends',
        casterId: 'caster',
        affectedTurn: 1,
        expiresAtTurn: 14401,
        kind: 'cast_by_caster'
      });
    });

    it.each([
      ['not_humanoid', { creatureTypes: ['Beast'], team: 'player' }],
      ['fighting_caster_or_allies', { creatureTypes: ['Humanoid'], team: 'enemy' }],
      ['recently_affected_by_spell', {
        creatureTypes: ['Humanoid'],
        team: 'player',
        spellMemory: [{
          spellId: 'friends',
          spellName: 'Friends',
          casterId: 'caster',
          affectedTurn: 1,
          expiresAtTurn: 20,
          kind: 'cast_by_caster'
        }]
      }]
    ])('auto-succeeds Friends for %s without applying Charmed', async (reason, targetPatch) => {
      const autoTarget = createMockCombatCharacter({
        id: 'target',
        name: 'Target',
        conditions: [],
        statusEffects: [],
        ...targetPatch
      });
      state = { ...state, characters: [state.characters[0], autoTarget] };

      const command = new StatusConditionCommand(friendsEffect, buildFriendsContext(state.characters[0], autoTarget));
      const result = await command.execute(state);
      const updatedTarget = result.characters.find(character => character.id === autoTarget.id)!;

      expect(savingThrowUtils.rollSavingThrow).not.toHaveBeenCalled();
      expect(updatedTarget.statusEffects.some(effect => effect.name === 'Charmed')).toBe(false);
      expect(updatedTarget.spellMemory?.some(memory => memory.spellId === 'friends' && memory.casterId === 'caster')).toBe(true);
      expect(result.combatLog.some(entry =>
        entry.data?.spellId === 'friends' &&
        entry.data?.saveOutcomeOverride === reason
      )).toBe(true);
    });

    it('records Friends post-charm awareness when concentration cleanup removes the charm', async () => {
      const caster = createMockCombatCharacter({
        id: 'caster',
        name: 'Caster',
        concentratingOn: {
          spellId: 'friends',
          spellName: 'Friends',
          spellLevel: 0,
          startedTurn: 1,
          effectIds: ['test-id'],
          canDropAsFreeAction: true
        }
      });
      const charmedTarget = createMockCombatCharacter({
        id: 'target',
        name: 'Target',
        conditions: [{ name: 'Charmed', duration: { type: 'minutes', value: 1 }, appliedTurn: 1, source: 'Friends', sourceCasterId: 'caster' }],
        statusEffects: [{
          id: 'test-id',
          name: 'Charmed',
          type: 'debuff',
          duration: 10,
          source: 'Friends',
          sourceCasterId: 'caster',
          socialLifecycle: { kind: 'friends_charm', targetKnowsOnEnd: true, recastMemoryDurationRounds: 14400 }
        }]
      });
      const attacker = createMockCombatCharacter({
        id: 'attacker',
        name: 'Attacker',
        conditions: [],
        statusEffects: []
      });
      state = { ...state, characters: [caster, charmedTarget, attacker] };

      const command = new BreakConcentrationCommand(buildFriendsContext(caster, charmedTarget));
      const result = await command.execute(state);
      const updatedTarget = result.characters.find(character => character.id === charmedTarget.id)!;

      expect(result.characters.find(character => character.id === caster.id)?.concentratingOn).toBeUndefined();
      expect(updatedTarget.statusEffects.some(effect => effect.name === 'Charmed')).toBe(false);
      expect(updatedTarget.socialAwareness?.[0]).toMatchObject({
        sourceSpellId: 'friends',
        sourceSpellName: 'Friends',
        casterId: 'caster',
        learnedTurn: 1,
        kind: 'post_charm_awareness',
        targetKnows: 'it_was_Charmed_by_caster'
      });
    });

    it('removes concentration-owned spell zones while preserving unrelated zones', async () => {
      const caster = createMockCombatCharacter({
        id: 'caster',
        name: 'Caster',
        concentratingOn: {
          spellId: 'grease',
          spellName: 'Grease',
          spellLevel: 1,
          startedTurn: 1,
          effectIds: ['grease-zone'],
          canDropAsFreeAction: true
        }
      });
      const greaseZone: ActiveSpellZone = {
        id: 'grease-zone',
        spellId: 'grease',
        casterId: 'caster',
        position: { x: 2, y: 2 },
        areaOfEffect: { shape: 'square', size: 10 },
        effects: [],
        triggeredThisTurn: new Set(),
        triggeredEver: new Set()
      };
      const webZone: ActiveSpellZone = {
        ...greaseZone,
        id: 'web-zone',
        spellId: 'web'
      };
      const terrainTile = {
        id: '2-2',
        coordinates: { x: 2, y: 2 },
        position: { x: 2, y: 2 },
        terrain: 'floor',
        movementCost: 2,
        blocksMovement: false,
        blocksLoS: false,
        elevation: 0,
        environmentalEffects: [
          {
            id: 'grease-difficult',
            type: 'difficult_terrain',
            duration: 10,
            sourceSpellId: 'grease',
            casterId: 'caster',
            effect: { id: 'grease-status', name: 'Difficult Terrain', type: 'debuff', duration: 10, effect: { type: 'condition' } }
          },
          {
            id: 'web-difficult',
            type: 'difficult_terrain',
            duration: 10,
            sourceSpellId: 'web',
            casterId: 'caster',
            effect: { id: 'web-status', name: 'Difficult Terrain', type: 'debuff', duration: 10, effect: { type: 'condition' } }
          }
        ]
      } as BattleMapData['tiles'] extends Map<string, infer Tile> ? Tile : never;
      const mapData = {
        tiles: new Map([['2-2', terrainTile]]),
        dimensions: { width: 3, height: 3 },
        theme: 'dungeon'
      } as BattleMapData;
      state = {
        ...state,
        characters: [caster, state.characters[1]],
        spellZones: [greaseZone, webZone],
        mapData
      };

      const command = new BreakConcentrationCommand({
        ...context,
        caster,
        targets: [],
        spellId: 'grease',
        spellName: 'Grease'
      });
      const result = await command.execute(state);

      expect(result.spellZones).toEqual([webZone]);
      const cleanedTile = result.mapData?.tiles.get('2-2');
      expect(cleanedTile?.environmentalEffects?.map(effect => effect.id)).toEqual(['web-difficult']);
      expect(cleanedTile?.movementCost).toBe(2);
      expect(result.characters.find(character => character.id === caster.id)?.concentratingOn).toBeUndefined();
    });

    it('ends Friends early and records awareness when the charmed target takes damage', async () => {
      const caster = createMockCombatCharacter({
        id: 'caster',
        name: 'Caster',
        concentratingOn: {
          spellId: 'friends',
          spellName: 'Friends',
          spellLevel: 0,
          startedTurn: 1,
          effectIds: ['test-id'],
          canDropAsFreeAction: true
        }
      });
      const charmedTarget = createMockCombatCharacter({
        id: 'target',
        name: 'Target',
        currentHP: 10,
        maxHP: 10,
        conditions: [{ name: 'Charmed', duration: { type: 'minutes', value: 1 }, appliedTurn: 1, source: 'Friends', sourceCasterId: 'caster' }],
        statusEffects: [{
          id: 'test-id',
          name: 'Charmed',
          type: 'debuff',
          duration: 10,
          source: 'Friends',
          sourceCasterId: 'caster',
          socialLifecycle: { kind: 'friends_charm', targetKnowsOnEnd: true, recastMemoryDurationRounds: 14400 }
        }]
      });
      const attacker = createMockCombatCharacter({
        id: 'attacker',
        name: 'Attacker',
        conditions: [],
        statusEffects: []
      });
      state = { ...state, characters: [caster, charmedTarget, attacker] };
      const damageEffect = {
        type: 'DAMAGE',
        damage: { dice: '1d1', type: 'Force' },
        trigger: { type: 'immediate' },
        condition: { type: 'always' }
      } as SpellEffect;

      const command = new DamageCommand(damageEffect, {
        ...context,
        caster: attacker,
        targets: [charmedTarget],
        spellId: 'test-damage',
        spellName: 'Test Damage'
      });
      const result = await command.execute(state);
      const updatedTarget = result.characters.find(character => character.id === charmedTarget.id)!;

      expect(result.characters.find(character => character.id === caster.id)?.concentratingOn).toBeUndefined();
      expect(updatedTarget.statusEffects.some(effect => effect.name === 'Charmed')).toBe(false);
      expect(updatedTarget.socialAwareness?.some(entry => entry.sourceSpellId === 'friends' && entry.casterId === 'caster')).toBe(true);
      expect(result.combatLog.some(entry => entry.data?.earlyEndReason === 'target_takes_damage')).toBe(true);
    });

    it('ends Friends early when the caster deals damage', async () => {
      const caster = createMockCombatCharacter({
        id: 'caster',
        name: 'Caster',
        concentratingOn: {
          spellId: 'friends',
          spellName: 'Friends',
          spellLevel: 0,
          startedTurn: 1,
          effectIds: ['test-id'],
          canDropAsFreeAction: true
        }
      });
      const friendTarget = createMockCombatCharacter({
        id: 'friend-target',
        name: 'Friend Target',
        conditions: [{ name: 'Charmed', duration: { type: 'minutes', value: 1 }, appliedTurn: 1, source: 'Friends', sourceCasterId: 'caster' }],
        statusEffects: [{
          id: 'test-id',
          name: 'Charmed',
          type: 'debuff',
          duration: 10,
          source: 'Friends',
          sourceCasterId: 'caster',
          socialLifecycle: { kind: 'friends_charm', targetKnowsOnEnd: true, recastMemoryDurationRounds: 14400 }
        }]
      });
      const damageTarget = createMockCombatCharacter({
        id: 'damage-target',
        name: 'Damage Target',
        currentHP: 10,
        maxHP: 10,
        conditions: [],
        statusEffects: []
      });
      state = { ...state, characters: [caster, friendTarget, damageTarget] };
      const damageEffect = {
        type: 'DAMAGE',
        damage: { dice: '1d1', type: 'Force' },
        trigger: { type: 'immediate' },
        condition: { type: 'always' }
      } as SpellEffect;

      const command = new DamageCommand(damageEffect, {
        ...context,
        caster,
        targets: [damageTarget],
        spellId: 'test-damage',
        spellName: 'Test Damage'
      });
      const result = await command.execute(state);
      const updatedFriendTarget = result.characters.find(character => character.id === friendTarget.id)!;

      expect(result.characters.find(character => character.id === caster.id)?.concentratingOn).toBeUndefined();
      expect(updatedFriendTarget.statusEffects.some(effect => effect.name === 'Charmed')).toBe(false);
      expect(updatedFriendTarget.socialAwareness?.some(entry => entry.sourceSpellId === 'friends' && entry.casterId === 'caster')).toBe(true);
      expect(result.combatLog.some(entry => entry.data?.earlyEndReason === 'caster_deals_damage')).toBe(true);
    });

    it('ends Friends early when the caster forces a saving throw', async () => {
      vi.mocked(savingThrowUtils.rollSavingThrow).mockReturnValue({
        total: 7,
        success: false,
        modifiersApplied: []
      } as any);
      const caster = createMockCombatCharacter({
        id: 'caster',
        name: 'Caster',
        concentratingOn: {
          spellId: 'friends',
          spellName: 'Friends',
          spellLevel: 0,
          startedTurn: 1,
          effectIds: ['test-id'],
          canDropAsFreeAction: true
        }
      });
      const friendTarget = createMockCombatCharacter({
        id: 'friend-target',
        name: 'Friend Target',
        conditions: [{ name: 'Charmed', duration: { type: 'minutes', value: 1 }, appliedTurn: 1, source: 'Friends', sourceCasterId: 'caster' }],
        statusEffects: [{
          id: 'test-id',
          name: 'Charmed',
          type: 'debuff',
          duration: 10,
          source: 'Friends',
          sourceCasterId: 'caster',
          socialLifecycle: { kind: 'friends_charm', targetKnowsOnEnd: true, recastMemoryDurationRounds: 14400 }
        }]
      });
      const saveTarget = createMockCombatCharacter({
        id: 'save-target',
        name: 'Save Target',
        conditions: [],
        statusEffects: []
      });
      state = { ...state, characters: [caster, friendTarget, saveTarget] };
      const saveEffect: StatusConditionEffect = {
        type: 'STATUS_CONDITION',
        statusCondition: {
          name: 'Prone',
          duration: { type: 'rounds', value: 1 }
        },
        condition: {
          type: 'save',
          saveType: 'Wisdom',
          saveEffect: 'negates_condition'
        } as any,
        trigger: { type: 'immediate' } as any
      };

      const command = new StatusConditionCommand(saveEffect, {
        ...context,
        caster,
        targets: [saveTarget],
        spellId: 'test-save-spell',
        spellName: 'Test Save Spell'
      });
      const result = await command.execute(state);
      const updatedFriendTarget = result.characters.find(character => character.id === friendTarget.id)!;

      expect(result.characters.find(character => character.id === caster.id)?.concentratingOn).toBeUndefined();
      expect(updatedFriendTarget.statusEffects.some(effect => effect.name === 'Charmed')).toBe(false);
      expect(updatedFriendTarget.socialAwareness?.some(entry => entry.sourceSpellId === 'friends' && entry.casterId === 'caster')).toBe(true);
      expect(result.combatLog.some(entry => entry.data?.earlyEndReason === 'caster_forces_saving_throw')).toBe(true);
    });
  });
});
