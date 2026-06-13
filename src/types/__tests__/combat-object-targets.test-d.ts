import { expectAssignable } from 'tsd';

import type { BattleMapData, TargetableMapObject } from '../combat';

/**
 * This type test protects the battle-map home for spell-targetable objects.
 *
 * Runtime object-targeting code can already consume explicit candidates, but
 * the live battle map also needs a typed slot where those positioned objects can
 * be stored without treating visual decorations as mechanics.
 */

const targetableObject: TargetableMapObject = {
  id: 'typed-crystal',
  name: 'Typed Crystal',
  position: { x: 2, y: 2 },
  size: 'Tiny',
  weightPounds: 1,
  isWornOrCarried: false,
  isMagical: true,
  isFixedToSurface: false
};

expectAssignable<BattleMapData>({
  dimensions: { width: 5, height: 5 },
  theme: 'dungeon',
  seed: 1,
  tiles: new Map(),
  targetableObjects: [targetableObject]
});

