import React from 'react';
import { type SubmapModel } from '../../systems/worldforge/submap/submapEngine';
import type { RoutePlan } from '../../systems/travel/routePlanning';
export interface SubmapSvgViewProps {
    model: SubmapModel;
    width?: number;
    height?: number;
    /** Fired with the picked sub-cell's siteIndex on click (drives the deeper drill). */
    onPickCell?: (siteIndex: number) => void;
    /** Index (into model.cells) of the sub-cell the player occupies, or null. */
    playerCellIndex?: number | null;
    /** Travel mode: hovering a sub-cell previews the fastest route to it. */
    travelActive?: boolean;
    /** Plan the fastest route from the player to a hovered sub-cell index. */
    planRoute?: (toCellIndex: number) => RoutePlan | null;
    /** Transport label for the travel readout. */
    transportLabel?: string;
    /** Per-save scope for the drill-tier layer toggles (pass the world seed). */
    prefsScope?: string | number;
}
/**
 * SP2 renderer for an SP1 `SubmapModel`: the parent-shaped Voronoi submap — cells
 * filled (burg/feature cells highlighted), boundary inked, burg labeled — with
 * fit-to-view + manual pan/zoom and click-to-drill. Clicking a cell resolves it
 * by point-in-polygon and reports its siteIndex so the host can recurse.
 */
declare const SubmapSvgView: React.FC<SubmapSvgViewProps>;
export default SubmapSvgView;
