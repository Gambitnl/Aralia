/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 19/07/2026, 23:41:08
 * Dependents: components/Worldforge/AtlasSvgView.tsx
 * Imports: 1 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
/**
 * This file decides which existing settlements the atlas paints at each zoom.
 *
 * AtlasSvgView calls it with the current viewport and the canonical SVG burg
 * records. The helper never creates, removes, or relocates a settlement: it only
 * selects a deterministic, geographically spaced subset for the current view.
 * Exact burg ids and cells remain owned by the canonical atlas model.
 */
import type { AtlasSvgBurg, DeclutterView, LabelObstacle } from './atlasSvg';
export interface SettlementDisplayBudget {
    maxMarkers: number;
    maxLabels: number;
    showTowns: boolean;
    showVillages: boolean;
    markerSeparationPx: number;
}
/** Return a monotonic detail budget for the rendered viewport and zoom ratio. */
export declare function settlementDisplayBudget(width: number, height: number, zoomRatio: number): SettlementDisplayBudget;
export interface VisibleAtlasBurg {
    burg: AtlasSvgBurg;
    modelIndex: number;
    screenX: number;
    screenY: number;
}
/** Select the canonical burg records that are eligible to paint in this view. */
export declare function selectVisibleBurgs(burgs: ReadonlyArray<AtlasSvgBurg>, view: DeclutterView, width: number, height: number, budget: SettlementDisplayBudget): VisibleAtlasBurg[];
/** Convert visible settlement silhouettes into screen-space label obstacles. */
export declare function burgLabelObstacles(burgs: ReadonlyArray<VisibleAtlasBurg>): LabelObstacle[];
