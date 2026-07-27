import { type Pt, type SubmapModel, type SubmapParentContext } from './submapEngine';
import { type SeedPath } from '../seedPath';
import type { FmgAtlasResult } from '../fmg/generateAtlas';
export interface NeighbourhoodCell {
    /** Atlas pack cell id. */
    cellId: number;
    /** The drilled cell at the centre of the neighbourhood. */
    isFocus: boolean;
    /** Explored ⇒ render its submap; otherwise grey + basic info. Focus is always explored. */
    explored: boolean;
    /** Cell polygon in the shared, cluster-scaled frame. */
    polygon: Pt[];
    /** Basic top-level info shown for grey (and any) cells. */
    biome?: string;
    burgName?: string;
    /** Generated submap — present only for the focus + explored neighbours. */
    model?: SubmapModel;
}
export interface AtlasNeighbourhood {
    focusCellId: number;
    /** The focus cell's scaled context — parent for drilling deeper into the focus. */
    focusCtx: SubmapParentContext;
    cells: NeighbourhoodCell[];
}
export interface NeighbourhoodOptions {
    /** Sites per generated submap. */
    submapCount?: number;
    /** Canonical cluster span the focus+neighbours are scaled to. */
    canonSpan?: number;
}
/**
 * Build the neighbourhood view-model for a focus atlas cell.
 * @param isExplored predicate: has the party physically explored this atlas cell?
 */
export declare function buildAtlasNeighbourhood(atlas: FmgAtlasResult, focusCellId: number, isExplored: (cellId: number) => boolean, seedPath: SeedPath, opts?: NeighbourhoodOptions): AtlasNeighbourhood;
