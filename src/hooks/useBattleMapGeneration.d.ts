/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 16/07/2026, 08:58:08
 * Dependents: components/BattleMap/BattleMapDemo.tsx, components/Combat/CombatView.tsx
 * Imports: 4 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
/**
 * @file hooks/useBattleMapGeneration.ts
 * Utility logic for battle-map setup generation.
 * The filename is still hook-shaped for caller stability, but this module is
 * a plain stateless helper. Keep callers pointed here until a coordinated
 * rename can update every use site together.
 */
import { BattleMapBiome, BattleMapData, CombatCharacter } from "../types/combat";
export interface BattleSetup {
    mapData: BattleMapData;
    positionedCharacters: CombatCharacter[];
}
/**
 * Production setup contract: callers must provide the tactical projection of
 * a real WorldForge location. There is no optional map and no arena fallback.
 */
export declare const generateWorldBattleSetup: (mapData: BattleMapData, seed: number, initialCharacters: CombatCharacter[]) => BattleSetup;
/**
 * Explicit developer-only arena generator used by BattleMapDemo and QA deep
 * links. Keeping construction behind this name makes accidental production
 * fallback visible in code review and dependency searches.
 */
export declare const generateProceduralSandboxBattleSetup: (biome: BattleMapBiome, seed: number, initialCharacters: CombatCharacter[]) => BattleSetup;
