/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 12/06/2026, 03:51:17
 * Dependents: systems/worldforge/delta/applyDeltas.ts, systems/worldforge/delta/serialize.ts, systems/worldforge/world/worldStore.ts
 * Imports: 3 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
/**
 * @file types.ts - Worldforge delta-layer persistence contracts.
 *
 * The generated artifact is the deterministic base; this file describes the
 * small saved records that replay player/world mutations on top of that base.
 * Each delta targets one seed-addressed artifact and one stable entity inside
 * it, so future generators can rebuild the same base and then apply only the
 * recorded changes.
 */
import type { LocalFeature } from '../artifacts';
import type { SeedPath } from '../seedPath';
import type { Feet } from '../units';
export declare const WORLD_DELTA_SCHEMA_VERSION = 1;
export declare const WORLD_DELTA_OPERATION_VERSION = 1;
export type JsonValue = string | number | boolean | null | JsonValue[] | {
    [key: string]: JsonValue;
};
export type JsonObject = {
    [key: string]: JsonValue;
};
export type WorldDeltaOperation = {
    kind: 'remove-feature';
    featureId: number;
} | {
    kind: 'set-feature-state';
    featureId: number;
    key: string;
    value: JsonValue;
} | {
    kind: 'add-feature';
    feature: LocalFeature;
} | {
    kind: 'modify-plot';
    plotId: number;
    role?: string;
    storeys?: number;
} | {
    kind: 'remove-plot';
    plotId: number;
} | {
    kind: 'add-building';
    plotId: number;
    buildingId: number;
    role: string;
    storeys: number;
    /**
     * Optional world-feet quad. If absent, replay reuses an existing plot's
     * footprint or creates a rectangle from x/y/widthFt/depthFt below.
     */
    footprint?: Array<[Feet, Feet]>;
    /** Center point for a default rectangle when no plot footprint exists. */
    x?: Feet;
    y?: Feet;
    /** Default rectangle size when footprint is omitted; 40x40 ft fallback. */
    widthFt?: Feet;
    depthFt?: Feet;
    /** Extra marker data for render/UI systems; interiors use the plot fields. */
    featureData?: JsonObject;
};
export interface WorldDelta {
    id: string;
    schemaVersion: number;
    opVersion: number;
    artifactSeedPath: SeedPath;
    entityKey: string;
    sequence: number;
    operation: WorldDeltaOperation;
}
export interface DeltaWarning {
    deltaId: string;
    message: string;
}
