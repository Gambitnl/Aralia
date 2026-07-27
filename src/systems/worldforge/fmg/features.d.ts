/**
 * ARCHITECTURAL ADVISORY:
 * CRITICAL CORE SYSTEM: Changes here ripple across the entire city.
 *
 * Last Sync: 10/07/2026, 13:11:03
 * Dependents: systems/worldforge/fmg/biomes.ts, systems/worldforge/fmg/burgs-generator.ts, systems/worldforge/fmg/coa-generator.ts, systems/worldforge/fmg/cultures-generator.ts, systems/worldforge/fmg/generateAtlas.ts, systems/worldforge/fmg/generateBase.ts, systems/worldforge/fmg/ice.ts, systems/worldforge/fmg/lakes.ts, systems/worldforge/fmg/markers-generator.ts, systems/worldforge/fmg/military-generator.ts, systems/worldforge/fmg/names-generator.ts, systems/worldforge/fmg/provinces-generator.ts, systems/worldforge/fmg/rankCells.ts, systems/worldforge/fmg/reGraph.ts, systems/worldforge/fmg/religions-generator.ts, systems/worldforge/fmg/river-generator.ts, systems/worldforge/fmg/routes-generator.ts, systems/worldforge/fmg/states-generator.ts, systems/worldforge/fmg/utils/graphUtils.ts, systems/worldforge/fmg/zones-generator.ts, systems/worldforge/provenance/worldCell.ts
 * Imports: 5 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
import type { Grid } from "./utils/graphUtils";
import type { Cells, Point, Vertices } from "./voronoi";
type FeatureType = "ocean" | "lake" | "island";
export interface PackedGraphFeature {
    i: number;
    type: FeatureType;
    land: boolean;
    border: boolean;
    cells: number;
    firstCell: number;
    vertices: number[];
    area: number;
    shoreline: number[];
    height: number;
    group: string;
    temp: number;
    flux: number;
    evaporation: number;
    name: string;
    inlets?: number[];
    outlet?: number;
    river?: number;
    enteringFlux?: number;
    closed?: boolean;
    outCell?: number;
}
export interface GridFeature {
    i: number;
    land: boolean;
    border: boolean;
    type: FeatureType;
}
/**
 * Packed-graph shape used by markupPack/defineGroups and the slice-2 stages —
 * subset of upstream's PackedGraph type (.tmp/azgaar-src/src/types/PackedGraph.ts).
 * Built by the reGraph stage (./reGraph.ts); rivers/biomes fields are added by
 * Rivers.generate (./river-generator.ts) and Biomes.define (./biomes.ts).
 */
export interface Pack {
    cells: Cells & {
        p: Point[];
        g?: Uint8Array | Uint16Array | Uint32Array;
        h: Uint8Array | Uint16Array | Uint32Array;
        area?: Uint8Array | Uint16Array | Uint32Array;
        t?: Int8Array;
        f?: Uint16Array;
        haven?: Uint8Array | Uint16Array | Uint32Array;
        harbor?: Uint8Array;
        fl?: Uint16Array;
        r?: Uint16Array;
        conf?: Uint8Array | Uint16Array;
        biome?: Uint8Array;
        s?: Int16Array;
        pop?: Float32Array;
        culture?: Uint16Array;
        burg?: Uint16Array;
        state?: Uint16Array;
        religion?: Uint16Array;
        province?: Uint16Array;
        routes?: Record<number, Record<number, number>>;
        q?: import("./utils/quadtree").Quadtree<number[]>;
    };
    vertices: Vertices;
    features: PackedGraphFeature[];
    rivers?: import("./river-generator").River[];
    cultures?: import("./cultures-generator").Culture[];
    burgs?: import("./burgs-generator").Burg[];
    states?: import("./states-generator").State[];
    routes?: import("./routes-generator").Route[];
    religions?: import("./religions-generator").Religion[];
    provinces?: import("./provinces-generator").Province[];
    ice?: import("./ice").IceElement[];
    forests?: import("../forests/forestsPass").PackForest[];
    ranges?: import("../mountains/mountainsPass").PackRange[];
    peaks?: import("../mountains/mountainsPass").PackPeak[];
    passes?: import("../mountains/mountainsPass").PackPass[];
}
export declare class FeatureModule {
    private DEEPER_LAND;
    private LANDLOCKED;
    private LAND_COAST;
    private UNMARKED;
    private WATER_COAST;
    private DEEP_WATER;
    /**
     * calculate distance to coast for every cell
     */
    private markup;
    /**
     * mark Grid features (ocean, lakes, islands) and calculate distance field
     */
    markupGrid(grid: Grid, seed: string): void;
    /**
     * mark PackedGraph features (oceans, lakes, islands) and calculate distance field
     */
    markupPack(pack: Pack, graphWidth: number, graphHeight: number): void;
    /**
     * define feature groups (ocean, sea, gulf, continent, island, isle, freshwater lake, salt lake, etc.)
     */
    defineGroups(grid: Grid, pack: Pack): void;
}
/** Module-level singleton, mirroring upstream `window.Features`. */
export declare const Features: FeatureModule;
export {};
