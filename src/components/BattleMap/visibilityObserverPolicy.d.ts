/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 01/06/2026, 18:40:55
 * Dependents: components/BattleMap/BattleMap.tsx, components/BattleMap/BattleMap3D.tsx
 * Imports: 1 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
import type { CombatCharacter } from '../../types/combat';
/**
 * This file names the current tactical-visibility viewpoint rule for the combat map.
 *
 * Light, darkness, and hidden-tile presentation needs to be identical in the 2D
 * and 3D maps. This helper keeps the current fallback order in one place so
 * future player-view, party-view, and developer/spectator decisions can change
 * the policy without letting the two renderers drift apart.
 *
 * Called by: BattleMap.tsx and BattleMap3D.tsx.
 * Depends on: combat characters, the selected map character, and the current turn.
 */
export interface VisibilityObserverPolicyInput {
    selectedCharacterId?: string | null;
    currentCharacterId?: string | null;
    characters: CombatCharacter[];
}
export interface SharedSensesObserverState {
    controllerId: string;
    controllerName: string;
    observerId: string;
    observerName: string;
    sourceName: string;
}
export interface VisibilityObserverSelection {
    observerId: string | null;
    sharedSenses: SharedSensesObserverState | null;
}
export declare function selectVisibilityObserver({ selectedCharacterId, currentCharacterId, characters }: VisibilityObserverPolicyInput): VisibilityObserverSelection;
export declare function selectVisibilityObserverId(input: VisibilityObserverPolicyInput): string | null;
