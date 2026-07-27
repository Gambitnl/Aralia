/**
 * @file townPropForms.ts — render-form table for the owned TOWN prop
 * generators (beautification wave, owned-generators slice).
 *
 * Maps each upgraded defId to its cached seeded geometry variants so
 * GroundProps can render one vertex-colored InstancedMesh per (def, variant)
 * with a single data-driven loop. Seeds are frozen constants → the same
 * variants forever (the per-instance `variation.variant` picks among them,
 * exactly like the boulder/bush/log forms).
 *
 * All geometries are unit-frame (ground contact at y = 0) and carry a baked
 * `color` attribute — render with `vertexColors` and yLift 0.
 */
import type * as THREE from 'three';
export interface TownPropForm {
    /** Cached geometry variants; instance `variant % length` selects one. */
    geometries: THREE.BufferGeometry[];
}
/** Build all town-prop geometry variants (call once, memoized by the renderer). */
export declare function buildTownPropForms(): Record<string, TownPropForm>;
/** DefIds upgraded to owned meshes — GroundProps must NOT route these through RENDER_VARIANT. */
export declare const TOWN_PROP_FORM_IDS: readonly ["gravestone", "tomb", "stone-cross", "lantern-post", "tavern-sign", "fingerpost", "statue", "milestone", "wayside-shrine", "anvil", "grindstone", "scarecrow", "brazier"];
