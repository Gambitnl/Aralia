/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 12/07/2026, 00:34:41
 * Dependents: components/World3D/WebGPUProbeScene.tsx, components/World3D/World3DScene.tsx
 * Imports: 1 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
/**
 * @file World3DLighting.tsx
 * @description Sun + sky + atmosphere for the streamed 3D ground world
 * (beautification wave, lighting lift — sub-spec beautification--lighting-migration.md).
 *
 * What lives here:
 * - Time-of-day sun model: `sunFromTime(hours)` maps a fractional hour to a sun
 *   direction + warm/cool color mix. Plumbed but fixed at a pleasant late-morning
 *   default by the host (no UI yet); the game clock can drive it later.
 * - Atmospheric `Sky` dome (drei / three in-tree Preetham) aligned to the same sun.
 * - Warm directional sun key + cool-sky/warm-ground hemisphere fill (battle-map
 *   parity: BattleMap3D uses the same warm-key/cool-fill split).
 * - Soft shadows (ground profile only): bounded ortho shadow camera that FOLLOWS
 *   the camera each frame with texel snapping, so a small high-res frustum covers
 *   the walking-scale neighbourhood instead of one giant acne-prone frustum over
 *   the whole streamed window. Continent profile keeps shadows off — the km-scale
 *   window is what caused the historical shadow-pass stalls.
 * - Distance fog tinted to the sky horizon so far terrain dissolves instead of
 *   ending on a flat page-background band.
 *
 * WebGL + WebGPU safe: standard three lights/materials only, no TSL.
 */
import React from 'react';
import { type CanopyInterior } from './canopyInterior';
export interface SunState {
    /** Unit-ish sun direction (points FROM origin TOWARD the sun). */
    direction: [number, number, number];
    /** Sun key light color (warm near horizon, neutral-warm at noon). */
    sunColor: number;
    sunIntensity: number;
    hemiSkyColor: number;
    hemiGroundColor: number;
    hemiIntensity: number;
    /** Fog / horizon haze tint, matched to the sky so the two blend. */
    fogColor: number;
    /** Gradient-sky zenith color (deep blue high sun, indigo at dusk). */
    skyZenith: number;
    /** Gradient-sky horizon-band color, matched to the fog so they blend. */
    skyHorizon: number;
}
/**
 * Simple analytic time-of-day model. Daylight-only for now (the streamed world
 * has no night mode yet): hours outside ~6..20 clamp to the nearest daylight edge.
 * Pure and deterministic so it can be tested and later driven by the game clock.
 */
export declare function sunFromTime(hours: number): SunState;
/**
 * Default time-of-day: late-afternoon golden hour. A lower sun gives a warmer
 * key colour, long dramatic shadows, and a richly-scattered (non-washed) sky —
 * the whole reason for shifting off the old flat late-morning default. The
 * `sunFromTime` time-of-day model stays intact and plumbed for the game clock;
 * only this tuning default changed.
 */
export declare const DEFAULT_TIME_OF_DAY_H = 18.2;
/**
 * The far cascade is useful only after the camera rises into a true town
 * overview. At walking and opening-diorama heights the near 440-metre-wide
 * shadow map already covers the visible play space; replaying every caster into
 * a second 1.7-kilometre map cost roughly one third of the delivered frames.
 */
export declare const FAR_SHADOW_ENABLE_HEIGHT_M = 90;
/** Pure threshold used by the live light and its regression test. */
export declare function shouldUseFarShadow(cameraY: number, referenceSurfaceY: number): boolean;
declare const World3DLighting: React.FC<{
    viewProfile: 'continent' | 'ground';
    timeOfDayHours?: number;
    /**
     * Canopy atmosphere (forests Task 11): already-damped modulation values from
     * the scene — hemisphere intensity × lightMul, ground-profile fog pulled to
     * fogNear/fogFar. Null (the default) renders the exact pre-canopy values.
     */
    interior?: CanopyInterior | null;
    /** Spawn-ground elevation used to distinguish walking height from overview. */
    shadowReferenceY?: number;
}>;
export default World3DLighting;
