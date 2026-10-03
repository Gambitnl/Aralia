/**
 * @file InteriorLights.tsx — interior lighting for the streamed 3D town.
 *
 * The sun + hemisphere fill (World3DLighting) light the OUTSIDE; roofs shadow
 * the sun so interiors go pitch black. This adds the two RENDER-side interior
 * lights the emissive-only lit-windows / lit-hearth data can't provide on its
 * own:
 *
 *  1. FLAME point lights — a warm, shadowless <pointLight> at the hearth of each
 *     lit-hearth building within ~40 m of the camera. Hard-capped at 4, nearest
 *     first, reselected each frame as the camera moves. Zero lights when nothing
 *     is lit. These make a hearthside room glow from a real source (bodies cast
 *     no shadow but pick up the warm falloff) rather than only the emissive box.
 *
 *  2. CAMERA-INSIDE fill — one neutral light that fades in when the camera is
 *     inside a building shell (cheap footprint-bounds + under-roof test) so any
 *     interior is readable at ANY hour, even a dark unlit house at noon. Smooth
 *     0.3 s intensity lerp so there is no pop crossing the threshold.
 *
 * DATA vs RENDER: which windows glow and where the hearths are flows through the
 * existing SitePart plumbing (emissiveHex tags, baked deterministically). This
 * component only does render-side, camera-relative SELECTION — legitimately not
 * deterministic data. No per-frame allocations in the selector loop.
 */
import React from 'react';
import type { LoadedChunk } from '@/systems/world3d/types';
import { type SceneOrigin } from '@/systems/world3d/sceneOrigin';
/** One hearth's world-scene position (already rebased to the scene origin). */
export interface HearthLight {
    x: number;
    y: number;
    z: number;
    /**
     * The site's 24-hour hearth schedule (`hearthHours[h]` = lit at hour h).
     * Undefined for legacy/unscheduled sites (always eligible). The per-frame
     * selector skips a hearth whose current hour is dark before the distance test.
     */
    hearthHours?: boolean[];
}
/** One building shell's scene-space bounds for the camera-inside test. */
export interface ShellBounds {
    /** Group origin (scene meters). */
    cx: number;
    cz: number;
    /** Yaw applied to the group (radians). */
    rotationY: number;
    /** Half extents along the group's local width/depth axes (meters). */
    halfW: number;
    halfD: number;
    /** Group base Y (ground surface) and shell top height above it. */
    baseY: number;
    topY: number;
}
/**
 * Flatten the loaded chunks into (a) every lit-hearth world position and (b)
 * every interior-bearing shell's bounds, in scene space. Recomputed only when
 * the loaded-chunk set changes (keyed by chunk coords) — never per frame.
 */
export declare const INTERIOR_LIGHT_TUNING: {
    readonly MAX_HEARTH_LIGHTS: 4;
    readonly HEARTH_RANGE_M: 40;
    readonly HEARTH_INTENSITY: 14;
    readonly HEARTH_DISTANCE_M: 9;
    readonly FILL_TARGET_INTENSITY: 1.15;
    readonly FILL_FADE_S: 0.3;
};
export declare function collectInteriorLighting(loaded: LoadedChunk[], origin: SceneOrigin): {
    hearths: HearthLight[];
    shells: ShellBounds[];
};
declare const InteriorLights: React.FC<{
    loaded: LoadedChunk[];
    origin: SceneOrigin;
}>;
export default InteriorLights;
