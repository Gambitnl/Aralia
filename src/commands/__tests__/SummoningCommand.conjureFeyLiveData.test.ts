import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { SummoningCommand } from '../effects/SummoningCommand';
import { AbilityCommandFactory } from '../factory/AbilityCommandFactory';
import { useTurnManager } from '../../hooks/combat/useTurnManager';
import { createMockCombatCharacter } from '../../utils/factories';
import type { CommandContext } from '../base/SpellCommand';
import type { Ability, CombatCharacter, CombatLogEntry, CombatState, SelectedSpellTarget } from '../../types/combat';
import type { SummoningEffect, UtilityEffect } from '../../types/spells';
import conjureFey from '../../../public/data/spells/level-6/conjure-fey.json';

/**
 * This file proves the live Conjure Fey spell packet reaches the summon actor
 * with the identity, command cadence, non-persistent lifecycle flags, and
 * shared-initiative routing that the current runtime already claims to support.
 *
 * The proof stays intentionally narrow: it checks the conjured Fey Spirit's
 * structured metadata and the turn-order insertion behavior without expanding
 * into broader summon balance, stat-block generation, or attack resolution.
 */

describe('SummoningCommand live Conjure Fey metadata bridge', () => {
  it('creates a Fey Spirit summon with preserved form, command, and lifecycle metadata', () => {
    const caster = createMockCombatCharacter({
      id: 'conjure-fey-caster',
      name: 'Conjure Fey Caster',
      team: 'player',
      position: { x: 0, y: 0 },
      initiative: 14,
      stats: {
        strength: 12,
        dexterity: 14,
        constitution: 12,
        intelligence: 10,
        wisdom: 14,
        charisma: 10,
        baseInitiative: 0,
        speed: 30,
        cr: '0'
      }
    });
    const summonEffect = conjureFey.effects.find(effect => effect.type === 'SUMMONING') as SummoningEffect;
    const context = {
      spellId: conjureFey.id,
      spellName: conjureFey.name,
      castAtLevel: 6,
      caster,
      targets: [],
      gameState: {}
    } as CommandContext;
    const state = {
      isActive: true,
      characters: [caster],
      turnState: {
        currentTurn: 1,
        turnOrder: [caster.id],
        currentCharacterId: caster.id,
        phase: 'action',
        actionsThisTurn: []
      },
      selectedCharacterId: null,
      selectedAbilityId: null,
      actionMode: 'select',
      validTargets: [],
      validMoves: [],
      combatLog: [] as CombatLogEntry[],
      reactiveTriggers: [],
      activeLightSources: []
    } as CombatState;

    const summonedState = new SummoningCommand(summonEffect, context).execute(state);
    const summonedSpirit = summonedState.characters.find(character =>
      character.isSummon &&
      character.summonMetadata?.spellId === conjureFey.id &&
      character.summonMetadata?.casterId === caster.id
    ) as CombatCharacter | undefined;

    expect(summonedSpirit).toBeDefined();
    expect(summonedSpirit?.name).toContain('Fey Spirit');
    expect(summonedSpirit?.summonMetadata).toEqual(expect.objectContaining({
      entityType: 'creature',
      formName: 'Fey creature appearance chosen by the caster',
      sourceName: conjureFey.name,
      commandCost: 'bonus_action',
      commandsPerTurn: 1,
      commandsUsedThisTurn: 0,
      initiativePolicy: 'shared',
      persistent: false,
      dismissable: false
    }));

    const spiritAttack = summonedSpirit?.abilities?.find(ability => ability.name === 'Fey Spirit Attack');

    expect(spiritAttack).toBeDefined();
    expect(spiritAttack?.cost.type).toBe('bonus');
    expect(spiritAttack?.effects).toEqual([
      expect.objectContaining({
        type: 'commanded_summon',
        commandedSummonAction: 'issue_command'
      }),
      expect.objectContaining({
        type: 'damage'
      })
    ]);

    const firstCommands = AbilityCommandFactory.createCommands(
      spiritAttack!,
      summonedSpirit!,
      [caster],
      {} as never
    );

    expect(firstCommands).toHaveLength(2);

    const afterFirstCommand = firstCommands[0].execute(summonedState);
    const spiritAfterFirstCommand = afterFirstCommand.characters.find(character => character.id === summonedSpirit?.id);

    expect(spiritAfterFirstCommand?.summonMetadata?.commandsUsedThisTurn).toBe(1);
    expect(afterFirstCommand.combatLog.some(entry =>
      entry.data?.commandSurface === 'controlled-summon' &&
      entry.data?.commandsUsedThisTurn === 1 &&
      entry.data?.entityType === 'creature'
    )).toBe(true);

    const secondCommands = AbilityCommandFactory.createCommands(
      spiritAttack!,
      spiritAfterFirstCommand!,
      [caster],
      {} as never
    );

    expect(secondCommands).toHaveLength(1);
    expect(secondCommands[0].description).toContain('controlled-summon');
  });

  it('inserts the live Fey Spirit immediately after the caster in shared initiative order', () => {
    const caster = createMockCombatCharacter({
      id: 'conjure-fey-turn-caster',
      name: 'Conjure Fey Turn Caster',
      team: 'player',
      position: { x: 0, y: 0 },
      initiative: 14,
      stats: {
        strength: 12,
        dexterity: 14,
        constitution: 12,
        intelligence: 10,
        wisdom: 14,
        charisma: 10,
        baseInitiative: 0,
        speed: 30,
        cr: '0'
      }
    });
    const summonEffect = conjureFey.effects.find(effect => effect.type === 'SUMMONING') as SummoningEffect;
    const context = {
      spellId: conjureFey.id,
      spellName: conjureFey.name,
      castAtLevel: 6,
      caster,
      targets: [],
      gameState: {}
    } as CommandContext;
    const initialState = {
      isActive: true,
      characters: [caster],
      turnState: {
        currentTurn: 1,
        turnOrder: [caster.id],
        currentCharacterId: caster.id,
        phase: 'action',
        actionsThisTurn: []
      },
      selectedCharacterId: null,
      selectedAbilityId: null,
      actionMode: 'select',
      validTargets: [],
      validMoves: [],
      combatLog: [] as CombatLogEntry[],
      reactiveTriggers: [],
      activeLightSources: []
    } as CombatState;

    const summonState = new SummoningCommand(summonEffect, context).execute(initialState);
    const summonedSpirit = summonState.characters.find(character =>
      character.isSummon &&
      character.summonMetadata?.spellId === conjureFey.id &&
      character.summonMetadata?.initiativePolicy === 'shared'
    ) as CombatCharacter | undefined;

    expect(summonedSpirit).toBeDefined();
    expect(summonedSpirit?.summonMetadata?.initiativePolicy).toBe('shared');

    const onCharacterUpdate = () => undefined;
    const onLogEntry = () => undefined;

    const { result } = renderHook(() => useTurnManager({
      characters: [caster],
      mapData: null,
      onCharacterUpdate,
      onLogEntry
    }));

    act(() => {
      result.current.initializeCombat([caster]);
    });

    act(() => {
      result.current.joinCombat(summonedSpirit!, { initiative: summonedSpirit!.initiative });
    });

    expect(result.current.turnState.turnOrder).toEqual([caster.id, summonedSpirit!.id]);
    expect(result.current.turnState.currentCharacterId).toBe(caster.id);
  });

  it('teleports the live Fey Spirit through the later-turn granted action', async () => {
    const caster = createMockCombatCharacter({
      id: 'conjure-fey-teleport-caster',
      name: 'Conjure Fey Teleport Caster',
      team: 'player',
      position: { x: 0, y: 0 },
      initiative: 14
    });
    const enemy = createMockCombatCharacter({
      id: 'conjure-fey-teleport-target',
      name: 'Teleport Target',
      team: 'enemy',
      position: { x: 5, y: 3 },
      armorClass: 12
    });
    const summonEffect = conjureFey.effects.find(effect => effect.type === 'SUMMONING') as SummoningEffect;
    const utilityEffect = conjureFey.effects.find(effect =>
      effect.type === 'UTILITY' &&
      effect.grantedActions?.some(action => action.action === 'teleport_fey_spirit_and_make_melee_spell_attack')
    ) as UtilityEffect;
    const grantedAction = utilityEffect.grantedActions?.[0];

    expect(grantedAction).toEqual(expect.objectContaining({
      action: 'teleport_fey_spirit_and_make_melee_spell_attack',
      type: 'bonus_action',
      rangeLimit: 30
    }));

    const context = {
      spellId: conjureFey.id,
      spellName: conjureFey.name,
      castAtLevel: 6,
      caster,
      targets: [],
      gameState: {}
    } as CommandContext;
    const state = {
      isActive: true,
      characters: [caster, enemy],
      turnState: {
        currentTurn: 1,
        turnOrder: [caster.id],
        currentCharacterId: caster.id,
        phase: 'action',
        actionsThisTurn: []
      },
      selectedCharacterId: null,
      selectedAbilityId: null,
      actionMode: 'select',
      validTargets: [],
      validMoves: [],
      combatLog: [] as CombatLogEntry[],
      reactiveTriggers: [],
      activeLightSources: []
    } as CombatState;
    const summonedState = new SummoningCommand(summonEffect, context).execute(state);
    const summonedSpirit = summonedState.characters.find(character =>
      character.isSummon &&
      character.summonMetadata?.spellId === conjureFey.id &&
      character.summonMetadata?.casterId === caster.id
    ) as CombatCharacter | undefined;
    const destination: SelectedSpellTarget = {
      kind: 'point',
      position: { x: 4, y: 2 },
      purpose: 'teleport_destination'
    };
    const grantedAbility: Ability = {
      id: 'conjure-fey-teleport-attack',
      name: 'Teleport Fey Spirit and Attack',
      description: grantedAction!.notes ?? 'Teleport the Fey Spirit and make its attack.',
      type: 'utility',
      cost: { type: 'bonus' },
      sourceSpellId: conjureFey.id,
      targeting: 'single_enemy',
      range: 6,
      effects: [{
        type: 'granted_action',
        grantedActionLabel: grantedAction!.action,
        grantedActionCost: grantedAction!.type,
        grantedActionFrequency: grantedAction!.frequency,
        grantedActionRangeLimit: grantedAction!.rangeLimit,
        grantedActionNotes: grantedAction!.notes
      }]
    };

    expect(summonedSpirit).toBeDefined();

    const [teleportCommand] = AbilityCommandFactory.createCommands(
      grantedAbility,
      caster,
      [enemy],
      {} as never,
      [destination, { kind: 'creature', id: enemy.id }]
    );
    const afterTeleport = await teleportCommand.execute(summonedState);
    const movedSpirit = afterTeleport.characters.find(character => character.id === summonedSpirit!.id);

    expect(movedSpirit?.position).toEqual(destination.position);
    expect(afterTeleport.combatLog.some(entry =>
      entry.data?.grantedAction === 'teleport_fey_spirit_and_make_melee_spell_attack' &&
      entry.data?.teleportedSummonId === summonedSpirit!.id &&
      entry.data?.spellId === conjureFey.id
    )).toBe(true);
  });
});
