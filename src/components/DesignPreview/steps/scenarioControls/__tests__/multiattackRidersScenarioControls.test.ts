/**
 * This file proves the Multiattack & Attack Riders controls use canonical combat state.
 *
 * The fixture matches the mounted drake, both AC-16 targets, their 40 HP pools,
 * and the authored board positions. Assertions cover a single action payment,
 * independent hit/miss rolls, split targets, hit-only venom, poison immunity,
 * repeat rejection, reasoned logs, and preservation of unrelated combatants.
 */

import { describe, expect, it } from 'vitest';
import type { CombatCharacter } from '../../../../../types/combat';
import { createMockCombatCharacter } from '../../../../../utils/core';
import multiattackRidersScenarioControls, {
  MULTIATTACK_RIDERS_ATTACKER_ID,
  MULTIATTACK_RIDERS_ATTACKER_START,
  MULTIATTACK_RIDERS_CLAW_DAMAGE,
  MULTIATTACK_RIDERS_GUARD_ID,
  MULTIATTACK_RIDERS_GUARD_START,
  MULTIATTACK_RIDERS_TARGET_AC,
  MULTIATTACK_RIDERS_TARGET_HP,
  MULTIATTACK_RIDERS_VENOM_DAMAGE,
  MULTIATTACK_RIDERS_WARD_ID,
  MULTIATTACK_RIDERS_WARD_START,
} from '../multiattackRidersScenarioControls';
import type { PreviewCombatScenarioControlSnapshot } from '../PreviewCombatScenarioControlTypes';

// ============================================================================
// Authored Scenario Snapshot
// ============================================================================
// The target numbers keep both attack rolls and every HP transition readable.
// An unrelated bystander confirms each control replaces only its owned actors.
// ============================================================================

function createTarget(
  id: string,
  name: string,
  position: { x: number; y: number },
): CombatCharacter {
  return createMockCombatCharacter({
    id,
    name,
    team: 'player',
    position,
    currentHP: MULTIATTACK_RIDERS_TARGET_HP,
    maxHP: MULTIATTACK_RIDERS_TARGET_HP,
    armorClass: MULTIATTACK_RIDERS_TARGET_AC,
    baseAC: MULTIATTACK_RIDERS_TARGET_AC,
  });
}

function createSnapshot(): PreviewCombatScenarioControlSnapshot {
  return {
    mapData: null,
    characters: [
      createMockCombatCharacter({
        id: MULTIATTACK_RIDERS_ATTACKER_ID,
        name: 'Venom Drake (Multiattack · +6)',
        level: 5,
        team: 'enemy',
        position: { ...MULTIATTACK_RIDERS_ATTACKER_START },
        stats: {
          ...createMockCombatCharacter().stats,
          strength: 16,
        },
      }),
      createTarget(
        MULTIATTACK_RIDERS_GUARD_ID,
        'Iron Guard (AC 16 · 40 HP)',
        { ...MULTIATTACK_RIDERS_GUARD_START },
      ),
      createTarget(
        MULTIATTACK_RIDERS_WARD_ID,
        'Venom Ward (AC 16 · 40 HP)',
        { ...MULTIATTACK_RIDERS_WARD_START },
      ),
      createMockCombatCharacter({
        id: 'multiattack-riders-bystander',
        name: 'Unrelated Bystander',
        team: 'neutral',
        position: { x: 2, y: 9 },
      }),
    ],
    activeLightSources: [],
    reactiveTriggers: [],
  };
}

function runAction(controlId: string) {
  return multiattackRidersScenarioControls.applyControl({
    controlId,
    value: true,
    snapshot: createSnapshot(),
  });
}

function findCharacter(
  characters: CombatCharacter[],
  characterId: string,
): CombatCharacter {
  const character = characters.find(candidate => candidate.id === characterId);
  if (!character) throw new Error(`Missing Multiattack actor ${characterId}.`);
  return character;
}

// ============================================================================
// Control Outcomes
// ============================================================================
// HP, economy, immunity, and log assertions jointly prove the visible teaching
// explanation is a projection of the returned engine state.
// ============================================================================

describe('multiattackRidersScenarioControls', () => {
  it('registers exactly four inert action controls', () => {
    expect(multiattackRidersScenarioControls.scenarioId).toBe('multiattack_riders');
    expect(multiattackRidersScenarioControls.controls).toHaveLength(4);
    expect(multiattackRidersScenarioControls.controls.every(control => (
      control.kind === 'action' && control.defaultValue === false
    ))).toBe(true);
  });

  it('spends one action while Bite hits with venom and Claw independently misses', () => {
    const snapshot = createSnapshot();
    const bystander = findCharacter(snapshot.characters, 'multiattack-riders-bystander');
    const result = multiattackRidersScenarioControls.applyControl({
      controlId: 'bite-hit-claw-miss',
      value: true,
      snapshot,
    });
    const characters = result.characters ?? [];
    const attacker = findCharacter(characters, MULTIATTACK_RIDERS_ATTACKER_ID);
    const guard = findCharacter(characters, MULTIATTACK_RIDERS_GUARD_ID);
    const ward = findCharacter(characters, MULTIATTACK_RIDERS_WARD_ID);

    expect(attacker.actionEconomy.action.used).toBe(true);
    expect(guard.currentHP).toBe(27);
    expect(ward.currentHP).toBe(MULTIATTACK_RIDERS_TARGET_HP);
    expect(attacker.riders).toEqual([]);
    expect(result.logMessage).toContain('Multiattack Action SPENT once');
    expect(result.logMessage).toContain('Bite → Iron Guard');
    expect(result.logMessage).toContain('d20 12 + 6 = 18 vs AC 16, HIT');
    expect(result.logMessage).toContain(`Venom Rider ${MULTIATTACK_RIDERS_VENOM_DAMAGE} Poison`);
    expect(result.logMessage).toContain('Claw → Venom Ward');
    expect(result.logMessage).toContain('d20 7 + 6 = 13 vs AC 16, MISS');
    expect(findCharacter(characters, bystander.id)).toBe(bystander);
  });

  it('keeps the venom rider dormant when Bite misses while Claw still hits', () => {
    const result = runAction('bite-miss-claw-hit');
    const characters = result.characters ?? [];
    const attacker = findCharacter(characters, MULTIATTACK_RIDERS_ATTACKER_ID);

    expect(findCharacter(characters, MULTIATTACK_RIDERS_GUARD_ID).currentHP).toBe(40);
    expect(findCharacter(characters, MULTIATTACK_RIDERS_WARD_ID).currentHP)
      .toBe(40 - MULTIATTACK_RIDERS_CLAW_DAMAGE);
    expect(attacker.riders).toHaveLength(1);
    expect(result.logMessage).toContain('Bite → Iron Guard');
    expect(result.logMessage).toContain('MISS; no base damage and no Venom Rider');
    expect(result.logMessage).toContain('Claw → Venom Ward');
    expect(result.logMessage).toContain('HIT; 8 base damage');
  });

  it('resolves two hits against two independently authored targets', () => {
    const result = runAction('split-target-hits');
    const characters = result.characters ?? [];

    expect(findCharacter(characters, MULTIATTACK_RIDERS_GUARD_ID).currentHP).toBe(27);
    expect(findCharacter(characters, MULTIATTACK_RIDERS_WARD_ID).currentHP).toBe(32);
    expect(result.logMessage).toContain('Each authored attack kept its own target and hit result');
  });

  it('applies Bite but zero venom damage to the poison-immune ward', () => {
    const result = runAction('poison-immunity');
    const characters = result.characters ?? [];
    const ward = findCharacter(characters, MULTIATTACK_RIDERS_WARD_ID);

    expect(ward.name).toContain('POISON IMMUNE');
    expect(ward.immunities).toContain('Poison');
    expect(ward.currentHP).toBe(31);
    expect(result.logMessage).toContain('Venom Rider 4 Poison → 0 (immune)');
    expect(findCharacter(characters, MULTIATTACK_RIDERS_GUARD_ID).currentHP).toBe(32);
  });

  it('rejects a repeated control until Reset Board restores the authored fixture', () => {
    const first = runAction('bite-hit-claw-miss');
    const firstCharacters = first.characters ?? [];
    const repeated = multiattackRidersScenarioControls.applyControl({
      controlId: 'bite-hit-claw-miss',
      value: true,
      snapshot: {
        ...createSnapshot(),
        characters: firstCharacters,
      },
    });

    // A rejected repeat returns no character patch, so the mounted host keeps
    // the spent Action and 27-HP guard exactly as the first transaction left them.
    expect(repeated.characters).toBeUndefined();
    expect(repeated.logMessage).toContain('action_unavailable');
    expect(repeated.logMessage).toContain('Reset Board');
    expect(findCharacter(firstCharacters, MULTIATTACK_RIDERS_ATTACKER_ID).actionEconomy.action.used)
      .toBe(true);
    expect(findCharacter(firstCharacters, MULTIATTACK_RIDERS_GUARD_ID).currentHP).toBe(27);
  });

  it('keeps false defaults and malformed controls state-preserving', () => {
    const snapshot = createSnapshot();
    const inert = multiattackRidersScenarioControls.applyControl({
      controlId: 'bite-hit-claw-miss',
      value: false,
      snapshot,
    });
    const malformed = multiattackRidersScenarioControls.applyControl({
      controlId: 'bite-hit-claw-miss',
      value: 'true',
      snapshot,
    });

    expect(inert).toEqual({ logMessage: '' });
    expect(malformed.characters).toBeUndefined();
    expect(malformed.logMessage).toContain('requires an action trigger');
  });
});
