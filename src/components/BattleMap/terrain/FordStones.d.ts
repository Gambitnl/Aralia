/**
 * @file FordStones.tsx
 * Stepping stones along the upstream edge of a ford crossing — the 3D twin of
 * the 2D painter's stone line. Placement mirrors the painter's rules exactly:
 * single file on the upstream side, irregular sizes, drunk spacing, ~1 in 5
 * missing, occasional doubled stone. Stones sit on the shallow ford bed and
 * poke just above the water film so a walker can read the dry path.
 *
 * Source-fact discipline: geometry derives ONLY from the tile grid's ford
 * crossing receipt (roadDirection, world-meter center, span/width) — the same
 * receipt the referee and the 2D painter consume. No invented placement.
 */
import React from 'react';
import type { BattleMapData } from '../../../types/combat';
declare const FordStones: React.FC<{
    mapData: BattleMapData;
}>;
export default FordStones;
