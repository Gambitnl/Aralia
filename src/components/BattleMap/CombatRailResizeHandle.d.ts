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
 * This file provides the thin desktop grabber between the battlefield and a
 * combat side rail. It supports pointer dragging, arrow keys, Home/End bounds,
 * and double-click reset so resizing is available to mouse and keyboard
 * users without adding permanent visual weight to the tactical screen.
 *
 * Called by: BattleMapDemo.tsx and CombatView.tsx
 * Depends on: the parent combat layout hook for the saved width
 */
import React from 'react';
interface CombatRailResizeHandleProps {
    side: 'roster' | 'command';
    value: number;
    minimum: number;
    maximum: number;
    onChange: (value: number) => void;
    onReset: () => void;
}
declare const CombatRailResizeHandle: React.FC<CombatRailResizeHandleProps>;
export default CombatRailResizeHandle;
