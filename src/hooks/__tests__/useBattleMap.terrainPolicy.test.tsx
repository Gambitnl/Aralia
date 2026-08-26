import { renderHook, act } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { BattleMapData, BattleMapTerrain, BattleMapTile, CombatAction, CombatCharacter } from '../../types/combat';
import { createMockCombatCharacter } from '../../utils/core';

/**
 * This file proves the battle-map click path prices movement through the
 * mover's own terrain waiver.
 *
 * GG-257 / agora-db71.25: `handleTileClick` was the last unqualified caller. It
 * asked `findPath` and `calculatePathMovementCost` for a route with no policy
 * at all, so an Earth Genasi was charged the difficult-terrain surcharge on the
 * ground its trait waives. The qualifier matters in both directions: Earth Walk
 * covers ground and floors, so difficult WATER must still cost full price.
 *
 * Called by: focused Vitest hook tests.
 * Depends on: useBattleMap's movement hand-off and the real pathfinding and
 * movement-cost utilities. `useGridMovement` is stubbed so the assertion sees
 * only the cost this hook computes for the action it dispatches.
 */

const mockCalculatePath = vi.fn();
const mockClearMovementState = vi.fn();
let stubValidMoves = new Set<string>();

vi.mock('../combat/useGridMovement', () => ({
  useGridMovement: () => ({
    validMoves: stubValidMoves,
    activePath: [],
    calculatePath: mockCalculatePath,
    clearMovementState: mockClearMovementState,
  }),
}));

const { useBattleMap } = await import('../useBattleMap');

/** A single east-west corridor. Columns 1..3 are difficult, everything else is plain. */
function buildCorridor(difficultTerrain: BattleMapTerrain): BattleMapData {
  const tiles = new Map<string, BattleMapTile>();
  for (let x = 0; x <= 4; x += 1) {
    const isDifficult = x >= 1 && x <= 3;
    tiles.set(`${x}-0`, {
      id: `${x}-0`,
      coordinates: { x, y: 0 },
      terrain: isDifficult ? difficultTerrain : 'grass',
      elevation: 0,
      // 10 feet per 5-foot square is the generated map's difficult-terrain form.
      movementCost: isDifficult ? 10 : 5,
      blocksLoS: false,
      blocksMovement: false,
      decoration: null,
      effects: [],
    });
  }
  return {
    dimensions: { width: 5, height: 1 },
    tiles,
    theme: 'forest',
    seed: 1,
  } as unknown as BattleMapData;
}

/** Walks the hook's click path and returns the movement cost it charged. */
async function chargedMovementCost(
  mover: CombatCharacter,
  mapData: BattleMapData,
): Promise<number> {
  mockCalculatePath.mockReset();
  mockClearMovementState.mockReset();
  stubValidMoves = new Set(['4-0']);

  const executeAction = vi.fn().mockResolvedValue(true);
  const turnManager = {
    turnState: { currentCharacterId: mover.id },
    getCurrentCharacter: () => mover,
    executeAction,
  } as unknown as Parameters<typeof useBattleMap>[2];
  const abilitySystem = {
    targetingMode: null,
    selectedAbility: null,
    selectTarget: vi.fn(),
  } as unknown as Parameters<typeof useBattleMap>[3];

  const { result } = renderHook(() =>
    useBattleMap(mapData, [mover], turnManager, abilitySystem));

  await act(async () => {
    await result.current.handleTileClick(mapData.tiles.get('4-0')!);
  });

  expect(executeAction).toHaveBeenCalledTimes(1);
  const action = executeAction.mock.calls[0][0] as CombatAction;
  return action.cost.movementCost!;
}

const moverAt = (id: string, overrides: Partial<CombatCharacter> = {}): CombatCharacter => ({
  ...createMockCombatCharacter({ id, name: id, team: 'player' }),
  position: { x: 0, y: 0 },
  ...overrides,
});

describe('useBattleMap terrain policy on the click path', () => {
  it('charges an Earth Genasi full cost through difficult water', async () => {
    const genasi = moverAt('earth-genasi', { terrainPolicyId: 'earth-walk' } as Partial<CombatCharacter>);

    // Earth Walk names "the ground or a floor". Wading is neither, so all three
    // difficult squares keep their surcharge: 10 + 10 + 10 + 5.
    expect(await chargedMovementCost(genasi, buildCorridor('water'))).toBe(35);
  });

  it('waives the surcharge for that same Earth Genasi on difficult ground', async () => {
    const genasi = moverAt('earth-genasi', { terrainPolicyId: 'earth-walk' } as Partial<CombatCharacter>);

    // Rock is ground, so the four squares cost 5 feet each.
    expect(await chargedMovementCost(genasi, buildCorridor('rock'))).toBe(20);
  });

  it('charges a mover with no waiver full cost on the same difficult ground', async () => {
    const fighter = moverAt('fighter');

    expect(await chargedMovementCost(fighter, buildCorridor('rock'))).toBe(35);
  });
});
