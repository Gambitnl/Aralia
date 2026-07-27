import type { Pack } from '../fmg/features';
import { type ForestKind } from './forestClusters';
/** One named forest on the pack (mirrored to AtlasForest by the adapter). */
export interface PackForest {
    /** 1-based forest id — 0 is reserved for "no forest" (FMG id convention). */
    i: number;
    /** "<Culture> <BankWord>", e.g. "Angshire Wildwood". */
    name: string;
    kind: ForestKind;
    /** Member pack-cell ids, ascending. Every cell is in exactly one forest. */
    cells: number[];
    /** Label anchor (pole of inaccessibility), FMG pixel space like cells.p. */
    pole: [number, number];
}
/**
 * Generate `pack.forests` from the world seed. Deterministic; additive-only;
 * draws exclusively from its own seeded stream (see file header).
 *
 * Call AFTER biomes and the civilization layer exist (generateWorld stage 36)
 * — the pass reads cells.biome, cells.f, cells.burg, cells.culture and
 * cultures for kinds and names.
 */
export declare function generateForests(pack: Pack, seed: string): void;
/** Forests-era alias of the shared geographic dedup (see block comment). */
export declare const dedupeForestNames: (forests: PackForest[]) => void;
