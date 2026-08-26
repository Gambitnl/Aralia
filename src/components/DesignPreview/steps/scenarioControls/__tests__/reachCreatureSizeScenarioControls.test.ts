/**
 * This file proves the Reach & Creature Size controls project canonical state.
 *
 * The mounted fixture contains a Large lancer, a Medium target, a Small scout,
 * and one wall square hidden inside the proposed Large placement. Assertions
 * cover normal versus extended reach, footprint-edge distance, size transition,
 * blocked placement, attack/HP truth, logs, and unrelated-character preservation.
 */

import { describe, expect, it } from 'vitest';
import type { BattleMapData, BattleMapTile, CombatCharacter } from '../../../../../types/combat';
import { createMockCombatCharacter } from '../../../../../utils/core';
import reachCreatureSizeScenarioControls, {
  REACH_CREATURE_SIZE_ATTACKER_ID,
  REACH_CREATURE_SIZE_ATTACKER_START,
  REACH_CREATURE_SIZE_BLOCKED_TILE,
  REACH_CREATURE_SIZE_DAMAGE,
  REACH_CREATURE_SIZE_OA_EDGE,
  REACH_CREATURE_SIZE_OA_EXIT,
  REACH_CREATURE_SIZE_SCOUT_ID,
  REACH_CREATURE_SIZE_SCOUT_START,
  REACH_CREATURE_SIZE_TARGET_AC,
  REACH_CREATURE_SIZE_TARGET_HP,
  REACH_CREATURE_SIZE_TARGET_ID,
  REACH_CREATURE_SIZE_TARGET_START,
} from '../reachCreatureSizeScenarioControls';
import type { PreviewCombatScenarioControlSnapshot } from '../PreviewCombatScenarioControlTypes';

// ============================================================================
// Authored Board Snapshot
// ============================================================================
// The 16-by-12 fixture mirrors the scenario host. Only the gate's far square
// blocks movement; the requested Large anchor itself remains ordinary floor.
// ============================================================================

function createMapData(): BattleMapData {
  const tiles = new Map<string, BattleMapTile>();
  for (let y = 0; y < 12; y += 1) {
    for (let x = 0; x < 16; x += 1) {
      const id = `${x}-${y}`;
      const blocked = x === REACH_CREATURE_SIZE_BLOCKED_TILE.x
        && y === REACH_CREATURE_SIZE_BLOCKED_TILE.y;
      tiles.set(id, {
        id,
        coordinates: { x, y },
        terrain: blocked ? 'wall' : 'floor',
        elevation: 0,
        movementCost: 5,
        blocksLoS: blocked,
        blocksMovement: blocked,
        decoration: null,
        effects: [],
      });
    }
  }
  return {
    dimensions: { width: 16, height: 12 },
    tiles,
    theme: 'dungeon',
    seed: 323,
  };
}

function createActor(
  id: string,
  name: string,
  size: NonNullable<CombatCharacter['stats']['size']>,
  position: { x: number; y: number },
): CombatCharacter {
  const actor = createMockCombatCharacter({ id, name, position });
  return {
    ...actor,
    stats: { ...actor.stats, size },
  };
}

function createSnapshot(): PreviewCombatScenarioControlSnapshot {
  return {
    mapData: createMapData(),
    characters: [
      createActor(
        REACH_CREATURE_SIZE_ATTACKER_ID,
        'Large Lancer (5 ft Reach)',
        'Large',
        { ...REACH_CREATURE_SIZE_ATTACKER_START },
      ),
      {
        ...createActor(
          REACH_CREATURE_SIZE_TARGET_ID,
          'Reach Target (AC 15 · 30 HP)',
          'Medium',
          { ...REACH_CREATURE_SIZE_TARGET_START },
        ),
        team: 'enemy',
        currentHP: REACH_CREATURE_SIZE_TARGET_HP,
        maxHP: REACH_CREATURE_SIZE_TARGET_HP,
        armorClass: REACH_CREATURE_SIZE_TARGET_AC,
        baseAC: REACH_CREATURE_SIZE_TARGET_AC,
      },
      createActor(
        REACH_CREATURE_SIZE_SCOUT_ID,
        'Small Space Scout',
        'Small',
        { ...REACH_CREATURE_SIZE_SCOUT_START },
      ),
      createMockCombatCharacter({
        id: 'reach-size-bystander',
        name: 'Unrelated Bystander',
        position: { x: 1, y: 9 },
      }),
    ],
    activeLightSources: [],
    reactiveTriggers: [],
  };
}

function runAction(controlId: string, snapshot = createSnapshot()) {
  return reachCreatureSizeScenarioControls.applyControl({
    controlId,
    value: true,
    snapshot,
  });
}

function findCharacter(characters: CombatCharacter[], id: string): CombatCharacter {
  const character = characters.find(candidate => candidate.id === id);
  if (!character) throw new Error(`Missing Reach & Creature Size actor ${id}.`);
  return character;
}

// ============================================================================
// Control Outcomes
// ============================================================================
// Each outcome checks returned character state and the teaching log together,
// proving the visible narrative is derived from the same canonical result.
// ============================================================================

describe('reachCreatureSizeScenarioControls', () => {
  it('preserves the original controls and registers two footprint-exit probes', () => {
    expect(reachCreatureSizeScenarioControls.scenarioId).toBe('reach_creature_size');
    expect(reachCreatureSizeScenarioControls.controls.map(control => control.id)).toEqual([
      'normal-reach-reset',
      'extended-reach-strike',
      'medium-footprint-check',
      'blocked-large-placement',
      'large-footprint-edge-step',
      'large-footprint-exit',
    ]);
    expect(reachCreatureSizeScenarioControls.controls.every(control => (
      control.kind === 'action' && control.defaultValue === false
    ))).toBe(true);
  });

  it('rejects normal reach from the Large footprint and resets prior damage', () => {
    const extended = runAction('extended-reach-strike');
    const resetSnapshot = {
      ...createSnapshot(),
      characters: extended.characters ?? [],
    };
    const reset = runAction('normal-reach-reset', resetSnapshot);
    const characters = reset.characters ?? [];
    const attacker = findCharacter(characters, REACH_CREATURE_SIZE_ATTACKER_ID);
    const target = findCharacter(characters, REACH_CREATURE_SIZE_TARGET_ID);

    expect(attacker.stats.size).toBe('Large');
    expect(attacker.abilities[0].range).toBe(1);
    expect(target.currentHP).toBe(REACH_CREATURE_SIZE_TARGET_HP);
    expect(reset.logMessage).toContain('target INVALID');
    expect(reset.logMessage).toContain('Nearest footprint distance 10 ft');
    expect(reset.logMessage).toContain('token-center distance 12.5 ft');
    expect(reset.logMessage).toContain('no attack roll or damage resolved');
  });

  it('makes the same target valid at 10-foot reach and resolves canonical damage', () => {
    const snapshot = createSnapshot();
    const bystander = findCharacter(snapshot.characters, 'reach-size-bystander');
    const result = runAction('extended-reach-strike', snapshot);
    const characters = result.characters ?? [];
    const attacker = findCharacter(characters, REACH_CREATURE_SIZE_ATTACKER_ID);
    const target = findCharacter(characters, REACH_CREATURE_SIZE_TARGET_ID);

    expect(attacker.stats.size).toBe('Large');
    expect(attacker.abilities[0].range).toBe(2);
    expect(target.currentHP).toBe(REACH_CREATURE_SIZE_TARGET_HP - REACH_CREATURE_SIZE_DAMAGE);
    expect(result.logMessage).toContain('target VALID');
    expect(result.logMessage).toContain('d20 12 + 6 = 18 vs AC 15, HIT');
    expect(findCharacter(characters, bystander.id)).toBe(bystander);
  });

  it('moves the target outside 10-foot reach when the same anchor shrinks to Medium', () => {
    const result = runAction('medium-footprint-check');
    const characters = result.characters ?? [];
    const attacker = findCharacter(characters, REACH_CREATURE_SIZE_ATTACKER_ID);
    const target = findCharacter(characters, REACH_CREATURE_SIZE_TARGET_ID);

    expect(attacker.stats.size).toBe('Medium');
    expect(attacker.abilities[0].range).toBe(2);
    expect(target.currentHP).toBe(REACH_CREATURE_SIZE_TARGET_HP);
    expect(result.logMessage).toContain('Medium footprint');
    expect(result.logMessage).toContain('Nearest footprint distance 15 ft');
    expect(result.logMessage).toContain('target INVALID');
  });

  it('rejects an open Large anchor when a far footprint square is blocked', () => {
    const result = runAction('blocked-large-placement');
    const attacker = findCharacter(
      result.characters ?? [],
      REACH_CREATURE_SIZE_ATTACKER_ID,
    );

    expect(attacker.position).toEqual(REACH_CREATURE_SIZE_ATTACKER_START);
    expect(attacker.stats.size).toBe('Large');
    expect(result.logMessage).toContain('Large placement BLOCKED at anchor 13,4');
    expect(result.logMessage).toContain('blocked at 14,5');
    expect(result.logMessage).toContain('remains at 6,4');
  });

  it('keeps a Large mover inside reach while it moves along the nearest footprint edge', () => {
    const result = runAction('large-footprint-edge-step');
    const characters = result.characters ?? [];
    const attacker = findCharacter(characters, REACH_CREATURE_SIZE_ATTACKER_ID);
    const mover = findCharacter(characters, REACH_CREATURE_SIZE_TARGET_ID);

    expect(attacker.stats.size).toBe('Large');
    expect(attacker.actionEconomy.reaction.used).toBe(false);
    expect(mover.stats.size).toBe('Large');
    expect(mover.position).toEqual(REACH_CREATURE_SIZE_OA_EDGE);
    expect(result.logMessage).toContain('nearest footprint edge 5 ft → 5 ft');
    expect(result.logMessage).toContain('Opportunity Attacks 0');
    expect(result.logMessage).toContain('Reaction remains ready');
  });

  it('discovers one true Large-footprint exit and atomically pays the Reaction', () => {
    const result = runAction('large-footprint-exit');
    const characters = result.characters ?? [];
    const attacker = findCharacter(characters, REACH_CREATURE_SIZE_ATTACKER_ID);
    const mover = findCharacter(characters, REACH_CREATURE_SIZE_TARGET_ID);

    expect(attacker.stats.size).toBe('Large');
    expect(attacker.actionEconomy.reaction.used).toBe(true);
    expect(mover.stats.size).toBe('Large');
    expect(mover.position).toEqual(REACH_CREATURE_SIZE_OA_EXIT);
    expect(result.logMessage).toContain('nearest footprint edge 5 ft → 10 ft');
    expect(result.logMessage).toContain('Opportunity Attacks 1');
    expect(result.logMessage).toContain('Reaction ready → spent');
  });

  it('keeps false defaults and malformed control values state-preserving', () => {
    const snapshot = createSnapshot();
    const inert = reachCreatureSizeScenarioControls.applyControl({
      controlId: 'extended-reach-strike',
      value: false,
      snapshot,
    });
    const malformed = reachCreatureSizeScenarioControls.applyControl({
      controlId: 'extended-reach-strike',
      value: 'true',
      snapshot,
    });

    expect(inert).toEqual({ logMessage: '' });
    expect(malformed.characters).toBeUndefined();
    expect(malformed.logMessage).toContain('requires an action trigger');
  });
});
