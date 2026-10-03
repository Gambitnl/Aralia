/**
 * @file battlefieldEscape.test.ts — pins the edge-of-map escape referee (9B).
 *
 * These tests are the contract between the UI (which decides whether to draw an
 * Escape button) and the turn manager (which decides whether the escape may
 * resolve). Both call the same function, so a disagreement between them is
 * impossible as long as these pass.
 */
import { describe, it, expect } from 'vitest';
import type { BattleMapData, CombatCharacter } from '../../../../types/combat';
import {
  applyEscapeMovementCost,
  distanceToBoundary,
  evaluateEscape,
  getBattlefieldBoundary,
  isAtBattlefieldEdge,
} from '../battlefieldEscape';

function makeMap(width = 40, height = 30): BattleMapData {
  return {
    dimensions: { width, height },
    tiles: new Map(),
    theme: 'forest',
    seed: 1,
  } as unknown as BattleMapData;
}

function makeCharacter(overrides: Partial<CombatCharacter> = {}): CombatCharacter {
  return {
    id: 'hero',
    name: 'Hero',
    team: 'player',
    currentHP: 12,
    maxHP: 12,
    position: { x: 20, y: 15 },
    actionEconomy: {
      action: { used: false, remaining: 1 },
      bonusAction: { used: false, remaining: 1 },
      reaction: { used: false, remaining: 1 },
      legendary: { used: 0, total: 0 },
      movement: { used: 0, total: 30 },
      freeActions: 0,
    },
    ...overrides,
  } as unknown as CombatCharacter;
}

describe('battlefield boundary', () => {
  it('derives an inclusive rectangle from the map dimensions', () => {
    expect(getBattlefieldBoundary(makeMap(40, 30))).toEqual({
      minX: 0, minY: 0, maxX: 39, maxY: 29,
    });
  });

  it('measures Chebyshev distance to the nearest edge', () => {
    const boundary = getBattlefieldBoundary(makeMap(40, 30));
    expect(distanceToBoundary(boundary, { x: 0, y: 15 })).toBe(0);
    expect(distanceToBoundary(boundary, { x: 39, y: 15 })).toBe(0);
    expect(distanceToBoundary(boundary, { x: 20, y: 29 })).toBe(0);
    expect(distanceToBoundary(boundary, { x: 20, y: 15 })).toBe(14);
  });

  it('clamps a position pushed outside the rectangle to zero rather than negative', () => {
    const boundary = getBattlefieldBoundary(makeMap(40, 30));
    expect(distanceToBoundary(boundary, { x: -3, y: 15 })).toBe(0);
  });

  it('treats only the outermost ring as the edge by default', () => {
    const map = makeMap(40, 30);
    expect(isAtBattlefieldEdge(map, { x: 0, y: 10 })).toBe(true);
    expect(isAtBattlefieldEdge(map, { x: 1, y: 10 })).toBe(false);
    expect(isAtBattlefieldEdge(map, { x: 1, y: 10 }, 2)).toBe(true);
  });
});

describe('evaluateEscape', () => {
  it('offers the escape at the rim with a full movement action', () => {
    const verdict = evaluateEscape({
      mapData: makeMap(),
      character: makeCharacter({ position: { x: 0, y: 12 } }),
    });
    expect(verdict.available).toBe(true);
    expect(verdict.tilesFromEdge).toBe(0);
    // Escaping costs the whole movement action, not the distance to the rim.
    expect(verdict.movementCostFeet).toBe(30);
    expect(verdict.contested).toBe(false);
  });

  it('refuses in the middle of the battlefield and reports the distance', () => {
    const verdict = evaluateEscape({
      mapData: makeMap(),
      character: makeCharacter({ position: { x: 20, y: 15 } }),
    });
    expect(verdict.available).toBe(false);
    expect(verdict.code).toBe('not-at-edge');
    expect(verdict.tilesFromEdge).toBe(14);
  });

  it('still allows the escape on the turn the character walked to the rim', () => {
    // The reachable case: getting to the edge costs movement, so a rule that
    // demanded a completely fresh allowance would make escape almost unusable.
    const character = makeCharacter({ position: { x: 0, y: 12 } });
    character.actionEconomy.movement.used = 25;
    const verdict = evaluateEscape({ mapData: makeMap(), character });
    expect(verdict.available).toBe(true);
    // Only what is LEFT is forfeited.
    expect(verdict.movementCostFeet).toBe(5);
  });

  it('refuses once every foot of movement is already spent', () => {
    const character = makeCharacter({ position: { x: 0, y: 12 } });
    character.actionEconomy.movement.used = 30;
    const verdict = evaluateEscape({ mapData: makeMap(), character });
    expect(verdict.available).toBe(false);
    expect(verdict.code).toBe('movement-already-spent');
  });

  it('refuses a downed combatant even at the rim', () => {
    const verdict = evaluateEscape({
      mapData: makeMap(),
      character: makeCharacter({ position: { x: 0, y: 12 }, currentHP: 0 }),
    });
    expect(verdict.available).toBe(false);
    expect(verdict.code).toBe('downed');
  });

  it('refuses a combatant with no movement speed', () => {
    const character = makeCharacter({ position: { x: 0, y: 12 } });
    character.actionEconomy.movement.total = 0;
    const verdict = evaluateEscape({ mapData: makeMap(), character });
    expect(verdict.available).toBe(false);
    expect(verdict.code).toBe('no-movement');
  });

  it('fails closed on a mapless encounter', () => {
    const verdict = evaluateEscape({ mapData: null, character: makeCharacter() });
    expect(verdict.available).toBe(false);
    expect(verdict.code).toBe('no-map');
    expect(verdict.tilesFromEdge).toBeNull();
  });
});

describe('applyEscapeMovementCost', () => {
  it('spends the entire movement allowance and leaves action and bonus action intact', () => {
    const spent = applyEscapeMovementCost(makeCharacter());
    expect(spent.actionEconomy.movement).toEqual({ used: 30, total: 30 });
    expect(spent.actionEconomy.action.used).toBe(false);
    expect(spent.actionEconomy.bonusAction.used).toBe(false);
  });

  it('does not mutate the input character', () => {
    const character = makeCharacter();
    applyEscapeMovementCost(character);
    expect(character.actionEconomy.movement.used).toBe(0);
  });
});
