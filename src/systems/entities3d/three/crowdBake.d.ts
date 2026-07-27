/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 26/07/2026, 23:09:39
 * Dependents: components/World3D/GroundAgents.tsx, components/World3D/crowdInstancePlan.ts
 * Imports: 7 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
/**
 * @file crowdBake.ts — crowd stand-ins: bake a generated entity into static
 * walk-cycle keyframe geometries so hundreds of street commuters render as
 * instanced meshes instead of live metaball fields.
 *
 * One archetype = one representative body per ancestry group, baked to
 * [idle, walkPhase0 … walkPhaseN-1] merged geometries with per-vertex colors
 * (body v2: the segment skeleton is posed, its meshes are snapshotted —
 * no field extraction)
 * (body = skin tone, gear/features = their part colors). A crowd renderer
 * buckets agents by (group, phase) and swaps instances between phase
 * geometries as their gait advances — the blobfolk look at instancing cost.
 *
 * Bake-time only: nothing here runs per frame.
 */
import { BufferGeometry } from 'three';
import type { EntityBlueprint } from '../types';
export declare const CROWD_WALK_PHASES = 8;
export interface CrowdArchetype {
    /** [idle, walk phase 0 … walk phase N-1] — feet at y=0, meters. */
    geometries: BufferGeometry[];
    heightM: number;
}
/** Bake the full keyframe set for one blueprint. */
export declare function bakeCrowdArchetype(blueprint: EntityBlueprint): CrowdArchetype;
/** One representative baked body per ancestry group, cached for the session. */
export declare function crowdArchetypeForGroup(group: string): CrowdArchetype;
