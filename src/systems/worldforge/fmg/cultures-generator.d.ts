import type { Pack } from "./features";
import type { Grid } from "./utils/graphUtils";
import type { BiomesData } from "./biomes";
import type { NamesGenerator } from "./names-generator";
import type { CoaGenerator } from "./coa-generator";
export interface Culture {
    name: string;
    i: number;
    base: number;
    shield: string;
    lock?: boolean;
    code?: string;
    center?: number;
    sort?: (i: number) => number;
    odd?: number;
    color?: string;
    type?: string;
    expansionism?: number;
    origins?: (number | null)[];
    removed?: boolean;
    cells?: number;
    area?: number;
    rural?: number;
    urban?: number;
}
export type CulturesSet = "world" | "european" | "oriental" | "english" | "antique" | "highFantasy" | "darkFantasy" | "random";
/** `data-max` per culturesSet option (upstream src/index.html select). */
export declare const CULTURES_SET_MAX: Record<CulturesSet, number>;
export interface CulturesContext {
    pack: Pack;
    grid: Grid;
    graphWidth: number;
    graphHeight: number;
    biomesData: BiomesData;
    culturesNumber: number;
    culturesSet: CulturesSet;
    sizeVariety: number;
    emblemShape: string;
    Names: NamesGenerator;
    COA: CoaGenerator;
}
export declare class CulturesModule {
    private ctx;
    cells: any;
    constructor(ctx: CulturesContext);
    getRandomShield(): string;
    getDefault(count?: number): Omit<Culture, "i">[];
    generate(): void;
    expand(): void;
}
