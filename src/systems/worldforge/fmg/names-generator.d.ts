import { type NameBase } from "./name-bases";
import type { Pack } from "./features";
type MarkovChain = string[][] & Record<string, string[]>;
export declare class NamesGenerator {
    chains: (MarkovChain | null)[];
    nameBases: NameBase[];
    /** assigned by generateWorld before any culture-based method is called */
    pack: Pack | null;
    constructor(nameBases?: NameBase[]);
    calculateChain(namesList: string): MarkovChain;
    updateChain(index: number): void;
    clearChains(): void;
    getBase(base: number, min?: number, max?: number, dupl?: string): string;
    getCulture(culture: number, min?: number, max?: number, dupl?: string): string;
    getCultureShort(culture: number): string;
    getBaseShort(base: number): string;
    private validateSuffix;
    getState(name: string, culture: number, base?: number): string;
}
export {};
