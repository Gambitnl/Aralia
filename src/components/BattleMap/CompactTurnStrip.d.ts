/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 11/07/2026, 18:40:42
 * Dependents: components/BattleMap/BattleMapDemo.tsx, components/Combat/CombatView.tsx
 * Imports: 1 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
/**
 * This file keeps the minimum turn information beside the battlefield when the
 * full command rail is hidden. It prevents map-focus mode from concealing whose
 * turn it is, which actions remain, how much movement is left, or the End Turn
 * command. Both the playable combat screen and the design preview use the same
 * strip so collapsing a rail has one predictable meaning everywhere.
 *
 * Called by: BattleMapDemo.tsx and CombatView.tsx
 * Depends on: the active combat character and familiar lucide interface icons
 */
import React from 'react';
import { CombatCharacter } from '../../types/combat';
interface CompactTurnStripProps {
    character: CombatCharacter | null;
    isCharactersTurn: boolean;
    onEndTurn: () => void | Promise<void>;
    onRestoreCommands: () => void;
}
declare const CompactTurnStrip: React.FC<CompactTurnStripProps>;
export default CompactTurnStrip;
