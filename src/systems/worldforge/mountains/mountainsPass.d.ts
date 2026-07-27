import type { Pack } from '../fmg/features';
import { type RangeKind } from './mountainClusters';
/** One named range on the pack (mirrored to AtlasRange by the adapter). */
export interface PackRange {
    /** 1-based range id — 0 is reserved for "no range" (FMG id convention). */
    i: number;
    /** "<Culture> <BankWord>", e.g. "Elden Spine" (post-dedup unique). */
    name: string;
    kind: RangeKind;
    /** Member pack-cell ids, ascending. Every range cell is in exactly one range. */
    cells: number[];
    /** The h >= PEAK_MIN_H core-mountain subset of cells, ascending. */
    coreCells: number[];
    /** Label anchor (pole of inaccessibility), FMG pixel space like cells.p. */
    pole: [number, number];
}
/** One named peak on the pack (mirrored to AtlasPeak by the adapter). */
export interface PackPeak {
    /** 1-based peak id, global across ranges in creation order. */
    i: number;
    /** Owning range's 1-based id. */
    rangeI: number;
    /** The peak's pack cell. */
    cellId: number;
    /** Encoded pack height (0–100 scale) at the peak cell. */
    h: number;
    /** Adopted marker-note name ("Mount X") or a fresh culture+form name. */
    name: string;
}
/** One named pass on the pack — detected and filled by `detectPasses` (the
 * LAST step of generateMountains), mirrored to AtlasPass by the adapter. */
export interface PackPass {
    /** 1-based pass id. */
    i: number;
    /** The range this pass crosses (1-based id). */
    rangeI: number;
    /** The crossing's highest route cell. */
    cellId: number;
    name: string;
    /** Routes (pack route ids) that cross through this pass. */
    routeIds: number[];
}
/**
 * Generate `pack.ranges` + `pack.peaks` from the world seed. Deterministic;
 * additive-only; draws exclusively from its own seeded stream (file header).
 *
 * Call AFTER the FMG markers stage and the forests pass (generateWorld stage
 * 37) — the pass reads cells.h, cells.culture, cultures, and pack.markers
 * (volcano kind + name adoption). `notes` is the world's legend-note array
 * (generateWorld's in-scope `notes`); optional — see the adoption header.
 */
export declare function generateMountains(pack: Pack, seed: string, notes?: Array<{
    id: string;
    name: string;
}>): void;
