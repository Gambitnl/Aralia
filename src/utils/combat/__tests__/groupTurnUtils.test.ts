/**
 * This file proves the production group-turn scheduler independently of React.
 *
 * The tests cover deterministic group/member construction, member hand-offs,
 * group and round completion, Incapacitated timing, missing members, active
 * removal, and a safe no-op when nobody remains eligible.
 *
 * Exercises: groupTurnUtils.
 * Depends on: the shared combat-character test factory.
 */

import { describe, expect, it } from 'vitest';
import type { CombatCharacter, TurnState } from '../../../types/combat';
import { createMockCombatCharacter } from '../../core';
import {
  advanceCombatGroupTurn,
  buildCombatTurnGroups,
  createActiveCombatTurnGroup,
  removeCombatTurnMember,
} from '../groupTurnUtils';

// ============================================================================
// Deterministic fixture
// ============================================================================
// Captain and Echo share one initiative group. Rival remains a normal singleton
// group even though it has the same initiative total; Guard acts later on 11.
// ============================================================================

function actor(id: string, initiative: number, overrides: Partial<CombatCharacter> = {}): CombatCharacter {
  return createMockCombatCharacter({
    id,
    name: id,
    initiative,
    currentHP: 20,
    maxHP: 20,
    team: id === 'guard' || id === 'rival' ? 'enemy' : 'player',
    ...overrides,
  });
}

function fixture(): CombatCharacter[] {
  const captain = actor('captain', 15);
  const echo = actor('echo', 15, {
    isSummon: true,
    summonMetadata: {
      casterId: captain.id,
      spellId: 'group-turn-proof',
      initiativePolicy: 'shared',
    },
  });
  return [captain, echo, actor('rival', 15), actor('guard', 11)];
}

function initializedState(characters: CombatCharacter[]): TurnState {
  const groups = buildCombatTurnGroups(characters);
  return {
    currentTurn: 1,
    turnOrder: characters.map(character => character.id),
    currentCharacterId: groups[0].memberIds[0],
    turnGroups: groups,
    activeGroup: createActiveCombatTurnGroup(groups[0], groups[0].memberIds[0]),
    phase: 'action',
    actionsThisTurn: [],
  };
}

describe('groupTurnUtils', () => {
  it('builds one shared group plus ordinary singleton groups in authored order', () => {
    const groups = buildCombatTurnGroups(fixture());

    expect(groups.map(group => group.memberIds)).toEqual([
      ['captain', 'echo'],
      ['rival'],
      ['guard'],
    ]);
    expect(groups.map(group => group.initiative)).toEqual([15, 15, 11]);
  });

  it('advances members inside one group before completing its initiative slot', () => {
    const characters = fixture();
    const captainToEcho = advanceCombatGroupTurn(initializedState(characters), characters);

    expect(captainToEcho.transition).toMatchObject({
      previousCharacterId: 'captain',
      nextCharacterId: 'echo',
      isGroupCompleted: false,
      isNewRound: false,
    });
    expect(captainToEcho.state.activeGroup).toMatchObject({
      activeMemberId: 'echo',
      completedMemberIds: ['captain'],
      actionOwnership: 'member',
      movementOwnership: 'member',
      reactionOwnership: 'member',
      effectTiming: 'member_start_and_end',
    });

    const echoToRival = advanceCombatGroupTurn(captainToEcho.state, characters);
    expect(echoToRival.transition).toMatchObject({
      nextCharacterId: 'rival',
      isGroupCompleted: true,
      isNewRound: false,
    });
  });

  it('keeps an Incapacitated member boundary but skips a missing follower atomically', () => {
    const characters = fixture();
    const incapacitatedEcho = characters.map(character => character.id === 'echo'
      ? {
          ...character,
          conditions: [{ name: 'Incapacitated', duration: { type: 'permanent' as const } }],
        }
      : character);
    const echoTurn = advanceCombatGroupTurn(initializedState(incapacitatedEcho), incapacitatedEcho);
    expect(echoTurn.transition.nextCharacterId).toBe('echo');

    const missingEcho = characters.filter(character => character.id !== 'echo');
    const skipMissing = advanceCombatGroupTurn(initializedState(characters), missingEcho);
    expect(skipMissing.transition).toMatchObject({
      nextCharacterId: 'rival',
      isGroupCompleted: true,
      skippedMemberIds: ['echo'],
    });
  });

  it('removes the active group member mid-turn and selects the next group exactly once', () => {
    const characters = fixture();
    const echoTurn = advanceCombatGroupTurn(initializedState(characters), characters).state;
    const removed = removeCombatTurnMember(echoTurn, 'echo', characters);

    expect(removed.transition).toMatchObject({
      previousCharacterId: 'echo',
      nextCharacterId: 'rival',
      isGroupCompleted: true,
      isNewRound: false,
    });
    expect(removed.state.turnOrder).toEqual(['captain', 'rival', 'guard']);
    expect(removed.state.turnGroups?.map(group => group.memberIds)).toEqual([
      ['captain'],
      ['rival'],
      ['guard'],
    ]);
  });

  it('wraps only after the final group and becomes a stable no-op with no eligible member', () => {
    const characters = fixture();
    let state = initializedState(characters);
    state = advanceCombatGroupTurn(state, characters).state;
    state = advanceCombatGroupTurn(state, characters).state;
    state = advanceCombatGroupTurn(state, characters).state;
    const wrap = advanceCombatGroupTurn(state, characters);

    expect(wrap.transition).toMatchObject({
      previousCharacterId: 'guard',
      nextCharacterId: 'captain',
      isGroupCompleted: true,
      isNewRound: true,
    });
    expect(wrap.state.currentTurn).toBe(2);

    const nobodyEligible = characters.map(character => ({
      ...character,
      currentHP: 0,
      team: 'enemy' as const,
    }));
    const noOp = advanceCombatGroupTurn(initializedState(nobodyEligible), nobodyEligible);
    expect(noOp.transition.nextCharacterId).toBeNull();
    expect(noOp.state.currentCharacterId).toBeNull();
    expect(noOp.state.currentTurn).toBe(1);
  });
});
