/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 11/06/2026, 02:47:05
 * Dependents: components/Worldforge/AtlasDemo.tsx, components/Worldforge/atlasDraw.ts
 * Imports: 6 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
/**
 * @file atlasArtifact.ts — FMG atlas result → Worldforge AtlasArtifact adapter.
 *
 * Spec: docs/projects/worldforge/SPEC.md §4 (layer model, feet canon), §11
 * (options frozen in artifact; cell ids canonical). Build-order item 2
 * (adapter slice, directive B1).
 *
 * What changed: new module (B1).
 * Why: FmgAtlasResult lives in FMG-pixel space with FMG-metric semantics;
 * AtlasArtifact lives in Worldforge feet-canon space (SPEC §4 decision #12).
 * This adapter is the single conversion boundary.
 * Preserved: no spine/fmg files edited; all types consumed read-only.
 *
 * ── px → feet derivation ──────────────────────────────────────────────────
 * Source: .tmp/azgaar-src/src/renderers/draw-scalebar.ts (upstream render).
 *   val = (init * size * distanceScale) / scaleLevel   // distance in distanceUnit
 *   length = (val * scaleLevel) / distanceScale         // pixels
 * → pixels = init * size  →  1 px = distanceScale / (init * size) in distanceUnit
 *
 * At scaleLevel=1 (the cartographic identity zoom), init=100, size=1:
 *   1 px = distanceScale [distanceUnit]
 *
 * Upstream default (options.js line ~612):
 *   distanceScale = gauss(3, 1, 1, 5)  →  centre 3
 *   distanceUnit  = "km"  (non-US locale default)
 *
 * Therefore: DEFAULT canonical value is 1 FMG pixel = 3 km = 3 000 m.
 * In Worldforge feet-canon (SPEC §4, 1 ft = 0.3048 m exactly per units.ts):
 *   3 000 m × (1 ft / 0.3048 m) ≈ 9 842.52 ft/px
 *
 * Worldforge worlds use the default distanceScale (3 km/px). If the
 * world-creation UI later exposes distanceScale as a WorldGenOptions field,
 * this constant becomes a derived value rather than a hard default — for now
 * it is the only value the default options surface produces.
 * ─────────────────────────────────────────────────────────────────────────
 */
import { type Feet } from '../units';
import { type AtlasArtifact } from '../artifacts';
import type { FmgAtlasResult } from '../fmg/generateAtlas';
import type { FmgWorldResult } from '../fmg/generateWorld';
import { type WorldGenOptions } from './worldGenOptions';
/**
 * Feet per one FMG graph-unit pixel, derived from the default distance scale.
 *   3 km/px × 1000 m/km × (1/0.3048) ft/m ≈ 9842.52 ft/px
 *
 * FROZEN constant: changing this value changes all artifact coordinates for
 * every existing world. Do not alter without an owner-approved world-break
 * decision (SPEC §4 / AGENTS.md determinism rules).
 */
export declare const FEET_PER_FMG_PIXEL: Feet;
/** Convert an FMG pixel coordinate to Worldforge feet. */
export declare function feetFromFmgPixel(px: number): Feet;
/** The returned artifact type: AtlasArtifact augmented with frozen options. */
export type AtlasArtifactWithOptions = AtlasArtifact & {
    options: Readonly<WorldGenOptions>;
};
type AtlasAdapterInput = FmgAtlasResult | FmgWorldResult;
/**
 * Convert an FmgAtlasResult (FMG pixel space) into the spine's
 * feet-canon AtlasArtifact, recording the resolved world-gen options
 * verbatim and frozen (SPEC §11).
 *
 * @param fmgAtlas - The result of `generateFmgAtlas`.
 * @param worldSeed - Numeric world seed (determines the root seed path).
 * @param options   - Resolved WorldGenOptions (null mapSize/lat/lon should
 *                    already be replaced with their drawn values by the
 *                    caller, or pass them as-is and they are stored verbatim).
 */
export declare function buildAtlasArtifact(fmgAtlas: AtlasAdapterInput, worldSeed: number, options: WorldGenOptions): AtlasArtifactWithOptions;
export {};
