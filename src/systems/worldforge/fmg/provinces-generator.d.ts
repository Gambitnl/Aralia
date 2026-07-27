import type { Pack } from "./features";
import type { NamesGenerator } from "./names-generator";
import type { CoaGenerator } from "./coa-generator";
import type { BurgsModule } from "./burgs-generator";
export interface Province {
    i: number;
    removed?: boolean;
    state: number;
    lock?: boolean;
    center: number;
    burg: number;
    name: string;
    formName: string;
    fullName: string;
    color: string;
    coa: any;
    pole?: [number, number];
}
export interface ProvincesContext {
    pack: Pack;
    seed: string;
    provincesRatio: number;
    Names: NamesGenerator;
    COA: CoaGenerator;
    Burgs: BurgsModule;
}
export declare class ProvincesModule {
    private ctx;
    forms: Record<string, Record<string, number>>;
    constructor(ctx: ProvincesContext);
    generate(regenerate?: boolean, regenerateLockedStates?: boolean): void;
    getPoles(): void;
}
