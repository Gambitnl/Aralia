/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 02/07/2026, 03:42:06
 * Dependents: components/BattleMap/BattleMap.tsx, components/BattleMap/BattleMap3D.tsx
 * Imports: 3 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
import { CombatState, LightLevel } from '../../types/combat';
interface UseVisibilityProps {
    combatState: CombatState;
    activeCharacterId?: string | null;
    viewerId?: string;
}
interface UseVisibilityResult {
    lightLevels: Map<string, LightLevel>;
    visibleTiles: Set<string>;
    canSeeTile: (tileId: string) => boolean;
    getLightLevel: (tileId: string) => LightLevel;
}
export declare const useVisibility: ({ combatState, activeCharacterId, viewerId }: UseVisibilityProps) => UseVisibilityResult;
export {};
