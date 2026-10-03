/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 16/07/2026, 13:31:28
 * Dependents: components/BattleMap/BattleMapDemo.tsx, components/Combat/CombatView.tsx
 * Imports: 2 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
/**
 * @file BattlefieldSourceGap.tsx
 * A fail-closed combat state for encounters that have no tactical projection
 * of their real WorldForge location.
 *
 * Production must never hide this gap by decorating a disconnected arena.
 * The explicit developer sandbox remains available through BattleMapDemo and
 * its dedicated deep link, while this screen lets players safely return to the
 * world without starting turns on invented terrain.
 */
import React from 'react';
import type { BattlefieldSourceGapReason } from '../../types/actions';
export interface BattlefieldSourceGapProps {
    /** Structured caller evidence for a known unsupported production path. */
    sourceGap?: BattlefieldSourceGapReason;
    /** Human-readable caller context; never substitute guessed terrain here. */
    detail?: string;
    /** Leaves the withheld encounter without resolving it as victory or defeat. */
    onReturn: () => void;
}
/** Visible evidence that the production source boundary withheld combat. */
export declare const BattlefieldSourceGap: React.FC<BattlefieldSourceGapProps>;
export default BattlefieldSourceGap;
