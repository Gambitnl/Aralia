/**
 * @file GroundMist.tsx
 * Low-hanging animated mist layers for moody biomes (GOAL #56).
 *
 * A few large translucent planes hover just above ground level with scrolling
 * FBM alpha. Because the planes are flat and depth-tested against the terrain
 * heightfield, mist naturally pools in hollows while hills and props rise
 * clear of it — the classic "ground fog" read without volumetrics.
 *
 * Per-biome character: swamp = thick low murk, forest = faint morning haze,
 * cave/dungeon = subtle cold floor vapor, desert = none (heat, not moisture).
 */
import React from 'react';
import { BattleMapData } from '../../../types/combat';
interface GroundMistProps {
    mapData: BattleMapData;
}
declare const GroundMist: React.FC<GroundMistProps>;
export default GroundMist;
