import { describe, expect, it } from 'vitest';
import { AbilityCommandFactory } from '../AbilityCommandFactory';
import { VisibilitySystem } from '@/systems/visibility';
import type {
  Ability,
  BattleMapData,
  BattleMapTile,
  CombatCharacter,
  CombatState,
  LightSource,
  Position,
} from '@/types/combat';
import { createMockCombatCharacter, createMockCombatState, createMockGameState } from '@/utils/core';

/**
 * This file proves that production attack rolls consume production visibility.
 *
 * The fixture varies exactly one sense, distance, light, or wall at a time.
 * It first checks VisibilitySystem's target tier, then executes the ordinary
 * AbilityCommandFactory attack command and audits the resulting combat log.
 * No scenario-only modifier is involved in either answer.
 *
 * Covers: AbilityCommandFactory.ts and VisibilitySystem.ts.
 */

// ============================================================================
// Deterministic Dark Cave Fixture
// ============================================================================
// One grid cell is five feet. A fixed d20 source makes both normal and
// Disadvantage rolls reproducible while leaving the production roller intact.
// ============================================================================

const OBSERVER_POSITION: Position = { x: 2, y: 5 };
const FIXED_D20_RNG = (): number => (12 - 0.5) / 20;
const FIXED_DAMAGE_RNG = (): number => 0.5;

const FIRE_BOLT: Ability = {
  id: 'visibility-fire-bolt',
  name: 'Visibility Fire Bolt',
  description: 'A deterministic ranged spell attack for visibility proof.',
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
    elevation: 0,
    movementCost: 5,
    blocksLoS: false,
    blocksMovement: false,
    decoration: null,
    effects: [],
  };
}

function createCaveMap(blocker?: Position): BattleMapData {
  const tiles = new Map<string, BattleMapTile>();
  for (let y = 0; y < 12; y += 1) {
    for (let x = 0; x < 16; x += 1) {
      const tile = createFloorTile(x, y);
      if (blocker && x === blocker.x && y === blocker.y) {
        tile.terrain = 'wall';
        tile.blocksLoS = true;
        tile.blocksMovement = true;
      }
      tiles.set(tile.id, tile);
    }
  }
  return {
    dimensions: { width: 16, height: 12 },
    tiles,
    theme: 'cave',
    seed: 102,
  };
}

function createObserver(senses: NonNullable<CombatCharacter['stats']['senses']>): CombatCharacter {
  return createMockCombatCharacter({
    id: 'observer',
    name: 'Observer',
    team: 'player',
    position: { ...OBSERVER_POSITION },
    stats: {
      ...createMockCombatCharacter().stats,
      senses,
    },
  });
}

function createTarget(position: Position): CombatCharacter {
  return createMockCombatCharacter({
    id: 'target',
    name: 'Target',
    team: 'enemy',
    position: { ...position },
    armorClass: 12,
    baseAC: 12,
    currentHP: 40,
    maxHP: 40,
  });
}

async function resolveAttack(input: {
  senses: NonNullable<CombatCharacter['stats']['senses']>;
  targetPosition: Position;
  lights?: LightSource[];
  blocker?: Position;
}): Promise<{ state: CombatState; visibility: string; attackMessage: string }> {
  const observer = createObserver(input.senses);
  const target = createTarget(input.targetPosition);
  const mapData = createCaveMap(input.blocker);
  const activeLightSources = input.lights ?? [];
  const lightLevels = VisibilitySystem.calculateLightLevels(mapData, activeLightSources);
  const visibility = VisibilitySystem.calculateVisibility(observer, mapData, lightLevels)
    .get(`${target.position.x}-${target.position.y}`) ?? 'hidden';
  const initialState = createMockCombatState({
    characters: [observer, target],
    mapData,
    activeLightSources,
    combatLog: [],
  });
  const commands = AbilityCommandFactory.createCommands(
    FIRE_BOLT,
    observer,
    [target],
    createMockGameState(),
    undefined,
    undefined,
    { attackRollRng: FIXED_D20_RNG, damageRng: FIXED_DAMAGE_RNG },
  );
  const state = await commands[0].execute(initialState);
  const attackMessage = state.combatLog.find(entry => entry.type === 'action')?.message ?? '';
  return { state, visibility, attackMessage };
}

// ============================================================================
// Visibility-to-Attack Contract
// ============================================================================

describe('AbilityCommandFactory production visibility', () => {
  const normalSenses = { darkvision: 0, blindsight: 0, tremorsense: 0, truesight: 0 };

  it.each([
    ['normal vision at 60 ft', normalSenses, { x: 14, y: 5 }, 'hidden', true],
    ['Darkvision at 60 ft', { ...normalSenses, darkvision: 60 }, { x: 14, y: 5 }, 'dim', false],
    ['Darkvision at 65 ft', { ...normalSenses, darkvision: 60 }, { x: 15, y: 5 }, 'hidden', true],
    ['Blindsight at 30 ft', { ...normalSenses, blindsight: 30 }, { x: 8, y: 5 }, 'visible', false],
    ['Blindsight at 35 ft', { ...normalSenses, blindsight: 30 }, { x: 9, y: 5 }, 'hidden', true],
  ])('%s maps the production visibility tier to the attack roll', async (
    _label,
    senses,
    targetPosition,
    expectedVisibility,
    expectsDisadvantage,
  ) => {
    const receipt = await resolveAttack({ senses, targetPosition });

    expect(receipt.visibility).toBe(expectedVisibility);
    expect(receipt.attackMessage.includes('with Disadvantage')).toBe(expectsDisadvantage);
  });

  it('lets real target light remove darkness Disadvantage for normal vision', async () => {
    const targetPosition = { x: 14, y: 5 };
    const receipt = await resolveAttack({
      senses: normalSenses,
      targetPosition,
      lights: [{
        id: 'target-lantern',
        sourceSpellId: 'light',
        casterId: 'observer',
        attachedTo: 'point',
        position: targetPosition,
        brightRadius: 15,
        dimRadius: 15,
        createdTurn: 0,
      }],
    });

    expect(receipt.visibility).toBe('visible');
    expect(receipt.attackMessage).not.toContain('with Disadvantage');
  });

  it('does not let Blindsight see through a production sight blocker', async () => {
    const receipt = await resolveAttack({
      senses: { ...normalSenses, blindsight: 30 },
      targetPosition: { x: 8, y: 5 },
      blocker: { x: 6, y: 5 },
    });

    expect(receipt.visibility).toBe('hidden');
    expect(receipt.attackMessage).toContain('with Disadvantage');
  });
});
