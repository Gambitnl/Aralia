/**
 * @file partBuilder.ts — shared assembler for owned multi-part prop geometry.
 *
 * The WAVE-1 generators (rock/log/bush) are single-material blobs; the town
 * props (gravestones, lantern posts, statues, anvils…) are COMPOSED shapes
 * with several material tones. Rather than per-part meshes (which would break
 * InstancedMesh batching in GroundProps), each generator merges its parts into
 * ONE non-indexed BufferGeometry with a baked per-vertex `color` attribute —
 * one InstancedMesh per (def, variant) with `vertexColors` renders the lot.
 *
 * Conventions:
 *  - Unit frame: geometry origin at the GROUND CONTACT point (y = 0 is the
 *    ground), so GroundProps places with yLift = 0.
 *  - Deterministic: generators drive all jitter from makeRng(seed); the
 *    builder itself is pure.
 *  - Flat-shaded: everything is non-indexed + computeVertexNormals so facets
 *    read hard-edged like the rest of the streamed world.
 */
import * as THREE from 'three';
export declare class PartBuilder {
    private positions;
    private colors;
    private readonly tmpColor;
    /**
     * Merge a primitive into the build. Takes ownership of `geo` (disposed).
     * Transform order: scale is already in the primitive args; rotation (XYZ
     * euler) then translation are applied here.
     */
    add(geo: THREE.BufferGeometry, color: string, position?: [number, number, number], rotation?: [number, number, number]): void;
    addBox(w: number, h: number, d: number, color: string, position: [number, number, number], rotation?: [number, number, number]): void;
    addCylinder(radiusTop: number, radiusBottom: number, height: number, segments: number, color: string, position: [number, number, number], rotation?: [number, number, number]): void;
    addSphere(radius: number, color: string, position: [number, number, number], widthSegs?: number, heightSegs?: number, scale?: [number, number, number]): void;
    /** Finish: one flat-shaded vertex-colored BufferGeometry, ground-origin. */
    build(): THREE.BufferGeometry;
}
export declare const P: {
    readonly WOOD: "#8a6a48";
    readonly WOOD_DARK: "#6e5238";
    readonly WOOD_PALE: "#a58a63";
    readonly STONE: "#8d8d86";
    readonly STONE_DARK: "#6f6f68";
    readonly STONE_PALE: "#a3a29a";
    readonly IRON: "#3d3f42";
    readonly STRAW: "#c9a94e";
    readonly CANVAS: "#d8cfb6";
    readonly EMBER: "#d96b2f";
    readonly GLOW: "#e8c96a";
    readonly BRONZE: "#7a6a4a";
};
