import React from 'react';
import type { AtlasNeighbourhood } from '../../systems/worldforge/submap/neighbourhood';
export interface NeighbourhoodSvgViewProps {
    neighbourhood: AtlasNeighbourhood;
    width?: number;
    height?: number;
    /** Atlas cell the party currently occupies — cell-level "You are here" fallback. */
    playerCellId?: number | null;
    /** Player's precise sub-cell index within the FOCUS submap (gold highlight). */
    playerCellIndex?: number | null;
    /** Per-save scope for the drill-tier layer toggles (pass the world seed). */
    prefsScope?: string | number;
    /** Drill deeper: a focus-cell sub-cell was clicked (siteIndex into the focus submap). */
    onPickCell?: (siteIndex: number) => void;
    /** Recenter: a neighbour atlas cell was clicked (its cellId). */
    onPickNeighbour?: (cellId: number) => void;
}
/**
 * Region-tier renderer (fog-of-war): the focus cell's submap surrounded by its
 * atlas neighbours. Explored cells (focus + visited) render their submap; grey
 * unexplored cells show basic info (biome/burg). Click a focus sub-cell to drill
 * deeper; click a neighbour to recenter the neighbourhood on it.
 */
declare const NeighbourhoodSvgView: React.FC<NeighbourhoodSvgViewProps>;
export default NeighbourhoodSvgView;
