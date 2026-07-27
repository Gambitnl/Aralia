/**
 * ARCHITECTURAL ADVISORY:
 * SHARED UTILITY: Multiple systems rely on these exports.
 *
 * Last Sync: 17/07/2026, 22:33:27
 * Dependents: components/MapPane.tsx, components/World3D/World3DWrapper.tsx, components/Worldforge/AtlasDemo.tsx, services/saveLoadService.ts, state/appState.ts, state/reducers/worldReducer.ts
 * Imports: 1 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
/**
 * This file keeps live Atlas-ground coordinates and discovered places attached to
 * the exact World -> Region -> Local address that authored them.
 *
 * PLAYING calls these helpers whenever the avatar moves or finds a hidden place.
 * Save/load and map views call the same normalizers, so a stale coordinate cannot
 * silently reopen in another Local and a pin from one world cannot appear in another.
 * Legacy Classic-map discoveries remain readable because only records that opt into
 * the versioned Atlas provenance are held to the stricter contract.
 *
 * Called by: World3DWrapper, worldReducer, saveLoadService, App/Atlas map views
 * Depends on: the compact AtlasGroundAddress contract from atlasGroundDrilldown
 */
import type { AtlasGroundAddress } from './atlasGroundDrilldown';
export declare const ATLAS_GROUND_POSITION_SCHEMA_VERSION: 1;
export interface AtlasGroundPosition {
    schemaVersion: typeof ATLAS_GROUND_POSITION_SCHEMA_VERSION;
    worldSeed: number;
    atlasCellId: number;
    regionSeedPath: string;
    localSeedPath: string;
    localBounds: AtlasGroundAddress['localBounds'];
    xM: number;
    zM: number;
}
export declare const ATLAS_GROUND_DISCOVERY_SCHEMA_VERSION: 1;
export type AtlasGroundDiscoverySourceKind = 'hidden-site' | 'dungeon-entrance';
export interface AtlasGroundDiscoveryProvenance {
    schemaVersion: typeof ATLAS_GROUND_DISCOVERY_SCHEMA_VERSION;
    worldSeed: number;
    atlasCellId: number;
    regionSeedPath: string;
    localSeedPath: string;
    localBounds: AtlasGroundAddress['localBounds'];
    source: {
        kind: AtlasGroundDiscoverySourceKind;
        id: string;
    };
    /** Exact Local-ground coordinates used by proximity discovery and return. */
    xM: number;
    zM: number;
    /** Exact absolute Atlas feet used by native Region/Local map rendering. */
    xFt: number;
    yFt: number;
}
export interface AtlasGroundDiscoveredSite {
    id: string;
    cellId: number;
    name?: string;
    kind?: string;
    offsetX?: number;
    offsetY?: number;
    atlasGround?: AtlasGroundDiscoveryProvenance;
}
export declare function atlasGroundPositionForAddress(address: AtlasGroundAddress, xM: number, zM: number): AtlasGroundPosition | null;
export declare function normalizeAtlasGroundPosition(input: unknown, expectedAddress?: AtlasGroundAddress | null): AtlasGroundPosition | null;
export declare function atlasGroundSpawnForAddress(address: AtlasGroundAddress, savedPosition: unknown, focusStart: readonly [number, number]): {
    xM: number;
    zM: number;
    source: 'saved-position' | 'selected-focus';
};
export declare function atlasHiddenSiteForAddress(input: {
    address: AtlasGroundAddress;
    sourceId: string;
    sourceKind: AtlasGroundDiscoverySourceKind;
    name?: string;
    kind?: string;
    xM: number;
    zM: number;
    offsetX?: number;
    offsetY?: number;
}): AtlasGroundDiscoveredSite | null;
export declare function normalizeDiscoveredHiddenSite(input: unknown): AtlasGroundDiscoveredSite | null;
export declare function normalizeDiscoveredHiddenSites(input: unknown): AtlasGroundDiscoveredSite[];
/** New Atlas pins are world-scoped; legacy Classic pins stay visible as before. */
export declare function discoveredSiteBelongsToWorld(site: AtlasGroundDiscoveredSite, worldSeed: number): boolean;
