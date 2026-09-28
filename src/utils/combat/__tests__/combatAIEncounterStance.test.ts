/**
 * @file src/utils/combat/__tests__/combatAIEncounterStance.test.ts
 * Proof that combat AI now reads NPC witness memory (agora-f58b).
 *
 * `src/systems/social/npcWitnessMemory.ts` shipped `deriveEncounterStance` with
 * no combat reader, so what an NPC had seen the player do changed nothing once
 * blades were out. These tests drive `evaluateCombatTurn` across the SAME
 * battlefield with only the memory varying, and assert the turn comes out
 * different: stand down, rout, or refuse to retreat.
 */

import { describe, it, expect, vi } from 'vitest';
import {
  CORNERED_ESCAPE_ROUTE_MINIMUM,
  countEscapeRoutes,
  evaluateCombatTurn,
  resolveEncounterStance,
} from '../combatAI';
import { createMockCombatCharacter } from '../../core/factories';
import type {
  Ability,
  BattleMapData,
  BattleMapTile,
  CombatCharacter,
} from '../../../types/combat';
import type { NpcMemory } from '../../../types/world';
import { SuspicionLevel } from '../../../types/index';
import {
  createWitnessedAct,
  recordWitnessedAct,
  type WitnessedAct,
} from '../../../systems/social/npcWitnessMemory';

vi.mock('../../logger', () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

const GAME_DAY = 6;

/** Flat, fully walkable map. Every tile is a legal escape route. */
function createOpenMap(width: number, height: number): BattleMapData {
  const tiles = new Map<string, BattleMapTile>();
  for (let x = 0; x < width; x++) {
    for (let y = 0; y < height; y++) {
      const id = `${x}-${y}`;
      tiles.set(id, {
        id,
        coordinates: { x, y },
        terrain: 'floor',
        movementCost: 1,
        blocksMovement: false,
        blocksLoS: false,
        elevation: 0,
        decoration: null,
        effects: [],
      });
    }
  }
  return { dimensions: { width, height }, tiles, theme: 'dungeon', seed: 4242 };
}

/** A one-tile-wide dead end: the only way out is through the player. */
function createDeadEndMap(): BattleMapData {
  const tiles = new Map<string, BattleMapTile>();
  for (let y = 0; y < 3; y++) {
    const id = `0-${y}`;
    tiles.set(id, {
      id,
      coordinates: { x: 0, y },
      terrain: 'floor',
      movementCost: 1,
      blocksMovement: false,
      blocksLoS: false,
      elevation: 0,
      decoration: null,
      effects: [],
    });
  }
  return { dimensions: { width: 1, height: 3 }, tiles, theme: 'dungeon', seed: 99 };
}

const meleeSwing: Ability = {
  id: 'swing',
  name: 'Rusty Blade',
  description: 'A plain melee swing.',
  type: 'attack',
  range: 1,
  targeting: 'single_enemy',
  cost: { type: 'action' },
  effects: [{ type: 'damage', damageType: 'slashing', value: 8, dice: '1d8' }],
  icon: 'blade',
  tags: [],
};

function emptyMemory(): NpcMemory {
  return { disposition: 0, knownFacts: [], suspicion: SuspicionLevel.Unaware, goals: [] };
}

function memoryOf(...acts: WitnessedAct[]): NpcMemory {
  return acts.reduce<NpcMemory>((memory, act) => recordWitnessedAct(memory, act), emptyMemory());
}

/** Saw the player win a large fight, then spare the man who yielded. */
function mercifulLegendMemory(): NpcMemory {
  return memoryOf(
    createWitnessedAct('defeated_foes', 4, { magnitude: 40, detail: 'of the levy' }),
    createWitnessedAct('spared_surrendering', 4, { detail: 'the beaten captain' })
  );
}

/** Saw the player kill prisoners. */
function butcherMemory(): NpcMemory {
  return memoryOf(
    createWitnessedAct('defeated_foes', 4, { magnitude: 3, detail: 'guards' }),
    createWitnessedAct('executed_surrendering', 4, { detail: 'a man on his knees' })
  );
}

function bandit(position = { x: 5, y: 5 }): CombatCharacter {
  return createMockCombatCharacter({
    id: 'bandit',
    name: 'Bandit',
    team: 'enemy',
    position,
    abilities: [meleeSwing],
  });
}

function player(position = { x: 4, y: 5 }): CombatCharacter {
  return createMockCombatCharacter({
    id: 'player',
    name: 'Player',
    team: 'player',
    position,
    abilities: [meleeSwing],
  });
}

describe('encounter stance reaches the combat planner (agora-f58b)', () => {
  it('attacks as before when no witness memory is supplied', () => {
    const map = createOpenMap(12, 12);
    const me = bandit();
    const foe = player();

    const action = evaluateCombatTurn(me, [me, foe], map);

    expect(action.type).toBe('ability');
    expect(action.targetCharacterIds).toContain('player');
  });

  it('stands down instead of attacking when it expects mercy', () => {
    const map = createOpenMap(12, 12);
    const me = bandit();
    const foe = player();

    const baseline = evaluateCombatTurn(me, [me, foe], map);
    expect(baseline.type).toBe('ability');

    const action = evaluateCombatTurn(me, [me, foe], map, {
      stance: { memory: mercifulLegendMemory(), gameDay: GAME_DAY },
    });

    // Same map, same abilities, same positions. Only the memory changed.
    expect(action.type).toBe('end_turn');
  });

  it('routs away from the enemy line when it expects a massacre', () => {
    const map = createOpenMap(12, 12);
    const me = bandit({ x: 5, y: 5 });
    const foe = player({ x: 4, y: 5 });

    const action = evaluateCombatTurn(me, [me, foe], map, {
      stance: { memory: butcherMemory(), gameDay: GAME_DAY },
    });

    expect(action.type).toBe('move');
    const before = Math.abs(me.position.x - foe.position.x);
    const after = Math.abs((action.targetPosition?.x ?? me.position.x) - foe.position.x);
    expect(after).toBeGreaterThan(before);
  });

  it('refuses the low-HP retreat when cornered by the same butcher', () => {
    const map = createDeadEndMap();
    // Wounded enough that `evaluateRetreatPlan` would normally fire (35% HP or less).
    const me = createMockCombatCharacter({
      id: 'bandit',
      name: 'Bandit',
      team: 'enemy',
      position: { x: 0, y: 2 },
      abilities: [meleeSwing],
      currentHP: 3,
      maxHP: 20,
    });
    const foe = player({ x: 0, y: 1 });

    const stance = { memory: butcherMemory(), gameDay: GAME_DAY };
    const resolved = resolveEncounterStance(me, [foe], new Map(), stance);
    expect(resolved.stance).toBe('fight_to_death');

    const action = evaluateCombatTurn(me, [me, foe], map, { stance });

    // A last stand: it swings, it does not reposition for safety.
    expect(action.type).not.toBe('move');
  });

  it('counts only tiles that both gain ground and leave enemy reach', () => {
    const me = bandit({ x: 5, y: 5 });
    const foe = player({ x: 4, y: 5 });

    // One tile still inside the player's reach, one three steps clear of it.
    const reachable = new Map(
      [
        { x: 5, y: 4 },
        { x: 8, y: 5 },
      ].map((coordinates, index) => [
        `plan-${index}`,
        {
          tile: {
            id: `${coordinates.x}-${coordinates.y}`,
            coordinates,
            terrain: 'floor',
            movementCost: 1,
            blocksMovement: false,
            blocksLoS: false,
            elevation: 0,
            decoration: null,
            effects: [],
          } as BattleMapTile,
          cost: 1,
          path: [coordinates],
        },
      ])
    );

    expect(countEscapeRoutes(me, [foe], reachable)).toBe(1);
    expect(countEscapeRoutes(me, [foe], reachable)).toBeLessThan(CORNERED_ESCAPE_ROUTE_MINIMUM);
  });

  it('leaves a witness with no memory of the player standing its ground', () => {
    const map = createOpenMap(12, 12);
    const me = bandit();
    const foe = player();

    const action = evaluateCombatTurn(me, [me, foe], map, {
      stance: { memory: emptyMemory(), gameDay: GAME_DAY },
    });

    expect(action.type).toBe('ability');
    expect(action.targetCharacterIds).toContain('player');
  });
});
