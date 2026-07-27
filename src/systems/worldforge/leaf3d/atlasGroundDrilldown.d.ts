/**
 * ARCHITECTURAL ADVISORY:
 * SHARED UTILITY: Multiple systems rely on these exports.
 *
 * Last Sync: 17/07/2026, 22:08:08
 * Dependents: App.tsx, components/World3D/World3DWrapper.tsx, components/Worldforge/AtlasDemo.tsx, components/Worldforge/LocalMapView.tsx, components/Worldforge/WorldforgeGroundDrilldown.tsx, services/saveLoadService.ts, state/appState.ts, systems/worldforge/leaf3d/atlasGroundRestore.ts
 * Imports: 1 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
import type { LocalArtifact, RegionArtifact } from '../artifacts';
/**
 * This file defines the canonical in-session receipt that carries one Atlas selection into ground 3D.
 *
 * Atlas creates the receipt from the Region and Local artifacts it already owns. The 3D
 * renderer then validates and renders those same objects, so a town or site cannot quietly
 * turn into a separately regenerated approximation during descent.
 */
export type GroundFocus = {
    kind: 'town';
    id: number;
    label: string;
    xFt: number;
    yFt: number;
} | {
    kind: 'site';
    id: number;
    label: string;
    xFt: number;
    yFt: number;
} | {
    kind: 'local';
    id: string;
    label: string;
    xFt: number;
    yFt: number;
};
/** Current JSON contract for a saved Atlas ground address. */
export declare const ATLAS_GROUND_ADDRESS_SCHEMA_VERSION: 1;
/**
 * Stable focus identity stored in a save slot.
 *
 * Labels are deliberately omitted because the regenerated Local is their
 * authority. Kind, source id, and exact authored coordinates are sufficient to
 * reject a renamed, moved, removed, or foreign destination.
 */
export type AtlasGroundFocusAddress = {
    kind: 'town';
    id: number;
    xFt: number;
    yFt: number;
} | {
    kind: 'site';
    id: number;
    xFt: number;
    yFt: number;
} | {
    kind: 'local';
    id: string;
    xFt: number;
    yFt: number;
};
/**
 * Compact save-state reference for one native Atlas descent.
 *
 * This contains only deterministic lineage and coordinates. Region and Local
 * artifacts are intentionally absent because their typed arrays and generated
 * object graphs are reconstructed from the same canonical pipeline after load.
 */
export interface AtlasGroundAddress {
    schemaVersion: typeof ATLAS_GROUND_ADDRESS_SCHEMA_VERSION;
    worldSeed: number;
    atlasCellId: number;
    regionSeedPath: string;
    regionBounds: RegionArtifact['bounds'];
    localSeedPath: string;
    localBounds: LocalArtifact['bounds'];
    focus: AtlasGroundFocusAddress;
    returnTier: 'local';
}
/**
 * The hierarchy tier PLAYING must restore when the player opens the map again.
 *
 * Wave 1 keeps the actual artifacts in memory. Wave 2 will need a serialized
 * version of this target plus deterministic artifact reconstruction on reload.
 * The named tier is intentionally explicit so deeper hierarchy tiers can extend
 * the return-target union without replacing today's Local contract.
 */
export interface AtlasGroundReturnTarget {
    tier: 'local';
    atlasCellId: number;
    regionSeedPath: string;
    localSeedPath: string;
}
/**
 * Canonical navigation receipt owned by Atlas and handed to PLAYING ground 3D.
 *
 * Region and Local are deliberate object references, not regeneration hints.
 * Keeping the exact objects here prevents PLAYING from replacing the selected
 * Local with a cell-centered approximation. This receipt is transient in Wave 1:
 * App component memory owns it, so save/reload support remains Wave 2 work.
 */
export interface AtlasGroundDrilldown {
    worldSeed: number;
    atlasCellId: number;
    regionSeedPath: string;
    localSeedPath: string;
    localBounds: LocalArtifact['bounds'];
    focus: GroundFocus;
    region: RegionArtifact;
    local: LocalArtifact;
    returnTarget: AtlasGroundReturnTarget;
}
/** Convert an already-validated runtime receipt into its JSON-safe address. */
export declare function atlasGroundAddressFromDrilldown(drilldown: AtlasGroundDrilldown): AtlasGroundAddress;
/**
 * Accept only the versioned, finite, compact address shape from a save slot.
 *
 * Semantic checks that require world generation happen during reconstruction;
 * this first boundary prevents malformed JSON values such as null coordinates,
 * unsupported versions, or copied artifact objects from entering game state.
 */
export declare function normalizeAtlasGroundAddress(input: unknown): AtlasGroundAddress | null;
export declare function groundFocusesForLocal(local: LocalArtifact): GroundFocus[];
export declare function buildAtlasGroundDrilldown(input: {
    worldSeed: number;
    atlasCellId: number;
    region: RegionArtifact;
    local: LocalArtifact;
    focus: GroundFocus;
}): AtlasGroundDrilldown;
export declare function artifactsForAtlasGroundDrilldown(drilldown: AtlasGroundDrilldown): {
    region: RegionArtifact;
    local: LocalArtifact;
};
export declare function groundStartForFocus(local: LocalArtifact, focus: GroundFocus): readonly [number, number];
