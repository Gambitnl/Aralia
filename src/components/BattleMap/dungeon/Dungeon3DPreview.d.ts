/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 21/07/2026, 01:47:39
 * Dependents: components/DesignPreview/steps/PreviewDungeon.tsx, components/World3D/DungeonExpeditionOverlay.tsx
 * Imports: 6 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
/**
 * This file presents a generated dungeon as an explorable three-dimensional scene.
 *
 * It consumes the plain placement records from dungeonSceneModel.ts and batches floors,
 * walls, doors, furniture, evidence, flames, and encounters into instanced meshes. Camera
 * presets and orbit controls make the result useful as both a whole-plan inspection tool and
 * an atmospheric preview. In mounted gameplay, each accepted grid position reports nearby plan
 * cells to the durable exploration ledger. No generation logic lives here, so the parchment and
 * 3D modes cannot disagree about what dungeon was built or what happened to it. A caller may now
 * supply the exact arrival cell selected by a level transition, allowing ascent to restore the
 * parent stair without changing collision or generation. Transition controls remain in the
 * expedition overlay; unsupported combat and completion interactions remain outside this renderer.
 *
 * Called by: PreviewDungeon.tsx when the user selects the 3D Expedition view.
 * Depends on: React Three Fiber for the canvas and drei for accessible camera controls/labels.
 */
import React from 'react';
import type { Cell, DungeonPlan } from '../../../systems/worldforge/dungeon/types';
import type { DungeonIdentity } from '../../../systems/worldforge/dungeon/world/dungeonIdentity';
export type DungeonCameraPreset = 'tactical' | 'entrance' | 'objective';
export interface Dungeon3DOverlays {
    graph: boolean;
    loops: boolean;
    critical: boolean;
    heatmap: boolean;
    rooms: boolean;
    props: boolean;
    spawns: boolean;
    secrets: boolean;
}
/** The deepest-level boss objective the mounted expedition can complete to finish the dungeon. */
export interface Dungeon3DObjectiveTarget {
    id: string;
    cell: Cell;
}
export interface Dungeon3DGameplay {
    identity: DungeonIdentity;
    claimedTreasureIds: readonly string[];
    onClaimTreasure: (eventId: string) => void;
    /** Encounters already cleared on this level, as persisted by the canonical lifecycle ledger. */
    clearedEncounterIds: readonly string[];
    /** Defeating a generated encounter reports its stable id; the reducer owns durable progress. */
    onClearEncounter: (eventId: string) => void;
    /** Current-level discovery already stored by the canonical dungeon lifecycle ledger. */
    discoveredCellKeys: readonly string[];
    /** Movement reports only newly visible canonical cell keys; the reducer owns persistence. */
    onDiscoverCells: (cellKeys: readonly string[]) => void;
    /** Present only when this mounted level exposes the deepest generated boss objective. */
    objective?: Dungeon3DObjectiveTarget | null;
    /** Reaching and defeating the boss reports its objective id so the dungeon can complete. */
    onCompleteObjective?: (objectiveId: string) => void;
    /** Exact floor cell selected by entry, descent, or parent ascent for this mounted level. */
    initialPlayerCell?: Cell;
}
interface Dungeon3DPreviewProps {
    plan: DungeonPlan;
    overlays: Dungeon3DOverlays;
    /** Present only in the mounted product expedition; design preview remains inspection-only. */
    gameplay?: Dungeon3DGameplay;
}
export declare const Dungeon3DPreview: React.FC<Dungeon3DPreviewProps>;
export default Dungeon3DPreview;
