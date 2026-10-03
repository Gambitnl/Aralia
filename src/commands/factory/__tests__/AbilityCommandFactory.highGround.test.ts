/**
 * This file proves production melee attack rolls consume the high-ground rule.
 *
 * The G14 combat-elevation house rule grants Advantage to a melee attacker a
 * full five-foot band above the target and Disadvantage below. The fixture
 * varies only the two combatants' relative terrain while holding senses,
 * light, distance, and the deterministic roll source fixed, so elevation is
 * provably the deciding factor in the real factory command.
 *
 * Covers: AbilityCommandFactory.ts (high-ground consumption).
 * Depends on: VisibilitySystem, mock combat state helpers, mapData tiles.
 */

import { describe, expect, it } from 'vitest';
import { AbilityCommandFactory } from '../AbilityCommandFactory';
import { VisibilitySystem } from '@/systems/visibility';
import type {
  Ability,
  BattleMapData,
  BattleMapTile,
  CombatCharacter,
  CombatState,
  Position,
} from '@/types/combat';
import { createMockCombatCharacter, createMockCombatState, createMockGameState } from '@/utils/core';

// ============================================================================
// Deterministic Terrace Fixture
// ============================================================================
// One grid cell is five feet. The terrace at x>=8 stands ten feet above the
// lower floor. A fixed d20 source keeps ordinary, Advantage, and
// Disadvantage rolls reproducible with the production roller intact.
// ============================================================================

const FIXED_D20_RNG = (): number => (12 - 0.5) / 20;
const FIXED_DAMAGE_RNG = (): number => 0.5;
const DARKVISION_SENSES = { darkvision: 60, blindsight: 0, tremorsense: 0, truesight: 0 };

const MELEE_SWING: Ability = {
  id: 'high-ground-swing',
  name: 'High Ground Swing',
  description: 'A deterministic melee weapon attack for elevation proof.',
  type: 'attack',
  cost: { type: 'action' },
  targeting: 'single_enemy',
  range: 1,
  effects: [{ type: 'damage', dice: '1d8', damageType: 'slashing' }],
  isProficient: true,
};

const FIRE_BOLT: Ability = {
  id: 'elevation-fire-bolt',
  name: 'Elevation Fire Bolt',
  description: 'A deterministic ranged spell attack proving the melee gate.',
  type: 'attack',
  attackType: 'spell',
  cost: { type: 'action' },
  targeting: 'single_enemy',
  range: 24,
  attackBonus: 6,
  effects: [{ type: 'damage', dice: '2d10', damageType: 'fire' }],
  isProficient: true,
  isMagical: true,
};

function createFloorTile(x: number, y: number): BattleMapTile {
  return {
    id: `${x}-${y}`,
    coordinates: { x, y },
    terrain: 'floor',
    elevation: x >= 8 ? 10 : 0,
    movementCost: 5,
    blocksLoS: false,
    blocksMovement: false,
    decoration: null,
    effects: [],
  };
}

function createTerraceMap(): BattleMapData {
  const tiles = new Map<string, BattleMapTile>();
  for (let y = 0; y < 12; y += 1) {
    for (let x = 0; x < 16; x += 1) {
      tiles.set(`${x}-${y}`, createFloorTile(x, y));
    }
  }
  return { dimensions: { width: 16, height: 12 }, tiles, theme: 'cave', seed: 103 };
}

function createCombatant(
  id: string,
  team: 'player' | 'enemy',
  position: Position,
): CombatCharacter {
  return createMockCombatCharacter({
    id,
    name: id,
    team,
    position: { ...position },
    armorClass: 12,
    baseAC: 12,
    currentHP: 40,
    maxHP: 40,
    stats: {
      ...createMockCombatCharacter().stats,
      senses: { ...DARKVISION_SENSES },
    },
  });
}

async function resolveAttackWithAbility(input: {
  ability: Ability;
  attackerPosition: Position;
  targetPosition: Position;
}): Promise<{ state: CombatState; attackMessage: string }> {
  const attacker = createCombatant('attacker', 'player', input.attackerPosition);
  const target = createCombatant('target', 'enemy', input.targetPosition);
  const mapData = createTerraceMap();
  const initialState = createMockCombatState({
    characters: [attacker, target],
    mapData,
    activeLightSources: [],
    combatLog: [],
  });
  const commands = AbilityCommandFactory.createCommands(
    input.ability,
    attacker,
    [target],
    createMockGameState(),
    undefined,
    undefined,
    { attackRollRng: FIXED_D20_RNG, damageRng: FIXED_DAMAGE_RNG },
  );
  const state = await commands[0].execute(initialState);
  const attackMessage = state.combatLog.find(entry => entry.type === 'action')?.message ?? '';
  return { state, attackMessage };
}

describe('AbilityCommandFactory high ground consumption', () => {
  it('grants Advantage to a melee attacker one band above the target', async () => {
    // Attacker on the lower floor edge, target up on the terrace.
    const receipt = await resolveAttackWithAbility({
      ability: MELEE_SWING,
      attackerPosition: { x: 7, y: 5 },
      targetPosition: { x: 8, y: 5 },
    });

    expect(receipt.attackMessage).toContain('(with Disadvantage)');
    expect(receipt.attackMessage).not.toContain('(with Advantage)');
  });

  it('grants Advantage when the terrace attacker strikes downhill at the same face', async () => {
    const receipt = await resolveAttackWithAbility({
      ability: MELEE_SWING,
      attackerPosition: { x: 8, y: 5 },
      targetPosition: { x: 7, y: 5 },
    });

    expect(receipt.attackMessage).toContain('(with Advantage)');
    expect(receipt.attackMessage).not.toContain('(with Disadvantage)');
  });

  it('adds nothing on level ground between equally placed melee fighters', async () => {
    const receipt = await resolveAttackWithAbility({
      ability: MELEE_SWING,
      attackerPosition: { x: 6, y: 5 },
      targetPosition: { x: 7, y: 5 },
    });

    expect(receipt.attackMessage).not.toContain('(with Advantage)');
    expect(receipt.attackMessage).not.toContain('(with Disadvantage)');
  });

  it('keeps ranged attacks outside the high-ground rule', async () => {
    const receipt = await resolveAttackWithAbility({
      ability: FIRE_BOLT,
      attackerPosition: { x: 6, y: 5 },
      targetPosition: { x: 9, y: 5 },
    });

    expect(receipt.attackMessage).not.toContain('(with Advantage)');
  });
});