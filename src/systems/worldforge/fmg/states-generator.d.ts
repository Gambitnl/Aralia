import type { Pack } from "./features";
import type { BiomesData } from "./biomes";
import type { NamesGenerator } from "./names-generator";
import type { CoaGenerator } from "./coa-generator";
interface Campaign {
    name: string;
    start: number;
    end?: number;
    attacker?: number;
    defender?: number;
}
export interface State {
    i: number;
    name: string;
    expansionism: number;
    capital: number;
    type: string;
    center: number;
    culture: number;
    coa: any;
    lock?: boolean;
    removed?: boolean;
    pole?: [number, number];
    neighbors?: number[];
    color?: string;
    cells?: number;
    area?: number;
    burgs?: number;
    rural?: number;
    urban?: number;
    campaigns?: Campaign[];
    diplomacy?: string[];
    formName?: string;
    fullName?: string;
    form?: string;
    military?: any[];
    provinces?: number[];
}
export interface StatesContext {
    pack: Pack;
    biomesData: BiomesData;
    sizeVariety: number;
    growthRate: number;
    year: number;
    Names: NamesGenerator;
    COA: CoaGenerator;
}
export declare class StatesModule {
    private ctx;
    constructor(ctx: StatesContext);
    private createStates;
    private getBiomeCost;
    private getHeightCost;
    private getRiverCost;
    private getTypeCost;
    generate(): void;
    expandStates(): void;
    normalize(): void;
    getPoles(): void;
    findNeighbors(): void;
    assignColors(): void;
    collectStatistics(): void;
    generateCampaign(state: State): Campaign[];
    generateCampaigns(): void;
    generateDiplomacy(): void;
    defineStateForms(list?: number[] | null): void;
    getFullName(state: State): string;
}
export {};
