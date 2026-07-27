import type { Pack } from "./features";
import type { State } from "./states-generator";
export interface MilitaryUnit {
    icon: string;
    name: string;
    rural: number;
    urban: number;
    crew: number;
    power: number;
    type: string;
    separate: number;
    /** Optional unit limits (editor feature; empty in default options). */
    biomes?: number[];
    states?: number[];
    cultures?: number[];
    religions?: number[];
}
export interface Regiment {
    i: number;
    /** Total troops. */
    a: number;
    cell: number;
    x: number;
    y: number;
    bx: number;
    by: number;
    /** Troops by unit name. */
    u: Record<string, number>;
    /** 1 = naval. */
    n: number;
    name: string;
    state: number;
    icon?: string;
}
export interface MapNote {
    id: string;
    name: string;
    legend: string;
}
export interface MilitaryContext {
    pack: Pack;
    /** Unit roster; defaults to getDefaultOptions() like upstream. */
    military?: MilitaryUnit[];
    /** People per population point (upstream populationRateInput, default 1000). */
    populationRate?: number;
    /** Urban population multiplier (upstream urbanizationInput, default 1). */
    urbanization?: number;
    /** Calendar values for regiment notes (upstream options.year/era/eraShort). */
    year?: number;
    era?: string;
    eraShort?: string;
    /** Sink for generated map notes (upstream global `notes`). */
    notes?: MapNote[];
}
export declare class MilitaryModule {
    options: MilitaryUnit[];
    private pack;
    private populationRate;
    private urbanization;
    private year;
    private era;
    private eraShort;
    private notes;
    constructor(context: MilitaryContext);
    static getDefaultOptions(): MilitaryUnit[];
    generate(): void;
    getTotal(reg: Regiment): string | number;
    getName(r: Regiment, regiments: Regiment[]): string;
    getEmblem(r: Regiment): string;
    generateNote(r: Regiment, s: State): void;
}
