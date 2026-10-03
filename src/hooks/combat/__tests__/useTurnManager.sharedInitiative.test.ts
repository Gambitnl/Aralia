import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useTurnManager } from '../useTurnManager';
import { SummoningCommand } from '../../../commands/effects/SummoningCommand';
import { createMockCombatCharacter } from '../../../utils/core';
import type { CombatCharacter, CombatLogEntry, CombatState } from '../../../types/combat';
import type { CommandContext } from '../../../commands/base/SpellCommand';
import type { SummoningEffect } from '../../../types/spells';
import summonBeast from '@/data/spells/level-2/summon-beast.json';
import {
  getInitiativeTiesSharedTurnsTotal,
  INITIATIVE_TIES_CAPTAIN_ID,
  INITIATIVE_TIES_LATE_GUARD_ID,
  INITIATIVE_TIES_RIVAL_ID,
  INITIATIVE_TIES_SHARED_ECHO_ID,
  INITIATIVE_TIES_TURN_MARKER,
  prepareInitiativeTiesSharedTurnsCharacters,
} from '../../../components/DesignPreview/steps/scenarioControls/initiativeTiesSharedTurnsScenarioControls';

/**
 * This test proves the live Summon Beast packet can create a summon that keeps
 * its shared-initiative policy and enters turn order directly after its caster.
 *
 * The combat hook is the nearest durable boundary for the scheduler bridge, so
 * the proof uses the real spell packet to create the summon and then asserts
 * the runtime join behavior.
 */
describe('useTurnManager shared-initiative summon scheduling', () => {
  it('places a live Summon Beast summon immediately after its caster', () => {
    const caster = createMockCombatCharacter({
      id: 'summon-beast-caster',
      name: 'Summon Beast Caster',
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
    const summonEffect = (summonBeast.effects.find(effect => effect.type === 'SUMMONING') as unknown) as SummoningEffect;
    const context: any = {
      spellId: summonBeast.id,
      spellName: summonBeast.name,
      castAtLevel: 2,
      caster,
      targets: [],
      playerInput: 'Air',
      gameState: {}
    } as unknown as CommandContext;
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
    const summonedActor = summonState.characters.find(character =>
      character.isSummon &&
      character.summonMetadata?.spellId === summonBeast.id &&
      character.summonMetadata?.initiativePolicy === 'shared'
    ) as CombatCharacter | undefined;

    expect(summonedActor).toBeDefined();
    expect(summonedActor?.summonMetadata?.initiativePolicy).toBe('shared');

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
      result.current.joinCombat(summonedActor!, { initiative: summonedActor!.initiative });
    });

    expect(result.current.turnState.turnOrder).toEqual([caster.id, summonedActor!.id]);
    expect(result.current.turnState.currentCharacterId).toBe(caster.id);
    expect(result.current.turnState.activeGroup).toMatchObject({
      memberIds: [caster.id, summonedActor!.id],
      activeMemberId: caster.id,
      actionOwnership: 'member',
      movementOwnership: 'member',
      reactionOwnership: 'member',
      effectTiming: 'member_start_and_end',
    });
  });

  it('advances tied and shared actors once while resetting only the actor whose turn starts', async () => {
    // Build the exact four-actor sandbox fixture, then let the real manager
    // initialize it through the deterministic initiative seam.
    let charactersState = prepareInitiativeTiesSharedTurnsCharacters([
      createMockCombatCharacter({ id: INITIATIVE_TIES_CAPTAIN_ID, name: 'Tie Captain' }),
      createMockCombatCharacter({ id: INITIATIVE_TIES_RIVAL_ID, name: 'Agile Rival' }),
      createMockCombatCharacter({ id: INITIATIVE_TIES_SHARED_ECHO_ID, name: 'Shared Echo' }),
      createMockCombatCharacter({ id: INITIATIVE_TIES_LATE_GUARD_ID, name: 'Late Guard' }),
    ]);
    const logs: CombatLogEntry[] = [];
    const onCharacterUpdate = (updatedCharacter: CombatCharacter) => {
      charactersState = charactersState.map(character => (
        character.id === updatedCharacter.id ? updatedCharacter : character
      ));
    };
    const onLogEntry = (entry: CombatLogEntry) => logs.push(entry);
    const { result, rerender } = renderHook(
      ({ chars }: { chars: CombatCharacter[] }) => useTurnManager({
        characters: chars,
        mapData: null,
        onCharacterUpdate,
        onLogEntry,
        initiativeRoller: getInitiativeTiesSharedTurnsTotal,
      }),
      { initialProps: { chars: charactersState } },
    );

    act(() => {
      result.current.initializeCombat(charactersState);
    });
    // The mounted scenario deliberately reapplies its spent proof ledgers after
    // normal combat initialization refreshes everyone.
    charactersState = prepareInitiativeTiesSharedTurnsCharacters(charactersState);
    rerender({ chars: charactersState });

    expect(result.current.turnState).toMatchObject({
      currentTurn: 1,
      currentCharacterId: INITIATIVE_TIES_CAPTAIN_ID,
      turnOrder: [
        INITIATIVE_TIES_CAPTAIN_ID,
        INITIATIVE_TIES_SHARED_ECHO_ID,
        INITIATIVE_TIES_RIVAL_ID,
        INITIATIVE_TIES_LATE_GUARD_ID,
      ],
      activeGroup: {
        memberIds: [INITIATIVE_TIES_CAPTAIN_ID, INITIATIVE_TIES_SHARED_ECHO_ID],
        activeMemberId: INITIATIVE_TIES_CAPTAIN_ID,
        completedMemberIds: [],
      },
    });

    // Ending the captain expires only its own marker and refreshes only Shared
    // Echo. The rival's spent resources prove tied totals do not merge turns.
    await act(async () => {
      await result.current.endTurn();
    });
    rerender({ chars: charactersState });
    const captainAfterEnd = charactersState.find(character => character.id === INITIATIVE_TIES_CAPTAIN_ID)!;
    const echoAtStart = charactersState.find(character => character.id === INITIATIVE_TIES_SHARED_ECHO_ID)!;
    const rivalStillWaiting = charactersState.find(character => character.id === INITIATIVE_TIES_RIVAL_ID)!;

    expect(result.current.turnState.currentCharacterId).toBe(INITIATIVE_TIES_SHARED_ECHO_ID);
    expect(result.current.turnState.activeGroup).toMatchObject({
      memberIds: [INITIATIVE_TIES_CAPTAIN_ID, INITIATIVE_TIES_SHARED_ECHO_ID],
      activeMemberId: INITIATIVE_TIES_SHARED_ECHO_ID,
      completedMemberIds: [INITIATIVE_TIES_CAPTAIN_ID],
    });
    expect(captainAfterEnd.conditions?.map(condition => condition.name))
      .not.toContain(INITIATIVE_TIES_TURN_MARKER);
    expect(captainAfterEnd.actionEconomy).toMatchObject({
      action: { used: true },
      reaction: { used: true },
      movement: { used: 15 },
    });
    expect(echoAtStart.actionEconomy).toMatchObject({
      action: { used: false, remaining: 1 },
      reaction: { used: false, remaining: 1 },
      movement: { used: 0, total: 30 },
      freeActions: 1,
    });
    expect(rivalStillWaiting.actionEconomy).toMatchObject({
      action: { used: true },
      reaction: { used: true },
      movement: { used: 15 },
    });

    // The remaining three transitions prove every id appears once before the
    // round wraps, with no duplicate shared actor and no skipped late guard.
    await act(async () => {
      await result.current.endTurn();
    });
    rerender({ chars: charactersState });
    expect(result.current.turnState.currentCharacterId).toBe(INITIATIVE_TIES_RIVAL_ID);

    await act(async () => {
      await result.current.endTurn();
    });
    rerender({ chars: charactersState });
    expect(result.current.turnState.currentCharacterId).toBe(INITIATIVE_TIES_LATE_GUARD_ID);

    await act(async () => {
      await result.current.endTurn();
    });
    rerender({ chars: charactersState });
    expect(result.current.turnState).toMatchObject({
      currentTurn: 2,
      currentCharacterId: INITIATIVE_TIES_CAPTAIN_ID,
      turnOrder: [
        INITIATIVE_TIES_CAPTAIN_ID,
        INITIATIVE_TIES_SHARED_ECHO_ID,
        INITIATIVE_TIES_RIVAL_ID,
        INITIATIVE_TIES_LATE_GUARD_ID,
      ],
    });
    expect(new Set(result.current.turnState.turnOrder).size).toBe(4);
    expect(logs.map(entry => entry.message)).toContain('Round 2 begins!');
  });

  it('makes repeated endings a no-op and advances once when the active shared member is removed', async () => {
    // Keep each member ledger independent and capture roster removal exactly as
    // the mounted sandbox does. The deterministic manager remains the only
    // owner of group completion and next-member selection.
    let charactersState = prepareInitiativeTiesSharedTurnsCharacters([
      createMockCombatCharacter({ id: INITIATIVE_TIES_CAPTAIN_ID, name: 'Tie Captain' }),
      createMockCombatCharacter({ id: INITIATIVE_TIES_RIVAL_ID, name: 'Agile Rival' }),
      createMockCombatCharacter({ id: INITIATIVE_TIES_SHARED_ECHO_ID, name: 'Shared Echo' }),
      createMockCombatCharacter({ id: INITIATIVE_TIES_LATE_GUARD_ID, name: 'Late Guard' }),
    ]);
    const logs: CombatLogEntry[] = [];
    const onCharacterUpdate = (updatedCharacter: CombatCharacter) => {
      charactersState = charactersState.map(character => (
        character.id === updatedCharacter.id ? updatedCharacter : character
      ));
    };
    const onCharacterRemove = (characterId: string) => {
      charactersState = charactersState.filter(character => character.id !== characterId);
    };
    const { result, rerender } = renderHook(
      ({ chars }: { chars: CombatCharacter[] }) => useTurnManager({
        characters: chars,
        mapData: null,
        onCharacterUpdate,
        onCharacterRemove,
        onLogEntry: entry => logs.push(entry),
        initiativeRoller: getInitiativeTiesSharedTurnsTotal,
      }),
      { initialProps: { chars: charactersState } },
    );

    act(() => result.current.initializeCombat(charactersState));
    charactersState = prepareInitiativeTiesSharedTurnsCharacters(charactersState);
    rerender({ chars: charactersState });

    // Two requests from the same rendered boundary process Captain only once.
    await act(async () => {
      await Promise.all([result.current.endTurn(), result.current.endTurn()]);
    });
    rerender({ chars: charactersState });
    expect(result.current.turnState.currentCharacterId).toBe(INITIATIVE_TIES_SHARED_ECHO_ID);
    expect(logs.filter(entry => (
      entry.characterId === INITIATIVE_TIES_CAPTAIN_ID
      && entry.data?.cleanup === 'turn_boundary_condition_expiry'
    ))).toHaveLength(1);

    const rivalBeforeRemoval = charactersState.find(character => character.id === INITIATIVE_TIES_RIVAL_ID)!;
    expect(rivalBeforeRemoval.actionEconomy.action.used).toBe(true);

    // Active removal completes the shared group, removes only Echo, and starts
    // Rival once. Repeating the same removal does not advance to Late Guard.
    let removalResult: ReturnType<typeof result.current.removeCharacterFromCombat>;
    act(() => {
      removalResult = result.current.removeCharacterFromCombat(INITIATIVE_TIES_SHARED_ECHO_ID);
    });
    rerender({ chars: charactersState });
    expect(removalResult!).toMatchObject({
      previousCharacterId: INITIATIVE_TIES_SHARED_ECHO_ID,
      nextCharacterId: INITIATIVE_TIES_RIVAL_ID,
      isGroupCompleted: true,
    });
    expect(result.current.turnState.currentCharacterId).toBe(INITIATIVE_TIES_RIVAL_ID);
    expect(charactersState.map(character => character.id)).not.toContain(INITIATIVE_TIES_SHARED_ECHO_ID);
    expect(charactersState.find(character => character.id === INITIATIVE_TIES_RIVAL_ID)?.actionEconomy.action.used).toBe(false);

    const departureLogsBeforeRepeat = logs.filter(entry => entry.message.includes('leaves combat')).length;
    act(() => {
      expect(result.current.removeCharacterFromCombat(INITIATIVE_TIES_SHARED_ECHO_ID)).toBeNull();
    });
    expect(result.current.turnState.currentCharacterId).toBe(INITIATIVE_TIES_RIVAL_ID);
    expect(logs.filter(entry => entry.message.includes('leaves combat'))).toHaveLength(departureLogsBeforeRepeat);
  });
});
