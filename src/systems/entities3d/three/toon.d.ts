/**
 * @file toon.ts — shared toon-shading pieces, ported from the blobfolk
 * prototype: 3-step gradient ramp, inverse-hull outline, and a canvas-free
 * radial blob shadow (shader-based so it works headless).
 */
import { DataTexture, MeshBasicMaterial, MeshToonMaterial, ShaderMaterial } from 'three';
/** How generated entity bodies are drawn. */
export type EntityRenderMode = 'solid' | 'wireframe';
/**
 * The global default look for generated entities. Every consumer that does
 * not pass its own `renderMode` inherits this. `'solid'` (toon-shaded bodies
 * with ink outlines) is the shipping look; `'wireframe'` remains available as
 * an explicit opt-in (forge debug toggle) — it was the global default from
 * 2026-07-12 until the creature-quality pass made solid bodies the better
 * first impression everywhere.
 */
export declare const ENTITY_RENDER_MODE: EntityRenderMode;
/** The 3-step toon ramp all entity materials share. */
export declare function toonGradient(): DataTexture;
export declare function toonMaterial(colorHex: string): MeshToonMaterial;
/**
 * Unlit wireframe material — draws only the triangle edges of a mesh. The
 * colour is brightened a touch so the lines read against sky and ground
 * without a filled surface behind them.
 */
export declare function wireframeMaterial(colorHex: string): MeshBasicMaterial;
/** The material factory for a render mode: toon-shaded solid, or wireframe. */
export declare function entityMaterial(mode: EntityRenderMode): (colorHex: string) => MeshToonMaterial | MeshBasicMaterial;
/** Inverse-hull ink outline: render the same geometry inflated, back faces only.
 *
 * Skeleton pivot slice 1: the vertex shader now includes the three.js skinning
 * chunks. On a plain Mesh nothing changes (every chunk is guarded by
 * USE_SKINNING, which three only defines when the object is a SkinnedMesh),
 * but on a skinned body the ink shell follows the bones instead of freezing in
 * bind pose. The inflation happens in bind space along the bind normal, then
 * the bone transform carries the inflated vertex — exact for rigid weights. */
export declare function outlineMaterial(colorHex: string, thickness?: number): ShaderMaterial;
/** Soft radial ground shadow without canvas textures (headless-safe). */
export declare function blobShadowMaterial(): ShaderMaterial;
