/**
 * @file name-bases.ts — ported from Azgaar's Fantasy-Map-Generator (MIT).
 * Upstream: .tmp/azgaar-src/src/modules/names-generator.ts `getNameBases()`.
 * See ./ATTRIBUTION.md.
 *
 * FROZEN DATA: the 43 default name bases (real-world by Azgaar, fantasy by
 * Wesley Lancel/Korash Sanjari/Paulo Santos, Levantine by Avengium) copied
 * verbatim. The Markov-chain name generator derives every culture/burg/state
 * name from these strings — any edit changes generated names for all seeds.
 */
export interface NameBase {
    name: string;
    i: number;
    min: number;
    max: number;
    d: string;
    m: number;
    b: string;
}
export declare function getNameBases(): NameBase[];
