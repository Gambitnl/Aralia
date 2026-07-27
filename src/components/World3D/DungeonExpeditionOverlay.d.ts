/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 21/07/2026, 01:49:02
 * Dependents: components/World3D/World3DWrapper.tsx
 * Imports: 7 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
/**
 * This file presents the generated dungeon reached from the live 3D world.
 *
 * It reuses the existing Dungeon3DPreview rather than creating a second interior renderer. The
 * surrounding expedition chrome identifies the canonical receipt and the exact world return
 * point, then gives the player one explicit route back. The shared preview now owns real floor-grid
 * movement, can secure deterministically identified authored treasure rooms, and can traverse a
 * three-page deterministic level stack generated from stable child seed paths. Each descent keeps
 * a parent return coordinate and writes compact visit evidence beside that page's isolated map ink.
 * The final page exposes the generated boss room as an objective. Inventory rewards, combat,
 * falling, pit rules, door actions, and automatic completion remain unsupported.
 *
 * Called by: World3DWrapper.tsx while a temporary dungeon entry is active.
 * Depends on: Dungeon3DPreview and the active entry receipt from dungeonEntryRuntime.ts.
 */
import React from 'react';
import type { ActiveDungeonEntry } from './dungeonEntryRuntime';
interface DungeonExpeditionOverlayProps {
    entry: ActiveDungeonEntry;
    onReturn: () => void;
}
/** Render one canonical dungeon and keep the originating world context visible in the chrome. */
declare const DungeonExpeditionOverlay: React.FC<DungeonExpeditionOverlayProps>;
export default DungeonExpeditionOverlay;
