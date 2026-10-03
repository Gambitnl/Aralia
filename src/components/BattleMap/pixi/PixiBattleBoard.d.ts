/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 18/07/2026, 18:36:02
 * Dependents: components/BattleMap/pixi/PixiBoardPrototype.tsx
 * Imports: 6 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
/**
 * @file PixiBattleBoard.tsx
 * Deliverable-1 prototype of the single-scene combat renderer (next-gen
 * combat map spec, Pillar 1). Renders ground + tokens + fog in one PixiJS v8
 * scene, WebGPU-first. Display only: no clicks, no targeting — the DOM board
 * remains the playable surface until the migration flips.
 */
import React from 'react';
import type { BattleMapData, CombatCharacter, LightLevel } from '../../../types/combat';
export interface PixiBattleBoardProps {
    mapData: BattleMapData;
    characters: CombatCharacter[];
    visibleTiles: Set<string>;
    getLightLevel: (tileId: string) => LightLevel;
    currentCharacterId: string | null;
    selectedCharacterId: string | null;
}
declare const PixiBattleBoard: React.FC<PixiBattleBoardProps>;
export default PixiBattleBoard;
