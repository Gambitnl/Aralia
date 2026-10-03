/**
 * This file proves an attempted edge step becomes one canonical fall event.
 *
 * The G14 voluntary-descent bridge derives its drop from map altitudes alone,
 * so a walker cannot inflate damage, and ordinary step-downs never enter the
 * falling transaction at all.
 *
 * Exercises: fallingGroundImpactResolution.ts resolveVoluntaryDescentImpact.
 * Depends on: production battle-map records and mock combat characters.
 */

import { describe, expect, it } from 'vitest';
import type { BattleMapData, BattleMapTile, CombatCharacter } from '../../../types/combat';
import { createMockCombatCharacter } from '../../../utils/core';
import { resolveVoluntaryDescentImpact } from '../fallingGroundImpactResolution';

// ============================================================================
// Cliff Ledge Fixture
// ============================================================================
// One grid cell is five feet. The plateau at x>=3 stands fifteen feet above
// the lower ground, exactly like the pathfinding referee fixtures.
// ============================================================================

function createCliffLedgeMap(): BattleMapData {
  const tiles = new Map<string, BattleMapTile>();
  for (let x = 0; x < 8; x += 1) {
    for (let y = 0; y < 4; y += 1) {
      const id = `${x}-${y}`;
      tiles.set(id, {
        id,
        coordinates: { x, y },
        terrain: 'grass',
        elevation: x >= 3 ? 15 : 0,
        movementCost: 5,
        blocksLoS: false,
        blocksMovement: false,
        decoration: null,
        effects: [],
      });
    }
  }
  return { dimensions: { width: 8, height: 4 }, tiles, theme: 'forest', seed: 7 };
}

function createWalker(id: string, position: { x: number; y: number }): CombatCharacter {
  return createMockCombatCharacter({
    id,
    name: 'Edge Walker',
    team: 'player',
    position: { ...position },
    armorClass: 12,
    baseAC: 12,
    currentHP: 40,
    maxHP: 40,
  });
}

const FIXED_DAMAGE_RNG = (): number => 0.5;

describe('resolveVoluntaryDescentImpact', () => {
  it('routes an edge step off the plateau through the canonical fall transaction', () => {
    const mapData = createCliffLedgeMap();
    const walker = createWalker('walker-top', { x: 3, y: 1 });
    const bystander = createWalker('bystander', { x: 1, y: 1 });

    const result = resolveVoluntaryDescentImpact({
      eventId: 'voluntary-descent-proof',
      character: walker,
      sourcePosition: { x: 3, y: 1 },
      landingPosition: { x: 2, y: 1 },
      mapData,
      characters: [walker, bystander],
      damageRng: FIXED_DAMAGE_RNG,
    });

    expect(result.status).toBe('resolved');
    expect(result.fallDistanceFeet).toBe(15);
    expect(result.faller?.currentHP).toBeLessThan(40);
    expect(result.hpDamage).toBeGreaterThan(0);
    expect(result.proneApplied).toBe(true);
    // Only the faller changes; the roster copy keeps everyone else intact.
    expect(result.characters.find(c => c.id === 'bystander')).toMatchObject({ currentHP: 40 });
  });

  it('rejects an ascent disguised as a descent without touching anyone', () => {
    const mapData = createCliffLedgeMap();
    const walker = createWalker('walker-low', { x: 2, y: 1 });

    const result = resolveVoluntaryDescentImpact({
      eventId: 'voluntary-descent-uphill',
      character: walker,
      sourcePosition: { x: 2, y: 1 },
      landingPosition: { x: 3, y: 1 },
      mapData,
      characters: [walker],
    });

    expect(result.status).toBe('rejected');
    expect(result.hpDamage).toBe(0);
    expect(result.characters[0].currentHP).toBe(40);
  });

  it('leaves ordinary slope step-downs to pathfinding instead of falling', () => {
    const mapData = createCliffLedgeMap();
    // Lower the landing band to ten feet so the edge is a legal slope drop.
    mapData.tiles.get('3-1')!.elevation = 10;
    const walker = createWalker('walker-slope', { x: 3, y: 1 });

    const result = resolveVoluntaryDescentImpact({
      eventId: 'voluntary-descent-slope',
      character: walker,
      sourcePosition: { x: 3, y: 1 },
      landingPosition: { x: 2, y: 1 },
      mapData,
      characters: [walker],
    });

    expect(result.status).toBe('repeat');
    expect(result.reason).toContain('ordinary walking');
    expect(result.characters[0].currentHP).toBe(40);
  });
});