import type { Pack } from "./features";
import type { BiomesData } from "./biomes";
import type { NamesGenerator } from "./names-generator";
import type { RoutesModule } from "./routes-generator";
interface ReligionBase {
    type: "Folk" | "Organized" | "Cult" | "Heresy";
    form: string;
    culture: number;
    center: number;
}
interface NamedReligion extends ReligionBase {
    name: string;
    deity: string | null;
    expansion: string;
    expansionism: number;
    color: string;
}
export interface Religion extends NamedReligion {
    i: number;
    code?: string;
    origins?: number[] | null;
    lock?: boolean;
    removed?: boolean;
    cells?: number;
    area?: number;
    rural?: number;
    urban?: number;
}
export interface ReligionsContext {
    pack: Pack;
    graphWidth: number;
    graphHeight: number;
    biomesData: BiomesData;
    religionsNumber: number;
    growthRate: number;
    Names: NamesGenerator;
    Routes: RoutesModule;
}
export declare class ReligionsModule {
    private ctx;
    constructor(ctx: ReligionsContext);
    generate(): void;
    private generateFolkReligions;
    private generateOrganizedReligions;
    private specifyReligions;
    private combineReligions;
    private defineOrigins;
    private getReligionsInRadius;
    private expandReligions;
    private spreadFolkReligions;
    private checkCenters;
    getDeityName(culture: number): string | undefined;
    private generateReligionName;
    private generateMeaning;
}
export {};
