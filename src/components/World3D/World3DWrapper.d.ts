/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 19/07/2026, 08:34:15
 * Dependents: App.tsx
 * Imports: 56 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
/**
 * @file src/components/World3D/World3DWrapper.tsx
 * Wraps World3DScene and connects the camera position to game state dispatch.
 *
 * Responsibilities:
 * 1. Renders World3DScene with the correct loader and start position
 * 2. Listens to camera position changes and dispatches SET_PLAYER_WORLD_POS
 * 3. Resolves terrain height (Y) from WorldData during position updates
 * 4. Throttles position dispatches to ~10Hz to avoid dispatch spam
 * 5. Renders InWorldHUD overlay (control panel, view-mode toggle, debug)
 * 6. Builds a worker-backed ChunkLoader for PLAYING (W3DUI-1) so mesh work stays off the main thread
 *
 * Sandbox `World3DDemo` still uses an inline loader; only this PLAYING wrapper uses the worker path.
 */
import React from 'react';
import type { GroundWorld } from '../../systems/worldforge/bridge/groundChunkLoader';
import { type AtlasGroundDrilldown } from '../../systems/worldforge/leaf3d/atlasGroundDrilldown';
import type { BuildingEventLogsByBurg } from '../../systems/worldforge/interior/blueprintTypes';
import type { TownSimRegistry } from '../../systems/worldforge/townsim/townSimRegistry';
interface World3DWrapperProps {
    /** Initial world position to start at. */
    entryPosition: {
        x: number;
        y: number;
        z: number;
    };
    /** Exact transient Atlas selection; absent for Classic map and developer entry. */
    atlasGroundDrilldown?: AtlasGroundDrilldown | null;
    /**
     * Click-to-talk: called with an NPC figure's id when the player clicks a
     * townsperson/stranger in the 3D world. App wires this to the same `talk`
     * action the 2D action pane runs, so the dialogue opens with full bookkeeping.
     */
    onTalkToNpc?: (npcId: string) => void;
}
export type GroundLoaderFactory = typeof import('../../systems/worldforge/bridge/groundChunkLoader').createGroundChunkLoader;
export declare function createAtlasReceiptGroundSession(drilldown: AtlasGroundDrilldown, createGroundLoader: GroundLoaderFactory, options?: Parameters<GroundLoaderFactory>[3]): {
    ground: GroundWorld;
    start: readonly [number, number, number];
    surfaceY: number;
};
/**
 * Strip the living-town registry down to worker-safe building history only.
 * Sorted numeric keys make the serialized effect dependency stable when
 * unrelated villagers, news, or prosperity change.
 */
export declare function compactBuildingEventLogs(registry: TownSimRegistry | undefined): BuildingEventLogsByBurg | undefined;
/**
 * Name the registered business owners that belong to the retained GroundWorld.
 *
 * The Atlas entry cell can sit beside a town's own cell, so cell-only NPC
 * selectors can omit the exact Local's keepers. These ids use the same burg and
 * plot identity as registerTownContent, giving PLAYING a small clickable cast
 * that routes through the existing talk/dialogue and merchant systems.
 */
export declare function retainedTownNpcIdsForGround(ground: GroundWorld | null): string[];
declare const World3DWrapper: React.FC<World3DWrapperProps>;
export default World3DWrapper;
