import type { Pack } from "./features";
import type { NamesGenerator } from "./names-generator";
import type { RoutesModule } from "./routes-generator";
import type { MapNote } from "./military-generator";
export interface Zone {
    i: number;
    name: string;
    type: string;
    cells: number[];
    color: string;
}
export interface ZonesContext {
    pack: Pack;
    Names: NamesGenerator;
    Routes: RoutesModule;
    notes: MapNote[];
}
export declare class ZonesModule {
    private config;
    private pack;
    private Names;
    private Routes;
    private notes;
    constructor(context: ZonesContext);
    generate(globalModifier?: number): void;
    private addInvasion;
    private addRebels;
    private addProselytism;
    private addCrusade;
    private addDisease;
    private getDiseaseName;
    private addDisaster;
    private addEruption;
    private addAvalanche;
    private addFault;
    private addFlood;
    private addTsunami;
}
