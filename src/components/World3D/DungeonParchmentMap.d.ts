/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 21/07/2026, 01:48:10
 * Dependents: components/World3D/DungeonExpeditionOverlay.tsx
 * Imports: 3 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
/**
 * This file renders the player's remembered dungeon as a parchment sheet.
 *
 * It receives the exact DungeonPlan already mounted by the 3D expedition and asks the shared map
 * model for explored cells, known doors, and discovered authored landmarks. Reached dungeon levels
 * become separate selectable pages, each backed by its own persisted exploration key. Stairs,
 * truthful height sightlines, and the deepest boss objective remain hidden until their real floor
 * cell is discovered. Search, pit traversal, combat, and completion rules remain separate lanes.
 *
 * Called by: DungeonExpeditionOverlay when the player chooses to unroll the map.
 * Depends on: the shared DungeonPlan map model and the normal Aralia Button primitive.
 */
import React from 'react';
import type { DungeonPlan } from '../../systems/worldforge/dungeon/types';
import { type DungeonMapAnnotation } from '../../systems/worldforge/dungeon/world/dungeonMap';
export interface DungeonParchmentPage {
    levelId: string;
    plan: DungeonPlan;
    discoveredCellKeys: readonly string[];
    annotations: readonly DungeonMapAnnotation[];
}
interface DungeonParchmentMapProps {
    pages: readonly DungeonParchmentPage[];
    initialLevelId: string;
    onClose: () => void;
}
declare const DungeonParchmentMap: React.FC<DungeonParchmentMapProps>;
export default DungeonParchmentMap;
