/**
 * This file proves the shared placement and ownership rules for controlled summons.
 *
 * The cases cover exact occupied-space rejection, the authored ninety-foot boundary,
 * blocked terrain, and owner-plus-spell cleanup identity. These checks protect the
 * production helper used by both SummoningCommand and the Tactical Sandbox controls.
 *
 * Covers: summonControlledResolution.
 */

// ============================================================================
// Test Fixtures
// ============================================================================
// The map is deliberately wider than the default sandbox so the exact 90/95-foot
// boundary can be checked horizontally without a diagonal-distance assumption.
// ============================================================================

import { describe, expect, it } from 'vitest';
import type { BattleMapData, BattleMapTile } from '../../../types/combat';
import { createMockCombatCharacter } from '../../../utils/core';
import {
  getExactOwnedSummons,
  resolveSummonPlacement,
} from '../summonControlledResolution';

function createMap(): BattleMapData {
  const tiles = new Map<string, BattleMapTile>();
  for (let y = 0; y < 12; y += 1) {
    for (let x = 0; x < 24; x += 1) {
      tiles.set(`${x}-${y}`, {
        id: `${x}-${y}`,
        coordinates: { x, y },
        terrain: 'floor',
        elevation: 0,
        movementCost: 5,
        blocksLoS: false,
        blocksMovement: false,
        decoration: null,
        effects: [],
      });
    }
  }
  return { dimensions: { width: 24, height: 12 }, tiles, theme: 'dungeon' };
}

describe('summonControlledResolution', () => {
  it('allows the exact 90-foot edge and rejects the next 5-foot square', () => {
    const caster = createMockCombatCharacter({
      id: 'owner',
      name: 'Druid',
      position: { x: 2, y: 6 },
    });
    const mapData = createMap();

    expect(resolveSummonPlacement({
      caster,
      destination: { x: 20, y: 6 },
      characters: [caster],
      mapData,
      rangeFeet: 90,
      requireLineOfSight: true,
    })).toEqual({ status: 'allowed', distanceFeet: 90 });

    expect(resolveSummonPlacement({
      caster,
      destination: { x: 21, y: 6 },
      characters: [caster],
      mapData,
      rangeFeet: 90,
      requireLineOfSight: true,
    })).toMatchObject({ status: 'rejected', reason: 'out_of_range', distanceFeet: 95 });
  });

  it('rejects the chosen square when any living footprint or terrain blocks it', () => {
    const caster = createMockCombatCharacter({ id: 'owner', position: { x: 2, y: 6 } });
    const blocker = createMockCombatCharacter({
      id: 'blocker',
      name: 'Blocking Guard',
      position: { x: 6, y: 6 },
      size: 'Large',
    });
    const mapData = createMap();

    expect(resolveSummonPlacement({
      caster,
      destination: { x: 6, y: 6 },
      characters: [caster, blocker],
      mapData,
      rangeFeet: 90,
    })).toMatchObject({ status: 'rejected', reason: 'occupied' });

    const blockedTiles = new Map(mapData.tiles);
    blockedTiles.set('7-6', { ...blockedTiles.get('7-6')!, blocksMovement: true, terrain: 'wall' });
    expect(resolveSummonPlacement({
      caster,
      destination: { x: 7, y: 6 },
      characters: [caster],
      mapData: { ...mapData, tiles: blockedTiles },
      rangeFeet: 90,
    })).toMatchObject({ status: 'rejected', reason: 'blocked' });
  });

  it('selects only summons owned by the exact caster and spell source', () => {
    const owned = createMockCombatCharacter({
      id: 'owned',
      isSummon: true,
      summonMetadata: { casterId: 'owner', spellId: 'summon-beast' },
    });
    const otherOwner = createMockCombatCharacter({
      id: 'other-owner',
      isSummon: true,
      summonMetadata: { casterId: 'rival', spellId: 'summon-beast' },
    });
    const otherSpell = createMockCombatCharacter({
      id: 'other-spell',
      isSummon: true,
      summonMetadata: { casterId: 'owner', spellId: 'find-familiar' },
    });

    expect(getExactOwnedSummons([owned, otherOwner, otherSpell], 'owner', 'summon-beast'))
      .toEqual([owned]);
  });
});
