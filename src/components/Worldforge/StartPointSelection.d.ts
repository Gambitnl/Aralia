/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 21/07/2026, 14:16:43
 * Dependents: App.tsx, components/DesignPreview/steps/PreviewStartSelect.tsx
 * Imports: 5 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
/**
 * @file StartPointSelection.tsx — "where will your journey begin?" step.
 *
 * Shown after character creation and before play starts. The player surveys the
 * generated world and chooses a *town* to begin in — the design constraint is
 * that a new game always starts inside a settlement, never open wilderness or
 * (the old bug) an ocean tile. Towns come from the real WF/FMG world
 * (`listSelectableTowns`), grouped by country/region, and the chosen town's
 * `burg.cell` is handed to `applyWfSpawnToMap` so the spawn is exactly where the
 * player pointed.
 *
 * The atlas (left) gives geographic context with a marker on the selected town;
 * clicking the map snaps to the nearest town. The panel (right) lets the player
 * narrow by region and pick a specific town, then confirm.
 *
 * `window.__startSelect` exposes `towns()`, `select(burgIndex)`, `selected()`,
 * and `confirm()` for headless verification.
 */
import React from 'react';
import { type SelectableTown } from '../../systems/worldforge/local/startTowns';
export interface StartPointSelectionProps {
    /** Seed of the world the player will begin in (same seed play uses). */
    worldSeed: number;
    /** Called with the chosen town when the player confirms their start. */
    onConfirm: (town: SelectableTown) => void;
    /** Optional: return to character creation / main menu. */
    onBack?: () => void;
    /** Optional hero name for the heading. */
    characterName?: string;
}
declare const StartPointSelection: React.FC<StartPointSelectionProps>;
export default StartPointSelection;
