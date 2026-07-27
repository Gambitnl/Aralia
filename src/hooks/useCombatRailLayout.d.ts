/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 11/07/2026, 19:13:14
 * Dependents: components/BattleMap/BattleMapDemo.tsx, components/Combat/CombatView.tsx
 * Imports: 1 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
/**
 * This file remembers which combat side rails the player wants visible.
 * First-time players see both rails, while returning players recover the last
 * roster and command layout they deliberately chose. The design preview and
 * playable combat screen share this hook so the same controls behave the same
 * way in both places.
 *
 * Called by: BattleMapDemo.tsx and CombatView.tsx
 * Depends on: useLocalStorage for guarded, schema-validated browser storage
 */
import { type CSSProperties, type SetStateAction } from 'react';
export declare const COMBAT_RAIL_LAYOUT_STORAGE_KEY = "aralia-combat-rail-layout-v1";
export declare const COMBAT_ROSTER_WIDTH_MIN = 180;
export declare const COMBAT_ROSTER_WIDTH_DEFAULT = 230;
export declare const COMBAT_ROSTER_WIDTH_MAX = 360;
export declare const COMBAT_COMMAND_WIDTH_MIN = 250;
export declare const COMBAT_COMMAND_WIDTH_DEFAULT = 300;
export declare const COMBAT_COMMAND_WIDTH_MAX = 440;
interface CombatRailLayout {
    rosterVisible: boolean;
    commandVisible: boolean;
    rosterWidth: number;
    commandWidth: number;
}
export interface CombatRailGridStyle extends CSSProperties {
    '--combat-roster-width': string;
    '--combat-command-width': string;
}
export declare const createCombatRailGridStyle: (rosterWidth: number, commandWidth: number) => CombatRailGridStyle;
interface UseCombatRailLayoutResult extends CombatRailLayout {
    setRosterVisible: (value: SetStateAction<boolean>) => void;
    setCommandVisible: (value: SetStateAction<boolean>) => void;
    setRosterWidth: (value: SetStateAction<number>) => void;
    setCommandWidth: (value: SetStateAction<number>) => void;
    resetLayout: () => void;
    layoutIsDefault: boolean;
}
export declare const useCombatRailLayout: () => UseCombatRailLayoutResult;
export {};
