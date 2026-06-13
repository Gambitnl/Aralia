import { describe, expect, it } from 'vitest';

import { buildSelectedSpellTargetsForPosition } from '../selectedSpellTargets';
import type { BattleMapData, CombatCharacter, TargetableMapObject } from '@/types/combat';

/**
 * This file protects the pure selected-target builder used by spell targeting.
 *
 * The live hook needs to turn a clicked map square into richer target refs
 * without guessing whether the square contains a creature, a spell-targetable
 * object, or just a ground point. These tests pin that split before UI wiring.
 */

const makeMap = (objects: TargetableMapObject[] = []): BattleMapData => ({
  dimensions: { width: 5, height: 5 },
  theme: 'dungeon',
  seed: 9,
  tiles: new Map(),
  targetableObjects: objects
});

const creature = {
  id: 'goblin',
  name: 'Goblin',
  position: { x: 1, y: 1 }
} as CombatCharacter;

const looseStone: TargetableMapObject = {
  id: 'loose-stone',
  name: 'Loose Stone',
  position: { x: 2, y: 1 },
  size: 'Tiny',
  weightPounds: 2,
  isWornOrCarried: false,
  isMagical: false,
  isFixedToSurface: false
};

describe('buildSelectedSpellTargetsForPosition', () => {
  it('returns creature refs before object refs when a creature occupies the clicked position', () => {
    const refs = buildSelectedSpellTargetsForPosition({
      position: creature.position,
      characters: [creature],
      mapData: makeMap([{ ...looseStone, position: creature.position }])
    });

    expect(refs).toEqual([{ kind: 'creature', id: 'goblin' }]);
  });

  it('returns object refs for targetable map objects without fabricating creature ids', () => {
    const refs = buildSelectedSpellTargetsForPosition({
      position: looseStone.position,
      characters: [creature],
      mapData: makeMap([looseStone])
    });

    expect(refs).toEqual([{
      kind: 'object',
      id: 'loose-stone',
      name: 'Loose Stone',
      position: { x: 2, y: 1 },
      object: looseStone
    }]);
  });

  it('returns a point ref when no creature or targetable object is present', () => {
    const refs = buildSelectedSpellTargetsForPosition({
      position: { x: 4, y: 4 },
      characters: [creature],
      mapData: makeMap(),
      pointPurpose: 'ground_target'
    });

    expect(refs).toEqual([{ kind: 'point', position: { x: 4, y: 4 }, purpose: 'ground_target' }]);
  });
});
