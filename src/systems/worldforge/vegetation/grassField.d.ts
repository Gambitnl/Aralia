/**
 * @file grassField.ts
 * @description Deterministic near-camera grass instances for the streamed 3D
 * world (beautification wave, vegetation lift). Pure: given a chunk's terrain
 * grid (positions + vertex colors) and its chunk coords, emit blade-cluster
 * instances (crossed-quad rendering happens in the component). Grass only
 * grows where the terrain vertex color reads green (grass-painted biomes), so
 * roads/rock/sand/water stay clean. Height comes from bilinear interpolation
 * of the terrain grid — blades sit ON the surface, not floating.
 *
 * Density falloff with distance is handled by the renderer only mounting
 * grass for chunks near the camera; within a chunk density is constant.
 */
export interface GrassFieldInstances {
    /** x,y,z per instance (chunk-local, y on the terrain surface). */
    positions: Float32Array;
    /** Uniform-ish scale per instance. */
    scales: Float32Array;
    /** Y rotation per instance. */
    rotations: Float32Array;
    /** r,g,b per instance — terrain color, slightly varied. */
    tints: Float32Array;
    count: number;
    cacheKey: string;
}
/**
 * Smooth seeded value noise in [0,1] over chunk-uv space (two octaves,
 * bilinear + smoothstep). Drives patchy density: clearings and thickets
 * instead of statistically flat coverage. Lattice values come from hash01 on
 * WORLD-space lattice coords so the field is continuous-ish per chunk and
 * fully deterministic from (cx, cy).
 *
 * Exported as `patchNoise2` (forests Task 10): the shared patch-noise
 * PRIMITIVE. Grass patchiness here and the 3D tree thicket/clearing gate +
 * undergrowth in generateLocal all call this function, but with DIFFERENT
 * salts/frequencies/coordinate spaces — so grass gaps and canopy clearings do
 * NOT currently line up (aligning them means retuning grass salts, a visual
 * decision parked in the forests spec's Open list). Pure in (u, v, salt,
 * freq) — callers that feed world-space coords (e.g. world feet / 1000) get a
 * field that continues seamlessly across chunk/window borders. The function
 * body is unchanged from the private valueNoise2 it used to be; the alias
 * below keeps grass call sites as-is.
 */
export declare function patchNoise2(u: number, v: number, salt: number, freq: number): number;
export interface GrassFieldOptions {
    /** Candidate samples per chunk (survivors depend on green coverage). */
    samples?: number;
    /** Chunk world edge length in meters. */
    chunkSize: number;
}
export declare const GRASS_SAMPLES_PER_CHUNK = 2600;
/**
 * Build the grass instances for one chunk. Deterministic from (cx, cy) and the
 * terrain grid content.
 */
export declare function buildGrassField(terrain: {
    positions: Float32Array;
    colors: Float32Array;
}, cx: number, cy: number, opts: GrassFieldOptions): GrassFieldInstances;
