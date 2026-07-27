/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 19/07/2026, 22:07:05
 * Dependents: components/Worldforge/AtlasSvgView.tsx
 * Imports: 3 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
import React from 'react';
import { type AtlasSvgModel } from './atlasSvg';
export interface AtlasLayersProps {
    model: AtlasSvgModel;
    visible: Record<string, boolean>;
    /**
     * Mount decorative relief and forest stamps in bounded animation-frame slices.
     * MapPane enables this for a newly worker-prepared world so thousands of
     * non-interactive paths cannot form one long browser task. Existing callers
     * default to the original immediate render.
     */
    deferDecorativeGlyphs?: boolean;
    /**
     * P1 perf — whether the `#atlas-soften` Gaussian-blur filter should be applied
     * to the biome/overlay groups. AtlasSvgView already zeroes the filter's
     * `stdDeviation` once zoomed in past ~2× the fit scale (`zoomedIn`), but a
     * stdDeviation-0 blur STILL forces the browser to allocate and walk the filter
     * region for ~8 groups (≈1900 nodes) on every pan/zoom frame. Gating the
     * `filter=` attribute off entirely above that threshold removes the filter
     * pass altogether (not just a no-op blur), so panning/zooming a zoomed-in atlas
     * does no per-frame rasterization.
     *
     * Defaults to `true` so callers that don't pass it keep the original
     * filter-always-on behaviour — the low-zoom look is unchanged. AtlasSvgView
     * should pass `softenActive={softenStdDev > 0}` (i.e. `!zoomedIn`) to mirror its
     * own cutoff; see the cross-file follow-up note in AtlasSvgView.tsx (~544).
     */
    softenActive?: boolean;
}
/**
 * The heavy static layer subtree of the atlas (ocean + biomes/cultures/.../burgs/
 * markers/military — thousands of SVG nodes when per-cell layers are on). Split
 * out and `React.memo`'d so that HOVER and PAN/ZOOM in `AtlasSvgView` — which
 * change `hoveredCell`/`view` but not `model`/`visible` — do NOT reconcile this
 * whole tree. The transform lives on the parent `<g>`; the hover highlight is a
 * cheap sibling. This is the fix for the World Map freeze (re-rendering ~4k–18k
 * nodes on every mouse move). Props are shallow-compared: same `model` + same
 * `visible` ref ⇒ skipped.
 */
declare function AtlasLayersImpl({ model, visible, softenActive, deferDecorativeGlyphs }: AtlasLayersProps): React.ReactElement;
/** Memoized: re-renders only when `model` or the `visible` object identity changes. */
declare const AtlasLayers: React.MemoExoticComponent<typeof AtlasLayersImpl>;
export default AtlasLayers;
