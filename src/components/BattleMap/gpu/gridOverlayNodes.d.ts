/**
 * @file gridOverlayNodes.ts
 * @description TSL translation of the WebGL battle-map grid/movement overlay
 * (`terrain/GridOverlay.tsx`'s `ShaderMaterial`). The WebGL overlay draws faint
 * grid lines plus valid-move (green), active-path (blue), and blocked (dark)
 * tile fills from a per-tile RGBA state DataTexture, faded by a global opacity.
 *
 * Rung 3 of the WebGPU battle-map port (wave spec §8). Rebuilds the exact same
 * look as `colorNode` + `opacityNode` for an unlit transparent
 * `MeshBasicNodeMaterial`, driven by the same `uTileStateMap` texture and a
 * `uniform` opacity the scene lerps for the fade-in/out.
 *
 * The AoE/targeting overlay rides the same state texture: the scene packs the
 * AoE set into the state map's alpha channel and this node tints those tiles.
 *
 * TESTABILITY: the builders take a texture + uniforms and return real TSL nodes
 * (no GPU), so the graph construction is unit-tested in CI.
 */
import { vec4 } from 'three/tsl';
import type { Texture } from 'three/webgpu';
type N = any;
export interface GridOverlayNodeParams {
    /** RGBA per-tile state: R=validMove, G=activePath, B=blocked, A=aoe. */
    stateTex: Texture;
    mapWidth: number;
    mapHeight: number;
    lineWidth: number;
    /** A `uniform(float)` node the scene lerps for the fade transition. */
    opacityUniform: N;
}
/** Build the grid overlay's `colorNode`. */
export declare function buildGridColorNode(p: GridOverlayNodeParams): N;
/** Build the grid overlay's `opacityNode` (already multiplied by fade opacity). */
export declare function buildGridOpacityNode(p: GridOverlayNodeParams): N;
export { vec4 };
