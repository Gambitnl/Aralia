import type { Pack } from "./features";
import type { Grid } from "./utils/graphUtils";
import type { NamesGenerator } from "./names-generator";
import type { CoaGenerator } from "./coa-generator";
import type { RoutesModule } from "./routes-generator";
export interface Burg {
    cell: number;
    x: number;
    y: number;
    i?: number;
    state?: number;
    culture?: number;
    name?: string;
    feature?: number;
    capital?: number;
    lock?: boolean;
    port?: number;
    removed?: boolean;
    population?: number;
    type?: string;
    coa?: any;
    citadel?: number;
    plaza?: number;
    walls?: number;
    shanty?: number;
    temple?: number;
    group?: string;
    link?: string;
    MFCG?: string;
}
export interface BurgGroup {
    name: string;
    active: boolean;
    order: number;
    features?: Record<string, boolean>;
    percentile?: number;
    min?: number;
    max?: number;
    biomes?: number[];
    preview?: string;
    isDefault?: boolean;
}
export interface BurgsContext {
    pack: Pack;
    grid: Grid;
    graphWidth: number;
    graphHeight: number;
    statesNumber: number;
    manorsNumber: number;
    burgGroups: BurgGroup[];
    Names: NamesGenerator;
    COA: CoaGenerator;
    Routes: RoutesModule;
}
export declare class BurgsModule {
    private ctx;
    constructor(ctx: BurgsContext);
    shift(): void;
    generate(): Burg[];
    getType(cellId: number, port?: number): "Generic" | "Nomadic" | "Highland" | "Lake" | "Naval" | "River" | "Hunting";
    private definePopulation;
    private defineEmblem;
    private defineFeatures;
    getDefaultGroups(): BurgGroup[];
    defineGroup(burg: Burg, populations: number[]): void;
    specify(): void;
}
