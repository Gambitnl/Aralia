/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 20/07/2026, 01:17:13
 * Dependents: components/DesignPreview/steps/PreviewBuilding3D.tsx
 * Imports: None
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
/**
 * This file turns one in-game hour into the Building Lab's complete light and
 * weather mood, then samples cheap smoke from real chimney boxes.
 *
 * The preview renderer calls these pure functions so dawn, noon, dusk, night,
 * and every point between them share one clock. Tests and screenshot tooling can
 * pass an explicit smoke time, while the live renderer may pass its elapsed frame
 * time. No saved building fact, generator draw, or camera decision changes here.
 */
export type AtmosphereMood = 'night' | 'dawn' | 'day' | 'golden-hour' | 'dusk';
export interface BuildingAtmosphere {
    /** Normalized 0-24 hour used for every value below. */
    hour: number;
    mood: AtmosphereMood;
    skyColor: string;
    hazeColor: string;
    groundColor: string;
    sunColor: string;
    sunIntensity: number;
    /** Multiplied by the visible building span in the renderer. */
    sunPositionScale: readonly [number, number, number];
    hemisphereIntensity: number;
    sideFillIntensity: number;
    overheadFillIntensity: number;
    roofEmissiveIntensity: number;
    contactShadowOpacity: number;
    /** Fog distances are multiplied by the visible building span. */
    hazeNearScale: number;
    hazeFarScale: number;
    /** A shallow, transparent ground sheet used only when this is above zero. */
    groundFogOpacity: number;
}
/** Wrap arbitrary fractional clock values into one stable 24-hour day. */
export declare function normalizeAtmosphereHour(hour: number): number;
/**
 * Resolve every atmosphere control from one continuous clock value.
 * The mood label changes at the midpoint only for receipts; all visible values
 * still interpolate continuously.
 */
export declare function buildingAtmosphereAtHour(hour: number): BuildingAtmosphere;
export declare const MAX_SMOKE_CHIMNEYS = 4;
export declare const SMOKE_PARTICLES_PER_CHIMNEY = 5;
export interface SmokeSourceBox {
    kind: string;
    x: number;
    y: number;
    z0: number;
    h: number;
}
export interface ChimneySmokeSource {
    x: number;
    y: number;
    topFt: number;
}
export interface ChimneySmokeParticle {
    chimneyIndex: number;
    particleIndex: number;
    x: number;
    y: number;
    zFt: number;
    scale: number;
    opacity: number;
}
/** Select the first bounded set of real visible chimney boxes in model order. */
export declare function chimneySmokeSources(boxes: readonly SmokeSourceBox[]): ChimneySmokeSource[];
/**
 * Sample a wispy plume at an explicit time. Every puff rises, widens, fades,
 * and drifts in the same gentle wind; a chimney-position phase keeps multiple
 * flues from moving in lockstep without consuming any random stream.
 */
export declare function sampleChimneySmoke(sources: readonly ChimneySmokeSource[], seconds: number): ChimneySmokeParticle[];
