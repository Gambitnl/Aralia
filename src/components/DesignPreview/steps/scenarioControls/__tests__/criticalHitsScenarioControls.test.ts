/**
 * This file proves CS21 authors deterministic requests without owning results.
 * It also executes one request through the production command factory to cover
 * critical base/rider dice, resistance, downing, and rider consumption.
 */

import { describe, expect, it } from 'vitest';
import { AbilityCommandFactory, CommandExecutor } from '../../../../../commands';
import { initialGameState } from '../../../../../state/initialState';
import type { CombatCharacter, CombatState } from '../../../../../types/combat';
import { createMockCombatCharacter } from '../../../../../utils/core';
import criticalHitsScenarioControls, {
  CRITICAL_HITS_ATTACKER_ID,
  CRITICAL_HITS_FORTRESS_AC,
  CRITICAL_HITS_FORTRESS_HP,
  CRITICAL_HITS_FORTRESS_TARGET_ID,
  CRITICAL_HITS_OPEN_AC,
  CRITICAL_HITS_OPEN_TARGET_ID,
  CRITICAL_HITS_RIDER_ID,
  CRITICAL_HITS_STANDARD_AC,
  CRITICAL_HITS_STANDARD_TARGET_ID,
  CRITICAL_HITS_TARGET_HP,
  prepareCriticalHitsCharacters,
} from '../criticalHitsScenarioControls';
import type { PreviewCombatScenarioControlSnapshot } from '../PreviewCombatScenarioControlTypes';

function createSnapshot(): PreviewCombatScenarioControlSnapshot {
  const character = (id: string, team: CombatCharacter['team']) => createMockCombatCharacter({
    id,
    name: id,
    team,
    currentHP: CRITICAL_HITS_TARGET_HP,
    maxHP: CRITICAL_HITS_TARGET_HP,
  });
  const characters = prepareCriticalHitsCharacters([
    character(CRITICAL_HITS_ATTACKER_ID, 'player'),
    character(CRITICAL_HITS_FORTRESS_TARGET_ID, 'enemy'),
    character(CRITICAL_HITS_STANDARD_TARGET_ID, 'enemy'),
    character(CRITICAL_HITS_OPEN_TARGET_ID, 'enemy'),
    character('critical-hits-bystander', 'neutral'),
  ]);

  return {
    mapData: null,
    characters,
    activeLightSources: [],
    reactiveTriggers: [],
    turnState: {
      currentTurn: 1,
      turnOrder: characters.map(character => character.id),
      currentCharacterId: CRITICAL_HITS_ATTACKER_ID,
      phase: 'action',
      actionsThisTurn: [],
    },
  };
}

function request(controlId: string) {
  return criticalHitsScenarioControls.applyControl({
    controlId,
    value: true,
    snapshot: createSnapshot(),
  });
}

async function executeControl(controlId: string): Promise<CombatState> {
  const snapshot = createSnapshot();
  const execution = request(controlId).abilityExecution!;
  const attacker = snapshot.characters.find(character => character.id === execution.casterId)!;
  const target = snapshot.characters.find(character => character.id === execution.targetId)!;
  const state: CombatState = {
    isActive: true,
    characters: snapshot.characters,
    turnState: snapshot.turnState!,
    selectedCharacterId: attacker.id,
    selectedAbilityId: execution.ability.id,
    actionMode: 'select',
    validTargets: [],
    validMoves: [],
    combatLog: [],
    reactiveTriggers: [], activeLightSources: [],
  };
  const commands = AbilityCommandFactory.createCommands(
    execution.ability,
    attacker,
    [target],
    initialGameState,
    undefined,
    undefined,
    execution,
  );
  return (await CommandExecutor.execute(commands, state)).finalState;
}

describe('criticalHitsScenarioControls', () => {
  it('registers four action controls that emit exact production requests', () => {
    expect(criticalHitsScenarioControls.controls).toHaveLength(4);

    const expectedRolls = new Map([
      ['natural-20', 20],
      ['natural-1', 1],
      ['ordinary-hit', 13],
      ['ordinary-miss', 12],
    ]);
    for (const [controlId, expectedRoll] of expectedRolls) {
      const execution = request(controlId).abilityExecution;
      expect(execution?.casterId).toBe(CRITICAL_HITS_ATTACKER_ID);
      expect(Math.floor((execution?.attackRollRng?.() ?? 0) * 20) + 1).toBe(expectedRoll);
      expect(execution?.damageRng?.()).toBe(0.5);
    }
  });

  it('restores the exact CS21 action, rider, AC, HP, and defense baseline only', () => {
    const snapshot = createSnapshot();
    const attacker = snapshot.characters.find(character => character.id === CRITICAL_HITS_ATTACKER_ID);
    const fortress = snapshot.characters.find(character => character.id === CRITICAL_HITS_FORTRESS_TARGET_ID);
    const standard = snapshot.characters.find(character => character.id === CRITICAL_HITS_STANDARD_TARGET_ID);
    const open = snapshot.characters.find(character => character.id === CRITICAL_HITS_OPEN_TARGET_ID);
    const bystander = snapshot.characters.find(character => character.id === 'critical-hits-bystander');

    expect(attacker?.actionEconomy.action).toEqual({ used: false, remaining: 1 });
    expect(attacker?.riders?.map(rider => rider.id)).toEqual([CRITICAL_HITS_RIDER_ID]);
    expect([fortress?.armorClass, standard?.armorClass, open?.armorClass]).toEqual([
      CRITICAL_HITS_FORTRESS_AC,
      CRITICAL_HITS_STANDARD_AC,
      CRITICAL_HITS_OPEN_AC,
    ]);
    expect(fortress).toMatchObject({ currentHP: CRITICAL_HITS_FORTRESS_HP, resistances: ['Fire'] });
    expect(standard?.currentHP).toBe(CRITICAL_HITS_TARGET_HP);
    expect(bystander?.name).toBe('critical-hits-bystander');
  });

  it('runs the natural 20 request through critical riders, resistance, and downing commands', async () => {
    const snapshot = createSnapshot();
    const execution = request('natural-20').abilityExecution!;
    const attacker = snapshot.characters.find(character => character.id === execution.casterId)!;
    const target = snapshot.characters.find(character => character.id === execution.targetId)!;
    const state: CombatState = {
      isActive: true,
      characters: snapshot.characters,
      turnState: snapshot.turnState!,
      selectedCharacterId: attacker.id,
      selectedAbilityId: execution.ability.id,
      actionMode: 'select',
      validTargets: [],
      validMoves: [],
      combatLog: [],
    reactiveTriggers: [], activeLightSources: [],
    };
    const commands = AbilityCommandFactory.createCommands(
      execution.ability,
      attacker,
      [target],
      initialGameState,
      undefined,
      undefined,
      execution,
    );
    const result = await CommandExecutor.execute(commands, state);
    const finalTarget = result.finalState.characters.find(character => character.id === target.id);
    const finalAttacker = result.finalState.characters.find(character => character.id === attacker.id);

    expect(result.success).toBe(true);
    expect(finalTarget?.currentHP).toBe(0);
    expect(finalTarget?.statusEffects.map(effect => effect.name)).toContain('Unconscious');
    expect(finalAttacker?.riders).toEqual([]);
    expect(result.finalState.combatLog).toEqual(expect.arrayContaining([
      expect.objectContaining({
        type: 'action',
        data: expect.objectContaining({ attackRoll: 20, isCritical: true, targetArmorClass: 30 }),
      }),
      expect.objectContaining({ type: 'damage', data: expect.objectContaining({ value: 13, type: 'piercing' }) }),
      expect.objectContaining({ type: 'damage', data: expect.objectContaining({ value: 4, type: 'Fire' }) }),
    ]));
  });

  it('preserves natural 1 and ordinary AC hit/miss truth in the production command', async () => {
    const naturalOne = await executeControl('natural-1');
    const ordinaryHit = await executeControl('ordinary-hit');
    const ordinaryMiss = await executeControl('ordinary-miss');
    const naturalOneTarget = naturalOne.characters.find(character => character.id === CRITICAL_HITS_OPEN_TARGET_ID);
    const ordinaryHitTarget = ordinaryHit.characters.find(character => character.id === CRITICAL_HITS_STANDARD_TARGET_ID);
    const ordinaryMissTarget = ordinaryMiss.characters.find(character => character.id === CRITICAL_HITS_STANDARD_TARGET_ID);

    expect(naturalOneTarget?.currentHP).toBe(CRITICAL_HITS_TARGET_HP);
    expect(naturalOne.combatLog).toContainEqual(expect.objectContaining({
      data: expect.objectContaining({ attackRoll: 1, attackTotal: 6, isHit: false, isAutoMiss: true }),
    }));
    expect(ordinaryHitTarget?.currentHP).toBe(32);
    expect(ordinaryHit.combatLog).toContainEqual(expect.objectContaining({
      data: expect.objectContaining({ attackRoll: 13, attackTotal: 18, isHit: true, isCritical: false }),
    }));
    expect(ordinaryMissTarget?.currentHP).toBe(CRITICAL_HITS_TARGET_HP);
    expect(ordinaryMiss.combatLog).toContainEqual(expect.objectContaining({
      data: expect.objectContaining({ attackRoll: 12, attackTotal: 17, isHit: false }),
    }));
  });

  it('keeps defaults and malformed controls state-preserving no-ops', () => {
    const snapshot = createSnapshot();
    expect(criticalHitsScenarioControls.applyControl({
      controlId: 'natural-20', value: false, snapshot,
    }).abilityExecution).toBeUndefined();
    expect(criticalHitsScenarioControls.applyControl({
      controlId: 'stale-control', value: true, snapshot,
    }).logMessage).toContain('Unknown');
  });
});
