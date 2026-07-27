import { Spell } from '../types';
export interface SpellManifestInfo {
    name: string;
    level: number;
    school: string;
    path: string;
}
export type SpellManifest = Record<string, SpellManifestInfo>;
declare class SpellService {
    private static instance;
    private manifest;
    private spellCache;
    private constructor();
    static getInstance(): SpellService;
    getAllSpellInfo(): Promise<SpellManifest | null>;
    getSpellDetails(spellId: string): Promise<Spell | null>;
}
export declare const spellService: SpellService;
export {};
