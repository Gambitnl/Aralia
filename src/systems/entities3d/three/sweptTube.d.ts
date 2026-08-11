/**
 * @file sweptTube.ts — one continuous CatmullRom-swept tube with an
 * interpolated radius profile: the Dragon Forge body technique.
 *
 * Build once (fixed station × radial vertex grid, indexed, with fan caps),
 * then recompute vertices IN PLACE each frame from the driver's live control
 * points. ~700 verts of CPU math a frame is far cheaper than the old metaball
 * field and keeps the walking/IK animation Dragon Forge itself lacks.
 */
import { Color, Material, Mesh, Vector3 } from 'three';
export interface SweptTubeOptions {
    /** Stations along the curve (rings). Dragon Forge uses 88; 24–48 suits us. */
    stations: number;
    /** Vertices per ring; 7–8 gives the low-poly facet read. */
    radial: number;
    material: Material;
    /** Optional inverse-hull ink shell sharing the same geometry. */
    outlineMaterial?: Material | null;
    /**
     * Countershading: when set, a vertex-color attribute blends `belly` into the
     * underside of the tube (by how far each ring vertex points down) and `body`
     * everywhere else. The material must have vertexColors enabled and a white
     * base color — the attribute carries the full tint. Frenet frames twist on
     * tightly coiled curves, so this is tuned for gentle spines/tails/necks.
     */
    countershade?: {
        body: Color;
        belly: Color;
    };
    /** Scale-ring VALUE bands (round 18, creature-anatomy): `count` evenly
     * spaced darkened rings along the tube, up to `strength` (0..1) darkening,
     * fading toward the belly. Requires `countershade`. */
    bands?: {
        count: number;
        strength: number;
    };
}
export interface SweptTube {
    readonly mesh: Mesh;
    /** Ink shell mesh (present when outlineMaterial was given). */
    readonly outline: Mesh | null;
    /** Recompute all vertices from control points + a radius profile (both in
     * meters; radii knots spread evenly along the curve like Dragon Forge's py). */
    update(points: Vector3[], radii: number[]): void;
    triangles(): number;
    dispose(): void;
}
/** Linear interpolation over evenly spaced radius knots (Dragon Forge `py`). */
export declare function sampleRadiusProfile(knots: number[], t: number): number;
export declare function createSweptTube(options: SweptTubeOptions): SweptTube;
