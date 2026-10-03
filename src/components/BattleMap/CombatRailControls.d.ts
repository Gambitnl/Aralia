/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 11/07/2026, 19:13:14
 * Dependents: components/BattleMap/BattleMapDemo.tsx, components/Combat/CombatView.tsx
 * Imports: None
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
/**
 * This file provides the two compact controls that show or hide the combat roster
 * and command rails. Both the real combat screen and the design-preview sandbox use
 * it so a player can temporarily give the battlefield more room without losing the
 * surrounding combat tools or creating two different layout conventions.
 *
 * Called by: BattleMapDemo.tsx and CombatView.tsx
 * Depends on: lucide-react for familiar panel icons
 */
import React from 'react';
interface CombatRailControlsProps {
    rosterVisible: boolean;
    commandVisible: boolean;
    onToggleRoster: () => void;
    onToggleCommand: () => void;
    onResetLayout: () => void;
    layoutIsDefault: boolean;
}
declare const CombatRailControls: React.FC<CombatRailControlsProps>;
export default CombatRailControls;
