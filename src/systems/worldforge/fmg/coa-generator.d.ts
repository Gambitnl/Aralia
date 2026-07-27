import type { Pack } from "./features";
/**
 * Create a per-run COA generator (upstream `window.COA` IIFE).
 * @param emblemShape upstream `emblemShape` select value; "culture",
 *   "random" and "state" form the "Diversiform" optgroup, any other value is
 *   a fixed shield shape returned as-is by getShield.
 * @param pack the pack whose cultures/states getShield reads.
 */
export declare function createCoaGenerator(emblemShape: string, pack: Pack): {
    generate: (parent: any, kinship: any, dominion: any, type: any) => any;
    getShield: (culture: any, state: any) => any;
    shields: Record<string, any>;
};
export type CoaGenerator = ReturnType<typeof createCoaGenerator>;
